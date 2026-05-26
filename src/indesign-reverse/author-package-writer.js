const fs = require('fs');
const path = require('path');
const { writeAuthorPackageEntry } = require('../authoring');
const { writeAuthorCssFiles } = require('./author-css-writer');
const { copyAuthorAssets } = require('./author-asset-packager');
const { authorStyleFiles, copySourceCssFiles, planSourceCss } = require('./author-source-css');
const { attrsToHtml, mergeAttributes } = require('./author-attribute-writer');
const { pageItemsToAuthorHtml } = require('./author-html-tree');

function writeReverseAuthorPackage(model, options = {}) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('writeReverseAuthorPackage requires a DocumentModel');
  }
  const outDir = path.resolve(options.outDir || 'reverse-export/author');
  const sourceRoot = options.sourceRoot ? path.resolve(options.sourceRoot) : null;
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'reports'), { recursive: true });

  const pages = pageEntries(model);
  const generatedCss = writeAuthorCssFiles(model);
  const sourceCss = planSourceCss(model, { sourceRoot, generatedCss });
  const styleFiles = authorStyleFiles({ sourceCss, generatedCss, sourceRoot });
  const assetCopy = copyAuthorAssets(model, {
    outDir,
    sourceRoot,
    assetRoot: (model.sourcePackage && model.sourcePackage.assetRoot) || 'assets',
  });
  const renderOptions = { ...options, assetPathMap: assetCopy.pathMap };
  const sourceConfig = readSourceConfig(sourceRoot);
  const config = deckConfigFor(model, pages, styleFiles, sourceConfig);
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify(config, null, 2), 'utf8');

  for (const [relativePath, css] of Object.entries(generatedCss)) {
    if (sourceCss.copiedSet.has(slash(relativePath))) continue;
    writeText(outDir, relativePath, css);
  }
  copySourceCssFiles(outDir, sourceCss);
  for (const page of pages) {
    writeText(outDir, page.file, pageHtml(page.modelPage, page.file, renderOptions));
  }

  const report = authoringReport(model, pages, options, {
    assets: assetCopy.report,
    sourceCss: sourceCss.report,
  });
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

function deckConfigFor(model, pages, styleFiles, sourceConfig = null) {
  const sourcePackage = model.sourcePackage || {};
  const id = sourceConfig && sourceConfig.id || sourcePackage.id || model.id;
  const title = sourceConfig && sourceConfig.title || sourcePackage.title || model.title || id;
  const hasSourceProfile = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'profile');
  const hasPackageProfile = sourcePackage && Object.prototype.hasOwnProperty.call(sourcePackage, 'profile');
  return {
    schemaVersion: sourceConfig && sourceConfig.schemaVersion || sourcePackage.schemaVersion || 1,
    id,
    title,
    profile: hasSourceProfile ? sourceConfig.profile : hasPackageProfile ? sourcePackage.profile : model.profile || null,
    unitMode: sourceConfig && sourceConfig.unitMode || model.unitMode || 'presentation',
    targetSize: sourceConfig && sourceConfig.targetSize || 'source',
    entry: sourceConfig && sourceConfig.entry || sourcePackage.entry || 'deck.html',
    styles: styleFiles,
    pages: pages.map((page) => ({ id: page.id, file: page.file })),
    assets: { root: sourceConfig && sourceConfig.assets && sourceConfig.assets.root || sourcePackage.assetRoot || 'assets' },
  };
}

function readSourceConfig(sourceRoot) {
  if (!sourceRoot) return null;
  const configPath = path.join(sourceRoot, 'deck.config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_error) {
    return null;
  }
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
  const items = pageItemsToAuthorHtml(page, options);
  return [`<section ${attrs}>`, indent(items, 2), '</section>', ''].join('\n');
}

