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
    'src/adapters/html/regex.js': 'const pattern = /data-id-role/gi;\n',
    'src/adapters/html/prefix.js': 'const prefix = `data-id-`;\n',
    'src/adapters/html/template.js': 'const field = `data-id-template`;\n',
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
    {
      rule: 'G2.1 protocol literals use registry constants',
      file: 'src/adapters/html/prefix.js',
      detail: 'field data-id- prefix',
    },
    {
      rule: 'G2.1 protocol literals use registry constants',
      file: 'src/adapters/html/regex.js',
      detail: 'field data-id-role',
    },
    {
      rule: 'G2.1 protocol literals use registry constants',
      file: 'src/adapters/html/template.js',
      detail: 'field data-id-template',
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
    for (const field of collectDataIdStringLiteralFields(fs.readFileSync(file, 'utf8'))) {
      fields.add(field);
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

function collectDataIdStringLiteralFields(text) {
  const fields = new Set();
  let state = 'code';
  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1] || '';
    if (state === 'line-comment') {
      if (current === '\n') {
        state = 'code';
      }
      continue;
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        index += 1;
        state = 'code';
      }
      continue;
    }
    if (current === '/' && next === '/') {
      index += 1;
      state = 'line-comment';
      continue;
    }
    if (current === '/' && next === '*') {
      index += 1;
      state = 'block-comment';
      continue;
    }
    if (current === '"' || current === "'" || current === '`') {
      const result = readStringLiteral(text, index, current);
      if (result.closed) addDataIdFields(fields, result.value);
      index = result.endIndex;
      continue;
    }
    if (current === '/') {
      const result = readRegexLiteral(text, index);
      if (result.closed) addDataIdFields(fields, result.value);
      index = result.endIndex;
    }
  }
  return fields;
}

function readStringLiteral(text, startIndex, quote) {
  let value = '';
  for (let index = startIndex + 1; index < text.length; index += 1) {
    const current = text[index];
    if (current === '\\') {
      value += current;
      index += 1;
      value += text[index] || '';
      continue;
    }
    if (current === quote) {
      return { value, endIndex: index, closed: true };
    }
    if (quote !== '`' && (current === '\n' || current === '\r')) {
      return { value: '', endIndex: startIndex, closed: false };
    }
    value += current;
  }
  return { value: '', endIndex: startIndex, closed: false };
}

function readRegexLiteral(text, startIndex) {
  let value = '';
  let inCharacterClass = false;
  for (let index = startIndex + 1; index < text.length; index += 1) {
    const current = text[index];
    if (current === '\\') {
      value += current;
      index += 1;
      value += text[index] || '';
      continue;
    }
    if (current === '[') inCharacterClass = true;
    if (current === ']') inCharacterClass = false;
    if (current === '/' && !inCharacterClass) {
      return { value, endIndex: readRegexFlags(text, index + 1), closed: true };
    }
    if (current === '\n' || current === '\r') {
      return { value: '', endIndex: startIndex, closed: false };
    }
    value += current;
  }
  return { value: '', endIndex: startIndex, closed: false };
}

function readRegexFlags(text, startIndex) {
  let index = startIndex;
  while (/[a-z]/i.test(text[index] || '')) index += 1;
  return index - 1;
}

function addDataIdFields(fields, value) {
  if (/\bdata-id-(?![a-z0-9])/i.test(value)) {
    fields.add('data-id- prefix');
  }
  for (const match of value.matchAll(/\bdata-id-\(\?:([a-z0-9][a-z0-9-]*(?:\|[a-z0-9][a-z0-9-]*)+)\)/gi)) {
    for (const suffix of match[1].split('|')) {
      fields.add(`data-id-${suffix.toLowerCase()}`);
    }
  }
  for (const match of value.matchAll(DATA_ID_LITERAL_PATTERN)) {
    fields.add(match[0].toLowerCase());
  }
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
