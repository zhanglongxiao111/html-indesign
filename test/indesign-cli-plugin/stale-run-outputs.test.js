// #23：复用同一个 outDir 时，构建在任一阶段失败后，上一轮的交付物和中间产物不得原样留在 outDir
// 冒充本次成品。本轮没重写的移进 previous-output/，本轮写过的（失败现场）原位保留；
// 移不动的原位留下并在 reportWarnings 里点名；失败总写 BUILD_FAILED.json，成功后删掉。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot } = require('./plugin-test-helper');
const { writeAuthorPackageEntry } = require('../../src/authoring');
const {
  clearBuildFailedMarker,
  settleFailedRun,
  snapshotRunOutputs,
} = require('../../src/indesign-cli-plugin/run-outputs');

const GRID_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'authoring-lint', 'grid-alignment-package');
const ARCH_FIXTURE = path.join(repoRoot, 'test', 'fixtures', 'e2e', 'architecture-report');
const WORKSPACE = path.join(repoRoot, 'test', 'workspace');
const OFF_GRID_BLOCK = '  <p class="grid-item stray-note" style="--grid-col:2;--grid-span:2;'
  + '--grid-row:2;--grid-row-span:1;margin-left:3mm;margin-top:4mm">stray note</p>\n';

const DELIVERABLES = ['html-indesign-output.indd', 'html-indesign-output.pdf', 'html-indesign-output.idml'];
const INTERMEDIATES = [
  'instructions.json',
  'expected-semantic-model.json',
  'expected-semantic-preset.json',
  'fidelity-snapshot.json',
  'build.jsx',
  'fidelity-snapshot.jsx',
  'export.jsx',
  'cleanup.jsx',
];
const REPORTS = ['authoring-lint-report.json', 'compile-summary.json', 'forward-fidelity-report.json'];

