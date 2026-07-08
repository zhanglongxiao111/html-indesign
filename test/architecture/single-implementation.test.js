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
const APPROVED_BASELINE = { exemptions: [] };
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
const SEMANTIC_HELPER_FAMILIES = [
  {
    label: 'asset path key',
    canonicalFiles: ['src/shared/assets.js'],
    names: ['normalizePathKey', 'sourceFileKey', 'pathMapKey', 'assetPathKey', 'normalizeAssetPathKey'],
  },
  {
    label: 'asset remote detection',
    canonicalFiles: ['src/shared/assets.js'],
    names: ['isRemoteReference', 'isRemoteUrl', 'isRemoteAssetReference', 'isExternalReference'],
  },
  {
    label: 'text whitespace normalization',
    canonicalFiles: ['src/shared/text.js'],
    names: ['collapseWhitespace', 'normalizeInstructionText', 'normalizeWhitespace', 'normalizeTextWhitespace'],
  },
  {
    label: 'table width normalization',
    canonicalFiles: ['src/style-synthesis/box-model.js'],
    names: ['normalizeTableWidths', 'normalizeColumnWidths', 'normalizeTableColumnWidths'],
  },
  {
    label: 'border visibility',
    canonicalFiles: ['src/style-synthesis/box-model.js'],
    names: ['visibleBorder', 'hasVisibleBorder', 'visibleCompiledBorder'],
  },
  {
    label: 'border uniformity',
    canonicalFiles: ['src/style-synthesis/box-model.js'],
    names: ['bordersAreUniform', 'sameBorder', 'sameCompiledBorder'],
  },
];

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
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/path-key.js',
      detail: 'defines asset path key helper normalizePathKey',
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

test('G6 failure reports baseline expansion entries', () => {
  const message = formatG6Failure({
    newViolations: [],
    expiredExemptions: [],
    baselineExpansion: [{
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/new-helper.js',
      detail: 'defines normalizeText',
      reason: 'unreviewed exemption',
      cleanupRef: 'Task 5',
    }],
  });

  assert.match(message, /Baseline expansion:/);
  assert.match(message, /file=src\/writers\/html\/new-helper\.js/);
});

test('G6 catches renamed duplicate implementations in semantic helper families', () => {
  const root = makeSampleProject({
    'src/shared/assets.js': `
      function normalizePathKey(value) { return String(value).replace(/\\\\/g, '/').toLowerCase(); }
      function isRemoteReference(value) { return /^[a-z][a-z0-9+.-]*:/i.test(String(value)); }
    `,
    'src/shared/text.js': 'function collapseWhitespace(value) { return String(value).replace(/\\s+/g, " ").trim(); }\n',
    'src/style-synthesis/box-model.js': `
      function normalizeTableWidths(widths, tableWidth) { return widths; }
      function visibleBorder(edge) { return Boolean(edge); }
      function bordersAreUniform(borders) { return sameBorder(borders.top, borders.right); }
      function sameBorder(a, b) { return a === b; }
    `,
    'src/writers/html/local-assets.js': `
      function pathMapKey(value) { return String(value).replace(/\\\\/g, '/').toLowerCase(); }
      const isRemoteUrl = (value) => /^[a-z][a-z0-9+.-]*:/i.test(String(value));
    `,
    'src/writers/indesign/local-text.js': 'function normalizeInstructionText(value) { return String(value).replace(/\\s+/g, " ").trim(); }\n',
    'src/writers/indesign/local-table.js': 'function normalizeColumnWidths(widths, tableWidth) { return widths; }\n',
    'src/writers/indesign/local-border.js': 'const hasVisibleBorder = (edge) => Boolean(edge);\n',
  });

  const violations = collectG6Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/local-assets.js',
      detail: 'defines asset path key helper pathMapKey',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/html/local-assets.js',
      detail: 'defines asset remote detection helper isRemoteUrl',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/indesign/local-border.js',
      detail: 'defines border visibility helper hasVisibleBorder',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/indesign/local-table.js',
      detail: 'defines table width normalization helper normalizeColumnWidths',
    },
    {
      rule: 'G6.1 shared helpers have a single implementation',
      file: 'src/writers/indesign/local-text.js',
      detail: 'defines text whitespace normalization helper normalizeInstructionText',
    },
  ]);
});

