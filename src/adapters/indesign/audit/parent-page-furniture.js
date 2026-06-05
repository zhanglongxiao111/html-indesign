const DEFAULT_OPTIONS = Object.freeze({
  minRepeatPages: 2,
  minRepeatPageRatio: 0.08,
  positionPrecision: 1,
  lineMaxThickness: 3,
  pageBandRatio: 0.18,
});

function auditParentPageFurniture(sourceSnapshot, actualSnapshot, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const source = sourceSnapshot || {};
  const actual = actualSnapshot || {};
  const candidates = sourceFurnitureCandidates(source, opts);
  const actualParentItems = parentFurnitureItems(actual, opts);
  const actualPageItems = pageFurnitureItems(actual, opts);

  const promoted = matchCandidatesToParentItems(candidates, actualParentItems);
  const promotedKeys = new Set(promoted.map((match) => match.candidateKey));
  const missed = candidates.filter((candidate) => !promotedKeys.has(candidate.key));
  const falsePromotions = actualParentItems
    .filter((item) => item.classification === 'content-like')
    .map((item) => falsePromotionSummary(item));
  const pageResidue = pageResidueForCandidates(candidates, actualPageItems);

  return {
    kind: 'ParentPageFurnitureAudit',
    version: 1,
    thresholds: {
      minRepeatPages: opts.minRepeatPages,
      minRepeatPageRatio: opts.minRepeatPageRatio,
      positionPrecision: opts.positionPrecision,
      lineMaxThickness: opts.lineMaxThickness,
      pageBandRatio: opts.pageBandRatio,
    },
    summary: {
      sourcePages: pageCount(source),
      actualPages: pageCount(actual),
      sourceCandidateCount: candidates.length,
      promotedCount: promoted.length,
      missedCount: missed.length,
      falsePromotionCount: falsePromotions.length,
      actualParentPageCount: (actual.parentPages || []).length,
      actualParentPageItemCount: actualParentItems.length,
      actualPageFurnitureResidueCount: pageResidue.length,
    },
    metrics: metricsFor({
      candidates,
      promoted,
      falsePromotions,
      actualParentItems,
      pageResidue,
      actualPages: pageCount(actual),
    }),
    candidates,
    promoted,
    missed,
    falsePromotions,
    pageResidue,
    stability: parentPageStability(actual, options.secondPassSnapshot, opts),
  };
}

function sourceFurnitureCandidates(snapshot, options) {
  const byKey = new Map();
  for (const item of parentFurnitureItems(snapshot, options)) {
    if (item.classification === 'content-like') continue;
    addCandidate(byKey, {
      key: item.key,
      kind: item.classification,
      sourceScope: 'parentPage',
      sources: [sourceRef(item)],
      signature: item.signature,
      sample: item.sample,
    });
  }

  const groups = new Map();
  for (const item of pageFurnitureItems(snapshot, options)) {
    if (item.classification === 'content-like') continue;
    if (!groups.has(item.key)) {
      groups.set(item.key, {
        key: item.key,
        kind: item.classification,
        sourceScope: 'page-repeat',
        pageIds: new Set(),
        sources: [],
        signature: item.signature,
        sample: item.sample,
      });
    }
    const group = groups.get(item.key);
    group.pageIds.add(item.pageId);
    group.sources.push(sourceRef(item));
  }

  const repeatThreshold = repeatPageThreshold(snapshot, options);
  for (const group of groups.values()) {
    if (group.pageIds.size < repeatThreshold) continue;
    addCandidate(byKey, {
      key: group.key,
      kind: group.kind,
      sourceScope: group.sourceScope,
      repeatedPages: group.pageIds.size,
      pageIds: Array.from(group.pageIds).sort(compareStringNumbers),
      sources: group.sources,
      signature: group.signature,
      sample: group.sample,
    });
  }

  for (const guide of guideCandidates(snapshot, options)) addCandidate(byKey, guide);
  return Array.from(byKey.values()).sort(compareCandidates);
}

