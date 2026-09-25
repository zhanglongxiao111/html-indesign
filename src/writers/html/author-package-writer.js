const fs = require('fs');
const path = require('path');
const { writeAuthorPackageEntry, writeRevealPresentation } = require('../../authoring');
const {
  fieldRegistry,
  HTML_DATA_ID_ATTRIBUTES,
} = require('../../protocol');
const { writeAuthorCssFiles } = require('./author-css-writer');
const { prepareAuthorAssets } = require('./asset-reference-policy');
const { authorStyleFiles, copySourceCssFiles, planSourceCss } = require('./author-source-css');
const { attrsToHtml, mergeAttributes } = require('./author-attribute-writer');
const { pageItemsToAuthorHtml } = require('./author-html-tree');
const { authorPageStyleVarPairs } = require('./author-reverse-geometry');
const { collectSemanticCandidates } = require('./semantic-candidates');
const {
  layerTokensByDisplayName,
  loadProjectSemanticPreset,
  loadStandardSemanticPreset,
  registerObservedSemanticTokens,
} = require('../../semantic-preset');
const { isUsefulSemantic } = require('./author-render-utils');
const {
  PARENT_PAGE_PASTEBOARD_PLACEMENT,
  filterEffectiveParentPages,
  pageHasEffectiveParentPage,
  parentPageKeySet,
  parentPageWritebackItemId,
} = require('../../semantic-model/parent-pages');
const { boundsIntersectPage } = require('../../shared/geometry');
const { compositeFontsConfig } = require('../../semantic-model/composite-fonts');

const SEMANTIC_ATTR = htmlWriteAttrFromRegistry('items[].semantic');
// 反向导出需要登记新 token、而源码包又没有项目语义库时，包内语义库写在这里。
const PACKAGE_SEMANTIC_PRESET_FILE = 'semantic-preset.json';
// 与 resolveSemanticPreset 的缺省一致：config 没有 profile 时 lint / compile 用这份标准库。
const DEFAULT_SEMANTIC_PROFILE = 'architecture-report';

