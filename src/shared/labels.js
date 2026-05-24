function normalizeLabel(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function parseLabeledSegments(label) {
  const result = {};
  String(label || '').split(/[;；\n\r]+/).forEach((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[:=：]/);
    if (parts.length < 2) return;
    const key = parts.shift().trim();
    const value = parts.join('=').trim();
    if (key && value) result[key] = value;
  });
  return result;
}

function firstSegmentValue(segments, keys) {
  for (const key of Object.keys(segments)) {
    if (keys.includes(key.toLowerCase())) return segments[key];
  }
  return null;
}

function parseSlotName(label) {
  const segments = parseLabeledSegments(label);
  return firstSegmentValue(segments, ['名称', '名字', '槽位', 'slot', 'name']) || label;
}

function parseSlotType(label) {
  const segments = parseLabeledSegments(label);
  const raw = firstSegmentValue(segments, ['类型', 'type']);
  const upper = String(raw || '').toUpperCase();
  if (upper.includes('图') || upper.includes('IMAGE')) return 'IMAGE';
  return 'TEXT';
}

function findBySlotName(slots, requestedName) {
  if (!slots || !requestedName) return null;
  if (Object.prototype.hasOwnProperty.call(slots, requestedName)) {
    return { key: requestedName, value: slots[requestedName] };
  }
  const requestedNorm = normalizeLabel(requestedName);
  for (const key of Object.keys(slots)) {
    if (normalizeLabel(key) === requestedNorm) {
      return { key, value: slots[key] };
    }
  }
  for (const key of Object.keys(slots)) {
    if (normalizeLabel(parseSlotName(key)) === requestedNorm) {
      return { key, value: slots[key] };
    }
  }
  return null;
}

module.exports = {
  normalizeLabel,
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
  findBySlotName,
};