function addCandidate(byKey, candidate) {
  const existing = byKey.get(candidate.key);
  if (!existing) {
    byKey.set(candidate.key, normalizeCandidate(candidate));
    return;
  }
  existing.sourceScope = mergeScope(existing.sourceScope, candidate.sourceScope);
  existing.sources.push(...(candidate.sources || []));
  if (candidate.pageIds) {
    const pages = new Set([...(existing.pageIds || []), ...candidate.pageIds]);
    existing.pageIds = Array.from(pages).sort(compareStringNumbers);
    existing.repeatedPages = existing.pageIds.length;
  }
}

function normalizeCandidate(candidate) {
  return {
    key: candidate.key,
    kind: candidate.kind,
    sourceScope: candidate.sourceScope,
    repeatedPages: candidate.repeatedPages || null,
    pageIds: candidate.pageIds || [],
    sources: candidate.sources || [],
    signature: candidate.signature,
    sample: candidate.sample,
  };
}

function mergeScope(left, right) {
  if (left === right) return left;
  if (left === 'parentPage' || right === 'parentPage') return 'parentPage+page-repeat';
  if (left === 'guide' || right === 'guide') return 'guide';
  return `${left}+${right}`;
}

function parentFurnitureItems(snapshot, options) {
  const out = [];
  for (const parentPage of snapshot.parentPages || []) {
    for (const item of itemList(parentPage)) {
      const normalized = normalizeFurnitureItem(item, {
        page: parentPage,
        pageId: parentPage.id || parentPage.name || null,
        parentPageName: parentPage.name || null,
        sourceScope: 'parentPage',
      }, options);
      out.push(normalized);
    }
  }
  return out;
}

function pageFurnitureItems(snapshot, options) {
  const out = [];
  for (const page of snapshot.pages || []) {
    for (const item of itemList(page)) {
      out.push(normalizeFurnitureItem(item, {
        page,
        pageId: page.id || page.name || String(page.index || ''),
        parentPageName: null,
        sourceScope: 'page',
      }, options));
    }
  }
  return out;
}

function normalizeFurnitureItem(item, context, options) {
  const classification = classifyItem(item, context.page, options, context.sourceScope);
  const signature = itemSignature(item, classification, context.page, options);
  return {
    key: signature.key,
    itemId: item && item.id != null ? String(item.id) : null,
    pageId: context.pageId,
    parentPageName: context.parentPageName,
    sourceScope: context.sourceScope,
    classification,
    signature,
    sample: sampleForItem(item),
  };
}

function classifyItem(item, page, options, sourceScope) {
  if (!item || item.visible === false || item.printable === false || item.nonprinting === true) return 'content-like';
  if (!intersectsPage(item.bounds, page && page.bounds)) return 'content-like';
  if (isFolioItem(item)) return 'folio';
  if (isDecorativeRule(item, options)) return 'decorative-rule';
  if (isRepeatedBackground(item, page)) return 'repeated-background';
  if (isHeaderFooterText(item, page, options, sourceScope)) return 'header-footer-text';
  return 'content-like';
}

function isFolioItem(item) {
  const labelText = labelSummary(item).toLowerCase();
  const styleText = `${item.objectStyleName || ''} ${item.paragraphStyleName || ''}`.toLowerCase();
  if (/(^|[-_\s])folio($|[-_\s])|page-number|页码/.test(`${labelText} ${styleText}`)) return true;
  const text = normalizeText(item.text).trim();
  return text.length > 0 && /^(?:\d{1,4}|[ivxlcdm]{1,8})$/i.test(text);
}

function isDecorativeRule(item, options) {
  if (item.placedAsset) return false;
  if (normalizeText(item.text).trim()) return false;
  const styleText = `${item.objectStyleName || ''} ${labelSummary(item)}`.toLowerCase();
  if (/装饰|decor|rule|divider|header-line|footer-line/.test(styleText)) return true;
  if (!hasStroke(item)) return false;
  return isLineLike(item.bounds, options.lineMaxThickness)
    || String(item.type || '') === 'GraphicLine'
    || (item.vectorGeometry && item.vectorGeometry.kind === 'line');
}

