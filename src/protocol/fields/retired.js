module.exports = [
  {
    canonicalPath: 'retired.model.itemsType',
    currentPaths: ['items[].type'],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'document-model',
    type: 'string',
    description: 'Retired item dialect field. Use items[].role for semantic role and items[].sourceType for source-format observation.',
    capabilities: {
      html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      modelPaths: [
        {
          path: 'items[].type',
          replacedBy: 'items[].sourceType',
          readPolicy: 'retired',
          reason: 'split-semantic-role-from-source-format-type',
        },
      ],
    },
  },
  {
    canonicalPath: 'retired.model.itemsEffects',
    currentPaths: ['items[].effects'],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'reverse-model',
    type: 'object',
    description: 'Retired flat InDesign effects surface. Use the InDesign format extension path instead.',
    capabilities: {
      html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      modelPaths: [
        {
          path: 'items[].effects',
          replacedBy: 'items[].extensions.indesign.effects',
          readPolicy: 'retired',
          reason: 'flat-indesign-effects-moved-to-format-extension',
        },
      ],
    },
  },
  {
    canonicalPath: 'retired.model.itemsTextFrameStyle',
    currentPaths: ['items[].textFrameStyle'],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'reverse-model',
    type: 'object',
    description: 'Retired flat InDesign text frame style surface. Use the InDesign format extension path instead.',
    capabilities: {
      html: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      modelPaths: [
        {
          path: 'items[].textFrameStyle',
          replacedBy: 'items[].extensions.indesign.textFrameStyle',
          readPolicy: 'retired',
          reason: 'flat-indesign-text-frame-style-moved-to-format-extension',
        },
      ],
    },
  },
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
