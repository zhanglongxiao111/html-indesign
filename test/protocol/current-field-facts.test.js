const test = require('node:test');
const assert = require('node:assert/strict');

const { placementFromAttributes } = require('../../src/paged-html/asset-detector');
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

test('registry contains current PDF page number facts and retired data-id-page alias', () => {
  const field = fieldRegistry.getByPath('items[].asset.placement.pageNumber');

  assert.equal(field.fieldClass, 'canonical');
  assert.equal(field.lifecycle, 'active');
  assert.deepEqual(field.html.readAttrs, ['data-id-pdf-page']);
  assert.equal(fieldRegistry.getByHtmlAttr('data-id-page'), null);

  const retired = field.html.retiredAttrs.find((item) => item.name === 'data-id-page');
  assert.equal(retired.readPolicy, 'observe-only');
  assert.equal(retired.writePolicy, 'forbidden');

  const retiredLookup = fieldRegistry.getRetiredHtmlAttr('data-id-page');
  assert.equal(retiredLookup.canonicalPath, 'items[].asset.placement.pageNumber');
  assert.equal(retiredLookup.readPolicy, 'observe-only');
  assert.equal(retiredLookup.writePolicy, 'forbidden');
});

test('registry contains sourceNode as sourceMetadata not canonical', () => {
  const field = fieldRegistry.getByPath('items[].sourceNode');

  assert.equal(field.fieldClass, 'sourceMetadata');
  assert.equal(field.lifecycle, 'active');
  assert.equal(field.capabilities.indesign.write, 'observe-only');
});

test('registry contains effectiveLabel and observedLabel observation boundaries', () => {
  assert.equal(fieldRegistry.getByPath('items[].effectiveLabel').fieldClass, 'sourceMetadata');
  assert.equal(fieldRegistry.getByPath('items[].observedLabel').fieldClass, 'observation');
});

test('registry keeps sourceRuns metadata separate from canonical text runs', () => {
  const sourceRuns = fieldRegistry.getByPath('items[].sourceRuns');
  const textRuns = fieldRegistry.getByPath('items[].content.runs');

  assert.equal(sourceRuns.fieldClass, 'sourceMetadata');
  assert.equal(textRuns.fieldClass, 'canonical');
  assert.equal(textRuns.currentPaths.includes('sourceRuns'), false);
});
