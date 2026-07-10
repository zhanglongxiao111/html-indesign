const { loadStandardSemanticPreset } = require('../../../semantic-preset');
const { normalizeSynthesizedStyles } = require('../../../semantic-model/synthesized-styles');
const { validateSemanticModel } = require('../../../semantic-model');
const {
  fieldRegistry,
  HTML_DATA_ID_ATTRIBUTES,
} = require('../../../protocol');
const { createProtocolLabel } = require('../../../shared/labels');
const { createReport, addMessage } = require('../../../shared/report');
const { isIndesignBuiltinStyleName } = require('../../../shared/style-utils');
const { normalizeLineEndings } = require('../../../shared/text');
const { validateReverseLabel } = require('./label-whitelist');
const { tableSourceHtmlMatchesTable } = require('./table-source-html');

const STYLE_REF_ALLOWED_KEYS = styleRefAllowedKeysFromRegistry();
const SOURCE_FILE_ATTR = htmlReadAttrFromRegistry('items[].sourceFile');

function reverseSnapshotToSemanticModel(snapshot, options = {}) {
  const documentLabel = firstLabel(snapshot.document && snapshot.document.labels, 'document') || {};
  const styleMaps = reverseStyleNameMaps(snapshot.styles || {});
  const reverseMode = options.mode || (snapshot.metadata && snapshot.metadata.mode) || 'structured';
  const semanticProfile = activeSemanticProfile(snapshot, documentLabel, options);
  const semanticPreset = activeSemanticPreset(snapshot, documentLabel, options, semanticProfile);
  const sourcePackage = sourcePackageFor(documentLabel, semanticProfile);
  const layerVisibility = reverseLayerVisibility(snapshot.layers || []);
  const diagnostics = createLabelDiagnostics();
  const context = {
    semanticPreset,
    sourcePageSemanticByFile: sourcePageSemanticByFile(sourcePackage, semanticPreset, {
      mode: reverseMode,
      strictFields: options.strictFields === true,
      warnFields: options.warnFields === true,
    }),
    layerVisibility,
    diagnostics,
    labelOptions: {
      mode: reverseMode,
      strictFields: options.strictFields === true,
      warnFields: options.warnFields === true,
    },
  };
  const pages = (snapshot.pages || []).map((page) => reversePage(page, styleMaps, context));
  const report = diagnostics.report.messages.length ? diagnostics.report : null;
  const documentId = documentLabel.id || 'indesign-document';
  const title = documentLabel.title || (documentLabel.sourcePackage && documentLabel.sourcePackage.title) || (snapshot.document && snapshot.document.name) || documentId;
  const model = {
    kind: 'DocumentModel',
    id: documentId,
    title,
    profile: semanticProfile,
    source: snapshot.metadata && snapshot.metadata.sourceDocument,
    unitMode: documentLabel.unitMode || 'presentation',
    coordinateUnit: documentLabel.coordinateUnit || 'pt',
    labels: labelsWithRequiredKind(snapshot.document && snapshot.document.labels, 'document', documentId, {
      title,
      unitMode: documentLabel.unitMode || 'presentation',
      coordinateUnit: documentLabel.coordinateUnit || 'pt',
      profile: semanticProfile || null,
      sourcePackage,
    }),
    sourcePackage,
    parentPages: (snapshot.parentPages || []).map((parentPage) => reverseParentPage(parentPage, styleMaps, context)),
    pages,
    layers: (snapshot.layers || []).map(reverseLayer),
    styles: reverseStyles(snapshot.styles || {}),
    assets: snapshot.assets || [],
    warnings: diagnostics.warnings,
    errors: diagnostics.errors,
    fieldValidation: diagnostics.fieldValidation,
    report,
    valid: diagnostics.errors.length === 0,
    reverseMode,
  };
  const normalized = normalizeSynthesizedStyles(model);
  const validation = validateSemanticModel(normalized, semanticModelValidationOptions(options));
  throwIfSemanticModelInvalid(normalized, validation, 'indesign reverseSnapshotToSemanticModel');
  return normalized;
}

