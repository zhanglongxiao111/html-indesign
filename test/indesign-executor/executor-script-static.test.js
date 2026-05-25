const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const scriptPath = path.join(root, '_indesign_scripts/build_from_instructions.jsx');
const libDir = path.join(root, '_indesign_scripts/lib');

test('build_from_instructions.jsx is a thin bootstrap that loads executor libs', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  for (const name of [
    'hi_core.jsxinc',
    'hi_labels.jsxinc',
    'hi_document.jsxinc',
    'hi_fonts.jsxinc',
    'hi_styles.jsxinc',
    'hi_assets.jsxinc',
    'hi_tables.jsxinc',
    'hi_items.jsxinc',
    'hi_executor.jsxinc',
  ]) {
    assert.match(source, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(source, /HI\.runBuildFromInstructions/);
  assert.equal(source.includes('slotNameFromLabel'), false);
});

test('executor lib files expose expected HI APIs and stay focused', () => {
  const expectations = {
    'hi_core.jsxinc': ['HI.readJsonFile', 'HI.stringify', 'HI.makeReport', 'HI.boundsToGeometricBounds', 'HI.measurementString'],
    'hi_labels.jsxinc': ['HI.writeProtocolLabels', 'HI.writeProtocolLabel', 'HI.readProtocolLabel'],
    'hi_document.jsxinc': ['HI.prepareDocument', 'HI.ensureLayers', 'HI.getPageForInstruction'],
    'hi_fonts.jsxinc': ['HI.resolveFont', 'HI.fontStyleNameFor', 'HI.fontByName'],
    'hi_styles.jsxinc': ['HI.ensureStyles', 'HI.applyParagraphStyle', 'HI.applyObjectStyle'],
    'hi_assets.jsxinc': ['HI.resolveAssetFile', 'HI.placeAssetInFrame', 'HI.applyFitting'],
    'hi_tables.jsxinc': ['HI.tableGridFromRows', 'HI.applyTableSpans', 'HI.applyTableCells'],
    'hi_items.jsxinc': ['HI.buildInstructionItems', 'HI.createTextFrame', 'HI.createGraphicFrame'],
    'hi_executor.jsxinc': ['HI.runBuildFromInstructions', 'HI.runLegacyBuildInstructions'],
  };

  for (const [fileName, apiNames] of Object.entries(expectations)) {
    const filePath = path.join(libDir, fileName);
    assert.equal(fs.existsSync(filePath), true, `${fileName} should exist`);
    const source = fs.readFileSync(filePath, 'utf8');
    for (const apiName of apiNames) {
      assert.match(source, new RegExp(apiName.replace('.', '\\.')));
    }
    assert.ok(source.split(/\r?\n/).length <= 340, `${fileName} should stay small`);
  }
});

test('executor label helpers report key label write failures', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_labels.jsxinc'), 'utf8');
  assert.match(source, /HI\.writeProtocolLabels/);
  assert.match(source, /LABEL_WRITE_FAILED/);
  assert.match(source, /critical/);
});

