const { round } = require('../../shared/geometry');
const { normalizeCssColor } = require('../../shared/style-utils');
const { ensureItemLabels } = require('./guide-instructions');
const { mappedLayerName } = require('./layer-instructions');

function applyBackgroundParentPages({
  modelPages,
  instructionPages,
  parentPages,
  styles,
  options,
  ensureSwatch,
}) {
  const parentById = new Map((parentPages || []).map((parentPage) => [String(parentPage.id || ''), parentPage]));
  const generated = new Map();
  for (let index = 0; index < instructionPages.length; index += 1) {
    const page = instructionPages[index];
    const modelPage = modelPages[index] || {};
    const rawPage = modelPage.raw || modelPage;
    const background = pageBackgroundItemFor(rawPage, styles, { width: page.width, height: page.height }, options, ensureSwatch);
    if (!background) continue;
    const baseParentId = page.parentPageId || null;
    const baseParent = baseParentId ? parentById.get(String(baseParentId)) : null;
    const parent = backgroundParentPageFor(background, page, baseParent, generated);
    if (!parentById.has(parent.id)) {
      parentPages.push(parent);
      parentById.set(parent.id, parent);
    }
    page.parentPageId = parent.id;
    page.parentPageName = parent.name;
  }
}

function pageBackgroundItemFor(page, styles, dimensions, options, ensureSwatch) {
  const style = page.computedStyle || {};
  const fill = normalizeCssColor(style.backgroundColor);
  if (!fill) return null;
  if (isDefaultPaperFill(fill)) return null;
  if (typeof ensureSwatch === 'function') ensureSwatch(styles, fill);
  return {
    id: `${page.id}-fill`,
    role: 'background',
    type: 'SHAPE',
    bounds: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
    zIndex: -1000,
    layer: mappedLayerName('background', options),
    sourceSelector: `#${page.id}`,
    styleRefs: {},
    objectStyle: null,
    frameStyle: null,
    styleOverride: {
      fillColor: fill.name,
      fillOpacity: fill.alpha == null ? null : fill.alpha,
      strokeWeight: 0,
    },
  };
}

function backgroundParentPageFor(background, page, baseParent, generated) {
  const baseId = baseParent && baseParent.id ? String(baseParent.id) : '';
  const key = [
    baseId || 'page',
    background.styleOverride && background.styleOverride.fillColor || 'fill',
    round(Number(page.width || 0), 2),
    round(Number(page.height || 0), 2),
  ].join('|');
  if (generated.has(key)) return generated.get(key);
  const id = backgroundParentPageId(background, page, baseParent);
  const name = baseParent && baseParent.name
    ? `${baseParent.name}-背景`
    : `背景母版-${background.styleOverride.fillColor}`;
  const parent = {
    id,
    name,
    semantic: 'page-background',
    provides: ['background'],
    labels: backgroundParentLabels(id, name),
    bounds: { x: 0, y: 0, width: page.width, height: page.height },
    width: page.width,
    height: page.height,
    items: [
      ensureItemLabels({ ...background, id: `${id}-fill` }),
      ...(baseParent && Array.isArray(baseParent.items) ? baseParent.items : []),
    ].sort((a, b) => a.zIndex - b.zIndex),
  };
  generated.set(key, parent);
  return parent;
}

function backgroundParentPageId(background, page, baseParent) {
  const prefix = baseParent && baseParent.id ? safeInstructionId(baseParent.id) : 'background';
  const color = String(background.styleOverride && background.styleOverride.fillColor || 'fill')
    .replace(/^颜色-/, '')
    .replace(/[^0-9a-zA-Z]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fill';
  const width = String(round(Number(page.width || 0), 2)).replace(/\./g, '_');
  const height = String(round(Number(page.height || 0), 2)).replace(/\./g, '_');
  return `${prefix}-${color}-${width}x${height}`;
}

function backgroundParentLabels(id, name) {
  return [{
    protocol: 'html-indesign',
    version: 1,
    kind: 'parentPage',
    id,
    source: 'html-to-indesign',
    semantic: 'page-background',
    name,
    generated: true,
  }];
}

function safeInstructionId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'parent';
}

function isDefaultPaperFill(fill) {
  return fill && fill.hex === '#ffffff' && (fill.alpha == null || fill.alpha === 1);
}

module.exports = {
  applyBackgroundParentPages,
  pageBackgroundItemFor,
  isDefaultPaperFill,
};
