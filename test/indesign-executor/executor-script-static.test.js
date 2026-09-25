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
  const { buildBuildJsx } = require('../../src/indesign-cli-plugin/host-jsx');
  const source = buildBuildJsx({
    repoRoot: root,
    instructionsPath: path.join(root, 'test/workspace/instructions.json'),
  });
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
    'hi_composite_fonts.jsxinc',
    'hi_styles.jsxinc',
    'hi_text_overrides.jsxinc',
    'hi_blend_modes.jsxinc',
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
    'hi_composite_fonts.jsxinc': ['HI.ensureCompositeFonts', 'HI.assignCompositeFontEntries', 'HI.reverseCompositeFonts'],
    'hi_styles.jsxinc': ['HI.ensureStyles', 'HI.applyParagraphStyle', 'HI.applyObjectStyle'],
    'hi_text_overrides.jsxinc': ['HI.applyTextOverride', 'HI.textOverrideSegments', 'HI.overrideOutsideCharacterStyle', 'HI.applyCharacterLevelOverride'],
    'hi_blend_modes.jsxinc': ['HI.applyBlendMode', 'HI.blendModeKey', 'HI.blendModeValue'],
    'hi_vector_styles.jsxinc': ['HI.applyStrokeOpacity', 'HI.applyLineMarker', 'HI.lineMarkerName', 'HI.createVectorGroupFrame'],
    'hi_assets.jsxinc': ['HI.resolveAssetFile', 'HI.placeAssetInFrame', 'HI.applyFitting'],
    'hi_tables.jsxinc': ['HI.tableGridFromRows', 'HI.applyTableSpans', 'HI.applyTableCells', 'HI.leadingHeaderRowCount', 'HI.applyTableHeaderRows'],
    'hi_text_fit.jsxinc': ['HI.resolveTextFrameOverflow', 'HI.applyTextFitNudge', 'TEXT_FIT_APPLIED', 'TEXT_FIT_NUDGE_APPLIED', 'TEXT_FIT_UNRESOLVED'],
    'hi_items.jsxinc': ['HI.buildInstructionItems', 'HI.createTextFrame', 'HI.createGraphicFrame'],
    'hi_executor.jsxinc': ['HI.runBuildFromInstructions', 'HI.runBuildInstructions'],
  };

  for (const [fileName, apiNames] of Object.entries(expectations)) {
    const filePath = path.join(libDir, fileName);
    assert.equal(fs.existsSync(filePath), true, `${fileName} should exist`);
    const source = fs.readFileSync(filePath, 'utf8');
    for (const apiName of apiNames) {
      assert.match(source, new RegExp(apiName.replace('.', '\\.')));
    }
    if (fileName === 'hi_executor.jsxinc') {
      assert.equal(source.includes(['HI', 'run' + 'LegacyBuildInstructions'].join('.')), false);
      assert.equal(source.includes(['HI', 'run' + 'Paged' + 'HtmlBuildInstructions'].join('.')), false);
    }
    assert.ok(source.split(/\r?\n/).length <= 340, `${fileName} should stay small`);
  }
});

test('table frames set InDesign header rows from leading header rows before spans and cells', () => {
  const items = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const tables = fs.readFileSync(path.join(libDir, 'hi_tables.jsxinc'), 'utf8');

  const headerCall = items.indexOf('HI.applyTableHeaderRows(table, item.rows || [], report);');
  const spansCall = items.indexOf('HI.applyTableSpans(table, grid, report);');
  assert.ok(headerCall > 0, 'createTableFrame must apply header rows');
  assert.ok(headerCall < spansCall, 'header rows must be set before spans are merged');

  assert.match(tables, /table\.rows\[r\]\.rowType = RowTypes\.HEADER_ROW;/);
  assert.equal(tables.includes('table.headerRowCount = count'), false, 'assigning headerRowCount appends rows instead of converting them');
  assert.match(tables, /TABLE_HEADER_APPLY_FAILED/);
  assert.match(tables, /TABLE_HEADER_SPAN_CROSSES_BODY/);
  // Only leading rows count: a header row in the middle of a table has no InDesign equivalent.
  assert.match(tables, /if \(!\(row\.header === true \|\| allHeader\)\) break;/);
});

