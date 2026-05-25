const { renderSnapshot } = require('./browser-snapshot');
const { compileStyles } = require('./style-compiler');
const { compileInstructions } = require('./instructions-compiler');
const { validateInstructions } = require('./instructions-validator');
const { validateAuthoringRules } = require('./authoring-validator');

module.exports = {
  renderSnapshot,
  compileStyles,
  compileInstructions,
  validateAuthoringRules,
  validateInstructions,
};
