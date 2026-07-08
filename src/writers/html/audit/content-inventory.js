const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { assetSourceFromElementLike, inferAssetKind } = require('../../../shared/assets');
const { nasUrlToUncPath } = require('../../../shared/nas-paths');
const { collapseWhitespace } = require('../../../shared/text');
const {
  HTML_DATA_ID_ATTRIBUTES,
  ITEM_ROLE,
  htmlItemRoleFromElementFacts,
} = require('../../../protocol');

function authorPackageContentInventory(root) {
  const packageRoot = path.resolve(root);
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'deck.config.json'), 'utf8'));
  const warnings = [];
  const assetAliases = readAssetAliases(packageRoot, new Set(), warnings);
  const pages = (config.pages || []).map((page) => {
    const filePath = path.join(packageRoot, page.file);
    const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const $ = cheerio.load(html, { decodeEntities: false });
    return {
      id: page.id || page.file,
      size: pageSize($),
      textDigest: textDigest($),
      resources: resourceDigest($, packageRoot, assetAliases),
      itemRoles: roleDigest($),
      geometry: geometryDigest($),
    };
  });
  return inventoryResult(pages, warnings);
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
  return inventoryResult(pages);
}

function compareContentInventories(expected, actual, options = {}) {
  const errors = [];
  const warnings = [
    ...inputWarnings(expected, 'expected'),
    ...inputWarnings(actual, 'actual'),
  ];
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
    if (!sameArray(expectedPage.textDigest, actualPage.textDigest)) {
      errors.push({
        code: 'CONTENT_TEXT_CHANGED',
        pageId: expectedPage.id,
        expected: expectedPage.textDigest,
        actual: actualPage.textDigest,
      });
    }
    const missingResources = missingByIdentity(expectedPage.resources, actualPage.resources);
    if (missingResources.length) {
      errors.push({
        code: 'CONTENT_RESOURCE_MISSING',
        pageId: expectedPage.id,
        missing: missingResources,
      });
    }
    if (options.strictGeometry && geometryChanged(expectedPage.geometry, actualPage.geometry)) {
      errors.push({ code: 'CONTENT_GEOMETRY_CHANGED', pageId: expectedPage.id });
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    expected: expected && expected.summary || null,
    actual: actual && actual.summary || null,
  };
}

function pageSize($) {
  const style = $('section.page').first().attr('style') || '';
  return {
    width: cssNumber(style, 'width'),
    height: cssNumber(style, 'height'),
  };
}

function textDigest($) {
  const out = [];
  $('section.page').first().find('h1,h2,h3,h4,h5,h6,p,figcaption,li,td,th,span').each((_, element) => {
    if (isPageFurnitureElement($, element)) return;
    const text = collapseWhitespace($(element).text());
    if (text) out.push(text);
  });
  return out;
}

function resourceDigest($, root, assetAliases = new Map()) {
  const out = [];
  $('img[src],object[data]').each((_, element) => {
    if (isPageFurnitureElement($, element)) return;
    const node = $(element);
    if (node.attr(HTML_DATA_ID_ATTRIBUTES.IGNORE) != null) return;
    const htmlValue = node.attr('src') || node.attr('data') || '';
    const explicitAssetPath = node.attr(HTML_DATA_ID_ATTRIBUTES.ASSET_PATH) || '';
    const value = explicitAssetPath || htmlValue;
    const alias = explicitAssetPath ? null : assetAliases.get(resourceIdentity(null, htmlValue));
    out.push({
      kind: String(element.tagName || '').toLowerCase() === 'object' ? 'object' : 'image',
      identity: alias || resourceIdentity(root, value),
    });
  });
  return out;
}

function roleDigest($) {
  const counts = new Map();
  $(`[${HTML_DATA_ID_ATTRIBUTES.ROLE}],img,object,svg,p,figure,section`).each((_, element) => {
    if (isPageFurnitureElement($, element)) return;
    const node = $(element);
    const role = htmlItemRoleFromElementFacts({
      tagName: element.tagName,
      attributes: node.attr() || {},
      hasAssetSource: hasRecognizedAssetSource(element.tagName, node.attr() || {}),
    });
    counts.set(role, (counts.get(role) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

function geometryDigest($) {
  const out = [];
  $('[id]').each((_, element) => {
    if (isPageFurnitureElement($, element)) return;
    const node = $(element);
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
  });
  return out;
}

function hasRecognizedAssetSource(tagName, attributes) {
  const source = assetSourceFromElementLike({ tagName, attributes });
  return Boolean(source.src && inferAssetKind(source.src, source.explicitKind) !== 'unknown');
}

function modelText(item) {
  return collapseWhitespace(item.content && item.content.text || item.text || '');
}

function modelResource(item) {
  const asset = item && (item.asset || item.placedAsset);
  if (!asset || !asset.path) return null;
  return { kind: asset.kind || item.role || 'asset', identity: resourceIdentity(null, asset.path) };
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

function inventoryResult(pages, warnings = []) {
  return {
    kind: 'AuthorContentInventory',
    pages,
    warnings,
    summary: {
      pages: pages.length,
      texts: pages.reduce((sum, page) => sum + page.textDigest.length, 0),
      resources: pages.reduce((sum, page) => sum + page.resources.length, 0),
      geometryItems: pages.reduce((sum, page) => sum + page.geometry.length, 0),
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

function inputWarnings(inventory, side) {
  return (inventory && Array.isArray(inventory.warnings) ? inventory.warnings : [])
    .map((warning) => ({ ...warning, side }));
}

function missingByIdentity(expected, actual) {
  const actualIds = new Set((actual || []).map((entry) => entry.identity));
  return (expected || []).filter((entry) => !isDerivedPreviewResource(entry) && !actualIds.has(entry.identity));
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

function readAssetAliases(root, seenReports = new Set(), warnings = []) {
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
    warnings.push({
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
      const aliases = readAssetAliases(current, new Set(seenReports), warnings);
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
