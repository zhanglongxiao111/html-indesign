const AUTHOR_HTML_SAFE_TAGS = Object.freeze(new Set([
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'figure', 'figcaption', 'img', 'object', 'embed', 'picture', 'source',
  'svg', 'canvas', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'strong', 'em', 'small', 'sup', 'sub',
]));

const AUTHOR_HTML_SAFE_INLINE_TAGS = Object.freeze(new Set([
  'span', 'strong', 'b', 'em', 'i', 'mark', 'small', 'sup', 'sub',
]));

const REVERSE_VISUAL_HTML_CONTAINER_TAGS = Object.freeze(new Set([
  'article',
  'aside',
  'blockquote',
  'caption',
  'div',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'span',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]));

function safeAuthorHtmlTag(value) {
  const tag = String(value || '').toLowerCase();
  return AUTHOR_HTML_SAFE_TAGS.has(tag) ? tag : 'div';
}

function safeAuthorInlineHtmlTag(value) {
  const tag = String(value || '').toLowerCase();
  return AUTHOR_HTML_SAFE_INLINE_TAGS.has(tag) ? tag : 'span';
}

function assertReverseVisualHtmlContainerTag(value) {
  const tag = String(value || '').toLowerCase();
  if (REVERSE_VISUAL_HTML_CONTAINER_TAGS.has(tag)) return tag;
  throw new Error(`Unsupported reverse HTML tag: ${value}`);
}

module.exports = {
  AUTHOR_HTML_SAFE_INLINE_TAGS,
  AUTHOR_HTML_SAFE_TAGS,
  REVERSE_VISUAL_HTML_CONTAINER_TAGS,
  assertReverseVisualHtmlContainerTag,
  safeAuthorHtmlTag,
  safeAuthorInlineHtmlTag,
};
