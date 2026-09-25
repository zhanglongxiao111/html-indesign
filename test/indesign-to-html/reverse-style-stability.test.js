// 反向往返的样式稳定性（09-26 真机验收）：样式定义不被局部外观污染、合成样式编号稳定、
// 合成样式不吞掉组内不同颜色、伴生文字段落样式、图片替代文字。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderSnapshot } = require('../../src/adapters/html');
const { compileStyles } = require('../../src/writers/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { normalizeSynthesizedStyles } = require('../../src/semantic-model/synthesized-styles');
const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { styleNameForKind } = require('../../src/style-synthesis/style-identities');

const SVG_ASSET = path.resolve(__dirname, '../fixtures/e2e/smoke-assets/svg/circulation.svg');

function writeHtml(name, body, css) {
  const outDir = path.resolve('test/workspace', name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, 'deck.html');
  fs.writeFileSync(htmlPath, `<!doctype html>
<style>
  .page { width: 800px; height: 450px; position: relative; }
  .page :where(p) { margin: 0; }
${css}
</style>
<section class="page" id="page-1">
${body}
</section>`, 'utf8');
  return htmlPath;
}

function swatchValue(styled, name) {
  const swatch = name && styled.styles.swatches[name];
  return swatch ? swatch.value : name;
}

test('paragraph style definition comes from its .pstyle-* rule, not from synth classes or fallback geometry', async () => {
  const htmlPath = writeHtml('reverse-style-stability-pstyle', `
  <p id="eyebrow" class="pstyle-eyebrow synth-synth_text_001" data-id-paragraph-style="eyebrow"
     data-id-paragraph-style-name="页眉小标" data-id-style-token="synth_text_001" data-id-style-name="文字样式 01">Grid</p>`, `
  .pstyle-eyebrow { font-family: Arial; font-size: 12px; line-height: 16px; color: #000000; margin-top: 8px; }
  .synth-synth_text_001 { font-family: Arial; font-size: 12px; line-height: 16px; color: #c8102e; }
  [id="eyebrow"] { position: absolute; left: 10px; top: 10px; width: 200px; height: 16px; margin: 0; }`);

  const snapshot = await renderSnapshot({ htmlPath });
  const item = snapshot.pages[0].items.find((entry) => entry.id === 'eyebrow');
  assert.match(item.styleClassRules.paragraph.color, /^(#000000|rgb\(0, 0, 0\))$/);
  assert.equal(item.styleClassRules.paragraph.marginTop, '8px');

  const styled = compileStyles(snapshot);
  const style = styled.styles.paragraphStyles['页眉小标'];
  assert.equal(swatchValue(styled, style.fillColor), '#000000', 'style color is the style rule, not the synth look');
  assert.equal(style.spaceBefore, 6, 'space before (8px = 6pt) survives the margin:0 fallback geometry');
  const compiledItem = styled.pages[0].items.find((entry) => entry.id === 'eyebrow');
  assert.equal(swatchValue(styled, compiledItem.textOverride.fillColor), '#c8102e', 'the item look becomes a local override');
  assert.equal('spaceBefore' in compiledItem.textOverride, false, 'frame margin is placement, not a paragraph override');
});

test('object style definition keeps the .ostyle-* rule: wrapper without paint, protocol stroke stays local', async () => {
  const htmlPath = writeHtml('reverse-style-stability-ostyle', `
  <div id="drawing-wrap" data-id-ignore style="position:absolute;left:300px;top:10px;width:200px;height:150px">
    <img id="drawing-frame" class="ostyle-drawing-frame" src="${SVG_ASSET.replace(/\\/g, '/')}" alt="plan"
         data-id-object data-id-object-style="drawing-frame" data-id-object-style-name="图纸图框"
         style="position:absolute;left:0;top:0;width:200px;height:150px">
  </div>
  <svg id="callout-line" class="ostyle-callout-line" data-id-object data-id-vector="line" data-id-object-style="callout-line"
       data-id-object-style-name="标注引线" data-id-stroke-color="#c8102e" data-id-stroke-weight="1"
       viewBox="0 0 100 40" preserveAspectRatio="none" style="position:absolute;left:20px;top:200px;width:100px;height:40px;overflow:visible">
    <path d="M0 40 L100 0" fill="none" stroke="#c8102e" stroke-width="1"></path>
  </svg>`, `
  .ostyle-drawing-frame { background-color: #ffffff; border: 1px solid #aeb8b8; border-radius: 4px; }
  .ostyle-callout-line { }`);

  const snapshot = await renderSnapshot({ htmlPath });
  const frame = snapshot.pages[0].items.find((entry) => entry.id === 'drawing-wrap');
  assert.equal(frame.computedStyle.backgroundColor, 'rgb(255, 255, 255)', 'an unpainted wrapper keeps the object paint');
  const line = snapshot.pages[0].items.find((entry) => entry.id === 'callout-line');
  assert.deepEqual(line.styleClassRules.object, {}, 'an empty style rule is still a declared (empty) style');

  const styled = compileStyles(snapshot);
  const frameStyle = styled.styles.objectStyles['图纸图框'];
  assert.equal(swatchValue(styled, frameStyle.fillColor), '#ffffff');
  assert.match(frameStyle.cornerRadius, /^4(px|pt)$/);
  const lineStyle = styled.styles.objectStyles['标注引线'];
  assert.equal(lineStyle.strokeWeight, 0, 'the line stroke is the item look, not the object style');
  assert.equal(lineStyle.strokeColor, null);
});

test('synthesized style numbers follow the previous round and element classes use the same numbers', () => {
  const textItem = (id, color, token) => ({
    id,
    role: 'text',
    textStyle: { fontFamily: 'Arial', pointSize: 10.6667, fillColor: color },
    sourceNode: token ? { tagName: 'p', attributes: { 'data-id-style-token': token } } : null,
  });
  const objectItem = (id, fill, token) => ({
    id,
    role: 'shape',
    visualStyle: { fillColor: fill, strokeWeight: 0 },
    sourceNode: token ? { tagName: 'div', attributes: { 'data-id-style-token': token } } : null,
  });
  const model = normalizeSynthesizedStyles({
    kind: 'DocumentModel',
    id: 'doc',
    pages: [{
      id: 'p1',
      items: [
        // 首个外观组在上一轮是 008 号：本轮仍是 008，不因出现顺序改成 001。
        objectItem('callout', '#ffffff', 'synth_object_008'),
        objectItem('swatch', '#c8102e', 'synth_object_004'),
        objectItem('new-shape', '#8da18f', null),
        textItem('legend', '#5e6b70', 'synth_text_006'),
        textItem('folio', '#7c8588', 'synth_text_006'),
      ],
    }],
  });
  const byId = new Map(model.pages[0].items.map((item) => [item.id, item]));
  assert.equal(byId.get('callout').styleRefs.synthesizedToken, 'synth_object_008');
  assert.equal(byId.get('callout').styleRefs.synthesizedName, '对象样式 08');
  assert.equal(byId.get('swatch').styleRefs.synthesizedToken, 'synth_object_004');
  assert.equal(byId.get('new-shape').styleRefs.synthesizedToken, 'synth_object_001', 'new groups take free numbers');
  assert.equal(byId.get('folio').styleRefs.synthesizedToken, 'synth_text_006');
  assert.deepEqual(byId.get('folio').styleOverrides, { text: { fillColor: '#7c8588' } });

  const outDir = path.resolve('test/workspace/reverse-style-stability-numbering');
  fs.rmSync(outDir, { recursive: true, force: true });
  const callout = byId.get('callout');
  callout.labelStatus = 'accepted';
  callout.bounds = { x: 10, y: 10, width: 100, height: 20 };
  callout.structure = { parentId: 'p1', order: 1 };
  callout.sourceNode = {
    tagName: 'div',
    id: 'callout',
    classList: ['annotation', 'synth-synth_object_009', 'id-object'],
    attributes: {
      id: 'callout',
      class: 'annotation synth-synth_object_009 id-object',
      'data-id-style-token': 'synth_object_009',
      'data-id-style-name': '对象样式 09',
    },
  };
  writeReverseAuthorPackage({
    ...model,
    title: 'numbering',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{ id: 'p1', index: 0, width: 800, height: 450, labels: [], items: [callout] }],
  }, { outDir, mode: 'observation' });
  const html = fs.readFileSync(path.join(outDir, 'pages', '00-p1.html'), 'utf8');
  const css = fs.readFileSync(path.join(outDir, 'styles', 'components.css'), 'utf8');
  assert.match(html, /class="annotation synth-synth_object_008 id-object"/, 'stale synth class is replaced in place');
  assert.match(html, /data-id-style-token="synth_object_008"/);
  assert.match(html, /data-id-style-name="对象样式 08"/);
  assert.doesNotMatch(html, /synth_object_009|对象样式 09/);
  assert.match(css, /\.synth-synth_object_008 \{ background-color:#ffffff \}/);
});

test('accepted source items write the synth group color they do not share as a local override', () => {
  const outDir = path.resolve('test/workspace/reverse-style-stability-synth-override');
  fs.rmSync(outDir, { recursive: true, force: true });
  const text = (id, color, order) => ({
    id,
    role: 'text',
    labelStatus: 'accepted',
    bounds: { x: 10, y: 10 + order * 20, width: 200, height: 14 },
    structure: { parentId: 'p1', order },
    content: { text: id, runs: [] },
    textStyle: { fontFamily: 'Arial', pointSize: 10.6667, fillColor: color, justification: 'left' },
    sourceNode: {
      tagName: 'span',
      id,
      classList: [],
      // 上一轮写下的覆盖值：与本轮合成规则相同的属性要从来源内联样式里剥掉。
      attributes: { id, style: order === 2 ? 'color:#7c8588' : '' },
    },
  });
  const model = normalizeSynthesizedStyles({
    kind: 'DocumentModel',
    id: 'doc',
    title: 'override',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      labels: [],
      items: [text('folio', '#7c8588', 1), text('legend', '#5e6b70', 2)],
    }],
  });
  writeReverseAuthorPackage(model, { outDir, mode: 'observation' });
  const html = fs.readFileSync(path.join(outDir, 'pages', '00-p1.html'), 'utf8');
  const css = fs.readFileSync(path.join(outDir, 'styles', 'components.css'), 'utf8');
  assert.match(css, /\.synth-synth_text_001 \{[^}]*color:#7c8588/);
  assert.match(html, /id="legend"[^>]*style="color:#5e6b70[;"]/, 'legend keeps its own color over the shared synth rule');
  assert.doesNotMatch(html, /id="folio"[^>]*style="[^"]*color:/, 'folio matches the rule and needs no override');
});

test('author CSS names native style rules by the same token the elements carry, and keeps empty user styles', () => {
  const outDir = path.resolve('test/workspace/reverse-style-stability-class-token');
  fs.rmSync(outDir, { recursive: true, force: true });
  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'doc',
    title: 'tokens',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {
      objectStyles: {
        'drawing-frame-object': {
          name: '图纸图框',
          token: 'drawing-frame-object',
          displayName: '图纸图框',
          safeName: '图纸图框',
          css: 'background-color:#ffffff; border:1pt solid #aeb8b8; border-radius:4pt',
        },
        'callout-line': { name: '标注引线', token: 'callout-line', displayName: '标注引线', safeName: '标注引线', css: '' },
        '[无]': { name: '[无]', token: '[无]', displayName: '[无]', safeName: '无', css: '' },
      },
    },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      labels: [],
      items: [{
        id: 'frame',
        role: 'shape',
        bounds: { x: 10, y: 10, width: 100, height: 60 },
        styleRefs: { objectStyle: 'drawing-frame-object', objectStyleDisplayName: '图纸图框' },
      }],
    }],
  }, { outDir, mode: 'observation' });
  const html = fs.readFileSync(path.join(outDir, 'pages', '00-p1.html'), 'utf8');
  const css = fs.readFileSync(path.join(outDir, 'styles', 'components.css'), 'utf8');
  assert.match(html, /class="[^"]*ostyle-drawing-frame-object/);
  assert.match(css, /\.ostyle-drawing-frame-object \{ background-color:#ffffff; border:1px solid #aeb8b8; border-radius:4px \}/);
  assert.doesNotMatch(css, /\.ostyle-图纸图框/);
  assert.match(css, /\.ostyle-callout-line \{ {2}\}/);
  assert.doesNotMatch(css, /\.ostyle-无/);
});

