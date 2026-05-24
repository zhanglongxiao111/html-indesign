const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

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

test('compileInstructions emits graphic placed assets and layers', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const graphicItems = instructions.pages[0].items.filter((item) => item.type === 'GRAPHIC');
  const pdf = graphicItems.find((item) => item.placed && item.placed.assetId === 'asset-site-plan-pdf');

  assert.equal(instructions.assets.length, 4);
  assert.equal(instructions.layers.some((layer) => layer.name === 'graphics'), true);
  assert.equal(pdf.frameStyle, 'drawing-frame');
  assert.equal(pdf.placed.pageNumber, 3);
  assert.equal(pdf.placed.crop, 'trim');
  assert.equal(instructions.styles.objectStyles.drawing.opacity, 1);
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
  assert.deepEqual(pdf.bounds, { x: 145, y: 22, width: 238, height: 168 });
  assert.equal(objectStyle.fillColor, 'color-ffffff');
  assert.equal(objectStyle.strokeColor, 'color-aeb8b8');
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
  assert.equal(stripe.styleOverride.fillColor, 'color-c8102e');
  assert.equal(stripe.styleOverride.strokeWeight, 0);
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
  assert.equal(instructions.styles.paragraphStyles['table-heading'].fillColor, 'color-ffffff');
});

test('compileInstructions emits page background shapes', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const firstPage = instructions.pages.find((page) => page.id === 'cover-page');
  const background = firstPage.items.find((item) => item.id === 'cover-page-background');

  assert.ok(background);
  assert.equal(background.type, 'SHAPE');
  assert.equal(background.layer, 'background');
  assert.deepEqual(background.bounds, { x: 0, y: 0, width: 420, height: 236.25 });
  assert.equal(background.styleOverride.fillColor, 'color-fbfaf7');
  assert.equal(background.styleOverride.strokeWeight, 0);
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
  assert.equal(instructions.styles.objectStyles.wash.fillColor, 'color-ffffff');
  assert.equal(instructions.styles.objectStyles.wash.opacity, 1);
  assert.equal(wash.effects.gradientFeather.scope, 'fill');
  assert.equal(wash.effects.gradientFeather.length, 0);
  assert.deepEqual(wash.effects.gradientFeather.start, { x: -80, y: 50 });
  assert.deepEqual(wash.effects.gradientFeather.stops.map((stop) => stop.opacity), [90, 40, 0]);
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
