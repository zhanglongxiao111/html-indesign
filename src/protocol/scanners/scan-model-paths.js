const hasOwn = Object.prototype.hasOwnProperty;
const {
  scanItemEffectiveLabel,
  scanItemObservedLabel,
  scanLayerArray,
  scanPageEffectiveLabel,
  scanPageObservedLabel,
  scanParentPages,
  scanStyles,
} = require('./model-surface-paths');

const ROOT_FIELD_PATHS = Object.freeze({
  id: 'document.id',
  title: 'document.title',
  profile: 'document.profile',
  source: 'document.source',
  unitMode: 'document.unitMode',
  coordinateUnit: 'document.coordinateUnit',
  styleLayout: 'document.styleLayout',
  sourcePackage: 'document.sourcePackage',
  parentPages: 'parentPages',
  layers: 'layers',
  styles: 'styles',
  warnings: 'warnings',
  errors: 'errors',
  fieldValidation: 'fieldValidation',
  report: 'report',
  valid: 'valid',
  reverseMode: 'reverseMode',
});

const PAGE_FIELD_PATHS = Object.freeze({
  id: 'pages[].id',
  index: 'pages[].index',
  semantic: 'pages[].semantic',
  attributes: 'pages[].attributes',
  classList: 'pages[].classList',
  computedStyle: 'pages[].computedStyle',
  layout: 'pages[].layout',
  semanticLayout: 'pages[].semanticLayout',
  sourceNode: 'pages[].sourceNode',
  grid: 'pages[].grid',
  margins: 'pages[].margins',
  width: 'pages[].width',
  height: 'pages[].height',
  guides: 'pages[].guides',
  labelStatus: 'pages[].labelStatus',
  effectiveLabel: 'pages[].effectiveLabel',
  observedLabel: 'pages[].observedLabel',
  rejectedFields: 'pages[].rejectedFields',
  rejectionReasons: 'pages[].rejectionReasons',
  migration: 'pages[].migration',
});

const ASSET_FIELD_PATHS = Object.freeze({
  name: 'assets[].name',
  kind: 'assets[].kind',
  path: 'assets[].path',
  status: 'assets[].status',
  src: 'assets[].src',
  resolvedPath: 'assets[].resolvedPath',
  fileName: 'assets[].fileName',
  linked: 'assets[].linked',
  placement: 'assets[].placement',
  sourceSelector: 'assets[].sourceSelector',
  source: 'assets[].source',
  imageSize: 'assets[].imageSize',
  cropped: 'assets[].cropped',
});

const LABEL_FIELD_PATHS = Object.freeze({
  protocol: 'labels[].protocol',
  version: 'labels[].version',
  kind: 'labels[].kind',
  id: 'labels[].id',
  name: 'labels[].name',
  token: 'labels[].token',
  displayName: 'labels[].displayName',
  styleKind: 'labels[].styleKind',
  htmlClass: 'labels[].htmlClass',
  generated: 'labels[].generated',
  title: 'document.title',
  profile: 'document.profile',
  source: 'labels[].source',
  unitMode: 'document.unitMode',
  coordinateUnit: 'document.coordinateUnit',
  sourcePackage: 'document.sourcePackage',
  provides: 'parentPages[].provides',
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
  type: 'items[].type',
  sourceType: 'items[].sourceType',
  effects: 'items[].effects',
  textFrameStyle: 'items[].textFrameStyle',
  tagName: 'items[].tagName',
  htmlClass: 'items[].htmlClass',
  attributes: 'items[].attributes',
  classList: 'items[].classList',
  computedStyle: 'items[].computedStyle',
  authoredStyle: 'items[].authoredStyle',
  sourceSelector: 'items[].sourceSelector',
  boundsMm: 'items[].boundsMm',
  box: 'items[].box',
  bounds: 'items[].bounds',
  layerName: 'items[].layerName',
  semantic: 'items[].semantic',
  layout: 'items[].layout',
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
  source: 'items[].source',
  sourceFile: 'items[].sourceFile',
  sourceNode: 'items[].sourceNode',
  sourceAncestorNodes: 'items[].sourceAncestorNodes',
  effectiveLabel: 'items[].effectiveLabel',
  observedLabel: 'items[].observedLabel',
  structure: 'items[].structure',
  sourceRuns: 'items[].sourceRuns',
  inlineStyle: 'items[].inlineStyle',
  styleOverrides: 'items[].styleOverrides',
  styleRefs: 'items[].styleRefs',
  zIndex: 'items[].zIndex',
  firstLineFont: 'items[].firstLineFont',
  labelStatus: 'pages[].items[].labelStatus',
  rejectedFields: 'pages[].items[].rejectedFields',
  rejectionReasons: 'pages[].items[].rejectionReasons',
  migration: 'items[].migration',
});

