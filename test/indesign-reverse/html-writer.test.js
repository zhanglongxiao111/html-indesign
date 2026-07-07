const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { semanticModelToHtml } = require('../../src/writers/html');

test('semanticModelToHtml writes page, parent page, layout and text item tags', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  const html = semanticModelToHtml(model);

  assert.match(html, /<main class="deck"/);
  assert.match(html, /data-id-document="architecture-report"/);
  assert.match(html, /data-page="agenda-page"/);
  assert.match(html, /data-id-parent-page="report-parent"/);
  assert.match(html, /data-id-parent-page-name="汇报母版"/);
  assert.match(html, /data-id-layout="contents-grid"/);
  assert.match(html, /<h2[^>]+agenda-title/);
  assert.match(html, /汇报结构/);
});

test('semanticModelToHtml writes current page margin carrier and omits structured reverse mode bookkeeping', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'registry-current-carriers',
    title: 'registry-current-carriers',
    reverseMode: 'structured',
    pages: [{
      id: 'page-1',
      width: 400,
      height: 225,
      margins: { top: 14, right: 16, bottom: 10, left: 18 },
      items: [],
    }],
  });

  assert.match(html, /data-id-margin="14 16 10 18"/);
  assert.doesNotMatch(html, /data-id-margins/);
  assert.doesNotMatch(html, /data-id-reverse-mode="structured"/);
});

test('semanticModelToHtml rejects pages without explicit geometry', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  delete model.pages[0].width;

  assert.throws(
    () => semanticModelToHtml(model),
    /Page agenda-page is missing width/
  );
});

test('semanticModelToHtml skips virtual author structure containers', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-virtual-container',
    title: 'visual-virtual-container',
    reverseMode: 'observation',
    pages: [
      {
        id: 'page-1',
        width: 800,
        height: 450,
        items: [
          {
            id: 'page-1-figure-grid-1',
            role: 'container',
            virtual: true,
            tagName: 'section',
            sourceNode: { tagName: 'section', id: 'page-1-figure-grid-1', classList: ['figure-grid'], attributes: {} },
            structure: { parentId: 'page-1', order: 0 },
            content: { text: '' },
          },
          {
            id: 'image-1',
            role: 'graphic',
            semantic: 'unknown',
            tagName: 'figure',
            bounds: { x: 100, y: 80, width: 240, height: 160 },
            structure: { parentId: 'page-1-figure-grid-1', order: 1 },
            content: { text: '' },
            asset: { name: 'hero.png', path: 'D:\\assets\\hero.png' },
          },
        ],
      },
    ],
  });

  assert.doesNotMatch(html, /page-1-figure-grid-1/);
  assert.match(html, /id="image-1"/);
});

test('semanticModelToHtml renders observed shapes and placed image assets', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-reverse',
    title: 'visual-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'visual-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'card-frame',
            role: 'shape',
            semantic: '指标卡片',
            tagName: 'div',
            bounds: { x: 40, y: 50, width: 240, height: 120 },
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: '#c8102e',
              strokeWeight: 3,
              opacity: 72,
              cornerRadius: 8,
            },
            styleRefs: {},
            content: { text: '' },
          },
          {
            id: 'hero-image',
            role: 'graphic',
            semantic: 'hero-image',
            tagName: 'figure',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              cropped: true,
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /id="card-frame"[^>]+background-color:#fbfaf7/);
  assert.match(html, /id="card-frame"[^>]+border:3px solid #c8102e/);
  assert.match(html, /id="card-frame"[^>]+opacity:0\.72/);
  assert.match(html, /id="card-frame"[^>]+border-radius:8px/);
  assert.match(html, /<figure[^>]+id="hero-image"[^>]+data-id-asset-path="D:\\assets\\hero\.png"/);
  assert.match(html, /<img src="file:\/\/\/D:\/assets\/hero\.png"/);
  assert.match(html, /data-id-image-cropped="true"/);
});

