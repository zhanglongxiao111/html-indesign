const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditAuthoringSemanticTokens } = require('../../src/semantic-preset/audit-authoring');

function pageFile(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-audit-authoring-'));
  const filePath = path.join(dir, 'pages', '01-page.html');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, relativePath: 'pages/01-page.html' };
}

test('SEMANTIC_TOKEN_UNKNOWN lists the registered tokens of that kind when there are few', () => {
  const preset = { styleNameMap: { paragraphStyles: { 'body-copy': '正文', 'table-body': '表格正文', 'page-title': '页面标题' } } };
  const result = auditAuthoringSemanticTokens({
    preset,
    pageFiles: [pageFile('<section class="page"><p data-id-paragraph-style="body-text">x</p></section>')],
    strict: true,
  });

  assert.equal(result.valid, false);
  const issue = result.errors[0];
  assert.equal(issue.code, 'SEMANTIC_TOKEN_UNKNOWN');
  assert.equal(issue.token, 'body-text');
  assert.equal(issue.message, 'Unknown semantic token "body-text" in data-id-paragraph-style. Known paragraphStyles: body-copy, page-title, table-body.');
  assert.deepEqual(issue.knownTokens, ['body-copy', 'page-title', 'table-body']);
});

test('SEMANTIC_TOKEN_UNKNOWN suggests the closest tokens when many are registered', () => {
  const names = {};
  for (let index = 0; index < 30; index += 1) names[`style-${String(index).padStart(2, '0')}`] = `样式${index}`;
  names['body-copy'] = '正文';
  const result = auditAuthoringSemanticTokens({
    preset: { styleNameMap: { paragraphStyles: names } },
    pageFiles: [pageFile('<section class="page"><p data-id-paragraph-style="body-text">x</p></section>')],
    strict: true,
  });

  const issue = result.errors[0];
  assert.match(issue.message, /^Unknown semantic token "body-text" in data-id-paragraph-style\. 31 paragraphStyles tokens are registered; closest: body-copy, /);
  assert.equal(issue.knownTokens.length, 5);
  assert.equal(issue.knownTokens[0], 'body-copy');
});

test('SEMANTIC_TOKEN_UNKNOWN says so when nothing of that kind is registered', () => {
  const result = auditAuthoringSemanticTokens({
    preset: {},
    pageFiles: [pageFile('<section class="page"><div data-id-layer="decor">x</div></section>')],
    strict: true,
  });

  const issue = result.errors.find((entry) => entry.token === 'decor');
  assert.ok(issue);
  assert.equal(issue.message, 'Unknown semantic token "decor" in data-id-layer. No layers tokens are registered in the semantic preset; add it to the preset before using it.');
  assert.deepEqual(issue.knownTokens, []);
});
