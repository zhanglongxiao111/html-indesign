const { fieldRegistry } = require('./field-entries');

const REQUIRED_VALUE_FIELDS = Object.freeze({
  ITEM_ROLE_VALUES: 'items[].role',
  STYLE_KIND_VALUES: 'labels[].styleKind',
  SYNTHESIZED_STYLE_KIND_VALUES: 'styles.synthesized[].kind',
});

function deriveProtocolConstants(registry) {
  if (!registry || !Array.isArray(registry.entries) || typeof registry.getByPath !== 'function') {
    throw new Error('PROTOCOL_CONSTANT_REGISTRY_INVALID');
  }

  const htmlDataIdAttributeNames = htmlDataIdAttributesFor(registry);
  const retiredHtmlDataIdAttributeNames = retiredHtmlDataIdAttributesFor(registry);
  const itemRoleField = requiredField(registry, REQUIRED_VALUE_FIELDS.ITEM_ROLE_VALUES);
  const itemRoleValues = allowedValuesForField(itemRoleField, REQUIRED_VALUE_FIELDS.ITEM_ROLE_VALUES);
  const styleKindValues = allowedValuesFor(registry, REQUIRED_VALUE_FIELDS.STYLE_KIND_VALUES);
  const synthesizedStyleKindValues = allowedValuesFor(
    registry,
    REQUIRED_VALUE_FIELDS.SYNTHESIZED_STYLE_KIND_VALUES,
  );
  const authoringMappableItemRoleValues = itemRoleSubsetFor(
    itemRoleField,
    itemRoleValues,
    'authoringMappable',
    'AUTHORING_MAPPABLE_ITEM_ROLE_VALUES',
  );
  const htmlPhysicalItemRoleValues = itemRoleSubsetFor(
    itemRoleField,
    itemRoleValues,
    'htmlPhysical',
    'HTML_PHYSICAL_ITEM_ROLE_VALUES',
  );

  return deepFreeze({
    HTML_DATA_ID_ATTRIBUTES: enumObjectForValues(htmlDataIdAttributeNames, 'data-id-'),
    HTML_DATA_ID_ATTRIBUTE_NAMES: htmlDataIdAttributeNames,
    RETIRED_HTML_DATA_ID_ATTRIBUTES: enumObjectForValues(retiredHtmlDataIdAttributeNames, 'data-id-'),
    RETIRED_HTML_DATA_ID_ATTRIBUTE_NAMES: retiredHtmlDataIdAttributeNames,
    ITEM_ROLE: enumObjectForValues(itemRoleValues),
    ITEM_ROLE_VALUES: itemRoleValues,
    AUTHORING_MAPPABLE_ITEM_ROLE_VALUES: authoringMappableItemRoleValues,
    HTML_PHYSICAL_ITEM_ROLE_VALUES: htmlPhysicalItemRoleValues,
    STYLE_KIND: enumObjectForValues(styleKindValues),
    STYLE_KIND_VALUES: styleKindValues,
    SYNTHESIZED_STYLE_KIND: enumObjectForValues(synthesizedStyleKindValues),
    SYNTHESIZED_STYLE_KIND_VALUES: synthesizedStyleKindValues,
  });
}

function htmlDataIdAttributesFor(registry) {
  const attrs = new Set();

  for (const entry of registry.entries) {
    if (!entry || entry.lifecycle !== 'active') continue;
    const html = entry.html || {};
    for (const attr of [
      ...arrayOrEmpty(html.readAttrs),
      ...arrayOrEmpty(html.writeAttrs),
      ...arrayOrEmpty(html.persistAttrs),
    ]) {
      if (typeof attr !== 'string' || !attr.startsWith('data-id-')) continue;
      attrs.add(attr);
    }
  }

  return Object.freeze(Array.from(attrs).sort());
}

function retiredHtmlDataIdAttributesFor(registry) {
  const attrs = new Set();

  for (const entry of registry.entries) {
    const retired = entry && entry.retired || {};
    for (const attr of arrayOrEmpty(retired.htmlAttrs)) {
      const name = attr && attr.name;
      if (typeof name !== 'string' || !name.startsWith('data-id-')) continue;
      attrs.add(name);
    }
  }

  return Object.freeze(Array.from(attrs).sort());
}

function allowedValuesFor(registry, fieldPath) {
  const field = requiredField(registry, fieldPath);
  return allowedValuesForField(field, fieldPath);
}

function requiredField(registry, fieldPath) {
  const field = registry.getByPath(fieldPath);
  if (!field) {
    throw new Error(`PROTOCOL_CONSTANT_FIELD_MISSING:${fieldPath}`);
  }
  return field;
}

function allowedValuesForField(field, fieldPath) {
  if (!Array.isArray(field.allowedValues) || field.allowedValues.length === 0) {
    throw new Error(`PROTOCOL_CONSTANT_VALUES_MISSING:${fieldPath}`);
  }

  return Object.freeze(field.allowedValues.slice());
}

function itemRoleSubsetFor(itemRoleField, itemRoleValues, subsetKey, subsetName) {
  const selectedValues = itemRoleField.roleSubsets && itemRoleField.roleSubsets[subsetKey];
  if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
    throw new Error(`PROTOCOL_CONSTANT_ROLE_SUBSET_MISSING:${subsetName}`);
  }
  const valueSet = new Set(itemRoleValues);
  const missing = selectedValues.filter((value) => !valueSet.has(value));
  if (missing.length) {
    throw new Error(`PROTOCOL_CONSTANT_ROLE_SUBSET_INVALID:${subsetName}:${missing.join(',')}`);
  }
  return Object.freeze(selectedValues.slice());
}

function enumObjectForValues(values, prefixToRemove = '') {
  const constants = {};
  for (const value of values) {
    const key = constantKeyFor(String(value), prefixToRemove);
    if (!key) {
      throw new Error(`PROTOCOL_CONSTANT_KEY_INVALID:${value}`);
    }
    if (Object.prototype.hasOwnProperty.call(constants, key)) {
      throw new Error(`PROTOCOL_CONSTANT_KEY_DUPLICATED:${key}`);
    }
    constants[key] = value;
  }
  return Object.freeze(constants);
}

function constantKeyFor(value, prefixToRemove) {
  const withoutPrefix = prefixToRemove && value.startsWith(prefixToRemove)
    ? value.slice(prefixToRemove.length)
    : value;
  return withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const item of Object.values(value)) {
    deepFreeze(item);
  }
  return Object.freeze(value);
}

const defaultConstants = deriveProtocolConstants(fieldRegistry);

module.exports = {
  deriveProtocolConstants,
  ...defaultConstants,
};
