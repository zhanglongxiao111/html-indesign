const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');
const { snapshotToSemanticModel, semanticModelToInstructions } = require('../../src/semantic-model');

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
