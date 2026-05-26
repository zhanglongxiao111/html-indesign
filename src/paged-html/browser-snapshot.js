const path = require('path');
const { chromium } = require('playwright');
const { rectPxToMm, round } = require('../shared/geometry');
const { createReport, addMessage } = require('../shared/report');
const { inferAssetKind, assetSourceFromElementLike } = require('../shared/assets');
const { detectAssetsFromItems } = require('./asset-detector');
const { defaultPageSelector } = require('./page-detector');

async function renderSnapshot(options) {
  const htmlPath = path.resolve(options.htmlPath);
  const pageSelector = options.pageSelector || defaultPageSelector();
  const report = createReport();
  addMessage(report, 'info', 'SNAPSHOT_START', 'Browser snapshot started', { htmlPath });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(images.map((img) => img.complete ? undefined : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })));
    });

    const raw = await page.evaluate((selector) => {
      const snapshotStyleProps = [
        'position',
        'display',
        'left',
        'top',
        'width',
        'height',
        'zIndex',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'lineHeight',
        'letterSpacing',
        'color',
        'textAlign',
        'textDecorationLine',
        'textTransform',
        'verticalAlign',
        'marginTop',
        'marginRight',
        'marginBottom',
        'marginLeft',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'gridTemplateColumns',
        'gridTemplateRows',
        'columnGap',
        'rowGap',
        'gap',
        'backgroundColor',
        'backgroundImage',
        'borderTopColor',
        'borderTopWidth',
        'borderTopStyle',
        'borderRightColor',
        'borderRightWidth',
        'borderRightStyle',
        'borderBottomColor',
        'borderBottomWidth',
        'borderBottomStyle',
        'borderLeftColor',
        'borderLeftWidth',
        'borderLeftStyle',
        'borderRadius',
        'opacity',
        'objectFit',
        'objectPosition',
        'overflow',
        'transform',
        'boxShadow',
        'filter',
        'maskImage',
        'webkitMaskImage',
      ];
      function styleObject(el) {
        const style = getComputedStyle(el);
        const out = {};
        for (const prop of snapshotStyleProps) {
          out[prop] = style[prop];
        }
        return out;
      }
      function cssPropertyName(prop) {
        return prop.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
      }
      function authoredValue(styleDecl, prop, rawDecls) {
        const direct = styleDecl.getPropertyValue(cssPropertyName(prop)) || styleDecl[prop] || '';
        if (direct) return direct;
        const rawDirect = rawDecls && rawDecls[cssPropertyName(prop)];
        if (rawDirect) return rawDirect;
        const border = prop.match(/^border(Top|Right|Bottom|Left)(Width|Style|Color)$/);
        if (!border) return '';
        const side = border[1].toLowerCase();
        const kind = border[2].toLowerCase();
        const rawSideShorthand = rawDecls && rawDecls[`border-${side}`];
        if (rawSideShorthand) return borderShorthandValue(rawSideShorthand, kind);
        const rawBoxShorthand = rawDecls && rawDecls[`border-${kind}`];
        if (rawBoxShorthand) return borderBoxSideValue(rawBoxShorthand, side);
        const rawShorthand = rawDecls && rawDecls.border;
        if (rawShorthand) return borderShorthandValue(rawShorthand, kind);
        const sideShorthand = styleDecl.getPropertyValue(`border-${side}`) || '';
        if (sideShorthand) return borderShorthandValue(sideShorthand, kind);
        const boxShorthand = styleDecl.getPropertyValue(`border-${kind}`) || '';
        if (boxShorthand) return borderBoxSideValue(boxShorthand, side);
        const shorthand = styleDecl.getPropertyValue('border') || '';
        return borderShorthandValue(shorthand, kind);
      }
      function borderBoxSideValue(value, side) {
        const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '';
        const values = parts.length === 1
          ? [parts[0], parts[0], parts[0], parts[0]]
          : parts.length === 2
            ? [parts[0], parts[1], parts[0], parts[1]]
            : parts.length === 3
              ? [parts[0], parts[1], parts[2], parts[1]]
              : [parts[0], parts[1], parts[2], parts[3]];
        const index = { top: 0, right: 1, bottom: 2, left: 3 }[side];
        return values[index] || '';
      }
      function borderShorthandValue(value, kind) {
        const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
        const styles = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);
        if (kind === 'width') return parts.find((part) => /^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)$/i.test(part) || ['thin', 'medium', 'thick'].includes(part)) || '';
        if (kind === 'style') return parts.find((part) => styles.has(part.toLowerCase())) || '';
        if (kind === 'color') return parts.find((part) => !styles.has(part.toLowerCase()) && !/^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)$/i.test(part)) || '';
        return '';
      }
      function collectStyleRules() {
        const rules = [];
        const rawBlocks = collectRawStyleBlocks();
        const used = new Map();
        for (const sheet of Array.from(document.styleSheets || [])) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) {
              if (rule.type === CSSRule.STYLE_RULE) {
                rules.push({
                  selectorText: rule.selectorText,
                  style: rule.style,
                  rawDecls: rawDeclarationMap(rawBlockForRule(rule.selectorText, rawBlocks, used)),
                });
              }
            }
          } catch (_) {}
        }
        return rules;
      }
      function collectRawStyleBlocks() {
        const source = Array.from(document.querySelectorAll('style'))
          .map((el) => el.textContent || '')
          .join('\n');
        const blocks = [];
        let cursor = 0;
        while (cursor < source.length) {
          const open = source.indexOf('{', cursor);
          if (open === -1) break;
          const selectorText = source.slice(cursor, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
          let depth = 1;
          let close = open + 1;
          while (close < source.length && depth > 0) {
            if (source[close] === '{') depth += 1;
            if (source[close] === '}') depth -= 1;
            close += 1;
          }
          const declarations = source.slice(open + 1, close - 1);
          if (selectorText && selectorText[0] !== '@') {
            blocks.push({
              selectorText: normalizeSelectorText(selectorText),
              declarations,
            });
          }
          cursor = close;
        }
        return blocks;
      }
      function rawBlockForRule(selectorText, rawBlocks, used) {
        const normalized = normalizeSelectorText(selectorText);
        const next = used.get(normalized) || 0;
        let seen = 0;
        for (const block of rawBlocks) {
          if (block.selectorText !== normalized) continue;
          if (seen === next) {
            used.set(normalized, next + 1);
            return block.declarations;
          }
          seen += 1;
        }
        return '';
      }
      function normalizeSelectorText(value) {
        return String(value || '')
          .replace(/\s*,\s*/g, ', ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      function rawDeclarationMap(rawStyle) {
        const out = {};
        for (const declaration of String(rawStyle || '').split(';')) {
          const colon = declaration.indexOf(':');
          if (colon === -1) continue;
          const name = declaration.slice(0, colon).trim().toLowerCase();
          const value = declaration.slice(colon + 1).trim();
          if (name && value) out[name] = value;
        }
        return out;
      }
      function authoredStyleObject(el, styleRules) {
        const out = {};
        for (const prop of snapshotStyleProps) out[prop] = '';
        for (const rule of styleRules) {
          try {
            if (!el.matches(rule.selectorText)) continue;
          } catch (_) {
            continue;
          }
          for (const prop of snapshotStyleProps) {
            const value = authoredValue(rule.style, prop, rule.rawDecls);
            if (value) out[prop] = value.trim();
          }
        }
        const inline = el.style || {};
        const inlineDecls = rawDeclarationMap(inline.cssText || '');
        for (const prop of snapshotStyleProps) {
          const value = inline.getPropertyValue ? authoredValue(inline, prop, inlineDecls) : '';
          if (value) out[prop] = value.trim();
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
      function mergeVisualFrameStyle(itemStyle, frameStyle) {
        const out = Object.assign({}, itemStyle);
        for (const prop of [
          'backgroundColor',
          'backgroundImage',
          'borderTopColor',
          'borderTopWidth',
          'borderTopStyle',
          'borderRightColor',
          'borderRightWidth',
          'borderRightStyle',
          'borderBottomColor',
          'borderBottomWidth',
          'borderBottomStyle',
          'borderLeftColor',
          'borderLeftWidth',
          'borderLeftStyle',
          'borderRadius',
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
          'overflow',
          'opacity',
        ]) {
          if (frameStyle[prop]) out[prop] = frameStyle[prop];
        }
        return out;
      }
      function rectObject(rect) {
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
      function attrs(el) {
        const out = {};
        for (const attr of Array.from(el.attributes || [])) out[attr.name] = attr.value;
        return out;
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
      function isTextTag(tagName) {
        return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName);
      }
      function isSemanticCandidate(el) {
        const tagName = el.tagName.toLowerCase();
        return isTextTag(tagName)
          || ['img', 'object', 'embed', 'svg', 'canvas', 'table'].includes(tagName)
          || el.hasAttribute('data-id-object')
          || el.hasAttribute('data-id-paragraph-style');
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
      function hasVisibleBackground(style) {
        return !isTransparentCssColor(style.backgroundColor)
          || Boolean(style.backgroundImage && style.backgroundImage !== 'none');
      }
      function isPaintOnlyCandidate(el) {
        if (String(el.innerText || el.textContent || '').trim()) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = getComputedStyle(el);
        return hasVisibleBackground(style) || hasVisibleBorder(style);
      }
      function isCandidateElement(el) {
        return isSemanticCandidate(el) || isPaintOnlyCandidate(el);
      }
      function inlineRunsFor(el) {
        const inlineSelector = 'span,strong,b,em,i,mark,sup,sub,[data-id-character-style]';
        const inlineEls = Array.from(el.querySelectorAll(inlineSelector));
        return inlineEls.map((runEl) => ({
          text: (runEl.innerText || runEl.textContent || '').trim(),
          tagName: runEl.tagName.toLowerCase(),
          classList: classList(runEl),
          attributes: attrs(runEl),
          computedStyle: styleObject(runEl),
        })).filter((run) => run.text);
      }
      function textRunsFor(el) {
        const tagName = el.tagName.toLowerCase();
        if (!isTextTag(tagName)) return [];
        const inlineRuns = inlineRunsFor(el);
        if (inlineRuns.length) return inlineRuns;
        return [{
          text: (el.innerText || el.textContent || '').trim(),
          tagName,
          classList: classList(el),
          attributes: attrs(el),
          computedStyle: styleObject(el),
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
              text: (cell.innerText || cell.textContent || '').trim(),
              tagName: cell.tagName.toLowerCase(),
              header: isHeaderRow || cell.tagName.toLowerCase() === 'th',
              rowSpan: cell.rowSpan || 1,
              colSpan: cell.colSpan || 1,
              classList: classList(cell),
              attributes: attrs(cell),
              rectPx: rectObject(cell.getBoundingClientRect()),
              computedStyle: styleObject(cell),
              authoredStyle: authoredStyleObject(cell, styleRules),
              runs: inlineRunsFor(cell),
            })),
          };
        });
      }
      function ancestorCandidateIndexes(el, candidates) {
        const out = [];
        let parent = el.parentElement;
        while (parent && candidates[0] && parent !== candidates[0].closest(selector)) {
          const index = candidates.indexOf(parent);
          if (index >= 0) out.push(index);
          parent = parent.parentElement;
        }
        return out;
      }
      function ancestorCandidateIds(el, candidates, pageIndex) {
        const out = [];
        let parent = el.parentElement;
        while (parent && candidates[0] && parent !== candidates[0].closest(selector)) {
          const index = candidates.indexOf(parent);
          if (index >= 0) out.push(itemIdFor(parent, visualFrameFor(parent), pageIndex, index));
          parent = parent.parentElement;
        }
        return out;
      }
      const pageEls = Array.from(document.querySelectorAll(selector));
      const styleRules = collectStyleRules();
      const deckEl = document.querySelector('main.deck') || document.body;
      const styleFiles = Array.from(document.querySelectorAll('style[data-source-file]'))
        .map((el) => el.getAttribute('data-source-file'))
        .filter(Boolean);
      const pageFiles = pageEls.map((pageEl) => ({
        id: pageEl.getAttribute('data-page') || pageEl.id || '',
        file: pageEl.getAttribute('data-id-source-file') || '',
      })).filter((page) => page.id && page.file);
      const pages = pageEls.map((pageEl, pageIndex) => {
        const pageRect = rectObject(pageEl.getBoundingClientRect());
        const pageStyle = getComputedStyle(pageEl);
        const candidates = Array.from(pageEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,figcaption,img,object,embed,svg,canvas,table,div,span,[data-id-object],[data-id-paragraph-style]'))
          .filter((el) => !el.hasAttribute('data-id-ignore'))
          .filter(isCandidateElement)
          .filter((el) => el.tagName.toLowerCase() === 'table' || !el.closest('table'));
        return {
          id: pageEl.id || pageEl.getAttribute('data-page-id') || `page-${pageIndex + 1}`,
          index: pageIndex,
          classList: classList(pageEl),
          attributes: attrs(pageEl),
          sourceFile: pageEl.getAttribute('data-id-source-file') || null,
          sourceNode: {
            tagName: pageEl.tagName.toLowerCase(),
            id: pageEl.id || null,
            classList: classList(pageEl),
            attributes: attrs(pageEl),
          },
          rectPx: pageRect,
          widthCss: pageStyle.width,
          heightCss: pageStyle.height,
          computedStyle: styleObject(pageEl),
          authoredStyle: authoredStyleObject(pageEl, styleRules),
          items: candidates.map((el, itemIndex) => {
            const frameEl = visualFrameFor(el);
            const itemStyle = styleObject(el);
            const frameStyle = styleObject(frameEl);
            const itemAuthoredStyle = authoredStyleObject(el, styleRules);
            const frameAuthoredStyle = authoredStyleObject(frameEl, styleRules);
            const itemAttrs = attrs(el);
            const frameAttrs = attrs(frameEl);
            return {
              id: itemIdFor(el, frameEl, pageIndex, itemIndex),
              tagName: el.tagName.toLowerCase(),
              classList: mergeClassList(classList(el), classList(frameEl)),
              attributes: mergeFrameAttributes(itemAttrs, frameAttrs),
              sourceNode: {
                tagName: el.tagName.toLowerCase(),
                id: itemIdFor(el, frameEl, pageIndex, itemIndex),
                classList: mergeClassList(classList(el), classList(frameEl)),
                attributes: mergeFrameAttributes(itemAttrs, frameAttrs),
              },
              cssVars: cssVarsFor(el),
              rectPx: rectObject(frameEl.getBoundingClientRect()),
              text: el.innerText || el.textContent || '',
              computedStyle: mergeVisualFrameStyle(itemStyle, frameStyle),
              authoredStyle: mergeVisualFrameStyle(itemAuthoredStyle, frameAuthoredStyle),
              runs: textRunsFor(el),
              table: tableRowsFor(el, styleRules),
              unsupported: unsupportedFor(el),
              candidateIndex: itemIndex,
              ancestorCandidateIndexes: ancestorCandidateIndexes(el, candidates),
              ancestorCandidateIds: ancestorCandidateIds(el, candidates, pageIndex),
            };
          }),
        };
      });
      return {
        sourcePackageInput: {
          attributes: attrs(deckEl),
          styleFiles,
          pageFiles,
          assetRoot: 'assets',
        },
        pages,
      };
    }, pageSelector);

    const rawPages = Array.isArray(raw) ? raw : raw.pages || [];
    const sourcePackageInput = Array.isArray(raw) ? null : raw.sourcePackageInput || null;
    const pages = rawPages.map((pageInfo) => {
      const widthMm = cssPixelsToMm(pageInfo.rectPx.width);
      const heightMm = cssPixelsToMm(pageInfo.rectPx.height);
      const items = pageInfo.items
        .filter((item) => item.rectPx.width > 0 && item.rectPx.height > 0)
        .map((item) => ({
          id: item.id,
          role: roleFromItem(item),
          sourceSelector: selectorFor(item),
          tagName: item.tagName,
          classList: item.classList,
          attributes: item.attributes,
          sourceNode: item.sourceNode || null,
          cssVars: item.cssVars || {},
          text: item.text.trim(),
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
          unsupported: item.unsupported || {},
          runs: item.runs,
          table: tableRowsWithBounds(item.table || [], pageInfo.rectPx, widthMm, heightMm),
          documentOrder: item.candidateIndex,
          ancestorCandidateIndexes: item.ancestorCandidateIndexes || [],
          ancestorCandidateIds: item.ancestorCandidateIds || [],
        }));
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
    });

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

function parseZIndex(value) {
  if (value == null || value === 'auto') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tableRowsWithBounds(rows, pageRectPx, pageWidthMm, pageHeightMm) {
  return rows.map((row) => ({
    ...row,
    cells: (row.cells || []).map((cell) => {
      if (!cell.rectPx) return cell;
      return {
        ...cell,
        boundsMm: roundBounds(rectPxToMm({
          rectPx: cell.rectPx,
          pageRectPx,
          pageWidthMm,
          pageHeightMm,
        }), 2),
      };
    }),
  }));
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

function collectUnsupportedWarnings(pages, warnings, report) {
  for (const pageInfo of pages) {
    for (const item of pageInfo.items) {
      const unsupported = item.unsupported || {};
      const effects = ['boxShadow', 'filter', 'maskImage'].filter((prop) => unsupported[prop]);
      if (effects.length) {
        const warning = {
          code: 'CSS_EFFECT_UNSUPPORTED',
          message: 'CSS visual effect is captured but not translated to native InDesign output yet.',
          itemId: item.id,
          effects: Object.fromEntries(effects.map((prop) => [prop, unsupported[prop]])),
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
      const pseudo = ['beforeContent', 'afterContent', 'markerContent'].filter((prop) => unsupported[prop]);
      if (pseudo.length) {
        const warning = {
          code: 'PSEUDO_CONTENT_UNSUPPORTED',
          message: 'CSS pseudo content is captured but not translated to native InDesign output yet.',
          itemId: item.id,
          content: Object.fromEntries(pseudo.map((prop) => [prop, unsupported[prop]])),
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
      if (item.tagName === 'li') {
        const warning = {
          code: 'LIST_MARKER_UNSUPPORTED',
          message: 'HTML list markers are not translated to native InDesign bullets yet.',
          itemId: item.id,
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
      if ((item.tagName === 'svg' || item.tagName === 'canvas') && !assetSourceFromElementLike(item).src) {
        const code = item.tagName === 'svg' ? 'INLINE_SVG_UNSUPPORTED' : 'CANVAS_FALLBACK_UNSUPPORTED';
        const warning = {
          code,
          message: `${item.tagName.toUpperCase()} fallback asset generation is not implemented yet.`,
          itemId: item.id,
        };
        warnings.push(warning);
        addMessage(report, 'warning', warning.code, warning.message, warning);
      }
    }
  }
}

function roleFromItem(item) {
  const tagName = item.tagName;
  const attributes = item.attributes || {};
  const source = assetSourceFromElementLike({ tagName, attributes, computedStyle: item.computedStyle, authoredStyle: item.authoredStyle });
  if (source.src && inferAssetKind(source.src, source.explicitKind) !== 'unknown') return 'graphic';
  if (attributes['data-id-paragraph-style']) return 'text';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName)) return 'text';
  if (['img', 'object', 'embed', 'svg', 'canvas'].includes(tagName)) return 'graphic';
  if (tagName === 'table') return 'table';
  return 'shape';
}

function selectorFor(item) {
  if (item.attributes.id) return `#${item.attributes.id}`;
  if (item.classList.length) return `${item.tagName}.${item.classList.join('.')}`;
  return item.tagName;
}

module.exports = {
  renderSnapshot,
};