const ITEM_ASSET_FIELD_PATHS = Object.freeze({
  name: 'items[].asset.name',
  path: 'items[].asset.path',
  status: 'items[].asset.status',
  bounds: 'items[].asset.bounds',
  graphicType: 'items[].asset.graphicType',
  imageTypeName: 'items[].asset.imageTypeName',
  cropped: 'items[].asset.cropped',
  preview: 'items[].asset.preview',
  pageNumber: 'items[].asset.pageNumber',
  source: 'items[].asset.source',
  imageSize: 'items[].asset.imageSize',
});

const ITEM_ASSET_PLACEMENT_FIELD_PATHS = Object.freeze({
  pageNumber: 'items[].asset.placement.pageNumber',
  crop: 'items[].asset.placement.crop',
  fit: 'items[].asset.placement.fit',
  artboard: 'items[].asset.placement.artboard',
  layerComp: 'items[].asset.placement.layerComp',
  transparentBackground: 'items[].asset.placement.transparentBackground',
  visibleLayers: 'items[].asset.placement.visibleLayers',
  hiddenLayers: 'items[].asset.placement.hiddenLayers',
  preserveVector: 'items[].asset.placement.preserveVector',
  frameBounds: 'items[].asset.placement.frameBounds',
  contentBounds: 'items[].asset.placement.contentBounds',
  contentOffset: 'items[].asset.placement.contentOffset',
  contentSize: 'items[].asset.placement.contentSize',
  contentScale: 'items[].asset.placement.contentScale',
  pdfCrop: 'items[].asset.placement.pdfCrop',
  layers: 'items[].asset.placement.layers',
});

const ITEM_EXTENSION_FIELD_PATHS = Object.freeze({
  indesign: Object.freeze({
    effects: 'items[].extensions.indesign.effects',
    textFrameStyle: 'items[].extensions.indesign.textFrameStyle',
  }),
});

const PAGE_MIGRATION_FIELD_PATHS = Object.freeze({
  source: 'pages[].migration.source',
  masterName: 'pages[].migration.masterName',
});

const ITEM_MIGRATION_FIELD_PATHS = Object.freeze({
  source: 'items[].migration.source',
  isSlot: 'items[].migration.isSlot',
  label: 'items[].migration.label',
  slotName: 'items[].migration.slotName',
  slotType: 'items[].migration.slotType',
  description: 'items[].migration.description',
  confidence: 'items[].migration.confidence',
  evidence: 'items[].migration.evidence',
});

const ITEM_STYLE_REFS_FIELD_PATHS = Object.freeze({
  paragraphStyle: 'items[].styleRefs.paragraphStyle',
  characterStyle: 'items[].styleRefs.characterStyle',
  objectStyle: 'items[].styleRefs.objectStyle',
  frameStyle: 'items[].styleRefs.frameStyle',
  tableStyle: 'items[].styleRefs.tableStyle',
  cellStyle: 'items[].styleRefs.cellStyle',
  layer: 'items[].styleRefs.layer',
  synthesizedToken: 'items[].styleRefs.synthesizedToken',
  synthesizedName: 'items[].styleRefs.synthesizedName',
  genericStyle: 'items[].styleRefs.genericStyle',
  displayName: 'items[].styleRefs.displayName',
  paragraphStyleDisplayName: 'items[].styleRefs.paragraphStyleDisplayName',
  characterStyleDisplayName: 'items[].styleRefs.characterStyleDisplayName',
  objectStyleDisplayName: 'items[].styleRefs.objectStyleDisplayName',
  frameStyleDisplayName: 'items[].styleRefs.frameStyleDisplayName',
  tableStyleDisplayName: 'items[].styleRefs.tableStyleDisplayName',
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
  synthesizedToken: 'items[].styleRefs.synthesizedToken',
  synthesizedName: 'items[].styleRefs.synthesizedName',
});

