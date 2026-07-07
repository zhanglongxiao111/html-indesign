const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G4';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G4.json');

const G4_RULE_METADATA = {
  'G4.1 audit invalid-input coverage': {
    reason: 'Audit gates must have an explicit invalid-input 必须 fail test before they can be trusted as fail-closed.',
    remediation: 'Add a corresponding test name that includes the audit script basename and invalid-input 必须 fail.',
  },
  'G4.2 audit cli unknown input exits nonzero': {
    reason: 'Audit command wrappers must exit nonzero when required evidence is missing or unknowable.',
    remediation: 'Return a nonzero exit code for missing required inputs instead of printing a success-like result.',
  },
};

test('G4 catches an audit script with no invalid-input 必须 fail test and a silent zero exit', () => {
  const root = makeSampleProject({
    'scripts/audit-silent.js': 'process.stdout.write("ok\\n");\n',
    'test/audit-silent.test.js': 'test("audit-silent happy path", () => {});\n',
  });

  const violations = collectG4Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G4.1 audit invalid-input coverage',
      file: 'scripts/audit-silent.js',
      detail: 'missing test named "audit-silent invalid-input 必须 fail"',
    },
    {
      rule: 'G4.2 audit cli unknown input exits nonzero',
      file: 'scripts/audit-silent.js',
      detail: 'exits 0 when invoked without required evidence',
    },
  ]);

  const message = formatG4Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G4\.1 audit invalid-input coverage/);
  assert.match(message, /Rule: G4\.2 audit cli unknown input exits nonzero/);
  assert.match(message, /Reason: Audit gates must have an explicit invalid-input 必须 fail test before they can be trusted as fail-closed\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G4 current audit fail-closed violations match the ratchet baseline', () => {
  const actualViolations = collectG4Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG4Failure(result));
  }
});

function collectG4Violations(repoRoot) {
  const scripts = collectAuditScripts(repoRoot);
  const testText = collectTestText(repoRoot);
  const violations = [];

  for (const script of scripts) {
    const basename = path.basename(script, '.js');
    const relativeScript = repoRelative(repoRoot, script);
    const expectedName = `${basename} invalid-input 必须 fail`;
    if (!testText.includes(expectedName)) {
      violations.push({
        rule: 'G4.1 audit invalid-input coverage',
        file: relativeScript,
        detail: `missing test named "${expectedName}"`,
      });
    }

    const result = spawnSync(process.execPath, [script], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10000,
    });
    if (result.status === 0) {
      violations.push({
        rule: 'G4.2 audit cli unknown input exits nonzero',
        file: relativeScript,
        detail: 'exits 0 when invoked without required evidence',
      });
    }
  }

  return sortViolations(violations);
}

function collectAuditScripts(repoRoot) {
  const scriptsDir = path.join(repoRoot, 'scripts');
  if (!fs.existsSync(scriptsDir)) return [];
  return fs.readdirSync(scriptsDir)
    .filter((name) => /^audit-.*\.js$/.test(name))
    .map((name) => path.join(scriptsDir, name))
    .sort();
}

function collectTestText(repoRoot) {
  const testDir = path.join(repoRoot, 'test');
  if (!fs.existsSync(testDir)) return '';
  return collectFiles(testDir)
    .filter((file) => file.endsWith('.test.js'))
    .filter((file) => !repoRelative(repoRoot, file).startsWith('test/architecture/'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

function collectFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function makeSampleProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g4-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  return root;
}

function sortViolations(violations) {
  return violations.sort((a, b) =>
    `${a.rule}\n${a.file}\n${a.detail}`.localeCompare(`${b.rule}\n${b.file}\n${b.detail}`)
  );
}

function repoRelative(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatG4Failure(result) {
  const failingRules = new Set([
    ...(result.newViolations || []).map((violation) => violation.rule),
    ...(result.expiredExemptions || []).map((violation) => violation.rule),
  ]);

  return [...failingRules].sort().map((rule) => {
    const metadata = G4_RULE_METADATA[rule];
    if (!metadata) throw new Error(`Missing G4 failure metadata for ${rule}`);
    return formatGuardrailFailure({
      rule,
      reason: metadata.reason,
      remediation: metadata.remediation,
      specPath: SPEC_PATH,
      newViolations: (result.newViolations || []).filter((violation) => violation.rule === rule),
      expiredExemptions: (result.expiredExemptions || []).filter((violation) => violation.rule === rule),
    });
  }).join('\n\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
