const fs = require('fs');
const path = require('path');
const { writeAuthorPackageEntry } = require('../authoring');
const { writeAuthorCssFiles } = require('./author-css-writer');

function writeReverseAuthorPackage(model, options = {}) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('writeReverseAuthorPackage requires a DocumentModel');
  }
  const outDir = path.resolve(options.outDir || 'reverse-export/author');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'reports'), { recursive: true });

  const pages = pageEntries(model);
  const config = deckConfigFor(model, pages);
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify(config, null, 2), 'utf8');

  for (const [relativePath, css] of Object.entries(writeAuthorCssFiles(model))) {
    writeText(outDir, relativePath, css);
  }
  for (const page of pages) {
    writeText(outDir, page.file, pageHtml(page.modelPage, page.file, options));
  }

  const report = authoringReport(model, pages, options);
  fs.writeFileSync(path.join(outDir, 'reports/authoring-report.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reports/inference-report.json'), JSON.stringify(report.inference, null, 2), 'utf8');
  writeAuthorPackageEntry(path.join(outDir, 'deck.config.json'));

  return {
    ok: true,
    outDir,
    configPath: path.join(outDir, 'deck.config.json'),
    entryPath: path.join(outDir, 'deck.html'),
    pages: pages.map((page) => page.file),
    report,
  };
}

function deckConfigFor(model, pages) {
  const sourcePackage = model.sourcePackage || {};
  return {
    schemaVersion: 1,
    id: model.id,
    title: model.title || model.id,
    profile: model.profile || null,
    unitMode: model.unitMode || 'presentation',
    targetSize: 'source',
    entry: sourcePackage.entry || 'deck.html',
    styles: [
      'styles/tokens.css',
      'styles/layout.css',
      'styles/components.css',
      'styles/pages.css',
      'styles/reverse-overrides.css',
    ],
    pages: pages.map((page) => ({ id: page.id, file: page.file })),
    assets: { root: sourcePackage.assetRoot || 'assets' },
  };
}

function pageEntries(model) {
  return (model.pages || []).map((page, index) => {
    const file = page.sourceFile || `pages/${String(index).padStart(2, '0')}-${safeFile(page.semantic || page.id || `page-${index + 1}`)}.html`;
    return {
      id: page.semantic || page.pageToken || page.id || `page-${index + 1}`,
      file,
      modelPage: page,
    };
  });
}

function pageHtml(page, sourceFile, options) {
  const attrs = sourcePageAttrs(page, sourceFile, options);
  const items = (page.items || [])
    .slice()
    .sort((a, b) => structureOrder(a) - structureOrder(b))
    .map((item) => itemHtml(item, options))
    .join('\n');
  return [`<section ${attrs.join(' ')}>`, indent(items, 2), '</section>', ''].join('\n');
}

function sourcePageAttrs(page, sourceFile, options) {
  const sourceNode = page.sourceNode || {};
  const classes = sourceNode.classList && sourceNode.classList.length ? sourceNode.classList.join(' ') : 'page';
  const attrs = [`class="${attr(classes)}"`];
  if (sourceNode.id || page.id) attrs.push(`id="${attr(sourceNode.id || page.id)}"`);
  attrs.push(`data-page="${attr(page.semantic || page.id)}"`);
  attrs.push(`data-id-source-file="${attr(sourceFile)}"`);
  if (options.mode === 'observation' || page.semantic === 'unknown') attrs.push('data-id-observed="true"');
  if (options.mode) attrs.push(`data-id-reverse-mode="${attr(options.mode)}"`);

  for (const [name, value] of Object.entries(sourceNode.attributes || {})) {
    if (['id', 'class', 'data-page', 'data-id-source-file'].includes(name)) continue;
    attrs.push(`${name}="${attr(value)}"`);
  }
  if (page.grid) {
    attrs.push(`data-id-grid="${attr(`${page.grid.columns}x${page.grid.rows}`)}"`);
    if (page.grid.columnGutter != null) attrs.push(`data-id-column-gutter="${attr(`${page.grid.columnGutter}px`)}"`);
    if (page.grid.rowGutter != null) attrs.push(`data-id-row-gutter="${attr(`${page.grid.rowGutter}px`)}"`);
    if (page.grid.baseline != null) attrs.push(`data-id-baseline="${attr(`${page.grid.baseline}px`)}"`);
  }
  return attrs;
}

function itemHtml(item, options) {
  const node = item.sourceNode || {};
  const tag = safeTag(node.tagName || item.tagName || tagForRole(item.role));
  const classes = itemClasses(item, options, node);
  const attrs = [`id="${attr(node.id || item.id)}"`, `class="${attr(classes)}"`];

  for (const [name, value] of Object.entries(node.attributes || {})) {
    if (['id', 'class', 'style'].includes(name)) continue;
    attrs.push(`${name}="${attr(value)}"`);
  }
  if (!attrs.some((part) => /^data-id-object=/.test(part))) attrs.push(`data-id-object="${attr(item.id)}"`);
  if (item.semantic) attrs.push(`data-id-semantic="${attr(item.semantic)}"`);
  const style = gridStyle(item);
  if (style) attrs.push(`style="${attr(style)}"`);
  return `<${tag} ${attrs.join(' ')}>${itemContent(item)}</${tag}>`;
}

function itemClasses(item, options, node) {
  const classes = new Set(node.classList || []);
  if (options.mode === 'observation' && item.role === 'text') classes.add('observed-text');
  if (!classes.size || options.mode === 'observation') classes.add('id-object');
  return Array.from(classes).join(' ');
}

function gridStyle(item) {
  const cssVars = item.layout && item.layout.cssVars;
  if (!cssVars) return '';
  return Object.entries(cssVars).map(([name, value]) => `${name}:${value}`).join(';');
}

function itemContent(item) {
  if (item.role === 'table' && item.table) return tableContent(item.table);
  return escapeHtml((item.content && item.content.text) || '').replace(/\r\n|\r|\n/g, '<br>');
}

function tableContent(table) {
  const rows = table.rows || [];
  return rows.map((row) => `<tr>${(row.cells || []).map((cell) => {
    const tag = cell.header ? 'th' : 'td';
    return `<${tag}>${escapeHtml(cell.text || '')}</${tag}>`;
  }).join('')}</tr>`).join('');
}

function authoringReport(model, pages, options) {
  const inferred = pages.filter((page) => !page.modelPage.sourceFile).length;
  return {
    ok: true,
    mode: options.mode || model.reverseMode || 'structured',
    pages: pages.length,
    inferredPageFiles: inferred,
    inference: {
      source: inferred ? 'observation-page-split' : 'source-labels',
      confidence: inferred ? 'low' : 'high',
    },
  };
}

function writeText(root, relativePath, text) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

function structureOrder(item) {
  const order = item.structure && Number(item.structure.order);
  return Number.isFinite(order) ? order : 0;
}

function safeFile(value) {
  return String(value || 'page').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}

function safeTag(value) {
  return /^(section|div|p|h1|h2|h3|h4|h5|h6|figure|table|span)$/i.test(value) ? String(value).toLowerCase() : 'div';
}

function tagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'table') return 'table';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces);
  return String(value || '').split(/\r?\n/).map((line) => (line ? `${prefix}${line}` : line)).join('\n');
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  writeReverseAuthorPackage,
};
