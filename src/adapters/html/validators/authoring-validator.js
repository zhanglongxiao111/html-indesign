const { parseCssLength, round } = require('../../../shared/geometry');

const PAGE_MARGIN_RULE_MISSING = 'PAGE_MARGIN_RULE_MISSING';
const PAGE_GRID_RULE_MISSING = 'PAGE_GRID_RULE_MISSING';
const PAGE_GRID_RULE_INVALID = 'PAGE_GRID_RULE_INVALID';
const GRID_ALIGNMENT_OFF = 'GRID_ALIGNMENT_OFF';
const SEMANTIC_TOKEN_MISSING = 'SEMANTIC_TOKEN_MISSING';

function validateAuthoringRules(snapshot, options = {}) {
  const pages = Array.isArray(snapshot && snapshot.pages) ? snapshot.pages : [];
  const errors = [];
  const warnings = [];
  const gridTolerance = Number.isFinite(Number(options.gridTolerance)) ? Number(options.gridTolerance) : 1;

  pages.forEach((page, pageIndex) => {
    const pageId = pageIdFor(page, pageIndex);
    const margin = resolvePageMargins(page);
    if (!margin.present) {
      errors.push(message('error', PAGE_MARGIN_RULE_MISSING, pageId, null, 'Page must declare authoring margins with data-id-margin, data-id-margin-* or page padding.'));
    }

    const grid = resolvePageGrid(page, margin.margins);
    if (!grid.present) {
      errors.push(message('error', PAGE_GRID_RULE_MISSING, pageId, null, 'Page must declare an authoring grid with data-id-grid or CSS Grid.'));
    } else if (!grid.valid) {
      errors.push(message('error', PAGE_GRID_RULE_INVALID, pageId, null, grid.reason || 'Page grid declaration could not be parsed.'));
    }

    const items = Array.isArray(page.items) ? page.items : [];
    if (grid.valid && grid.lines) {
      items.forEach((item, itemIndex) => {
        if (!shouldCheckGrid(item, page)) return;
        const edges = offGridEdges(item.boundsMm, grid.lines, gridTolerance, item);
        if (!edges.length) return;
        warnings.push({
          ...message('warning', GRID_ALIGNMENT_OFF, pageId, itemIdFor(item, itemIndex), 'Item edges do not align to the declared authoring grid.'),
          edges,
        });
      });
    }

    items.forEach((item, itemIndex) => {
      if (!isMappableItem(item) || hasStableSemanticToken(item)) return;
      warnings.push(message('warning', SEMANTIC_TOKEN_MISSING, pageId, itemIdFor(item, itemIndex), 'Mappable item should use a stable class or data-id semantic token.'));
    });
  });

  const resultWarnings = options.strict ? [] : warnings;
  const resultErrors = options.strict
    ? errors.concat(warnings.map((entry) => ({ ...entry, level: 'error' })))
    : errors;
  return {
    valid: resultErrors.length === 0,
    errors: resultErrors,
    warnings: resultWarnings,
    messages: resultErrors.concat(resultWarnings),
  };
}

function message(level, code, pageId, itemId, text) {
  const out = { level, code, message: text, pageId };
  if (itemId) out.itemId = itemId;
  return out;
}

function pageIdFor(page, index) {
  return page && page.id ? page.id : `page-${index + 1}`;
}

function itemIdFor(item, index) {
  return item && item.id ? item.id : `item-${index + 1}`;
}

