const path = require('path');
const { launchEdgeBrowser } = require('../../../shared/edge-browser');
const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const { rectPxToMm, round } = require('../../../shared/geometry');
const { createReport, addMessage } = require('../../../shared/report');
const { parseZIndex } = require('../../../shared/style-utils');
const { detectAssetsFromItems } = require('./asset-detector');
const { roleFromItem, selectorFor } = require('./candidate-elements');
const { defaultPageSelector } = require('./page-detector');
const { browserSnapshotScriptPaths } = require('./browser-snapshot-scripts');
const { tableRowsWithBounds } = require('./table-snapshot');
const { collectUnsupportedWarnings } = require('./unsupported-css');

async function renderSnapshot(options) {
  const htmlPath = path.resolve(options.htmlPath);
  const pageSelector = options.pageSelector || defaultPageSelector();
  const report = createReport();
  addMessage(report, 'info', 'SNAPSHOT_START', 'Browser snapshot started', { htmlPath });
  const browser = await (options.launchBrowser || launchEdgeBrowser)({
    launchOptions: { headless: true },
  });
  try {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await waitForPageAssets(page);
    await installBrowserSnapshotScripts(page);

    const raw = await evaluateBrowserSnapshotCapture(page, pageSelector, htmlPath);
    const capture = browserSnapshotCapturePayload(raw, { htmlPath, pageSelector });
    const rawPages = capture.pages;
    const sourcePackageInput = capture.sourcePackageInput;
    const pages = rawPages.map((pageInfo) => pageSnapshotToModel(pageInfo));

    const warnings = [];
    collectUnsupportedWarnings(pages, warnings, report);
    const allItems = pages.flatMap((pageInfo) => pageInfo.items);
    const assets = detectAssetsFromItems(allItems, htmlPath);

    return {
      metadata: {
        source: htmlPath,
        capturedAt: new Date().toISOString(),
      },
      sourcePackageInput,
      pages,
      assets,
      warnings,
      report,
    };
  } finally {
    await browser.close();
  }
}

async function evaluateBrowserSnapshotCapture(page, pageSelector, htmlPath) {
  try {
    return await page.evaluate((selector) => {
      return window.htmlIndesignBrowserSnapshotCapture.collectBrowserSnapshot(selector);
    }, pageSelector);
  } catch (error) {
    const wrapped = new Error(`Browser snapshot capture failed for selector "${pageSelector}" from "${htmlPath}": ${error.message}`);
    wrapped.cause = error;
    throw wrapped;
  }
}