test('semanticModelToHtml renders placed image content geometry inside the visible frame', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-crop-reverse',
    title: 'visual-crop-reverse',
    reverseMode: 'observation',
    pages: [
      {
        id: 'crop-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'cropped-image',
            role: 'graphic',
            semantic: 'unknown',
            tagName: 'figure',
            bounds: { x: 100, y: 80, width: 240, height: 160 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              cropped: true,
              placement: {
                fit: 'manual',
                contentOffset: { x: -30, y: -20 },
                contentSize: { width: 320, height: 210 },
                contentScale: { x: 1.3333, y: 1.3125 },
              },
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /<figure[^>]+id="cropped-image"[^>]+data-id-fit="manual"/);
  assert.match(html, /data-id-content-x="-30px"/);
  assert.match(html, /data-id-content-y="-20px"/);
  assert.match(html, /data-id-content-width="320px"/);
  assert.match(html, /data-id-content-height="210px"/);
  assert.match(html, /<img src="file:\/\/\/D:\/assets\/hero\.png"[^>]+class="placed-asset-content"/);
  assert.match(html, /style="[^"]*position:absolute[^"]*left:-30px[^"]*top:-20px[^"]*width:320px[^"]*height:210px/);
});

test('semanticModelToHtml keeps generated placed-asset previews from being stretched by source content geometry', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-preview-crop-reverse',
    title: 'visual-preview-crop-reverse',
    reverseMode: 'observation',
    pages: [
      {
        id: 'preview-crop-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'cropped-pdf',
            role: 'graphic',
            semantic: 'unknown',
            tagName: 'figure',
            bounds: { x: 100, y: 80, width: 240, height: 160 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'drawing.pdf',
              path: 'D:\\assets\\drawing.pdf',
              preview: {
                path: 'D:\\reverse\\previews\\cropped-pdf.png',
                relativePath: 'previews/cropped-pdf.png',
                source: 'indesign-frame-export',
                format: 'png',
              },
              placement: {
                fit: 'manual',
                contentOffset: { x: -30, y: -20 },
                contentSize: { width: 420, height: 210 },
                contentScale: { x: 1.75, y: 1.3125 },
              },
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /<figure[^>]+id="cropped-pdf"[^>]+data-id-content-width="420px"[^>]+data-id-content-height="210px"/);
  assert.match(html, /<img src="file:\/\/\/D:\/reverse\/previews\/cropped-pdf\.png"[^>]+class="placed-asset-preview"/);
  assert.match(html, /style="[^"]*position:absolute[^"]*left:0px[^"]*top:0px[^"]*width:100%[^"]*height:100%/);
  assert.doesNotMatch(html, /class="placed-asset-preview"[^>]+width:420px/);
});

test('semanticModelToHtml treats JFIF links as raster images', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-jfif-reverse',
    title: 'visual-jfif-reverse',
    reverseMode: 'observation',
    pages: [
      {
        id: 'jfif-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'jfif-image',
            role: 'graphic',
            semantic: 'unknown',
            tagName: 'figure',
            bounds: { x: 0, y: 0, width: 240, height: 160 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'material.jfif',
              path: 'D:\\assets\\material.jfif',
              graphicType: 'Image',
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /<figure[^>]+id="jfif-image"/);
  assert.match(html, /<img src="file:\/\/\/D:\/assets\/material\.jfif"/);
  assert.doesNotMatch(html, /<span class="id-asset-placeholder">/);
});

test('semanticModelToHtml renders observed vector paths as SVG instead of rectangular fallbacks', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-vector-reverse',
    title: 'visual-vector-reverse',
    reverseMode: 'observation',
    pages: [
      {
        id: 'vector-page',
        width: 400,
        height: 240,
        items: [
          {
            id: 'axis-line',
            role: 'shape',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 10, y: 20, width: 180, height: 0 },
            visualStyle: {
              fillColor: null,
              strokeColor: '#c8102e',
              strokeWeight: 2,
              strokeOpacity: 65,
              strokeStyle: '虚线（3 和 2）',
            },
            vectorGeometry: {
              kind: 'line',
              paths: [
                {
                  closed: false,
                  points: [
                    { anchor: { x: 10, y: 20 }, leftDirection: { x: 10, y: 20 }, rightDirection: { x: 10, y: 20 } },
                    { anchor: { x: 190, y: 20 }, leftDirection: { x: 190, y: 20 }, rightDirection: { x: 190, y: 20 } },
                  ],
                },
              ],
            },
            styleRefs: {},
            content: { text: '' },
          },
        ],
      },
    ],
  });

  assert.match(html, /<svg[^>]+id="axis-line"[^>]+data-id-vector="line"/);
  assert.match(html, /viewBox="0 0 180 2"/);
  assert.match(html, /style="[^"]*height:0px[^"]*min-height:2px/);
  assert.match(html, /<path[^>]+d="M0 1 L180 1"/);
  assert.match(html, /stroke="#c8102e"/);
  assert.match(html, /stroke-width="2"/);
  assert.match(html, /stroke-opacity="0.65"/);
  assert.match(html, /stroke-dasharray=/);
  assert.doesNotMatch(html, /id="axis-line"[^>]+border:2px solid #c8102e/);
});