function writeReverseAuthorPackage(model, options = {}) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('writeReverseAuthorPackage requires a DocumentModel');
  }
  const semanticPreset = activeSemanticPresetFor(model, options);
  const outDir = path.resolve(options.outDir || 'reverse-export/author');
  const sourceRoot = options.sourceRoot ? path.resolve(options.sourceRoot) : null;
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'reports'), { recursive: true });

  const sourceConfig = readSourceConfig(sourceRoot);
  const effectiveParentPages = filterEffectiveParentPages(
    model.parentPages || [],
    model.pages || [],
    hasEffectiveAuthorParentPageContent,
  );
  const effectiveParentPageKeys = parentPageKeySet(effectiveParentPages);
  const pasteboardCarriedParentPages = new Set();
  const pages = pageEntries(model, sourceConfig).map((page) => ({
    ...page,
    authorPage: withCanonicalItemZIndexes(
      pageWithAppliedParentItems(page.modelPage, effectiveParentPages, pasteboardCarriedParentPages),
      model.layers || [],
    ),
  }));
  const sourceCss = planSourceCss(model, { sourceRoot });
  // 源码样式拷回包里时，有源码节点的对象沿用源码 class 定位；否则外框全部按读回 bounds 兜底。
  const sourceLayoutCarried = sourceCss.copiedSet.size > 0;
  // 与 deck.config.json 写出的 unitMode 一致：再次正向构建按它换算表格外框余量。
  const unitMode = authorUnitMode(model, sourceConfig);
  const generatedCss = writeAuthorCssFiles(
    { ...model, pages: pages.map((page) => page.authorPage) },
    { mode: options.mode, sourceLayoutCarried, unitMode },
  );
  const styleFiles = authorStyleFiles({ sourceCss, generatedCss, sourceRoot });
  const assetCopy = prepareAuthorAssets(model, {
    outDir,
    sourceRoot,
    assetPolicy: options.assetPolicy || 'reference',
    nasPublicRoot: options.nasPublicRoot || '/nas',
    assetRoot: (model.sourcePackage && model.sourcePackage.assetRoot) || 'assets',
  });
  const styleResidualReport = {
    removedProperties: 0,
    itemsReduced: 0,
    missingSynthRules: [],
  };
  const synthesizedStyles = effectiveSynthesizedStyles(model, sourceConfig);
  const authorWarnings = [];
  const config = deckConfigFor({ ...model, parentPages: effectiveParentPages }, pages, styleFiles, sourceConfig);
  const vocabulary = packageVocabularyFor(config, sourceConfig, sourceRoot);
  const renderOptions = {
    ...options,
    sourceRoot,
    sourceLayoutCarried,
    unitMode,
    preserveTrustedSource: options.preserveTrustedSource !== false && Boolean(sourceRoot),
    assetPathMap: assetCopy.pathMap,
    effectiveParentPageKeys,
    synthesizedStyles,
    styleResidualReport,
    authorWarnings,
    layerTokenByName: layerTokensByDisplayName(vocabulary.preset),
  };

  for (const [relativePath, css] of Object.entries(generatedCss)) {
    if (sourceCss.copiedSet.has(slash(relativePath))) continue;
    writeText(outDir, relativePath, css);
  }
  copySourceCssFiles(outDir, sourceCss);
  for (const page of pages) {
    writeText(outDir, page.file, pageHtml(page.authorPage, page.file, renderOptions));
  }
  const packagePreset = writePackageSemanticPreset(vocabulary, pages, outDir, config);
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify(config, null, 2), 'utf8');

  const report = authoringReport(model, pages, options, {
    assets: assetCopy.report,
    sourceCss: sourceCss.report,
    styleResidual: styleResidualReport,
    warnings: authorWarnings,
    semanticPreset: packagePreset,
  });
  const semanticCandidates = collectSemanticCandidates(model, semanticPreset);
  fs.writeFileSync(path.join(outDir, 'reports/authoring-report.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reports/inference-report.json'), JSON.stringify(report.inference, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reports/semantic-candidates.json'), JSON.stringify(semanticCandidates, null, 2), 'utf8');
  // presentation.html 紧接着按首页尺寸整份重写，这里不必先同步一遍旧预览。
  writeAuthorPackageEntry(path.join(outDir, 'deck.config.json'), { syncPresentation: false });
  const presentation = writeRevealPresentation(path.join(outDir, 'deck.config.json'), firstPageSize(pages));

  return {
    ok: true,
    outDir,
    configPath: path.join(outDir, 'deck.config.json'),
    entryPath: path.join(outDir, 'deck.html'),
    presentation: presentation.path,
    pages: pages.map((page) => page.file),
    report,
    semanticCandidates,
    warnings: authorWarnings,
    // 原始资源路径（normalizePathKey）到作者 HTML 引用的映射；copy 策略下值是包内相对路径。
    // 反向导出的 content-manifest.json 用它找作者包内的拷贝。
    assetPathMap: assetCopy.pathMap,
    semanticPreset: packagePreset,
  };
}

// 作者包的语义词表就是 lint 与 compile 将要用的那一份（resolveSemanticPreset 的同一口径）：
// 源码包带项目语义库时用它，否则用 config.profile 的标准库（缺省 architecture-report）。
// 图层反查和包内登记都以它为底。
function packageVocabularyFor(config, sourceConfig, sourceRoot) {
  const profile = config.profile || DEFAULT_SEMANTIC_PROFILE;
  if (sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'semanticPreset')) {
    const loaded = loadProjectSemanticPreset(sourceRoot, sourceConfig.semanticPreset);
    return {
      base: 'project',
      relativePath: loaded.relativePath,
      sourceFile: loaded.filePath,
      preset: loaded.preset,
      // 项目语义库的 profile 可以是项目自定义名，没有同名标准库；枚举值的标准口径退回默认标准库。
      canonicalPreset: standardPresetOrNull(profile) || standardPresetOrNull(DEFAULT_SEMANTIC_PROFILE),
    };
  }
  let canonical;
  try {
    canonical = loadStandardSemanticPreset(profile);
  } catch (error) {
    throw semanticPresetLoadFailed(profile, error.message, error);
  }
  return {
    base: 'standard',
    profile,
    relativePath: PACKAGE_SEMANTIC_PRESET_FILE,
    sourceFile: null,
    preset: canonical.preset,
    canonicalPreset: canonical.preset,
  };
}

function standardPresetOrNull(profile) {
  try {
    return loadStandardSemanticPreset(profile).preset;
  } catch (_error) {
    return null;
  }
}

