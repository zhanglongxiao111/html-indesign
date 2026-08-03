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
});

test('auditHtmlCompatibility reports supported inline SVG primitives as native normalization', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/svg-primitives-deck.html');
  const report = auditHtmlCompatibility(await renderSnapshot({ htmlPath }));
  const svgMessages = report.messages.filter((message) => message.code === 'HTML_INLINE_SVG_NORMALIZED');

  assert.equal(svgMessages.length, 8);
  assert.equal(svgMessages.every((message) => message.action === 'normalized'), true);
  assert.equal(report.messages.some((message) => message.code === 'HTML_INLINE_SVG_UNSUPPORTED'), false);
  assert.equal(report.summary.blocked, 0);
});
