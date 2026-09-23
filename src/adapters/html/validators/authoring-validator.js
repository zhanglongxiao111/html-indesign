const { parseCssLength, round } = require('../../../shared/geometry');
const {
  AUTHORING_MAPPABLE_ITEM_ROLE_VALUES,
  HTML_DATA_ID_ATTRIBUTES,
  ITEM_ROLE,
  isAuthoringMappableItemRole,
} = require('../../../protocol');

const PAGE_MARGIN_RULE_MISSING = 'PAGE_MARGIN_RULE_MISSING';
const PAGE_GRID_RULE_MISSING = 'PAGE_GRID_RULE_MISSING';
const PAGE_GRID_RULE_INVALID = 'PAGE_GRID_RULE_INVALID';
const GRID_ALIGNMENT_OFF = 'GRID_ALIGNMENT_OFF';
const SEMANTIC_TOKEN_MISSING = 'SEMANTIC_TOKEN_MISSING';
const GRAPHIC_ASSET_REFERENCE_MISSING = 'GRAPHIC_ASSET_REFERENCE_MISSING';
const TEXT_CONTAINER_HAS_CHILD_OBJECTS = 'TEXT_CONTAINER_HAS_CHILD_OBJECTS';
const HTML_TEXT_NOT_CONVERTIBLE = 'HTML_TEXT_NOT_CONVERTIBLE';
const TEXT_FIRST_LINE_CANNOT_FIT = 'TEXT_FIRST_LINE_CANNOT_FIT';
const GRID_OBSERVED_DOWNGRADED = 'GRID_OBSERVED_DOWNGRADED';

// lintProfile：default 是作者包的完整规则；reverse-export 面向从人做的 INDD 反向导出的包，
// 只把「带观察态标记的对象」的 GRID_ALIGNMENT_OFF 降为提示（notices[]），其余规则不变。
const AUTHORING_LINT_PROFILE = Object.freeze({
  DEFAULT: 'default',
  REVERSE_EXPORT: 'reverse-export',
});
const AUTHORING_LINT_PROFILE_NAMES = Object.freeze(Object.values(AUTHORING_LINT_PROFILE));
const DEFAULT_AUTHORING_LINT_PROFILE = AUTHORING_LINT_PROFILE.DEFAULT;

function resolveAuthoringLintProfile(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_AUTHORING_LINT_PROFILE;
  if (AUTHORING_LINT_PROFILE_NAMES.includes(value)) return value;
  const error = new Error(`INVALID_ARGS: lintProfile must be one of ${AUTHORING_LINT_PROFILE_NAMES.join(', ')}, received: ${value}`);
  error.code = 'INVALID_ARGS';
  throw error;
}

