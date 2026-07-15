const { inferAssetKind, assetSourceFromElementLike } = require('../../../shared/assets');
const {
  htmlItemRoleFromElementFacts,
} = require('../../../protocol');

function roleFromItem(item) {
  const tagName = item.tagName;
  const attributes = item.attributes || {};
  const source = assetSourceFromElementLike({
    tagName,
    attributes,
    computedStyle: item.computedStyle,
    authoredStyle: item.authoredStyle,
  });
  const hasAssetSource = source.src && inferAssetKind(source.src, source.explicitKind) !== 'unknown';
  return htmlItemRoleFromElementFacts({
    tagName,
    attributes,
    hasAssetSource,
    naturalTextElement: item.naturalTextElement === true,
  });
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
