const VECTOR_PATH_STYLE_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'svg' },
});

function vectorPathStyleField(name, type) {
  const canonicalPath = `items[].vectorGeometry.paths[].visualStyle.${name}`;
  return {
    canonicalPath,
    currentPaths: [
      `reverseModel.pages[].items[].vectorGeometry.paths[].visualStyle.${name}`,
      `instructions.pages[].items[].vectorGeometry.paths[].visualStyle.${name}`,
      `instructions.pages[].items[].vectorGeometry.paths[].styleOverride.${name}`,
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'vector-geometry',
    type,
    capabilities: VECTOR_PATH_STYLE_CAPABILITIES,
    indesign: {
      snapshotPaths: [`vectorGeometry.paths[].visualStyle.${name}`],
    },
  };
}

module.exports = [
  {
    canonicalPath: 'items[].vectorGeometry.kind',
    currentPaths: ['reverseModel.pages[].items[].vectorGeometry.kind'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'vector-geometry',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'svg' },
    },
    html: {
      readAttrs: ['data-id-vector'],
      writeAttrs: ['data-id-vector'],
    },
    indesign: {
      snapshotPaths: ['vectorGeometry.kind'],
    },
  },
  {
    canonicalPath: 'items[].vectorGeometry.paths',
    currentPaths: ['reverseModel.pages[].items[].vectorGeometry.paths'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'vector-geometry',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'svg' },
    },
    html: {
      readAttrs: ['data-id-vector-points'],
      writeAttrs: ['data-id-vector-points'],
    },
    indesign: {
      snapshotPaths: ['vectorGeometry.paths'],
    },
  },
  {
    canonicalPath: 'items[].vectorGeometry.paths[].points[].pointType',
    currentPaths: ['reverseModel.pages[].items[].vectorGeometry.paths[].points[].pointType'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'vector-geometry',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'svg' },
    },
    html: {
      readAttrs: ['data-id-point-types'],
      writeAttrs: ['data-id-point-types'],
    },
    indesign: {
      snapshotPaths: ['vectorGeometry.paths[].points[].pointType'],
    },
  },
  vectorPathStyleField('fillColor', 'color'),
  vectorPathStyleField('fillOpacity', 'number'),
  vectorPathStyleField('strokeColor', 'color'),
  vectorPathStyleField('strokeWeight', 'number'),
  vectorPathStyleField('strokeOpacity', 'number'),
  vectorPathStyleField('opacity', 'number'),
  vectorPathStyleField('blendMode', 'string'),
  vectorPathStyleField('strokeStyle', 'string'),
  vectorPathStyleField('strokeLineCap', 'string'),
  vectorPathStyleField('strokeLineJoin', 'string'),
  vectorPathStyleField('strokeMiterLimit', 'number'),
  vectorPathStyleField('strokeAlignment', 'string'),
  vectorPathStyleField('lineStartMarker', 'object'),
  vectorPathStyleField('lineStartMarker.rawName', 'string'),
  vectorPathStyleField('lineEndMarker', 'object'),
  vectorPathStyleField('lineEndMarker.rawName', 'string'),
];