function validateAuthoringRules(snapshot, options = {}) {
  const pages = Array.isArray(snapshot && snapshot.pages) ? snapshot.pages : [];
  const errors = [];
  const warnings = [];
  // 提示级条目：不进 errors/warnings，strict 不提升；靠计数 + 汇总警告保证不隐身。
  const notices = [];
  const lintProfile = resolveAuthoringLintProfile(options.lintProfile);
  const downgradeObservedGrid = lintProfile === AUTHORING_LINT_PROFILE.REVERSE_EXPORT;
  let gridObservedDowngradedCount = 0;
  const gridTolerance = Number.isFinite(Number(options.gridTolerance)) ? Number(options.gridTolerance) : 1;
  // 豁免与偏差都计数：整包豁免不能静默通过，报告和遥测要看得见。
  let gridIgnoredCount = 0;
  let gridOffCount = 0;
  // "0 偏移"有两种来源：真的都压住线了，和一个都没量。只有把量过的、被块挡住的、
  // 量不出来的分开计数，报告才能把两者区分开。
  //
  // 条目侧的四个计数必须凑成一本闭合的账：每个可映射条目恰好落进
  // ignored / shielded / checked / skipped 之一，四者相加等于跑过网格检查的页面上
  // 可映射条目的总数。少一类（此前缺 skipped）就等于账不平——条目被 shouldCheckGrid
  // 的其他规则（annotation、folio、flex 自适应文本、整页、无几何、有可映射祖先）
  // 悄悄挡掉，报告里看不出来，"覆盖率回落到零"仍然可以装成"都压住线"。
  let gridCheckedCount = 0;
  let gridShieldedCount = 0;
  let gridSkippedCount = 0;
  let gridBlockCheckedCount = 0;
  let gridBlockSkippedCount = 0;
  // gridOffCount 是条目 + 块的总数，单看它分不出块级覆盖有没有在报错，
  // 所以块级另计一份 gridBlockOffCount。
  let gridBlockOffCount = 0;

  pages.forEach((page, pageIndex) => {
    const pageId = pageIdFor(page, pageIndex);
    const margin = resolvePageMargins(page);
    if (!margin.present) {
      errors.push(message('error', PAGE_MARGIN_RULE_MISSING, pageId, null, `Page must declare authoring margins with ${HTML_DATA_ID_ATTRIBUTES.MARGIN}, ${HTML_DATA_ID_ATTRIBUTES.MARGIN}-* or page padding.`));
    }

    const grid = resolvePageGrid(page, margin.margins);
    if (!grid.present) {
      errors.push(message('error', PAGE_GRID_RULE_MISSING, pageId, null, `Page must declare an authoring grid with ${HTML_DATA_ID_ATTRIBUTES.GRID} or CSS Grid.`));
    } else if (!grid.valid) {
      errors.push(message('error', PAGE_GRID_RULE_INVALID, pageId, null, grid.reason || 'Page grid declaration could not be parsed.'));
    }

    const items = Array.isArray(page.items) ? page.items : [];
    for (const issue of Array.isArray(page.uncapturedText) ? page.uncapturedText : []) {
      const itemId = issue.id || issue.sourcePath || null;
      const preview = String(issue.text || '').replace(/\s+/g, ' ').trim().slice(0, 20);
      errors.push({
        ...message(
          'error',
          HTML_TEXT_NOT_CONVERTIBLE,
          pageId,
          itemId,
          'Visible HTML text cannot be assigned safely to an InDesign text object. '
            + 'Put it in a leaf text element such as p, a heading, or a text-only div; keep layout containers separate.'
            + (preview ? ` Text starts with: "${preview}"` : ''),
        ),
        ...(preview ? { textPreview: preview } : {}),
      });
    }
    if (grid.valid && grid.lines) {
      items.forEach((item, itemIndex) => {
        if (isGridIgnored(item)) {
          gridIgnoredCount += 1;
          return;
        }
        // 豁免优先：豁免过的条目不再算进"被块挡住"，两个计数不能重叠。
        if (isMappableItem(item) && isPlacedBlockContent(item)) {
          gridShieldedCount += 1;
          return;
        }
        if (!shouldCheckGrid(item, page)) {
          // 只有可映射条目参与这本账：不可映射的节点从来不是网格检查的对象，
          // 把它们算进 skipped 只会让"跳过"这个数字失去意义。
          if (isMappableItem(item)) gridSkippedCount += 1;
          return;
        }
        gridCheckedCount += 1;
        const edges = offGridEdges(item.boundsMm, grid.lines, gridTolerance, item);
        if (!edges.length) return;
        const itemId = itemIdFor(item, itemIndex);
        const entry = {
          ...message('warning', GRID_ALIGNMENT_OFF, pageId, itemId, gridOffMessage(edges)),
          edges: edges.map((edge) => edge.edge),
          edgeOffsets: edges,
          suggestedFix: gridSuggestedFix(itemId, edges),
        };
        // 观察态对象的坐标来自人做的 INDD，不是 Agent 排的版：降为提示，
        // 仍算"量过"（gridCheckedCount），但不进 gridOffCount，另计 gridObservedDowngradedCount。
        if (downgradeObservedGrid && isObservedReverseObject(item, page)) {
          gridObservedDowngradedCount += 1;
          notices.push({ ...entry, level: 'info', observed: true, downgradedBy: lintProfile });
          return;
        }
        gridOffCount += 1;
        warnings.push(entry);
      });
      // 母元素规则的另一半：块内内容不量，块本身必须有人量。承担放置的祖先节点
      // 多半是无边框的定位包裹层，永远不会成为 item，若不在这里收上来当条目报，
      // 整页网格检查就等于没跑。
      responsibleBlocksFor(items).forEach(({ node, itemIds }) => {
        const bounds = node.boundsMm;
        // 旧快照的祖先节点没有几何：量不出来的块静默跳过，不拿"无法判断"充当错误。
        // 但跳过要留痕，否则"块级覆盖回落到零"和"块全都压住线"在报告里长得一样。
        if (!hasFiniteBounds(bounds)) {
          gridBlockSkippedCount += 1;
          return;
        }
        gridBlockCheckedCount += 1;
        const edges = offGridBlockEdges(bounds, grid.lines, gridTolerance);
        if (!edges.length) return;
        gridOffCount += 1;
        gridBlockOffCount += 1;
        const blockLabel = blockLabelFor(node, bounds);
        warnings.push({
          ...message(
            'warning',
            GRID_ALIGNMENT_OFF,
            pageId,
            node.id || node.sourcePath || blockLabel,
            gridOffMessage(edges),
          ),
          block: true,
          edges: edges.map((entry) => entry.edge),
          edgeOffsets: edges,
          blockOf: itemIds.slice(0, 10),
          blockOfCount: itemIds.length,
          suggestedFix: gridBlockSuggestedFix(blockLabel, edges),
        });
      });
    }

    items.forEach((item, itemIndex) => {
      if (isCompositeTextContainer(item, itemIndex, items)) {
        const itemId = itemIdFor(item, itemIndex);
        errors.push({
          ...message(
          'error',
          TEXT_CONTAINER_HAS_CHILD_OBJECTS,
          pageId,
          itemId,
          `A layout container with child objects cannot use ${HTML_DATA_ID_ATTRIBUTES.ROLE}="${ITEM_ROLE.TEXT}". Use ${HTML_DATA_ID_ATTRIBUTES.ROLE}="${ITEM_ROLE.CONTAINER}" and keep text semantics on the leaf text elements.`,
          ),
          suggestedFix: `Change #${itemId} to ${HTML_DATA_ID_ATTRIBUTES.ROLE}="${ITEM_ROLE.CONTAINER}"; keep ${HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE} on its child text elements.`,
          ...(page && page.sourceFile ? { sourceFile: page.sourceFile } : {}),
        });
      }
      const lineFit = firstLineOverflowIssue(item);
      if (lineFit) {
        const itemId = itemIdFor(item, itemIndex);
        errors.push({
          ...message(
            'error',
            TEXT_FIRST_LINE_CANNOT_FIT,
            pageId,
            itemId,
            `Text line-height (${lineFit.lineHeight}px) exceeds the box inner height (${lineFit.innerHeight}px = ${lineFit.height}px height − ${lineFit.vertical}px vertical padding/border). The browser still paints the line, but InDesign cannot compose it inside the frame inset and the built frame renders empty.`,
          ),
          suggestedFix: `Make #${itemId} tall enough for its text: increase height to ≥ ${lineFit.requiredHeight}px, or reduce vertical padding to ≤ ${lineFit.maxVertical}px total, or lower line-height to ≤ ${lineFit.innerHeight}px. A single-line text with overflow: visible is frame-auto-fitted instead.`,
          ...(page && page.sourceFile ? { sourceFile: page.sourceFile } : {}),
        });
      }
      if (isGraphicWithoutOwnResource(item)) {
        errors.push(message(
          'error',
          GRAPHIC_ASSET_REFERENCE_MISSING,
          pageId,
          itemIdFor(item, itemIndex),
          `Graphic protocol fields must be placed on the resource element itself, with src, data, href or ${HTML_DATA_ID_ATTRIBUTES.ASSET_PATH}.`,
        ));
      }
      if (!isMappableItem(item) || hasStableSemanticToken(item)) return;
      // Materialized pseudo spans are tool output, not authored markup;
      // telling the author to name one is advice they cannot act on.
      if (attributeValue(attributesFor(item), 'data-pseudo-generated') != null) return;
      const itemId = itemIdFor(item, itemIndex);
      const role = String(item && item.role || '').trim().toLowerCase();
      warnings.push({
        ...message('warning', SEMANTIC_TOKEN_MISSING, pageId, itemId, 'A neutral HTML element was understood from its content; add an explicit role when this object must remain stable across edits.'),
        action: 'normalized',
        strictBlocking: false,
        ruleRef: 'semantics/inferred-role',
        suggestedFix: `Add ${HTML_DATA_ID_ATTRIBUTES.ROLE}="${role || ITEM_ROLE.CONTAINER}" to #${itemId}.`,
      });
    });
  });

  // 降级不能不声不响：只要降过一条，就留一条汇总警告（strictBlocking:false，strict 不提升）。
  if (gridObservedDowngradedCount > 0) {
    warnings.push({
      ...message(
        'warning',
        GRID_OBSERVED_DOWNGRADED,
        null,
        null,
        observedGridDowngradeMessage(gridObservedDowngradedCount, lintProfile),
      ),
      strictBlocking: false,
      lintProfile,
      count: gridObservedDowngradedCount,
    });
  }

  const promotedWarnings = options.strict
    ? warnings.filter((entry) => entry.strictBlocking !== false)
    : [];
  const resultWarnings = options.strict
    ? warnings.filter((entry) => entry.strictBlocking === false)
    : warnings;
  const resultErrors = options.strict
    ? errors.concat(promotedWarnings.map((entry) => ({ ...entry, level: 'error' })))
    : errors;
  return {
    valid: resultErrors.length === 0,
    errors: resultErrors,
    warnings: resultWarnings,
    messages: resultErrors.concat(resultWarnings),
    notices,
    lintProfile,
    gridObservedDowngradedCount,
    gridIgnoredCount,
    gridOffCount,
    gridBlockOffCount,
    gridCheckedCount,
    gridShieldedCount,
    gridSkippedCount,
    gridBlockCheckedCount,
    gridBlockSkippedCount,
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
  const semantic = attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.MARGIN);
  if (semantic != null) {
    const margins = boxLengths(semantic, page);
    return {
      present: !!margins,
      margins: margins || zeroMargins(),
    };
  }

  const sideAttrs = {
    top: attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.MARGIN_TOP),
    right: attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.MARGIN_RIGHT),
    bottom: attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.MARGIN_BOTTOM),
    left: attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.MARGIN_LEFT),
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
  const semantic = attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.GRID);
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
      attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER)
        || style.columnGap
        || style.gap,
      page,
      'x'
    );
    const rowGap = lengthToMm(
      attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER)
        || style.rowGap
        || style.gap,
      page,
      'y'
    );
    const baseline = lengthToMm(
      attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.BASELINE),
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
  const raw = attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.SNAP_GRID);
  const rawX = attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.SNAP_GRID_X) || raw;
  const rawY = attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.SNAP_GRID_Y) || raw;
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

