const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { assetSourceFromElementLike, inferAssetKind } = require('../../../shared/assets');
const { nasUrlToUncPath } = require('../../../shared/nas-paths');
const { collapseWhitespace } = require('../../../shared/text');
const {
  HTML_DATA_ID_ATTRIBUTES,
  ITEM_ROLE,
  htmlItemRoleFromElementFacts,
} = require('../../../protocol');

const NON_CONTENT_TAGS = new Set(['script', 'style', 'template', 'noscript']);
const PAGE_SIZE_TOLERANCE = 1;

function authorPackageContentInventory(root) {
  const packageRoot = path.resolve(root);
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'deck.config.json'), 'utf8'));
  const warnings = [];
  const errors = [];
  const assetAliases = readAssetAliases(packageRoot, new Set(), warnings, errors);
  const furniture = [];
  const pages = (config.pages || []).map((page) => {
    const pageId = page.id || page.file;
    const filePath = path.join(packageRoot, page.file);
    const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const $ = cheerio.load(html, { decodeEntities: false });
    const roots = pageRootElements($, pageId, warnings);
    furniture.push(...furnitureDigest($, roots, packageRoot, assetAliases));
    return {
      id: pageId,
      size: pageSize($),
      textDigest: textDigest($, roots),
      resources: resourceDigest($, roots, packageRoot, assetAliases),
      itemRoles: roleDigest($, roots),
      geometry: geometryDigest($, roots),
    };
  });
  furniture.push(...parentPageFileFurniture(config, packageRoot, assetAliases, warnings));
  return inventoryResult(pages, furniture, warnings, errors);
}

function documentModelContentInventory(model) {
  const pages = (model.pages || []).map((page) => {
    const items = Array.isArray(page.items) ? page.items : [];
    return {
      id: page.id || null,
      size: {
        width: round(page.width || page.bounds && page.bounds.width),
        height: round(page.height || page.bounds && page.bounds.height),
      },
      textDigest: items.filter((item) => item && item.role === ITEM_ROLE.TEXT).map(modelText).filter(Boolean),
      resources: items.map(modelResource).filter(Boolean),
      itemRoles: modelRoleDigest(items),
      geometry: items.filter((item) => item && item.bounds).map((item) => geometryEntry(item.id, item.role, item.bounds)),
    };
  });
  const furniture = (model.parentPages || []).flatMap((parentPage) => (parentPage.items || []).map((item) => ({
    sourceId: item && item.id != null ? String(item.id) : null,
    text: canonicalContentText(modelText(item) || ''),
    resources: [modelResource(item)].filter(Boolean).map((entry) => entry.identity),
  })));
  return inventoryResult(pages, furniture);
}

function compareContentInventories(expected, actual, options = {}) {
  const errors = [];
  const warnings = [
    ...inputWarnings(expected, 'expected'),
    ...inputWarnings(actual, 'actual'),
  ];
  collectInventoryErrors(expected, 'expected', errors);
  collectInventoryErrors(actual, 'actual', errors);
  validateInventoryInput(expected, 'expected', errors);
  validateInventoryInput(actual, 'actual', errors);
  comparePageCounts(expected, actual, errors);
  const expectedPages = inventoryPages(expected);
  const actualPages = new Map(inventoryPages(actual).map((page) => [page.id, page]));
  for (const expectedPage of expectedPages) {
    const actualPage = actualPages.get(expectedPage.id);
    if (!actualPage) {
      errors.push({ code: 'CONTENT_PAGE_MISSING', pageId: expectedPage.id });
      continue;
    }
    warnEmptyPageDigest(expectedPage, actualPage, warnings);
    comparePageSize(expectedPage, actualPage, errors);
    compareTextDigests(expectedPage, actualPage, errors, warnings);
    compareResourceDigests(expectedPage, actualPage, errors, warnings);
    compareRoleDigests(expectedPage, actualPage, errors);
    compareGeometryDigests(expectedPage, actualPage, errors, warnings, options);
  }
  compareFurniture(expected, actual, errors);
  compareSummaries(expected, actual, errors);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    expected: expected && expected.summary || null,
    actual: actual && actual.summary || null,
  };
}

