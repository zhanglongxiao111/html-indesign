// #13 P1-1（lint 默认只回摘要）与 P1-2（报告带运行标识、主报告永远是本次结果）。
// 事故现场：8/6 北小河通宵，lint 返回 76–85KB 整块进上下文；seq 467 在 lint 明确失败后
// 读到 build/authoring-lint-report.json 里上一轮的 valid:true，据此二次误判。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot } = require('./plugin-test-helper');
const { lintAuthoringPackage, writeAuthorPackageEntry } = require('../../src/authoring');
const { getSchema } = require('../../src/indesign-cli-plugin/tool-catalog');
const { validateArgs } = require('../../src/indesign-cli-plugin/validate-args');
const dispatcher = require('../../src/indesign-cli-plugin/dispatcher');

const GRID_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'authoring-lint', 'grid-alignment-package');
const ARCH_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'e2e', 'architecture-report');
const OFF_GRID_BLOCK = '  <p class="grid-item stray-note" style="--grid-col:2;--grid-span:2;'
  + '--grid-row:2;--grid-row-span:1;margin-left:3mm;margin-top:4mm">stray note</p>\n';
const RUN_ID = /^(lint|build)-\d{8}T\d{6}-[0-9a-f]{6}$/;
const SUMMARY_KEYS = ['errorCount', 'firstErrors', 'format', 'ok', 'reportPath', 'runId', 'topCodes', 'warningCount'];
const FULL_ARRAYS = ['errors', 'warnings', 'normalized', 'messages'];

