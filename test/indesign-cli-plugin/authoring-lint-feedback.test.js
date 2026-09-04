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
const { writeAuthorPackageEntry } = require('../../src/authoring');

// 2026-08-12 生产事故的真实作者包（已重新组装）。历史基准：56 errors / 100% GRID_ALIGNMENT_OFF /
// 23 normalized / page-2 22、page-3 10、page-4 24 / left 52、top 50、right 3。
// 2026-08-19 之前是 73 errors（top 59、left 58、right 57）：那时 flex 家具文本的 left/top 和
// 继承 --grid-span 撑起的 right 都在报，17 条属于作者无从下手的噪声，A3 修复后不再产出。
// 2026-09-04 起：母元素规则让块内元素不再计入——那 56 条全部位于 grid-item 祖先内部
// （dayparts 21、zone-map 11、metric-panel 10、flow-cards 6、report-title 3、flow-map 3、
// reset-bar 2），网格放置由块承担，块内文本的边缘由块的内边距决定，作者无从逐条去改。
// 这个包因此在 strict 下整体通过（0 errors / 23 normalized），见文末的回归用例。
// 2026-09-05 起补上母元素规则的另一半：承担放置的 grid-item 包裹层自己参与对齐校验。
// 这个包里共 20 个这样的块（每页 5 个：report-head / report-title / 主体 / 侧栏或 reset-bar /
// folio），其中 01 页整页 data-id-grid-ignore、5 个整体豁免，02/03/04 三页的 15 个块逐个被量，
// 全部压住网格线 —— 整包通过的数字因此不变（0 errors / 23 normalized）。数字不变不等于没在量：
// 见 "承担放置的包裹层自己压不住线时由块级校验兜住" 一例，注入一个偏 3mm/4mm 的包裹层就必须报错。
// 失败反馈的口径仍需真实用例：copyOffGridFixture 在同一个包的副本里，往 02/03/04 三页各注入
// 一个**自己承担放置却压不住线**的块（--grid-col/--grid-row 放置 + margin 3mm/4mm 推离），
// 这正是新规则要报的那类错误。变体实测基准：3 errors / 100% GRID_ALIGNMENT_OFF /
// 23 normalized / page-2 1、page-3 1、page-4 1 / left 3、top 3、right 3。
const GRID_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'authoring-lint', 'grid-alignment-package');
const CONCENTRATION_SENTENCE = 'All 3 errors share code GRID_ALIGNMENT_OFF'
  + ' — this is one systemic cause, not 3 independent fixes.';
// 自己带网格放置、又被 margin 推离网格线的块：新规则下责任在这个块本身。
const OFF_GRID_BLOCK = '  <p class="grid-item stray-note" style="--grid-col:2;--grid-span:2;'
  + '--grid-row:2;--grid-row-span:1;margin-left:3mm;margin-top:4mm">stray note</p>\n';
// 同样偏离网格，但责任落在一个自己永远不会成为 item 的无边框包裹层上：
// 只有块级对齐校验能发现它，块内段落不该被单独点名。
const OFF_GRID_WRAPPER = '  <div class="grid-item stray-card" style="--grid-col:2;--grid-span:2;'
  + '--grid-row:2;--grid-row-span:1;margin-left:3mm;margin-top:4mm">\n'
  + '    <p class="stray-card-copy">stray card copy</p>\n'
  + '  </div>\n';

