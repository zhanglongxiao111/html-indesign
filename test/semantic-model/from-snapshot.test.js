const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');
const { snapshotToSemanticModel } = require('../../src/semantic-model');

test('snapshotToSemanticModel builds document pages, styles, assets, and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, {
    unitMode: 'presentation',
    targetSize: 'same',
  });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.unitMode, 'presentation');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].items.length > 0, true);
  assert.equal(model.pages[0].labels[0].kind, 'page');
  assert.equal(model.styles.paragraphStyles && typeof model.styles.paragraphStyles, 'object');
  assert.equal(Array.isArray(model.assets), true);
});

test('snapshotToSemanticModel preserves page layout and parent page metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'agenda-page',
      index: 0,
      widthMm: 508,
      heightMm: 285.75,
      rectPx: { x: 0, y: 0, width: 1920, height: 1080 },
      classList: ['page'],
      attributes: {
        'data-page': 'agenda',
        'data-id-semantic': 'agenda',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-name': '汇报母版',
        'data-id-layout': 'contents-grid',
        'data-id-margin': '14mm',
        'data-id-grid': '12x6',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].semantic, 'agenda');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.deepEqual(model.pages[0].margins, { top: 14, right: 14, bottom: 14, left: 14 });
});

test('snapshotToSemanticModel accepts alternate parent page display-name metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'p1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: {
        'data-page': 'p1',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-display-name': '汇报母版',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.parentPages[0].name, '汇报母版');
});

test('snapshotToSemanticModel preserves authoring source package labels', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'deck.html' },
    sourcePackageInput: {
      attributes: {
        'data-id-source-package-config': 'deck.config.json',
        'data-id-source-package-schema': '1',
      },
      styleFiles: ['styles/tokens.css'],
      pageFiles: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
      assetRoot: 'assets',
    },
    pages: [
      {
        id: 'agenda-page',
        index: 0,
        widthMm: 420,
        heightMm: 236.25,
        rectPx: { x: 0, y: 0, width: 1587.39, height: 892.91 },
        attributes: {
          'data-page': 'agenda',
          'data-id-source-file': 'pages/01-agenda.html',
          'data-id-layout': 'contents-grid',
          'data-id-grid': '12x6',
          'data-id-column-gutter': '6mm',
          'data-id-row-gutter': '8mm',
          'data-id-baseline': '4mm',
        },
        classList: ['page'],
        computedStyle: { width: '1587.39px', height: '892.91px', backgroundColor: 'rgb(255, 255, 255)' },
        items: [
          {
            id: 'agenda-card',
            role: 'shape',
            tagName: 'div',
            classList: ['chapter-card', 'grid-item'],
            attributes: { 'data-id-object': '', 'data-id-object-style': 'chapter-card' },
            sourceNode: {
              tagName: 'div',
              id: 'agenda-card',
              classList: ['chapter-card', 'grid-item'],
              attributes: { 'data-id-object': '', 'data-id-object-style': 'chapter-card' },
            },
            cssVars: {
              '--grid-col': '5',
              '--grid-span': '3',
              '--grid-row': '2',
              '--grid-row-span': '2',
            },
            rectPx: { x: 100, y: 100, width: 200, height: 100 },
            boundsMm: { x: 10, y: 10, width: 20, height: 10 },
            computedStyle: {},
            authoredStyle: {},
            text: '',
            runs: [],
            table: [],
          },
        ],
      },
    ],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.equal(model.sourcePackage.config, 'deck.config.json');
  assert.equal(model.pages[0].sourceFile, 'pages/01-agenda.html');
  assert.equal(model.pages[0].grid.columns, 12);
  assert.equal(model.pages[0].items[0].sourceFile, 'pages/01-agenda.html');
  assert.deepEqual(model.pages[0].items[0].layout.grid, { col: 5, span: 3, row: 2, rowSpan: 2 });

  const documentLabel = model.labels.find((label) => label.kind === 'document');
  const pageLabel = model.pages[0].labels.find((label) => label.kind === 'page');
  const itemLabel = model.pages[0].items[0].labels.find((label) => label.kind === 'item');

  assert.equal(documentLabel.sourcePackage.config, 'deck.config.json');
  assert.equal(pageLabel.sourceFile, 'pages/01-agenda.html');
  assert.equal(itemLabel.sourceFile, 'pages/01-agenda.html');
  assert.equal(itemLabel.sourceNode.tagName, 'div');
  assert.equal(itemLabel.structure.parentId, 'agenda-page');
});

