const test = require('node:test');
const assert = require('node:assert/strict');

const { snapshotToSemanticModel } = require('../../src/adapters/html');

test('html adapter restores synthesized style registry and item references', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'author/deck.html' },
    sourcePackageInput: {
      attributes: {
        'data-id-source-package-config': 'deck.config.json',
        'data-id-document': 'synth-style-doc',
      },
      pageFiles: [{ id: 'p1', file: 'pages/00-p1.html' }],
      styleFiles: ['styles/tokens.css'],
      synthesizedStyles: [{
        token: 'synth_line_001',
        displayName: '线条样式 01',
        kind: 'line',
        fingerprint: 'line:abc',
        source: 'observed-style-atom',
        properties: { strokeStyle: '虚线（3 和 2）' },
      }],
    },
    pages: [{
      id: 'p1',
      index: 0,
      widthMm: 800,
      heightMm: 450,
      rectPx: { x: 0, y: 0, width: 800, height: 450 },
      attributes: { 'data-page': 'p1' },
      computedStyle: {},
      items: [{
        id: 'line-a',
        role: 'line',
        tagName: 'svg',
        classList: ['id-object'],
        attributes: {
          'data-id-style-token': 'synth_line_001',
          'data-id-style-name': '线条样式 01',
        },
        rectPx: { x: 100, y: 120, width: 200, height: 1 },
        computedStyle: {},
        text: '',
        runs: [],
      }],
    }],
    assets: [],
  }, { unitMode: 'presentation', targetSize: 'same' });

  assert.deepEqual(model.styles.synthesized, [{
    token: 'synth_line_001',
    displayName: '线条样式 01',
    kind: 'line',
    fingerprint: 'line:abc',
    source: 'observed-style-atom',
    properties: { strokeStyle: '虚线（3 和 2）' },
  }]);
  assert.equal(model.pages[0].items[0].styleRefs.synthesizedToken, 'synth_line_001');
  assert.equal(model.pages[0].items[0].styleRefs.synthesizedName, '线条样式 01');
});
