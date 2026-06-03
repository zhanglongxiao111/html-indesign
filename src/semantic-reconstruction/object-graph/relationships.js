const {
  containment,
  minEdgeDistance,
  overlap,
  round,
} = require('./bounds');

const DEFAULT_OBJECT_GRAPH_OPTIONS = {
  minimumOverlapRatio: 0.08,
  maxCaptionTextLength: 80,
  maxSequenceSpacingVariance: 0.18,
};

function buildRelationshipEdges(nodes, page = {}, options = {}) {
  const config = { ...DEFAULT_OBJECT_GRAPH_OPTIONS, ...options };
  const tolerances = tolerancesForPage(page);
  const edges = [];

  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      const first = nodes[firstIndex];
      const second = nodes[secondIndex];
      addAlignmentEdge(edges, first, second, tolerances);
      addProximityEdge(edges, first, second, tolerances);
      addContainmentEdge(edges, first, second, tolerances);
      addOverlapEdge(edges, first, second, config);
      addSameStyleEdge(edges, first, second);
      addCaptionCandidateEdge(edges, first, second, tolerances, config);
    }
  }

  edges.push(...sequenceEdges(nodes, tolerances, config));
  return dedupeEdges(edges);
}

function tolerancesForPage(page = {}) {
  const smaller = Math.min(Number(page.width) || 0, Number(page.height) || 0) || 1;
  return {
    alignment: Math.max(1.5, 0.004 * smaller),
    proximity: 0.035 * smaller,
    containment: Math.max(2, 0.006 * smaller),
  };
}

function addAlignmentEdge(edges, first, second, tolerances) {
  const candidates = [
    ['left', Math.abs(first._metrics.x - second._metrics.x)],
    ['right', Math.abs(first._metrics.right - second._metrics.right)],
    ['top', Math.abs(first._metrics.y - second._metrics.y)],
    ['bottom', Math.abs(first._metrics.bottom - second._metrics.bottom)],
    ['center-x', Math.abs(first._metrics.centerX - second._metrics.centerX)],
    ['center-y', Math.abs(first._metrics.centerY - second._metrics.centerY)],
  ].filter(([, delta]) => delta <= tolerances.alignment);

  if (!candidates.length) return;
  const [axis, delta] = candidates.sort((a, b) => a[1] - b[1])[0];
  edges.push(edge('alignment', first.id, second.id, scoreFromDelta(delta, tolerances.alignment), {
    axis,
    delta: round(delta),
    tolerance: round(tolerances.alignment),
    unit: 'pt',
  }));
}

function addProximityEdge(edges, first, second, tolerances) {
  const distance = minEdgeDistance(first._metrics, second._metrics);
  if (distance > tolerances.proximity) return;
  edges.push(edge('proximity', first.id, second.id, scoreFromDelta(distance, tolerances.proximity), {
    distance: round(distance),
    tolerance: round(tolerances.proximity),
    unit: 'pt',
  }));
}

function addContainmentEdge(edges, first, second, tolerances) {
  const firstContainsSecond = containment(first._metrics, second._metrics, tolerances.containment);
  const secondContainsFirst = containment(second._metrics, first._metrics, tolerances.containment);
  if (firstContainsSecond >= 0.95 && first.size.area > second.size.area) {
    edges.push(edge('containment', first.id, second.id, firstContainsSecond, {
      containedRatio: firstContainsSecond,
      tolerance: round(tolerances.containment),
    }));
  } else if (secondContainsFirst >= 0.95 && second.size.area > first.size.area) {
    edges.push(edge('containment', second.id, first.id, secondContainsFirst, {
      containedRatio: secondContainsFirst,
      tolerance: round(tolerances.containment),
    }));
  }
}

function addOverlapEdge(edges, first, second, config) {
  const result = overlap(first._metrics, second._metrics);
  if (result.ratio < config.minimumOverlapRatio) return;
  edges.push(edge('overlap', first.id, second.id, result.ratio, {
    overlapArea: round(result.area),
    overlapRatio: result.ratio,
    zOrder: {
      [first.id]: first.zOrder,
      [second.id]: second.zOrder,
    },
  }));
}

