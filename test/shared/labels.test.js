const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createProtocolLabel,
  parseProtocolLabel,
  normalizeStyleRef,
  labelDisplayPair,
  labelCoordinateUnit,
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
  normalizeLabel,
  findBySlotName,
} = require('../../src/shared/labels');

test('parseLabeledSegments parses Chinese and English label keys', () => {
  assert.deepEqual(
    parseLabeledSegments('名称：项目英文名\r\n类型：文本\r\n说明：根据项目中文名翻译'),
    { '名称': '项目英文名', '类型': '文本', '说明': '根据项目中文名翻译' }
  );
  assert.deepEqual(
    parseLabeledSegments('name: Hero\nslot: Cover Image\ntype: image'),
    { name: 'Hero', slot: 'Cover Image', type: 'image' }
  );
});

test('parseSlotName returns the stable short slot name', () => {
  assert.equal(parseSlotName('名称：项目英文名\r\n类型：文本'), '项目英文名');
  assert.equal(parseSlotName('slot: Hero Image\ntype: image'), 'Hero Image');
  assert.equal(parseSlotName('Plain Slot'), 'Plain Slot');
});

test('parseSlotType detects image and text labels', () => {
  assert.equal(parseSlotType('名称：主图\r\n类型：图像'), 'IMAGE');
  assert.equal(parseSlotType('slot: Body\ntype: text'), 'TEXT');
  assert.equal(parseSlotType('Plain Slot'), 'TEXT');
});

test('findBySlotName supports exact normalized and short-name lookup', () => {
  const slots = {
    '名称：项目英文名\r\n类型：文本': { id: 'a' },
    '名称：主图\r\n类型：图像': { id: 'b' },
  };
  assert.deepEqual(findBySlotName(slots, '名称：项目英文名\r\n类型：文本'), { key: '名称：项目英文名\r\n类型：文本', value: { id: 'a' } });
  assert.deepEqual(findBySlotName(slots, '项目英文名'), { key: '名称：项目英文名\r\n类型：文本', value: { id: 'a' } });
  assert.deepEqual(findBySlotName(slots, ' 主 图 '), { key: '名称：主图\r\n类型：图像', value: { id: 'b' } });
  assert.equal(findBySlotName(slots, '不存在'), null);
});

test('createProtocolLabel creates stable html_indesign payloads', () => {
  assert.deepEqual(createProtocolLabel({
    kind: 'item',
    id: 'agenda-title',
    source: 'html-to-indesign',
    role: 'text',
    semantic: 'page-title',
  }), {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id: 'agenda-title',
    source: 'html-to-indesign',
    role: 'text',
    semantic: 'page-title',
  });
});

test('parseProtocolLabel rejects invalid json and kind mismatches', () => {
  assert.equal(parseProtocolLabel('', { expectedKind: 'item' }).valid, false);
  assert.equal(parseProtocolLabel('{"protocol":"x"}', { expectedKind: 'item' }).valid, false);
  const parsed = parseProtocolLabel(JSON.stringify(createProtocolLabel({
    kind: 'page',
    id: 'page-1',
    source: 'html-to-indesign',
  })), { expectedKind: 'item' });
  assert.equal(parsed.valid, false);
  assert.equal(parsed.errors[0].code, 'LABEL_KIND_MISMATCH');
});

test('normalizeStyleRef preserves token and displayName separately', () => {
  assert.deepEqual(normalizeStyleRef({ token: 'page-title', displayName: '页面标题' }), {
    token: 'page-title',
    displayName: '页面标题',
  });
  assert.deepEqual(normalizeStyleRef('page-title'), {
    token: 'page-title',
    displayName: null,
  });
});

test('labelDisplayPair and labelCoordinateUnit provide stable defaults', () => {
  assert.deepEqual(labelDisplayPair('report-parent', '汇报母版'), {
    id: 'report-parent',
    name: '汇报母版',
  });
  assert.equal(labelCoordinateUnit({ coordinateUnit: 'pt' }), 'pt');
  assert.equal(labelCoordinateUnit({ unitMode: 'print' }), 'mm');
});