// InDesign 的 inset 是排版硬边界：第一行行高排不进内高时整个文本帧 overset 为空，
// 而浏览器裁切边界是 padding 盒，同样的盒子预览完全正常。单行且 overflow: visible
// 的文本会被编译层 textFit 自动扩帧救回，不在此拦截；观察态回读文本同理跳过。
function firstLineOverflowIssue(item) {
  const role = String(item && item.role || '').toLowerCase();
  if (role !== ITEM_ROLE.TEXT) return null;
  const text = String(item && item.text || '');
  if (!text.trim()) return null;
  if (isObservedReverseTextItem(item)) return null;
  const style = item && item.computedStyle || {};
  const rect = item && item.rectPx || {};
  const height = Number(rect.height);
  if (!Number.isFinite(height) || height <= 0) return null;
  const lineHeight = cssPxNumber(style.lineHeight) || round(cssPxNumber(style.fontSize) * 1.2, 2);
  if (!lineHeight) return null;
  const vertical = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
    .reduce((sum, prop) => sum + cssPxNumber(style[prop]), 0);
  const innerHeight = round(height - vertical, 2);
  if (innerHeight + 0.5 >= lineHeight) return null;
  const singleLine = !/\r|\n/.test(text);
  if (singleLine && String(style.overflow || '').toLowerCase() === 'visible') return null;
  return {
    lineHeight,
    innerHeight,
    height: round(height, 2),
    vertical: round(vertical, 2),
    requiredHeight: round(lineHeight + vertical, 2),
    maxVertical: round(height - lineHeight, 2),
  };
}

