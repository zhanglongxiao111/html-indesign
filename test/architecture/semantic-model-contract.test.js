const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G3';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G3.json');

const G3_RULE_METADATA = {
  'G3.1 semantic exports validate model': {
    reason: 'Semantic model exits must validate generated DocumentModel objects before they cross format boundaries.',
    remediation: 'Require validateSemanticModel at the adapter exit and fail visibly when the generated model is invalid.',
  },
  'G3.2 invalid adapter input fails': {
    reason: 'Adapter exits must reject invalid input instead of returning an unverifiable model.',
    remediation: 'Throw a concrete error or return an explicit invalid result for unsupported adapter inputs.',
  },
  'G3.3 registry-backed adapter isomorphism': {
    reason: 'HTML and InDesign adapters must expose registered semantic model fields consistently.',
    remediation: 'Register the field in src/protocol or record the current dialect difference in the G3 ratchet baseline.',
  },
};

const ADAPTER_EXITS = [
  {
    name: 'html snapshotToSemanticModel',
    file: 'src/adapters/html/normalizer/snapshot-to-model.js',
    exportName: 'snapshotToSemanticModel',
  },
  {
    name: 'indesign reverseSnapshotToSemanticModel',
    file: 'src/adapters/indesign/normalizer/snapshot-to-model.js',
    exportName: 'reverseSnapshotToSemanticModel',
  },
  {
    name: 'indesign blueprintMigrationToSemanticModel',
    file: 'src/adapters/indesign/normalizer/blueprint-migration.js',
    exportName: 'blueprintMigrationToSemanticModel',
  },
];

