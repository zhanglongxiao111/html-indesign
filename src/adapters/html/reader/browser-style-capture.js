(function installBrowserStyleCapture(globalObject) {
  const snapshotStyleProps = [
    'position',
    'display',
    'flexDirection',
    'justifyContent',
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
    'textAlignLast',
    'textDecorationLine',
    'textTransform',
    'webkitTextStrokeWidth',
    'webkitTextStrokeColor',
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
    'backgroundPosition',
    'backgroundSize',
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
    'mixBlendMode',
    'objectFit',
    'objectPosition',
    'overflow',
    'transform',
    'boxShadow',
    'filter',
    'clipPath',
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
    const out = ruleStyleObject(el, styleRules);
    const inline = el.style || {};
    // The style attribute text keeps the author's digits; cssText is re-serialized by CSSOM (see preciseLength).
    const inlineDecls = rawDeclarationMap((el.getAttribute && el.getAttribute('style')) || inline.cssText || '');
    for (const prop of snapshotStyleProps) {
      const value = inline.getPropertyValue ? authoredValue(inline, prop, inlineDecls) : '';
      if (value) out[prop] = value.trim();
    }
    return out;
  }

  function ruleStyleObject(el, styleRules) {
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
    return out;
  }

  // A native style class (.pstyle-<token> / .cstyle-<token> / .ostyle-<token>, as the reverse author writer
  // emits them) names one InDesign style and its single-class rule carries that style's definition. ruleStyle
  // is the union of every matching rule (synth-* appearance classes, reverse-overrides geometry, layout resets),
  // i.e. the element's look; the style definition has to be read from the style class rule alone.
  // extraClassNames: style classes implied by the element's declarations (a run's data-id-character-style).
  const STYLE_CLASS_RULE_PREFIXES = { paragraph: 'pstyle-', character: 'cstyle-', object: 'ostyle-' };

  function styleClassRuleObjects(el, styleRules, extraClassNames = []) {
    const out = {};
    const classNames = new Set(Array.from(el.classList || []).concat(extraClassNames || []));
    for (const [kind, prefix] of Object.entries(STYLE_CLASS_RULE_PREFIXES)) {
      let declarations = null;
      for (const rule of styleRules) {
        const className = singleClassSelectorName(rule.selectorText);
        if (!className || !className.startsWith(prefix) || !classNames.has(className)) continue;
        if (!declarations) declarations = {};
        for (const prop of snapshotStyleProps) {
          const value = authoredValue(rule.style, prop, rule.rawDecls);
          if (value) declarations[prop] = value.trim();
        }
      }
      if (declarations) out[kind] = declarations;
    }
    return out;
  }

  // Same sanitizing as shared/style-utils safeAuthorClassToken: the class the author writer derives from a style name.
  function styleClassToken(value) {
    const token = String(value || 'style')
      .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return token || 'style';
  }

  function singleClassSelectorName(selectorText) {
    const match = /^\.((?:\\.|[^\s.#:[\]>+~,*()\\])+)$/.exec(String(selectorText || '').trim());
    if (!match) return null;
    return match[1].replace(/\\(.)/g, '$1');
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

  const FRAME_PAINT_PROPS = new Set([
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
  ]);

  // The visual frame (a wrapper such as a data-id-ignore PDF frame) is the InDesign frame, so its paint
  // wins. A wrapper that paints nothing leaves the item's own fill, border and radius as the frame paint:
  // reverse-written packages carry the object style class on the placed object, not on the wrapper.
  function mergeVisualFrameStyle(itemStyle, frameStyle) {
    const out = Object.assign({}, itemStyle);
    const framePaints = stylePaints(frameStyle);
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
      'mixBlendMode',
    ]) {
      if (!framePaints && FRAME_PAINT_PROPS.has(prop)) continue;
      if (frameStyle[prop]) out[prop] = frameStyle[prop];
    }
    return out;
  }

  // The visual frame's authored placement is the InDesign frame's placement (a table inside a data-id-ignore
  // text-frame wrapper, an asset inside its frame): an absolutely placed frame lends the item its authored
  // left/top/width/height, so the item keeps the authored lengths instead of the 1/64 px laid-out rect.
  const FRAME_GEOMETRY_PROPS = ['position', 'left', 'top', 'width', 'height'];

  function withVisualFrameGeometry(style, frameStyle) {
    const frame = frameStyle || {};
    if (String(frame.position || '').trim().toLowerCase() !== 'absolute') return style;
    if (!FRAME_GEOMETRY_PROPS.every((prop) => String(frame[prop] || '').trim())) return style;
    const out = Object.assign({}, style);
    for (const prop of FRAME_GEOMETRY_PROPS) out[prop] = frame[prop];
    return out;
  }

  function stylePaints(style) {
    const background = String(style.backgroundColor || '').trim().toLowerCase().replace(/\s+/g, '');
    if (background && background !== 'transparent' && background !== 'rgba(0,0,0,0)') return true;
    const image = String(style.backgroundImage || '').trim().toLowerCase();
    if (image && image !== 'none') return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some((side) => {
      const width = parseFloat(style[`border${side}Width`]);
      const borderStyle = String(style[`border${side}Style`] || '').trim().toLowerCase();
      return Number.isFinite(width) && width > 0 && borderStyle !== 'none' && borderStyle !== 'hidden';
    });
  }

  function authoredValue(styleDecl, prop, rawDecls) {
    const direct = styleDecl.getPropertyValue(cssPropertyName(prop)) || styleDecl[prop] || '';
    const rawDirect = rawDecls && rawDecls[cssPropertyName(prop)];
    if (direct) return preciseLength(direct, rawDirect);
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

  // CSSOM serializes numbers with 6 significant digits: an authored 1587.402px reads back as 1587.4px and
  // 1016.693px as 1016.69px. When the raw declaration is the same plain length, keep the author's digits.
  const PLAIN_LENGTH = /^([+-]?(?:\d*\.\d+|\d+))(px|pt|mm)$/i;

  function preciseLength(value, raw) {
    const cssom = PLAIN_LENGTH.exec(String(value || '').trim());
    const authored = PLAIN_LENGTH.exec(String(raw || '').trim());
    if (!cssom || !authored || cssom[2].toLowerCase() !== authored[2].toLowerCase()) return value;
    const a = Number(cssom[1]);
    const b = Number(authored[1]);
    return Math.abs(a - b) <= Math.abs(b) * 1e-5 + 1e-9 ? String(raw).trim() : value;
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
    ruleStyleObject,
    styleClassRuleObjects,
    styleClassToken,
    collectStyleRules,
    mergeVisualFrameStyle,
    withVisualFrameGeometry,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.htmlIndesignBrowserStyleCapture = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
