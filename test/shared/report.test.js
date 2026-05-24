const test = require('node:test');
const assert = require('node:assert/strict');
const { createReport, addMessage } = require('../../src/shared/report');

test('createReport stores info warning and error messages', () => {
  const report = createReport();
  addMessage(report, 'info', 'SNAPSHOT_START', 'Snapshot started', { source: 'deck.html' });
  addMessage(report, 'warning', 'UNSUPPORTED_CSS', 'Unsupported CSS property', { property: 'filter' });
  addMessage(report, 'error', 'MISSING_ASSET', 'Asset missing', { src: 'missing.pdf' });

  assert.equal(report.messages.length, 3);
  assert.equal(report.errorCount, 1);
  assert.equal(report.warningCount, 1);
});
