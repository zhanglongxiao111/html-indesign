(function installBrowserElementCapture(globalObject) {
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

  function rectObject(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function attrs(el) {
    const out = {};
    for (const attr of Array.from(el.attributes || [])) out[attr.name] = attr.value;
    return out;
  }

  function sourceText(el) {
    return textWithHardBreaks(el, '\n');
  }

  function textWithHardBreaks(node, brToken, excludedElements, rootNode) {
    if (!node) return '';
    if (node !== rootNode && excludedElements && excludedElements.has(node)) return '';
    if (node.nodeType === 3) {
      return isRenderedTextParent(node.parentElement) ? String(node.nodeValue || '') : '';
    }
    if (node.nodeType !== 1) return '';
    if (getComputedStyle(node).display === 'none') return '';
    if (String(node.tagName || '').toLowerCase() === 'br') return brToken;
    return Array.from(node.childNodes || [])
      .map((child) => textWithHardBreaks(child, brToken, excludedElements, rootNode))
      .join('');
  }

  function isRenderedTextParent(parent) {
    if (!parent) return false;
    const style = getComputedStyle(parent);
    if (!style || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    let current = parent;
    while (current && current.nodeType === 1) {
      if (getComputedStyle(current).display === 'none') return false;
      current = current.parentElement;
    }
    return true;
  }

  const HARD_BREAK_TOKEN = '\u0000';

  function trimmedTextWithHardBreaks(el, candidates) {
    const excludedElements = new Set(candidateDescendantsFor(el, candidates));
    return textWithHardBreaks(el, HARD_BREAK_TOKEN, excludedElements, el)
      .trim()
      .replace(/[ \t]*\u0000[ \t]*/g, '\n');
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
    const dataId = dataIdAttributes();
    const tagName = el.tagName.toLowerCase();
    if (tagName !== 'object' && tagName !== 'embed') return null;
    const fallback = objectFallbackPreviewFor(el);
    if (fallback) return sourceNodeFor(fallback, pageEl);
    if (!frameEl) return null;
    if (frameEl === el) {
      const previous = el.previousElementSibling;
      return isIgnoredImagePreview(previous, dataId)
        ? sourceNodeFor(previous, pageEl)
        : null;
    }
    const preview = frameEl.querySelector(`img[${dataId.IGNORE}]`);
    return preview ? sourceNodeFor(preview, pageEl) : null;
  }

  function isIgnoredImagePreview(el, dataId) {
    return Boolean(el
      && el.tagName
      && el.tagName.toLowerCase() === 'img'
      && el.hasAttribute(dataId.IGNORE));
  }

  function objectFallbackPreviewFor(objectEl) {
    if (!objectEl || !['object', 'embed'].includes(String(objectEl.tagName || '').toLowerCase())) return null;
    const images = Array.from(objectEl.children || [])
      .filter((child) => String(child.tagName || '').toLowerCase() === 'img');
    return images.length === 1 ? images[0] : null;
  }

  function isObjectFallbackPreview(el) {
    const parent = el && el.parentElement;
    return Boolean(parent
      && String(el.tagName || '').toLowerCase() === 'img'
      && objectFallbackPreviewFor(parent) === el);
  }

  function sourceHtmlFor(el, candidates) {
    const descendants = candidateDescendantsFor(el, candidates);
    if (descendants.length) {
      if (!descendants.every(isInlineSourceCandidate)) return null;
      if (!Array.from(el.querySelectorAll('*')).every(isInlineSourceElement)) return null;
      if (!candidates.includes(el) && trimmedTextWithHardBreaks(el, candidates) !== '') return null;
    }
    const html = String(el.innerHTML || '');
    if (!html) return null;
    return html === sourceText(el) ? null : html;
  }

  function isInlineSourceCandidate(el) {
    const tagName = String(el && el.tagName || '').toLowerCase();
    return ['span', 'strong', 'b', 'em', 'i', 'mark', 'small', 'sup', 'sub'].includes(tagName);
  }

  function isInlineSourceElement(el) {
    const tagName = String(el && el.tagName || '').toLowerCase();
    return tagName === 'br' || isInlineSourceCandidate(el);
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

  const SVG_VECTOR_TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'];
  const SVG_UNSUPPORTED_VISIBLE_TAGS = new Set(['use', 'text', 'image', 'foreignobject']);
  const SVG_DEFINITION_TAGS = new Set([
    'defs', 'marker', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'symbol',
  ]);

  function vectorElementsFor(el) {
    if (!el || String(el.tagName || '').toLowerCase() !== 'svg') return [];
    return Array.from(el.querySelectorAll(SVG_VECTOR_TAGS.join(',')))
      .filter((vectorEl) => !hasSvgDefinitionAncestor(vectorEl, el))
      .filter(isRenderedSvgVectorElement)
      .map((vectorEl) => ({
        tagName: String(vectorEl.tagName || '').toLowerCase(),
        attributes: attrs(vectorEl),
        geometry: vectorElementGeometry(vectorEl),
        computedStyle: vectorElementComputedStyle(vectorEl),
      }));
  }

  function isRenderedSvgVectorElement(vectorEl) {
    return isRenderedSvgNode(vectorEl, vectorEl && vectorEl.ownerSVGElement);
  }

  function svgUnsupportedElementsFor(el) {
    if (!el || String(el.tagName || '').toLowerCase() !== 'svg') return [];
    const nodes = [el, ...Array.from(el.querySelectorAll('*'))]
      .filter((node) => node === el || !isSvgDefinitionNode(node, el))
      .filter((node) => node === el || isRenderedSvgNode(node, el));
    const findings = [];
    for (const node of nodes) {
      const tagName = String(node.tagName || '').toLowerCase();
      if (SVG_UNSUPPORTED_VISIBLE_TAGS.has(tagName)) {
        findings.push({ tagName, reason: 'unsupported-element' });
      } else if (node !== el
        && !SVG_VECTOR_TAGS.includes(tagName)
        && !['g', 'title', 'desc', 'metadata'].includes(tagName)) {
        findings.push({ tagName, reason: 'unsupported-element' });
      }
      for (const finding of unsupportedSvgFactsForNode(node, tagName)) findings.push(finding);
      const invalidGeometry = invalidSvgGeometryFinding(node, tagName);
      if (invalidGeometry) findings.push(invalidGeometry);
    }
    return uniqueSvgFindings(findings);
  }

  function isRenderedSvgNode(node, rootSvg) {
    let current = node;
    while (current) {
      const style = getComputedStyle(current);
      if (!style
        || style.display === 'none'
        || style.visibility === 'hidden'
        || style.visibility === 'collapse') return false;
      if (current === rootSvg) break;
      current = current.parentElement;
    }
    return true;
  }

  function vectorElementGeometry(vectorEl) {
    const tagName = String(vectorEl && vectorEl.tagName || '').toLowerCase();
    if (tagName === 'circle') {
      return {
        cx: svgLengthValue(vectorEl.cx),
        cy: svgLengthValue(vectorEl.cy),
        r: svgLengthValue(vectorEl.r),
      };
    }
    if (tagName === 'ellipse') {
      return {
        cx: svgLengthValue(vectorEl.cx),
        cy: svgLengthValue(vectorEl.cy),
        rx: svgLengthValue(vectorEl.rx),
        ry: svgLengthValue(vectorEl.ry),
      };
    }
    if (tagName === 'rect') {
      return {
        x: svgLengthValue(vectorEl.x),
        y: svgLengthValue(vectorEl.y),
        width: svgLengthValue(vectorEl.width),
        height: svgLengthValue(vectorEl.height),
        ...(vectorEl.hasAttribute('rx') ? { rx: svgLengthValue(vectorEl.rx) } : {}),
        ...(vectorEl.hasAttribute('ry') ? { ry: svgLengthValue(vectorEl.ry) } : {}),
      };
    }
    if (tagName === 'line') {
      return {
        x1: svgLengthValue(vectorEl.x1),
        y1: svgLengthValue(vectorEl.y1),
        x2: svgLengthValue(vectorEl.x2),
        y2: svgLengthValue(vectorEl.y2),
      };
    }
    if (tagName === 'polyline' || tagName === 'polygon') {
      return { points: svgPointListValue(vectorEl.points) };
    }
    if (tagName === 'path') return { d: String(vectorEl.getAttribute('d') || '') };
    return {};
  }

  function svgLengthValue(animatedLength) {
    const value = Number(animatedLength && animatedLength.baseVal && animatedLength.baseVal.value);
    return Number.isFinite(value) ? value : null;
  }

  function svgPointListValue(pointList) {
    const out = [];
    const count = Number(pointList && pointList.numberOfItems || 0);
    for (let index = 0; index < count; index += 1) {
      const point = pointList.getItem(index);
      const x = Number(point && point.x);
      const y = Number(point && point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      out.push({ x, y });
    }
    return out;
  }

  function invalidSvgGeometryFinding(node, tagName) {
    if (!SVG_VECTOR_TAGS.includes(tagName)) return null;
    const geometry = vectorElementGeometry(node);
    let valid = true;
    if (tagName === 'circle') valid = positiveSvgNumber(geometry.r);
    else if (tagName === 'ellipse') valid = positiveSvgNumber(geometry.rx) && positiveSvgNumber(geometry.ry);
    else if (tagName === 'rect') valid = positiveSvgNumber(geometry.width) && positiveSvgNumber(geometry.height);
    else if (tagName === 'line') valid = finiteSvgNumbers(geometry.x1, geometry.y1, geometry.x2, geometry.y2);
    else if (tagName === 'polyline') valid = Array.isArray(geometry.points) && geometry.points.length >= 2;
    else if (tagName === 'polygon') valid = Array.isArray(geometry.points) && geometry.points.length >= 3;
    else if (tagName === 'path') valid = Boolean(String(geometry.d || '').trim());
    return valid ? null : { tagName, reason: 'invalid-geometry' };
  }

  function positiveSvgNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function finiteSvgNumbers() {
    return Array.prototype.every.call(arguments, (value) => Number.isFinite(Number(value)));
  }

  function isSvgDefinitionNode(node, rootSvg) {
    const tagName = String(node && node.tagName || '').toLowerCase();
    return SVG_DEFINITION_TAGS.has(tagName) || hasSvgDefinitionAncestor(node, rootSvg);
  }

  function unsupportedSvgFactsForNode(node, tagName) {
    const findings = [];
    for (const name of ['transform', 'clip-path', 'mask', 'filter']) {
      const value = String(node.getAttribute && node.getAttribute(name) || '').trim();
      if (value && value.toLowerCase() !== 'none') {
        findings.push({ tagName, reason: `unsupported-${name}`, detail: value });
      }
    }
    for (const name of ['fill', 'stroke']) {
      const value = String(node.getAttribute && node.getAttribute(name) || '').trim();
      if (/^url\s*\(/i.test(value)) {
        findings.push({ tagName, reason: 'unsupported-paint-server', detail: `${name}: ${value}` });
      }
    }
    if (tagName === 'path') {
      const d = String(node.getAttribute && node.getAttribute('d') || '');
      const unsupportedCommand = (d.match(/[A-Za-z]/g) || []).find((command) => !/[mMlLcCzZ]/.test(command));
      if (unsupportedCommand) {
        findings.push({ tagName, reason: 'unsupported-path-command', detail: unsupportedCommand });
      }
    }
    const style = getComputedStyle(node);
    if (style && style.transform && style.transform !== 'none') {
      findings.push({ tagName, reason: 'unsupported-transform', detail: style.transform });
    }
    for (const name of ['clip-path', 'mask-image', 'filter']) {
      const value = String(style && style.getPropertyValue(name) || '').trim();
      if (value && value !== 'none') {
        findings.push({ tagName, reason: `unsupported-${name}`, detail: value });
      }
    }
    for (const name of ['fill', 'stroke']) {
      const value = String(style && style.getPropertyValue(name) || '').trim();
      if (/^url\s*\(/i.test(value)) {
        findings.push({ tagName, reason: 'unsupported-paint-server', detail: `${name}: ${value}` });
      }
    }
    return findings;
  }

  function uniqueSvgFindings(findings) {
    const seen = new Set();
    return findings.filter((finding) => {
      const key = `${finding.tagName}|${finding.reason}|${finding.detail || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function hasSvgDefinitionAncestor(vectorEl, rootSvg) {
    let parent = vectorEl && vectorEl.parentElement;
    while (parent && parent !== rootSvg) {
      if (SVG_DEFINITION_TAGS.has(String(parent.tagName || '').toLowerCase())) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function vectorElementComputedStyle(vectorEl) {
    const style = getComputedStyle(vectorEl);
    const out = {};
    for (const name of [
      'fill',
      'fill-opacity',
      'stroke',
      'stroke-width',
      'stroke-opacity',
      'opacity',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-miterlimit',
      'stroke-dasharray',
      'marker-start',
      'marker-end',
      'mix-blend-mode',
    ]) {
      const value = style.getPropertyValue(name);
      if (value != null && String(value).trim()) out[name] = String(value).trim();
    }
    return out;
  }

  function visualFrameFor(el) {
    const dataId = dataIdAttributes();
    const tagName = el.tagName.toLowerCase();
    if (!['img', 'object', 'embed', 'svg', 'canvas'].includes(tagName)) return el;
    const parent = el.parentElement;
    if (!parent) return el;
    if (parent.hasAttribute(dataId.IGNORE)) return parent;
    return isNaturalSingleAssetFrame(parent, el) ? parent : el;
  }

  function isNaturalSingleAssetFrame(frameEl, assetEl) {
    if (!frameEl || !assetEl) return false;
    const dataId = dataIdAttributes();
    const frameTag = String(frameEl.tagName || '').toLowerCase();
    if (!['div', 'figure'].includes(frameTag)) return false;
    if (sourceText(frameEl).trim()) return false;
    const ownAssetSources = [
      frameEl.getAttribute('src'),
      frameEl.getAttribute('href'),
      frameEl.getAttribute('data'),
      frameEl.getAttribute(dataId.ASSET_PATH),
    ];
    if (ownAssetSources.some((value) => value != null && String(value).trim() !== '')) return false;
    const contentChildren = Array.from(frameEl.children || [])
      .filter((child) => !child.hasAttribute(dataId.IGNORE));
    if (contentChildren.length !== 1 || contentChildren[0] !== assetEl) return false;
    return ['img', 'object', 'embed', 'svg', 'canvas'].includes(String(assetEl.tagName || '').toLowerCase());
  }

  function mergeFrameAttributes(itemAttrs, frameAttrs) {
    const dataId = dataIdAttributes();
    if (!frameAttrs || frameAttrs === itemAttrs) return itemAttrs;
    const out = Object.assign({}, frameAttrs, itemAttrs);
    delete out[dataId.IGNORE];
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
      clipPath: style.clipPath && style.clipPath !== 'none' ? style.clipPath : '',
      maskImage: unsupportedMaskImage(style),
      beforeContent: pseudoContent(el, '::before'),
      afterContent: pseudoContent(el, '::after'),
      beforePaint: pseudoPaint(el, '::before'),
      afterPaint: pseudoPaint(el, '::after'),
      markerContent: el.tagName.toLowerCase() === 'li' ? pseudoContent(el, '::marker') : '',
      svgUnsupportedElements: svgUnsupportedElementsFor(el),
    };
  }

  function isTextTag(tagName) {
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName);
  }

  function isNaturalTextElement(el) {
    const tagName = String(el && el.tagName || '').toLowerCase();
    if (tagName !== 'div') return false;
    if (!sourceText(el).trim()) return false;
    const dataId = dataIdAttributes();
    if (el.querySelector(`h1,h2,h3,h4,h5,h6,p,li,figcaption,hr,img,object,embed,svg,canvas,table,[${dataId.OBJECT}],[${dataId.PARAGRAPH_STYLE}]`)) return false;
    return Array.from(el.children || []).every(isInlineSourceElement);
  }

  function collectCandidateElements(pageEl) {
    const dataId = dataIdAttributes();
    const candidates = Array.from(pageEl.querySelectorAll(`h1,h2,h3,h4,h5,h6,p,li,figcaption,hr,img,object,embed,svg,canvas,table,div,span,[${dataId.OBJECT}],[${dataId.PARAGRAPH_STYLE}]`))
      .filter((el) => !el.hasAttribute(dataId.IGNORE))
      .filter((el) => !isObjectFallbackPreview(el))
      .filter(isCandidateElement)
      .filter((el) => {
        const contentChildren = Array.from(el.children || [])
          .filter((child) => !child.hasAttribute(dataId.IGNORE));
        return contentChildren.length !== 1 || !isNaturalSingleAssetFrame(el, contentChildren[0]);
      })
      .filter((el) => el.tagName.toLowerCase() === 'table' || !el.closest('table'));
    return candidates.filter((el) => !isRedundantTextContainer(el, candidates));
  }

  function collectUncapturedTextElements(pageEl, candidates) {
    const dataId = dataIdAttributes();
    return Array.from(pageEl.querySelectorAll('*')).filter((el) => {
      const tagName = String(el.tagName || '').toLowerCase();
      if (['script', 'style', 'template', 'noscript'].includes(tagName)) return false;
      if (el.closest(`[${dataId.IGNORE}]`)) return false;
      if (!directText(el)) return false;
      if (candidateCoversText(el, candidates, dataId)) return false;
      return !candidates.some((candidate) => (
        candidate !== el
          && candidate.contains(el)
          && candidateCoversText(candidate, candidates, dataId)
      ));
    }).map((el) => ({
      id: el.id || el.getAttribute('data-id') || null,
      tagName: el.tagName.toLowerCase(),
      text: directText(el),
      sourcePath: sourcePathFor(el, pageEl),
    }));
  }

  function candidateCoversText(el, candidates, dataId) {
    if (!candidates.includes(el)) return false;
    const tagName = String(el.tagName || '').toLowerCase();
    if (isTextTag(tagName) || isNaturalTextElement(el) || tagName === 'table' || tagName === 'svg') return true;
    if (el.hasAttribute(dataId.PARAGRAPH_STYLE)) return true;
    return String(el.getAttribute(dataId.ROLE) || '').trim().toLowerCase() === 'text';
  }

  function directText(el) {
    return Array.from(el.childNodes || [])
      .filter((node) => node.nodeType === 3)
      .map((node) => String(node.nodeValue || ''))
      .join(' ')
      .trim();
  }

  function candidateDescendantsFor(el, candidates) {
    if (!el || !Array.isArray(candidates)) return [];
    return candidates.filter((candidate) => candidate !== el && el.contains(candidate));
  }

  function isRedundantTextContainer(el, candidates) {
    if (!isTextTag(String(el && el.tagName || '').toLowerCase())) return false;
    if (!candidateDescendantsFor(el, candidates).length) return false;
    return trimmedTextWithHardBreaks(el, candidates) === '';
  }

  function textRunsFor(el, candidates) {
    const tagName = el.tagName.toLowerCase();
    if (!isTextTag(tagName) && !isNaturalTextElement(el)) return [];
    const inlineRuns = inlineRunsFor(el, candidates);
    if (inlineRuns.length) return inlineRuns;
    return [{
      text: trimmedTextWithHardBreaks(el, candidates),
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
          text: trimmedTextWithHardBreaks(cell),
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
      if (!candidates.includes(parent)) {
        const sourceHtml = sourceHtmlFor(parent, candidates);
        out.unshift(sourceNodeFor(parent, pageEl, sourceHtml == null ? null : { sourceHtml }));
      }
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

  function inlineRunsFor(el, candidates) {
    const dataId = dataIdAttributes();
    const inlineSelector = `span,strong,b,em,i,mark,sup,sub,[${dataId.CHARACTER_STYLE}]`;
    const inlineEls = Array.from(el.querySelectorAll(inlineSelector))
      .filter((runEl) => !Array.isArray(candidates) || !candidates.includes(runEl));
    return inlineEls.map((runEl) => ({
      text: trimmedTextWithHardBreaks(runEl),
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
    const dataId = dataIdAttributes();
    const tagName = el.tagName.toLowerCase();
    return isTextTag(tagName)
      || isNaturalTextElement(el)
      || ['hr', 'img', 'object', 'embed', 'svg', 'canvas', 'table'].includes(tagName)
      || el.hasAttribute(dataId.OBJECT)
      || el.hasAttribute(dataId.PARAGRAPH_STYLE);
  }

  function isPaintOnlyCandidate(el) {
    if (sourceText(el).trim()) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(el);
    return hasVisibleBackground(style)
      || hasVisibleCssBorder(style)
      || Boolean(pseudoPaint(el, '::before'))
      || Boolean(pseudoPaint(el, '::after'));
  }

  function hasVisibleBackground(style) {
    return !isTransparentCssColor(style.backgroundColor)
      || Boolean(style.backgroundImage && style.backgroundImage !== 'none');
  }

  function hasVisibleCssBorder(style) {
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
    if (!raw || raw === 'transparent') return true;
    const slashAlpha = raw.match(/^rgba?\([^/]+\/\s*([+-]?(?:\d+|\d*\.\d+))%?\s*\)$/i);
    if (slashAlpha) return Number(slashAlpha[1]) === 0;
    const commaAlpha = raw.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([+-]?(?:\d+|\d*\.\d+))\s*\)$/i);
    return Boolean(commaAlpha && Number(commaAlpha[1]) === 0);
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

  function pseudoPaint(el, pseudo) {
    const style = getComputedStyle(el, pseudo);
    if (!style || style.display === 'none') return null;
    if (!hasVisibleBackground(style) && !hasVisibleCssBorder(style)) return null;
    return {
      visible: true,
      display: style.display || '',
      width: style.width || '',
      height: style.height || '',
      backgroundColor: style.backgroundColor || '',
      backgroundImage: style.backgroundImage || '',
      borderTop: visibleBorderSummary(style, 'Top'),
      borderRight: visibleBorderSummary(style, 'Right'),
      borderBottom: visibleBorderSummary(style, 'Bottom'),
      borderLeft: visibleBorderSummary(style, 'Left'),
    };
  }

  function visibleBorderSummary(style, side) {
    const borderStyle = String(style[`border${side}Style`] || '').toLowerCase();
    const width = style[`border${side}Width`] || '';
    const color = style[`border${side}Color`] || '';
    if (borderStyle === 'none' || borderStyle === 'hidden') return '';
    if (cssPxNumber(width) <= 0 || isTransparentCssColor(color)) return '';
    return `${width} ${borderStyle} ${color}`;
  }

  const api = {
    rectObject,
    attrs,
    sourceText,
    trimmedTextWithHardBreaks,
    sourceNodeFor,
    sourcePreviewNodeFor,
    sourceHtmlFor,
    cssVarsFor,
    vectorElementsFor,
    visualFrameFor,
    mergeFrameAttributes,
    classList,
    mergeClassList,
    itemIdFor,
    unsupportedFor,
    collectCandidateElements,
    collectUncapturedTextElements,
    isNaturalTextElement,
    textRunsFor,
    tableRowsFor,
    ancestorCandidateIndexes,
    ancestorCandidateIds,
    sourceAncestorNodes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.htmlIndesignBrowserElementCapture = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
