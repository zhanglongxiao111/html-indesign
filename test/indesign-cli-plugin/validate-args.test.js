// 回归：工具参数必须在进入 handler 前按公开 schema 校验，未知字段报错退回而不是被静默吞掉。
// 现场：Agent 给 html.authoring_lint 传 schema 之外的键，调用返回成功，它据此以为参数生效，
// 直到去读那个没人写过的目录才发现不对（2026-08-25 起遥测 67 次）。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const dispatcher = require('../../src/indesign-cli-plugin/dispatcher');
const authoringLint = require('../../src/indesign-cli-plugin/tools/authoring-lint');
const { validateArgs, argsErrorMessage } = require('../../src/indesign-cli-plugin/validate-args');
const { getSchema } = require('../../src/indesign-cli-plugin/tool-catalog');
const { callPlugin, repoRoot } = require('./plugin-test-helper');

const LINT_SCHEMA = getSchema('html.authoring_lint');
const REVERSE_SCHEMA = getSchema('html.reverse_export');

test('未知参数被拒绝，并报出可用参数清单', () => {
  const issues = validateArgs(LINT_SCHEMA, { package: 'deck.config.json', reportPath: 'x.json' });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'UNKNOWN_ARG');
  assert.equal(issues[0].arg, 'reportPath');
  assert.match(issues[0].message, /不会有任何效果/);
  for (const name of ['package', 'strict', 'gridTolerance', 'outDir']) {
    assert.match(issues[0].message, new RegExp(name), `可用参数清单应含 ${name}`);
  }
});

test('参数名拼错时给出最接近的候选', () => {
  const issues = validateArgs(LINT_SCHEMA, { package: 'deck.config.json', outdir: 'out' });

  assert.equal(issues[0].code, 'UNKNOWN_ARG');
  assert.equal(issues[0].didYouMean, 'outDir', '大小写不同应直接命中');

  const typo = validateArgs(LINT_SCHEMA, { package: 'deck.config.json', outDri: 'out' });
  assert.equal(typo[0].didYouMean, 'outDir');
});

test('毫不相干的参数名不硬凑候选', () => {
  const issues = validateArgs(LINT_SCHEMA, { package: 'deck.config.json', 完全不相干的长参数名: 1 });

  assert.equal(issues[0].code, 'UNKNOWN_ARG');
  assert.equal(issues[0].didYouMean, undefined);
});

test('缺必填、类型不符、枚举越界、下界越界都各自成条', () => {
  assert.equal(validateArgs(LINT_SCHEMA, {})[0].code, 'MISSING_REQUIRED_ARG');

  const wrongType = validateArgs(LINT_SCHEMA, { package: 'deck.config.json', strict: 'true' });
  assert.equal(wrongType[0].code, 'ARG_TYPE_MISMATCH');
  assert.equal(wrongType[0].expected, 'boolean');
  assert.equal(wrongType[0].actual, 'string');

  const badEnum = validateArgs(REVERSE_SCHEMA, { indd: 'a.indd', mode: 'observe' });
  assert.equal(badEnum[0].code, 'ARG_NOT_IN_ENUM');
  assert.deepEqual(badEnum[0].allowed, ['structured', 'inferred', 'observation']);

  const belowMin = validateArgs(REVERSE_SCHEMA, { indd: 'a.indd', timeout: 0 });
  assert.equal(belowMin[0].code, 'ARG_OUT_OF_RANGE');
  assert.equal(belowMin[0].minimum, 1);
});

test('数组元素逐个按 items 校验并带下标', () => {
  const issues = validateArgs(REVERSE_SCHEMA, {
    indd: 'a.indd',
    reconstruct: ['不存在的算法名'],
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ARG_NOT_IN_ENUM');
  assert.equal(issues[0].arg, 'reconstruct[0]');
});

test('合法参数零 issue；没有 schema 时放行', () => {
  assert.deepEqual(
    validateArgs(LINT_SCHEMA, { package: 'deck.config.json', strict: true, gridTolerance: 1, outDir: 'out' }),
    [],
  );
  assert.deepEqual(validateArgs(null, { 随便什么: 1 }), []);
});

test('多条 issue 时首条进 message，其余计数指向 details.issues', () => {
  const issues = validateArgs(LINT_SCHEMA, { 未知一: 1, 未知二: 2 });
  const message = argsErrorMessage('html.authoring_lint', issues);

  assert.match(message, /html\.authoring_lint/);
  assert.match(message, /另有 \d+ 处/);
});

test('dispatcher 在未知参数时不调用 handler，并返回 TOOL_ARGS_INVALID', async () => {
  const original = authoringLint.call;
  let invoked = false;
  authoringLint.call = async () => {
    invoked = true;
    return { status: 'complete', data: { ok: true } };
  };

  try {
    const response = await dispatcher.dispatch({
      method: 'tools/call',
      params: {
        id: 'html.authoring_lint',
        args: { package: 'deck.config.json', reportPath: 'somewhere.json' },
      },
      context: { cwd: repoRoot },
    });

    assert.equal(invoked, false, 'handler 必须在校验失败时完全不执行');
    assert.equal(response.status, 'error');
    assert.equal(response.error.code, 'TOOL_ARGS_INVALID');
    assert.equal(response.error.details.tool, 'html.authoring_lint');
    assert.equal(response.error.details.issues[0].arg, 'reportPath');
    assert.deepEqual(
      response.error.details.allowedArgs.sort(),
      ['format', 'gridTolerance', 'lintProfile', 'outDir', 'package', 'strict'],
    );
  } finally {
    authoringLint.call = original;
  }
});

test('dispatcher 对合法参数照常放行到 handler', async () => {
  const original = authoringLint.call;
  let received = null;
  authoringLint.call = async (args) => {
    received = args;
    return { status: 'complete', data: { ok: true } };
  };

  try {
    const response = await dispatcher.dispatch({
      method: 'tools/call',
      params: { id: 'html.authoring_lint', args: { package: 'deck.config.json', strict: true } },
      context: { cwd: repoRoot },
    });

    assert.equal(response.status, 'complete');
    assert.deepEqual(received, { package: 'deck.config.json', strict: true });
  } finally {
    authoringLint.call = original;
  }
});

// —— 通过态的报告产出（同一张单子的另一半）——
// outDir 过去只在失败路径生效，通过时什么都不写，指定了目录的调用方只看到一个空目录。

test('lint 通过且传了 outDir 时写报告、回 reportPath 与 artifact', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'lint-pass-report-outdir');
  fs.rmSync(outDir, { recursive: true, force: true });

  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      strict: true,
      outDir,
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);

  const reportPath = path.join(outDir, 'authoring-lint-report.json');
  assert.equal(response.data.reportPath, reportPath);
  assert.equal(fs.existsSync(reportPath), true, '通过态也必须真的把报告写下去');
  assert.equal(response.metrics.artifacts, 1);
  assert.deepEqual(
    response.artifacts.map((item) => ({ kind: item.kind, path: item.path })),
    [{ kind: 'json', path: reportPath }],
  );

  const written = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(written.ok, true);
  assert.equal('snapshot' in written, false, '报告不带浏览器快照');

  // 通过态不做失败快照归档：没有需要事后复盘的现场。
  const archived = fs.readdirSync(outDir).filter((name) => name.includes('.failed-'));
  assert.deepEqual(archived, []);
});

test('format:full 下 lint 通过但没传 outDir 时维持原状：不写文件、不回 artifact', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      strict: true,
      format: 'full',
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.reportPath, null);
  assert.deepEqual(response.artifacts, []);
  assert.equal(response.metrics.artifacts, 0);
});
