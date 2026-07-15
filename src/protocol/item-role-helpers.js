const {
  AUTHORING_MAPPABLE_ITEM_ROLE_VALUES,
  HTML_DATA_ID_ATTRIBUTES,
  HTML_PHYSICAL_ITEM_ROLE_VALUES,
  ITEM_ROLE,
  ITEM_ROLE_VALUES,
} = require('./constants');

const REGISTERED_ITEM_ROLE_SET = new Set(ITEM_ROLE_VALUES);
const HTML_PHYSICAL_ITEM_ROLE_SET = new Set(HTML_PHYSICAL_ITEM_ROLE_VALUES);
const AUTHORING_MAPPABLE_ITEM_ROLE_SET = new Set(AUTHORING_MAPPABLE_ITEM_ROLE_VALUES);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption', 'td', 'th']);
const GRAPHIC_TAGS = new Set(['img', 'object', 'embed', 'canvas']);

function registeredItemRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return REGISTERED_ITEM_ROLE_SET.has(role) ? role : '';
}

function htmlPhysicalItemRoleFromAttributes(attributes) {
  const role = registeredItemRole(attributeValue(attributes, HTML_DATA_ID_ATTRIBUTES.ROLE));
  return HTML_PHYSICAL_ITEM_ROLE_SET.has(role) ? role : '';
}

function htmlItemRoleFromElementFacts(facts = {}) {
  const tagName = String(facts.tagName || '').trim().toLowerCase();
  const attributes = facts.attributes || {};
  if (facts.hasAssetSource) return ITEM_ROLE.GRAPHIC;

  const protocolRole = htmlPhysicalItemRoleFromAttributes(attributes);
  if (protocolRole) return protocolRole;

  if (attributeValue(attributes, HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE)) return ITEM_ROLE.TEXT;
  if (facts.naturalTextElement === true
    && !Object.prototype.hasOwnProperty.call(attributes, HTML_DATA_ID_ATTRIBUTES.OBJECT)) return ITEM_ROLE.TEXT;
  if (tagName === 'svg') {
    const vectorKind = String(attributeValue(attributes, HTML_DATA_ID_ATTRIBUTES.VECTOR) || '').trim().toLowerCase();
    return vectorKind === 'line' ? ITEM_ROLE.LINE : ITEM_ROLE.SHAPE;
  }
  if (TEXT_TAGS.has(tagName)) return ITEM_ROLE.TEXT;
  if (GRAPHIC_TAGS.has(tagName)) return ITEM_ROLE.GRAPHIC;
  if (tagName === 'table') return ITEM_ROLE.TABLE;
  return ITEM_ROLE.SHAPE;
}

function isAuthoringMappableItemRole(value) {
  return AUTHORING_MAPPABLE_ITEM_ROLE_SET.has(registeredItemRole(value));
}

function attributeValue(attributes, name) {
  if (!attributes || !name) return null;
  if (Object.prototype.hasOwnProperty.call(attributes, name)) return attributes[name];
  const lower = String(name).toLowerCase();
  const key = Object.keys(attributes).find((candidate) => candidate.toLowerCase() === lower);
  return key ? attributes[key] : null;
}

module.exports = {
  htmlItemRoleFromElementFacts,
  htmlPhysicalItemRoleFromAttributes,
  isAuthoringMappableItemRole,
  registeredItemRole,
};
