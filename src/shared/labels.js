const PROTOCOL = 'html-indesign';
const PROTOCOL_VERSION = 1;

function normalizeLabel(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function createProtocolLabel(input = {}) {
  const base = {
    protocol: PROTOCOL,
    version: PROTOCOL_VERSION,
    kind: requiredString(input.kind, 'kind'),
    id: requiredString(input.id, 'id'),
    source: input.source || 'html-to-indesign',
  };
  const payload = { ...input };
  delete payload.protocol;
  delete payload.version;
  delete payload.kind;
  delete payload.id;
  delete payload.source;
  return { ...base, ...payload };
}

function requiredString(value, field) {
  const out = String(value || '').trim();
  if (!out) throw new Error(`Protocol label requires ${field}.`);
  return out;
}

function parseProtocolLabel(raw, options = {}) {
  const errors = [];
  let value = null;
  try {
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    errors.push({ code: 'LABEL_JSON_INVALID', message: String(error) });
    return { valid: false, label: null, errors };
  }
  if (!value || value.protocol !== PROTOCOL) {
    errors.push({ code: 'LABEL_PROTOCOL_MISSING', message: 'Label protocol is missing or unsupported.' });
  }
  if (value && value.version !== PROTOCOL_VERSION) {
    errors.push({ code: 'LABEL_VERSION_UNSUPPORTED', message: `Unsupported label version: ${value.version}` });
  }
  if (options.expectedKind && value && value.kind !== options.expectedKind) {
    errors.push({ code: 'LABEL_KIND_MISMATCH', message: `Expected ${options.expectedKind}, got ${value.kind}.` });
  }
  if (!value || !value.id) {
    errors.push({ code: 'LABEL_ID_MISSING', message: 'Label id is missing.' });
  }
  return { valid: errors.length === 0, label: value || null, errors };
}

function normalizeStyleRef(value) {
  if (!value) return { token: null, displayName: null };
  if (typeof value === 'string') return { token: value, displayName: null };
  return {
    token: value.token || value.id || null,
    displayName: value.displayName || value.name || null,
  };
}

function labelDisplayPair(id, name) {
  return {
    id: String(id || '').trim(),
    name: name ? String(name).trim() : null,
  };
}

function labelCoordinateUnit(documentLabel) {
  const explicit = String((documentLabel && documentLabel.coordinateUnit) || '').toLowerCase();
  if (explicit === 'pt' || explicit === 'mm') return explicit;
  return String((documentLabel && documentLabel.unitMode) || '').toLowerCase() === 'presentation' ? 'pt' : 'mm';
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
  createProtocolLabel,
  parseProtocolLabel,
  normalizeStyleRef,
  labelDisplayPair,
  labelCoordinateUnit,
  normalizeLabel,
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
  findBySlotName,
};
