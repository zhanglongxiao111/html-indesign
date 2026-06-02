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
  {
    canonicalPath: 'retired.htmlAttrs.dataIdParentPageDisplayName',
    currentPaths: [],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'document-page',
    type: 'attribute',
    capabilities: {
      html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      htmlAttrs: [{
        name: 'data-id-parent-page-display-name',
        replacedBy: 'data-id-parent-page-name',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
        reason: 'replaced-by-single-parent-page-display-name-carrier',
      }],
    },
  },
  {
    canonicalPath: 'retired.htmlAttrs.dataIdAuthoringGrid',
    currentPaths: [],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'document-page',
    type: 'attribute',
    capabilities: {
      html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      htmlAttrs: [{
        name: 'data-id-authoring-grid',
        replacedBy: 'data-id-snap-grid',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
        reason: 'snap-grid-has-a-single-current-carrier',
      }],
    },
  },
  {
    canonicalPath: 'retired.htmlAttrs.dataIdMargins',
    currentPaths: [],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'document-page',
    type: 'attribute',
    capabilities: {
      html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      htmlAttrs: [{
        name: 'data-id-margins',
        replacedBy: 'data-id-margin',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
        reason: 'plural-margin-carrier-replaced-by-current-authoring-page-margin-field',
      }],
    },
  },
];
