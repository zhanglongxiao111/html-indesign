'use strict';

const fs = require('fs');
const cheerio = require('cheerio');
const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const { ATTRIBUTE_RULES, attributeToken } = require('./audit-authoring');
const { STYLE_NAME_MAP_KINDS } = require('./kinds');
const { collectKnownSemanticTokens } = require('./maps');
const { validateSemanticPreset } = require('./schema');

// 反向导出作者包的包内语义库（#32）。
//
// 反向写出的样式与图层 token 都是从 INDD 读回的真实资源名：正向构建按样式签名派生的变体
// （色块-08371558）、作者未登记的自动对象样式、人做 INDD 的「图层 1」「渐变段落」。
// 不登记，build 的 strict lint 就把它们判成 SEMANTIC_TOKEN_UNKNOWN；删掉又丢了往返。
// 这里把它们按「token -> 读回的 InDesign 名」登记进作者包自带的语义库，正向构建再按同一张表
// 写回同名样式和图层。
//
// 只登记 styleNameMap 类（样式、图层）：它们是文档里真实存在的资源名，登记不改变语义。
// 语义 token（data-id-semantic）是白名单，绝不自动登记；资源类型 / 置入方式 / 裁切这三类
// 枚举只接受标准语义库里已有的值（项目语义库可能是旧版标准库的拷贝，缺少后来补登记的
// manual、none）。其余一律留给 lint 报错，并记进 unresolved。
const STYLE_DISPLAY_NAME_ATTRS = Object.freeze({
  paragraphStyles: HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE_NAME,
  characterStyles: HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE_NAME,
  objectStyles: HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE_NAME,
  frameStyles: HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE_NAME,
  tableStyles: HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE_NAME,
});
const STYLE_NAME_MAP_KIND_SET = new Set(STYLE_NAME_MAP_KINDS);
const CANONICAL_ENUM_KINDS = new Set(['assets', 'fits', 'crops']);

function registerObservedSemanticTokens(options = {}) {
  const preset = clonePreset(options.preset);
  const canonical = collectKnownSemanticTokens(options.canonicalPreset || {});
  const known = collectKnownSemanticTokens(preset);
  const registrations = [];
  const unresolved = [];
  const unresolvedKeys = new Set();

  for (const pageFile of options.pageFiles || []) {
    const filePath = pageFile.filePath || pageFile;
    const file = pageFile.relativePath || filePath;
    const $ = cheerio.load(fs.readFileSync(filePath, 'utf8'), { decodeEntities: false, xmlMode: false });
    for (const [attrName, kind] of ATTRIBUTE_RULES) {
      $(`[${attrName}]`).each((_index, element) => {
        const token = attributeToken($(element).attr(attrName));
        if (!token || known[kind].has(token)) return;
        if (STYLE_NAME_MAP_KIND_SET.has(kind)) {
          const displayName = styleDisplayName($, element, kind) || token;
          if (!preset.styleNameMap[kind]) preset.styleNameMap[kind] = {};
          preset.styleNameMap[kind][token] = displayName;
          known[kind].add(token);
          registrations.push({ kind, token, displayName, attr: attrName, file });
          return;
        }
        if (CANONICAL_ENUM_KINDS.has(kind) && canonical[kind].has(token)) {
          if (!preset.tokens) preset.tokens = {};
          if (!Array.isArray(preset.tokens[kind])) preset.tokens[kind] = [];
          preset.tokens[kind].push(token);
          known[kind].add(token);
          registrations.push({ kind, token, attr: attrName, file });
          return;
        }
        const key = `${kind}\u0000${token}`;
        if (unresolvedKeys.has(key)) return;
        unresolvedKeys.add(key);
        unresolved.push({ kind, token, attr: attrName, file });
      });
    }
  }

  const validation = validateSemanticPreset(preset);
  if (!validation.valid) {
    const error = new Error(`SEMANTIC_PRESET_INVALID: registered reverse tokens produced an invalid preset: ${validation.errors.map((entry) => entry.code).join(', ')}`);
    error.code = 'SEMANTIC_PRESET_INVALID';
    error.details = validation.errors;
    throw error;
  }
  return { preset, registrations, unresolved };
}

function styleDisplayName($, element, kind) {
  const attrName = STYLE_DISPLAY_NAME_ATTRS[kind];
  if (!attrName) return '';
  return attributeToken($(element).attr(attrName));
}

function clonePreset(preset) {
  const out = JSON.parse(JSON.stringify(preset && typeof preset === 'object' ? preset : {}));
  if (!out.styleNameMap || typeof out.styleNameMap !== 'object' || Array.isArray(out.styleNameMap)) out.styleNameMap = {};
  return out;
}

module.exports = { registerObservedSemanticTokens };
