const { inferAssetKind, assetSourceFromElementLike } = require('../../../shared/assets');

function roleFromItem(item) {
  const tagName = item.tagName;
  const attributes = item.attributes || {};
  const source = assetSourceFromElementLike({
    tagName,
    attributes,
    computedStyle: item.computedStyle,
    authoredStyle: item.authoredStyle,
  });
  if (source.src && inferAssetKind(source.src, source.explicitKind) !== 'unknown') return 'graphic';
  if (attributes['data-id-paragraph-style']) return 'text';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName)) return 'text';
  if (['img', 'object', 'embed', 'svg', 'canvas'].includes(tagName)) return 'graphic';
  if (tagName === 'table') return 'table';
  return 'shape';
}

function selectorFor(item) {
  if (item.attributes.id) return `#${item.attributes.id}`;
  if (item.classList.length) return `${item.tagName}.${item.classList.join('.')}`;
  return item.tagName;
}

module.exports = {
  roleFromItem,
  selectorFor,
};