function cssPxNumber(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return 0;
  if (parsed.unit === 'pt') return round(parsed.value * 96 / 72, 4);
  if (parsed.unit === 'mm') return round(parsed.value * 96 / 25.4, 4);
  return round(parsed.value, 4);
}

function isObservedReverseTextItem(item) {
  const classList = Array.isArray(item && item.classList) ? item.classList : [];
  if (classList.includes('observed-text')) return true;
  const attrs = attributesFor(item);
  return attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.OBSERVED) === 'true'
    || attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE) === 'observation';
}

// lintProfile reverse-export 的观察态判定只认对象自身的证据，不因页面带观察标记就整页放行：
// Agent 在观察页上新增或改写的对象照常量网格。
//   1. 对象自身：observed-text 类、data-id-observed="true"、data-id-reverse-mode="observation"；
//   2. 对象带 data-id-observed-label-status（标签复核未通过、降级为观察标签）；
//   3. 页面是 observation 模式导出的，且对象带反向写出器给每个观察对象加的 id-object 类。
function isObservedReverseObject(item, page) {
  if (isObservedReverseTextItem(item)) return true;
  const attrs = attributesFor(item);
  if (attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.OBSERVED_LABEL_STATUS) != null) return true;
  const classList = Array.isArray(item && item.classList) ? item.classList : [];
  return classList.includes('id-object') && isObservationPage(page);
}