// 写完页面再登记：登记对象就是 lint 会读到的属性值，不必另外推算一遍。
// 源码包的项目语义库没有新增登记时原样拷贝（保持字节一致）；标准库没有新增登记时不写包内语义库，
// 作者包继续按 profile 解析标准库。
function writePackageSemanticPreset(vocabulary, pages, outDir, config) {
  const pageFiles = pages.map((page) => ({ filePath: path.join(outDir, page.file), relativePath: slash(page.file) }));
  const registered = registerObservedSemanticTokens({
    preset: vocabulary.preset,
    canonicalPreset: vocabulary.canonicalPreset,
    pageFiles,
  });
  const summary = {
    base: vocabulary.base,
    ...(vocabulary.profile ? { profile: vocabulary.profile } : {}),
    path: null,
    registered: registered.registrations,
    unresolved: registered.unresolved,
  };
  // unresolved 只记进 authoring-report.json：这些 token 由 lint 以 SEMANTIC_TOKEN_UNKNOWN 报出，
  // 那里带词表和修法，这里不再重复一条 warning。
  if (!registered.registrations.length && vocabulary.base === 'standard') return summary;
  const target = path.resolve(outDir, vocabulary.relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (registered.registrations.length) {
    fs.writeFileSync(target, `${JSON.stringify(registered.preset, null, 2)}\n`, 'utf8');
  } else if (path.resolve(vocabulary.sourceFile) !== target) {
    fs.copyFileSync(vocabulary.sourceFile, target);
  }
  config.semanticPreset = vocabulary.relativePath;
  summary.path = vocabulary.relativePath;
  return summary;
}

function authorUnitMode(model, sourceConfig) {
  return sourceConfig && sourceConfig.unitMode || model.unitMode || 'presentation';
}

function effectiveSynthesizedStyles(model, sourceConfig) {
  if (sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'synthesizedStyles')) {
    return Array.isArray(sourceConfig.synthesizedStyles) ? sourceConfig.synthesizedStyles : [];
  }
  return model.styles && Array.isArray(model.styles.synthesized) ? model.styles.synthesized : [];
}

function firstPageSize(pages) {
  const page = pages && pages[0] && pages[0].authorPage;
  return {
    width: page && page.width,
    height: page && page.height,
  };
}

function activeSemanticPresetFor(model, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'semanticPreset')) {
    if (isNonEmptyObject(options.semanticPreset)) return options.semanticPreset;
    throw semanticPresetLoadFailed(
      'semanticPreset',
      'semanticPreset must be a non-empty object when provided',
    );
  }
  const profile = firstProfile([
    model && model.profile,
    model && model.sourcePackage && model.sourcePackage.profile,
  ]);
  const mode = options.mode || model.reverseMode || 'structured';
  if (!profile) {
    if (mode === 'observation' || mode === 'inferred') return {};
    throw semanticPresetLoadFailed(
      'profile-required',
      'Structured reverse author package requires an explicit semanticPreset or profile',
    );
  }
  try {
    return loadStandardSemanticPreset(profile).preset;
  } catch (error) {
    throw semanticPresetLoadFailed(profile, error.message, error);
  }
}

function isNonEmptyObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
}

function semanticPresetLoadFailed(profile, message, cause) {
  const error = new Error(`SEMANTIC_PRESET_LOAD_FAILED:${profile}:${message}`);
  error.code = 'SEMANTIC_PRESET_LOAD_FAILED';
  error.profile = profile;
  if (cause) error.cause = cause;
  return error;
}

function firstProfile(values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const profile = value.trim();
    if (profile) return profile;
  }
  return null;
}

