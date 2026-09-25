const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadReverseStylesContext({ withEffects = false } = {}) {
  const libs = ['hi_reverse_styles.jsxinc', ...(withEffects ? ['hi_reverse_effects.jsxinc'] : [])];
  const context = {
    HI: {},
    ColorSpace: {
      RGB: 'RGB',
      CMYK: 'CMYK',
    },
  };
  vm.createContext(context);
  for (const lib of libs) {
    vm.runInContext(fs.readFileSync(path.resolve('_indesign_scripts/lib', lib), 'utf8'), context);
  }
  return context;
}

// 模拟 InDesign DOM：constructor.name 与真实对象一致；Gradient 上读 colorValue 会抛错（issue #9 的触发点）。
class Color {
  constructor(name, space, colorValue) {
    Object.assign(this, { isValid: true, name, space, colorValue });
  }
}
class Tint {
  constructor(name, space, colorValue, tintValue) {
    Object.assign(this, { isValid: true, name, space, colorValue, tintValue });
  }
}
class MixedInk {
  constructor(name) {
    Object.assign(this, { isValid: true, name });
  }

  get colorValue() {
    throw new Error("Object does not support the property or method 'colorValue'");
  }
}
class Gradient {
  constructor(name, type, stops) {
    Object.assign(this, { isValid: true, name, type, gradientStops: stops });
  }

  get colorValue() {
    throw new Error("Object does not support the property or method 'colorValue'");
  }

  get space() {
    throw new Error("Object does not support the property or method 'space'");
  }
}
class Swatch {
  constructor(element) {
    Object.assign(this, { isValid: true, name: element.name, element });
  }

  getElements() {
    return [this.element];
  }
}

const GRADIENT_TYPE_LINEAR = 1635282023;
const GRADIENT_TYPE_RADIAL = 1918985319;

function sampleGradient(type = GRADIENT_TYPE_LINEAR) {
  return new Gradient('Grad-Used', type, [
    { stopColor: new Color('G-Red', 'CMYK', [0, 100, 100, 0]), location: 0 },
    { stopColor: new Color('G-Blue', 'RGB', [0, 0, 255]), location: 100 },
  ]);
}

function trackGradientWarnings(context) {
  const messages = [];
  context.HI.addMessage = (report, level, code, message, details) => {
    messages.push({ level, code, message, details: JSON.parse(JSON.stringify(details)) });
  };
  context.HI.reverseBeginGradientTracking({});
  return messages;
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

test('reverseColor approximates gradient swatches by their first stop without throwing (#9)', () => {
  const context = loadReverseStylesContext({ withEffects: true });
  const messages = trackGradientWarnings(context);
  context.HI.reverseSetGradientOwner({ styleKind: 'paragraph', styleName: 'GradPara' });

  assert.equal(context.HI.reverseColor(sampleGradient()), '#ff0000');
  assert.equal(context.HI.reverseColor(new Swatch(sampleGradient())), '#ff0000');
  assert.equal(context.HI.characterStyleCss({ fillColor: sampleGradient() }), 'color:#ff0000');

  assert.equal(messages.length, 1, 'same owner and gradient should warn once');
  assert.equal(messages[0].level, 'warning');
  assert.equal(messages[0].code, 'REVERSE_GRADIENT_APPROXIMATED');
  assert.deepEqual(messages[0].details, {
    gradient: 'Grad-Used',
    approximatedColor: '#ff0000',
    styleKind: 'paragraph',
    styleName: 'GradPara',
  });
});

test('reverseVisualStyle keeps first-stop hex colors and attaches gradient facts with item id (#9)', () => {
  const context = loadReverseStylesContext({ withEffects: true });
  const messages = trackGradientWarnings(context);
  context.HI.reverseSetGradientOwner({ itemId: '291' });

  const item = {
    fillColor: new Swatch(sampleGradient()),
    gradientFillAngle: 30,
    strokeColor: sampleGradient(GRADIENT_TYPE_RADIAL),
    gradientStrokeAngle: 0,
    strokeWeight: 6,
  };
  const visualStyle = context.HI.reverseVisualStyle(item);

  assert.equal(visualStyle.fillColor, '#ff0000');
  assert.equal(visualStyle.strokeColor, '#ff0000');
  assert.equal(visualStyle.strokeWeight, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(visualStyle.fillGradient)), {
    type: 'linear',
    angle: 30,
    stops: [{ color: '#ff0000', location: 0 }, { color: '#0000ff', location: 100 }],
  });
  assert.equal(visualStyle.strokeGradient.type, 'radial');
  assert.equal(String(visualStyle.fillColor).includes('gradient'), false, 'never emit multi-color CSS gradients');
  assert.deepEqual(messages.map((entry) => [entry.code, entry.details.itemId]), [
    ['REVERSE_GRADIENT_APPROXIMATED', '291'],
  ]);
});