test('G3 catches an adapter exit that omits validateSemanticModel and reports the required fields', () => {
  const root = makeSampleProject({
    'src/adapters/html/normalizer/snapshot-to-model.js': 'function snapshotToSemanticModel() { return { kind: "DocumentModel" }; }\nmodule.exports = { snapshotToSemanticModel };\n',
  });

  const violations = collectG3Violations(root, {
    adapterExits: [{
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      exportName: 'snapshotToSemanticModel',
    }],
    skipRuntimeChecks: true,
  });

  assert.deepEqual(violations, [{
    rule: 'G3.1 semantic exports validate model',
    file: 'src/adapters/html/normalizer/snapshot-to-model.js',
    detail: 'html snapshotToSemanticModel does not call validateSemanticModel',
  }]);

  const message = formatG3Failure({ newViolations: violations, expiredExemptions: [] });
  assert.match(message, /Rule: G3\.1 semantic exports validate model/);
  assert.match(message, /Reason: Semantic model exits must validate generated DocumentModel objects before they cross format boundaries\./);
  assert.match(message, /Remediation: Require validateSemanticModel at the adapter exit and fail visibly when the generated model is invalid\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G3 catches exported adapter exits even when unrelated helpers call validateSemanticModel', () => {
  const root = makeSampleProject({
    'src/adapters/html/normalizer/snapshot-to-model.js': [
      'const { validateSemanticModel } = require("../../../semantic-model");',
      'function helper(model) { return validateSemanticModel(model); }',
      'function snapshotToSemanticModel() { return { kind: "DocumentModel" }; }',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, {
    adapterExits: [{
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      exportName: 'snapshotToSemanticModel',
    }],
    skipRuntimeChecks: true,
  });

  assert.deepEqual(violations, [{
    rule: 'G3.1 semantic exports validate model',
    file: 'src/adapters/html/normalizer/snapshot-to-model.js',
    detail: 'html snapshotToSemanticModel does not call validateSemanticModel',
  }]);
});

test('G3 catches exported adapter exits when an uncalled nested helper validates the model', () => {
  const root = makeSampleProject({
    'src/adapters/html/normalizer/snapshot-to-model.js': [
      'const { validateSemanticModel } = require("../../../semantic-model");',
      'function snapshotToSemanticModel() {',
      '  function nestedDeadHelper(model) {',
      '    return validateSemanticModel(model);',
      '  }',
      '  return { kind: "DocumentModel" };',
      '}',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, {
    adapterExits: [{
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      exportName: 'snapshotToSemanticModel',
    }],
    skipRuntimeChecks: true,
  });

  assert.deepEqual(violations, [{
    rule: 'G3.1 semantic exports validate model',
    file: 'src/adapters/html/normalizer/snapshot-to-model.js',
    detail: 'html snapshotToSemanticModel does not call validateSemanticModel',
  }]);
});

test('G3 catches validateSemanticModel calls inside obviously unreachable branches', () => {
  for (const guard of ['false', '0', 'null']) {
    const root = makeSampleProject({
      'src/adapters/html/normalizer/snapshot-to-model.js': [
        'const { validateSemanticModel } = require("../../../semantic-model");',
        'function snapshotToSemanticModel() {',
        `  if (${guard}) { validateSemanticModel(model); }`,
        '  return { kind: "DocumentModel" };',
        '}',
        'module.exports = { snapshotToSemanticModel };',
        '',
      ].join('\n'),
    });

    const violations = collectG3Violations(root, {
      adapterExits: [{
        name: 'html snapshotToSemanticModel',
        file: 'src/adapters/html/normalizer/snapshot-to-model.js',
        exportName: 'snapshotToSemanticModel',
      }],
      skipRuntimeChecks: true,
    });

    assert.deepEqual(violations, [{
      rule: 'G3.1 semantic exports validate model',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      detail: 'html snapshotToSemanticModel does not call validateSemanticModel',
    }], `guard ${guard} must not satisfy G3.1`);
  }
});

test('G3 catches unbraced validateSemanticModel calls inside obviously unreachable branches', () => {
  for (const guard of ['false', '0', 'null']) {
    const root = makeSampleProject({
      'src/adapters/html/normalizer/snapshot-to-model.js': [
        'const { validateSemanticModel } = require("../../../semantic-model");',
        'function snapshotToSemanticModel() {',
        `  if (${guard}) validateSemanticModel(model);`,
        '  return { kind: "DocumentModel" };',
        '}',
        'module.exports = { snapshotToSemanticModel };',
        '',
      ].join('\n'),
    });

    const violations = collectG3Violations(root, {
      adapterExits: [{
        name: 'html snapshotToSemanticModel',
        file: 'src/adapters/html/normalizer/snapshot-to-model.js',
        exportName: 'snapshotToSemanticModel',
      }],
      skipRuntimeChecks: true,
    });

    assert.deepEqual(violations, [{
      rule: 'G3.1 semantic exports validate model',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      detail: 'html snapshotToSemanticModel does not call validateSemanticModel',
    }], `unbraced guard ${guard} must not satisfy G3.1`);
  }
});

test('G3 ignores validateSemanticModel mentions in comments and ordinary strings', () => {
  const root = makeSampleProject({
    'src/adapters/html/normalizer/snapshot-to-model.js': [
      'function snapshotToSemanticModel() {',
      '  // validateSemanticModel(model);',
      '  const note = "validateSemanticModel(model)";',
      '  return { kind: "DocumentModel" };',
      '}',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, {
    adapterExits: [{
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      exportName: 'snapshotToSemanticModel',
    }],
    skipRuntimeChecks: true,
  });

  assert.deepEqual(violations, [{
    rule: 'G3.1 semantic exports validate model',
    file: 'src/adapters/html/normalizer/snapshot-to-model.js',
    detail: 'html snapshotToSemanticModel does not call validateSemanticModel',
  }]);
});

test('G3 accepts a top-level direct validateSemanticModel call in the exported adapter exit', () => {
  const root = makeSampleProject({
    'src/adapters/html/normalizer/snapshot-to-model.js': [
      'const { validateSemanticModel } = require("../../../semantic-model");',
      'function snapshotToSemanticModel() {',
      '  const model = { kind: "DocumentModel" };',
      '  validateSemanticModel(model);',
      '  return model;',
      '}',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, {
    adapterExits: [{
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      exportName: 'snapshotToSemanticModel',
    }],
    skipRuntimeChecks: true,
  });

  assert.deepEqual(violations, []);
});

test('G3 accepts a returned direct validateSemanticModel call in the exported adapter exit', () => {
  const root = makeSampleProject({
    'src/adapters/html/normalizer/snapshot-to-model.js': [
      'const { validateSemanticModel } = require("../../../semantic-model");',
      'function snapshotToSemanticModel() {',
      '  const model = { kind: "DocumentModel" };',
      '  return validateSemanticModel(model);',
      '}',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, {
    adapterExits: [{
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      exportName: 'snapshotToSemanticModel',
    }],
    skipRuntimeChecks: true,
  });

  assert.deepEqual(violations, []);
});

test('G3 reports registry comparable paths missing from both adapter sample collectors', () => {
  const root = makeSampleProject({
    'src/protocol/index.js': [
      'const fieldEntries = [{',
      '  canonicalPath: "document.uncoveredRegistryPath",',
      '  currentPaths: ["document.id"],',
      '  fieldClass: "canonical",',
      '  allPaths: ["document.id", "document.uncoveredRegistryPath"],',
      '  capabilities: { html: { read: "native" }, indesign: { read: "lossless" } },',
      '}];',
      'const fieldRegistry = { getByPath: (modelPath) => fieldEntries.flatMap((entry) => entry.allPaths).includes(modelPath) };',
      'function scanModelPaths(model) { return model.paths; }',
      'module.exports = { fieldEntries, fieldRegistry, scanModelPaths };',
      '',
    ].join('\n'),
    'src/adapters/html/index.js': [
      'function snapshotToSemanticModel(input) {',
      '  if (input === null) throw new Error("invalid input");',
      '  return { paths: ["document.id"] };',
      '}',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
    'src/adapters/indesign/index.js': [
      'function reverseSnapshotToSemanticModel(input) {',
      '  if (input === null) throw new Error("invalid input");',
      '  return { paths: ["document.id"] };',
      '}',
      'function blueprintMigrationToSemanticModel(input) {',
      '  if (input === null) throw new Error("invalid input");',
      '  return { paths: ["document.id"] };',
      '}',
      'module.exports = { reverseSnapshotToSemanticModel, blueprintMigrationToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, { adapterExits: [] });

  assert.deepEqual(violations, [{
    rule: 'G3.3 registry-backed adapter isomorphism',
    file: 'src/protocol/index.js',
    detail: 'registered comparable model path document.uncoveredRegistryPath is not covered by html or indesign adapter samples',
  }]);
});

test('G3 sample coverage is based on canonical adapter-readable model paths', () => {
  const root = makeSampleProject({
    'src/protocol/index.js': [
      'const fieldEntries = [{',
      '  canonicalPath: "document.id",',
      '  currentPaths: ["snapshot.document.id", "instructions.document.id"],',
      '  allPaths: ["document.id", "snapshot.document.id", "instructions.document.id"],',
      '  fieldClass: "canonical",',
      '  capabilities: { html: { read: "native" }, indesign: { read: "lossless" } },',
      '}, {',
      '  canonicalPath: "items[].observedLabel",',
      '  currentPaths: ["pages[].items[].observedLabel"],',
      '  allPaths: ["items[].observedLabel", "pages[].items[].observedLabel"],',
      '  fieldClass: "sourceMetadata",',
      '  capabilities: { html: { read: "native" }, indesign: { read: "lossless" } },',
      '}];',
      'const byPath = new Set(fieldEntries.flatMap((entry) => entry.allPaths));',
      'const fieldRegistry = { getByPath: (modelPath) => byPath.has(modelPath) };',
      'function scanModelPaths(model) { return model.paths; }',
      'module.exports = { fieldEntries, fieldRegistry, scanModelPaths };',
      '',
    ].join('\n'),
    'src/adapters/html/index.js': [
      'function snapshotToSemanticModel(input) {',
      '  if (input === null) throw new Error("invalid input");',
      '  return { paths: ["document.id"] };',
      '}',
      'module.exports = { snapshotToSemanticModel };',
      '',
    ].join('\n'),
    'src/adapters/indesign/index.js': [
      'function reverseSnapshotToSemanticModel(input) {',
      '  if (input === null) throw new Error("invalid input");',
      '  return { paths: ["document.id", "pages[].items[].observedLabel"] };',
      '}',
      'function blueprintMigrationToSemanticModel(input) {',
      '  if (input === null) throw new Error("invalid input");',
      '  return { paths: ["document.id"] };',
      '}',
      'module.exports = { reverseSnapshotToSemanticModel, blueprintMigrationToSemanticModel };',
      '',
    ].join('\n'),
  });

  const violations = collectG3Violations(root, { adapterExits: [] });

  assert.deepEqual(violations, []);
});

test('G3 current semantic model contract violations match the ratchet baseline', () => {
  const actualViolations = collectG3Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG3Failure(result));
  }
});

test('G3 baseline does not add exemptions beyond the 9d starting point', () => {
  const current = baselineExemptions(readJson(BASELINE_PATH));
  const startingPoint = baselineExemptions(JSON.parse(execFileSync(
    'git',
    ['show', '5831054^:test/architecture/baselines/G3.json'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )));
  const startingKeys = new Set(startingPoint.map(violationKey));
  const added = current.filter((violation) => !startingKeys.has(violationKey(violation)));

  assert.deepEqual(added, []);
});

function collectG3Violations(repoRoot, options = {}) {
  const violations = [];
  const adapterExits = options.adapterExits || ADAPTER_EXITS;

  for (const adapterExit of adapterExits) {
    violations.push(...validateAdapterExitStaticContract(repoRoot, adapterExit));
  }

  if (options.skipRuntimeChecks) {
    return sortViolations(violations);
  }

  violations.push(...validateInvalidInputBehavior(repoRoot));
  violations.push(...validateAdapterSurfaceIsomorphism(repoRoot));
  return sortViolations(dedupeViolations(violations));
}

function validateAdapterExitStaticContract(repoRoot, adapterExit) {
  const file = path.join(repoRoot, adapterExit.file);
  if (!fs.existsSync(file)) {
    return [{
      rule: 'G3.1 semantic exports validate model',
      file: adapterExit.file,
      detail: `${adapterExit.name} exit file is missing`,
    }];
  }

  const source = fs.readFileSync(file, 'utf8');
  const functionBody = exportedFunctionBody(source, adapterExit.exportName);
  if (!functionBody) {
    return [{
      rule: 'G3.1 semantic exports validate model',
      file: adapterExit.file,
      detail: `${adapterExit.name} export body could not be statically resolved`,
    }];
  }
  if (functionBodyHasDirectCall(functionBody, 'validateSemanticModel')) {
    return [];
  }

  return [{
    rule: 'G3.1 semantic exports validate model',
    file: adapterExit.file,
    detail: `${adapterExit.name} does not call validateSemanticModel`,
  }];
}

function validateInvalidInputBehavior(repoRoot) {
  const violations = [];
  const html = require(path.join(repoRoot, 'src/adapters/html'));
  const indesign = require(path.join(repoRoot, 'src/adapters/indesign'));
  const cases = [
    {
      name: 'html snapshotToSemanticModel',
      file: 'src/adapters/html/normalizer/snapshot-to-model.js',
      run: () => html.snapshotToSemanticModel(null),
    },
    {
      name: 'indesign reverseSnapshotToSemanticModel',
      file: 'src/adapters/indesign/normalizer/snapshot-to-model.js',
      run: () => indesign.reverseSnapshotToSemanticModel(null, { mode: 'observation' }),
    },
    {
      name: 'indesign blueprintMigrationToSemanticModel',
      file: 'src/adapters/indesign/normalizer/blueprint-migration.js',
      run: () => indesign.blueprintMigrationToSemanticModel(null),
    },
  ];

  for (const entry of cases) {
    if (!throws(entry.run)) {
      violations.push({
        rule: 'G3.2 invalid adapter input fails',
        file: entry.file,
        detail: `${entry.name} accepted null input`,
      });
    }
  }

  return violations;
}

function validateAdapterSurfaceIsomorphism(repoRoot) {
  const {
    fieldRegistry,
    fieldEntries,
    scanModelPaths,
  } = require(path.join(repoRoot, 'src/protocol'));
  const { snapshotToSemanticModel } = require(path.join(repoRoot, 'src/adapters/html'));
  const { reverseSnapshotToSemanticModel } = require(path.join(repoRoot, 'src/adapters/indesign'));
  const htmlModel = snapshotToSemanticModel(sampleHtmlSnapshot(), { unitMode: 'presentation', targetSize: 'same' });
  const indesignModel = reverseSnapshotToSemanticModel(sampleReverseSnapshot(), { mode: 'observation' });
  const surfaces = {
    html: new Set(scanModelPaths(htmlModel)),
    indesign: new Set(scanModelPaths(indesignModel)),
  };
  const comparablePaths = adapterComparableModelPaths(fieldEntries);
  const violations = [];

  for (const [adapter, paths] of Object.entries(surfaces)) {
    for (const modelPath of paths) {
      if (!fieldRegistry.getByPath(modelPath)) {
        violations.push({
          rule: 'G3.3 registry-backed adapter isomorphism',
          file: adapterFile(adapter),
          detail: `${adapter} emits unregistered model path ${modelPath}`,
        });
      }
    }
  }

  for (const modelPath of [...comparablePaths].sort()) {
    if (!surfaces.html.has(modelPath) && !surfaces.indesign.has(modelPath)) {
      violations.push({
        rule: 'G3.3 registry-backed adapter isomorphism',
        file: 'src/protocol/index.js',
        detail: `registered comparable model path ${modelPath} is not covered by html or indesign adapter samples`,
      });
      continue;
    }
    if (surfaces.html.has(modelPath) && !surfaces.indesign.has(modelPath)) {
      violations.push({
        rule: 'G3.3 registry-backed adapter isomorphism',
        file: 'src/adapters/html/normalizer/snapshot-to-model.js',
        detail: `html emits ${modelPath} but indesign does not`,
      });
    }
    if (surfaces.indesign.has(modelPath) && !surfaces.html.has(modelPath)) {
      violations.push({
        rule: 'G3.3 registry-backed adapter isomorphism',
        file: 'src/adapters/indesign/normalizer/snapshot-to-model.js',
        detail: `indesign emits ${modelPath} but html does not`,
      });
    }
  }

  return violations;
}

function functionBodyHasDirectCall(source, calleeName) {
  let index = 0;
  let blockDepth = 0;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index);
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index);
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index);
    } else if (blockDepth === 0 && isIdentifierAt(source, index, 'function')) {
      const bodyStart = functionBodyOpenBrace(source, index);
      const bodyEnd = bodyStart === -1 ? -1 : matchingBraceIndex(source, bodyStart);
      index = bodyEnd === -1 ? source.length : bodyEnd + 1;
    } else if (source.startsWith('=>', index)) {
      index = skipArrowFunctionBody(source, index);
    } else if (blockDepth === 0 && isIdentifierAt(source, index, 'if')) {
      index = skipIfStatement(source, index);
    } else if (source[index] === '{') {
      blockDepth += 1;
      index += 1;
    } else if (source[index] === '}') {
      blockDepth = Math.max(0, blockDepth - 1);
      index += 1;
    } else if (blockDepth === 0 && isIdentifierAt(source, index, 'return')) {
      return returnStatementHasDirectCall(source, index, calleeName);
    } else if (blockDepth === 0 && isIdentifierAt(source, index, 'throw')) {
      return false;
    } else if (blockDepth === 0 && isIdentifierAt(source, index, calleeName) && isDirectCallAt(source, index, calleeName)) {
      return true;
    } else {
      index += 1;
    }
  }
  return false;
}

function returnStatementHasDirectCall(source, returnIndex, calleeName) {
  let cursor = skipWhitespaceAndComments(source, returnIndex + 'return'.length);
  while (source[cursor] === '(') {
    cursor = skipWhitespaceAndComments(source, cursor + 1);
  }
  return isIdentifierAt(source, cursor, calleeName) && isDirectCallAt(source, cursor, calleeName);
}

function skipIfStatement(source, ifIndex) {
  const conditionStart = skipWhitespaceAndComments(source, ifIndex + 'if'.length);
  if (source[conditionStart] !== '(') return ifIndex + 'if'.length;
  const conditionEnd = matchingParenIndex(source, conditionStart);
  if (conditionEnd === -1) return source.length;

  let cursor = skipSingleStatement(source, skipWhitespaceAndComments(source, conditionEnd + 1));
  const afterConsequent = skipWhitespaceAndComments(source, cursor);
  if (!isIdentifierAt(source, afterConsequent, 'else')) {
    return cursor;
  }

  cursor = skipWhitespaceAndComments(source, afterConsequent + 'else'.length);
  if (isIdentifierAt(source, cursor, 'if')) {
    return skipIfStatement(source, cursor);
  }
  return skipSingleStatement(source, cursor);
}

function skipSingleStatement(source, statementIndex) {
  if (source[statementIndex] === '{') {
    const bodyEnd = matchingBraceIndex(source, statementIndex);
    return bodyEnd === -1 ? source.length : bodyEnd + 1;
  }

  let cursor = statementIndex;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  while (cursor < source.length) {
    if (source.startsWith('//', cursor)) {
      cursor = skipLineComment(source, cursor);
    } else if (source.startsWith('/*', cursor)) {
      cursor = skipBlockComment(source, cursor);
    } else if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuotedString(source, cursor);
    } else if (source[cursor] === '`') {
      cursor = skipTemplateLiteral(source, cursor);
    } else if (source[cursor] === '/' && startsRegexLiteral(source, cursor)) {
      cursor = skipRegexLiteral(source, cursor);
    } else if (source[cursor] === '(') {
      parenDepth += 1;
      cursor += 1;
    } else if (source[cursor] === ')') {
      if (parenDepth === 0) return cursor + 1;
      parenDepth -= 1;
      cursor += 1;
    } else if (source[cursor] === '[') {
      bracketDepth += 1;
      cursor += 1;
    } else if (source[cursor] === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      cursor += 1;
    } else if (source[cursor] === '{') {
      braceDepth += 1;
      cursor += 1;
    } else if (source[cursor] === '}') {
      if (braceDepth === 0) return cursor;
      braceDepth -= 1;
      cursor += 1;
    } else if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && /[;\n]/.test(source[cursor])) {
      return cursor + 1;
    } else {
      cursor += 1;
    }
  }
  return source.length;
}

function skipWhitespaceAndComments(source, index) {
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
  return cursor;
}

function isDirectCallAt(source, index, calleeName) {
  const previousIndex = previousSignificantIndex(source, index);
  if (previousIndex !== -1 && source[previousIndex] === '.') return false;
  let cursor = index + calleeName.length;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return source[cursor] === '(';
}

function isIdentifierAt(source, index, identifier) {
  if (!source.startsWith(identifier, index)) return false;
  return !isIdentifierCharacter(source[index - 1]) && !isIdentifierCharacter(source[index + identifier.length]);
}

function isIdentifierCharacter(character) {
  return typeof character === 'string' && /[$\w]/.test(character);
}

function skipArrowFunctionBody(source, arrowIndex) {
  let cursor = arrowIndex + 2;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  if (source[cursor] === '{') {
    const bodyEnd = matchingBraceIndex(source, cursor);
    return bodyEnd === -1 ? source.length : bodyEnd + 1;
  }

  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  while (cursor < source.length) {
    if (source.startsWith('//', cursor)) {
      cursor = skipLineComment(source, cursor);
    } else if (source.startsWith('/*', cursor)) {
      cursor = skipBlockComment(source, cursor);
    } else if (source[cursor] === '"' || source[cursor] === "'") {
      cursor = skipQuotedString(source, cursor);
    } else if (source[cursor] === '`') {
      cursor = skipTemplateLiteral(source, cursor);
    } else if (source[cursor] === '/' && startsRegexLiteral(source, cursor)) {
      cursor = skipRegexLiteral(source, cursor);
    } else if (source[cursor] === '(') {
      parenDepth += 1;
      cursor += 1;
    } else if (source[cursor] === ')') {
      if (parenDepth === 0) return cursor + 1;
      parenDepth -= 1;
      cursor += 1;
    } else if (source[cursor] === '[') {
      bracketDepth += 1;
      cursor += 1;
    } else if (source[cursor] === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      cursor += 1;
    } else if (source[cursor] === '{') {
      braceDepth += 1;
      cursor += 1;
    } else if (source[cursor] === '}') {
      if (braceDepth === 0) return cursor;
      braceDepth -= 1;
      cursor += 1;
    } else if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && /[;,\n]/.test(source[cursor])) {
      return cursor + 1;
    } else {
      cursor += 1;
    }
  }
  return source.length;
}

function exportedFunctionBody(source, exportName) {
  const directFunctionIndex = source.indexOf(`function ${exportName}`);
  if (directFunctionIndex !== -1) {
    const bodyStart = functionBodyOpenBrace(source, directFunctionIndex);
    if (bodyStart !== -1) {
      const bodyEnd = matchingBraceIndex(source, bodyStart);
      if (bodyEnd !== -1) return source.slice(bodyStart + 1, bodyEnd);
      return source.slice(bodyStart + 1, nextTopLevelBoundary(source, bodyStart));
    }
  }

  const declarations = [
    new RegExp(`\\bfunction\\s+${escapeRegExp(exportName)}\\s*\\(`, 'm'),
    new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(exportName)}\\s*=\\s*(?:async\\s*)?(?:function\\s*)?\\(`, 'm'),
    new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(exportName)}\\s*=\\s*(?:async\\s*)?[^=;\\n]+=>\\s*\\{`, 'm'),
  ];

  for (const declaration of declarations) {
    const match = declaration.exec(source);
    if (!match) continue;
    const bodyStart = functionBodyOpenBrace(source, match.index);
    if (bodyStart === -1) continue;
    const bodyEnd = matchingBraceIndex(source, bodyStart);
    if (bodyEnd !== -1) return source.slice(bodyStart + 1, bodyEnd);
    return source.slice(bodyStart + 1, nextTopLevelBoundary(source, bodyStart));
  }

  const propertyExport = new RegExp(`\\b(?:module\\.)?exports\\.${escapeRegExp(exportName)}\\s*=\\s*(?:async\\s*)?function\\s*\\(`, 'm');
  const propertyMatch = propertyExport.exec(source);
  if (propertyMatch) {
    const bodyStart = functionBodyOpenBrace(source, propertyMatch.index);
    const bodyEnd = bodyStart === -1 ? -1 : matchingBraceIndex(source, bodyStart);
    if (bodyEnd !== -1) return source.slice(bodyStart + 1, bodyEnd);
    if (bodyStart !== -1) return source.slice(bodyStart + 1, nextTopLevelBoundary(source, bodyStart));
  }

  return null;
}

function functionBodyOpenBrace(source, declarationIndex) {
  const openParenIndex = source.indexOf('(', declarationIndex);
  if (openParenIndex === -1) return source.indexOf('{', declarationIndex);
  const closeParenIndex = matchingParenIndex(source, openParenIndex);
  if (closeParenIndex === -1) return -1;
  let cursor = closeParenIndex + 1;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  if (source.slice(cursor, cursor + 2) === '=>') {
    cursor += 2;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  }
  return source[cursor] === '{' ? cursor : -1;
}

function matchingParenIndex(source, openParenIndex) {
  let depth = 1;
  let index = openParenIndex + 1;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index);
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index);
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index);
    } else if (source[index] === '(') {
      depth += 1;
      index += 1;
    } else if (source[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
      index += 1;
    } else {
      index += 1;
    }
  }
  return -1;
}

function nextTopLevelBoundary(source, startIndex) {
  const boundary = /\n(?:function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=|module\.exports\s*=|exports\.\w+\s*=)/g;
  boundary.lastIndex = startIndex + 1;
  const match = boundary.exec(source);
  return match ? match.index : source.length;
}

function matchingBraceIndex(source, openBraceIndex) {
  let depth = 1;
  let index = openBraceIndex + 1;
  while (index < source.length) {
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index);
    } else if (source.startsWith('/*', index)) {
      index = skipBlockComment(source, index);
    } else if (source[index] === '"' || source[index] === "'") {
      index = skipQuotedString(source, index);
    } else if (source[index] === '`') {
      index = skipTemplateLiteral(source, index);
    } else if (source[index] === '/' && startsRegexLiteral(source, index)) {
      index = skipRegexLiteral(source, index);
    } else if (source[index] === '{') {
      depth += 1;
      index += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
      index += 1;
    } else {
      index += 1;
    }
  }
  return -1;
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
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
    } else if (source[cursor] === quote) {
      return cursor + 1;
    } else {
      cursor += 1;
    }
  }
  return source.length;
}

