'use strict';

class SemanticPresetError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'SemanticPresetError';
    this.code = code;
    this.details = details || {};
  }
}

module.exports = { SemanticPresetError };
