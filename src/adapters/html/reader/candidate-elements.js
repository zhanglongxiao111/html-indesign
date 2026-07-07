const { inferAssetKind, assetSourceFromElementLike } = require('../../../shared/assets');
const {
  HTML_DATA_ID_ATTRIBUTES,
  ITEM_ROLE,
  htmlItemRoleFromElementFacts,
  htmlPhysicalItemRoleFromAttributes,
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
  if (hasAssetSource) return ITEM_ROLE.GRAPHIC;
  const protocolRole = htmlPhysicalItemRoleFromAttributes(attributes);
  if (protocolRole) return protocolRole;
  if (attributes[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE]) return ITEM_ROLE.TEXT;
  return htmlItemRoleFromElementFacts({ tagName, attributes, hasAssetSource });
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
