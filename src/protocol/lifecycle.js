const FIELD_CLASSES = Object.freeze([
  'canonical',
  'sourceMetadata',
  'formatExtension',
  'observation',
]);

const LIFECYCLES = Object.freeze([
  'active',
  'candidate',
  'deprecated',
  'retired',
]);

const fieldClassSet = new Set(FIELD_CLASSES);
const lifecycleSet = new Set(LIFECYCLES);

function isFieldClass(value) {
  return fieldClassSet.has(value);
}

function isLifecycle(value) {
  return lifecycleSet.has(value);
}

module.exports = {
  FIELD_CLASSES,
  LIFECYCLES,
  isFieldClass,
  isLifecycle,
};
