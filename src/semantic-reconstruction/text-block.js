const { normalizePageLevelReadingOrder } = require('./reading-order');

const DEFAULT_TEXT_BLOCK_OPTIONS = {
  minGroupSize: 2,
  maxVerticalGap: 48,
  xTolerance: 8,
  widthToleranceRatio: 0.12,
};

function applyTextBlock(model, options = {}) {
  const config = { ...DEFAULT_TEXT_BLOCK_OPTIONS, ...options };
  const applied = [];
  const skipped = [];

  for (const page of model.pages || []) {
    const groups = textBlockGroups(page, config);
    let groupIndex = 1;
    for (const group of groups) {
      if (group.length < config.minGroupSize) {
        skipped.push({
          pageId: page.id || null,
          textIds: group.map((item) => item.id),
          reason: 'too-few-text-frames',
        });
        continue;
      }
      const result = createTextBlock(page, group, groupIndex);
      normalizePageLevelReadingOrder(page);
      groupIndex += 1;
      applied.push({
        pageId: page.id || null,
        groupId: result.group.id,
        textIds: result.textIds,
        bounds: result.bounds,
        evidence: {
          maxVerticalGap: config.maxVerticalGap,
          xTolerance: config.xTolerance,
          widthToleranceRatio: config.widthToleranceRatio,
          styleKey: styleKey(group[0]),
        },
      });
    }
  }

  const groupedTextFrames = applied.reduce((sum, group) => sum + group.textIds.length, 0);
  return {
    name: 'text-block',
    version: 1,
    status: 'completed',
    source: 'observed-model',
    summary: {
      pages: (model.pages || []).length,
      candidates: groupedTextFrames + skipped.reduce((sum, group) => sum + group.textIds.length, 0),
      groups: applied.length,
      groupedTextFrames,
      skipped: skipped.length,
      applied: groupedTextFrames,
    },
    applied,
    skipped,
  };
}

function textBlockGroups(page, config) {
  const columns = textColumns(textCandidates(page), config);
  const groups = [];
  for (const column of columns) {
    const items = column.items.sort((a, b) => Number(a.bounds.y) - Number(b.bounds.y) || Number(a.bounds.x) - Number(b.bounds.x));
    let current = [];
    for (const item of items) {
      const previous = current[current.length - 1];
      if (previous && canContinueTextBlock(previous, item, config)) {
        current.push(item);
        continue;
      }
      if (current.length >= config.minGroupSize) groups.push(current);
      current = [item];
    }
    if (current.length >= config.minGroupSize) groups.push(current);
  }
  return groups;
}

function textColumns(candidates, config) {
  const columns = [];
  const sorted = candidates.slice().sort((a, b) => styleKey(a).localeCompare(styleKey(b)) || Number(a.bounds.x) - Number(b.bounds.x));
  for (const item of sorted) {
    const column = columns.find((candidate) => sameTextColumn(candidate.anchor, item, config));
    if (column) {
      column.items.push(item);
    } else {
      columns.push({ anchor: item, items: [item] });
    }
  }
  return columns;
}

function sameTextColumn(first, second, config) {
  return styleKey(first) === styleKey(second)
    && Math.abs(Number(first.bounds.x) - Number(second.bounds.x)) <= config.xTolerance
    && relativeDelta(first.bounds.width, second.bounds.width) <= config.widthToleranceRatio;
}

function textCandidates(page) {
  return (page.items || [])
    .filter((item) => item && item.role === 'text')
    .filter((item) => hasBounds(item))
    .filter((item) => isPageLevelItem(page, item))
    .filter((item) => !isFigcaption(item))
    .filter((item) => textContent(item).trim() !== '');
}

function canContinueTextBlock(previous, item, config) {
  if (styleKey(previous) !== styleKey(item)) return false;
  if (Math.abs(Number(previous.bounds.x) - Number(item.bounds.x)) > config.xTolerance) return false;
  if (relativeDelta(previous.bounds.width, item.bounds.width) > config.widthToleranceRatio) return false;
  const gap = Number(item.bounds.y) - (Number(previous.bounds.y) + Number(previous.bounds.height));
  return gap >= 0 && gap <= config.maxVerticalGap;
}

function createTextBlock(page, texts, groupIndex) {
  const orderedTexts = texts.slice().sort((a, b) => Number(a.bounds.y) - Number(b.bounds.y) || Number(a.bounds.x) - Number(b.bounds.x));
  const groupId = uniqueGroupId(page, groupIndex);
  const bounds = unionBounds(orderedTexts);
  const group = {
    id: groupId,
    role: 'container',
    virtual: true,
    semantic: null,
    tagName: 'section',
    sourceNode: {
      tagName: 'section',
      id: groupId,
      classList: ['text-block'],
      attributes: {},
    },
    structure: {
      parentId: page.id || null,
      order: 0,
    },
    content: { text: '' },
  };
  page.items.push(group);
  orderedTexts.forEach((item, index) => {
    item.structure = {
      ...(item.structure || {}),
      parentId: groupId,
      order: index + 1,
    };
  });
  return { group, bounds, textIds: orderedTexts.map((item) => item.id) };
}

function styleKey(item) {
  const refs = item.styleRefs || {};
  const textStyle = item.textStyle || {};
  return [
    refs.paragraphStyle || '',
    textStyle.fontFamily || '',
    textStyle.pointSize == null ? '' : String(textStyle.pointSize),
    textStyle.leading == null ? '' : String(textStyle.leading),
    textStyle.fillColor || '',
    textStyle.justification || '',
  ].join('|');
}

function isPageLevelItem(page, item) {
  const parentId = item.structure && item.structure.parentId;
  return !parentId || parentId === page.id;
}

function isFigcaption(item) {
  const tag = String(item.tagName || item.sourceNode && item.sourceNode.tagName || '').toLowerCase();
  return tag === 'figcaption';
}

function textContent(item) {
  if (item.content && typeof item.content.text === 'string') return item.content.text;
  if (typeof item.text === 'string') return item.text;
  return '';
}

function uniqueGroupId(page, groupIndex) {
  const base = `${safeId(page.id || 'page')}-text-block`;
  const existing = new Set((page.items || []).map((item) => item && item.id));
  let index = groupIndex;
  let id = `${base}-${index}`;
  while (existing.has(id)) {
    index += 1;
    id = `${base}-${index}`;
  }
  return id;
}

function unionBounds(items) {
  const left = Math.min(...items.map((item) => Number(item.bounds.x)));
  const top = Math.min(...items.map((item) => Number(item.bounds.y)));
  const right = Math.max(...items.map((item) => Number(item.bounds.x) + Number(item.bounds.width)));
  const bottom = Math.max(...items.map((item) => Number(item.bounds.y) + Number(item.bounds.height)));
  return {
    x: round(left),
    y: round(top),
    width: round(right - left),
    height: round(bottom - top),
  };
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

function safeId(value) {
  return String(value || 'page')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function relativeDelta(first, second) {
  const a = Number(first);
  const b = Number(second);
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / max;
}

function round(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 10000) / 10000;
}

module.exports = {
  applyTextBlock,
};