function isRepeatedBackground(item, page) {
  if (normalizeText(item.text).trim()) return false;
  const styleText = `${item.id || ''} ${item.objectStyleName || ''} ${labelSummary(item)}`.toLowerCase();
  if (/background|背景/.test(styleText)) return true;
  if (!hasFill(item) || item.placedAsset) return false;
  const pageArea = area(page && page.bounds || {});
  return pageArea > 0 && area(item.bounds || {}) / pageArea >= 0.72;
}

function isHeaderFooterText(item, page, options, sourceScope) {
  const text = normalizeText(item.text).trim();
  if (!text || text.length > 120) return false;
  if (item.placedAsset) return false;
  const styleText = `${item.objectStyleName || ''} ${item.paragraphStyleName || ''} ${labelSummary(item)}`.toLowerCase();
  if (/header|footer|页眉|页脚|章节|chapter/.test(styleText)) return true;
  if (sourceScope === 'parentPage') return false;
  return inPageBand(item.bounds, page && page.bounds, options.pageBandRatio)
    && isSmallPageFurnitureText(item.bounds, page && page.bounds);
}

function itemSignature(item, classification, page, options) {
  if (classification === 'content-like') {
    return {
      key: `content:${rawItemIdentity(item)}`,
      kind: classification,
    };
  }
  const bounds = normalizedBounds(item.bounds, options.positionPrecision);
  const base = [
    classification,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  ];
  if (classification === 'header-footer-text') base.push(compactText(item.text));
  if (classification === 'repeated-background') base.push(assetPath(item) || colorSignature(item));
  if (classification === 'decorative-rule') base.push(strokeSignature(item));
  return {
    key: base.map((part) => String(part).replace(/[|#]/g, '-')).join('|'),
    kind: classification,
    bounds,
    pageSize: normalizedBounds(page && page.bounds, options.positionPrecision),
    style: styleSignature(item),
  };
}

function guideCandidates(snapshot, options) {
  const groups = new Map();
  for (const page of snapshot.pages || []) {
    for (const guide of page.guides || []) {
      if (!isNormativeGuide(guide)) continue;
      const key = guideKey(guide, options);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          kind: 'guide',
          sourceScope: 'guide',
          pageIds: new Set(),
          sources: [],
          signature: guideSignature(guide, options),
          sample: {
            orientation: guide.orientation || guide.axis || null,
            position: round(guide.position, options.positionPrecision),
            source: guide.source || null,
          },
        });
      }
      const group = groups.get(key);
      group.pageIds.add(page.id || String(page.index || ''));
      group.sources.push({ pageId: page.id || String(page.index || ''), guideId: guide.id || null });
    }
  }

  const repeatThreshold = repeatPageThreshold(snapshot, options);
  return Array.from(groups.values())
    .filter((group) => group.pageIds.size >= repeatThreshold)
    .map((group) => normalizeCandidate({
      ...group,
      repeatedPages: group.pageIds.size,
      pageIds: Array.from(group.pageIds).sort(compareStringNumbers),
    }));
}

function isNormativeGuide(guide) {
  const source = String(guide && guide.source || '').trim();
  if (!source) return false;
  return ['grid', 'margin', 'baseline-grid', 'page-grid'].includes(source);
}

function guideSignature(guide, options) {
  return {
    orientation: guide.orientation || guide.axis || null,
    position: round(guide.position, options.positionPrecision),
    source: guide.source || null,
  };
}

function guideKey(guide, options) {
  const signature = guideSignature(guide, options);
  return `guide|${signature.orientation}|${signature.position}|${signature.source || ''}`;
}

function matchCandidatesToParentItems(candidates, parentItems) {
  const available = new Map();
  for (const item of parentItems) {
    if (item.classification === 'content-like') continue;
    const list = available.get(item.key) || [];
    list.push(item);
    available.set(item.key, list);
  }

  const matches = [];
  for (const candidate of candidates) {
    const list = available.get(candidate.key) || [];
    const match = list.shift();
    if (!match) continue;
    matches.push({
      candidateKey: candidate.key,
      kind: candidate.kind,
      actualItemId: match.itemId,
      actualParentPageName: match.parentPageName,
      score: 1,
    });
  }
  return matches;
}

