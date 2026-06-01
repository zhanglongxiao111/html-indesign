function compareVisualGeometry(options = {}) {
  const reference = normalizeCapture(options.reference);
  const candidate = normalizeCapture(options.candidate);
  const tolerance = Number.isFinite(Number(options.tolerance)) ? Number(options.tolerance) : 2;
  const errors = [];
  const warnings = [];
  const stats = {
    referencePages: reference.pages.length,
    candidatePages: candidate.pages.length,
    referenceElements: reference.elements.length,
    candidateElements: candidate.elements.length,
    compared: 0,
    missing: 0,
    mismatched: 0,
    pageMismatches: 0,
  };

  if (reference.pages.length !== candidate.pages.length) {
    stats.pageMismatches += 1;
    errors.push(issue(
      'AUTHOR_VISUAL_PAGE_COUNT_MISMATCH',
      `Reference has ${reference.pages.length} pages but author has ${candidate.pages.length}.`,
      null,
    ));
  }

  const candidatePages = new Map(candidate.pages.map((page) => [page.index, page]));
  for (const refPage of reference.pages) {
    const candidatePage = candidatePages.get(refPage.index);
    if (!candidatePage) continue;
    const delta = geometryDelta(refPage, candidatePage);
    if (maxDelta(delta) > tolerance) {
      stats.pageMismatches += 1;
      errors.push(issue(
        'AUTHOR_VISUAL_PAGE_GEOMETRY_MISMATCH',
        `Page ${refPage.index} geometry differs by ${formatDelta(delta)}.`,
        refPage.index,
      ));
    }
  }

  const candidateElements = new Map(candidate.elements.map((element) => [element.key || elementKey(element), element]));
  for (const refElement of reference.elements) {
    const key = refElement.key || elementKey(refElement);
    const candidateElement = candidateElements.get(key);
    if (!candidateElement) {
      stats.missing += 1;
      errors.push(issue(
        'AUTHOR_VISUAL_ELEMENT_MISSING',
        `Element ${key} exists in visual HTML but is missing from author HTML.`,
        refElement.pageIndex,
        refElement.id,
      ));
      continue;
    }
    stats.compared += 1;
    const delta = geometryDelta(refElement, candidateElement);
    if (maxDelta(delta) > tolerance) {
      stats.mismatched += 1;
      errors.push(issue(
        'AUTHOR_VISUAL_GEOMETRY_MISMATCH',
        `Element ${key} geometry differs by ${formatDelta(delta)}.`,
        refElement.pageIndex,
        refElement.id,
      ));
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

function normalizeCapture(capture) {
  return {
    pages: Array.isArray(capture && capture.pages) ? capture.pages.map(normalizeBox).filter(Boolean) : [],
    elements: Array.isArray(capture && capture.elements)
      ? capture.elements.map((element) => normalizeBox(element, true)).filter(Boolean)
      : [],
  };
}

function normalizeBox(value, element = false) {
  if (!value) return null;
  const out = {
    index: Number.isFinite(Number(value.index)) ? Number(value.index) : undefined,
    pageIndex: Number.isFinite(Number(value.pageIndex)) ? Number(value.pageIndex) : undefined,
    id: value.id == null ? undefined : String(value.id),
    key: value.key == null ? undefined : String(value.key),
    x: num(value.x),
    y: num(value.y),
    width: num(value.width),
    height: num(value.height),
  };
  if (element && !out.key) out.key = elementKey(out);
  return out;
}

function elementKey(element) {
  return `${Number.isFinite(Number(element.pageIndex)) ? Number(element.pageIndex) : 0}:${element.id || ''}`;
}

function geometryDelta(a, b) {
  return {
    x: Math.abs(num(a.x) - num(b.x)),
    y: Math.abs(num(a.y) - num(b.y)),
    width: Math.abs(num(a.width) - num(b.width)),
    height: Math.abs(num(a.height) - num(b.height)),
  };
}

function maxDelta(delta) {
  return Math.max(delta.x, delta.y, delta.width, delta.height);
}

function formatDelta(delta) {
  return `x=${round(delta.x)}, y=${round(delta.y)}, width=${round(delta.width)}, height=${round(delta.height)}`;
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function issue(code, message, pageIndex, id = null) {
  return { code, message, pageIndex, id };
}

module.exports = {
  compareVisualGeometry,
};
