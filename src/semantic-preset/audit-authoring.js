'use strict';

const fs = require('fs');
const cheerio = require('cheerio');
const { collectKnownSemanticTokens } = require('./maps');

const ATTRIBUTE_RULES = [
  ['data-id-paragraph-style', 'paragraphStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-character-style', 'characterStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-object-style', 'objectStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-frame-style', 'frameStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-table-style', 'tableStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-cell-style', 'cellStyles', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-layer', 'layers', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-semantic', 'semantic', 'SEMANTIC_TOKEN_UNKNOWN'],
  ['data-id-asset-kind', 'assets', 'SEMANTIC_ASSET_KIND_UNKNOWN'],
  ['data-id-fit', 'fits', 'SEMANTIC_ASSET_FIT_UNKNOWN'],
  ['data-id-crop', 'crops', 'SEMANTIC_ASSET_CROP_UNKNOWN'],
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
