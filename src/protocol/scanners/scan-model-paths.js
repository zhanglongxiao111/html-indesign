const hasOwn = Object.prototype.hasOwnProperty;

const ROOT_FIELD_PATHS = Object.freeze({
  id: 'document.id',
  profile: 'document.profile',
});

const PAGE_FIELD_PATHS = Object.freeze({
  id: 'pages[].id',
  layout: 'pages[].layout',
  semanticLayout: 'pages[].semanticLayout',
  grid: 'pages[].grid',
});

const ASSET_FIELD_PATHS = Object.freeze({
  path: 'assets[].path',
  src: 'assets[].src',
  resolvedPath: 'assets[].resolvedPath',
});

const LABEL_FIELD_PATHS = Object.freeze({
  protocol: 'labels[].protocol',
  version: 'labels[].version',
  kind: 'labels[].kind',
  id: 'labels[].id',
  source: 'labels[].source',
  grid: 'labels[].grid',
  semantic: 'labels[].semantic',
  layout: 'labels[].layout',
  role: 'labels[].role',
  styleRefs: 'labels[].styleRefs',
  paragraphStyle: 'labels[].paragraphStyle',
  paragraphStyleToken: 'labels[].paragraphStyleToken',
  characterStyle: 'labels[].characterStyle',
  characterStyleToken: 'labels[].characterStyleToken',
  objectStyle: 'labels[].objectStyle',
  objectStyleToken: 'labels[].objectStyleToken',
  tableStyle: 'labels[].tableStyle',
  tableStyleToken: 'labels[].tableStyleToken',
  layer: 'labels[].layer',
  layerToken: 'labels[].layerToken',
  sourceNode: 'labels[].sourceNode',
  sourceAncestorNodes: 'labels[].sourceAncestorNodes',
  sourceFile: 'labels[].sourceFile',
  sourceText: 'labels[].sourceText',
  sourceHtml: 'labels[].sourceHtml',
  htmlTag: 'labels[].htmlTag',
  className: 'labels[].className',
  structure: 'labels[].structure',
  sourceRuns: 'labels[].sourceRuns',
  parentPage: 'labels[].parentPage',
  parentPageId: 'labels[].parentPageId',
  parentPageName: 'labels[].parentPageName',
  margins: 'labels[].margins',
});

const ITEM_FIELD_PATHS = Object.freeze({
  semantic: 'items[].semantic',
  layout: 'pages[].items[].layout',
  role: 'items[].role',
  paragraphStyle: 'items[].paragraphStyle',
  characterStyle: 'items[].characterStyle',
  objectStyle: 'items[].objectStyle',
  frameStyle: 'items[].frameStyle',
  cellStyle: 'items[].cellStyle',
  layer: 'items[].layer',
  layerToken: 'items[].layerToken',
  text: 'items[].text',
  textRuns: 'items[].textRuns',
  textStyle: 'items[].textStyle',
  sourceFile: 'items[].sourceFile',
  sourceNode: 'items[].sourceNode',
  sourceAncestorNodes: 'items[].sourceAncestorNodes',
  effectiveLabel: 'items[].effectiveLabel',
  observedLabel: 'items[].observedLabel',
  structure: 'items[].structure',
  sourceRuns: 'items[].sourceRuns',
});

const EFFECTIVE_LABEL_FIELD_PATHS = Object.freeze({
  semantic: 'items[].effectiveLabel.semantic',
  sourceNode: 'effectiveLabel.sourceNode',
  sourceAncestorNodes: 'effectiveLabel.sourceAncestorNodes',
  sourceFile: 'effectiveLabel.sourceFile',
  sourceText: 'effectiveLabel.sourceText',
  sourceHtml: 'effectiveLabel.sourceHtml',
  htmlTag: 'effectiveLabel.htmlTag',
  className: 'effectiveLabel.className',
  structure: 'effectiveLabel.structure',
  sourceRuns: 'effectiveLabel.sourceRuns',
});

const ITEM_ASSET_FIELD_PATHS = Object.freeze({
  path: 'items[].asset.path',
  pageNumber: 'items[].asset.pageNumber',
});