test('a synthesized object style name is never read as the paragraph style of the companion text', () => {
  const item = {
    attributes: {
      'data-id-object-style': 'annotation-label',
      'data-id-style-token': 'synth_object_009',
      'data-id-style-name': '对象样式 09',
    },
    classList: ['annotation', 'ostyle-annotation-label', 'synth-synth_object_009', 'id-object'],
  };
  assert.equal(styleNameForKind(item, 'paragraphStyles', null, {}), 'annotation');
  assert.equal(styleNameForKind({
    ...item,
    attributes: { ...item.attributes, 'data-id-paragraph-style-name': '标注文字' },
    classList: [...item.classList, 'pstyle-annotation'],
  }, 'paragraphStyles', null, {}), '标注文字');
  assert.equal(styleNameForKind({
    attributes: { 'data-id-style-token': 'synth_text_006', 'data-id-style-name': '文字样式 06' },
    classList: [],
  }, 'paragraphStyles', null, {}), '文字样式-06', 'a synthesized text style still names an unstyled paragraph');
});

test('a folded companion text frame carries its paragraph style onto the vector container', () => {
  const outDir = path.resolve('test/workspace/reverse-style-stability-companion');
  fs.rmSync(outDir, { recursive: true, force: true });
  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'doc',
    title: 'companion',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      labels: [],
      items: [{
        id: 'label',
        role: 'shape',
        bounds: { x: 100, y: 100, width: 120, height: 30 },
        visualStyle: { fillColor: '#ffffff', strokeColor: '#c8102e', strokeWeight: 1 },
        vectorGeometry: {
          kind: 'rectangle',
          paths: [{ closed: true, points: [[100, 100], [100, 130], [220, 130], [220, 100]].map(([x, y]) => ({ anchor: { x, y }, leftDirection: { x, y }, rightDirection: { x, y } })) }],
        },
        styleRefs: { objectStyle: 'annotation-label', objectStyleDisplayName: '标注标签' },
        structure: { parentId: 'p1', order: 1 },
      }, {
        id: 'label-text',
        role: 'text',
        bounds: { x: 108, y: 106, width: 100, height: 14 },
        content: { text: 'Public entry band', runs: [] },
        textStyle: { fontFamily: 'Arial', pointSize: 9.3333 },
        styleRefs: { paragraphStyle: 'annotation', paragraphStyleDisplayName: '标注文字' },
        structure: { parentId: 'p1', order: 2 },
      }],
    }],
  }, { outDir, mode: 'observation' });
  const html = fs.readFileSync(path.join(outDir, 'pages', '00-p1.html'), 'utf8');
  const container = html.match(/<div id="label"[^>]*>/);
  assert.ok(container, html);
  assert.match(container[0], /class="[^"]*pstyle-annotation/);
  assert.match(container[0], /data-id-paragraph-style-name="标注文字"/);
  assert.doesNotMatch(container[0], /data-id-paragraph-style="/, 'a paragraph style token would turn the shape into a text frame');
});

