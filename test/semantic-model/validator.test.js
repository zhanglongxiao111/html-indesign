const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSemanticModel } = require('../../src/semantic-model');

test('validateSemanticModel requires pages and page labels', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    pages: [{ id: 'p1', items: [], labels: [] }],
    styles: {},
    assets: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'DOCUMENT_LABEL_MISSING'), true);
  assert.equal(result.errors.some((error) => error.code === 'PAGE_LABEL_MISSING'), true);
});

test('validateSemanticModel rejects duplicate item ids on a page', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [
        { id: 'item-1', labels: [{ kind: 'item', id: 'item-1' }] },
        { id: 'item-1', labels: [{ kind: 'item', id: 'item-1' }] },
      ],
    }],
    styles: {},
    assets: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'ITEM_ID_DUPLICATED');
});

test('validateSemanticModel rejects unknown model fields in strict field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{
        id: 'item-1',
        labels: [{ kind: 'item', id: 'item-1' }],
        madeUpField: 'not registered',
      }],
    }],
  }, { strictFields: true });

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'pages[].items[].madeUpField'
    )),
    true,
  );
});

test('validateSemanticModel passes strict field domains to model field validation', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{
        id: 'item-1',
        labels: [{ kind: 'item', id: 'item-1' }],
        madeUpField: 'warn only outside requested domain',
        asset: { placement: { fakePlacement: true } },
      }],
    }],
  }, { strictFields: true, fieldDomains: ['asset.placement'] });

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].asset.placement.fakePlacement'
    )),
    true,
  );
  assert.equal(
    result.errors.some((error) => error.path === 'pages[].items[].madeUpField'),
    false,
  );
  assert.equal(
    result.warnings.some((warning) => warning.path === 'pages[].items[].madeUpField'),
    true,
  );
});

test('validateSemanticModel rejects unknown raw label fields only when label domain is strict', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{
        id: 'item-1',
        labels: [{
          kind: 'item',
          id: 'item-1',
          foreignSlot: 'observe only unless labels are strict',
        }],
      }],
    }],
  };

  const strict = validateSemanticModel(model, {
    strictFields: true,
    fieldDomains: ['labels'],
  });
  assert.equal(strict.valid, false);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'LABEL_FIELD_NOT_REGISTERED'
      && error.path === 'foreignSlot'
      && error.labelPath === 'pages[0].items[0].labels[0]'
    )),
    true,
  );

  const warned = validateSemanticModel(model, { warnFields: true });
  assert.equal(warned.valid, true);
  assert.equal(warned.errors.length, 0);
  assert.equal(
    warned.warnings.some((warning) => (
      warning.code === 'LABEL_FIELD_NOT_REGISTERED'
      && warning.path === 'foreignSlot'
      && warning.labelPath === 'pages[0].items[0].labels[0]'
    )),
    true,
  );
});

test('validateSemanticModel rejects raw item label fields that are not allowed for item labels in strict field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{
        id: 'item-1',
        labels: [{
          kind: 'item',
          id: 'item-1',
          title: 'Document Title',
          sourcePackage: { config: 'deck.config.json' },
          parentPageId: 'report-parent',
          grid: { columns: 12 },
          margins: { top: 32, right: 32, bottom: 32, left: 32 },
        }],
      }],
    }],
  }, { strictFields: true });

  assert.equal(result.valid, false);
  const labelErrors = result.errors
    .filter((error) => error.code === 'LABEL_FIELD_KIND_NOT_ALLOWED');
  assert.deepEqual(
    labelErrors.map((error) => error.path),
    ['title', 'sourcePackage', 'parentPageId', 'grid', 'margins'],
  );
  assert.deepEqual(
    labelErrors.map((error) => error.labelPath),
    [
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
    ],
  );
  assert.equal(labelErrors.every((error) => error.surfacePath === 'pages[].items[].labels[]'), true);
});

