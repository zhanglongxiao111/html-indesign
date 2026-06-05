const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileStyles, compileInstructions } = require('../../src/writers/indesign');
const { detectAssetsFromItems } = require('../../src/adapters/html/reader/asset-detector');

test('compileInstructions emits document styles pages and text items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, { mode: 'editable-first' });
  const page = instructions.pages[0];
  const title = page.items.find((item) => item.id.includes('el1'));

  assert.equal(instructions.metadata.mode, 'editable-first');
  assert.equal(instructions.document.pages[0].width, 528);
  assert.equal(instructions.styles.paragraphStyles['report-title'].pointSize, 30);
  assert.equal(title.type, 'TEXT');
  assert.equal(title.paragraphStyle, 'report-title');
  assert.equal(title.runs.some((run) => run.characterStyle === 'accent'), true);
  assert.deepEqual(title.bounds, { x: 15, y: 18, width: 260, height: 30 });
  assert.equal(title.layer, 'text');
});

test('compileInstructions carries source package labels into instructions', async () => {
  const htmlPath = path.resolve('test/fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: 'presentation',
    targetSize: 'same',
  });

  const documentLabel = instructions.document.labels.find((label) => label.kind === 'document');
  const pageLabel = instructions.pages[0].labels.find((label) => label.kind === 'page');
  const itemWithSource = instructions.pages[0].items.find((item) => {
    const label = (item.labels || []).find((candidate) => candidate.kind === 'item');
    return label && label.sourceFile;
  });
  const itemLabel = itemWithSource.labels.find((label) => label.kind === 'item');

  assert.equal(documentLabel.sourcePackage.config, 'deck.config.json');
  assert.match(pageLabel.sourceFile, /^pages\/\d\d-/);
  assert.match(itemLabel.sourceFile, /^pages\/\d\d-/);
  assert.ok(itemLabel.sourceNode.tagName);
  assert.equal(itemLabel.structure.parentId, instructions.pages[0].id);
});

test('compileInstructions emits graphic placed assets and layers', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const graphicItems = instructions.pages[0].items.filter((item) => item.type === 'GRAPHIC');
  const pdf = graphicItems.find((item) => item.placed && item.placed.assetId === 'asset-site-plan-pdf' && item.placed.pageNumber === 3);
  const linkedPdf = graphicItems.find((item) => item.id === 'linked-pdf');

  assert.equal(instructions.assets.length, 4);
  assert.equal(instructions.layers.some((layer) => layer.name === 'graphics'), true);
  assert.equal(pdf.frameStyle, 'drawing-frame');
  assert.equal(pdf.placed.pageNumber, 3);
  assert.equal(pdf.placed.crop, 'trim');
  assert.equal(instructions.styles.objectStyles.drawing.opacity, 1);
  assert.equal(linkedPdf.type, 'GRAPHIC');
  assert.equal(linkedPdf.placed.assetId, 'asset-site-plan-pdf');
  assert.equal(linkedPdf.placed.pageNumber, 2);
  assert.equal(linkedPdf.placed.crop, 'media');
});

test('compileInstructions keeps outer PDF drawing frame geometry and style', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const pdfPage = instructions.pages.find((page) => page.items.some((item) => item.placed && item.placed.assetId === 'asset-ice-rink-layout-reference-pdf'));
  const pdf = pdfPage.items.find((item) => item.placed && item.placed.assetId === 'asset-ice-rink-layout-reference-pdf');
  const objectStyle = instructions.styles.objectStyles['drawing-frame-object'];
  const frameStyle = instructions.styles.frameStyles['drawing-frame'];

  assert.ok(pdf);
  assert.deepEqual(pdf.bounds, { x: 148.66, y: 14, width: 255.34, height: 185.1 });
  assert.equal(objectStyle.fillColor, '颜色-255-255-255');
  assert.equal(objectStyle.strokeColor, '颜色-174-184-184');
  assert.equal(objectStyle.strokeWeight, 1);
  assert.equal(frameStyle.overflow, 'hidden');
});