function copyGridFixture(name) {
  const target = path.join(repoRoot, 'test', 'workspace', name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(GRID_FIXTURE, target, { recursive: true });
  return target;
}

// 注入后必须重写生成入口，否则 checkAuthorPackageEntry 会先以
// AUTHOR_GENERATED_ENTRY_DIRTY 短路，测的就不是网格失败反馈了。
function copyOffGridFixture(name) {
  const target = copyGridFixture(name);
  const pagesDir = path.join(target, 'pages');
  for (const file of fs.readdirSync(pagesDir)) {
    // 01 页整页 data-id-grid-ignore，注入进去只会被豁免掉。
    if (file.startsWith('01-')) continue;
    injectIntoPage(path.join(pagesDir, file), OFF_GRID_BLOCK);
  }
  writeAuthorPackageEntry(path.join(target, 'deck.config.json'));
  return target;
}

function copyOffGridWrapperFixture(name) {
  const target = copyGridFixture(name);
  const pagesDir = path.join(target, 'pages');
  const page = fs.readdirSync(pagesDir).find((file) => file.startsWith('02-'));
  // 页面重命名后 find 会静默返回 undefined，注入无声跳过，测试就变成在测一个干净包。
  if (!page) {
    throw new Error(`fixture has no 02- page to inject into: ${pagesDir}`);
  }
  injectIntoPage(path.join(pagesDir, page), OFF_GRID_WRAPPER);
  writeAuthorPackageEntry(path.join(target, 'deck.config.json'));
  return target;
}

function injectIntoPage(pagePath, markup) {
  const html = fs.readFileSync(pagePath, 'utf8');
  const injected = html.replace(/\n<\/section>/, `\n${markup}</section>`);
  // 注入失败必须炸：替换没命中时写回原文，整条用例会变成"干净包也报错"式的假绿。
  if (injected === html) {
    throw new Error(`injection point \\n</section> not found in ${pagePath}`);
  }
  fs.writeFileSync(pagePath, injected, 'utf8');
}

function callLint(packageDir, args = {}) {
  return callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: { package: path.join(packageDir, 'deck.config.json'), strict: true, ...args },
  });
}

test('html.authoring_lint 首条消息承载真实作者包的规模、分类与首条定位', () => {
  const packageDir = copyOffGridFixture('lint-feedback-grid-scale');
  const response = callLint(packageDir);

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');

  const { message } = response.error;
  assert.match(message, /^Strict authoring checks found 3 errors \(GRID_ALIGNMENT_OFF: 3\)\./);
  assert.equal(message.includes(CONCENTRATION_SENTENCE), true, message);
  assert.equal(
    message.includes('Affected: page-2 (1), page-3 (1), page-4 (1); edges left/top/right.'),
    true,
    message,
  );
  // 首条定位后面要带得走的偏差：3mm/4mm 就是注入时推离网格线的量。
  assert.match(
    message,
    /First issue at page-2 \/ p2-el28: Item edges do not align to the declared authoring grid: left at [\d.]+mm is 3mm right of the column line at [\d.]+mm; top at [\d.]+mm is 4mm below the row line at [\d.]+mm/,
  );
  assert.match(message, /Full report: .*authoring-lint-report\.json/);
});