function isObservationPage(page) {
  const attrs = attributesFor(page);
  return attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.OBSERVED) === 'true'
    || attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE) === 'observation';
}

function observedGridDowngradeMessage(count, lintProfile) {
  return `lintProfile ${lintProfile}: grid checks for ${count} observed object(s) were downgraded — their GRID_ALIGNMENT_OFF `
    + 'is reported as info in notices[], not counted as warnings or errors, and not promoted by strict. '
    + 'Objects without observed markers (added or rewritten by the author) are still checked.';
}

function isGraphicWithoutOwnResource(item) {
  const attrs = attributesFor(item);
  const role = String(item && item.role || attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.ROLE) || '').trim().toLowerCase();
  if (role !== ITEM_ROLE.GRAPHIC) return false;
  return ![
    attributeValue(attrs, 'src'),
    attributeValue(attrs, 'data'),
    attributeValue(attrs, 'href'),
    attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.ASSET_PATH),
  ].some((value) => value != null && String(value).trim() !== '');
}

function isCompositeTextContainer(item, itemIndex, items) {
  const attrs = attributesFor(item);
  if (String(attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.ROLE) || '').trim().toLowerCase() !== ITEM_ROLE.TEXT) return false;
  const tagName = String(item && item.tagName || '').trim().toLowerCase();
  if (!['div', 'section', 'article', 'aside', 'figure', 'header', 'footer', 'main', 'nav'].includes(tagName)) return false;
  const candidateIndex = Number.isInteger(item && item.candidateIndex) ? item.candidateIndex : itemIndex;
  return (items || []).some((child) => child !== item
    && Array.isArray(child && child.ancestorCandidateIndexes)
    && child.ancestorCandidateIndexes.includes(candidateIndex));
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
  if (isGridIgnored(item)) return false;
  if (isPlacedBlockContent(item)) return false;
  if (attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.ROLE) === ITEM_ROLE.ANNOTATION) return false;
  if (Array.isArray(item && item.ancestorCandidateIndexes) && item.ancestorCandidateIndexes.length) return false;
  if (attributeValue(attrs, HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE) === 'folio') return false;
  // Text furniture laid out by a flex parent (auto width, no own grid
  // placement) cannot be aligned to the page grid by the author; checking
  // any edge only produces noise. Promoted orphan spans land here too.
  if (String(item && item.role || '').toLowerCase() === ITEM_ROLE.TEXT
    && item.inFlexFlow === true
    && !hasDeclaredWidth(item)) return false;
  const bounds = item && item.boundsMm;
  return hasFiniteBounds(bounds) && !coversWholePage(bounds, page);
}