test('semanticModelToHtml renders vector arrow markers and extended stroke fields', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'vector-marker-reverse',
    title: 'vector-marker-reverse',
    reverseMode: 'observation',
    pages: [
      {
        id: 'vector-page',
        width: 400,
        height: 240,
        items: [
          {
            id: 'route-arrow',
            role: 'shape',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 40, y: 60, width: 180, height: 80 },
            visualStyle: {
              fillColor: null,
              strokeColor: '#c8102e',
              strokeWeight: 4,
              strokeOpacity: 75,
              strokeStyle: '虚线（3 和 2）',
              strokeLineCap: 'round',
              strokeLineJoin: 'bevel',
              strokeMiterLimit: 6,
              lineStartMarker: { type: 'circle', rawName: 'Circle' },
              lineEndMarker: { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' },
            },
            vectorGeometry: {
              kind: 'path',
              paths: [
                {
                  closed: false,
                  points: [
                    { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 } },
                    { anchor: { x: 220, y: 140 }, leftDirection: { x: 220, y: 140 }, rightDirection: { x: 220, y: 140 } },
                  ],
                },
              ],
            },
            styleRefs: {},
            content: { text: '' },
          },
          {
            id: 'zone-fill',
            role: 'shape',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 240, y: 60, width: 80, height: 60 },
            visualStyle: {
              fillColor: '#ff9339',
              fillOpacity: 42,
              strokeColor: null,
              strokeWeight: null,
            },
            vectorGeometry: {
              kind: 'path',
              paths: [
                {
                  closed: true,
                  points: [
                    { anchor: { x: 240, y: 60 }, leftDirection: { x: 240, y: 60 }, rightDirection: { x: 240, y: 60 } },
                    { anchor: { x: 320, y: 60 }, leftDirection: { x: 320, y: 60 }, rightDirection: { x: 320, y: 60 } },
                    { anchor: { x: 320, y: 120 }, leftDirection: { x: 320, y: 120 }, rightDirection: { x: 320, y: 120 } },
                    { anchor: { x: 240, y: 120 }, leftDirection: { x: 240, y: 120 }, rightDirection: { x: 240, y: 120 } },
                  ],
                },
              ],
            },
            styleRefs: {},
            content: { text: '' },
          },
          {
            id: 'marker-only-line',
            role: 'shape',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 330, y: 40, width: 0, height: 120 },
            visualStyle: {
              fillColor: null,
              strokeColor: null,
              strokeWeight: null,
              lineStartMarker: { type: 'circle', rawName: 'Circle' },
            },
            vectorGeometry: {
              kind: 'line',
              paths: [
                {
                  closed: false,
                  points: [
                    { anchor: { x: 330, y: 40 }, leftDirection: { x: 330, y: 40 }, rightDirection: { x: 330, y: 40 } },
                    { anchor: { x: 330, y: 160 }, leftDirection: { x: 330, y: 160 }, rightDirection: { x: 330, y: 160 } },
                  ],
                },
              ],
            },
            styleRefs: {},
            content: { text: '' },
          },
          {
            id: 'closed-marker',
            role: 'shape',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 40, y: 160, width: 80, height: 50 },
            visualStyle: {
              fillColor: null,
              strokeColor: '#ff0a0d',
              strokeWeight: 4,
              lineEndMarker: { type: 'circle', rawName: 'Circle' },
            },
            vectorGeometry: {
              kind: 'polygon',
              paths: [
                {
                  closed: true,
                  points: [
                    { anchor: { x: 40, y: 160 }, leftDirection: { x: 40, y: 160 }, rightDirection: { x: 40, y: 160 } },
                    { anchor: { x: 120, y: 160 }, leftDirection: { x: 120, y: 160 }, rightDirection: { x: 120, y: 160 } },
                    { anchor: { x: 120, y: 210 }, leftDirection: { x: 120, y: 210 }, rightDirection: { x: 120, y: 210 } },
                  ],
                },
              ],
            },
            styleRefs: {},
            content: { text: '' },
          },
        ],
      },
    ],
  });

  assert.match(html, /<defs>[\s\S]*id="route-arrow-marker-start"[\s\S]*id="route-arrow-marker-end"[\s\S]*<\/defs>/);
  assert.match(html, /<circle[^>]+fill="#c8102e"/);
  assert.match(html, /<path[^>]+fill="#c8102e"[^>]+d="M0 0 L10 5 L0 10 Z"/);
  assert.match(html, /<path[^>]+marker-start="url\(#route-arrow-marker-start\)"[^>]+marker-end="url\(#route-arrow-marker-end\)"/);
  assert.match(html, /<path[^>]+data-id-stroke-style="虚线（3 和 2）"/);
  assert.match(html, /<path[^>]+data-id-line-start-marker-raw-name="Circle"/);
  assert.match(html, /<path[^>]+data-id-line-end-marker-raw-name="SIMPLE_WIDE_ARROW_HEAD"/);
  assert.match(html, /stroke-linecap="round"/);
  assert.match(html, /stroke-linejoin="bevel"/);
  assert.match(html, /stroke-miterlimit="6"/);
  assert.match(html, /stroke-opacity="0.75"/);
  assert.match(html, /id="zone-fill"[\s\S]*fill="#ff9339"[^>]+fill-opacity="0.42"/);
  assert.match(html, /id="marker-only-line"[^>]+style="[^"]*width:0px[^"]*min-width:1px/);
  assert.match(html, /id="marker-only-line"[\s\S]*<path[^>]+stroke="none"[^>]+marker-start="url\(#marker-only-line-marker-start\)"/);
  assert.match(html, /id="closed-marker"[\s\S]*<path[^>]+marker-end="url\(#closed-marker-marker-end\)"/);
  assert.match(html, /id="closed-marker"[\s\S]*<path[^>]+data-id-vector-points="/);
});

