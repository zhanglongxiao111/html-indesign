const fs = require('fs');
const { removeFileWithRetrySync, writeFileAtomicSync } = require('../shared/atomic-write');
const { GENERATED_COMMENT, assembleAuthorPackage, authorEntryWriteOptions } = require('./source-package');
const {
  configPresentationSize,
  presentationPathFor,
  readPresentationSize,
  writeRevealPresentation,
} = require('./reveal-presentation');

// 组装作者包：原子覆写 deck.html（字节未变时跳过落盘），并同步包里已有的 presentation.html。
// options.syncPresentation === false 时跳过预览同步（反向导出随后会自行写 presentation.html）。
// options.writeOptions 透传给原子写（测试注入 fs / sleep / 重试参数）。
function writeAuthorPackageEntry(configPath, options = {}) {
  const { html, sourcePackage } = assembleAuthorPackage(configPath);
  const fileSystem = (options.writeOptions && options.writeOptions.fs) || fs;
  if (!hasIdenticalFileContent(sourcePackage.entryPath, html, fileSystem)) {
    writeFileAtomicSync(sourcePackage.entryPath, html, authorEntryWriteOptions(options.writeOptions));
  }
  const assembledFragments = extractAssembledFragments(html);
  const presentation = options.syncPresentation === false
    ? { path: presentationPathFor(sourcePackage.rootDir), status: 'skipped' }
    : syncRevealPresentation(sourcePackage, { ...options, assembledFragments });
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

  let existingPresentationBuffer = null;
  try {
    existingPresentationBuffer = fileSystem.readFileSync(presentationPath);
  } catch (_error) {
    existingPresentationBuffer = null;
  }

  const size = presentationSizeFor(sourcePackage.config, existingPresentationBuffer);
  const assembledFragments = options.assembledFragments || null;
  try {
    const written = writeRevealPresentation(sourcePackage.configPath, {
      sourcePackage,
      ...(assembledFragments ? { stylesHtml: assembledFragments.stylesHtml, pagesHtml: assembledFragments.pagesHtml } : {}),
      ...(existingPresentationBuffer !== null ? { existingHtmlBuffer: existingPresentationBuffer } : {}),
      ...(size.source === 'existing-presentation' ? { width: size.width, height: size.height } : {}),
      writeOptions: options.writeOptions,
    });
    return {
      path: presentationPath,
      status: written.unchanged ? 'unchanged' : 'rewritten',
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
function presentationSizeFor(config, existingPresentationBuffer) {
  const configured = configPresentationSize(config);
  if (configured) return configured;
  if (existingPresentationBuffer != null) {
    const existingText = Buffer.isBuffer(existingPresentationBuffer)
      ? existingPresentationBuffer.toString('utf8')
      : String(existingPresentationBuffer);
    const existing = readPresentationSize(existingText);
    if (existing) return { ...existing, source: 'existing-presentation' };
  }
  return { source: 'default' };
}

function hasIdenticalFileContent(filePath, content, fileSystem) {
  try {
    const existing = fileSystem.readFileSync(filePath);
    const existingBuf = Buffer.isBuffer(existing) ? existing : Buffer.from(String(existing), 'utf8');
    return existingBuf.equals(Buffer.from(content, 'utf8'));
  } catch (_error) {
    return false;
  }
}

function extractAssembledFragments(html) {
  const commentMarker = `  ${GENERATED_COMMENT}\n`;
  const commentIndex = html.indexOf(commentMarker);
  if (commentIndex === -1) return null;
  const stylesStart = commentIndex + commentMarker.length;
  const headCloseMarker = '\n</head>\n<body>\n';
  const headCloseIndex = html.indexOf(headCloseMarker, stylesStart);
  if (headCloseIndex === -1) return null;
  const stylesHtml = html.slice(stylesStart, headCloseIndex);

  const mainOpenIndex = html.indexOf('  <main class="deck" ', headCloseIndex);
  if (mainOpenIndex === -1) return null;
  const pagesStartMarker = '>\n';
  const pagesStartIndex = html.indexOf(pagesStartMarker, mainOpenIndex);
  if (pagesStartIndex === -1) return null;
  const pagesStart = pagesStartIndex + pagesStartMarker.length;

  const mainCloseMarker = '\n  </main>\n</body>\n</html>\n';
  const pagesEnd = html.lastIndexOf(mainCloseMarker);
  if (pagesEnd === -1 || pagesEnd < pagesStart) return null;
  const indentedPages = html.slice(pagesStart, pagesEnd);
  const pagesHtml = indentedPages
    .split('\n')
    .map((line) => (line.startsWith('    ') ? line.slice(4) : line))
    .join('\n');
  return { stylesHtml, pagesHtml };
}

module.exports = {
  syncRevealPresentation,
  writeAuthorPackageEntry,
};
