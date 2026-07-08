const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G6';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G6.json');
const SINGLE_IMPLEMENTATION_NAMES = [
  'normalizeText',
  'normalizeLineEndings',
  'collapseWhitespace',
  'safeClass',
  'safeClassToken',
  'safeAuthorClassToken',
  'safeMigrationClassToken',
  'safeVisualClassToken',
  'sanitizeStyleName',
  'cssLengthToMm',
  'cssLengthToPx',
  'cssLengthToPt',
  'parseZIndex',
];
const DEFINITION_PATTERN = new RegExp(
  String.raw`\b(?:function\s+(${SINGLE_IMPLEMENTATION_NAMES.join('|')})\b|(?:const|let|var)\s+(${SINGLE_IMPLEMENTATION_NAMES.join('|')})\s*=)`,
  'g'
);

const G6_RULE_METADATA = {
  'G6.1 shared helpers have a single implementation': {
    reason: 'Shared helper semantics must live in src/shared instead of drifting across format layers.',
    remediation: 'Move the implementation to src/shared or rename it when it is a deliberately different concept.',
  },
};

test('G6 catches duplicate helper definitions outside src/shared and reports the required fields', () => {
  const root = makeSampleProject({
    'src/shared/text.js': 'function normalizeText(value) { return String(value); }\nconst safeClass = (value) => String(value);\n',
    'src/writers/html/a.js': 'function normalizeText(value) { return String(value).trim(); }\n',
    'src/adapters/html/b.js': 'const safeCssIdentifier = (value) => String(value);\n',
    'scripts/build.js': 'var parseZIndex = function parseZIndex(value) { return Number(value) || 0; };\n',
    'src/protocol/fields.js': 'function safeClass(value) { return value; }\n',
    'src/writers/html/new-text.js': 'function collapseWhitespace(value) { return String(value).trim(); }\n',
    'src/writers/html/new-style.js': 'const safeVisualClassToken = (value) => String(value);\n',
    'src/writers/html/path-key.js': 'function normalizePathKey(value) { return String(value); }\n',
  });

  const violations = collectG6Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'scripts/build.js',
      detail: 'defines parseZIndex',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/protocol/fields.js',
      detail: 'defines safeClass',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/a.js',
      detail: 'defines normalizeText',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/new-style.js',
      detail: 'defines safeVisualClassToken',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/new-text.js',
      detail: 'defines collapseWhitespace',
    },
  ]);

  const message = formatG6Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G6\.1 shared helpers have a single implementation/);
  assert.match(message, /Reason: Shared helper semantics must live in src\/shared instead of drifting across format layers\./);
  assert.match(message, /Remediation: Move the implementation to src\/shared or rename it when it is a deliberately different concept\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G6 ratchet reports new duplicate helper definitions and expired baseline entries', () => {
  const actualViolations = [{
    rule: 'G6.1 shared helpers have a single implementation',
    file: 'src/writers/html/current.js',
    detail: 'defines normalizeText',
  }];
  const baseline = {
    exemptions: [{
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/old.js',
      detail: 'defines normalizeText',
      reason: 'existing violation',
      cleanupRef: 'Task 4',
    }],
  };

  const result = compareViolationsToBaseline({ actualViolations, baseline });

  assert.equal(result.passed, false);
  assert.deepEqual(result.newViolations, actualViolations);
  assert.deepEqual(result.expiredExemptions, baseline.exemptions);
});

test('G6 collector scans definitions after regex literals with quotes', () => {
  const root = makeSampleProject({
    'src/writers/html/regex-before-definitions.js': `
      const quotedPattern = /['"]/g;
      function safeClass(value) { return String(value); }
      const normalizeText = (value) => String(value).trim();
    `,
  });

  const violations = collectG6Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/regex-before-definitions.js',
      detail: 'defines normalizeText',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/regex-before-definitions.js',
      detail: 'defines safeClass',
    },
  ]);
});

