const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { checkAuthorPackageEntry } = require('../../src/authoring');

function captureThrow(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('Expected function to throw');
}

test('writeReverseAuthorPackage splits tagged model into author source package', () => {
  const outDir = path.resolve('test/workspace/reverse-author-package-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = writeReverseAuthorPackage(taggedModel(), { outDir, mode: 'authoring' });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.config.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'pages/01-agenda.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/tokens.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/layout.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/components.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/pages.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/reverse-overrides.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'reports/authoring-report.json')), true);

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.match(pageHtml, /<section class="page"/);
  assert.match(pageHtml, /data-id-source-file="pages\/01-agenda\.html"/);
  assert.match(pageHtml, /<h2[^>]+class="[^"]*page-title[^"]*grid-item[^"]*pstyle-page-title/);
  assert.match(pageHtml, /--grid-col:1/);

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.deepEqual(config.pages, [{ id: 'agenda', file: 'pages/01-agenda.html' }]);
  assert.equal(checkAuthorPackageEntry(path.join(outDir, 'deck.config.json')).ok, true);
});

test('writeReverseAuthorPackage writes a separate local reveal presentation without changing conversion entry', () => {
  const outDir = path.resolve('test/workspace/reverse-author-reveal-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = writeReverseAuthorPackage(taggedModel(), { outDir, mode: 'authoring' });

  assert.equal(result.presentation, path.join(outDir, 'presentation.html'));
  assert.equal(fs.existsSync(path.join(outDir, 'presentation.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'vendor/reveal/reveal.css')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'vendor/reveal/reveal.js')), true);
  assert.equal(checkAuthorPackageEntry(path.join(outDir, 'deck.config.json')).ok, true);

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.equal(config.entry, 'deck.html');

  const deckHtml = fs.readFileSync(path.join(outDir, 'deck.html'), 'utf8');
  assert.doesNotMatch(deckHtml, /Reveal\.initialize|class="reveal"|vendor\/reveal/);
  assert.match(deckHtml, /<main class="deck" data-id-document="architecture-report"/);

  const presentationHtml = fs.readFileSync(path.join(outDir, 'presentation.html'), 'utf8');
  assert.match(presentationHtml, /<link rel="stylesheet" href="vendor\/reveal\/reveal\.css">/);
  assert.match(presentationHtml, /<script src="vendor\/reveal\/reveal\.js"><\/script>/);
  assert.match(presentationHtml, /<div class="reveal hi-reveal" data-id-ignore="true">/);
  assert.match(presentationHtml, /<div class="slides">/);
  assert.match(presentationHtml, /<section[^>]+class="page"[^>]+data-page="agenda"/);
  assert.match(presentationHtml, /Reveal\.initialize\(\{/);
});

test('writeReverseAuthorPackage still splits observation models by page', () => {
  const outDir = path.resolve('test/workspace/reverse-author-observed-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = writeReverseAuthorPackage(observedModel(), { outDir, mode: 'observation' });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'pages/00-page-1.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'styles/reverse-overrides.css')), true);

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/00-page-1.html'), 'utf8');
  assert.match(pageHtml, /data-id-reverse-mode="observation"/);
  assert.match(pageHtml, /data-id-observed="true"/);
  assert.match(pageHtml, /class="observed-text id-object"/);

  const candidates = JSON.parse(fs.readFileSync(path.join(outDir, 'reports/semantic-candidates.json'), 'utf8'));
  assert.equal(candidates.presetId, null);

  const overrides = fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8');
  assert.match(overrides, /\[id="observed-title"\]/);
  assert.match(overrides, /position:absolute/);
});

test('writeReverseAuthorPackage renders applied parent page decoration without template placeholders', () => {
  const outDir = path.resolve('test/workspace/reverse-author-parent-page-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'parent-page-test',
    title: 'Parent Page Test',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    parentPages: [
      {
        id: 'A-正文',
        name: 'A-正文',
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'parent-rule',
            role: 'line',
            layerName: 'text',
            sourceType: 'GraphicLine',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 40, y: 420, width: 720, height: 0 },
            vectorGeometry: {
              kind: 'line',
              x1: 40,
              y1: 420,
              x2: 760,
              y2: 420,
            },
            visualStyle: { strokeColor: '#c8102e', strokeWeight: 2 },
          },
          {
            id: 'template-title',
            role: 'text',
            layerName: 'text',
            sourceType: 'TextFrame',
            semantic: 'unknown',
            bounds: { x: 40, y: 40, width: 420, height: 40 },
            content: { text: '中文本页标题/ English Page Title', runs: [] },
            textStyle: { pointSize: 24, fillColor: '#123456' },
          },
          {
            id: 'template-note',
            role: 'text',
            layerName: 'PageNotes',
            sourceType: 'TextFrame',
            semantic: 'unknown',
            bounds: { x: 40, y: 80, width: 420, height: 40 },
            content: { text: '本页一般用于放效果图', runs: [] },
          },
          {
            id: 'image-placeholder-frame',
            role: 'graphic',
            layerName: '图片',
            sourceType: 'Rectangle',
            semantic: 'unknown',
            bounds: { x: 120, y: 120, width: 240, height: 160 },
            visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
          },
        ],
      },
    ],
    pages: [
      {
        id: 'page-1',
        semantic: 'page-1',
        parentPageName: 'A-正文',
        width: 800,
        height: 450,
        items: [],
      },
    ],
    styles: {},
    assets: [],
  }, { outDir, mode: 'observation' });

  const html = fs.readFileSync(path.join(outDir, 'pages/00-page-1.html'), 'utf8');
  assert.match(html, /id="page-1-parent-rule"/);
  assert.match(html, /data-id-parent-page-item="A-正文"/);
  assert.match(html, /data-id-parent-page-source-id="parent-rule"/);
  assert.match(html, /class="[^"]*id-parent-page-object/);
  assert.doesNotMatch(html, /中文本页标题/);
  assert.doesNotMatch(html, /English Page Title/);
  assert.doesNotMatch(html, /本页一般用于/);
  assert.doesNotMatch(html, /image-placeholder-frame/);
});

