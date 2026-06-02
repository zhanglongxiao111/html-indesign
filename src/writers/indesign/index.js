const { semanticModelToInstructions } = require('./instruction-writer');
const { compileStyles } = require('./style-compiler');
const { compileInstructions } = require('./instructions-compiler');
const { validateInstructions } = require('./instructions-validator');

module.exports = {
  semanticModelToInstructions,
  compileStyles,
  compileInstructions,
  validateInstructions,
};
