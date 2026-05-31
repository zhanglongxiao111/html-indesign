module.exports = [
  {
    canonicalPath: 'extensions.pptx.animation',
    currentPaths: [],
    fieldClass: 'formatExtension',
    lifecycle: 'candidate',
    owner: 'pptx-adapter',
    type: 'object',
    capabilities: {
      html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'native', write: 'native', persist: 'native' },
    },
    extensions: {
      pptx: { packagePaths: ['pptx.slides[].animations'] },
    },
  },
  {
    canonicalPath: 'extensions.pptx.transition',
    currentPaths: [],
    fieldClass: 'formatExtension',
    lifecycle: 'candidate',
    owner: 'pptx-adapter',
    type: 'object',
    capabilities: {
      html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'native', write: 'native', persist: 'native' },
    },
    extensions: {
      pptx: { packagePaths: ['pptx.slides[].transition'] },
    },
  },
  {
    canonicalPath: 'extensions.pptx.placeholder',
    currentPaths: [],
    fieldClass: 'formatExtension',
    lifecycle: 'candidate',
    owner: 'pptx-adapter',
    type: 'object',
    capabilities: {
      html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'native', write: 'native', persist: 'native' },
    },
    extensions: {
      pptx: { packagePaths: ['pptx.slides[].placeholders'] },
    },
  },
  {
    canonicalPath: 'extensions.pptx.speakerNotes',
    currentPaths: [],
    fieldClass: 'formatExtension',
    lifecycle: 'candidate',
    owner: 'pptx-adapter',
    type: 'array',
    capabilities: {
      html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'native', write: 'native', persist: 'native' },
    },
    extensions: {
      pptx: { packagePaths: ['pptx.slides[].speakerNotes'] },
    },
  },
];
