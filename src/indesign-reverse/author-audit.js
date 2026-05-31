const fs = require('fs');
const path = require('path');
const { isDegenerateInvisibleVector } = require('./vector-svg');

function auditReverseAuthorPackage(outDir, options = {}) {
  const root = path.resolve(outDir);
  const errors = [];
  const warnings = [];
  const configPath = path.join(root, 'deck.config.json');
  if (!fs.existsSync(configPath)) {
    errors.push(error('AUTHOR_CONFIG_MISSING', 'author/deck.config.json is missing.', 'deck.config.json'));
    return result(errors, warnings, { pages: 0 });
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const pages = config.pages || [];
  for (const page of pages) {
    const file = path.join(root, page.file);
    if (!fs.existsSync(file)) {
      errors.push(error('AUTHOR_PAGE_MISSING', `Author page is missing: ${page.file}`, page.file));
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    scanDuplicateAttributes(html, page.file, errors);
    scanResourcePlaceholders(html, page.file, errors);
  }
  const layoutCss = readOptional(root, 'styles/layout.css');
  if (!/display:\s*grid/.test(layoutCss) || !/grid-template-columns/.test(layoutCss)) {
    errors.push(error('AUTHOR_GRID_CSS_MISSING', 'styles/layout.css must define grid-first page layout.', 'styles/layout.css'));
  }
  if (options.model) {
    auditModelGeometryCoverage(root, options.model, errors, warnings);
  }
  return result(errors, warnings, { pages: pages.length });
}

function scanDuplicateAttributes(html, file, errors) {
  const tagRe = /<([a-zA-Z][\w:-]*)([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(html))) {
    const attrs = new Set();
    for (const name of scanAttributeNames(match[2])) {
      if (attrs.has(name)) {
        errors.push(error('AUTHOR_DUPLICATE_ATTRIBUTE', `Duplicate attribute ${name}.`, file));
        break;
      }
      attrs.add(name);
    }
  }
}

function scanAttributeNames(attributeSource) {
  const names = [];
  let index = 0;
  while (index < attributeSource.length) {
    while (index < attributeSource.length && /[\s/]/.test(attributeSource[index])) index += 1;
    if (index >= attributeSource.length) break;

    const start = index;
    while (index < attributeSource.length && !/[\s=/>]/.test(attributeSource[index])) index += 1;
    const name = attributeSource.slice(start, index);
    if (!/^[a-zA-Z_:][\w:.-]*$/.test(name)) {
      while (index < attributeSource.length && !/\s/.test(attributeSource[index])) index += 1;
      continue;
    }
    names.push(name.toLowerCase());

    while (index < attributeSource.length && /\s/.test(attributeSource[index])) index += 1;
    if (attributeSource[index] !== '=') continue;
    index += 1;
    while (index < attributeSource.length && /\s/.test(attributeSource[index])) index += 1;
    const quote = attributeSource[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      while (index < attributeSource.length && attributeSource[index] !== quote) index += 1;
      if (index < attributeSource.length) index += 1;
    } else {
      while (index < attributeSource.length && !/[\s>]/.test(attributeSource[index])) index += 1;
    }
  }
  return names;
}

function scanResourcePlaceholders(html, file, errors) {
  if (/<div\b[^>]*(?:\ssrc=|\sdata=)[^>]*>/i.test(html)) {
    errors.push(error('AUTHOR_DIV_RESOURCE_PLACEHOLDER', 'Resource source/data attributes must not be written on div placeholders.', file));
  }
}

function auditModelGeometryCoverage(root, model, errors, warnings) {
  const htmlById = collectAuthorElementIds(root);
  const positionedIds = collectPositionedIds(root);
  for (const page of model.pages || []) {
    for (const item of page.items || []) {
      if (!item || !item.id) continue;
      if (needsFallbackGeometry(item) && htmlById.has(String(item.id)) && !positionedIds.has(String(item.id))) {
        errors.push(error(
          'AUTHOR_OBSERVED_ITEM_GEOMETRY_MISSING',
          `Observed item ${item.id} has reverse bounds but no author fallback geometry.`,
          page.sourceFile || page.id || '',
        ));
      }
      if (isUnsupportedVectorFallback(item) && positionedIds.has(String(item.id))) {
        warnings.push(error(
          'AUTHOR_UNSUPPORTED_VECTOR_FALLBACK',
          `InDesign item ${item.id} has unknown PageItem vector geometry and is represented as a rectangular fallback.`,
          page.sourceFile || page.id || '',
        ));
      }
    }
  }
}

function collectAuthorElementIds(root) {
  const ids = new Set();
  const pagesDir = path.join(root, 'pages');
  if (!fs.existsSync(pagesDir)) return ids;
  for (const file of fs.readdirSync(pagesDir)) {
    if (!/\.html$/i.test(file)) continue;
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    const re = /\bid="([^"]+)"/g;
    let match;
    while ((match = re.exec(html))) ids.add(match[1]);
  }
  return ids;
}

function collectPositionedIds(root) {
  const ids = new Set();
  const overrideCss = readOptional(root, 'styles/reverse-overrides.css');
  const ruleRe = /(?:#([a-zA-Z0-9_\-:.]+)|\[id=(["'])(.*?)\2\])\s*\{([^}]+)\}/g;
  let match;
  while ((match = ruleRe.exec(overrideCss))) {
    const body = match[4];
    if (/position\s*:\s*absolute/i.test(body) && /left\s*:/i.test(body) && /top\s*:/i.test(body)) {
      ids.add(match[1] ? match[1].replace(/\\([:.[\]#])/g, '$1') : unescapeCssString(match[3]));
    }
  }
  return ids;
}

function unescapeCssString(value) {
  return String(value || '').replace(/\\(["\\])/g, '$1');
}

function needsFallbackGeometry(item) {
  if (!item.bounds) return false;
  if (item.layout && (item.layout.grid || item.layout.cssVars)) return false;
  const attrs = item.sourceNode && item.sourceNode.attributes || {};
  const classList = item.sourceNode && item.sourceNode.classList || [];
  if (classList.includes('grid-item')) return false;
  if (/\b(left|top|width|height)\s*:/.test(String(attrs.style || ''))) return false;
  return true;
}

function isUnsupportedVectorFallback(item) {
  if (isDegenerateInvisibleVector(item)) return false;
  if (hasVectorGeometry(item)) return false;
  if (item.asset || item.table) return false;
  if (item.content && String(item.content.text || '').trim()) return false;
  const role = String(item.role || '').toLowerCase();
  if (role !== 'shape' && role !== 'line') return false;
  const sourceType = String(item.sourceType || item.type || '').toLowerCase();
  return sourceType === 'pageitem' || sourceType === 'unknown' || sourceType === '';
}

function hasVectorGeometry(item) {
  const vector = item && item.vectorGeometry;
  return Boolean(vector && Array.isArray(vector.paths) && vector.paths.some((path) => path && Array.isArray(path.points) && path.points.length > 1));
}

function readOptional(root, relativePath) {
  const file = path.join(root, relativePath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function error(code, message, file) {
  return { code, message, file };
}

function result(errors, warnings, stats) {
  return { ok: errors.length === 0, errors, warnings, stats };
}

module.exports = {
  auditReverseAuthorPackage,
};
