const { createReport, addMessage } = require('../shared/report');
const { compileStyles } = require('./style-compiler');

function compileInstructions(snapshot, options = {}) {
  const styled = snapshot.styles ? snapshot : compileStyles(snapshot, options);
  const report = createReport();
  addMessage(report, 'info', 'INSTRUCTIONS_COMPILE_START', 'Build instructions compilation started', {
    pageCount: styled.pages.length,
  });

  const pages = styled.pages.map((page) => ({
    id: page.id,
    index: page.index,
    width: page.widthMm,
    height: page.heightMm,
    items: page.items
      .map((item) => instructionItemFor(item, styled.assets || []))
      .filter(Boolean)
      .sort((a, b) => a.zIndex - b.zIndex),
  }));
  const layers = collectLayers(pages);

  return {
    metadata: {
      source: styled.metadata && styled.metadata.source,
      generatedAt: new Date().toISOString(),
      compiler: 'html-indesign/paged-html-to-instructions',
      mode: options.mode || 'editable-first',
    },
    document: {
      pages: styled.pages.map((page) => ({
        id: page.id,
        width: page.widthMm,
        height: page.heightMm,
      })),
    },
    styles: styled.styles,
    assets: styled.assets || [],
    layers,
    pages,
    warnings: styled.warnings || [],
    report,
  };
}

function instructionItemFor(item, assets) {
  const base = {
    id: item.id,
    role: item.role,
    bounds: item.boundsMm,
    zIndex: item.zIndex || 0,
    layer: layerForItem(item),
    sourceSelector: item.sourceSelector,
    styleRefs: item.styleRefs,
  };
  if (item.role === 'text') {
    return {
      ...base,
      type: 'TEXT',
      text: item.content.text,
      paragraphStyle: item.styleRefs.paragraphStyle,
      runs: item.content.runs,
    };
  }
  if (item.role === 'graphic') {
    const asset = assetForItem(item, assets);
    return {
      ...base,
      type: 'GRAPHIC',
      objectStyle: item.styleRefs.objectStyle,
      frameStyle: item.styleRefs.frameStyle,
      placed: asset ? {
        assetId: asset.id,
        fit: asset.placement.fit,
        position: asset.placement.position,
        pageNumber: asset.placement.pageNumber,
        crop: asset.placement.crop,
        artboard: asset.placement.artboard,
        layerComp: asset.placement.layerComp,
        preserveVector: asset.placement.preserveVector,
      } : null,
    };
  }
  if (item.role === 'table') {
    return {
      ...base,
      type: 'TABLE',
      tableStyle: item.styleRefs.tableStyle,
      text: item.text,
    };
  }
  return {
    ...base,
    type: 'SHAPE',
    objectStyle: item.styleRefs.objectStyle,
    frameStyle: item.styleRefs.frameStyle,
  };
}

function assetForItem(item, assets) {
  return assets.find((asset) => asset.sourceSelector === item.sourceSelector)
    || assets.find((asset) => asset.src === item.attributes.src || asset.src === item.attributes.data)
    || null;
}

function layerForItem(item) {
  if (item.attributes && item.attributes['data-id-layer']) return item.attributes['data-id-layer'];
  if (item.role === 'text') return 'text';
  if (item.role === 'graphic') return 'graphics';
  if (item.role === 'table') return 'tables';
  return 'content';
}

function collectLayers(pages) {
  const names = new Set(['background', 'content', 'graphics', 'text', 'tables', 'annotations']);
  for (const page of pages) {
    for (const item of page.items) {
      names.add(item.layer);
    }
  }
  return Array.from(names).map((name, index) => ({
    name,
    order: index,
  }));
}

module.exports = {
  compileInstructions,
};
