const hasOwn = Object.prototype.hasOwnProperty;

const STRUCTURAL_KEYS = new Set(['id', 'kind', 'type']);

const PAGE_EFFECTIVE_LABEL_FIELD_PATHS = Object.freeze({
  semantic: 'pages[].effectiveLabel.semantic',
  layout: 'pages[].effectiveLabel.layout',
  parentPage: 'pages[].effectiveLabel.parentPage',
  parentPageId: 'pages[].effectiveLabel.parentPageId',
  parentPageName: 'pages[].effectiveLabel.parentPageName',
  sourceFile: 'pages[].effectiveLabel.sourceFile',
  sourceNode: 'pages[].effectiveLabel.sourceNode',
  sourceAncestorNodes: 'pages[].effectiveLabel.sourceAncestorNodes',
  sourceText: 'pages[].effectiveLabel.sourceText',
  sourceHtml: 'pages[].effectiveLabel.sourceHtml',
  htmlTag: 'pages[].effectiveLabel.htmlTag',
  className: 'pages[].effectiveLabel.className',
  sourceRuns: 'pages[].effectiveLabel.sourceRuns',
  structure: 'pages[].effectiveLabel.structure',
  grid: 'pages[].effectiveLabel.grid',
  margins: 'pages[].effectiveLabel.margins',
});

const PAGE_OBSERVED_LABEL_FIELD_PATHS = Object.freeze({
  semantic: 'pages[].observedLabel.semantic',
  layout: 'pages[].observedLabel.layout',
  parentPage: 'pages[].observedLabel.parentPage',
  parentPageId: 'pages[].observedLabel.parentPageId',
  parentPageName: 'pages[].observedLabel.parentPageName',
  sourceFile: 'pages[].observedLabel.sourceFile',
  sourceNode: 'pages[].observedLabel.sourceNode',
  sourceAncestorNodes: 'pages[].observedLabel.sourceAncestorNodes',
  sourceText: 'pages[].observedLabel.sourceText',
  sourceHtml: 'pages[].observedLabel.sourceHtml',
  htmlTag: 'pages[].observedLabel.htmlTag',
  className: 'pages[].observedLabel.className',
  sourceRuns: 'pages[].observedLabel.sourceRuns',
  structure: 'pages[].observedLabel.structure',
  grid: 'pages[].observedLabel.grid',
  margins: 'pages[].observedLabel.margins',
  rejectionReasons: 'pages[].observedLabel.rejectionReasons',
});

const PARENT_PAGE_FIELD_PATHS = Object.freeze({
  id: 'parentPages[].id',
  name: 'parentPages[].name',
  semantic: 'parentPages[].semantic',
  provides: 'parentPages[].provides',
  bounds: 'parentPages[].bounds',
  labels: 'parentPages[].labels',
  items: 'parentPages[].items',
});

const LAYER_FIELD_PATHS = Object.freeze({
  token: 'layers[].token',
  displayName: 'layers[].displayName',
  name: 'layers[].name',
  visible: 'layers[].visible',
  printable: 'layers[].printable',
  locked: 'layers[].locked',
  labels: 'layers[].labels',
});

const OBSERVED_LABEL_FIELD_PATHS = Object.freeze({
  role: 'items[].observedLabel.role',
  semantic: 'items[].observedLabel.semantic',
  layout: 'items[].observedLabel.layout',
  sourceNode: 'items[].observedLabel.sourceNode',
  sourceAncestorNodes: 'items[].observedLabel.sourceAncestorNodes',
  sourceFile: 'items[].observedLabel.sourceFile',
  sourceText: 'items[].observedLabel.sourceText',
  sourceHtml: 'items[].observedLabel.sourceHtml',
  htmlTag: 'items[].observedLabel.htmlTag',
  className: 'items[].observedLabel.className',
  structure: 'items[].observedLabel.structure',
  sourceRuns: 'items[].observedLabel.sourceRuns',
  rejectionReasons: 'items[].observedLabel.rejectionReasons',
});

const STYLE_COLLECTION_KEYS = new Set([
  'paragraphStyles',
  'characterStyles',
  'objectStyles',
  'frameStyles',
  'tableStyles',
  'cellStyles',
  'compositeFonts',
]);

const STYLE_RESOURCE_KEYS = new Set([
  'name',
  'token',
  'displayName',
  'safeName',
  'css',
  'source',
]);

const STYLE_INDESIGN_FEATURE_KEYS = new Set([
  'compositeFont',
  'dropCap',
  'list',
  'grepStyles',
  'nestedStyles',
]);

const COMPOSITE_FONT_KEYS = new Set([
  'name',
  'safeName',
  'hasBoldCJK',
  'cjkWeight',
  'romanWeight',
]);

const COMPOSITE_FONT_ENTRY_KEYS = new Set([
  'name',
  'fontStyle',
  'size',
  'weight',
]);

function scanPageEffectiveLabel(paths, seen, value) {
  scanObjectSurface(paths, seen, value, PAGE_EFFECTIVE_LABEL_FIELD_PATHS, 'pages[].effectiveLabel');
}

