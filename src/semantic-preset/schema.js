'use strict';

const {
  STYLE_NAME_MAP_KINDS,
  TOKEN_LIST_KINDS,
} = require('./kinds');

const STYLE_NAME_MAP_KIND_SET = new Set(STYLE_NAME_MAP_KINDS);

function validateSemanticPreset(preset, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(preset)) {
    push(errors, 'SEMANTIC_PRESET_NOT_OBJECT', 'Semantic preset must be an object', options);
    return { valid: false, errors, warnings };
  }

  if (preset.schemaVersion !== 1) {
    push(errors, 'SEMANTIC_PRESET_SCHEMA_VERSION_INVALID', 'semantic preset schemaVersion must be 1');
  }
  if (typeof preset.id !== 'string' || !preset.id.trim()) {
    push(errors, 'SEMANTIC_PRESET_ID_REQUIRED', 'semantic preset id is required');
  }
  if (!isObject(preset.styleNameMap)) {
    push(errors, 'SEMANTIC_PRESET_STYLE_MAP_REQUIRED', 'semantic preset styleNameMap is required');
  } else {
    validateStyleNameMapKinds(errors, preset.styleNameMap);
    STYLE_NAME_MAP_KINDS.forEach((name) => validateStringMap(errors, preset, name));
  }

  if (preset.tokens !== undefined && !isObject(preset.tokens)) {
    push(errors, 'SEMANTIC_PRESET_TOKENS_INVALID', 'tokens must be an object');
  } else {
    TOKEN_LIST_KINDS.forEach((name) => validateStringArray(errors, preset, name));
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateStyleNameMapKinds(errors, styleNameMap) {
  Object.keys(styleNameMap).forEach((kind) => {
    if (!STYLE_NAME_MAP_KIND_SET.has(kind)) {
      push(errors, 'SEMANTIC_PRESET_STYLE_MAP_KIND_UNKNOWN', `styleNameMap.${kind} is not a registered style map kind`, { kind });
    }
  });
}

function validateStringMap(errors, preset, name) {
  const value = preset.styleNameMap[name];
  if (value === undefined) return;
  if (!isObject(value)) {
    push(errors, 'SEMANTIC_PRESET_STYLE_MAP_INVALID', `${name} must be an object`);
    return;
  }
  Object.keys(value).forEach((token) => {
    if (typeof value[token] !== 'string' || !value[token].trim()) {
      push(errors, 'SEMANTIC_PRESET_STYLE_NAME_INVALID', `${name}.${token} must be a non-empty string`);
    }
  });
}

function validateStringArray(errors, preset, name) {
  const value = preset.tokens && preset.tokens[name];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    push(errors, 'SEMANTIC_PRESET_TOKEN_LIST_INVALID', `tokens.${name} must be an array`);
    return;
  }
  value.forEach((token, index) => {
    if (typeof token !== 'string' || !token.trim()) {
      push(errors, 'SEMANTIC_PRESET_TOKEN_INVALID', `tokens.${name}[${index}] must be a non-empty string`);
    }
  });
}

function push(errors, code, message, details) {
  errors.push({ code, message, details: details || {} });
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { validateSemanticPreset };
