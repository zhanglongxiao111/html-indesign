'use strict';

const fs = require('fs');
const path = require('path');
const { loadAuthorPackageConfig, writeAuthorPackageConfig } = require('../authoring/source-package');
const { SemanticPresetError } = require('./errors');
const { loadStandardSemanticPreset } = require('./loader');

function initProjectSemanticPreset(options = {}) {
  if (!options.packagePath) {
    throw new SemanticPresetError('AUTHOR_PACKAGE_CONFIG_MISSING', 'Authoring package config path is required');
  }

  const packagePath = path.resolve(options.packagePath);
  const loadedPackage = loadAuthorPackageConfig(packagePath);
  const rootDir = loadedPackage.rootDir;
  const outRelative = options.out || 'semantic-preset.json';
  const outPath = path.resolve(rootDir, outRelative);
  assertInside(rootDir, outPath);

  if (fs.existsSync(outPath) && !options.force) {
    throw new SemanticPresetError(
      'SEMANTIC_PRESET_EXISTS',
      'Project semantic preset already exists; pass --force to overwrite',
      { outPath }
    );
  }

  const standard = loadStandardSemanticPreset(options.profile || loadedPackage.config.profile || 'architecture-report');
  fs.writeFileSync(outPath, `${JSON.stringify(standard.preset, null, 2)}\n`, 'utf8');

  const config = Object.assign({}, loadedPackage.config, {
    semanticPreset: path.relative(rootDir, outPath).replace(/\\/g, '/'),
  });
  writeAuthorPackageConfig(packagePath, config);

  return {
    ok: true,
    files: {
      configPath: packagePath,
      presetPath: outPath,
    },
    preset: {
      source: 'project',
      id: standard.preset.id,
      relativePath: config.semanticPreset,
    },
  };
}

function assertInside(rootDir, filePath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(filePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new SemanticPresetError('SEMANTIC_PRESET_OUTSIDE_PACKAGE', 'Preset output must stay inside the author package root', {
      rootDir: root,
      outPath: target,
    });
  }
}

module.exports = { initProjectSemanticPreset };
