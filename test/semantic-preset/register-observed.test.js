const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  layerTokensByDisplayName,
  loadStandardSemanticPreset,
  registerObservedSemanticTokens,
} = require('../../src/semantic-preset');

function pageFile(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-register-observed-'));
  const filePath = path.join(dir, 'pages', '01-page.html');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, relativePath: 'pages/01-page.html' };
}

test('registers read-back style and layer names with their InDesign display names (#32)', () => {
  const base = { schemaVersion: 1, id: 'project', styleNameMap: { objectStyles: { swatch: '色块' } }, tokens: {} };
  const html = '<section class="page">'
    + '<div data-id-object-style="data-table" data-id-object-style-name="自动对象-66324081"></div>'
    + '<div data-id-object-style="swatch" data-id-object-style-name="色块"></div>'
    + '<div data-id-layer="图层 1" data-id-cell-style="强调单元格"></div>'
    + '</section>';
  const result = registerObservedSemanticTokens({ preset: base, pageFiles: [pageFile(html)] });

  assert.equal(result.preset.styleNameMap.objectStyles['data-table'], '自动对象-66324081');
  assert.equal(result.preset.styleNameMap.layers['图层 1'], '图层 1');
  assert.equal(result.preset.styleNameMap.cellStyles['强调单元格'], '强调单元格', 'no name attribute: token is the name');
  assert.deepEqual(result.registrations.map((entry) => entry.token).sort(), ['data-table', '图层 1', '强调单元格'].sort());
  assert.equal(base.styleNameMap.layers, undefined, 'input preset is not mutated');
});

test('enum tokens are registered only from the standard vocabulary; semantic tokens never are (#32)', () => {
  const canonicalPreset = loadStandardSemanticPreset('architecture-report').preset;
  const base = { schemaVersion: 1, id: 'old-project', styleNameMap: {}, tokens: { fits: ['cover', 'contain', 'fill'] } };
  const html = '<section class="page">'
    + '<figure data-id-fit="manual"></figure><figure data-id-fit="stretch"></figure>'
    + '<div data-id-semantic="made-up"></div>'
    + '</section>';
  const result = registerObservedSemanticTokens({ preset: base, canonicalPreset, pageFiles: [pageFile(html)] });

  assert.deepEqual(result.preset.tokens.fits, ['cover', 'contain', 'fill', 'manual']);
  assert.deepEqual(result.unresolved.map((entry) => `${entry.kind}:${entry.token}`), ['semantic:made-up', 'fits:stretch']);
});

test('layerTokensByDisplayName inverts styleNameMap.layers', () => {
  const map = layerTokensByDisplayName(loadStandardSemanticPreset('architecture-report').preset);
  assert.equal(map.get('文字'), 'text');
  assert.equal(map.get('内容'), 'content');
  assert.equal(map.get('标注组'), 'annotations');
  assert.equal(map.has('图层 1'), false);
});