function deckConfigFor(model, pages, styleFiles, sourceConfig = null) {
  const sourcePackage = model.sourcePackage || {};
  const id = sourceConfig && sourceConfig.id || sourcePackage.id || model.id;
  const title = sourceConfig && sourceConfig.title || sourcePackage.title || model.title || id;
  const hasSourceProfile = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'profile');
  const hasPackageProfile = sourcePackage && Object.prototype.hasOwnProperty.call(sourcePackage, 'profile');
  const hasSourceConfig = Boolean(sourceConfig);
  const hasSourceParentPages = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'parentPages');
  const hasSourceLayers = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'layers');
  const layers = hasSourceConfig
    ? sourceConfig.layers
    : layersConfigFor(model.layers || []);
  const hasSourceCompositeFonts = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'compositeFonts');
  const hasSourceSemanticPreset = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'semanticPreset');
  const compositeFonts = hasSourceConfig
    ? sourceConfig.compositeFonts
    : compositeFontsConfig(model.styles && model.styles.compositeFonts);
  const hasSourceSynthesizedStyles = sourceConfig && Object.prototype.hasOwnProperty.call(sourceConfig, 'synthesizedStyles');
  const parentPages = hasSourceConfig
    ? sourceConfig.parentPages
    : parentPagesConfigFor(model.parentPages || []);
  const synthesizedStyles = hasSourceConfig
    ? sourceConfig.synthesizedStyles
    : synthesizedStylesConfigFor(model.styles && model.styles.synthesized);
  const config = {
    schemaVersion: sourceConfig && sourceConfig.schemaVersion || sourcePackage.schemaVersion || 1,
    id,
    title,
    profile: hasSourceProfile ? sourceConfig.profile : hasPackageProfile ? sourcePackage.profile : model.profile || null,
    unitMode: authorUnitMode(model, sourceConfig),
    targetSize: sourceConfig && sourceConfig.targetSize || 'source',
    entry: sourceConfig && sourceConfig.entry || sourcePackage.entry || 'deck.html',
    styles: styleFiles,
    pages: pages.map((page) => ({ id: page.id, file: page.file })),
    assets: { root: sourceConfig && sourceConfig.assets && sourceConfig.assets.root || sourcePackage.assetRoot || 'assets' },
  };
  if (hasSourceSynthesizedStyles) {
    config.synthesizedStyles = synthesizedStyles;
  } else if (Array.isArray(synthesizedStyles) && synthesizedStyles.length) {
    config.synthesizedStyles = synthesizedStyles;
  }
  if (hasSourceParentPages) {
    config.parentPages = parentPages;
  } else if (Array.isArray(parentPages) && parentPages.length) {
    config.parentPages = parentPages;
  }
  if (hasSourceLayers) {
    config.layers = layers;
  } else if (Array.isArray(layers) && layers.length) {
    config.layers = layers;
  }
  if (hasSourceCompositeFonts) {
    config.compositeFonts = compositeFonts;
  } else if (Array.isArray(compositeFonts) && compositeFonts.length) {
    config.compositeFonts = compositeFonts;
  }
  if (hasSourceSemanticPreset) {
    config.semanticPreset = sourceConfig.semanticPreset;
  }
  return config;
}

function layersConfigFor(layers = []) {
  return (Array.isArray(layers) ? layers : [])
    .map((layer) => {
      const name = layer && (layer.name != null ? layer.name : layer);
      if (name == null || String(name).trim() === '') return null;
      return { name: String(name) };
    })
    .filter(Boolean);
}

function synthesizedStylesConfigFor(styles) {
  if (!Array.isArray(styles)) {
    return [];
  }
  return styles
    .filter((style) => style && style.token && style.displayName)
    .map((style) => ({
      token: style.token,
      displayName: style.displayName,
      kind: style.kind || null,
      fingerprint: style.fingerprint || null,
      source: style.source || null,
      properties: style.properties || {},
    }));
}

function parentPagesConfigFor(parentPages = []) {
  return parentPages
    .map((parentPage) => {
      const id = parentPage && (parentPage.id || parentPage.name);
      if (!id) return null;
      const out = {
        id: String(id),
        name: String(parentPage.name || id),
      };
      if (parentPage.parentPageId) out.parentPageId = String(parentPage.parentPageId);
      if (parentPage.parentPageName) out.parentPageName = String(parentPage.parentPageName);
      const guides = parentPageGuidesConfigFor(parentPage.guides || []);
      if (guides.length) out.guides = guides;
      return out;
    })
    .filter(Boolean);
}

function parentPageGuidesConfigFor(guides = []) {
  return guides
    .map((guide) => {
      const orientation = String(guide && guide.orientation || '').trim().toLowerCase();
      const position = Number(guide && guide.position);
      if (!['vertical', 'horizontal'].includes(orientation) || !Number.isFinite(position)) return null;
      return {
        orientation,
        position: Math.round(position * 1000) / 1000,
        source: guide.source || 'parent-page',
      };
    })
    .filter(Boolean);
}

function hasEffectiveAuthorParentPageContent(parentPage) {
  if (parentPageGuidesConfigFor(parentPage && parentPage.guides || []).length) return true;
  return (parentPage && parentPage.items || []).some(shouldWriteParentPageItem);
}

function readSourceConfig(sourceRoot) {
  if (!sourceRoot) return null;
  const configPath = path.join(sourceRoot, 'deck.config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw sourceConfigParseFailed(configPath, error);
  }
}

function sourceConfigParseFailed(configPath, cause) {
  const message = cause && cause.message ? cause.message : String(cause || 'unknown parse error');
  const error = new Error(`SOURCE_CONFIG_PARSE_FAILED:${configPath}:${message}`);
  error.code = 'SOURCE_CONFIG_PARSE_FAILED';
  error.configPath = configPath;
  error.cause = cause;
  return error;
}

