const path = require('path');
const {
  parseLabeledSegments,
  parseSlotName,
  parseSlotType,
} = require('../shared/labels');

const LEGACY_SOURCE = 'legacy-blueprint';
const LEGACY_LAYOUT = 'legacy-template';
const SLOT_CONFIDENCE = 0.85;
const OBSERVATION_CONFIDENCE = 0.65;

function legacyBlueprintToSemanticModel(blueprint, options = {}) {
  assertBlueprint(blueprint);
  const mode = options.mode || 'observation';
  if (mode === 'authoring') {
    throw new Error('Legacy blueprint input cannot be exported in authoring mode without source-structure labels.');
  }

  const documentName = (blueprint.metadata && blueprint.metadata.documentName) || 'legacy-blueprint';
  const documentId = documentIdFromName(documentName);
  const pages = Object.entries(blueprint.masters || {}).map(([masterName, master], index) => (
    legacyMasterToPage(masterName, master, index, blueprint)
  ));
  const assets = collectAssets(pages);

  return {
    kind: 'DocumentModel',
    id: documentId,
    title: documentName,
    source: documentName,
    profile: LEGACY_SOURCE,
    unitMode: 'print',
    coordinateUnit: 'mm',
    labels: [],
    parentPages: [],
    pages,
    layers: [],
    styles: {
      paragraphStyles: legacyStyleCollection(blueprint.paragraphStyles || blueprint.styles || {}),
      characterStyles: legacyStyleCollection(blueprint.characterStyles || {}),
      objectStyles: legacyStyleCollection(blueprint.objectStyles || {}),
      frameStyles: {},
      tableStyles: {},
      cellStyles: {},
    },
    assets,
    warnings: [],
    report: {
      inputFormat: LEGACY_SOURCE,
      mode,
      inference: {
        source: LEGACY_SOURCE,
        confidence: mode === 'inferred' ? SLOT_CONFIDENCE : OBSERVATION_CONFIDENCE,
        evidence: ['legacy-master', 'legacy-slot-label', 'geometric-bounds', 'style-css'],
      },
    },
    reverseMode: mode,
  };
}

