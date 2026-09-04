const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot } = require('./plugin-test-helper');
const {
  classifyLintErrors,
  isLintShortCircuit,
  lintFailureHint,
  lintFailureMessage,
  underlyingHostFailure,
} = require('../../src/indesign-cli-plugin/lint-feedback');
const { fidelityFailureMessage } = require('../../src/indesign-cli-plugin/tools/build-indesign');

// 2026-08-12 生产事故的真实作者包（已重新组装）。实测基准：56 errors / 100% GRID_ALIGNMENT_OFF /
// 23 normalized / page-2 22、page-3 10、page-4 24 / left 52、top 50、right 3。
// 2026-08-19 之前是 73 errors（top 59、left 58、right 57）：那时 flex 家具文本的 left/top 和
// 继承 --grid-span 撑起的 right 都在报，17 条属于作者无从下手的噪声，A3 修复后不再产出。
const GRID_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'authoring-lint', 'grid-alignment-package');
const CONCENTRATION_SENTENCE = 'All 56 errors share code GRID_ALIGNMENT_OFF'
  + ' — this is one systemic cause, not 56 independent fixes.';

function copyGridFixture(name) {
  const target = path.join(repoRoot, 'test', 'workspace', name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(GRID_FIXTURE, target, { recursive: true });
  return target;
}

function callLint(packageDir, args = {}) {
  return callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: { package: path.join(packageDir, 'deck.config.json'), strict: true, ...args },
  });
}

test('html.authoring_lint 首条消息承载真实作者包的规模、分类与首条定位', () => {
  const packageDir = copyGridFixture('lint-feedback-grid-scale');
  const response = callLint(packageDir);

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');

  const { message } = response.error;
  assert.match(message, /^Strict authoring checks found 56 errors \(GRID_ALIGNMENT_OFF: 56\)\./);
  assert.equal(message.includes(CONCENTRATION_SENTENCE), true, message);
  assert.equal(
    message.includes('Affected: page-2 (22), page-3 (10), page-4 (24); edges left/top/right.'),
    true,
    message,
  );
  assert.match(
    message,
    /First issue at page-2 \/ p2-el4: Item edges do not align to the declared authoring grid\./,
  );
  assert.match(message, /Full report: .*authoring-lint-report\.json/);
});

test('html.authoring_lint 失败时 hint 非空并指向 details.errors 与报告文件', () => {
  const packageDir = copyGridFixture('lint-feedback-grid-hint');
  const response = callLint(packageDir);

  assert.equal(response.status, 'error');
  assert.notEqual(response.error.hint, null);
  assert.equal(typeof response.error.hint, 'string');
  assert.match(response.error.hint, /error\.details\.errors/);
  assert.match(response.error.hint, /56 条/);
  assert.match(response.error.hint, /authoring-lint-report\.json/);

  // 宿主侧当前只读 details，hint/retryable/stage 必须冗余落一份。
  assert.equal(response.error.details.hint, response.error.hint);
  assert.equal(response.error.details.retryable, false);
  assert.equal(response.error.details.stage, 'lint');
  assert.equal(typeof response.error.details.reportPath, 'string');
});

test('html.authoring_lint 失败时落下不含浏览器快照的完整报告 artifact', () => {
  const packageDir = copyGridFixture('lint-feedback-grid-report');
  const response = callLint(packageDir);

  const { reportPath } = response.error.details;
  assert.equal(fs.existsSync(reportPath), true, reportPath);
  // 未提供 outDir 时落作者包根目录下的 .indesign-cli/，不污染作者源码目录。
  assert.equal(path.dirname(reportPath), path.join(packageDir, '.indesign-cli'));

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.errorCount, 56);
  // 归一化条目（工具已自动处理）不再计入 warningCount，单列 normalizedCount；总量口径不变。
  assert.equal(report.warningCount + report.normalizedCount, 23);
  assert.equal(report.normalizedCount, 23);
  assert.equal(Array.isArray(report.errors), true);
  assert.equal(Array.isArray(report.warnings), true);
  assert.equal(Array.isArray(report.normalized), true);
  assert.ok(report.compatibility);
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'snapshot'), false);

  assert.equal(
    response.artifacts.some((item) => item.kind === 'json' && item.path === reportPath),
    true,
  );
});

test('html.authoring_lint 接受 outDir 作为报告落点', () => {
  const packageDir = copyGridFixture('lint-feedback-grid-outdir');
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-feedback-grid-outdir-report');
  fs.rmSync(outDir, { recursive: true, force: true });
  const response = callLint(packageDir, { outDir });

  assert.equal(response.status, 'error');
  assert.equal(response.error.details.reportPath, path.join(outDir, 'authoring-lint-report.json'));
  assert.equal(fs.existsSync(response.error.details.reportPath), true);
});

