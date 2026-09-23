// #13 P2：从人做的 INDD 反向导出的包里，观察态对象大面积压不住网格（北小河一次 120 条
// GRID_ALIGNMENT_OFF），Agent 只能批量贴 data-id-grid-ignore 把 lint 压绿。
// profile: reverse-export 让观察态对象的网格偏移降为提示，但必须计数、必须留汇总警告，
// 且 Agent 新增或改写的对象照常检查。
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAuthoringRules } = require('../../src/adapters/html');
const {
  AUTHORING_LINT_PROFILE_NAMES,
  DEFAULT_AUTHORING_LINT_PROFILE,
  resolveAuthoringLintProfile,
} = require('../../src/adapters/html');

const OBSERVATION_PAGE_ATTRS = {
  'data-id-margin': '10mm',
  'data-id-grid': '4x2',
  'data-id-observed': 'true',
  'data-id-reverse-mode': 'observation',
};

// 页边距 10mm、4x2 网格：x=13 的左边压不住任何列线。
const OFF_GRID_BOUNDS = { x: 13, y: 10, width: 20, height: 30 };

function observedText(id) {
  return {
    id,
    role: 'text',
    tagName: 'p',
    classList: ['observed-text', 'id-object'],
    attributes: {},
    boundsMm: { ...OFF_GRID_BOUNDS },
  };
}

function observedShape(id) {
  return {
    id,
    role: 'shape',
    tagName: 'div',
    classList: ['id-object'],
    attributes: { 'data-id-object': '' },
    boundsMm: { ...OFF_GRID_BOUNDS },
  };
}

function agentShape(id) {
  return {
    id,
    role: 'shape',
    tagName: 'div',
    classList: ['metric-card'],
    attributes: { 'data-id-object-style': 'metric-card' },
    boundsMm: { ...OFF_GRID_BOUNDS },
  };
}

function snapshotWithPage(overrides = {}) {
  return {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 1200, height: 800 },
      attributes: overrides.attributes || {},
      classList: ['page'],
      authoredStyle: {},
      computedStyle: {},
      items: overrides.items || [],
    }],
  };
}

function gridCodes(entries) {
  return entries.filter((entry) => entry.code === 'GRID_ALIGNMENT_OFF').map((entry) => entry.itemId);
}

test('profile 取值：默认 default，只接受登记的档位', () => {
  assert.deepEqual([...AUTHORING_LINT_PROFILE_NAMES], ['default', 'reverse-export']);
  assert.equal(DEFAULT_AUTHORING_LINT_PROFILE, 'default');
  assert.equal(resolveAuthoringLintProfile(undefined), 'default');
  assert.equal(resolveAuthoringLintProfile('reverse-export'), 'reverse-export');
  assert.throws(() => resolveAuthoringLintProfile('reverse'), (error) => error.code === 'INVALID_ARGS');
  assert.throws(
    () => validateAuthoringRules(snapshotWithPage(), { profile: 'observation' }),
    (error) => error.code === 'INVALID_ARGS',
  );
});

test('reverse-export 下观察态对象的网格偏移降为提示，计数正确且留一条汇总警告', () => {
  const snapshot = snapshotWithPage({
    attributes: OBSERVATION_PAGE_ATTRS,
    items: [observedText('obs-text'), observedShape('obs-shape')],
  });

  const result = validateAuthoringRules(snapshot, { profile: 'reverse-export', gridTolerance: 0.5 });

  assert.equal(result.profile, 'reverse-export');
  assert.equal(result.valid, true);
  assert.deepEqual(gridCodes(result.errors), []);
  assert.deepEqual(gridCodes(result.warnings), []);
  assert.equal(result.gridObservedDowngradedCount, 2);
  // 降级的条目量过（算 checked），但不再算作偏差。
  assert.equal(result.gridCheckedCount, 2);
  assert.equal(result.gridOffCount, 0);

  assert.deepEqual(result.notices.map((entry) => entry.itemId), ['obs-text', 'obs-shape']);
  for (const notice of result.notices) {
    assert.equal(notice.level, 'info');
    assert.equal(notice.code, 'GRID_ALIGNMENT_OFF');
    assert.equal(notice.observed, true);
    assert.equal(notice.downgradedBy, 'reverse-export');
    assert.ok(Array.isArray(notice.edgeOffsets) && notice.edgeOffsets.length);
  }

  // 豁免不能不声不响：一条汇总警告写明本次降级了几个对象。
  const summary = result.warnings.filter((entry) => entry.code === 'GRID_OBSERVED_DOWNGRADED');
  assert.equal(summary.length, 1);
  assert.equal(summary[0].count, 2);
  assert.equal(summary[0].strictBlocking, false);
  assert.match(summary[0].message, /grid checks for 2 observed object\(s\) were downgraded/);
});

