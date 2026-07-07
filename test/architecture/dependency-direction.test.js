const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');
const { formatGuardrailFailure } = require('./helpers/guardrail-report');
const { collectRequireGraph } = require('./helpers/require-graph');

const SPEC_PATH = 'docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md#G1';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'baselines', 'G1.json');
const ROOT_PUBLIC_ENTRYPOINTS = ['index.js'];
const G1_RULE_METADATA = {
  'G1.0 static require graph': {
    reason: 'Dependency direction guardrails require statically resolved local require edges.',
    remediation: 'Replace dynamic relative require calls with static local require calls or move the variability behind an existing public entry.',
  },
  'G1.1 adapters-writers direction': {
    reason: 'Format adapters and writers must stay separated by the semantic model layer.',
    remediation: 'Move cross-format orchestration into semantic-model, shared, or a higher-level pipeline instead of requiring across layers.',
  },
  'G1.2 shared truth layers stay upstream': {
    reason: 'Shared truth layers must not depend on downstream format or reconstruction layers.',
    remediation: 'Move downstream behavior out of semantic-model, protocol, or shared and keep those modules as upstream facts.',
  },
  'G1.3 src must not require scripts': {
    reason: 'Runtime src modules must not depend on command wrapper scripts.',
    remediation: 'Move reusable script logic behind a src public module entry and leave scripts as command wrappers.',
  },
  'G1.4 semantic-reconstruction dependencies': {
    reason: 'Semantic reconstruction may only depend on its own layer, semantic-model, protocol, or shared.',
    remediation: 'Route semantic reconstruction through its own layer, semantic-model, protocol, or shared instead of local downstream or root entries.',
  },
  'G1.5 plugin uses public module entries': {
    reason: 'Plugin tools must cross into implementation modules only through public src entries.',
    remediation: 'Require public src module entries from plugin tools instead of deep internal implementation files.',
  },
  'G1.6 no dependency cycles': {
    reason: 'The local architecture dependency graph must remain acyclic.',
    remediation: 'Break the cycle by moving shared facts upstream or inverting the dependency through an existing public boundary.',
  },
};

function makeSampleProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-g1-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  return root;
}

test('G1 catches an adapters to writers require sample and reports the required fields', () => {
  const root = makeSampleProject({
    'src/adapters/html/example.js': "module.exports = require('../../writers/indesign/style-compiler');\n",
    'src/writers/indesign/style-compiler.js': 'module.exports = {};\n',
  });

  const violations = collectG1Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G1.1 adapters-writers direction',
      file: 'src/adapters/html/example.js',
      detail: 'requires src/writers/indesign/style-compiler.js',
    },
  ]);

  const message = formatG1Failure({
    newViolations: violations,
    expiredExemptions: [],
  });

  assert.match(message, /Rule: G1\.1 adapters-writers direction/);
  assert.match(message, /Reason: Format adapters and writers must stay separated by the semantic model layer\./);
  assert.match(message, /Remediation: Move cross-format orchestration into semantic-model, shared, or a higher-level pipeline instead of requiring across layers\./);
  assert.match(message, new RegExp(`Spec: ${escapeRegExp(SPEC_PATH)}`));
});

test('G1.4 catches semantic-reconstruction requires to local root public entries', () => {
  const root = makeSampleProject({
    'index.js': 'module.exports = {};\n',
    'src/semantic-reconstruction/reconstruct.js': "module.exports = require('../../index.js');\n",
  });

  const violations = collectG1Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G1.4 semantic-reconstruction dependencies',
      file: 'src/semantic-reconstruction/reconstruct.js',
      detail: 'requires index.js',
    },
  ]);

  const message = formatG1Failure({
    newViolations: violations,
    expiredExemptions: [],
  });

  assert.match(message, /Rule: G1\.4 semantic-reconstruction dependencies/);
  assert.match(message, /Reason: Semantic reconstruction may only depend on its own layer, semantic-model, protocol, or shared\./);
  assert.doesNotMatch(message, /Move cross-format orchestration into semantic-model/);
});

test('G1.6 catches dependency cycles through local root public entries', () => {
  const root = makeSampleProject({
    'index.js': "module.exports = require('./src/semantic-model/model');\n",
    'src/semantic-model/model.js': "module.exports = require('../../index.js');\n",
  });

  const violations = collectG1Violations(root);

  assert.deepEqual(violations, [
    {
      rule: 'G1.6 no dependency cycles',
      file: 'index.js',
      detail: 'cycle index.js -> src/semantic-model/model.js -> index.js',
    },
  ]);

  const message = formatG1Failure({
    newViolations: violations,
    expiredExemptions: [],
  });

  assert.match(message, /Rule: G1\.6 no dependency cycles/);
  assert.match(message, /Reason: The local architecture dependency graph must remain acyclic\./);
  assert.doesNotMatch(message, /Move cross-format orchestration into semantic-model/);
});

