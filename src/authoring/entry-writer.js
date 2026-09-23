const fs = require('fs');
const { removeFileWithRetrySync, writeFileAtomicSync } = require('../shared/atomic-write');
const { assembleAuthorPackage, authorEntryWriteOptions } = require('./source-package');
const {
  configPresentationSize,
  presentationPathFor,
  readPresentationSize,
  writeRevealPresentation,
} = require('./reveal-presentation');

// 组装作者包：原子覆写 deck.html，并同步包里已有的 presentation.html。
// options.syncPresentation === false 时跳过预览同步（反向导出随后会自行写 presentation.html）。
// options.writeOptions 透传给原子写（测试注入 fs / sleep / 重试参数）。
function writeAuthorPackageEntry(configPath, options = {}) {
  const { html, sourcePackage } = assembleAuthorPackage(configPath);
  writeFileAtomicSync(sourcePackage.entryPath, html, authorEntryWriteOptions(options.writeOptions));
  const presentation = options.syncPresentation === false
    ? { path: presentationPathFor(sourcePackage.rootDir), status: 'skipped' }
    : syncRevealPresentation(sourcePackage, options);
  return { entryPath: sourcePackage.entryPath, presentation };
}

// 只同步已存在的 presentation.html，不新建。重写失败就删掉，不留陈旧的第二份页面真相；
// 删除也失败（例如仍被占用）时抛错，让组装整体失败而不是假成功。
function syncRevealPresentation(sourcePackage, options = {}) {
  const presentationPath = presentationPathFor(sourcePackage.rootDir);
  const fileSystem = (options.writeOptions && options.writeOptions.fs) || fs;
  if (!fileSystem.existsSync(presentationPath)) {
    return { path: presentationPath, status: 'absent' };
  }

  const size = presentationSizeFor(sourcePackage.config, presentationPath, fileSystem);
  try {
    const written = writeRevealPresentation(sourcePackage.configPath, {
      ...(size.source === 'existing-presentation' ? { width: size.width, height: size.height } : {}),
      writeOptions: options.writeOptions,
    });
    return {
      path: presentationPath,
      status: 'rewritten',
      width: written.width,
      height: written.height,
      sizeSource: size.source === 'existing-presentation' ? size.source : written.sizeSource,
    };
  } catch (error) {
    removeFileWithRetrySync(presentationPath, authorEntryWriteOptions(options.writeOptions));
    return {
      path: presentationPath,
      status: 'removed',
      reason: `rewrite failed, removed stale presentation.html: ${error && error.message ? error.message : String(error)}`,
      errorCode: error && error.code ? error.code : null,
    };
  }
}

// 页面尺寸顺序：deck.config.json presentation.width/height → 既有 presentation.html 声明的尺寸
// → writer 默认值。反向导出的 deck.config.json 不带 presentation 字段，首页尺寸只落在预览文件里。
function presentationSizeFor(config, presentationPath, fileSystem) {
  const configured = configPresentationSize(config);
  if (configured) return configured;
  let existing = null;
  try {
    existing = readPresentationSize(fileSystem.readFileSync(presentationPath, 'utf8'));
  } catch (_error) {
    existing = null;
  }
  if (existing) return { ...existing, source: 'existing-presentation' };
  return { source: 'default' };
}

module.exports = {
  syncRevealPresentation,
  writeAuthorPackageEntry,
};
