const { buildInstructions } = require('./builder');
const { validate, ERRORS } = require('./validator');

module.exports = {
  buildInstructions,
  validate,
  ERRORS,
};
