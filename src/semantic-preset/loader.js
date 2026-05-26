'use strict';

const fs = require('fs');
const path = require('path');
const { SemanticPresetError } = require('./errors');
const { validateSemanticPreset } = require('./schema');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STANDARD_PRESET_ROOT = path.join(REPO_ROOT, 'presets');

function loadSemanticPreset(filePath) {
  const absolutePath = path.resolve(filePath);
  const preset = readJsonFile(absolutePath, 'SEMANTIC_PRESET_NOT_FOUND');
  const validation = validateSemanticPreset(preset, { filePath: absolutePath });
  if (!validation.valid) {
    throw new SemanticPresetError('SEMANTIC_PRESET_INVALID', `Invalid semantic preset: ${absolutePath}`, {
      filePath: absolutePath,
      errors: validation.errors,
    });
  }
  return {
    ok: true,
    source: 'file',
    filePath: absolutePath,
    preset,
    warnings: validation.warnings,
  };
}

function loadStandardSemanticPreset(profile) {
  const id = profile || 'architecture-report';
  const filePath = path.join(STANDARD_PRESET_ROOT, id, 'semantic-preset.json');
  const loaded = loadSemanticPreset(filePath);
  return Object.assign({}, loaded, { source: 'standard', profile: id });
}

function loadProjectSemanticPreset(rootDir, relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    throw new SemanticPresetError('SEMANTIC_PRESET_PATH_REQUIRED', 'Project semantic preset path is required');
  }
  const filePath = path.resolve(rootDir, relativePath);
  assertInside(rootDir, filePath);
  const loaded = loadSemanticPreset(filePath);
  return Object.assign({}, loaded, {
    source: 'project',
    rootDir: path.resolve(rootDir),
    relativePath: slash(relativePath),
  });
}

function resolveSemanticPreset(options = {}) {
  if (options.config && options.config.semanticPreset) {
    return loadProjectSemanticPreset(options.rootDir, options.config.semanticPreset);
  }
  if (options.presetPath) {
    return loadSemanticPreset(options.presetPath);
  }
  return loadStandardSemanticPreset((options.config && options.config.profile) || options.profile || 'architecture-report');
}

function readJsonFile(filePath, code) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new SemanticPresetError(code, `Cannot read semantic preset: ${filePath}`, {
      filePath,
      cause: error.message,
    });
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new SemanticPresetError('SEMANTIC_PRESET_INVALID_JSON', `Invalid semantic preset JSON: ${filePath}`, {
      filePath,
      cause: error.message,
    });
  }
}

function assertInside(rootDir, filePath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(filePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new SemanticPresetError(
      'SEMANTIC_PRESET_OUTSIDE_PACKAGE',
      'Project semantic preset must stay inside the author package root',
      { rootDir: root, filePath: target }
    );
  }
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

module.exports = {
  loadSemanticPreset,
  loadStandardSemanticPreset,
  loadProjectSemanticPreset,
  resolveSemanticPreset,
};