function browserSnapshotCapturePayload(raw, context) {
  const { htmlPath, pageSelector } = context;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Browser snapshot capture returned invalid payload shape for selector "${pageSelector}" from "${htmlPath}": expected object with pages array and sourcePackageInput object.`);
  }
  if (!Array.isArray(raw.pages)) {
    throw new Error(`Browser snapshot capture returned invalid payload shape for selector "${pageSelector}" from "${htmlPath}": pages must be an array.`);
  }
  if (!raw.sourcePackageInput || typeof raw.sourcePackageInput !== 'object' || Array.isArray(raw.sourcePackageInput)) {
    throw new Error(`Browser snapshot capture returned invalid payload shape for selector "${pageSelector}" from "${htmlPath}": sourcePackageInput must be an object.`);
  }
  if (raw.pages.length === 0) {
    throw new Error(`No pages captured for selector "${pageSelector}" from "${htmlPath}".`);
  }
  return raw;
}

async function waitForPageAssets(page) {
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const images = Array.from(document.images);
    await Promise.all(images.map((img) => img.complete ? undefined : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    })));
  });
}

async function installBrowserSnapshotScripts(page) {
  await page.evaluate((attributes) => {
    window.htmlIndesignDataIdAttributes = attributes;
  }, HTML_DATA_ID_ATTRIBUTES);
  for (const scriptPath of browserSnapshotScriptPaths) {
    await page.addScriptTag({ path: scriptPath });
  }
}

function pageSnapshotToModel(pageInfo) {
  const widthMm = cssPixelsToMm(pageInfo.rectPx.width);
  const heightMm = cssPixelsToMm(pageInfo.rectPx.height);
  const items = pageInfo.items
    .filter((item) => (item.rectPx.width > 0 && item.rectPx.height > 0) || isDeclaredProtocolObject(item))
    .map((item) => itemSnapshotToModel(item, pageInfo, widthMm, heightMm));
  applyNestedPaintOrder(items);
  return {
    id: pageInfo.id,
    index: pageInfo.index,
    classList: pageInfo.classList || [],
    attributes: pageInfo.attributes || {},
    sourceFile: pageInfo.sourceFile || null,
    sourceNode: pageInfo.sourceNode || null,
    widthMm: round(widthMm, 2),
    heightMm: round(heightMm, 2),
    rectPx: pageInfo.rectPx,
    computedStyle: pageInfo.computedStyle || {},
    authoredStyle: pageInfo.authoredStyle || {},
    mmPerPxX: round(widthMm / pageInfo.rectPx.width),
    mmPerPxY: round(heightMm / pageInfo.rectPx.height),
    items,
  };
}

function isDeclaredProtocolObject(item) {
  const attrs = item && item.attributes || {};
  return Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.OBJECT)
    || Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.VECTOR);
}

function itemSnapshotToModel(item, pageInfo, widthMm, heightMm) {
  return {
    id: item.id,
    role: roleFromItem(item),
    sourceSelector: selectorFor(item),
    tagName: item.tagName,
    classList: item.classList,
    attributes: item.attributes,
    sourceNode: item.sourceNode || null,
    sourceAncestorNodes: item.sourceAncestorNodes || [],
    cssVars: item.cssVars || {},
    text: item.text,
    rectPx: item.rectPx,
    boundsMm: roundBounds(rectPxToMm({
      rectPx: item.rectPx,
      pageRectPx: pageInfo.rectPx,
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
    }), 2),
    zIndex: parseZIndex(item.computedStyle.zIndex),
    baseZIndex: parseZIndex(item.computedStyle.zIndex),
    computedStyle: item.computedStyle,
    authoredStyle: item.authoredStyle || {},
    ruleStyle: item.ruleStyle || {},
    unsupported: item.unsupported || {},
    runs: item.runs,
    table: tableRowsWithBounds(item.table || [], pageInfo.rectPx, widthMm, heightMm),
    documentOrder: item.candidateIndex,
    ancestorCandidateIndexes: item.ancestorCandidateIndexes || [],
    ancestorCandidateIds: item.ancestorCandidateIds || [],
  };
}

function cssPixelsToMm(px) {
  return px * 25.4 / 96;
}

function roundBounds(bounds, digits) {
  return {
    x: round(bounds.x, digits),
    y: round(bounds.y, digits),
    width: round(bounds.width, digits),
    height: round(bounds.height, digits),
  };
}

function applyNestedPaintOrder(items) {
  const byCandidateIndex = new Map(items.map((item) => [item.documentOrder, item]));
  const visiting = new Set();
  const visited = new Set();
  function effectiveZ(item) {
    if (visited.has(item.documentOrder)) return item.zIndex;
    if (visiting.has(item.documentOrder)) return item.zIndex;
    visiting.add(item.documentOrder);
    let zIndex = item.zIndex;
    for (const ancestorIndex of item.ancestorCandidateIndexes || []) {
      const ancestor = byCandidateIndex.get(ancestorIndex);
      if (!ancestor) continue;
      zIndex = Math.max(zIndex, effectiveZ(ancestor) + 0.01);
    }
    item.zIndex = round(zIndex, 2);
    visiting.delete(item.documentOrder);
    visited.add(item.documentOrder);
    return item.zIndex;
  }
  for (const item of items) effectiveZ(item);
}

module.exports = {
  renderSnapshot,
};