test('executor label helpers report key label write failures', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_labels.jsxinc'), 'utf8');
  assert.match(source, /HI\.writeProtocolLabels/);
  assert.match(source, /LABEL_WRITE_FAILED/);
  assert.match(source, /critical/);
});

test('executor fails closed for non-current instruction schemas', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_executor.jsxinc'), 'utf8');
  let buildCalled = false;
  const context = {
    HI: {
      readJsonFile() {
        return {
          data: { template: { items: [] } },
          baseFolder: 'base',
        };
      },
      makeReport() {
        return { ok: true, messages: [], errors: [], warnings: [], counts: {} };
      },
      addMessage(report, level, code, message, details) {
        const entry = { level, code, message, details: details || {} };
        report.messages.push(entry);
        if (level === 'error') {
          report.ok = false;
          report.errors.push(entry);
        }
        return entry;
      },
    },
  };
  vm.runInNewContext(source, context);
  context.HI.runBuildInstructions = () => {
    buildCalled = true;
    throw new Error('build should not run');
  };

  const report = context.HI.runBuildFromInstructions({}, 'instructions.json');

  assert.equal(buildCalled, false);
  assert.equal(report.ok, false);
  assert.equal(report.errors[0].code, 'INSTRUCTIONS_SCHEMA_UNSUPPORTED');
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
    'style.appliedFont = font',
  ]) {
    assert.match(stylesSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const token of [
    'HI.resolveFont',
    'HI.fontStyleNameFor',
    'def.fontStyleName',
    'HI.installedFontNameFor(families[j], styles[i])',
    'app.fonts.itemByName(name)',
    'font.isValid !== true',
    'String(font.fontFamily || "")',
  ]) {
    assert.match(fontsSource, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(stylesSource, /\.fontStyle\s*=\s*HI\.lastFontResolution\.styleName/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(libDir, 'hi_text_overrides.jsxinc'), 'utf8'),
    /\.fontStyle\s*=\s*HI\.lastFontResolution\.styleName/,
  );
  assert.doesNotMatch(
    fs.readFileSync(path.join(libDir, 'hi_tables.jsxinc'), 'utf8'),
    /\.fontStyle\s*=\s*HI\.lastFontResolution\.styleName/,
  );
});

test('executor follows compiled font fallbacks and resolves Windows InDesign font aliases', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  const fontsSource = fs.readFileSync(path.join(libDir, 'hi_fonts.jsxinc'), 'utf8');
  const tablesSource = fs.readFileSync(path.join(libDir, 'hi_tables.jsxinc'), 'utf8');

  assert.match(stylesSource, /HI\.configureFonts\(styles\.fonts \|\| \{\}\)/);
  assert.match(fontsSource, /HI\.fontDefs\s*=\s*defs \|\| \{\}/);
  assert.match(fontsSource, /FONT_FALLBACK_APPLIED/);
  assert.match(fontsSource, /HI\.fontFamilyCandidates/);
  assert.match(fontsSource, /app\.fonts\.everyItem\(\)\.name/);
  assert.match(fontsSource, /HI\.installedFontNameFor/);
  assert.match(fontsSource, /Noto Sans SC \(TT\)/);
  assert.match(fontsSource, /微软雅黑/);
  assert.match(fontsSource, /def\.fallback/);
  assert.match(
    fontsSource,
    /base === "semibold"[^\n]+weights = \[base, "bold", "medium", "regular"\]/,
    'when Semibold is unavailable, the fallback order must match Chromium and prefer Bold before Medium',
  );
  assert.ok(
    tablesSource.indexOf('cell.texts[0].appliedParagraphStyle') < tablesSource.indexOf('cell.texts[0].fillColor'),
    'table paragraph style must be applied before cell text overrides',
  );
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

  assert.deepEqual(JSON.parse(JSON.stringify(context.HI.vectorPathPointArray({
    anchor: { x: 20, y: 30 },
    leftDirection: { x: 10, y: 30 },
    rightDirection: { x: 40, y: 50 },
  }))), [[10, 30], [20, 30], [40, 50]]);
});

