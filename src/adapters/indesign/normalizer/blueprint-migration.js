const path = require('path');
const {
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
  createProtocolLabel,
} = require('../../../shared/labels');
const { validateSemanticModel } = require('../../../semantic-model');

const HISTORICAL_BLUEPRINT_INPUT = 'historical-blueprint';
const BLUEPRINT_MIGRATION_SOURCE = 'blueprint-migration';
const BLUEPRINT_MIGRATION_LAYOUT = 'blueprint-migration';
const SLOT_CONFIDENCE = 0.85;
const OBSERVATION_CONFIDENCE = 0.65;
const ADAPTER_VALIDATION_OPTIONS = Object.freeze({
  strictFields: true,
});

function blueprintMigrationToSemanticModel(blueprint, options = {}) {
  assertBlueprint(blueprint);
  const mode = options.mode || 'observation';
  if (mode === 'authoring') {
    throw new Error('Historical blueprint input cannot be exported in authoring mode without source-structure labels.');
  }

  const documentName = (blueprint.metadata && blueprint.metadata.documentName) || HISTORICAL_BLUEPRINT_INPUT;
  const documentId = documentIdFromName(documentName);
  const pages = Object.entries(blueprint.masters || {}).map(([masterName, master], index) => (
    blueprintMasterToPage(masterName, master, index, blueprint)
  ));
  const assets = collectAssets(pages);

  const model = {
    kind: 'DocumentModel',
    id: documentId,
    title: documentName,
    source: documentName,
    unitMode: 'print',
    coordinateUnit: 'mm',
    labels: [createProtocolLabel({
      kind: 'document',
      id: documentId,
      source: BLUEPRINT_MIGRATION_SOURCE,
      title: documentName,
      unitMode: 'print',
      coordinateUnit: 'mm',
    })],
    parentPages: [],
    pages,
    layers: [],
    styles: {
      paragraphStyles: blueprintStyleCollection(blueprint.paragraphStyles || blueprint.styles || {}),
      characterStyles: blueprintStyleCollection(blueprint.characterStyles || {}),
      objectStyles: blueprintStyleCollection(blueprint.objectStyles || {}),
      frameStyles: {},
      tableStyles: {},
      cellStyles: {},
    },
    assets,
    warnings: [],
    report: {
      inputFormat: HISTORICAL_BLUEPRINT_INPUT,
      mode,
      inference: {
        source: BLUEPRINT_MIGRATION_SOURCE,
        confidence: mode === 'inferred' ? SLOT_CONFIDENCE : OBSERVATION_CONFIDENCE,
        evidence: ['blueprint-master', 'blueprint-slot-label', 'geometric-bounds', 'style-css'],
      },
    },
    reverseMode: mode,
  };
  const validation = validateSemanticModel(model, ADAPTER_VALIDATION_OPTIONS);
  throwIfSemanticModelInvalid(model, validation, 'indesign blueprintMigrationToSemanticModel');
  return model;
}

function blueprintMasterToPage(masterName, master, index, blueprint) {
  const items = [];
  for (const item of master.staticItems || []) {
    items.push(blueprintItemToModel(item, {
      blueprint,
      masterName,
      isSlot: false,
      sourceKey: null,
    }));
  }
  for (const [label, item] of Object.entries(master.slots || {})) {
    items.push(blueprintItemToModel({ label, ...item }, {
      blueprint,
      masterName,
      isSlot: true,
      sourceKey: label,
    }));
  }

  items.sort((a, b) => {
    const left = Number.isFinite(a.zIndex) ? a.zIndex : 0;
    const right = Number.isFinite(b.zIndex) ? b.zIndex : 0;
    return left - right;
  });

  return {
    id: masterName,
    index,
    semantic: masterName,
    parentPageId: null,
    parentPageName: null,
    layout: BLUEPRINT_MIGRATION_LAYOUT,
    width: requiredNumber(master.width, `Historical blueprint master ${masterName} is missing width`),
    height: requiredNumber(master.height, `Historical blueprint master ${masterName} is missing height`),
    margins: null,
    guides: [],
    labels: [createProtocolLabel({
      kind: 'page',
      id: masterName,
      source: BLUEPRINT_MIGRATION_SOURCE,
      semantic: masterName,
      layout: BLUEPRINT_MIGRATION_LAYOUT,
    })],
    source: BLUEPRINT_MIGRATION_SOURCE,
    migration: {
      source: BLUEPRINT_MIGRATION_SOURCE,
      masterName,
    },
    items,
  };
}

