const { nodeFactForItem, publicNode } = require('./node-facts');
const { buildRelationshipEdges } = require('./relationships');
const { objectGraphPass } = require('./report');

function buildDocumentObjectGraph(model, options = {}) {
  assertDocumentModel(model);
  const pages = (model.pages || []).map((page, pageIndex) => buildPageObjectGraph(page, {
    ...options,
    pageIndex,
  }));
  return objectGraphPass(pages);
}

function buildPageObjectGraph(page = {}, context = {}) {
  const nodes = [];
  const unresolvedNodes = [];
  const warnings = [];

  const items = Array.isArray(page.items) ? page.items : [];
  items.forEach((item, itemIndex) => {
    const result = nodeFactForItem(item, page, itemIndex);
    if (result.unresolved) {
      unresolvedNodes.push(result.unresolved);
      return;
    }
    nodes.push(result.node);
  });

  if (!Number.isFinite(Number(page.width)) || !Number.isFinite(Number(page.height))) {
    warnings.push({
      code: 'PAGE_SIZE_MISSING',
      message: 'Page object graph requires page width and height for normalized geometry.',
    });
  }

  const edges = buildRelationshipEdges(nodes, page, context);
  return {
    pageId: page.id || `page-${(context.pageIndex || 0) + 1}`,
    nodes: nodes.map(publicNode),
    edges,
    unresolvedNodes,
    warnings,
  };
}

function assertDocumentModel(model) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('buildDocumentObjectGraph requires a DocumentModel');
  }
}

module.exports = {
  buildDocumentObjectGraph,
  buildPageObjectGraph,
};
