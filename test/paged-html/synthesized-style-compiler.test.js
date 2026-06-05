const test = require('node:test');
const assert = require('node:assert/strict');

const { semanticModelToInstructions } = require('../../src/writers/indesign');

test('semantic model compiler maps synthesized line style to native object style with Chinese name', () => {
  const instructions = semanticModelToInstructions({
    kind: 'DocumentModel',
    id: 'synth-style-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {
      synthesized: [{
        token: 'synth_line_001',
        displayName: '线条样式 01',
        kind: 'line',
        fingerprint: 'line:abc',
        source: 'observed-style-atom',
        properties: {
          strokeColor: '#111111',
          strokeWeight: 0.2834645669,
          strokeStyle: '虚线（3 和 2）',
          lineEndMarker: '箭头',
        },
      }],
    },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      items: [{
        id: 'line-a',
        role: 'line',
        bounds: { x: 100, y: 120, width: 200, height: 0 },
        styleRefs: {
          synthesizedToken: 'synth_line_001',
          synthesizedName: '线条样式 01',
        },
        visualStyle: {
          strokeColor: '#111111',
          strokeWeight: 0.2834645669,
          strokeStyle: '虚线（3 和 2）',
          lineEndMarker: '箭头',
        },
      }],
    }],
  });

  assert.deepEqual(instructions.styles.objectStyles['线条样式 01'], {
    name: '线条样式 01',
    token: 'synth_line_001',
    displayName: '线条样式 01',
    strokeColor: '#111111',
    strokeWeight: 0.2834645669,
    strokeStyle: '虚线（3 和 2）',
    lineEndMarker: '箭头',
    labels: instructions.styles.objectStyles['线条样式 01'].labels,
  });
  assert.equal(instructions.pages[0].items[0].styleRefs.objectStyle, '线条样式 01');
  assert.equal(instructions.pages[0].items[0].styleRefs.synthesizedToken, 'synth_line_001');
});

test('semantic model compiler maps synthesized asset placement style to native frame style', () => {
  const instructions = semanticModelToInstructions({
    kind: 'DocumentModel',
    id: 'synth-asset-doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {
      synthesized: [{
        token: 'synth_asset_001',
        displayName: '置入样式 01',
        kind: 'asset',
        fingerprint: 'asset:abc',
        source: 'observed-style-atom',
        properties: {
          fit: 'manual',
          contentScale: { x: 1.2, y: 1.2 },
        },
      }],
    },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      items: [{
        id: 'asset-a',
        role: 'graphic',
        bounds: { x: 100, y: 120, width: 200, height: 100 },
        styleRefs: {
          synthesizedToken: 'synth_asset_001',
          synthesizedName: '置入样式 01',
        },
        asset: { path: 'drawing.pdf', placement: { fit: 'manual' } },
      }],
    }],
    assets: [{ id: 'drawing.pdf', path: 'drawing.pdf' }],
  });

  assert.equal(instructions.styles.frameStyles['置入样式 01'].token, 'synth_asset_001');
  assert.equal(instructions.pages[0].items[0].styleRefs.frameStyle, '置入样式 01');
});