function copyPackage(source, name) {
  const target = path.join(repoRoot, 'test', 'workspace', name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function copyOffGridPackage(name) {
  const target = copyPackage(GRID_FIXTURE, name);
  const pagesDir = path.join(target, 'pages');
  for (const file of fs.readdirSync(pagesDir)) {
    if (file.startsWith('01-')) continue;
    const pagePath = path.join(pagesDir, file);
    const html = fs.readFileSync(pagePath, 'utf8');
    const injected = html.replace(/\n<\/section>/, `\n${OFF_GRID_BLOCK}</section>`);
    if (injected === html) throw new Error(`injection point not found in ${pagePath}`);
    fs.writeFileSync(pagePath, injected, 'utf8');
  }
  writeAuthorPackageEntry(path.join(target, 'deck.config.json'));
  return target;
}

function lint(packageDir, args = {}) {
  return callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: { package: path.join(packageDir, 'deck.config.json'), strict: true, ...args },
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function omit(value, keys) {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

test('默认 summary：失败返回体只含摘要字段，完整清单只在报告里', () => {
  const packageDir = copyOffGridPackage('run-id-summary-failure');
  const response = lint(packageDir);

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');
  const { details } = response.error;
  // 摘要字段 + 失败路径原有的 stage/hint/retryable/metrics，一个完整数组都不带。
  assert.deepEqual(
    Object.keys(details).sort(),
    [...SUMMARY_KEYS, 'hint', 'metrics', 'retryable', 'stage'].sort(),
  );
  for (const key of FULL_ARRAYS) assert.equal(key in details, false, `${key} must not be in summary`);
  assert.equal(details.ok, false);
  assert.equal(details.format, 'summary');
  assert.equal(details.errorCount, 3);
  assert.deepEqual(details.topCodes[0], { code: 'GRID_ALIGNMENT_OFF', level: 'error', count: 3 });
  assert.equal(details.firstErrors.length, 3);
  assert.equal(details.firstErrors[0].code, 'GRID_ALIGNMENT_OFF');
  assert.equal(details.firstErrors[0].pageId, 'page-2');
  assert.match(details.firstErrors[0].suggestedFix, /^Move #p2-el28 left edge/);
  assert.equal('edgeOffsets' in details.firstErrors[0], false, '逐边偏移明细留在报告里');

  // 原有 Agent 依赖的字段不能丢。
  assert.equal(details.stage, 'lint');
  assert.equal(details.retryable, false);
  assert.equal(details.hint, response.error.hint);
  assert.match(details.hint, /authoring-lint-report\.json 的 errors 数组/);
  assert.match(details.hint, /format:"full"/);
  assert.doesNotMatch(response.error.message, /error\.details\.errors/);
  assert.match(response.error.message, /Full report: .*authoring-lint-report\.json/);

  const report = readJson(details.reportPath);
  assert.equal(report.errors.length, 3);
  assert.ok(Array.isArray(report.warnings));
  assert.ok(Array.isArray(report.normalized));
  assert.ok(Array.isArray(report.messages));

  // 体积：摘要必须远小于完整返回。
  const full = lint(packageDir, { format: 'full' });
  assert.ok(JSON.stringify(response).length * 3 < JSON.stringify(full).length);
});

test('默认 summary：通过且没传 outDir 时报告写到作者包根目录下的 .indesign-cli/', () => {
  const packageDir = copyPackage(ARCH_FIXTURE, 'run-id-summary-pass');
  const response = lint(packageDir);

  assert.equal(response.status, 'complete');
  assert.deepEqual(Object.keys(response.data).sort(), SUMMARY_KEYS);
  assert.equal(response.data.ok, true);
  assert.equal(response.data.errorCount, 0);
  assert.deepEqual(response.data.firstErrors, []);
  const expected = path.join(packageDir, '.indesign-cli', 'authoring-lint-report.json');
  assert.equal(response.data.reportPath, expected);
  assert.equal(fs.existsSync(expected), true);
  assert.equal(response.metrics.artifacts, 1);
  assert.deepEqual(response.artifacts.map((item) => item.path), [expected]);
});

test('format:full 与改前一致：返回体就是完整 lint 结果', async () => {
  const packageDir = copyOffGridPackage('run-id-full-failure');
  const packagePath = path.join(packageDir, 'deck.config.json');
  const expected = await lintAuthoringPackage({ packagePath, strict: true });

  const failed = lint(packageDir, { format: 'full' });
  assert.equal(failed.status, 'error');
  assert.deepEqual(
    omit(failed.error.details, ['stage', 'hint', 'retryable', 'reportPath', 'metrics', 'runId']),
    JSON.parse(JSON.stringify(expected)),
  );
  assert.match(failed.error.hint, /完整错误清单见 error\.details\.errors（3 条）/);

  const cleanDir = copyPackage(ARCH_FIXTURE, 'run-id-full-pass');
  const cleanPath = path.join(cleanDir, 'deck.config.json');
  const cleanExpected = await lintAuthoringPackage({ packagePath: cleanPath, strict: true });
  const passed = lint(cleanDir, { format: 'full' });
  assert.equal(passed.status, 'complete');
  assert.equal(passed.data.reportPath, null);
  assert.deepEqual(omit(passed.data, ['reportPath', 'runId']), JSON.parse(JSON.stringify(cleanExpected)));
  assert.equal(fs.existsSync(path.join(cleanDir, '.indesign-cli')), false, 'full 通过且无旧报告时不凭空写文件');
});

test('runId 在返回体与报告顶层一致，报告带 generatedAt 与 tool', () => {
  const packageDir = copyOffGridPackage('run-id-consistency');
  const before = Date.now();
  const failed = lint(packageDir);
  const report = readJson(failed.error.details.reportPath);

  assert.match(failed.error.details.runId, RUN_ID);
  assert.equal(report.runId, failed.error.details.runId);
  assert.equal(report.tool, 'html.authoring_lint');
  assert.ok(Date.parse(report.generatedAt) >= before - 1000);
  // 标识在最前面，打开文件第一眼就能核对。
  assert.deepEqual(Object.keys(report).slice(0, 3), ['runId', 'generatedAt', 'tool']);

  // 失败归档里也是同一个 runId。
  const dir = path.dirname(failed.error.details.reportPath);
  const archives = fs.readdirSync(dir).filter((name) => name.includes('.failed-'));
  assert.ok(archives.some((name) => readJson(path.join(dir, name)).runId === report.runId));

  // 两次调用不共用 runId。
  const again = lint(packageDir);
  assert.notEqual(again.error.details.runId, failed.error.details.runId);
  assert.equal(readJson(again.error.details.reportPath).runId, again.error.details.runId);
});

test('format:full 通过时盖掉 .indesign-cli/ 里上一次失败留下的旧报告', () => {
  const packageDir = copyPackage(ARCH_FIXTURE, 'run-id-full-supersede');
  const stalePath = path.join(packageDir, '.indesign-cli', 'authoring-lint-report.json');
  fs.mkdirSync(path.dirname(stalePath), { recursive: true });
  fs.writeFileSync(stalePath, JSON.stringify({ runId: 'lint-old', ok: false, valid: false }), 'utf8');

  const response = lint(packageDir, { format: 'full' });
  assert.equal(response.status, 'complete');
  assert.equal(response.data.reportPath, stalePath);
  const report = readJson(stalePath);
  assert.equal(report.runId, response.data.runId);
  assert.equal(report.ok, true);
});

test('build 在 lint 阶段失败时，复用 outDir 里的旧报告全部换成本次内容', () => {
  const packageDir = copyOffGridPackage('run-id-build-stale');
  const outDir = path.join(repoRoot, 'test', 'workspace', 'run-id-build-stale-out');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const stale = { runId: 'build-old', ok: true, valid: true };
  for (const name of ['authoring-lint-report.json', 'forward-fidelity-report.json', 'compile-summary.json']) {
    fs.writeFileSync(path.join(outDir, name), JSON.stringify(stale), 'utf8');
  }

  const response = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: { package: path.join(packageDir, 'deck.config.json'), outDir },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');
  const { runId } = response.error.details;
  assert.match(runId, RUN_ID);
  assert.equal(response.error.details.format, 'summary');
  assert.equal(response.error.details.reportPath, path.join(outDir, 'authoring-lint-report.json'));

  const lintReport = readJson(path.join(outDir, 'authoring-lint-report.json'));
  assert.equal(lintReport.runId, runId);
  assert.equal(lintReport.ok, false, '主报告必须是本次的失败内容');
  assert.equal(lintReport.tool, 'html.build_indesign');
  for (const name of ['forward-fidelity-report.json', 'compile-summary.json']) {
    const placeholder = readJson(path.join(outDir, name));
    assert.equal(placeholder.runId, runId, `${name} 不得留着上一轮的内容`);
    assert.equal(placeholder.status, 'not-produced');
    assert.equal(placeholder.ok, false);
    assert.equal('valid' in placeholder, false);
  }
});

test('build lint 通过后 lint 报告与编译摘要带本次 runId，INDD 归属标记就是 runId', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'run-id-build-pass-out');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'forward-fidelity-report.json'), JSON.stringify({ ok: true, runId: 'old' }), 'utf8');

  const response = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: { package: path.join(ARCH_FIXTURE, 'deck.config.json'), outDir },
  });

  assert.equal(response.status, 'requires_host_actions');
  const { runId } = response.state;
  assert.match(runId, RUN_ID);
  assert.equal(response.state.runMarker, runId);
  assert.equal(readJson(response.state.lintReportPath).runId, runId);
  const summary = readJson(response.state.summaryPath);
  assert.equal(summary.runId, runId);
  assert.equal(summary.tool, 'html.build_indesign');
  // 保真报告要等读回快照后才写：在那之前是本次的占位，不是上一轮的 ok:true。
  const fidelity = readJson(path.join(outDir, 'forward-fidelity-report.json'));
  assert.equal(fidelity.runId, runId);
  assert.equal(fidelity.status, 'not-produced');
});