function blueprintItemToModel(item, context) {
  const blueprintType = String(item.type || '').toUpperCase();
  const label = item.label || context.sourceKey || '';
  const segments = parseLabeledSegments(label);
  const slotName = context.isSlot ? parseSlotName(label) : null;
  const slotType = context.isSlot ? parseSlotType(label) : null;
  const role = roleFromBlueprintType(blueprintType, slotType);
  const id = String(item.id || `${context.masterName}-${role}-${context.isSlot ? slotName : 'static'}`);
  const zIndex = Number(item.zIndex);
  const inlineStyle = blueprintInlineStyle(item, context.blueprint);

  return {
    id,
    role,
    semantic: context.isSlot ? slotName : semanticForStaticItem(item, role),
    tagName: tagForBlueprintRole(role),
    htmlClass: htmlClassForBlueprintItem({ isSlot: context.isSlot, role, slotName }),
    bounds: normalizeBounds(item.bounds, id),
    layerName: null,
    styleRefs: {
      paragraphStyle: item.appliedParagraphStyle || null,
      objectStyle: item.appliedObjectStyle || null,
      frameStyle: null,
    },
    content: { text: normalizeText(item.content || '') },
    labels: [createProtocolLabel({
      kind: 'item',
      id,
      source: BLUEPRINT_MIGRATION_SOURCE,
      role,
      semantic: context.isSlot ? slotName : semanticForStaticItem(item, role),
      htmlTag: tagForBlueprintRole(role),
      className: htmlClassForBlueprintItem({ isSlot: context.isSlot, role, slotName }),
      sourceText: normalizeText(item.content || ''),
    })],
    source: BLUEPRINT_MIGRATION_SOURCE,
    zIndex: Number.isFinite(zIndex) ? zIndex : null,
    inlineStyle,
    asset: blueprintAsset(item),
    migration: {
      source: BLUEPRINT_MIGRATION_SOURCE,
      isSlot: Boolean(context.isSlot),
      label: label || null,
      slotName,
      slotType,
      description: segmentValue(segments, ['说明', 'description', 'desc']),
      confidence: context.isSlot ? SLOT_CONFIDENCE : OBSERVATION_CONFIDENCE,
      evidence: blueprintEvidence(context.isSlot, item),
    },
  };
}

function blueprintInlineStyle(item, blueprint) {
  const parts = [];
  const objectStyle = styleCss(blueprint.objectStyles, item.appliedObjectStyle);
  const paragraphStyle = styleCss(blueprint.paragraphStyles || blueprint.styles, item.appliedParagraphStyle);
  if (objectStyle) parts.push(objectStyle);
  if (paragraphStyle) parts.push(paragraphStyle);
  if (item.inlineCSS) parts.push(item.inlineCSS);
  if (Number.isFinite(Number(item.zIndex))) parts.push(`z-index:${Number(item.zIndex)}`);
  return parts.filter(Boolean).join('; ');
}

function blueprintAsset(item) {
  if (!item.imagePath) return null;
  return {
    id: assetIdFromPath(item.imagePath),
    path: item.imagePath,
    cropped: Boolean(item.imageCropped),
    imageSize: item.imageSize || null,
    source: BLUEPRINT_MIGRATION_SOURCE,
  };
}

function collectAssets(pages) {
  const seen = new Map();
  for (const page of pages) {
    for (const item of page.items || []) {
      if (!item.asset || !item.asset.path) continue;
      if (!seen.has(item.asset.path)) {
        seen.set(item.asset.path, item.asset);
      }
    }
  }
  return Array.from(seen.values());
}