test('writeReverseAuthorPackage restores source resource tags instead of div placeholders', () => {
  const outDir = path.resolve('test/workspace/reverse-author-resource-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = writeReverseAuthorPackage(resourceModel(), { outDir, mode: 'authoring' });

  const html = fs.readFileSync(path.join(outDir, 'pages/00-cover.html'), 'utf8');
  assert.match(html, /<img[^>]+class="hero-media"/);
  assert.match(html, /src="\.\.\/smoke-assets\/photos\/industrial-site\.jpg"/);
  assert.doesNotMatch(html, /<div[^>]+src="/);
  assert.match(html, /<object[^>]+class="pdf-source"/);
  assert.match(html, /data="\.\.\/reference-pdfs\/ice-rink-layout-reference\.pdf"/);
  assert.doesNotMatch(html, /<div[^>]+data="\.\.\/reference-pdfs/);
  assert.equal(result.report.assets.policy, 'reference');
  assert.equal(result.report.assets.copied, 0);
});

test('writeReverseAuthorPackage copies source assets into the author package and rewrites resource paths', () => {
  const root = path.resolve('test/workspace/reverse-author-resource-copy-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(path.join(sourceRoot, '../smoke-assets/photos/industrial-site.jpg'), 'image-bytes');
  writeFixtureFile(path.join(sourceRoot, '../reference-pdfs/ice-rink-layout-reference.pdf'), 'pdf-bytes');

  const result = writeReverseAuthorPackage(resourceModel(), { outDir, sourceRoot, mode: 'authoring', assetPolicy: 'copy' });

  const html = fs.readFileSync(path.join(outDir, 'pages/00-cover.html'), 'utf8');
  assert.match(html, /src="assets\/smoke-assets\/photos\/industrial-site\.jpg"/);
  assert.match(html, /data="assets\/reference-pdfs\/ice-rink-layout-reference\.pdf"/);
  assert.equal(fs.existsSync(path.join(outDir, 'assets/smoke-assets/photos/industrial-site.jpg')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'assets/reference-pdfs/ice-rink-layout-reference.pdf')), true);
  assert.equal(result.report.assets.copied, 2);
  assert.deepEqual(result.report.assets.missing, []);
});

test('writeReverseAuthorPackage maps absolute placed asset aliases without duplicating copied files', () => {
  const root = path.resolve('test/workspace/reverse-author-asset-alias-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  const imagePath = path.resolve(sourceRoot, '../smoke-assets/photos/industrial-site.jpg');
  writeFixtureFile(imagePath, 'image-bytes');
  const model = resourceModel();
  model.pages[0].items[0].asset.path = imagePath;
  model.assets = [{ name: 'industrial-site.jpg', path: imagePath, status: 'NORMAL' }];

  const result = writeReverseAuthorPackage(model, { outDir, sourceRoot, mode: 'authoring', assetPolicy: 'copy' });

  assert.equal(result.report.assets.copiedFiles.filter((file) => /industrial-site\.jpg$/.test(file)).length, 1);
  assert.equal(fs.existsSync(path.join(outDir, 'assets/smoke-assets/photos/industrial-site.jpg')), true);
});

test('writeReverseAuthorPackage preserves known source css files for a second HTML to InDesign pass', () => {
  const root = path.resolve('test/workspace/reverse-author-source-css-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(path.join(sourceRoot, 'styles/components.css'), '.swatch { width: 18px; height: 18px; background: #c8102e; }');
  writeFixtureFile(path.join(sourceRoot, 'styles/layout.css'), '.page { display:grid; }');
  writeFixtureFile(path.join(sourceRoot, 'styles/tokens.css'), ':root { --id-text: #14324a; }');
  writeFixtureFile(path.join(sourceRoot, 'styles/pages.css'), '#agenda-page { color: #14324a; }');

  const result = writeReverseAuthorPackage(taggedModel(), { outDir, sourceRoot, mode: 'authoring' });

  const copiedComponents = fs.readFileSync(path.join(outDir, 'styles/components.css'), 'utf8');
  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.equal(copiedComponents, '.swatch { width: 18px; height: 18px; background: #c8102e; }');
  assert.deepEqual(config.styles, [
    'styles/tokens.css',
    'styles/layout.css',
    'styles/components.css',
    'styles/pages.css',
    'styles/reverse-overrides.css',
  ]);
  assert.equal(result.report.sourceCss.copied, 4);
  assert.deepEqual(result.report.sourceCss.missing, []);
});

test('writeReverseAuthorPackage emits grid-first layout css and avoids absolute overrides for grid items', () => {
  const outDir = path.resolve('test/workspace/reverse-author-grid-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage(taggedModel(), { outDir, mode: 'authoring' });

  const layoutCss = fs.readFileSync(path.join(outDir, 'styles/layout.css'), 'utf8');
  const overrides = fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8');
  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');

  assert.match(layoutCss, /\.page \{[\s\S]*display: grid/);
  assert.match(layoutCss, /grid-template-columns: repeat\(var\(--id-grid-columns, 12\), minmax\(0, 1fr\)\)/);
  assert.match(layoutCss, /\.grid-item \{[\s\S]*grid-column: var\(--grid-col\) \/ span var\(--grid-span, 1\)/);
  assert.match(pageHtml, /style="[^"]*--id-grid-columns:12/);
  assert.doesNotMatch(overrides, /#agenda-title/);
});

test('writeReverseAuthorPackage preserves source grid and margin units in page variables', () => {
  const outDir = path.resolve('test/workspace/reverse-author-unit-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const model = taggedModel();
  model.pages[0].sourceNode.attributes = {
    ...model.pages[0].sourceNode.attributes,
    'data-id-margin': '14mm 16mm 10mm 18mm',
    'data-id-column-gutter': '6mm',
    'data-id-row-gutter': '8mm',
    'data-id-baseline': '4mm',
  };
  model.pages[0].margins = { top: 52.91, right: 60.47, bottom: 37.79, left: 68.03 };

  writeReverseAuthorPackage(model, { outDir, mode: 'authoring' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.match(pageHtml, /data-id-margin="14mm 16mm 10mm 18mm"/);
  assert.match(pageHtml, /style="[^"]*--id-column-gutter:6mm/);
  assert.match(pageHtml, /style="[^"]*--id-row-gutter:8mm/);
  assert.match(pageHtml, /style="[^"]*--id-baseline:4mm/);
  assert.match(pageHtml, /style="[^"]*--id-margin-top:14mm/);
  assert.match(pageHtml, /style="[^"]*--id-margin-right:16mm/);
  assert.match(pageHtml, /style="[^"]*--id-margin-bottom:10mm/);
  assert.match(pageHtml, /style="[^"]*--id-margin-left:18mm/);
});

test('writeReverseAuthorPackage preserves source package config metadata', () => {
  const root = path.resolve('test/workspace/reverse-author-config-metadata-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(path.join(sourceRoot, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'architecture-report',
    title: '冰球场首层平面排布汇报',
    profile: 'architecture-report',
    unitMode: 'presentation',
    targetSize: 'source',
    entry: 'deck.html',
    styles: ['styles/tokens.css'],
    pages: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
    assets: { root: 'assets' },
  }, null, 2));
  writeFixtureFile(path.join(sourceRoot, 'styles/tokens.css'), ':root { --ink: #123456; }');

  writeReverseAuthorPackage(taggedModel(), { outDir, sourceRoot, mode: 'structured' });

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.equal(config.id, 'architecture-report');
  assert.equal(config.title, '冰球场首层平面排布汇报');
  assert.equal(config.profile, 'architecture-report');
});

test('writeReverseAuthorPackage preserves source page ids when reverse page semantic is absent', () => {
  const root = path.resolve('test/workspace/reverse-author-source-page-id-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(path.join(sourceRoot, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'architecture-report',
    title: '建筑汇报',
    profile: 'architecture-report',
    unitMode: 'presentation',
    targetSize: 'source',
    entry: 'deck.html',
    styles: ['styles/tokens.css'],
    pages: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
    assets: { root: 'assets' },
  }, null, 2));
  writeFixtureFile(path.join(sourceRoot, 'styles/tokens.css'), ':root { --ink: #123456; }');
  const model = taggedModel();
  model.pages[0].semantic = null;

  writeReverseAuthorPackage(model, { outDir, sourceRoot, mode: 'structured' });

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.deepEqual(config.pages, [{ id: 'agenda', file: 'pages/01-agenda.html' }]);
  assert.match(pageHtml, /data-page="agenda"/);
});

test('writeReverseAuthorPackage writes clean structured author markup', () => {
  const outDir = path.resolve('test/workspace/reverse-author-clean-markup-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = taggedModel();
  model.pages[0].items.push({
    id: 'legend-swatch',
    role: 'shape',
    semantic: 'unknown',
    sourceNode: {
      tagName: 'span',
      classList: ['swatch'],
      attributes: { style: 'background:var(--accent)' },
    },
    structure: { parentId: 'agenda-page', order: 2 },
    bounds: { x: 0, y: 0, width: 20, height: 20 },
  });

  writeReverseAuthorPackage(model, { outDir, mode: 'structured' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.doesNotMatch(pageHtml, /data-id-reverse-mode/);
  assert.doesNotMatch(pageHtml, /data-id-semantic="unknown"/);
  assert.match(pageHtml, /\sdata-id-object(\s|>)/);
  assert.doesNotMatch(pageHtml, /data-id-object=""/);
});

test('writeReverseAuthorPackage accepts model profile sourced only from reverse options', () => {
  const outDir = path.resolve('test/workspace/reverse-author-option-profile-chain-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'option-profile.indd', mode: 'structured' },
    document: {
      name: 'option-profile.indd',
      labels: [
        {
          protocol: 'html-indesign',
          version: 1,
          kind: 'document',
          id: 'option-profile',
          title: 'Option Profile',
          sourcePackage: {
            schemaVersion: 1,
            config: 'deck.config.json',
            entry: 'deck.html',
          },
        },
      ],
    },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [
          {
            protocol: 'html-indesign',
            version: 1,
            kind: 'page',
            id: 'page-1',
          },
        ],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [],
      },
    ],
  }, { mode: 'structured', profile: 'architecture-report' });

  assert.equal(model.profile, 'architecture-report');
  assert.equal(model.sourcePackage.profile, 'architecture-report');

  const result = writeReverseAuthorPackage(model, { outDir, mode: 'structured' });
  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));

  assert.equal(result.ok, true);
  assert.equal(config.profile, 'architecture-report');
  assert.equal(checkAuthorPackageEntry(path.join(outDir, 'deck.config.json')).ok, true);
});

