const {
  assetSourceFromElementLike,
  inferAssetKind,
  inferAssetKindFromExtension,
} = require('../../../shared/assets');
const {
  HTML_DATA_ID_ATTRIBUTES,
  HTML_DATA_ID_ATTRIBUTE_NAMES,
} = require('../../../protocol');
const { gradientHasSingleColor, parseCssLinearGradient } = require('../../../shared/style-utils');

const SPECIAL_FORMAT_KINDS = new Set(['pdf', 'psd', 'ai', 'svg']);
const FORMAT_DECLARATIONS = new Set(['raster', 'pdf', 'psd', 'ai', 'svg']);
const CSS_FITS = new Set(['cover', 'contain', 'fill', 'none', 'scale-down']);
const PROTOCOL_ATTRIBUTE_NAMES = new Set(HTML_DATA_ID_ATTRIBUTE_NAMES);

function auditHtmlCompatibility(snapshot) {
  const messages = [];
  for (const page of Array.isArray(snapshot && snapshot.pages) ? snapshot.pages : []) {
    for (const item of Array.isArray(page && page.items) ? page.items : []) {
      auditItem(page, item, messages);
    }
  }
  return {
    summary: {
      normalized: messages.filter((entry) => entry.action === 'normalized').length,
      warnings: messages.filter((entry) => entry.level === 'warning').length,
      blocked: messages.filter((entry) => entry.level === 'error').length,
    },
    messages,
  };
}

function auditItem(page, item, messages) {
  const attrs = attributesFor(item);
  const source = assetSourceFromElementLike({
    tagName: item && item.tagName,
    attributes: attrs,
    computedStyle: item && item.computedStyle,
    authoredStyle: item && item.authoredStyle,
  });
  const explicitKind = clean(attrs[HTML_DATA_ID_ATTRIBUTES.ASSET_KIND]);
  const extensionKind = inferAssetKindFromExtension(source.src);
  const effectiveKind = inferAssetKind(source.src, source.explicitKind);
  const context = {
    pageId: page && page.id,
    itemId: item && item.id,
    sourcePath: item && item.sourceNode && item.sourceNode.sourcePath,
  };

  auditVisibleConstructs(item, context, messages);

  if (source.src && !explicitKind && SPECIAL_FORMAT_KINDS.has(extensionKind)) {
    messages.push(normalizedMessage(
      'HTML_ASSET_KIND_INFERRED',
      context,
      `Resource type '${extensionKind}' was inferred from ${source.src}.`,
      `Add ${HTML_DATA_ID_ATTRIBUTES.ASSET_KIND}="${extensionKind}" to #${item.id}.`,
      'assets/resource-kind',
    ));
  } else if (source.src
    && explicitKind
    && FORMAT_DECLARATIONS.has(explicitKind)
    && extensionKind !== 'unknown'
    && effectiveKind !== explicitKind) {
    messages.push(normalizedMessage(
      'HTML_ASSET_KIND_CANONICALIZED',
      context,
      `Declared resource type '${explicitKind}' conflicts with '${extensionKind}' from ${source.src}; the real resource format is used.`,
      `Change ${HTML_DATA_ID_ATTRIBUTES.ASSET_KIND}="${explicitKind}" to ${HTML_DATA_ID_ATTRIBUTES.ASSET_KIND}="${extensionKind}" on #${item.id}.`,
      'assets/resource-kind',
    ));
  }

  const fit = clean(item && item.authoredStyle && item.authoredStyle.objectFit)
    || clean(item && item.computedStyle && item.computedStyle.objectFit);
  if (source.src && !attrs[HTML_DATA_ID_ATTRIBUTES.FIT] && CSS_FITS.has(fit) && fit !== 'fill') {
    messages.push(normalizedMessage(
      'HTML_FIT_INFERRED_FROM_CSS',
      context,
      `InDesign fitting '${fit}' was inferred from CSS object-fit.`,
      `Add ${HTML_DATA_ID_ATTRIBUTES.FIT}="${fit}" to #${item.id} when this placement must remain explicit.`,
      'assets/css-fitting',
    ));
  }

  const tagName = clean(item && item.tagName);
  const role = clean(item && item.role);
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.ROLE]
    && ['div', 'span'].includes(tagName)
    && ['text', 'graphic', 'container'].includes(role)) {
    messages.push(normalizedMessage(
      'HTML_ROLE_INFERRED',
      context,
      `Role '${role}' was inferred from the neutral ${tagName} element and its content.`,
      `Add ${HTML_DATA_ID_ATTRIBUTES.ROLE}="${role}" to #${item.id}.`,
      'semantics/inferred-role',
    ));
  }

  const sourceAttrs = attributesFor(item && item.sourceNode);
  const inherited = Object.keys(attrs)
    .filter((name) => PROTOCOL_ATTRIBUTE_NAMES.has(name))
    .filter((name) => !Object.prototype.hasOwnProperty.call(sourceAttrs, name));
  if (source.src && inherited.length && Array.isArray(item.sourceAncestorNodes) && item.sourceAncestorNodes.length) {
    messages.push(normalizedMessage(
      'HTML_SINGLE_ASSET_WRAPPER_NORMALIZED',
      context,
      `A wrapper around the only resource was used as its visual InDesign frame; inherited fields: ${inherited.join(', ')}.`,
      `Keep one resource child and move resource-specific fields to #${item.id}; frame styling may remain on the wrapper.`,
      'assets/single-resource-wrapper',
    ));
  }
}

