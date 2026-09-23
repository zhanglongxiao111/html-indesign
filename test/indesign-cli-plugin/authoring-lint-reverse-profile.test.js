// #13 P2：html.authoring_lint / html.build_indesign 的 lintProfile 参数，走真实插件入口。
// 作者包由反向写出器按 observation 模式真实生成，再模拟 Agent 在观察页上新增一个对象。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { writeAuthorPackageEntry } = require('../../src/authoring');
const { validateArgs } = require('../../src/indesign-cli-plugin/validate-args');
const { getSchema, getTool } = require('../../src/indesign-cli-plugin/tool-catalog');
const { lintFailureMessage } = require('../../src/indesign-cli-plugin/lint-feedback');
const { callPlugin, repoRoot } = require('./plugin-test-helper');

function observedModel() {
  return {
    kind: 'DocumentModel',
    id: 'observed-grid',
    title: 'Observed grid',
    reverseMode: 'observation',
    pages: [{
      id: 'page-1',
      width: 800,
      height: 450,
      sourceNode: { tagName: 'section', attributes: { 'data-id-layout': 'observed' } },
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      grid: { columns: 4, rows: 2, columnGutter: 20, rowGutter: 20 },
      items: [
        {
          id: 'observed-title',
          role: 'text',
          semantic: null,
          tagName: 'p',
          bounds: { x: 57, y: 63, width: 300, height: 60 },
          styleRefs: {},
          content: { text: '未标注标题', runs: [] },
          textStyle: { pointSize: 24, fillColor: '#123456' },
        },
        {
          id: 'observed-box',
          role: 'shape',
          semantic: null,
          bounds: { x: 233, y: 251, width: 150, height: 100 },
          styleRefs: {},
          visualStyle: { fill: '#cccccc' },
        },
      ],
    }],
  };
}

// Agent 新增的对象：不带任何观察态标记，左边 13px 压不住 40px 页边距起算的列线。
const AGENT_CARD = '<div id="agent-card" data-id-object data-id-role="shape" '
  + 'style="position:absolute;left:13px;top:13px;width:100px;height:50px;background:#eeeeee"></div>';

function observedPackage(name, { withAgentCard = false } = {}) {
  const outDir = path.join(repoRoot, 'test', 'workspace', name);
  fs.rmSync(outDir, { recursive: true, force: true });
  writeReverseAuthorPackage(observedModel(), { outDir, mode: 'observation' });
  if (withAgentCard) {
    const pagePath = path.join(outDir, 'pages', '00-page-1.html');
    const html = fs.readFileSync(pagePath, 'utf8');
    fs.writeFileSync(pagePath, html.replace('</section>', `  ${AGENT_CARD}\n</section>`), 'utf8');
    writeAuthorPackageEntry(path.join(outDir, 'deck.config.json'));
  }
  return outDir;
}

function callLint(packageDir, args = {}) {
  return callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: { package: path.join(packageDir, 'deck.config.json'), strict: true, ...args },
  });
}

test('schema：authoring_lint 与 build_indesign 都接受 lintProfile 合法值、拒绝非法值，旧名 profile 不再存在', () => {
  for (const id of ['html.authoring_lint', 'html.build_indesign']) {
    const schema = getSchema(id);
    assert.deepEqual(schema.properties.lintProfile.enum, ['default', 'reverse-export']);
    assert.equal(schema.properties.lintProfile.default, 'default');
    assert.equal(getTool(id).arg_names.includes('lintProfile'), true);
    assert.equal(getTool(id).arg_names.includes('profile'), false);
    assert.equal(schema.properties.profile, undefined);
    const oldName = validateArgs(schema, { package: 'deck.config.json', profile: 'reverse-export' });
    assert.equal(oldName[0].code, 'UNKNOWN_ARG');
    for (const value of ['default', 'reverse-export']) {
      assert.deepEqual(validateArgs(schema, { package: 'deck.config.json', lintProfile: value }), []);
    }
    const bad = validateArgs(schema, { package: 'deck.config.json', lintProfile: 'observation' });
    assert.equal(bad.length, 1);
    assert.equal(bad[0].code, 'ARG_NOT_IN_ENUM');
    assert.equal(bad[0].arg, 'lintProfile');
  }
});

test('插件入口拒绝非法 lintProfile，不带着无效参数跑出结果', () => {
  const packageDir = observedPackage('lint-profile-invalid');
  const response = callLint(packageDir, { lintProfile: 'reverse' });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'TOOL_ARGS_INVALID');
  assert.equal(response.error.details.issues[0].code, 'ARG_NOT_IN_ENUM');
});