test('G6 current duplicate helper definitions match the ratchet baseline', () => {
  const actualViolations = collectG6Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG6Failure(result));
  }
});

function collectG6Violations(repoRoot) {
  const violations = [];
  for (const file of listProjectFiles(repoRoot)) {
    const relativeFile = repoRelative(repoRoot, file);
    if (!isG6Scope(relativeFile) || isSkipped(relativeFile) || !isCodeFile(file)) continue;
    const text = stripCommentsPreservingDefinitions(fs.readFileSync(file, 'utf8'), relativeFile);
    const seen = new Set();
    for (const match of text.matchAll(DEFINITION_PATTERN)) {
      const name = match[1] || match[2];
      if (seen.has(name)) continue;
      seen.add(name);
      violations.push({
        rule: 'G6.1 shared helpers have a single implementation',
        file: relativeFile,
        detail: `defines ${name}`,
      });
    }
  }
  return sortViolations(violations);
}

function isG6Scope(relativeFile) {
  if (relativeFile.startsWith('src/shared/')) return false;
  return relativeFile.startsWith('src/') || relativeFile.startsWith('scripts/');
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

function isCodeFile(file) {
  return ['.js', '.cjs', '.mjs', '.jsx', '.jsxinc', '.ts', '.tsx'].includes(path.extname(file));
}

function stripCommentsPreservingDefinitions(text, file = 'source') {
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
      out += ' ';
      if (current === '\\') {
        index += 1;
        out += ' ';
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
      out += ' ';
      continue;
    }
    if (current === '/' && startsRegexLiteral(text, index)) {
      const endIndex = findRegexLiteralEnd(text, index, file);
      out += blankPreservingNewlines(text.slice(index, endIndex));
      index = endIndex - 1;
      continue;
    }
    out += current;
  }
  return out;
}

function startsRegexLiteral(source, index) {
  const previousIndex = previousSignificantIndex(source, index);
  if (previousIndex === -1) return true;

  const previous = source[previousIndex];
  if (/[[({=,:;!&|?+\-*~^<>%]/.test(previous)) return true;

  const token = previousIdentifierToken(source, previousIndex);
  return ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'yield', 'await'].includes(token);
}

function previousSignificantIndex(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  return cursor;
}

function previousIdentifierToken(source, index) {
  if (!isIdentifierCharacter(source[index])) return '';
  let start = index;
  while (start > 0 && isIdentifierCharacter(source[start - 1])) start -= 1;
  return source.slice(start, index + 1);
}

function isIdentifierCharacter(character) {
  return typeof character === 'string' && /[$\w]/.test(character);
}

function findRegexLiteralEnd(source, index, file) {
  let cursor = index + 1;
  let inCharacterClass = false;

  while (cursor < source.length) {
    const character = source[cursor];
    if (character === '\\') {
      cursor += 2;
    } else if (character === '[') {
      inCharacterClass = true;
      cursor += 1;
    } else if (character === ']') {
      inCharacterClass = false;
      cursor += 1;
    } else if (character === '/' && !inCharacterClass) {
      cursor += 1;
      while (cursor < source.length && /[A-Za-z]/.test(source[cursor])) cursor += 1;
      return cursor;
    } else {
      cursor += 1;
    }
  }

  throw new Error(`Unclosed regular expression literal in ${file}`);
}

function blankPreservingNewlines(value) {
  return value.replace(/[^\n\r]/g, ' ');
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g6-'));
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

function formatG6Failure(result) {
  return formatGuardrailFailure({
    rule: 'G6.1 shared helpers have a single implementation',
    reason: G6_RULE_METADATA['G6.1 shared helpers have a single implementation'].reason,
    remediation: G6_RULE_METADATA['G6.1 shared helpers have a single implementation'].remediation,
    specPath: SPEC_PATH,
    newViolations: result.newViolations || [],
    expiredExemptions: result.expiredExemptions || [],
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
