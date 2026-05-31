const fs = require('fs');
const path = require('path');

function validateInstructions(instructions, options = {}) {
  const errors = [];
  const styles = instructions.styles || {};
  const documentPages = instructions.document && Array.isArray(instructions.document.pages)
    ? instructions.document.pages
    : [];
  const pageIds = new Set(documentPages.map((page) => page.id));
  const assets = instructions.assets || [];
  const assetIds = new Set(assets.map((asset) => asset.id));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  if (documentPages.length === 0) {
    errors.push({
      code: 'DOCUMENT_PAGE_MISSING',
      message: 'instructions.document.pages must contain at least one page.',
    });
  }
  validatePageSizes(documentPages, errors);

  if (options.checkAssetFiles) {
    validateAssetFiles(instructions.assets || [], options, errors);
  }

  for (const page of instructions.pages || []) {
    if (!pageIds.has(page.id)) {
      errors.push({
        code: 'PAGE_NOT_IN_DOCUMENT',
        message: `Page '${page.id}' is missing from instructions.document.pages.`,
        pageId: page.id,
      });
    }
    for (const item of page.items || []) {
      validateBounds(item, errors);
      validateStyleRefs(item, styles, errors);
      validatePlacedAsset(item, assetIds, assetById, errors);
    }
  }

  validateProtocolLabels(instructions, options, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validatePageSizes(documentPages, errors) {
  if (documentPages.length < 2) return;
  const first = documentPages[0] || {};
  for (const page of documentPages.slice(1)) {
    if (Math.abs(Number(page.width || 0) - Number(first.width || 0)) > 0.01
      || Math.abs(Number(page.height || 0) - Number(first.height || 0)) > 0.01) {
      errors.push({
        code: 'MIXED_PAGE_SIZE_UNSUPPORTED',
        message: 'Mixed page sizes are not supported by the current InDesign executor.',
      });
      return;
    }
  }
}

function validateAssetFiles(assets, options, errors) {
  const baseDir = options.baseDir || process.cwd();
  for (const asset of assets) {
    const candidate = resolveInstructionAssetPath(asset, baseDir);
    if (!candidate || !fs.existsSync(candidate)) {
      errors.push({
        code: 'ASSET_FILE_NOT_FOUND',
        message: `Asset '${asset.id}' file was not found.`,
        assetId: asset.id,
        path: candidate || asset.resolvedPath || asset.src,
      });
    }
  }
}

function resolveInstructionAssetPath(asset, baseDir) {
  const raw = asset && (asset.resolvedPath || asset.src);
  if (!raw) return null;
  if (/^[a-z]+:\/\//i.test(raw)) return raw;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(baseDir, raw);
}

function validateBounds(item, errors) {
  const bounds = item.bounds;
  const valid = bounds
    && Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width >= 0
    && bounds.height >= 0;
  if (!valid) {
    errors.push({
      code: 'INVALID_BOUNDS',
      message: `Item '${item.id}' has invalid bounds.`,
      itemId: item.id,
    });
  }
}

function validateStyleRefs(item, styles, errors) {
  if (item.type === 'TEXT' && item.paragraphStyle && !(styles.paragraphStyles || {})[item.paragraphStyle]) {
    errors.push({
      code: 'PARAGRAPH_STYLE_NOT_FOUND',
      message: `Paragraph style '${item.paragraphStyle}' was not found.`,
      itemId: item.id,
      styleName: item.paragraphStyle,
    });
  }
  for (const run of item.runs || []) {
    if (run.characterStyle && !(styles.characterStyles || {})[run.characterStyle]) {
      errors.push({
        code: 'CHARACTER_STYLE_NOT_FOUND',
        message: `Character style '${run.characterStyle}' was not found.`,
        itemId: item.id,
        styleName: run.characterStyle,
      });
    }
  }
  if ((item.type === 'TEXT' || item.type === 'GRAPHIC' || item.type === 'SHAPE' || item.type === 'LINE' || item.type === 'TABLE') && item.objectStyle && !(styles.objectStyles || {})[item.objectStyle]) {
    errors.push({
      code: 'OBJECT_STYLE_NOT_FOUND',
      message: `Object style '${item.objectStyle}' was not found.`,
      itemId: item.id,
      styleName: item.objectStyle,
    });
  }
  if ((item.type === 'TEXT' || item.type === 'GRAPHIC' || item.type === 'SHAPE' || item.type === 'TABLE') && item.frameStyle && !(styles.frameStyles || {})[item.frameStyle]) {
    errors.push({
      code: 'FRAME_STYLE_NOT_FOUND',
      message: `Frame style '${item.frameStyle}' was not found.`,
      itemId: item.id,
      styleName: item.frameStyle,
    });
  }
  if (item.type === 'TABLE') {
    validateTableCellStyleRefs(item, styles, errors);
  }
}

function validateTableCellStyleRefs(item, styles, errors) {
  for (const row of item.rows || []) {
    for (const cell of row.cells || []) {
      if (cell.paragraphStyle && !(styles.paragraphStyles || {})[cell.paragraphStyle]) {
        errors.push({
          code: 'TABLE_CELL_PARAGRAPH_STYLE_NOT_FOUND',
          message: `Table cell paragraph style '${cell.paragraphStyle}' was not found.`,
          itemId: item.id,
          styleName: cell.paragraphStyle,
        });
      }
      for (const run of cell.runs || []) {
        if (run.characterStyle && !(styles.characterStyles || {})[run.characterStyle]) {
          errors.push({
            code: 'TABLE_CELL_CHARACTER_STYLE_NOT_FOUND',
            message: `Table cell character style '${run.characterStyle}' was not found.`,
            itemId: item.id,
            styleName: run.characterStyle,
          });
        }
      }
    }
  }
}

function validatePlacedAsset(item, assetIds, assetById, errors) {
  if (item.type !== 'GRAPHIC') return;
  if (!item.placed || !item.placed.assetId) {
    errors.push({
      code: 'GRAPHIC_ASSET_MISSING',
      message: `Graphic item '${item.id}' is missing a placed asset reference.`,
      itemId: item.id,
    });
    return;
  }
  if (!assetIds.has(item.placed.assetId)) {
    errors.push({
      code: 'ASSET_NOT_FOUND',
      message: `Placed asset '${item.placed.assetId}' was not found.`,
      itemId: item.id,
      assetId: item.placed.assetId,
    });
    return;
  }
  const asset = assetById.get(item.placed.assetId) || {};
  if (isPdfAsset(asset) && !Number.isFinite(Number(item.placed.pageNumber))) {
    errors.push({
      code: 'PDF_PAGE_NUMBER_MISSING',
      message: `PDF graphic item '${item.id}' is missing an explicit PDF page number.`,
      itemId: item.id,
      assetId: item.placed.assetId,
    });
  }
}

function isPdfAsset(asset) {
  const kind = String(asset && asset.kind || '').toLowerCase();
  const src = String(asset && (asset.src || asset.resolvedPath || asset.fileName) || '').toLowerCase();
  return kind === 'pdf' || /\.pdf(?:[?#].*)?$/.test(src);
}

function validateProtocolLabels(instructions, options, errors) {
  if (!options.requireLabels) return;

  if (!hasProtocolLabel(instructions.document && instructions.document.labels, 'document')) {
    errors.push({
      code: 'INSTRUCTION_LABEL_MISSING',
      message: 'Document protocol label is missing.',
      target: 'document',
    });
  }

  for (const layer of instructions.layers || []) {
    if (!hasProtocolLabel(layer.labels, 'layer')) {
      errors.push({
        code: 'INSTRUCTION_LABEL_MISSING',
        message: `Layer '${layer.name || layer.token || ''}' protocol label is missing.`,
        target: 'layer',
        layerName: layer.name || layer.token || '',
      });
    }
  }

  const documentPages = instructions.document && Array.isArray(instructions.document.pages)
    ? instructions.document.pages
    : [];
  for (const page of documentPages) {
    if (!hasProtocolLabel(page.labels, 'page')) {
      errors.push({
        code: 'INSTRUCTION_LABEL_MISSING',
        message: `Page '${page.id}' protocol label is missing.`,
        target: 'page',
        pageId: page.id,
      });
    }
    for (const guide of page.guides || []) {
      if (!hasProtocolLabel(guide.labels, 'guide')) {
        errors.push({
          code: 'INSTRUCTION_LABEL_MISSING',
          message: `Guide on page '${page.id}' protocol label is missing.`,
          target: 'guide',
          pageId: page.id,
        });
      }
    }
  }

  for (const page of instructions.pages || []) {
    for (const item of page.items || []) {
      if (!hasProtocolLabel(item.labels, 'item')) {
        errors.push({
          code: 'INSTRUCTION_LABEL_MISSING',
          message: `Item '${item.id}' protocol label is missing.`,
          target: 'item',
          pageId: page.id,
          itemId: item.id,
        });
      }
    }
  }
}

function hasProtocolLabel(labels, kind) {
  return (labels || []).some((label) => label
    && label.protocol === 'html-indesign'
    && label.kind === kind
    && label.id);
}

module.exports = {
  validateInstructions,
  resolveInstructionAssetPath,
};