test('semanticModelToHtml maps reverse blend modes without faking opacity', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'blend-mode-reverse',
    title: 'blend-mode-reverse',
    reverseMode: 'observation',
    pages: [
      {
        id: 'blend-page',
        width: 400,
        height: 240,
        items: [
          {
            id: 'multiply-fill',
            role: 'shape',
            semantic: 'unknown',
            tagName: 'div',
            bounds: { x: 40, y: 60, width: 180, height: 80 },
            visualStyle: {
              fillColor: '#ff9339',
              opacity: 100,
              blendMode: 'multiply',
            },
            vectorGeometry: {
              kind: 'polygon',
              paths: [
                {
                  closed: true,
                  points: [
                    { anchor: { x: 40, y: 60 }, leftDirection: { x: 40, y: 60 }, rightDirection: { x: 40, y: 60 } },
                    { anchor: { x: 220, y: 60 }, leftDirection: { x: 220, y: 60 }, rightDirection: { x: 220, y: 60 } },
                    { anchor: { x: 220, y: 140 }, leftDirection: { x: 220, y: 140 }, rightDirection: { x: 220, y: 140 } },
                  ],
                },
              ],
            },
            styleRefs: {},
            content: { text: '' },
          },
        ],
      },
    ],
  });

  assert.match(html, /\.page \{[^}]*isolation: isolate/);
  assert.match(html, /<svg[^>]+id="multiply-fill"[^>]+style="[^"]*mix-blend-mode:multiply/);
  assert.match(html, /<path[^>]+fill="#ff9339"/);
  assert.doesNotMatch(html, /opacity:0\./);
});