function sourcePageAttrs(page, sourceFile, options) {
  const sourceNode = page.sourceNode || {};
  const attrs = mergeAttributes(sourceNode.attributes);
  attrs.class = sourceNode.classList && sourceNode.classList.length ? sourceNode.classList.join(' ') : 'page';
  attrs.id = sourceNode.id || page.id;
  attrs['data-page'] = page.semantic || page.id;
  attrs['data-id-source-file'] = sourceFile;
  if (options.mode === 'observation' || page.semantic === 'unknown') attrs['data-id-observed'] = 'true';
  if (options.mode && options.mode !== 'structured') attrs['data-id-reverse-mode'] = options.mode;
  if (page.grid) {
    attrs['data-id-grid'] = attrs['data-id-grid'] || `${page.grid.columns}x${page.grid.rows}`;
    if (page.grid.columnGutter != null) attrs['data-id-column-gutter'] = attrs['data-id-column-gutter'] || `${page.grid.columnGutter}px`;
    if (page.grid.rowGutter != null) attrs['data-id-row-gutter'] = attrs['data-id-row-gutter'] || `${page.grid.rowGutter}px`;
    if (page.grid.baseline != null) attrs['data-id-baseline'] = attrs['data-id-baseline'] || `${page.grid.baseline}px`;
  }
  const style = pageStyleVars(page);
  if (style) attrs.style = style;
  return attrsToHtml(orderPageAttrs(attrs));
}

function pageStyleVars(page) {
  const pairs = [];
  const attrs = (page.sourceNode && page.sourceNode.attributes) || {};
  if (page.grid) {
    pairs.push(['--id-grid-columns', page.grid.columns]);
    pairs.push(['--id-grid-rows', page.grid.rows]);
    if (page.grid.columnGutter != null || attrs['data-id-column-gutter']) {
      pairs.push(['--id-column-gutter', attrs['data-id-column-gutter'] || `${page.grid.columnGutter}px`]);
    }
    if (page.grid.rowGutter != null || attrs['data-id-row-gutter']) {
      pairs.push(['--id-row-gutter', attrs['data-id-row-gutter'] || `${page.grid.rowGutter}px`]);
    }
    if (page.grid.baseline != null || attrs['data-id-baseline']) {
      pairs.push(['--id-baseline', attrs['data-id-baseline'] || `${page.grid.baseline}px`]);
    }
  }
  const marginTokens = marginTokensFor(attrs['data-id-margin']);
  if (marginTokens) {
    pairs.push(['--id-margin-top', marginTokens.top]);
    pairs.push(['--id-margin-right', marginTokens.right]);
    pairs.push(['--id-margin-bottom', marginTokens.bottom]);
    pairs.push(['--id-margin-left', marginTokens.left]);
  } else if (page.margins) {
    pairs.push(['--id-margin-top', `${page.margins.top}px`]);
    pairs.push(['--id-margin-right', `${page.margins.right}px`]);
    pairs.push(['--id-margin-bottom', `${page.margins.bottom}px`]);
    pairs.push(['--id-margin-left', `${page.margins.left}px`]);
  }
  return pairs.map(([name, value]) => `${name}:${value}`).join(';');
}

function marginTokensFor(value) {
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  if (tokens.length === 1) {
    return { top: tokens[0], right: tokens[0], bottom: tokens[0], left: tokens[0] };
  }
  if (tokens.length === 2) {
    return { top: tokens[0], right: tokens[1], bottom: tokens[0], left: tokens[1] };
  }
  if (tokens.length === 3) {
    return { top: tokens[0], right: tokens[1], bottom: tokens[2], left: tokens[1] };
  }
  return { top: tokens[0], right: tokens[1], bottom: tokens[2], left: tokens[3] };
}

function authoringReport(model, pages, options, extras = {}) {
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
    assets: extras.assets || { copied: 0, missing: [] },
    sourceCss: extras.sourceCss || { copied: 0, missing: [] },
  };
}

function writeText(root, relativePath, text) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

function safeFile(value) {
  return String(value || 'page').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function orderPageAttrs(attrs) {
  const out = {};
  for (const key of ['class', 'id', 'data-page', 'data-id-source-file', 'data-id-layout', 'data-id-grid', 'data-id-column-gutter', 'data-id-row-gutter', 'data-id-baseline', 'data-id-observed', 'data-id-reverse-mode', 'style']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces);
  return String(value || '').split(/\r?\n/).map((line) => (line ? `${prefix}${line}` : line)).join('\n');
}

module.exports = {
  writeReverseAuthorPackage,
};
