'use strict';

const {
  STYLE_NAME_MAP_KINDS,
  TOKEN_LIST_KINDS,
} = require('./kinds');

function presetToStyleNameMap(preset) {
  return Object.assign({}, preset && preset.styleNameMap ? preset.styleNameMap : {});
}

function collectKnownSemanticTokens(preset) {
  const tokens = emptyKnownTokenSets();

  const styleNameMap = (preset && preset.styleNameMap) || {};
  STYLE_NAME_MAP_KINDS.forEach((kind) => {
    const mapped = styleNameMap[kind];
    if (mapped && typeof mapped === 'object' && !Array.isArray(mapped)) {
      Object.keys(mapped).forEach((token) => addToken(tokens[kind], token));
    }
  });

  const declared = (preset && preset.tokens) || {};
  TOKEN_LIST_KINDS.forEach((kind) => {
    const values = Array.isArray(declared[kind]) ? declared[kind] : [];
    values.forEach((token) => addToken(tokens[kind], token));
  });

  return tokens;
}

function emptyKnownTokenSets() {
  const tokens = {};
  STYLE_NAME_MAP_KINDS.forEach((kind) => {
    tokens[kind] = new Set();
  });
  TOKEN_LIST_KINDS.forEach((kind) => {
    tokens[kind] = new Set();
  });
  return tokens;
}

function addToken(set, value) {
  if (typeof value === 'string' && value.trim()) set.add(value.trim());
}

module.exports = {
  presetToStyleNameMap,
  collectKnownSemanticTokens,
};
