const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const scriptPath = path.join(root, '_indesign_scripts/build_from_instructions.jsx');
const libDir = path.join(root, '_indesign_scripts/lib');

test('build_from_instructions.jsx is a thin bootstrap that loads executor libs', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  for (const name of executorLibNames()) {
    assert.match(source, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(source, /HI\.runBuildFromInstructions/);
  assert.equal(source.includes('slotNameFromLabel'), false);
});

test('InDesign E2E build wrapper loads the same executor libs as the bootstrap', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/indesign-e2e.js'), 'utf8');
  for (const name of executorLibNames()) {
    assert.match(source, new RegExp(`includeLib\\("${name.replace('.', '\\.')}"\\)`));
  }
});

function executorLibNames() {
  return [
    'hi_core.jsxinc',
    'hi_labels.jsxinc',
    'hi_document.jsxinc',
    'hi_parent_pages.jsxinc',
    'hi_fonts.jsxinc',
    'hi_styles.jsxinc',
    'hi_vector_styles.jsxinc',
    'hi_assets.jsxinc',
    'hi_tables.jsxinc',
    'hi_text_fit.jsxinc',
    'hi_items.jsxinc',
    'hi_executor.jsxinc',
  ];
}

test('executor lib files expose expected HI APIs and stay focused', () => {
  const expectations = {
    'hi_core.jsxinc': ['HI.readJsonFile', 'HI.stringify', 'HI.makeReport', 'HI.boundsToGeometricBounds', 'HI.measurementString', 'HI.noneSwatch'],
    'hi_labels.jsxinc': ['HI.writeProtocolLabels', 'HI.writeProtocolLabel', 'HI.readProtocolLabel'],
    'hi_document.jsxinc': ['HI.prepareDocument', 'HI.ensureLayers', 'HI.getPageForInstruction'],
    'hi_parent_pages.jsxinc': ['HI.ensureParentPages', 'HI.applyParentPageToParentPage', 'HI.buildParentPageItems', 'HI.applyParentPage'],
    'hi_fonts.jsxinc': ['HI.resolveFont', 'HI.fontStyleNameFor', 'HI.fontByName'],
    'hi_styles.jsxinc': ['HI.ensureStyles', 'HI.applyParagraphStyle', 'HI.applyObjectStyle'],
    'hi_vector_styles.jsxinc': ['HI.applyStrokeOpacity', 'HI.applyLineMarker', 'HI.lineMarkerName'],
    'hi_assets.jsxinc': ['HI.resolveAssetFile', 'HI.placeAssetInFrame', 'HI.applyFitting'],
    'hi_tables.jsxinc': ['HI.tableGridFromRows', 'HI.applyTableSpans', 'HI.applyTableCells'],
    'hi_text_fit.jsxinc': ['HI.resolveTextFrameOverflow', 'HI.applyTextFitNudge', 'TEXT_FIT_APPLIED', 'TEXT_FIT_NUDGE_APPLIED', 'TEXT_FIT_UNRESOLVED'],
    'hi_items.jsxinc': ['HI.buildInstructionItems', 'HI.createTextFrame', 'HI.createGraphicFrame'],
    'hi_executor.jsxinc': ['HI.runBuildFromInstructions', 'HI.buildParentPageItems', 'HI.runLegacyBuildInstructions'],
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

test('parent page helper preserves nested parent pages and default cleanup', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_parent_pages.jsxinc'), 'utf8');
  for (const token of [
    'HI.ensureParentPages',
    'HI.applyParentPageToParentPage',
    'master.appliedMaster',
    'PARENT_PAGE_PARENT_APPLY_FAILED',
    'HI.setParentPageName',
    'HI.reusableDefaultParentPage',
    'namePrefix',
    'baseName',
    'HI.buildParentPageItems',
    'doc.masterSpreads',
    'HI.applyParentPage',
    'page.appliedMaster',
    'NothingEnum.NOTHING',
    'PARENT_PAGE_APPLY_FAILED',
    'HI.removeUnusedDefaultParentPages',
    'HI.parentPageHasProtocolLabel',
    'HI.parentPageHasContent',
    'HI.parentPageIsApplied',
    'DEFAULT_PARENT_PAGE_REMOVED',
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
  assert.match(stylesSource, /style\.spaceBefore\s*=\s*HI\.ptValue\(def\.spaceBefore\)/);
  assert.match(stylesSource, /style\.spaceAfter\s*=\s*HI\.ptValue\(def\.spaceAfter\)/);
  assert.match(stylesSource, /style\.composer\s*=\s*def\.composer/);
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
    'PDF_PAGE_NUMBER_MISSING',
    'HI.pdfCropFor',
    'FitOptions.PROPORTIONALLY',
    'HI.boundsToGeometricBounds(placed.contentBounds)',
    'HI.alignedContentOrigin',
    'ASSET_FILE_MISSING',
    'ASSET_PLACE_FAILED',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /Number\(pageNumber \|\| 1\)/);
});

test('asset helper applies manual content bounds to placed graphics without moving the frame off pasteboard', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');
  const placeAssetBody = source.slice(
    source.indexOf('HI.placeAssetInFrame'),
    source.indexOf('HI.configurePlacePreferences = function'),
  );

  assert.doesNotMatch(placeAssetBody, /frame\.geometricBounds\s*=\s*HI\.boundsToGeometricBounds\(placed\.contentBounds\)/);
  assert.match(placeAssetBody, /frame\.allGraphics\[0\]\.geometricBounds\s*=\s*HI\.boundsToGeometricBounds\(placed\.contentBounds\)/);
});

test('asset helper maps content PDF crop to InDesign visible-layer content crop', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');
  const pdfCropBody = source.slice(
    source.indexOf('HI.pdfCropFor'),
    source.indexOf('HI.applyFitting = function'),
  );

  assert.match(pdfCropBody, /if \(!key\) return null;/);
  assert.match(pdfCropBody, /CROP_CONTENT_VISIBLE_LAYERS/);
  assert.match(pdfCropBody, /CROP_CONTENT_ALL_LAYERS/);
  assert.doesNotMatch(pdfCropBody, /constantName\s*=\s*"CROP_CONTENT"/);
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
    'HI.recordOversetTextFrame',
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

test('text frame creation restores instruction bounds after applying object and frame styles', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const body = source.slice(
    source.indexOf('HI.createTextFrame'),
    source.indexOf('HI.textFromRuns'),
  );

  assert.match(body, /HI\.applyObjectStyle\(doc,\s*frame,\s*item\.objectStyle,\s*report\)[\s\S]*HI\.applyFrameStyle\(doc,\s*frame,\s*item\.frameStyle,\s*report\)[\s\S]*HI\.disableTextFrameAutoSizing\(frame\)[\s\S]*frame\.geometricBounds\s*=\s*HI\.boundsToGeometricBounds\(item\.bounds\)/);
});

test('item helper computes endpoints for horizontal and vertical native lines', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(source, context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.HI.lineEndPoints({
    bounds: { x: 10, y: 20, width: 50, height: 0 },
    rotationAngle: 0,
  }))), { x1: 10, y1: 20, x2: 60, y2: 20 });
  assert.deepEqual(JSON.parse(JSON.stringify(context.HI.lineEndPoints({
    bounds: { x: 10, y: 20, width: 0, height: 50 },
    rotationAngle: 0,
  }))), { x1: 10, y1: 20, x2: 10, y2: 70 });
});

