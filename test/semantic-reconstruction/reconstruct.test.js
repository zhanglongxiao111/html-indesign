const test = require('node:test');
const assert = require('node:assert/strict');

const { reconstructSemanticModel } = require('../../src/semantic-reconstruction');
const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');

test('reconstructSemanticModel creates an explicit pass-through report without inventing semantics', () => {
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    profile: 'architecture-report',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        semantic: null,
        width: 1920,
        height: 1080,
        items: [
          {
            id: 'text-1',
            role: 'text',
            semantic: 'unknown',
            bounds: { x: 100, y: 120, width: 400, height: 48 },
            content: { text: 'Observed title' },
          },
        ],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, { mode: 'observation' });

  assert.notEqual(result.model, observedModel);
  assert.equal(result.model.pages[0].items[0].semantic, 'unknown');
  assert.equal(result.report.kind, 'SemanticReconstructionReport');
  assert.equal(result.report.status, 'observed-only');
  assert.equal(result.report.summary.pages, 1);
  assert.equal(result.report.summary.items, 1);
  assert.equal(result.report.summary.reconstructedItems, 0);
  assert.equal(result.report.summary.unresolvedItems, 1);
  assert.deepEqual(result.report.algorithms, []);
  assert.equal(result.report.unresolved[0].path, 'pages[0].items[0]');
  assert.equal(result.report.unresolved[0].reason, 'semantic-unknown');
});

test('reconstructSemanticModel fails visibly for invalid model input', () => {
  assert.throws(
    () => reconstructSemanticModel({ kind: 'NotDocumentModel' }),
    /requires a DocumentModel/,
  );
});

test('reconstructSemanticModel can run page object graph without mutating semantic fields', () => {
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 500,
        items: [
          {
            id: 'text-1',
            role: 'text',
            semantic: 'unknown',
            bounds: { x: 100, y: 100, width: 300, height: 40 },
            content: { text: '普通文字' },
          },
        ],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, {
    mode: 'observation',
    algorithms: ['page-object-graph'],
  });

  assert.notEqual(result.model, observedModel);
  assert.equal(result.model.pages[0].items[0].semantic, 'unknown');
  assert.deepEqual(result.report.algorithms, ['page-object-graph']);
  assert.equal(result.report.passes.length, 1);
  assert.equal(result.report.passes[0].name, 'page-object-graph');
  assert.equal(result.report.summary.reconstructedItems, 0);
});

test('reconstructSemanticModel can apply high-confidence caption structure to author HTML', () => {
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 1000,
        items: [
          {
            id: 'image-1',
            role: 'graphic',
            semantic: 'unknown',
            bounds: { x: 100, y: 100, width: 300, height: 180 },
            zIndex: 1,
            asset: { kind: 'image', path: 'assets/image-1.png' },
            structure: { parentId: 'page-1', order: 1 },
          },
          {
            id: 'caption-1',
            role: 'text',
            semantic: 'unknown',
            bounds: { x: 100, y: 285, width: 300, height: 24 },
            zIndex: 2,
            content: { text: '总平面效果图' },
            structure: { parentId: 'page-1', order: 2 },
          },
          {
            id: 'body-1',
            role: 'text',
            semantic: 'unknown',
            bounds: { x: 100, y: 500, width: 300, height: 80 },
            zIndex: 3,
            content: { text: '这段文字距离图片较远，不应被合并。' },
            structure: { parentId: 'page-1', order: 3 },
          },
        ],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, {
    mode: 'observation',
    algorithms: ['caption-structure'],
  });

  const image = result.model.pages[0].items.find((item) => item.id === 'image-1');
  const caption = result.model.pages[0].items.find((item) => item.id === 'caption-1');
  const body = result.model.pages[0].items.find((item) => item.id === 'body-1');

  assert.equal(observedModel.pages[0].items[1].tagName, undefined);
  assert.equal(caption.tagName, 'figcaption');
  assert.deepEqual(caption.structure, { parentId: 'image-1', order: 1 });
  assert.equal(image.tagName, 'figure');
  assert.equal(body.tagName, undefined);
  assert.equal(body.structure.parentId, 'page-1');
  assert.deepEqual(result.report.algorithms, ['caption-structure']);
  assert.equal(result.report.passes.length, 1);
  assert.equal(result.report.passes[0].name, 'caption-structure');
  assert.equal(result.report.passes[0].summary.applied, 1);
  assert.equal(result.report.summary.reconstructedItems, 1);

  const html = pageItemsToAuthorHtml(result.model.pages[0], { mode: 'authoring' });
  assert.match(html, /<figure[^>]+id="image-1"[\s\S]*<figcaption[^>]+id="caption-1"[\s\S]*总平面效果图[\s\S]*<\/figcaption>[\s\S]*<\/figure>/);
  assert.doesNotMatch(html, /<figure[^>]+id="image-1"[\s\S]*body-1[\s\S]*<\/figure>/);
});

