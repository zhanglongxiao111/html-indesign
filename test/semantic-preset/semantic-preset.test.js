const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  SemanticPresetError,
  loadStandardSemanticPreset,
  resolveSemanticPreset,
  presetToStyleNameMap,
  collectKnownSemanticTokens,
  validateSemanticPreset,
} = require('../../src/semantic-preset');

test('loads the architecture-report standard semantic preset', () => {
  const loaded = loadStandardSemanticPreset('architecture-report');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'standard');
  assert.equal(loaded.profile, 'architecture-report');
  assert.equal(loaded.preset.id, 'architecture-report');
  assert.equal(path.basename(loaded.filePath), 'semantic-preset.json');
});

test('converts a semantic preset into a style name map', () => {
  const loaded = loadStandardSemanticPreset('architecture-report');
  const styleNameMap = presetToStyleNameMap(loaded.preset);

  assert.equal(styleNameMap.paragraphStyles['cover-title'], '封面标题');
  assert.equal(styleNameMap.objectStyles['drawing-frame'], '图纸图框');
  assert.equal(styleNameMap.layers.drawing, '图纸');
});

test('collects known semantic tokens from style maps and token lists', () => {
  const loaded = loadStandardSemanticPreset('architecture-report');
  const known = collectKnownSemanticTokens(loaded.preset);

  assert.equal(known.paragraphStyles.has('cover-title'), true);
  assert.equal(known.objectStyles.has('metric-card'), true);
  assert.equal(known.layers.has('background'), true);
  assert.equal(known.semantic.has('drawing-sheet'), true);
  assert.equal(known.assets.has('pdf'), true);
  assert.equal(known.fits.has('cover'), true);
  assert.equal(known.crops.has('media'), true);
  assert.equal(known.semanticContainers.has('text-block'), true);
  assert.equal(known.semanticContainers.has('figure-grid'), true);
});

test('validates semantic container token lists', () => {
  const validation = validateSemanticPreset({
    schemaVersion: 1,
    id: 'bad-containers',
    styleNameMap: {},
    tokens: {
      semanticContainers: ['content-grid', ''],
    },
  });

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors.map((error) => error.code), [
    'SEMANTIC_PRESET_TOKEN_INVALID',
  ]);
});

test('validates required semantic preset fields', () => {
  const validation = validateSemanticPreset({
    schemaVersion: 2,
    tokens: {
      assets: ['pdf'],
    },
  });

  assert.equal(validation.valid, false);
  assert.deepEqual(
    validation.errors.map((error) => error.code),
    [
      'SEMANTIC_PRESET_SCHEMA_VERSION_INVALID',
      'SEMANTIC_PRESET_ID_REQUIRED',
      'SEMANTIC_PRESET_STYLE_MAP_REQUIRED',
    ]
  );
});

test('resolves a project semantic preset without merging the standard preset', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-semantic-preset-'));
  const presetPath = path.join(root, 'semantic-preset.json');
  fs.writeFileSync(
    presetPath,
    JSON.stringify({
      schemaVersion: 1,
      id: 'project-only',
      styleNameMap: {
        paragraphStyles: {
          headline: '项目标题',
        },
      },
    }, null, 2),
    'utf8'
  );

  const resolved = resolveSemanticPreset({
    rootDir: root,
    config: {
      profile: 'architecture-report',
      semanticPreset: 'semantic-preset.json',
    },
  });
  const known = collectKnownSemanticTokens(resolved.preset);

  assert.equal(resolved.source, 'project');
  assert.equal(resolved.relativePath, 'semantic-preset.json');
  assert.equal(known.paragraphStyles.has('headline'), true);
  assert.equal(known.paragraphStyles.has('cover-title'), false);
});

test('rejects project semantic presets outside the author package root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-semantic-preset-root-'));

  assert.throws(
    () => resolveSemanticPreset({
      rootDir: root,
      config: {
        profile: 'architecture-report',
        semanticPreset: '../semantic-preset.json',
      },
    }),
    (error) => error instanceof SemanticPresetError && error.code === 'SEMANTIC_PRESET_OUTSIDE_PACKAGE'
  );
});