test('compileInstructions binds graphics by exact source before non-unique selectors', () => {
  const sharedPlacement = { fit: 'contain', position: '50% 50%' };
  const snapshot = {
    metadata: { source: 'fixture.html' },
    styles: {},
    assets: [
      { id: 'asset-photo-jpg', src: 'photo.jpg', kind: 'raster', placement: sharedPlacement, sourceSelector: 'img.large-media' },
      { id: 'asset-section-svg', src: 'section.svg', kind: 'svg', placement: sharedPlacement, sourceSelector: 'img.large-media' },
      { id: 'asset-circulation-svg', src: 'circulation.svg', kind: 'svg', placement: sharedPlacement, sourceSelector: 'img.large-media' },
    ],
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 420,
      heightMm: 236.25,
      items: ['photo.jpg', 'section.svg', 'circulation.svg'].map((src, index) => ({
        id: `p1-el${index + 1}`,
        role: 'graphic',
        boundsMm: { x: index * 10, y: 0, width: 10, height: 10 },
        zIndex: index,
        layer: 'drawing',
        sourceSelector: 'img.large-media',
        styleRefs: { objectStyle: 'diagram', frameStyle: 'diagram-frame' },
        attributes: { src },
      })),
    }],
    warnings: [],
  };

  const instructions = compileInstructions(snapshot);
  const assetIds = instructions.pages[0].items.map((item) => item.placed.assetId);

  assert.deepEqual(assetIds, ['asset-photo-jpg', 'asset-section-svg', 'asset-circulation-svg']);
});

test('compileInstructions keeps placement options on each graphic use', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const items = [
    graphicItem('first-plan', './assets/site-plan.pdf', 1),
    graphicItem('second-plan', './assets/site-plan.pdf', 2),
  ];
  const snapshot = {
    metadata: { source: htmlPath },
    styles: {
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
    },
    assets: detectAssetsFromItems(items, htmlPath),
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 420,
      heightMm: 236.25,
      items,
    }],
    warnings: [],
  };

  const instructions = compileInstructions(snapshot);
  const graphics = instructions.pages[0].items.filter((item) => item.type === 'GRAPHIC');

  assert.equal(instructions.assets.length, 1);
  assert.deepEqual(graphics.map((item) => item.placed.assetId), ['asset-site-plan-pdf', 'asset-site-plan-pdf']);
  assert.deepEqual(graphics.map((item) => item.placed.pageNumber), [1, 2]);
});

test('compileInstructions emits padded graphic content bounds separately from the visible frame', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      items: [{
        id: 'padded-render',
        role: 'graphic',
        tagName: 'img',
        classList: ['padded-render'],
        attributes: {
          src: './assets/render.jpg',
          'data-id-object-style': 'image-frame',
          'data-id-frame-style': 'image-frame-inset',
        },
        text: '',
        boundsMm: { x: 10, y: 20, width: 100, height: 60 },
        zIndex: 1,
        computedStyle: {
          objectFit: 'contain',
          objectPosition: 'left top',
          paddingTop: '10mm',
          paddingRight: '10mm',
          paddingBottom: '10mm',
          paddingLeft: '10mm',
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgb(18, 52, 86)',
          borderTopWidth: '1pt',
          borderTopStyle: 'solid',
          borderRightColor: 'rgb(18, 52, 86)',
          borderRightWidth: '1pt',
          borderRightStyle: 'solid',
          borderBottomColor: 'rgb(18, 52, 86)',
          borderBottomWidth: '1pt',
          borderBottomStyle: 'solid',
          borderLeftColor: 'rgb(18, 52, 86)',
          borderLeftWidth: '1pt',
          borderLeftStyle: 'solid',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'hidden',
        },
        authoredStyle: {},
      }],
    }],
    assets: [{
      id: 'asset-render-jpg',
      src: './assets/render.jpg',
      resolvedPath: './assets/render.jpg',
      kind: 'raster',
      linked: true,
      placement: { fit: 'contain', position: '0% 0%' },
      sourceSelector: 'img.padded-render',
    }],
  };

  const instructions = compileInstructions(snapshot);
  const graphic = instructions.pages[0].items.find((item) => item.id === 'padded-render');

  assert.deepEqual(graphic.bounds, { x: 10, y: 20, width: 100, height: 60 });
  assert.deepEqual(graphic.contentBounds, { x: 20, y: 30, width: 80, height: 40 });
  assert.equal(graphic.placed.position, '0% 0%');
});

