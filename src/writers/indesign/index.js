const { semanticModelToInstructions } = require('./instruction-writer');
const { compileStyles } = require('../../style-synthesis');
const { validateInstructions } = require('./instructions-validator');

module.exports = {
  semanticModelToInstructions,
  compileStyles,
  validateInstructions,
};