function semanticModelValidationOptions(options = {}) {
  return {
    strictFields: true,
  };
}

function reversePage(page, styleMaps, context = {}) {
  const label = firstLabel(page.labels, 'page') || {};
  const validation = validateReverseLabel(label, { preset: context.semanticPreset, kind: 'page', ...context.labelOptions });
  recordLabelDiagnostics(context.diagnostics, validation, {
    labelKind: 'page',
    labelId: label.id || page.id || null,
    pageId: page.id || null,
  });
  const effective = validation.effective;
  const observed = observedLabelWithReasons(validation);
  const sourcePackageSemantic = pageSemanticFromSourcePackage(label, effective, observed, context);
  const effectiveForPage = sourcePackageSemantic ? { ...effective, semantic: sourcePackageSemantic } : effective;
  const parent = effective.parentPage || {};
  const appliedParentPageName = page.appliedParentPageName || null;
  return {
    id: label.id || page.id,
    index: page.index,
    semantic: effectiveForPage.semantic || null,
    parentPageId: effective.parentPageId || parent.id || appliedParentPageName || null,
    parentPageName: effective.parentPageName || parent.name || appliedParentPageName,
    layout: effective.layout || null,
    sourceFile: effective.sourceFile || null,
    sourceNode: effective.sourceNode || null,
    grid: effective.grid || null,
    width: page.bounds && page.bounds.width,
    height: page.bounds && page.bounds.height,
    margins: effective.margins || page.margins || null,
    guides: page.guides || [],
    labelStatus: validation.status,
    effectiveLabel: effectiveForPage,
    observedLabel: observed,
    rejectedFields: validation.rejectedFields,
    rejectionReasons: validation.rejectionReasons,
    labels: labelsWithRequiredKind(page.labels, 'page', label.id || page.id),
    items: effectiveReversePageItems(page)
      .filter((item) => shouldKeepReverseItem(item, context))
      .map((item) => reverseItem(item, styleMaps, { ...context, pageId: page.id || null })),
  };
}