function blueprintStyleCollection(styles) {
  const out = {};
  for (const [name, style] of Object.entries(styles || {})) {
    const token = style.name || name;
    out[token] = {
      name: style.name || name,
      token,
      displayName: style.name || name,
      safeName: style.safeName || null,
      css: style.css || '',
      source: BLUEPRINT_MIGRATION_SOURCE,
      labels: [],
      indesignFeatures: omitUndefined({
        dropCap: style.dropCap,
        list: style.list,
        grepStyles: style.grepStyles,
        nestedStyles: style.nestedStyles,
        compositeFont: style.compositeFont,
      }),
    };
  }
  return out;
}

function roleFromBlueprintType(type, slotType) {
  if (slotType === 'IMAGE') return 'graphic';
  if (type === 'TEXT') return 'text';
  if (type === 'IMAGE') return 'graphic';
  if (type === 'LINE') return 'line';
  if (type === 'RECT' || type === 'OVAL' || type === 'POLYGON') return 'shape';
  return 'graphic';
}

function tagForBlueprintRole(role) {
  if (role === 'text') return 'div';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function htmlClassForBlueprintItem(item) {
  return [
    'id-object',
    'migration-item',
    item.isSlot ? 'migration-slot' : 'migration-static',
    `migration-${item.role}`,
    item.slotName ? `slot-${safeClassToken(item.slotName)}` : null,
  ].filter(Boolean).join(' ');
}

function semanticForStaticItem(item, role) {
  if (item.appliedObjectStyle && !String(item.appliedObjectStyle).startsWith('[')) {
    return item.appliedObjectStyle;
  }
  if (item.appliedParagraphStyle && !String(item.appliedParagraphStyle).startsWith('[')) {
    return item.appliedParagraphStyle;
  }
  return `blueprint-${role}`;
}

function blueprintEvidence(isSlot, item) {
  const evidence = ['geometric-bounds'];
  if (isSlot) evidence.push('slot-label');
  if (item.appliedObjectStyle) evidence.push('object-style');
  if (item.appliedParagraphStyle) evidence.push('paragraph-style');
  if (item.imagePath) evidence.push('placed-asset');
  if (item.inlineCSS) evidence.push('inline-css');
  return evidence;
}

function normalizeBounds(bounds, itemId) {
  if (!bounds) throw new Error(`Historical blueprint item ${itemId} is missing bounds`);
  return {
    x: requiredNumber(bounds.x, `Historical blueprint item ${itemId} bounds is missing x`),
    y: requiredNumber(bounds.y, `Historical blueprint item ${itemId} bounds is missing y`),
    width: requiredNumber(bounds.width, `Historical blueprint item ${itemId} bounds is missing width`),
    height: requiredNumber(bounds.height, `Historical blueprint item ${itemId} bounds is missing height`),
  };
}

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function styleCss(styles, name) {
  if (!styles || !name || !styles[name]) return '';
  return styles[name].css || '';
}

function segmentValue(segments, keys) {
  const normalized = keys.map((key) => key.toLowerCase());
  for (const [key, value] of Object.entries(segments || {})) {
    if (normalized.includes(key.toLowerCase())) return value;
  }
  return null;
}

function documentIdFromName(name) {
  const parsed = path.parse(String(name || HISTORICAL_BLUEPRINT_INPUT));
  return parsed.name || HISTORICAL_BLUEPRINT_INPUT;
}

function assetIdFromPath(value) {
  const raw = String(value || 'asset');
  const filename = raw.split(/[\\/]/).pop() || raw;
  return safeClassToken(path.parse(filename).name || filename);
}

function safeClassToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function requiredNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(message);
  }
  return number;
}

function assertBlueprint(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') {
    throw new Error('blueprintMigrationToSemanticModel requires a blueprint object');
  }
  if (!blueprint.masters || typeof blueprint.masters !== 'object') {
    throw new Error('historical blueprint is missing masters');
  }
}

function throwIfSemanticModelInvalid(model, validation, adapter) {
  if (validation.valid) return;
  const issues = validation.errors || [];
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

function omitUndefined(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value || {})) {
    if (entry !== undefined && entry !== null) out[key] = entry;
  }
  return out;
}

module.exports = {
  blueprintMigrationToSemanticModel,
};
