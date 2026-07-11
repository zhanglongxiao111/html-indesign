const { buildDocumentObjectGraph } = require('./object-graph');
const { applyCaptionStructure } = require('./caption-structure');
const { applyFigureGrid } = require('./figure-grid');
const { applyTextBlock } = require('./text-block');
const { applyReadingOrderLite } = require('./reading-order-lite');
const { auditTrustedSourcePreservation } = require('./trusted-source-preservation');

const SUPPORTED_ALGORITHMS = new Set(['page-object-graph', 'caption-structure', 'figure-grid', 'text-block', 'reading-order-lite']);

function reconstructSemanticModel(observedModel, options = {}) {
  assertDocumentModel(observedModel);

  const model = cloneJson(observedModel);
  const trustedSourceBaseline = cloneJson(model);
  const unresolved = collectUnresolvedItems(model);
  const pageCount = Array.isArray(model.pages) ? model.pages.length : 0;
  const itemCount = countItems(model);
  const mode = options.mode || model.reverseMode || 'structured';

  const algorithms = normalizeAlgorithms(options.algorithms || []);
  const passes = runAlgorithms(algorithms, model, options);
  const reconstructedItems = countReconstructedItems(passes);
  const trustedSourcePreservation = auditTrustedSourcePreservation(trustedSourceBaseline, model);
  const report = {
    kind: 'SemanticReconstructionReport',
    version: 1,
    status: reconstructedItems > 0 ? 'reconstructed' : 'observed-only',
    mode,
    sourceModelId: model.id || null,
    profile: model.profile || null,
    algorithms,
    passes,
    summary: {
      pages: pageCount,
      items: itemCount,
      reconstructedItems,
      unresolvedItems: unresolved.length,
    },
    unresolved,
    trustedSourcePreservation,
    warnings: [],
    errors: [],
  };

  return { model, report };
}

function normalizeAlgorithms(algorithms) {
  if (!Array.isArray(algorithms)) {
    throw new Error('Semantic reconstruction algorithms must be an array');
  }
  const normalized = algorithms.map((algorithm) => String(algorithm || '').trim()).filter(Boolean);
  for (const algorithm of normalized) {
    if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
      throw new Error(`Unknown semantic reconstruction algorithm: ${algorithm}`);
    }
  }
  return [
    ...normalized.filter((algorithm) => algorithm !== 'reading-order-lite'),
    ...normalized.filter((algorithm) => algorithm === 'reading-order-lite'),
  ];
}

function runAlgorithms(algorithms, model, options) {
  const context = {};
  return algorithms.map((algorithm) => {
    if (algorithm === 'page-object-graph') {
      context.objectGraphPass = buildDocumentObjectGraph(model, options.objectGraph || {});
      return context.objectGraphPass;
    }
    if (algorithm === 'caption-structure') {
      const pass = applyCaptionStructure(model, options.captionStructure || {}, {
        objectGraphPass: context.objectGraphPass,
        objectGraphOptions: options.objectGraph || {},
      });
      return pass;
    }
    if (algorithm === 'figure-grid') {
      return applyFigureGrid(model, options.figureGrid || {});
    }
    if (algorithm === 'text-block') {
      return applyTextBlock(model, options.textBlock || {});
    }
    if (algorithm === 'reading-order-lite') {
      return applyReadingOrderLite(model);
    }
    throw new Error(`Unknown semantic reconstruction algorithm: ${algorithm}`);
  });
}

function countReconstructedItems(passes) {
  return (passes || []).reduce((sum, pass) => {
    const applied = pass && pass.summary && Number(pass.summary.applied);
    return sum + (Number.isFinite(applied) ? applied : 0);
  }, 0);
}

function assertDocumentModel(model) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('reconstructSemanticModel requires a DocumentModel');
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function countItems(model) {
  return (model.pages || []).reduce((sum, page) => sum + ((page && page.items && page.items.length) || 0), 0);
}

function collectUnresolvedItems(model) {
  const unresolved = [];
  const pages = Array.isArray(model.pages) ? model.pages : [];

  pages.forEach((page, pageIndex) => {
    const items = Array.isArray(page.items) ? page.items : [];
    items.forEach((item, itemIndex) => {
      const reason = unresolvedReason(item);
      if (!reason) return;
      unresolved.push({
        type: 'item',
        path: `pages[${pageIndex}].items[${itemIndex}]`,
        pageId: page.id || null,
        itemId: item.id || null,
        role: item.role || null,
        reason,
      });
    });
  });

  return unresolved;
}

function unresolvedReason(item = {}) {
  if (!item.semantic) return 'semantic-missing';
  if (item.labelStatus && item.labelStatus !== 'accepted') return `label-${item.labelStatus}`;
  if (Array.isArray(item.rejectionReasons) && item.rejectionReasons.length) return 'label-rejected';
  return null;
}

module.exports = {
  reconstructSemanticModel,
  collectUnresolvedItems,
  buildDocumentObjectGraph,
};
