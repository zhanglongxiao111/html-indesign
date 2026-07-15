const test = require('node:test');
const assert = require('node:assert/strict');

const { auditForwardFidelity } = require('../../src/semantic-model/audit/forward-fidelity');

test('forward fidelity audit invalid-input 必须 fail', () => {
  const report = auditForwardFidelity({});

  assert.equal(report.ok, false);
  assert.equal(report.errors.every((issue) => issue.code === 'FORWARD_FIDELITY_INPUT_INVALID'), true);
  assert.equal(report.errors.some((issue) => issue.field === 'instructions'), true);
  assert.equal(report.errors.some((issue) => issue.field === 'actualSnapshot'), true);
});

test('forward fidelity audit accepts matching supported facts within geometry tolerance', () => {
  const fixture = matchingFixture();
  fixture.actualSnapshot.pages[0].bounds.width += 0.2;
  fixture.actualSnapshot.pages[0].items[0].bounds.x += 0.2;

  const report = auditForwardFidelity(fixture);

  assert.equal(report.ok, true);
  assert.equal(report.summary.pages, 1);
  assert.equal(report.summary.items, 2);
  assert.equal(report.errors.length, 0);
  assert.equal(report.capabilitySource, 'src/protocol');
});

test('forward fidelity audit reports missing objects, changed text, asset paths, and trusted source facts', () => {
  const fixture = matchingFixture();
  const actualText = fixture.actualSnapshot.pages[0].items[0];
  actualText.text = 'Changed';
  fixture.actualModel.pages[0].items[0].content.text = 'Changed';
  actualText.labels = JSON.parse(JSON.stringify(actualText.labels));
  actualText.labels[0].structure.order = 9;
  fixture.actualSnapshot.pages[0].items = [actualText];
  fixture.actualSnapshot.assets[0].path = 'D:/assets/other.png';

  const report = auditForwardFidelity(fixture);

  assert.equal(report.ok, false);
  assert.equal(report.errors.some((issue) => issue.code === 'FORWARD_TEXT_CHANGED'
    && issue.pageId === 'page-1'
    && issue.itemId === 'title'), true);
  assert.equal(report.errors.some((issue) => issue.code === 'FORWARD_TRUSTED_FACT_CHANGED'
    && issue.field === 'structure'), true);
  assert.equal(report.errors.some((issue) => issue.code === 'FORWARD_ITEM_MISSING'
    && issue.itemId === 'hero'), true);
  assert.equal(report.errors.some((issue) => issue.code === 'FORWARD_ASSET_CHANGED'), true);
});

test('forward fidelity audit compares native table cells instead of InDesign table control text', () => {
  const fixture = matchingFixture();
  const expectedTable = {
    id: 'table-1',
    role: 'table',
    type: 'TABLE',
    bounds: { x: 10, y: 40, width: 80, height: 30 },
    layer: '表格',
    labels: [itemLabel('table-1', 'table', { order: 2 })],
    rows: [{
      index: 0,
      header: true,
      cells: [{ index: 0, text: 'Area', header: true, rowSpan: 1, colSpan: 1 }],
    }],
  };
  const actualTable = {
    id: '203',
    type: 'TextFrame',
    bounds: { x: 10, y: 40, width: 80, height: 30 },
    layerName: '表格',
    text: '\u0016',
    textRuns: [{ text: '\u0016', characterStyle: null }],
    table: {
      rows: [{
        index: 0,
        header: true,
        cells: [{ index: 0, text: 'Area', header: true, rowSpan: 1, colSpan: 1 }],
      }],
    },
    placedAsset: null,
    labels: [itemLabel('table-1', 'table', { order: 2 })],
  };
  fixture.instructions.pages[0].items = [expectedTable];
  fixture.actualSnapshot.pages[0].items = [actualTable];
  fixture.actualModel.pages[0].items = [{
    id: 'table-1',
    role: 'table',
    bounds: actualTable.bounds,
    content: { text: '', runs: [] },
    table: actualTable.table,
  }];

  const report = auditForwardFidelity(fixture);

  assert.equal(report.ok, true);
});

test('forward fidelity audit compares rotated lines by endpoints', () => {
  const fixture = matchingFixture();
  const expectedLine = {
    id: 'line-1',
    role: 'shape',
    type: 'LINE',
    bounds: { x: 10, y: 20, width: 100, height: 0 },
    rotationAngle: 30,
    layer: '标注',
    labels: [itemLabel('line-1', 'shape', { order: 3 })],
  };
  const actualLine = {
    id: '204',
    type: 'GraphicLine',
    bounds: { x: 10, y: 20, width: 86.6025, height: 50 },
    layerName: '标注',
    text: '',
    textRuns: [],
    table: null,
    placedAsset: null,
    vectorGeometry: {
      kind: 'line',
      paths: [{
        closed: false,
        points: [
          vectorPoint(10, 20),
          vectorPoint(96.6025, 70),
        ],
      }],
    },
    labels: [itemLabel('line-1', 'shape', { order: 3 })],
  };
  fixture.instructions.pages[0].items = [expectedLine];
  fixture.actualSnapshot.pages[0].items = [actualLine];
  fixture.actualModel.pages[0].items = [{
    id: 'line-1',
    role: 'shape',
    bounds: actualLine.bounds,
    content: { text: '', runs: [] },
  }];

  const report = auditForwardFidelity(fixture);

  assert.equal(report.ok, true);
});