function effectiveReversePageItems(page = {}) {
  const topLevel = Array.isArray(page.items) ? page.items : [];
  const auditById = auditItemsById(page.auditItems || []);
  const out = topLevel.map((item) => mergeAuditTreeItem(item, auditById.get(String(item && item.id || ''))));
  const seen = new Set(out.map((item) => String(item && item.id || '')));
  for (const item of page.auditItems || []) {
    if (!shouldExposeAuditChildItem(item)) continue;
    const id = String(item && item.id || '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(item);
  }
  return out;
}

function sourcePageSemanticByFile(sourcePackage, semanticPreset, labelOptions = {}) {
  const out = new Map();
  for (const pageFile of Array.isArray(sourcePackage && sourcePackage.pageFiles) ? sourcePackage.pageFiles : []) {
    const token = cleanString(pageFile && pageFile.id);
    const file = slash(pageFile && pageFile.file);
    if (!token || !file) continue;
    const validation = validateReverseLabel({
      kind: 'page',
      id: token,
      semantic: token,
    }, {
      preset: semanticPreset,
      kind: 'page',
      ...labelOptions,
    });
    if (validation.effective && validation.effective.semantic === token) {
      out.set(file, token);
    }
  }
  return out;
}

function pageSemanticFromSourcePackage(label, effective, observed, context = {}) {
  if (effective && effective.semantic) return null;
  if (observed && observed.semantic) return null;
  const byFile = context.sourcePageSemanticByFile;
  if (!byFile || !byFile.size) return null;
  const sourceFile = slash(
    effective && effective.sourceFile
      || label && label.sourceFile
      || label && label.sourceNode && label.sourceNode.attributes && label.sourceNode.attributes[SOURCE_FILE_ATTR]
  );
  if (!sourceFile) return null;
  return byFile.get(sourceFile) || null;
}

function auditItemsById(items) {
  const out = new Map();
  for (const item of items || []) {
    const id = String(item && item.id || '');
    if (!id || out.has(id)) continue;
    out.set(id, item);
  }
  return out;
}

function mergeAuditTreeItem(item, auditItem) {
  if (!auditItem) return item;
  return {
    ...item,
    ...auditItem,
    labels: item.labels || auditItem.labels || [],
  };
}

function shouldExposeAuditChildItem(item = {}) {
  const parentType = String(item.parent && item.parent.type || '');
  if (parentType !== 'Group') return false;
  const type = String(item.type || '');
  if (type === 'PDF' || type === 'Image') return false;
  if (item.placedAsset) return true;
  const visual = item.visualStyle || {};
  if (visual.fillColor) return true;
  return Boolean(visual.strokeColor && Number(visual.strokeWeight || 0) > 0);
}

function reverseItem(item, styleMaps = {}, context = {}) {
  const label = firstLabel(item.labels, 'item') || {};
  const validation = validateReverseLabel(label, { preset: context.semanticPreset, kind: 'item', ...context.labelOptions });
  recordLabelDiagnostics(context.diagnostics, validation, {
    labelKind: 'item',
    labelId: label.id || item.id || null,
    pageId: context.pageId || null,
    itemId: item.id || null,
  });
  const effective = validation.effective;
  const observed = observedLabelWithReasons(validation);
  const role = effective.role || roleFromInDesignType(item.type, item);
  const table = reverseTable(item.table, styleMaps);
  const vectorGeometry = reverseVectorGeometry(item.vectorGeometry);
  const extensions = reverseItemExtensions(item);
  return {
    id: label.id || item.id,
    role,
    sourceType: item.type || null,
    semantic: effective.semantic || null,
    tagName: effective.htmlTag || htmlTagForRole(role),
    htmlClass: effective.className || null,
    bounds: item.bounds,
    layerName: item.layerName || null,
    layer: item.layerName || null,
    styleRefs: foldSynthesizedStyleRefs(reverseStyleRefs({
      ...(isPlainObject(item.styleRefs) ? item.styleRefs : {}),
      ...reverseStyleNamePair(styleMaps, 'paragraphStyles', 'paragraphStyle', item.paragraphStyleName),
      ...reverseStyleNamePair(styleMaps, 'objectStyles', 'objectStyle', item.objectStyleName),
      ...reverseStyleNamePair(styleMaps, 'frameStyles', 'frameStyle', item.frameStyleName),
      tableStyle: table && table.tableStyle ? table.tableStyle : null,
      tableStyleDisplayName: table && table.tableStyleDisplayName ? table.tableStyleDisplayName : null,
      layer: item.layerName || null,
    })),
    content: contentForReverseItem(role, item, effective, styleMaps, table),
    table,
    vectorGeometry,
    visualStyle: item.visualStyle || null,
    textStyle: item.textStyle || null,
    ...(extensions ? { extensions } : {}),
    inlineStyle: item.inlineStyle || item.inlineCSS || null,
    zIndex: numberOrNull(item.zIndex),
    firstLineFont: item.firstLineFont || null,
    sourceFile: effective.sourceFile || null,
    sourceNode: effective.sourceNode || null,
    sourceAncestorNodes: Array.isArray(effective.sourceAncestorNodes) ? effective.sourceAncestorNodes : [],
    structure: effective.structure || null,
    layout: effective.layout || null,
    labelStatus: validation.status,
    effectiveLabel: effective,
    observedLabel: observed,
    rejectedFields: validation.rejectedFields,
    rejectionReasons: validation.rejectionReasons,
    asset: item.placedAsset || null,
    labels: labelsWithRequiredKind(item.labels, 'item', label.id || item.id, { role }),
  };
}

function reverseStyleNamePair(styleMaps, kind, refKey, rawName) {
  if (isIndesignBuiltinStyleName(rawName)) {
    return { [refKey]: null, [`${refKey}DisplayName`]: null };
  }
  return {
    [refKey]: mapStyleName(styleMaps, kind, rawName),
    [`${refKey}DisplayName`]: rawName || null,
  };
}

function foldSynthesizedStyleRefs(refs) {
  for (const key of ['objectStyle', 'frameStyle']) {
    const match = /^synth-(synth_[a-z]+_\d+)$/.exec(String(refs[key] || ''));
    if (!match) continue;
    refs[key] = null;
    refs[`${key}DisplayName`] = null;
    if (!refs.synthesizedToken) refs.synthesizedToken = match[1];
  }
  return refs;
}

function reverseStyleRefs(styleRefs) {
  const out = {};
  for (const key of STYLE_REF_ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(styleRefs, key)) {
      out[key] = styleRefs[key];
    }
  }
  return out;
}

