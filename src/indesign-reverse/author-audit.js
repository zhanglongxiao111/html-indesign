const fs = require('fs');
const path = require('path');

function auditReverseAuthorPackage(outDir) {
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
  return result(errors, warnings, { pages: pages.length });
}

function scanDuplicateAttributes(html, file, errors) {
  const tagRe = /<([a-zA-Z][\w:-]*)([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(html))) {
    const attrs = new Set();
    const attrRe = /\s([a-zA-Z_:][\w:.-]*)(?:\s*=|\s|$)/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(match[2]))) {
      const name = attrMatch[1].toLowerCase();
      if (attrs.has(name)) {
        errors.push(error('AUTHOR_DUPLICATE_ATTRIBUTE', `Duplicate attribute ${name}.`, file));
        break;
      }
      attrs.add(name);
    }
  }
}

function scanResourcePlaceholders(html, file, errors) {
  if (/<div\b[^>]*(?:\ssrc=|\sdata=)[^>]*>/i.test(html)) {
    errors.push(error('AUTHOR_DIV_RESOURCE_PLACEHOLDER', 'Resource source/data attributes must not be written on div placeholders.', file));
  }
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
