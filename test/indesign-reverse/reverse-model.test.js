const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel } = require('../../src/indesign-reverse');

test('reverseSnapshotToSemanticModel restores tagged InDesign as DocumentModel', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.id, 'architecture-report');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.parentPages[0].id, 'report-parent');
  assert.equal(model.layers[0].token, 'text');
  assert.equal(model.pages[0].id, 'agenda-page');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.equal(model.pages[0].items[0].semantic, 'page-title');
});

test('reverseSnapshotToSemanticModel preserves observed visual style and placed asset per item', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'visual.indd', mode: 'structured' },
    document: { name: 'visual.indd', labels: [] },
    pages: [
      {
        id: '1',
        index: 0,
        labels: [],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        items: [
          {
            id: 'card-frame',
            type: 'Rectangle',
            bounds: { x: 40, y: 50, width: 240, height: 120 },
            objectStyleName: '指标卡片',
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: '#c8102e',
              strokeWeight: 3,
              opacity: 72,
              cornerRadius: 8,
            },
            labels: [],
          },
          {
            id: 'hero-image',
            type: 'Rectangle',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            placedAsset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              status: 'NORMAL',
              cropped: true,
            },
            labels: [
              {
                protocol: 'html-indesign',
                version: 1,
                kind: 'item',
                id: 'hero-image',
                role: 'graphic',
                semantic: 'hero-image',
              },
            ],
          },
        ],
      },
    ],
  }, { mode: 'structured' });

  const card = model.pages[0].items.find((item) => item.id === 'card-frame');
  assert.equal(card.role, 'shape');
  assert.equal(card.visualStyle.fillColor, '#fbfaf7');
  assert.equal(card.visualStyle.strokeColor, '#c8102e');
  assert.equal(card.visualStyle.strokeWeight, 3);
  assert.equal(card.visualStyle.opacity, 72);
  assert.equal(card.visualStyle.cornerRadius, 8);

  const hero = model.pages[0].items.find((item) => item.id === 'hero-image');
  assert.equal(hero.role, 'graphic');
  assert.equal(hero.asset.path, 'D:\\assets\\hero.png');
  assert.equal(hero.asset.cropped, true);
});