// 母元素规则的另一半：块自己压不住线时，修法必须落在这个块上，而且要点明块内内容不被检查。
test('html.authoring_lint 的失败条目带着逐边偏移与可执行修法', () => {
  const packageDir = copyOffGridFixture('lint-feedback-grid-offsets');
  const response = callLint(packageDir);

  const entry = response.error.details.errors.find((issue) => issue.itemId === 'p2-el28');
  assert.ok(entry, JSON.stringify(response.error.details.errors));
  assert.deepEqual(entry.edges, ['left', 'top', 'right']);
  const left = entry.edgeOffsets.find((offset) => offset.edge === 'left');
  assert.equal(left.offsetMm, 3);
  assert.equal(typeof left.nearestLineMm, 'number');
  assert.match(entry.suggestedFix, /^Move #p2-el28 left edge to [\d.]+mm \(-3mm\)/);
  assert.match(entry.suggestedFix, /content inside a placed block is not checked/);
});

// 母元素规则的收益就是这一条：2026-08-12 事故包原样跑 strict 不再报 56 条网格偏移。
// 若这条重新变红，说明块内后代又被拉回逐条检查，先看 authoring-validator 的
// isPlacedBlockContent，别改这里的数字。
test('2026-08-12 事故包在母元素规则下整体通过 strict 检查', () => {
  const packageDir = copyGridFixture('lint-feedback-grid-clean');
  const response = callLint(packageDir);

  assert.equal(response.status, 'complete', JSON.stringify(response.error || null));
  assert.equal(response.data.errorCount, 0);
  assert.equal(response.data.warningCount, 0);
  assert.equal(response.data.normalizedCount, 23);
  // "0 errors"必须能被证明是"量过且都压住线"，不是"一条都没量"：
  // 02/03/04 三页 15 个承担放置的块逐个被量、无一被跳过，75 个块内条目由块承担，
  // 19 个条目整体豁免（01 页整页 data-id-grid-ignore），因此没有条目走逐条检查。
  assert.equal(response.data.gridBlockCheckedCount, 15);
  assert.equal(response.data.gridBlockSkippedCount, 0);
  assert.equal(response.data.gridShieldedCount, 75);
  assert.equal(response.data.gridCheckedCount, 0);
  assert.equal(response.data.gridIgnoredCount, 19);
});

// 母元素规则的另一半：块内不量，块本身必须有人量。这个包的 15 个 grid-item 包裹层
// 都压住了线，所以上一条是 0 errors —— 但"0 errors"不能等于"没在量"。往 02 页注入一个
// 自己承担放置、又被 margin 推离 3mm/4mm 的包裹层：它永远不会成为 item，只有块级
// 对齐校验能发现。这条若变绿而不报错，说明块级覆盖又回落到零，先看 authoring-validator
// 的 responsibleBlocksFor / offGridBlockEdges 与 capture 侧祖先节点的 boundsMm。
test('承担放置的包裹层自己压不住线时由块级校验兜住', () => {
  const packageDir = copyOffGridWrapperFixture('lint-feedback-grid-wrapper');
  const response = callLint(packageDir);

  assert.equal(response.status, 'error');
  const { errors } = response.error.details;
  assert.equal(errors.length, 1, JSON.stringify(errors));
  const [entry] = errors;
  assert.equal(entry.code, 'GRID_ALIGNMENT_OFF');
  assert.equal(entry.pageId, 'page-2');
  assert.equal(entry.block, true);
  // 包裹层没有 id，条目落回 sourcePath —— 作者仍能按选择器定位。
  assert.equal(entry.itemId, 'div:nth-of-type(3)');
  assert.deepEqual(entry.edges, ['left', 'top', 'right']);
  assert.equal(entry.edgeOffsets.find((offset) => offset.edge === 'left').offsetMm, 3);
  assert.equal(entry.edgeOffsets.find((offset) => offset.edge === 'top').offsetMm, 4);
  // 块内段落归属这个块，自己不再被点名。
  assert.deepEqual(entry.blockOf, ['p2-el28']);
  assert.equal(entry.blockOfCount, 1);
  assert.equal(errors.some((issue) => issue.itemId === 'p2-el28'), false);
  // 选择器路径不是 id，前面不加 #；修法也不能叫作者"再放到网格上"。
  assert.match(entry.suggestedFix, /^Move div:nth-of-type\(3\) left edge to [\d.]+mm \(-3mm\)/);
  assert.match(entry.suggestedFix, /this block already carries a grid placement/);
  assert.match(entry.suggestedFix, /data-id-grid-ignore/);
});

test('html.authoring_lint 失败时 hint 非空并指向 details.errors 与报告文件', () => {
  const packageDir = copyOffGridFixture('lint-feedback-grid-hint');
  const response = callLint(packageDir);

  assert.equal(response.status, 'error');
  assert.notEqual(response.error.hint, null);
  assert.equal(typeof response.error.hint, 'string');
  assert.match(response.error.hint, /error\.details\.errors/);
  assert.match(response.error.hint, /3 条/);
  assert.match(response.error.hint, /authoring-lint-report\.json/);

  // 宿主侧当前只读 details，hint/retryable/stage 必须冗余落一份。
  assert.equal(response.error.details.hint, response.error.hint);
  assert.equal(response.error.details.retryable, false);
  assert.equal(response.error.details.stage, 'lint');
  assert.equal(typeof response.error.details.reportPath, 'string');
});

test('html.authoring_lint 失败时落下不含浏览器快照的完整报告 artifact', () => {
  const packageDir = copyOffGridFixture('lint-feedback-grid-report');
  const response = callLint(packageDir);

  const { reportPath } = response.error.details;
  assert.equal(fs.existsSync(reportPath), true, reportPath);
  // 未提供 outDir 时落作者包根目录下的 .indesign-cli/，不污染作者源码目录。
  assert.equal(path.dirname(reportPath), path.join(packageDir, '.indesign-cli'));

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.errorCount, 3);
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
  const packageDir = copyOffGridFixture('lint-feedback-grid-outdir');
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
  const packageDir = copyOffGridFixture('lint-feedback-grid-escape');
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
  const packageDir = copyOffGridFixture('lint-feedback-parity');
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

test('deliverables older than this run are not reported as saved after INDD_SAVE_FAILED', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-feedback-stale-artifacts');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const inddPath = path.join(outDir, 'deck.indd');
  const pdfPath = path.join(outDir, 'deck.pdf');
  fs.writeFileSync(inddPath, 'stale', 'utf8');
  fs.writeFileSync(pdfPath, 'stale', 'utf8');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'deck',
      exportPdf: true,
      exportIdml: true,
      // 开工前快照就是这两个文件本身：本轮一个字节都没写，不能报成已落盘。
      preRunDeliverables: {
        indd: deliverableSnapshot(inddPath),
        pdf: deliverableSnapshot(pdfPath),
        idml: null,
      },
    },
    host_results: [{
      id: 'html-export-script',
      ok: true,
      data: { ok: false, errors: [{ code: 'INDD_SAVE_FAILED', message: '无法存储到文件“deck.indd”，因为该文件已打开。' }] },
    }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'INDESIGN_EXPORT_FAILED');
  assert.equal(response.error.message, '无法存储到文件“deck.indd”，因为该文件已打开。');
  assert.equal(response.error.details.artifactsExported, false);
  assert.deepEqual(response.error.details.partialArtifacts, []);
  assert.equal(response.artifacts, undefined);
});