test('validateSemanticModel reports raw item label fields that are not allowed for item labels in warning field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{
        id: 'item-1',
        labels: [{
          kind: 'item',
          id: 'item-1',
          title: 'Document Title',
          sourcePackage: { config: 'deck.config.json' },
          parentPageId: 'report-parent',
          grid: { columns: 12 },
          margins: { top: 32, right: 32, bottom: 32, left: 32 },
        }],
      }],
    }],
  }, { warnFields: true });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  const labelWarnings = result.warnings
    .filter((warning) => warning.code === 'LABEL_FIELD_KIND_NOT_ALLOWED');
  assert.deepEqual(
    labelWarnings.map((warning) => warning.path),
    ['title', 'sourcePackage', 'parentPageId', 'grid', 'margins'],
  );
  assert.deepEqual(
    labelWarnings.map((warning) => warning.labelPath),
    [
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
      'pages[0].items[0].labels[0]',
    ],
  );
  assert.equal(labelWarnings.every((warning) => warning.surfacePath === 'pages[].items[].labels[]'), true);
});

test('validateSemanticModel rejects nested root-surface ghosts in strict field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    parentPages: [{
      id: 'parent-a',
      ghost: true,
      items: [{ id: 'parent-rule', role: 'line', ghost: true }],
    }],
    layers: [{ token: 'text', ghost: true }],
    styles: {
      paragraphStyles: {
        title: { name: 'Title', css: 'font-size:32pt', ghost: true },
      },
    },
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      effectiveLabel: { semantic: 'agenda-page', ghost: true },
      observedLabel: { rejectionReasons: ['unknown-layout'], ghost: true },
      items: [],
    }],
  }, { strictFields: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.fieldValidation.unknown, [
    'parentPages[].ghost',
    'parentPages[].items[].ghost',
    'layers[].ghost',
    'styles.paragraphStyles[].ghost',
    'pages[].effectiveLabel.ghost',
    'pages[].observedLabel.ghost',
  ]);
});

test('validateSemanticModel accepts current DocumentModel fields in strict field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    title: 'Current document',
    profile: 'architecture-report',
    source: 'deck.html',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    sourcePackage: { config: 'deck.config.json', profile: 'architecture-report' },
    labels: [{ kind: 'document', id: 'doc' }],
    parentPages: [{ id: 'parent-a', name: 'A-Parent' }],
    pages: [{
      id: 'p1',
      index: 0,
      semantic: 'agenda-page',
      labels: [{ kind: 'page', id: 'p1' }],
      effectiveLabel: {
        semantic: 'agenda-page',
        sourceNode: { tagName: 'section' },
        grid: { columns: 12 },
      },
      observedLabel: { rejectionReasons: ['unknown-layout'] },
      guides: [{ axis: 'x', position: 40 }],
      items: [{
        id: 'item-1',
        labels: [{ kind: 'item', id: 'item-1' }],
      }],
    }],
    layers: [{ token: 'text', displayName: 'Text' }],
    styles: { paragraphStyles: {} },
    assets: [],
  }, { strictFields: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.fieldValidation.unknown, []);
});

test('validateSemanticModel accepts legal raw document and page label fields in strict field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{
      kind: 'document',
      id: 'doc',
      title: 'Current document',
      sourcePackage: { config: 'deck.config.json' },
      profile: 'architecture-report',
    }],
    pages: [{
      id: 'p1',
      labels: [{
        kind: 'page',
        id: 'p1',
        parentPageId: 'report-parent',
        grid: { columns: 12 },
        margins: { top: 32, right: 32, bottom: 32, left: 32 },
      }],
      items: [{
        id: 'item-1',
        labels: [{ kind: 'item', id: 'item-1' }],
      }],
    }],
  }, { strictFields: true });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateSemanticModel reports unknown model fields as warnings in warning field mode', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [{
        id: 'item-1',
        labels: [{ kind: 'item', id: 'item-1' }],
        madeUpField: 'not registered',
      }],
    }],
  }, { warnFields: true });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_NOT_REGISTERED'
      && warning.path === 'pages[].items[].madeUpField'
    )),
    true,
  );
});