test('writeReverseAuthorPackage writes semantic candidate report', () => {
  const outDir = path.resolve('test/workspace/reverse-author-semantic-candidates-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = taggedModel();
  model.pages[0].items.push({
    id: 'custom-panel',
    role: 'shape',
    semantic: 'custom-panel',
    layer: 'custom-layer',
    sourceNode: {
      tagName: 'div',
      id: 'custom-panel',
      classList: ['custom-panel'],
      attributes: { 'data-id-object': '' },
    },
    structure: { parentId: 'agenda-page', order: 2 },
    bounds: { x: 0, y: 0, width: 20, height: 20 },
  });

  writeReverseAuthorPackage(model, {
    outDir,
    mode: 'structured',
    semanticPreset: {
      schemaVersion: 1,
      id: 'project-semantic',
      styleNameMap: {
        paragraphStyles: {
          'page-title': '页面标题',
        },
        objectStyles: {
          'page-title': '页面标题',
        },
        layers: {
          content: '内容',
        },
      },
    },
  });

  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'reports/semantic-candidates.json'), 'utf8'));
  assert.deepEqual(report, {
    schemaVersion: 1,
    presetId: 'project-semantic',
    candidates: [
      {
        kind: 'layers',
        token: 'custom-layer',
        suggestedName: 'custom-layer',
        source: 'reverse-export',
        count: 1,
      },
      {
        kind: 'objectStyles',
        token: 'custom-panel',
        suggestedName: 'custom-panel',
        source: 'reverse-export',
        count: 1,
      },
    ],
  });
});