test('only deliverables that changed since the pre-run snapshot are reported as landed', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-feedback-mixed-freshness');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const inddPath = path.join(outDir, 'deck.indd');
  const pdfPath = path.join(outDir, 'deck.pdf');

  // 上一轮遗留的 INDD：mtime 推到一小时前，和本轮写出的 PDF 明显区分开。
  fs.writeFileSync(inddPath, 'stale', 'utf8');
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(inddPath, anHourAgo, anHourAgo);
  const preRunDeliverables = {
    indd: deliverableSnapshot(inddPath),
    pdf: null,
    idml: null,
  };

  // 快照之后才落盘的 PDF 才是本轮成果。
  fs.writeFileSync(pdfPath, 'fresh', 'utf8');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'deck',
      exportPdf: true,
      exportIdml: true,
      preRunDeliverables,
    },
    host_results: [{
      id: 'html-export-script',
      ok: true,
      data: { ok: false, errors: [{ code: 'INDD_SAVE_FAILED', message: '无法存储到文件“deck.indd”，因为该文件已打开。' }] },
    }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'INDESIGN_EXPORT_FAILED');
  assert.deepEqual(response.error.details.partialArtifacts.map((item) => item.path), [pdfPath]);
  assert.match(response.error.message, /^PDF 已保存于/);
  assert.equal(response.error.details.artifactsExported, true);
});