function addSameStyleEdge(edges, first, second) {
  const firstStyle = stableStyleKey(first);
  const secondStyle = stableStyleKey(second);
  if (!firstStyle || firstStyle !== secondStyle) return;
  edges.push(edge('same-style', first.id, second.id, 1, {
    styleKey: firstStyle,
  }));
}

function addCaptionCandidateEdge(edges, first, second, tolerances, config) {
  const pair = captionPair(first, second);
  if (!pair) return;
  const { graphic, text } = pair;
  if (!text.textFacts || text.textFacts.length > config.maxCaptionTextLength) return;
  const gap = text._metrics.y - graphic._metrics.bottom;
  if (gap < 0 || gap > tolerances.proximity) return;
  const horizontalOverlap = axisOverlapRatio(graphic._metrics.x, graphic._metrics.right, text._metrics.x, text._metrics.right);
  const leftDelta = Math.abs(graphic._metrics.x - text._metrics.x);
  if (horizontalOverlap < 0.25 && leftDelta > tolerances.alignment) return;

  edges.push(edge('caption-candidate', graphic.id, text.id, round(Math.max(0.5, 1 - gap / tolerances.proximity)), {
    gap: round(gap),
    horizontalOverlap: round(horizontalOverlap),
    maxTextLength: config.maxCaptionTextLength,
  }));
}

function sequenceEdges(nodes, tolerances, config) {
  const edges = [];
  const groups = groupSequenceCandidates(nodes);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const vertical = group.slice().sort((a, b) => a._metrics.y - b._metrics.y);
    addSequenceEdges(edges, vertical, 'vertical', tolerances, config);
    const horizontal = group.slice().sort((a, b) => a._metrics.x - b._metrics.x);
    addSequenceEdges(edges, horizontal, 'horizontal', tolerances, config);
  }
  return edges;
}

function addSequenceEdges(edges, sorted, axis, tolerances, config) {
  if (sorted.length < 2) return;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    const aligned = axis === 'vertical'
      ? Math.abs(current._metrics.x - next._metrics.x) <= tolerances.alignment
      : Math.abs(current._metrics.y - next._metrics.y) <= tolerances.alignment;
    if (!aligned) continue;
    const spacing = axis === 'vertical'
      ? next._metrics.y - current._metrics.bottom
      : next._metrics.x - current._metrics.right;
    if (spacing < 0 || spacing > tolerances.proximity * 3) continue;
    edges.push(edge('sequence', current.id, next.id, 0.8, {
      axis,
      spacing: round(spacing),
      maxSpacingVariance: config.maxSequenceSpacingVariance,
    }));
  }
}

function groupSequenceCandidates(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const key = [
      node.sourceType,
      round(node.size.width),
      round(node.size.height),
      stableStyleKey(node) || 'unstyled',
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }
  return groups;
}

function captionPair(first, second) {
  if (isGraphicLike(first) && second.sourceType === 'text') return { graphic: first, text: second };
  if (isGraphicLike(second) && first.sourceType === 'text') return { graphic: second, text: first };
  return null;
}

function isGraphicLike(node) {
  return node.sourceType === 'graphic' || node.sourceType === 'shape';
}

function axisOverlapRatio(aStart, aEnd, bStart, bEnd) {
  const overlapSize = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const minSize = Math.min(aEnd - aStart, bEnd - bStart);
  return minSize > 0 ? overlapSize / minSize : 0;
}

function stableStyleKey(node) {
  const style = node.visualFacts || {};
  const keys = Object.keys(style).sort();
  if (!keys.length) return '';
  return keys.map((key) => `${key}:${style[key]}`).join(';');
}

function scoreFromDelta(delta, tolerance) {
  if (tolerance <= 0) return 0;
  return round(Math.max(0, Math.min(1, 1 - delta / tolerance)));
}

function edge(type, from, to, score, evidence) {
  return {
    type,
    from,
    to,
    score: round(score),
    evidence,
  };
}

function dedupeEdges(edges) {
  const seen = new Set();
  const out = [];
  for (const candidate of edges) {
    const key = `${candidate.type}|${candidate.from}|${candidate.to}|${candidate.evidence && candidate.evidence.axis || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

module.exports = {
  DEFAULT_OBJECT_GRAPH_OPTIONS,
  buildRelationshipEdges,
  tolerancesForPage,
};
