const test = require('node:test');
const assert = require('node:assert/strict');

const { auditSynthesizedStyles } = require('../../src/adapters/indesign/audit/synthesized-style-audit');

test('audit passes for a complete synthesized style registry', () => {
  const report = auditSynthesizedStyles({
    kind: 'DocumentModel',
    styles: {
      synthesized: [{
        token: 'synth_line_001',
        displayName: '线条样式 01',
        kind: 'line',
        fingerprint: 'line:abc',
        properties: { strokeStyle: '虚线（3 和 2）' },
      }],
    },
    pages: [{
      id: 'p1',
      items: [{
        id: 'line-a',
        styleRefs: {
          synthesizedToken: 'synth_line_001',
          synthesizedName: '线条样式 01',
        },
      }],
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.issues.length, 0);
  assert.equal(report.summary.styleCount, 1);
  assert.equal(report.summary.referenceCount, 1);
});

test('audit fails when an item references a missing synthesized style token', () => {
  const report = auditSynthesizedStyles({
    kind: 'DocumentModel',
    styles: { synthesized: [] },
    pages: [{
      id: 'p1',
      items: [{
        id: 'line-a',
        styleRefs: { synthesizedToken: 'synth_line_001' },
      }],
    }],
  });

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].code, 'SYNTHESIZED_STYLE_REF_MISSING');
  assert.equal(report.issues[0].itemId, 'line-a');
});

test('audit fails for duplicate tokens and missing Chinese display names', () => {
  const report = auditSynthesizedStyles({
    kind: 'DocumentModel',
    styles: {
      synthesized: [
        { token: 'synth_text_001', kind: 'text', fingerprint: 'text:a', properties: {} },
        { token: 'synth_text_001', displayName: '文字样式 01', kind: 'text', fingerprint: 'text:b', properties: {} },
      ],
    },
    pages: [],
  });

  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.code === 'SYNTHESIZED_STYLE_DISPLAY_NAME_MISSING'), true);
  assert.equal(report.issues.some((issue) => issue.code === 'SYNTHESIZED_STYLE_TOKEN_DUPLICATED'), true);
});