const ITEM_VISUAL_STYLE_FIELD_PATHS = Object.freeze({
  fillColor: 'items[].visualStyle.fillColor',
  fillOpacity: 'items[].visualStyle.fillOpacity',
  strokeColor: 'items[].visualStyle.strokeColor',
  strokeWeight: 'items[].visualStyle.strokeWeight',
  opacity: 'items[].visualStyle.opacity',
  strokeOpacity: 'items[].visualStyle.strokeOpacity',
  strokeStyle: 'items[].visualStyle.strokeStyle',
  strokeLineCap: 'items[].visualStyle.strokeLineCap',
  strokeLineJoin: 'items[].visualStyle.strokeLineJoin',
  strokeMiterLimit: 'items[].visualStyle.strokeMiterLimit',
  strokeAlignment: 'items[].visualStyle.strokeAlignment',
  cornerRadius: 'items[].visualStyle.cornerRadius',
  lineStartMarker: 'items[].visualStyle.lineStartMarker',
  lineEndMarker: 'items[].visualStyle.lineEndMarker',
});

const PAGE_GRID_FIELD_PATHS = Object.freeze({
  columns: 'pages[].grid.columns',
  rows: 'pages[].grid.rows',
  columnGutter: 'pages[].grid.columnGutter',
  rowGutter: 'pages[].grid.rowGutter',
  baseline: 'pages[].grid.baseline',
  baselineGuideMode: 'pages[].grid.baselineGuideMode',
});

const PAGE_MARGIN_FIELD_PATHS = Object.freeze({
  top: 'pages[].margins.top',
  right: 'pages[].margins.right',
  bottom: 'pages[].margins.bottom',
  left: 'pages[].margins.left',
});

const ITEM_VECTOR_GEOMETRY_FIELD_PATHS = Object.freeze({
  kind: 'items[].vectorGeometry.kind',
  paths: 'items[].vectorGeometry.paths',
});

const ITEM_CONTENT_FIELD_PATHS = Object.freeze({
  text: 'items[].content.text',
  sourceHtml: 'items[].content.sourceHtml',
  runs: 'items[].content.runs',
});

const ITEM_CONTENT_RUN_FIELD_PATHS = Object.freeze({
  text: 'items[].content.runs[].text',
  tagName: 'items[].content.runs[].tagName',
  classList: 'items[].content.runs[].classList',
  attributes: 'items[].content.runs[].attributes',
  characterStyle: 'items[].content.runs[].characterStyle',
  textStyle: 'items[].content.runs[].textStyle',
  inlineStyle: 'items[].content.runs[].inlineStyle',
});

const ITEM_TABLE_FIELD_PATHS = Object.freeze({
  rows: 'items[].table.rows',
  tableStyle: 'items[].table.tableStyle',
  rowCount: 'items[].table.rowCount',
  columnCount: 'items[].table.columnCount',
  columnWidths: 'items[].table.columnWidths',
  rowHeights: 'items[].table.rowHeights',
  sourceRows: 'items[].table.sourceRows',
});

const ITEM_TABLE_ROW_FIELD_PATHS = Object.freeze({
  index: 'items[].table.rows[].index',
  header: 'items[].table.rows[].header',
  cells: 'items[].table.rows[].cells',
});

const ITEM_TABLE_CELL_FIELD_PATHS = Object.freeze({
  index: 'items[].table.rows[].cells[].index',
  text: 'items[].table.rows[].cells[].text',
  header: 'items[].table.rows[].cells[].header',
  rowSpan: 'items[].table.rows[].cells[].rowSpan',
  colSpan: 'items[].table.rows[].cells[].colSpan',
  paragraphStyle: 'items[].table.rows[].cells[].paragraphStyle',
  cellStyle: 'items[].table.rows[].cells[].cellStyle',
  fillColor: 'items[].table.rows[].cells[].fillColor',
  fillOpacity: 'items[].table.rows[].cells[].fillOpacity',
  borderColor: 'items[].table.rows[].cells[].borderColor',
  borderWeight: 'items[].table.rows[].cells[].borderWeight',
  textColor: 'items[].table.rows[].cells[].textColor',
  textStyle: 'items[].table.rows[].cells[].textStyle',
  bounds: 'items[].table.rows[].cells[].bounds',
  pointSize: 'items[].table.rows[].cells[].pointSize',
  leading: 'items[].table.rows[].cells[].leading',
  textAlign: 'items[].table.rows[].cells[].textAlign',
  padding: 'items[].table.rows[].cells[].padding',
  paddingUnit: 'items[].table.rows[].cells[].paddingUnit',
  borders: 'items[].table.rows[].cells[].borders',
  runs: 'items[].table.rows[].cells[].runs',
});