test('报告落盘受项目围栏约束，越界时不写且留痕', () => {
  // 报告写盘是本轮新增的写入点。outDir 是 Agent 可控参数，若不校验就等于给
  // OUTPUT_OUTSIDE_PROJECT 开后门，越界路径还会作为 artifacts 回给 Agent。
  const packageDir = copyGridFixture('lint-feedback-grid-escape');
  const outside = path.join(repoRoot, '..', 'lint-feedback-outside-project');
  fs.rmSync(outside, { recursive: true, force: true });

  const response = callLint(packageDir, { outDir: outside });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED', '围栏不得盖掉真正的 lint 失败');
  assert.equal(response.error.details.reportPath, null);
  assert.match(response.error.details.reportWriteError, /OUTPUT_OUTSIDE_PROJECT/);
  assert.deepEqual(response.artifacts, [], '越界路径不得作为 artifacts 回给 Agent');
  assert.equal(fs.existsSync(outside), false, '越界目录不得被创建');
});

test('html.authoring_lint 与 html.build_indesign 对同一作者包给出同口径首条消息', () => {
  const packageDir = copyGridFixture('lint-feedback-parity');
  const lintResponse = callLint(packageDir);
  const buildResponse = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: path.join(packageDir, 'deck.config.json'),
      outDir: path.join(repoRoot, 'test', 'workspace', 'lint-feedback-parity-build'),
    },
  });

  assert.equal(buildResponse.status, 'error');
  assert.equal(buildResponse.error.code, 'AUTHORING_LINT_FAILED');
  assert.equal(withoutReportLine(lintResponse.error.message), withoutReportLine(buildResponse.error.message));
  assert.match(buildResponse.error.message, /Full report: .*authoring-lint-report\.json/);
  // 抛出路径上 dispatcher 只搬运 details，hint 必须同时冗余进 details。
  assert.match(buildResponse.error.details.hint, /error\.details\.errors/);
});

