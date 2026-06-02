function parseZIndex(value, fallback = 0) {
  if (value == null || value === '' || value === 'auto') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  parseZIndex,
};
