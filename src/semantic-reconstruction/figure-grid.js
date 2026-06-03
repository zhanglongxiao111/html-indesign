const { normalizePageLevelReadingOrder } = require('./reading-order');

const DEFAULT_FIGURE_GRID_OPTIONS = {
  minGroupSize: 3,
  sizeToleranceRatio: 0.18,
};

function applyFigureGrid(model, options = {}) {
  const config = { ...DEFAULT_FIGURE_GRID_OPTIONS, ...options };
  const applied = [];
  const skipped = [];

  for (const page of model.pages || []) {
    const candidates = captionedFigures(page);
    const clusters = clusterByComparableSize(candidates, config);
    let groupIndex = 1;
    for (const cluster of clusters) {
      const decision = gridDecision(cluster, config);
      if (!decision.ok) {
        skipped.push({
          pageId: page.id || null,
          figureIds: cluster.map((item) => item.id),
          reason: decision.reason,
        });
        continue;
      }
      const result = createFigureGrid(page, cluster, groupIndex);
      normalizePageLevelReadingOrder(page);
      groupIndex += 1;
      applied.push({
        pageId: page.id || null,
        groupId: result.group.id,
        figureIds: result.figureIds,
        rows: decision.rows,
        columns: decision.columns,
        bounds: result.bounds,
        evidence: {
          sizeToleranceRatio: config.sizeToleranceRatio,
        },
      });
    }
  }

  const groupedFigures = applied.reduce((sum, group) => sum + group.figureIds.length, 0);
  return {
    name: 'figure-grid',
    version: 1,
    status: 'completed',
    source: 'caption-structure',
    summary: {
      pages: (model.pages || []).length,
      candidates: applied.reduce((sum, group) => sum + group.figureIds.length, 0)
        + skipped.reduce((sum, group) => sum + group.figureIds.length, 0),
      groups: applied.length,
      groupedFigures,
      skipped: skipped.length,
      applied: groupedFigures,
    },
    applied,
    skipped,
  };
}

function captionedFigures(page) {
  const items = Array.isArray(page.items) ? page.items : [];
  const captionsByParent = new Set(items
    .filter((item) => item && item.role === 'text' && isFigcaption(item))
    .map((item) => item.structure && item.structure.parentId)
    .filter(Boolean));
  return items
    .filter((item) => item && item.role === 'graphic')
    .filter((item) => captionsByParent.has(item.id))
    .filter((item) => hasBounds(item))
    .filter((item) => isPageLevelItem(page, item));
}

function isFigcaption(item) {
  const tag = String(item.tagName || item.sourceNode && item.sourceNode.tagName || '').toLowerCase();
  return tag === 'figcaption';
}

function isPageLevelItem(page, item) {
  const parentId = item.structure && item.structure.parentId;
  return !parentId || parentId === page.id;
}

function clusterByComparableSize(candidates, config) {
  const clusters = [];
  for (const item of candidates) {
    const cluster = clusters.find((candidate) => comparableSize(candidate[0], item, config));
    if (cluster) {
      cluster.push(item);
    } else {
      clusters.push([item]);
    }
  }
  return clusters;
}

function comparableSize(first, second, config) {
  return relativeDelta(first.bounds.width, second.bounds.width) <= config.sizeToleranceRatio
    && relativeDelta(first.bounds.height, second.bounds.height) <= config.sizeToleranceRatio;
}

function gridDecision(cluster, config) {
  if (cluster.length < config.minGroupSize) return { ok: false, reason: 'too-few-captioned-figures' };
  const rows = rowClusters(cluster);
  const maxColumns = Math.max(...rows.map((row) => row.length));
  if (rows.length < 2 && maxColumns < config.minGroupSize) return { ok: false, reason: 'not-grid-like' };
  return { ok: true, rows: rows.length, columns: maxColumns };
}

function createFigureGrid(page, figures, groupIndex) {
  const orderedFigures = rowMajorFigures(figures);
  const groupId = uniqueGroupId(page, groupIndex);
  const bounds = unionBounds(page.items || [], orderedFigures);
  const group = {
    id: groupId,
    role: 'container',
    virtual: true,
    semantic: null,
    tagName: 'section',
    sourceNode: {
      tagName: 'section',
      id: groupId,
      classList: ['figure-grid'],
      attributes: {},
    },
    structure: {
      parentId: page.id || null,
      order: 0,
    },
    content: { text: '' },
  };
  page.items.push(group);
  orderedFigures.forEach((figure, index) => {
    figure.structure = {
      ...(figure.structure || {}),
      parentId: groupId,
      order: index + 1,
    };
  });
  return { group, bounds, figureIds: orderedFigures.map((figure) => figure.id) };
}

function rowClusters(figures) {
  const sorted = figures.slice().sort((a, b) => boundsMetric(a).centerY - boundsMetric(b).centerY);
  const rows = [];
  for (const figure of sorted) {
    const metric = boundsMetric(figure);
    const row = rows.find((candidate) => Math.abs(candidate.centerY - metric.centerY) <= rowTolerance(candidate.items));
    if (row) {
      row.items.push(figure);
      row.centerY = average(row.items.map((item) => boundsMetric(item).centerY));
    } else {
      rows.push({ centerY: metric.centerY, items: [figure] });
    }
  }
  return rows.map((row) => row.items.sort((a, b) => a.bounds.x - b.bounds.x));
}

function rowMajorFigures(figures) {
  return rowClusters(figures).flat();
}

function rowTolerance(items) {
  const averageHeight = average(items.map((item) => Number(item.bounds.height) || 0));
  return Math.max(6, averageHeight * 0.2);
}

function unionBounds(items, figures) {
  const figureIds = new Set(figures.map((item) => item.id));
  const bounds = [];
  for (const item of items) {
    if (!hasBounds(item)) continue;
    const parentId = item.structure && item.structure.parentId;
    if (figureIds.has(item.id) || figureIds.has(parentId)) bounds.push(item.bounds);
  }
  const left = Math.min(...bounds.map((entry) => Number(entry.x)));
  const top = Math.min(...bounds.map((entry) => Number(entry.y)));
  const right = Math.max(...bounds.map((entry) => Number(entry.x) + Number(entry.width)));
  const bottom = Math.max(...bounds.map((entry) => Number(entry.y) + Number(entry.height)));
  return {
    x: round(left),
    y: round(top),
    width: round(right - left),
    height: round(bottom - top),
  };
}

function uniqueGroupId(page, groupIndex) {
  const base = `${safeId(page.id || 'page')}-figure-grid`;
  const existing = new Set((page.items || []).map((item) => item && item.id));
  let index = groupIndex;
  let id = `${base}-${index}`;
  while (existing.has(id)) {
    index += 1;
    id = `${base}-${index}`;
  }
  return id;
}

function safeId(value) {
  return String(value || 'page')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function hasBounds(item) {
  const bounds = item && item.bounds;
  return Boolean(bounds
    && Number.isFinite(Number(bounds.x))
    && Number.isFinite(Number(bounds.y))
    && Number.isFinite(Number(bounds.width))
    && Number.isFinite(Number(bounds.height))
    && Number(bounds.width) > 0
    && Number(bounds.height) > 0);
}

function boundsMetric(item) {
  return {
    centerY: Number(item.bounds.y) + Number(item.bounds.height) / 2,
  };
}

function relativeDelta(first, second) {
  const a = Number(first);
  const b = Number(second);
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / max;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 10000) / 10000;
}

module.exports = {
  applyFigureGrid,
};
