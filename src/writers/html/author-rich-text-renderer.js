const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml, escapeHtml } = require('./author-attribute-writer');
const { patchTableSourceHtmlCells, patchTableSourceHtmlRows, tableContent } = require('./author-table-renderer');
const { patchSourceHtmlStyles, runStyleCss } = require('./author-run-style');
const { safeAuthorClassToken } = require('../../shared/style-utils');
const {
  isUsefulCharacterStyle,
  orderInlineAttrs,
  safeInlineTag,
} = require('./author-render-utils');

// options.writeRunStyles：对象的读回样式写进作者 HTML 时（未保留可信源码样式），
// 字符级外观与段落不同的 run 同样写内联 style（author-run-style）。
function ownContent(item, depth, options = {}) {
  const sourceHtml = itemSourceHtml(item, options);
  const baseTextStyle = options.writeRunStyles ? item.textStyle || null : null;
  if (item.role === 'table' && sourceHtml) {
    const cellStyled = options.writeRunStyles && item.table
      ? patchTableSourceHtmlRows(patchTableSourceHtmlCells(sourceHtml, item.table, item.textStyle || null), item.table)
      : sourceHtml;
    return tableSourceHtmlContent(cellStyled, depth);
  }
  if (sourceHtml) {
    const styled = styledSourceHtml(item, sourceHtml, baseTextStyle);
    if (styled != null) return sourceHtmlContent(styled, depth);
  } else {
    if (item.role === 'table' && item.table) {
      const tableOptions = { writeRunStyles: options.writeRunStyles, baseTextStyle: item.textStyle || null };
      return `\n${tableContent(item.table, depth + 2, tableOptions)}\n${' '.repeat(depth)}`;
    }
    if (item.authorTextCompanion && item.authorTextCompanion.content) {
      return plainTextContent(item.authorTextCompanion.content.text || '');
    }
  }
  // 来源 HTML 保不住（或没有来源 HTML）时按读回 run 重新渲染：带构建标签的多段文本框与无标签对象
  // 走同一条分段写出（每段一个 <p>），段落结束符不能写成 <br>。
  if (options.paragraphFrame) return paragraphFrameContent(item, depth, baseTextStyle);
  const rich = richTextContent(item, baseTextStyle);
  if (rich != null) return rich;
  if (sourceHtml) return sourceHtmlContent(sourceHtml, depth);
  return plainTextContent((item.content && item.content.text) || '');
}

function itemSourceHtml(item, options = {}) {
  const content = item && item.content;
  return !options.ignoreSourceHtml && content && typeof content.sourceHtml === 'string' && content.sourceHtml !== ''
    ? content.sourceHtml
    : null;
}

// 来源 HTML 片段原样保留，只给外观与段落不同的 run 按 id 合并 style；
// 有 run 定位不到（没有 id、id 不唯一）时返回 null，改由 run 重新渲染。
function styledSourceHtml(item, sourceHtml, baseTextStyle) {
  if (!baseTextStyle) return sourceHtml;
  const runs = Array.isArray(item.content && item.content.runs) ? item.content.runs : [];
  const patches = [];
  for (const run of runs) {
    const css = runStyleCss(run && run.textStyle, baseTextStyle);
    if (!css) continue;
    const id = run.attributes && run.attributes.id;
    if (!id) return null;
    patches.push({ id: String(id), css });
  }
  if (!patches.length) return sourceHtml;
  return patchSourceHtmlStyles(sourceHtml, patches);
}

function sourceHtmlContent(sourceHtml, depth) {
  const text = String(sourceHtml).replace(/\r\n|\r/g, '\n');
  if (!/^\s*\n/.test(text) || !/\n\s*$/.test(text)) return text;
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  if (!lines.length) return '';
  const contentLines = lines.filter((line) => line.trim() !== '');
  const commonIndent = contentLines.reduce(
    (min, line) => Math.min(min, /^[ \t]*/.exec(line)[0].length),
    Infinity,
  );
  const contentIndent = ' '.repeat(depth + 2);
  const body = lines.map((line) => (
    line.trim() === '' ? '' : `${contentIndent}${line.slice(commonIndent)}`
  )).join('\n');
  return `\n${body}\n${' '.repeat(depth)}`;
}

function tableSourceHtmlContent(sourceHtml, depth) {
  const contentLines = String(sourceHtml).split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');
  if (!contentLines.length) return '';
  const commonIndent = contentLines.reduce(
    (min, line) => Math.min(min, /^ */.exec(line)[0].length),
    Infinity,
  );
  const body = contentLines.map((line) => `${' '.repeat(depth + 2)}${line.slice(commonIndent)}`).join('\n');
  return `\n${body}\n${' '.repeat(depth)}`;
}

function richTextContent(item, baseTextStyle = null) {
  const content = item.content || {};
  const text = String(content.text == null ? '' : content.text);
  const runs = Array.isArray(content.runs)
    ? content.runs
      .filter((run) => run && run.text != null && String(run.text) !== '')
      .map((run) => withRunStyle(run, baseTextStyle))
    : [];
  if (!text || !runs.some((run) => hasRichRunMarkup(run))) return null;
  let cursor = 0;
  let html = '';
  for (const run of runs) {
    const runText = String(run.text);
    const index = text.indexOf(runText, cursor);
    if (index < cursor) return null;
    html += plainTextContent(text.slice(cursor, index));
    html += renderInlineRun(run);
    cursor = index + runText.length;
  }
  html += plainTextContent(text.slice(cursor));
  return html;
}