test('item and style helpers apply native vector paths and line markers', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const styleSource = fs.readFileSync(path.join(libDir, 'hi_vector_styles.jsxinc'), 'utf8');

  for (const token of [
    'HI.createVectorShapePageItem',
    'page.polygons.add',
    'HI.applyVectorGeometry',
    'HI.applyVectorPath',
    'targetPath.entirePath',
    'PathType.CLOSED_PATH',
    'PathType.OPEN_PATH',
    'PointType.PLAIN',
    'PointType.SMOOTH',
  ]) {
    assert.match(itemSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of [
    'HI.applyStrokeOpacity',
    'strokeTransparencySettings',
    'HI.applyStrokeLineCap',
    'HI.applyStrokeLineJoin',
    'HI.applyLineMarker',
    'leftLineEnd',
    'rightLineEnd',
    'ArrowHead.SIMPLE_ARROW_HEAD',
    'ArrowHead.CIRCLE_SOLID_ARROW_HEAD',
    'ArrowHead.BAR_ARROW_HEAD',
  ]) {
    assert.match(styleSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(styleSource, /app\.arrowHeadStyles\.itemByName/);
  assert.doesNotMatch(styleSource, /target\[propertyName\]\s*=\s*name/);
});

test('style helper clears explicit zero stroke through the None swatch', () => {
  const coreSource = fs.readFileSync(path.join(libDir, 'hi_core.jsxinc'), 'utf8');
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');

  assert.match(coreSource, /HI\.swatchByName/);
  assert.match(coreSource, /swatch\.isValid/);
  assert.match(coreSource, /app\.translateKeyString\("\$ID\/None"\)/);
  assert.match(coreSource, /HI\.noneSwatch/);
  assert.match(coreSource, /HI\.strokeSwatchFor/);
  assert.match(stylesSource, /style\.strokeColor = strokeSwatch/);
  assert.match(stylesSource, /pageItem\.strokeColor = strokeSwatch/);
});

test('item helper clears InDesign default stroke on new drawable page items', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const vectorStyleSource = fs.readFileSync(path.join(libDir, 'hi_vector_styles.jsxinc'), 'utf8');

  assert.match(vectorStyleSource, /HI\.clearDefaultStroke/);
  assert.match(itemSource, /HI\.clearDefaultStroke\(doc, rect\)/);
  assert.match(itemSource, /HI\.clearDefaultStroke\(doc, line\)/);
});

test('line style overrides are applied after native line stroke fields', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const start = itemSource.indexOf('HI.createLineFrame = function');
  const body = itemSource.slice(
    start,
    itemSource.indexOf('HI.createVectorShapePageItem', start),
  );

  assert.match(body, /HI\.applyObjectStyle\(doc,\s*line,\s*item\.objectStyle,\s*report\)[\s\S]*if \(item\.strokeColor\) line\.strokeColor[\s\S]*if \(item\.strokeWeight !== null[\s\S]*HI\.applyStyleOverride\(doc,\s*line,\s*item\.styleOverride,\s*report\)/);
});

test('style helper preserves authored dashed stroke style names for InDesign', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(stylesSource, context);

  assert.equal(context.HI.strokeStyleName('dashed'), '$ID/Dashed');
  assert.equal(context.HI.strokeStyleName('虚线（3 和 2）'), '虚线（3 和 2）');
  assert.equal(context.HI.strokeStyleName('12 8'), '12 8');
  assert.equal(context.HI.strokeStyleName('点线'), '$ID/Dotted');
  assert.equal(context.HI.strokeStyleName('实底'), '$ID/Solid');
  assert.equal(context.HI.strokeStyleName('自定义线型'), '自定义线型');
});

