(function installBrowserStyleCapture(globalObject) {
  const snapshotStyleProps = [
    'position',
    'display',
    'left',
    'top',
    'width',
    'height',
    'zIndex',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'color',
    'textAlign',
    'textDecorationLine',
    'textTransform',
    'verticalAlign',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'gridTemplateColumns',
    'gridTemplateRows',
    'columnGap',
    'rowGap',
    'gap',
    'backgroundColor',
    'backgroundImage',
    'borderTopColor',
    'borderTopWidth',
    'borderTopStyle',
    'borderRightColor',
    'borderRightWidth',
    'borderRightStyle',
    'borderBottomColor',
    'borderBottomWidth',
    'borderBottomStyle',
    'borderLeftColor',
    'borderLeftWidth',
    'borderLeftStyle',
    'borderRadius',
    'opacity',
    'objectFit',
    'objectPosition',
    'overflow',
    'transform',
    'boxShadow',
    'filter',
    'maskImage',
    'webkitMaskImage',
  ];

  function styleObject(el) {
    const style = getComputedStyle(el);
    const out = {};
    for (const prop of snapshotStyleProps) {
      out[prop] = style[prop];
    }
    return out;
  }

  function authoredStyleObject(el, styleRules) {
    const out = {};
    for (const prop of snapshotStyleProps) out[prop] = '';
    for (const rule of styleRules) {
      try {
        if (!el.matches(rule.selectorText)) continue;
      } catch (_) {
        continue;
      }
      for (const prop of snapshotStyleProps) {
        const value = authoredValue(rule.style, prop, rule.rawDecls);
        if (value) out[prop] = value.trim();
      }
    }
    const inline = el.style || {};
    const inlineDecls = rawDeclarationMap(inline.cssText || '');
    for (const prop of snapshotStyleProps) {
      const value = inline.getPropertyValue ? authoredValue(inline, prop, inlineDecls) : '';
      if (value) out[prop] = value.trim();
    }
    return out;
  }

  function collectStyleRules() {
    const rules = [];
    const rawBlocks = collectRawStyleBlocks();
    const used = new Map();
    for (const sheet of Array.from(document.styleSheets || [])) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.type === CSSRule.STYLE_RULE) {
            rules.push({
              selectorText: rule.selectorText,
              style: rule.style,
              rawDecls: rawDeclarationMap(rawBlockForRule(rule.selectorText, rawBlocks, used)),
            });
          }
        }
      } catch (_) {}
    }
    return rules;
  }

  function mergeVisualFrameStyle(itemStyle, frameStyle) {
    const out = Object.assign({}, itemStyle);
    for (const prop of [
      'backgroundColor',
      'backgroundImage',
      'borderTopColor',
      'borderTopWidth',
      'borderTopStyle',
      'borderRightColor',
      'borderRightWidth',
      'borderRightStyle',
      'borderBottomColor',
      'borderBottomWidth',
      'borderBottomStyle',
      'borderLeftColor',
      'borderLeftWidth',
      'borderLeftStyle',
      'borderRadius',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'overflow',
      'opacity',
    ]) {
      if (frameStyle[prop]) out[prop] = frameStyle[prop];
    }
    return out;
  }

  function authoredValue(styleDecl, prop, rawDecls) {
    const direct = styleDecl.getPropertyValue(cssPropertyName(prop)) || styleDecl[prop] || '';
    if (direct) return direct;
    const rawDirect = rawDecls && rawDecls[cssPropertyName(prop)];
    if (rawDirect) return rawDirect;
    const border = prop.match(/^border(Top|Right|Bottom|Left)(Width|Style|Color)$/);
    if (!border) return '';
    const side = border[1].toLowerCase();
    const kind = border[2].toLowerCase();
    const rawSideShorthand = rawDecls && rawDecls[`border-${side}`];
    if (rawSideShorthand) return borderShorthandValue(rawSideShorthand, kind);
    const rawBoxShorthand = rawDecls && rawDecls[`border-${kind}`];
    if (rawBoxShorthand) return borderBoxSideValue(rawBoxShorthand, side);
    const rawShorthand = rawDecls && rawDecls.border;
    if (rawShorthand) return borderShorthandValue(rawShorthand, kind);
    const sideShorthand = styleDecl.getPropertyValue(`border-${side}`) || '';
    if (sideShorthand) return borderShorthandValue(sideShorthand, kind);
    const boxShorthand = styleDecl.getPropertyValue(`border-${kind}`) || '';
    if (boxShorthand) return borderBoxSideValue(boxShorthand, side);
    const shorthand = styleDecl.getPropertyValue('border') || '';
    return borderShorthandValue(shorthand, kind);
  }

  function cssPropertyName(prop) {
    return prop.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
  }

  function borderBoxSideValue(value, side) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const values = parts.length === 1
      ? [parts[0], parts[0], parts[0], parts[0]]
      : parts.length === 2
        ? [parts[0], parts[1], parts[0], parts[1]]
        : parts.length === 3
          ? [parts[0], parts[1], parts[2], parts[1]]
          : [parts[0], parts[1], parts[2], parts[3]];
    const index = { top: 0, right: 1, bottom: 2, left: 3 }[side];
    return values[index] || '';
  }

  function borderShorthandValue(value, kind) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    const styles = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);
    if (kind === 'width') return parts.find((part) => /^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)$/i.test(part) || ['thin', 'medium', 'thick'].includes(part)) || '';
    if (kind === 'style') return parts.find((part) => styles.has(part.toLowerCase())) || '';
    if (kind === 'color') return parts.find((part) => !styles.has(part.toLowerCase()) && !/^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)$/i.test(part)) || '';
    return '';
  }

  function collectRawStyleBlocks() {
    const source = Array.from(document.querySelectorAll('style'))
      .map((el) => el.textContent || '')
      .join('\n');
    const blocks = [];
    let cursor = 0;
    while (cursor < source.length) {
      const open = source.indexOf('{', cursor);
      if (open === -1) break;
      const selectorText = source.slice(cursor, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
      let depth = 1;
      let close = open + 1;
      while (close < source.length && depth > 0) {
        if (source[close] === '{') depth += 1;
        if (source[close] === '}') depth -= 1;
        close += 1;
      }
      const declarations = source.slice(open + 1, close - 1);
      if (selectorText && selectorText[0] !== '@') {
        blocks.push({
          selectorText: normalizeSelectorText(selectorText),
          declarations,
        });
      }
      cursor = close;
    }
    return blocks;
  }

  function rawBlockForRule(selectorText, rawBlocks, used) {
    const normalized = normalizeSelectorText(selectorText);
    const next = used.get(normalized) || 0;
    let seen = 0;
    for (const block of rawBlocks) {
      if (block.selectorText !== normalized) continue;
      if (seen === next) {
        used.set(normalized, next + 1);
        return block.declarations;
      }
      seen += 1;
    }
    return '';
  }

  function normalizeSelectorText(value) {
    return String(value || '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function rawDeclarationMap(rawStyle) {
    const out = {};
    for (const declaration of String(rawStyle || '').split(';')) {
      const colon = declaration.indexOf(':');
      if (colon === -1) continue;
      const name = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (name && value) out[name] = value;
    }
    return out;
  }

  const api = {
    snapshotStyleProps,
    styleObject,
    authoredStyleObject,
    collectStyleRules,
    mergeVisualFrameStyle,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.htmlIndesignBrowserStyleCapture = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
