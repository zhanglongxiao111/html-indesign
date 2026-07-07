const VISUAL_STYLE_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
});

function visualStyleField(canonicalPath, type, extra = {}) {
  const fieldName = canonicalPath.slice('items[].visualStyle.'.length);
  return {
    canonicalPath,
    currentPaths: [`reverseModel.pages[].items[].visualStyle.${fieldName}`],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type,
    capabilities: VISUAL_STYLE_CAPABILITIES,
    indesign: {
      snapshotPaths: [`visualStyle.${fieldName}`],
    },
    ...extra,
  };
}

module.exports = [
  {
    canonicalPath: 'items[].visualStyle.fillColor',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.fillColor'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'color',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['background-color', 'fill'],
      readAttrs: ['data-id-fill-color'],
      writeAttrs: ['data-id-fill-color'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.fillColor'],
    },
  },
  visualStyleField('items[].visualStyle.fillOpacity', 'number', {
    html: {
      styleProps: ['fill-opacity'],
      readAttrs: ['data-id-fill-opacity'],
      writeAttrs: ['data-id-fill-opacity'],
    },
  }),
  {
    canonicalPath: 'items[].visualStyle.strokeColor',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.strokeColor'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'color',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-color', 'stroke'],
      readAttrs: ['data-id-stroke-color'],
      writeAttrs: ['data-id-stroke-color'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.strokeColor'],
    },
  },
  {
    canonicalPath: 'items[].visualStyle.strokeWeight',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.strokeWeight'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'number',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-width', 'stroke-width'],
      readAttrs: ['data-id-stroke-weight'],
      writeAttrs: ['data-id-stroke-weight'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.strokeWeight'],
    },
  },
  {
    canonicalPath: 'items[].visualStyle.opacity',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.opacity'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'number',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['opacity'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.opacity'],
    },
  },
  {
    canonicalPath: 'items[].visualStyle.strokeOpacity',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.strokeOpacity'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'number',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-opacity', 'stroke-opacity'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.strokeOpacity'],
    },
  },
  visualStyleField('items[].visualStyle.strokeStyle', 'string', {
    currentPaths: [
      'reverseModel.pages[].items[].visualStyle.strokeStyle',
      'sourceNode.attributes.data-id-stroke-style',
    ],
    html: {
      styleProps: ['border-style', 'stroke-dasharray'],
      readAttrs: ['data-id-stroke-style'],
      writeAttrs: ['data-id-stroke-style'],
    },
  }),
  visualStyleField('items[].visualStyle.lineStartMarker', 'object', {
    currentPaths: [],
    indesign: {
      snapshotPaths: ['visualStyle.lineStartMarker'],
    },
  }),
  visualStyleField('items[].visualStyle.lineStartMarker.rawName', 'string', {
    currentPaths: [
      'reverseModel.pages[].items[].visualStyle.lineStartMarker.rawName',
      'sourceNode.attributes.data-id-line-start-marker-raw-name',
    ],
    html: {
      readAttrs: ['data-id-line-start-marker-raw-name'],
      writeAttrs: ['data-id-line-start-marker-raw-name'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.lineStartMarker.rawName'],
    },
  }),
  visualStyleField('items[].visualStyle.lineEndMarker', 'object', {
    currentPaths: [],
    indesign: {
      snapshotPaths: ['visualStyle.lineEndMarker'],
    },
  }),
  visualStyleField('items[].visualStyle.lineEndMarker.rawName', 'string', {
    currentPaths: [
      'reverseModel.pages[].items[].visualStyle.lineEndMarker.rawName',
      'sourceNode.attributes.data-id-line-end-marker-raw-name',
    ],
    html: {
      readAttrs: ['data-id-line-end-marker-raw-name'],
      writeAttrs: ['data-id-line-end-marker-raw-name'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.lineEndMarker.rawName'],
    },
  }),
  visualStyleField('items[].visualStyle.strokeLineCap', 'string', {
    html: {
      styleProps: ['stroke-linecap'],
    },
  }),
  visualStyleField('items[].visualStyle.strokeLineJoin', 'string', {
    html: {
      styleProps: ['stroke-linejoin'],
    },
  }),
  visualStyleField('items[].visualStyle.strokeMiterLimit', 'number', {
    html: {
      styleProps: ['stroke-miterlimit'],
    },
  }),
  visualStyleField('items[].visualStyle.strokeAlignment', 'string', {
    currentPaths: [
      'reverseModel.pages[].items[].visualStyle.strokeAlignment',
      'sourceNode.attributes.data-id-stroke-alignment',
    ],
    html: {
      readAttrs: ['data-id-stroke-alignment'],
      writeAttrs: ['data-id-stroke-alignment'],
    },
  }),
  {
    canonicalPath: 'items[].visualStyle.cornerRadius',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.cornerRadius'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'number',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'observe-only', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-radius'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.cornerRadius'],
    },
  },
];
