const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateDataIdFields,
  scanDataIdFields,
  fieldRegistry,
} = require('../../src/protocol');

const ROOT_DIR = path.join(__dirname, '../..');

test('scanDataIdFields returns unique data-id attributes in first-seen order', () => {
  assert.deepEqual(
    scanDataIdFields('<div data-id-pdf-page="2" data-id-page="9" data-id-made-up="x"></div><span data-id-page="8"></span>'),
    ['data-id-pdf-page', 'data-id-page', 'data-id-made-up'],
  );
});

test('scanDataIdFields only scans attribute names inside start tags', () => {
  assert.deepEqual(scanDataIdFields('<div>text data-id-page after</div>'), []);
  assert.deepEqual(scanDataIdFields('<div class="x data-id-page y"></div>'), []);
  assert.deepEqual(scanDataIdFields('<!-- data-id-page -->'), []);
  assert.deepEqual(scanDataIdFields('< data-id-page >'), []);
  assert.deepEqual(
    scanDataIdFields('<div data-id-pdf-page="2" data-id-page></div>'),
    ['data-id-pdf-page', 'data-id-page'],
  );
});

test('scanDataIdFields ignores pseudo tags inside raw text and RCDATA elements', () => {
  assert.deepEqual(scanDataIdFields('<script>const s = "<div data-id-page>";</script>'), []);
  assert.deepEqual(scanDataIdFields('<style>.x::before{content:"<div data-id-page>"}</style>'), []);
  assert.deepEqual(scanDataIdFields('<textarea><div data-id-page></textarea>'), []);
  assert.deepEqual(scanDataIdFields('<title><div data-id-page></title>'), []);
  assert.deepEqual(
    scanDataIdFields('<section data-id-pdf-page="2"><script>const s = "<div data-id-page>";</script><div data-id-asset-path="x"></div></section>'),
    ['data-id-pdf-page', 'data-id-asset-path'],
  );
});

test('scanDataIdFields requires raw text close tag name boundaries', () => {
  assert.deepEqual(
    scanDataIdFields('<script>const s = "</scripted><div data-id-page>";</script><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<style>.x{content:"</stylex><div data-id-page>"}</style><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<textarea></textareax><div data-id-page></textarea><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<title></titlex><div data-id-page></title><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<section data-id-asset-path="x"><script></scripted><div data-id-page></script><div data-id-pdf-page="2"></div></section>'),
    ['data-id-asset-path', 'data-id-pdf-page'],
  );
});

test('validateDataIdFields accepts active fields and reports unknown and retired fields as warnings by default', () => {
  const result = validateDataIdFields(fieldRegistry, [
    'data-id-pdf-page',
    'data-id-made-up',
    'data-id-page',
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['data-id-pdf-page']);
  assert.deepEqual(result.unknown, ['data-id-made-up']);
  assert.deepEqual(result.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_NOT_REGISTERED'
      && warning.name === 'data-id-made-up'
    )),
    true,
  );
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_RETIRED'
      && warning.name === 'data-id-page'
      && warning.policy.writePolicy === 'forbidden'
    )),
    true,
  );
});

test('validateDataIdFields rejects retired data-id fields only in strict mode', () => {
  const nonStrict = validateDataIdFields(fieldRegistry, ['data-id-page']);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, []);
  assert.deepEqual(nonStrict.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_RETIRED'
      && warning.name === 'data-id-page'
    )),
    true,
  );

  const strict = validateDataIdFields(fieldRegistry, ['data-id-page'], { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, []);
  assert.deepEqual(strict.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'DATA_ID_FIELD_RETIRED'
      && error.name === 'data-id-page'
      && error.policy.writePolicy === 'forbidden'
    )),
    true,
  );
});