function skipTemplateLiteral(source, index) {
  let cursor = index + 1;
  while (cursor < source.length) {
    if (source[cursor] === '\\') {
      cursor += 2;
    } else if (source[cursor] === '`') {
      return cursor + 1;
    } else {
      cursor += 1;
    }
  }
  return source.length;
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
  if (!/[$\w]/.test(source[index])) return '';
  let start = index;
  while (start > 0 && /[$\w]/.test(source[start - 1])) start -= 1;
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

function sampleHtmlSnapshot() {
  return {
    metadata: { source: 'sample.html' },
    sourcePackageInput: {
      title: 'Sample',
      attributes: {
        'data-id-document': 'sample',
        'data-id-profile': 'architecture-report',
        'data-id-source-package-config': 'deck.config.json',
        'data-id-source-package-schema': '1',
        'data-id-semantic-preset': 'semantic-preset.json',
      },
      parentPages: [{
        id: 'A-Parent',
        name: 'A-Parent',
        guides: [{ orientation: 'horizontal', position: 90, source: 'parent-page' }],
      }],
      synthesizedStyles: [{
        token: 'synth-callout',
        displayName: 'Synth Callout',
        kind: 'object',
        fingerprint: 'sample-fingerprint',
        source: 'sample',
        properties: { fillColor: '#ffffff' },
      }],
    },
    pages: [{
      id: 'page-1',
      index: 0,
      width: 100,
      height: 100,
      attributes: {
        'data-page': 'page-1',
        'data-id-semantic': 'cover',
        'data-id-layout': 'cover-layout',
        'data-id-margin-top': '5',
        'data-id-margin-right': '6',
        'data-id-margin-bottom': '7',
        'data-id-margin-left': '8',
        'data-id-grid': '12x6',
        'data-id-column-gutter': '4',
        'data-id-row-gutter': '3',
        'data-id-baseline': '2',
        'data-id-baseline-guides': 'baseline',
        'data-id-guide-mode': 'explicit',
        'data-id-snap-grid': '4',
        'data-id-snap-grid-x': '4',
        'data-id-snap-grid-y': '4',
      },
      items: [{
        id: 'item-1',
        role: 'text',
        tagName: 'p',
        text: 'Hello',
        runs: [{
          text: 'Hello',
          tagName: 'span',
          classList: ['run'],
          attributes: { 'data-id-character-style': 'emphasis' },
        }],
        attributes: {
          'data-id-semantic': 'title',
          'data-id-layout': 'title-layout',
          'data-id-layer': 'Layer 1',
          'data-id-paragraph-style': 'body',
          'data-id-paragraph-style-name': 'body',
          'data-id-frame-style': 'callout-frame',
          'data-id-frame-style-name': 'Callout Frame',
          'data-id-character-style': 'emphasis',
          'data-id-character-style-name': 'emphasis',
          'data-id-object-style': 'object-style',
          'data-id-object-style-name': 'Object Style',
          'data-id-table-style': 'default-table',
          'data-id-table-style-name': 'default-table',
          'data-id-style': 'generic-style',
          'data-id-style-token': 'synth-callout',
          'data-id-style-name': 'Synth Callout',
          'data-id-paragraph-composer': 'Adobe Paragraph Composer',
        },
        cssVars: {
          '--grid-col': '1',
          '--grid-span': '4',
          '--grid-row': '1',
          '--grid-row-span': '1',
        },
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        computedStyle: {
          objectFit: 'contain',
          objectPosition: '50% 50%',
          paddingTop: '1px',
          paddingRight: '1px',
          paddingBottom: '1px',
          paddingLeft: '1px',
          overflow: 'hidden',
          opacity: '0.75',
          mixBlendMode: 'multiply',
        },
        visualStyle: {
          fillColor: '#eeeeee',
          fillOpacity: 80,
          strokeColor: '#999999',
          strokeWeight: 1,
          strokeOpacity: 90,
          strokeStyle: 'solid',
          strokeAlignment: 'center',
          lineStartMarker: { rawName: 'None' },
          lineEndMarker: { rawName: 'Arrow' },
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          strokeMiterLimit: 4,
          cornerRadius: 2,
        },
        vectorGeometry: {
          kind: 'path',
          paths: [{
            closed: false,
            visualStyle: {
              fillColor: '#eeeeee',
              fillOpacity: 80,
              strokeColor: '#999999',
              strokeWeight: 1,
              strokeOpacity: 90,
              strokeStyle: 'solid',
              strokeAlignment: 'center',
              lineStartMarker: { rawName: 'None' },
              lineEndMarker: { rawName: 'Arrow' },
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              strokeMiterLimit: 4,
              opacity: 75,
              blendMode: 'multiply',
            },
            points: [{
              anchor: { x: 0, y: 0 },
              leftDirection: { x: 0, y: 0 },
              rightDirection: { x: 10, y: 10 },
              pointType: 'corner',
            }],
          }],
        },
      }, {
        id: 'parent-rule-on-page',
        role: 'text',
        tagName: 'p',
        text: 'Parent',
        runs: [],
        attributes: {
          'data-id-role': 'text',
          'data-id-parent-page-item': 'A-Parent',
          'data-id-parent-page-source-id': 'parent-rule',
        },
        bounds: { x: 0, y: 90, width: 100, height: 1 },
        computedStyle: {},
      }, {
        id: 'table-1',
        role: 'table',
        tagName: 'table',
        attributes: {},
        bounds: { x: 20, y: 20, width: 60, height: 30 },
        computedStyle: {},
        table: [{
          index: 0,
          header: true,
          cells: [{
            index: 0,
            text: 'Area',
            computedStyle: {},
            attributes: {},
            rowSpan: 1,
            colSpan: 1,
            boundsMm: { x: 20, y: 20, width: 60, height: 30 },
            runs: [{
              text: 'Area',
              tagName: 'span',
              classList: ['table-run'],
              attributes: { 'data-id-character-style': 'emphasis' },
              characterStyle: 'emphasis',
            }],
          }],
        }],
        content: {
          tableStyle: null,
          rowCount: 1,
          columnCount: 1,
          columnWidths: [60],
          rowHeights: [30],
          rows: [{
            index: 0,
            header: true,
            cells: [{
              index: 0,
              text: 'Area',
              header: false,
              rowSpan: 1,
              colSpan: 1,
              paragraphStyle: null,
              cellStyle: 'cell-body',
              fillColor: null,
              fillOpacity: 80,
              borderColor: '#cccccc',
              borderWeight: 1,
              textColor: null,
              bounds: { x: 20, y: 20, width: 60, height: 30 },
              pointSize: null,
              leading: null,
              textAlign: 'left',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              paddingUnit: 'pt',
              borders: {
                top: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                right: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                bottom: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                left: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
              },
              runs: [],
            }, {
              index: 1,
              text: 'Value',
              header: false,
              rowSpan: 1,
              colSpan: 1,
              paragraphStyle: null,
              cellStyle: 'cell-body',
              fillColor: null,
              fillOpacity: 80,
              borderColor: '#cccccc',
              borderWeight: 1,
              textColor: null,
              bounds: { x: 40, y: 20, width: 40, height: 30 },
              pointSize: null,
              leading: null,
              textAlign: 'left',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              paddingUnit: 'pt',
              borders: {
                top: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                right: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                bottom: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                left: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
              },
              runs: [{
                text: 'Value',
                tagName: 'span',
                classList: ['table-run'],
                attributes: { 'data-id-character-style': 'emphasis' },
                characterStyle: 'emphasis',
              }],
            }],
          }],
        },
      }],
    }],
    styleLayout: {
      unitMode: 'presentation',
      targetUnit: 'pt',
      scale: 1,
      targetSize: { width: 100, height: 100 },
    },
    styles: {
      paragraphStyles: {
        body: {
          name: 'body',
          token: 'body',
          displayName: 'body',
          safeName: 'body',
          css: 'font-size: 12pt;',
          source: 'html',
          composer: 'Adobe Paragraph Composer',
          labels: [{ kind: 'style', id: 'body', token: 'body', displayName: 'body', styleKind: 'paragraphStyles' }],
        },
      },
      characterStyles: {
        emphasis: {
          name: 'emphasis',
          token: 'emphasis',
          displayName: 'emphasis',
          safeName: 'emphasis',
          css: 'font-weight: 600;',
          source: 'html',
          labels: [{ kind: 'style', id: 'emphasis', token: 'emphasis', displayName: 'emphasis', styleKind: 'characterStyles' }],
        },
      },
      objectStyles: {
        'object-style': {
          name: 'Object Style',
          token: 'object-style',
          displayName: 'Object Style',
          safeName: 'object-style',
          css: 'stroke: #999999;',
          source: 'html',
          labels: [{ kind: 'style', id: 'object-style', token: 'object-style', displayName: 'Object Style', styleKind: 'objectStyles' }],
        },
      },
      frameStyles: {
        'callout-frame': {
          name: 'Callout Frame',
          token: 'callout-frame',
          displayName: 'Callout Frame',
          safeName: 'callout-frame',
          css: 'object-fit: contain;',
          source: 'html',
          labels: [{ kind: 'style', id: 'callout-frame', token: 'callout-frame', displayName: 'Callout Frame', styleKind: 'frameStyles' }],
        },
      },
      tableStyles: {
        'default-table': {
          name: 'default-table',
          token: 'default-table',
          displayName: 'default-table',
          safeName: 'default-table',
          css: 'border-collapse: collapse;',
          source: 'html',
          labels: [{ kind: 'style', id: 'default-table', token: 'default-table', displayName: 'default-table', styleKind: 'tableStyles' }],
        },
      },
      cellStyles: {
        'cell-body': {
          name: 'cell-body',
          token: 'cell-body',
          displayName: 'cell-body',
          safeName: 'cell-body',
          css: 'padding: 0;',
          source: 'html',
          labels: [{ kind: 'style', id: 'cell-body', token: 'cell-body', displayName: 'cell-body', styleKind: 'cellStyles' }],
        },
      },
    },
    assets: [{ kind: 'image', path: '\\\\nas\\share\\sample.png' }],
  };
}

function sampleReverseSnapshot() {
  return {
    metadata: { mode: 'observation' },
    document: {
      name: 'sample.indd',
      labels: [{
        protocol: 'html_indesign',
        version: 1,
        kind: 'document',
        id: 'sample',
        source: 'indesign-reverse',
        title: 'sample',
        unitMode: 'presentation',
        coordinateUnit: 'pt',
        profile: 'architecture-report',
        sourcePackage: {
          config: 'deck.config.json',
          schemaVersion: 1,
          parentPages: [{ id: 'A-Parent', name: 'A-Parent' }],
          semanticPreset: { relativePath: 'semantic-preset.json' },
        },
      }],
    },
    pages: [{
      id: 'page-1',
      index: 0,
      bounds: { width: 100, height: 100 },
      labels: [{
        protocol: 'html_indesign',
        version: 1,
        kind: 'page',
        id: 'page-1',
        source: 'indesign-reverse',
        semantic: 'cover',
        layout: 'cover-layout',
        margins: { top: 5, right: 6, bottom: 7, left: 8 },
        grid: {
          columns: 12,
          rows: 6,
          columnGutter: 4,
          rowGutter: 3,
          baseline: 2,
          baselineGuideMode: 'baseline',
        },
      }],
      items: [{
        id: 'item-1',
        type: 'TextFrame',
        text: 'Hello',
        textRuns: [{
          text: 'Hello',
          tagName: 'span',
          classList: ['run'],
          attributes: { 'data-id-character-style': 'emphasis' },
          characterStyle: 'emphasis',
        }],
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        visualStyle: {
          fillColor: '#eeeeee',
          fillOpacity: 80,
          strokeColor: '#999999',
          strokeWeight: 1,
          strokeOpacity: 90,
          strokeStyle: 'solid',
          strokeAlignment: 'center',
          lineStartMarker: { rawName: 'None' },
          lineEndMarker: { rawName: 'Arrow' },
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          strokeMiterLimit: 4,
          cornerRadius: 2,
          opacity: 75,
          blendMode: 'multiply',
        },
        textStyle: {
          composer: 'Adobe Paragraph Composer',
          pointSize: 12,
        },
        vectorGeometry: {
          kind: 'path',
          paths: [{
            closed: false,
            points: [{
              anchor: { x: 0, y: 0 },
              leftDirection: { x: 0, y: 0 },
              rightDirection: { x: 10, y: 10 },
              pointType: 'corner',
            }],
          }],
        },
        styleRefs: {
          layer: 'Layer 1',
          paragraphStyle: 'body',
          characterStyle: 'emphasis',
          objectStyle: 'object-style',
          frameStyle: 'callout-frame',
          tableStyle: 'default-table',
          genericStyle: 'generic-style',
          displayName: 'Synth Callout',
          paragraphStyleDisplayName: 'body',
          characterStyleDisplayName: 'emphasis',
          objectStyleDisplayName: 'Object Style',
          frameStyleDisplayName: 'Callout Frame',
          tableStyleDisplayName: 'default-table',
          synthesizedToken: 'synth-callout',
          synthesizedName: 'Synth Callout',
        },
        labels: [{
          protocol: 'html_indesign',
          version: 1,
          kind: 'item',
          id: 'item-1',
          source: 'indesign-reverse',
          semantic: 'title',
          role: 'text',
          htmlTag: 'p',
          layout: {
            grid: { col: 1, span: 4, row: 1, rowSpan: 1 },
          },
        }],
      }, {
        id: 'table-1',
        type: 'TextFrame',
        text: '',
        bounds: { x: 20, y: 20, width: 60, height: 30 },
        styleRefs: { cellStyle: 'cell-body' },
        table: {
          rowCount: 1,
          columnCount: 1,
          columnWidths: [60],
          rowHeights: [30],
          rows: [{
            index: 0,
            header: true,
            cells: [{
              index: 0,
              text: 'Area',
              header: false,
              rowSpan: 1,
              colSpan: 1,
              paragraphStyle: null,
              cellStyle: 'cell-body',
              fillColor: null,
              fillOpacity: 80,
              borderColor: '#cccccc',
              borderWeight: 1,
              textColor: null,
              bounds: { x: 20, y: 20, width: 60, height: 30 },
              pointSize: null,
              leading: null,
              textAlign: 'left',
              padding: { top: 0, right: 0, bottom: 0, left: 0 },
              paddingUnit: 'pt',
              borders: {
                top: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                right: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                bottom: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
                left: { color: null, widthPt: 0, widthCss: '0px', style: 'none', borderWeight: 0 },
              },
              runs: [{
                text: 'Area',
                tagName: 'span',
                classList: ['table-run'],
                attributes: { 'data-id-character-style': 'emphasis' },
                characterStyle: 'emphasis',
              }],
            }],
          }],
        },
        labels: [{
          protocol: 'html_indesign',
          version: 1,
          kind: 'item',
          id: 'table-1',
          source: 'indesign-reverse',
          semantic: 'metrics-table',
          role: 'table',
        }],
      }],
    }],
    parentPages: [{
      name: 'A-Parent',
        labels: [{ protocol: 'html_indesign', version: 1, kind: 'parentPage', id: 'A-Parent', displayName: 'A-Parent', source: 'indesign-reverse' }],
      items: [{
        id: 'parent-rule',
        type: 'TextFrame',
        text: 'Parent',
        bounds: { x: 0, y: 90, width: 100, height: 1 },
        labels: [{ protocol: 'html_indesign', version: 1, kind: 'item', id: 'parent-rule', role: 'text', source: 'indesign-reverse' }],
      }],
    }],
    layers: [{
      name: 'Layer 1',
      visible: true,
      printable: true,
      locked: false,
      labels: [{ protocol: 'html_indesign', version: 1, kind: 'layer', token: 'Layer 1', displayName: 'Layer 1', source: 'indesign-reverse' }],
    }],
    styles: {
      paragraphStyles: [
        {
          name: 'body',
          safeName: 'body',
          css: 'font-size: 12pt;',
          source: 'indesign-reverse',
          composer: 'Adobe Paragraph Composer',
          labels: [{ protocol: 'html_indesign', version: 1, kind: 'style', id: 'body', token: 'body', displayName: 'body', styleKind: 'paragraphStyles', source: 'indesign-reverse' }],
        },
      ],
      characterStyles: [
        {
          name: 'emphasis',
          safeName: 'emphasis',
          css: 'font-weight: 600;',
          source: 'indesign-reverse',
          labels: [{ protocol: 'html_indesign', version: 1, kind: 'style', id: 'emphasis', token: 'emphasis', displayName: 'emphasis', styleKind: 'characterStyles', source: 'indesign-reverse' }],
        },
      ],
      objectStyles: [
        {
          name: '自动对象-21251102',
          safeName: 'object-style',
          css: 'stroke: #999999;',
          source: 'indesign-reverse',
          labels: [{ protocol: 'html_indesign', version: 1, kind: 'style', id: '自动对象-21251102', token: '自动对象-21251102', displayName: '自动对象-21251102', styleKind: 'objectStyles', source: 'indesign-reverse' }],
        },
      ],
      tableStyles: [
        {
          name: 'default-table',
          safeName: 'default-table',
          css: 'border-collapse: collapse;',
          source: 'indesign-reverse',
          labels: [{ protocol: 'html_indesign', version: 1, kind: 'style', id: 'default-table', token: 'default-table', displayName: 'default-table', styleKind: 'tableStyles', source: 'indesign-reverse' }],
        },
      ],
      cellStyles: [
        {
          name: 'cell-body',
          safeName: 'cell-body',
          css: 'padding: 0;',
          source: 'indesign-reverse',
          labels: [{ protocol: 'html_indesign', version: 1, kind: 'style', id: 'cell-body', token: 'cell-body', displayName: 'cell-body', styleKind: 'cellStyles', source: 'indesign-reverse' }],
        },
      ],
      frameStyles: [
        {
          name: 'Callout Frame',
          safeName: 'callout-frame',
          css: 'object-fit: contain;',
          source: 'indesign-reverse',
          fit: 'contain',
          position: '50% 50%',
          inset: { top: 1, right: 1, bottom: 1, left: 1 },
          overflow: 'hidden',
          labels: [{ protocol: 'html_indesign', version: 1, kind: 'style', id: 'callout-frame', token: 'callout-frame', displayName: 'Callout Frame', styleKind: 'frameStyles', source: 'indesign-reverse' }],
        },
      ],
    },
    assets: [{ kind: 'image', path: '\\\\nas\\share\\sample.png' }],
  };
}

function formatCanRead(entry, format) {
  const capability = entry.capabilities && entry.capabilities[format];
  return capability && ['native', 'lossless'].includes(capability.read);
}

function adapterComparableModelPaths(fieldEntries) {
  return new Set(
    fieldEntries
      .filter((entry) => entry.fieldClass === 'canonical')
      .filter((entry) => formatCanRead(entry, 'html') && formatCanRead(entry, 'indesign'))
      .map((entry) => entry.canonicalPath),
  );
}

function adapterFile(adapter) {
  return adapter === 'html'
    ? 'src/adapters/html/normalizer/snapshot-to-model.js'
    : 'src/adapters/indesign/normalizer/snapshot-to-model.js';
}

function throws(fn) {
  try {
    fn();
    return false;
  } catch (_error) {
    return true;
  }
}

function makeSampleProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g3-'));
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

function dedupeViolations(violations) {
  return [...new Map(violations.map((violation) => [JSON.stringify(violation), violation])).values()];
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function violationKey(violation) {
  return JSON.stringify({
    rule: violation.rule,
    file: violation.file,
    detail: violation.detail,
  });
}

function baselineExemptions(baseline) {
  return Array.isArray(baseline) ? baseline : baseline.exemptions || [];
}

function formatG3Failure(result) {
  const failingRules = new Set([
    ...(result.newViolations || []).map((violation) => violation.rule),
    ...(result.expiredExemptions || []).map((violation) => violation.rule),
  ]);

  return [...failingRules].sort().map((rule) => {
    const metadata = G3_RULE_METADATA[rule];
    if (!metadata) throw new Error(`Missing G3 failure metadata for ${rule}`);
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