test('lintFailureMessage 把前三条 suggestedFix 与豁免计数写进首条消息', () => {
  const errors = [
    { level: 'error', code: 'GRID_ALIGNMENT_OFF', pageId: 'page-2', itemId: 'p2-el4', message: 'Item edges do not align to the declared authoring grid: left at 13mm is 3mm right of the column line at 10mm.', edges: ['left'], suggestedFix: 'Move #p2-el4 left edge to 10mm (-3mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked.' },
    { level: 'error', code: 'GRID_ALIGNMENT_OFF', pageId: 'page-2', itemId: 'p2-el5', message: 'x', edges: ['top'], suggestedFix: 'Move #p2-el5 top edge to 41mm (+2mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked.' },
    { level: 'error', code: 'GRID_ALIGNMENT_OFF', pageId: 'page-3', itemId: 'p3-el1', message: 'x', edges: ['left'], suggestedFix: 'Move #p3-el1 left edge to 10mm (-1.5mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked.' },
    { level: 'error', code: 'GRID_ALIGNMENT_OFF', pageId: 'page-3', itemId: 'p3-el2', message: 'x', edges: ['left'], suggestedFix: 'Move #p3-el2 left edge to 10mm (-1mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked.' },
  ];
  const message = lintFailureMessage({ errors, errorCount: 4, gridIgnoredCount: 12 }, { strict: true });

  assert.match(message, /Fix examples: page-2 \/ p2-el4: Move #p2-el4 left edge to 10mm \(-3mm\)/);
  assert.match(message, /\| page-2 \/ p2-el5: Move #p2-el5 top edge/);
  assert.match(message, /\| page-3 \/ p3-el1: Move #p3-el1/);
  assert.equal(message.includes('p3-el2: Move'), false, 'only the first three fixes are inlined');
  assert.match(message, /\(\+1 more in error\.details\.errors\[\]\.suggestedFix\)/);
  assert.match(
    message,
    /Grid exemptions already in this package: 12 item\(s\) are exempt from grid checks via data-id-grid-ignore \(own or inherited\)\./,
  );

  const withoutFixes = lintFailureMessage({ errors: [{ level: 'error', code: 'HTML_TEXT_NOT_CONVERTIBLE', pageId: 'page-1', itemId: 'p1-el1', message: 'x' }], errorCount: 1 }, { strict: true });
  assert.equal(withoutFixes.includes('Fix examples'), false);
  assert.equal(withoutFixes.includes('Grid exemptions'), false);
});

// 首条消息不是完整报告：一条过长的修法会把另外两条示例和 Full report 那行挤出视野。
test('lintFailureMessage 把过长的 suggestedFix 截到 220 字符并留下省略号', () => {
  const message = lintFailureMessage({
    errors: [{
      level: 'error',
      code: 'GRID_ALIGNMENT_OFF',
      pageId: 'page-2',
      itemId: 'p2-el1',
      message: 'x',
      suggestedFix: 'M'.repeat(300),
    }],
    errorCount: 1,
  }, { strict: true });

  const line = message.split('\n').find((entry) => entry.startsWith('Fix examples: '));
  assert.ok(line, message);
  const example = line.slice('Fix examples: page-2 / p2-el1: '.length);
  assert.equal(example.endsWith('…'), true, example);
  assert.equal(example.length <= 224, true, `example length ${example.length}`);
  assert.equal(example.length, 221);
  // 截断只发生在首条消息里，完整原文仍在 error.details.errors[].suggestedFix。
  assert.equal(message.includes('M'.repeat(221)), false);
});

// 上一句刚说"这是一处系统性成因"，示例却来自那个零散的少数派 code，Agent 就会照着
// 改完再跑，集中的那批一条没动。
test('lintFailureMessage 的 Fix examples 优先取集中成因的 code，而不是文件顺序里的第一条', () => {
  const errors = [
    // 文件顺序里的第一条带修法的条目属于少数派 code。
    { level: 'error', code: 'TEXT_FIRST_LINE_CANNOT_FIT', pageId: 'page-1', itemId: 'p1-el9', message: 'x', suggestedFix: 'Enlarge #p1-el9 so the first line fits.' },
    ...Array.from({ length: 4 }, (_value, index) => ({
      level: 'error',
      code: 'GRID_ALIGNMENT_OFF',
      pageId: 'page-2',
      itemId: `p2-el${index + 1}`,
      message: 'x',
      suggestedFix: `Move #p2-el${index + 1} left edge to 10mm (-3mm).`,
    })),
  ];
  const message = lintFailureMessage({ errors, errorCount: 5 }, { strict: true });

  const line = message.split('\n').find((entry) => entry.startsWith('Fix examples: '));
  assert.ok(line, message);
  const [first] = line.slice('Fix examples: '.length).split(' | ');
  assert.match(first, /^page-2 \/ p2-el1: Move #p2-el1 left edge/, line);
  // 少数派那条没有被丢掉，只是排到集中成因后面，本例里被三条上限挤出示例。
  assert.equal(line.includes('p1-el9'), false, line);
  assert.match(line, /\(\+2 more in error\.details\.errors\[\]\.suggestedFix\)/);
});

function deliverableSnapshot(file) {
  const stat = fs.statSync(file);
  return { mtimeMs: stat.mtimeMs, size: stat.size };
}

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
