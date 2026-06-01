(function installBrowserSnapshotCapture(globalObject) {
  function styleApi() {
    const api = globalObject && globalObject.htmlIndesignBrowserStyleCapture;
    if (!api) throw new Error('htmlIndesignBrowserStyleCapture is not installed');
    return api;
  }

  function elementApi() {
    const api = globalObject && globalObject.htmlIndesignBrowserElementCapture;
    if (!api) throw new Error('htmlIndesignBrowserElementCapture is not installed');
    return api;
  }

  function collectBrowserSnapshot(selector) {
    const pageEls = Array.from(document.querySelectorAll(selector));
    const styleRules = styleApi().collectStyleRules();
    return {
      sourcePackageInput: collectSourcePackageInput(pageEls),
      pages: pageEls.map((pageEl, pageIndex) => collectPageSnapshot(pageEl, pageIndex, styleRules)),
    };
  }

  function collectSourcePackageInput(pageEls) {
    const deckEl = document.querySelector('main.deck') || document.body;
    const styleFiles = Array.from(document.querySelectorAll('style[data-source-file]'))
      .map((el) => el.getAttribute('data-source-file'))
      .filter(Boolean);
    const pageFiles = pageEls.map((pageEl) => ({
      id: pageEl.getAttribute('data-page') || pageEl.id || '',
      file: pageEl.getAttribute('data-id-source-file') || '',
    })).filter((page) => page.id && page.file);
    return {
      attributes: elementApi().attrs(deckEl),
      title: document.title || '',
      styleFiles,
      pageFiles,
      assetRoot: 'assets',
    };
  }

  function collectPageSnapshot(pageEl, pageIndex, styleRules) {
    const elements = elementApi();
    const styles = styleApi();
    const pageRect = elements.rectObject(pageEl.getBoundingClientRect());
    const pageStyle = getComputedStyle(pageEl);
    const candidates = elements.collectCandidateElements(pageEl);
    return {
      id: pageEl.id || pageEl.getAttribute('data-page-id') || `page-${pageIndex + 1}`,
      index: pageIndex,
      classList: elements.classList(pageEl),
      attributes: elements.attrs(pageEl),
      sourceFile: pageEl.getAttribute('data-id-source-file') || null,
      sourceNode: {
        tagName: pageEl.tagName.toLowerCase(),
        id: pageEl.id || null,
        classList: elements.classList(pageEl),
        attributes: elements.attrs(pageEl),
      },
      rectPx: pageRect,
      widthCss: pageStyle.width,
      heightCss: pageStyle.height,
      computedStyle: styles.styleObject(pageEl),
      authoredStyle: styles.authoredStyleObject(pageEl, styleRules),
      items: candidates.map((el, itemIndex) => collectItemSnapshot(el, itemIndex, pageIndex, pageEl, candidates, styleRules)),
    };
  }

  function collectItemSnapshot(el, itemIndex, pageIndex, pageEl, candidates, styleRules) {
    const elements = elementApi();
    const styles = styleApi();
    const frameEl = elements.visualFrameFor(el);
    const itemStyle = styles.styleObject(el);
    const frameStyle = styles.styleObject(frameEl);
    const itemAuthoredStyle = styles.authoredStyleObject(el, styleRules);
    const frameAuthoredStyle = styles.authoredStyleObject(frameEl, styleRules);
    const itemAttrs = elements.attrs(el);
    const frameAttrs = elements.attrs(frameEl);
    const previewNode = elements.sourcePreviewNodeFor(el, frameEl, pageEl);
    return {
      id: elements.itemIdFor(el, frameEl, pageIndex, itemIndex),
      tagName: el.tagName.toLowerCase(),
      classList: elements.mergeClassList(elements.classList(el), elements.classList(frameEl)),
      attributes: elements.mergeFrameAttributes(itemAttrs, frameAttrs),
      sourceNode: elements.sourceNodeFor(el, pageEl, {
        classList: elements.classList(el),
        attributes: itemAttrs,
        previewNode,
        sourceHtml: elements.sourceHtmlFor(el),
      }),
      sourceAncestorNodes: elements.sourceAncestorNodes(el, pageEl, candidates),
      cssVars: elements.cssVarsFor(el),
      rectPx: elements.rectObject(frameEl.getBoundingClientRect()),
      text: elements.sourceText(el),
      computedStyle: styles.mergeVisualFrameStyle(itemStyle, frameStyle),
      authoredStyle: styles.mergeVisualFrameStyle(itemAuthoredStyle, frameAuthoredStyle),
      runs: elements.textRunsFor(el),
      table: elements.tableRowsFor(el, styleRules),
      unsupported: elements.unsupportedFor(el),
      candidateIndex: itemIndex,
      ancestorCandidateIndexes: elements.ancestorCandidateIndexes(el, candidates, pageEl),
      ancestorCandidateIds: elements.ancestorCandidateIds(el, candidates, pageIndex, pageEl),
    };
  }

  const api = {
    collectBrowserSnapshot,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.htmlIndesignBrowserSnapshotCapture = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
