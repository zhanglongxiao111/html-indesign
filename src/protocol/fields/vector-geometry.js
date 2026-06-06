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
];