test('writeReverseAuthorPackage fails visibly when structured author package has no semantic preset source', () => {
  const outDir = path.resolve('test/workspace/reverse-author-missing-preset-source-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = taggedModel();
  delete model.profile;
  delete model.sourcePackage.profile;

  const error = captureThrow(() => writeReverseAuthorPackage(model, { outDir, mode: 'structured' }));

  assert.equal(error.code, 'SEMANTIC_PRESET_LOAD_FAILED');
  assert.match(error.message, /SEMANTIC_PRESET_LOAD_FAILED:profile-required/);
  assert.equal(fs.existsSync(outDir), false);
});

test('writeReverseAuthorPackage fails visibly when structured author package profile is unknown', () => {
  const outDir = path.resolve('test/workspace/reverse-author-bad-profile-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = taggedModel();
  model.profile = 'missing-profile';

  const error = captureThrow(() => writeReverseAuthorPackage(model, { outDir, mode: 'structured' }));

  assert.equal(error.code, 'SEMANTIC_PRESET_LOAD_FAILED');
  assert.match(error.message, /SEMANTIC_PRESET_LOAD_FAILED:missing-profile/);
  assert.equal(fs.existsSync(outDir), false);
});

test('writeReverseAuthorPackage rejects explicit empty semantic presets instead of loading profile fallback', () => {
  const root = path.resolve('test/workspace/reverse-author-empty-preset-test');
  fs.rmSync(root, { recursive: true, force: true });

  [null, {}, []].forEach((semanticPreset, index) => {
    const outDir = path.join(root, String(index));
    const error = captureThrow(() => writeReverseAuthorPackage(taggedModel(), {
      outDir,
      mode: 'structured',
      semanticPreset,
    }));

    assert.equal(error.code, 'SEMANTIC_PRESET_LOAD_FAILED');
    assert.match(error.message, /SEMANTIC_PRESET_LOAD_FAILED:semanticPreset/);
    assert.equal(fs.existsSync(outDir), false);
  });
});

test('writeReverseAuthorPackage reports accepted partial and observed reverse labels', () => {
  const outDir = path.resolve('test/workspace/reverse-author-label-report-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = observedModel();
  model.pages[0].labelStatus = 'accepted';
  model.pages[0].items[0].labelStatus = 'partial';
  model.pages[0].items[0].rejectionReasons = ['unknown-layout'];
  model.pages[0].items.push({
    id: 'foreign-item',
    role: 'text',
    semantic: 'unknown',
    bounds: { x: 20, y: 140, width: 160, height: 40 },
    styleRefs: {},
    content: { text: '外来标签', runs: [] },
    labelStatus: 'observed',
    rejectionReasons: ['unknown-semantic'],
  });

  writeReverseAuthorPackage(model, { outDir, mode: 'observation' });

  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'reports/authoring-report.json'), 'utf8'));
  assert.deepEqual(report.labels, {
    accepted: 1,
    partial: 1,
    observed: 1,
    rejections: [
      { pageId: 'page-1', itemId: 'observed-title', reasons: ['unknown-layout'] },
      { pageId: 'page-1', itemId: 'foreign-item', reasons: ['unknown-semantic'] },
    ],
  });
});