test('forward fidelity audit treats page-specific parent furniture overrides as expected page objects', () => {
  const fixture = matchingFixture();
  const label = itemLabel('page-folio', 'text', { order: 9 });
  const expected = {
    id: 'page-folio',
    role: 'text',
    type: 'TEXT',
    bounds: { x: 85, y: 72, width: 10, height: 5 },
    layer: '文字',
    text: '01',
    runs: [{ text: '01', characterStyle: null }],
    labels: [label],
  };
  const actual = {
    id: '205',
    type: 'TextFrame',
    bounds: expected.bounds,
    layerName: '文字',
    text: '01',
    textRuns: [{ text: '01', characterStyle: null }],
    table: null,
    placedAsset: null,
    labels: [label],
  };
  fixture.instructions.pages[0].parentPageItemOverrides = [expected];
  fixture.actualSnapshot.pages[0].items.push(actual);
  fixture.actualModel.pages[0].items.push({
    id: 'page-folio',
    role: 'text',
    bounds: expected.bounds,
    content: { text: '01', runs: [{ text: '01', characterStyle: null }] },
  });

  const report = auditForwardFidelity(fixture);

  assert.equal(report.ok, true);
  assert.equal(report.summary.items, 3);
});

function matchingFixture() {
  const pageLabel = {
    protocol: 'html-indesign',
    version: 1,
    kind: 'page',
    id: 'page-1',
    source: 'html-to-indesign',
    semantic: 'cover',
    layout: 'cover-grid',
  };
  const textLabel = itemLabel('title', 'text', { order: 0 });
  const graphicLabel = itemLabel('hero', 'graphic', { order: 1 });
  const expectedModel = {
    kind: 'DocumentModel',
    id: 'deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{
      id: 'page-1',
      index: 0,
      semantic: 'cover',
      layout: 'cover-grid',
      width: 100,
      height: 80,
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      guides: [{ orientation: 'vertical', position: 50 }],
      items: [],
    }],
  };
  const instructions = {
    document: { id: 'deck', parentPages: [] },
    assets: [{
      id: 'asset-hero',
      resolvedPath: 'D:/assets/hero.png',
      kind: 'raster',
    }],
    pages: [{
      id: 'page-1',
      width: 100,
      height: 80,
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      guides: [{ orientation: 'vertical', position: 50 }],
      labels: [pageLabel],
      items: [{
        id: 'title',
        role: 'text',
        type: 'TEXT',
        bounds: { x: 10, y: 10, width: 80, height: 20 },
        layer: '文字',
        text: 'Hello',
        runs: [{ text: 'Hello', characterStyle: null }],
        labels: [textLabel],
      }, {
        id: 'hero',
        role: 'graphic',
        type: 'GRAPHIC',
        bounds: { x: 10, y: 35, width: 80, height: 35 },
        layer: '图片',
        placed: { assetId: 'asset-hero', fit: 'cover' },
        labels: [graphicLabel],
      }],
    }],
  };
  const actualSnapshot = {
    document: { labels: [] },
    report: { ok: true, errors: [], oversetTextFrames: [] },
    parentPages: [],
    assets: [{ name: 'hero.png', path: 'D:/assets/hero.png', status: 'NORMAL' }],
    pages: [{
      id: '1',
      index: 0,
      bounds: { x: 0, y: 0, width: 100, height: 80 },
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      guides: [{ orientation: 'vertical', position: 50 }],
      labels: [pageLabel],
      items: [{
        id: '201',
        type: 'TextFrame',
        bounds: { x: 10, y: 10, width: 80, height: 20 },
        layerName: '文字',
        paragraphStyleName: '',
        objectStyleName: '',
        text: 'Hello',
        textRuns: [{ text: 'Hello', characterStyle: null }],
        table: null,
        placedAsset: null,
        labels: [textLabel],
      }, {
        id: '202',
        type: 'Rectangle',
        bounds: { x: 10, y: 35, width: 80, height: 35 },
        layerName: '图片',
        paragraphStyleName: '',
        objectStyleName: '',
        text: '',
        textRuns: [],
        table: null,
        placedAsset: {
          name: 'hero.png',
          path: 'D:/assets/hero.png',
          status: 'NORMAL',
          placement: { frameBounds: { x: 10, y: 35, width: 80, height: 35 } },
        },
        labels: [graphicLabel],
      }],
    }],
  };
  const actualModel = {
    kind: 'DocumentModel',
    id: 'deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{
      id: 'page-1',
      index: 0,
      semantic: 'cover',
      layout: 'cover-grid',
      width: 100,
      height: 80,
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      guides: [{ orientation: 'vertical', position: 50 }],
      items: [{
        id: 'title',
        role: 'text',
        bounds: { x: 10, y: 10, width: 80, height: 20 },
        content: { text: 'Hello', runs: [{ text: 'Hello', characterStyle: null }] },
      }, {
        id: 'hero',
        role: 'graphic',
        bounds: { x: 10, y: 35, width: 80, height: 35 },
        content: { text: '', runs: [] },
        asset: { path: 'D:/assets/hero.png' },
      }],
    }],
  };
  return { expectedModel, instructions, actualSnapshot, actualModel };
}

function itemLabel(id, role, structure) {
  return {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id,
    source: 'html-to-indesign',
    role,
    semantic: null,
    htmlTag: role === 'text' ? 'p' : 'div',
    className: role,
    sourceFile: 'pages/01.html',
    sourceNode: {
      tagName: role === 'text' ? 'p' : 'div',
      id,
      classList: [role],
      attributes: { id },
    },
    sourceText: role === 'text' ? 'Hello' : '',
    sourceHtml: null,
    sourceRuns: [],
    sourceAncestorNodes: [],
    structure: { parentId: 'page-1', order: structure.order, containerPolicy: 'group' },
    layout: null,
  };
}

function vectorPoint(x, y) {
  return {
    anchor: { x, y },
    leftDirection: { x, y },
    rightDirection: { x, y },
    pointType: 'PLAIN',
  };
}