test('G1 failure reports describe every failing subrule family', () => {
  const message = formatG1Failure({
    newViolations: [
      {
        rule: 'G1.3 src must not require scripts',
        file: 'src/example.js',
        detail: 'requires scripts/example.js',
      },
      {
        rule: 'G1.5 plugin uses public module entries',
        file: 'src/indesign-cli-plugin/tools/example.js',
        detail: 'requires internal module src/authoring/lint.js',
      },
    ],
    expiredExemptions: [
      {
        rule: 'G1.4 semantic-reconstruction dependencies',
        file: 'src/semantic-reconstruction/example.js',
        detail: 'requires index.js',
      },
      {
        rule: 'G1.6 no dependency cycles',
        file: 'index.js',
        detail: 'cycle index.js -> src/example.js -> index.js',
      },
    ],
  });

  assert.match(message, /Rule: G1\.3 src must not require scripts/);
  assert.match(message, /Rule: G1\.4 semantic-reconstruction dependencies/);
  assert.match(message, /Rule: G1\.5 plugin uses public module entries/);
  assert.match(message, /Rule: G1\.6 no dependency cycles/);
  assert.match(message, /Remediation: Move reusable script logic behind a src public module entry and leave scripts as command wrappers\./);
  assert.match(message, /Remediation: Route semantic reconstruction through its own layer, semantic-model, protocol, or shared instead of local downstream or root entries\./);
  assert.match(message, /Remediation: Require public src module entries from plugin tools instead of deep internal implementation files\./);
  assert.match(message, /Remediation: Break the cycle by moving shared facts upstream or inverting the dependency through an existing public boundary\./);
  assert.doesNotMatch(message, /Rule: G1 dependency direction/);
});

test('G1 current dependency direction violations match the ratchet baseline', () => {
  const actualViolations = collectG1Violations(REPO_ROOT);
  const baseline = readJson(BASELINE_PATH);
  const result = compareViolationsToBaseline({ actualViolations, baseline });

  if (!result.passed) {
    throw new Error(formatG1Failure(result));
  }
});

function collectG1Violations(repoRoot) {
  const rootDirs = ['src', 'scripts']
    .map((relativePath) => path.join(repoRoot, relativePath))
    .filter((rootDir) => fs.existsSync(rootDir));
  const graph = collectLocalRequireGraph(repoRoot, rootDirs);
  const violations = [];

  for (const observation of graph.observations) {
    violations.push({
      rule: 'G1.0 static require graph',
      file: repoRelative(repoRoot, observation.from),
      detail: `has dynamic relative require ${observation.expression}`,
    });
  }

  for (const edge of graph.edges) {
    const from = repoRelative(repoRoot, edge.from);
    const to = repoRelative(repoRoot, edge.to);
    violations.push(...violationsForEdge(from, to));
  }

  for (const cycle of findCycles(graph.edges, repoRoot)) {
    violations.push({
      rule: 'G1.6 no dependency cycles',
      file: cycle[0],
      detail: `cycle ${cycle.join(' -> ')}`,
    });
  }

  return sortViolations(dedupeViolations(violations));
}

function violationsForEdge(from, to) {
  const violations = [];

  if (isUnder(from, 'src/adapters') && isUnder(to, 'src/writers')) {
    violations.push({
      rule: 'G1.1 adapters-writers direction',
      file: from,
      detail: `requires ${to}`,
    });
  }
  if (isUnder(from, 'src/writers') && isUnder(to, 'src/adapters')) {
    violations.push({
      rule: 'G1.1 adapters-writers direction',
      file: from,
      detail: `requires ${to}`,
    });
  }

  if (isSharedTruthLayer(from) && isForbiddenTruthLayerTarget(to)) {
    violations.push({
      rule: 'G1.2 shared truth layers stay upstream',
      file: from,
      detail: `requires downstream module ${to}`,
    });
  }

  if (isUnder(from, 'src') && isUnder(to, 'scripts')) {
    violations.push({
      rule: 'G1.3 src must not require scripts',
      file: from,
      detail: `requires ${to}`,
    });
  }

  if (isUnder(from, 'src/semantic-reconstruction') && isForbiddenSemanticReconstructionTarget(to)) {
    violations.push({
      rule: 'G1.4 semantic-reconstruction dependencies',
      file: from,
      detail: `requires ${to}`,
    });
  }

  if (isUnder(from, 'src/indesign-cli-plugin') && isPluginInternalBypass(to)) {
    violations.push({
      rule: 'G1.5 plugin uses public module entries',
      file: from,
      detail: `requires internal module ${to}`,
    });
  }

  return violations;
}

function isSharedTruthLayer(file) {
  return isUnder(file, 'src/semantic-model') || isUnder(file, 'src/protocol') || isUnder(file, 'src/shared');
}

