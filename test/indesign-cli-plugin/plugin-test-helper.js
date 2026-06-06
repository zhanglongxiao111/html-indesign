const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const pluginEntry = path.join(repoRoot, 'src', 'indesign-cli-plugin', 'index.js');
const workspaceRoot = path.join(repoRoot, 'test', 'workspace');

function callPlugin(method, params = {}, context = { cwd: repoRoot }) {
  const result = spawnSync(process.execPath, [pluginEntry], {
    cwd: repoRoot,
    input: JSON.stringify({ method, params, context }),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), '');
  return JSON.parse(result.stdout);
}

module.exports = {
  callPlugin,
  repoRoot,
  workspaceRoot,
};
