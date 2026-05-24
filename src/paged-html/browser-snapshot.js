const path = require('path');
const { chromium } = require('playwright');
const { rectPxToMm, round } = require('../shared/geometry');
const { defaultPageSelector } = require('./page-detector');

async function renderSnapshot(options) {
  const htmlPath = path.resolve(options.htmlPath);
  const pageSelector = options.pageSelector || defaultPageSelector();
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
      function styleObject(el) {
        const style = getComputedStyle(el);
        return {
          position: style.position,
          display: style.display,
          zIndex: style.zIndex,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderTopColor: style.borderTopColor,
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          borderRadius: style.borderRadius,
          opacity: style.opacity,
          objectFit: style.objectFit,
          objectPosition: style.objectPosition,
          overflow: style.overflow,
          transform: style.transform,
        };
      }
      function rectObject(rect) {
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
      function attrs(el) {
        const out = {};
        for (const attr of Array.from(el.attributes || [])) out[attr.name] = attr.value;
        return out;
      }
      const pageEls = Array.from(document.querySelectorAll(selector));
      return pageEls.map((pageEl, pageIndex) => {
        const pageRect = rectObject(pageEl.getBoundingClientRect());
        const pageStyle = getComputedStyle(pageEl);
        const candidates = Array.from(pageEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,figcaption,img,object,embed,svg,canvas,table,[data-id-object]'));
        return {
          id: pageEl.id || pageEl.getAttribute('data-page-id') || `page-${pageIndex + 1}`,
          index: pageIndex,
          rectPx: pageRect,
          widthCss: pageStyle.width,
          heightCss: pageStyle.height,
          items: candidates.map((el, itemIndex) => ({
            id: el.id || el.getAttribute('data-id') || `p${pageIndex + 1}-el${itemIndex + 1}`,
            tagName: el.tagName.toLowerCase(),
            classList: Array.from(el.classList || []),
            attributes: attrs(el),
            rectPx: rectObject(el.getBoundingClientRect()),
            text: el.innerText || el.textContent || '',
            computedStyle: styleObject(el),
          })),
        };
      });
    }, pageSelector);

    const pages = raw.map((pageInfo) => {
      const widthMm = cssPixelsToMm(pageInfo.rectPx.width);
      const heightMm = cssPixelsToMm(pageInfo.rectPx.height);
      return {
        id: pageInfo.id,
        index: pageInfo.index,
        widthMm: round(widthMm, 2),
        heightMm: round(heightMm, 2),
        rectPx: pageInfo.rectPx,
        mmPerPxX: round(widthMm / pageInfo.rectPx.width),
        mmPerPxY: round(heightMm / pageInfo.rectPx.height),
        items: pageInfo.items
          .filter((item) => item.rectPx.width > 0 && item.rectPx.height > 0)
          .map((item) => ({
            id: item.id,
            role: roleFromTag(item.tagName),
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
            computedStyle: item.computedStyle,
          })),
      };
    });

    return {
      metadata: {
        source: htmlPath,
        capturedAt: new Date().toISOString(),
      },
      pages,
      assets: [],
      warnings: [],
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

function roleFromTag(tagName) {
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
