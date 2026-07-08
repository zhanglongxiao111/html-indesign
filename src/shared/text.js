function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n|\r/g, '\n');
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  normalizeLineEndings,
  collapseWhitespace,
};
