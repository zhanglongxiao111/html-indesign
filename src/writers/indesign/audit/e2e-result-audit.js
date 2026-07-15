const fs = require('fs');
const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');

const LOSSY_VECTOR_WARNING_CODES = new Set([
  'PRESERVE_VECTOR_UNSUPPORTED',
  'VECTOR_DASH_STYLE_CREATE_FAILED',
  'VECTOR_GROUP_CHILD_CREATE_FAILED',
  'VECTOR_GROUP_CREATE_FAILED',
  'VECTOR_GROUP_INCOMPLETE',
  'VECTOR_GROUP_PATH_APPLY_FAILED',
  'VECTOR_MULTIPATH_UNSUPPORTED',
  'VECTOR_MULTIPATH_GROUP_REQUIRED',
  'VECTOR_PATH_APPLY_FAILED',
  'VECTOR_STROKE_STYLE_APPLY_FAILED',
  'VECTOR_STROKE_STYLE_RESOLVE_FAILED',
]);

function assertPanelNameAuditOk(result, options = {}) {
  assertResultInputValid(result, 'assertPanelNameAuditOk');
  const allowed = panelNameSet(options.allowedPanelNames || []);
  const asciiNames = (result && result.audit && result.audit.panelAsciiNames || [])
    .filter((entry) => !isAllowedBuiltInPanelName(entry.kind, entry.name))
    .filter((entry) => !allowed.has(panelNameKey(entry.kind, entry.name)));
  if (Array.isArray(asciiNames) && asciiNames.length > 0) {
    throw new Error(`InDesign panel names still contain English tokens: ${JSON.stringify(asciiNames, null, 2)}`);
  }
}

function observedPanelNamesForHtml(htmlPath) {
  const html = readTextIfExists(htmlPath);
  const reverseModePattern = new RegExp(`\\b${escapeRegExp(HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE)}\\s*=\\s*["']observation["']`, 'i');
  const observedPattern = new RegExp(`\\b${escapeRegExp(HTML_DATA_ID_ATTRIBUTES.OBSERVED)}\\s*=\\s*["']true["']`, 'i');
  if (!reverseModePattern.test(html)
    && !observedPattern.test(html)) {
    return [];
  }
  const names = [];
  const seen = new Set();
  const pattern = new RegExp(`\\b${escapeRegExp(HTML_DATA_ID_ATTRIBUTES.LAYER)}\\s*=\\s*(["'])(.*?)\\1`, 'gi');
  let match;
  while ((match = pattern.exec(html))) {
    const name = htmlAttrText(match[2]);
    if (!name) continue;
    const key = panelNameKey('layers', name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push({ kind: 'layers', name });
  }
  return names;
}

function assertNoTextOverset(result) {
  assertResultInputValid(result, 'assertNoTextOverset');
  const count = Number(result && result.counts && result.counts.oversetTextFrames || 0);
  const directFrames = result && Array.isArray(result.oversetTextFrames) ? result.oversetTextFrames : [];
  const messages = [
    ...(result && result.messages || []),
    ...(result && result.warnings || []),
  ]
    .filter((message) => message && (message.code === 'TEXT_OVERSET' || message.code === 'TABLE_FRAME_OVERSET'));
  const frames = directFrames.length
    ? directFrames
    : messages.map((message) => message.details).filter(Boolean);
  if (count <= 0 && frames.length === 0 && messages.length === 0) return;
  const error = new Error(`InDesign text frames are overset: ${JSON.stringify({
    count,
    frames,
    messages,
  }, null, 2)}`);
  error.oversetTextFrames = frames;
  error.oversetMessages = messages;
  throw error;
}

function assertNoLossyVectorWarnings(result) {
  assertResultInputValid(result, 'assertNoLossyVectorWarnings');
  const messages = [
    ...(result.messages || []),
    ...(result.warnings || []),
  ].filter((message) => message && LOSSY_VECTOR_WARNING_CODES.has(String(message.code || '')));
  if (messages.length === 0) return;

  const error = new Error(`InDesign dropped or failed to apply vector geometry: ${JSON.stringify(messages, null, 2)}`);
  error.code = 'INDESIGN_VECTOR_GEOMETRY_LOSS';
  error.vectorMessages = messages;
  throw error;
}

function isAllowedBuiltInPanelName(kind, name) {
  return kind === 'swatches' && ['None', 'Registration', 'Paper', 'Black'].includes(String(name));
}

function assertResultInputValid(result, gateName) {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    const error = new Error(`${gateName} requires an E2E result object; refusing to pass on missing evidence`);
    error.code = 'E2E_RESULT_INPUT_INVALID';
    throw error;
  }
}

function panelNameSet(entries) {
  const out = new Set();
  for (const entry of entries || []) {
    if (!entry || !entry.kind || !entry.name) continue;
    out.add(panelNameKey(entry.kind, entry.name));
  }
  return out;
}

function panelNameKey(kind, name) {
  return `${String(kind || '')}\u0000${String(name || '')}`;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
}

function htmlAttrText(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  assertPanelNameAuditOk,
  observedPanelNamesForHtml,
  assertNoLossyVectorWarnings,
  assertNoTextOverset,
  isAllowedBuiltInPanelName,
};
