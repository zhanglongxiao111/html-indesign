const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function authorPackageContentInventory(root) {
  const packageRoot = path.resolve(root);
  const config = JSON.parse(fs.readFileSync(path.join(packageRoot, 'deck.config.json'), 'utf8'));
  const pages = (config.pages || []).map((page) => {
    const filePath = path.join(packageRoot, page.file);
    const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const $ = cheerio.load(html, { decodeEntities: false });
    return {
      id: page.id || page.file,
      size: pageSize($),
      textDigest: textDigest($),
      resources: resourceDigest($, packageRoot),
      itemRoles: roleDigest($),
      geometry: geometryDigest($),
    };
  });
  return inventoryResult(pages);
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
      textDigest: items.filter((item) => item && item.role === 'text').map(modelText).filter(Boolean),
      resources: items.map(modelResource).filter(Boolean),
      itemRoles: modelRoleDigest(items),
      geometry: items.filter((item) => item && item.bounds).map((item) => geometryEntry(item.id, item.role, item.bounds)),
    };
  });
  return inventoryResult(pages);
}

function compareContentInventories(expected, actual, options = {}) {
  const errors = [];
  const warnings = [];
  comparePageCounts(expected, actual, errors);
  const actualPages = new Map((actual.pages || []).map((page) => [page.id, page]));
  for (const expectedPage of expected.pages || []) {
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
    expected: expected.summary,
    actual: actual.summary,
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
    const text = normalizeText($(element).text());
    if (text) out.push(text);
  });
  return out;
}

function resourceDigest($, root) {
  const out = [];
  $('img[src],object[data]').each((_, element) => {
    const node = $(element);
    const value = node.attr('src') || node.attr('data') || '';
    out.push({
      kind: String(element.tagName || '').toLowerCase() === 'object' ? 'object' : 'image',
      identity: resourceIdentity(root, value),
    });
  });
  return out;
}

function roleDigest($) {
  const counts = new Map();
  $('[data-id-role],img,object,svg,p,figure,section').each((_, element) => {
    const node = $(element);
    const role = node.attr('data-id-role') || tagRole(element.tagName);
    counts.set(role, (counts.get(role) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

function geometryDigest($) {
  const out = [];
  $('[id]').each((_, element) => {
    const node = $(element);
    const style = node.attr('style') || '';
    out.push(geometryEntry(node.attr('id'), node.attr('data-id-role') || tagRole(element.tagName), {
      x: cssNumber(style, 'left'),
      y: cssNumber(style, 'top'),
      width: cssNumber(style, 'width'),
      height: cssNumber(style, 'height'),
    }));
  });
  return out;
}

function modelText(item) {
  return normalizeText(item.content && item.content.text || item.text || '');
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

function inventoryResult(pages) {
  return {
    kind: 'AuthorContentInventory',
    pages,
    summary: {
      pages: pages.length,
      texts: pages.reduce((sum, page) => sum + page.textDigest.length, 0),
      resources: pages.reduce((sum, page) => sum + page.resources.length, 0),
      geometryItems: pages.reduce((sum, page) => sum + page.geometry.length, 0),
    },
  };
}

function comparePageCounts(expected, actual, errors) {
  if ((expected.pages || []).length !== (actual.pages || []).length) {
    errors.push({
      code: 'CONTENT_PAGE_COUNT_CHANGED',
      expected: (expected.pages || []).length,
      actual: (actual.pages || []).length,
    });
  }
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
  const nas = raw.match(/^\/nas\/([^/]+)\/(.+)$/i);
  if (nas) return `\\\\${nas[1]}\\${nas[2].replace(/\//g, '\\')}`;
  if (/^\\\\|^\/\//.test(raw)) return raw.replace(/\//g, '\\');
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return path.normalize(raw);
  return path.normalize(raw).replace(/^\.?[\\/]+/, '');
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

function tagRole(tagName) {
  const tag = String(tagName || '').toLowerCase();
  if (tag === 'img' || tag === 'object') return 'graphic';
  if (tag === 'svg') return 'shape';
  if (['p', 'span', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'].includes(tag)) return 'text';
  return tag || 'unknown';
}

function cssNumber(style, prop) {
  const match = new RegExp(`${prop}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(String(style || ''));
  return match ? round(Number(match[1])) : 0;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalContentText(value) {
  return normalizeText(value)
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
