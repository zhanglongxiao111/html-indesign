const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSynthesizedStyleRegistry,
  normalizeSynthesizedStyles,
  synthesizedStyleFingerprint,
} = require('../../src/semantic-model/synthesized-styles');

function textItem(id, visualStyle = {}, textStyle = {}) {
  return {
    id,
    role: 'text',
    sourceType: 'TextFrame',
    content: { text: id },
    visualStyle: {
      fillColor: null,
      strokeColor: null,
      strokeWeight: null,
      ...visualStyle,
    },
    textStyle: {
      fontFamily: '思源黑体',
      pointSize: 18,
      fillColor: '#333333',
      leading: 22,
      justification: 'left',
      ...textStyle,
    },
  };
}

function lineItem(id, visualStyle = {}) {
  return {
    id,
    role: 'line',
    sourceType: 'GraphicLine',
    visualStyle: {
      strokeColor: '#111111',
      strokeWeight: 0.2834645669,
      strokeStyle: '虚线（3 和 2）',
      lineStartMarker: null,
      lineEndMarker: null,
      ...visualStyle,
    },
  };
}

function shapeItem(id, visualStyle = {}, effects = null) {
  return {
    id,
    role: 'shape',
    sourceType: 'Rectangle',
    visualStyle: {
      fillColor: '#eeeeee',
      strokeColor: '#111111',
      strokeWeight: 1,
      strokeStyle: '实底',
      blendMode: 'multiply',
      opacity: 80,
      ...visualStyle,
    },
    effects,
  };
}

function assetItem(id, placement = {}) {
  return {
    id,
    role: 'graphic',
    sourceType: 'Rectangle',
    asset: {
      path: '\\\\server\\share\\drawing.pdf',
      placement: {
        pageNumber: 2,
        crop: 'media',
        visibleLayers: ['A-墙体'],
        ...placement,
      },
    },
  };
}

test('merges identical text atoms into one synthesized style with Chinese display name', () => {
  const result = normalizeSynthesizedStyles({
    kind: 'DocumentModel',
    id: 'doc',
    pages: [{
      id: 'p1',
      items: [
        textItem('copy-a'),
        textItem('copy-b'),
      ],
    }],
  });

  assert.equal(result.styles.synthesized.length, 1);
  assert.equal(result.styles.synthesized[0].kind, 'text');
  assert.equal(result.styles.synthesized[0].displayName, '文字样式 01');
  assert.match(result.styles.synthesized[0].token, /^synth_text_\d{3}$/);
  assert.equal(
    result.pages[0].items[0].styleRefs.synthesizedToken,
    result.pages[0].items[1].styleRefs.synthesizedToken,
  );
  assert.equal(result.pages[0].items[0].styleRefs.synthesizedName, '文字样式 01');
});

test('keeps item-only text differences as overrides instead of splitting the base style', () => {
  const result = normalizeSynthesizedStyles({
    kind: 'DocumentModel',
    id: 'doc',
    pages: [{
      id: 'p1',
      items: [
        textItem('copy-a'),
        textItem('copy-b', {}, { fillColor: '#ff0000' }),
      ],
    }],
  });

  assert.equal(result.styles.synthesized.length, 1);
  assert.equal(result.styles.synthesized[0].displayName, '文字样式 01');
  assert.deepEqual(result.pages[0].items[1].styleOverrides, {
    text: {
      fillColor: '#ff0000',
    },
  });
});

test('creates stable line fingerprints independent of item id and page order', () => {
  const first = synthesizedStyleFingerprint(lineItem('line-a'));
  const second = synthesizedStyleFingerprint(lineItem('line-b'));

  assert.equal(first.kind, 'line');
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.properties, {
    lineEndMarker: null,
    lineStartMarker: null,
    strokeColor: '#111111',
    strokeStyle: '虚线（3 和 2）',
    strokeWeight: 0.2834645669,
  });
});

test('synthesized style fingerprints ignore retired item type dialect', () => {
  const atom = synthesizedStyleFingerprint({
    id: 'retired-line',
    type: 'GraphicLine',
    visualStyle: {
      strokeColor: '#111111',
      strokeWeight: 1,
    },
  });

  assert.equal(atom, null);
});

test('synthesized style fingerprints may use active sourceType observation for line atoms', () => {
  const atom = synthesizedStyleFingerprint({
    id: 'observed-line',
    sourceType: 'GraphicLine',
    visualStyle: {
      strokeColor: '#111111',
      strokeWeight: 1,
    },
  });

  assert.equal(atom.kind, 'line');
});

test('builds one line style for identical dashed arrows with a Chinese name', () => {
  const registry = buildSynthesizedStyleRegistry([
    lineItem('line-a', { lineEndMarker: '箭头' }),
    lineItem('line-b', { lineEndMarker: '箭头' }),
  ]);

  assert.equal(registry.styles.length, 1);
  assert.deepEqual(registry.styles[0], {
    token: 'synth_line_001',
    displayName: '线条样式 01',
    kind: 'line',
    fingerprint: registry.styles[0].fingerprint,
    source: 'observed-style-atom',
    properties: {
      lineEndMarker: '箭头',
      lineStartMarker: null,
      strokeColor: '#111111',
      strokeStyle: '虚线（3 和 2）',
      strokeWeight: 0.2834645669,
    },
  });
});

test('merges identical object visual atoms into one synthesized object style', () => {
  const registry = buildSynthesizedStyleRegistry([
    shapeItem('shape-a'),
    shapeItem('shape-b'),
  ]);

  assert.equal(registry.styles.length, 1);
  assert.equal(registry.styles[0].kind, 'object');
  assert.equal(registry.styles[0].displayName, '对象样式 01');
  assert.deepEqual(registry.styles[0].properties, {
    blendMode: 'multiply',
    fillColor: '#eeeeee',
    opacity: 80,
    strokeColor: '#111111',
    strokeStyle: '实底',
    strokeWeight: 1,
  });
});

test('creates asset placement atoms without using source file path in the fingerprint', () => {
  const first = synthesizedStyleFingerprint(assetItem('asset-a'));
  const second = synthesizedStyleFingerprint({
    ...assetItem('asset-b'),
    asset: {
      ...assetItem('asset-b').asset,
      path: '\\\\other\\share\\another.pdf',
    },
  });

  assert.equal(first.kind, 'asset');
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.properties, {
    crop: 'media',
    pageNumber: 2,
    visibleLayers: ['A-墙体'],
  });
});