function styleRefAllowedKeysFromRegistry() {
  const field = fieldRegistry.getByPath('items[].styleRefs');
  if (!field || !Array.isArray(field.allowedKeys) || !field.allowedKeys.length) {
    throw new Error('STYLE_REFS_ALLOWED_KEYS_MISSING:items[].styleRefs');
  }
  return Object.freeze(field.allowedKeys.slice());
}

function htmlReadAttrFromRegistry(modelPath) {
  const field = fieldRegistry.getByPath(modelPath);
  const attrs = field && field.html && field.html.readAttrs;
  if (!Array.isArray(attrs) || !attrs[0]) {
    throw new Error(`HTML_READ_ATTR_MISSING:${modelPath}`);
  }
  return attrs[0];
}

function reverseItemExtensions(item = {}) {
  const indesign = {};
  if (item.effects) indesign.effects = item.effects;
  if (item.textFrameStyle) indesign.textFrameStyle = item.textFrameStyle;
  return Object.keys(indesign).length
    ? { indesign }
    : null;
}

function reverseParentPage(parentPage, styleMaps, context = {}) {
  const label = firstLabel(parentPage.labels, 'parentPage') || {};
  const appliedParentPageName = parentPage.appliedParentPageName || null;
  return {
    id: label.id || parentPage.name,
    name: label.name || label.displayName || parentPage.name,
    semantic: label.semantic || label.id || parentPage.name,
    parentPageId: label.parentPageId || appliedParentPageName || null,
    parentPageName: label.parentPageName || appliedParentPageName || null,
    provides: label.provides || [],
    bounds: parentPage.bounds || null,
    guides: normalizeReverseGuides(parentPage.guides || [], 'parent-page'),
    labels: parentPage.labels || [],
    items: (parentPage.items || [])
      .filter((item) => shouldKeepReverseItem(item, context))
      .map((item) => {
        const normalized = reverseItem(item, styleMaps, context);
        return {
          ...normalized,
          parentPageItem: true,
          parentPageSourceId: item.id || normalized.id || null,
        };
      }),
  };
}

function normalizeReverseGuides(guides, source) {
  return (guides || [])
    .map((guide) => ({
      orientation: normalizeGuideOrientation(guide.orientation),
      position: numberOrNull(guide.position != null ? guide.position : guide.location),
      source: guide.source || source || 'indesign',
      labels: guide.labels || [],
    }))
    .filter((guide) => guide.orientation && guide.position != null);
}

function normalizeGuideOrientation(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'vertical' || text === 'horizontal') return text;
  if (text.includes('vertical')) return 'vertical';
  if (text.includes('horizontal')) return 'horizontal';
  return null;
}

function reverseLayer(layer) {
  const label = firstLabel(layer.labels, 'layer') || {};
  return {
    token: label.token || layer.name,
    displayName: label.displayName || layer.name,
    name: layer.name,
    visible: typeof layer.visible === 'boolean' ? layer.visible : undefined,
    printable: typeof layer.printable === 'boolean' ? layer.printable : undefined,
    locked: typeof layer.locked === 'boolean' ? layer.locked : undefined,
    labels: layer.labels || [],
  };
}

