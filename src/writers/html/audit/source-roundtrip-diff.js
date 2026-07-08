const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { collapseWhitespace } = require('../../../shared/text');
const { isRemoteReference, resolveLocalAssetReference } = require('../../../shared/assets');

const EMPTY_PROJECT_BOOLEAN_ATTRIBUTES = Object.freeze([
  HTML_DATA_ID_ATTRIBUTES.OBJECT,
  HTML_DATA_ID_ATTRIBUTES.IGNORE,
]);
const EMPTY_PROJECT_BOOLEAN_ATTRIBUTES_PATTERN = new RegExp(
  `\\s(${EMPTY_PROJECT_BOOLEAN_ATTRIBUTES.map(escapeRegExp).join('|')})\\s*=\\s*["']{2}`,
  'gi',
);

function auditAuthorSourceRoundtrip(options = {}) {
  const sourceRoot = options.sourceRoot && path.resolve(options.sourceRoot);
  const reverseRoot = options.reverseRoot && path.resolve(options.reverseRoot);
  const errors = [];
  const warnings = [];
  const addIssue = createIssueWriter({ errors, warnings, strict: !!options.strict });

  if (!sourceRoot || !fs.existsSync(path.join(sourceRoot, 'deck.config.json'))) {
    addIssue('ROUNDTRIP_SOURCE_CONFIG_MISSING', 'Source author package deck.config.json is missing.', {
      file: sourceRoot ? path.join(sourceRoot, 'deck.config.json') : 'deck.config.json',
    });
    return result(errors, warnings, { pagesCompared: 0, pagesExpected: 0 });
  }
  if (!reverseRoot || !fs.existsSync(path.join(reverseRoot, 'deck.config.json'))) {
    addIssue('ROUNDTRIP_REVERSE_CONFIG_MISSING', 'Reverse author package deck.config.json is missing.', {
      file: reverseRoot ? path.join(reverseRoot, 'deck.config.json') : 'deck.config.json',
    });
    return result(errors, warnings, { pagesCompared: 0, pagesExpected: 0 });
  }

  const sourcePackage = readAuthorPackage(sourceRoot);
  const reversePackage = readAuthorPackage(reverseRoot);
  compareConfigMetadata(sourcePackage, reversePackage, addIssue);
  auditReverseSourceQuality(reversePackage, addIssue);
  const reversePages = new Map(reversePackage.pages.map((page) => [page.id, page]));
  let pagesCompared = 0;

  for (const sourcePage of sourcePackage.pages) {
    const reversePage = reversePages.get(sourcePage.id);
    if (!reversePage) {
      addIssue('ROUNDTRIP_PAGE_MISSING', `Reverse author package is missing page ${sourcePage.id}.`, {
        page: sourcePage.id,
        expected: sourcePage.file,
      });
      continue;
    }
    pagesCompared += 1;
    comparePage(sourcePage, reversePage, addIssue);
  }
  if (pagesCompared === 0) {
    throw new Error('No comparable pages found between source and reverse author packages.');
  }

  const report = result(errors, warnings, {
    pagesCompared,
    pagesExpected: sourcePackage.pages.length,
    issues: errors.length + warnings.length,
  });
  if (options.includeSourceDrift) {
    report.sourceDrift = measureAuthorSourceDrift({ sourceRoot, reverseRoot });
  }
  return report;
}

function measureAuthorSourceDrift(options = {}) {
  const sourceRoot = options.sourceRoot && path.resolve(options.sourceRoot);
  const reverseRoot = options.reverseRoot && path.resolve(options.reverseRoot);
  const errors = [];

  if (!sourceRoot || !fs.existsSync(path.join(sourceRoot, 'deck.config.json'))) {
    errors.push({
      code: 'DRIFT_SOURCE_CONFIG_MISSING',
      message: 'Source author package deck.config.json is missing.',
      file: sourceRoot ? path.join(sourceRoot, 'deck.config.json') : 'deck.config.json',
    });
    return driftResult(errors, []);
  }
  if (!reverseRoot || !fs.existsSync(path.join(reverseRoot, 'deck.config.json'))) {
    errors.push({
      code: 'DRIFT_REVERSE_CONFIG_MISSING',
      message: 'Reverse author package deck.config.json is missing.',
      file: reverseRoot ? path.join(reverseRoot, 'deck.config.json') : 'deck.config.json',
    });
    return driftResult(errors, []);
  }

  const sourceConfig = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'deck.config.json'), 'utf8'));
  const reverseConfig = JSON.parse(fs.readFileSync(path.join(reverseRoot, 'deck.config.json'), 'utf8'));
  const files = collectComparableSourceFiles(sourceConfig, reverseConfig, sourceRoot, reverseRoot);
  const entries = files.map((file) => compareSourceFile(sourceRoot, reverseRoot, file));
  return driftResult(errors, entries);
}

