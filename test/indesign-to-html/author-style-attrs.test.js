const test = require('node:test');
const assert = require('node:assert/strict');

const {
  authorInlineStyleForItem,
  textStyleCss,
} = require('../../src/writers/html/author-style-attrs');
const {
  inlineResidualForSynth,
} = require('../../src/writers/html/author-style-residual');

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

test('inline synth residual removes only equivalent covered properties', () => {
  const result = inlineResidualForSynth({
    inlineCss: 'font-size:45.0001px;line-height:72px;color:#0D0D0D;z-index:4',
    token: 'synth_text_001',
    synthesizedStyles: [{
      token: 'synth_text_001',
      kind: 'text',
      properties: { pointSize: 45, leading: 72, fillColor: '#0d0d0d' },
    }],
  });

  assert.equal(result.css, 'z-index:4');
  assert.deepEqual(result.removed, ['font-size', 'line-height', 'color']);
  assert.equal(result.reason, 'synth-covered');
});

test('inline synth residual preserves different values and missing synth rules', () => {
  const styles = [{
    token: 'synth_text_001',
    kind: 'text',
    properties: { pointSize: 45, fillColor: '#0d0d0d' },
  }];

  assert.equal(inlineResidualForSynth({
    inlineCss: 'font-size:45px;color:#ff0000',
    token: 'synth_text_001',
    synthesizedStyles: styles,
  }).css, 'color:#ff0000');
  assert.deepEqual(inlineResidualForSynth({
    inlineCss: 'font-size:45px;color:#ff0000',
    token: 'missing-token',
    synthesizedStyles: styles,
  }), {
    css: 'font-size:45px;color:#ff0000',
    removed: [],
    reason: 'synth-rule-missing',
  });
});

test('author inline residual always preserves source styles and item overrides', () => {
  const css = authorInlineStyleForItem({
    styleRefs: { synthesizedToken: 'synth_text_001' },
    textStyle: { pointSize: 45, leading: 72, fillColor: '#ff0000' },
    styleOverrides: { text: { fillColor: '#ff0000' } },
  }, 'color:#123456;--grid-col:2', {
    synthesizedStyles: [{
      token: 'synth_text_001',
      kind: 'text',
      properties: { pointSize: 45, leading: 72, fillColor: '#0d0d0d' },
    }],
  });

  assert.equal(css, 'color:#ff0000;--grid-col:2');
});

test('author inline residual can be disabled for trusted and special renderers', () => {
  const css = authorInlineStyleForItem({
    styleRefs: { synthesizedToken: 'synth_text_001' },
    textStyle: { pointSize: 45, fillColor: '#0d0d0d' },
  }, '', {
    disableSynthResidual: true,
    synthesizedStyles: [{
      token: 'synth_text_001',
      kind: 'text',
      properties: { pointSize: 45, fillColor: '#0d0d0d' },
    }],
  });

  assert.equal(css, 'font-size:45px;color:#0d0d0d');
});
