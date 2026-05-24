const { renderSnapshot } = require('./browser-snapshot');
const { compileStyles } = require('./style-compiler');
const { compileInstructions } = require('./instructions-compiler');

module.exports = {
  renderSnapshot,
  compileStyles,
  compileInstructions,
};
