const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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

  return result(errors, warnings, {
    pagesCompared,
    pagesExpected: sourcePackage.pages.length,
    issues: errors.length + warnings.length,
  });
}

function comparePage(sourcePage, reversePage, addIssue) {
  compareEntries('ROUNDTRIP_TAG_SEQUENCE_CHANGED', sourcePage, reversePage, tagSequence, 'Element tag sequence changed.');
  compareEntries('ROUNDTRIP_TEXT_CHANGED', sourcePage, reversePage, pageText, 'Page text changed.');
  compareEntries('ROUNDTRIP_CHARACTER_STYLE_CHANGED', sourcePage, reversePage, characterStyleEntries, 'Character style spans changed.');
  compareEntries('ROUNDTRIP_INLINE_STYLE_CHANGED', sourcePage, reversePage, criticalInlineStyles, 'Critical inline styles changed.');
  compareEntries('ROUNDTRIP_TABLE_CELL_STYLE_CHANGED', sourcePage, reversePage, tableCellStyleEntries, 'Table cell paragraph styles changed.');
  compareEntries('ROUNDTRIP_RESOURCE_CHANGED', sourcePage, reversePage, resourceEntries, 'Resource references changed.');

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

function readAuthorPackage(root) {
  const configPath = path.join(root, 'deck.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pages = (config.pages || []).map((page) => {
    const pageFile = path.join(root, page.file);
    const html = fs.existsSync(pageFile) ? fs.readFileSync(pageFile, 'utf8') : '';
    return {
      id: page.id || page.file,
      file: page.file,
      html,
      $: cheerio.load(html, {
        decodeEntities: false,
        xmlMode: false,
      }),
    };
  });
  return { config, pages };
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
  return normalizeText(text);
}

function characterStyleEntries($) {
  return $('[data-id-character-style]').map((_, element) => {
    const node = $(element);
    return {
      tag: element.name.toLowerCase(),
      className: normalizeClass(node.attr('class')),
      style: node.attr('data-id-character-style') || '',
      text: normalizeText(node.text()),
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
      text: normalizeText(node.text()),
      style,
    };
  }).get().filter(Boolean);
}

function tableCellStyleEntries($) {
  return $('th,td').map((_, element) => {
    const node = $(element);
    return {
      tag: element.name.toLowerCase(),
      paragraphStyle: node.attr('data-id-paragraph-style') || '',
      text: normalizeText(node.text()),
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
      page: node.attr('data-id-pdf-page') || '',
      crop: node.attr('data-id-crop') || '',
      fit: node.attr('data-id-fit') || '',
    });
  });
  return entries;
}

function isCriticalInlineStyle(style) {
  return /(^|;)(left|top|right|bottom|width|height|transform|background|background-color)\s*:/.test(style);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeClass(value) {
  return String(value || '').split(/\s+/).filter(Boolean).sort().join(' ');
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
};
