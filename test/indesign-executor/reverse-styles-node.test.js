const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadReverseStylesContext() {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse_styles.jsxinc'), 'utf8');
  const context = {
    HI: {},
    ColorSpace: {
      RGB: 'RGB',
      CMYK: 'CMYK',
    },
  };
  vm.runInNewContext(source, context);
  return context;
}

test('reverseVisualStyle tolerates mixed InDesign graphic attributes', () => {
  const context = loadReverseStylesContext();
  Object.assign(context.HI, {
    reverseColor(value) {
      return value || null;
    },
    positiveNumberOrNull(value) {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : null;
    },
    reverseOpacity() {
      return null;
    },
    reverseCornerRadius() {
      return null;
    },
  });

  const item = {};
  for (const prop of ['fillColor', 'strokeColor', 'strokeWeight']) {
    Object.defineProperty(item, prop, {
      get() {
        throw new Error('multiple values');
      },
    });
  }

  const visualStyle = context.HI.reverseVisualStyle(item);
  assert.equal(visualStyle.fillColor, null);
  assert.equal(visualStyle.strokeColor, null);
  assert.equal(visualStyle.strokeWeight, null);
  assert.equal(visualStyle.opacity, null);
  assert.equal(visualStyle.cornerRadius, null);
});

test('reverseColor preserves unnamed RGB process colors from InDesign page items', () => {
  const context = loadReverseStylesContext();

  const color = {
    isValid: true,
    name: '',
    space: 'RGB',
    colorValue: [255, 222, 189],
  };

  assert.equal(context.HI.reverseColor(color), '#ffdebd');
});

test('reverseVisualStyle treats empty InDesign stroke color as no stroke', () => {
  const context = loadReverseStylesContext();

  const emptyStrokeColor = {
    isValid: true,
    name: '',
    space: 'RGB',
    colorValue: [0, 0, 0],
  };
  const item = {
    strokeColor: emptyStrokeColor,
    strokeWeight: 0.28346456692913,
  };

  const visualStyle = context.HI.reverseVisualStyle(item);

  assert.equal(visualStyle.strokeColor, null);
  assert.equal(visualStyle.strokeWeight, null);
});