test('validateDataIdFields rejects unknown data-id fields in strict mode while keeping retired fields out of accepted', () => {
  const result = validateDataIdFields(fieldRegistry, [
    'data-id-pdf-page',
    'data-id-made-up',
    'data-id-page',
  ], { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, ['data-id-pdf-page']);
  assert.deepEqual(result.unknown, ['data-id-made-up']);
  assert.deepEqual(result.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'DATA_ID_FIELD_NOT_REGISTERED'
      && error.name === 'data-id-made-up'
    )),
    true,
  );
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_RETIRED'
      && warning.name === 'data-id-page'
      && warning.policy.readPolicy === 'observe-only'
    )),
    true,
  );
});

test('validateDataIdFields accepts reverse-author active protocol data-id fields in strict mode', () => {
  const attrs = [
    'data-id-role',
    'data-id-vector',
    'data-id-point-types',
    'data-id-vector-points',
    'data-id-stroke-color',
    'data-id-stroke-weight',
    'data-id-stroke-style',
    'data-id-stroke-alignment',
    'data-id-line-start-marker-raw-name',
    'data-id-line-end-marker-raw-name',
    'data-id-object-style',
    'data-id-paragraph-style',
    'data-id-paragraph-composer',
    'data-id-table-style',
    'data-id-source-csv',
    'data-id-source-xml',
  ];

  const result = validateDataIdFields(fieldRegistry, attrs, { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, attrs);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.retired, []);
  assert.deepEqual(result.errors, []);

  const vectorField = fieldRegistry.getByHtmlAttr('data-id-vector');
  assert.equal(vectorField.canonicalPath, 'items[].vectorGeometry.kind');
  assert.equal(vectorField.fieldClass, 'canonical');

  const vectorPointsField = fieldRegistry.getByHtmlAttr('data-id-vector-points');
  assert.equal(vectorPointsField.canonicalPath, 'items[].vectorGeometry.paths');
  assert.equal(vectorPointsField.fieldClass, 'canonical');

  const pointTypesField = fieldRegistry.getByHtmlAttr('data-id-point-types');
  assert.equal(pointTypesField.canonicalPath, 'items[].vectorGeometry.paths[].points[].pointType');
  assert.equal(pointTypesField.fieldClass, 'canonical');

  const strokeStyleField = fieldRegistry.getByHtmlAttr('data-id-stroke-style');
  assert.equal(strokeStyleField.canonicalPath, 'items[].visualStyle.strokeStyle');
  assert.equal(strokeStyleField.fieldClass, 'canonical');

  const strokeColorField = fieldRegistry.getByHtmlAttr('data-id-stroke-color');
  assert.equal(strokeColorField.canonicalPath, 'items[].visualStyle.strokeColor');
  assert.equal(strokeColorField.fieldClass, 'canonical');

  const strokeWeightField = fieldRegistry.getByHtmlAttr('data-id-stroke-weight');
  assert.equal(strokeWeightField.canonicalPath, 'items[].visualStyle.strokeWeight');
  assert.equal(strokeWeightField.fieldClass, 'canonical');

  const strokeAlignmentField = fieldRegistry.getByHtmlAttr('data-id-stroke-alignment');
  assert.equal(strokeAlignmentField.canonicalPath, 'items[].visualStyle.strokeAlignment');
  assert.equal(strokeAlignmentField.fieldClass, 'canonical');

  const markerStartField = fieldRegistry.getByHtmlAttr('data-id-line-start-marker-raw-name');
  assert.equal(markerStartField.canonicalPath, 'items[].visualStyle.lineStartMarker.rawName');
  assert.equal(markerStartField.fieldClass, 'canonical');

  const markerEndField = fieldRegistry.getByHtmlAttr('data-id-line-end-marker-raw-name');
  assert.equal(markerEndField.canonicalPath, 'items[].visualStyle.lineEndMarker.rawName');
  assert.equal(markerEndField.fieldClass, 'canonical');

  for (const attr of ['data-id-source-csv', 'data-id-source-xml']) {
    const field = fieldRegistry.getByHtmlAttr(attr);
    assert.equal(field.fieldClass, 'sourceMetadata', `${attr} must be registered as source metadata`);
    assert.equal(field.capabilities.html.read, 'native');
    assert.equal(field.capabilities.html.write, 'native');
    assert.equal(field.capabilities.html.persist, 'native');
    assert.equal(field.capabilities.indesign.write, 'observe-only');
    assert.equal(field.capabilities.indesign.persist, 'lossless');
    assert.equal(field.capabilities.pptx.read, 'unsupported');
    assert.equal(field.capabilities.pptx.persist, 'lossless');
  }
});

