function validateInstructions(instructions) {
  const errors = [];
  const styles = instructions.styles || {};
  const documentPages = instructions.document && Array.isArray(instructions.document.pages)
    ? instructions.document.pages
    : [];
  const pageIds = new Set(documentPages.map((page) => page.id));
  const assetIds = new Set((instructions.assets || []).map((asset) => asset.id));

  if (documentPages.length === 0) {
    errors.push({
      code: 'DOCUMENT_PAGE_MISSING',
      message: 'instructions.document.pages must contain at least one page.',
    });
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
      validatePlacedAsset(item, assetIds, errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
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
  if ((item.type === 'GRAPHIC' || item.type === 'SHAPE') && item.objectStyle && !(styles.objectStyles || {})[item.objectStyle]) {
    errors.push({
      code: 'OBJECT_STYLE_NOT_FOUND',
      message: `Object style '${item.objectStyle}' was not found.`,
      itemId: item.id,
      styleName: item.objectStyle,
    });
  }
  if ((item.type === 'GRAPHIC' || item.type === 'SHAPE') && item.frameStyle && !(styles.frameStyles || {})[item.frameStyle]) {
    errors.push({
      code: 'FRAME_STYLE_NOT_FOUND',
      message: `Frame style '${item.frameStyle}' was not found.`,
      itemId: item.id,
      styleName: item.frameStyle,
    });
  }
}

function validatePlacedAsset(item, assetIds, errors) {
  if (item.type !== 'GRAPHIC' || !item.placed || !item.placed.assetId) return;
  if (!assetIds.has(item.placed.assetId)) {
    errors.push({
      code: 'ASSET_NOT_FOUND',
      message: `Placed asset '${item.placed.assetId}' was not found.`,
      itemId: item.id,
      assetId: item.placed.assetId,
    });
  }
}

module.exports = {
  validateInstructions,
};
