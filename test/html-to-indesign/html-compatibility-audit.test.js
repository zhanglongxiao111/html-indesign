const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { auditHtmlCompatibility, renderSnapshot } = require('../../src/adapters/html');

test('auditHtmlCompatibility reports safe resource, CSS, role, and wrapper normalizations', () => {
  const snapshot = {
    pages: [{
      id: 'site-plan',
      items: [{
        id: 'ai-inferred',
        tagName: 'object',
        role: 'graphic',
        attributes: { data: './site-plan.ai' },
        authoredStyle: { objectFit: 'contain' },
        computedStyle: { objectFit: 'contain' },
        sourceNode: { tagName: 'object', attributes: { data: './site-plan.ai' } },
        sourceAncestorNodes: [],
      }, {
        id: 'ai-conflict',
        tagName: 'object',
        role: 'graphic',
        attributes: { data: './diagram.ai', 'data-id-asset-kind': 'pdf' },
        computedStyle: { objectFit: 'fill' },
        sourceNode: { tagName: 'object', attributes: { data: './diagram.ai', 'data-id-asset-kind': 'pdf' } },
        sourceAncestorNodes: [],
      }, {
        id: 'plain-copy',
        tagName: 'div',
        role: 'text',
        attributes: {},
        computedStyle: {},
        sourceNode: { tagName: 'div', attributes: {} },
        sourceAncestorNodes: [],
      }, {
        id: 'hero-frame',
        tagName: 'img',
        role: 'graphic',
        attributes: { src: './hero.png', 'data-id-frame-style': 'hero-frame' },
        computedStyle: { objectFit: 'cover' },
        sourceNode: { tagName: 'img', attributes: { src: './hero.png' } },
        sourceAncestorNodes: [{
          tagName: 'figure',
          id: 'hero-frame',
          attributes: { 'data-id-frame-style': 'hero-frame' },
        }],
      }],
    }],
  };

  const report = auditHtmlCompatibility(snapshot);
  const byCode = new Map(report.messages.map((message) => [message.code, message]));

  for (const code of [
    'HTML_ASSET_KIND_INFERRED',
    'HTML_ASSET_KIND_CANONICALIZED',
    'HTML_FIT_INFERRED_FROM_CSS',
    'HTML_ROLE_INFERRED',
    'HTML_SINGLE_ASSET_WRAPPER_NORMALIZED',
  ]) {
    const message = byCode.get(code);
    assert.ok(message, `missing ${code}`);
    assert.equal(message.action, 'normalized');
    assert.ok(message.suggestedFix);
    assert.ok(message.ruleRef);
  }
  assert.equal(report.summary.normalized, report.messages.length);
  assert.equal(report.summary.blocked, 0);
  assert.equal(report.summary.warnings, report.messages.length);
});

test('auditHtmlCompatibility blocks common visible HTML constructs that cannot be translated safely', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/unsupported-deck.html');
  const report = auditHtmlCompatibility(await renderSnapshot({ htmlPath }));
  const byCode = new Map(report.messages.map((message) => [message.code, message]));

  for (const code of [
    'HTML_INLINE_SVG_UNSUPPORTED',
    'HTML_PSEUDO_ELEMENT_UNSUPPORTED',
    'HTML_CLIP_PATH_UNSUPPORTED',
    'HTML_CSS_EFFECT_UNSUPPORTED',
    'HTML_GRADIENT_UNSUPPORTED',
    'HTML_CSS_BORDER_SHAPE_UNSUPPORTED',
  ]) {
    const message = byCode.get(code);
    assert.ok(message, `missing ${code}`);
    assert.equal(message.level, 'error');
    assert.equal(message.action, 'blocked');
    assert.ok(message.pageId);
    assert.ok(message.itemId);
    assert.ok(message.suggestedFix);
    assert.ok(message.ruleRef);
  }
  assert.equal(report.summary.blocked >= 6, true);
  const invalidGeometry = report.messages.find((message) => (
    message.code === 'HTML_INLINE_SVG_UNSUPPORTED'
      && message.itemId === 'invalid-svg'
      && message.unsupportedElements.some((entry) => entry.reason === 'invalid-geometry')
  ));
  assert.ok(invalidGeometry, 'invalid SVG geometry must be blocked before compilation');
});

