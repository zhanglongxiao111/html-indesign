const SNAPSHOT_STYLE_PROPS = [
  'position',
  'display',
  'left',
  'top',
  'width',
  'height',
  'zIndex',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'color',
  'textAlign',
  'textDecorationLine',
  'textTransform',
  'verticalAlign',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'backgroundColor',
  'borderTopColor',
  'borderTopWidth',
  'borderTopStyle',
  'borderRightColor',
  'borderRightWidth',
  'borderRightStyle',
  'borderBottomColor',
  'borderBottomWidth',
  'borderBottomStyle',
  'borderLeftColor',
  'borderLeftWidth',
  'borderLeftStyle',
  'borderRadius',
  'opacity',
  'objectFit',
  'objectPosition',
  'overflow',
  'transform',
];

function pickComputedStyle(style) {
  const out = {};
  for (const prop of SNAPSHOT_STYLE_PROPS) {
    out[prop] = style[prop];
  }
  return out;
}

module.exports = {
  SNAPSHOT_STYLE_PROPS,
  pickComputedStyle,
};
