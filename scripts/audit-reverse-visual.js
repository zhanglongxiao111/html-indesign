#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { compareVisualGeometry } = require('../src/writers/html/audit/visual-geometry-audit');

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reverse-html') {
      options.reverseHtmlDir = argv[++index];
    } else if (arg.startsWith('--reverse-html=')) {
      options.reverseHtmlDir = arg.slice('--reverse-html='.length);
    } else if (arg === '--reference') {
      options.referenceHtml = argv[++index];
    } else if (arg.startsWith('--reference=')) {
      options.referenceHtml = arg.slice('--reference='.length);
    } else if (arg === '--candidate') {
      options.candidateHtml = argv[++index];
    } else if (arg.startsWith('--candidate=')) {
      options.candidateHtml = arg.slice('--candidate='.length);
    } else if (arg === '--out') {
      options.outFile = argv[++index];
    } else if (arg.startsWith('--out=')) {
      options.outFile = arg.slice('--out='.length);
    } else if (arg === '--tolerance') {
      options.tolerance = Number(argv[++index]);
    } else if (arg.startsWith('--tolerance=')) {
      options.tolerance = Number(arg.slice('--tolerance='.length));
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function resolveInputs(options = {}) {
  const reverseHtmlDir = options.reverseHtmlDir ? path.resolve(options.reverseHtmlDir) : null;
  const referenceHtml = path.resolve(options.referenceHtml || (reverseHtmlDir && path.join(reverseHtmlDir, 'deck.visual.html')) || '');
  const candidateHtml = path.resolve(options.candidateHtml || (reverseHtmlDir && path.join(reverseHtmlDir, 'author/deck.html')) || '');
  return {
    referenceHtml,
    candidateHtml,
    outFile: options.outFile ? path.resolve(options.outFile) : null,
    tolerance: Number.isFinite(Number(options.tolerance)) ? Number(options.tolerance) : 2,
    json: Boolean(options.json),
    help: Boolean(options.help),
  };
}

function usage() {
  return [
    'Usage: node scripts/audit-reverse-visual.js --reverse-html <reverse-html-dir> [--tolerance 2] [--out report.json] [--json]',
    '   or: node scripts/audit-reverse-visual.js --reference <deck.visual.html> --candidate <author/deck.html> [--out report.json]',
    '',
    'Compares browser-computed page and element geometry between visual reverse HTML and editable author HTML.',
  ].join('\n');
}

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
    const capture = await page.evaluate(() => {
      function round(value) {
        return Math.round(Number(value || 0) * 1000) / 1000;
      }
      function metadataFor(element, pageElement) {
        return {
          pageId: pageElement.id || '',
          role: element.getAttribute('data-id-role') || '',
          vector: element.getAttribute('data-id-vector') || '',
          objectStyle: element.getAttribute('data-id-object-style') || '',
          paragraphStyle: element.getAttribute('data-id-paragraph-style') || '',
          tableStyle: element.getAttribute('data-id-table-style') || '',
          sourceCsv: element.getAttribute('data-id-source-csv') || '',
          sourceXml: element.getAttribute('data-id-source-xml') || '',
          visualAccept: element.getAttribute('data-id-visual-accept') || '',
          generated: element.getAttribute('data-id-generated-fragment') === 'true',
          generatedKind: element.getAttribute('data-id-generated-kind') || '',
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
    });
    return capture;
  } finally {
    await browser.close();
  }
}

function validateInputs(inputs) {
  if (!inputs.referenceHtml || inputs.referenceHtml === path.resolve('')) {
    throw new Error('Missing --reference or --reverse-html.');
  }
  if (!inputs.candidateHtml || inputs.candidateHtml === path.resolve('')) {
    throw new Error('Missing --candidate or --reverse-html.');
  }
  if (!fs.existsSync(inputs.referenceHtml)) throw new Error(`Reference HTML not found: ${inputs.referenceHtml}`);
  if (!fs.existsSync(inputs.candidateHtml)) throw new Error(`Candidate HTML not found: ${inputs.candidateHtml}`);
}

function printHuman(report, inputs) {
  const lines = [
    `reverse visual audit: ${report.ok ? 'ok' : 'failed'}`,
    `reference: ${inputs.referenceHtml}`,
    `candidate: ${inputs.candidateHtml}`,
    `pages: ${report.stats.candidatePages}/${report.stats.referencePages}`,
    `elements compared: ${report.stats.compared}`,
    `missing: ${report.stats.missing}`,
    `mismatched: ${report.stats.mismatched}`,
    `accepted: ${report.stats.accepted || 0}`,
    `errors: ${report.errors.length}`,
    `warnings: ${report.warnings.length}`,
  ];
  for (const issue of report.errors.slice(0, 40)) {
    lines.push(`- ${issue.code}${issue.id ? ` ${issue.id}` : ''}: ${issue.message}`);
  }
  if (report.errors.length > 40) lines.push(`- ... ${report.errors.length - 40} more errors`);
  for (const issue of report.warnings.slice(0, 20)) {
    lines.push(`~ ${issue.code}${issue.id ? ` ${issue.id}` : ''}: ${issue.message}`);
  }
  if (report.warnings.length > 20) lines.push(`~ ... ${report.warnings.length - 20} more warnings`);
  console.log(lines.join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const inputs = resolveInputs(options);
  validateInputs(inputs);
  const reference = await captureHtmlGeometry(inputs.referenceHtml);
  const candidate = await captureHtmlGeometry(inputs.candidateHtml);
  const report = compareVisualGeometry({ reference, candidate, tolerance: inputs.tolerance });
  if (inputs.outFile) {
    fs.mkdirSync(path.dirname(inputs.outFile), { recursive: true });
    fs.writeFileSync(inputs.outFile, JSON.stringify(report, null, 2), 'utf8');
  }
  if (inputs.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report, inputs);
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  resolveInputs,
  captureHtmlGeometry,
  usage,
};