function pageRootElements($, pageId, warnings) {
  const sections = $('section.page').toArray();
  if (sections.length > 0) return sections;
  warnings.push({
    code: 'CONTENT_PAGE_SECTION_MISSING',
    pageId,
    message: 'No section.page root found; falling back to whole-document scan.',
  });
  return $.root().children().toArray();
}

function pageSize($) {
  const style = $('section.page').first().attr('style') || '';
  return {
    width: cssNumber(style, 'width'),
    height: cssNumber(style, 'height'),
  };
}

function textDigest($, roots) {
  const out = [];
  for (const element of elementsWithin($, roots)) {
    if (NON_CONTENT_TAGS.has(tagNameOf(element))) continue;
    if (isPageFurnitureElement($, element)) continue;
    const text = collapseWhitespace(directText(element));
    if (text) out.push(text);
  }
  return out;
}

function resourceDigest($, roots, root, assetAliases = new Map()) {
  const out = [];
  for (const element of elementsWithin($, roots)) {
    if (!isResourceElement(element)) continue;
    if (isPageFurnitureElement($, element)) continue;
    const entry = resourceEntryFor($, element, root, assetAliases);
    if (entry) out.push(entry);
  }
  return out;
}

function furnitureDigest($, roots, root, assetAliases = new Map()) {
  const out = [];
  for (const element of elementsWithin($, roots)) {
    if (!isFurnitureRootElement($, element)) continue;
    const node = $(element);
    const resources = [];
    const candidates = [element, ...node.find('img[src],object[data]').toArray()];
    for (const candidate of candidates) {
      if (!isResourceElement(candidate)) continue;
      const entry = resourceEntryFor($, candidate, root, assetAliases);
      if (entry) resources.push(entry.identity);
    }
    out.push({
      sourceId: node.attr(HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_SOURCE_ID) || node.attr('id') || null,
      text: canonicalContentText(node.text()),
      resources: resources.sort(),
    });
  }
  return out;
}

function parentPageFileFurniture(config, packageRoot, assetAliases, warnings) {
  const parentPages = Array.isArray(config.parentPages) ? config.parentPages : [];
  const out = [];
  for (const parentPage of parentPages) {
    if (!parentPage || !parentPage.file) continue;
    const filePath = path.join(packageRoot, parentPage.file);
    if (!fs.existsSync(filePath)) {
      warnings.push({
        code: 'CONTENT_PARENT_PAGE_FILE_MISSING',
        parentPageId: parentPage.id || parentPage.file,
        file: parentPage.file,
      });
      continue;
    }
    const $ = cheerio.load(fs.readFileSync(filePath, 'utf8'), { decodeEntities: false });
    const roots = $.root().children().toArray();
    const explicit = furnitureDigest($, roots, packageRoot, assetAliases);
    if (explicit.length) {
      out.push(...explicit);
      continue;
    }
    for (const element of elementsWithin($, roots)) {
      if (NON_CONTENT_TAGS.has(tagNameOf(element))) continue;
      const node = $(element);
      const hasContent = collapseWhitespace(directText(element)) || isResourceElement(element);
      if (!hasContent) continue;
      const entry = resourceEntryFor($, element, packageRoot, assetAliases);
      out.push({
        sourceId: node.attr(HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_SOURCE_ID) || node.attr('id') || null,
        text: canonicalContentText(collapseWhitespace(directText(element))),
        resources: entry ? [entry.identity] : [],
      });
    }
  }
  return out;
}