test('reconstructSemanticModel does not apply low-confidence caption candidates to author HTML', () => {
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 1000,
        items: [
          {
            id: 'drawing-1',
            role: 'graphic',
            semantic: 'unknown',
            bounds: { x: 100, y: 100, width: 300, height: 180 },
            asset: { kind: 'pdf', path: 'assets/drawing.pdf' },
            structure: { parentId: 'page-1', order: 1 },
          },
          {
            id: 'annotation-1',
            role: 'text',
            semantic: 'unknown',
            bounds: { x: 100, y: 305, width: 300, height: 24 },
            content: { text: '往3F会议' },
            structure: { parentId: 'page-1', order: 2 },
          },
        ],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, {
    mode: 'observation',
    algorithms: ['caption-structure'],
  });
  const annotation = result.model.pages[0].items.find((item) => item.id === 'annotation-1');
  const pass = result.report.passes[0];

  assert.equal(annotation.tagName, undefined);
  assert.equal(annotation.structure.parentId, 'page-1');
  assert.equal(pass.summary.applied, 0);
  assert.equal(pass.summary.skipped, 1);
  assert.equal(pass.skipped[0].reason, 'score-too-low');
  assert.equal(result.report.summary.reconstructedItems, 0);
});

test('reconstructSemanticModel can group captioned figures into an editable figure grid', () => {
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 1000,
        items: [
          graphic('image-1', 100, 100, 180, 100, 1),
          caption('caption-1', 100, 204, '材料一', 2),
          graphic('image-2', 320, 100, 180, 100, 3),
          caption('caption-2', 320, 204, '材料二', 4),
          graphic('image-3', 100, 260, 180, 100, 5),
          caption('caption-3', 100, 364, '材料三', 6),
          graphic('image-4', 320, 260, 180, 100, 7),
          caption('caption-4', 320, 364, '材料四', 8),
          {
            id: 'body-1',
            role: 'text',
            semantic: 'unknown',
            bounds: { x: 650, y: 120, width: 220, height: 100 },
            content: { text: '旁边正文不应该进入图片矩阵。' },
            structure: { parentId: 'page-1', order: 9 },
          },
        ],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, {
    mode: 'observation',
    algorithms: ['caption-structure', 'figure-grid'],
  });
  const page = result.model.pages[0];
  const grid = page.items.find((item) => item.id === 'page-1-figure-grid-1');
  const body = page.items.find((item) => item.id === 'body-1');
  const figureGridPass = result.report.passes.find((pass) => pass.name === 'figure-grid');

  assert.ok(grid);
  assert.equal(grid.virtual, true);
  assert.equal(grid.sourceNode.tagName, 'section');
  assert.deepEqual(grid.sourceNode.classList, ['figure-grid']);
  assert.equal(grid.bounds, undefined);
  assert.equal(figureGridPass.summary.groups, 1);
  assert.equal(figureGridPass.summary.groupedFigures, 4);
  assert.equal(figureGridPass.applied[0].figureIds.length, 4);
  assert.deepEqual(figureGridPass.applied[0].bounds, { x: 100, y: 100, width: 400, height: 288 });
  assert.deepEqual(
    ['image-1', 'image-2', 'image-3', 'image-4'].map((id) => page.items.find((item) => item.id === id).structure.parentId),
    ['page-1-figure-grid-1', 'page-1-figure-grid-1', 'page-1-figure-grid-1', 'page-1-figure-grid-1'],
  );
  assert.equal(body.structure.parentId, 'page-1');

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });
  assert.match(html, /<section[^>]+id="page-1-figure-grid-1"[^>]+class="figure-grid"[\s\S]*<figure[^>]+id="image-1"[\s\S]*<figcaption[^>]+id="caption-1"[\s\S]*材料一[\s\S]*<\/figcaption>[\s\S]*<\/figure>[\s\S]*<\/section>/);
  assert.doesNotMatch(html, /<section[^>]+id="page-1-figure-grid-1"[\s\S]*body-1[\s\S]*<\/section>/);
});

