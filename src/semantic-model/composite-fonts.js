'use strict';

function compositeFontsConfig(fonts) {
  const list = Array.isArray(fonts)
    ? fonts
    : fonts && typeof fonts === 'object' ? Object.values(fonts) : [];
  return list
    .filter((font) => font && font.name)
    .map((font) => ({
      name: String(font.name),
      ...(font.safeName ? { safeName: String(font.safeName) } : {}),
      ...(font.hasBoldCJK != null ? { hasBoldCJK: Boolean(font.hasBoldCJK) } : {}),
      ...(font.cjkWeight != null ? { cjkWeight: String(font.cjkWeight) } : {}),
      ...(font.romanWeight != null ? { romanWeight: String(font.romanWeight) } : {}),
      entries: (Array.isArray(font.entries) ? font.entries : [])
        .map(compositeFontConfigEntry)
        .filter(Boolean),
    }));
}

function compositeFontConfigEntry(entry) {
  if (!entry || !entry.name) return null;
  const out = { name: String(entry.name) };
  if (entry.appliedFont) out.appliedFont = String(entry.appliedFont);
  if (entry.fontStyle) out.fontStyle = String(entry.fontStyle);
  for (const key of ['size', 'horizontalScale', 'verticalScale', 'baselineShift']) {
    if (entry[key] != null && Number.isFinite(Number(entry[key]))) out[key] = Number(entry[key]);
  }
  if (entry.weight != null) out.weight = String(entry.weight);
  if (typeof entry.scaleOption === 'boolean') out.scaleOption = entry.scaleOption;
  if (entry.customCharacters) out.customCharacters = String(entry.customCharacters);
  return out;
}

function compositeFontsByName(fonts) {
  const out = {};
  for (const font of compositeFontsConfig(fonts)) {
    out[font.name] = font;
  }
  return out;
}

module.exports = {
  compositeFontsConfig,
  compositeFontsByName,
};
