const test = require('node:test');
const assert = require('node:assert/strict');

const { placementFromAttributes } = require('../../src/adapters/html/reader/asset-detector');
const { fieldRegistry } = require('../../src/protocol');

test('current HTML asset placement reads data-id-pdf-page and not data-id-page', () => {
  const placement = placementFromAttributes({
    src: 'drawings/site.pdf',
    'data-id-pdf-page': '3',
    'data-id-page': '9',
    'data-id-crop': 'trim',
    'data-id-visible-layers': 'base|annotations',
    'data-id-hidden-layers': 'old',
  }, { objectFit: 'contain', objectPosition: '50% 50%' });

  assert.equal(placement.pageNumber, 3);
  assert.equal(placement.crop, 'trim');
  assert.deepEqual(placement.visibleLayers, ['base', 'annotations']);
  assert.deepEqual(placement.hiddenLayers, ['old']);
});

test('registry contains current PDF page number facts separate from retired data-id-page facts', () => {
  const field = fieldRegistry.getByPath('items[].asset.placement.pageNumber');

  assert.equal(field.fieldClass, 'canonical');
  assert.equal(field.lifecycle, 'active');
  assert.deepEqual(field.html.readAttrs, ['data-id-pdf-page']);
  assert.equal(field.html.retiredAttrs, undefined);
  assert.equal(fieldRegistry.getByHtmlAttr('data-id-page'), null);

  const retiredLookup = fieldRegistry.getRetiredHtmlAttr('data-id-page');
  assert.equal(retiredLookup.canonicalPath, 'retired.htmlAttrs.dataIdPage');
  assert.equal(retiredLookup.fieldClass, 'observation');
  assert.equal(retiredLookup.lifecycle, 'retired');
  assert.equal(retiredLookup.name, 'data-id-page');
  assert.equal(retiredLookup.readPolicy, 'observe-only');
  assert.equal(retiredLookup.writePolicy, 'forbidden');
  assert.equal(retiredLookup.replacedBy, 'data-id-pdf-page');
  assert.equal(retiredLookup.entry, fieldRegistry.getByPath('retired.htmlAttrs.dataIdPage'));
});

test('registry contains sourceNode as sourceMetadata not canonical', () => {
  const field = fieldRegistry.getByPath('items[].sourceNode');

  assert.equal(field.fieldClass, 'sourceMetadata');
  assert.equal(field.lifecycle, 'active');
  assert.equal(field.capabilities.indesign.write, 'observe-only');
});

test('registry marks HTML top-level asset snapshot metadata as source metadata', () => {
  for (const path of [
    'assets[].fileName',
    'assets[].linked',
    'assets[].placement',
    'assets[].sourceSelector',
  ]) {
    const field = fieldRegistry.getByPath(path);

    assert.ok(field, `${path} should be registered`);
    assert.equal(field.fieldClass, 'sourceMetadata');
    assert.equal(field.capabilities.html.read, 'native');
    assert.equal(field.capabilities.indesign.read, 'unsupported');
  }
});

test('registry marks HTML snapshot-only source metadata as unsupported for InDesign reads', () => {
  for (const path of [
    'document.styleLayout',
    'pages[].attributes',
    'pages[].classList',
    'pages[].computedStyle',
    'items[].attributes',
    'items[].classList',
    'items[].computedStyle',
    'items[].authoredStyle',
    'items[].sourceSelector',
    'items[].boundsMm',
    'items[].box',
    'items[].table.sourceRows',
  ]) {
    const field = fieldRegistry.getByPath(path);

    assert.ok(field, `${path} should be registered`);
    assert.equal(field.fieldClass, 'sourceMetadata');
    assert.equal(field.capabilities.html.read, 'native');
    assert.equal(field.capabilities.indesign.read, 'unsupported');
  }
});

test('registry keeps retained raw label payload fields as source metadata', () => {
  for (const path of [
    'labels[].name',
    'labels[].token',
    'labels[].displayName',
    'labels[].styleKind',
    'labels[].htmlClass',
  ]) {
    const field = fieldRegistry.getByPath(path);

    assert.ok(field, `${path} should be registered`);
    assert.equal(field.fieldClass, 'sourceMetadata', `${path} should not be canonical`);
    assert.notEqual(field.fieldClass, 'canonical', `${path} should not be canonical`);
  }
});

test('registry contains effectiveLabel and observedLabel observation boundaries', () => {
  assert.equal(fieldRegistry.getByPath('items[].effectiveLabel').fieldClass, 'sourceMetadata');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel').fieldClass, 'observation');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel.styleRefs').fieldClass, 'observation');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel').capabilities.html.read, 'unsupported');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel.styleRefs').capabilities.html.read, 'unsupported');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel.styleRefs').validation.mayDriveStructuredCompilation, false);
});

test('registry adjudicates role plus sourceType and retires the old item type dialect', () => {
  const role = fieldRegistry.getByPath('items[].role');
  const sourceType = fieldRegistry.getByPath('items[].sourceType');
  const retiredType = fieldRegistry.getByPath('items[].type');

  assert.equal(role.fieldClass, 'canonical');
  assert.equal(role.lifecycle, 'active');
  assert.equal(role.description, 'Canonical semantic role for an item.');

  assert.equal(sourceType.fieldClass, 'sourceMetadata');
  assert.equal(sourceType.lifecycle, 'active');
  assert.equal(sourceType.description, 'Observed source-format object type, not a semantic role.');

  assert.equal(retiredType.lifecycle, 'retired');
  assert.equal(retiredType.fieldClass, 'observation');
  assert.equal(retiredType.retired.modelPaths[0].path, 'items[].type');
  assert.equal(retiredType.retired.modelPaths[0].replacedBy, 'items[].sourceType');
  assert.notEqual(retiredType.lifecycle, 'active');
});

