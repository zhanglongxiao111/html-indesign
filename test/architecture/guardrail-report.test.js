const test = require('node:test');
const assert = require('node:assert/strict');

const { formatGuardrailFailure } = require('./helpers/guardrail-report');

test('formatGuardrailFailure formats the required four failure fields', () => {
  const message = formatGuardrailFailure({
    rule: 'G1 dependency direction',
    reason: 'Adapters must not require writers.',
    remediation: 'Move orchestration to a writer or shared layer.',
    specPath: 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1',
    newViolations: [{ file: 'src/adapters/html/example.js', detail: 'requires src/writers/indesign/example.js' }],
    expiredExemptions: [{ file: 'src/old.js', detail: 'baseline entry no longer matches' }],
  });

  assert.match(message, /Rule: G1 dependency direction/);
  assert.match(message, /Reason: Adapters must not require writers\./);
  assert.match(message, /Remediation: Move orchestration to a writer or shared layer\./);
  assert.match(message, /Spec: docs\/superpowers\/specs\/2026-07-06-architecture-hardening-guardrails-design\.md#G1/);
  assert.match(message, /New violations/);
  assert.match(message, /Expired exemptions/);
});

test('formatGuardrailFailure rejects missing required failure fields', () => {
  assert.throws(
    () => formatGuardrailFailure({
      rule: 'G1 dependency direction',
      reason: 'Adapters must not require writers.',
      remediation: 'Move orchestration to a writer or shared layer.',
    }),
    /specPath is required/
  );
});

test('formatGuardrailFailure rejects multi-sentence reasons', () => {
  assert.throws(
    () => formatGuardrailFailure({
      rule: 'G1 dependency direction',
      reason: 'Adapters must not require writers. Writers own target-format output.',
      remediation: 'Move orchestration to a writer or shared layer.',
      specPath: 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1',
    }),
    /reason must be exactly one sentence/
  );
});

test('formatGuardrailFailure rejects malformed multi-sentence reasons without spaces', () => {
  assert.throws(
    () => formatGuardrailFailure({
      rule: 'G1 dependency direction',
      reason: 'A.B.',
      remediation: 'Move orchestration to a writer or shared layer.',
      specPath: 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1',
    }),
    /reason must be exactly one sentence/
  );
});

test('formatGuardrailFailure rejects Chinese or Japanese punctuation multi-sentence reasons', () => {
  assert.throws(
    () => formatGuardrailFailure({
      rule: 'G1 dependency direction',
      reason: 'A。B。',
      remediation: 'Move orchestration to a writer or shared layer.',
      specPath: 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1',
    }),
    /reason must be exactly one sentence/
  );
});

test('formatGuardrailFailure rejects multi-line reasons', () => {
  assert.throws(
    () => formatGuardrailFailure({
      rule: 'G1 dependency direction',
      reason: 'Adapters must not require writers.\nWriters own target-format output.',
      remediation: 'Move orchestration to a writer or shared layer.',
      specPath: 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1',
    }),
    /reason must be a single line/
  );
});