function resolvePageMargins(page) {
  const attrs = attributesFor(page);
  const semantic = attributeValue(attrs, 'data-id-margin');
  if (semantic != null) {
    const margins = boxLengths(semantic, page);
    return {
      present: !!margins,
      margins: margins || zeroMargins(),
    };
  }

  const sideAttrs = {
    top: attributeValue(attrs, 'data-id-margin-top'),
    right: attributeValue(attrs, 'data-id-margin-right'),
    bottom: attributeValue(attrs, 'data-id-margin-bottom'),
    left: attributeValue(attrs, 'data-id-margin-left'),
  };
  if (Object.values(sideAttrs).some((value) => value != null)) {
    return {
      present: true,
      margins: {
        top: lengthToMm(sideAttrs.top, page, 'y'),
        right: lengthToMm(sideAttrs.right, page, 'x'),
        bottom: lengthToMm(sideAttrs.bottom, page, 'y'),
        left: lengthToMm(sideAttrs.left, page, 'x'),
      },
    };
  }

  const authored = page && page.authoredStyle || {};
  const computed = page && page.computedStyle || {};
  const paddingProps = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  const hasAuthoredPadding = paddingProps.some((prop) => authored[prop] != null && String(authored[prop]).trim() !== '');
  const hasComputedPadding = paddingProps.some((prop) => {
    const axis = prop === 'paddingTop' || prop === 'paddingBottom' ? 'y' : 'x';
    return lengthToMm(computed[prop], page, axis) > 0;
  });
  if (!hasAuthoredPadding && !hasComputedPadding) {
    return {
      present: false,
      margins: zeroMargins(),
    };
  }

  return {
    present: true,
    margins: {
      top: lengthToMm(authored.paddingTop || computed.paddingTop, page, 'y'),
      right: lengthToMm(authored.paddingRight || computed.paddingRight, page, 'x'),
      bottom: lengthToMm(authored.paddingBottom || computed.paddingBottom, page, 'y'),
      left: lengthToMm(authored.paddingLeft || computed.paddingLeft, page, 'x'),
    },
  };
}

function resolvePageGrid(page, margins) {
  const attrs = attributesFor(page);
  const style = page && page.computedStyle || {};
  const semantic = attributeValue(attrs, 'data-id-grid');
  const snap = snapGridSpec(page, margins, attrs);
  if (snap.present && !snap.valid) {
    return {
      present: true,
      valid: false,
      reason: snap.reason,
    };
  }
  if (semantic != null) {
    const spec = semanticGridSpec(semantic);
    if (!spec) {
      return {
        present: true,
        valid: false,
        reason: `Invalid grid declaration: ${semantic}`,
      };
    }
    const columnGap = lengthToMm(
      attributeValue(attrs, 'data-id-column-gutter')
        || style.columnGap
        || style.gap,
      page,
      'x'
    );
    const rowGap = lengthToMm(
      attributeValue(attrs, 'data-id-row-gutter')
        || style.rowGap
        || style.gap,
      page,
      'y'
    );
    const baseline = lengthToMm(
      attributeValue(attrs, 'data-id-baseline'),
      page,
      'y'
    );
    const horizontal = spec.rows > 0
      ? evenGridLines(margins.top, pageHeight(page) - margins.top - margins.bottom, spec.rows, rowGap, pageHeight(page))
      : modularGridLines(margins.top, pageHeight(page) - margins.bottom, baseline, pageHeight(page));
    return {
      present: true,
      valid: true,
      lines: {
        vertical: evenGridLines(margins.left, pageWidth(page) - margins.left - margins.right, spec.columns, columnGap, pageWidth(page)),
        horizontal,
      },
    };
  }

  if (String(style.display || '').toLowerCase().includes('grid')) {
    const columns = parseTrackLengths(style.gridTemplateColumns, page, 'x');
    const rows = parseTrackLengths(style.gridTemplateRows, page, 'y');
    if (!columns.length && !rows.length) {
      return {
        present: true,
        valid: false,
        reason: 'CSS Grid is present but grid-template tracks could not be parsed.',
      };
    }
    return {
      present: true,
      valid: true,
      lines: {
        vertical: trackLines(margins.left, columns, lengthToMm(style.columnGap || style.gap, page, 'x'), pageWidth(page)),
        horizontal: trackLines(margins.top, rows, lengthToMm(style.rowGap || style.gap, page, 'y'), pageHeight(page)),
      },
    };
  }

  return {
    present: false,
    valid: false,
    lines: null,
  };
}

function snapGridSpec(page, margins, attrs) {
  const raw = attributeValue(attrs, 'data-id-snap-grid') || attributeValue(attrs, 'data-id-authoring-grid');
  const rawX = attributeValue(attrs, 'data-id-snap-grid-x') || raw;
  const rawY = attributeValue(attrs, 'data-id-snap-grid-y') || raw;
  if (rawX == null && rawY == null) {
    return {
      present: false,
      valid: false,
      lines: null,
    };
  }

  const stepX = lengthToMm(rawX, page, 'x');
  const stepY = lengthToMm(rawY, page, 'y');
  if (stepX <= 0 || stepY <= 0) {
    return {
      present: true,
      valid: false,
      reason: `Invalid snap grid declaration: ${rawX || rawY}`,
    };
  }
  return {
    present: true,
    valid: true,
    lines: {
      vertical: modularGridLines(margins.left, pageWidth(page) - margins.right, stepX, pageWidth(page)),
      horizontal: modularGridLines(margins.top, pageHeight(page) - margins.bottom, stepY, pageHeight(page)),
    },
  };
}

