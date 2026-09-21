// 回归：verified 的构建也要把保真警告的量级带回返回体。
// 现场：final 构建返回 verified=true，但报告里记着两处文字框 bounds 变化；返回体只给
// "warnings: 2" 一个计数，调用方无从知道是哪两个框、各长了多少（2026-09-08 起遥测 35 次）。
// 口径不变：expand-frame-to-content 在策略内的扩框仍是 warning，不升级为门禁失败——
// 它是作者自己声明允许的，升级会把所有用了该策略的作者包一并打挂。
const assert = require('node:assert/strict');
const { test } = require('node:test');

const { fidelityWarningDigest } = require('../../src/indesign-cli-plugin/tools/build-indesign');

// 取自 0.5.12 真实现场：page-10 / p10-el7，growX=33.5、growY=0。
const REAL_TEXT_FIT_WARNING = {
  code: 'FORWARD_TEXT_FIT_APPLIED',
  pageId: 'page-10',
  itemId: 'p10-el7',
  field: 'bounds',
  expected: { x: 650.75, y: 591.5, width: 618.48, height: 31 },
  actual: { x: 634.000000000005, y: 591.499999999998, width: 651.98, height: 31 },
  growX: 33.5,
  growY: 0,
};

test('没有警告时不产出 digest', () => {
  assert.equal(fidelityWarningDigest([]), null);
  assert.equal(fidelityWarningDigest(undefined), null);
});

test('digest 带总数、按 code 计数，并点名具体对象与扩框量', () => {
  const digest = fidelityWarningDigest([
    REAL_TEXT_FIT_WARNING,
    { ...REAL_TEXT_FIT_WARNING, itemId: 'p10-el9', growX: 4, growY: 0 },
  ]);

  assert.equal(digest.total, 2);
  assert.deepEqual(digest.byCode, { FORWARD_TEXT_FIT_APPLIED: 2 });
  assert.equal(digest.top.length, 2);
  assert.deepEqual(digest.top[0], {
    code: 'FORWARD_TEXT_FIT_APPLIED',
    pageId: 'page-10',
    itemId: 'p10-el7',
    field: 'bounds',
    growX: 33.5,
    growY: 0,
  });
  assert.equal(digest.omitted, undefined);
});

test('按几何变化量排序，最大的排在最前', () => {
  const digest = fidelityWarningDigest([
    { ...REAL_TEXT_FIT_WARNING, itemId: 'small', growX: 1, growY: 0 },
    { ...REAL_TEXT_FIT_WARNING, itemId: 'tall', growX: 0, growY: 88 },
    { ...REAL_TEXT_FIT_WARNING, itemId: 'wide', growX: 33.5, growY: 0 },
  ]);

  assert.deepEqual(digest.top.map((entry) => entry.itemId), ['tall', 'wide', 'small']);
});

test('超过上限时截断并说明省略了多少条', () => {
  const many = Array.from({ length: 9 }, (_unused, index) => ({
    ...REAL_TEXT_FIT_WARNING,
    itemId: `item-${index}`,
    growX: index,
  }));

  const digest = fidelityWarningDigest(many);

  assert.equal(digest.total, 9);
  assert.equal(digest.top.length, 5);
  assert.equal(digest.omitted, 4);
  assert.equal(digest.top[0].itemId, 'item-8', '截断保留的是最大的那几条，不是最先出现的');
});

test('不带 grow 的警告也进 digest，只是不编造几何字段', () => {
  const digest = fidelityWarningDigest([
    { code: 'FONT_FALLBACK_APPLIED', pageId: 'page-1', itemId: 'p1-el2' },
    REAL_TEXT_FIT_WARNING,
  ]);

  assert.equal(digest.total, 2);
  assert.deepEqual(digest.byCode, { FONT_FALLBACK_APPLIED: 1, FORWARD_TEXT_FIT_APPLIED: 1 });

  const fallback = digest.top.find((entry) => entry.code === 'FONT_FALLBACK_APPLIED');
  assert.equal('growX' in fallback, false);
  assert.equal('growY' in fallback, false);
  assert.equal(fallback.pageId, 'page-1');
});

test('code 缺失的警告不会把 digest 打崩', () => {
  const digest = fidelityWarningDigest([{ pageId: 'page-3' }]);

  assert.equal(digest.total, 1);
  assert.deepEqual(digest.byCode, { UNKNOWN: 1 });
});
