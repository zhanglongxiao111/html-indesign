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
  assert.doesNotMatch(componentsCss, /\.synth-synth_line_001\s*\{[^}]*border:/);
});

test('author package writes synthesized text fill as color instead of background', () => {
  const outDir = path.resolve('test/workspace/synthesized-text-style-author-package');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'synth-text-style-doc',
    title: '合成文字样式测试',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {
      synthesized: [{
        token: 'synth_text_001',
        displayName: '文字样式 01',
        kind: 'text',
        fingerprint: 'text:abc',
        source: 'observed-style-atom',
        properties: {
          fontFamily: '微软雅黑',
          fontWeight: '700',
          pointSize: 45,
          leading: 72,
          fillColor: '#0d0d0d',
          tracking: 120,
          justification: 'right',
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
        id: 'title-a',
        role: 'text',
        sourceType: 'TextFrame',
        bounds: { x: 100, y: 120, width: 400, height: 80 },
        content: { text: '永定湾展示中心建筑设计概念方案' },
        styleRefs: {
          synthesizedToken: 'synth_text_001',
          synthesizedName: '文字样式 01',
        },
        textStyle: {
          fontFamily: '微软雅黑',
          fontWeight: '700',
          pointSize: 45,
          leading: 72,
          fillColor: '#0d0d0d',
          tracking: 120,
          justification: 'right',
        },
        visualStyle: {
          fillColor: null,
          strokeColor: null,
          strokeWeight: null,
        },
      }],
    }],
  }, { outDir, mode: 'observation' });

  const componentsCss = fs.readFileSync(path.join(outDir, 'styles/components.css'), 'utf8');
  assert.match(componentsCss, /\/\* 文字样式 01 \*\//);
  assert.match(componentsCss, /\.synth-synth_text_001\s*\{[^}]*color:#0d0d0d/);
  assert.doesNotMatch(componentsCss, /\.synth-synth_text_001\s*\{[^}]*background-color:/);
  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/00-p1.html'), 'utf8');
  const titleTag = /<p[^>]+id="title-a"[^>]*>/.exec(pageHtml)[0];
  assert.doesNotMatch(titleTag, /font-family|font-weight|font-size|line-height|color:|letter-spacing|text-align/);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'reports/authoring-report.json'), 'utf8'));
  assert.deepEqual(report.styleResidual, {
    removedProperties: 7,
    itemsReduced: 1,
    missingSynthRules: [],
  });
});

test('author package preserves inline facts and reports a missing synth rule', () => {
  const outDir = path.resolve('test/workspace/missing-synth-style-author-package');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'missing-synth-style-doc',
    reverseMode: 'observation',
    styles: { synthesized: [] },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      items: [{
        id: 'copy-a',
        role: 'text',
        bounds: { x: 100, y: 120, width: 400, height: 80 },
        content: { text: '缺失样式仍须保留格式' },
        styleRefs: { synthesizedToken: 'missing-token' },
        textStyle: { pointSize: 24, fillColor: '#123456' },
      }],
    }],
  }, { outDir, mode: 'observation' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/00-p1.html'), 'utf8');
  assert.match(pageHtml, /id="copy-a"[^>]+style="[^"]*font-size:24px[^"]*color:#123456/);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'reports/authoring-report.json'), 'utf8'));
  assert.deepEqual(report.styleResidual.missingSynthRules, [{ itemId: 'copy-a', token: 'missing-token' }]);
});

test('author package uses copied source synthesized rules when the reverse model no longer carries the registry', () => {
  const root = path.resolve('test/workspace/source-synthesized-style-author-package');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(sourceRoot, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'source-synth-doc',
    title: '来源样式规则测试',
    entry: 'deck.html',
    styles: ['styles/components.css'],
    pages: [{ id: 'p1', file: 'pages/00-p1.html' }],
    assets: { root: 'assets' },
    synthesizedStyles: [{
      token: 'synth_text_001',
      displayName: '文字样式 01',
      kind: 'text',
      properties: { pointSize: 24, fillColor: '#123456' },
    }],
  }, null, 2));
  fs.writeFileSync(path.join(sourceRoot, 'styles/components.css'), '.synth-synth_text_001{font-size:24px;color:#123456}\n');

  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'source-synth-doc',
    title: '来源样式规则测试',
    reverseMode: 'observation',
    styles: { synthesized: [] },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      items: [{
        id: 'copy-a',
        role: 'text',
        bounds: { x: 100, y: 120, width: 400, height: 80 },
        content: { text: '样式来自上一轮作者包' },
        styleRefs: { synthesizedToken: 'synth_text_001' },
        textStyle: { pointSize: 24, fillColor: '#123456' },
      }],
    }],
  }, { outDir, sourceRoot, mode: 'observation' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/00-p1.html'), 'utf8');
  const copyTag = /<p[^>]+id="copy-a"[^>]*>/.exec(pageHtml)[0];
  assert.doesNotMatch(copyTag, /font-size:24px|color:#123456/);
  const report = JSON.parse(fs.readFileSync(path.join(outDir, 'reports/authoring-report.json'), 'utf8'));
  assert.deepEqual(report.styleResidual, {
    removedProperties: 2,
    itemsReduced: 1,
    missingSynthRules: [],
  });
});