const ITEM_ASSET_PLACEMENT_FIELD_PATHS = Object.freeze({
  pageNumber: 'items[].asset.placement.pageNumber',
});

const ITEM_STYLE_REFS_FIELD_PATHS = Object.freeze({
  paragraphStyle: 'items[].styleRefs.paragraphStyle',
  characterStyle: 'items[].styleRefs.characterStyle',
  objectStyle: 'items[].styleRefs.objectStyle',
  frameStyle: 'items[].styleRefs.frameStyle',
  tableStyle: 'items[].styleRefs.tableStyle',
  cellStyle: 'items[].styleRefs.cellStyle',
  layer: 'items[].styleRefs.layer',
});

const LABEL_STYLE_REFS_FIELD_PATHS = Object.freeze({
  paragraphStyle: 'items[].styleRefs.paragraphStyle',
  paragraphStyleToken: 'items[].styleRefs.paragraphStyle',
  characterStyle: 'items[].styleRefs.characterStyle',
  characterStyleToken: 'items[].styleRefs.characterStyle',
  objectStyle: 'items[].styleRefs.objectStyle',
  objectStyleToken: 'items[].styleRefs.objectStyle',
  frameStyle: 'items[].styleRefs.frameStyle',
  frameStyleToken: 'items[].styleRefs.frameStyle',
  tableStyle: 'items[].styleRefs.tableStyle',
  tableStyleToken: 'items[].styleRefs.tableStyle',
  cellStyle: 'items[].styleRefs.cellStyle',
  cellStyleToken: 'items[].styleRefs.cellStyle',
  layer: 'items[].styleRefs.layer',
  layerToken: 'items[].styleRefs.layer',
});

const ITEM_VISUAL_STYLE_FIELD_PATHS = Object.freeze({
  fillColor: 'items[].visualStyle.fillColor',
  strokeColor: 'items[].visualStyle.strokeColor',
  strokeWeight: 'items[].visualStyle.strokeWeight',
});

const ITEM_VECTOR_GEOMETRY_FIELD_PATHS = Object.freeze({
  kind: 'items[].vectorGeometry.kind',
  paths: 'items[].vectorGeometry.paths',
});

const ITEM_CONTENT_FIELD_PATHS = Object.freeze({
  text: 'items[].content.text',
  runs: 'items[].content.runs',
});

const ITEM_CONTENT_RUN_FIELD_PATHS = Object.freeze({
  characterStyle: 'items[].content.runs[].characterStyle',
});

const ITEM_TABLE_FIELD_PATHS = Object.freeze({
  rows: 'items[].table.rows',
  tableStyle: 'items[].table.tableStyle',
});

const ITEM_TABLE_ROW_FIELD_PATHS = Object.freeze({
  cells: 'items[].table.rows[].cells',
});

const STRUCTURAL_KEYS = new Set(['id', 'kind', 'type']);

function scanModelPaths(model) {
  const paths = [];
  const seen = new Set();

  if (!isPlainObject(model)) {
    return paths;
  }

  for (const [key, value] of Object.entries(model)) {
    if (hasOwn.call(ROOT_FIELD_PATHS, key)) {
      addPath(paths, seen, ROOT_FIELD_PATHS[key]);
    } else if (key === 'assets') {
      scanArraySurface(paths, seen, value, ASSET_FIELD_PATHS, 'assets[]');
    } else if (key === 'labels') {
      scanLabelArray(paths, seen, value);
    } else if (key === 'pages') {
      scanPages(paths, seen, value);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, key);
    }
  }

  return paths;
}

function scanPages(paths, seen, pages) {
  if (!Array.isArray(pages)) {
    return;
  }

  for (const page of pages) {
    if (!isPlainObject(page)) {
      continue;
    }

    for (const [key, value] of Object.entries(page)) {
      if (key === 'items') {
        scanItems(paths, seen, value);
      } else if (key === 'labels') {
        scanLabelArray(paths, seen, value);
      } else if (hasOwn.call(PAGE_FIELD_PATHS, key)) {
        addPath(paths, seen, PAGE_FIELD_PATHS[key]);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `pages[].${key}`);
      }
    }
  }
}