function auditVisibleConstructs(item, context, messages) {
  const tagName = clean(item && item.tagName);
  const unsupported = item && item.unsupported || {};
  const vectorElements = Array.isArray(item && item.vectorElements) ? item.vectorElements : [];
  const svgUnsupported = Array.isArray(unsupported.svgUnsupportedElements)
    ? unsupported.svgUnsupportedElements
    : [];

  if (tagName === 'svg') {
    if (svgUnsupported.length || vectorElements.length === 0) {
      const facts = svgUnsupported.length
        ? svgUnsupported.map((entry) => `${entry.tagName}:${entry.reason}`).join(', ')
        : 'no supported visible primitive';
      messages.push(blockedMessage(
        'HTML_INLINE_SVG_UNSUPPORTED',
        context,
        `Inline SVG cannot be translated safely (${facts}).`,
        'Use path, circle, ellipse, rect, line, polyline or polygon without transforms; otherwise save the complete artwork as an external .svg resource.',
        'vectors/inline-svg',
        { unsupportedElements: svgUnsupported },
      ));
    } else {
      messages.push(normalizedMessage(
        'HTML_INLINE_SVG_NORMALIZED',
        context,
        `Inline SVG primitives will be compiled to native InDesign vectors: ${vectorElements.map((entry) => entry.tagName).join(', ')}.`,
        'No authoring rewrite is required; keep the SVG limited to supported primitives when native editability is required.',
        'vectors/inline-svg',
      ));
    }
  }

  const pseudoFacts = ['beforeContent', 'afterContent', 'beforePaint', 'afterPaint', 'markerContent']
    .filter((name) => unsupported[name]);
  if (pseudoFacts.length) {
    messages.push(blockedMessage(
      'HTML_PSEUDO_ELEMENT_UNSUPPORTED',
      context,
      `Visible pseudo-element content is not translated (${pseudoFacts.join(', ')}).`,
      'Move visible content into a real HTML element, or use a supported inline SVG primitive for decorative geometry.',
      'css/pseudo-elements',
      { unsupportedFacts: pseudoFacts },
    ));
  }

  if (unsupported.clipPath) {
    messages.push(blockedMessage(
      'HTML_CLIP_PATH_UNSUPPORTED',
      context,
      `CSS clip-path is visible but cannot be translated safely: ${unsupported.clipPath}.`,
      'Use a supported inline SVG polygon/path for editable geometry, or place an external .svg resource.',
      'css/clip-path',
      { clipPath: unsupported.clipPath },
    ));
  }

  const unsupportedEffects = ['boxShadow', 'filter', 'maskImage'].filter((name) => unsupported[name]);
  if (unsupportedEffects.length) {
    messages.push(blockedMessage(
      'HTML_CSS_EFFECT_UNSUPPORTED',
      context,
      `CSS visual effects cannot be translated safely: ${unsupportedEffects.join(', ')}.`,
      'Replace the effect with native background/border/opacity styling, or place the complete artwork as an external resource.',
      'css/visual-effects',
      { unsupportedEffects: Object.fromEntries(unsupportedEffects.map((name) => [name, unsupported[name]])) },
    ));
  }

  const backgroundImage = cleanStyle(item, 'backgroundImage');
  if (/gradient\s*\(/i.test(backgroundImage)) {
    const gradient = parseCssLinearGradient(backgroundImage);
    if (!gradient || !gradientHasSingleColor(gradient)) {
      messages.push(blockedMessage(
        'HTML_GRADIENT_UNSUPPORTED',
        context,
        'The CSS gradient uses multiple colors or an unsupported gradient syntax.',
        'Use one color with opacity stops for an InDesign gradient feather, or place the complete artwork as an external resource.',
        'css/gradients',
        { backgroundImage },
      ));
    }
  }

  if (isCssBorderShape(item)) {
    messages.push(blockedMessage(
      'HTML_CSS_BORDER_SHAPE_UNSUPPORTED',
      context,
      'A zero-size element uses transparent and visible borders to draw a non-rectangular CSS shape.',
      'Replace the border trick with a supported inline SVG polygon/path.',
      'css/border-shapes',
    ));
  }
}

function cleanStyle(item, property) {
  return String(item && item.computedStyle && item.computedStyle[property]
    || item && item.authoredStyle && item.authoredStyle[property]
    || '').trim();
}

function isCssBorderShape(item) {
  const style = item && item.computedStyle || {};
  if (cssPx(style.width) !== 0 || cssPx(style.height) !== 0) return false;
  let visible = 0;
  let transparent = 0;
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    const width = cssPx(style[`border${side}Width`]);
    const borderStyle = clean(style[`border${side}Style`]);
    if (width <= 0 || borderStyle === 'none' || borderStyle === 'hidden') continue;
    if (isTransparentComputedColor(style[`border${side}Color`])) transparent += 1;
    else visible += 1;
  }
  return visible >= 1 && transparent >= 2;
}

