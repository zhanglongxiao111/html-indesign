const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDocumentObjectGraph,
} = require('../../src/semantic-reconstruction');

test('buildDocumentObjectGraph creates normalized nodes and records InDesign layer only as observed fact', () => {
  assert.equal(typeof buildDocumentObjectGraph, 'function');

  const pass = buildDocumentObjectGraph({
    kind: 'DocumentModel',
    id: 'observed-deck',
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 500,
        items: [
          {
            id: 'text-1',
            role: 'text',
            semantic: null,
            layerName: '标题',
            bounds: { x: 100, y: 100, width: 300, height: 40 },
            zIndex: 4,
            content: { text: '普通文字' },
          },
        ],
      },
    ],
  });

  assert.equal(pass.name, 'page-object-graph');
  assert.deepEqual(pass.ignoredSignals, ['indesignLayerName', 'indesignLayerIndex']);
  assert.equal(pass.summary.pages, 1);
  assert.equal(pass.summary.nodes, 1);
  assert.equal(pass.summary.unresolvedNodes, 0);

  const node = pass.pages[0].nodes[0];
  assert.equal(node.id, 'text-1');
  assert.equal(node.sourceType, 'text');
  assert.deepEqual(node.normalizedBounds, { x: 0.1, y: 0.2, width: 0.3, height: 0.08 });
  assert.equal(node.zOrder, 4);
  assert.equal(node.textFacts.length, 4);
  assert.equal(node.textFacts.firstLine, '普通文字');
  assert.equal(node.observedFacts.indesignLayerName, '标题');
  assert.equal(Object.hasOwn(node, 'semantic'), false);
  assert.equal(Object.hasOwn(node, 'semanticCandidate'), false);
  assert.equal(pass.pages[0].edges.length, 0);
});

test('buildDocumentObjectGraph reports objects missing bounds as unresolved nodes', () => {
  assert.equal(typeof buildDocumentObjectGraph, 'function');

  const pass = buildDocumentObjectGraph({
    kind: 'DocumentModel',
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 500,
        items: [
          {
            id: 'text-without-bounds',
            role: 'text',
            content: { text: '缺少坐标' },
          },
        ],
      },
    ],
  });

  assert.equal(pass.summary.nodes, 0);
  assert.equal(pass.summary.unresolvedNodes, 1);
  assert.deepEqual(pass.pages[0].unresolvedNodes, [
    {
      itemId: 'text-without-bounds',
      reason: 'bounds-missing',
    },
  ]);
});

test('buildDocumentObjectGraph creates geometric evidence edges without mutating semantics', () => {
  assert.equal(typeof buildDocumentObjectGraph, 'function');

  const model = {
    kind: 'DocumentModel',
    pages: [
      {
        id: 'page-1',
        width: 1000,
        height: 1000,
        items: [
          shape('background', 80, 80, 300, 230, 0, { fill: '#f4f4f4' }),
          graphic('main-image', 100, 100, 120, 90, 1),
          text('caption', 100, 198, 120, 20, 2, '效果图'),
          shape('overlap-mark', 110, 110, 80, 80, 3, { fill: '#ff0000' }),
          shape('card-1', 500, 100, 100, 60, 1, { fill: '#ffffff' }),
          shape('card-2', 500, 185, 100, 60, 1, { fill: '#ffffff' }),
          shape('card-3', 500, 270, 100, 60, 1, { fill: '#ffffff' }),
        ],
      },
    ],
  };

  const pass = buildDocumentObjectGraph(model);
  const edges = pass.pages[0].edges;

  assert.equal(model.pages[0].items[2].semantic, null);
  assertEdge(edges, 'containment', 'background', 'main-image');
  assertEdge(edges, 'alignment', 'main-image', 'caption');
  assertEdge(edges, 'caption-candidate', 'main-image', 'caption');
  assertEdge(edges, 'overlap', 'main-image', 'overlap-mark');
  assertEdge(edges, 'sequence', 'card-1', 'card-2');
  assertEdge(edges, 'sequence', 'card-2', 'card-3');
  assert.equal(edges.some((edge) => edge.evidence && edge.evidence.signal === 'indesignLayerName'), false);
});

function text(id, x, y, width, height, zIndex, content) {
  return {
    id,
    role: 'text',
    semantic: null,
    bounds: { x, y, width, height },
    zIndex,
    content: { text: content },
  };
}

function graphic(id, x, y, width, height, zIndex) {
  return {
    id,
    role: 'graphic',
    semantic: null,
    bounds: { x, y, width, height },
    zIndex,
    asset: { kind: 'image', path: `assets/${id}.png` },
  };
}

function shape(id, x, y, width, height, zIndex, visualStyle = {}) {
  return {
    id,
    role: 'shape',
    semantic: null,
    bounds: { x, y, width, height },
    zIndex,
    visualStyle,
  };
}

function assertEdge(edges, type, from, to) {
  const edge = edges.find((candidate) => (
    candidate.type === type
    && candidate.from === from
    && candidate.to === to
  ));
  assert.ok(edge, `Expected ${type} edge from ${from} to ${to}`);
  assert.equal(typeof edge.score, 'number');
  assert.ok(edge.score > 0);
}