test('writeReverseAuthorPackage keeps structured source geometry in html instead of dead override rules', () => {
  const outDir = path.resolve('test/workspace/reverse-author-overrides-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const model = taggedModel();
  model.pages[0].items.push(
    {
      id: 'timeline',
      role: 'shape',
      semantic: 'timeline-line',
      sourceNode: {
        tagName: 'div',
        id: 'timeline',
        classList: ['line'],
        attributes: { style: 'left:158mm;top:184mm;width:225mm;transform:rotate(0deg)', 'data-id-object': '' },
      },
      structure: { parentId: 'agenda-page', order: 2 },
      bounds: { x: 597.17, y: 695.43, width: 850.39, height: 0 },
    },
    {
      id: 'chapter-1-border-left',
      role: 'shape',
      semantic: 'unknown',
      sourceNode: { tagName: 'div', id: 'chapter-1-border-left', classList: ['id-object'], attributes: {} },
      structure: { parentId: 'agenda-page', order: 3 },
      labels: [{ generated: true }],
      bounds: { x: 0, y: 0, width: 10, height: 100 },
    },
  );

  writeReverseAuthorPackage(model, { outDir, mode: 'authoring' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  const overrides = fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8');

  assert.match(pageHtml, /id="timeline"[^>]+style="left:158mm;top:184mm;width:225mm;transform:rotate\(0deg\)"/);
  assert.doesNotMatch(pageHtml, /chapter-1-border-left/);
  assert.doesNotMatch(overrides, /#timeline/);
  assert.doesNotMatch(overrides, /#chapter-1-border-left/);
});

function taggedModel() {
  return {
    kind: 'DocumentModel',
    id: 'architecture-report',
    title: '建筑汇报',
    profile: 'architecture-report',
    reverseMode: 'structured',
    sourcePackage: {
      schemaVersion: 1,
      config: 'deck.config.json',
      entry: 'deck.html',
      profile: 'architecture-report',
      styleFiles: ['styles/tokens.css', 'styles/layout.css', 'styles/components.css', 'styles/pages.css'],
      pageFiles: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
      assetRoot: 'assets',
    },
    styles: {
      paragraphStyles: {
        '页面标题': { token: 'page-title', name: '页面标题', safeName: 'page-title', css: 'font-size:32pt; color:#123456' },
      },
      objectStyles: {},
      characterStyles: {},
    },
    pages: [
      {
        id: 'agenda-page',
        semantic: 'agenda',
        sourceFile: 'pages/01-agenda.html',
        sourceNode: {
          tagName: 'section',
          id: 'agenda-page',
          classList: ['page'],
          attributes: { 'data-page': 'agenda', 'data-id-layout': 'contents-grid' },
        },
        layout: 'contents-grid',
        width: 1587.39,
        height: 892.91,
        grid: { columns: 12, rows: 6, columnGutter: 6, rowGutter: 8, baseline: 4 },
        items: [
          {
            id: 'agenda-title',
            role: 'text',
            semantic: 'page-title',
            tagName: 'h2',
            sourceFile: 'pages/01-agenda.html',
            sourceNode: {
              tagName: 'h2',
              id: 'agenda-title',
              classList: ['page-title', 'grid-item'],
              attributes: { 'data-id-object': '', 'data-id-paragraph-style': 'page-title' },
            },
            structure: { parentId: 'agenda-page', order: 1, containerPolicy: 'group' },
            layout: {
              grid: { col: 1, span: 4, row: 1, rowSpan: 1 },
              cssVars: { '--grid-col': '1', '--grid-span': '4', '--grid-row': '1', '--grid-row-span': '1' },
            },
            bounds: { x: 120, y: 140, width: 460, height: 80 },
            styleRefs: { paragraphStyle: '页面标题' },
            content: { text: '汇报结构', runs: [] },
          },
        ],
      },
    ],
  };
}

function observedModel() {
  return {
    kind: 'DocumentModel',
    id: 'observed-report',
    title: 'Observed',
    reverseMode: 'observation',
    pages: [
      {
        id: 'page-1',
        width: 800,
        height: 450,
        items: [
          {
            id: 'observed-title',
            role: 'text',
            semantic: 'unknown',
            tagName: 'p',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            styleRefs: {},
            content: { text: '未标注标题', runs: [] },
            textStyle: { pointSize: 32, fillColor: '#123456' },
          },
        ],
      },
    ],
  };
}

function resourceModel() {
  return {
    kind: 'DocumentModel',
    id: 'resource-report',
    title: 'Resource Report',
    unitMode: 'presentation',
    sourcePackage: {
      entry: 'deck.html',
      profile: 'architecture-report',
      assetRoot: 'assets',
    },
    styles: {},
    pages: [
      {
        id: 'cover-page',
        semantic: 'cover',
        sourceFile: 'pages/00-cover.html',
        sourceNode: {
          tagName: 'section',
          id: 'cover-page',
          classList: ['page'],
          attributes: { 'data-page': 'cover', 'data-id-grid': '12x8' },
        },
        width: 1920,
        height: 1080,
        grid: { columns: 12, rows: 8, columnGutter: 24, rowGutter: 20, baseline: 16 },
        items: [
          {
            id: 'hero-media',
            role: 'graphic',
            semantic: 'hero-media',
            sourceNode: {
              tagName: 'img',
              id: 'hero-media',
              classList: ['hero-media'],
              attributes: {
                src: '../smoke-assets/photos/industrial-site.jpg',
                alt: 'industrial roof aerial',
                'data-id-object': '',
              },
            },
            structure: { parentId: 'cover-page', order: 1, containerPolicy: 'leaf' },
            layout: {
              grid: { col: 1, span: 12, row: 1, rowSpan: 8 },
              cssVars: { '--grid-col': '1', '--grid-span': '12', '--grid-row': '1', '--grid-row-span': '8' },
            },
            asset: { path: '../smoke-assets/photos/industrial-site.jpg', graphicType: 'image' },
          },
          {
            id: 'pdf-source',
            role: 'graphic',
            semantic: 'drawing-pdf',
            sourceNode: {
              tagName: 'object',
              id: 'pdf-source',
              classList: ['pdf-source'],
              attributes: {
                data: '../reference-pdfs/ice-rink-layout-reference.pdf',
                type: 'application/pdf',
                'data-id-object': '',
                'data-id-pdf-page': '1',
              },
            },
            structure: { parentId: 'cover-page', order: 2, containerPolicy: 'leaf' },
            layout: {
              grid: { col: 7, span: 5, row: 2, rowSpan: 5 },
              cssVars: { '--grid-col': '7', '--grid-span': '5', '--grid-row': '2', '--grid-row-span': '5' },
            },
            asset: { path: '../reference-pdfs/ice-rink-layout-reference.pdf', graphicType: 'pdf' },
          },
        ],
      },
    ],
  };
}

function writeFixtureFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