function cssPx(value) {
  const match = String(value || '').trim().match(/^([+-]?(?:\d+|\d*\.\d+))px$/i);
  return match ? Number(match[1]) : NaN;
}

function isTransparentComputedColor(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'transparent') return true;
  const slashAlpha = raw.match(/^rgba?\([^/]+\/\s*([+-]?(?:\d+|\d*\.\d+))%?\s*\)$/i);
  if (slashAlpha) return Number(slashAlpha[1]) === 0;
  const commaAlpha = raw.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([+-]?(?:\d+|\d*\.\d+))\s*\)$/i);
  return Boolean(commaAlpha && Number(commaAlpha[1]) === 0);
}

function normalizedMessage(code, context, message, suggestedFix, ruleRef) {
  return {
    level: 'warning',
    code,
    action: 'normalized',
    ...(context.pageId ? { pageId: context.pageId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
    ...(context.sourcePath ? { sourcePath: context.sourcePath } : {}),
    message,
    suggestedFix,
    ruleRef,
  };
}

function blockedMessage(code, context, message, suggestedFix, ruleRef, details = {}) {
  return {
    level: 'error',
    code,
    action: 'blocked',
    ...(context.pageId ? { pageId: context.pageId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
    ...(context.sourcePath ? { sourcePath: context.sourcePath } : {}),
    message,
    suggestedFix,
    ruleRef,
    ...details,
  };
}

function attributesFor(value) {
  return value && value.attributes && typeof value.attributes === 'object' ? value.attributes : {};
}

function clean(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

module.exports = {
  auditHtmlCompatibility,
};
