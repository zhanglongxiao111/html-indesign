const {
  HTML_DATA_ID_ATTRIBUTES,
  ITEM_ROLE,
  fieldRegistry,
  registeredItemRole,
} = require('../../../protocol');

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
    textCompared: 0,
    textMismatches: 0,
    pageMismatches: 0,
    accepted: 0,
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

  const referencePagesByIndex = new Map(reference.pages.map((page) => [page.index, page]));
  const referenceElements = new Map(reference.elements.map((element) => [element.key || elementKey(element), element]));
  const candidateElements = new Map(candidate.elements.map((element) => [element.key || elementKey(element), element]));
  for (const refElement of reference.elements) {
    const key = refElement.key || elementKey(refElement);
    const candidateElement = candidateElements.get(key);
    if (!candidateElement) {
      const acceptedMissing = acceptedMissingElement(refElement, {
        candidateElements,
        referenceElements,
        referencePagesByIndex,
        tolerance,
      });
      if (acceptedMissing) {
        stats.accepted += 1;
        warnings.push(issue(
          acceptedMissing,
          `Element ${key} is generated visual structure that is folded into editable author HTML.`,
          refElement.pageIndex,
          refElement.id,
        ));
        continue;
      }
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
    const textComparison = comparableText(refElement, candidateElement);
    if (textComparison) {
      stats.textCompared += 1;
      if (textComparison.referenceText !== textComparison.candidateText) {
        stats.textMismatches += 1;
        errors.push(issue(
          'AUTHOR_VISUAL_TEXT_CONTENT_MISMATCH',
          `Element ${key} text differs: reference="${shortText(textComparison.referenceText)}", candidate="${shortText(textComparison.candidateText)}".`,
          refElement.pageIndex,
          refElement.id,
          {
            referenceText: textComparison.referenceText,
            candidateText: textComparison.candidateText,
          },
        ));
      }
    }
    const delta = geometryDelta(refElement, candidateElement);
    if (maxDelta(delta) > tolerance) {
      const acceptedMismatch = acceptedGeometryMismatch(refElement, candidateElement, delta, tolerance);
      if (acceptedMismatch) {
        stats.accepted += 1;
        warnings.push(issue(
          acceptedMismatch,
          `Element ${key} geometry differs by ${formatDelta(delta)} within an accepted reverse-author normalization.`,
          refElement.pageIndex,
          refElement.id,
        ));
        continue;
      }
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
    pageId: value.pageId == null ? undefined : String(value.pageId),
    id: value.id == null ? undefined : String(value.id),
    key: value.key == null ? undefined : String(value.key),
    tagName: value.tagName == null ? undefined : String(value.tagName).toLowerCase(),
    role: optionalString(value.role),
    vector: optionalString(value.vector),
    objectStyle: optionalString(value.objectStyle),
    paragraphStyle: optionalString(value.paragraphStyle),
    tableStyle: optionalString(value.tableStyle),
    sourceCsv: registeredSourceMetadataValue(value.sourceCsv),
    sourceXml: registeredSourceMetadataValue(value.sourceXml),
    textContent: normalizeTextValue(value.textContent),
    innerText: normalizeTextValue(value.innerText),
    ownTextContent: normalizeTextValue(value.ownTextContent || value.directTextContent),
    hasIdChildren: Boolean(value.hasIdChildren),
    dataIdAttrs: normalizeDataIdAttrs(value.dataIdAttrs || value.dataIdFields || value.htmlAttrs),
    classList: normalizeClassList(value.classList || value.className || value.classes),
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

function acceptedMissingElement(element, context = {}) {
  if (isGeneratedPageBackground(element, context)) return 'AUTHOR_VISUAL_GENERATED_BACKGROUND_ACCEPTED';
  if (isGeneratedBorderFragment(element, context)) return 'AUTHOR_VISUAL_GENERATED_BORDER_ACCEPTED';
  if (isGeneratedTextFragment(element, context)) return 'AUTHOR_VISUAL_GENERATED_TEXT_ACCEPTED';
  return null;
}

function acceptedGeometryMismatch(reference, candidate, delta, tolerance) {
  if (delta.x > tolerance || delta.y > tolerance) return null;
  const refTag = String(reference && reference.tagName || '').toLowerCase();
  const candidateTag = String(candidate && candidate.tagName || '').toLowerCase();
  if (refTag === 'table' && candidateTag === 'table' && delta.width <= tolerance && delta.height <= 24
    && isReverseAuthorTableNormalization(reference, candidate)) {
    return 'AUTHOR_VISUAL_TABLE_HEIGHT_ACCEPTED';
  }
  if (isInlineTextTag(refTag) && isInlineTextTag(candidateTag) && delta.width <= 8 && delta.height <= 2
    && isReverseAuthorTextMetricNormalization(reference, candidate)) {
    return 'AUTHOR_VISUAL_TEXT_METRICS_ACCEPTED';
  }
  return null;
}

function isGeneratedPageBackground(element, context) {
  const page = context.referencePagesByIndex && context.referencePagesByIndex.get(element.pageIndex);
  if (!page || !page.id) return false;
  if (element.id !== `${page.id}-background`) return false;
  if (!hasRegisteredRole(element, ITEM_ROLE.BACKGROUND) || !isRegisteredVectorRectangle(element)) return false;
  if (String(element.tagName || '').toLowerCase() !== 'svg') return false;
  const tolerance = Number.isFinite(Number(context.tolerance)) ? Number(context.tolerance) : 2;
  return maxDelta(geometryDelta({
    x: 0,
    y: 0,
    width: page.width,
    height: page.height,
  }, element)) <= tolerance;
}

function isGeneratedBorderFragment(element, context) {
  const match = /^(.*)-border-(left|right|top|bottom)$/.exec(String(element && element.id || ''));
  if (!match || !hasRegisteredRole(element, ITEM_ROLE.DECORATION) || !isRegisteredVectorRectangle(element)) return false;
  const baseReference = samePageElement(context.referenceElements, element, match[1]);
  const baseCandidate = samePageElement(context.candidateElements, element, match[1]);
  if (!baseReference || !baseCandidate || !isRegisteredVectorRectangle(baseReference)) return false;
  return hasBorderFragmentGeometry(element, match[2]);
}

function isGeneratedTextFragment(element, context) {
  const match = /^(.*)-text$/.exec(String(element && element.id || ''));
  if (!match || !hasRegisteredRole(element, ITEM_ROLE.TEXT)) return false;
  const baseReference = samePageElement(context.referenceElements, element, match[1]);
  const baseCandidate = samePageElement(context.candidateElements, element, match[1]);
  if (!baseReference || !baseCandidate) return false;
  return isAnnotationBase(baseReference) && isAnnotationBase(baseCandidate);
}

function samePageElement(elements, element, id) {
  return elements && elements.get(elementLookupKey(element.pageIndex, id));
}

function elementLookupKey(pageIndex, id) {
  return `${Number.isFinite(Number(pageIndex)) ? Number(pageIndex) : 0}:${id || ''}`;
}

function hasBorderFragmentGeometry(element, side) {
  if (side === 'left' || side === 'right') return num(element.width) > 0 && num(element.width) <= 16 && num(element.height) > 0;
  return num(element.height) > 0 && num(element.height) <= 16 && num(element.width) > 0;
}

function isAnnotationBase(element) {
  if (hasRegisteredRole(element, ITEM_ROLE.ANNOTATION)) return true;
  return hasRegisteredObjectStyle(element, 'annotation-label');
}

function isReverseAuthorTableNormalization(reference, candidate) {
  if (!reference || !candidate) return false;
  const refTableStyle = String(reference.tableStyle || '').trim();
  const candidateTableStyle = String(candidate.tableStyle || '').trim();
  return Boolean(
    refTableStyle
      && candidateTableStyle
      && refTableStyle === candidateTableStyle
      && hasRegisteredDataIdAttr(reference, HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE, 'canonical')
      && hasRegisteredDataIdAttr(candidate, HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE, 'canonical')
      && hasMatchingRegisteredTableSourceMetadata(reference, candidate),
  );
}

function isReverseAuthorTextMetricNormalization(reference, candidate) {
  return isPageNumberText(reference) && isPageNumberText(candidate);
}

function isPageNumberText(element) {
  return hasRegisteredParagraphStyle(element, 'folio');
}

function hasRole(element, role) {
  return String(element && element.role || '').trim().toLowerCase() === role;
}

function isVectorRectangle(element) {
  return String(element && element.vector || '').trim().toLowerCase() === 'rectangle';
}

function hasRegisteredRole(element, role) {
  const registeredRole = registeredItemRole(role);
  return Boolean(
    registeredRole
      && hasRole(element, registeredRole)
      && hasRegisteredDataIdAttr(element, HTML_DATA_ID_ATTRIBUTES.ROLE, 'canonical')
  );
}

function isRegisteredVectorRectangle(element) {
  return isVectorRectangle(element) && hasRegisteredDataIdAttr(element, HTML_DATA_ID_ATTRIBUTES.VECTOR, 'canonical');
}

function hasRegisteredObjectStyle(element, objectStyle) {
  return (
    String(element && element.objectStyle || '').trim().toLowerCase() === objectStyle
    && hasRegisteredDataIdAttr(element, HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE, 'canonical')
  );
}

function hasRegisteredParagraphStyle(element, paragraphStyle) {
  return Boolean(
    hasRegisteredDataIdAttr(element, HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE, 'canonical')
      && String(element && element.paragraphStyle || '').trim().toLowerCase() === paragraphStyle,
  );
}

function hasMatchingRegisteredTableSourceMetadata(reference, candidate) {
  const referenceSources = registeredTableSourceMetadata(reference);
  const candidateSources = registeredTableSourceMetadata(candidate);
  if (!referenceSources.length || referenceSources.length !== candidateSources.length) return false;
  const candidateByAttr = new Map(candidateSources.map((source) => [source.attr, source.value]));
  return referenceSources.every((referenceSource) => candidateByAttr.get(referenceSource.attr) === referenceSource.value);
}

function registeredTableSourceMetadata(element) {
  const sources = [];
  for (const [attr, prop] of [
    [HTML_DATA_ID_ATTRIBUTES.SOURCE_CSV, 'sourceCsv'],
    [HTML_DATA_ID_ATTRIBUTES.SOURCE_XML, 'sourceXml'],
  ]) {
    const value = registeredSourceMetadataValue(element && element[prop]);
    if (value && hasRegisteredDataIdAttr(element, attr, 'sourceMetadata')) {
      sources.push({ attr, value });
    }
  }
  return sources;
}

function registeredSourceMetadataValue(value) {
  if (value == null) return undefined;
  const string = String(value);
  return string.trim() ? string : undefined;
}

function hasRegisteredDataIdAttr(element, attr, fieldClass) {
  const field = fieldRegistry.getByHtmlAttr(attr);
  return Boolean(
    field
      && field.lifecycle === 'active'
      && (!fieldClass || field.fieldClass === fieldClass)
      && Array.isArray(element && element.dataIdAttrs)
      && element.dataIdAttrs.includes(attr),
  );
}

function isInlineTextTag(tagName) {
  return ['span', 'small', 'strong', 'em', 'b', 'i'].includes(String(tagName || '').toLowerCase());
}

function normalizeClassList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeDataIdAttrs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const attrs = [];
  for (const item of value) {
    const attr = String(item || '').trim();
    if (!attr.startsWith(`data-id-`) || seen.has(attr)) continue;
    seen.add(attr);
    attrs.push(attr);
  }
  return attrs;
}

function comparableText(reference, candidate) {
  const ownTextOnly = hasTrackedChildElements(reference) || hasTrackedChildElements(candidate);
  const referenceText = textForComparison(reference, ownTextOnly);
  const candidateText = textForComparison(candidate, ownTextOnly);
  if (referenceText == null && candidateText == null) return null;
  const normalizedReference = referenceText || '';
  const normalizedCandidate = candidateText || '';
  if (!normalizedReference && !normalizedCandidate) return null;
  return {
    referenceText: normalizedReference,
    candidateText: normalizedCandidate,
  };
}

function textForComparison(element, ownTextOnly = false) {
  if (!element) return undefined;
  if (ownTextOnly) return normalizeTextValue(element.ownTextContent);
  const ownText = normalizeTextValue(element.ownTextContent);
  if (ownText) return ownText;
  const textContent = normalizeTextValue(element && element.textContent);
  if (textContent != null) return textContent;
  return normalizeTextValue(element && element.innerText);
}

function hasTrackedChildElements(element) {
  return Boolean(element && element.hasIdChildren);
}

function normalizeTextValue(value) {
  if (value == null) return undefined;
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortText(value) {
  const text = normalizeTextValue(value) || '';
  if (text.length <= 80) return text;
  return `${text.slice(0, 77)}...`;
}

function optionalString(value) {
  if (value == null) return undefined;
  const string = String(value).trim();
  return string || undefined;
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function issue(code, message, pageIndex, id = null, details = null) {
  return details ? { code, message, pageIndex, id, ...details } : { code, message, pageIndex, id };
}

module.exports = {
  compareVisualGeometry,
};