function scanItems(paths, seen, items) {
  if (!Array.isArray(items)) {
    return;
  }

  for (const item of items) {
    if (!isPlainObject(item)) {
      continue;
    }

    for (const [key, value] of Object.entries(item)) {
      if (key === 'effectiveLabel') {
        addPath(paths, seen, ITEM_FIELD_PATHS.effectiveLabel);
        scanObjectSurface(
          paths,
          seen,
          value,
          EFFECTIVE_LABEL_FIELD_PATHS,
          'items[].effectiveLabel',
        );
      } else if (key === 'labels') {
        scanLabelArray(paths, seen, value);
      } else if (hasOwn.call(ITEM_FIELD_PATHS, key)) {
        addPath(paths, seen, ITEM_FIELD_PATHS[key]);
      } else if (key === 'asset') {
        scanItemAsset(paths, seen, value);
      } else if (key === 'styleRefs') {
        scanObjectSurface(paths, seen, value, ITEM_STYLE_REFS_FIELD_PATHS, 'items[].styleRefs');
      } else if (key === 'visualStyle') {
        scanObjectSurface(paths, seen, value, ITEM_VISUAL_STYLE_FIELD_PATHS, 'items[].visualStyle');
      } else if (key === 'vectorGeometry') {
        scanObjectSurface(paths, seen, value, ITEM_VECTOR_GEOMETRY_FIELD_PATHS, 'items[].vectorGeometry');
      } else if (key === 'content') {
        scanItemContent(paths, seen, value);
      } else if (key === 'table') {
        scanItemTable(paths, seen, value);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `pages[].items[].${key}`);
      }
    }
  }
}

function scanLabelArray(paths, seen, labels) {
  if (!Array.isArray(labels)) {
    return;
  }

  for (const label of labels) {
    scanLabelSurface(paths, seen, label);
  }
}

function scanLabelSurface(paths, seen, label) {
  if (!isPlainObject(label)) {
    return;
  }

  for (const [key, value] of Object.entries(label)) {
    if (key === 'styleRefs') {
      addPath(paths, seen, LABEL_FIELD_PATHS.styleRefs);
      scanObjectSurface(paths, seen, value, LABEL_STYLE_REFS_FIELD_PATHS, 'labels[].styleRefs');
    } else if (hasOwn.call(LABEL_FIELD_PATHS, key)) {
      addPath(paths, seen, LABEL_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `labels[].${key}`);
    }
  }
}

function scanItemAsset(paths, seen, asset) {
  if (!isPlainObject(asset)) {
    return;
  }

  for (const [key, value] of Object.entries(asset)) {
    if (key === 'placement') {
      scanObjectSurface(
        paths,
        seen,
        value,
        ITEM_ASSET_PLACEMENT_FIELD_PATHS,
        'items[].asset.placement',
      );
    } else if (hasOwn.call(ITEM_ASSET_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_ASSET_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `items[].asset.${key}`);
    }
  }
}

function scanItemContent(paths, seen, content) {
  if (!isPlainObject(content)) {
    return;
  }

  for (const [key, value] of Object.entries(content)) {
    if (key === 'runs') {
      addPath(paths, seen, ITEM_CONTENT_FIELD_PATHS.runs);
      scanArraySurface(
        paths,
        seen,
        value,
        ITEM_CONTENT_RUN_FIELD_PATHS,
        'items[].content.runs[]',
      );
    } else if (hasOwn.call(ITEM_CONTENT_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_CONTENT_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `items[].content.${key}`);
    }
  }
}

function scanItemTable(paths, seen, table) {
  if (!isPlainObject(table)) {
    return;
  }

  for (const [key, value] of Object.entries(table)) {
    if (key === 'rows') {
      addPath(paths, seen, ITEM_TABLE_FIELD_PATHS.rows);
      scanArraySurface(
        paths,
        seen,
        value,
        ITEM_TABLE_ROW_FIELD_PATHS,
        'items[].table.rows[]',
      );
    } else if (hasOwn.call(ITEM_TABLE_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_TABLE_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `items[].table.${key}`);
    }
  }
}

function scanArraySurface(paths, seen, values, pathByKey, prefix) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    scanObjectSurface(paths, seen, value, pathByKey, prefix);
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
  scanModelPaths,
});
