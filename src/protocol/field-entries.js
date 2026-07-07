const { createFieldRegistry } = require('./registry');

const rawFieldEntries = [
  ...require('./fields/document-page'),
  ...require('./fields/document-model'),
  ...require('./fields/styles'),
  ...require('./fields/assets'),
  ...require('./fields/html-authoring'),
  ...require('./fields/labels'),
  ...require('./fields/source-metadata'),
  ...require('./fields/visual-style'),
  ...require('./fields/vector-geometry'),
  ...require('./fields/text'),
  ...require('./fields/table'),
  ...require('./fields/observation'),
  ...require('./fields/reverse-surfaces'),
  ...require('./fields/reverse-diagnostics'),
  ...require('./fields/retired'),
  ...require('./fields/pptx-extensions'),
];

const fieldRegistry = createFieldRegistry(rawFieldEntries);
const fieldEntries = fieldRegistry.entries;

module.exports = Object.freeze({
  fieldEntries,
  fieldRegistry,
  rawFieldEntries,
});
