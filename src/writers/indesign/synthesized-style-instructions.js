const { createProtocolLabel } = require('../../shared/labels');

const STYLE_COLLECTION_BY_KIND = Object.freeze({
  text: 'paragraphStyles',
  line: 'objectStyles',
  object: 'objectStyles',
  frame: 'frameStyles',
  asset: 'frameStyles',
});

const STYLE_REF_BY_COLLECTION = Object.freeze({
  paragraphStyles: 'paragraphStyle',
  objectStyles: 'objectStyle',
  frameStyles: 'frameStyle',
});

function applySynthesizedStyleInstructions(model) {
  const synthesizedStyles = model && model.styles && model.styles.synthesized;
  if (!Array.isArray(synthesizedStyles) || synthesizedStyles.length === 0) {
    return model;
  }

  const styleByToken = new Map();
  const styles = {
    ...(model.styles || {}),
  };

  for (const synthesized of synthesizedStyles) {
    const collectionName = STYLE_COLLECTION_BY_KIND[synthesized.kind];
    if (!collectionName || !synthesized.token || !synthesized.displayName) {
      continue;
    }
    if (!styles[collectionName]) {
      styles[collectionName] = {};
    }
    const nativeStyle = nativeStyleForSynthesized(collectionName, synthesized);
    styles[collectionName][nativeStyle.name] = {
      ...(styles[collectionName][nativeStyle.name] || {}),
      ...nativeStyle,
    };
    styleByToken.set(synthesized.token, {
      collectionName,
      refKey: STYLE_REF_BY_COLLECTION[collectionName],
      name: nativeStyle.name,
    });
  }

  return {
    ...model,
    styles,
    parentPages: mapPages(model.parentPages, styleByToken),
    pages: mapPages(model.pages, styleByToken),
  };
}

function nativeStyleForSynthesized(collectionName, synthesized) {
  return {
    name: synthesized.displayName,
    token: synthesized.token,
    displayName: synthesized.displayName,
    ...(synthesized.properties || {}),
    labels: [createProtocolLabel({
      kind: 'style',
      id: synthesized.token,
      source: 'synthesized-style',
      styleKind: collectionName,
      token: synthesized.token,
      displayName: synthesized.displayName,
    })],
  };
}

function mapPages(pages, styleByToken) {
  if (!Array.isArray(pages)) {
    return pages;
  }
  return pages.map((page) => ({
    ...page,
    items: mapItems(page.items, styleByToken),
  }));
}

function mapItems(items, styleByToken) {
  if (!Array.isArray(items)) {
    return items;
  }
  return items.map((item) => mapItem(item, styleByToken));
}

function mapItem(item, styleByToken) {
  const refs = item && item.styleRefs || {};
  const synthesizedToken = refs.synthesizedToken;
  const native = styleByToken.get(synthesizedToken);
  if (!native || !native.refKey || refs[native.refKey]) {
    return item;
  }
  return {
    ...item,
    styleRefs: {
      ...refs,
      [native.refKey]: native.name,
    },
  };
}

module.exports = Object.freeze({
  applySynthesizedStyleInstructions,
});
