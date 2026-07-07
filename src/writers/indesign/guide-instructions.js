const { createProtocolLabel } = require('../../shared/labels');

function guideInstructionsFor(page) {
  return (page.guides || []).map((guide, index) => ({
    ...guide,
    labels: labelsFor(guide.labels, {
      kind: 'guide',
      id: `${page.id}-guide-${index + 1}`,
      source: 'html-to-indesign',
      pageId: page.id,
      orientation: guide.orientation,
      position: guide.position,
      guideSource: guide.source || null,
    }),
  }));
}

function ensureItemLabels(item) {
  if (!item) return item;
  return {
    ...item,
    labels: labelsFor(item.labels, {
      kind: 'item',
      id: item.id,
      source: 'html-to-indesign',
      role: item.role || null,
      generated: item.role === 'background' || item.role === 'decoration',
    }),
  };
}

function labelsFor(labels, fallback) {
  return Array.isArray(labels) && labels.length ? labels : [createProtocolLabel(fallback)];
}

module.exports = {
  guideInstructionsFor,
  ensureItemLabels,
};