test('item helper records located overset text frame diagnostics', () => {
  const coreSource = fs.readFileSync(path.join(libDir, 'hi_core.jsxinc'), 'utf8');
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');

  assert.match(coreSource, /oversetTextFrames:\s*\[\]/);
  assert.match(itemSource, /HI\.recordOversetTextFrame\(report,\s*frame,\s*item,\s*"TEXT_OVERSET"/);
  assert.match(itemSource, /pageName/);
  assert.match(itemSource, /visibleText/);
  assert.match(itemSource, /sourceText/);
});

test('executor loads dedicated text fit helper before item creation', () => {
  const bootstrap = fs.readFileSync(path.resolve('_indesign_scripts/build_from_instructions.jsx'), 'utf8');
  const e2e = fs.readFileSync(path.resolve('scripts/indesign-e2e.js'), 'utf8');

  assert.match(bootstrap, /includeLib\("hi_text_fit\.jsxinc"\)/);
  assert.match(e2e, /includeLib\("hi_text_fit\.jsxinc"\)/);
});

test('text fit helper expands bounded overset frames and reports unresolved cases', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_text_fit.jsxinc'), 'utf8');
  const items = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_items.jsxinc'), 'utf8');

  assert.match(source, /HI\.resolveTextFrameOverflow\s*=/);
  assert.match(source, /TEXT_FIT_APPLIED/);
  assert.match(source, /TEXT_FIT_UNRESOLVED/);
  assert.match(source, /maxGrowX/);
  assert.match(source, /maxGrowY/);
  assert.match(items, /HI\.resolveTextFrameOverflow\(report,\s*frame,\s*item\)/);
});

