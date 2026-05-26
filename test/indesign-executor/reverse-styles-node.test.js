const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('reverseVisualStyle tolerates mixed InDesign graphic attributes', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse_styles.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(source, context);
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
