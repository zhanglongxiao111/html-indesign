function objectGraphPass(pageGraphs) {
  const summary = pageGraphs.reduce((acc, page) => {
    acc.pages += 1;
    acc.nodes += page.nodes.length;
    acc.edges += page.edges.length;
    acc.unresolvedNodes += page.unresolvedNodes.length;
    return acc;
  }, {
    pages: 0,
    nodes: 0,
    edges: 0,
    unresolvedNodes: 0,
  });

  return {
    name: 'page-object-graph',
    version: 1,
    status: 'completed',
    source: 'observed-model',
    ignoredSignals: ['indesignLayerName', 'indesignLayerIndex'],
    summary,
    pages: pageGraphs,
  };
}

module.exports = {
  objectGraphPass,
};
