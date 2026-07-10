const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileInstructions } = require('../../src/indesign-pipeline');
const { semanticModelToInstructions, validateInstructions } = require('../../src/writers/indesign');

test('compileInstructions emits per-page parent-page furniture overrides with per-page text and labels', async () => {
  const htmlPath = path.resolve('test/fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: 'presentation',
    targetSize: 'same',
  });

  const overridesByPage = instructions.pages.map((page) => page.parentPageItemOverrides || []);
  assert.equal(overridesByPage.length, 7);
  for (const overrides of overridesByPage) {
    assert.equal(overrides.length, 1);
    const override = overrides[0];
    assert.equal(override.type, 'TEXT');
    assert.equal(override.parentPageSourceId, 'report-folio');
    assert.ok(override.bounds && Number.isFinite(override.bounds.x));
    const label = (override.labels || []).find((candidate) => candidate.kind === 'item');
    assert.ok(label, 'override must carry its per-page item protocol label');
    assert.equal(label.sourceNode.attributes['data-id-parent-page-source-id'], 'report-folio');
  }
  assert.deepEqual(
    overridesByPage.map((overrides) => overrides[0].text),
    ['00', '01', '02', '03', '04', '05', '06'],
  );
  assert.deepEqual(
    overridesByPage.map((overrides) => overrides[0].id).slice(0, 2),
    ['cover-folio', 'agenda-folio'],
  );

  const parentFolio = instructions.document.parentPages
    .flatMap((parentPage) => parentPage.items || [])
    .find((item) => item.id === 'report-folio');
  assert.ok(parentFolio, 'parent page keeps the canonical furniture item');
  assert.equal(parentFolio.text, '00');
});

test('semanticModelToInstructions warns instead of silently dropping non-text furniture instances', () => {
  const instructions = semanticModelToInstructions({
    kind: 'DocumentModel',
    id: 'furniture-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {},
    parentPages: [{
      id: 'report-parent',
      name: '汇报母版',
      items: [{
        id: 'corner-mark',
        role: 'shape',
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'corner-mark', source: 'html-to-indesign', role: 'shape' }],
      }],
    }],
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      parentPageId: 'report-parent',
      parentPageName: '汇报母版',
      items: [],
      parentPageItems: [{
        id: 'hero-corner-mark',
        role: 'shape',
        parentPageItem: 'report-parent',
        parentPageSourceId: 'corner-mark',
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        content: { text: '' },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'hero-corner-mark', source: 'html-to-indesign', role: 'shape' }],
      }],
    }],
  });

  assert.equal((instructions.pages[0].parentPageItemOverrides || []).length, 0);
  const warning = (instructions.report.messages || []).find((message) => message.code === 'PARENT_PAGE_ITEM_OVERRIDE_UNSUPPORTED');
  assert.ok(warning, 'non-text furniture instance must produce an explicit warning');
});

test('validateInstructions parentPageItemOverrides invalid-input 必须 fail', () => {
  const base = {
    document: {
      pages: [{ id: 'p1', width: 800, height: 450 }],
    },
    styles: { paragraphStyles: { folio: {} } },
    assets: [],
    pages: [{
      id: 'p1',
      items: [],
      parentPageItemOverrides: [{
        id: 'p1-folio',
        parentPageSourceId: null,
        type: 'TEXT',
        text: '01',
        bounds: { x: Number.NaN, y: 0, width: 10, height: 10 },
        labels: [],
      }],
    }],
  };

  const result = validateInstructions(base, {});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'PARENT_PAGE_ITEM_OVERRIDE_SOURCE_MISSING'));

  base.pages[0].parentPageItemOverrides = [{
    id: 'p1-folio',
    parentPageSourceId: 'report-folio',
    type: 'SHAPE',
    text: '01',
    bounds: { x: Number.NaN, y: 0, width: 10, height: 10 },
    labels: [],
  }];
  const result2 = validateInstructions(base, {});
  assert.equal(result2.valid, false);
  assert.ok(result2.errors.some((error) => error.code === 'PARENT_PAGE_ITEM_OVERRIDE_TYPE_UNSUPPORTED'));
  assert.ok(result2.errors.some((error) => error.code === 'INVALID_BOUNDS'));
  assert.ok(result2.errors.some((error) => error.code === 'PARENT_PAGE_ITEM_OVERRIDE_LABEL_MISSING'));
});

test('semanticModelToInstructions keeps pasteboard parent items on the parent page without emitting overrides', () => {
  const instructions = semanticModelToInstructions({
    kind: 'DocumentModel',
    id: 'pasteboard-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {},
    parentPages: [{
      id: 'report-parent',
      name: '汇报母版',
      items: [{
        id: 'section-stash',
        role: 'text',
        bounds: { x: 1032, y: -132, width: 430, height: 32 },
        content: { text: '项目现状 /Project status', runs: [] },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'section-stash', source: 'html-to-indesign', role: 'text' }],
      }],
    }],
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      parentPageId: 'report-parent',
      parentPageName: '汇报母版',
      items: [],
      parentPageItems: [{
        id: 'p1-section-stash',
        role: 'text',
        parentPageItem: 'report-parent',
        parentPageSourceId: 'section-stash',
        placement: 'parent-page-pasteboard',
        bounds: { x: 1032, y: -132, width: 430, height: 32 },
        content: { text: '项目现状 /Project status', runs: [] },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'p1-section-stash', source: 'html-to-indesign', role: 'text' }],
      }],
    }],
  });

  assert.equal((instructions.pages[0].parentPageItemOverrides || []).length, 0, 'pasteboard furniture must not be overridden onto pages');
  const stash = instructions.document.parentPages
    .flatMap((parentPage) => parentPage.items || [])
    .find((item) => item.id === 'section-stash');
  assert.ok(stash, 'parent page must keep the pasteboard item for master fidelity');
  const validation = validateInstructions(instructions, {});
  const offPageErrors = validation.errors.filter((error) => error.code === 'PARENT_PAGE_ITEM_OVERRIDE_OFF_PARENT_PAGE');
  assert.equal(offPageErrors.length, 0);
});

