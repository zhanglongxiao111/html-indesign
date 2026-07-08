const fs = require('fs');
const path = require('path');
const {
  HTML_DATA_ID_ATTRIBUTES,
} = require('../../../protocol');

function loadReverseHtmlEvidence(reverseHtmlDir) {
  if (!reverseHtmlDir) {
    return {
      reverseModel: null,
    };
  }
  return {
    reverseModel: readJsonIfExists(path.join(reverseHtmlDir, 'reverse-model.json')),
  };
}

function readJsonIfExists(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid audit evidence JSON: ${file}: ${error.message}`);
  }
}

function enrichCaptureWithReverseModelSourceMetadata(capture, model) {
  if (!capture || !Array.isArray(capture.elements) || !model) return capture;
  const sourceMetadata = reverseModelSourceMetadataByKey(model);
  for (const element of capture.elements) {
    const metadata = sourceMetadata.get(element.key || `${element.pageIndex || 0}:${element.id || ''}`);
    if (!metadata) continue;
    for (const { attr, prop } of sourceMetadataAttrs()) {
      if (!element[prop] && metadata[prop]) {
        element[prop] = metadata[prop];
      }
      if (element[prop]) addDataIdAttr(element, attr);
    }
  }
  return capture;
}

function reverseModelSourceMetadataByKey(model) {
  const map = new Map();
  const pages = Array.isArray(model && model.pages) ? model.pages : [];
  pages.forEach((page, pageIndex) => {
    collectReverseModelSourceMetadata(map, page && page.items, pageIndex);
  });
  return map;
}

function collectReverseModelSourceMetadata(map, items, pageIndex) {
  for (const item of Array.isArray(items) ? items : []) {
    const id = item && item.id ? String(item.id) : '';
    const metadata = sourceMetadataFromItem(item);
    if (id && (metadata.sourceCsv || metadata.sourceXml)) {
      map.set(`${pageIndex}:${id}`, metadata);
    }
    collectReverseModelSourceMetadata(map, item && item.children, pageIndex);
  }
}

function sourceMetadataFromItem(item) {
  const sourceNode = item && (item.sourceNode || (item.effectiveLabel && item.effectiveLabel.sourceNode)) || {};
  const attrs = sourceNode.attributes || {};
  return {
    sourceCsv: attrs[HTML_DATA_ID_ATTRIBUTES.SOURCE_CSV] || '',
    sourceXml: attrs[HTML_DATA_ID_ATTRIBUTES.SOURCE_XML] || '',
  };
}

function sourceMetadataAttrs() {
  return [
    { attr: HTML_DATA_ID_ATTRIBUTES.SOURCE_CSV, prop: 'sourceCsv' },
    { attr: HTML_DATA_ID_ATTRIBUTES.SOURCE_XML, prop: 'sourceXml' },
  ];
}

function addDataIdAttr(element, attr) {
  if (!Array.isArray(element.dataIdAttrs)) element.dataIdAttrs = [];
  if (!element.dataIdAttrs.includes(attr)) element.dataIdAttrs.push(attr);
}

module.exports = {
  loadReverseHtmlEvidence,
  enrichCaptureWithReverseModelSourceMetadata,
  reverseModelSourceMetadataByKey,
  collectReverseModelSourceMetadata,
};