function scanPageObservedLabel(paths, seen, value) {
  scanObjectSurface(paths, seen, value, PAGE_OBSERVED_LABEL_FIELD_PATHS, 'pages[].observedLabel');
}

function scanItemObservedLabel(paths, seen, value) {
  scanObjectSurface(paths, seen, value, OBSERVED_LABEL_FIELD_PATHS, 'items[].observedLabel');
}

function scanParentPages(paths, seen, parentPages, scanLabelArray, scanParentPageItems) {
  if (!Array.isArray(parentPages)) {
    return;
  }

  for (const parentPage of parentPages) {
    if (!isPlainObject(parentPage)) {
      continue;
    }

    for (const [key, value] of Object.entries(parentPage)) {
      if (key === 'labels') {
        addPath(paths, seen, PARENT_PAGE_FIELD_PATHS.labels);
        scanLabelArray(paths, seen, value);
      } else if (key === 'items') {
        addPath(paths, seen, PARENT_PAGE_FIELD_PATHS.items);
        scanParentPageItems(paths, seen, value);
      } else if (hasOwn.call(PARENT_PAGE_FIELD_PATHS, key)) {
        addPath(paths, seen, PARENT_PAGE_FIELD_PATHS[key]);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `parentPages[].${key}`);
      }
    }
  }
}

function scanLayerArray(paths, seen, layers, scanLabelArray) {
  if (!Array.isArray(layers)) {
    return;
  }

  for (const layer of layers) {
    if (!isPlainObject(layer)) {
      continue;
    }

    for (const [key, value] of Object.entries(layer)) {
      if (key === 'labels') {
        addPath(paths, seen, LAYER_FIELD_PATHS.labels);
        scanLabelArray(paths, seen, value);
      } else if (hasOwn.call(LAYER_FIELD_PATHS, key)) {
        addPath(paths, seen, LAYER_FIELD_PATHS[key]);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `layers[].${key}`);
      }
    }
  }
}

function scanStyles(paths, seen, styles, scanLabelArray) {
  if (Array.isArray(styles)) {
    scanStyleResourceArray(paths, seen, styles, 'styles[]', null, scanLabelArray);
    return;
  }
  if (!isPlainObject(styles)) {
    return;
  }

  for (const [key, value] of Object.entries(styles)) {
    if (STYLE_COLLECTION_KEYS.has(key)) {
      const collectionPath = `styles.${key}`;
      addPath(paths, seen, collectionPath);
      scanStyleCollection(paths, seen, value, `${collectionPath}[]`, key, scanLabelArray);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `styles.${key}`);
    }
  }
}

function scanStyleCollection(paths, seen, value, prefix, collectionKey, scanLabelArray) {
  if (Array.isArray(value)) {
    scanStyleResourceArray(paths, seen, value, prefix, collectionKey, scanLabelArray);
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }

  for (const resource of Object.values(value)) {
    scanStyleResource(paths, seen, resource, prefix, collectionKey, scanLabelArray);
  }
}

function scanStyleResourceArray(paths, seen, values, prefix, collectionKey, scanLabelArray) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    scanStyleResource(paths, seen, value, prefix, collectionKey, scanLabelArray);
  }
}

function scanStyleResource(paths, seen, value, prefix, collectionKey, scanLabelArray) {
  if (!isPlainObject(value)) {
    return;
  }

  if (collectionKey === 'compositeFonts') {
    scanCompositeFont(paths, seen, value, prefix);
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    if (key === 'labels') {
      addPath(paths, seen, `${prefix}.labels`);
      scanLabelArray(paths, seen, item);
    } else if (key === 'indesignFeatures') {
      addPath(paths, seen, `${prefix}.indesignFeatures`);
      scanObjectKeys(paths, seen, item, `${prefix}.indesignFeatures`, STYLE_INDESIGN_FEATURE_KEYS);
    } else if (STYLE_RESOURCE_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    }
  }
}

function scanCompositeFont(paths, seen, value, prefix) {
  for (const [key, item] of Object.entries(value)) {
    if (key === 'entries') {
      addPath(paths, seen, `${prefix}.entries`);
      scanCompositeFontEntries(paths, seen, item, `${prefix}.entries[]`);
    } else if (COMPOSITE_FONT_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    }
  }
}

function scanCompositeFontEntries(paths, seen, entries, prefix) {
  if (!Array.isArray(entries)) {
    return;
  }

  for (const entry of entries) {
    scanObjectKeys(paths, seen, entry, prefix, COMPOSITE_FONT_ENTRY_KEYS);
  }
}

function scanObjectSurface(paths, seen, value, pathByKey, prefix) {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (hasOwn.call(pathByKey, key)) {
      addPath(paths, seen, pathByKey[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    }
  }
}

function scanObjectKeys(paths, seen, value, prefix, knownKeys) {
  if (!isPlainObject(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (knownKeys.has(key) || !STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `${prefix}.${key}`);
    }
  }
}

function addPath(paths, seen, path) {
  if (seen.has(path)) {
    return;
  }
  seen.add(path);
  paths.push(path);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  scanItemObservedLabel,
  scanLayerArray,
  scanPageEffectiveLabel,
  scanPageObservedLabel,
  scanParentPages,
  scanStyles,
});
