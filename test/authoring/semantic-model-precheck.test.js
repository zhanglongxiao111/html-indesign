// #25：同页重复 id 此前 lint 放行、build 的 compile 阶段（snapshotToSemanticModel → validateSemanticModel）
// 才抛 ITEM_ID_DUPLICATED。lint 现在跑同一个语义模型转换，判重口径必须与 compile 完全一致：
// 同页重复报 error，跨页同名不报（compile 也放行），无重复不误报。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { renderSnapshot, snapshotToSemanticModel } = require('../../src/adapters/html');
const { lintAuthoringPackage, writeAuthorPackageEntry } = require('../../src/authoring');
const { auditSemanticModelPrecheck } = require('../../src/authoring/semantic-model-precheck');
const { callPlugin, repoRoot } = require('../indesign-cli-plugin/plugin-test-helper');

const ARCH_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'e2e', 'architecture-report');

function snapshotItem(id, tagName, sourcePath) {
  return {
    id,
    role: 'text',
    tagName,
    classList: ['note'],
    attributes: { id },
    sourceNode: { tagName, id, classList: ['note'], attributes: { id }, sourcePath },
    rectPx: { x: 0, y: 0, width: 10, height: 10 },
    boundsMm: { x: 0, y: 0, width: 10, height: 10 },
    computedStyle: {},
    authoredStyle: {},
    text: 'x',
    runs: [],
  };
}

function snapshotPage(id, index, sourceFile, items, extraAttributes = {}) {
  return {
    id,
    index,
    widthMm: 100,
    heightMm: 80,
    rectPx: { x: 0, y: 0, width: 100, height: 80 },
    attributes: { 'data-page': id, 'data-id-source-file': sourceFile, ...extraAttributes },
    computedStyle: {},
    items,
  };
}

function snapshotOf(pages) {
  return { metadata: { source: 'inline.html' }, pages, assets: [] };
}

function compileModelError(snapshot) {
  try {
    snapshotToSemanticModel(snapshot, { unitMode: 'presentation', targetSize: 'same' });
    return null;
  } catch (error) {
    return error;
  }
}

test('同页重复 id：报一条 ITEM_ID_DUPLICATED，列出全部出现位置和不撞名的改名建议', () => {
  const snapshot = snapshotOf([
    snapshotPage('agenda', 0, 'pages/01-agenda.html', [
      snapshotItem('title', 'p', 'p:nth-of-type(1)'),
      snapshotItem('title', 'h2', 'h2:nth-of-type(1)'),
      snapshotItem('title-2', 'p', 'p:nth-of-type(2)'),
    ]),
  ]);

  // 口径锚点：compile 端对同一快照确实拒绝。
  const compileError = compileModelError(snapshot);
  assert.equal(compileError && compileError.code, 'SEMANTIC_MODEL_VALIDATION_FAILED');
  assert.deepEqual(compileError.validation.errors.map((issue) => issue.code), ['ITEM_ID_DUPLICATED']);

  const result = auditSemanticModelPrecheck(snapshot);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  const [entry] = result.errors;
  assert.equal(entry.level, 'error');
  assert.equal(entry.code, 'ITEM_ID_DUPLICATED');
  assert.equal(entry.stage, 'semantic-model');
  assert.equal(entry.pageId, 'agenda');
  assert.equal(entry.itemId, 'title');
  assert.equal(entry.duplicateId, 'title');
  assert.equal(entry.sourceFile, 'pages/01-agenda.html');
  assert.deepEqual(entry.occurrences.map((occurrence) => [occurrence.tagName, occurrence.sourceFile, occurrence.sourcePath]), [
    ['p', 'pages/01-agenda.html', 'p:nth-of-type(1)'],
    ['h2', 'pages/01-agenda.html', 'h2:nth-of-type(1)'],
  ]);
  assert.match(entry.message, /Page agenda has 2 objects with id "title"/);
  // title-2 已被同页占用，建议名必须跳过它。
  assert.match(entry.suggestedFix, /<h2> at pages\/01-agenda\.html h2:nth-of-type\(1\) -> id="title-3"/);
  assert.doesNotMatch(entry.suggestedFix, /id="title-2"/);
});

test('三处同名只报一条，改名建议覆盖除第一处外的全部', () => {
  const result = auditSemanticModelPrecheck(snapshotOf([
    snapshotPage('p1', 0, 'pages/a.html', [
      snapshotItem('dup', 'p', 'p:nth-of-type(1)'),
      snapshotItem('dup', 'p', 'p:nth-of-type(2)'),
      snapshotItem('dup', 'h3', 'h3:nth-of-type(1)'),
    ]),
  ]));
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].occurrences.length, 3);
  assert.match(result.errors[0].suggestedFix, /p:nth-of-type\(2\) -> id="dup-2"; <h3> .* -> id="dup-3"/);
});

test('跨页同名 id：compile 放行，lint 也不报', () => {
  const snapshot = snapshotOf([
    snapshotPage('p1', 0, 'pages/a.html', [snapshotItem('shared', 'p', 'p:nth-of-type(1)')]),
    snapshotPage('p2', 1, 'pages/b.html', [snapshotItem('shared', 'p', 'p:nth-of-type(1)')]),
  ]);
  assert.equal(compileModelError(snapshot), null);
  assert.deepEqual(auditSemanticModelPrecheck(snapshot), { valid: true, errors: [] });
});

