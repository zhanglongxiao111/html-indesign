const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, snapshotToSemanticModel } = require('../../src/adapters/html');
const { semanticModelToInstructions } = require('../../src/writers/indesign');

test('semanticModelToInstructions produces current executor schema', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instructions = semanticModelToInstructions(model, {});

  assert.equal(instructions.document.unitMode, 'presentation');
  assert.equal(instructions.document.coordinateUnit, 'pt');
  assert.equal(instructions.document.pages.length, model.pages.length);
  assert.equal(instructions.pages.length, model.pages.length);
  assert.equal(Array.isArray(instructions.layers), true);
  assert.equal(instructions.pages[0].items.every((item) => item.id && item.type && item.bounds), true);
});

test('semanticModelToInstructions carries labels for document pages guides layers and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/grid-guide-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instructions = semanticModelToInstructions(model, {});

  assert.equal(instructions.document.labels[0].kind, 'document');
  assert.equal(instructions.document.pages[0].labels[0].kind, 'page');
  assert.equal(instructions.document.pages[0].guides[0].labels[0].kind, 'guide');
  assert.equal(instructions.layers.every((layer) => Array.isArray(layer.labels) && layer.labels.length > 0), true);
  assert.equal(instructions.pages[0].items.every((item) => Array.isArray(item.labels) && item.labels.length > 0), true);
});

test('semanticModelToInstructions preserves semantic preset document label metadata', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{
      protocol: 'html-indesign',
      version: 1,
      kind: 'document',
      id: 'doc',
      source: 'html-to-indesign',
      semanticPreset: {
        source: 'project',
        id: 'architecture-report',
        relativePath: 'semantic-preset.json',
      },
    }],
    parentPages: [],
    pages: [],
    styles: {},
    assets: [],
  };

  const instructions = semanticModelToInstructions(model);

  assert.deepEqual(instructions.document.labels[0].semanticPreset, {
    source: 'project',
    id: 'architecture-report',
    relativePath: 'semantic-preset.json',
  });
});

test('semanticModelToInstructions emits parent pages and page parent references', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'document', id: 'doc', source: 'html-to-indesign' }],
    parentPages: [{
      id: 'report-parent',
      name: '汇报母版',
      semantic: 'report-parent',
      provides: ['guides'],
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'parentPage', id: 'report-parent', source: 'html-to-indesign' }],
      items: [],
    }],
    pages: [{
      id: 'p1',
      index: 0,
      width: 100,
      height: 80,
      parentPageId: 'report-parent',
      parentPageName: '汇报母版',
      layout: 'contents-grid',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      guides: [],
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'page', id: 'p1', source: 'html-to-indesign' }],
      items: [],
    }],
    styles: {},
    assets: [],
  };
  const instructions = semanticModelToInstructions(model);

  assert.equal(instructions.document.parentPages[0].id, 'report-parent');
  assert.equal(instructions.document.pages[0].parentPageId, 'report-parent');
  assert.equal(instructions.document.pages[0].parentPageName, '汇报母版');
  assert.equal(instructions.document.pages[0].layout, 'contents-grid');
  assert.equal(instructions.pages[0].parentPageId, 'report-parent');
  assert.equal(instructions.pages[0].layout, 'contents-grid');
});