test('compileInstructions preserves object styles on styled text frames', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'badge',
        role: 'text',
        tagName: 'p',
        classList: ['badge'],
        attributes: {
          'data-id-paragraph-style': 'badge-text',
          'data-id-object-style': 'badge-frame',
        },
        text: 'Approved',
        boundsMm: { x: 10, y: 10, width: 30, height: 8 },
        zIndex: 1,
        computedStyle: {
          color: 'rgb(18, 52, 86)',
          fontFamily: 'Arial, sans-serif',
          fontSize: '10pt',
          lineHeight: '12pt',
          fontWeight: '700',
          fontStyle: 'normal',
          textAlign: 'center',
          backgroundColor: 'rgba(245, 200, 80, 0.8)',
          borderTopColor: 'rgb(18, 52, 86)',
          borderTopWidth: '1pt',
          borderTopStyle: 'solid',
          borderRightColor: 'rgb(18, 52, 86)',
          borderRightWidth: '1pt',
          borderRightStyle: 'solid',
          borderBottomColor: 'rgb(18, 52, 86)',
          borderBottomWidth: '1pt',
          borderBottomStyle: 'solid',
          borderLeftColor: 'rgb(18, 52, 86)',
          borderLeftWidth: '1pt',
          borderLeftStyle: 'solid',
          borderRadius: '4px',
          opacity: '0.9',
          overflow: 'visible',
        },
        authoredStyle: {},
        runs: [],
      }],
    }],
    assets: [],
  };

  const instructions = compileInstructions(snapshot);
  const badge = instructions.pages[0].items.find((item) => item.id === 'badge');

  assert.equal(badge.type, 'TEXT');
  assert.equal(badge.objectStyle, 'badge-frame');
  assert.equal(instructions.styles.objectStyles['badge-frame'].fillColor, '颜色-245-200-80');
  assert.equal(instructions.styles.objectStyles['badge-frame'].strokeColor, '颜色-18-52-86');
  assert.equal(instructions.styles.objectStyles['badge-frame'].cornerRadius, '4px');
});

function graphicItem(id, src, pageNumber) {
  return {
    id,
    role: 'graphic',
    boundsMm: { x: pageNumber * 10, y: 0, width: 40, height: 30 },
    zIndex: pageNumber,
    sourceSelector: 'object.reused-plan',
    tagName: 'object',
    classList: ['reused-plan'],
    attributes: {
      data: src,
      type: 'application/pdf',
      'data-id-pdf-page': String(pageNumber),
      'data-id-crop': pageNumber === 1 ? 'trim' : 'media',
      'data-id-fit': 'contain',
    },
    computedStyle: {
      objectFit: 'contain',
      objectPosition: '50% 50%',
    },
    styleRefs: { objectStyle: null, frameStyle: null },
  };
}

test('compileInstructions preserves nested paint order above parent object backgrounds', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const page = instructions.pages[0];
  const card = page.items.find((item) => item.id === 'semantic-card');
  const body = page.items.find((item) => item.text && item.text.includes('Card body must stay above'));

  assert.ok(card);
  assert.ok(body);
  assert.equal(card.type, 'SHAPE');
  assert.equal(body.type, 'TEXT');
  assert.equal(body.zIndex > card.zIndex, true);
});

test('compileInstructions emits generated stripe objects for asymmetric left borders', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const page = instructions.pages[0];
  const card = page.items.find((item) => item.id === 'semantic-card');
  const stripe = page.items.find((item) => item.id === 'semantic-card-border-left');

  assert.ok(card);
  assert.ok(stripe);
  assert.equal(stripe.type, 'SHAPE');
  assert.equal(stripe.layer, card.layer);
  assert.equal(stripe.bounds.x, card.bounds.x);
  assert.equal(stripe.bounds.y, card.bounds.y);
  assert.equal(stripe.bounds.width, 3);
  assert.equal(stripe.bounds.height, card.bounds.height);
  assert.equal(stripe.styleOverride.fillColor, '颜色-200-16-46');
  assert.equal(stripe.styleOverride.strokeWeight, 0);
});

