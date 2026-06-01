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