test('figure frames keep the author alt text across a second round trip', () => {
  const outDir = path.resolve('test/workspace/reverse-style-stability-alt');
  fs.rmSync(outDir, { recursive: true, force: true });
  const assetPath = SVG_ASSET;
  writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'doc',
    title: 'alt',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      labels: [],
      items: [{
        id: 'facade',
        role: 'graphic',
        labelStatus: 'accepted',
        bounds: { x: 10, y: 10, width: 200, height: 120 },
        structure: { parentId: 'p1', order: 1 },
        asset: { path: assetPath, kind: 'svg' },
        sourceNode: {
          tagName: 'figure',
          id: 'facade',
          classList: ['large-media'],
          attributes: { id: 'facade', class: 'large-media' },
          sourceHtml: `<img class="placed-asset-content" src="file:///${assetPath.replace(/\\/g, '/')}" alt="venue public frontage" data-id-ignore="">`,
        },
      }],
    }],
  }, { outDir, mode: 'observation' });
  const html = fs.readFileSync(path.join(outDir, 'pages', '00-p1.html'), 'utf8');
  assert.match(html, /alt="venue public frontage"/);
  assert.doesNotMatch(html, /alt="circulation"/);
});

test('reverse label check accepts style tokens the document itself defines with style labels', () => {
  const styleLabel = (token, displayName, styleKind) => ({
    protocol: 'html-indesign', version: 1, kind: 'style', id: token, source: 'html-to-indesign', styleKind, token, displayName,
  });
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'round-trip.indd', mode: 'observation' },
    document: { name: 'round-trip.indd', labels: [{ protocol: 'html-indesign', version: 1, kind: 'document', id: 'doc', profile: 'architecture-report' }] },
    styles: {
      objectStyles: [{ name: '色块-08371558', labels: [styleLabel('色块-08371558', '色块-08371558', 'objectStyles')] }],
    },
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: 800, height: 450 },
      items: [{
        id: '10',
        type: 'Rectangle',
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        objectStyleName: '色块-08371558',
        visualStyle: { fillColor: '#8da18f' },
        labels: [{
          protocol: 'html-indesign', version: 1, kind: 'item', id: 'swatch', source: 'html-to-indesign', role: 'shape', objectStyle: '色块-08371558',
        }],
      }, {
        id: '11',
        type: 'Rectangle',
        bounds: { x: 40, y: 10, width: 20, height: 20 },
        visualStyle: { fillColor: '#8da18f' },
        labels: [{
          protocol: 'html-indesign', version: 1, kind: 'item', id: 'stray', source: 'html-to-indesign', role: 'shape', objectStyle: 'not-defined-anywhere',
        }],
      }],
    }],
  }, { mode: 'observation' });
  const byId = new Map(model.pages[0].items.map((item) => [item.id, item]));
  assert.equal(byId.get('swatch').labelStatus, 'accepted');
  assert.notEqual(byId.get('stray').labelStatus, 'accepted', 'tokens the document does not define are still checked');
});

test('executor reads decimal corner radii with their unit (37.5001pt stays 37.5pt, not 37px)', () => {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.resolve(__dirname, '../../_indesign_scripts/lib/hi_styles.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(source, context);
  const toPt = (value) => Math.round(context.HI.cssLengthToMm(value) * 72 / 25.4 * 1000) / 1000;
  assert.equal(toPt('37.5001pt'), 37.5);
  assert.equal(toPt('4pt'), 4);
  assert.equal(toPt('.5pt'), 0.5);
  assert.equal(toPt('12px'), 9);
});