function pageEntries(model, sourceConfig = null) {
  const sourcePages = sourcePagesByFile(sourceConfig, model.sourcePackage);
  return (model.pages || []).map((page, index) => {
    const sourceFile = slash(page.sourceFile || sourceNodeAttribute(page, HTML_DATA_ID_ATTRIBUTES.SOURCE_FILE) || '');
    const sourcePage = sourceFile ? sourcePages.get(sourceFile) : null;
    const pageToken = page.pageToken || (sourcePage && sourcePage.id) || sourceNodeAttribute(page, 'data-page') || null;
    const pageId = pageToken || page.semantic || page.id || `page-${index + 1}`;
    const file = (sourcePage && sourcePage.file)
      || sourceFile
      || `pages/${String(index).padStart(2, '0')}-${safeFile(page.semantic || page.id || `page-${index + 1}`)}.html`;
    return {
      id: (sourcePage && sourcePage.id) || pageId,
      file,
      modelPage: {
        ...page,
        pageToken,
      },
    };
  });
}

function sourcePagesByFile(sourceConfig, sourcePackage = {}) {
  const out = new Map();
  addSourcePages(out, sourceConfig && sourceConfig.pages);
  addSourcePages(out, sourcePackage && sourcePackage.pageFiles);
  return out;
}

function addSourcePages(out, pages) {
  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || !page.file || !page.id) continue;
    const key = slash(page.file);
    if (!out.has(key)) out.set(key, { id: page.id, file: key });
  }
}

function sourceNodeAttribute(page, name) {
  return page && page.sourceNode && page.sourceNode.attributes
    ? page.sourceNode.attributes[name]
    : null;
}

function pageWithAppliedParentItems(page, parentPages = [], pasteboardCarriedParentPages = new Set()) {
  const parentPage = appliedParentPageFor(page, parentPages);
  const instantiatedSourceIds = pageFurnitureSourceIds(page);
  const writableItems = parentPage && Array.isArray(parentPage.items)
    ? parentPage.items
      .filter(shouldWriteParentPageItem)
      .filter((item) => !instantiatedSourceIds.has(String(item.id || '')))
    : [];
  const parentItems = writableItems.filter((item) => boundsIntersectPage(item.bounds, page));
  const pasteboardItems = writableItems.filter((item) => !boundsIntersectPage(item.bounds, page));
  const parentPageKey = parentPage ? String(parentPage.id || parentPage.name || '') : '';
  let carriedPasteboardItems = [];
  if (pasteboardItems.length && parentPageKey && !pasteboardCarriedParentPages.has(parentPageKey)) {
    pasteboardCarriedParentPages.add(parentPageKey);
    carriedPasteboardItems = pasteboardItems;
  }
  if (!parentItems.length && !carriedPasteboardItems.length) return page;
  return {
    ...page,
    items: [
      ...parentItems.map((item, index) => parentPageItemForPage(item, parentPage, page, index)),
      ...carriedPasteboardItems.map((item, index) => ({
        ...parentPageItemForPage(item, parentPage, page, parentItems.length + index),
        placement: PARENT_PAGE_PASTEBOARD_PLACEMENT,
      })),
      ...(page.items || []),
    ],
  };
}

function withCanonicalItemZIndexes(page, layers) {
  const items = Array.isArray(page.items) ? page.items : [];
  const stacked = items
    .map((item, index) => ({ item, index }))
    .filter((entry) => Number.isFinite(Number(entry.item.zIndex)));
  if (!stacked.length) return page;
  const bandByLayer = layerBottomFirstPositions(layers);
  const ordinalByIndex = new Map();
  stacked
    .slice()
    .sort((a, b) => compareIndesignStacking(a, b, bandByLayer))
    .forEach((entry, position) => ordinalByIndex.set(entry.index, position));
  return {
    ...page,
    items: items.map((item, index) => (ordinalByIndex.has(index)
      ? { ...item, zIndex: ordinalByIndex.get(index) }
      : item)),
  };
}

function layerBottomFirstPositions(layers) {
  const names = (Array.isArray(layers) ? layers : [])
    .map((layer) => String((layer && layer.name) || layer || ''))
    .filter(Boolean);
  const positions = new Map();
  names.forEach((name, index) => positions.set(name, names.length - 1 - index));
  return positions;
}

function compareIndesignStacking(a, b, bandByLayer) {
  const bandA = itemLayerBand(a.item, bandByLayer);
  const bandB = itemLayerBand(b.item, bandByLayer);
  if (bandA !== bandB) return bandA - bandB;
  const pageLevelA = a.item.parentPageItem ? 0 : 1;
  const pageLevelB = b.item.parentPageItem ? 0 : 1;
  if (pageLevelA !== pageLevelB) return pageLevelA - pageLevelB;
  const zA = Number(a.item.zIndex);
  const zB = Number(b.item.zIndex);
  if (zA !== zB) return zA - zB;
  return a.index - b.index;
}

