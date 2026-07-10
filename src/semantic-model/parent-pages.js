const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');

const PARENT_PAGE_PASTEBOARD_PLACEMENT = 'parent-page-pasteboard';

function isParentPagePasteboardItem(item) {
  const placement = item && item.placement
    || item && item.sourceNode && item.sourceNode.attributes
      && item.sourceNode.attributes[HTML_DATA_ID_ATTRIBUTES.PLACEMENT]
    || item && item.attributes && item.attributes[HTML_DATA_ID_ATTRIBUTES.PLACEMENT];
  return String(placement || '').trim() === PARENT_PAGE_PASTEBOARD_PLACEMENT;
}

function filterEffectiveParentPages(parentPages = [], pages = [], hasEffectiveContent = defaultHasContent) {
  const parentPageLookup = parentPageLookupFor(parentPages);
  const usage = expandParentPageUsage(parentPageUsageFor(pages), parentPageLookup);
  return (parentPages || []).filter((parentPage) => (
    parentPageIsApplied(parentPage, usage)
      && parentPageHasEffectiveContent(parentPage, parentPageLookup, hasEffectiveContent)
  ));
}

function parentPageUsageFor(pages = []) {
  const usage = new Set();
  for (const page of pages || []) {
    for (const key of pageParentPageKeys(page)) usage.add(key);
  }
  return usage;
}

function parentPageKeySet(parentPages = []) {
  const out = new Set();
  for (const parentPage of parentPages || []) {
    for (const key of parentPageKeys(parentPage)) out.add(key);
  }
  return out;
}

function parentPageLookupFor(parentPages = []) {
  const out = new Map();
  for (const parentPage of parentPages || []) {
    for (const key of parentPageKeys(parentPage)) {
      if (!out.has(key)) out.set(key, parentPage);
    }
  }
  return out;
}

function expandParentPageUsage(seedUsage, parentPageLookup) {
  const usage = new Set(seedUsage || []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(usage)) {
      const parentPage = parentPageLookup.get(key);
      if (!parentPage) continue;
      for (const parentKey of parentPageParentPageKeys(parentPage)) {
        if (usage.has(parentKey)) continue;
        usage.add(parentKey);
        changed = true;
      }
    }
  }
  return usage;
}

function parentPageHasEffectiveContent(parentPage, parentPageLookup, hasEffectiveContent, seen = new Set()) {
  if (!parentPage) return false;
  const keys = parentPageKeys(parentPage);
  const seenKey = keys[0] || parentPage.name || parentPage.id;
  if (seenKey && seen.has(seenKey)) return false;
  if (seenKey) seen.add(seenKey);
  if (hasEffectiveContent(parentPage)) return true;
  for (const key of parentPageParentPageKeys(parentPage)) {
    if (parentPageHasEffectiveContent(parentPageLookup.get(key), parentPageLookup, hasEffectiveContent, seen)) {
      return true;
    }
  }
  return false;
}

function pageHasEffectiveParentPage(page, effectiveParentPageKeys) {
  const keys = pageParentPageKeys(page);
  if (!effectiveParentPageKeys) return keys.length > 0;
  return keys.some((key) => effectiveParentPageKeys.has(key));
}

function effectiveParentPageRefForPage(page, effectiveParentPageKeys) {
  if (!pageHasEffectiveParentPage(page, effectiveParentPageKeys)) {
    return { id: null, name: null };
  }
  return {
    id: page && page.parentPageId || null,
    name: page && page.parentPageName || null,
  };
}

function parentPageIsApplied(parentPage, usage) {
  if (!usage || !usage.size) return false;
  return parentPageKeys(parentPage).some((key) => usage.has(key));
}

function parentPageKeys(parentPage) {
  return uniqueStringKeys([
    parentPage && parentPage.id,
    parentPage && parentPage.name,
    parentPage && parentPage.semantic,
  ]);
}

function pageParentPageKeys(page) {
  return uniqueStringKeys([
    page && page.parentPageId,
    page && page.parentPageName,
  ]);
}

function parentPageParentPageKeys(parentPage) {
  return uniqueStringKeys([
    parentPage && parentPage.parentPageId,
    parentPage && parentPage.parentPageName,
  ]);
}

function uniqueStringKeys(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    if (value == null) continue;
    const key = String(value).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function defaultHasContent(parentPage) {
  return Boolean(parentPage);
}

module.exports = {
  PARENT_PAGE_PASTEBOARD_PLACEMENT,
  effectiveParentPageRefForPage,
  filterEffectiveParentPages,
  isParentPagePasteboardItem,
  pageHasEffectiveParentPage,
  parentPageKeySet,
};
