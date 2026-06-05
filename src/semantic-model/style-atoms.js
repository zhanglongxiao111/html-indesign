const TEXT_STYLE_FIELDS = Object.freeze([
  'fontFamily',
  'fontStyle',
  'fontWeight',
  'pointSize',
  'leading',
  'tracking',
  'justification',
  'align',
  'firstLineIndent',
  'leftIndent',
  'rightIndent',
  'spaceBefore',
  'spaceAfter',
]);

const TEXT_OVERRIDE_FIELDS = Object.freeze([
  'fillColor',
]);

const LINE_STYLE_FIELDS = Object.freeze([
  'lineEndMarker',
  'lineStartMarker',
  'strokeColor',
  'strokeStyle',
  'strokeWeight',
]);

function styleAtomForItem(item) {
  if (!isPlainObject(item)) {
    return null;
  }
  if (isLineItem(item)) {
    return lineStyleAtom(item);
  }
  if (isTextItem(item)) {
    return textStyleAtom(item);
  }
  return null;
}

function textStyleAtom(item) {
  const textStyle = isPlainObject(item.textStyle) ? item.textStyle : {};
  const properties = pickDefined(textStyle, TEXT_STYLE_FIELDS);
  const overrideCandidates = pickDefined(textStyle, TEXT_OVERRIDE_FIELDS);
  return {
    kind: 'text',
    properties,
    overrideCandidates,
  };
}

function lineStyleAtom(item) {
  const visualStyle = isPlainObject(item.visualStyle) ? item.visualStyle : {};
  return {
    kind: 'line',
    properties: pickPresent(visualStyle, LINE_STYLE_FIELDS),
    overrideCandidates: {},
  };
}

function isTextItem(item) {
  return item.type === 'TextFrame'
    || item.kind === 'text'
    || isPlainObject(item.textStyle)
    || (isPlainObject(item.content) && typeof item.content.text === 'string');
}

function isLineItem(item) {
  return item.type === 'GraphicLine'
    || item.sourceType === 'GraphicLine'
    || item.kind === 'line'
    || item.vectorGeometry?.kind === 'line';
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value !== 'undefined' && value !== null) {
      result[key] = value;
    }
  }
  return sortObject(result);
}

function pickPresent(source, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return sortObject(result);
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObject(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObject(value[key]);
  }
  return sorted;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  styleAtomForItem,
  sortObject,
});