function compareConfigMetadata(sourcePackage, reversePackage, addIssue) {
  const fields = ['id', 'title', 'profile'];
  const expected = {};
  const actual = {};
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(sourcePackage.config, field)) continue;
    expected[field] = normalizeConfigValue(sourcePackage.config[field]);
    actual[field] = normalizeConfigValue(reversePackage.config[field]);
  }
  if (Object.keys(expected).length && !deepEqual(expected, actual)) {
    addIssue('ROUNDTRIP_CONFIG_METADATA_CHANGED', 'Author package config metadata changed.', {
      file: 'deck.config.json',
      expected,
      actual,
    });
  }
}

function auditReverseSourceQuality(reversePackage, addIssue) {
  const structuredReverseModePattern = new RegExp(`\\s${escapeRegExp(HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE)}\\s*=\\s*["']structured["']`, 'i');
  const unknownSemanticPattern = new RegExp(`\\s${escapeRegExp(HTML_DATA_ID_ATTRIBUTES.SEMANTIC)}\\s*=\\s*["']unknown["']`, 'i');
  for (const page of reversePackage.pages) {
    if (structuredReverseModePattern.test(page.html)) {
      addIssue('ROUNDTRIP_REVERSE_MODE_LEAKED', 'Structured reverse bookkeeping leaked into editable author source.', {
        page: page.id,
        file: page.file,
        attribute: HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE,
      });
    }
    if (unknownSemanticPattern.test(page.html)) {
      addIssue('ROUNDTRIP_UNKNOWN_SEMANTIC_LEAKED', 'Unknown semantic marker leaked into editable author source.', {
        page: page.id,
        file: page.file,
        attribute: HTML_DATA_ID_ATTRIBUTES.SEMANTIC,
      });
    }
    const serializedEmpty = emptyProjectBooleanAttributes(page.html);
    if (serializedEmpty.length) {
      addIssue('ROUNDTRIP_EMPTY_DATA_ATTRIBUTE_SERIALIZED', 'Project boolean data attributes were serialized as empty string attributes.', {
        page: page.id,
        file: page.file,
        attributes: serializedEmpty,
      });
    }
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function comparePage(sourcePage, reversePage, addIssue) {
  compareEntries('ROUNDTRIP_TAG_SEQUENCE_CHANGED', sourcePage, reversePage, tagSequence, 'Element tag sequence changed.');
  compareEntries('ROUNDTRIP_TEXT_CHANGED', sourcePage, reversePage, pageText, 'Page text changed.');
  compareEntries('ROUNDTRIP_CHARACTER_STYLE_CHANGED', sourcePage, reversePage, characterStyleEntries, 'Character style spans changed.');
  compareEntries('ROUNDTRIP_INLINE_STYLE_CHANGED', sourcePage, reversePage, criticalInlineStyles, 'Critical inline styles changed.');
  compareEntries('ROUNDTRIP_TABLE_CELL_STYLE_CHANGED', sourcePage, reversePage, tableCellStyleEntries, 'Table cell paragraph styles changed.');
  compareResources(sourcePage, reversePage, addIssue);

  function compareEntries(code, expectedPage, actualPage, collect, message) {
    const expected = collect(expectedPage.$);
    const actual = collect(actualPage.$);
    if (!deepEqual(expected, actual)) {
      addIssue(code, message, {
        page: expectedPage.id,
        file: expectedPage.file,
        expected,
        actual,
      });
    }
  }
}

function compareResources(sourcePage, reversePage, addIssue) {
  const expected = resourceEntries(sourcePage.$);
  const actual = resourceEntries(reversePage.$);
  const expectedComparable = expected.map((entry) => comparableResourceEntry(entry, sourcePage.root));
  const actualComparable = actual.map((entry) => comparableResourceEntry(entry, reversePage.root));
  if (!deepEqual(expectedComparable, actualComparable)) {
    addIssue('ROUNDTRIP_RESOURCE_CHANGED', 'Resource references changed.', {
      page: sourcePage.id,
      file: sourcePage.file,
      expected,
      actual,
    });
  }
}

function readAuthorPackage(root) {
  const configPath = path.join(root, 'deck.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pageList = validateAuthorPages(config, configPath);
  const pages = pageList.map((page, index) => {
    const pageFile = path.join(root, page.file);
    const html = fs.existsSync(pageFile) ? fs.readFileSync(pageFile, 'utf8') : '';
    return {
      id: page.id || page.file || `page-${index + 1}`,
      file: page.file,
      root,
      html,
      $: cheerio.load(html, {
        decodeEntities: false,
        xmlMode: false,
      }),
    };
  });
  return { config, pages };
}

function validateAuthorPages(config, configPath) {
  if (!Array.isArray(config && config.pages) || config.pages.length === 0) {
    throw new Error(`Author package requires a non-empty pages array: ${configPath}`);
  }
  return config.pages.map((page, index) => {
    if (!page || typeof page !== 'object' || !page.file) {
      throw new Error(`Author package page ${index} is missing file: ${configPath}`);
    }
    return page;
  });
}

function collectComparableSourceFiles(sourceConfig, reverseConfig, sourceRoot, reverseRoot) {
  const files = new Set();
  addSourceFiles(files, sourceConfig);
  addSourceFiles(files, reverseConfig);
  return Array.from(files).filter((file) => (
    fs.existsSync(path.join(sourceRoot, file)) || fs.existsSync(path.join(reverseRoot, file))
  ));
}

function addSourceFiles(files, config) {
  files.add('deck.config.json');
  if (config && config.entry) files.add(slashPath(config.entry));
  for (const style of config && Array.isArray(config.styles) ? config.styles : []) {
    files.add(slashPath(style));
  }
  for (const page of config && Array.isArray(config.pages) ? config.pages : []) {
    if (page && page.file) files.add(slashPath(page.file));
  }
}

function compareSourceFile(sourceRoot, reverseRoot, file) {
  const sourcePath = path.join(sourceRoot, file);
  const reversePath = path.join(reverseRoot, file);
  const sourceExists = fs.existsSync(sourcePath);
  const reverseExists = fs.existsSync(reversePath);
  const sourceText = sourceExists ? fs.readFileSync(sourcePath, 'utf8') : '';
  const reverseText = reverseExists ? fs.readFileSync(reversePath, 'utf8') : '';
  const normalizedSource = normalizeSourceForDrift(sourceText);
  const normalizedReverse = normalizeSourceForDrift(reverseText);
  const exactEqual = sourceExists && reverseExists && sourceText === reverseText;
  const normalizedEqual = sourceExists && reverseExists && normalizedSource === normalizedReverse;
  return {
    file,
    sourceExists,
    reverseExists,
    exactEqual,
    normalizedEqual,
    sourceLines: countLines(sourceText),
    reverseLines: countLines(reverseText),
    sourceBytes: Buffer.byteLength(sourceText, 'utf8'),
    reverseBytes: Buffer.byteLength(reverseText, 'utf8'),
    sourceSha256: sourceExists ? sha256(sourceText) : null,
    reverseSha256: reverseExists ? sha256(reverseText) : null,
    lineEditDistance: sourceExists && reverseExists ? lineEditDistance(sourceText, reverseText) : null,
    normalizedLineEditDistance: sourceExists && reverseExists ? lineEditDistance(normalizedSource, normalizedReverse) : null,
  };
}

function driftResult(errors, files) {
  const changed = files.filter((entry) => !entry.exactEqual);
  const normalizedChanged = files.filter((entry) => !entry.normalizedEqual);
  const missing = files.filter((entry) => !entry.sourceExists || !entry.reverseExists);
  return {
    ok: errors.length === 0,
    stable: errors.length === 0 && missing.length === 0 && changed.length === 0,
    errors,
    stats: {
      filesCompared: files.length,
      filesChanged: changed.length,
      normalizedFilesChanged: normalizedChanged.length,
      missingFiles: missing.length,
      lineEditDistance: files.reduce((sum, entry) => sum + (entry.lineEditDistance || 0), 0),
      normalizedLineEditDistance: files.reduce((sum, entry) => sum + (entry.normalizedLineEditDistance || 0), 0),
    },
    files,
  };
}

function emptyProjectBooleanAttributes(html) {
  const names = new Set();
  let match;
  EMPTY_PROJECT_BOOLEAN_ATTRIBUTES_PATTERN.lastIndex = 0;
  while ((match = EMPTY_PROJECT_BOOLEAN_ATTRIBUTES_PATTERN.exec(html))) {
    names.add(match[1].toLowerCase());
  }
  return Array.from(names).sort();
}

function comparableResourceEntry(entry, root) {
  const out = { ...entry };
  if (Object.prototype.hasOwnProperty.call(out, 'src')) {
    out.src = resourceIdentity(root, out.src);
  }
  if (Object.prototype.hasOwnProperty.call(out, 'data')) {
    out.data = resourceIdentity(root, out.data);
  }
  return out;
}

function resourceIdentity(root, value) {
  const raw = String(value || '');
  const filePath = resolveResourcePath(root, raw);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return `path:${raw.replace(/\\/g, '/')}`;
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  return `sha256:${hash}`;
}

function resolveResourcePath(root, value) {
  if (!value || isRemoteReference(value)) return null;
  return resolveLocalAssetReference(value, { sourceRoot: root });
}

function slashPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function tagSequence($) {
  const roots = $('section.page, section[data-page], body').first();
  const scope = roots.length ? roots : $.root();
  const tags = [];
  scope.each((_, element) => {
    if (element.type === 'tag') tags.push(element.name.toLowerCase());
  });
  scope.find('*').each((_, element) => {
    tags.push(element.name.toLowerCase());
  });
  return tags;
}

function pageText($) {
  const root = $('section.page, section[data-page], body').first();
  const text = root.length ? root.text() : $.root().text();
  return collapseWhitespace(text);
}

function characterStyleEntries($) {
  return $(`[${HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE}]`).map((_, element) => {
    const node = $(element);
    return {
      tag: element.name.toLowerCase(),
      className: normalizeClass(node.attr('class')),
      style: node.attr(HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE) || '',
      text: collapseWhitespace(node.text()),
    };
  }).get();
}

function criticalInlineStyles($) {
  return $('[style]').map((_, element) => {
    const node = $(element);
    const style = normalizeInlineStyle(node.attr('style'));
    if (!isCriticalInlineStyle(style)) return null;
    return {
      tag: element.name.toLowerCase(),
      className: normalizeClass(node.attr('class')),
      text: collapseWhitespace(node.text()),
      style,
    };
  }).get().filter(Boolean);
}

function tableCellStyleEntries($) {
  return $('th,td').map((_, element) => {
    const node = $(element);
    return {
      tag: element.name.toLowerCase(),
      paragraphStyle: node.attr(HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE) || '',
      text: collapseWhitespace(node.text()),
    };
  }).get();
}

function resourceEntries($) {
  const entries = [];
  $('img').each((_, element) => {
    const node = $(element);
    entries.push({
      tag: 'img',
      className: normalizeClass(node.attr('class')),
      src: node.attr('src') || '',
      alt: node.attr('alt') || '',
    });
  });
  $('object').each((_, element) => {
    const node = $(element);
    entries.push({
      tag: 'object',
      className: normalizeClass(node.attr('class')),
      data: node.attr('data') || '',
      type: node.attr('type') || '',
      page: node.attr(HTML_DATA_ID_ATTRIBUTES.PDF_PAGE) || '',
      crop: node.attr(HTML_DATA_ID_ATTRIBUTES.CROP) || '',
      fit: node.attr(HTML_DATA_ID_ATTRIBUTES.FIT) || '',
    });
  });
  return entries;
}

function isCriticalInlineStyle(style) {
  return /(^|;)(left|top|right|bottom|width|height|transform|background|background-color)\s*:/.test(style);
}

function normalizeClass(value) {
  return String(value || '').split(/\s+/).filter(Boolean).sort().join(' ');
}

function normalizeConfigValue(value) {
  return value == null ? null : value;
}

function normalizeInlineStyle(value) {
  return String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf(':');
      if (separator === -1) return part;
      return `${part.slice(0, separator).trim().toLowerCase()}:${part.slice(separator + 1).trim()}`;
    })
    .sort()
    .join(';');
}

function normalizeSourceForDrift(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trimEnd();
}

function countLines(value) {
  const text = String(value || '');
  if (!text) return 0;
  return text.split(/\r\n?|\n/).length;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function lineEditDistance(left, right) {
  const a = normalizeSourceForDrift(left).split('\n');
  const b = normalizeSourceForDrift(right).split('\n');
  if (a.length === 1 && a[0] === '') a.pop();
  if (b.length === 1 && b[0] === '') b.pop();
  const lcs = longestCommonSubsequenceLength(a, b);
  return a.length + b.length - (2 * lcs);
}

function longestCommonSubsequenceLength(a, b) {
  const previous = new Array(b.length + 1).fill(0);
  const current = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1] + 1
        : Math.max(previous[j], current[j - 1]);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function createIssueWriter({ errors, warnings, strict }) {
  return function addIssue(code, message, details = {}) {
    const issue = {
      code,
      severity: strict ? 'error' : 'warning',
      message,
      ...details,
    };
    if (strict) errors.push(issue);
    else warnings.push(issue);
  };
}

function result(errors, warnings, stats) {
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

module.exports = {
  auditAuthorSourceRoundtrip,
  measureAuthorSourceDrift,
};
