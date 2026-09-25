const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const { styleNameForKind } = require('./style-identities');

// 反向导出的观察页（人工 INDD 回读）上，原件没有绑定样式的对象只带局部格式。
// 正向构建对这类对象不凭空新建命名样式（自动段落 / 自动字符 / 自动对象 / 单独使用的合成样式），
// 而是不套样式、把外观写成局部覆盖，重建文档的样式清单才接近原件。
// 判定：所在页是观察页（data-id-observed="true" 或带 data-id-reverse-mode），该种类没有声明样式身份，
// 且合成样式 token（data-id-style-token）只被这一个未声明样式的对象使用——多个这样的对象共用的合成样式是
// “相同外观归并”，照旧建样式；已声明真实样式的对象不算合成样式的使用者。
// 正常 HTML 作者包没有观察页标记，行为不变。

const SYNTHESIZED_TOKEN_PATTERN = /^synth_/;

const STYLE_KIND_BY_SYNTH_KIND = Object.freeze({ text: 'paragraphStyles', object: 'objectStyles', line: 'objectStyles', asset: 'objectStyles', frame: 'objectStyles' });

function synthesizedTokenUsage(pages, options) {
  const usage = new Map();
  for (const page of Array.isArray(pages) ? pages : []) {
    for (const item of Array.isArray(page && page.items) ? page.items : []) {
      const token = synthesizedTokenOf(item);
      if (!token) continue;
      const kind = STYLE_KIND_BY_SYNTH_KIND[token.split('_')[1]];
      if (kind && styleNameForKind(withoutSynthesizedIdentity(item), kind, null, options)) continue;
      usage.set(token, (usage.get(token) || 0) + 1);
    }
  }
  return usage;
}

function localFormattingOptions(page, options, usage) {
  if (!isObservedPage(page)) return options;
  return { ...options, observedPage: true, synthesizedTokenUsage: usage };
}

function isObservedPage(page) {
  const attributes = page && page.attributes || {};
  return String(attributes[HTML_DATA_ID_ATTRIBUTES.OBSERVED] || '').trim().toLowerCase() === 'true'
    || Boolean(String(attributes[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] || '').trim());
}

// kind: paragraphStyles / characterStyles / objectStyles。返回 true 时调用方不建命名样式，改写局部覆盖。
function keepsLocalFormatting(item, kind, options) {
  if (!options || !options.observedPage || !item) return false;
  if (styleNameForKind(withoutSynthesizedIdentity(item), kind, null, options)) return false;
  const token = synthesizedTokenOf(item);
  const usage = options.synthesizedTokenUsage;
  return !(token && usage && Number(usage.get(token) || 0) > 1);
}

function synthesizedTokenOf(item) {
  const token = String(item && item.attributes && item.attributes[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN] || '').trim();
  return SYNTHESIZED_TOKEN_PATTERN.test(token) ? token : null;
}

// 合成样式的显示名（data-id-style-name，与 synth_* token 成对写出）不算声明的样式身份。
function withoutSynthesizedIdentity(item) {
  if (!synthesizedTokenOf(item)) return item;
  const attributes = { ...(item.attributes || {}) };
  delete attributes[HTML_DATA_ID_ATTRIBUTES.STYLE_NAME];
  delete attributes[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN];
  return { ...item, attributes };
}

module.exports = {
  keepsLocalFormatting,
  localFormattingOptions,
  synthesizedTokenUsage,
};