test('semanticModelToHtml renders source img graphic items through a frame container', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'source-img-reverse',
    title: 'source-img-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'source-img-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'hero-image',
            role: 'graphic',
            semantic: 'hero-image',
            tagName: 'img',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              cropped: true,
            },
          },
          {
            id: 'placed-pdf',
            role: 'graphic',
            semantic: 'drawing-frame-object',
            tagName: 'object',
            bounds: { x: 100, y: 100, width: 400, height: 240 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'drawing.pdf',
              path: 'D:\\assets\\drawing.pdf',
              cropped: false,
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /<figure[^>]+id="hero-image"[^>]+data-id-asset-path="D:\\assets\\hero\.png"/);
  assert.match(html, /<img src="file:\/\/\/D:\/assets\/hero\.png"/);
  assert.match(html, /<figure[^>]+id="placed-pdf"[^>]+data-id-asset-path="D:\\assets\\drawing\.pdf"/);
  assert.match(html, /<object data="file:\/\/\/D:\/assets\/drawing\.pdf" type="application\/pdf"/);
  assert.doesNotMatch(html, /<\/img>/);
});

test('semanticModelToHtml can write local asset URLs relative to the HTML output directory', () => {
  const outputDir = path.resolve('test/workspace/manual-reverse-html');
  const assetPath = path.resolve('test/fixtures/e2e/smoke-assets/photos/industrial-site.jpg');
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'relative-asset-reverse',
    title: 'relative-asset-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'relative-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'hero-image',
            role: 'graphic',
            semantic: 'hero-image',
            tagName: 'figure',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'industrial-site.jpg',
              path: assetPath,
              cropped: true,
            },
          },
        ],
      },
    ],
  }, { outputDir });

  const expectedUrl = path.relative(outputDir, assetPath).replace(/\\/g, '/');
  assert.match(html, new RegExp(`<img src="${escapeRegExp(expectedUrl)}"`));
  assert.doesNotMatch(html, /<img src="file:\/\//);
});

test('semanticModelToHtml renders placed PDFs through image previews when available', () => {
  const outputDir = path.resolve('test/workspace/manual-reverse-html');
  const pdfPath = path.resolve('test/fixtures/e2e/reference-pdfs/ice-rink-layout-reference.pdf');
  const previewPath = path.resolve('test/fixtures/e2e/reference-pdfs/ice-rink-layout-reference-page1.png');
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'pdf-preview-reverse',
    title: 'pdf-preview-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'pdf-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'placed-pdf',
            role: 'graphic',
            semantic: 'drawing-frame-object',
            tagName: 'figure',
            bounds: { x: 80, y: 40, width: 500, height: 300 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'ice-rink-layout-reference.pdf',
              path: pdfPath,
              cropped: false,
              graphicType: 'PDF',
              placement: { pageNumber: 1 },
            },
          },
        ],
      },
    ],
  }, { outputDir });

  const expectedUrl = path.relative(outputDir, previewPath).replace(/\\/g, '/');
  assert.match(html, /<figure[^>]+data-id-asset-path="/);
  assert.match(html, new RegExp(`<img src="${escapeRegExp(expectedUrl)}"`));
  assert.match(html, /data-id-preview-asset-path=/);
  assert.doesNotMatch(html, /<object[^>]+type="application\/pdf"/);
});

