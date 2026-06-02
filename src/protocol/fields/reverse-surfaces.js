const SOURCE_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const FORMAT_EXTENSION_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'native', write: 'native', persist: 'native' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'text-runs' },
});

function sourceMetadata(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'reverse-model',
    type,
    capabilities: SOURCE_METADATA_CAPABILITIES,
  };
}

function formatExtension(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'formatExtension',
    lifecycle: 'active',
    owner: 'reverse-model',
    type,
    capabilities: FORMAT_EXTENSION_CAPABILITIES,
  };
}

function canonical(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'reverse-model',
    type,
    capabilities: CANONICAL_CAPABILITIES,
  };
}

module.exports = [
  sourceMetadata('pages[].effectiveLabel', [], 'object'),
  sourceMetadata('items[].sourceType', ['pages[].items[].sourceType'], 'string'),
  sourceMetadata('items[].tagName', ['pages[].items[].tagName'], 'string'),
  sourceMetadata('items[].htmlClass', ['pages[].items[].htmlClass'], 'string'),
  sourceMetadata('items[].layerName', ['pages[].items[].layerName'], 'string'),
  sourceMetadata('items[].inlineStyle', ['pages[].items[].inlineStyle'], 'string'),
  sourceMetadata('items[].firstLineFont', ['pages[].items[].firstLineFont'], 'string'),
  canonical('items[].zIndex', ['pages[].items[].zIndex'], 'number'),
  sourceMetadata('items[].content.sourceHtml', [], 'string'),
  canonical('items[].content.runs[].text', [], 'string'),
  sourceMetadata('items[].content.runs[].tagName', [], 'string'),
  sourceMetadata('items[].content.runs[].classList', [], 'array'),
  sourceMetadata('items[].content.runs[].attributes', [], 'object'),
  formatExtension('items[].effects', ['pages[].items[].effects'], 'object'),
  formatExtension('items[].textFrameStyle', ['pages[].items[].textFrameStyle'], 'object'),
];
