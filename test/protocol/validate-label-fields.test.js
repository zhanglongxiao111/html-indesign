const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fieldRegistry,
  validateLabelFields,
} = require('../../src/protocol');

test('validateLabelFields accepts registered common label payload fields', () => {
  const result = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id: 'title',
    source: 'reverse-export',
    semantic: 'page-title',
    layout: 'cover-grid',
    role: 'text',
    styleRefs: {
      paragraphStyle: 'title-style',
      characterStyleToken: 'accent',
      objectStyle: 'title-frame',
      tableStyleToken: 'metrics-table',
      layer: 'Text',
    },
    sourceNode: { tagName: 'h1' },
    sourceFile: 'pages/cover.html',
    sourceText: 'Cover',
    sourceHtml: '<span>Cover</span>',
    sourceRuns: [{ text: 'Cover' }],
    structure: { parentId: 'cover-page' },
    generated: true,
  }, { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.errors.length, 0);
});

test('validateLabelFields accepts generated only on generated-capable structural labels', () => {
  for (const kind of ['page', 'item', 'parentPage']) {
    const result = validateLabelFields(fieldRegistry, {
      protocol: 'html-indesign',
      version: 1,
      kind,
      id: `${kind}-generated`,
      generated: false,
    }, { strict: true });

    assert.equal(result.valid, true, `${kind} generated flag should be valid`);
    assert.equal(result.accepted.includes('generated'), true);
  }

  const styleResult = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'style',
    id: 'style-generated',
    generated: true,
  }, { strict: true });

  assert.equal(styleResult.valid, false);
  assert.equal(
    styleResult.errors.some((error) => (
      error.code === 'LABEL_FIELD_KIND_NOT_ALLOWED'
      && error.path === 'generated'
      && error.labelKind === 'style'
    )),
    true,
  );
});

test('label identity payload fields remain source metadata fields', () => {
  for (const path of ['labels[].name', 'labels[].token', 'labels[].displayName', 'labels[].styleKind', 'labels[].htmlClass']) {
    const field = fieldRegistry.getByPath(path);
    assert.ok(field, `${path} should be registered`);
    assert.equal(field.fieldClass, 'sourceMetadata');
  }
});

test('validateLabelFields rejects page document style and layer fields on item labels in strict mode', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    id: 'title',
    semantic: 'page-title',
    role: 'text',
    parentPageId: 'report-parent',
    parentPageName: '汇报母版',
    grid: { columns: 12 },
    margins: { top: 32, right: 32, bottom: 32, left: 32 },
    title: 'Document Title',
    sourcePackage: { config: 'deck.config.json' },
    name: 'Title Frame',
    token: 'title-frame',
    displayName: 'Title Frame',
    styleKind: 'paragraph',
    htmlClass: 'page-title',
  }, { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, ['kind', 'id', 'semantic', 'role']);
  assert.deepEqual((result.disallowed || []).map((entry) => entry.path), [
    'parentPageId',
    'parentPageName',
    'grid',
    'margins',
    'title',
    'sourcePackage',
    'name',
    'token',
    'displayName',
    'styleKind',
    'htmlClass',
  ]);
  assert.deepEqual(result.observed, [
    'parentPageId',
    'parentPageName',
    'grid',
    'margins',
    'title',
    'sourcePackage',
    'name',
    'token',
    'displayName',
    'styleKind',
    'htmlClass',
  ]);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'LABEL_FIELD_KIND_NOT_ALLOWED'
      && error.path === 'parentPageId'
      && error.labelKind === 'item'
    )),
    true,
  );
});

test('validateLabelFields rejects unknown label payload fields in strict mode', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    id: 'title',
    madeUpField: true,
  }, { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, ['kind', 'id']);
  assert.deepEqual(result.unknown, ['madeUpField']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'LABEL_FIELD_NOT_REGISTERED'
      && error.path === 'madeUpField'
    )),
    true,
  );
});

test('validateLabelFields rejects registered allowedValues violations in strict mode', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    id: 'title',
    role: 'bogus',
  }, { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, ['kind', 'id']);
  assert.deepEqual(result.invalidValues.map((entry) => entry.path), ['role']);
  assert.equal(result.observed.includes('role'), true);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'LABEL_FIELD_VALUE_NOT_ALLOWED'
      && error.path === 'role'
    )),
    true,
  );
});

test('validateLabelFields reports unknown fields in observation mode without accepting them', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    id: 'title',
    foreignSlot: 'legacy',
  }, { mode: 'observation' });

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['kind', 'id']);
  assert.deepEqual(result.unknown, ['foreignSlot']);
  assert.deepEqual(result.observed, ['foreignSlot']);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'LABEL_FIELD_NOT_REGISTERED'
      && warning.path === 'foreignSlot'
    )),
    true,
  );
});

test('validateLabelFields accepts registered nested style refs and source metadata', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    styleRefs: {
      paragraphStyle: 'body',
      paragraphStyleToken: 'body-token',
      objectStyleToken: 'frame-token',
      layerToken: 'text-layer',
    },
    sourceNode: {
      tagName: 'p',
      attributes: { 'data-id-paragraph-style': 'body' },
    },
    sourceAncestorNodes: [{ tagName: 'section' }],
    sourceFile: 'pages/01.html',
  }, { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.unknown, []);
});

test('validateLabelFields accepts registered page label fields', () => {
  const result = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'page',
    id: 'page-1',
    parentPageId: 'report-parent',
    parentPageName: '汇报母版',
    grid: { columns: 12 },
    margins: { top: 32, right: 32, bottom: 32, left: 32 },
  }, { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.accepted.includes('parentPageId'), true);
  assert.equal(result.accepted.includes('parentPageName'), true);
  assert.equal(result.accepted.includes('grid'), true);
  assert.equal(result.accepted.includes('margins'), true);
});

test('validateLabelFields accepts legal document style layer and parent page payloads in strict mode', () => {
  const document = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'document',
    id: 'doc',
    title: 'Report',
    profile: 'architecture-report',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    sourcePackage: { config: 'deck.config.json' },
  }, { strict: true });
  assert.equal(document.valid, true);
  assert.deepEqual(document.unknown, []);

  const style = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'style',
    id: 'style-page-title',
    token: 'page-title',
    displayName: '页面标题',
    styleKind: 'paragraphStyles',
    htmlClass: 'page-title',
  }, { strict: true });
  assert.equal(style.valid, true);
  assert.deepEqual(style.unknown, []);

  const layer = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'layer',
    id: 'layer-text',
    token: 'text',
    displayName: '文字',
  }, { strict: true });
  assert.equal(layer.valid, true);
  assert.deepEqual(layer.unknown, []);

  const parentPage = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'parentPage',
    id: 'report-parent',
    name: '汇报母版',
    displayName: '汇报母版',
    semantic: 'report-parent',
    provides: ['header-guides'],
  }, { strict: true });
  assert.equal(parentPage.valid, true);
  assert.deepEqual(parentPage.unknown, []);
});
