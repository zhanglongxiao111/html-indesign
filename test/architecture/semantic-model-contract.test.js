const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

test('G3 reports registry comparable paths missing from both adapter sample collectors', () => {
  const root = makeSampleProject({
    'src/protocol/index.js': [
      'const fieldEntries = [{',
      '  fieldClass: "canonical",',
      '  allPaths: ["document.id", "document.uncoveredRegistryPath"],',
      '  capabilities: { html: { read: "full" }, indesign: { read: "full" } },',
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

test('G3 current semantic model contract violations match the ratchet baseline', () => {
  const actualViolations = collectG3Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG3Failure(result));
  }
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
  const registryPaths = new Set(fieldEntries.flatMap((entry) => entry.allPaths));
  const comparablePaths = new Set(
    fieldEntries
      .filter((entry) => entry.fieldClass !== 'formatExtension')
      .filter((entry) => formatCanRead(entry, 'html') && formatCanRead(entry, 'indesign'))
      .flatMap((entry) => entry.allPaths),
  );
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
    } else if (source[index] === '{') {
      blockDepth += 1;
      index += 1;
    } else if (source[index] === '}') {
      blockDepth = Math.max(0, blockDepth - 1);
      index += 1;
    } else if (blockDepth === 0 && (isIdentifierAt(source, index, 'return') || isIdentifierAt(source, index, 'throw'))) {
      return false;
    } else if (blockDepth === 0 && isIdentifierAt(source, index, calleeName) && isDirectCallAt(source, index, calleeName)) {
      return true;
    } else {
      index += 1;
    }
  }
  return false;
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
    pages: [{
      id: 'page-1',
      index: 0,
      width: 100,
      height: 100,
      attributes: { 'data-page': 'page-1', 'data-id-semantic': 'cover' },
      items: [{
        id: 'item-1',
        role: 'text',
        tagName: 'p',
        text: 'Hello',
        attributes: { 'data-id-semantic': 'title' },
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        computedStyle: {},
      }],
    }],
    styles: {},
    assets: [],
  };
}

function sampleReverseSnapshot() {
  return {
    metadata: { mode: 'observation' },
    document: {
      name: 'sample.indd',
      labels: [{ kind: 'document', id: 'sample', title: 'sample', unitMode: 'presentation', coordinateUnit: 'pt' }],
    },
    pages: [{
      id: 'page-1',
      index: 0,
      bounds: { width: 100, height: 100 },
      labels: [{ kind: 'page', id: 'page-1', semantic: 'cover' }],
      items: [{
        id: 'item-1',
        type: 'TextFrame',
        text: 'Hello',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        labels: [{ kind: 'item', id: 'item-1', semantic: 'title', role: 'text', htmlTag: 'p' }],
      }],
    }],
    parentPages: [],
    layers: [],
    styles: {},
    assets: [],
  };
}

function formatCanRead(entry, format) {
  const capability = entry.capabilities && entry.capabilities[format];
  return capability && !['unsupported'].includes(capability.read);
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
