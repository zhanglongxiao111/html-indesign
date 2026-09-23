const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { writeReportFile } = require('../../src/indesign-cli-plugin/report-archive');

test('failed reports get a timestamped archive pruned to the last three', () => {
  const dir = path.resolve('test/workspace/report-archive');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, 'authoring-lint-report.json');

  writeReportFile(reportPath, { ok: true }, { failed: false, runId: 'lint-test', tool: 'html.authoring_lint' });
  assert.deepEqual(fs.readdirSync(dir), ['authoring-lint-report.json']);

  for (const stamp of ['20260819-120001', '20260819-120002', '20260819-120003', '20260819-120004']) {
    writeReportFile(reportPath, { ok: false, stamp }, { failed: true, stamp, runId: `lint-${stamp}`, tool: 'html.authoring_lint' });
  }
  assert.deepEqual(fs.readdirSync(dir).sort(), [
    'authoring-lint-report.failed-20260819-120002.json',
    'authoring-lint-report.failed-20260819-120003.json',
    'authoring-lint-report.failed-20260819-120004.json',
    'authoring-lint-report.json',
  ]);
  assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).stamp, '20260819-120004');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, 'authoring-lint-report.failed-20260819-120002.json'), 'utf8')).stamp,
    '20260819-120002',
  );
});

test('default stamp is derived from the clock and archive write returns its path', () => {
  const dir = path.resolve('test/workspace/report-archive-default-stamp');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, 'forward-fidelity-report.json');
  const { archivedPath } = writeReportFile(reportPath, { errors: [{ code: 'X' }] }, {
    failed: true,
    runId: 'build-test',
    tool: 'html.build_indesign',
  });
  assert.ok(archivedPath);
  assert.match(path.basename(archivedPath), /^forward-fidelity-report\.failed-\d{8}-\d{6}\.json$/);
  assert.equal(fs.existsSync(archivedPath), true);
});