function pageResidueForCandidates(candidates, pageItems) {
  const candidateKeys = new Set(candidates.map((candidate) => candidate.key));
  return pageItems
    .filter((item) => candidateKeys.has(item.key))
    .map((item) => ({
      candidateKey: item.key,
      kind: item.classification,
      pageId: item.pageId,
      itemId: item.itemId,
    }));
}

function metricsFor({ candidates, promoted, falsePromotions, actualParentItems, pageResidue, actualPages }) {
  const candidateCount = candidates.length;
  const parentItemCount = actualParentItems.length;
  const residueDenominator = candidateCount * Math.max(1, actualPages || 0);
  return {
    promotionRate: ratio(promoted.length, candidateCount),
    falsePromotionRate: ratio(falsePromotions.length, parentItemCount),
    pageFurnitureResidueRate: Math.min(1, ratio(pageResidue.length, residueDenominator)),
  };
}

function parentPageStability(actualSnapshot, secondPassSnapshot, options) {
  if (!secondPassSnapshot) {
    return {
      available: false,
      stable: null,
      parentPageItemDelta: null,
      duplicateParentFurnitureCount: null,
    };
  }
  const firstKeys = parentFurnitureItems(actualSnapshot || {}, options)
    .filter((item) => item.classification !== 'content-like')
    .map((item) => item.key);
  const secondKeys = parentFurnitureItems(secondPassSnapshot || {}, options)
    .filter((item) => item.classification !== 'content-like')
    .map((item) => item.key);
  const firstCounts = countKeys(firstKeys);
  const secondCounts = countKeys(secondKeys);
  const duplicateParentFurnitureCount = Array.from(secondCounts.entries()).reduce((total, [key, count]) => {
    const firstCount = firstCounts.get(key) || 0;
    return total + Math.max(0, count - firstCount);
  }, 0);
  return {
    available: true,
    stable: duplicateParentFurnitureCount === 0 && firstKeys.length === secondKeys.length,
    parentPageItemDelta: secondKeys.length - firstKeys.length,
    duplicateParentFurnitureCount,
  };
}

function falsePromotionSummary(item) {
  return {
    kind: 'content-like',
    actualItemId: item.itemId,
    actualParentPageName: item.parentPageName,
    sample: item.sample,
  };
}

function sourceRef(item) {
  return {
    scope: item.sourceScope,
    pageId: item.pageId || null,
    parentPageName: item.parentPageName || null,
    itemId: item.itemId || null,
  };
}

function sampleForItem(item) {
  return {
    id: item && item.id != null ? String(item.id) : null,
    type: item && item.type || null,
    text: compactText(item && item.text || ''),
    bounds: normalizedBounds(item && item.bounds, 2),
    objectStyleName: item && item.objectStyleName || null,
    paragraphStyleName: item && item.paragraphStyleName || null,
    assetPath: assetPath(item),
  };
}

function itemList(container) {
  if (Array.isArray(container.auditItems) && container.auditItems.length) return container.auditItems;
  return container.items || [];
}

function firstLabel(item) {
  return (item && item.labels || []).find((label) => label && label.kind === 'item') || null;
}

function labelSummary(item) {
  const label = firstLabel(item);
  if (!label) return '';
  return [
    label.id,
    label.role,
    label.semantic,
    label.className,
    label.scope,
  ].filter(Boolean).join(' ');
}

function rawItemIdentity(item) {
  if (!item) return 'unknown';
  const label = firstLabel(item);
  if (label && label.id) return String(label.id);
  if (item.id != null) return String(item.id);
  return JSON.stringify(normalizedBounds(item.bounds, 1));
}

function hasStroke(item) {
  const visual = item && item.visualStyle || {};
  return Boolean(visual.strokeColor) && Number(visual.strokeWeight || 0) > 0;
}