test('summary 请求但报告写不成时退回完整返回并显式标注', () => {
  const packageDir = copyOffGridPackage('run-id-summary-fallback');
  const outside = path.join(repoRoot, '..', 'run-id-outside-project');
  fs.rmSync(outside, { recursive: true, force: true });

  const response = lint(packageDir, { outDir: outside });
  assert.equal(response.status, 'error');
  const { details } = response.error;
  assert.equal(details.reportPath, null);
  assert.match(details.reportWriteError, /OUTPUT_OUTSIDE_PROJECT/);
  assert.equal(details.format, 'full');
  assert.match(details.formatFallback, /report file was not written/);
  assert.equal(details.errors.length, 3);
  assert.equal(fs.existsSync(outside), false);
});

test('schema 接受 format summary/full，拒绝其他值', async () => {
  for (const id of ['html.authoring_lint', 'html.build_indesign']) {
    const schema = getSchema(id);
    assert.deepEqual(schema.properties.format.enum, ['summary', 'full']);
    assert.equal(schema.properties.format.default, 'summary');
    for (const format of ['summary', 'full']) {
      assert.deepEqual(validateArgs(schema, { package: 'deck.config.json', format }), []);
    }
    const issues = validateArgs(schema, { package: 'deck.config.json', format: 'compact' });
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, 'ARG_NOT_IN_ENUM');
    assert.equal(issues[0].arg, 'format');
  }

  const response = await dispatcher.dispatch({
    method: 'tools/call',
    params: { id: 'html.authoring_lint', args: { package: 'deck.config.json', format: 'brief' } },
    context: { cwd: repoRoot },
  });
  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'TOOL_ARGS_INVALID');
  assert.match(response.error.details.runId, RUN_ID);
});

test('resume 返回体沿用 state 里的 runId', async () => {
  const response = await dispatcher.dispatch({
    method: 'tools/resume',
    params: { state: { tool_id: 'html.build_indesign', stage: 'bogus', runId: 'build-20260924T000000-abcdef' } },
  });
  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'BUILD_STATE_INVALID');
  assert.equal(response.error.details.runId, 'build-20260924T000000-abcdef');
});