test('document helper configures page geometry layers and unit restoration', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_document.jsxinc'), 'utf8');
  for (const token of [
    'HI.restoreDocumentPreferences',
    'HI.measurementUnitsFor',
    'HI.measurementUnitName',
    'HI.measurementString',
    'scriptPreferences.measurementUnit',
    'RulerOrigin.PAGE_ORIGIN',
    'documentPreferences.pageWidth',
    'documentPreferences.pageHeight',
    'coordinateUnit',
    'documentPreferences.facingPages = false',
    'HI.ensureParentPages',
    'doc.masterSpreads',
    'HI.applyParentPage',
    'page.appliedMaster',
    'PARENT_PAGE_APPLY_FAILED',
    'HI.applyPageMargins',
    'marginPreferences',
    'HI.applyPageGuides',
    'guides.add',
    'HorizontalOrVertical.VERTICAL',
    'HI.reuseDefaultLayer',
    'HI.findDefaultLayer',
    'HI.isDefaultLayerName',
    'charCodeAt(0) === 22270',
    'doc.layers.everyItem().getElements()',
    'HI.removeUnusedDefaultLayers',
    'report.counts.layers',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('styles helper creates swatches and InDesign text/object style resources', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  for (const token of [
    'HI.ensureSwatches',
    'HI.removeDefaultProcessSwatches',
    'doc.colors.add',
    'ColorSpace.RGB',
    'HI.ensureParagraphStyles',
    'doc.paragraphStyles.add',
    'HI.ensureCharacterStyles',
    'doc.characterStyles.add',
    'HI.ensureObjectStyles',
    'doc.objectStyles.add',
    'HI.applyCharacterStyleToRange',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('executor consumes frame styles and richer object style fields', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  const itemsSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const assetsSource = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');

  for (const token of [
    'HI.ensureFrameStyles',
    'styles.frameStyles',
    'strokeType',
    'topLeftCornerRadius',
    'HI.applyFrameStyle',
    'HI.applyFillOpacity',
  ]) {
    assert.match(stylesSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(itemsSource, /HI\.applyFrameStyle\(doc,\s*rect,\s*item\.frameStyle,\s*report\)/);
  assert.match(itemsSource, /HI\.applyObjectStyle\(doc,\s*frame,\s*item\.objectStyle,\s*report\)/);
  assert.match(itemsSource, /HI\.applyFrameStyle\(doc,\s*frame,\s*item\.frameStyle,\s*report\)/);
  assert.match(stylesSource, /var prefs = null;/);
  assert.match(stylesSource, /if \(!prefs\) return;/);
  assert.match(assetsSource, /HI\.alignPlacedContent/);
  assert.match(assetsSource, /graphic\.geometricBounds/);
  assert.match(assetsSource, /placed\.contentBounds/);
});

test('executor writes text sizes with explicit point units', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  const tableSource = fs.readFileSync(path.join(libDir, 'hi_tables.jsxinc'), 'utf8');

  assert.match(stylesSource, /style\.pointSize\s*=\s*HI\.ptValue\(def\.pointSize\)/);
  assert.match(stylesSource, /style\.leading\s*=\s*HI\.ptValue\(def\.leading\)/);
  assert.match(stylesSource, /style\.underline\s*=\s*true/);
  assert.match(stylesSource, /style\.strikeThru\s*=\s*true/);
  assert.match(stylesSource, /Position\.SUPERSCRIPT/);
  assert.match(stylesSource, /Capitalization\.ALL_CAPS/);
  assert.match(tableSource, /cell\.texts\[0\]\.pointSize\s*=\s*HI\.ptValue\(cellDef\.pointSize\)/);
  assert.match(tableSource, /cell\.texts\[0\]\.leading\s*=\s*HI\.ptValue\(cellDef\.leading\)/);
  assert.match(tableSource, /HI\.applyTableCellRuns/);
});

test('executor maps font family weight and italic into InDesign font styles', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  const fontsSource = fs.readFileSync(path.join(libDir, 'hi_fonts.jsxinc'), 'utf8');

  for (const token of [
    'HI.resolveFont',
    'def.fontStyleName',
    'style.fontStyle',
  ]) {
    assert.match(stylesSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of [
    'HI.resolveFont',
    'HI.fontStyleNameFor',
    'def.fontStyleName',
    'family + "\\t" + styleName',
    'app.fonts.itemByName(name)',
  ]) {
    assert.match(fontsSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('asset helper resolves placed files and applies fitting preferences', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');
  for (const token of [
    'HI.findAssetById',
    'frame.place(file)',
    'app.pdfPlacePreferences.pageNumber',
    'Number(pageNumber || 1)',
    'HI.pdfCropFor',
    'FitOptions.PROPORTIONALLY',
    'HI.boundsToGeometricBounds(placed.contentBounds)',
    'HI.alignedContentOrigin',
    'ASSET_FILE_MISSING',
    'ASSET_PLACE_FAILED',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('item helper creates text graphic shape items and applies z order', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const tableSource = fs.readFileSync(path.join(libDir, 'hi_tables.jsxinc'), 'utf8');
  for (const token of [
    'HI.createShapeFrame',
    'HI.createLineFrame',
    'page.textFrames.add',
    'HI.clearTextFrameInsets',
    'HI.applyRuns',
    'frame.overflows',
    'page.rectangles.add',
    'page.ovals.add',
    'page.graphicLines.add',
    'HI.placeAssetInFrame',
    'HI.applyZIndex',
    'sendToBack',
    'bringToFront',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of [
    'HI.tableGridFromRows',
    'item.columnWidths',
    'item.rowHeights',
    'HI.measurementString',
    'cellDef.paddingUnit',
    'cellDef.fillOpacity',
    'topEdgeStrokeColor',
    'rightEdgeStrokeWeight',
  ]) {
    assert.match(tableSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('asset helper does not silently ignore advanced placement options', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');
  for (const token of [
    'placed.artboard',
    'placed.layerComp',
    'placed.preserveVector',
    'AI_ARTBOARD_APPLY_FAILED',
    'PSD_LAYER_COMP_UNSUPPORTED',
    'PRESERVE_VECTOR_UNSUPPORTED',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('executor reports structured counts for CLI result_json consumers', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_executor.jsxinc'), 'utf8');
  for (const token of [
    'pagesRequested',
    'pageCount',
    'textFrames',
    'graphicFrames',
    'placedAssets',
    'missingAssets',
    'build_last_result',
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test('reverse snapshot script loads reverse and label helpers', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/export_to_html_snapshot.jsx'), 'utf8');
  assert.match(source, /hi_core\.jsxinc/);
  assert.match(source, /hi_labels\.jsxinc/);
  assert.match(source, /hi_reverse_styles\.jsxinc/);
  assert.match(source, /hi_reverse_text\.jsxinc/);
  assert.match(source, /hi_reverse_effects\.jsxinc/);
  assert.match(source, /hi_reverse_tables\.jsxinc/);
  assert.match(source, /hi_reverse\.jsxinc/);
  assert.match(source, /HI\.exportReverseSnapshot/);
});

test('reverse snapshot helper extracts labels, pages, styles, layers and assets', () => {
  const reverseSource = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');
  const stylePath = path.resolve('_indesign_scripts/lib/hi_reverse_styles.jsxinc');
  const textPath = path.resolve('_indesign_scripts/lib/hi_reverse_text.jsxinc');
  const effectPath = path.resolve('_indesign_scripts/lib/hi_reverse_effects.jsxinc');
  const tablePath = path.resolve('_indesign_scripts/lib/hi_reverse_tables.jsxinc');
  assert.equal(fs.existsSync(stylePath), true, 'hi_reverse_styles.jsxinc should exist');
  assert.equal(fs.existsSync(textPath), true, 'hi_reverse_text.jsxinc should exist');
  assert.equal(fs.existsSync(effectPath), true, 'hi_reverse_effects.jsxinc should exist');
  assert.equal(fs.existsSync(tablePath), true, 'hi_reverse_tables.jsxinc should exist');
  const styleSource = fs.readFileSync(stylePath, 'utf8');
  const textSource = fs.readFileSync(textPath, 'utf8');
  const effectSource = fs.readFileSync(effectPath, 'utf8');
  const tableSource = fs.readFileSync(tablePath, 'utf8');
  const source = `${reverseSource}\n${styleSource}\n${textSource}\n${effectSource}\n${tableSource}`;
  assert.match(source, /HI\.readProtocolLabel/);
  assert.match(source, /snapshot\.pages/);
  assert.match(source, /snapshot\.styles/);
  assert.match(source, /snapshot\.layers/);
  assert.match(source, /snapshot\.assets/);
  assert.match(source, /HI\.reverseVisualStyle/);
  assert.match(source, /HI\.reversePlacedAsset/);
  assert.match(source, /HI\.reverseTextStyle/);
  assert.match(source, /HI\.reverseTextRuns/);
  assert.match(source, /HI\.reverseCharacterTextStyle/);
  assert.match(source, /FORCED_LINE_BREAK/);
  assert.match(source, /HI\.reverseEffects/);
  assert.match(source, /fillTransparencySettings/);
  assert.match(source, /gradientFeatherSettings/);
  assert.match(source, /opacityGradientStops/);
  assert.match(source, /HI\.reverseTableData/);
  assert.match(source, /HI\.reverseTableRows/);
  assert.match(source, /HI\.reverseTableCell/);
  assert.match(source, /columnWidths/);
  assert.match(source, /rowHeights/);
  assert.match(source, /cell\.rowSpan/);
  assert.match(source, /cell\.columnSpan/);
  assert.match(source, /allGraphics/);
  assert.match(source, /fillColor/);
  assert.match(source, /strokeColor/);
  assert.match(source, /pointSize/);
  assert.match(source, /appliedFont/);
  assert.match(source, /HI\.reverseCompositeFonts/);
  assert.match(source, /dropCapCharacters/);
  assert.match(source, /nestedGrepStyles/);
  assert.match(source, /bulletsAndNumberingListType/);
  assert.match(source, /textColumnCount/);
  assert.ok(styleSource.split(/\r?\n/).length <= 340, 'hi_reverse_styles.jsxinc should stay focused');
  assert.ok(textSource.split(/\r?\n/).length <= 180, 'hi_reverse_text.jsxinc should stay focused');
  assert.ok(effectSource.split(/\r?\n/).length <= 120, 'hi_reverse_effects.jsxinc should stay focused');
  assert.ok(tableSource.split(/\r?\n/).length <= 240, 'hi_reverse_tables.jsxinc should stay focused');
});

test('reverse snapshot derives HTML z order from InDesign layer order', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(source, /HI\.reverseLayerIndexMap/);
  assert.match(source, /HI\.reverseItemZIndex/);
  assert.match(source, /itemLayer/);
  assert.match(source, /layerBase/);
  assert.match(source, /var local = Number\(index\)/);
  assert.doesNotMatch(source, /total\s*-\s*1\s*-\s*index/);
  assert.match(source, /layer\.count\s*-\s*1\s*-\s*layer\.index/);
  assert.match(source, /zIndex:\s*HI\.reverseItemZIndex\(item,\s*index,\s*total,\s*layerOrder\)/);
});

test('reverse snapshot reads bounds in document coordinate units and restores preferences', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  for (const token of [
    'HI.reverseCoordinateUnit',
    'HI.applyReverseMeasurementUnits',
    'HI.restoreReverseMeasurementUnits',
    'HI.measurementUnitsFor',
    'HI.measurementUnitName',
    'scriptPreferences.measurementUnit',
    'RulerOrigin.PAGE_ORIGIN',
    'finally',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(source, /HI\.applyReverseMeasurementUnits\(appRef,\s*doc,\s*coordinateUnit\)/);
  assert.match(source, /HI\.restoreReverseMeasurementUnits\(appRef,\s*doc,\s*oldUnits\)/);
});

test('executor and reverse scripts use html_indesign protocol labels for source metadata', () => {
  const labels = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_labels.jsxinc'), 'utf8');
  const document = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_document.jsxinc'), 'utf8');
  const items = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_items.jsxinc'), 'utf8');
  const reverse = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(labels, /insertLabel\("html_indesign"/);
  assert.match(document, /HI\.writeProtocolLabels\(doc/);
  assert.match(document, /HI\.writeProtocolLabels\(page/);
  assert.match(items, /HI\.writeProtocolLabels\(frame/);
  assert.match(items, /HI\.writeProtocolLabels\(rect/);
  assert.match(reverse, /HI\.readProtocolLabel\(target\)/);
});

test('core JSON reader opens instruction files as UTF-8', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_core.jsxinc'), 'utf8');
  assert.match(source, /file\.encoding\s*=\s*["']UTF-8["']/);
  assert.ok(source.indexOf('file.encoding') < source.indexOf('file.open("r")'));
  assert.match(source, /MeasurementUnits\.MILLIMETERS/);
  assert.match(source, /MeasurementUnits\.POINTS/);
});