function itemLayerBand(item, bandByLayer) {
  const name = String(item.layer || item.layerName || '');
  return bandByLayer.has(name) ? bandByLayer.get(name) : -1;
}

function pageFurnitureSourceIds(page) {
  const out = new Set();
  for (const item of page && page.items || []) {
    const sourceId = item && item.parentPageSourceId
      || item && item.sourceNode && item.sourceNode.attributes
        && item.sourceNode.attributes[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_SOURCE_ID];
    if (sourceId) out.add(String(sourceId));
  }
  return out;
}

function shouldWriteParentPageItem(item) {
  if (!item) return false;
  if (isTemplateNotesLayer(item)) return false;
  if (hasAcceptedItemProtocolLabel(item)) return true;
  if (item.role === 'text') return hasExplicitParentTextSemantic(item);
  if (isUnplacedTemplateFrame(item)) return false;
  return isVisibleParentDecoration(item);
}

function hasAcceptedItemProtocolLabel(item) {
  if (item && item.labelStatus && item.labelStatus !== 'accepted') return false;
  return (item && item.labels || []).some((label) => label
    && label.protocol === 'html-indesign'
    && label.kind === 'item'
    && label.id
    && label.generated !== true);
}

function isTemplateNotesLayer(item) {
  return /pagenotes|说明|注释/i.test(layerNameFor(item));
}

function hasExplicitParentTextSemantic(item) {
  const semantic = String(item.semantic || '').trim();
  if (['page-number', 'folio', 'running-header', 'running-footer', 'chapter-marker', 'section-marker'].includes(semantic)) return true;
  return (item.labels || []).some((label) => {
    const values = [label && label.semantic, label && label.role]
      .map((value) => String(value || '').trim());
    return values.some((value) => ['page-number', 'folio', 'running-header', 'running-footer', 'chapter-marker', 'section-marker'].includes(value));
  });
}

function isUnplacedTemplateFrame(item) {
  const role = String(item.role || '').toLowerCase();
  if (role !== 'graphic' && role !== 'image' && role !== 'frame') return false;
  if (item.asset || item.sourceAsset || item.placedAsset) return false;
  return !isVisibleParentDecoration(item);
}

function isVisibleParentDecoration(item) {
  const visual = item.visualStyle || {};
  const hasStroke = Boolean(visual.strokeColor) && Number(visual.strokeWeight) > 0;
  const hasFill = Boolean(visual.fillColor) && !/^\[?(none|无)\]?$/i.test(String(visual.fillColor));
  const hasVector = Boolean(item.vectorGeometry);
  const role = String(item.role || '').toLowerCase();
  if (role === 'line' && hasStroke) return true;
  if (/装饰|rule|line/i.test(layerNameFor(item)) && (hasStroke || hasFill || hasVector)) return true;
  if (hasVector && (hasStroke || hasFill)) return true;
  return hasStroke || hasFill;
}

function layerNameFor(item) {
  return String(item && (item.layerName || item.layer || '') || '');
}

function appliedParentPageFor(page, parentPages = []) {
  const keys = new Set([page && page.parentPageId, page && page.parentPageName].filter(Boolean).map(String));
  if (!keys.size) return null;
  return (parentPages || []).find((parentPage) => {
    return [parentPage.id, parentPage.name, parentPage.semantic].some((value) => value != null && keys.has(String(value)));
  }) || null;
}

function parentPageItemForPage(item, parentPage, page, index) {
  const sourceId = String(item.id || `parent-item-${index + 1}`);
  return {
    ...item,
    id: parentPageWritebackItemId(page.id || page.semantic || 'page', sourceId),
    parentPageItem: true,
    parentPageId: parentPage.id || null,
    parentPageName: parentPage.name || parentPage.id || null,
    parentPageSourceId: sourceId,
    structure: null,
  };
}

function pageHtml(page, sourceFile, options) {
  const attrs = sourcePageAttrs(withObservedPageContract(page, options), sourceFile, options);
  const items = pageItemsToAuthorHtml(page, options);
  return [`<section ${attrs}>`, indent(items, 2), '</section>', ''].join('\n');
}