test('真实反向导出包：default strict 报观察态对象，reverse-export 降级并计数', () => {
  const packageDir = observedPackage('lint-profile-observed');

  const strictDefault = callLint(packageDir);
  assert.equal(strictDefault.status, 'error');
  const defaultGrid = strictDefault.error.details.errors
    .filter((entry) => entry.code === 'GRID_ALIGNMENT_OFF')
    .map((entry) => entry.itemId)
    .sort();
  assert.deepEqual(defaultGrid, ['observed-box', 'observed-title']);
  assert.equal(strictDefault.error.details.lintProfile, 'default');
  assert.equal(strictDefault.error.details.metrics.grid_observed_downgraded_count, 0);

  const reverse = callLint(packageDir, { lintProfile: 'reverse-export' });
  assert.equal(reverse.status, 'complete', JSON.stringify(reverse.error || null));
  assert.equal(reverse.data.lintProfile, 'reverse-export');
  assert.equal(reverse.data.errorCount, 0);
  assert.equal(reverse.data.gridObservedDowngradedCount, 2);
  assert.deepEqual(reverse.data.notices.map((entry) => entry.itemId).sort(), ['observed-box', 'observed-title']);
  // 通过时也要看得见：汇总警告在 warnings 里，遥测里有同名蛇形计数。
  const summary = reverse.data.warnings.find((entry) => entry.code === 'GRID_OBSERVED_DOWNGRADED');
  assert.ok(summary, JSON.stringify(reverse.data.warnings));
  assert.equal(summary.count, 2);
  assert.equal(reverse.metrics.grid_observed_downgraded_count, 2);
});

test('真实反向导出包：Agent 新增的对象照常检查，首条消息点明降级数量', () => {
  const packageDir = observedPackage('lint-profile-agent-card', { withAgentCard: true });

  const response = callLint(packageDir, { lintProfile: 'reverse-export' });

  assert.equal(response.status, 'error');
  const gridErrors = response.error.details.errors.filter((entry) => entry.code === 'GRID_ALIGNMENT_OFF');
  assert.deepEqual(gridErrors.map((entry) => entry.itemId), ['agent-card']);
  assert.equal(response.error.details.gridObservedDowngradedCount, 2);
  assert.match(
    response.error.message,
    /Grid checks downgraded by lintProfile reverse-export: 2 observed object\(s\) are off-grid/,
  );
});

test('lintFailureMessage 只在确有降级时加那一句', () => {
  const errors = [{ level: 'error', code: 'GRID_ALIGNMENT_OFF', pageId: 'page-1', itemId: 'a', message: 'off' }];
  const without = lintFailureMessage({ errors, errorCount: 1 }, { strict: true });
  assert.doesNotMatch(without, /downgraded/);
  const withCount = lintFailureMessage({
    errors, errorCount: 1, gridObservedDowngradedCount: 120, lintProfile: 'reverse-export',
  }, { strict: true });
  assert.match(withCount, /lintProfile reverse-export: 120 observed object\(s\)/);
});

test('html.build_indesign 透传 lintProfile：reverse-export 下观察态对象不再挡住构建，降级在成功结果里可见', () => {
  const packageDir = observedPackage('build-profile-observed');
  const outDir = path.join(repoRoot, 'test', 'workspace', 'build-profile-observed-out');
  fs.rmSync(outDir, { recursive: true, force: true });
  const baseArgs = {
    package: path.join(packageDir, 'deck.config.json'),
    outDir,
    outputBaseName: 'observed',
    mode: 'draft',
    exportPdf: false,
    exportIdml: false,
  };

  const blocked = callPlugin('tools/call', { id: 'html.build_indesign', args: baseArgs });
  assert.equal(blocked.status, 'error');
  assert.equal(blocked.error.code, 'AUTHORING_LINT_FAILED');

  const started = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: { ...baseArgs, lintProfile: 'reverse-export' },
  });
  assert.equal(started.status, 'requires_host_actions', JSON.stringify(started.error || null));
  assert.equal(started.state.lintProfile, 'reverse-export');
  assert.equal(started.state.lintCounts.gridObservedDowngradedCount, 2);

  fs.writeFileSync(path.join(started.state.runDir, 'observed.indd'), 'fake');
  // 宿主动作序列随 draft / 导出开关变化；这里只管逐个应答，直到构建收尾。
  let complete = started;
  for (let step = 0; step < 6 && complete.status === 'requires_host_actions'; step += 1) {
    complete = callPlugin('tools/resume', {
      state: complete.state,
      host_results: complete.actions.map((action) => ({ id: action.id, status: 'complete', data: { ok: true } })),
    });
  }

  assert.equal(complete.status, 'complete', JSON.stringify(complete.error || null));
  const notice = complete.data.warnings.find((entry) => entry.code === 'GRID_OBSERVED_DOWNGRADED');
  assert.ok(notice, JSON.stringify(complete.data.warnings));
  assert.match(notice.message, /2 observed object\(s\)/);
  assert.equal(complete.metrics.grid_observed_downgraded_count, 2);
});
