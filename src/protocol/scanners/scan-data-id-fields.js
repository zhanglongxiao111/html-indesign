function scanDataIdFields(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return [];
  }

  const attrs = [];
  const seen = new Set();
  let index = 0;

  while (index < html.length) {
    const tagStart = html.indexOf('<', index);
    if (tagStart === -1) {
      break;
    }

    if (html.startsWith('<!--', tagStart)) {
      index = skipComment(html, tagStart);
      continue;
    }

    const next = html[tagStart + 1];
    if (!next || next === '/' || next === '!' || next === '?') {
      index = skipTag(html, tagStart + 1);
      continue;
    }

    if (!isTagNameStart(next)) {
      index = tagStart + 1;
      continue;
    }

    index = scanStartTag(html, tagStart + 1, attrs, seen);
  }

  return attrs;
}

function scanStartTag(html, index, attrs, seen) {
  let cursor = skipTagName(html, index);

  while (cursor < html.length) {
    cursor = skipWhitespace(html, cursor);
    const char = html[cursor];

    if (!char) {
      return html.length;
    }

    if (char === '>') {
      return cursor + 1;
    }

    if (char === '/' && html[cursor + 1] === '>') {
      return cursor + 2;
    }

    if (char === '/') {
      cursor += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      cursor = skipQuotedValue(html, cursor);
      continue;
    }

    const nameStart = cursor;
    while (
      cursor < html.length
      && !isWhitespace(html[cursor])
      && html[cursor] !== '='
      && html[cursor] !== '>'
      && html[cursor] !== '/'
    ) {
      cursor += 1;
    }

    const attrName = html.slice(nameStart, cursor);
    if (attrName.startsWith('data-id-') && !seen.has(attrName)) {
      seen.add(attrName);
      attrs.push(attrName);
    }

    cursor = skipWhitespace(html, cursor);
    if (html[cursor] !== '=') {
      continue;
    }

    cursor = skipWhitespace(html, cursor + 1);
    if (html[cursor] === '"' || html[cursor] === "'") {
      cursor = skipQuotedValue(html, cursor);
      continue;
    }

    while (cursor < html.length && !isWhitespace(html[cursor]) && html[cursor] !== '>') {
      cursor += 1;
    }
  }

  return cursor;
}

function skipComment(html, start) {
  const end = html.indexOf('-->', start + 4);
  return end === -1 ? html.length : end + 3;
}

function skipTag(html, index) {
  let cursor = index;
  while (cursor < html.length && html[cursor] !== '>') {
    cursor += 1;
  }
  return cursor < html.length ? cursor + 1 : cursor;
}

function skipTagName(html, index) {
  let cursor = index;
  while (
    cursor < html.length
    && !isWhitespace(html[cursor])
    && html[cursor] !== '>'
    && html[cursor] !== '/'
  ) {
    cursor += 1;
  }
  return cursor;
}

function skipWhitespace(html, index) {
  let cursor = index;
  while (cursor < html.length && isWhitespace(html[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function skipQuotedValue(html, index) {
  const quote = html[index];
  let cursor = index + 1;
  while (cursor < html.length && html[cursor] !== quote) {
    cursor += 1;
  }
  return cursor < html.length ? cursor + 1 : cursor;
}

function isWhitespace(char) {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f';
}

function isTagNameStart(char) {
  return (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z');
}

module.exports = Object.freeze({
  scanDataIdFields,
});
