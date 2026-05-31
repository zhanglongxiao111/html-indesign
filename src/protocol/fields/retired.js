module.exports = [
  {
    canonicalPath: 'retired.htmlAttrs.dataIdPage',
    currentPaths: [],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'asset-placement',
    type: 'attribute',
    capabilities: {
      html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      htmlAttrs: [{
        name: 'data-id-page',
        replacedBy: 'data-id-pdf-page',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
        reason: 'ambiguous-with-page-identity',
      }],
    },
  },
];
