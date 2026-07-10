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
        id: 'p1-corner-mark',
        role: 'shape',
        parentPageItem: 'report-parent',
        parentPageSourceId: 'corner-mark',
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        content: { text: '' },
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'item', id: 'p1-corner-mark', source: 'html-to-indesign', role: 'shape' }],
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