function hasInheritedGridIgnore(item) {
  return Array.isArray(item && item.sourceAncestorNodes)
    && item.sourceAncestorNodes.some((ancestor) => (
      attributeValue(attributesFor(ancestor), HTML_DATA_ID_ATTRIBUTES.GRID_IGNORE) != null
    ));
}

function isGridIgnored(item) {
  if (!isMappableItem(item)) return false;
  return attributeValue(attributesFor(item), HTML_DATA_ID_ATTRIBUTES.GRID_IGNORE) != null
    || hasInheritedGridIgnore(item);
}

// Grid alignment is the placed block's responsibility: an element inside an
// ancestor that carries grid placement (a card, a column, a header band) is
// that block's content, and its own edges sit wherever the block's padding
// puts them. Mappable ancestors are already excluded via ancestorCandidateIndexes;
// this covers the borderless wrappers that only exist for positioning.
function isPlacedBlockContent(item) {
  return Array.isArray(item && item.sourceAncestorNodes)
    && item.sourceAncestorNodes.some(isGridPlacedNode);
}

function isGridPlacedNode(node) {
  if (!node) return false;
  if (node.gridPlaced === true) return true;
  if (Array.isArray(node.classList) && node.classList.includes('grid-item')) return true;
  const style = String(attributeValue(attributesFor(node), 'style') || '');
  return /--grid-(?:col|row)\s*:/.test(style);
}

// 责任块：从最外层祖先往里走。撞上 data-id-grid-ignore 就整棵子树退出（该条目
// 已由 isGridIgnored 计入豁免）；第一个承担放置的节点就是责任块，放置块里的
// 放置块只是外层块的内容，跟着外层块走。
function responsibleBlockFor(item) {
  const nodes = Array.isArray(item && item.sourceAncestorNodes) ? item.sourceAncestorNodes : [];
  for (const node of nodes) {
    if (attributeValue(attributesFor(node), HTML_DATA_ID_ATTRIBUTES.GRID_IGNORE) != null) return null;
    if (isGridPlacedNode(node)) return node;
  }
  return null;
}

// 同一个块会被它内部每个条目各指认一次，按 sourcePath 去重，并记住块内条目的
// id：报告要能从块指回作者看得见的内容。
// 决策：块内只有 data-id-role="annotation" 或 folio 段落时，这个块照样要量。
// 免检的是"条目自己的边缘"（注解与页码的位置由排版惯例决定，作者不逐条对齐），
// 而块是作者亲手放上网格的东西，它压不住线仍然是作者能改、也该改的偏差。
function responsibleBlocksFor(items) {
  const blocks = new Map();
  items.forEach((item, itemIndex) => {
    if (!isMappableItem(item)) return;
    if (isGridIgnored(item)) return;
    const node = responsibleBlockFor(item);
    if (!node) return;
    const key = blockKeyFor(node);
    const existing = blocks.get(key);
    if (existing) {
      existing.itemIds.push(itemIdFor(item, itemIndex));
      return;
    }
    blocks.set(key, { node, itemIds: [itemIdFor(item, itemIndex)] });
  });
  return Array.from(blocks.values());
}

function blockKeyFor(node) {
  // 兜底键要带上 tagName：两个都没 id/sourcePath 的包裹层可能占同一块几何
  // （一个套着另一个），只按 boundsMm 去重会把它们并成一条。
  return node.sourcePath
    || node.id
    || `${node.tagName || ''}|${JSON.stringify(node.boundsMm || null)}`;
}

// 块的作者可见名字：id 最准，其次是选择器路径，两者都没有就用标签加几何坐标。
// 直接拼 `#${node.id || node.sourcePath}` 会在两者皆空时给出 "#undefined"。
function blockLabelFor(node, bounds) {
  if (node && node.id) return `#${node.id}`;
  if (node && node.sourcePath) return String(node.sourcePath);
  const box = bounds || {};
  return `${(node && node.tagName) || 'block'}@${box.x},${box.y}mm`;
}

function offGridEdges(bounds, lines, tolerance, item) {
  const vertical = lines && Array.isArray(lines.vertical) ? lines.vertical : [];
  const horizontal = lines && Array.isArray(lines.horizontal) ? lines.horizontal : [];
  return offGridEntries(gridEdgesForItem(bounds, vertical, horizontal, item), tolerance);
}

