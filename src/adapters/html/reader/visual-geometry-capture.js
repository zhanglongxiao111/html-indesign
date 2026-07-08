const fs = require('fs');
const {
  HTML_DATA_ID_ATTRIBUTES,
  HTML_DATA_ID_ATTRIBUTE_NAMES,
} = require('../../../protocol');

async function captureHtmlGeometry(htmlFile) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1400 }, deviceScaleFactor: 1 });
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') return route.abort();
      return route.continue();
    });
    const html = fs.readFileSync(htmlFile, 'utf8');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const capture = await page.evaluate(({ dataId, dataIdAttributeNames }) => {
      const dataIdAttributeNameSet = new Set(dataIdAttributeNames);
      function round(value) {
        return Math.round(Number(value || 0) * 1000) / 1000;
      }
      function normalizedText(value) {
        return String(value || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      function ownTextContent(element) {
        return normalizedText(Array.from(element.childNodes || [])
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.nodeValue || '')
          .join(''));
      }
      function metadataFor(element, pageElement) {
        const dataIdAttrs = Array.from(element.attributes || [])
          .map((attribute) => attribute.name)
          .filter((name) => dataIdAttributeNameSet.has(name));
        return {
          pageId: pageElement.id || '',
          role: element.getAttribute(dataId.ROLE) || '',
          vector: element.getAttribute(dataId.VECTOR) || '',
          objectStyle: element.getAttribute(dataId.OBJECT_STYLE) || '',
          paragraphStyle: element.getAttribute(dataId.PARAGRAPH_STYLE) || '',
          tableStyle: element.getAttribute(dataId.TABLE_STYLE) || '',
          sourceCsv: element.getAttribute(dataId.SOURCE_CSV) || '',
          sourceXml: element.getAttribute(dataId.SOURCE_XML) || '',
          textContent: normalizedText(element.textContent),
          innerText: normalizedText(element.innerText),
          ownTextContent: ownTextContent(element),
          hasIdChildren: Boolean(element.querySelector('[id]')),
          dataIdAttrs,
          classList: Array.from(element.classList || []),
        };
      }
      const pageElements = Array.from(document.querySelectorAll('.page'));
      const pages = pageElements.map((pageElement, index) => {
        const rect = pageElement.getBoundingClientRect();
        return {
          index,
          id: pageElement.id || '',
          x: 0,
          y: 0,
          width: round(rect.width),
          height: round(rect.height),
        };
      });
      const elements = [];
      pageElements.forEach((pageElement, pageIndex) => {
        const pageRect = pageElement.getBoundingClientRect();
        for (const element of Array.from(pageElement.querySelectorAll('[id]'))) {
          if (element === pageElement) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 && rect.height <= 0) continue;
          const id = element.id || '';
          if (!id) continue;
          elements.push({
            key: `${pageIndex}:${id}`,
            id,
            pageIndex,
            tagName: element.tagName.toLowerCase(),
            ...metadataFor(element, pageElement),
            x: round(rect.left - pageRect.left),
            y: round(rect.top - pageRect.top),
            width: round(rect.width),
            height: round(rect.height),
          });
        }
      });
      return { pages, elements };
    }, {
      dataId: HTML_DATA_ID_ATTRIBUTES,
      dataIdAttributeNames: HTML_DATA_ID_ATTRIBUTE_NAMES,
    });
    return capture;
  } finally {
    await browser.close();
  }
}

module.exports = {
  captureHtmlGeometry,
};