function sourcePageAttrs(page, sourceFile, options) {
  const sourceNode = page.sourceNode || {};
  const attrs = mergeAttributes(sourceNode.attributes);
  const preserveTrustedSource = options.preserveTrustedSource && sourceNode.attributes;
  attrs.class = sourceNode.classList && sourceNode.classList.length ? sourceNode.classList.join(' ') : 'page';
  attrs.id = sourceNode.id || page.id;
  attrs['data-page'] = page.pageToken || sourceNodeAttribute(page, 'data-page') || page.semantic || page.id;
  if (!attrs[SEMANTIC_ATTR] && isUsefulSemantic(page.semantic)) attrs[SEMANTIC_ATTR] = page.semantic;
  attrs[HTML_DATA_ID_ATTRIBUTES.SOURCE_FILE] = sourceFile;
  if (!preserveTrustedSource && shouldWritePageParentAttrs(page, options)) {
    if (page.parentPageId) attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE] = attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE] || page.parentPageId;
    if (page.parentPageName) attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_NAME] = attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_NAME] || page.parentPageName;
  } else if (!preserveTrustedSource) {
    delete attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_NAME];
  }
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN]) {
    const marginAttr = pageMarginAttrValue(page.margins);
    if (marginAttr) attrs[HTML_DATA_ID_ATTRIBUTES.MARGIN] = marginAttr;
  }
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.GUIDES]) {
    const guidesAttr = pageGuidesAttrValue(page.guides);
    if (guidesAttr) attrs[HTML_DATA_ID_ATTRIBUTES.GUIDES] = guidesAttr;
    else if (page.writeEmptyGuides) attrs[HTML_DATA_ID_ATTRIBUTES.GUIDES] = '[]';
  }
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.LAYOUT] && page.contractLayout) attrs[HTML_DATA_ID_ATTRIBUTES.LAYOUT] = page.contractLayout;
  if (options.mode === 'observation') attrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED] = 'true';
  if (options.mode && options.mode !== 'structured') attrs[HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE] = options.mode;
  if (page.grid) {
    attrs[HTML_DATA_ID_ATTRIBUTES.GRID] = attrs[HTML_DATA_ID_ATTRIBUTES.GRID] || `${page.grid.columns}x${page.grid.rows}`;
    if (page.grid.columnGutter != null) attrs[HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER] = attrs[HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER] || `${page.grid.columnGutter}px`;
    if (page.grid.rowGutter != null) attrs[HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER] = attrs[HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER] || `${page.grid.rowGutter}px`;
    if (page.grid.baseline != null) attrs[HTML_DATA_ID_ATTRIBUTES.BASELINE] = attrs[HTML_DATA_ID_ATTRIBUTES.BASELINE] || `${page.grid.baseline}px`;
  }
  const style = preserveTrustedSource
    ? attrs.style || ''
    : pageStyleVars(page);
  if (style) attrs.style = style;
  return attrsToHtml(orderPageAttrs(attrs));
}

// 人做的 INDD 没有页面标签，observation / inferred 回读的页面缺 data-id-layout 与 data-id-grid，
// strict lint 报 AUTHOR_PAGE_CONTRACT_MISSING（#32）。这里补一份明确的中性契约，而不是从视觉推断：
// - data-id-layout="observed"：尚未语义化的自由版面，Agent 语义化时换成真正的页面结构模板 token；
// - data-id-grid="1x1"：只有版心一个格（边距已由 data-id-margin 读回；快照不含 InDesign 分栏），
//   和 InDesign 新建页面的单栏默认一致；
// - data-id-guides 固定写出（没有参考线时写 []）：声明网格后正向构建不再生成网格参考线，
//   往返后页面参考线仍是 INDD 原有的那一组。
// 观察对象的网格偏移在 lintProfile reverse-export 下降为提示，这份网格不会带来成批的 GRID_ALIGNMENT_OFF。
const OBSERVED_PAGE_LAYOUT = 'observed';
const OBSERVED_PAGE_GRID = Object.freeze({ columns: 1, rows: 1 });

function withObservedPageContract(page, options = {}) {
  if (!options.mode || options.mode === 'structured') return page;
  const sourceAttrs = page.sourceNode && page.sourceNode.attributes || {};
  const hasLayout = Boolean(sourceAttrs[HTML_DATA_ID_ATTRIBUTES.LAYOUT]);
  const hasGrid = Boolean(sourceAttrs[HTML_DATA_ID_ATTRIBUTES.GRID] || page.grid);
  if (hasLayout && hasGrid) return page;
  return {
    ...page,
    // 页面标签里读回了布局 token 就写它；都没有才写中性值。
    ...(hasLayout ? {} : { contractLayout: page.layout || OBSERVED_PAGE_LAYOUT }),
    ...(hasGrid ? {} : { grid: { ...OBSERVED_PAGE_GRID }, writeEmptyGuides: true }),
  };
}