test('semanticModelToInstructions carries placed PDF page crop and layer visibility options', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [
      {
        id: 'p1',
        index: 0,
        width: 800,
        height: 450,
        margins: null,
        guides: [],
        labels: [],
        items: [
          {
            id: 'layered-pdf',
            role: 'graphic',
            bounds: { x: 10, y: 20, width: 300, height: 200 },
            zIndex: 1,
            layer: 'drawing',
            sourceSelector: '#layered-pdf',
            styleRefs: {},
            attributes: {
              src: 'previews/layered-pdf.png',
              'data-id-asset-path': './assets/layered.pdf',
              'data-id-asset-kind': 'pdf',
              'data-id-pdf-page': '5',
              'data-id-crop': 'trim',
              'data-id-visible-layers': '结构|标注',
              'data-id-hidden-layers': '家具',
            },
            computedStyle: { objectFit: 'contain', objectPosition: '50% 50%' },
          },
        ],
      },
    ],
    styles: {},
    assets: [
      {
        id: 'asset-layered-pdf',
        src: './assets/layered.pdf',
        kind: 'pdf',
        sourceSelector: '#layered-pdf',
        placement: {
          pageNumber: 5,
          crop: 'trim',
          visibleLayers: ['结构', '标注'],
          hiddenLayers: ['家具'],
        },
      },
    ],
  };

  const instructions = semanticModelToInstructions(model);
  const placed = instructions.pages[0].items.find((item) => item.id === 'layered-pdf').placed;

  assert.equal(placed.assetId, 'asset-layered-pdf');
  assert.equal(placed.pageNumber, 5);
  assert.equal(placed.crop, 'trim');
  assert.deepEqual(placed.visibleLayers, ['结构', '标注']);
  assert.deepEqual(placed.hiddenLayers, ['家具']);
});

test('semanticModelToInstructions does not compile retired data-id-page as a PDF page number', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [
      {
        id: 'p1',
        index: 0,
        width: 800,
        height: 450,
        margins: null,
        guides: [],
        labels: [],
        items: [
          {
            id: 'retired-page-field-pdf',
            role: 'graphic',
            bounds: { x: 10, y: 20, width: 300, height: 200 },
            zIndex: 1,
            layer: 'drawing',
            sourceSelector: '#retired-page-field-pdf',
            styleRefs: {},
            attributes: {
              data: './assets/layered.pdf',
              type: 'application/pdf',
              'data-id-asset-kind': 'pdf',
              'data-id-page': '5',
            },
            computedStyle: { objectFit: 'contain', objectPosition: '50% 50%' },
          },
        ],
      },
    ],
    styles: {},
    assets: [
      {
        id: 'asset-layered-pdf',
        src: './assets/layered.pdf',
        kind: 'pdf',
        sourceSelector: '#retired-page-field-pdf',
        placement: {},
      },
    ],
  };

  const instructions = semanticModelToInstructions(model);
  const placed = instructions.pages[0].items.find((item) => item.id === 'retired-page-field-pdf').placed;

  assert.equal(placed.pageNumber, undefined);
});

test('semanticModelToInstructions converts manual placed content geometry to absolute content bounds', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    parentPages: [],
    pages: [
      {
        id: 'p1',
        index: 0,
        width: 800,
        height: 450,
        margins: null,
        guides: [],
        labels: [],
        items: [
          {
            id: 'manual-crop',
            role: 'graphic',
            bounds: { x: 100, y: 80, width: 240, height: 160 },
            zIndex: 1,
            layer: 'image',
            sourceSelector: '#manual-crop',
            styleRefs: {},
            attributes: {
              'data-id-asset-path': './assets/render.jpg',
              'data-id-asset-kind': 'raster',
              'data-id-fit': 'manual',
              'data-id-content-x': '-30px',
              'data-id-content-y': '-20px',
              'data-id-content-width': '320px',
              'data-id-content-height': '210px',
              'data-id-content-scale-x': '1.3333',
              'data-id-content-scale-y': '1.3125',
            },
            computedStyle: { objectFit: 'fill', objectPosition: '50% 50%' },
          },
        ],
      },
    ],
    styles: {},
    assets: [
      {
        id: 'asset-render-jpg',
        src: './assets/render.jpg',
        kind: 'raster',
        sourceSelector: '#manual-crop',
        placement: {},
      },
    ],
  };

  const instructions = semanticModelToInstructions(model);
  const graphic = instructions.pages[0].items.find((item) => item.id === 'manual-crop');

  assert.equal(graphic.placed.fit, 'manual');
  assert.deepEqual(graphic.placed.contentBounds, { x: 70, y: 60, width: 320, height: 210 });
  assert.deepEqual(graphic.contentBounds, { x: 70, y: 60, width: 320, height: 210 });
});
