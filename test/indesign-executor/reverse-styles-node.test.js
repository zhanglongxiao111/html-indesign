const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadReverseStylesContext({ withEffects = false } = {}) {
  const libs = ['hi_reverse_styles.jsxinc', 'hi_reverse_colors.jsxinc', ...(withEffects ? ['hi_reverse_effects.jsxinc'] : [])];
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
  const messages = trackGradientWarnings(context);
  context.HI.reverseSetGradientOwner({ itemId: '257' });

  // 探针实测：Tint.colorValue 是基色，tintValue 是色调百分比；等效色 = 基色按色调缩放（09-26 gradient-sample 的 G-Red 40%）。
  assert.equal(context.HI.reverseColor(new Tint('Red 40%', 'CMYK', [0, 100, 100, 0], 40)), '#ff9999');
  assert.equal(context.HI.reverseColor(new Tint('Blue 50%', 'RGB', [0, 0, 255], 50)), '#8080ff');
  assert.equal(context.HI.reverseColor(new MixedInk('Mixed')), null);
  assert.equal(context.HI.reverseColor(new Swatch(new MixedInk('Mixed'))), null);
  assert.deepEqual(messages.map((entry) => [entry.code, entry.details.swatch, entry.details.itemId]), [
    ['REVERSE_COLOR_UNRESOLVED', 'Mixed', '257'],
  ]);
});

test('reverseColor applies the owner local tint over the base color and warns on unreadable tints', () => {
  const context = loadReverseStylesContext({ withEffects: true });
  const messages = trackGradientWarnings(context);
  context.HI.reverseSetGradientOwner({ itemId: '9' });
  const red = new Color('Red', 'CMYK', [0, 100, 100, 0]);

  assert.equal(context.HI.reverseVisualStyle({ fillColor: red, fillTint: 40 }).fillColor, '#ff9999');
  assert.equal(context.HI.reverseVisualStyle({ fillColor: red, fillTint: -1 }).fillColor, '#ff0000');
  assert.equal(context.HI.reverseVisualStyle({ fillColor: red, fillTint: 100 }).fillColor, '#ff0000');
  assert.equal(context.HI.reverseColor(new Tint('Red ?', 'CMYK', [0, 100, 100, 0], undefined)), '#ff0000');
  assert.deepEqual(messages.map((entry) => entry.code), ['REVERSE_TINT_UNREADABLE']);
  assert.equal(context.HI.labHex(100, 0, 0), '#ffffff');
});

test('reverse text stroke reads character stroke color and weight and writes -webkit-text-stroke', () => {
  const context = loadReverseStylesContext({ withEffects: true });
  trackGradientWarnings(context);
  const { HI } = context;
  const stroke = HI.reverseTextStroke({ strokeColor: new Color('Black', 'CMYK', [0, 0, 0, 100]), strokeWeight: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(stroke)), { strokeColor: '#000000', strokeWeight: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(HI.reverseTextStroke({ strokeColor: new Color('None', 'RGB', [0, 0, 0]), strokeWeight: 1 }))), { strokeColor: null, strokeWeight: null });
  // 渐变描边按首个色标近似（REVERSE_GRADIENT_APPROXIMATED 由渐变路径记账）。
  assert.equal(HI.reverseTextStroke({ strokeColor: sampleGradient(), strokeWeight: 0.5 }).strokeColor, '#ff0000');
  assert.match(HI.textStyleCss({ pointSize: 12, leading: null, tracking: null, strokeColor: '#000000', strokeWeight: 1 }), /-webkit-text-stroke:1px #000000/);
  assert.match(HI.characterStyleCss({ strokeColor: new Color('Black', 'RGB', [0, 0, 0]), strokeWeight: 2 }), /-webkit-text-stroke:2pt #000000/);
});

test('reverse justification separates LEFT_JUSTIFIED from FULLY_JUSTIFIED and writes text-align-last', () => {
  const context = loadReverseStylesContext();
  context.Justification = {
    LEFT_ALIGN: 1, CENTER_ALIGN: 2, RIGHT_ALIGN: 3, LEFT_JUSTIFIED: 4, FULLY_JUSTIFIED: 5, CENTER_JUSTIFIED: 6, RIGHT_JUSTIFIED: 7,
  };
  const { HI, Justification } = context;
  assert.equal(HI.reverseJustification(Justification.LEFT_JUSTIFIED), 'justify');
  assert.equal(HI.reverseJustification(Justification.FULLY_JUSTIFIED), 'justify-all');
  assert.equal(HI.reverseJustification(Justification.CENTER_JUSTIFIED), 'justify-center');
  assert.equal(HI.reverseJustification(Justification.RIGHT_JUSTIFIED), 'justify-right');
  assert.equal(HI.justificationCss('justify'), 'text-align:justify');
  assert.equal(HI.justificationCss('justify-all'), 'text-align:justify; text-align-last:justify');
  assert.match(HI.paragraphStyleCss({ justification: Justification.FULLY_JUSTIFIED }), /text-align:justify; text-align-last:justify/);
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