function shouldWritePageParentAttrs(page, options = {}) {
  return pageHasEffectiveParentPage(page, options.effectiveParentPageKeys);
}

function pageStyleVars(page) {
  return authorPageStyleVarPairs(page).map(([name, value]) => `${name}:${value}`).join(';');
}

function pageMarginAttrValue(margins) {
  if (!margins) return '';
  const values = [margins.top, margins.right, margins.bottom, margins.left].map(cssPxValue);
  return values.every(Boolean) ? values.join(' ') : '';
}

function pageGuidesAttrValue(guides) {
  const values = (Array.isArray(guides) ? guides : [])
    .map((guide) => {
      const orientation = String(guide && guide.orientation || '').trim().toLowerCase();
      const position = Number(guide && guide.position);
      if (!['vertical', 'horizontal'].includes(orientation) || !Number.isFinite(position)) return null;
      return {
        orientation,
        position: Math.round(position * 1000) / 1000,
        source: String(guide.source || 'page'),
      };
    })
    .filter(Boolean);
  return values.length ? JSON.stringify(values) : '';
}

function cssPxValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return `${Math.round(number * 1000) / 1000}px`;
}

function authoringReport(model, pages, options, extras = {}) {
  const inferred = pages.filter((page) => !page.modelPage.sourceFile).length;
  return {
    ok: true,
    mode: options.mode || model.reverseMode || 'structured',
    pages: pages.length,
    inferredPageFiles: inferred,
    inference: {
      source: inferred ? 'observation-page-split' : 'source-labels',
      confidence: inferred ? 'low' : 'high',
    },
    assets: extras.assets || { copied: 0, missing: [] },
    sourceCss: extras.sourceCss || { copied: 0, missing: [] },
    styleResidual: extras.styleResidual || { removedProperties: 0, itemsReduced: 0, missingSynthRules: [] },
    labels: labelReport(model),
    // 作者 HTML 写出时的降级与兜底记账（如 REVERSE_AUTHOR_ITEM_DROPPED），反向导出汇总进 report.json。
    warnings: extras.warnings || [],
    // 包内语义库：以哪份词表为底、登记了哪些读回的样式/图层名、哪些 token 无法登记（#32）。
    ...(extras.semanticPreset ? { semanticPreset: extras.semanticPreset } : {}),
  };
}

function labelReport(model) {
  const report = { accepted: 0, partial: 0, observed: 0, rejections: [] };
  for (const page of model.pages || []) {
    addLabelStatus(report, { pageId: page.id }, page);
    for (const item of page.items || []) {
      addLabelStatus(report, { pageId: page.id, itemId: item.id }, item);
    }
  }
  return report;
}

function addLabelStatus(report, context, value) {
  const status = value && value.labelStatus;
  if (!status || !Object.prototype.hasOwnProperty.call(report, status)) return;
  report[status] += 1;
  const reasons = value.rejectionReasons || value.observedLabel && value.observedLabel.rejectionReasons || [];
  if (reasons.length) {
    report.rejections.push({
      ...context,
      reasons: reasons.slice(),
    });
  }
}

function writeText(root, relativePath, text) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

function safeFile(value) {
  return String(value || 'page').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function orderPageAttrs(attrs) {
  const out = {};
  for (const key of ['class', 'id', 'data-page', HTML_DATA_ID_ATTRIBUTES.SOURCE_FILE, HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE, HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_NAME, HTML_DATA_ID_ATTRIBUTES.LAYOUT, HTML_DATA_ID_ATTRIBUTES.GRID, HTML_DATA_ID_ATTRIBUTES.COLUMN_GUTTER, HTML_DATA_ID_ATTRIBUTES.ROW_GUTTER, HTML_DATA_ID_ATTRIBUTES.BASELINE, HTML_DATA_ID_ATTRIBUTES.MARGIN, HTML_DATA_ID_ATTRIBUTES.GUIDES, HTML_DATA_ID_ATTRIBUTES.OBSERVED, HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE, 'style']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}

function htmlWriteAttrFromRegistry(modelPath) {
  const field = fieldRegistry.getByPath(modelPath);
  const attrs = field && field.html && field.html.writeAttrs;
  if (!Array.isArray(attrs) || !attrs[0]) {
    throw new Error(`HTML_WRITE_ATTR_MISSING:${modelPath}`);
  }
  return attrs[0];
}

function indent(value, spaces) {
  const prefix = ' '.repeat(spaces);
  return String(value || '').split(/\r?\n/).map((line) => (line ? `${prefix}${line}` : line)).join('\n');
}

module.exports = {
  writeReverseAuthorPackage,
};
