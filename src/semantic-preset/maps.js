'use strict';

function presetToStyleNameMap(preset) {
  return Object.assign({}, preset && preset.styleNameMap ? preset.styleNameMap : {});
}

function collectKnownSemanticTokens(preset) {
  const tokens = {
    paragraphStyles: new Set(),
    characterStyles: new Set(),
    objectStyles: new Set(),
    frameStyles: new Set(),
    tableStyles: new Set(),
    cellStyles: new Set(),
    layers: new Set(),
    semantic: new Set(),
    assets: new Set(),
    fits: new Set(),
    crops: new Set(),
  };

  const styleNameMap = (preset && preset.styleNameMap) || {};
  Object.keys(tokens).forEach((kind) => {
    const mapped = styleNameMap[kind];
    if (mapped && typeof mapped === 'object' && !Array.isArray(mapped)) {
      Object.keys(mapped).forEach((token) => addToken(tokens[kind], token));
    }
  });

  const declared = (preset && preset.tokens) || {};
  ['semantic', 'assets', 'fits', 'crops'].forEach((kind) => {
    const values = Array.isArray(declared[kind]) ? declared[kind] : [];
    values.forEach((token) => addToken(tokens[kind], token));
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
