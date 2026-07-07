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

test('G4 ignores invalid-input coverage text in comments and ordinary strings', () => {
  const root = makeSampleProject({
    'scripts/audit-commented.js': 'process.exit(1);\n',
    'test/audit-commented.test.js': [
      '// audit-commented invalid-input 必须 fail',
      'const fakeImport = "const test = require(\'node:test\');";',
      'const note = "audit-commented invalid-input 必须 fail";',
      'test("audit-commented invalid-input 必须 fail", () => {});',
      'test("audit-commented happy path", () => {});',
      '',
    ].join('\n'),
  });

  const violations = collectG4Violations(root);

  assert.deepEqual(violations, [{
    rule: 'G4.1 audit invalid-input coverage',
    file: 'scripts/audit-commented.js',
    detail: 'missing test named "audit-commented invalid-input 必须 fail"',
  }]);
});

test('G4 accepts a real Node test case named for invalid-input coverage', () => {
  const root = makeSampleProject({
    'scripts/audit-covered.js': 'process.exit(1);\n',
    'test/audit-covered.test.js': [
      'const test = require("node:test");',
      'test("audit-covered invalid-input 必须 fail", () => {});',
      '',
    ].join('\n'),
  });

  const violations = collectG4Violations(root);

  assert.deepEqual(violations, []);
});

test('G4 rejects invalid-input coverage when test is shadowed by a local function', () => {
  const root = makeSampleProject({
    'scripts/audit-shadowed.js': 'process.exit(1);\n',
    'test/audit-shadowed.test.js': [
      'function test(_name, _fn) {}',
      'test("audit-shadowed invalid-input 必须 fail", () => {});',
      '',
    ].join('\n'),
  });

  const violations = collectG4Violations(root);

  assert.deepEqual(violations, [{
    rule: 'G4.1 audit invalid-input coverage',
    file: 'scripts/audit-shadowed.js',
    detail: 'missing test named "audit-shadowed invalid-input 必须 fail"',
  }]);
});

test('G4 accepts a destructured node:test import for invalid-input coverage', () => {
  const root = makeSampleProject({
    'scripts/audit-destructured.js': 'process.exit(1);\n',
    'test/audit-destructured.test.js': [
      'const { test } = require("node:test");',
      'test("audit-destructured invalid-input 必须 fail", () => {});',
      '',
    ].join('\n'),
  });

  const violations = collectG4Violations(root);

  assert.deepEqual(violations, []);
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
  const testNames = collectNodeTestNames(repoRoot);
  const violations = [];

  for (const script of scripts) {
    const basename = path.basename(script, '.js');
    const relativeScript = repoRelative(repoRoot, script);
    const expectedName = `${basename} invalid-input 必须 fail`;
    if (!testNames.has(expectedName)) {
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

function collectNodeTestNames(repoRoot) {
  const testDir = path.join(repoRoot, 'test');
  const names = new Set();
  if (!fs.existsSync(testDir)) return names;
  for (const file of collectFiles(testDir)
    .filter((file) => file.endsWith('.test.js'))
    .filter((file) => !repoRelative(repoRoot, file).startsWith('test/architecture/'))) {
    for (const name of extractNodeTestNames(fs.readFileSync(file, 'utf8'))) {
      names.add(name);
    }
  }
  return names;
}

function extractNodeTestNames(source) {
  const apiNames = collectNodeTestApiNames(source);
  const names = [];
  if (apiNames.size === 0) return names;
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index).end;
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index).end;
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index);
    } else if (isBareTestIdentifierAt(source, index, apiNames)) {
      const openParenIndex = findCallOpenParen(source, index + testIdentifierAt(source, index, apiNames).length);
      if (openParenIndex === null) {
        index += 1;
        continue;
      }
      const firstArgumentIndex = nextArgumentIndex(source, openParenIndex + 1);
      const literal = readStaticStringLiteral(source, firstArgumentIndex);
      if (literal) names.push(literal.value);
      index = openParenIndex + 1;
    } else {
      index += 1;
    }
  }
  return names;
}

