'use strict';

const { blendModeCss, normalizeBlendMode } = require('../../shared/blend-mode');

function cssBlendMode(value) {
  return normalizeBlendMode(value);
}

module.exports = {
  blendModeCss,
  cssBlendMode,
};