test('reverse-export + strict：观察态对象不被提升为 error，汇总警告也不提升', () => {
  const snapshot = snapshotWithPage({
    attributes: OBSERVATION_PAGE_ATTRS,
    items: [observedText('obs-text'), observedShape('obs-shape')],
  });

  const result = validateAuthoringRules(snapshot, { profile: 'reverse-export', strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings.map((entry) => entry.code), ['GRID_OBSERVED_DOWNGRADED']);
  assert.equal(result.gridObservedDowngradedCount, 2);
});

test('reverse-export 下非观察态对象照常检查，strict 下照常提升为 error', () => {
  const snapshot = snapshotWithPage({
    attributes: OBSERVATION_PAGE_ATTRS,
    // agent-card 放在观察页上，但不带任何观察态标记：它是 Agent 新增或改写的对象。
    items: [observedShape('obs-shape'), agentShape('agent-card')],
  });

  const loose = validateAuthoringRules(snapshot, { profile: 'reverse-export', gridTolerance: 0.5 });
  assert.deepEqual(gridCodes(loose.warnings), ['agent-card']);
  assert.equal(loose.gridOffCount, 1);
  assert.equal(loose.gridObservedDowngradedCount, 1);

  const strict = validateAuthoringRules(snapshot, { profile: 'reverse-export', strict: true, gridTolerance: 0.5 });
  assert.equal(strict.valid, false);
  assert.deepEqual(gridCodes(strict.errors), ['agent-card']);
  assert.equal(strict.errors.find((entry) => entry.itemId === 'agent-card').level, 'error');
  assert.deepEqual(strict.notices.map((entry) => entry.itemId), ['obs-shape']);
});

test('观察态只认对象自身证据：观察页上不带 id-object 的对象照常检查，非观察页上的 id-object 也照常检查', () => {
  const plainOnObservedPage = { ...agentShape('plain'), classList: [] };
  const observedPage = validateAuthoringRules(snapshotWithPage({
    attributes: OBSERVATION_PAGE_ATTRS,
    items: [plainOnObservedPage],
  }), { profile: 'reverse-export', gridTolerance: 0.5 });
  assert.deepEqual(gridCodes(observedPage.warnings), ['plain']);
  assert.equal(observedPage.gridObservedDowngradedCount, 0);

  const structuredPage = validateAuthoringRules(snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2' },
    items: [observedShape('id-object-only')],
  }), { profile: 'reverse-export', gridTolerance: 0.5 });
  assert.deepEqual(gridCodes(structuredPage.warnings), ['id-object-only']);
  assert.equal(structuredPage.gridObservedDowngradedCount, 0);
});

test('对象自身的观察标记与降级观察标签在任何页面上都算观察态', () => {
  const pageAttrs = { 'data-id-margin': '10mm', 'data-id-grid': '4x2' };
  const items = [
    { ...agentShape('own-observed'), attributes: { 'data-id-observed': 'true' } },
    { ...agentShape('own-mode'), attributes: { 'data-id-reverse-mode': 'observation' } },
    { ...agentShape('label-rejected'), attributes: { 'data-id-observed-label-status': 'rejected' } },
    { ...agentShape('observed-text'), role: 'text', classList: ['observed-text'] },
  ];

  const result = validateAuthoringRules(snapshotWithPage({ attributes: pageAttrs, items }), {
    profile: 'reverse-export',
    gridTolerance: 0.5,
  });

  assert.deepEqual(gridCodes(result.warnings), []);
  assert.equal(result.gridObservedDowngradedCount, 4);
});

test('default profile 行为不变：观察态对象照常报 GRID_ALIGNMENT_OFF，strict 下提升为 error', () => {
  const snapshot = snapshotWithPage({
    attributes: OBSERVATION_PAGE_ATTRS,
    items: [observedText('obs-text'), observedShape('obs-shape')],
  });

  const implicit = validateAuthoringRules(snapshot, { gridTolerance: 0.5 });
  const explicit = validateAuthoringRules(snapshot, { profile: 'default', gridTolerance: 0.5 });
  for (const result of [implicit, explicit]) {
    assert.equal(result.profile, 'default');
    assert.deepEqual(gridCodes(result.warnings), ['obs-text', 'obs-shape']);
    assert.equal(result.gridOffCount, 2);
    assert.equal(result.gridObservedDowngradedCount, 0);
    assert.deepEqual(result.notices, []);
    assert.equal(result.warnings.some((entry) => entry.code === 'GRID_OBSERVED_DOWNGRADED'), false);
  }

  const strict = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });
  assert.deepEqual(gridCodes(strict.errors), ['obs-text', 'obs-shape']);
});

test('reverse-export 不影响其他规则：观察页上的其他错误照常报出', () => {
  const snapshot = snapshotWithPage({
    // 缺网格声明：网格检查本身不跑，PAGE_GRID_RULE_MISSING 照报。
    attributes: { 'data-id-margin': '10mm', 'data-id-observed': 'true', 'data-id-reverse-mode': 'observation' },
    items: [{
      ...observedShape('graphic-without-source'),
      role: 'graphic',
      attributes: { 'data-id-role': 'graphic' },
    }],
  });

  const result = validateAuthoringRules(snapshot, { profile: 'reverse-export', strict: true });

  const codes = result.errors.map((entry) => entry.code).sort();
  assert.deepEqual(codes, ['GRAPHIC_ASSET_REFERENCE_MISSING', 'PAGE_GRID_RULE_MISSING']);
  assert.equal(result.gridObservedDowngradedCount, 0);
});