test('compileInstructions emits decoration objects for non-left asymmetric borders', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'edge-card',
        role: 'shape',
        tagName: 'div',
        classList: ['edge-card'],
        attributes: { 'data-id-object': '', 'data-id-object-style': 'edge-card' },
        text: '',
        boundsMm: { x: 10, y: 10, width: 40, height: 20 },
        zIndex: 1,
        computedStyle: {
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          borderTopStyle: 'none',
          borderRightColor: 'rgb(200, 16, 46)',
          borderRightWidth: '3px',
          borderRightStyle: 'solid',
          borderBottomColor: 'rgb(18, 52, 86)',
          borderBottomWidth: '2px',
          borderBottomStyle: 'solid',
          borderLeftColor: 'rgba(0, 0, 0, 0)',
          borderLeftWidth: '0px',
          borderLeftStyle: 'none',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'visible',
        },
        authoredStyle: {},
      }],
    }],
    assets: [],
  };
  const instructions = compileInstructions(snapshot);
  const page = instructions.pages[0];
  const card = page.items.find((item) => item.id === 'edge-card');
  const right = page.items.find((item) => item.id === 'edge-card-border-right');
  const bottom = page.items.find((item) => item.id === 'edge-card-border-bottom');

  assert.equal(instructions.styles.objectStyles['edge-card'].strokeWeight, 0);
  assert.equal(card.type, 'SHAPE');
  assert.ok(right);
  assert.ok(bottom);
  assert.equal(right.styleOverride.fillColor, '颜色-200-16-46');
  assert.equal(bottom.styleOverride.fillColor, '颜色-18-52-86');
  assert.equal(right.bounds.x > card.bounds.x, true);
  assert.equal(bottom.bounds.y > card.bounds.y, true);
});

test('compileInstructions keeps semantic table rows for native InDesign tables', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const page = instructions.pages[0];
  const table = page.items.find((item) => item.id === 'semantic-table');

  assert.ok(table);
  assert.equal(table.type, 'TABLE');
  assert.equal(table.tableStyle, 'native-table');
  assert.equal(table.columnCount, 2);
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].cells[0].text, 'Space');
  assert.equal(table.rows[0].cells[0].header, true);
  assert.equal(table.rows[0].cells[0].pointSize, 8);
  assert.equal(table.rows[0].cells[0].leading, 11);
  assert.equal(table.rows[0].cells[0].padding.top, 2);
  assert.equal(table.rows[1].cells[1].text, '7600 sqm');
});

test('compileInstructions creates paragraph styles referenced by table cells', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const table = instructions.pages
    .flatMap((page) => page.items)
    .find((item) => item.type === 'TABLE' && item.tableStyle === 'area-table');

  assert.ok(table);
  assert.equal(table.rows[0].cells[0].paragraphStyle, 'table-heading');
  assert.equal(table.rows[1].cells[0].paragraphStyle, 'table-body');
  assert.ok(instructions.styles.paragraphStyles['table-heading']);
  assert.ok(instructions.styles.paragraphStyles['table-body']);
  assert.equal(instructions.styles.paragraphStyles['table-heading'].fontWeight, '700');
  assert.equal(instructions.styles.paragraphStyles['table-heading'].fillColor, '颜色-255-255-255');
});

test('compileInstructions emits page backgrounds through parent pages', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const firstPage = instructions.pages.find((page) => page.id === 'cover-page');
  const backgroundParent = instructions.document.parentPages.find((parentPage) => (
    (parentPage.items || []).some((item) => item.role === 'background')
  ));
  assert.ok(backgroundParent);
  const background = backgroundParent.items.find((item) => item.role === 'background');

  assert.equal(firstPage.items.some((item) => item.role === 'background'), false);
  assert.equal(firstPage.parentPageId, backgroundParent.id);
  assert.equal(instructions.document.pages.find((page) => page.id === 'cover-page').parentPageId, backgroundParent.id);
  assert.ok(background);
  assert.equal(background.type, 'SHAPE');
  assert.equal(background.layer, 'background');
  assert.deepEqual(background.bounds, { x: 0, y: 0, width: 420, height: 236.25 });
  assert.equal(background.styleOverride.fillColor, '颜色-251-250-247');
  assert.equal(background.styleOverride.strokeWeight, 0);
});