function freshDir(name) {
  const dir = path.join(WORKSPACE, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 上一轮成功构建留在 outDir 里的全套文件：内容统一写成 "previous"，mtime 推到一小时前。
function seedPreviousRun(outDir, content = 'previous') {
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const name of [...DELIVERABLES, ...INTERMEDIATES]) {
    fs.writeFileSync(path.join(outDir, name), content, 'utf8');
    fs.utimesSync(path.join(outDir, name), anHourAgo, anHourAgo);
  }
  fs.mkdirSync(path.join(outDir, 'previews'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'previews', 'asset-1.png'), content, 'utf8');
  for (const name of REPORTS) {
    fs.writeFileSync(path.join(outDir, name), JSON.stringify({ runId: 'build-old', ok: true }), 'utf8');
  }
}

function lintFailingPackage(name) {
  const target = path.join(WORKSPACE, name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(GRID_FIXTURE, target, { recursive: true });
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
  return path.join(target, 'deck.config.json');
}

// 这个夹具的素材以 ../smoke-assets、../reference-pdfs 引用包外目录。
// withAssets:false 时只拷作者包：lint 通过，编译阶段因素材找不到而失败。
function architecturePackage(name, { withAssets }) {
  const root = path.join(WORKSPACE, name);
  fs.rmSync(root, { recursive: true, force: true });
  if (withAssets) {
    for (const shared of ['smoke-assets', 'reference-pdfs']) {
      fs.cpSync(path.join(ARCH_FIXTURE, '..', shared), path.join(root, shared), { recursive: true });
    }
  }
  fs.cpSync(ARCH_FIXTURE, path.join(root, 'architecture-report'), { recursive: true });
  return path.join(root, 'architecture-report', 'deck.config.json');
}

const ONE_BLANK_PAGE_SNAPSHOT = {
  document: { labels: [] },
  report: { ok: true, errors: [], oversetTextFrames: [] },
  parentPages: [],
  assets: [],
  layers: [],
  styles: {},
  pages: [{
    id: 'fake-page-1',
    index: 0,
    bounds: { x: 0, y: 0, width: 100, height: 80 },
    margins: { top: 5, right: 5, bottom: 5, left: 5 },
    guides: [],
    labels: [],
    items: [],
  }],
};

// 真实 fs 包一层：对 lockedPath 的 rename 一律报 EBUSY（模拟被 InDesign 打开的 INDD），其余放行。
function lockingFsFor(lockedPath) {
  return {
    ...fs,
    renameSync(from, to) {
      if (path.resolve(from) === lockedPath) {
        const error = new Error('EBUSY: resource busy or locked');
        error.code = 'EBUSY';
        throw error;
      }
      return fs.renameSync(from, to);
    },
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function warningOf(details, code) {
  return (details.reportWarnings || []).find((entry) => entry.code === code);
}

function assertMovedToPrevious(outDir, names, content = 'previous') {
  for (const name of names) {
    assert.equal(fs.existsSync(path.join(outDir, name)), false, `${name} 不得留在 outDir 冒充本次成品`);
    const archived = path.join(outDir, 'previous-output', name);
    const archivedFile = name === 'previews' ? path.join(archived, 'asset-1.png') : archived;
    assert.equal(fs.readFileSync(archivedFile, 'utf8'), content, `${name} 应原样移进 previous-output/`);
  }
}

test('lint 阶段失败：上一轮全部交付物和中间产物移进 previous-output/，写 BUILD_FAILED.json，报告留在原位', () => {
  const packagePath = lintFailingPackage('stale-outputs-lint-pkg');
  const outDir = freshDir('stale-outputs-lint-out');
  seedPreviousRun(outDir);

  const response = callPlugin('tools/call', { id: 'html.build_indesign', args: { package: packagePath, outDir } });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');
  const { details } = response.error;
  const moved = warningOf(details, 'PREVIOUS_OUTPUT_MOVED');
  assert.ok(moved, JSON.stringify(details.reportWarnings));
  assert.deepEqual([...moved.details.files].sort(), [...DELIVERABLES, ...INTERMEDIATES, 'previews'].sort());
  assert.equal(moved.details.previousOutputDir, path.join(outDir, 'previous-output'));
  assert.equal(warningOf(details, 'PREVIOUS_OUTPUT_NOT_MOVED'), undefined);
  assertMovedToPrevious(outDir, [...DELIVERABLES, ...INTERMEDIATES, 'previews']);

  // 三份主报告仍由 supersedeReports 原位处理：lint 报告是本次失败内容，其余是本次占位。
  for (const name of REPORTS) assert.equal(readJson(path.join(outDir, name)).runId, details.runId);
  assert.equal(fs.existsSync(path.join(outDir, 'previous-output', 'authoring-lint-report.json')), false);

  const marker = readJson(path.join(outDir, 'BUILD_FAILED.json'));
  assert.equal(marker.runId, details.runId);
  assert.equal(marker.tool, 'html.build_indesign');
  assert.equal(marker.status, 'build-failed');
  assert.equal(marker.errorCode, 'AUTHORING_LINT_FAILED');
  assert.equal(marker.stage, 'lint');
  assert.deepEqual(marker.notMoved, []);
  assert.equal(moved.details.markerPath, path.join(outDir, 'BUILD_FAILED.json'));
});

test('连续失败：previous-output/ 里同名旧副本只保留最近一份，没有更新副本的名字不动', () => {
  const packagePath = lintFailingPackage('stale-outputs-repeat-pkg');
  const outDir = freshDir('stale-outputs-repeat-out');
  seedPreviousRun(outDir, 'v1');

  const first = callPlugin('tools/call', { id: 'html.build_indesign', args: { package: packagePath, outDir } });
  assert.equal(first.error.code, 'AUTHORING_LINT_FAILED');

  // 第二次失败前，outDir 里又出现了一个 PDF 和一份 previews（例如别的流程写进来的旧版本）。
  fs.writeFileSync(path.join(outDir, 'html-indesign-output.pdf'), 'v2', 'utf8');
  fs.mkdirSync(path.join(outDir, 'previews'));
  fs.writeFileSync(path.join(outDir, 'previews', 'asset-2.png'), 'v2', 'utf8');

  const second = callPlugin('tools/call', { id: 'html.build_indesign', args: { package: packagePath, outDir } });
  assert.equal(second.error.code, 'AUTHORING_LINT_FAILED');
  const moved = warningOf(second.error.details, 'PREVIOUS_OUTPUT_MOVED');
  assert.deepEqual([...moved.details.files].sort(), ['html-indesign-output.pdf', 'previews']);

  const archive = path.join(outDir, 'previous-output');
  assert.equal(fs.readFileSync(path.join(archive, 'html-indesign-output.pdf'), 'utf8'), 'v2');
  assert.equal(fs.readFileSync(path.join(archive, 'html-indesign-output.indd'), 'utf8'), 'v1');
  assert.deepEqual(fs.readdirSync(path.join(archive, 'previews')), ['asset-2.png']);
  assert.equal(readJson(path.join(outDir, 'BUILD_FAILED.json')).runId, second.error.details.runId);
});

test('编译阶段失败：旧文件同样移走，BUILD_FAILED.json 记下 compile 阶段', () => {
  // 资源缺失、重复 id 这类作者包问题 lint 已经拦下（#25）；只取决于构建参数的 targetSize 比例不符仍到 compile 才失败。
  const packagePath = architecturePackage('stale-outputs-compile-pkg', { withAssets: true });
  const outDir = freshDir('stale-outputs-compile-out');
  seedPreviousRun(outDir);

  const response = callPlugin('tools/call', { id: 'html.build_indesign', args: { package: packagePath, outDir, targetSize: '1000x1000' } });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'TOOL_CALL_FAILED');
  assert.equal(response.error.details.stage, 'compile');
  const moved = warningOf(response.error.details, 'PREVIOUS_OUTPUT_MOVED');
  assert.deepEqual([...moved.details.files].sort(), [...DELIVERABLES, ...INTERMEDIATES, 'previews'].sort());
  assertMovedToPrevious(outDir, [...DELIVERABLES, ...INTERMEDIATES, 'previews']);
  // lint 已通过：lint 报告是本次写出的通过结论，留在原位。
  const lintReport = readJson(path.join(outDir, 'authoring-lint-report.json'));
  assert.equal(lintReport.runId, response.error.details.runId);
  assert.equal(lintReport.ok, true);
  const marker = readJson(path.join(outDir, 'BUILD_FAILED.json'));
  assert.equal(marker.stage, 'compile');
  assert.equal(marker.errorCode, 'TOOL_CALL_FAILED');
});

test('保真阶段失败：本轮重写的中间产物是失败现场、原位保留，旧 INDD/PDF/IDML 与旧 previews 移走', () => {
  const packagePath = architecturePackage('stale-outputs-fidelity-pkg', { withAssets: true });
  const outDir = freshDir('stale-outputs-fidelity-out');
  seedPreviousRun(outDir);

  const started = callPlugin('tools/call', { id: 'html.build_indesign', args: { package: packagePath, outDir } });
  assert.equal(started.status, 'requires_host_actions', JSON.stringify(started.error || null));
  const afterBuild = callPlugin('tools/resume', {
    state: started.state,
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterBuild.state.stage, 'snapshot');
  // 读回快照由本轮宿主脚本写出：一页空白页，对不上源 HTML 的 7 页，保真门禁必然失败。
  fs.writeFileSync(started.state.snapshotPath, JSON.stringify(ONE_BLANK_PAGE_SNAPSHOT), 'utf8');
  const afterSnapshot = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{ id: 'html-fidelity-snapshot', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterSnapshot.state.stage, 'cleanup');
  const response = callPlugin('tools/resume', {
    state: afterSnapshot.state,
    host_results: [{ id: 'html-build-cleanup', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'FIDELITY_GATE_FAILED');
  assert.equal(response.error.details.stage, 'fidelity');
  assert.equal(response.error.details.runId, started.state.runId);
  const moved = warningOf(response.error.details, 'PREVIOUS_OUTPUT_MOVED');
  assert.deepEqual([...moved.details.files].sort(), [...DELIVERABLES, 'previews'].sort());
  assertMovedToPrevious(outDir, [...DELIVERABLES, 'previews']);
  for (const name of INTERMEDIATES) {
    const file = path.join(outDir, name);
    assert.notEqual(fs.readFileSync(file, 'utf8'), 'previous', `${name} 是本轮写出的失败现场，必须原位保留`);
    assert.equal(fs.existsSync(path.join(outDir, 'previous-output', name)), false);
  }
  // 保真报告是本次写出的失败结论，同样原位保留。
  assert.equal(readJson(path.join(outDir, 'forward-fidelity-report.json')).runId, started.state.runId);
  const marker = readJson(path.join(outDir, 'BUILD_FAILED.json'));
  assert.equal(marker.runId, started.state.runId);
  assert.equal(marker.errorCode, 'FIDELITY_GATE_FAILED');
  assert.equal(marker.stage, 'fidelity');
});

test('移不动时原位保留、在 PREVIOUS_OUTPUT_NOT_MOVED 里点名，并写 BUILD_FAILED.json 清单', () => {
  const packagePath = lintFailingPackage('stale-outputs-blocked-pkg');
  const outDir = freshDir('stale-outputs-blocked-out');
  seedPreviousRun(outDir);
  // previous-output 被同名普通文件占住：建不了目录，所有移动都失败。
  fs.writeFileSync(path.join(outDir, 'previous-output'), 'not a directory', 'utf8');

  const response = callPlugin('tools/call', { id: 'html.build_indesign', args: { package: packagePath, outDir } });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');
  const { details } = response.error;
  assert.equal(warningOf(details, 'PREVIOUS_OUTPUT_MOVED'), undefined);
  const notMoved = warningOf(details, 'PREVIOUS_OUTPUT_NOT_MOVED');
  assert.ok(notMoved, JSON.stringify(details.reportWarnings));
  const names = notMoved.details.files.map((item) => item.name).sort();
  assert.deepEqual(names, [...DELIVERABLES, ...INTERMEDIATES, 'previews'].sort());
  for (const item of notMoved.details.files) {
    assert.equal(item.path, path.join(outDir, item.name));
    assert.ok(item.error, `${item.name} 必须带没移走的原因`);
    assert.equal(fs.existsSync(item.path), true);
  }
  assert.match(notMoved.message, /html-indesign-output\.pdf/);
  const marker = readJson(path.join(outDir, 'BUILD_FAILED.json'));
  assert.equal(marker.runId, details.runId);
  assert.deepEqual(marker.notMoved.map((item) => item.name).sort(), names);
  assert.deepEqual(marker.moved, []);
});

test('被占用（EBUSY）的文件重试后仍移不动：只它原位保留，其余照常移走，不抛错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-stale-outputs-'));
  for (const name of DELIVERABLES) fs.writeFileSync(path.join(dir, name), 'previous', 'utf8');
  const snapshot = snapshotRunOutputs(dir, 'html-indesign-output');
  const locked = path.join(dir, 'html-indesign-output.indd');
  const lockingFs = lockingFsFor(locked);

  const warnings = settleFailedRun({
    dir,
    baseName: 'html-indesign-output',
    snapshot,
    runId: 'build-20260925T000000-abcdef',
    tool: 'html.build_indesign',
    failure: { code: 'AUTHORING_LINT_FAILED', stage: 'lint' },
    fs: lockingFs,
    retry: { retries: 1, initialDelayMs: 0 },
  });

  const moved = warnings.find((entry) => entry.code === 'PREVIOUS_OUTPUT_MOVED');
  const notMoved = warnings.find((entry) => entry.code === 'PREVIOUS_OUTPUT_NOT_MOVED');
  assert.deepEqual(moved.details.files, ['html-indesign-output.pdf', 'html-indesign-output.idml']);
  assert.deepEqual(notMoved.details.files.map((item) => item.name), ['html-indesign-output.indd']);
  assert.match(notMoved.details.files[0].error, /EBUSY/);
  assert.equal(fs.existsSync(locked), true);

  // 一个都没移成（只剩被占用的那个）时，不留下空的 previous-output/。
  const onlyLocked = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-stale-outputs-'));
  fs.writeFileSync(path.join(onlyLocked, 'html-indesign-output.indd'), 'previous', 'utf8');
  const lockedAgain = path.join(onlyLocked, 'html-indesign-output.indd');
  settleFailedRun({
    dir: onlyLocked,
    baseName: 'html-indesign-output',
    snapshot: snapshotRunOutputs(onlyLocked, 'html-indesign-output'),
    runId: 'build-20260925T000000-abcdef',
    tool: 'html.build_indesign',
    failure: { code: 'AUTHORING_LINT_FAILED', stage: 'lint' },
    fs: lockingFsFor(lockedAgain),
    retry: { retries: 0, initialDelayMs: 0 },
  });
  assert.equal(fs.existsSync(path.join(onlyLocked, 'previous-output')), false);
  const marker = readJson(path.join(dir, 'BUILD_FAILED.json'));
  assert.equal(marker.runId, 'build-20260925T000000-abcdef');
  assert.deepEqual(marker.notMoved.map((item) => item.name), ['html-indesign-output.indd']);
});

test('OUTPUT_TARGET_OPEN：作者正在 InDesign 里打开的目标 INDD 不挪走，其余旧交付物照常移走', () => {
  const outDir = freshDir('stale-outputs-target-open');
  for (const name of DELIVERABLES) fs.writeFileSync(path.join(outDir, name), 'previous', 'utf8');
  const preRunOutputs = snapshotRunOutputs(outDir, 'html-indesign-output');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'final',
      runId: 'build-20260925T000000-0a0b0c',
      runDir: outDir,
      outputBaseName: 'html-indesign-output',
      exportPdf: true,
      exportIdml: true,
      preRunOutputs,
    },
    host_results: [{
      id: 'html-build-script',
      status: 'complete',
      data: { ok: false, errors: [{ code: 'OUTPUT_TARGET_OPEN', message: 'Target INDD is open in InDesign' }] },
    }],
  });

  assert.equal(response.error.code, 'OUTPUT_TARGET_OPEN');
  const notMoved = warningOf(response.error.details, 'PREVIOUS_OUTPUT_NOT_MOVED');
  assert.deepEqual(notMoved.details.files.map((item) => item.name), ['html-indesign-output.indd']);
  assert.match(notMoved.details.files[0].error, /OUTPUT_TARGET_OPEN/);
  assert.equal(fs.existsSync(path.join(outDir, 'html-indesign-output.indd')), true);
  const moved = warningOf(response.error.details, 'PREVIOUS_OUTPUT_MOVED');
  assert.deepEqual(moved.details.files, ['html-indesign-output.pdf', 'html-indesign-output.idml']);
});

test('构建成功后删掉上一次失败留下的 BUILD_FAILED.json', () => {
  const packagePath = architecturePackage('stale-outputs-success-pkg', { withAssets: true });
  const outDir = freshDir('stale-outputs-success-out');
  fs.writeFileSync(path.join(outDir, 'BUILD_FAILED.json'), JSON.stringify({ runId: 'build-old', status: 'build-failed' }));

  const started = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: { package: packagePath, outDir, mode: 'draft', exportPdf: false, exportIdml: false },
  });
  assert.equal(started.status, 'requires_host_actions', JSON.stringify(started.error || null));
  // 构建还没结束：旧标记仍在，它描述的那次失败在本次成功之前依然成立。
  assert.equal(fs.existsSync(path.join(outDir, 'BUILD_FAILED.json')), true);
  const afterBuild = callPlugin('tools/resume', {
    state: started.state,
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });
  fs.writeFileSync(path.join(outDir, 'html-indesign-output.indd'), 'this run', 'utf8');
  const complete = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{ id: 'html-export-script', status: 'complete', data: { ok: true } }],
  });

  assert.equal(complete.status, 'complete', JSON.stringify(complete.error || null));
  assert.equal(fs.existsSync(path.join(outDir, 'BUILD_FAILED.json')), false);
  assert.equal(complete.data.warnings.some((entry) => entry.code === 'BUILD_FAILED_MARKER_NOT_REMOVED'), false);
});

test('成功时删不掉旧 BUILD_FAILED.json：以 BUILD_FAILED_MARKER_NOT_REMOVED 报出路径，不抛错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-stale-marker-'));
  const markerPath = path.join(dir, 'BUILD_FAILED.json');
  fs.writeFileSync(markerPath, '{}', 'utf8');
  const lockingFs = {
    ...fs,
    unlinkSync() {
      const error = new Error('EPERM: operation not permitted');
      error.code = 'EPERM';
      throw error;
    },
  };

  const warnings = clearBuildFailedMarker(dir, { fs: lockingFs, retry: { retries: 0, initialDelayMs: 0 } });

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, 'BUILD_FAILED_MARKER_NOT_REMOVED');
  assert.equal(warnings[0].details.markerPath, markerPath);
  assert.match(warnings[0].details.error, /EPERM/);
  assert.deepEqual(clearBuildFailedMarker(path.join(dir, 'missing-dir')), []);
});
