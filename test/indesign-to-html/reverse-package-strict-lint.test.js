const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileDocument } = require('../../src/indesign-pipeline');
const { authorPackageCompileOptions, lintAuthoringPackage, readAuthorPackage } = require('../../src/authoring');
const { auditAuthorSourceRoundtrip } = require('../../src/writers/html/audit/source-roundtrip-diff');

// #32：observation 回读的作者包不经人工修改就要能过 html.build_indesign 的 strict lint，
// 并且正向构建后对象回到同名图层、同名样式。

test('human INDD: layer "图层 1" stays one token, styles and layer are registered in the package preset (#32)', async () => {
  const root = path.resolve('test/workspace/reverse-package-strict-lint/human');
  fs.rmSync(root, { recursive: true, force: true });
  const model = reverseSnapshotToSemanticModel(humanSnapshot(), { mode: 'observation' });
  const result = writeReverseAuthorPackage(model, { outDir: root, mode: 'observation' });
  const pageHtml = fs.readFileSync(path.join(root, result.pages[0]), 'utf8');

  assert.match(pageHtml, /data-id-layer="图层 1"/);
  assert.match(pageHtml, /<section [^>]*data-id-layout="observed"/, 'neutral layout token on the page root');
  assert.match(pageHtml, /<section [^>]*data-id-grid="1x1"/, 'explicit single-cell grid on the page root');
  assert.match(pageHtml, /<section [^>]*data-id-guides="\[\]"/, 'guides stay the observed (empty) set');

  const config = JSON.parse(fs.readFileSync(result.configPath, 'utf8'));
  assert.equal(config.semanticPreset, 'semantic-preset.json');
  const preset = JSON.parse(fs.readFileSync(path.join(root, 'semantic-preset.json'), 'utf8'));
  assert.equal(preset.styleNameMap.layers['图层 1'], '图层 1');
  assert.equal(preset.styleNameMap.layers.text, '文字', 'standard vocabulary is kept as the base');
  assert.equal(preset.styleNameMap.paragraphStyles['渐变段落'], '渐变段落');
  assert.equal(preset.styleNameMap.objectStyles['渐变对象'], '渐变对象');
  assert.deepEqual(result.report.semanticPreset.unresolved, []);
  assert.equal(result.report.semanticPreset.path, 'semantic-preset.json');

  const lint = await lintAuthoringPackage({ packagePath: result.configPath, strict: true, lintProfile: 'reverse-export' });
  assert.deepEqual(lint.errors.map((entry) => entry.code), []);
  const defaultLint = await lintAuthoringPackage({ packagePath: result.configPath, strict: true });
  const defaultCodes = new Set(defaultLint.errors.map((entry) => entry.code));
  for (const code of ['SEMANTIC_TOKEN_UNKNOWN', 'AUTHOR_PAGE_CONTRACT_MISSING', 'PAGE_GRID_RULE_MISSING']) {
    assert.equal(defaultCodes.has(code), false, `${code} must not block the default profile either`);
  }

  const sourcePackage = readAuthorPackage(result.configPath);
  const snapshot = await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const { instructions } = compileDocument(snapshot, authorPackageCompileOptions(sourcePackage).document);
  const items = instructions.pages.flatMap((page) => page.items);
  assert.ok(items.length > 0);
  assert.deepEqual([...new Set(items.map((item) => item.layer))], ['图层 1'], 'objects land on the same human layer');
  assert.ok(instructions.layers.some((layer) => layer.name === '图层 1'));
  assert.ok(Object.values(instructions.styles.paragraphStyles).some((style) => style.name === '渐变段落'));
  assert.deepEqual(instructions.pages[0].guides, [], 'declaring the default grid adds no grid guides');
});

