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
  'backgroundColor',
  'borderTopColor',
  'borderTopWidth',
  'borderTopStyle',
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