function createLabelDiagnostics() {
  return {
    warnings: [],
    errors: [],
    fieldValidation: [],
    report: createReport(),
  };
}

function recordLabelDiagnostics(diagnostics, validation, context = {}) {
  if (!diagnostics || !validation) return;
  if (shouldRecordFieldValidation(validation.fieldValidation)) {
    diagnostics.fieldValidation.push(labelFieldValidationDiagnostic(validation.fieldValidation, context));
  }
  for (const warning of validation.warnings || []) {
    const diagnostic = labelDiagnostic(warning, context);
    diagnostics.warnings.push(diagnostic);
    addMessage(diagnostics.report, 'warning', diagnostic.code, diagnostic.message, diagnostic);
  }
  for (const error of validation.errors || []) {
    const diagnostic = labelDiagnostic(error, context);
    diagnostics.errors.push(diagnostic);
    addMessage(diagnostics.report, 'error', diagnostic.code, diagnostic.message, diagnostic);
  }
}

function shouldRecordFieldValidation(fieldValidation) {
  if (!fieldValidation) return false;
  return Boolean(
    fieldValidation.accepted.length
      || fieldValidation.unknown.length
      || fieldValidation.retired.length
      || (fieldValidation.disallowed && fieldValidation.disallowed.length)
      || fieldValidation.observed.length
      || fieldValidation.warnings.length
      || fieldValidation.errors.length,
  );
}

function labelFieldValidationDiagnostic(fieldValidation, context = {}) {
  return {
    labelKind: context.labelKind || null,
    labelId: context.labelId || null,
    pageId: context.pageId || null,
    itemId: context.itemId || null,
    valid: fieldValidation.valid,
    accepted: fieldValidation.accepted.slice(),
    unknown: fieldValidation.unknown.slice(),
    retired: fieldValidation.retired.map((entry) => ({
      path: entry.path,
      canonicalPath: entry.field && entry.field.canonicalPath || null,
      lifecycle: entry.field && entry.field.lifecycle || null,
    })),
    disallowed: (fieldValidation.disallowed || []).map((entry) => ({
      path: entry.path,
      labelKind: entry.labelKind || null,
      allowedLabelKinds: Array.isArray(entry.allowedLabelKinds) ? entry.allowedLabelKinds.slice() : [],
      canonicalPath: entry.field && entry.field.canonicalPath || null,
      lifecycle: entry.field && entry.field.lifecycle || null,
    })),
    observed: fieldValidation.observed.slice(),
    warnings: fieldValidation.warnings.slice(),
    errors: fieldValidation.errors.slice(),
  };
}

function labelDiagnostic(issue = {}, context = {}) {
  return {
    code: issue.code,
    message: issue.message,
    path: issue.path,
    labelKind: context.labelKind || null,
    labelId: context.labelId || null,
    pageId: context.pageId || null,
    itemId: context.itemId || null,
  };
}

function reverseLayerVisibility(layers = []) {
  const hidden = new Set();
  for (const layer of layers || []) {
    if (!layer || !layer.name) continue;
    if (layer.visible === false || layer.printable === false) hidden.add(String(layer.name));
  }
  return { hidden };
}

function shouldKeepReverseItem(item = {}, context = {}) {
  if (item.visible === false || item.printable === false || item.nonprinting === true) return false;
  const layerName = item.layerName || '';
  if (layerName && context.layerVisibility && context.layerVisibility.hidden.has(String(layerName))) return false;
  return true;
}

function reverseStyles(styles) {
  return {
    paragraphStyles: reverseStyleCollection(styles.paragraphStyles || []),
    characterStyles: reverseStyleCollection(styles.characterStyles || []),
    objectStyles: reverseStyleCollection(styles.objectStyles || []),
    frameStyles: reverseStyleCollection(styles.frameStyles || []),
    tableStyles: reverseStyleCollection(styles.tableStyles || []),
    cellStyles: reverseStyleCollection(styles.cellStyles || []),
    compositeFonts: reverseCompositeFonts(styles.compositeFonts || []),
  };
}

