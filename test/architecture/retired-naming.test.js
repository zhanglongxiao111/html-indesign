const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G5';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G5.json');
const RETIRED_PATTERN = /\blegacy\b|pagedHtml|paged-html/gi;

const G5_RULE_METADATA = {
  'G5.1 retired naming is blocked': {
    reason: 'Retired names must not re-enter live code, tests, or current documentation.',
    remediation: 'Remove the retired naming or move historical context under docs/legacy with no live runtime path.',
  },
};

test('G5 catches retired names outside the allowed observation and legacy-doc zones', () => {
  const root = makeSampleProject({
    'src/example/old.js': 'const pagedHtml = require("./legacy");\n',
    '_indesign_scripts/lib/hi_old.jsxinc': 'var source = "pagedHtml";\n',
    'test/examples/paged-html-case.test.js': 'test path names are scanned even though test file contents are not.\n',
    'docs/legacy/history.md': 'legacy and paged-html are historical here.\n',
    'docs/superpowers/plans/old-plan.md': 'paged-html appears in planning notes.\n',
    'package.json': '{"scripts":{"old":"node test/fixtures/fixed-html/basic-deck.html"}}\n',
    'src/protocol/lifecycle.js': 'const LIFECYCLE = "legacy";\n',
    'src/labels.js': 'const tag = "legacy-label";\n',
  });

  const violations = collectG5Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G5.1 retired naming is blocked',
      file: '_indesign_scripts/lib/hi_old.jsxinc',
      detail: 'line 1 contains pagedHtml',
    },
    {
      rule: 'G5.1 retired naming is blocked',
      file: 'src/example/old.js',
      detail: 'line 1 contains legacy',
    },
    {
      rule: 'G5.1 retired naming is blocked',
      file: 'src/example/old.js',
      detail: 'line 1 contains pagedHtml',
    },
    {
      rule: 'G5.1 retired naming is blocked',
      file: 'test/examples/paged-html-case.test.js',
      detail: 'path contains paged-html',
    },
  ]);

  const message = formatG5Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G5\.1 retired naming is blocked/);
  assert.match(message, /Reason: Retired names must not re-enter live code, tests, or current documentation\./);
  assert.match(message, /Remediation: Remove the retired naming or move historical context under docs\/legacy with no live runtime path\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G5 current retired naming violations match the ratchet baseline', () => {
  const actualViolations = collectG5Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG5Failure(result));
  }
});

function collectG5Violations(repoRoot) {
  const violations = [];
  const emittedPathViolations = new Set();
  for (const file of listScannableFiles(repoRoot)) {
    const relativeFile = repoRelative(repoRoot, file);
    RETIRED_PATTERN.lastIndex = 0;
    for (const match of relativeFile.matchAll(RETIRED_PATTERN)) {
      if (allowedPath(relativeFile, match[0])) continue;
      const violation = {
        rule: 'G5.1 retired naming is blocked',
        file: relativeFile,
        detail: `path contains ${match[0]}`,
      };
      const key = JSON.stringify(violation);
      if (emittedPathViolations.has(key)) continue;
      emittedPathViolations.add(key);
      violations.push(violation);
    }
    if (!isCodeLikeFile(file) || !shouldScanContent(relativeFile)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      const emittedLineTokens = new Set();
      RETIRED_PATTERN.lastIndex = 0;
      for (const match of line.matchAll(RETIRED_PATTERN)) {
        if (allowedOccurrence(relativeFile, line, match[0])) continue;
        const lineToken = match[0].toLowerCase();
        if (emittedLineTokens.has(lineToken)) continue;
        emittedLineTokens.add(lineToken);
        violations.push({
          rule: 'G5.1 retired naming is blocked',
          file: relativeFile,
          detail: `line ${index + 1} contains ${match[0]}`,
        });
      }
    });
  }
  return sortViolations(violations);
}

function listScannableFiles(repoRoot) {
  return listProjectFiles(repoRoot)
    .filter((file) => isTextFile(file))
    .filter((file) => isGuardrailScope(repoRelative(repoRoot, file)))
    .filter((file) => !shouldSkip(repoRelative(repoRoot, file)));
}

function listProjectFiles(repoRoot) {
  const gitResult = spawnSync('git', ['-C', repoRoot, 'ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  if (gitResult.status === 0 && gitResult.stdout.trim()) {
    return gitResult.stdout.trim().split(/\r?\n/).map((file) => path.join(repoRoot, file));
  }
  return collectFiles(repoRoot);
}

function allowedOccurrence(relativeFile, line, token) {
  if (allowedPath(relativeFile, token)) return true;
  if (String(token).toLowerCase() === 'legacy' && line.includes('legacy-label')) return true;
  if (token === 'legacy-label') return true;
  if (relativeFile === 'src/adapters/indesign/audit/reverse-snapshot-structure.js' && String(token).toLowerCase() === 'legacy') return true;
  if (isProtocolLifecycleVocabulary(relativeFile, line, token)) return true;
  return false;
}

function allowedPath(relativeFile) {
  return relativeFile.startsWith('docs/legacy/');
}

function shouldSkip(relativeFile) {
  return [
    '.codex/',
    '.git/',
    '.superpowers/',
    'node_modules/',
    'test/architecture/',
    'test/workspace/',
  ].some((prefix) => relativeFile.startsWith(prefix));
}

function isGuardrailScope(relativeFile) {
  return [
    'src/',
    '_indesign_scripts/',
    'test/',
  ].some((prefix) => relativeFile.startsWith(prefix));
}

function shouldScanContent(relativeFile) {
  return !relativeFile.startsWith('test/');
}

function isProtocolLifecycleVocabulary(relativeFile, line, token) {
  if (String(token).toLowerCase() !== 'legacy') return false;
  if (relativeFile === 'src/protocol/lifecycle.js') return true;
  if (!relativeFile.startsWith('test/protocol/')) return false;
  return /\b(?:isFieldClass|isLifecycle|isCapabilityLevel|fieldClass|FORMATS|legacy or unknown|rejects legacy|foreignSlot)\b/.test(line);
}

function isTextFile(file) {
  return ['.js', '.cjs', '.json', '.md', '.jsx', '.jsxinc', '.ts', '.tsx', '.css', '.html', '.txt'].includes(path.extname(file));
}

function isCodeLikeFile(file) {
  return ['.js', '.cjs', '.json', '.jsx', '.jsxinc', '.ts', '.tsx', '.css', '.html'].includes(path.extname(file));
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g5-'));
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

function formatG5Failure(result) {
  return formatGuardrailFailure({
    rule: 'G5.1 retired naming is blocked',
    reason: G5_RULE_METADATA['G5.1 retired naming is blocked'].reason,
    remediation: G5_RULE_METADATA['G5.1 retired naming is blocked'].remediation,
    specPath: SPEC_PATH,
    newViolations: result.newViolations || [],
    expiredExemptions: result.expiredExemptions || [],
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