test('snapshotToSemanticModel labels source text runs and nonvisual ancestor nodes', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'agenda-page',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'agenda' },
      computedStyle: {},
      items: [
        {
          id: 'agenda-copy',
          role: 'text',
          tagName: 'p',
          classList: ['body-copy'],
          attributes: { 'data-id-paragraph-style': 'body-copy' },
          sourceNode: { tagName: 'p', id: 'agenda-copy', classList: ['body-copy'], attributes: { 'data-id-paragraph-style': 'body-copy' } },
          sourceAncestorNodes: [
            { sourcePath: 'section>div:nth-of-type(1)', tagName: 'div', id: null, classList: ['legend-item'], attributes: {} },
          ],
          documentOrder: 1,
          text: 'PDF 置入',
          rectPx: { x: 10, y: 10, width: 200, height: 30 },
          runs: [
            { text: 'PDF 置入', tagName: 'span', classList: ['accent'], attributes: { 'data-id-character-style': 'term-accent' } },
          ],
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  const label = model.pages[0].items[0].labels[0];

  assert.equal(label.sourceText, 'PDF 置入');
  assert.deepEqual(label.sourceRuns, [
    {
      text: 'PDF 置入',
      tagName: 'span',
      classList: ['accent'],
      attributes: { 'data-id-character-style': 'term-accent' },
    },
  ]);
  assert.equal(label.sourceAncestorNodes[0].classList[0], 'legend-item');
});

test('snapshotToSemanticModel omits whole-item source runs and keeps source inner html', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'title.html' },
    pages: [{
      id: 'cover-page',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'cover' },
      computedStyle: {},
      items: [
        {
          id: 'title',
          role: 'text',
          tagName: 'h1',
          classList: ['cover-title'],
          attributes: { 'data-id-paragraph-style': 'cover-title' },
          sourceNode: {
            tagName: 'h1',
            id: null,
            classList: ['cover-title'],
            attributes: { 'data-id-paragraph-style': 'cover-title' },
            sourceHtml: '冰球场首层平面<br><span class="accent" data-id-character-style="cover-accent">排布汇报</span>',
          },
          documentOrder: 1,
          text: '冰球场首层平面排布汇报',
          rectPx: { x: 10, y: 10, width: 400, height: 80 },
          runs: [
            { text: '冰球场首层平面排布汇报', tagName: 'h1', classList: ['cover-title'], attributes: { 'data-id-paragraph-style': 'cover-title' } },
          ],
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  const label = model.pages[0].items[0].labels[0];

  assert.equal(label.sourceHtml, '冰球场首层平面<br><span class="accent" data-id-character-style="cover-accent">排布汇报</span>');
  assert.deepEqual(label.sourceRuns, []);
});

test('snapshotToSemanticModel uses nearest candidate ancestor as structure parent', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      widthMm: 264,
      heightMm: 158,
      attributes: { 'data-page': 'page-1', 'data-id-grid': '12x6' },
      computedStyle: {},
      items: [
        {
          id: 'card-1',
          role: 'shape',
          tagName: 'div',
          classList: ['metric-card'],
          attributes: { 'data-id-object': '' },
          sourceNode: { tagName: 'div', id: 'card-1', classList: ['metric-card'], attributes: { 'data-id-object': '' } },
          documentOrder: 1,
          rectPx: { x: 10, y: 10, width: 300, height: 120 },
        },
        {
          id: 'card-1-value',
          role: 'text',
          tagName: 'p',
          classList: ['metric-value'],
          attributes: { 'data-id-paragraph-style': 'metric-value' },
          sourceNode: { tagName: 'p', id: 'card-1-value', classList: ['metric-value'], attributes: { 'data-id-paragraph-style': 'metric-value' } },
          ancestorCandidateIds: ['card-1'],
          documentOrder: 2,
          text: '243.75m',
          rectPx: { x: 20, y: 20, width: 200, height: 40 },
        },
      ],
    }],
    assets: [],
  }, { unitMode: 'presentation' });

  assert.equal(model.pages[0].items[1].structure.parentId, 'card-1');
});