function hasFill(item) {
  const visual = item && item.visualStyle || {};
  return Boolean(visual.fillColor);
}

function isLineLike(bounds, maxThickness) {
  const width = Math.abs(Number(bounds && bounds.width || 0));
  const height = Math.abs(Number(bounds && bounds.height || 0));
  return (width > 8 && height <= maxThickness) || (height > 8 && width <= maxThickness);
}

function inPageBand(bounds, pageBounds, ratioValue) {
  const pageHeight = Number(pageBounds && pageBounds.height || 0);
  if (!pageHeight) return false;
  const y = Number(bounds && bounds.y || 0);
  const bottom = y + Number(bounds && bounds.height || 0);
  return y <= pageHeight * ratioValue || bottom >= pageHeight * (1 - ratioValue);
}

function isSmallPageFurnitureText(bounds, pageBounds) {
  const pageHeight = Number(pageBounds && pageBounds.height || 0);
  if (!pageHeight) return true;
  return Number(bounds && bounds.height || 0) <= pageHeight * 0.18;
}

function intersectsPage(bounds, pageBounds) {
  if (!pageBounds || !Number(pageBounds.width) || !Number(pageBounds.height)) return true;
  const itemLeft = Number(bounds && bounds.x || 0);
  const itemTop = Number(bounds && bounds.y || 0);
  const itemRight = itemLeft + Math.max(0, Number(bounds && bounds.width || 0));
  const itemBottom = itemTop + Math.max(0, Number(bounds && bounds.height || 0));
  const pageLeft = Number(pageBounds.x || 0);
  const pageTop = Number(pageBounds.y || 0);
  const pageRight = pageLeft + Number(pageBounds.width || 0);
  const pageBottom = pageTop + Number(pageBounds.height || 0);
  return Math.max(itemLeft, pageLeft) <= Math.min(itemRight, pageRight)
    && Math.max(itemTop, pageTop) <= Math.min(itemBottom, pageBottom);
}

function normalizedBounds(bounds, precision) {
  return {
    x: round(bounds && bounds.x, precision),
    y: round(bounds && bounds.y, precision),
    width: round(bounds && bounds.width, precision),
    height: round(bounds && bounds.height, precision),
  };
}

function styleSignature(item) {
  return {
    objectStyleName: item && item.objectStyleName || null,
    paragraphStyleName: item && item.paragraphStyleName || null,
    stroke: strokeSignature(item),
    fill: colorSignature(item),
  };
}

function strokeSignature(item) {
  const visual = item && item.visualStyle || {};
  return [
    colorValue(visual.strokeColor),
    round(visual.strokeWeight, 2),
    visual.strokeStyle || '',
  ].join('/');
}

function colorSignature(item) {
  const visual = item && item.visualStyle || {};
  return colorValue(visual.fillColor);
}

function colorValue(value) {
  return value == null ? '' : String(value).toLowerCase();
}

function assetPath(item) {
  return item && item.placedAsset && item.placedAsset.path ? String(item.placedAsset.path) : null;
}

function compactText(value) {
  const text = normalizeText(value).replace(/\s+/g, ' ').trim();
  if (text.length <= 80) return text;
  return `${text.slice(0, 40)}...${text.slice(-20)}`;
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n|\r/g, '\n');
}

function repeatPageThreshold(snapshot, options) {
  const pages = pageCount(snapshot);
  return Math.max(options.minRepeatPages, Math.ceil(pages * options.minRepeatPageRatio));
}

function pageCount(snapshot) {
  return (snapshot.pages || []).length;
}

function area(bounds) {
  return Math.max(0, Number(bounds.width || 0)) * Math.max(0, Number(bounds.height || 0));
}

function countKeys(keys) {
  const counts = new Map();
  for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function round(value, precision = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
}

function compareCandidates(left, right) {
  return left.kind.localeCompare(right.kind) || left.key.localeCompare(right.key);
}

function compareStringNumbers(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

module.exports = {
  auditParentPageFurniture,
  sourceFurnitureCandidates,
};