test('registry records item semantic default as null', () => {
  const semantic = fieldRegistry.getByPath('items[].semantic');

  assert.equal(semantic.defaultValue, null);
  assert.match(semantic.description, /Defaults to null/);
});

test('registry records the styleRefs allowed key adjudication', () => {
  const styleRefs = fieldRegistry.getByPath('items[].styleRefs');

  assert.deepEqual(styleRefs.allowedKeys, [
    'paragraphStyle',
    'characterStyle',
    'objectStyle',
    'frameStyle',
    'tableStyle',
    'cellStyle',
    'paragraphStyleDisplayName',
    'characterStyleDisplayName',
    'objectStyleDisplayName',
    'frameStyleDisplayName',
    'tableStyleDisplayName',
    'displayName',
    'genericStyle',
    'synthesizedToken',
    'synthesizedName',
    'layer',
  ]);
});

test('registry records item bounds as absolute page coordinates in pt', () => {
  const bounds = fieldRegistry.getByPath('items[].bounds');

  assert.equal(bounds.contract.coordinateSystem, 'absolute-page');
  assert.equal(bounds.contract.unit, 'pt');
  assert.match(bounds.description, /Absolute page coordinates/);
});

test('registry keeps reverse diagnostics out of canonical model facts', () => {
  assert.equal(fieldRegistry.getByPath('pages[].observedLabel').fieldClass, 'observation');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel').fieldClass, 'observation');

  for (const path of [
    'warnings',
    'errors',
    'fieldValidation',
    'report',
    'valid',
    'pages[].labelStatus',
    'pages[].rejectedFields',
    'pages[].rejectionReasons',
    'pages[].items[].labelStatus',
    'pages[].items[].rejectedFields',
    'pages[].items[].rejectionReasons',
  ]) {
    assert.notEqual(fieldRegistry.getByPath(path).fieldClass, 'canonical', path);
  }
});

test('registry keeps sourceRuns metadata separate from canonical text runs', () => {
  const sourceRuns = fieldRegistry.getByPath('items[].sourceRuns');
  const textRuns = fieldRegistry.getByPath('items[].content.runs');

  assert.equal(sourceRuns.fieldClass, 'sourceMetadata');
  assert.equal(textRuns.fieldClass, 'canonical');
  assert.equal(textRuns.currentPaths.includes('sourceRuns'), false);
});

test('registry keeps reverse item effects as an InDesign format extension', () => {
  const canonicalVisualEffects = fieldRegistry.getByPath('items[].visualStyle.effects');
  const reverseEffects = fieldRegistry.getByPath('items[].extensions.indesign.effects');

  assert.equal(canonicalVisualEffects, null);
  assert.equal(reverseEffects.fieldClass, 'formatExtension');
  assert.equal(reverseEffects.owner, 'reverse-model');
  assert.deepEqual(reverseEffects.currentPaths, []);
  assert.equal(reverseEffects.migration.from, 'items[].effects');
  assert.equal(reverseEffects.migration.to, 'items[].extensions.indesign.effects');
});

test('registry records textFrameStyle as an InDesign extension migration target', () => {
  const textFrameStyle = fieldRegistry.getByPath('items[].extensions.indesign.textFrameStyle');

  assert.equal(textFrameStyle.fieldClass, 'formatExtension');
  assert.deepEqual(textFrameStyle.currentPaths, []);
  assert.equal(textFrameStyle.migration.from, 'items[].textFrameStyle');
  assert.equal(textFrameStyle.migration.to, 'items[].extensions.indesign.textFrameStyle');
});

test('registry does not declare reverse visualStyle fields as native InDesign write fields', () => {
  for (const path of [
    'items[].visualStyle.fillColor',
    'items[].visualStyle.strokeColor',
    'items[].visualStyle.strokeLineCap',
  ]) {
    const field = fieldRegistry.getByPath(path);

    assert.ok(field, `${path} should remain registered`);
    assert.equal(field.fieldClass, 'canonical');
    assert.equal(field.capabilities.indesign.read, 'native');
    assert.equal(field.capabilities.indesign.write, 'observe-only');
    assert.equal(field.indesign.instructionPaths, undefined);
  }
});

test('registry keeps line marker container paths canonical-only', () => {
  for (const path of [
    'items[].visualStyle.lineStartMarker',
    'items[].visualStyle.lineEndMarker',
  ]) {
    const field = fieldRegistry.getByPath(path);

    assert.ok(field, `${path} should remain registered`);
    assert.deepEqual(field.currentPaths, []);
    assert.deepEqual(field.indesign.snapshotPaths, [
      path.endsWith('lineStartMarker') ? 'visualStyle.lineStartMarker' : 'visualStyle.lineEndMarker',
    ]);
  }

  assert.deepEqual(
    fieldRegistry.getByPath('items[].visualStyle.lineStartMarker.rawName').currentPaths,
    [
      'reverseModel.pages[].items[].visualStyle.lineStartMarker.rawName',
      'sourceNode.attributes.data-id-line-start-marker-raw-name',
    ],
  );
  assert.deepEqual(
    fieldRegistry.getByPath('items[].visualStyle.lineEndMarker.rawName').currentPaths,
    [
      'reverseModel.pages[].items[].visualStyle.lineEndMarker.rawName',
      'sourceNode.attributes.data-id-line-end-marker-raw-name',
    ],
  );
});