test('semanticModelToHtml does not invent first-page PDF previews without explicit page facts', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-pdf-no-page-'));
  const pdfPath = path.join(outputDir, 'drawing.pdf');
  const previewPath = path.join(outputDir, 'drawing-page1.png');
  fs.writeFileSync(pdfPath, 'dummy pdf placeholder');
  fs.writeFileSync(previewPath, 'dummy preview placeholder');

  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'pdf-no-page-preview-reverse',
    title: 'pdf-no-page-preview-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'pdf-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'placed-pdf-no-page',
            role: 'graphic',
            semantic: 'drawing-frame-object',
            tagName: 'figure',
            bounds: { x: 80, y: 40, width: 500, height: 300 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'drawing.pdf',
              path: pdfPath,
              graphicType: 'PDF',
            },
          },
        ],
      },
    ],
  }, { outputDir });

  assert.doesNotMatch(html, /drawing-page1\.png/);
  assert.doesNotMatch(html, /data-id-preview-asset-path=/);
  assert.doesNotMatch(html, /data-id-pdf-page=/);
});

test('semanticModelToHtml uses placement page number for PDF preview fallback', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-pdf-page-'));
  const pdfPath = path.join(outputDir, 'drawing.pdf');
  const previewPath = path.join(outputDir, 'drawing-page3.png');
  fs.writeFileSync(pdfPath, 'dummy pdf placeholder');
  fs.writeFileSync(previewPath, 'dummy preview placeholder');

  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'pdf-page-preview-reverse',
    title: 'pdf-page-preview-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'pdf-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'placed-pdf-page3',
            role: 'graphic',
            semantic: 'drawing-frame-object',
            tagName: 'figure',
            bounds: { x: 80, y: 40, width: 500, height: 300 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'drawing.pdf',
              path: pdfPath,
              graphicType: 'PDF',
              placement: { pageNumber: 3 },
            },
          },
        ],
      },
    ],
  }, { outputDir });

  assert.match(html, /data-id-pdf-page="3"/);
  assert.match(html, /<img src="drawing-page3\.png"/);
  assert.doesNotMatch(html, /data-id-page=/);
  assert.doesNotMatch(html, /<object[^>]+type="application\/pdf"/);
});

test('semanticModelToHtml renders reverse gradient feather effects over observed fill', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'effect-reverse',
    title: 'effect-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'effect-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'cover-veil',
            role: 'shape',
            semantic: 'cover-veil',
            tagName: 'div',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: null,
              strokeWeight: null,
              opacity: 100,
              cornerRadius: null,
            },
            extensions: {
              indesign: {
                effects: {
                  gradientFeather: {
                    type: 'linear',
                    scope: 'fill',
                    angle: 0,
                    stops: [
                      { location: 0, opacity: 94 },
                      { location: 45, opacity: 55 },
                      { location: 100, opacity: 8 },
                    ],
                  },
                },
              },
            },
            styleRefs: {},
            content: { text: '' },
          },
        ],
      },
    ],
  });

  assert.match(html, /id="cover-veil"[^>]+background:linear-gradient/);
  assert.match(html, /rgba\(251, 250, 247, 0\.94\) 0%/);
  assert.match(html, /rgba\(251, 250, 247, 0\.55\) 45%/);
  assert.match(html, /rgba\(251, 250, 247, 0\.08\) 100%/);
});

test('semanticModelToHtml renders observed text style', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'type-reverse',
    title: 'type-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'type-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'title',
            role: 'text',
            semantic: 'page-title',
            tagName: 'h1',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            textStyle: {
              fontFamily: 'Microsoft YaHei',
              fontWeight: '700',
              fontStyle: null,
              pointSize: 32,
              leading: 38,
              fillColor: '#123456',
              tracking: 20,
              justification: 'center',
            },
            styleRefs: {},
            content: { text: '标题文字' },
          },
        ],
      },
    ],
  });

  assert.match(html, /\.id-object\[data-id-role="text"\] \{ overflow: visible; \}/);
  assert.match(html, /id="title"[^>]+font-family:&quot;Microsoft YaHei&quot;, Arial, sans-serif/);
  assert.match(html, /id="title"[^>]+font-weight:700/);
  assert.match(html, /id="title"[^>]+font-size:32px/);
  assert.match(html, /id="title"[^>]+line-height:38px/);
  assert.match(html, /id="title"[^>]+color:#123456/);
  assert.match(html, /id="title"[^>]+letter-spacing:0\.02em/);
  assert.match(html, /id="title"[^>]+text-align:center/);
});

