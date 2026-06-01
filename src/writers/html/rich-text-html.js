const {
  attr,
  escapeHtml,
  formatNumber,
  cssForHtml,
  styleByName,
  styleClassToken,
  usesCompositeFont,
  indesignFeatures,
  wrapEnglishText,
  splitLines,
} = require('./visual-html-utils');
const { textStyleCss } = require('./visual-style-css');

function renderTextContent(item, model) {
  const text = textContent(item);
  if (item.role !== 'text') return escapeHtml(text);
  const runs = contentRuns(item);
  if (runs.length) return renderRichTextRuns(runs, model);
  const paragraphStyle = styleByName(model, 'paragraphStyles', item.styleRefs && item.styleRefs.paragraphStyle);
  const features = indesignFeatures(paragraphStyle);
  const usesComposite = usesCompositeFont(paragraphStyle, model, item.firstLineFont);

  if (features.list) return renderListText(text, features.list, usesComposite);
  if (features.dropCap) return renderDropCapText(text, features.dropCap, usesComposite);
  if (features.grepStyles && features.grepStyles.length) return renderGrepText(text, features.grepStyles, usesComposite, item, model);
  return renderPlainText(text, usesComposite);
}

function renderRichTextRuns(runs, model) {
  return runs.map((run) => {
    const content = renderTextWithBreaks(run.text);
    const characterStyle = styleByName(model, 'characterStyles', run.characterStyle);
    const classes = characterStyle ? [`cstyle-${styleClassToken(characterStyle)}`] : [];
    const inlineStyle = [
      run.inlineStyle ? cssForHtml(run.inlineStyle) : textStyleCss(run.textStyle),
    ].filter(Boolean).map((value) => String(value).trim().replace(/;+$/, '')).join(';');
    const attrs = [
      classes.length ? `class="${attr(classes.join(' '))}"` : null,
      inlineStyle ? `style="${attr(inlineStyle)}"` : null,
    ].filter(Boolean);
    return attrs.length ? `<span ${attrs.join(' ')}>${content}</span>` : content;
  }).join('');
}

function contentRuns(item) {
  const runs = item.content && Array.isArray(item.content.runs) ? item.content.runs : [];
  return runs.filter((run) => run && run.text != null && String(run.text) !== '');
}

function renderPlainText(text, usesComposite) {
  if (usesComposite) {
    return splitLines(text).map((line) => wrapEnglishText(escapeHtml(line))).join('<br>');
  }
  return renderTextWithBreaks(text);
}

function renderTextWithBreaks(text) {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');
}

function renderListText(text, list, usesComposite) {
  const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
  let counter = 1;
  return splitLines(text).map((line) => {
    if (!line.trim()) return '';
    const content = usesComposite ? wrapEnglishText(escapeHtml(line)) : escapeHtml(line);
    if (list.type === 'bullet') return `<span class="list-item has-bullet">${content}</span>`;
    const number = counter++;
    const circle = list.isCircle ? ` data-circle="${circleNumbers[number - 1] || `(${number})`}"` : '';
    return `<span class="list-item has-number" data-number="${number}"${circle}>${content}</span>`;
  }).filter(Boolean).join('\n');
}

function renderDropCapText(text, dropCap, usesComposite) {
  const chars = Math.max(1, Number(dropCap.chars || 1));
  const escaped = escapeHtml(text);
  const head = escaped.slice(0, chars);
  const rest = escaped.slice(chars);
  const restContent = usesComposite ? wrapEnglishText(rest) : rest;
  return `<span class="dropcap-chars">${head}</span><span class="dropcap-rest">${restContent}</span>`;
}

function renderGrepText(text, grepStyles, usesComposite, item, model) {
  const lines = splitLines(text).map((line) => escapeHtml(line));
  for (const grepStyle of grepStyles) {
    if (grepStyle.pattern && grepStyle.pattern.includes('^.+?(?=\\n|\\r)') && lines.length > 0) {
      const firstUsesComposite = usesCompositeFont(null, model, item.firstLineFont) || usesComposite;
      const first = firstUsesComposite ? wrapEnglishText(lines[0]) : lines[0];
      const firstLineStyle = firstLineStyleCss(grepStyle, item, model);
      lines[0] = firstLineStyle
        ? `<span class="grep-first-line" style="${attr(firstLineStyle)}">${first}</span>`
        : `<span class="grep-first-line">${first}</span>`;
    }
  }
  return lines.map((line, index) => (index === 0 || !usesComposite ? line : wrapEnglishText(line))).join('<br>');
}

function firstLineStyleCss(grepStyle, item, model) {
  const styles = [];
  if (item.firstLineFont) {
    const compositeFonts = (model.styles && model.styles.compositeFonts) || {};
    const composite = compositeFonts[item.firstLineFont];
    if (composite && (composite.hasBoldCJK || String(composite.cjkWeight) === '700')) {
      styles.push('font-weight:bold');
    } else if (!composite) {
      styles.push(`font-family:'${item.firstLineFont}',sans-serif`);
    }
  }
  if (grepStyle.charStyleCSS) styles.push(cssForHtml(grepStyle.charStyleCSS));
  return styles.join('; ');
}

function textContent(item) {
  return (item.content && item.content.text) || '';
}

module.exports = {
  renderTextContent,
  renderRichTextRuns,
  renderTextWithBreaks,
  textContent,
};