test('semanticModelToInstructions skips writeback-echo furniture instances and keeps authored ones', () => {
  const parentItem = {
    id: 'report-folio',
    role: 'text',
    bounds: { x: 1515, y: 843, width: 18, height: 13 },
    content: { text: '00', runs: [] },
    styleRefs: { paragraphStyle: 'folio' },
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'report-folio', source: 'html-to-indesign', role: 'text' }],
  };
  const instanceBase = {
    role: 'text',
    parentPageItem: 'report-parent',
    parentPageSourceId: 'report-folio',
    bounds: { x: 1515, y: 843, width: 18, height: 13 },
    styleRefs: { paragraphStyle: 'folio' },
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'x', source: 'html-to-indesign', role: 'text' }],
  };
  const instructions = semanticModelToInstructions({
    kind: 'DocumentModel',
    id: 'echo-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: { paragraphStyles: { folio: {} } },
    parentPages: [{ id: 'report-parent', name: '汇报母版', items: [parentItem] }],
    pages: [
      {
        id: '1',
        index: 0,
        width: 1600,
        height: 900,
        parentPageId: 'report-parent',
        items: [],
        parentPageItems: [{ ...instanceBase, id: '1-report-folio', content: { text: '00', runs: [] } }],
      },
      {
        id: '2',
        index: 1,
        width: 1600,
        height: 900,
        parentPageId: 'report-parent',
        items: [],
        parentPageItems: [{ ...instanceBase, id: '2-report-folio', content: { text: '02', runs: [] } }],
      },
      {
        id: '3',
        index: 2,
        width: 1600,
        height: 900,
        parentPageId: 'report-parent',
        items: [],
        parentPageItems: [{ ...instanceBase, id: 'closing-folio', content: { text: '00', runs: [] } }],
      },
    ],
  });

  const overridesByPage = instructions.pages.map((pageInstruction) => pageInstruction.parentPageItemOverrides || []);
  assert.equal(overridesByPage[0].length, 0, 'writeback echo identical to the parent item must not be overridden');
  assert.equal(overridesByPage[1].length, 1, 'writeback instance with changed text must stay an override');
  assert.equal(overridesByPage[1][0].text, '02');
  assert.equal(overridesByPage[2].length, 1, 'author-named instance keeps its override even with identical text');
  assert.equal(overridesByPage[2][0].id, 'closing-folio');
});

test('validateInstructions rejects overrides targeting pasteboard parent items', () => {
  const result = validateInstructions({
    document: {
      pages: [{ id: 'p1', width: 800, height: 450 }],
      parentPages: [{
        id: 'report-parent',
        name: '汇报母版',
        items: [{ id: 'section-stash', type: 'TEXT', bounds: { x: 1032, y: -132, width: 430, height: 32 } }],
      }],
    },
    styles: { paragraphStyles: {} },
    assets: [],
    pages: [{
      id: 'p1',
      items: [],
      parentPageItemOverrides: [{
        id: 'p1-section-stash',
        parentPageSourceId: 'section-stash',
        type: 'TEXT',
        text: '项目现状',
        bounds: { x: 100, y: 20, width: 200, height: 30 },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'p1-section-stash', source: 'html-to-indesign', role: 'text' }],
      }],
    }],
  }, {});

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'PARENT_PAGE_ITEM_OVERRIDE_OFF_PARENT_PAGE'));
});

test('semanticModelToInstructions orders observed document layers by their original stacking', () => {
  const instructions = semanticModelToInstructions({
    kind: 'DocumentModel',
    id: 'layer-order-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {},
    layers: [
      { name: 'text' },
      { name: '图片' },
      { name: '装饰线' },
    ],
    parentPages: [],
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      items: [
        { id: 'a', role: 'shape', layer: '装饰线', bounds: { x: 0, y: 0, width: 10, height: 10 }, labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'a', source: 'html-to-indesign', role: 'shape' }] },
        { id: 'b', role: 'shape', layer: '图片', bounds: { x: 0, y: 20, width: 10, height: 10 }, labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'b', source: 'html-to-indesign', role: 'shape' }] },
      ],
    }],
  });

  const names = instructions.layers.map((layer) => layer.name);
  assert.ok(names.indexOf('装饰线') < names.indexOf('图片'), '装饰线 must be created below 图片 to match the original stacking');
  assert.ok(names.indexOf('图片') < names.indexOf('text'), '图片 must be created below text to match the original stacking');
});