function attributesFor(element) {
  return element && element.attributes && typeof element.attributes === 'object' ? element.attributes : {};
}

function attributeValue(attrs, name) {
  if (Object.prototype.hasOwnProperty.call(attrs, name)) return attrs[name];
  const lower = name.toLowerCase();
  const key = Object.keys(attrs).find((candidate) => candidate.toLowerCase() === lower);
  return key ? attrs[key] : null;
}

function zeroMargins() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function boxLengths(value, page) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  const values = parts.length === 1
    ? [parts[0], parts[0], parts[0], parts[0]]
    : parts.length === 2
      ? [parts[0], parts[1], parts[0], parts[1]]
      : parts.length === 3
        ? [parts[0], parts[1], parts[2], parts[1]]
        : parts;
  return {
    top: lengthToMm(values[0], page, 'y'),
    right: lengthToMm(values[1], page, 'x'),
    bottom: lengthToMm(values[2], page, 'y'),
    left: lengthToMm(values[3], page, 'x'),
  };
}

function lengthToMm(value, page, axis) {
  const parsed = parseCssLength(value);
  if (!parsed) return 0;
  if (parsed.unit === 'mm') return round(parsed.value, 4);
  if (parsed.unit === 'pt') return round(parsed.value * 25.4 / 72, 4);
  return round(parsed.value * pxToMm(page, axis), 4);
}

function pxToMm(page, axis) {
  const rect = page && page.rectPx || {};
  if (axis === 'x' && Number(rect.width) > 0 && Number(page.widthMm) > 0) {
    return Number(page.widthMm) / Number(rect.width);
  }
  if (axis === 'y' && Number(rect.height) > 0 && Number(page.heightMm) > 0) {
    return Number(page.heightMm) / Number(rect.height);
  }
  return 25.4 / 96;
}

function semanticGridSpec(raw) {
  const match = String(raw || '').trim().match(/^(\d+)(?:\s*[xX*]\s*(\d+))?$/);
  if (!match) return null;
  const columns = Number(match[1]);
  const rows = Number(match[2] || 0);
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 0) return null;
  return { columns, rows };
}

function evenGridLines(start, total, count, gap, pageEnd) {
  const safeStart = Number(start || 0);
  const safeTotal = Number(total || 0);
  const safeGap = Math.max(0, Number(gap || 0));
  const lines = [0, safeStart, pageEnd];
  if (count < 1 || safeTotal <= 0) return uniqueLines(lines);
  const track = (safeTotal - safeGap * (count - 1)) / count;
  if (track <= 0) return uniqueLines(lines);
  for (let index = 1; index <= count; index += 1) {
    const trackEnd = safeStart + index * track + (index - 1) * safeGap;
    lines.push(trackEnd);
    if (index < count && safeGap > 0) lines.push(trackEnd + safeGap);
  }
  return uniqueLines(lines);
}

function trackLines(start, tracks, gap, pageEnd) {
  const lines = [0, Number(start || 0), pageEnd];
  const safeGap = Math.max(0, Number(gap || 0));
  let cursor = Number(start || 0);
  for (let index = 0; index < tracks.length; index += 1) {
    cursor += tracks[index];
    lines.push(cursor);
    if (index < tracks.length - 1 && safeGap > 0) {
      cursor += safeGap;
      lines.push(cursor);
    }
  }
  return uniqueLines(lines);
}

function modularGridLines(start, end, step, pageEnd) {
  const lines = [0, Number(start || 0), Number(end || 0), Number(pageEnd || 0)];
  const safeStep = Number(step || 0);
  if (safeStep <= 0) return uniqueLines(lines);
  for (let cursor = Number(start || 0); cursor <= Number(end || 0) + 0.0001; cursor += safeStep) {
    lines.push(cursor);
  }
  return uniqueLines(lines);
}

