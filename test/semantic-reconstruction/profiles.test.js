const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CANONICAL_ALGORITHM_ORDER,
  resolveReconstructionProfile,
} = require('../../src/semantic-reconstruction');

test('reconstruction profile defaults to explicit none and keeps safe empty before 0F', () => {
  assert.deepEqual(resolveReconstructionProfile({}), {
    name: 'none',
    algorithms: [],
  });
  assert.deepEqual(resolveReconstructionProfile({ profile: 'safe' }), {
    name: 'safe',
    algorithms: [],
  });
});

test('experimental profile adds dependencies, removes duplicates and uses canonical order', () => {
  const profile = resolveReconstructionProfile({
    profile: 'experimental',
    algorithms: ['text-block', 'figure-grid', 'caption-structure', 'figure-grid'],
  });

  assert.deepEqual(CANONICAL_ALGORITHM_ORDER, [
    'page-object-graph',
    'caption-structure',
    'figure-grid',
    'text-block',
    'reading-order-lite',
  ]);
  assert.deepEqual(profile, {
    name: 'experimental',
    algorithms: ['page-object-graph', 'caption-structure', 'figure-grid', 'text-block'],
  });
});

test('experimental profile always places reading-order-lite after selected structure passes', () => {
  assert.deepEqual(resolveReconstructionProfile({
    profile: 'experimental',
    algorithms: ['reading-order-lite', 'text-block', 'caption-structure'],
  }).algorithms, [
    'page-object-graph',
    'caption-structure',
    'text-block',
    'reading-order-lite',
  ]);
});

test('reconstruction profile rejects unknown names and algorithms', () => {
  assert.throws(
    () => resolveReconstructionProfile({ profile: 'automatic' }),
    /Unknown reconstruction profile: automatic/,
  );
  assert.throws(
    () => resolveReconstructionProfile({ profile: 'experimental', algorithms: ['unknown-pass'] }),
    /Unknown semantic reconstruction algorithm: unknown-pass/,
  );
});

test('only experimental accepts an explicit algorithm list', () => {
  assert.throws(
    () => resolveReconstructionProfile({ profile: 'none', algorithms: ['text-block'] }),
    /only valid with the experimental profile/,
  );
  assert.throws(
    () => resolveReconstructionProfile({ profile: 'safe', algorithms: ['text-block'] }),
    /only valid with the experimental profile/,
  );
  assert.throws(
    () => resolveReconstructionProfile({ profile: 'experimental', algorithms: [] }),
    /requires at least one algorithm/,
  );
});
