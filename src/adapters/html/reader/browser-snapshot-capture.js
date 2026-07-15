(function installBrowserSnapshotCapture(globalObject) {
  function dataIdAttributes() {
    const attrs = globalObject && globalObject.htmlIndesignDataIdAttributes;
    if (!attrs) throw new Error('htmlIndesignDataIdAttributes is not installed');
    return attrs;
  }

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
    if (pageEls.length === 0) {
      throw new Error(`No pages captured for selector "${selector}" in browser document "${document.location.href}"`);
    }
    const styleRules = styleApi().collectStyleRules();
    return {
      sourcePackageInput: collectSourcePackageInput(pageEls),
      pages: pageEls.map((pageEl, pageIndex) => collectPageSnapshot(pageEl, pageIndex, styleRules)),
    };
  }

  function collectSourcePackageInput(pageEls) {
    const dataId = dataIdAttributes();
    const deckEl = document.querySelector('main.deck') || document.body;
    const styleFiles = Array.from(document.querySelectorAll('style[data-source-file]'))
      .map((el) => el.getAttribute('data-source-file'))
      .filter(Boolean);
    const pageFiles = pageEls.map((pageEl) => ({
      id: pageEl.getAttribute('data-page') || pageEl.id || '',
      file: pageEl.getAttribute(dataId.SOURCE_FILE) || '',
    })).filter((page) => page.id && page.file);
    return {
      attributes: elementApi().attrs(deckEl),
      title: document.title || '',
      styleFiles,
      pageFiles,
      parentPages: collectSourcePackageParentPages(),
      layers: collectSourcePackageLayers(),
      compositeFonts: collectSourcePackageCompositeFonts(),
      assetRoot: 'assets',
    };
  }

  function collectSourcePackageParentPages() {
    const dataId = dataIdAttributes();
    const el = document.querySelector(`script[type="application/json"][${dataId.SOURCE_PACKAGE_PARENT_PAGES}]`);
    if (!el) return [];
    try {
      const value = JSON.parse(el.textContent || '[]');
      if (Array.isArray(value)) return value;
    } catch (error) {
      throw new Error(`SOURCE_PACKAGE_PARENT_PAGES_INVALID:${error.message}`);
    }
    throw new Error('SOURCE_PACKAGE_PARENT_PAGES_INVALID: parentPages metadata must be an array');
  }

  function collectSourcePackageLayers() {
    const dataId = dataIdAttributes();
    const el = document.querySelector(`script[type="application/json"][${dataId.SOURCE_PACKAGE_LAYERS}]`);
    if (!el) return [];
    try {
      const value = JSON.parse(el.textContent || '[]');
      if (Array.isArray(value)) return value;
    } catch (error) {
      throw new Error(`SOURCE_PACKAGE_LAYERS_INVALID:${error.message}`);
    }
    throw new Error('SOURCE_PACKAGE_LAYERS_INVALID: layers metadata must be an array');
  }

  function collectSourcePackageCompositeFonts() {
    const dataId = dataIdAttributes();
    const el = document.querySelector(`script[type="application/json"][${dataId.SOURCE_PACKAGE_COMPOSITE_FONTS}]`);
    if (!el) return [];
    try {
      const value = JSON.parse(el.textContent || '[]');
      if (Array.isArray(value)) return value;
    } catch (error) {
      throw new Error(`SOURCE_PACKAGE_COMPOSITE_FONTS_INVALID:${error.message}`);
    }
    throw new Error('SOURCE_PACKAGE_COMPOSITE_FONTS_INVALID: compositeFonts metadata must be an array');
  }

  function collectPageSnapshot(pageEl, pageIndex, styleRules) {
    const dataId = dataIdAttributes();
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
      sourceFile: pageEl.getAttribute(dataId.SOURCE_FILE) || null,
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
    const itemRuleStyle = styles.ruleStyleObject(el, styleRules);
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
        sourceHtml: elements.sourceHtmlFor(el, candidates),
      }),
      sourceAncestorNodes: elements.sourceAncestorNodes(el, pageEl, candidates),
      cssVars: elements.cssVarsFor(el),
      rectPx: elements.rectObject(frameEl.getBoundingClientRect()),
      text: elements.trimmedTextWithHardBreaks(el, candidates),
      computedStyle: styles.mergeVisualFrameStyle(itemStyle, frameStyle),
      authoredStyle: styles.mergeVisualFrameStyle(itemAuthoredStyle, frameAuthoredStyle),
      ruleStyle: itemRuleStyle,
      runs: elements.textRunsFor(el, candidates),
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
