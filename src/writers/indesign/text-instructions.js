const { round } = require('../../shared/geometry');
const { cssLengthToTarget } = require('../../semantic-model/layout');

function effectsForInstruction(effects, page, layout) {
  if (!effects || layout.unitMode !== 'presentation') return effects || null;
  const out = { ...effects };
  if (effects.gradientFeather) {
    out.gradientFeather = {
      ...effects.gradientFeather,
      start: pagePointToTarget(effects.gradientFeather.start, page, layout),
      length: pageLengthToTarget(effects.gradientFeather.length, page, layout),
    };
  }
  return out;
}

function pagePointToTarget(point, page, layout) {
  const scale = pageScaleFromMm(page, layout);
  return {
    x: roundEffectCoordinate(Number(point && point.x || 0) * scale.x),
    y: roundEffectCoordinate(Number(point && point.y || 0) * scale.y),
  };
}

function pageLengthToTarget(length, page, layout) {
  if (!Number.isFinite(Number(length))) return length;
  return roundEffectCoordinate(Number(length) * pageScaleFromMm(page, layout).x);
}

function pageScaleFromMm(page, layout) {
  return {
    x: Number(layout.targetSize && layout.targetSize.width || 0) / Number(page.widthMm || 1),
    y: Number(layout.targetSize && layout.targetSize.height || 0) / Number(page.heightMm || 1),
  };
}

function roundEffectCoordinate(value) {
  const rounded = round(value, 2);
  const nearestInteger = Math.round(rounded);
  return Math.abs(rounded - nearestInteger) < 0.05 ? nearestInteger : rounded;
}

function textFrameBounds(item, bounds, layout) {
  if (layout.unitMode !== 'presentation') return bounds;
  const minHeight = minimumTextFrameHeight(item, layout);
  const minWidth = minimumTextFrameWidth(item, layout);
  return {
    ...bounds,
    width: minWidth && Number(bounds.width || 0) < minWidth ? round(minWidth, 2) : bounds.width,
    height: minHeight && Number(bounds.height || 0) < minHeight ? round(minHeight, 2) : bounds.height,
  };
}

function minimumTextFrameHeight(item, layout) {
  const style = item.computedStyle || {};
  const lineHeight = cssLengthToTarget(style.lineHeight, layout)
    || round(cssLengthToTarget(style.fontSize, layout) * 1.2, 2);
  if (!lineHeight) return 0;
  return round(lineHeight * textLineCount(item), 2);
}

function textLineCount(item) {
  const text = item && item.content && item.content.text ? item.content.text : item && item.text;
  return Math.max(1, String(text || '').split(/\r\n|\r|\n/).length);
}

function minimumTextFrameWidth(item, layout) {
  if (!usesAutoInlineWidth(item)) return 0;
  const style = item.computedStyle || {};
  const fontSize = cssLengthToTarget(style.fontSize, layout);
  if (!fontSize) return 0;
  const text = String(item && item.content && item.content.text ? item.content.text : item && item.text || '');
  const longestLine = text.split(/\r\n|\r|\n/).reduce((max, line) => Math.max(max, line.length), 0);
  return round(longestLine * fontSize * 0.65 + fontSize * 0.35, 2);
}

function usesAutoInlineWidth(item) {
  const style = item.computedStyle || {};
  const authored = item.authoredStyle || {};
  return (String(item.tagName || '').toLowerCase() === 'span' && !authored.width)
    || String(style.display || '').toLowerCase() === 'inline'
    || String(style.width || '').toLowerCase() === 'auto';
}

module.exports = {
  effectsForInstruction,
  textFrameBounds,
};