test('semanticModelToHtml preserves hard line breaks and character runs in text objects', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'run-reverse',
    title: 'run-reverse',
    reverseMode: 'structured',
    styles: {
      characterStyles: {
        封面强调: {
          name: '封面强调',
          token: '封面强调',
          safeName: '封面强调',
          css: 'color:#c8102e; font-style:italic',
        },
      },
    },
    pages: [
      {
        id: 'run-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'cover-title',
            role: 'text',
            semantic: 'cover-title',
            tagName: 'h1',
            bounds: { x: 40, y: 50, width: 500, height: 120 },
            styleRefs: { paragraphStyle: '封面标题' },
            content: {
              text: '冰球场首层平面\n排布汇报',
              runs: [
                {
                  text: '冰球场首层平面\n',
                  textStyle: { fillColor: '#123456' },
                },
                {
                  text: '排布汇报',
                  characterStyle: '封面强调',
                  textStyle: { fillColor: '#c8102e', fontStyle: 'italic' },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /冰球场首层平面<br><\/span><span[\s\S]+排布汇报<\/span>/);
  assert.match(html, /class="cstyle-封面强调"/);
  assert.match(html, /style="[^"]*color:#c8102e/);
  assert.match(html, /style="[^"]*font-style:italic/);
});

test('semanticModelToHtml preserves text separators between rich text runs', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'run-separators',
    title: 'run-separators',
    reverseMode: 'structured',
    styles: {
      characterStyles: {
        正文橙色: {
          name: '正文橙色',
          token: '正文橙色',
          safeName: '正文橙色',
          css: 'color:#c85014',
        },
      },
    },
    pages: [
      {
        id: 'page-1',
        width: 800,
        height: 450,
        items: [
          {
            id: 'copy',
            role: 'text',
            tagName: 'p',
            bounds: { x: 40, y: 50, width: 360, height: 120 },
            styleRefs: {},
            content: {
              text: '选取暖色系的材料 \n选取细节丰富的材料',
              runs: [
                { text: '选取暖色系的材料', characterStyle: '正文橙色' },
                { text: '选取细节丰富的材料', characterStyle: '正文橙色' },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /选取暖色系的材料<\/span> <br><span[^>]*>选取细节丰富的材料<\/span>/);
});

test('semanticModelToHtml renders native table rows cells and cell styles', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'table-reverse',
    title: 'table-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'table-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'area-table',
            role: 'table',
            semantic: 'metrics-table',
            tagName: 'table',
            bounds: { x: 80, y: 100, width: 420, height: 120 },
            styleRefs: { tableStyle: '面积指标表', objectStyle: '表格框' },
            content: { text: '\u0016' },
            table: {
              tableStyle: '面积指标表',
              rowCount: 2,
              columnCount: 2,
              columnWidths: [260, 160],
              rowHeights: [32, 28],
              rows: [
                {
                  index: 0,
                  cells: [
                    {
                      index: 0,
                      text: 'Space',
                      header: true,
                      rowSpan: 1,
                      colSpan: 1,
                      fillColor: '#123456',
                      textColor: '#ffffff',
                      pointSize: 18,
                      leading: 24,
                      textAlign: 'center',
                      paragraphStyle: '表头文字',
                      padding: { top: 8, right: 10, bottom: 8, left: 10 },
                      borders: {
                        top: { color: '#cfd6d2', borderWeight: 1 },
                        right: { color: '#cfd6d2', borderWeight: 1 },
                        bottom: { color: '#cfd6d2', borderWeight: 1 },
                        left: { color: '#cfd6d2', borderWeight: 1 },
                      },
                    },
                    { index: 1, text: 'Area', header: true, rowSpan: 1, colSpan: 1 },
                  ],
                },
                {
                  index: 1,
                  cells: [
                    { index: 0, text: 'Ice rink', rowSpan: 1, colSpan: 1 },
                    { index: 1, text: '7,600 sqm', rowSpan: 1, colSpan: 1 },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /<table[^>]+id="area-table"/);
  assert.match(html, /data-id-table-style="面积指标表"/);
  assert.match(html, /<col style="width:260px">/);
  assert.match(html, /<tr[^>]*>\s*<th[^>]+data-id-paragraph-style="表头文字"[^>]+>Space<\/th>/);
  assert.match(html, /<td[^>]*>Ice rink<\/td>/);
  assert.match(html, /background-color:#123456/);
  assert.match(html, /color:#ffffff/);
  assert.match(html, /font-size:18px/);
  assert.match(html, /line-height:24px/);
  assert.match(html, /text-align:center/);
  assert.match(html, /padding:8px 10px 8px 10px/);
  assert.match(html, /border-left:1px solid #cfd6d2/);
  assert.doesNotMatch(html, /\u0016/);
});

test('semanticModelToHtml renders reverse style classes composite text features and z order', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'rich-type-reverse',
    title: 'rich-type-reverse',
    reverseMode: 'structured',
    styles: {
      compositeFonts: {
        '建筑复合字体': {
          name: '建筑复合字体',
          romanWeight: '400',
          cjkWeight: '700',
          entries: [{ name: '罗马字', size: 82, weight: '400' }],
        },
      },
      paragraphStyles: {
        '正文列表': {
          name: '正文列表',
          token: '正文列表',
          safeName: 'body-list',
          css: "font-family:'建筑复合字体',sans-serif; font-size:12pt; color:#123456",
          indesignFeatures: {
            list: { type: 'numbered', isCircle: true, charStyleCSS: 'color:#c8102e' },
          },
        },
        首字下沉: {
          name: '首字下沉',
          token: '首字下沉',
          safeName: 'drop-cap',
          css: 'font-size:14pt',
          indesignFeatures: {
            dropCap: { chars: 1, lines: 2, styleCSS: 'color:#c8102e' },
          },
        },
        首行强调: {
          name: '首行强调',
          token: '首行强调',
          safeName: 'first-line',
          css: 'font-size:12pt',
          indesignFeatures: {
            grepStyles: [{ pattern: '^.+?(?=\\n|\\r)', charStyleCSS: 'font-weight:bold; color:#c8102e' }],
          },
        },
      },
      objectStyles: {
        图片框: {
          name: '图片框',
          token: '图片框',
          safeName: 'image-frame',
          css: 'border:1pt solid #aeb8b8',
        },
      },
    },
    pages: [
      {
        id: 'rich-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'numbered',
            role: 'text',
            semantic: 'body-list',
            tagName: 'div',
            bounds: { x: 40, y: 50, width: 300, height: 80 },
            styleRefs: { paragraphStyle: '正文列表' },
            content: { text: '第一条\nSecond item' },
            zIndex: 9,
          },
          {
            id: 'drop',
            role: 'text',
            semantic: 'drop',
            tagName: 'div',
            bounds: { x: 40, y: 150, width: 300, height: 80 },
            styleRefs: { paragraphStyle: '首字下沉' },
            content: { text: '首段Text' },
          },
          {
            id: 'grep',
            role: 'text',
            semantic: 'grep',
            tagName: 'div',
            bounds: { x: 40, y: 250, width: 300, height: 80 },
            styleRefs: { paragraphStyle: '首行强调' },
            content: { text: '标题行\n正文行' },
          },
        ],
      },
    ],
  });

  assert.match(html, /\.pstyle-body-list \{ font-family:'建筑复合字体',sans-serif; font-size:12px; color:#123456 \}/);
  assert.match(html, /\.ostyle-image-frame \{ border:1px solid #aeb8b8 \}/);
  assert.doesNotMatch(html, /font-size:12pt/);
  assert.match(html, /id="numbered"[^>]+class="[^"]*pstyle-body-list/);
  assert.match(html, /id="numbered"[^>]+style="[^"]*z-index:9/);
  assert.match(html, /class="list-item has-number" data-number="1" data-circle="①"/);
  assert.match(html, /<span class="en-text">Second item<\/span>/);
  assert.match(html, /id="drop"[\s\S]*<span class="dropcap-chars">首<\/span>/);
  assert.match(html, /id="grep"[\s\S]*<span class="grep-first-line" style="font-weight:bold; color:#c8102e">标题行<\/span>/);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
