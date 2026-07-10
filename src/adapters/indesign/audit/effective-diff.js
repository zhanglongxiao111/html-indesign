const {
  reverseSnapshotStructureSignature,
  compareReverseSnapshotStructures,
} = require('./reverse-snapshot-structure');

const P0_CODES = new Set([
  'REVERSE_SNAPSHOT_INPUT_INVALID',
  'REVERSE_SNAPSHOT_PAGE_COUNT_CHANGED',
  'REVERSE_SNAPSHOT_PAGE_MISSING',
  'REVERSE_SNAPSHOT_PAGE_EXTRA',
  'REVERSE_SNAPSHOT_TEXT_CHANGED',
  'REVERSE_SNAPSHOT_ASSET_CHANGED',
  'REVERSE_SNAPSHOT_ASSET_FIELD_CHANGED',
]);

const P1_CODES = new Set([
  'REVERSE_SNAPSHOT_PAGE_BOUNDS_CHANGED',
  'REVERSE_SNAPSHOT_BOUNDS_CHANGED',
  'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED',
  'REVERSE_SNAPSHOT_EFFECTS_CHANGED',
  'REVERSE_SNAPSHOT_VECTOR_GEOMETRY_CHANGED',
  'REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED',
  'REVERSE_SNAPSHOT_Z_ORDER_CHANGED',
  'REVERSE_SNAPSHOT_ITEM_MISSING',
  'REVERSE_SNAPSHOT_ITEM_EXTRA',
]);

const P2_CODES = new Set([
  'REVERSE_SNAPSHOT_PAGE_GUIDES_CHANGED',
  'REVERSE_SNAPSHOT_PAGE_MARGINS_CHANGED',
]);

const P2_ITEM_FIELDS = new Set([
  'layerName',
  'objectStyleName',
  'paragraphStyleName',
]);

const WEIGHTS = Object.freeze({
  p0: 100,
  p1: 10,
  p2: 1,
});

function auditEffectiveDiff(expectedSnapshot, actualSnapshot, options = {}) {
  const compareOptions = options.compareOptions || {};
  const expectedSignature = reverseSnapshotStructureSignature(expectedSnapshot || {}, compareOptions);
  const actualSignature = reverseSnapshotStructureSignature(actualSnapshot || {}, compareOptions);
  const comparison = compareReverseSnapshotStructures(expectedSignature, actualSignature, compareOptions);
  return effectiveDiffReport(comparison, options);
}

function effectiveDiffReport(comparison, options = {}) {
  const groups = {
    p0: bucket('p0'),
    p1: bucket('p1'),
    p2: bucket('p2'),
  };
  const errors = comparison && Array.isArray(comparison.errors) ? comparison.errors : [];
  for (const issue of errors) {
    const classified = {
      ...issue,
      ...classifyEffectiveDiffIssue(issue),
    };
    groups[classified.level].issues.push(classified);
  }
  for (const level of Object.keys(groups)) {
    groups[level].count = groups[level].issues.length;
    groups[level].score = groups[level].count * groups[level].weight;
  }
  groups.p0.ok = groups.p0.count === 0;
  groups.p1.budget = p1BudgetFor(options);
  groups.p1.ok = groups.p1.count <= groups.p1.budget;
  groups.p2.ok = true;

  const stability = stabilityGate(options);
  const edi = groups.p0.score + groups.p1.score + groups.p2.score;
  return {
    kind: 'EffectiveDiffAuditReport',
    ok: groups.p0.ok && groups.p1.ok && stability.ok,
    edi,
    weights: WEIGHTS,
    gates: {
      p0: 'must be zero',
      p1: `must be <= ${groups.p1.budget}`,
      p2: 'advisory only',
      stability: options.requireStabilityAudits ? 'at least one clean stability audit required' : 'provided stability audits must be clean',
    },
    p0: groups.p0,
    p1: groups.p1,
    p2: groups.p2,
    stability,
    comparison: {
      ok: Boolean(comparison && comparison.ok),
      errors: errors.length,
      warnings: comparison && Array.isArray(comparison.warnings) ? comparison.warnings.length : 0,
      expected: comparison && comparison.expected || null,
      actual: comparison && comparison.actual || null,
    },
  };
}

