const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, auditHtmlCompatibility } = require('../../src/adapters/html');
const { validateAuthoringRules } = require('../../src/adapters/html/validators/authoring-validator');

test('0819 friction patterns pass strict lint with normalizations reported', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/friction-0819-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const page = snapshot.pages[0];

  // A1：裸 span 徽标成为文本 item，而不是 uncapturedText
  assert.deepEqual(page.uncapturedText, []);
  const badge = page.items.find((item) => item.id === 'badge');
  assert.ok(badge);
  assert.equal(badge.role, 'text');

  // A2：伪元素编号被物化并并入宿主文本
  assert.equal(page.pseudoMaterialized.length, 1);
  const gov = page.items.find((item) => item.id === 'gov-1');
  assert.ok(gov);
  assert.match(gov.text, /01/);
  assert.equal(gov.unsupported.beforeContent, '');

  // A1+A2+A3 合并结果：严格模式 0 error
  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });
  assert.deepEqual(result.errors, []);

  // 归一化消息可见：角色推断 + 伪元素物化
  const compatibility = auditHtmlCompatibility(snapshot);
  const codes = compatibility.messages.map((entry) => entry.code);
  assert.equal(codes.includes('HTML_ROLE_INFERRED'), true);
  assert.equal(codes.includes('HTML_PSEUDO_CONTENT_MATERIALIZED'), true);
  assert.equal(compatibility.summary.blocked, 0);
});
