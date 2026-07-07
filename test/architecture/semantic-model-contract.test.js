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
  if (/\bvalidateSemanticModel\s*\(/.test(source)) {
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

  const observedComparablePaths = [...new Set([...surfaces.html, ...surfaces.indesign])]
    .filter((modelPath) => comparablePaths.has(modelPath));
  for (const modelPath of observedComparablePaths) {
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
