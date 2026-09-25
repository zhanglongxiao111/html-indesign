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

// 正向构建按 styleNameMap.layers 把图层语义键写成 InDesign 图层名（text -> 文字）；
// 反向读回的是图层名，这里给出反函数。多个键映射到同一图层名时取先登记的键。
function layerTokensByDisplayName(preset) {
  const layers = preset && preset.styleNameMap && preset.styleNameMap.layers;
  const out = new Map();
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) return out;
  for (const [token, displayName] of Object.entries(layers)) {
    const name = typeof displayName === 'string' ? displayName.trim() : '';
    const key = typeof token === 'string' ? token.trim() : '';
    if (name && key && !out.has(name)) out.set(name, key);
  }
  return out;
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
  layerTokensByDisplayName,
};