test('compileInstructions maps page padding to margins and semantic grid to guides', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/grid-guide-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const docPage = instructions.document.pages[0];
  const page = instructions.pages[0];

  assert.deepEqual(docPage.margins, {
    top: 10,
    right: 20,
    bottom: 30,
    left: 40,
  });
  assert.deepEqual(page.margins, docPage.margins);
  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position), [65, 90, 115]);
  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [30, 50]);
});

test('compileInstructions accepts non-visual page margin semantics', () => {
  const instructions = compileInstructions({
    metadata: { source: 'inline.html' },
    styles: {},
    assets: [],
    warnings: [],
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      rectPx: { x: 0, y: 0, width: 1000, height: 600 },
      attributes: {
        'data-id-margin': '4mm 5mm 6mm 7mm',
        'data-id-grid': '2x2',
      },
      computedStyle: {
        paddingTop: '0px',
        paddingRight: '0px',
        paddingBottom: '0px',
        paddingLeft: '0px',
      },
      items: [],
    }],
  });
  const page = instructions.pages[0];

  assert.deepEqual(page.margins, { top: 4, right: 5, bottom: 6, left: 7 });
  assert.deepEqual(page.guides.map((guide) => `${guide.orientation}:${guide.position}`), ['vertical:51', 'horizontal:29']);
});

test('compileInstructions emits architectural column gutters and coarse row guides while baseline stays authoring-only', () => {
  const instructions = compileInstructions({
    metadata: { source: 'inline.html' },
    styles: {},
    assets: [],
    warnings: [],
    pages: [{
      id: 'grid-page',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 1200, height: 800 },
      attributes: {
        'data-id-margin': '10mm',
        'data-id-grid': '4x3',
        'data-id-column-gutter': '2mm',
        'data-id-baseline': '10mm',
      },
      computedStyle: {},
      items: [],
    }],
  });
  const page = instructions.pages[0];

  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position), [33.5, 35.5, 59, 61, 84.5, 86.5]);
  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [30, 50]);
  assert.equal(page.guides.every((guide) => guide.source === 'grid'), true);
});

test('compileInstructions can explicitly emit every baseline as visible guides', () => {
  const instructions = compileInstructions({
    metadata: { source: 'inline.html' },
    styles: {},
    assets: [],
    warnings: [],
    pages: [{
      id: 'grid-page',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 1200, height: 800 },
      attributes: {
        'data-id-margin': '10mm',
        'data-id-grid': '4x3',
        'data-id-baseline': '10mm',
        'data-id-baseline-guides': 'all',
      },
      computedStyle: {},
      items: [],
    }],
  });
  const page = instructions.pages[0];

  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [20, 30, 40, 50, 60, 70]);
  assert.equal(page.guides.filter((guide) => guide.orientation === 'horizontal').every((guide) => guide.source === 'baseline-grid'), true);
});

test('compileInstructions can emit InDesign guides from used authoring snap lines', () => {
  const instructions = compileInstructions({
    metadata: { source: 'inline.html' },
    styles: {},
    assets: [],
    warnings: [],
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 1200, height: 800 },
      attributes: {
        'data-id-margin': '10mm',
        'data-id-grid': '4x2',
        'data-id-snap-grid': '2mm',
        'data-id-guide-mode': 'used-snap',
      },
      computedStyle: {},
      items: [{
        id: 'card',
        role: 'shape',
        tagName: 'div',
        classList: ['metric-card'],
        attributes: { 'data-id-object': '', 'data-id-object-style': 'metric-card' },
        boundsMm: { x: 14, y: 12, width: 42, height: 20 },
        zIndex: 1,
        styleRefs: {},
        effects: null,
      }, {
        id: 'nested-title',
        role: 'text',
        tagName: 'h3',
        classList: [],
        attributes: { 'data-id-paragraph-style': 'card-title' },
        ancestorCandidateIndexes: [0],
        boundsMm: { x: 18, y: 16, width: 20, height: 6 },
        zIndex: 2,
        styleRefs: {},
        content: { text: 'Title', runs: [] },
      }, {
        id: 'callout-dot',
        role: 'shape',
        tagName: 'span',
        classList: ['dot'],
        attributes: { 'data-id-object': '', 'data-id-role': 'annotation' },
        boundsMm: { x: 58, y: 18, width: 4, height: 4 },
        zIndex: 3,
        styleRefs: {},
      }],
    }],
  });
  const page = instructions.pages[0];

  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position), [10, 14, 56, 110]);
  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [10, 12, 32, 70]);
  assert.equal(page.guides.every((guide) => guide.source === 'used-snap'), true);
});