function reverseStyleNameMaps(styles) {
  return {
    paragraphStyles: reverseStyleNameMap(styles.paragraphStyles || []),
    characterStyles: reverseStyleNameMap(styles.characterStyles || []),
    objectStyles: reverseStyleNameMap(styles.objectStyles || []),
    frameStyles: reverseStyleNameMap(styles.frameStyles || []),
    tableStyles: reverseStyleNameMap(styles.tableStyles || []),
    cellStyles: reverseStyleNameMap(styles.cellStyles || []),
  };
}

function reverseStyleNameMap(items) {
  const map = new Map();
  for (const item of styleItems(items)) {
    const label = firstLabel(item.labels, 'style') || {};
    const token = label.token || label.id || null;
    if (!token) continue;
    for (const name of [item.name, item.safeName, label.displayName, label.safeName]) {
      if (name) map.set(String(name), token);
    }
  }
  return map;
}

function styleItems(items) {
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return Object.values(items);
  return [];
}

function mapStyleName(styleMaps, kind, value) {
  if (!value) return null;
  const map = styleMaps && styleMaps[kind];
  return map && map.get(String(value)) || value;
}

function contentForReverseItem(role, item, label, styleMaps, table = null) {
  if (role === 'table' && item.table) {
    const sourceHtml = typeof label.sourceHtml === 'string' ? label.sourceHtml : null;
    if (sourceHtml && tableSourceHtmlMatchesTable(sourceHtml, table)) {
      return { text: '', sourceHtml, runs: [] };
    }
    return {
      text: '',
      runs: reverseTextRuns(item.textRuns || item.runs || [], styleMaps),
    };
  }
  const rawText = normalizeReverseText(item.text || '');
  const sourceText = typeof label.sourceText === 'string' ? label.sourceText : null;
  if (sourceText != null && sourceTextMatchesCurrentText(sourceText, rawText)) {
    return {
      text: sourceText,
      sourceHtml: typeof label.sourceHtml === 'string' ? label.sourceHtml : null,
      runs: sourceRunsFromLabel(label, styleMaps),
    };
  }
  return {
    text: rawText,
    runs: reverseTextRuns(item.textRuns || item.runs || [], styleMaps),
  };
}

function sourceTextMatchesCurrentText(sourceText, currentText) {
  return normalizeLineEndings(sourceText) === normalizeLineEndings(currentText);
}

function sourceRunsFromLabel(label, styleMaps) {
  const runs = Array.isArray(label.sourceRuns) ? label.sourceRuns : [];
  return runs.map((run) => {
    const attributes = { ...(run.attributes || {}) };
    const characterStyle = mapStyleName(styleMaps, 'characterStyles', run.characterStyle || attributes[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE]);
    if (characterStyle && !attributes[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE]) {
      attributes[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE] = characterStyle;
    }
    return {
      text: String(run.text || ''),
      tagName: run.tagName || null,
      classList: Array.isArray(run.classList) ? run.classList.slice() : [],
      attributes,
      characterStyle,
    };
  });
}

function reverseTextRuns(runs, styleMaps) {
  return (runs || []).map((run) => ({
    ...run,
    text: normalizeReverseText(run.text || ''),
    characterStyle: mapStyleName(styleMaps, 'characterStyles', run.characterStyle),
  }));
}

function reverseTable(table, styleMaps) {
  if (!table) return null;
  return {
    ...table,
    tableStyle: mapStyleName(styleMaps, 'tableStyles', table.tableStyle),
    rows: (table.rows || []).map((row) => ({
      ...row,
      cells: (row.cells || []).map((cell) => {
        const normalized = {
          ...cell,
          text: normalizeReverseText(cell.text || ''),
          runs: reverseTextRuns(cell.runs || [], styleMaps),
        };
        if (Object.prototype.hasOwnProperty.call(cell, 'paragraphStyle')) {
          normalized.paragraphStyle = mapStyleName(styleMaps, 'paragraphStyles', cell.paragraphStyle);
        }
        if (Object.prototype.hasOwnProperty.call(cell, 'cellStyle')) {
          normalized.cellStyle = mapStyleName(styleMaps, 'cellStyles', cell.cellStyle);
        }
        return normalized;
      }),
    })),
  };
}

