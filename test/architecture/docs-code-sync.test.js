const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G7';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G7.json');
const APPROVED_BASELINE = { exemptions: [] };

const G7_RULE_METADATA = {
  'G7.1 src top-level directory documented': {
    reason: 'Top-level src ownership must be visible in AGENTS markdown before new architecture surfaces can drift.',
    remediation: 'Add the src top-level directory to AGENTS markdown section 4 or remove the orphaned directory.',
  },
  'G7.2 audit benchmark script documented': {
    reason: 'Audit and benchmark commands must be discoverable from AGENTS markdown section 9.',
    remediation: 'Add the package script command to the AGENTS markdown execution baseline table or remove the stale script.',
  },
};

test('G7 catches undocumented src directories and audit scripts', () => {
  const root = makeSampleProject({
    'AGENTS.md': [
      '## 4. 仓库地图',
      '| 路径 | 作用 |',
      '| ---- | ---- |',
      '| `src/known/` | known |',
      '## 5. stop',
      '## 9. 执行基线',
      '| 动作 | 命令 |',
      '| ---- | ---- |',
      '| 已登记 | `npm run audit:known` |',
      '## 10. stop',
    ].join('\n'),
    'package.json': JSON.stringify({ scripts: { 'audit:known': 'node a.js', 'audit:missing': 'node b.js' } }),
    'src/known/index.js': 'module.exports = {};\n',
    'src/missing/index.js': 'module.exports = {};\n',
  });

  const violations = collectG7Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G7.1 src top-level directory documented',
      file: 'src/missing/',
      detail: 'src top-level directory is missing from AGENTS.md section 4',
    },
    {
      rule: 'G7.2 audit benchmark script documented',
      file: 'package.json',
      detail: 'audit:missing is missing from AGENTS.md section 9',
    },
  ]);

  const message = formatG7Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G7\.1 src top-level directory documented/);
  assert.match(message, /Rule: G7\.2 audit benchmark script documented/);
  assert.match(message, /Reason: Top-level src ownership must be visible in AGENTS markdown before new architecture surfaces can drift\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G7 failure reports baseline expansion entries', () => {
  const message = formatG7Failure({
    newViolations: [],
    expiredExemptions: [],
    baselineExpansion: [{
      rule: 'G7.2 audit benchmark script documented',
      file: 'package.json',
      detail: 'audit:expanded is missing from AGENTS.md section 9',
      reason: 'unreviewed exemption',
      cleanupRef: 'Task 5',
    }],
  });

  assert.match(message, /Rule: G7\.2 audit benchmark script documented/);
  assert.match(message, /Baseline expansion:/);
  assert.match(message, /detail=audit:expanded is missing from AGENTS\.md section 9/);
});

test('G7 current docs-code sync violations match the ratchet baseline', () => {
  const actualViolations = collectG7Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({
    actualViolations,
    baseline,
    approvedBaseline: APPROVED_BASELINE,
    forbidNewExemptions: true,
  });

  if (!result.passed) {
    throw new Error(formatG7Failure(result));
  }
});

function collectG7Violations(repoRoot) {
  const agents = fs.readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const section4 = sectionText(agents, '4');
  const section9 = sectionText(agents, '9');
  const documentedSrcDirs = new Set(
    [...section4.matchAll(/`(src\/[^`]+?\/)`/g)]
      .map((match) => match[1].split('/').slice(0, 2).join('/')),
  );
  const violations = [];

  for (const directory of srcTopLevelDirectories(repoRoot)) {
    const key = `src/${directory}`;
    if (!documentedSrcDirs.has(key)) {
      violations.push({
        rule: 'G7.1 src top-level directory documented',
        file: `${key}/`,
        detail: 'src top-level directory is missing from AGENTS.md section 4',
      });
    }
  }

  for (const scriptName of Object.keys(packageJson.scripts || {}).sort()) {
    if (!/^(audit|benchmark):/.test(scriptName)) continue;
    if (!section9.includes(`npm run ${scriptName}`) && !section9.includes(scriptName)) {
      violations.push({
        rule: 'G7.2 audit benchmark script documented',
        file: 'package.json',
        detail: `${scriptName} is missing from AGENTS.md section 9`,
      });
    }
  }

  return sortViolations(violations);
}

function srcTopLevelDirectories(repoRoot) {
  const src = path.join(repoRoot, 'src');
  if (!fs.existsSync(src)) return [];
  return fs.readdirSync(src, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function sectionText(markdown, sectionNumber) {
  const start = markdown.search(new RegExp(`^## ${sectionNumber}\\.`, 'm'));
  if (start === -1) return '';
  const rest = markdown.slice(start);
  const next = rest.slice(1).search(/^## \d+\./m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

function makeSampleProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g7-'));
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatG7Failure(result) {
  const failingRules = new Set([
    ...(result.newViolations || []).map((violation) => violation.rule),
    ...(result.expiredExemptions || []).map((violation) => violation.rule),
    ...(result.baselineExpansion || []).map((violation) => violation.rule),
  ]);

  return [...failingRules].sort().map((rule) => {
    const metadata = G7_RULE_METADATA[rule];
    if (!metadata) throw new Error(`Missing G7 failure metadata for ${rule}`);
    return formatGuardrailFailure({
      rule,
      reason: metadata.reason,
      remediation: metadata.remediation,
      specPath: SPEC_PATH,
      newViolations: (result.newViolations || []).filter((violation) => violation.rule === rule),
      expiredExemptions: (result.expiredExemptions || []).filter((violation) => violation.rule === rule),
      baselineExpansion: (result.baselineExpansion || []).filter((violation) => violation.rule === rule),
    });
  }).join('\n\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
