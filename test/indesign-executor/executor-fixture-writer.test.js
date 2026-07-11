const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { validateInstructions } = require('../../src/writers/indesign');
const { writeExecutorSmokeWorkspace } = require('./executor-fixture-writer');

test('writeExecutorSmokeWorkspace writes valid instructions and local placeable assets', () => {
  const workspaceDir = path.resolve(__dirname, '../workspace/indesign-executor-smoke');
  const result = writeExecutorSmokeWorkspace(workspaceDir);

  assert.equal(fs.existsSync(result.instructionsPath), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, 'executor-assets/site-plan.pdf')), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, 'executor-assets/diagram.svg')), true);
  assert.match(
    fs.readFileSync(path.join(workspaceDir, 'executor-assets/site-plan.pdf'), 'ascii'),
    /\/TrimBox \[0 0 200 120\]/,
  );
  assert.equal(result.instructions.pages[0].items.length, 4);

  const validation = validateInstructions(result.instructions, {
    checkAssetFiles: true,
    baseDir: workspaceDir,
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
});

test('validateInstructions reports missing asset files when asset preflight is enabled', () => {
  const instructions = {
    metadata: {},
    document: { pages: [{ id: 'p1', width: 100, height: 100 }] },
    styles: {
      swatches: {},
      fonts: {},
      compositeFonts: {},
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
      cellStyles: {},
    },
    assets: [{ id: 'missing-pdf', resolvedPath: 'assets/missing.pdf' }],
    layers: [],
    pages: [{
      id: 'p1',
      items: [{
        id: 'g1',
        type: 'GRAPHIC',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        placed: { assetId: 'missing-pdf' },
        zIndex: 1,
      }],
    }],
  };

  const result = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: __dirname,
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'ASSET_FILE_NOT_FOUND'), true);
});

test('validateInstructions accepts existing local file URL assets during preflight', () => {
  const workspaceDir = path.resolve(__dirname, '../workspace/indesign-executor-file-url');
  const result = writeExecutorSmokeWorkspace(workspaceDir);
  const pdfAsset = result.instructions.assets.find((asset) => asset.kind === 'pdf');
  pdfAsset.resolvedPath = pathToFileURL(path.resolve(workspaceDir, pdfAsset.resolvedPath)).href;

  const validation = validateInstructions(result.instructions, {
    checkAssetFiles: true,
    baseDir: workspaceDir,
  });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
});