// 写出用的临时副本：authorStyle 是这次要写的内联 style（来源 run 上的 style 属性不直接透传）。
function withRunStyle(run, baseTextStyle) {
  const css = runStyleCss(run.textStyle, baseTextStyle);
  return css ? { ...run, authorStyle: css } : run;
}

function renderInlineRun(run) {
  if (!hasRichRunMarkup(run)) return plainTextContent(run.text);
  const tag = safeInlineTag(run.tagName);
  const attrs = mergeAttributes(run.attributes);
  if (isUsefulCharacterStyle(run.characterStyle) && !attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE]) {
    attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE] = run.characterStyle;
  }
  const classes = new Set(run.classList || []);
  // 字符样式类（cstyle-<token>）与元素上的 pstyle / ostyle 类同一规则：components.css 的 .cstyle-* 是
  // 字符样式定义，浏览器预览按它上色，正向构建也只从这条规则读字符样式定义（其余是 run 局部格式）。
  const characterStyle = attrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE];
  if (isUsefulCharacterStyle(characterStyle)) classes.add(`cstyle-${safeAuthorClassToken(characterStyle)}`);
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  if (run.authorStyle) attrs.style = run.authorStyle;
  const attrHtml = attrsToHtml(orderInlineAttrs(attrs));
  return `<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${plainTextContent(run.text)}</${tag}>`;
}

function hasRichRunMarkup(run) {
  if (run.authorStyle) return true;
  if (isUsefulCharacterStyle(run.characterStyle)) return true;
  if ((run.classList || []).length) return true;
  const attrs = mergeAttributes(run.attributes);
  if (Object.keys(attrs).some((name) => name !== 'id')) return true;
  const tag = safeInlineTag(run.tagName);
  return tag !== 'span';
}

// 多段文本框（InDesign 段落结束符 \r 分隔的多段）：文本框写成 data-id-role="text" 容器，每段一个 <p>，
// 段内强制换行（\n）仍写 <br>。正向把这种容器读回成一个文本框、段间用 \r 分隔（browser-element-capture）。
// 只处理由读回 run 重新渲染的文本：来源 HTML 能原样保留（run 外观可按 id 合并）的对象、有子对象的对象
// 不走这里；带构建标签但来源 HTML 保不住的对象与无标签对象走同一条分段写出。
const PARAGRAPH_BREAK = '\r';

function frameParagraphTexts(item) {
  const text = String(item && item.content && item.content.text != null ? item.content.text : '');
  const paragraphs = text.split(PARAGRAPH_BREAK);
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1] === '') paragraphs.pop();
  return paragraphs;
}

// options 与 ownContent 相同：writeRunStyles 决定来源 HTML 能否原样保留。
function isParagraphFrameItem(item, hasChildren, options = {}) {
  if (!item || item.role !== 'text' || hasChildren) return false;
  if (frameParagraphTexts(item).length <= 1) return false;
  const sourceHtml = itemSourceHtml(item, options);
  if (!sourceHtml) return !item.authorTextCompanion;
  const baseTextStyle = options.writeRunStyles ? item.textStyle || null : null;
  return styledSourceHtml(item, sourceHtml, baseTextStyle) == null;
}

function paragraphFrameContent(item, depth, baseTextStyle) {
  const paragraphs = splitParagraphRuns(item);
  const pad = ' '.repeat(depth + 2);
  const body = paragraphs.map((paragraph) => {
    const rich = richTextContent({ content: paragraph }, baseTextStyle);
    return `${pad}<p>${rich != null ? rich : plainTextContent(paragraph.text)}</p>`;
  }).join('\n');
  return `\n${body}\n${' '.repeat(depth)}`;
}

// 读回 run 按段落切开：跨段的 run 在 \r 处拆成几段各自带同样外观；run 定位不上全文时只按文字分段。
function splitParagraphRuns(item) {
  const content = item.content || {};
  const text = String(content.text == null ? '' : content.text);
  const texts = frameParagraphTexts(item);
  const paragraphs = texts.map((paragraphText) => ({ text: paragraphText, runs: [] }));
  const starts = [];
  let offset = 0;
  for (const paragraphText of texts) {
    starts.push(offset);
    offset += paragraphText.length + PARAGRAPH_BREAK.length;
  }
  const paragraphAt = (position) => {
    let index = 0;
    while (index + 1 < starts.length && starts[index + 1] <= position) index += 1;
    return index;
  };
  const runs = Array.isArray(content.runs) ? content.runs.filter((run) => run && run.text != null && String(run.text) !== '') : [];
  let cursor = 0;
  for (const run of runs) {
    const runText = String(run.text);
    const index = text.indexOf(runText, cursor);
    if (index < cursor) return texts.map((paragraphText) => ({ text: paragraphText, runs: [] }));
    let position = index;
    for (const piece of runText.split(PARAGRAPH_BREAK)) {
      if (piece) {
        const target = paragraphs[paragraphAt(position)];
        if (target) target.runs.push({ ...run, text: piece });
      }
      position += piece.length + PARAGRAPH_BREAK.length;
    }
    cursor = index + runText.length;
  }
  return paragraphs;
}

function plainTextContent(value) {
  return escapeHtml(value)
    .replace(/\u00a0/g, '&nbsp;')
    .replace(/(\r\n|\r|\n)( +)/g, (match, lineBreak, spaces) => `\n${'&nbsp;'.repeat(spaces.length)}`)
    .replace(/\r\n|\r|\n/g, '<br>');
}

module.exports = {
  isParagraphFrameItem,
  ownContent,
  sourceHtmlContent,
  richTextContent,
  renderInlineRun,
  hasRichRunMarkup,
  plainTextContent,
};
