const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G2';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G2.json');
const DATA_ID_LITERAL_PATTERN = /\bdata-id-[a-z0-9][a-z0-9-]*/gi;

const G2_RULE_METADATA = {
  'G2.1 protocol literals use registry constants': {
    reason: 'Protocol fields must be declared in src/protocol instead of scattered as bare data-id literals.',
    remediation: 'Replace the literal with a registry-backed protocol constant or remove the unsupported protocol field.',
  },
};

test('G2 catches bare data-id literals outside src/protocol and reports the required fields', () => {
  const root = makeSampleProject({
    'src/adapters/html/example.js': [
      "const field = 'data-id-role';",
      '// data-id-comment-only is not a literal.',
      '',
    ].join('\n'),
    'src/protocol/fields.js': "const allowed = 'data-id-layout';\n",
    'scripts/check.js': 'const attr = "data-id-grid";\n',
    'docs/spec.md': 'data-id-docs is not scanned.\n',
    'test/workspace/out.js': "const ignored = 'data-id-workspace';\n",
  });

  const violations = collectG2Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G2.1 protocol literals use registry constants',
      file: 'scripts/check.js',
      detail: 'field data-id-grid',
    },
    {
      rule: 'G2.1 protocol literals use registry constants',
      file: 'src/adapters/html/example.js',
      detail: 'field data-id-role',
    },
  ]);

  const message = formatG2Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G2\.1 protocol literals use registry constants/);
  assert.match(message, /Reason: Protocol fields must be declared in src\/protocol instead of scattered as bare data-id literals\./);
  assert.match(message, /Remediation: Replace the literal with a registry-backed protocol constant or remove the unsupported protocol field\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G2 current protocol literal violations match the ratchet baseline', () => {
  const actualViolations = collectG2Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG2Failure(result));
  }
});

function collectG2Violations(repoRoot) {
  const violations = [];
  for (const file of listProjectFiles(repoRoot)) {
    const relativeFile = repoRelative(repoRoot, file);
    if (!isG2Scope(relativeFile) || isSkipped(relativeFile) || !isTextFile(file)) continue;
    const fields = new Set();
    const text = stripCommentsPreservingStrings(fs.readFileSync(file, 'utf8'));
    for (const match of text.matchAll(DATA_ID_LITERAL_PATTERN)) {
      fields.add(match[0].toLowerCase());
    }
    for (const field of fields) {
      violations.push({
        rule: 'G2.1 protocol literals use registry constants',
        file: relativeFile,
        detail: `field ${field}`,
      });
    }
  }
  return sortViolations(violations);
}

function isG2Scope(relativeFile) {
  return (relativeFile.startsWith('src/') && !relativeFile.startsWith('src/protocol/'))
    || relativeFile.startsWith('scripts/');
}

function isSkipped(relativeFile) {
  return [
    '.codex/',
    '.git/',
    '.superpowers/',
    'node_modules/',
    'test/workspace/',
  ].some((prefix) => relativeFile.startsWith(prefix));
}

function isTextFile(file) {
  return ['.js', '.cjs', '.mjs', '.json', '.jsx', '.jsxinc', '.ts', '.tsx', '.css', '.html'].includes(path.extname(file));
}

function stripCommentsPreservingStrings(text) {
  let out = '';
  let state = 'code';
  let quote = '';
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1] || '';
    if (state === 'line-comment') {
      if (current === '\n') {
        state = 'code';
        out += current;
      } else {
        out += ' ';
      }
      continue;
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        out += '  ';
        index += 1;
        state = 'code';
      } else {
        out += current === '\n' ? current : ' ';
      }
      continue;
    }
    if (state === 'string') {
      out += current;
      if (current === '\\') {
        index += 1;
        out += text[index] || '';
      } else if (current === quote) {
        state = 'code';
      }
      continue;
    }
    if (current === '/' && next === '/') {
      out += '  ';
      index += 1;
      state = 'line-comment';
      continue;
    }
    if (current === '/' && next === '*') {
      out += '  ';
      index += 1;
      state = 'block-comment';
      continue;
    }
    if (current === '"' || current === "'" || current === '`') {
      quote = current;
      state = 'string';
    }
    out += current;
  }
  return out;
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g2-'));
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

function formatG2Failure(result) {
  return formatGuardrailFailure({
    rule: 'G2.1 protocol literals use registry constants',
    reason: G2_RULE_METADATA['G2.1 protocol literals use registry constants'].reason,
    remediation: G2_RULE_METADATA['G2.1 protocol literals use registry constants'].remediation,
    specPath: SPEC_PATH,
    newViolations: result.newViolations || [],
    expiredExemptions: result.expiredExemptions || [],
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