test('structured-built INDD: layer display names are written back as semantic keys, forward-created styles are registered (#32)', async () => {
  const root = path.resolve('test/workspace/reverse-package-strict-lint/structured-built');
  fs.rmSync(root, { recursive: true, force: true });
  const model = reverseSnapshotToSemanticModel(structuredBuiltSnapshot(), { mode: 'observation' });
  const result = writeReverseAuthorPackage(model, { outDir: root, mode: 'observation' });
  const pageHtml = fs.readFileSync(path.join(root, result.pages[0]), 'utf8');

  assert.doesNotMatch(pageHtml, /data-id-layer="(?:文字|内容)"/);
  assert.match(pageHtml, /data-id-layer="text"/);
  assert.match(pageHtml, /data-id-layer="content"/);
  const preset = JSON.parse(fs.readFileSync(path.join(root, 'semantic-preset.json'), 'utf8'));
  assert.equal(preset.styleNameMap.objectStyles['data-table'], '自动对象-66324081', 'token keeps its InDesign name');
  assert.equal(preset.styleNameMap.objectStyles['色块-08371558'], '色块-08371558');
  assert.equal(Object.prototype.hasOwnProperty.call(preset.styleNameMap.layers, '文字'), false, 'display names are not registered as new layer tokens');

  const lint = await lintAuthoringPackage({ packagePath: result.configPath, strict: true });
  assert.deepEqual(lint.errors.filter((entry) => entry.code === 'SEMANTIC_TOKEN_UNKNOWN'), []);

  const sourcePackage = readAuthorPackage(result.configPath);
  const snapshot = await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const { instructions } = compileDocument(snapshot, authorPackageCompileOptions(sourcePackage).document);
  const items = instructions.pages.flatMap((page) => page.items);
  assert.deepEqual([...new Set(items.map((item) => item.layer))].sort(), ['内容', '文字']);
  const objectStyleNames = Object.values(instructions.styles.objectStyles).map((style) => style.name);
  assert.ok(objectStyleNames.includes('自动对象-66324081'));
  assert.ok(objectStyleNames.includes('色块-08371558'));
});

test('observation reverse against a source package demotes form-only diffs but keeps content losses as errors (#32)', () => {
  const root = path.resolve('test/workspace/reverse-package-strict-lint/source-audit');
  fs.rmSync(root, { recursive: true, force: true });
  const { auditReverseAuthorPackage } = require('../../src/writers/html/audit/reverse-roundtrip');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets', 'photo.jpg'), 'jpg', 'utf8');
  writePackage(sourceRoot, '<section class="page" data-page="p1"><p id="t">Title</p><img id="hero" class="hero" src="../assets/photo.jpg" alt="hero"></section>');
  const assetPath = path.join(root, 'assets', 'photo.jpg');
  const framed = `<figure id="hero" class="hero id-object" data-id-asset-path="${assetPath}" data-id-fit="manual">`
    + `<img class="placed-asset-content" src="file:///${assetPath.replace(/\\/g, '/')}" alt="hero" data-id-ignore></figure>`;
  writePackage(reverseRoot, `<section class="page" data-page="p1"><p id="t" class="observed-text id-object">Title</p>${framed}</section>`);

  const observed = auditReverseAuthorPackage({ config: path.join(reverseRoot, 'deck.config.json'), outDir: reverseRoot, sourceRoot, mode: 'observation' });
  assert.equal(observed.contentInventory.ok, true, 'figure frame with data-id-asset-path counts as the same resource');
  assert.deepEqual(observed.structureSignature.errors, []);
  assert.deepEqual(observed.sourceRoundtrip.errors, []);
  assert.ok(observed.structureSignature.warnings.some((entry) => entry.code === 'STRUCTURE_NODE_TAG_CHANGED' && entry.demotedBy === 'observation'));
  assert.ok(observed.sourceRoundtrip.warnings.some((entry) => entry.code === 'ROUNDTRIP_TAG_SEQUENCE_CHANGED'));

  const structured = auditReverseAuthorPackage({ config: path.join(reverseRoot, 'deck.config.json'), outDir: reverseRoot, sourceRoot, mode: 'structured' });
  assert.ok(structured.structureSignature.errors.some((entry) => entry.code === 'STRUCTURE_NODE_TAG_CHANGED'), 'structured mode still gates structure');

  writePackage(reverseRoot, `<section class="page" data-page="p1"><p id="t" class="observed-text id-object">Changed</p>${framed}</section>`);
  const lost = auditReverseAuthorPackage({ config: path.join(reverseRoot, 'deck.config.json'), outDir: reverseRoot, sourceRoot, mode: 'observation' });
  assert.ok(lost.sourceRoundtrip.errors.some((entry) => entry.code === 'ROUNDTRIP_TEXT_CHANGED'), 'text change is still an error');
  assert.equal(lost.ok, false);
  assert.equal(auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot }).ok, false);
});

function writePackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'reverse-audit',
    title: 'Reverse Audit',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'p1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}

function textItem(id, bounds, text, layerName, paragraphStyleName) {
  return {
    id,
    type: 'TextFrame',
    bounds,
    layerName,
    text,
    labels: [],
    paragraphStyleName,
    objectStyleName: '[基本文本框架]',
    textRuns: [{ text, characterStyle: '[无]', textStyle: { pointSize: 12 } }],
  };
}

function rectangleItem(id, bounds, layerName, objectStyleName, fillColor) {
  return {
    id,
    type: 'Rectangle',
    bounds,
    layerName,
    text: '',
    labels: [],
    objectStyleName,
    visualStyle: { fillColor, strokeWeight: 0 },
  };
}

function humanSnapshot() {
  return {
    metadata: { sourceDocument: 'gradient-sample.indd', mode: 'observation' },
    document: { name: 'gradient-sample.indd', labels: [] },
    layers: [{ name: '图层 1', index: 0, visible: true, printable: true, locked: false, labels: [] }],
    styles: {
      paragraphStyles: [{ name: '[基本段落]', labels: [], css: '' }, { name: '渐变段落', labels: [], css: 'font-size:12pt' }],
      characterStyles: [{ name: '[无]', labels: [], css: '' }],
      objectStyles: [{ name: '[基本图形框架]', labels: [] }, { name: '渐变对象', labels: [], css: 'background-color:#ff0000' }],
    },
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: 595.28, height: 841.89 },
      margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 },
      guides: [],
      items: [
        textItem('286', { x: 396.85, y: 56.69, width: 170.08, height: 170.08 }, 'Gradient text', '图层 1', '渐变段落'),
        rectangleItem('290', { x: 396.85, y: 453.54, width: 170.08, height: 113.39 }, '图层 1', '渐变对象', '#ff0000'),
      ],
    }],
  };
}

function structuredBuiltSnapshot() {
  const layer = (name, index) => ({
    name,
    index,
    visible: true,
    printable: true,
    locked: false,
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'layer', id: `layer-${name}`, source: 'html-to-indesign', token: name, displayName: name }],
  });
  const objectStyle = (name, token) => ({
    name,
    labels: [{ protocol: 'html-indesign', version: 1, kind: 'style', id: token, source: 'html-to-indesign', styleKind: 'objectStyles', token, displayName: name }],
    css: 'background-color:#8da18f',
  });
  return {
    metadata: { sourceDocument: 'html-indesign-output.indd', mode: 'structured' },
    document: {
      name: 'html-indesign-output.indd',
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'document', id: 'architecture-report', source: 'html-to-indesign', title: 'Report', profile: 'architecture-report' }],
    },
    layers: [layer('文字', 0), layer('内容', 1)],
    styles: {
      paragraphStyles: [{ name: '[基本段落]', labels: [], css: '' }],
      objectStyles: [objectStyle('色块-08371558', '色块-08371558'), objectStyle('自动对象-66324081', 'data-table')],
    },
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: 800, height: 450 },
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      guides: [],
      items: [
        textItem('t1', { x: 40, y: 40, width: 300, height: 40 }, 'Observed title', '文字', '[基本段落]'),
        rectangleItem('r1', { x: 40, y: 120, width: 40, height: 40 }, '内容', '色块-08371558', '#8da18f'),
        rectangleItem('r2', { x: 120, y: 120, width: 200, height: 100 }, '内容', '自动对象-66324081', '#ffffff'),
      ],
    }],
  };
}
