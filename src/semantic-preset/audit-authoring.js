const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
'use strict';

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
        splitTokens(raw).forEach((token) => {
          if (known[kind] && known[kind].has(token)) return;
          const enumError = code !== 'SEMANTIC_TOKEN_UNKNOWN';
          const level = enumError || strict ? 'error' : 'warning';
          messages.push({
            level,
            code,
            message: `Unknown semantic token "${token}" in ${attrName}.`,
            file,
            attr: attrName,
            token,
            kind,
          });
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

function splitTokens(value) {
  return String(value || '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

module.exports = { auditAuthoringSemanticTokens };
