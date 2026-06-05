const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { writeReverseAuthorPackage } = require('../../src/writers/html');

test('author package preserves synthesized style token and Chinese display name', () => {
  const outDir = path.resolve('test/workspace/synthesized-style-author-package');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'synth-style-doc',
    title: '合成样式测试',
    reverseMode: 'observation',
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
        },
      }],
    },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      labels: [],
      items: [{
        id: 'line-a',
        role: 'line',
        sourceType: 'GraphicLine',
        bounds: { x: 100, y: 120, width: 200, height: 0 },
        styleRefs: {
          synthesizedToken: 'synth_line_001',
          synthesizedName: '线条样式 01',
        },
        visualStyle: {
          strokeColor: '#111111',
          strokeWeight: 0.2834645669,
          strokeStyle: '虚线（3 和 2）',
        },
      }],
    }],
  }, { outDir, mode: 'observation' });

  const config = JSON.parse(fs.readFileSync(path.join(outDir, 'deck.config.json'), 'utf8'));
  assert.deepEqual(config.synthesizedStyles, [{
    token: 'synth_line_001',
    displayName: '线条样式 01',
    kind: 'line',
    fingerprint: 'line:abc',
    source: 'observed-style-atom',
    properties: {
      strokeColor: '#111111',
      strokeWeight: 0.2834645669,
      strokeStyle: '虚线（3 和 2）',
    },
  }]);

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/00-p1.html'), 'utf8');
  assert.match(pageHtml, /data-id-style-token="synth_line_001"/);
  assert.match(pageHtml, /data-id-style-name="线条样式 01"/);
  assert.match(pageHtml, /class="[^"]*synth-synth_line_001/);

  const componentsCss = fs.readFileSync(path.join(outDir, 'styles/components.css'), 'utf8');
  assert.match(componentsCss, /\/\* 线条样式 01 \*\//);
  assert.match(componentsCss, /\.synth-synth_line_001\s*\{/);
});