// 承担放置的块只查 left/top/right：块的高度随内容长，底边落在哪根线上不由作者
// 决定，与 data-id-role="container" 免检底边同理。
function offGridBlockEdges(bounds, lines, tolerance) {
  const vertical = lines && Array.isArray(lines.vertical) ? lines.vertical : [];
  const horizontal = lines && Array.isArray(lines.horizontal) ? lines.horizontal : [];
  return offGridEntries([
    ['left', Number(bounds.x), vertical],
    ['top', Number(bounds.y), horizontal],
    ['right', Number(bounds.x) + Number(bounds.width), vertical],
  ], tolerance);
}

function offGridEntries(edges, tolerance) {
  return edges
    .map(([edge, value, candidates]) => {
      const nearest = nearestLine(value, candidates);
      return {
        edge,
        valueMm: round(Number(value), 2),
        nearestLineMm: nearest,
        offsetMm: nearest == null ? null : round(Number(value) - nearest, 2),
      };
    })
    .filter((entry) => entry.nearestLineMm == null || Math.abs(entry.offsetMm) > tolerance);
}

function hasFiniteBounds(bounds) {
  return Boolean(bounds)
    && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(Number(bounds[key])));
}

function nearestLine(value, lines) {
  let best = null;
  for (const line of lines || []) {
    const candidate = Number(line);
    if (!Number.isFinite(candidate)) continue;
    if (best == null || Math.abs(Number(value) - candidate) < Math.abs(Number(value) - best)) best = candidate;
  }
  return best;
}

function gridOffMessage(edges) {
  return `Item edges do not align to the declared authoring grid: ${edges.map(describeEdgeOffset).join('; ')}.`;
}

function describeEdgeOffset(entry) {
  if (entry.nearestLineMm == null) return `${entry.edge} at ${entry.valueMm}mm has no grid line to align to`;
  const axis = entry.edge === 'left' || entry.edge === 'right' ? 'column' : 'row';
  const direction = entry.offsetMm > 0
    ? (axis === 'column' ? 'right of' : 'below')
    : (axis === 'column' ? 'left of' : 'above');
  return `${entry.edge} at ${entry.valueMm}mm is ${Math.abs(entry.offsetMm)}mm ${direction} the ${axis} line at ${entry.nearestLineMm}mm`;
}

function gridSuggestedFix(itemId, edges) {
  const moves = edgeMoves(edges);
  if (!moves.length) {
    return `Give #${itemId} a grid placement (--grid-col/--grid-row) or mark it ${HTML_DATA_ID_ATTRIBUTES.GRID_IGNORE} if it is meant to leave the grid.`;
  }
  return `Move #${itemId} ${moves.join(', ')}, or place it with --grid-col/--grid-row so the block itself sits on the grid; `
    + 'content inside a placed block is not checked.';
}

// 块级修法不能照抄条目版：块被报出来正是因为它已经带着网格放置，"再放一次"是
// 自相矛盾的建议。成因清单也要说准：padding 推不动一个 border-box 的左/上边缘，
// 写进去只是让作者去改一个不可能是成因的属性。真正只有两类——块自己的 margin /
// transform，或者声明的网格（data-id-grid / 间距）与它实际被放置的那套 CSS grid
// 不一致（这一类才是整块整块偏的成因，改单个块反而是白改）。
function gridBlockSuggestedFix(blockLabel, edges) {
  const moves = edgeMoves(edges);
  const cause = 'this block already carries a grid placement, so the offset comes from its own '
    + `margin or transform, or from the declared grid (${HTML_DATA_ID_ATTRIBUTES.GRID} / gutters) `
    + 'not matching the CSS grid it is placed on; fix that, or mark the block '
    + `${HTML_DATA_ID_ATTRIBUTES.GRID_IGNORE} if it is meant to leave the grid.`;
  if (!moves.length) return `Realign ${blockLabel}; ${cause}`;
  return `Move ${blockLabel} ${moves.join(', ')}; ${cause}`;
}

function edgeMoves(edges) {
  return edges
    .filter((entry) => entry.nearestLineMm != null)
    .map((entry) => `${entry.edge} edge to ${entry.nearestLineMm}mm (${entry.offsetMm > 0 ? '-' : '+'}${Math.abs(entry.offsetMm)}mm)`);
}

