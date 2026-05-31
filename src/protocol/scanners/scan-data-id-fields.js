function scanDataIdFields(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return [];
  }

  const attrs = [];
  const seen = new Set();
  const attrPattern = /(^|[\s<])((?:data-id-)[A-Za-z0-9_.:-]+)(?=\s*=|\s|>|\/)/g;
  let match = attrPattern.exec(html);

  while (match) {
    const attr = match[2];
    if (!seen.has(attr)) {
      seen.add(attr);
      attrs.push(attr);
    }
    match = attrPattern.exec(html);
  }

  return attrs;
}

module.exports = Object.freeze({
  scanDataIdFields,
});
