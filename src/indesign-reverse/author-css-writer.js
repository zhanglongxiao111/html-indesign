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
    `.page { position: relative; width: ${px(first.width || 0)}; height: ${px(first.height || 0)}; background: var(--id-page-bg); overflow: hidden; }`,
    '.grid-item { position: absolute; }',
    '.id-object { position: absolute; margin: 0; overflow: hidden; }',
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
  for (const page of model.pages || []) {
    for (const item of page.items || []) {
      if (item.layout && item.layout.grid) continue;
      if (!item.bounds) continue;
      lines.push(`#${cssId(item.id)} { position:absolute; left:${px(item.bounds.x)}; top:${px(item.bounds.y)}; width:${px(item.bounds.width)}; height:${px(item.bounds.height)}; }`);
    }
  }
  lines.push('');
  return lines.join('\n');
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