const ITEM_TABLE_CELL_RUN_FIELD_PATHS = Object.freeze({
  text: 'items[].table.rows[].cells[].runs[].text',
  tagName: 'items[].table.rows[].cells[].runs[].tagName',
  classList: 'items[].table.rows[].cells[].runs[].classList',
  attributes: 'items[].table.rows[].cells[].runs[].attributes',
  characterStyle: 'items[].table.rows[].cells[].runs[].characterStyle',
  textStyle: 'items[].table.rows[].cells[].runs[].textStyle',
  inlineStyle: 'items[].table.rows[].cells[].runs[].inlineStyle',
});

const STRUCTURAL_KEYS = new Set(['id', 'kind', 'type']);

function scanModelPaths(model) {
  const paths = [];
  const seen = new Set();

  if (!isPlainObject(model)) {
    return paths;
  }

  for (const [key, value] of Object.entries(model)) {
    if (key === 'parentPages') {
      addPath(paths, seen, ROOT_FIELD_PATHS.parentPages);
      scanParentPages(paths, seen, value, scanLabelArray, scanParentPageItems);
    } else if (key === 'layers') {
      addPath(paths, seen, ROOT_FIELD_PATHS.layers);
      scanLayerArray(paths, seen, value, scanLabelArray);
    } else if (key === 'styles') {
      addPath(paths, seen, ROOT_FIELD_PATHS.styles);
      scanStyles(paths, seen, value, scanLabelArray);
    } else if (hasOwn.call(ROOT_FIELD_PATHS, key)) {
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
        scanItems(paths, seen, value, 'pages[].items[]');
      } else if (key === 'labels') {
        scanLabelArray(paths, seen, value);
      } else if (key === 'effectiveLabel') {
        addPath(paths, seen, PAGE_FIELD_PATHS.effectiveLabel);
        scanPageEffectiveLabel(paths, seen, value);
      } else if (key === 'observedLabel') {
        addPath(paths, seen, PAGE_FIELD_PATHS.observedLabel);
        scanPageObservedLabel(paths, seen, value);
      } else if (key === 'grid') {
        addPath(paths, seen, PAGE_FIELD_PATHS.grid);
        scanObjectSurface(paths, seen, value, PAGE_GRID_FIELD_PATHS, 'pages[].grid');
      } else if (key === 'margins') {
        addPath(paths, seen, PAGE_FIELD_PATHS.margins);
        scanObjectSurface(paths, seen, value, PAGE_MARGIN_FIELD_PATHS, 'pages[].margins');
      } else if (key === 'migration') {
        addPath(paths, seen, PAGE_FIELD_PATHS.migration);
        scanObjectSurface(paths, seen, value, PAGE_MIGRATION_FIELD_PATHS, 'pages[].migration');
      } else if (hasOwn.call(PAGE_FIELD_PATHS, key)) {
        addPath(paths, seen, PAGE_FIELD_PATHS[key]);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `pages[].${key}`);
      }
    }
  }
}

function scanParentPageItems(paths, seen, items) {
  scanItems(paths, seen, items, 'parentPages[].items[]');
}

function scanItems(paths, seen, items, unknownPrefix) {
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
        scanItemEffectiveLabel(paths, seen, value);
      } else if (key === 'observedLabel') {
        addPath(paths, seen, ITEM_FIELD_PATHS.observedLabel);
        scanItemObservedLabel(paths, seen, value);
      } else if (key === 'labels') {
        scanLabelArray(paths, seen, value);
      } else if (key === 'styleRefs') {
        addPath(paths, seen, ITEM_FIELD_PATHS.styleRefs);
        scanObjectSurface(paths, seen, value, ITEM_STYLE_REFS_FIELD_PATHS, 'items[].styleRefs');
      } else if (key === 'migration') {
        addPath(paths, seen, ITEM_FIELD_PATHS.migration);
        scanObjectSurface(paths, seen, value, ITEM_MIGRATION_FIELD_PATHS, 'items[].migration');
      } else if (hasOwn.call(ITEM_FIELD_PATHS, key)) {
        addPath(paths, seen, ITEM_FIELD_PATHS[key]);
      } else if (key === 'asset') {
        scanItemAsset(paths, seen, value);
      } else if (key === 'extensions') {
        scanItemExtensions(paths, seen, value, unknownPrefix);
      } else if (key === 'visualStyle') {
        scanVisualStyle(paths, seen, value);
      } else if (key === 'vectorGeometry') {
        scanVectorGeometry(paths, seen, value);
      } else if (key === 'content') {
        scanItemContent(paths, seen, value);
      } else if (key === 'table') {
        scanItemTable(paths, seen, value);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `${unknownPrefix}.${key}`);
      }
    }
  }
}