function parseTrackLengths(value, page, axis) {
  const text = String(value || '').trim();
  if (!text || text === 'none') return [];
  return text.split(/\s+/)
    .map((part) => lengthToMm(part, page, axis))
    .filter((length) => Number.isFinite(length) && length > 0);
}

function uniqueLines(lines) {
  const seen = new Set();
  return (lines || [])
    .filter((line) => Number.isFinite(Number(line)))
    .map((line) => round(Number(line), 2))
    .sort((a, b) => a - b)
    .filter((line) => {
      const key = String(line);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function pageWidth(page) {
  return Number(page && page.widthMm || 0);
}

function pageHeight(page) {
  return Number(page && page.heightMm || 0);
}

function shouldCheckGrid(item, page) {
  if (!isMappableItem(item)) return false;
  const attrs = attributesFor(item);
  if (attributeValue(attrs, 'data-id-grid-ignore') != null) return false;
  if (attributeValue(attrs, 'data-id-role') === 'annotation') return false;
  if (Array.isArray(item && item.ancestorCandidateIndexes) && item.ancestorCandidateIndexes.length) return false;
  if (Array.isArray(item && item.classList) && item.classList.includes('page-number')) return false;
  if (attributeValue(attrs, 'data-id-paragraph-style') === 'folio') return false;
  const bounds = item && item.boundsMm;
  return bounds
    && Number.isFinite(Number(bounds.x))
    && Number.isFinite(Number(bounds.y))
    && Number.isFinite(Number(bounds.width))
    && Number.isFinite(Number(bounds.height))
    && !coversWholePage(bounds, page);
}

function offGridEdges(bounds, lines, tolerance, item) {
  const vertical = lines && Array.isArray(lines.vertical) ? lines.vertical : [];
  const horizontal = lines && Array.isArray(lines.horizontal) ? lines.horizontal : [];
  const edges = gridEdgesForItem(bounds, vertical, horizontal, item);
  return edges
    .filter(([, value, candidates]) => !nearAnyLine(value, candidates, tolerance))
    .map(([name]) => name);
}

function gridEdgesForItem(bounds, vertical, horizontal, item) {
  const edges = [
    ['left', Number(bounds.x), vertical],
    ['right', Number(bounds.x) + Number(bounds.width), vertical],
    ['top', Number(bounds.y), horizontal],
  ];
  const role = String(item && item.role || '').toLowerCase();
  if (role !== 'text' && role !== 'table') {
    edges.push(['bottom', Number(bounds.y) + Number(bounds.height), horizontal]);
  }
  return edges;
}

function coversWholePage(bounds, page) {
  if (!page) return false;
  return Math.abs(Number(bounds.x || 0)) < 0.01
    && Math.abs(Number(bounds.y || 0)) < 0.01
    && Math.abs(Number(bounds.width || 0) - pageWidth(page)) < 0.01
    && Math.abs(Number(bounds.height || 0) - pageHeight(page)) < 0.01;
}

function nearAnyLine(value, lines, tolerance) {
  return (lines || []).some((line) => Math.abs(Number(value) - Number(line)) <= tolerance);
}

function isMappableItem(item) {
  const role = String(item && item.role || '').toLowerCase();
  if (['text', 'graphic', 'shape', 'table'].includes(role)) return true;
  const tagName = String(item && item.tagName || '').toLowerCase();
  return [
    'article', 'aside', 'blockquote', 'canvas', 'caption', 'div', 'figure', 'figcaption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'object', 'ol', 'p',
    'picture', 'section', 'span', 'svg', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'tr', 'ul',
  ].includes(tagName);
}

function hasStableSemanticToken(item) {
  if (Array.isArray(item && item.classList) && item.classList.some((name) => String(name || '').trim())) {
    return true;
  }
  const attrs = attributesFor(item);
  return [
    'data-id-paragraph-style',
    'data-id-character-style',
    'data-id-object-style',
    'data-id-frame-style',
    'data-id-table-style',
    'data-id-cell-style',
    'data-id-asset-kind',
    'data-id-object',
    'data-id-role',
    'data-id-semantic',
    'data-id-layer',
    'data-id-placement',
    'data-id-fit',
    'data-id-pdf-page',
    'data-id-artboard',
  ].some((name) => {
    const value = attributeValue(attrs, name);
    return value != null && String(value).trim() !== '';
  });
}

module.exports = {
  validateAuthoringRules,
};
