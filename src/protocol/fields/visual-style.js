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
];
