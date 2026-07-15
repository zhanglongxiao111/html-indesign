const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
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
  if (isObservedReverseText(item)) return bounds;
  const minHeight = minimumTextFrameHeight(item, layout);
  const minWidth = minimumTextFrameWidth(item, layout);
  return {
    ...bounds,
    width: minWidth && Number(bounds.width || 0) < minWidth ? round(minWidth, 2) : bounds.width,
    height: minHeight && Number(bounds.height || 0) < minHeight ? round(minHeight, 2) : bounds.height,
  };
}

function textFitPolicy(item, options = {}, layout) {
  if (options.textFit === false) return null;
  if (!isObservedReverseText(item) && !isSingleLineVisibleOverflow(item, layout)) return null;
  const authoredSingleLine = !isObservedReverseText(item);
  return {
    mode: 'expand-frame-to-content',
    maxGrowX: Number(options.textFitMaxGrowX || 96),
    maxGrowY: Number(options.textFitMaxGrowY || 48),
    preservePosition: true,
    ...(authoredSingleLine ? {
      preferWidth: true,
      horizontalAnchor: horizontalAnchorFor(item),
    } : {}),
  };
}

function isSingleLineVisibleOverflow(item, layout) {
  const style = item && item.computedStyle || {};
  if (String(style.overflow || '').toLowerCase() !== 'visible') return false;
  const text = String(item && item.content && item.content.text || item && item.text || '');
  if (/\r|\n/.test(text)) return false;
  const lineHeight = cssLengthToTarget(style.lineHeight, layout)
    || round(cssLengthToTarget(style.fontSize, layout) * 1.2, 2);
  if (!lineHeight) return false;
  const verticalExtras = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
    .reduce((sum, key) => sum + cssLengthToTarget(style[key], layout), 0);
  const contentHeight = Math.max(0, Number(item && item.bounds && item.bounds.height || 0) - verticalExtras);
  return contentHeight > 0 && contentHeight <= lineHeight * 1.35;
}

function horizontalAnchorFor(item) {
  const value = String(item && item.computedStyle && item.computedStyle.textAlign || '').toLowerCase();
  if (value === 'center') return 'center';
  if (value === 'right' || value === 'end') return 'end';
  return 'start';
}

function textForInstruction(item, content = {}) {
  const sourceHtml = observedSourceHtml(item);
  if (sourceHtml && /<br\b/i.test(sourceHtml)) return htmlTextWithBreaks(sourceHtml);
  return content.text;
}

function runsForInstruction(item, content = {}, text = content.text) {
  const runs = Array.isArray(content.runs) ? content.runs : [];
  if (!runs.length) return [];
  const sourceHtml = observedSourceHtml(item);
  if (!sourceHtml || !/<br\b/i.test(sourceHtml)) return runs;
  if (!canReplaceSyntheticRuns(runs, content.text, text)) return runs;
  return [{ ...runs[0], text }];
}

function canReplaceSyntheticRuns(runs, contentText, instructionText) {
  if (!Array.isArray(runs) || runs.length !== 1) return false;
  if (runs[0].characterStyle) return false;
  const runText = String(runs[0].text || '');
  if (runText !== String(contentText || '')) return false;
  return runText !== String(instructionText || '');
}

function isObservedReverseText(item) {
  return sourceNodeIsObserved(item && item.sourceNode)
    || (item && item.labels || []).some((label) => sourceNodeIsObserved(label && label.sourceNode));
}

function observedSourceHtml(item) {
  if (!isObservedReverseText(item)) return null;
  if (item && typeof item.sourceHtml === 'string') return item.sourceHtml;
  if (item && item.sourceNode && typeof item.sourceNode.sourceHtml === 'string') return item.sourceNode.sourceHtml;
  for (const label of item && item.labels || []) {
    if (label && typeof label.sourceHtml === 'string') return label.sourceHtml;
    if (label && label.sourceNode && typeof label.sourceNode.sourceHtml === 'string') return label.sourceNode.sourceHtml;
  }
  return null;
}

function htmlTextWithBreaks(html) {
  return decodeBasicEntities(String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n');
}

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sourceNodeIsObserved(sourceNode) {
  if (!sourceNode) return false;
  const attributes = sourceNode.attributes || {};
  if (attributes[HTML_DATA_ID_ATTRIBUTES.OBSERVED] === 'true' || attributes[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] === 'observation') return true;
  const classList = Array.isArray(sourceNode.classList)
    ? sourceNode.classList
    : String(attributes.class || '').split(/\s+/);
  return classList.includes('observed-text');
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
  runsForInstruction,
  textFrameBounds,
  textFitPolicy,
  textForInstruction,
};
