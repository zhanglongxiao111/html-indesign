'use strict';

const { collectKnownSemanticTokens } = require('../../semantic-preset');

function collectSemanticCandidates(model, preset) {
  const known = collectKnownSemanticTokens(preset || {});
  const knownDisplayNames = collectKnownDisplayNames(preset || {});
  const candidates = {};

  (model.pages || []).forEach((page) => {
    (page.items || []).forEach((item) => {
      const semantic = usefulToken(item.semantic);
      if (semantic) {
        const kind = item.role === 'text' ? 'paragraphStyles' : 'objectStyles';
        if (!hasKnownTerm(known, knownDisplayNames, kind, semantic)) {
          countCandidate(candidates, kind, semantic, item.styleName || semantic);
        }
      }

      const layer = usefulToken(item.layer || item.layerName);
      if (layer && !hasKnownTerm(known, knownDisplayNames, 'layers', layer)) {
        countCandidate(candidates, 'layers', layer, item.layerName || layer);
      }
    });
  });

  return {
    schemaVersion: 1,
    presetId: preset && preset.id || null,
    candidates: Object.keys(candidates).sort().map((key) => candidates[key]),
  };
}

function collectKnownDisplayNames(preset) {
  const known = {};
  const styleNameMap = preset && preset.styleNameMap || {};
  Object.keys(styleNameMap).forEach((kind) => {
    const mapped = styleNameMap[kind];
    if (!mapped || typeof mapped !== 'object' || Array.isArray(mapped)) return;
    known[kind] = new Set();
    Object.keys(mapped).forEach((token) => {
      const displayName = usefulToken(mapped[token]);
      if (displayName) known[kind].add(displayName);
    });
  });
  return known;
}

function hasKnownTerm(knownTokens, knownDisplayNames, kind, value) {
  return Boolean(
    knownTokens[kind] && knownTokens[kind].has(value)
    || knownDisplayNames[kind] && knownDisplayNames[kind].has(value),
  );
}

function countCandidate(map, kind, token, suggestedName) {
  const key = `${kind}:${token}`;
  if (!map[key]) {
    map[key] = {
      kind,
      token,
      suggestedName: suggestedName || token,
      source: 'reverse-export',
      count: 0,
    };
  }
  map[key].count += 1;
}

function usefulToken(value) {
  const token = String(value || '').trim();
  if (!token || token === 'unknown') return null;
  return token;
}

module.exports = { collectSemanticCandidates };
