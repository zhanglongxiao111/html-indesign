module.exports = [
  {
    canonicalPath: 'items[].content.text',
    currentPaths: ['items[].text', 'instructions.pages[].items[].text'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'native', persist: 'lossless' },
    },
    indesign: {
      snapshotPaths: ['text'],
      instructionPaths: ['text'],
    },
  },
  {
    canonicalPath: 'items[].content.runs',
    currentPaths: ['items[].textRuns'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'text-runs' },
    },
    indesign: {
      snapshotPaths: ['textRuns'],
      instructionPaths: ['textRuns'],
    },
  },
  {
    canonicalPath: 'items[].textStyle',
    currentPaths: ['reverseModel.pages[].items[].textStyle'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'object',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    indesign: {
      snapshotPaths: ['textStyle'],
    },
  },
  {
    canonicalPath: 'items[].textStyle.composer',
    currentPaths: [
      'reverseModel.pages[].items[].textStyle.composer',
      'sourceNode.attributes.data-id-paragraph-composer',
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-paragraph-composer'],
      writeAttrs: ['data-id-paragraph-composer'],
    },
    indesign: {
      snapshotPaths: ['textStyle.composer'],
    },
  },
  {
    canonicalPath: 'items[].textStyle.capitalization',
    currentPaths: [
      'reverseModel.pages[].items[].textStyle.capitalization',
      'reverseModel.pages[].items[].content.runs[].textStyle.capitalization',
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    description: 'InDesign capitalization read back as allCaps / smallCaps (null = normal). HTML writes text-transform:uppercase / font-variant-caps:small-caps; forward compile maps text-transform:uppercase back to allCaps.',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['text-transform', 'font-variant-caps'],
    },
    indesign: {
      snapshotPaths: ['textStyle.capitalization', 'textRuns[].textStyle.capitalization'],
    },
  },
  {
    canonicalPath: 'items[].textStyle.justification',
    currentPaths: ['reverseModel.pages[].items[].textStyle.justification'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    description: 'Paragraph alignment: left / center / right / justify / justify-all / justify-center / justify-right. justify is InDesign LEFT_JUSTIFIED (CSS text-align:justify, last line at the start edge); justify-all / justify-center / justify-right are FULLY / CENTER / RIGHT_JUSTIFIED, written as text-align:justify plus text-align-last:justify|center|right and read back from the same pair.',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    html: {
      styleProps: ['text-align', 'text-align-last'],
    },
    indesign: {
      snapshotPaths: ['textStyle.justification'],
    },
  },
  ...['strokeColor', 'strokeWeight'].map((name) => ({
    canonicalPath: `items[].textStyle.${name}`,
    currentPaths: [
      `reverseModel.pages[].items[].textStyle.${name}`,
      `reverseModel.pages[].items[].content.runs[].textStyle.${name}`,
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: name === 'strokeColor' ? 'color' : 'number',
    description: 'Text (character) stroke read back from InDesign strokeColor / strokeWeight (tint applied; gradient strokes keep the first stop color with REVERSE_GRADIENT_APPROXIMATED). HTML writes -webkit-text-stroke; forward compile reads -webkit-text-stroke-width / -color back into paragraph / character styles and overrides.',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      styleProps: ['-webkit-text-stroke', '-webkit-text-stroke-width', '-webkit-text-stroke-color'],
    },
    indesign: {
      snapshotPaths: [`textStyle.${name}`, `textRuns[].textStyle.${name}`],
    },
  })),
  {
    canonicalPath: 'styles.paragraphStyles[].composer',
    currentPaths: ['styles.paragraphStyles[].composer'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'observe-only', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      instructionPaths: ['styles.paragraphStyles[].composer'],
    },
  },
  {
    canonicalPath: 'items[].extensions.indesign.textFit',
    currentPaths: ['instructions.pages[].items[].textFit'],
    fieldClass: 'formatExtension',
    lifecycle: 'active',
    owner: 'indesign-writer',
    type: 'object',
    description: 'Derived InDesign executor policy for bounded text-frame growth when browser-visible text would otherwise become overset.',
    capabilities: {
      html: { read: 'native', write: 'unsupported', persist: 'lossless' },
      indesign: { read: 'unsupported', write: 'native', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      instructionPaths: ['textFit'],
    },
  },
];