test('无重复不误报', () => {
  const result = auditSemanticModelPrecheck(snapshotOf([
    snapshotPage('p1', 0, 'pages/a.html', [
      snapshotItem('a', 'p', 'p:nth-of-type(1)'),
      snapshotItem('b', 'h2', 'h2:nth-of-type(1)'),
    ]),
  ]));
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('转换中途抛出的带码错误（非法 data-id-guides）同样报成 lint error；兼容性 blocked 时注明可能是连带后果', () => {
  const snapshot = snapshotOf([
    snapshotPage('p1', 0, 'pages/a.html', [snapshotItem('a', 'p', 'p:nth-of-type(1)')], { 'data-id-guides': 'not json' }),
  ]);
  assert.equal(compileModelError(snapshot).code, 'PAGE_GUIDES_ATTR_INVALID');

  const plain = auditSemanticModelPrecheck(snapshot);
  assert.equal(plain.valid, false);
  assert.equal(plain.errors.length, 1);
  assert.equal(plain.errors[0].code, 'PAGE_GUIDES_ATTR_INVALID');
  assert.equal(plain.errors[0].stage, 'semantic-model');
  assert.equal('hint' in plain.errors[0], false);

  const blocked = auditSemanticModelPrecheck(snapshot, { compatibilityBlocked: true });
  assert.match(blocked.errors[0].hint, /side effect of the blocked content/);
});

test('没有错误码的异常是转换器缺陷，原样抛出，不包装成作者错误', () => {
  assert.throws(() => auditSemanticModelPrecheck(null), TypeError);
});

function copyArchitecturePackage(name, edits) {
  const target = path.join(repoRoot, 'test', 'workspace', name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(ARCH_FIXTURE, target, { recursive: true });
  for (const [file, from, to] of edits) {
    const pagePath = path.join(target, 'pages', file);
    const html = fs.readFileSync(pagePath, 'utf8');
    const edited = html.replace(from, to);
    if (edited === html) throw new Error(`edit point not found in ${pagePath}`);
    fs.writeFileSync(pagePath, edited, 'utf8');
  }
  writeAuthorPackageEntry(path.join(target, 'deck.config.json'));
  return target;
}

test('issue #25 复现：作者包同页重复 id，lint（含 strict）报错，build 停在 lint 阶段而不是 compile', async () => {
  const packageDir = copyArchitecturePackage('semantic-model-precheck-dup-id', [
    ['01-agenda.html', 'id="agenda-eyebrow"', 'id="agenda-title"'],
  ]);
  const packagePath = path.join(packageDir, 'deck.config.json');

  for (const strict of [false, true]) {
    const result = await lintAuthoringPackage({ packagePath, strict });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map((entry) => entry.code), ['ITEM_ID_DUPLICATED']);
    const [entry] = result.errors;
    assert.equal(entry.pageId, 'agenda-page');
    assert.equal(entry.itemId, 'agenda-title');
    assert.equal(entry.sourceFile, 'pages/01-agenda.html');
    assert.deepEqual(entry.occurrences.map((occurrence) => occurrence.tagName), ['p', 'h2']);
  }

  // 插件摘要：topCodes / firstErrors 自动带上新码与定位、改名建议。
  const lintResponse = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: { package: packagePath, strict: true },
  });
  assert.equal(lintResponse.status, 'error');
  assert.equal(lintResponse.error.code, 'AUTHORING_LINT_FAILED');
  assert.deepEqual(lintResponse.error.details.topCodes[0], { code: 'ITEM_ID_DUPLICATED', level: 'error', count: 1 });
  const first = lintResponse.error.details.firstErrors[0];
  assert.equal(first.pageId, 'agenda-page');
  assert.equal(first.itemId, 'agenda-title');
  assert.match(first.message, /pages\/01-agenda\.html/);
  assert.match(first.suggestedFix, /id="agenda-title-2"/);

  const buildResponse = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: packagePath,
      outDir: path.join(repoRoot, 'test', 'workspace', 'semantic-model-precheck-dup-id-build'),
    },
  });
  assert.equal(buildResponse.status, 'error');
  assert.equal(buildResponse.error.code, 'AUTHORING_LINT_FAILED');
  assert.equal(buildResponse.error.details.stage, 'lint');
});

test('作者包跨页同名 id：compile 探针不抛，lint 也不报', async () => {
  const packageDir = copyArchitecturePackage('semantic-model-precheck-cross-page-id', [
    ['02-site-analysis.html', 'id="site-eyebrow"', 'id="agenda-eyebrow"'],
  ]);
  const result = await lintAuthoringPackage({ packagePath: path.join(packageDir, 'deck.config.json'), strict: true });
  assert.equal(result.errors.some((entry) => entry.stage === 'semantic-model'), false);
  assert.equal(result.ok, true);

  const snapshot = await renderSnapshot({ htmlPath: result.htmlPath });
  assert.equal(compileModelError(snapshot), null);
});