test('validateDataIdFields accepts architecture report deck data-id carriers in strict mode', () => {
  const htmlPath = path.join(ROOT_DIR, 'test/fixtures/e2e/architecture-report/deck.html');
  const attrs = scanDataIdFields(fs.readFileSync(htmlPath, 'utf8'));
  const result = validateDataIdFields(fieldRegistry, attrs, { strict: true });

  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.retired, []);
  assert.deepEqual(result.errors, []);
});

test('validateDataIdFields accepts every current fixture HTML data-id carrier in strict mode', () => {
  for (const htmlPath of fixtureHtmlFiles(path.join(ROOT_DIR, 'test/fixtures'))) {
    const attrs = scanDataIdFields(fs.readFileSync(htmlPath, 'utf8'));
    const result = validateDataIdFields(fieldRegistry, attrs, { strict: true });

    assert.equal(
      result.valid,
      true,
      `${path.relative(ROOT_DIR, htmlPath)}:\n${JSON.stringify(result.errors, null, 2)}`,
    );
  }
});

test('validateDataIdFields lifecycle-manages stale parent-page and reverse-mode carriers', () => {
  const strict = validateDataIdFields(fieldRegistry, [
    'data-id-authoring-grid',
    'data-id-parent-page-display-name',
    'data-id-margins',
  ], { strict: true });

  assert.equal(strict.valid, false);
  assert.deepEqual(
    strict.retired.map((item) => item.name).sort(),
    ['data-id-authoring-grid', 'data-id-margins', 'data-id-parent-page-display-name'].sort(),
  );
  assert.equal(
    strict.errors.every((entry) => entry.code === 'DATA_ID_FIELD_RETIRED'),
    true,
  );

  const reverseModeField = fieldRegistry.getByHtmlAttr('data-id-reverse-mode');
  assert.ok(reverseModeField);
  assert.equal(reverseModeField.fieldClass, 'observation');
  assert.equal(reverseModeField.lifecycle, 'active');
  assert.equal(reverseModeField.validation.mayDriveStructuredCompilation, false);
  assert.equal(reverseModeField.capabilities.html.read, 'observe-only');
  assert.equal(reverseModeField.capabilities.html.write, 'observe-only');
});

test('validateDataIdFields accepts active source and writer data-id carriers outside current fixtures', () => {
  const attrs = [
    'data-id-character-style-name',
    'data-id-confidence',
    'data-id-frame-style-name',
    'data-id-grid-ignore',
    'data-id-guide-ignore',
    'data-id-migration-slot',
    'data-id-object-style-name',
    'data-id-paragraph-style-name',
    'data-id-parent-page-item',
    'data-id-parent-page-source-id',
    'data-id-placement',
    'data-id-slot-name',
    'data-id-slot-type',
    'data-id-snap-grid',
    'data-id-snap-grid-x',
    'data-id-snap-grid-y',
    'data-id-source',
    'data-id-style',
    'data-id-style-name',
    'data-id-table-style-name',
  ];

  const result = validateDataIdFields(fieldRegistry, attrs, { strict: true });

  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.retired, []);
  assert.deepEqual(result.errors, []);
});

function fixtureHtmlFiles(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...fixtureHtmlFiles(fullPath));
    else if (/\.html$/i.test(entry.name)) out.push(fullPath);
  }
  return out.sort();
}