test('compileInstructions merges near-duplicate guide positions from browser rounding', () => {
  const instructions = compileInstructions({
    metadata: { source: 'inline.html' },
    styles: {},
    assets: [],
    warnings: [],
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 1200, height: 800 },
      attributes: {
        'data-id-margin': '10mm',
        'data-id-grid': '4x2',
        'data-id-snap-grid': '2mm',
        'data-id-guide-mode': 'used-snap',
      },
      computedStyle: {},
      items: [{
        id: 'near-margin-card',
        role: 'shape',
        tagName: 'div',
        classList: ['metric-card'],
        attributes: { 'data-id-object': '', 'data-id-object-style': 'metric-card' },
        boundsMm: { x: 10.01, y: 10.01, width: 20, height: 20 },
        zIndex: 1,
        styleRefs: {},
      }],
    }],
  });
  const page = instructions.pages[0];

  assert.equal(page.guides.filter((guide) => guide.orientation === 'vertical' && guide.position <= 10.02).length, 1);
  assert.equal(page.guides.filter((guide) => guide.orientation === 'horizontal' && guide.position <= 10.02).length, 1);
});

test('compileInstructions scales margins and guides in presentation mode', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/grid-guide-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, {
    unitMode: 'presentation',
    targetSize: '1600x1000',
  });
  const page = instructions.pages[0];

  assert.deepEqual(page.margins, {
    top: 100,
    right: 200,
    bottom: 300,
    left: 400,
  });
  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position), [650, 900, 1150]);
  assert.deepEqual(page.guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [300, 500]);
});

test('compileInstructions scales browser pixels into a target presentation canvas', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, {
    unitMode: 'presentation',
    targetSize: 'qhd',
  });
  const firstSnapshotPage = snapshot.pages[0];
  const firstInstructionPage = instructions.pages[0];
  const cardSnapshot = firstSnapshotPage.items.find((item) => item.attributes['data-id-object-style'] === 'metric-card');
  const card = firstInstructionPage.items.find((item) => item.id === cardSnapshot.id);
  const folio = firstInstructionPage.items.find((item) => item.paragraphStyle === 'folio');
  const folioStyle = instructions.styles.paragraphStyles.folio;
  const scale = 2560 / firstSnapshotPage.rectPx.width;
  const sitePage = instructions.pages.find((page) => page.id === 'site-analysis-page');
  const annotationLine = sitePage.items.find((item) => item.id === 'p3-el6');
  const coverVeil = firstInstructionPage.items.find((item) => item.objectStyle === 'cover-veil');

  assert.equal(instructions.document.coordinateUnit, 'pt');
  assert.equal(instructions.document.pages[0].id, 'cover-page');
  assert.equal(instructions.document.pages[0].width, 2560);
  assert.equal(instructions.document.pages[0].height, 1440);
  assert.equal(firstInstructionPage.width, 2560);
  assert.equal(firstInstructionPage.height, 1440);
  assert.equal(card.bounds.x, Number(((cardSnapshot.rectPx.x - firstSnapshotPage.rectPx.x) * scale).toFixed(2)));
  assert.equal(card.bounds.width, Number((cardSnapshot.rectPx.width * scale).toFixed(2)));
  assert.equal(instructions.styles.objectStyles['metric-card'].strokeWeight, Number((1 * scale).toFixed(4)));
  assert.equal(folio.bounds.height >= Number((folioStyle.pointSize * 1.2).toFixed(2)), true);
  assert.equal(folio.bounds.width > Number((folioStyle.pointSize * 2 * 0.65).toFixed(2)), true);
  assert.equal(annotationLine.bounds.x, Number((269 * 96 / 25.4 * scale).toFixed(2)));
  assert.equal(annotationLine.bounds.y, Number((102 * 96 / 25.4 * scale).toFixed(2)));
  assert.equal(annotationLine.bounds.width, Number((46 * 96 / 25.4 * scale).toFixed(2)));
  assert.deepEqual(coverVeil.effects.gradientFeather.start, { x: -1280, y: 720 });
});