test('入口文件过期时首条消息说明检查未执行，并上浮下层的重组装命令', () => {
  const packageDir = copyGridFixture('lint-feedback-short-circuit');
  const pagePath = path.join(packageDir, 'pages', '01-audience-time.html');
  fs.writeFileSync(pagePath, `${fs.readFileSync(pagePath, 'utf8')}\n<!-- 作者改了页面但没重新组装 -->\n`, 'utf8');

  const response = callLint(packageDir);

  assert.equal(response.status, 'error');
  assert.equal(response.error.details.errorCount, 1);
  // errorCount 1 是短路计数，绝不能作为首条消息的主语。
  assert.match(response.error.message, /^Authoring lint did not run: generated deck\.html is out of date\./);
  assert.doesNotMatch(response.error.message, /found 1 error/);
  assert.match(response.error.message, /Reassemble the package and retry: & "/);
  assert.match(response.error.message, /assemble-authoring\.js/);
  assert.match(response.error.message, /deck\.config\.json/);

  assert.notEqual(response.error.hint, null);
  assert.match(response.error.hint, /assemble-authoring\.js/);
});

test('classifyLintErrors 按 code 计数降序、最多三类、其余归 other', () => {
  const lint = {
    ok: false,
    errorCount: 12,
    errors: [
      ...repeatError('A_CODE', 5, 'page-1'),
      ...repeatError('B_CODE', 4, 'page-2'),
      ...repeatError('C_CODE', 2, 'page-3'),
      ...repeatError('D_CODE', 1, 'page-4'),
    ],
    warnings: [],
  };

  const classification = classifyLintErrors(lint);
  assert.equal(classification.total, 12);
  assert.deepEqual(classification.listed, [['A_CODE', 5], ['B_CODE', 4], ['C_CODE', 2], ['other', 1]]);
  assert.equal(classification.concentration, null);
});

test('多类错误时不出现集中提示句', () => {
  const lint = {
    ok: false,
    errorCount: 4,
    errors: [
      ...repeatError('A_CODE', 2, 'page-1'),
      ...repeatError('B_CODE', 2, 'page-2'),
    ],
    warnings: [],
  };

  const message = lintFailureMessage(lint, { strict: true });
  assert.match(message, /^Strict authoring checks found 4 errors \(A_CODE: 2, B_CODE: 2\)\./);
  assert.doesNotMatch(message, /one systemic cause/);
});

test('占比达到 80% 但不足 100% 时，集中提示句不得声称全部同类', () => {
  const lint = {
    ok: false,
    errorCount: 5,
    errors: [
      ...repeatError('A_CODE', 4, 'page-1'),
      ...repeatError('B_CODE', 1, 'page-2'),
    ],
    warnings: [],
  };

  const message = lintFailureMessage(lint, { strict: false });
  assert.match(message, /^Authoring checks found 5 errors \(A_CODE: 4, B_CODE: 1\)\./);
  assert.match(message, /4 of 5 errors share code A_CODE — treat those as one systemic cause, then handle the remaining 1 separately\./);
  // 前半句刚说有两类、后半句就说全部同一类，会让 Agent 以为修完 A_CODE 就清零
  assert.doesNotMatch(message, /All errors share/);
});

test('100% 集中时才可以说全部同类', () => {
  const lint = {
    ok: false,
    errorCount: 3,
    errors: repeatError('A_CODE', 3, 'page-1'),
    warnings: [],
  };

  const message = lintFailureMessage(lint, { strict: true });
  assert.match(message, /All 3 errors share code A_CODE — this is one systemic cause, not 3 independent fixes\./);
});

test('lintFailureHint 优先上浮下层错误自带的 hint', () => {
  const lint = {
    ok: false,
    errorCount: 2,
    errors: [
      { level: 'error', code: 'A_CODE', message: 'first' },
      { level: 'error', code: 'B_CODE', message: 'second', hint: '按这条命令修：& "node.exe" fix.js' },
    ],
    warnings: [],
  };

  const hint = lintFailureHint(lint, { reportPath: 'D:\\out\\authoring-lint-report.json' });
  assert.match(hint, /按这条命令修：& "node\.exe" fix\.js/);
  assert.match(hint, /error\.details\.errors（2 条）/);
  assert.match(hint, /D:\\out\\authoring-lint-report\.json/);
});

test('isLintShortCircuit 只认前置短路，不把普通规则失败当短路', () => {
  assert.equal(isLintShortCircuit({
    errors: [{ level: 'error', code: 'AUTHOR_GENERATED_ENTRY_DIRTY', message: 'x' }],
  }), true);
  assert.equal(isLintShortCircuit({
    errors: [{ level: 'error', code: 'GRID_ALIGNMENT_OFF', message: 'x' }],
  }), false);
});

test('underlyingHostFailure 从共享模块导出，保留下层 code 与文本', () => {
  assert.deepEqual(
    underlyingHostFailure({ data: { ok: false, errors: [{ code: 'FONT_NOT_FOUND', message: 'Missing font' }] } }),
    { code: 'FONT_NOT_FOUND', message: 'Missing font' },
  );
  assert.deepEqual(underlyingHostFailure({}), { code: null, message: null });
});

test('underlyingHostFailure 把被 CLI 序列化成 JSON 文本的脚本结果解回首条结构化错误', () => {
  const blob = JSON.stringify({
    ok: false,
    outputs: { pdf: 'D:/run/deck.pdf' },
    errors: [{ code: 'INDD_SAVE_FAILED', message: '无法存储到文件“deck.indd”，因为该文件已打开。' }],
    audit: { panelNames: { layers: ['内容'] } },
  });
  const failure = underlyingHostFailure({ error: { code: 'INDESIGN_SCRIPT_FAILED', message: blob } });
  assert.equal(failure.code, 'INDD_SAVE_FAILED');
  assert.equal(failure.message, '无法存储到文件“deck.indd”，因为该文件已打开。');
  assert.equal(failure.hostResult.outputs.pdf, 'D:/run/deck.pdf');

  const plain = underlyingHostFailure({ error: { code: 'X', message: 'not json' } });
  assert.deepEqual(plain, { code: 'X', message: 'not json' });

  const lifted = underlyingHostFailure({ data: { ok: false, code: 'OUTPUT_TARGET_OPEN', message: 'busy' } });
  assert.deepEqual(lifted, { code: 'OUTPUT_TARGET_OPEN', message: 'busy' });
});

test('导出后宿主失败必须报出已落盘的 INDD/PDF/IDML，而不是整体吞掉', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-feedback-partial-artifacts');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'partial-build.indd'), 'fake', 'utf8');
  fs.writeFileSync(path.join(outDir, 'partial-build.idml'), 'fake', 'utf8');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'partial-build',
      exportPdf: true,
      exportIdml: true,
    },
    host_results: [{
      id: 'html-export-script',
      ok: true,
      data: { ok: false, errors: [{ code: 'PDF_EXPORT_FAILED', message: 'PDF preset missing' }] },
    }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'INDESIGN_EXPORT_FAILED');
  assert.match(response.error.message, /^INDD 已保存于 .*partial-build\.indd/);
  assert.match(response.error.message, /PDF preset missing/);
  assert.equal(response.error.details.artifactsExported, true);
  assert.equal(response.error.details.intermediateDir, outDir);

  const partialPaths = response.error.details.partialArtifacts.map((item) => item.path);
  assert.equal(partialPaths.includes(path.join(outDir, 'partial-build.indd')), true);
  assert.equal(partialPaths.includes(path.join(outDir, 'partial-build.idml')), true);
  assert.equal(partialPaths.includes(path.join(outDir, 'partial-build.pdf')), false);
  assert.deepEqual(response.artifacts.map((item) => item.path), partialPaths);
});

