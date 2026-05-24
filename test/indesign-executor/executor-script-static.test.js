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
    'hi_document.jsxinc',
    'hi_styles.jsxinc',
    'hi_assets.jsxinc',
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
    'hi_core.jsxinc': ['HI.readJsonFile', 'HI.stringify', 'HI.makeReport', 'HI.boundsToGeometricBounds'],
    'hi_document.jsxinc': ['HI.prepareDocument', 'HI.ensureLayers', 'HI.getPageForInstruction'],
    'hi_styles.jsxinc': ['HI.ensureStyles', 'HI.applyParagraphStyle', 'HI.applyObjectStyle'],
    'hi_assets.jsxinc': ['HI.resolveAssetFile', 'HI.placeAssetInFrame', 'HI.applyFitting'],
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
    assert.ok(source.split(/\r?\n/).length <= 260, `${fileName} should stay small`);
  }
});

test('document helper configures page geometry layers and unit restoration', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_document.jsxinc'), 'utf8');
  for (const token of [
    'HI.restoreDocumentPreferences',
    'MeasurementUnits.MILLIMETERS',
    'RulerOrigin.PAGE_ORIGIN',
    'documentPreferences.pageWidth',
    'documentPreferences.pageHeight',
    'documentPreferences.facingPages = false',
    'report.counts.layers',
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('styles helper creates swatches and InDesign text/object style resources', () => {
  const source = fs.readFileSync(path.join(libDir, 'hi_styles.jsxinc'), 'utf8');
  for (const token of [
    'HI.ensureSwatches',
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
