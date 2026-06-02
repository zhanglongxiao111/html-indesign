(function installBrowserElementCapture(globalObject) {
  function styleApi() {
    const api = globalObject && globalObject.htmlIndesignBrowserStyleCapture;
    if (!api) throw new Error('htmlIndesignBrowserStyleCapture is not installed');
    return api;
  }

  function rectObject(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function attrs(el) {
    const out = {};
    for (const attr of Array.from(el.attributes || [])) out[attr.name] = attr.value;
    return out;
  }

  function sourceText(el) {
    return String(el.textContent || '');
  }

  function sourceNodeFor(el, pageEl, extra) {
    const node = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      classList: classList(el),
      attributes: attrs(el),
      sourcePath: sourcePathFor(el, pageEl),
    };
    if (extra) {
      for (const key of Object.keys(extra)) node[key] = extra[key];
    }
    return node;
  }

  function sourcePreviewNodeFor(el, frameEl, pageEl) {
    const tagName = el.tagName.toLowerCase();
    if (tagName !== 'object' && tagName !== 'embed') return null;
    if (!frameEl || frameEl === el) return null;
    const preview = frameEl.querySelector('img[data-id-ignore]');
    return preview ? sourceNodeFor(preview, pageEl) : null;
  }

  function sourceHtmlFor(el) {
    const html = String(el.innerHTML || '');
    if (!html) return null;
    return html === sourceText(el) ? null : html;
  }

  function cssVarsFor(el) {
    const style = getComputedStyle(el);
    const out = {};
    for (const name of ['--grid-col', '--grid-span', '--grid-row', '--grid-row-span']) {
      const value = style.getPropertyValue(name);
      if (value && value.trim()) out[name] = value.trim();
    }
    return out;
  }

  function visualFrameFor(el) {
    const tagName = el.tagName.toLowerCase();
    if (!['img', 'object', 'embed', 'svg', 'canvas'].includes(tagName)) return el;
    const parent = el.parentElement;
    if (!parent || !parent.hasAttribute('data-id-ignore')) return el;
    return parent;
  }

  function mergeFrameAttributes(itemAttrs, frameAttrs) {
    if (!frameAttrs || frameAttrs === itemAttrs) return itemAttrs;
    const out = Object.assign({}, frameAttrs, itemAttrs);
    delete out['data-id-ignore'];
    return out;
  }

  function classList(el) {
    return Array.from(el.classList || []);
  }

  function mergeClassList(itemClasses, frameClasses) {
    return Array.from(new Set([...(frameClasses || []), ...(itemClasses || [])]));
  }

  function itemIdFor(el, frameEl, pageIndex, itemIndex) {
    if (frameEl && frameEl !== el) {
      const frameId = frameEl.id || frameEl.getAttribute('data-id');
      if (frameId) return frameId;
    }
    return el.id || el.getAttribute('data-id') || `p${pageIndex + 1}-el${itemIndex + 1}`;
  }

  function unsupportedFor(el) {
    const style = getComputedStyle(el);
    return {
      boxShadow: style.boxShadow && style.boxShadow !== 'none' ? style.boxShadow : '',
      filter: style.filter && style.filter !== 'none' ? style.filter : '',
      maskImage: unsupportedMaskImage(style),
      beforeContent: pseudoContent(el, '::before'),
      afterContent: pseudoContent(el, '::after'),
      markerContent: el.tagName.toLowerCase() === 'li' ? pseudoContent(el, '::marker') : '',
    };
  }

  function isTextTag(tagName) {
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName);
  }

  function collectCandidateElements(pageEl) {
    return Array.from(pageEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,figcaption,img,object,embed,svg,canvas,table,div,span,[data-id-object],[data-id-paragraph-style]'))
      .filter((el) => !el.hasAttribute('data-id-ignore'))
      .filter(isCandidateElement)
      .filter((el) => el.tagName.toLowerCase() === 'table' || !el.closest('table'));
  }

  function textRunsFor(el) {
    const tagName = el.tagName.toLowerCase();
    if (!isTextTag(tagName)) return [];
    const inlineRuns = inlineRunsFor(el);
    if (inlineRuns.length) return inlineRuns;
    return [{
      text: sourceText(el).trim(),
      tagName,
      classList: classList(el),
      attributes: attrs(el),
      computedStyle: styleApi().styleObject(el),
    }].filter((run) => run.text);
  }

  function tableRowsFor(el, styleRules) {
    if (el.tagName.toLowerCase() !== 'table') return [];
    return Array.from(el.rows || []).map((row, rowIndex) => {
      const isHeaderRow = row.parentElement && row.parentElement.tagName.toLowerCase() === 'thead';
      return {
        index: rowIndex,
        header: isHeaderRow,
        cells: Array.from(row.cells || []).map((cell, cellIndex) => ({
          index: cellIndex,
          text: sourceText(cell).trim(),
          tagName: cell.tagName.toLowerCase(),
          header: isHeaderRow || cell.tagName.toLowerCase() === 'th',
          rowSpan: cell.rowSpan || 1,
          colSpan: cell.colSpan || 1,
          classList: classList(cell),
          attributes: attrs(cell),
          rectPx: rectObject(cell.getBoundingClientRect()),
          computedStyle: styleApi().styleObject(cell),
          authoredStyle: styleApi().authoredStyleObject(cell, styleRules),
          runs: inlineRunsFor(cell),
        })),
      };
    });
  }

  function ancestorCandidateIndexes(el, candidates, pageEl) {
    const out = [];
    let parent = el.parentElement;
    while (parent && parent !== pageEl) {
      const index = candidates.indexOf(parent);
      if (index >= 0) out.push(index);
      parent = parent.parentElement;
    }
    return out;
  }

  function ancestorCandidateIds(el, candidates, pageIndex, pageEl) {
    const out = [];
    let parent = el.parentElement;
    while (parent && parent !== pageEl) {
      const index = candidates.indexOf(parent);
      if (index >= 0) out.push(itemIdFor(parent, visualFrameFor(parent), pageIndex, index));
      parent = parent.parentElement;
    }
    return out;
  }

  function sourceAncestorNodes(el, pageEl, candidates) {
    const out = [];
    let parent = el.parentElement;
    while (parent && parent !== pageEl) {
      if (!candidates.includes(parent)) out.unshift(sourceNodeFor(parent, pageEl));
      parent = parent.parentElement;
    }
    return out;
  }

  function sourcePathFor(el, pageEl) {
    const parts = [];
    let current = el;
    while (current && current !== pageEl && current.nodeType === 1) {
      const tag = current.tagName.toLowerCase();
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName && sibling.tagName.toLowerCase() === tag) index += 1;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(`${tag}:nth-of-type(${index})`);
      current = current.parentElement;
    }
    return parts.join('>');
  }

  function inlineRunsFor(el) {
    const inlineSelector = 'span,strong,b,em,i,mark,sup,sub,[data-id-character-style]';
    const inlineEls = Array.from(el.querySelectorAll(inlineSelector));
    return inlineEls.map((runEl) => ({
      text: sourceText(runEl).trim(),
      tagName: runEl.tagName.toLowerCase(),
      classList: classList(runEl),
      attributes: attrs(runEl),
      computedStyle: styleApi().styleObject(runEl),
    })).filter((run) => run.text);
  }

  function isCandidateElement(el) {
    return isSemanticCandidate(el) || isPaintOnlyCandidate(el);
  }

  function isSemanticCandidate(el) {
    const tagName = el.tagName.toLowerCase();
    return isTextTag(tagName)
      || ['img', 'object', 'embed', 'svg', 'canvas', 'table'].includes(tagName)
      || el.hasAttribute('data-id-object')
      || el.hasAttribute('data-id-paragraph-style');
  }

  function isPaintOnlyCandidate(el) {
    if (sourceText(el).trim()) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(el);
    return hasVisibleBackground(style) || hasVisibleBorder(style);
  }

  function hasVisibleBackground(style) {
    return !isTransparentCssColor(style.backgroundColor)
      || Boolean(style.backgroundImage && style.backgroundImage !== 'none');
  }

  function hasVisibleBorder(style) {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const borderStyle = String(style[`border${side}Style`] || '').toLowerCase();
      if (borderStyle === 'none' || borderStyle === 'hidden') continue;
      if (cssPxNumber(style[`border${side}Width`]) <= 0) continue;
      if (isTransparentCssColor(style[`border${side}Color`])) continue;
      return true;
    }
    return false;
  }

  function isTransparentCssColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    return !raw
      || raw === 'transparent'
      || raw === 'rgba(0, 0, 0, 0)'
      || raw === 'rgb(0 0 0 / 0)'
      || /rgba?\([^)]*[,/]\s*0(?:\.0+)?\s*\)$/i.test(raw);
  }

  function cssPxNumber(value) {
    const match = String(value || '').match(/^([+-]?(?:\d+|\d*\.\d+))px$/i);
    return match ? Number(match[1]) : 0;
  }

  function unsupportedMaskImage(style) {
    const value = style.maskImage || style.webkitMaskImage || '';
    return value && value !== 'none' ? value : '';
  }

  function pseudoContent(el, pseudo) {
    const style = getComputedStyle(el, pseudo);
    const content = style && style.content ? String(style.content) : '';
    if (!content || content === 'none' || content === 'normal' || content === '""') return '';
    return content;
  }

  const api = {
    rectObject,
    attrs,
    sourceText,
    sourceNodeFor,
    sourcePreviewNodeFor,
    sourceHtmlFor,
    cssVarsFor,
    visualFrameFor,
    mergeFrameAttributes,
    classList,
    mergeClassList,
    itemIdFor,
    unsupportedFor,
    collectCandidateElements,
    textRunsFor,
    tableRowsFor,
    ancestorCandidateIndexes,
    ancestorCandidateIds,
    sourceAncestorNodes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.htmlIndesignBrowserElementCapture = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