function scanItemExtensions(paths, seen, extensions, unknownPrefix) {
  if (!isPlainObject(extensions)) {
    return;
  }
  for (const [format, value] of Object.entries(extensions)) {
    const mapping = ITEM_EXTENSION_FIELD_PATHS[format];
    if (mapping) {
      scanObjectSurface(paths, seen, value, mapping, `items[].extensions.${format}`);
    } else {
      addPath(paths, seen, `${unknownPrefix}.extensions.${format}`);
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

function scanVisualStyle(paths, seen, visualStyle) {
  if (!isPlainObject(visualStyle)) {
    return;
  }
  for (const [key, value] of Object.entries(visualStyle)) {
    if (key === 'lineStartMarker') {
      addPath(paths, seen, ITEM_VISUAL_STYLE_FIELD_PATHS.lineStartMarker);
      scanObjectSurface(paths, seen, value, {
        rawName: 'items[].visualStyle.lineStartMarker.rawName',
      }, 'items[].visualStyle.lineStartMarker');
    } else if (key === 'lineEndMarker') {
      addPath(paths, seen, ITEM_VISUAL_STYLE_FIELD_PATHS.lineEndMarker);
      scanObjectSurface(paths, seen, value, {
        rawName: 'items[].visualStyle.lineEndMarker.rawName',
      }, 'items[].visualStyle.lineEndMarker');
    } else if (hasOwn.call(ITEM_VISUAL_STYLE_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_VISUAL_STYLE_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `items[].visualStyle.${key}`);
    }
  }
}

function scanVectorGeometry(paths, seen, vectorGeometry) {
  if (!isPlainObject(vectorGeometry)) {
    return;
  }
  for (const [key, value] of Object.entries(vectorGeometry)) {
    if (key === 'paths') {
      addPath(paths, seen, ITEM_VECTOR_GEOMETRY_FIELD_PATHS.paths);
      scanVectorGeometryPaths(paths, seen, value);
    } else if (hasOwn.call(ITEM_VECTOR_GEOMETRY_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_VECTOR_GEOMETRY_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `items[].vectorGeometry.${key}`);
    }
  }
}

function scanVectorGeometryPaths(paths, seen, vectorPaths) {
  if (!Array.isArray(vectorPaths)) {
    return;
  }
  for (const vectorPath of vectorPaths) {
    if (!isPlainObject(vectorPath) || !Array.isArray(vectorPath.points)) {
      continue;
    }
    for (const point of vectorPath.points) {
      if (isPlainObject(point) && hasOwn.call(point, 'pointType')) {
        addPath(paths, seen, 'items[].vectorGeometry.paths[].points[].pointType');
      }
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
      scanItemTableRows(paths, seen, value);
    } else if (hasOwn.call(ITEM_TABLE_FIELD_PATHS, key)) {
      addPath(paths, seen, ITEM_TABLE_FIELD_PATHS[key]);
    } else if (!STRUCTURAL_KEYS.has(key)) {
      addPath(paths, seen, `items[].table.${key}`);
    }
  }
}

function scanItemTableRows(paths, seen, rows) {
  if (!Array.isArray(rows)) {
    return;
  }

  for (const row of rows) {
    if (!isPlainObject(row)) {
      continue;
    }

    for (const [key, value] of Object.entries(row)) {
      if (key === 'cells') {
        addPath(paths, seen, ITEM_TABLE_ROW_FIELD_PATHS.cells);
        scanItemTableCells(paths, seen, value);
      } else if (hasOwn.call(ITEM_TABLE_ROW_FIELD_PATHS, key)) {
        addPath(paths, seen, ITEM_TABLE_ROW_FIELD_PATHS[key]);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `items[].table.rows[].${key}`);
      }
    }
  }
}

function scanItemTableCells(paths, seen, cells) {
  if (!Array.isArray(cells)) {
    return;
  }

  for (const cell of cells) {
    if (!isPlainObject(cell)) {
      continue;
    }

    for (const [key, value] of Object.entries(cell)) {
      if (key === 'runs') {
        addPath(paths, seen, ITEM_TABLE_CELL_FIELD_PATHS.runs);
        scanArraySurface(
          paths,
          seen,
          value,
          ITEM_TABLE_CELL_RUN_FIELD_PATHS,
          'items[].table.rows[].cells[].runs[]',
        );
      } else if (hasOwn.call(ITEM_TABLE_CELL_FIELD_PATHS, key)) {
        addPath(paths, seen, ITEM_TABLE_CELL_FIELD_PATHS[key]);
      } else if (!STRUCTURAL_KEYS.has(key)) {
        addPath(paths, seen, `items[].table.rows[].cells[].${key}`);
      }
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
