const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');
const { collectRequireGraphFromFiles } = require('./helpers/require-graph');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G8';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G8.json');

const G8_RULE_METADATA = {
  'G8.1 src module has an owner': {
    reason: 'Source modules must be reachable from a public entry, script, or another owned source module.',
    remediation: 'Require the module from its intended owner or delete it if it is dead code.',
  },
};

test('G8 catches an unrequired src module through the real require graph collector', () => {
  const root = makeSampleProject({
    'index.js': 'module.exports = require("./src/used");\n',
    'src/used.js': 'module.exports = {};\n',
    'src/orphan.js': 'module.exports = {};\n',
  });

  const violations = collectG8Violations(root);

  assert.deepEqual(violations, [{
    rule: 'G8.1 src module has an owner',
    file: 'src/orphan.js',
    detail: 'src module has no static incoming require edge',
  }]);

  const message = formatG8Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G8\.1 src module has an owner/);
  assert.match(message, /Reason: Source modules must be reachable from a public entry, script, or another owned source module\./);
  assert.match(message, /Remediation: Require the module from its intended owner or delete it if it is dead code\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G8 treats package script targets and browser runtime asset scripts as owned modules', () => {
  const root = makeSampleProject({
    'package.json': JSON.stringify({
      scripts: {
        'docs:fields': 'node src/protocol/docs/generate-field-docs.js',
      },
    }),
    'index.js': 'module.exports = require("./src/adapters/html/reader/browser-snapshot-scripts");\n',
    'src/protocol/docs/generate-field-docs.js': 'module.exports = {};\n',
    'src/adapters/html/reader/browser-snapshot-scripts.js': [
      'const path = require("node:path");',
      'const browserSnapshotScriptPaths = [',
      '  path.join(__dirname, "browser-style-capture.js"),',
      '  path.join(__dirname, "browser-element-capture.js"),',
      '];',
      'module.exports = { browserSnapshotScriptPaths };',
      '',
    ].join('\n'),
    'src/adapters/html/reader/browser-style-capture.js': 'window.captureStyle = true;\n',
    'src/adapters/html/reader/browser-element-capture.js': 'window.captureElement = true;\n',
    'src/orphan.js': 'module.exports = {};\n',
  });

  const violations = collectG8Violations(root);

  assert.deepEqual(violations, [{
    rule: 'G8.1 src module has an owner',
    file: 'src/orphan.js',
    detail: 'src module has no static incoming require edge',
  }]);
});

test('G8 current orphan module violations match the ratchet baseline', () => {
  const actualViolations = collectG8Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG8Failure(result));
  }
});

function collectG8Violations(repoRoot) {
  const srcRoot = path.join(repoRoot, 'src');
  if (!fs.existsSync(srcRoot)) return [];
  const srcFiles = collectJavaScriptFiles(srcRoot);
  const packageScriptEntrypoints = collectPackageScriptEntrypoints(repoRoot);
  const graphFiles = [
    ...srcFiles,
    ...collectJavaScriptFiles(path.join(repoRoot, 'scripts')),
    ...collectJavaScriptFiles(path.join(repoRoot, 'test')),
    path.join(repoRoot, 'index.js'),
    ...packageScriptEntrypoints,
  ].filter((file) => fs.existsSync(file));
  const graph = collectRequireGraphFromFiles(graphFiles);
  const incoming = new Set(
    [
      ...graph.edges,
      ...collectStaticAssetEdges(graphFiles),
    ]
      .map((edge) => edge.to)
      .filter((file) => isUnder(file, srcRoot))
      .map((file) => path.resolve(file)),
  );
  const allowedEntrypoints = new Set([
    path.join(repoRoot, 'src/indesign-cli-plugin/index.js'),
    ...packageScriptEntrypoints,
  ].map((file) => path.resolve(file)));

  return srcFiles
    .map((file) => path.resolve(file))
    .filter((file) => !allowedEntrypoints.has(file))
    .filter((file) => !incoming.has(file))
    .map((file) => ({
      rule: 'G8.1 src module has an owner',
      file: repoRelative(repoRoot, file),
      detail: 'src module has no static incoming require edge',
    }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

function collectJavaScriptFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(fullPath));
    if (entry.isFile() && ['.js', '.cjs'].includes(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function collectPackageScriptEntrypoints(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson && typeof packageJson.scripts === 'object' && packageJson.scripts
    ? Object.values(packageJson.scripts)
    : [];
  const files = [];
  for (const script of scripts) {
    for (const command of splitShellCommands(String(script))) {
      const nodeEntrypoint = nodeCommandEntrypoint(command);
      if (nodeEntrypoint) files.push(path.resolve(repoRoot, nodeEntrypoint));
    }
  }
  return [...new Set(files)].filter((file) => fs.existsSync(file));
}

function splitShellCommands(script) {
  return script
    .split(/&&|\|\||;/)
    .map((command) => command.trim())
    .filter(Boolean);
}

function nodeCommandEntrypoint(command) {
  const tokens = command.match(/"[^"]+"|'[^']+'|\S+/g) || [];
  const nodeIndex = tokens.findIndex((token) => ['node', 'node.exe'].includes(unquote(token)));
  if (nodeIndex === -1) return null;
  for (const token of tokens.slice(nodeIndex + 1)) {
    const value = unquote(token);
    if (value.startsWith('-')) continue;
    return value;
  }
  return null;
}

function collectStaticAssetEdges(files) {
  const edges = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const request of staticDirnameAssetRequests(source)) {
      const target = path.resolve(path.dirname(file), request);
      if (fs.existsSync(target)) edges.push({ from: file, to: target });
    }
  }
  return edges;
}

function staticDirnameAssetRequests(source) {
  const requests = [];
  const pattern = /\bpath\.(?:join|resolve)\s*\(\s*__dirname\s*,\s*(['"])([^'"]+)\1\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    requests.push(match[2]);
  }
  return requests;
}

function unquote(value) {
  return value.replace(/^['"]|['"]$/g, '');
}

function isUnder(file, directory) {
  const relative = path.relative(directory, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function makeSampleProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g8-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  return root;
}

function repoRelative(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatG8Failure(result) {
  return formatGuardrailFailure({
    rule: 'G8.1 src module has an owner',
    reason: G8_RULE_METADATA['G8.1 src module has an owner'].reason,
    remediation: G8_RULE_METADATA['G8.1 src module has an owner'].remediation,
    specPath: SPEC_PATH,
    newViolations: result.newViolations || [],
    expiredExemptions: result.expiredExemptions || [],
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
