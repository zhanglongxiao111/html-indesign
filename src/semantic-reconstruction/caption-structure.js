const { buildDocumentObjectGraph } = require('./object-graph');

const DEFAULT_CAPTION_STRUCTURE_OPTIONS = {
  maxCaptionTextLength: 80,
  minimumScore: 0.75,
};

function applyCaptionStructure(model, options = {}, context = {}) {
  const config = { ...DEFAULT_CAPTION_STRUCTURE_OPTIONS, ...options };
  const objectGraphPass = context.objectGraphPass || buildDocumentObjectGraph(model, context.objectGraphOptions || {});
  const applied = [];
  const skipped = [];

  for (const pageGraph of objectGraphPass.pages || []) {
    const page = findPage(model, pageGraph.pageId);
    if (!page) continue;
    const itemsById = new Map((page.items || []).map((item) => [item.id, item]));
    const usedFigureIds = new Set();
    const usedCaptionIds = new Set();
    const edges = (pageGraph.edges || [])
      .filter((edge) => edge.type === 'caption-candidate')
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    for (const edge of edges) {
      const figure = itemsById.get(edge.from);
      const caption = itemsById.get(edge.to);
      const decision = captionDecision({ page, figure, caption, edge, usedFigureIds, usedCaptionIds, config });
      if (!decision.ok) {
        skipped.push(skippedCandidate(page, edge, decision.reason));
        continue;
      }
      structureCaption({ page, figure, caption });
      usedFigureIds.add(figure.id);
      usedCaptionIds.add(caption.id);
      applied.push({
        pageId: page.id || null,
        figureId: figure.id || null,
        captionId: caption.id || null,
        score: round(edge.score),
        evidence: edge.evidence || {},
      });
    }
  }

  return {
    name: 'caption-structure',
    version: 1,
    status: 'completed',
    source: 'page-object-graph',
    summary: {
      pages: (model.pages || []).length,
      candidates: applied.length + skipped.length,
      applied: applied.length,
      skipped: skipped.length,
    },
    applied,
    skipped,
  };
}

function captionDecision({ page, figure, caption, edge, usedFigureIds, usedCaptionIds, config }) {
  if (!figure || !caption) return { ok: false, reason: 'item-missing' };
  if (usedFigureIds.has(figure.id)) return { ok: false, reason: 'figure-already-has-caption' };
  if (usedCaptionIds.has(caption.id)) return { ok: false, reason: 'caption-already-used' };
  if (!isGraphicCaptionHost(figure)) return { ok: false, reason: 'figure-not-graphic' };
  if (caption.role !== 'text') return { ok: false, reason: 'caption-not-text' };
  if (Number(edge.score || 0) < config.minimumScore) return { ok: false, reason: 'score-too-low' };
  if (captionText(caption).length > config.maxCaptionTextLength) return { ok: false, reason: 'caption-too-long' };
  if (captionAlreadyNestedUnderOther(page, caption, figure)) return { ok: false, reason: 'caption-already-nested' };
  return { ok: true };
}

function structureCaption({ page, figure, caption }) {
  const childOrder = nextChildOrder(page, figure.id);
  figure.tagName = figure.tagName || 'figure';
  if (figure.labelStatus !== 'accepted') {
    figure.sourceNode = sourceNodeForReconstructedTag(figure, 'figure', { 'data-id-object': '' });
  }
  caption.tagName = 'figcaption';
  caption.structure = {
    ...(caption.structure || {}),
    parentId: figure.id,
    order: childOrder,
  };
  if (caption.labelStatus !== 'accepted') {
    caption.sourceNode = sourceNodeForReconstructedTag(caption, 'figcaption');
  }
}

function isGraphicCaptionHost(item) {
  if (!item) return false;
  if (item.role === 'graphic') return true;
  return Boolean(item.asset || item.sourceAsset || item.placedAsset);
}

function captionAlreadyNestedUnderOther(page, caption, figure) {
  const parentId = caption.structure && caption.structure.parentId;
  if (!parentId || parentId === page.id || parentId === figure.id) return false;
  return true;
}

function nextChildOrder(page, figureId) {
  const childOrders = (page.items || [])
    .filter((item) => item && item.structure && item.structure.parentId === figureId)
    .map((item) => Number(item.structure.order))
    .filter(Number.isFinite);
  if (!childOrders.length) return 1;
  return Math.max(...childOrders) + 1;
}

function findPage(model, pageId) {
  return (model.pages || []).find((page) => page && page.id === pageId);
}

function captionText(item) {
  if (item.content && typeof item.content.text === 'string') return item.content.text;
  if (typeof item.text === 'string') return item.text;
  return '';
}

function sourceNodeForReconstructedTag(item, tagName, extraAttrs = {}) {
  const sourceNode = item.sourceNode || {};
  return {
    ...sourceNode,
    tagName,
    id: sourceNode.id || item.id || null,
    classList: Array.isArray(sourceNode.classList) ? sourceNode.classList.slice() : [],
    attributes: {
      ...(sourceNode.attributes || {}),
      ...extraAttrs,
    },
  };
}

function skippedCandidate(page, edge, reason) {
  return {
    pageId: page && page.id || null,
    figureId: edge && edge.from || null,
    captionId: edge && edge.to || null,
    score: round(edge && edge.score),
    reason,
  };
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 10000) / 10000;
}

module.exports = {
  applyCaptionStructure,
};