test('G6 current duplicate helper definitions match the ratchet baseline', () => {
  const actualViolations = collectG6Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({
    actualViolations,
    baseline,
    approvedBaseline: APPROVED_BASELINE,
    forbidNewExemptions: true,
  });

  if (!result.passed) {
    throw new Error(formatG6Failure(result));
  }
});

test('border uniformity comparison has a single implementation in style-synthesis box model', () => {
  const definitions = collectBorderUniformityDefinitions(REPO_ROOT);

  assert.deepEqual(definitions, [
    {
      file: 'src/style-synthesis/box-model.js',
      name: 'bordersAreUniform',
    },
    {
      file: 'src/style-synthesis/box-model.js',
      name: 'sameBorder',
    },
  ]);
});

test('border uniformity collector scans the full G6 src and scripts scope', () => {
  const root = makeSampleProject({
    'src/style-synthesis/box-model.js': 'function bordersAreUniform(borders) { return sameBorder(borders.top, borders.right); }\nfunction sameBorder(a, b) { return a === b; }\n',
    'src/writers/html/drift.js': 'function bordersAreUniform(borders) { return Boolean(borders); }\n',
    'scripts/drift.js': 'const sameCompiledBorder = (a, b) => a === b;\n',
    'src/shared/ignored.js': 'function sameBorder(a, b) { return a === b; }\n',
    'test/workspace/ignored.js': 'function bordersAreUniform() { return true; }\n',
  });

  const definitions = collectBorderUniformityDefinitions(root);

  assert.deepEqual(definitions, [
    {
      file: 'scripts/drift.js',
      name: 'sameCompiledBorder',
    },
    {
      file: 'src/style-synthesis/box-model.js',
      name: 'bordersAreUniform',
    },
    {
      file: 'src/style-synthesis/box-model.js',
      name: 'sameBorder',
    },
    {
      file: 'src/writers/html/drift.js',
      name: 'bordersAreUniform',
    },
  ]);
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
    for (const definition of collectSemanticHelperDefinitions(text, relativeFile)) {
      violations.push({
        rule: 'G6.1 shared helpers have a single implementation',
        file: relativeFile,
        detail: `defines ${definition.label} helper ${definition.name}`,
      });
    }
  }
  return sortViolations(violations);
}

function collectSemanticHelperDefinitions(text, relativeFile) {
  const definitions = [];
  for (const family of SEMANTIC_HELPER_FAMILIES) {
    if (family.canonicalFiles.includes(relativeFile)) continue;
    const pattern = helperDefinitionPattern(family.names);
    const seen = new Set();
    for (const match of text.matchAll(pattern)) {
      const name = match[1] || match[2];
      if (SINGLE_IMPLEMENTATION_NAMES.includes(name)) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      definitions.push({ label: family.label, name });
    }
  }
  return definitions;
}

function helperDefinitionPattern(names) {
  return new RegExp(
    String.raw`\b(?:function\s+(${names.map(escapeRegExp).join('|')})\b|(?:const|let|var)\s+(${names.map(escapeRegExp).join('|')})\s*=)`,
    'g'
  );
}

function collectBorderUniformityDefinitions(repoRoot) {
  const pattern = /\b(?:function\s+(bordersAreUniform|sameCompiledBorder|sameBorder)\b|(?:const|let|var)\s+(bordersAreUniform|sameCompiledBorder|sameBorder)\s*=)/g;
  return listProjectFiles(repoRoot)
    .map((file) => ({ file, relativeFile: repoRelative(repoRoot, file) }))
    .filter(({ file, relativeFile }) => isG6Scope(relativeFile) && !isSkipped(relativeFile) && isCodeFile(file))
    .flatMap(({ file, relativeFile }) => {
      const text = stripCommentsPreservingDefinitions(fs.readFileSync(file, 'utf8'), relativeFile);
      return [...text.matchAll(pattern)].map((match) => ({
        file: relativeFile,
        name: match[1] || match[2],
      }));
    })
    .sort((a, b) => `${a.file}\n${a.name}`.localeCompare(`${b.file}\n${b.name}`));
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
    baselineExpansion: result.baselineExpansion || [],
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
