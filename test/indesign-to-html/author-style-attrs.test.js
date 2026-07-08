const test = require('node:test');
const assert = require('node:assert/strict');

const {
  authorInlineStyleForItem,
  textStyleCss,
} = require('../../src/writers/html/author-style-attrs');

test('author text style CSS snaps sub-millipixel InDesign jitter to stable px values', () => {
  assert.equal(
    textStyleCss({ pointSize: 45.0001, leading: 72.0002 }),
    'font-size:45px;line-height:72px',
  );
  assert.equal(
    textStyleCss({ pointSize: 29.3333, leading: 34.6667 }),
    'font-size:29.333px;line-height:34.667px',
  );
});

test('author inline style CSS normalizes retained reverse inlineStyle numeric jitter', () => {
  assert.equal(
    authorInlineStyleForItem({
      textStyle: { pointSize: 45.0001, leading: 72.0002 },
      inlineStyle: 'font-size:45.0001px; line-height:72.0002px; color:#0d0d0d',
    }),
    'font-size:45px;line-height:72px;color:#0d0d0d',
  );
});
