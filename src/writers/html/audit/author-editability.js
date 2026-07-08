const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { collapseWhitespace } = require('../../../shared/text');
const { collectKnownSemanticTokens, resolveSemanticPreset } = require('../../../semantic-preset');

const TEXT_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,figcaption,li,td,th';
const LOW_LEVEL_GEOMETRY_ATTRIBUTES = new Set([
  HTML_DATA_ID_ATTRIBUTES.CONTENT_X,
  HTML_DATA_ID_ATTRIBUTES.CONTENT_Y,
  HTML_DATA_ID_ATTRIBUTES.CONTENT_WIDTH,
  HTML_DATA_ID_ATTRIBUTES.CONTENT_HEIGHT,
  HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_X,
  HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_Y,
  HTML_DATA_ID_ATTRIBUTES.VECTOR_POINTS,
]);

function auditAuthorEditability(root, options = {}) {
  const packageRoot = path.resolve(root || '');
  const failures = [];
  const warnings = [];
  const pages = [];
  const configPath = path.join(packageRoot, 'deck.config.json');
  if (!fs.existsSync(configPath)) {
    failures.push(failure('AUTHOR_EDITABILITY_CONFIG_MISSING', 'Author package deck.config.json is missing.', 'deck.config.json'));
    return report(false, packageRoot, emptySummary(), pages, failures, warnings, thresholdsFor(options));
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const semanticContainerClasses = resolveSemanticContainerClasses(packageRoot, config, options);
  const pageFiles = validatePageList(config, configPath);
  const totals = emptyTotals();
  for (const page of pageFiles) {
    const pageMetrics = scanPage(packageRoot, page, semanticContainerClasses);
    pages.push(pageMetrics);
    addTotals(totals, pageMetrics);
    if (pageMetrics.missing) {
      failures.push(failure('AUTHOR_EDITABILITY_PAGE_MISSING', `Author page is missing: ${page.file}`, page.file));
    }
  }

  const summary = summaryFromTotals(totals, pageFiles.length);
  const thresholds = thresholdsFor(options);
  failures.push(...thresholdFailures(summary, thresholds));
  return report(failures.length === 0, packageRoot, summary, pages, failures, warnings, thresholds);
}

function validatePageList(config, configPath) {
  if (!Array.isArray(config && config.pages) || config.pages.length === 0) {
    throw new Error(`Author package requires a non-empty pages array: ${configPath}`);
  }
  return config.pages.map((page, index) => {
    if (!page || typeof page !== 'object' || !page.file) {
      throw new Error(`Author package page ${index} is missing file: ${configPath}`);
    }
    return page;
  });
}

function resolveSemanticContainerClasses(packageRoot, config, options = {}) {
  if (options.preset) {
    return collectKnownSemanticTokens(options.preset).semanticContainers;
  }
  if (Object.prototype.hasOwnProperty.call(config || {}, 'semanticPreset')) {
    const relativePath = config.semanticPreset;
    if (typeof relativePath !== 'string' || !relativePath.trim()) {
      throw new Error('Author package semanticPreset must be a non-empty string when declared.');
    }
  }
  const resolved = resolveSemanticPreset({
    rootDir: packageRoot,
    config,
  });
  return collectKnownSemanticTokens(resolved.preset).semanticContainers;
}

function scanPage(packageRoot, page, semanticContainerClasses) {
  const file = page && page.file ? String(page.file) : '';
  const fullPath = path.join(packageRoot, file);
  if (!file || !fs.existsSync(fullPath)) {
    return { id: page && page.id || file, file, missing: true, ...emptyTotals() };
  }
  const html = fs.readFileSync(fullPath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const pageRoots = $('.page').toArray();
  const objectIdElements = $('[id]').toArray().filter((element) => !isPageRoot($, element));
  const semanticContainerElements = objectIdElements.filter((element) => isSemanticContainer($, element, semanticContainerClasses));
  const coveredObjectIdElements = objectIdElements.filter((element) => isCoveredBySemanticContainer($, element, semanticContainerClasses));
  const looseTopLevelObjects = pageRoots.reduce((count, pageRoot) => {
    return count + $(pageRoot).children('[id]').toArray()
      .filter((element) => !isSemanticContainer($, element, semanticContainerClasses))
      .filter((element) => !isPageRoot($, element))
      .length;
  }, 0);

  return {
    id: page && page.id || file,
    file,
    missing: false,
    idElements: $('[id]').length,
    objectIdElements: objectIdElements.length,
    semanticContainerElements: semanticContainerElements.length,
    coveredObjectIdElements: coveredObjectIdElements.length,
    looseTopLevelObjects,
    inlineStyleElements: $('[style]').length,
    lowLevelGeometryAttrs: countLowLevelGeometryAttrs($),
    vectorSvgElements: $('svg[id]').length,
    figureCaptionPairs: $('figure').toArray().filter((element) => $(element).find('figcaption').length > 0).length,
    textElements: $(TEXT_SELECTOR).toArray().filter((element) => collapseWhitespace($(element).text())).length,
    characterStyleSpans: $(`[${HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE}]`).length,
  };
}

function isPageRoot($, element) {
  return $(element).hasClass('page');
}

function isSemanticContainer($, element, semanticContainerClasses) {
  const tag = tagName(element);
  if (tag === 'figure' || tag === 'table' || tag === 'ul' || tag === 'ol') return true;
  const classes = classList($(element).attr('class'));
  return classes.some((className) => semanticContainerClasses.has(className));
}

function isCoveredBySemanticContainer($, element, semanticContainerClasses) {
  if (isSemanticContainer($, element, semanticContainerClasses)) return true;
  return $(element).parents().toArray().some((parent) => {
    return !isPageRoot($, parent) && isSemanticContainer($, parent, semanticContainerClasses);
  });
}

function countLowLevelGeometryAttrs($) {
  let count = 0;
  $('*').each((_, element) => {
    const attrs = element.attribs || {};
    for (const name of Object.keys(attrs)) {
      if (LOW_LEVEL_GEOMETRY_ATTRIBUTES.has(name)) count += 1;
    }
  });
  return count;
}

function emptyTotals() {
  return {
    idElements: 0,
    objectIdElements: 0,
    semanticContainerElements: 0,
    coveredObjectIdElements: 0,
    looseTopLevelObjects: 0,
    inlineStyleElements: 0,
    lowLevelGeometryAttrs: 0,
    vectorSvgElements: 0,
    figureCaptionPairs: 0,
    textElements: 0,
    characterStyleSpans: 0,
  };
}

function emptySummary() {
  return {
    pages: 0,
    sourcePageFiles: 0,
    ...emptyTotals(),
    semanticContainerCoverage: { covered: 0, total: 0, ratio: 0 },
  };
}

function addTotals(totals, pageMetrics) {
  for (const key of Object.keys(emptyTotals())) {
    totals[key] += Number(pageMetrics[key] || 0);
  }
}

function summaryFromTotals(totals, pageCount) {
  return {
    pages: pageCount,
    sourcePageFiles: pageCount,
    ...totals,
    semanticContainerCoverage: {
      covered: totals.coveredObjectIdElements,
      total: totals.objectIdElements,
      ratio: ratio(totals.coveredObjectIdElements, totals.objectIdElements),
    },
  };
}

function thresholdsFor(options = {}) {
  const baseline = options.baselineReport && options.baselineReport.summary || null;
  const explicit = options.thresholds || {};
  return cleanThresholds({
    maxLooseTopLevelObjects: numberOr(explicit.maxLooseTopLevelObjects, baseline && baseline.looseTopLevelObjects),
    maxInlineStyleElements: numberOr(explicit.maxInlineStyleElements, baseline && baseline.inlineStyleElements),
    maxLowLevelGeometryAttrs: numberOr(explicit.maxLowLevelGeometryAttrs, baseline && baseline.lowLevelGeometryAttrs),
    maxVectorSvgElements: numberOr(explicit.maxVectorSvgElements, explicit.maxVectorSvgElements),
    minSemanticContainerCoverage: numberOr(
      explicit.minSemanticContainerCoverage,
      baseline && baseline.semanticContainerCoverage && baseline.semanticContainerCoverage.ratio,
    ),
  });
}

function thresholdFailures(summary, thresholds) {
  const failures = [];
  if (Number.isFinite(thresholds.maxLooseTopLevelObjects)
    && summary.looseTopLevelObjects > thresholds.maxLooseTopLevelObjects) {
    failures.push(metricFailure(
      'AUTHOR_EDITABILITY_LOOSE_TOP_LEVEL_OVER_BUDGET',
      'Loose top-level author objects exceed the editability budget.',
      summary.looseTopLevelObjects,
      thresholds.maxLooseTopLevelObjects,
    ));
  }
  if (Number.isFinite(thresholds.minSemanticContainerCoverage)
    && summary.semanticContainerCoverage.ratio < thresholds.minSemanticContainerCoverage) {
    failures.push(metricFailure(
      'AUTHOR_EDITABILITY_CONTAINER_COVERAGE_BELOW_BUDGET',
      'Semantic container coverage is below the editability budget.',
      summary.semanticContainerCoverage.ratio,
      thresholds.minSemanticContainerCoverage,
    ));
  }
  if (Number.isFinite(thresholds.maxInlineStyleElements)
    && summary.inlineStyleElements > thresholds.maxInlineStyleElements) {
    failures.push(metricFailure(
      'AUTHOR_EDITABILITY_INLINE_STYLE_OVER_BUDGET',
      'Inline style elements exceed the editability budget.',
      summary.inlineStyleElements,
      thresholds.maxInlineStyleElements,
    ));
  }
  if (Number.isFinite(thresholds.maxLowLevelGeometryAttrs)
    && summary.lowLevelGeometryAttrs > thresholds.maxLowLevelGeometryAttrs) {
    failures.push(metricFailure(
      'AUTHOR_EDITABILITY_LOW_LEVEL_GEOMETRY_OVER_BUDGET',
      'Low-level geometry attributes exceed the editability budget.',
      summary.lowLevelGeometryAttrs,
      thresholds.maxLowLevelGeometryAttrs,
    ));
  }
  if (Number.isFinite(thresholds.maxVectorSvgElements)
    && summary.vectorSvgElements > thresholds.maxVectorSvgElements) {
    failures.push(metricFailure(
      'AUTHOR_EDITABILITY_VECTOR_SVG_OVER_BUDGET',
      'Vector SVG elements exceed the editability budget.',
      summary.vectorSvgElements,
      thresholds.maxVectorSvgElements,
    ));
  }
  return failures;
}

function cleanThresholds(value) {
  return Object.fromEntries(Object.entries(value).filter(([, threshold]) => Number.isFinite(threshold)));
}

function numberOr(value, fallback) {
  const number = optionalNumber(value);
  if (Number.isFinite(number)) return number;
  const fallbackNumber = optionalNumber(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : undefined;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function metricFailure(code, message, actual, budget) {
  return { code, message, actual, budget };
}

function failure(code, message, file) {
  return { code, message, file };
}

function report(ok, root, summary, pages, failures, warnings, thresholds) {
  return {
    kind: 'AuthorEditabilityAudit',
    ok,
    root,
    summary,
    pages,
    thresholds,
    failures,
    warnings,
  };
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

function tagName(element) {
  return String(element && (element.tagName || element.name) || '').toLowerCase();
}

function classList(value) {
  return String(value || '').split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

module.exports = {
  auditAuthorEditability,
};
