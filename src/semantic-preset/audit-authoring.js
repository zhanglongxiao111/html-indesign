'use strict';

const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const fs = require('fs');
const cheerio = require('cheerio');
const { collectKnownSemanticTokens } = require('./maps');

const ATTRIBUTE_RULES = [
  [HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE, 'paragraphStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE, 'characterStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE, 'objectStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE, 'frameStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE, 'tableStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.CELL_STYLE, 'cellStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.LAYER, 'layers', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.SEMANTIC, 'semantic', 'SEMANTIC_TOKEN_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.ASSET_KIND, 'assets', 'SEMANTIC_ASSET_KIND_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.FIT, 'fits', 'SEMANTIC_ASSET_FIT_UNKNOWN'],
  [HTML_DATA_ID_ATTRIBUTES.CROP, 'crops', 'SEMANTIC_ASSET_CROP_UNKNOWN'],
];

function auditAuthoringSemanticTokens(options = {}) {
  const preset = options.preset || {};
  const pageFiles = options.pageFiles || [];
  const strict = !!options.strict;
  const known = collectKnownSemanticTokens(preset);
  const messages = [];

  pageFiles.forEach((pageFile) => {
    const html = fs.readFileSync(pageFile.filePath || pageFile, 'utf8');
    const file = pageFile.relativePath || pageFile.filePath || pageFile;
    const $ = cheerio.load(html, {
      decodeEntities: false,
      xmlMode: false,
    });

    ATTRIBUTE_RULES.forEach(([attrName, kind, code]) => {
      $(`[${attrName}]`).each((index, element) => {
        const raw = $(element).attr(attrName);
        const token = attributeToken(raw);
        if (!token) return;
        if (known[kind] && known[kind].has(token)) return;
        const enumError = code !== 'SEMANTIC_TOKEN_UNKNOWN';
        const level = enumError || strict ? 'error' : 'warning';
        const knownTokens = suggestedTokens(token, known[kind]);
        messages.push({
          level,
          code,
          message: unknownTokenMessage(token, attrName, kind, known[kind], knownTokens),
          file,
          attr: attrName,
          token,
          kind,
          knownTokens,
          totalKnown: known[kind] ? known[kind].size : 0,
        });
      });
    });
  });

  const errors = messages.filter((message) => message.level === 'error');
  const warnings = messages.filter((message) => message.level === 'warning');
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    messages,
  };
}

const MAX_LISTED_TOKENS = 20;
const MAX_SUGGESTED_TOKENS = 5;

// 只说 unknown 等于让 Agent 再猜一次；把本 kind 已登记的词表给出来，
// 词表太长时按编辑距离给最近的几个。
function suggestedTokens(token, knownSet) {
  const known = [...(knownSet || [])].sort();
  if (known.length <= MAX_LISTED_TOKENS) return known;
  return known
    .map((name) => [levenshtein(token, name), name])
    .sort((left, right) => left[0] - right[0] || left[1].localeCompare(right[1]))
    .slice(0, MAX_SUGGESTED_TOKENS)
    .map(([, name]) => name);
}

function unknownTokenMessage(token, attrName, kind, knownSet, suggested) {
  const base = `Unknown semantic token "${token}" in ${attrName}.`;
  const total = knownSet ? knownSet.size : 0;
  if (!total) return `${base} No ${kind} tokens are registered in the semantic preset; add it to the preset before using it.`;
  if (total <= MAX_LISTED_TOKENS) return `${base} Known ${kind}: ${suggested.join(', ')}.`;
  return `${base} ${total} ${kind} tokens are registered; closest: ${suggested.join(', ')}.`;
}

function levenshtein(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_value, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

// 这些 data-id-* 在协议注册表里都是单值 string 字段，整段属性值就是一个 token。
// InDesign 默认图层「图层 1」、内置样式「[Basic Paragraph]」都带空格，按空白拆开
// 会把一个名字拆成两个不存在的 token（#32）。
function attributeToken(value) {
  return String(value == null ? '' : value).trim();
}

module.exports = {
  ATTRIBUTE_RULES,
  attributeToken,
  auditAuthoringSemanticTokens,
};