function isForbiddenTruthLayerTarget(file) {
  return ['src/adapters', 'src/writers', 'scripts', 'src/semantic-reconstruction'].some((forbidden) =>
    isUnder(file, forbidden)
  );
}

function isForbiddenSemanticReconstructionTarget(file) {
  if (isUnder(file, 'src/semantic-reconstruction')) {
    return false;
  }
  return ![
    'src/semantic-model',
    'src/protocol',
    'src/shared',
  ].some((allowed) => isUnder(file, allowed));
}

function isPluginInternalBypass(file) {
  if (!isUnder(file, 'src') || isUnder(file, 'src/indesign-cli-plugin')) {
    return false;
  }
  return !isPublicModuleEntry(file);
}

function isPublicModuleEntry(file) {
  const parts = file.split('/');
  if (parts.length === 3 && parts[0] === 'src' && parts[2] === 'index.js') {
    return true;
  }
  return (
    parts.length === 4 &&
    parts[0] === 'src' &&
    ['adapters', 'writers'].includes(parts[1]) &&
    parts[3] === 'index.js'
  );
}

function findCycles(edges, repoRoot) {
  const adjacency = new Map();
  for (const edge of edges) {
    const from = repoRelative(repoRoot, edge.from);
    const to = repoRelative(repoRoot, edge.to);
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from).push(to);
    if (!adjacency.has(to)) {
      adjacency.set(to, []);
    }
  }

  const cycles = new Map();
  const visiting = new Set();
  const visited = new Set();

  for (const node of [...adjacency.keys()].sort()) {
    visit(node, []);
  }

  function visit(node, stack) {
    if (visiting.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      cycles.set(canonicalCycle(cycle), cycle);
      return;
    }
    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const next of [...(adjacency.get(node) || [])].sort()) {
      visit(next, stack);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  return [...cycles.values()].sort((a, b) => a.join('\n').localeCompare(b.join('\n')));
}

function collectLocalRequireGraph(repoRoot, rootDirs) {
  const graph = collectRequireGraph(rootDirs);
  const rootEntrypointEdges = collectRootEntrypointEdges(repoRoot);
  return {
    edges: graph.edges.concat(rootEntrypointEdges),
    observations: graph.observations,
  };
}

function collectRootEntrypointEdges(repoRoot) {
  const edges = [];
  for (const relativePath of ROOT_PUBLIC_ENTRYPOINTS) {
    const file = path.join(repoRoot, relativePath);
    if (!fs.existsSync(file)) {
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    for (const request of extractStaticRootEntrypointRequireRequests(source)) {
      if (!request.startsWith('.')) {
        continue;
      }
      edges.push({ from: file, to: createRequire(file).resolve(request) });
    }
  }
  return edges;
}

function extractStaticRootEntrypointRequireRequests(source) {
  const requests = [];
  const requirePattern = /\brequire\s*\(\s*(["'`])([^"'`]*?)\1\s*\)/g;
  for (const match of source.matchAll(requirePattern)) {
    const [, quote, request] = match;
    if (quote === '`' && request.includes('${')) {
      continue;
    }
    requests.push(request);
  }
  return requests;
}

function canonicalCycle(cycle) {
  const openCycle = cycle.slice(0, -1);
  const rotations = openCycle.map((_, index) => openCycle.slice(index).concat(openCycle.slice(0, index)));
  rotations.sort((a, b) => a.join('\n').localeCompare(b.join('\n')));
  return rotations[0].join('\n');
}

function dedupeViolations(violations) {
  const byKey = new Map();
  for (const violation of violations) {
    byKey.set(JSON.stringify(violation), violation);
  }
  return [...byKey.values()];
}

function sortViolations(violations) {
  return violations.sort((a, b) =>
    `${a.rule}\n${a.file}\n${a.detail}`.localeCompare(`${b.rule}\n${b.file}\n${b.detail}`)
  );
}

function isUnder(file, directory) {
  return file === directory || file.startsWith(`${directory}/`);
}

function repoRelative(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function formatG1Failure(result) {
  const failingRules = new Set([
    ...(result.newViolations || []).map((violation) => violation.rule),
    ...(result.expiredExemptions || []).map((violation) => violation.rule),
  ]);

  return [...failingRules]
    .sort()
    .map((rule) => {
      const metadata = metadataForG1Rule(rule);
      return formatGuardrailFailure({
        rule,
        reason: metadata.reason,
        remediation: metadata.remediation,
        specPath: SPEC_PATH,
        newViolations: (result.newViolations || []).filter((violation) => violation.rule === rule),
        expiredExemptions: (result.expiredExemptions || []).filter((violation) => violation.rule === rule),
      });
    })
    .join('\n\n');
}

function metadataForG1Rule(rule) {
  const metadata = G1_RULE_METADATA[rule];
  if (!metadata) {
    throw new Error(`Missing G1 failure metadata for ${rule}`);
  }
  return metadata;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