test('auditHtmlCompatibility reports supported inline SVG primitives as native normalization', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/svg-primitives-deck.html');
  const report = auditHtmlCompatibility(await renderSnapshot({ htmlPath }));
  const svgMessages = report.messages.filter((message) => message.code === 'HTML_INLINE_SVG_NORMALIZED');

  assert.equal(svgMessages.length, 9);
  assert.equal(svgMessages.every((message) => message.action === 'normalized'), true);
  assert.equal(report.messages.some((message) => message.code === 'HTML_INLINE_SVG_UNSUPPORTED'), false);
  assert.equal(report.summary.blocked, 0);
});

test('materialized pseudo content surfaces as a normalized compatibility message', () => {
  const { auditHtmlCompatibility } = require('../../src/adapters/html');
  const audit = auditHtmlCompatibility({
    pages: [{
      id: 'page-1',
      pseudoMaterialized: [{ pseudo: 'before', text: '01', hostTag: 'div', hostId: 'gov-1' }],
      items: [],
    }],
  });
  const entry = audit.messages.find((message) => message.code === 'HTML_PSEUDO_CONTENT_MATERIALIZED');
  assert.ok(entry);
  assert.equal(entry.action, 'normalized');
  assert.equal(entry.level, 'warning');
  assert.equal(entry.pageId, 'page-1');
  assert.equal(entry.itemId, 'gov-1');
  assert.equal(audit.summary.normalized, 1);
  assert.equal(audit.summary.blocked, 0);
});

test('auditHtmlCompatibility treats identity SVG transforms as untransformed and still blocks real transforms', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/svg-transform-deck.html');
  const report = auditHtmlCompatibility(await renderSnapshot({ htmlPath }));
  const blockedIds = new Set(report.messages
    .filter((message) => message.code === 'HTML_INLINE_SVG_UNSUPPORTED')
    .map((message) => message.itemId));
  const normalizedIds = new Set(report.messages
    .filter((message) => message.code === 'HTML_INLINE_SVG_NORMALIZED')
    .map((message) => message.itemId));

  for (const id of ['plain-line', 'identity-rotate-line', 'identity-matrix-line', 'identity-attr-line', 'identity-individual-line']) {
    assert.equal(blockedIds.has(id), false, `${id} must not be blocked`);
    assert.equal(normalizedIds.has(id), true, `${id} must compile to native vectors`);
  }
  for (const id of ['rotated-line', 'rotate-property-line', 'rotated-attr-line']) {
    const message = report.messages.find((entry) => entry.code === 'HTML_INLINE_SVG_UNSUPPORTED' && entry.itemId === id);
    assert.ok(message, `${id} must stay blocked`);
    assert.equal(message.unsupportedElements.some((entry) => entry.reason === 'unsupported-transform'), true);
  }
});

test('identity SVG transforms compile to the same native vector geometry as untransformed SVG', async () => {
  const { snapshotToSemanticModel } = require('../../src/adapters/html');
  const { semanticModelToInstructions } = require('../../src/writers/indesign');
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/svg-transform-deck.html');
  const model = snapshotToSemanticModel(await renderSnapshot({ htmlPath }), { unitMode: 'presentation', targetSize: 'same' });
  const items = new Map(model.pages[0].items.map((item) => [item.id, item]));
  const instructionItems = new Map(semanticModelToInstructions(model, {}).pages[0].items.map((item) => [item.id, item]));
  const relativeAnchors = (item) => item.vectorGeometry.paths[0].points.map((point) => ({
    x: Math.round((point.anchor.x - item.bounds.x) * 100) / 100,
    y: Math.round((point.anchor.y - item.bounds.y) * 100) / 100,
  }));

  const plain = items.get('plain-line');
  for (const id of ['identity-rotate-line', 'identity-matrix-line', 'identity-attr-line', 'identity-individual-line']) {
    const item = items.get(id);
    assert.equal(item.bounds.width, plain.bounds.width, `${id} width`);
    assert.equal(item.bounds.height, plain.bounds.height, `${id} height`);
    assert.deepEqual(relativeAnchors(item), relativeAnchors(plain), `${id} anchors`);
    assert.equal(Number(instructionItems.get(id).rotationAngle || 0), 0, `${id} rotation`);
  }
});