function classifyEffectiveDiffIssue(issue = {}) {
  if (issue.code === 'REVERSE_SNAPSHOT_TEXT_CHANGED' && sameEffectiveText(issue.expected, issue.actual)) {
    return { level: 'p2', category: 'normalization-difference', reason: 'text differs only by line indentation or trailing blank content' };
  }
  if ((issue.code === 'REVERSE_SNAPSHOT_ITEM_MISSING' || issue.code === 'REVERSE_SNAPSHOT_ITEM_EXTRA')
    && itemCarriesContent(issue)) {
    return { level: 'p0', category: 'content-loss', reason: 'a whole item carrying real text or a placed asset was lost or fabricated' };
  }
  if (P0_CODES.has(issue.code)) {
    return { level: 'p0', category: 'content-loss', reason: 'page text or asset identity changed' };
  }
  if (P2_CODES.has(issue.code)) {
    return { level: 'p2', category: 'normalization-difference', reason: 'page setup can differ in normalized output' };
  }
  if (issue.code === 'REVERSE_SNAPSHOT_ITEM_FIELD_CHANGED') {
    if (P2_ITEM_FIELDS.has(issue.field)) {
      return { level: 'p2', category: 'normalization-difference', reason: 'panel-facing style or layer name changed' };
    }
    return { level: 'p1', category: 'layout-object-loss', reason: 'item structural field changed' };
  }
  if (P1_CODES.has(issue.code)) {
    return { level: 'p1', category: 'layout-object-loss', reason: 'geometry paint placement or object matching changed' };
  }
  return { level: 'p1', category: 'unclassified-effective-diff', reason: 'unclassified issue defaults to effective layout risk' };
}

function itemCarriesContent(issue) {
  const text = typeof issue.text === 'string' ? issue.text.trim() : '';
  if (text) return true;
  return Boolean(issue.asset && (issue.asset.path || issue.asset.name));
}

function sameEffectiveText(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  return effectiveText(expected) === effectiveText(actual);
}

function effectiveText(value) {
  return String(value || '')
    .replace(/\r\n|\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n+$/g, '')
    .trim();
}

function bucket(level) {
  return {
    ok: false,
    level,
    weight: WEIGHTS[level],
    count: 0,
    score: 0,
    issues: [],
  };
}

function p1BudgetFor(options) {
  if (typeof options.p1Budget === 'number') {
    if (!Number.isFinite(options.p1Budget) || options.p1Budget < 0) {
      throw invalidBudget(`p1Budget must be a non-negative finite number, received: ${options.p1Budget}`);
    }
    return options.p1Budget;
  }
  const baseline = options.baselineReport || null;
  if (baseline) {
    const count = Number(baseline.p1 && baseline.p1.count);
    if (!Number.isFinite(count)) {
      throw invalidBudget('baseline report is missing a numeric p1.count; refusing to silently disable the P1 gate');
    }
    return count;
  }
  return 0;
}

function invalidBudget(message) {
  const error = new Error(`EFFECTIVE_DIFF_BUDGET_INVALID: ${message}`);
  error.code = 'EFFECTIVE_DIFF_BUDGET_INVALID';
  return error;
}

function stabilityGate(options) {
  const audits = Array.isArray(options.stabilityAudits) ? options.stabilityAudits : [];
  const failures = [];
  audits.forEach((audit, index) => {
    if (!isRecognizableStabilityAudit(audit)) {
      failures.push({
        index,
        ok: false,
        errors: null,
        reason: 'unrecognizable stability audit shape; refusing to treat missing evidence as clean',
      });
      return;
    }
    const errors = stabilityErrorCount(audit);
    if (audit.ok !== false && errors === 0) return;
    failures.push({
      index,
      ok: audit.ok !== false,
      errors,
    });
  });
  if (options.requireStabilityAudits && audits.length === 0) {
    failures.push({ index: null, ok: false, errors: 0, reason: 'missing required stability audit' });
  }
  return {
    available: audits.length > 0,
    auditCount: audits.length,
    ok: failures.length === 0,
    failures,
  };
}

function isRecognizableStabilityAudit(audit) {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return false;
  return Array.isArray(audit.errors)
    || typeof audit.errors === 'number'
    || (audit.comparison && Array.isArray(audit.comparison.errors))
    || typeof audit.ok === 'boolean';
}

function stabilityErrorCount(audit) {
  if (Array.isArray(audit.errors)) return audit.errors.length;
  if (audit.comparison && Array.isArray(audit.comparison.errors)) return audit.comparison.errors.length;
  if (typeof audit.errors === 'number') return audit.errors;
  return audit.ok === false ? 1 : 0;
}

module.exports = {
  auditEffectiveDiff,
  effectiveDiffReport,
  classifyEffectiveDiffIssue,
};
