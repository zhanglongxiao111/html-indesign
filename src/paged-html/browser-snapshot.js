const path = require('path');
const { chromium } = require('playwright');
const { rectPxToMm, round } = require('../shared/geometry');
const { createReport, addMessage } = require('../shared/report');
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
      function authoredValue(styleDecl, prop) {
        const direct = styleDecl.getPropertyValue(cssPropertyName(prop)) || styleDecl[prop] || '';
        if (direct) return direct;
        const border = prop.match(/^border(Top|Right|Bottom|Left)(Width|Style|Color)$/);
        if (!border) return '';
        const side = border[1].toLowerCase();
        const kind = border[2].toLowerCase();
        const shorthand = styleDecl.getPropertyValue(`border-${side}`) || styleDecl.getPropertyValue('border') || '';
        return borderShorthandValue(shorthand, kind);
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
        for (const sheet of Array.from(document.styleSheets || [])) {
          try {
            for (const rule of Array.from(sheet.cssRules || [])) {
              if (rule.type === CSSRule.STYLE_RULE) rules.push(rule);
            }
          } catch (_) {}
        }
        return rules;
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
            const value = authoredValue(rule.style, prop);
            if (value) out[prop] = value.trim();
          }
        }
        const inline = el.style || {};
        for (const prop of snapshotStyleProps) {
          const value = inline.getPropertyValue ? authoredValue(inline, prop) : '';
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
      function classList(el) {
        return Array.from(el.classList || []);
      }
      function isTextTag(tagName) {
        return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption'].includes(tagName);
      }
      function textRunsFor(el) {
        const tagName = el.tagName.toLowerCase();
        if (!isTextTag(tagName)) return [];
        const inlineSelector = 'span,strong,b,em,i,mark,sup,sub,[data-id-character-style]';
        const inlineEls = Array.from(el.querySelectorAll(inlineSelector));
        if (inlineEls.length === 0) {
          return [{
            text: (el.innerText || el.textContent || '').trim(),
            tagName,
            classList: classList(el),
            attributes: attrs(el),
            computedStyle: styleObject(el),
          }].filter((run) => run.text);
        }
        return inlineEls.map((runEl) => ({
          text: (runEl.innerText || runEl.textContent || '').trim(),
          tagName: runEl.tagName.toLowerCase(),
          classList: classList(runEl),
          attributes: attrs(runEl),
          computedStyle: styleObject(runEl),
        })).filter((run) => run.text);
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
      const pageEls = Array.from(document.querySelectorAll(selector));
      const styleRules = collectStyleRules();
      return pageEls.map((pageEl, pageIndex) => {
        const pageRect = rectObject(pageEl.getBoundingClientRect());
        const pageStyle = getComputedStyle(pageEl);
        const candidates = Array.from(pageEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,figcaption,img,object,embed,svg,canvas,table,[data-id-object],[data-id-paragraph-style]'))
          .filter((el) => !el.hasAttribute('data-id-ignore'))
          .filter((el) => el.tagName.toLowerCase() === 'table' || !el.closest('table'));
        return {
          id: pageEl.id || pageEl.getAttribute('data-page-id') || `page-${pageIndex + 1}`,
          index: pageIndex,
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
            return {
              id: el.id || el.getAttribute('data-id') || `p${pageIndex + 1}-el${itemIndex + 1}`,
              tagName: el.tagName.toLowerCase(),
              classList: classList(el),
              attributes: attrs(el),
              rectPx: rectObject(frameEl.getBoundingClientRect()),
              text: el.innerText || el.textContent || '',
              computedStyle: mergeVisualFrameStyle(itemStyle, frameStyle),
              authoredStyle: mergeVisualFrameStyle(itemAuthoredStyle, frameAuthoredStyle),
              runs: textRunsFor(el),
              table: tableRowsFor(el, styleRules),
              candidateIndex: itemIndex,
              ancestorCandidateIndexes: ancestorCandidateIndexes(el, candidates),
            };
          }),
        };
      });
    }, pageSelector);

    const pages = raw.map((pageInfo) => {
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
          runs: item.runs,
          table: tableRowsWithBounds(item.table || [], pageInfo.rectPx, widthMm, heightMm),
          documentOrder: item.candidateIndex,
          ancestorCandidateIndexes: item.ancestorCandidateIndexes || [],
        }));
      applyNestedPaintOrder(items);
      return {
        id: pageInfo.id,
        index: pageInfo.index,
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

    const allItems = pages.flatMap((pageInfo) => pageInfo.items);
    const assets = detectAssetsFromItems(allItems, htmlPath);

    return {
      metadata: {
        source: htmlPath,
        capturedAt: new Date().toISOString(),
      },
      pages,
      assets,
      warnings: [],
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

function roleFromItem(item) {
  const tagName = item.tagName;
  const attributes = item.attributes || {};
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
