const DEFAULT_RECONSTRUCTION_PROFILE = 'safe';
const RECONSTRUCTION_PROFILE_NAMES = Object.freeze(['none', 'safe', 'experimental']);

const CANONICAL_ALGORITHM_ORDER = Object.freeze([
  'page-object-graph',
  'caption-structure',
  'figure-grid',
  'text-block',
  'reading-order-lite',
]);

const ALGORITHM_DEPENDENCIES = Object.freeze({
  'page-object-graph': Object.freeze([]),
  'caption-structure': Object.freeze(['page-object-graph']),
  'figure-grid': Object.freeze(['caption-structure']),
  'text-block': Object.freeze([]),
  'reading-order-lite': Object.freeze([]),
});

const SAFE_ALGORITHMS = Object.freeze([...CANONICAL_ALGORITHM_ORDER]);
const PROFILE_NAMES = new Set(RECONSTRUCTION_PROFILE_NAMES);
const ALGORITHM_NAMES = new Set(CANONICAL_ALGORITHM_ORDER);

function resolveReconstructionProfile(options = {}) {
  const name = String(options.profile || DEFAULT_RECONSTRUCTION_PROFILE).trim();
  if (!PROFILE_NAMES.has(name)) {
    throw new Error(`Unknown reconstruction profile: ${name}`);
  }
  const requested = normalizeRequestedAlgorithms(options.algorithms);
  if (name !== 'experimental' && requested.length) {
    throw new Error('An explicit reconstruction algorithm list is only valid with the experimental profile');
  }
  if (name === 'experimental' && !requested.length) {
    throw new Error('The experimental reconstruction profile requires at least one algorithm');
  }
  const selected = name === 'safe' ? SAFE_ALGORITHMS : requested;
  return {
    name,
    algorithms: orderedDependencyClosure(selected),
  };
}

function assertResolvedReconstructionProfile(value) {
  if (!value || typeof value !== 'object' || typeof value.name !== 'string' || !Array.isArray(value.algorithms)) {
    throw new Error('compileReverseSnapshotToHtml requires an explicit resolved reconstructionProfile');
  }
  const resolved = resolveReconstructionProfile({
    profile: value.name,
    algorithms: value.name === 'experimental' ? value.algorithms : undefined,
  });
  if (JSON.stringify(value.algorithms) !== JSON.stringify(resolved.algorithms)) {
    throw new Error('reconstructionProfile algorithms must be dependency-complete, unique, and canonically ordered');
  }
  return resolved;
}

function normalizeRequestedAlgorithms(algorithms) {
  if (algorithms == null) return [];
  if (!Array.isArray(algorithms)) {
    throw new Error('Semantic reconstruction algorithms must be an array');
  }
  const normalized = algorithms.map((algorithm) => String(algorithm || '').trim()).filter(Boolean);
  for (const algorithm of normalized) {
    if (!ALGORITHM_NAMES.has(algorithm)) {
      throw new Error(`Unknown semantic reconstruction algorithm: ${algorithm}`);
    }
  }
  return normalized;
}

function orderedDependencyClosure(algorithms) {
  const selected = new Set();
  const addWithDependencies = (algorithm) => {
    for (const dependency of ALGORITHM_DEPENDENCIES[algorithm] || []) addWithDependencies(dependency);
    selected.add(algorithm);
  };
  for (const algorithm of algorithms) addWithDependencies(algorithm);
  return CANONICAL_ALGORITHM_ORDER.filter((algorithm) => selected.has(algorithm));
}

module.exports = {
  DEFAULT_RECONSTRUCTION_PROFILE,
  RECONSTRUCTION_PROFILE_NAMES,
  CANONICAL_ALGORITHM_ORDER,
  ALGORITHM_DEPENDENCIES,
  SAFE_ALGORITHMS,
  resolveReconstructionProfile,
  assertResolvedReconstructionProfile,
};