function legacyMasterToPage(masterName, master, index, blueprint) {
  const items = [];
  for (const item of master.staticItems || []) {
    items.push(legacyItemToModel(item, {
      blueprint,
      masterName,
      isSlot: false,
      sourceKey: null,
    }));
  }
  for (const [label, item] of Object.entries(master.slots || {})) {
    items.push(legacyItemToModel({ label, ...item }, {
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
    layout: LEGACY_LAYOUT,
    width: requiredNumber(master.width, `Legacy master ${masterName} is missing width`),
    height: requiredNumber(master.height, `Legacy master ${masterName} is missing height`),
    margins: null,
    guides: [],
    labels: [],
    source: LEGACY_SOURCE,
    legacy: {
      source: LEGACY_SOURCE,
      masterName,
    },
    items,
  };
}

function legacyItemToModel(item, context) {
  const legacyType = String(item.type || '').toUpperCase();
  const label = item.label || context.sourceKey || '';
  const segments = parseLabeledSegments(label);
  const slotName = context.isSlot ? parseSlotName(label) : null;
  const slotType = context.isSlot ? parseSlotType(label) : null;
  const role = roleFromLegacyType(legacyType, slotType);
  const id = String(item.id || `${context.masterName}-${role}-${context.isSlot ? slotName : 'static'}`);
  const zIndex = Number(item.zIndex);
  const inlineStyle = legacyInlineStyle(item, context.blueprint);

  return {
    id,
    role,
    semantic: context.isSlot ? slotName : semanticForStaticItem(item, role),
    tagName: tagForLegacyRole(role),
    htmlClass: htmlClassForLegacyItem({ isSlot: context.isSlot, role, slotName }),
    bounds: normalizeBounds(item.bounds, id),
    layerName: null,
    styleRefs: {
      paragraphStyle: item.appliedParagraphStyle || null,
      objectStyle: item.appliedObjectStyle || null,
      frameStyle: null,
    },
    content: { text: normalizeText(item.content || '') },
    labels: [],
    source: LEGACY_SOURCE,
    zIndex: Number.isFinite(zIndex) ? zIndex : null,
    inlineStyle,
    asset: legacyAsset(item),
    legacy: {
      source: LEGACY_SOURCE,
      isSlot: Boolean(context.isSlot),
      label: label || null,
      slotName,
      slotType,
      description: segmentValue(segments, ['说明', 'description', 'desc']),
      confidence: context.isSlot ? SLOT_CONFIDENCE : OBSERVATION_CONFIDENCE,
      evidence: legacyEvidence(context.isSlot, item),
    },
  };
}

function legacyInlineStyle(item, blueprint) {
  const parts = [];
  const objectStyle = styleCss(blueprint.objectStyles, item.appliedObjectStyle);
  const paragraphStyle = styleCss(blueprint.paragraphStyles || blueprint.styles, item.appliedParagraphStyle);
  if (objectStyle) parts.push(objectStyle);
  if (paragraphStyle) parts.push(paragraphStyle);
  if (item.inlineCSS) parts.push(item.inlineCSS);
  if (Number.isFinite(Number(item.zIndex))) parts.push(`z-index:${Number(item.zIndex)}`);
  return parts.filter(Boolean).join('; ');
}

function legacyAsset(item) {
  if (!item.imagePath) return null;
  return {
    id: assetIdFromPath(item.imagePath),
    path: item.imagePath,
    cropped: Boolean(item.imageCropped),
    imageSize: item.imageSize || null,
    source: LEGACY_SOURCE,
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

function legacyStyleCollection(styles) {
  const out = {};
  for (const [name, style] of Object.entries(styles || {})) {
    const token = style.name || name;
    out[token] = {
      name: style.name || name,
      token,
      displayName: style.name || name,
      safeName: style.safeName || null,
      css: style.css || '',
      source: LEGACY_SOURCE,
      labels: [],
      legacy: omitUndefined({
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

function roleFromLegacyType(type, slotType) {
  if (slotType === 'IMAGE') return 'graphic';
  if (type === 'TEXT') return 'text';
  if (type === 'IMAGE') return 'graphic';
  if (type === 'LINE') return 'line';
  if (type === 'RECT' || type === 'OVAL' || type === 'POLYGON') return 'shape';
  return 'graphic';
}

function tagForLegacyRole(role) {
  if (role === 'text') return 'div';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function htmlClassForLegacyItem(item) {
  return [
    'id-object',
    'legacy-item',
    item.isSlot ? 'legacy-slot' : 'legacy-static',
    `legacy-${item.role}`,
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
  return `legacy-${role}`;
}

function legacyEvidence(isSlot, item) {
  const evidence = ['geometric-bounds'];
  if (isSlot) evidence.push('slot-label');
  if (item.appliedObjectStyle) evidence.push('object-style');
  if (item.appliedParagraphStyle) evidence.push('paragraph-style');
  if (item.imagePath) evidence.push('placed-asset');
  if (item.inlineCSS) evidence.push('inline-css');
  return evidence;
}

function normalizeBounds(bounds, itemId) {
  if (!bounds) throw new Error(`Legacy item ${itemId} is missing bounds`);
  return {
    x: requiredNumber(bounds.x, `Legacy item ${itemId} bounds is missing x`),
    y: requiredNumber(bounds.y, `Legacy item ${itemId} bounds is missing y`),
    width: requiredNumber(bounds.width, `Legacy item ${itemId} bounds is missing width`),
    height: requiredNumber(bounds.height, `Legacy item ${itemId} bounds is missing height`),
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
  const parsed = path.parse(String(name || 'legacy-blueprint'));
  return parsed.name || 'legacy-blueprint';
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
    throw new Error('legacyBlueprintToSemanticModel requires a blueprint object');
  }
  if (!blueprint.masters || typeof blueprint.masters !== 'object') {
    throw new Error('legacy blueprint is missing masters');
  }
}

function omitUndefined(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value || {})) {
    if (entry !== undefined && entry !== null) out[key] = entry;
  }
  return out;
}

module.exports = {
  legacyBlueprintToSemanticModel,
};