test('reconstructSemanticModel can group adjacent same-style text frames into an editable text block', () => {
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 1000,
        items: [
          textFrame('copy-1', 80, 120, 280, 80, '正文第一段', 1),
          textFrame('copy-2', 80, 216, 280, 100, '正文第二段', 2),
          textFrame('side-note', 620, 120, 220, 80, '旁边注释不应进入正文块。', 3),
        ],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, {
    mode: 'observation',
    algorithms: ['text-block'],
  });
  const page = result.model.pages[0];
  const block = page.items.find((item) => item.id === 'page-1-text-block-1');
  const pass = result.report.passes.find((entry) => entry.name === 'text-block');

  assert.ok(block);
  assert.equal(block.virtual, true);
  assert.equal(block.sourceNode.tagName, 'section');
  assert.deepEqual(block.sourceNode.classList, ['text-block']);
  assert.equal(block.bounds, undefined);
  assert.equal(pass.summary.groups, 1);
  assert.equal(pass.summary.groupedTextFrames, 2);
  assert.deepEqual(pass.applied[0].textIds, ['copy-1', 'copy-2']);
  assert.deepEqual(pass.applied[0].bounds, { x: 80, y: 120, width: 280, height: 196 });
  assert.deepEqual(
    ['copy-1', 'copy-2'].map((id) => page.items.find((item) => item.id === id).structure.parentId),
    ['page-1-text-block-1', 'page-1-text-block-1'],
  );
  assert.equal(page.items.find((item) => item.id === 'side-note').structure.parentId, 'page-1');

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });
  assert.match(html, /<section[^>]+id="page-1-text-block-1"[^>]+class="text-block"[\s\S]*<p[^>]+id="copy-1"[\s\S]*正文第一段[\s\S]*<p[^>]+id="copy-2"[\s\S]*正文第二段[\s\S]*<\/section>/);
  assert.doesNotMatch(html, /<section[^>]+id="page-1-text-block-1"[\s\S]*side-note[\s\S]*<\/section>/);
});

test('reconstructSemanticModel keeps text block source order when observed items have no explicit structure order', () => {
  const intro = textFrame('intro', 80, 40, 280, 48, '前置说明', undefined);
  const copy1 = textFrame('copy-1', 80, 140, 280, 72, '正文第一段', undefined);
  const copy2 = textFrame('copy-2', 80, 224, 280, 72, '正文第二段', undefined);
  const sideNote = textFrame('side-note', 620, 140, 220, 80, '旁边注释', undefined);
  const observedModel = {
    kind: 'DocumentModel',
    id: 'observed-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 1000,
        items: [copy2, copy1, intro, sideNote],
      },
    ],
    assets: [],
  };

  const result = reconstructSemanticModel(observedModel, {
    mode: 'observation',
    algorithms: ['text-block'],
  });

  const html = pageItemsToAuthorHtml(result.model.pages[0], { mode: 'authoring' });
  assert.ok(html.indexOf('id="intro"') < html.indexOf('id="page-1-text-block-1"'));
  assert.ok(html.indexOf('id="page-1-text-block-1"') < html.indexOf('id="side-note"'));
});

test('reconstructSemanticModel fails visibly for unknown algorithms', () => {
  assert.throws(
    () => reconstructSemanticModel({
      kind: 'DocumentModel',
      pages: [],
    }, { algorithms: ['unknown-algorithm'] }),
    /Unknown semantic reconstruction algorithm: unknown-algorithm/,
  );
});

function graphic(id, x, y, width, height, order) {
  return {
    id,
    role: 'graphic',
    semantic: 'unknown',
    bounds: { x, y, width, height },
    zIndex: order,
    asset: { kind: 'image', path: `assets/${id}.png` },
    structure: { parentId: 'page-1', order },
  };
}

function caption(id, x, y, text, order) {
  return {
    id,
    role: 'text',
    semantic: 'unknown',
    bounds: { x, y, width: 180, height: 24 },
    zIndex: order,
    content: { text },
    structure: { parentId: 'page-1', order },
  };
}

function textFrame(id, x, y, width, height, text, order) {
  return {
    id,
    role: 'text',
    semantic: 'unknown',
    bounds: { x, y, width, height },
    zIndex: order,
    styleRefs: { paragraphStyle: '正文' },
    textStyle: { pointSize: 18, leading: 26, fontFamily: 'Microsoft YaHei', fillColor: '#333333', justification: 'left' },
    content: { text },
    structure: { parentId: 'page-1', order },
  };
}
