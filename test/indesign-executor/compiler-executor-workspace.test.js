const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validateInstructions } = require('../../src/paged-html');
const { writeCompilerExecutorWorkspace } = require('./compiler-executor-workspace');

test('writeCompilerExecutorWorkspace compiles real paged HTML into executor instructions', async () => {
  const workspaceDir = path.resolve(__dirname, '../workspace/compiler-executor-e2e');
  const result = await writeCompilerExecutorWorkspace(workspaceDir);
  const instructions = result.instructions;

  assert.equal(fs.existsSync(result.htmlPath), true);
  assert.equal(fs.existsSync(result.instructionsPath), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, 'compiler-assets/site-plan.pdf')), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, 'compiler-assets/diagram.svg')), true);

  const validation = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: workspaceDir,
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);

  assert.equal(instructions.pages.length, 1);
  assert.equal(instructions.assets.length, 2);
  assert.ok(instructions.styles.paragraphStyles['report-title']);
  assert.ok(instructions.styles.characterStyles.accent);
  assert.ok(instructions.styles.objectStyles['metric-card']);
  assert.ok(instructions.styles.frameStyles['drawing-frame']);

  const page = instructions.pages[0];
  const title = page.items.find((item) => item.id === 'compiler-title');
  assert.equal(title.type, 'TEXT');
  assert.equal(title.text, '建筑设计汇报重点');
  assert.equal(title.runs.map((run) => run.text).join(''), title.text);
  assert.equal(title.runs.some((run) => run.characterStyle === 'accent'), true);

  const graphics = page.items.filter((item) => item.type === 'GRAPHIC');
  assert.equal(graphics.length, 2);
  assert.equal(graphics.every((item) => item.placed && item.placed.assetId), true);
});