test('reverseVisualStyle leaves solid fills without gradient fields', () => {
  const context = loadReverseStylesContext({ withEffects: true });
  const visualStyle = context.HI.reverseVisualStyle({ fillColor: new Color('Blue', 'RGB', [0, 0, 255]) });

  assert.equal(visualStyle.fillColor, '#0000ff');
  assert.equal(Object.prototype.hasOwnProperty.call(visualStyle, 'fillGradient'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(visualStyle, 'strokeGradient'), false);
});

test('reverseColor reads tints and mixed inks without escaping try/catch', () => {
  const context = loadReverseStylesContext({ withEffects: true });

  assert.equal(context.HI.reverseColor(new Tint('Red 40%', 'CMYK', [0, 100, 100, 0], 40)), '#ff0000');
  assert.equal(context.HI.reverseColor(new MixedInk('Mixed')), null);
  assert.equal(context.HI.reverseColor(new Swatch(new MixedInk('Mixed'))), null);
});

test('real InDesign gradient probe fixture matches the reverse gradient assumptions (#9)', () => {
  const probe = require('../fixtures/indesign-gradient-swatches/probe-indesign-20.0.1.32.json');
  assert.deepEqual(probe.steps.filter((step) => !step.ok), []);

  // 缺陷事实：取反后直接用于 if/return/三元/while 会逃出 try/catch；先赋值再取反不会。
  const escaped = Object.fromEntries(probe.tryCatchBypass.map((entry) => [entry.form, entry.escaped]));
  for (const form of ['if (!o.p) return', 'if (!(o.p)) return', 'return !o.p', '!o.p ? a : b', 'while (!o.p)', 'if (a || !o.p)', 'if (a && !o.p)']) {
    assert.equal(escaped[form], true, form);
  }
  for (const form of ['var v = o.p; if (!v)', 'var b = !o.p', 'if (o.p == null)', 'if (o.p)']) {
    assert.equal(escaped[form], false, form);
  }

  const used = probe.gradients.find((gradient) => gradient.name === 'Grad-Used');
  assert.equal(used.kind, 'Gradient');
  assert.equal(used.colorValueReadable, false);
  assert.equal(probe.swatchWrapper.resolvedKind, 'Gradient');
  assert.equal(probe.gradientType.RADIAL, GRADIENT_TYPE_RADIAL);
  assert.match(fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse_effects.jsxinc'), 'utf8'), new RegExp(String(GRADIENT_TYPE_RADIAL)));

  const context = loadReverseStylesContext({ withEffects: true });
  context.ColorSpace = { RGB: 1666336578, CMYK: 1129142603 };
  const fake = (gradient) => new Gradient(gradient.name, gradient.type, gradient.stops.map((stop) => ({
    location: stop.location,
    stopColor: new Color(stop.stopColor.name, stop.stopColor.space, stop.stopColor.colorValue),
  })));
  const visualStyle = context.HI.reverseVisualStyle({ fillColor: new Swatch(fake(used)), gradientFillAngle: 0 });
  assert.equal(visualStyle.fillColor, '#ff0000');
  assert.deepEqual(JSON.parse(JSON.stringify(visualStyle.fillGradient.stops)), [
    { color: '#ff0000', location: 0 },
    { color: '#0000ff', location: 100 },
  ]);
  const unused = probe.gradients.find((gradient) => gradient.name === 'Grad-Unused');
  assert.equal(context.HI.reverseGradientVisualStyle({ fillColor: fake(unused) }).fillGradient.type, 'radial');
});

test('reverse text style reads InDesign capitalization as allCaps / smallCaps and writes text-transform (#34)', () => {
  const context = loadReverseStylesContext();
  context.Capitalization = { NORMAL: 1852797549, ALL_CAPS: 1634493296, SMALL_CAPS: 1664250723 };
  context.Justification = { LEFT_ALIGN: 1, CENTER_ALIGN: 2, RIGHT_ALIGN: 3 };
  const { HI } = context;

  assert.equal(HI.reverseCapitalization(context.Capitalization.ALL_CAPS), 'allCaps');
  assert.equal(HI.reverseCapitalization(context.Capitalization.SMALL_CAPS), 'smallCaps');
  assert.equal(HI.reverseCapitalization(context.Capitalization.NORMAL), null);
  assert.equal(HI.reverseCapitalization(undefined), null);

  assert.match(HI.textStyleCss({ pointSize: 10, leading: null, tracking: null, capitalization: 'allCaps' }), /text-transform:uppercase/);
  assert.doesNotMatch(HI.textStyleCss({ pointSize: 10, leading: null, tracking: null, capitalization: null }), /text-transform/);
  assert.match(HI.paragraphStyleCss({ capitalization: context.Capitalization.ALL_CAPS }), /text-transform:uppercase/);
});

test('reverse capitalization stays null without the InDesign Capitalization enum', () => {
  const context = loadReverseStylesContext();
  assert.equal(context.HI.reverseCapitalization(1634493296), null);
});