function normalizeReverseText(value) {
  return String(value || '')
    .replace(/DOUBLE_LEFT_QUOTE/g, '“')
    .replace(/DOUBLE_RIGHT_QUOTE/g, '”')
    .replace(/SINGLE_LEFT_QUOTE/g, '‘')
    .replace(/SINGLE_RIGHT_QUOTE/g, '’')
    .replace(/FORCED_LINE_BREAK|PARAGRAPH_BREAK/g, '\n');
}

function reverseStyleCollection(items) {
  const out = {};
  for (const item of styleItems(items)) {
    const label = firstLabel(item.labels, 'style') || {};
    const token = label.token || item.name;
    const style = {
      name: label.displayName || item.name,
      token,
      displayName: label.displayName || item.name,
      indesignFeatures: reverseStyleIndesignFeatures(item),
      labels: item.labels || [],
    };
    if (item.safeName || label.safeName) style.safeName = item.safeName || label.safeName;
    if (Object.prototype.hasOwnProperty.call(item, 'css')) style.css = item.css;
    if (Object.prototype.hasOwnProperty.call(item, 'source')) style.source = item.source;
    out[token] = style;
  }
  return out;
}

function reverseStyleIndesignFeatures(item) {
  const features = {};
  for (const key of ['compositeFont', 'dropCap', 'list', 'grepStyles', 'nestedStyles']) {
    if (item[key] != null) features[key] = item[key];
  }
  return Object.keys(features).length ? features : null;
}

function reverseCompositeFonts(items) {
  const out = {};
  for (const item of items || []) {
    if (!item || !item.name) continue;
    out[item.name] = {
      name: item.name,
      safeName: item.safeName || null,
      hasBoldCJK: Boolean(item.hasBoldCJK),
      cjkWeight: item.cjkWeight || null,
      romanWeight: item.romanWeight || null,
      entries: item.entries || [],
    };
  }
  return out;
}

function activeSemanticPreset(snapshot, documentLabel, options = {}, semanticProfile = activeSemanticProfile(snapshot, documentLabel, options)) {
  if (Object.prototype.hasOwnProperty.call(options, 'semanticPreset')) {
    if (isNonEmptyObject(options.semanticPreset)) return options.semanticPreset;
    throw semanticPresetLoadFailed(
      'semanticPreset',
      'semanticPreset must be a non-empty object when provided',
    );
  }
  const mode = options.mode || (snapshot && snapshot.metadata && snapshot.metadata.mode) || 'structured';
  if (!semanticProfile) {
    if (mode === 'observation') return {};
    throw semanticPresetLoadFailed(
      'profile-required',
      'Structured reverse requires an explicit semanticPreset or profile',
    );
  }
  try {
    return loadStandardSemanticPreset(semanticProfile).preset;
  } catch (error) {
    throw semanticPresetLoadFailed(semanticProfile, error.message, error);
  }
}

function activeSemanticProfile(snapshot, documentLabel, options = {}) {
  const sourcePackage = documentLabel && documentLabel.sourcePackage || {};
  return firstProfile([
    options.profile,
    documentLabel && documentLabel.profile,
    sourcePackage.profile,
    snapshot && snapshot.metadata && snapshot.metadata.profile,
  ]);
}

function sourcePackageFor(documentLabel, semanticProfile) {
  if (!documentLabel || !isPlainObject(documentLabel.sourcePackage)) return null;
  const sourcePackage = { ...documentLabel.sourcePackage };
  if (semanticProfile) sourcePackage.profile = semanticProfile;
  return sourcePackage;
}

function isNonEmptyObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function slash(value) {
  return cleanString(value).replace(/\\/g, '/');
}

function observedLabelWithReasons(validation) {
  const observed = validation.observed || {};
  if (!validation.rejectionReasons || !validation.rejectionReasons.length) return observed;
  return {
    ...observed,
    rejectionReasons: validation.rejectionReasons.slice(),
  };
}

function firstLabel(labels, kind) {
  return (labels || []).find((label) => label && label.kind === kind) || null;
}

function labelsWithRequiredKind(labels, kind, id, payload = {}) {
  const list = Array.isArray(labels) ? labels.slice() : [];
  if (firstLabel(list, kind)) return list;
  return [
    createProtocolLabel({
      kind,
      id: id || `${kind}-unknown`,
      source: 'indesign-reverse',
      ...payload,
    }),
    ...list,
  ];
}

function throwIfSemanticModelInvalid(model, validation, adapter) {
  const modelErrors = Array.isArray(model.errors) ? model.errors : [];
  if (validation.valid && model.valid !== false) return;
  const issues = [
    ...(validation.errors || []),
    ...modelErrors,
  ];
  const firstIssue = issues[0] || { code: 'SEMANTIC_MODEL_INVALID', message: 'Semantic model validation failed.' };
  const details = issues
    .slice(0, 5)
    .map((issue) => issue.path || issue.code || issue.message)
    .filter(Boolean)
    .join(', ');
  const error = new Error(`SEMANTIC_MODEL_VALIDATION_FAILED:${adapter}:${details || firstIssue.message}`);
  error.code = 'SEMANTIC_MODEL_VALIDATION_FAILED';
  error.adapter = adapter;
  error.validation = validation;
  error.model = model;
  throw error;
}

function roleFromInDesignType(type, item = {}) {
  if (item.table) return 'table';
  if (item.placedAsset) return 'graphic';
  if (hasTextFacts(item)) return 'text';
  if (item.vectorGeometry && String(item.vectorGeometry.kind || '').toLowerCase() === 'line') return 'line';
  const raw = String(type || '').toLowerCase();
  if (raw.includes('text')) return 'text';
  if (raw.includes('table')) return 'table';
  if (raw.includes('line')) return 'line';
  if (raw.includes('rectangle') || raw.includes('oval') || raw.includes('polygon')) return 'shape';
  return 'shape';
}

function reverseVectorGeometry(vectorGeometry) {
  if (!vectorGeometry || !Array.isArray(vectorGeometry.paths)) return null;
  return {
    kind: vectorGeometry.kind || 'path',
    paths: vectorGeometry.paths.map((path) => ({
      closed: Boolean(path && path.closed),
      points: (path && Array.isArray(path.points) ? path.points : []).map(reverseVectorPoint),
    })).filter((path) => path.points.length),
  };
}

function reverseVectorPoint(point = {}) {
  return {
    anchor: reverseVectorCoordinate(point.anchor),
    leftDirection: reverseVectorCoordinate(point.leftDirection || point.anchor),
    rightDirection: reverseVectorCoordinate(point.rightDirection || point.anchor),
    pointType: point.pointType || null,
  };
}

function reverseVectorCoordinate(value = {}) {
  return {
    x: numberOrNull(value.x) || 0,
    y: numberOrNull(value.y) || 0,
  };
}

function hasTextFacts(item = {}) {
  if (typeof item.text === 'string' && item.text.length > 0) return true;
  if (Array.isArray(item.textRuns) && item.textRuns.length > 0) return true;
  if (item.textStyle && Object.keys(item.textStyle).length > 0) return true;
  if (item.textFrameStyle && Object.keys(item.textFrameStyle).length > 0) return true;
  if (item.paragraphStyleName) return true;
  if (item.firstLineFont) return true;
  return false;
}

function htmlTagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'graphic') return 'figure';
  if (role === 'table') return 'table';
  return 'div';
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  reverseSnapshotToSemanticModel,
};