function gridEdgesForItem(bounds, vertical, horizontal, item) {
  const role = String(item && item.role || '').toLowerCase();
  const authoredRole = String(attributeValue(attributesFor(item), HTML_DATA_ID_ATTRIBUTES.ROLE) || '').trim().toLowerCase();
  const edges = [
    ['left', Number(bounds.x), vertical],
    ['top', Number(bounds.y), horizontal],
  ];
  // Auto-width text frames (no authored width or grid span) size to their
  // content; their right edge cannot land on a grid line by construction,
  // mirroring the existing bottom-edge exemption for content-grown text.
  if (role !== ITEM_ROLE.TEXT || hasDeclaredWidth(item)) {
    edges.push(['right', Number(bounds.x) + Number(bounds.width), vertical]);
  }
  if (role !== ITEM_ROLE.TEXT && role !== ITEM_ROLE.TABLE && authoredRole !== ITEM_ROLE.CONTAINER) {
    edges.push(['bottom', Number(bounds.y) + Number(bounds.height), horizontal]);
  }
  return edges;
}

function hasDeclaredWidth(item) {
  const authored = item && item.authoredStyle || {};
  const declared = [authored.width, authored.minWidth, authored.gridColumn, authored.gridArea, authored.flexBasis]
    .some((value) => value != null && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'auto');
  if (declared) return true;
  const cssVars = item && item.cssVars || {};
  return ['--grid-col', '--grid-span'].some((name) => cssVars[name] != null && String(cssVars[name]).trim() !== '');
}

function coversWholePage(bounds, page) {
  if (!page) return false;
  return Math.abs(Number(bounds.x || 0)) < 0.01
    && Math.abs(Number(bounds.y || 0)) < 0.01
    && Math.abs(Number(bounds.width || 0) - pageWidth(page)) < 0.01
    && Math.abs(Number(bounds.height || 0) - pageHeight(page)) < 0.01;
}

function isMappableItem(item) {
  const role = String(item && item.role || '').toLowerCase();
  if (isAuthoringMappableItemRole(role)) return true;
  const tagName = String(item && item.tagName || '').toLowerCase();
  return [
    'article', 'aside', 'blockquote', 'canvas', 'caption', 'div', 'figure', 'figcaption',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'object', 'ol', 'p',
    'picture', 'section', 'span', 'svg', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'tr', 'ul',
  ].includes(tagName);
}

function hasStableSemanticToken(item) {
  const tagName = String(item && item.tagName || '').trim().toLowerCase();
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption', 'table'].includes(tagName)) {
    return true;
  }
  if (Array.isArray(item && item.classList) && item.classList.some((name) => String(name || '').trim())) {
    return true;
  }
  const attrs = attributesFor(item);
  return [
    HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE,
    HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE,
    HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE,
    HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE,
    HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE,
    HTML_DATA_ID_ATTRIBUTES.CELL_STYLE,
    HTML_DATA_ID_ATTRIBUTES.ASSET_KIND,
    HTML_DATA_ID_ATTRIBUTES.OBJECT,
    HTML_DATA_ID_ATTRIBUTES.ROLE,
    HTML_DATA_ID_ATTRIBUTES.SEMANTIC,
    HTML_DATA_ID_ATTRIBUTES.LAYER,
    HTML_DATA_ID_ATTRIBUTES.PLACEMENT,
    HTML_DATA_ID_ATTRIBUTES.FIT,
    HTML_DATA_ID_ATTRIBUTES.PDF_PAGE,
    HTML_DATA_ID_ATTRIBUTES.ARTBOARD,
  ].some((name) => {
    const value = attributeValue(attrs, name);
    return value != null && String(value).trim() !== '';
  });
}

module.exports = {
  validateAuthoringRules,
  resolveAuthoringLintProfile,
  AUTHORING_LINT_PROFILE,
  AUTHORING_LINT_PROFILE_NAMES,
  AUTHORING_MAPPABLE_ITEM_ROLE_VALUES,
  DEFAULT_AUTHORING_LINT_PROFILE,
  GRID_OBSERVED_DOWNGRADED,
};
