const FIELD_CLASSES = new Set([
  'canonical',
  'sourceMetadata',
  'formatExtension',
  'observation',
]);

const LIFECYCLES = new Set([
  'active',
  'candidate',
  'deprecated',
  'retired',
]);

function isFieldClass(value) {
  return FIELD_CLASSES.has(value);
}

function isLifecycle(value) {
  return LIFECYCLES.has(value);
}

module.exports = {
  FIELD_CLASSES,
  LIFECYCLES,
  isFieldClass,
  isLifecycle,
};
