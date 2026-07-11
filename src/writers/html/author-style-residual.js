const { blendModeCss } = require('./css-blend-mode');

function inlineResidualForSynth({ inlineCss, token, synthesizedStyles }) {
  const inline = parseCssDeclarations(inlineCss);
  const originalCss = serializeCssDeclarations(inline);
  if (!token) return { css: originalCss, removed: [], reason: 'synth-token-missing' };
  const style = (Array.isArray(synthesizedStyles) ? synthesizedStyles : [])
    .find((entry) => entry && entry.token === token);
  if (!style) return { css: originalCss, removed: [], reason: 'synth-rule-missing' };
  const synthesized = parseCssDeclarations(synthesizedStyleDeclarations(style));
  if (!synthesized.order.length) return { css: originalCss, removed: [], reason: 'synth-rule-empty' };

  const removed = [];
  for (const property of inline.order.slice()) {
    if (!synthesized.values.has(property)) continue;
    if (!equivalentCssValue(inline.values.get(property), synthesized.values.get(property))) continue;
    inline.values.delete(property);
    removed.push(property);
  }
  inline.order = inline.order.filter((property) => inline.values.has(property));
  return {
    css: serializeCssDeclarations(inline),
    removed,
    reason: removed.length ? 'synth-covered' : 'no-equivalent-coverage',
  };
}

function synthesizedStyleDeclarations(style) {
  if (style && style.kind === 'line') return '';
  const properties = style && style.properties || {};
  if (style && style.kind === 'text') return synthesizedTextStyleDeclarations(properties);
  const declarations = [];
  if (properties.fillColor) declarations.push(`background-color:${properties.fillColor}`);
  if (properties.strokeColor && Number(properties.strokeWeight) > 0) {
    declarations.push(`border:${px(properties.strokeWeight)} solid ${properties.strokeColor}`);
  }
  if (Number(properties.cornerRadius) > 0) declarations.push(`border-radius:${px(properties.cornerRadius)}`);
  const blendMode = blendModeCss(properties.blendMode);
  if (blendMode) declarations.push(blendMode);
  const opacity = Number(properties.opacity);
  if (Number.isFinite(opacity) && opacity >= 0 && opacity < 100) declarations.push(`opacity:${formatNumber(opacity / 100)}`);
  return declarations.join('; ');
}

function synthesizedTextStyleDeclarations(properties) {
  const declarations = [];
  if (properties.fontFamily) declarations.push(`font-family:"${properties.fontFamily}", Arial, sans-serif`);
  if (properties.fontWeight) declarations.push(`font-weight:${properties.fontWeight}`);
  if (properties.fontStyle) declarations.push(`font-style:${properties.fontStyle}`);
  if (properties.pointSize != null) declarations.push(`font-size:${px(properties.pointSize)}`);
  if (properties.leading != null) declarations.push(`line-height:${px(properties.leading)}`);
  if (properties.fillColor) declarations.push(`color:${properties.fillColor}`);
  if (properties.tracking != null && Number(properties.tracking) !== 0) {
    declarations.push(`letter-spacing:${formatNumber(Number(properties.tracking) / 1000)}em`);
  }
  if (properties.justification) declarations.push(`text-align:${properties.justification}`);
  return declarations.join('; ');
}

function parseCssDeclarations(value) {
  const order = [];
  const values = new Map();
  for (const declaration of String(value || '').split(';')) {
    const index = declaration.indexOf(':');
    if (index <= 0) continue;
    const property = declaration.slice(0, index).trim().toLowerCase();
    const cssValue = declaration.slice(index + 1).trim();
    if (!property || !cssValue) continue;
    if (!values.has(property)) order.push(property);
    values.set(property, cssValue);
  }
  return { order, values };
}

function serializeCssDeclarations(declarations) {
  return declarations.order
    .filter((property) => declarations.values.has(property))
    .map((property) => `${property}:${declarations.values.get(property)}`)
    .join(';');
}

function equivalentCssValue(first, second) {
  return normalizeCssValue(first) === normalizeCssValue(second);
}

function normalizeCssValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/'/g, '"')
    .replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/g, '#$1$1$2$2$3$3')
    .replace(/(-?\d+(?:\.\d+)?)(px|pt|em|%)?/g, (match, number, unit = '') => {
      const parsed = Number(number);
      if (!Number.isFinite(parsed)) return match;
      return `${formatNumber(parsed)}${unit}`;
    })
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function px(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? formatNumber(number) : 0}px`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

module.exports = {
  inlineResidualForSynth,
  synthesizedStyleDeclarations,
  parseCssDeclarations,
  serializeCssDeclarations,
  equivalentCssValue,
};
