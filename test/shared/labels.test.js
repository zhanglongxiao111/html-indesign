const test = require('node:test');
const assert = require('node:assert/strict');
const {
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