function roleDigest($, roots) {
  const counts = new Map();
  for (const element of elementsWithin($, roots)) {
    if (!matchesRoleSelector($, element)) continue;
    if (isPageFurnitureElement($, element)) continue;
    const node = $(element);
    const role = htmlItemRoleFromElementFacts({
      tagName: element.tagName,
      attributes: node.attr() || {},
      hasAssetSource: hasRecognizedAssetSource(element.tagName, node.attr() || {}),
    });
    counts.set(role, (counts.get(role) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

function geometryDigest($, roots) {
  const out = [];
  for (const element of elementsWithin($, roots)) {
    const node = $(element);
    if (node.attr('id') == null) continue;
    if (isPageFurnitureElement($, element)) continue;
    const style = node.attr('style') || '';
    out.push(geometryEntry(node.attr('id'), htmlItemRoleFromElementFacts({
      tagName: element.tagName,
      attributes: node.attr() || {},
      hasAssetSource: hasRecognizedAssetSource(element.tagName, node.attr() || {}),
    }), {
      x: cssNumber(style, 'left'),
      y: cssNumber(style, 'top'),
      width: cssNumber(style, 'width'),
      height: cssNumber(style, 'height'),
    }));
  }
  return out;
}

function elementsWithin($, roots) {
  const out = [];
  const seen = new Set();
  for (const root of roots || []) {
    for (const element of [root, ...$(root).find('*').toArray()]) {
      if (!element || element.type !== 'tag' || seen.has(element)) continue;
      seen.add(element);
      out.push(element);
    }
  }
  return out;
}

function directText(element) {
  return (element.children || [])
    .filter((child) => child && child.type === 'text')
    .map((child) => child.data || '')
    .join(' ');
}

function tagNameOf(element) {
  return String(element && (element.tagName || element.name) || '').toLowerCase();
}

function isResourceElement(element) {
  const tag = tagNameOf(element);
  const attributes = element.attribs || {};
  if (tag === 'img') return attributes.src != null;
  if (tag === 'object') return attributes.data != null;
  return false;
}

function matchesRoleSelector($, element) {
  const tag = tagNameOf(element);
  if (['img', 'object', 'svg', 'p', 'figure', 'section'].includes(tag)) return true;
  return $(element).attr(HTML_DATA_ID_ATTRIBUTES.ROLE) != null;
}

function resourceEntryFor($, element, root, assetAliases) {
  const node = $(element);
  if (node.attr(HTML_DATA_ID_ATTRIBUTES.IGNORE) != null) return null;
  if (!isResourceElement(element)) return null;
  const htmlValue = node.attr('src') || node.attr('data') || '';
  const explicitAssetPath = node.attr(HTML_DATA_ID_ATTRIBUTES.ASSET_PATH) || '';
  const value = explicitAssetPath || htmlValue;
  const alias = explicitAssetPath ? null : assetAliases.get(resourceIdentity(null, htmlValue));
  const identity = alias || resourceIdentity(root, value);
  return {
    kind: tagNameOf(element) === 'object' ? 'object' : 'image',
    identity,
    contentHash: contentHashFor(root, identity),
  };
}

function warnEmptyPageDigest(expectedPage, actualPage, warnings) {
  const expectedEmpty = digestIsEmpty(expectedPage);
  const actualEmpty = digestIsEmpty(actualPage);
  if (expectedEmpty && actualEmpty) {
    warnings.push({
      code: 'CONTENT_PAGE_DIGEST_EMPTY',
      pageId: expectedPage.id,
      message: 'Both sides produced empty digests for this page; nothing was actually compared. Confirm the page markup is scannable.',
    });
  }
}

function digestIsEmpty(page) {
  return (page.textDigest || []).length === 0
    && (page.resources || []).length === 0
    && (page.geometry || []).length === 0;
}

function comparePageSize(expectedPage, actualPage, errors) {
  const expected = expectedPage.size || {};
  const actual = actualPage.size || {};
  if (!Number.isFinite(expected.width) || !Number.isFinite(expected.height)) return;
  if (expected.width === 0 && expected.height === 0) return;
  if (Math.abs((expected.width || 0) - (actual.width || 0)) > PAGE_SIZE_TOLERANCE
    || Math.abs((expected.height || 0) - (actual.height || 0)) > PAGE_SIZE_TOLERANCE) {
    errors.push({
      code: 'CONTENT_PAGE_SIZE_CHANGED',
      pageId: expectedPage.id,
      expected,
      actual,
    });
  }
}

function compareTextDigests(expectedPage, actualPage, errors, warnings) {
  if (!sameArray(expectedPage.textDigest, actualPage.textDigest)) {
    errors.push({
      code: 'CONTENT_TEXT_CHANGED',
      pageId: expectedPage.id,
      expected: expectedPage.textDigest,
      actual: actualPage.textDigest,
    });
    return;
  }
  if (JSON.stringify(expectedPage.textDigest || []) !== JSON.stringify(actualPage.textDigest || [])) {
    warnings.push({
      code: 'CONTENT_TEXT_NORMALIZED_DIFF',
      pageId: expectedPage.id,
      message: 'Text matched only after CJK whitespace normalization; raw text differs.',
    });
  }
}

function compareResourceDigests(expectedPage, actualPage, errors, warnings) {
  const expectedCounts = resourceCounts(expectedPage.resources);
  const actualCounts = resourceCounts(actualPage.resources);
  const missing = [];
  for (const [identity, entry] of expectedCounts) {
    if (isDerivedPreviewResource({ identity })) continue;
    const actualEntry = actualCounts.get(identity);
    const actualCount = actualEntry ? actualEntry.count : 0;
    if (actualCount < entry.count) {
      missing.push({ identity, kind: entry.kind, expected: entry.count, actual: actualCount });
      continue;
    }
    if (entry.contentHash && actualEntry && actualEntry.contentHash && entry.contentHash !== actualEntry.contentHash) {
      errors.push({
        code: 'CONTENT_RESOURCE_CONTENT_CHANGED',
        pageId: expectedPage.id,
        identity,
        expectedHash: entry.contentHash,
        actualHash: actualEntry.contentHash,
      });
    }
  }
  if (missing.length) {
    errors.push({
      code: 'CONTENT_RESOURCE_MISSING',
      pageId: expectedPage.id,
      missing,
    });
  }
  const extra = [];
  for (const [identity, entry] of actualCounts) {
    if (isDerivedPreviewResource({ identity })) continue;
    const expectedEntry = expectedCounts.get(identity);
    const expectedCount = expectedEntry ? expectedEntry.count : 0;
    if (entry.count > expectedCount) {
      extra.push({ identity, kind: entry.kind, expected: expectedCount, actual: entry.count });
    }
  }
  if (extra.length) {
    warnings.push({
      code: 'CONTENT_RESOURCE_EXTRA',
      pageId: expectedPage.id,
      extra,
    });
  }
}

function resourceCounts(entries) {
  const counts = new Map();
  for (const entry of entries || []) {
    const existing = counts.get(entry.identity);
    if (existing) {
      existing.count += 1;
      if (!existing.contentHash && entry.contentHash) existing.contentHash = entry.contentHash;
    } else {
      counts.set(entry.identity, { kind: entry.kind, count: 1, contentHash: entry.contentHash || null });
    }
  }
  return counts;
}

function compareRoleDigests(expectedPage, actualPage, errors) {
  const actualRoles = new Map((actualPage.itemRoles || []).map((entry) => [entry.role, entry.count]));
  for (const entry of expectedPage.itemRoles || []) {
    const actualCount = actualRoles.get(entry.role) || 0;
    if (actualCount < entry.count) {
      errors.push({
        code: 'CONTENT_ROLE_COUNT_REDUCED',
        pageId: expectedPage.id,
        role: entry.role,
        expected: entry.count,
        actual: actualCount,
      });
    }
  }
}

function compareGeometryDigests(expectedPage, actualPage, errors, warnings, options) {
  const actualIds = new Set((actualPage.geometry || []).map((entry) => entry.id).filter(Boolean));
  const lost = (expectedPage.geometry || [])
    .filter((entry) => entry.id && !actualIds.has(entry.id))
    .map((entry) => ({ id: entry.id, role: entry.role }));
  if (lost.length) {
    errors.push({
      code: 'CONTENT_GEOMETRY_ITEMS_LOST',
      pageId: expectedPage.id,
      lost,
    });
  }
  const expectedIds = new Set((expectedPage.geometry || []).map((entry) => entry.id).filter(Boolean));
  const added = (actualPage.geometry || [])
    .filter((entry) => entry.id && !expectedIds.has(entry.id))
    .map((entry) => ({ id: entry.id, role: entry.role }));
  if (added.length) {
    warnings.push({
      code: 'CONTENT_GEOMETRY_ITEMS_ADDED',
      pageId: expectedPage.id,
      added,
    });
  }
  if (options.strictGeometry && geometryChanged(expectedPage.geometry, actualPage.geometry)) {
    errors.push({ code: 'CONTENT_GEOMETRY_CHANGED', pageId: expectedPage.id });
  }
}

function compareFurniture(expected, actual, errors) {
  const expectedEntries = inventoryFurniture(expected);
  const actualEntries = inventoryFurniture(actual);
  if (!expectedEntries.length) return;
  const actualByKey = new Map();
  for (const entry of actualEntries) {
    const key = furnitureKey(entry);
    actualByKey.set(key, (actualByKey.get(key) || 0) + 1);
  }
  const missing = [];
  for (const entry of expectedEntries) {
    const key = furnitureKey(entry);
    const available = actualByKey.get(key) || 0;
    if (available > 0) {
      actualByKey.set(key, available - 1);
      continue;
    }
    missing.push(entry);
  }
  if (missing.length) {
    errors.push({
      code: 'CONTENT_FURNITURE_MISSING',
      missing: missing.map((entry) => ({
        sourceId: entry.sourceId,
        text: entry.text,
        resources: entry.resources,
      })),
    });
  }
}

function furnitureKey(entry) {
  return [
    entry.sourceId || '',
    entry.text || '',
    (entry.resources || []).join(','),
  ].join(' ');
}

function inventoryFurniture(inventory) {
  return inventory && Array.isArray(inventory.furniture) ? inventory.furniture : [];
}

function compareSummaries(expected, actual, errors) {
  const expectedSummary = expected && expected.summary;
  const actualSummary = actual && actual.summary;
  if (!expectedSummary || !actualSummary) return;
  const changed = {};
  for (const field of ['pages', 'texts', 'resources', 'geometryItems', 'furniture']) {
    const expectedCount = Number(expectedSummary[field] || 0);
    const actualCount = Number(actualSummary[field] || 0);
    if (expectedCount !== actualCount) {
      changed[field] = { expected: expectedCount, actual: actualCount };
    }
  }
  if (Object.keys(changed).length) {
    errors.push({ code: 'CONTENT_SUMMARY_CHANGED', changed });
  }
}

function isFurnitureRootElement($, element) {
  const node = $(element);
  if (node.attr(HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_ITEM) != null) return true;
  return node.attr(HTML_DATA_ID_ATTRIBUTES.PLACEMENT) === 'parent-page-furniture';
}

function hasRecognizedAssetSource(tagName, attributes) {
  const source = assetSourceFromElementLike({ tagName, attributes });
  return Boolean(source.src && inferAssetKind(source.src, source.explicitKind) !== 'unknown');
}

function modelText(item) {
  return collapseWhitespace(item && (item.content && item.content.text || item.text) || '');
}

function modelResource(item) {
  const asset = item && (item.asset || item.placedAsset);
  if (!asset || !asset.path) return null;
  return { kind: asset.kind || item.role || 'asset', identity: resourceIdentity(null, asset.path), contentHash: null };
}

function modelRoleDigest(items) {
  const counts = new Map();
  for (const item of items) {
    const role = item && item.role || 'unknown';
    counts.set(role, (counts.get(role) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

function inventoryResult(pages, furniture = [], warnings = [], errors = []) {
  return {
    kind: 'AuthorContentInventory',
    pages,
    furniture,
    warnings,
    errors,
    summary: {
      pages: pages.length,
      texts: pages.reduce((sum, page) => sum + page.textDigest.length, 0),
      resources: pages.reduce((sum, page) => sum + page.resources.length, 0),
      geometryItems: pages.reduce((sum, page) => sum + page.geometry.length, 0),
      furniture: furniture.length,
    },
  };
}

function comparePageCounts(expected, actual, errors) {
  const expectedPages = inventoryPages(expected);
  const actualPages = inventoryPages(actual);
  if (expectedPages.length !== actualPages.length) {
    errors.push({
      code: 'CONTENT_PAGE_COUNT_CHANGED',
      expected: expectedPages.length,
      actual: actualPages.length,
    });
  }
}

function inventoryPages(inventory) {
  return inventory && Array.isArray(inventory.pages) ? inventory.pages : [];
}

function validateInventoryInput(inventory, side, errors) {
  if (!inventory || !Array.isArray(inventory.pages)) {
    errors.push({
      code: 'CONTENT_INVENTORY_INPUT_INVALID',
      side,
      reason: 'pages must be a non-empty array',
    });
    return;
  }
  if (inventory.pages.length === 0) {
    errors.push({
      code: 'CONTENT_INVENTORY_INPUT_INVALID',
      side,
      reason: 'pages must not be empty',
    });
  }
}

function collectInventoryErrors(inventory, side, errors) {
  for (const error of (inventory && Array.isArray(inventory.errors) ? inventory.errors : [])) {
    errors.push({ ...error, side });
  }
}

function inputWarnings(inventory, side) {
  return (inventory && Array.isArray(inventory.warnings) ? inventory.warnings : [])
    .map((warning) => ({ ...warning, side }));
}

function geometryChanged(expected, actual) {
  if ((expected || []).length !== (actual || []).length) return true;
  const actualById = new Map((actual || []).map((entry) => [entry.id, entry]));
  return (expected || []).some((entry) => {
    const other = actualById.get(entry.id);
    return !other
      || Math.abs(entry.x - other.x) > 2
      || Math.abs(entry.y - other.y) > 2
      || Math.abs(entry.width - other.width) > 2
      || Math.abs(entry.height - other.height) > 2;
  });
}

function geometryEntry(id, role, bounds) {
  return {
    id: id || null,
    role: role || 'unknown',
    x: round(bounds.x),
    y: round(bounds.y),
    width: round(bounds.width),
    height: round(bounds.height),
  };
}

function resourceIdentity(root, value) {
  const raw = decodeResourcePath(String(value || '').trim());
  const nasPath = nasUrlToUncPath(raw);
  if (nasPath) return nasPath;
  if (/^\\\\|^\/\//.test(raw)) return raw.replace(/\//g, '\\');
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return path.normalize(raw);
  if (root && escapesPackageRoot(raw)) return path.normalize(path.resolve(root, raw));
  return path.normalize(raw).replace(/^\.?[\\/]+/, '');
}

function contentHashFor(root, identity) {
  if (!root) return null;
  const raw = String(identity || '');
  if (!raw || path.isAbsolute(raw) || /^\\\\/.test(raw)) return null;
  const filePath = path.join(root, raw);
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 16);
  } catch (_) {
    return null;
  }
}

function readAssetAliases(root, seenReports = new Set(), warnings = [], errors = []) {
  const reportPath = path.join(root, 'reports', 'authoring-report.json');
  if (!fs.existsSync(reportPath)) return new Map();
  const normalizedReportPath = path.normalize(reportPath);
  if (seenReports.has(normalizedReportPath)) return new Map();
  seenReports.add(normalizedReportPath);
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const entries = report && report.assets && Array.isArray(report.assets.entries)
      ? report.assets.entries
      : [];
    const aliases = new Map();
    for (const entry of entries) {
      const htmlPath = entry && entry.htmlPath;
      const originalPath = entry && entry.originalPath;
      if (!htmlPath || !originalPath) continue;
      const key = resourceIdentity(null, htmlPath);
      const transitiveOriginalPath = resolveTransitiveAssetAlias(originalPath, seenReports, warnings);
      const value = resourceIdentity(null, transitiveOriginalPath || originalPath);
      if (!aliases.has(key) || isAbsoluteHostPath(originalPath)) {
        aliases.set(key, value);
      }
    }
    return aliases;
  } catch (error) {
    errors.push({
      code: 'CONTENT_INVENTORY_ASSET_ALIAS_INVALID',
      reportPath: normalizedReportPath,
      message: String(error && error.message || error),
    });
    return new Map();
  }
}

function resolveTransitiveAssetAlias(originalPath, seenReports, warnings) {
  if (!/^[a-zA-Z]:[\\/]/.test(String(originalPath || ''))) return null;
  const absolutePath = path.normalize(originalPath);
  let current = path.dirname(absolutePath);
  const root = path.parse(absolutePath).root;
  while (current && current !== root) {
    const reportPath = path.join(current, 'reports', 'authoring-report.json');
    if (fs.existsSync(reportPath)) {
      const relativePath = path.relative(current, absolutePath);
      const aliases = readAssetAliases(current, new Set(seenReports), warnings, warnings);
      const alias = aliases.get(resourceIdentity(null, relativePath));
      if (alias && alias !== resourceIdentity(null, originalPath)) return alias;
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return null;
}

function isPageFurnitureElement($, element) {
  const node = $(element);
  return node.closest(`[${HTML_DATA_ID_ATTRIBUTES.PLACEMENT}="parent-page-furniture"],[${HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_ITEM}]`).length > 0;
}

function escapesPackageRoot(value) {
  const normalized = path.normalize(String(value || ''));
  return normalized === '..' || normalized.startsWith(`..${path.sep}`) || normalized.startsWith('../') || normalized.startsWith('..\\');
}

function isAbsoluteHostPath(value) {
  const raw = String(value || '').trim();
  return /^\\\\|^\/nas\/|^[a-zA-Z]:[\\/]/i.test(raw);
}

function isDerivedPreviewResource(entry) {
  return /^previews[\\/]/i.test(String(entry && entry.identity || ''));
}

function decodeResourcePath(value) {
  try {
    return decodeURI(value);
  } catch (_) {
    return value;
  }
}

function cssNumber(style, prop) {
  const match = new RegExp(`${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(String(style || ''));
  return match ? round(Number(match[1])) : 0;
}

function canonicalContentText(value) {
  return collapseWhitespace(value)
    .replace(/([\p{Script=Han}])\s+([\p{Script=Han}])/gu, '$1$2')
    .replace(/([\p{Script=Han}])\s+([，。！？；：、])/gu, '$1$2')
    .replace(/([，。！？；：、])\s+([\p{Script=Han}])/gu, '$1$2')
    .replace(/\s+([，。！？；：、])/g, '$1')
    .replace(/([（《“])\s+/g, '$1')
    .replace(/\s+([）》”])/g, '$1');
}

function sameArray(left, right) {
  const normalizeArray = (values) => (values || []).map(canonicalContentText);
  return JSON.stringify(normalizeArray(left)) === JSON.stringify(normalizeArray(right));
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

module.exports = {
  authorPackageContentInventory,
  documentModelContentInventory,
  compareContentInventories,
};