test('compileInstructions recompiles pre-styled snapshots when presentation layout changes', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const styledForPrint = compileStyles(snapshot);
  const instructions = compileInstructions(styledForPrint, { unitMode: 'presentation', targetSize: 'qhd' });

  assert.equal(instructions.document.coordinateUnit, 'pt');
  assert.equal(instructions.styles.paragraphStyles['cover-title'].pointSize > 70, true);
  assert.equal(instructions.styles.objectStyles['metric-card'].strokeWeight > 1.5, true);
});

test('compileInstructions preserves table frame object styles', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const table = instructions.pages
    .flatMap((page) => page.items)
    .find((item) => item.type === 'TABLE' && item.tableStyle === 'area-table');

  assert.equal(table.objectStyle, 'table-frame');
  assert.equal(table.frameStyle, null);
  assert.ok(instructions.styles.objectStyles['table-frame']);
  assert.equal(instructions.styles.frameStyles['data-table'], undefined);
});

test('compileInstructions gives presentation tables enough native row height for padding and leading', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, { unitMode: 'presentation', targetSize: 'qhd' });
  const table = instructions.pages
    .flatMap((page) => page.items)
    .find((item) => item.type === 'TABLE' && item.tableStyle === 'area-table');
  const firstCell = table.rows[0].cells[0];
  const minHeight = firstCell.padding.top
    + firstCell.padding.bottom
    + firstCell.leading
    + firstCell.borderWeight * 2;
  const rowTotal = table.rowHeights.reduce((sum, height) => sum + height, 0);

  assert.equal(table.rowHeights[0] >= Number(minHeight.toFixed(2)), true);
  assert.equal(table.bounds.height >= Number((rowTotal + 12).toFixed(2)), true);
});

test('compileInstructions preserves native table column widths and row heights', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const table = instructions.pages
    .flatMap((page) => page.items)
    .find((item) => item.type === 'TABLE' && item.tableStyle === 'area-table');
  const totalWidth = Number(table.columnWidths.reduce((sum, width) => sum + width, 0).toFixed(2));
  const totalHeight = Number(table.rowHeights.reduce((sum, height) => sum + height, 0).toFixed(2));

  assert.equal(table.columnWidths.length, 4);
  assert.equal(totalWidth, table.bounds.width);
  assert.equal(table.rowHeights.length, table.rows.length);
  assert.equal(table.columnWidths[0] > table.columnWidths[2], true);
  assert.equal(table.bounds.height >= totalHeight + 1, true);
});

test('compileInstructions emits native lines and oval dot shapes', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const items = instructions.pages.flatMap((page) => page.items);
  const slopedLine = items.find((item) => item.type === 'LINE' && item.rotationAngle === -22);
  const dot = items.find((item) => item.type === 'SHAPE' && item.objectStyle === 'annotation-dot');

  assert.ok(slopedLine);
  assert.equal(slopedLine.objectStyle, 'annotation-line');
  assert.deepEqual(slopedLine.bounds, { x: 269, y: 102, width: 46, height: 0 });
  assert.equal(slopedLine.strokeWeight, 1);
  assert.ok(dot);
  assert.equal(dot.shapeKind, 'oval');
});

test('compileInstructions orders visual layers below editable text layers', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const layerOrder = Object.fromEntries(instructions.layers.map((layer) => [layer.name, layer.order]));

  assert.equal(layerOrder.image < layerOrder.overlay, true);
  assert.equal(layerOrder.overlay < layerOrder.text, true);
});

