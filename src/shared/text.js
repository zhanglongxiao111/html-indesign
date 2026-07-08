function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n|\r/g, '\n');
}

function collapseWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeInstructionText(value) {
  return collapseWhitespace(value);
}

module.exports = {
  normalizeLineEndings,
  collapseWhitespace,
  normalizeInstructionText,
};
