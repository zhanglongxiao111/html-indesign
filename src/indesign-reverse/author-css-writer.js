function writeAuthorCssFiles(model) {
  return {
    'styles/tokens.css': tokensCss(model),
    'styles/layout.css': layoutCss(model),
    'styles/components.css': componentsCss(model),
    'styles/pages.css': pagesCss(model),
    'styles/reverse-overrides.css': reverseOverridesCss(model),
  };
}

function tokensCss(model) {
  return [
    ':root {',
    '  --id-page-bg: #ffffff;',
    '  --id-text: #14324a;',
    '}',
    '',
  ].join('\n');
}

function layoutCss(model) {
  const first = (model.pages && model.pages[0]) || {};
  return [
    '* { box-sizing: border-box; }',
    'body { margin: 0; background: #f3f5f6; color: var(--id-text); font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '.deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `.page { width: ${px(first.width || 0)}; height: ${px(first.height || 0)}; background: var(--id-page-bg); overflow: hidden; position: relative; display: grid; grid-template-columns: repeat(var(--id-grid-columns, 12), minmax(0, 1fr)); grid-template-rows: repeat(var(--id-grid-rows, 8), minmax(0, 1fr)); column-gap: var(--id-column-gutter, 0px); row-gap: var(--id-row-gutter, 0px); padding: var(--id-margin-top, 0px) var(--id-margin-right, 0px) var(--id-margin-bottom, 0px) var(--id-margin-left, 0px); }`,
    '.grid-item { grid-column: var(--grid-col) / span var(--grid-span, 1); grid-row: var(--grid-row) / span var(--grid-row-span, 1); min-width: 0; min-height: 0; }',
    '.id-object { margin: 0; overflow: hidden; }',
    '',
  ].join('\n');
}

function componentsCss(model) {
  const styles = model.styles || {};
  return [
    styleCollectionCss(styles.paragraphStyles, 'pstyle'),
    styleCollectionCss(styles.characterStyles, 'cstyle'),
    styleCollectionCss(styles.objectStyles, 'ostyle'),
    '',
  ].filter(Boolean).join('\n');
}

function pagesCss(model) {
  return [
    '/* Page-specific reverse styles are emitted here when a page cannot use shared components. */',
    '',
  ].join('\n');
}

function reverseOverridesCss(model) {
  const lines = ['/* Generated fallback geometry for reverse-exported objects. */'];
  const itemIds = new Set();
  for (const page of model.pages || []) {
    for (const item of page.items || []) itemIds.add(item.id);
  }
  for (const page of model.pages || []) {
    for (const item of page.items || []) {
      if (shouldOmitAuthorOverride(item, itemIds)) continue;
      if (item.layout && item.layout.grid) continue;
      if (!item.bounds) continue;
      lines.push(`#${cssId(item.id)} { position:absolute; left:${px(item.bounds.x)}; top:${px(item.bounds.y)}; width:${px(item.bounds.width)}; height:${px(item.bounds.height)}; }`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function shouldOmitAuthorOverride(item, itemIds) {
  if (!item) return true;
  if (item.sourceNode) return true;
  if (isGeneratedLabel(item)) return true;
  const id = String(item.id || '');
  if (/-border-(top|right|bottom|left)$/i.test(id)) return true;
  if (item.semantic === 'unknown' && /-background$/i.test(id)) return true;
  if (/-text$/i.test(id) && itemIds.has(id.replace(/-text$/i, ''))) return true;
  return false;
}

function isGeneratedLabel(item) {
  return (item.labels || []).some((label) => label && (label.generated === true || label.kind === 'generated'));
}

function styleCollectionCss(collection, prefix) {
  return Object.values(collection || {}).filter((style) => style && style.css).map((style) => {
    return `.${prefix}-${safeClass(style.safeName || style.token || style.name)} { ${String(style.css).replace(/pt\b/g, 'px')} }`;
  }).join('\n');
}

function px(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0}px`;
}

function cssId(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function safeClass(value) {
  return String(value || 'style').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-');
}

module.exports = {
  writeAuthorCssFiles,
};
