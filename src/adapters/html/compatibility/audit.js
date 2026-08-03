const {
  assetSourceFromElementLike,
  inferAssetKind,
  inferAssetKindFromExtension,
} = require('../../../shared/assets');
const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');

const SPECIAL_FORMAT_KINDS = new Set(['pdf', 'psd', 'ai', 'svg']);
const FORMAT_DECLARATIONS = new Set(['raster', 'pdf', 'psd', 'ai', 'svg']);
const CSS_FITS = new Set(['cover', 'contain', 'fill', 'none', 'scale-down']);

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
  const context = { pageId: page && page.id, itemId: item && item.id };

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
    .filter((name) => name.startsWith('data-id-'))
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

function normalizedMessage(code, context, message, suggestedFix, ruleRef) {
  return {
    level: 'warning',
    code,
    action: 'normalized',
    ...(context.pageId ? { pageId: context.pageId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
    message,
    suggestedFix,
    ruleRef,
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
