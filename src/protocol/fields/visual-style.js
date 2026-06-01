const VISUAL_STYLE_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
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
      instructionPaths: [`appearance.${fieldName}`],
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
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['background-color', 'fill'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.fillColor'],
      instructionPaths: ['appearance.fillColor'],
    },
  },
  visualStyleField('items[].visualStyle.fillOpacity', 'number', {
    html: {
      styleProps: ['fill-opacity'],
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
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-color', 'stroke'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.strokeColor'],
      instructionPaths: ['appearance.strokeColor'],
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
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-width', 'stroke-width'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.strokeWeight'],
      instructionPaths: ['appearance.strokeWeight'],
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
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['opacity'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.opacity'],
      instructionPaths: ['appearance.opacity'],
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
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-opacity', 'stroke-opacity'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.strokeOpacity'],
      instructionPaths: ['appearance.strokeOpacity'],
    },
  },
  visualStyleField('items[].visualStyle.strokeStyle', 'string', {
    html: {
      styleProps: ['border-style', 'stroke-dasharray'],
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
  visualStyleField('items[].visualStyle.strokeAlignment', 'string'),
  visualStyleField('items[].visualStyle.lineStartMarker', 'string'),
  visualStyleField('items[].visualStyle.lineEndMarker', 'string'),
  visualStyleField('items[].visualStyle.blendMode', 'string', {
    html: {
      styleProps: ['mix-blend-mode'],
    },
  }),
  visualStyleField('items[].visualStyle.effects', 'object'),
  {
    canonicalPath: 'items[].visualStyle.cornerRadius',
    currentPaths: ['reverseModel.pages[].items[].visualStyle.cornerRadius'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'visual-style',
    type: 'number',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['border-radius'],
    },
    indesign: {
      snapshotPaths: ['visualStyle.cornerRadius'],
      instructionPaths: ['appearance.cornerRadius'],
    },
  },
];