test('asset helper does not silently ignore advanced placement options', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');
  for (const token of [
    'placed.artboard',
    'placed.layerComp',
    'placed.visibleLayers',
    'placed.hiddenLayers',
    'HI.applyPlacedGraphicLayerOptions',
    'graphicLayerOptions',
    'currentVisibility',
    'placed.preserveVector',
    'AI_ARTBOARD_APPLY_FAILED',
    'PSD_LAYER_COMP_UNSUPPORTED',
    'PLACED_ASSET_LAYER_VISIBILITY_APPLY_FAILED',
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
  assert.match(source, /HI\.reverseItemType/);
  assert.match(source, /HI\.reverseVectorGeometry/);
  assert.match(source, /auditItems:\s*HI\.reversePageAuditItems/);
  assert.match(source, /HI\.reverseAuditPageItems/);
  assert.match(source, /HI\.reverseItemParentInfo/);
  assert.match(source, /pathPoints/);
  assert.match(source, /leftDirection/);
  assert.match(source, /rightDirection/);
  assert.match(source, /HI\.reversePlacedAsset/);
  assert.match(source, /HI\.reversePdfAttributes/);
  assert.match(source, /HI\.reverseGraphicLayerOptions/);
  assert.match(source, /HI\.exportPlacedAssetPreview/);
  assert.match(source, /ExportFormat\.PNG_FORMAT/);
  assert.match(source, /HI\.reverseTextStyle/);
  assert.match(source, /HI\.reverseTextRuns/);
  assert.match(source, /HI\.reverseCharacterTextStyle/);
  assert.match(source, /HI\.reverseTextValue/);
  assert.match(source, /DOUBLE_LEFT_QUOTE/);
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
  assert.match(source, /fillOpacity/);
  assert.match(source, /strokeOpacity/);
  assert.match(source, /strokeType/);
  assert.match(source, /leftLineEnd/);
  assert.match(source, /rightLineEnd/);
  assert.match(source, /endCap/);
  assert.match(source, /endJoin/);
  assert.match(source, /miterLimit/);
  assert.match(source, /strokeAlignment/);
  assert.match(source, /fillTint/);
  assert.match(source, /strokeTint/);
  assert.match(source, /blendMode/);
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

test('reverse visual style treats empty None stroke color as no stroke', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_reverse_styles.jsxinc'), 'utf8');

  assert.match(source, /name === ""/);
  assert.match(source, /out\.strokeWeight = out\.strokeColor \? HI\.positiveNumberOrNull/);
});

test('reverse snapshot derives HTML z order from InDesign layer and front-to-back item order', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(source, /HI\.reverseLayerIndexMap/);
  assert.match(source, /HI\.reverseTopLevelPageItems/);
  assert.match(source, /HI\.reverseAuditPageItems/);
  assert.match(source, /allPageItems/);
  assert.match(source, /HI\.isTopLevelReverseItem/);
  assert.match(source, /HI\.reverseItemZIndex/);
  assert.match(source, /itemLayer/);
  assert.match(source, /layerBase/);
  assert.match(source, /var local = Number\(total\s*-\s*1\s*-\s*index\)/);
  assert.match(source, /layer\.count\s*-\s*1\s*-\s*layer\.index/);
  assert.match(source, /zIndex:\s*HI\.reverseItemZIndex\(item,\s*index,\s*total,\s*layerOrder\)/);
});

test('reverse snapshot records and respects InDesign layer and item visibility', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(source, /HI\.shouldReversePageItem/);
  assert.match(source, /item\.visible/);
  assert.match(source, /item\.nonprinting/);
  assert.match(source, /item\.itemLayer\.visible/);
  assert.match(source, /item\.itemLayer\.printable/);
  assert.match(source, /visible:\s*HI\.reverseLayerVisible/);
  assert.match(source, /printable:\s*HI\.reverseLayerPrintable/);
});

test('reverse snapshot extracts parent page items instead of dropping master decoration', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(source, /HI\.reverseParentPageItems/);
  assert.match(source, /HI\.reverseTopLevelPageItems\(masterSpread\)/);
  assert.match(source, /container\.pageItems/);
  assert.match(source, /HI\.reversePageItem\(items\[i\]/);
});

test('reverse snapshot records placed asset frame and content geometry', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(source, /HI\.reverseAssetGeometry/);
  assert.match(source, /frameBounds/);
  assert.match(source, /contentBounds/);
  assert.match(source, /contentOffset/);
  assert.match(source, /contentSize/);
  assert.match(source, /contentScale/);
  assert.match(source, /out\.fit\s*=\s*"manual"/);
});

test('reverse snapshot exports generated previews for embedded images without source paths', () => {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse.jsxinc'), 'utf8');

  assert.match(source, /HI\.needsPlacedPreview/);
  assert.match(source, /if\s*\(!assetPath\)\s*return true/);
  assert.match(source, /HI\.tryExportPlacedAssetPreviewItem/);
  assert.match(source, /HI\.tryExportPlacedAssetPreviewItem\(item,\s*target\)[\s\S]*HI\.tryExportPlacedAssetPreviewItem\(graphic,\s*target\)/);
  assert.match(source, /target\.exists/);
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