test('item and style helpers apply native vector paths and line markers', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const styleSource = fs.readFileSync(path.join(libDir, 'hi_vector_styles.jsxinc'), 'utf8');

  for (const token of [
    'HI.createVectorShapePageItem',
    'page.polygons.add',
    'HI.applyVectorGeometry',
    'HI.applyVectorPath',
    'HI.vectorPathPointArray',
    'targetPath.entirePath',
    'PathType.CLOSED_PATH',
    'PathType.OPEN_PATH',
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

test('multi-path vectors create one native child per path and group them without lossy fallback', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const vectorStyleSource = fs.readFileSync(path.join(libDir, 'hi_vector_styles.jsxinc'), 'utf8');

  assert.match(itemSource, /HI\.createVectorGroupFrame\(doc,\s*page,\s*item/);
  assert.match(vectorStyleSource, /HI\.createVectorGroupFrame\s*=\s*function/);
  assert.match(vectorStyleSource, /for \(var i = 0; i < paths\.length; i\+\+\)/);
  assert.match(vectorStyleSource, /HI\.applyVectorPath\(targetPath,\s*path/);
  assert.match(vectorStyleSource, /HI\.applyStyleOverride\(doc,\s*children\[j\],\s*paths\[j\]\.styleOverride/);
  assert.match(vectorStyleSource, /page\.groups\.add\(children\)/);
  assert.match(vectorStyleSource, /HI\.applyObjectStyle\(doc,\s*group,\s*item\.objectStyle/);
  assert.match(vectorStyleSource, /HI\.applyObjectStyle\(doc,\s*group,\s*item\.objectStyle[\s\S]*for \(var j = 0; j < children\.length; j\+\+\)[\s\S]*HI\.applyStyleOverride\(doc,\s*children\[j\],\s*paths\[j\]\.styleOverride/);
  assert.match(vectorStyleSource, /html_indesign_vector_path_index/);
  assert.doesNotMatch(itemSource, /VECTOR_MULTIPATH_UNSUPPORTED/);
  assert.doesNotMatch(vectorStyleSource, /VECTOR_MULTIPATH_UNSUPPORTED/);
});

test('style helper clears explicit zero stroke through the None swatch', () => {
  const coreSource = fs.readFileSync(path.join(libDir, 'hi_core.jsxinc'), 'utf8');
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');

  assert.match(coreSource, /HI\.swatchByName/);
  assert.match(coreSource, /swatch\.isValid/);
  assert.match(coreSource, /app\.translateKeyString\("\$ID\/None"\)/);
  assert.match(coreSource, /HI\.noneSwatch/);
  assert.match(coreSource, /HI\.strokeSwatchFor/);
  assert.match(coreSource, /HI\.applyStrokePaint/);
  assert.match(coreSource, /target\.strokeWeight = 0; target\.strokeColor = strokeSwatch/);
  assert.match(stylesSource, /HI\.applyStrokePaint\(doc, style, def\.strokeColor, def\.strokeWeight\)/);
  assert.match(stylesSource, /HI\.applyStrokePaint\(doc, pageItem, override\.strokeColor, override\.strokeWeight\)/);
});

test('item helper clears InDesign default stroke on new drawable page items', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const vectorStyleSource = fs.readFileSync(path.join(libDir, 'hi_vector_styles.jsxinc'), 'utf8');
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');

  assert.match(vectorStyleSource, /HI\.clearDefaultStroke/);
  assert.match(vectorStyleSource, /HI\.clearDefaultVectorPaint/);
  assert.match(vectorStyleSource, /pageItem\.fillColor = none/);
  assert.match(itemSource, /HI\.clearDefaultStroke\(doc, rect\)/);
  assert.match(itemSource, /HI\.createShapeFrame[\s\S]*HI\.clearDefaultVectorPaint\(doc, rect\)/);
  assert.match(itemSource, /HI\.clearDefaultStroke\(doc, line\)/);
  assert.match(stylesSource, /override\.fillColor === null \? HI\.noneSwatch\(doc\)/);
});

test('reverse snapshot preserves inactive stroke width for native vector paths', () => {
  const reverseSource = fs.readFileSync(path.join(libDir, 'hi_reverse.jsxinc'), 'utf8');

  assert.match(reverseSource, /if \(vectorGeometry\)[\s\S]*visualStyle\.strokeWeight = HI\.positiveNumberOrNull/);
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

test('graphic frame style overrides are reapplied after placing assets', () => {
  const itemSource = fs.readFileSync(path.join(libDir, 'hi_items.jsxinc'), 'utf8');
  const start = itemSource.indexOf('HI.createGraphicFrame = function');
  const body = itemSource.slice(
    start,
    itemSource.indexOf('HI.createShapeFrame', start),
  );

  assert.match(body, /HI\.placeAssetInFrame\(doc,\s*rect,\s*asset,\s*placed,\s*context\.baseFolder,\s*report\)[\s\S]*HI\.applyStyleOverride\(doc,\s*rect,\s*item\.styleOverride,\s*report\)/);
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

  const vectorSource = fs.readFileSync(path.join(libDir, 'hi_vector_styles.jsxinc'), 'utf8');
  const vectorContext = { HI: {} };
  vm.runInNewContext(vectorSource, vectorContext);
  assert.deepEqual(
    JSON.parse(JSON.stringify(vectorContext.HI.dashPatternFromStrokeStyle('6px, 6px'))),
    [6, 6],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(vectorContext.HI.dashPatternFromStrokeStyle('虚线（3 和 2）'))),
    [3, 2],
  );
  assert.match(vectorSource, /doc\.dashedStrokeStyles\.add/);
  assert.match(vectorSource, /dashArray/);
});

test('style helper applies full stroke alignment values to object styles', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');

  assert.match(stylesSource, /HI\.applyStrokeAlignment\(style,\s*def\.strokeAlignment\)/);
  assert.doesNotMatch(stylesSource, /if \(def\.strokeAlignment === "inside"\) style\.strokeAlignment = StrokeAlignment\.INSIDE_ALIGNMENT/);
});

test('blend mode helper maps CSS and observed blend modes into explicit executor calls', () => {
  const stylesSource = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  const blendSource = fs.readFileSync(path.join(libDir, 'hi_blend_modes.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(blendSource, context);

  assert.match(stylesSource, /HI\.applyBlendMode\(style,\s*def\.blendMode,\s*report\)/);
  assert.match(stylesSource, /HI\.applyBlendMode\(pageItem,\s*override\.blendMode,\s*report\)/);
  assert.equal(context.HI.blendModeKey('multiply'), 'multiply');
  assert.equal(context.HI.blendModeKey('正片叠底'), 'multiply');
  assert.equal(context.HI.blendModeKey('saturation'), 'saturation');
  assert.equal(context.HI.blendModeKey('normal'), '');
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
  const { buildBuildJsx } = require('../../src/indesign-cli-plugin/host-jsx');
  const e2e = buildBuildJsx({
    repoRoot: root,
    instructionsPath: path.join(root, 'test/workspace/instructions.json'),
  });

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
  assert.match(source, /HI\.applyTextFitWidthFirst/);
  assert.match(source, /TEXT_FIT_WIDTH_APPLIED/);
  assert.ok(
    source.indexOf('HI.applyTextFitWidthFirst') < source.indexOf('frame.fit(FitOptions.FRAME_TO_CONTENT)'),
    'single-line authored text should try bounded width growth before adding a wrapped line',
  );
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

test('asset helper matches placed graphic layer names verbatim, including "|" and commas (#33)', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_assets.jsxinc'), 'utf8');
  const messages = [];
  const context = {
    HI: {
      addMessage: (report, level, code, message, details) => messages.push({ level, code, details }),
    },
  };
  vm.runInNewContext(source, context);
  const layer = (name, currentVisibility) => ({ name, currentVisibility });
  const layers = [
    layer('A_建筑_2D_区域.A', false),
    layer('合并底图|PM-隔断', false),
    layer('合并底图', true),
    layer('PM-隔断', true),
    layer('A, B', true),
  ];
  const frame = { allGraphics: [{ graphicLayerOptions: { graphicLayers: layers } }] };

  context.HI.applyPlacedGraphicLayerOptions(frame, {
    visibleLayers: ['A_建筑_2D_区域.A', '合并底图|PM-隔断'],
    hiddenLayers: ['合并底图', 'PM-隔断', 'A, B', '不存在的图层'],
  }, {}, { id: 'asset-drawing-pdf' });

  assert.deepEqual(layers.map((entry) => entry.currentVisibility), [true, true, false, false, false]);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].code, 'PLACED_ASSET_LAYER_NOT_FOUND');
  assert.deepEqual(JSON.parse(JSON.stringify(messages[0].details.missingLayers)), ['不存在的图层']);
  // 字符串不再被当成 `|` / `,` 拼接的图层名单拆开：图层名单只接受数组。
  assert.equal(context.HI.layerNameSet('合并底图|PM-隔断'), null);
  assert.equal(context.HI.layerNameSet([]), null);
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
  assert.match(source, /hi_reverse_colors\.jsxinc/);
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
  const colorPath = path.resolve('_indesign_scripts/lib/hi_reverse_colors.jsxinc');
  assert.equal(fs.existsSync(colorPath), true, 'hi_reverse_colors.jsxinc should exist');
  assert.equal(fs.existsSync(stylePath), true, 'hi_reverse_styles.jsxinc should exist');
  assert.equal(fs.existsSync(textPath), true, 'hi_reverse_text.jsxinc should exist');
  assert.equal(fs.existsSync(effectPath), true, 'hi_reverse_effects.jsxinc should exist');
  assert.equal(fs.existsSync(tablePath), true, 'hi_reverse_tables.jsxinc should exist');
  const styleSource = fs.readFileSync(stylePath, 'utf8');
  const textSource = fs.readFileSync(textPath, 'utf8');
  const effectSource = fs.readFileSync(effectPath, 'utf8');
  const tableSource = fs.readFileSync(tablePath, 'utf8');
  const colorSource = fs.readFileSync(colorPath, 'utf8');
  const source = `${reverseSource}\n${styleSource}\n${colorSource}\n${textSource}\n${effectSource}\n${tableSource}`;
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
  assert.ok(colorSource.split(/\r?\n/).length <= 140, 'hi_reverse_colors.jsxinc should stay focused');
});

test('reverse text helper restores InDesign special-character names to authored Unicode', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_reverse_text.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(source, context);

  assert.equal(
    context.HI.reverseTextValue('EM_DASHEM_DASH EN_DASH DOUBLE_STRAIGHT_QUOTE'),
    '—— – "',
  );
  assert.equal(context.HI.reverseTextValue('旋转 8DEGREE_SYMBOL'), '旋转 8°');
});

test('reverse visual style treats empty None stroke color as no stroke', () => {
  const source = ['hi_reverse_styles.jsxinc', 'hi_reverse_colors.jsxinc']
    .map((name) => fs.readFileSync(path.join(libDir, name), 'utf8'))
    .join('\n');

  assert.match(source, /HI\.reverseStrokeColor/);
  assert.match(source, /String\(color\.name \|\| ""\) === ""/);
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

// ExtendScript 解释器缺陷（issue #9）：对 InDesign DOM 对象上不存在的属性写
// if (!o.p) / return !o.p / !o.p ? a : b / while (!o.p)（含 a || !o.p 这类链式条件），
// 报错会绕过同一函数里的 try/catch；var v = o.p; if (!v) 能被正常接住。
// 因此 JSX 里对「标识符.属性」取反后直接用于判断、return 或三元时，一律先落到变量再取反。
// 例外只允许普通 JS 值（instruction JSON、JS 数组、HI 命名空间）和 ExtendScript File，按文件逐个登记接收者。
const NEGATED_MEMBER_GLOBAL_RECEIVERS = Object.freeze({
  HI: 'HI 命名空间是普通 JS 对象，不是 InDesign DOM',
});
const NEGATED_MEMBER_ALLOWED_RECEIVERS = Object.freeze({
  'build_from_instructions.jsx': { lib: 'ExtendScript File，exists 在所有 File 上都存在' },
  'export_to_html_snapshot.jsx': { lib: 'ExtendScript File，exists 在所有 File 上都存在' },
  'hi_assets.jsxinc': { file: 'ExtendScript File' },
  'hi_composite_fonts.jsxinc': { def: 'instruction 里的复合字体定义 JSON', familyFaces: 'JS 数组' },
  'hi_core.jsxinc': { file: 'ExtendScript File' },
  'hi_document.jsxinc': { ordered: 'JS 数组' },
  'hi_fonts.jsxinc': { index: '字体索引普通对象' },
  'hi_items.jsxinc': {
    runs: 'instruction 文本 run 数组',
    textFrameStyle: 'instruction textFrameStyle JSON',
    vector: 'instruction vectorGeometry JSON',
    context: '构建上下文普通对象',
  },
  'hi_parent_pages.jsxinc': {
    nestedSpec: 'instruction 母版定义 JSON',
    spec: 'instruction 母版定义 JSON',
    context: '构建上下文普通对象',
  },
  'hi_reverse.jsxinc': {
    items: 'HI.collectionElements 返回的 JS 数组',
    raw: 'HI.collectionElements 返回的 JS 数组',
    paths: '反向矢量路径 JS 数组',
    context: '预览导出上下文普通对象',
  },
  'hi_reverse_effects.jsxinc': { stops: '不透明度色标 JS 数组' },
  'hi_tables.jsxinc': {
    rows: 'instruction 表格行 JSON',
    cells: 'instruction 单元格 JSON',
    rowDef: 'instruction 单元格 JSON',
  },
  'hi_text_fit.jsxinc': { item: 'instruction item JSON（textFit 配置）' },
});
// extract_blueprint.jsx 是冻结的历史 blueprint 抽取脚本，不在当前构建 / 反向导出路径；_debug/ 不随包发布。
const NEGATED_MEMBER_EXCLUDED_SCRIPTS = Object.freeze(['extract_blueprint.jsx']);

function negatedDomMemberUsages(source) {
  const findings = [];
  const identifier = '[A-Za-z_$][\\w$]*';
  const chain = `${identifier}(?:\\s*\\.\\s*${identifier}|\\s*\\[[^\\]\\n]*\\])+`;
  const patterns = [
    new RegExp(`!\\s*(${chain})(?!\\s*[\\w$.\\[(])`, 'g'),
    new RegExp(`!\\s*\\(\\s*(${chain})\\s*\\)`, 'g'),
  ];
  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.replace(/\/\/.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line))) {
        const expression = match[1].replace(/\s+/g, '');
        // 只管「标识符.属性」；纯下标访问（visited[key]、out[a.b]）是普通 JS 查表。
        if (!expression.replace(/\[[^\]]*\]/g, '[]').includes('.')) continue;
        if (!isConditionalUse(line, match.index, match.index + match[0].length)) continue;
        findings.push({ line: index + 1, receiver: expression.split(/[.[]/)[0], expression, text: rawLine.trim() });
      }
    }
  });
  return findings;
}

function isConditionalUse(line, start, end) {
  const statementStart = Math.max(line.lastIndexOf(';', start), line.lastIndexOf('{', start), line.lastIndexOf('}', start)) + 1;
  const before = line.slice(statementStart, start);
  if (/\breturn\b/.test(before)) return true;
  const keyword = /\b(?:if|while)\s*\(/g;
  let last = null;
  let found;
  while ((found = keyword.exec(before))) last = found;
  if (last) {
    const inside = before.slice(last.index + last[0].length);
    const depth = (inside.match(/\(/g) || []).length - (inside.match(/\)/g) || []).length;
    if (depth >= 0) return true;
  }
  const rest = line.slice(end);
  const statementEnd = rest.indexOf(';');
  return /\?/.test(statementEnd >= 0 ? rest.slice(0, statementEnd) : rest);
}

test('negated DOM member guard recognises the ExtendScript try/catch bypass forms', () => {
  for (const bad of [
    'if (!color.colorValue) return null;',
    'if (!(color.colorValue)) return null;',
    'if (!color || !color.isValid) return null;',
    'if (a && !graphic.graphicLayerOptions) return out;',
    'return !frame.overflows;',
    'var kind = !color.colorValue ? "a" : "b";',
    'while (!item.parent.isValid) { break; }',
  ]) {
    assert.equal(negatedDomMemberUsages(bad).length, 1, bad);
  }
  for (const ok of [
    'var v = HI.reverseSafeProperty(color, "colorValue"); if (!v || !(v.length > 0)) return null;',
    'var missing = !color.colorValue;',
    'if (!HI.isTextFrame(item)) return null;',
    'if (!graphic.getElements()) return null;',
    'if (!visited[name]) visited[name] = true;',
    '// if (!o.p) 只在注释里',
    'if (x) y = !o.p;',
  ]) {
    assert.deepEqual(negatedDomMemberUsages(ok), [], ok);
  }
});

test('JSX libs never negate DOM member expressions directly in conditions, returns or ternaries', () => {
  const scripts = fs.readdirSync(path.join(root, '_indesign_scripts'))
    .filter((name) => name.endsWith('.jsx') && !NEGATED_MEMBER_EXCLUDED_SCRIPTS.includes(name))
    .map((name) => path.join(root, '_indesign_scripts', name));
  const libs = fs.readdirSync(libDir)
    .filter((name) => name.endsWith('.jsxinc'))
    .map((name) => path.join(libDir, name));
  const violations = [];
  const usedAllowances = new Set();
  for (const filePath of [...scripts, ...libs]) {
    const fileName = path.basename(filePath);
    const allowed = NEGATED_MEMBER_ALLOWED_RECEIVERS[fileName] || {};
    for (const finding of negatedDomMemberUsages(fs.readFileSync(filePath, 'utf8'))) {
      if (Object.prototype.hasOwnProperty.call(NEGATED_MEMBER_GLOBAL_RECEIVERS, finding.receiver)) continue;
      if (Object.prototype.hasOwnProperty.call(allowed, finding.receiver)) {
        usedAllowances.add(`${fileName}:${finding.receiver}`);
        continue;
      }
      violations.push(`${fileName}:${finding.line} ${finding.expression} -> ${finding.text}`);
    }
  }
  assert.deepEqual(violations, [], 'assign DOM properties to a variable (or use HI.reverseSafeProperty) before negating them');

  const staleAllowances = Object.entries(NEGATED_MEMBER_ALLOWED_RECEIVERS)
    .flatMap(([fileName, receivers]) => Object.keys(receivers).map((receiver) => `${fileName}:${receiver}`))
    .filter((key) => !usedAllowances.has(key));
  assert.deepEqual(staleAllowances, [], 'remove allowlist entries that no longer match any usage');
});

// InDesign 的 $.evalFile 对无 BOM 的文件按开头若干字节猜编码：第一个中文字符出现得晚（09-26 实测 12310 字节处）
// 就会按本地编码读坏，整份脚本加载失败（INDESIGN_SNAPSHOT_FAILED: TypeError: Cannot convert）。
// 单元测试不开 InDesign 抓不到，只能在这里静态守住：含非 ASCII 字节的生产 JSX 必须带 UTF-8 BOM。
test('production JSX files with non-ASCII bytes start with a UTF-8 BOM', () => {
  const scriptsDir = path.join(root, '_indesign_scripts');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === '_debug' ? [] : walk(path.join(dir, entry.name));
    return /\.(jsx|jsxinc)$/.test(entry.name) ? [path.join(dir, entry.name)] : [];
  });
  const missing = walk(scriptsDir).filter((file) => {
    const bytes = fs.readFileSync(file);
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    return !hasBom && bytes.some((byte) => byte > 0x7f);
  }).map((file) => path.relative(root, file));
  assert.deepEqual(missing, [], `add a UTF-8 BOM (or keep the file ASCII-only): ${missing.join(', ')}`);
});