function collectNodeTestApiNames(source) {
  const codeMask = codeMaskFor(source);
  const names = new Set();
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]node:test['"]\s*\)/g)) {
    if (!codeMask[match.index]) continue;
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*['"]node:test['"]\s*\)/g)) {
    if (!codeMask[match.index]) continue;
    addNamedNodeTestImports(names, match[1]);
  }
  for (const match of source.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]node:test['"]/g)) {
    if (!codeMask[match.index]) continue;
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s+['"]node:test['"]/g)) {
    if (!codeMask[match.index]) continue;
    addNamedNodeTestImports(names, match[1]);
  }

  for (const shadowed of collectShadowedTestApiNames(source, codeMask)) {
    names.delete(shadowed);
  }
  return names;
}

function addNamedNodeTestImports(names, specifierList) {
  for (const specifier of specifierList.split(',')) {
    const match = specifier.trim().match(/^(test|it)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/);
    if (match) names.add(match[2] || match[1]);
  }
}

function collectShadowedTestApiNames(source, codeMask) {
  const names = new Set();
  for (const match of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!codeMask[match.index]) continue;
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    if (!codeMask[match.index]) continue;
    const declaration = source.slice(match.index, Math.min(source.length, match.index + 160));
    if (/=\s*require\(\s*['"]node:test['"]\s*\)/.test(declaration)) continue;
    names.add(match[1]);
  }
  return names;
}

function codeMaskFor(source) {
  let index = 0;
  const mask = new Array(source.length).fill(false);
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index).end;
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index).end;
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index);
    } else {
      mask[index] = true;
      index += 1;
    }
  }
  return mask;
}

function isBareTestIdentifierAt(source, index, apiNames) {
  const identifier = testIdentifierAt(source, index, apiNames);
  if (!identifier) return false;
  const previousIndex = previousSignificantIndex(source, index);
  return previousIndex === -1 || source[previousIndex] !== '.';
}

function testIdentifierAt(source, index, apiNames) {
  for (const identifier of apiNames) {
    if (
      source.startsWith(identifier, index)
      && !isIdentifierCharacter(source[index - 1])
      && !isIdentifierCharacter(source[index + identifier.length])
    ) {
      return identifier;
    }
  }
  return null;
}

function findCallOpenParen(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return source[cursor] === '(' ? cursor : null;
}

function nextArgumentIndex(source, index) {
  let cursor = index;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
    } else if (source.startsWith('//', cursor)) {
      cursor = skipLineComment(source, cursor);
    } else if (source.startsWith('/*', cursor)) {
      cursor = skipBlockComment(source, cursor);
    } else {
      return cursor;
    }
  }
  return source.length;
}

function readStaticStringLiteral(source, index) {
  if (source[index] === '"' || source[index] === "'") return skipQuotedString(source, index);
  if (source[index] === '`') {
    const literal = skipTemplateLiteral(source, index);
    return literal.isStatic ? literal : null;
  }
  return null;
}

function skipLineComment(source, index) {
  const newlineIndex = source.indexOf('\n', index + 2);
  return newlineIndex === -1 ? source.length : newlineIndex + 1;
}

function skipBlockComment(source, index) {
  const closeIndex = source.indexOf('*/', index + 2);
  return closeIndex === -1 ? source.length : closeIndex + 2;
}

function skipQuotedString(source, index) {
  const quote = source[index];
  let cursor = index + 1;
  let value = '';
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      value += source[cursor + 1] || '';
      cursor += 2;
    } else if (source[cursor] === quote) {
      return { value, end: cursor + 1 };
    } else {
      value += source[cursor];
      cursor += 1;
    }
  }
  return { value, end: source.length };
}

function skipTemplateLiteral(source, index) {
  let cursor = index + 1;
  let value = '';
  let isStatic = true;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      value += source[cursor + 1] || '';
      cursor += 2;
    } else if (source.startsWith('${', cursor)) {
      isStatic = false;
      cursor += 2;
    } else if (source[cursor] === '`') {
      return { value, end: cursor + 1, isStatic };
    } else {
      value += source[cursor];
      cursor += 1;
    }
  }
  return { value, end: source.length, isStatic: false };
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

function skipRegexLiteral(source, index) {
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
  return source.length;
}

function isIdentifierCharacter(character) {
  return typeof character === 'string' && /[$\w]/.test(character);
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
