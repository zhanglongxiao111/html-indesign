const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { writeReverseAuthorPackage } = require('../../src/indesign-reverse');
const { checkAuthorPackageEntry } = require('../../src/authoring');

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
  assert.match(pageHtml, /<h2[^>]+class="page-title grid-item"/);
  assert.match(pageHtml, /--grid-col:1/);

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.deepEqual(config.pages, [{ id: 'agenda', file: 'pages/01-agenda.html' }]);
  assert.equal(checkAuthorPackageEntry(path.join(outDir, 'deck.config.json')).ok, true);
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

  const overrides = fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8');
  assert.match(overrides, /#observed-title/);
  assert.match(overrides, /position:absolute/);
});

test('writeReverseAuthorPackage restores source resource tags instead of div placeholders', () => {
  const outDir = path.resolve('test/workspace/reverse-author-resource-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage(resourceModel(), { outDir, mode: 'authoring' });

  const html = fs.readFileSync(path.join(outDir, 'pages/00-cover.html'), 'utf8');
  assert.match(html, /<img[^>]+class="hero-media"/);
  assert.match(html, /src="\.\.\/smoke-assets\/photos\/industrial-site\.jpg"/);
  assert.doesNotMatch(html, /<div[^>]+src="/);
  assert.match(html, /<object[^>]+class="pdf-source"/);
  assert.match(html, /data="\.\.\/reference-pdfs\/ice-rink-layout-reference\.pdf"/);
  assert.doesNotMatch(html, /<div[^>]+data="\.\.\/reference-pdfs/);
});

function taggedModel() {
  return {
    kind: 'DocumentModel',
    id: 'architecture-report',
    title: '建筑汇报',
    reverseMode: 'structured',
    sourcePackage: {
      schemaVersion: 1,
      config: 'deck.config.json',
      entry: 'deck.html',
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
