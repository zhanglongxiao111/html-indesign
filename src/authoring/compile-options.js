const path = require('path');
const { resolveSemanticPreset, presetToStyleNameMap } = require('../semantic-preset');

// 作者包 -> 编译选项的唯一来源。html.compile_instructions / html.build_indesign 的 compile 阶段
// 与 lint 的编译预检都从这里取，不得各自再写一份字面量（#25）。
const DEFAULT_COMPILE_UNIT_MODE = 'presentation';
const DEFAULT_COMPILE_TARGET_SIZE = 'same';

// compileDocument（snapshotToSemanticModel + semanticModelToInstructions）的选项。
// 没有作者包时（只有 htmlPath）拿不到项目语义库，styleNameMap 缺省。
function compileDocumentOptions({ unitMode, targetSize, styleNameMap } = {}) {
  return {
    mode: 'editable-first',
    unitMode: unitMode || DEFAULT_COMPILE_UNIT_MODE,
    targetSize: targetSize || DEFAULT_COMPILE_TARGET_SIZE,
    ...(styleNameMap ? { styleNameMap } : {}),
    preserveObservedLayerNames: false,
  };
}

// args 只认 unitMode / targetSize（compile 工具参数）；lint 不传，走默认值。
// resolvedPreset 可由调用方传入已解析的语义库，避免重复读盘。
function authorPackageCompileOptions(sourcePackage, args = {}, resolvedPreset = null) {
  const preset = resolvedPreset || resolveSemanticPreset({
    rootDir: sourcePackage.rootDir,
    config: sourcePackage.config,
  });
  return {
    document: compileDocumentOptions({
      unitMode: args.unitMode,
      targetSize: args.targetSize,
      styleNameMap: presetToStyleNameMap(preset.preset),
    }),
    instructionValidation: {
      checkAssetFiles: true,
      baseDir: path.dirname(sourcePackage.entryPath),
    },
  };
}

module.exports = {
  DEFAULT_COMPILE_TARGET_SIZE,
  DEFAULT_COMPILE_UNIT_MODE,
  authorPackageCompileOptions,
  compileDocumentOptions,
};
