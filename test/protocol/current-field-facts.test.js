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
  const reverseEffects = fieldRegistry.getByPath('items[].effects');

  assert.equal(canonicalVisualEffects, null);
  assert.equal(reverseEffects.fieldClass, 'formatExtension');
  assert.equal(reverseEffects.owner, 'reverse-model');
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