test('没有任何产物落盘时宿主失败保持整体失败口径', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-feedback-no-artifacts');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'nothing-landed',
    },
    host_results: [{
      id: 'html-build-script',
      ok: true,
      data: { ok: false, errors: [{ code: 'FONT_NOT_FOUND', message: 'Missing font: Example' }] },
    }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'INDESIGN_BUILD_FAILED');
  assert.equal(response.error.message, 'Missing font: Example');
  assert.equal(response.error.details.artifactsExported, false);
  assert.deepEqual(response.error.details.partialArtifacts, []);
  assert.equal(response.artifacts, undefined);
});

test('fidelityFailureMessage 把溢出原因与表格差异维度写进首条消息', () => {
  const overset = fidelityFailureMessage({ pageId: 'page-2', itemId: 'p2-el3', field: 'content.text', reason: 'overset' }, 3);
  assert.match(overset, /at page page-2, item p2-el3, field content\.text; 3 issue\(s\) found \(text overset: the InDesign frame is too small for its text\)\./);

  const table = fidelityFailureMessage({ pageId: 'page-7', itemId: 'p7-el4', field: 'table.rows', dimensions: ['header', 'paragraphStyle'] }, 8);
  assert.match(table, /8 issue\(s\) found \(table differs in: header, paragraphStyle\)\./);

  const plain = fidelityFailureMessage({ pageId: 'page-1', itemId: 'p1-el2', field: 'bounds' }, 1);
  assert.equal(plain, 'Built InDesign content differs from the HTML source at page page-1, item p1-el2, field bounds; 1 issue(s) found.');
});

test('OUTPUT_TARGET_OPEN from the build pre-check surfaces as its own retryable error with a close-it hint', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-feedback-target-open');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.indd'), 'stale', 'utf8');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'deck',
      // runStartedAt 由 Task 6 的 mtime 过滤消费；OUTPUT_TARGET_OPEN 这条路径上它不起作用。
      runStartedAt: Date.now() + 60000,
    },
    host_results: [{
      id: 'html-build-script',
      ok: true,
      data: {
        ok: false,
        code: 'OUTPUT_TARGET_OPEN',
        message: 'Target INDD is open in InDesign; close it (or choose another outputBaseName) before building: D:/run/deck.indd',
        errors: [{ code: 'OUTPUT_TARGET_OPEN', message: 'Target INDD is open in InDesign; close it (or choose another outputBaseName) before building: D:/run/deck.indd' }],
      },
    }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'OUTPUT_TARGET_OPEN');
  assert.equal(response.error.retryable, true);
  assert.match(response.error.message, /^Target INDD is open in InDesign/);
  assert.match(response.error.hint, /关闭/);
  assert.equal(response.error.details.artifactsExported, false);
  assert.deepEqual(response.error.details.partialArtifacts, []);

  // 真实 CLI 的形状：script.run 把脚本的首条错误抬到 host_result.error，data 不再挂 errors。
  const viaHostError = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'deck',
      runStartedAt: Date.now() + 60000,
    },
    host_results: [{
      id: 'html-build-script',
      ok: false,
      error: {
        code: 'OUTPUT_TARGET_OPEN',
        message: 'Target INDD is open in InDesign; close it (or choose another outputBaseName) before building: D:/run/deck.indd',
      },
    }],
  });

  assert.equal(viaHostError.status, 'error');
  assert.equal(viaHostError.error.code, 'OUTPUT_TARGET_OPEN');
  assert.equal(viaHostError.error.retryable, true);
  assert.match(viaHostError.error.message, /^Target INDD is open in InDesign/);
  assert.match(viaHostError.error.hint, /关闭/);
  assert.equal(viaHostError.error.details.artifactsExported, false);
  assert.deepEqual(viaHostError.error.details.partialArtifacts, []);
});

function repeatError(code, count, pageId) {
  return Array.from({ length: count }, (_value, index) => ({
    level: 'error',
    code,
    message: `${code} issue ${index + 1}`,
    pageId,
    itemId: `${pageId}-el${index + 1}`,
  }));
}

function withoutReportLine(message) {
  return String(message)
    .split('\n')
    .filter((line) => !line.startsWith('Full report: '))
    .join('\n');
}