test('compileInstructions preserves gradient masks as InDesign gradient feather effects', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const wash = instructions.pages[0].items.find((item) => item.id === 'p1-el2');

  assert.ok(wash);
  assert.equal(wash.objectStyle, 'wash');
  assert.equal(instructions.styles.objectStyles.wash.fillColor, '颜色-255-255-255');
  assert.equal(instructions.styles.objectStyles.wash.opacity, 1);
  assert.equal(wash.effects.gradientFeather.scope, 'fill');
  assert.equal(wash.effects.gradientFeather.length, 0);
  assert.deepEqual(wash.effects.gradientFeather.start, { x: -80, y: 50 });
  assert.deepEqual(wash.effects.gradientFeather.stops.map((stop) => stop.opacity), [90, 40, 0]);
});

test('compileInstructions carries style compiler warnings into the final report', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'rotated-card',
        role: 'shape',
        tagName: 'div',
        classList: ['rotated-card'],
        attributes: { 'data-id-object': '' },
        text: '',
        boundsMm: { x: 10, y: 10, width: 30, height: 20 },
        zIndex: 1,
        computedStyle: {
          backgroundColor: 'rgb(255, 255, 255)',
          borderTopColor: 'rgba(0, 0, 0, 0)',
          borderTopWidth: '0px',
          borderTopStyle: 'none',
          borderRightColor: 'rgba(0, 0, 0, 0)',
          borderRightWidth: '0px',
          borderRightStyle: 'none',
          borderBottomColor: 'rgba(0, 0, 0, 0)',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          borderLeftColor: 'rgba(0, 0, 0, 0)',
          borderLeftWidth: '0px',
          borderLeftStyle: 'none',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'visible',
          transform: 'rotate(15deg)',
        },
        authoredStyle: {},
      }],
    }],
    assets: [],
  };

  const instructions = compileInstructions(snapshot);

  assert.equal(instructions.report.messages.some((message) => message.code === 'TRANSFORM_NOT_NATIVE'), true);
});

test('compileInstructions does not warn for transforms converted to native lines', () => {
  const snapshot = {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 100,
      heightMm: 60,
      items: [{
        id: 'native-line',
        role: 'shape',
        tagName: 'div',
        classList: ['line'],
        attributes: { 'data-id-object': '', 'data-id-object-style': 'annotation-line' },
        text: '',
        boundsMm: { x: 10, y: 10, width: 30, height: 1 },
        zIndex: 1,
        computedStyle: {
          left: '10mm',
          top: '10mm',
          width: '30mm',
          height: '0px',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          borderTopColor: 'rgb(18, 52, 86)',
          borderTopWidth: '1pt',
          borderTopStyle: 'solid',
          borderRightColor: 'rgba(0, 0, 0, 0)',
          borderRightWidth: '0px',
          borderRightStyle: 'none',
          borderBottomColor: 'rgba(0, 0, 0, 0)',
          borderBottomWidth: '0px',
          borderBottomStyle: 'none',
          borderLeftColor: 'rgba(0, 0, 0, 0)',
          borderLeftWidth: '0px',
          borderLeftStyle: 'none',
          borderRadius: '0px',
          opacity: '1',
          overflow: 'visible',
          transform: 'rotate(15deg)',
        },
        authoredStyle: {},
      }],
    }],
    assets: [],
  };

  const instructions = compileInstructions(snapshot);

  assert.equal(instructions.pages[0].items.some((item) => item.type === 'LINE'), true);
  assert.equal(instructions.report.messages.some((message) => message.code === 'TRANSFORM_NOT_NATIVE'), false);
});

test('compileInstructions emits editable text for textual annotation objects', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const page = instructions.pages[0];
  const annotationBox = page.items.find((item) => item.id === 'semantic-annotation');
  const annotationText = page.items.find((item) => item.id === 'semantic-annotation-text');

  assert.ok(annotationBox);
  assert.ok(annotationText);
  assert.equal(annotationBox.type, 'SHAPE');
  assert.equal(annotationText.type, 'TEXT');
  assert.equal(annotationText.text, 'Native label');
  assert.equal(annotationText.zIndex > annotationBox.zIndex, true);
  assert.equal(annotationText.bounds.x, 89);
  assert.equal(annotationText.paragraphStyle, 'annotation');
});
