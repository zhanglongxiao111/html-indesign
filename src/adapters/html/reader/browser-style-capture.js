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

  const SNAPSHOT_PROP_META = snapshotStyleProps.map((prop) => {
    const cssName = prop.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
    const borderMatch = prop.match(/^border(Top|Right|Bottom|Left)(Width|Style|Color)$/);
    const border = borderMatch
      ? {
        side: borderMatch[1].toLowerCase(),
        kind: borderMatch[2].toLowerCase(),
        sideShorthand: `border-${borderMatch[1].toLowerCase()}`,
        boxShorthand: `border-${borderMatch[2].toLowerCase()}`,
      }
      : null;
    return { prop, cssName, border };
  });
  const SNAPSHOT_PROP_META_BY_NAME = new Map(SNAPSHOT_PROP_META.map((entry) => [entry.prop, entry]));
  const BORDER_STYLE_KEYWORDS = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);
  const BORDER_WIDTH_RE = /^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)$/i;
  const BORDER_WIDTH_KEYWORDS = new Set(['thin', 'medium', 'thick']);
  const styleRuleIndexCache = new WeakMap();

  function styleObject(el) {
    const style = getComputedStyle(el);
    const out = {};
    for (const prop of snapshotStyleProps) {
      out[prop] = style[prop];
    }
    return out;
  }

  function authoredStyleObject(el, styleRules, precomputedRuleStyle) {
    const out = precomputedRuleStyle
      ? Object.assign({}, precomputedRuleStyle)
      : ruleStyleObject(el, styleRules);
    const inline = el.style || {};
    if (!inline.getPropertyValue) return out;
    // The style attribute text keeps the author's digits; cssText is re-serialized by CSSOM (see preciseLength).
    const rawInlineStyle = (el.getAttribute && el.getAttribute('style')) || inline.cssText || '';
    if (!rawInlineStyle && typeof inline.length === 'number' && inline.length === 0) return out;
    const inlineDecls = rawDeclarationMap(rawInlineStyle);
    for (const meta of SNAPSHOT_PROP_META) {
      const value = authoredValue(inline, meta, inlineDecls);
      if (value) out[meta.prop] = value.trim();
    }
    return out;
  }

  function ruleStyleObject(el, styleRules) {
    const out = {};
    for (const prop of snapshotStyleProps) out[prop] = '';
    if (!styleRules || !styleRules.length) return out;
    const index = getStyleRuleIndex(styleRules);
    const candidates = el && typeof el.tagName === 'string'
      ? candidateRulesForElement(el, index)
      : index.entries;
    for (let i = 0; i < candidates.length; i += 1) {
      const entry = candidates[i];
      try {
        if (!el.matches(entry.rule.selectorText)) continue;
      } catch (_) {
        continue;
      }
      const resolved = resolveRuleProps(entry);
      for (let j = 0; j < resolved.length; j += 1) {
        out[resolved[j][0]] = resolved[j][1];
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
  const STYLE_CLASS_RULE_PREFIX_ENTRIES = Object.entries(STYLE_CLASS_RULE_PREFIXES);

  function styleClassRuleObjects(el, styleRules, extraClassNames = []) {
    const out = {};
    if (!styleRules || !styleRules.length) return out;
    const index = getStyleRuleIndex(styleRules);
    if (index.bySingleStyleClass.size === 0) return out;
    const classNames = new Set(Array.from(el.classList || []).concat(extraClassNames || []));
    if (classNames.size === 0) return out;
    const matchedByKind = {};
    for (const className of classNames) {
      const entries = index.bySingleStyleClass.get(className);
      if (!entries) continue;
      for (let i = 0; i < STYLE_CLASS_RULE_PREFIX_ENTRIES.length; i += 1) {
        const kind = STYLE_CLASS_RULE_PREFIX_ENTRIES[i][0];
        const prefix = STYLE_CLASS_RULE_PREFIX_ENTRIES[i][1];
        if (!className.startsWith(prefix)) continue;
        if (!matchedByKind[kind]) matchedByKind[kind] = [];
        for (let j = 0; j < entries.length; j += 1) {
          matchedByKind[kind].push(entries[j]);
        }
      }
    }
    for (let i = 0; i < STYLE_CLASS_RULE_PREFIX_ENTRIES.length; i += 1) {
      const kind = STYLE_CLASS_RULE_PREFIX_ENTRIES[i][0];
      const matched = matchedByKind[kind];
      if (!matched || matched.length === 0) continue;
      if (matched.length > 1) matched.sort((a, b) => a.order - b.order);
      const declarations = {};
      for (let j = 0; j < matched.length; j += 1) {
        const resolved = resolveRuleProps(matched[j]);
        for (let k = 0; k < resolved.length; k += 1) {
          declarations[resolved[k][0]] = resolved[k][1];
        }
      }
      out[kind] = declarations;
    }
    return out;
  }

  function resolveRuleProps(entry) {
    if (entry.resolvedProps) return entry.resolvedProps;
    const pairs = [];
    const rule = entry.rule;
    for (let i = 0; i < SNAPSHOT_PROP_META.length; i += 1) {
      const meta = SNAPSHOT_PROP_META[i];
      const value = authoredValue(rule.style, meta, rule.rawDecls);
      if (value) pairs.push([meta.prop, value.trim()]);
    }
    entry.resolvedProps = pairs;
    return pairs;
  }

  function getStyleRuleIndex(styleRules) {
    const cached = styleRuleIndexCache.get(styleRules);
    if (cached && cached.length === styleRules.length) return cached;
    const index = buildStyleRuleIndex(styleRules);
    styleRuleIndexCache.set(styleRules, index);
    return index;
  }

  function buildStyleRuleIndex(styleRules) {
    const entries = [];
    const universal = [];
    const byId = new Map();
    const byClass = new Map();
    const byTag = new Map();
    const bySingleStyleClass = new Map();

    for (let i = 0; i < styleRules.length; i += 1) {
      const rule = styleRules[i];
      const entry = { rule, order: i, resolvedProps: null };
      entries.push(entry);

      const singleClass = singleClassSelectorName(rule.selectorText);
      if (singleClass && isStyleClassRuleName(singleClass)) {
        pushToBucket(bySingleStyleClass, singleClass, entry);
      }

      const selectors = splitTopLevelSelectors(rule.selectorText);
      if (selectors.length === 0) {
        universal.push(entry);
        continue;
      }

      let isUniversal = false;
      const keys = [];
      for (let j = 0; j < selectors.length; j += 1) {
        const compound = rightmostCompoundSelector(selectors[j]);
        const bucket = bucketKeyForCompound(compound);
        if (bucket.kind === 'universal') {
          isUniversal = true;
          break;
        }
        keys.push(bucket);
      }
      if (isUniversal) {
        universal.push(entry);
        continue;
      }
      const addedKeys = new Set();
      for (let j = 0; j < keys.length; j += 1) {
        const bucket = keys[j];
        const dedupeKey = `${bucket.kind}:${bucket.key}`;
        if (addedKeys.has(dedupeKey)) continue;
        addedKeys.add(dedupeKey);
        if (bucket.kind === 'id') pushToBucket(byId, bucket.key, entry);
        else if (bucket.kind === 'class') pushToBucket(byClass, bucket.key, entry);
        else if (bucket.kind === 'tag') pushToBucket(byTag, bucket.key, entry);
      }
    }

    return {
      length: styleRules.length,
      entries,
      universal,
      byId,
      byClass,
      byTag,
      bySingleStyleClass,
    };
  }

  function isStyleClassRuleName(className) {
    for (let i = 0; i < STYLE_CLASS_RULE_PREFIX_ENTRIES.length; i += 1) {
      if (className.startsWith(STYLE_CLASS_RULE_PREFIX_ENTRIES[i][1])) return true;
    }
    return false;
  }

  function pushToBucket(map, key, entry) {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = [];
      map.set(key, bucket);
    }
    bucket.push(entry);
  }

  function candidateRulesForElement(el, index) {
    const matched = [];
    const seen = new Set();
    function addBucket(bucket) {
      if (!bucket) return;
      for (let i = 0; i < bucket.length; i += 1) {
        const entry = bucket[i];
        if (!seen.has(entry.order)) {
          seen.add(entry.order);
          matched.push(entry);
        }
      }
    }
    addBucket(index.universal);
    const tagKey = String(el.tagName || '').toLowerCase();
    if (tagKey) addBucket(index.byTag.get(tagKey));
    const idKey = typeof el.id === 'string' && el.id ? el.id.toLowerCase() : '';
    if (idKey) addBucket(index.byId.get(idKey));
    const classes = el.classList;
    if (classes && classes.length) {
      for (let i = 0; i < classes.length; i += 1) {
        addBucket(index.byClass.get(String(classes[i]).toLowerCase()));
      }
    }
    if (matched.length > 1) {
      matched.sort((a, b) => a.order - b.order);
    }
    return matched;
  }

  function splitTopLevelSelectors(selectorText) {
    const text = String(selectorText || '');
    const parts = [];
    let start = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let quote = '';
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') { i += 1; continue; }
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(') { parenDepth += 1; continue; }
      if (ch === ')' && parenDepth > 0) { parenDepth -= 1; continue; }
      if (ch === '[') { bracketDepth += 1; continue; }
      if (ch === ']' && bracketDepth > 0) { bracketDepth -= 1; continue; }
      if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
        const part = text.slice(start, i).trim();
        if (part) parts.push(part);
        start = i + 1;
      }
    }
    const tail = text.slice(start).trim();
    if (tail) parts.push(tail);
    return parts;
  }

  function rightmostCompoundSelector(complexSelector) {
    const text = String(complexSelector || '').trim();
    if (!text) return '';
    let parenDepth = 0;
    let bracketDepth = 0;
    let quote = '';
    let lastBoundary = -1;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') { i += 1; continue; }
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '(') { parenDepth += 1; continue; }
      if (ch === ')' && parenDepth > 0) { parenDepth -= 1; continue; }
      if (ch === '[') { bracketDepth += 1; continue; }
      if (ch === ']' && bracketDepth > 0) { bracketDepth -= 1; continue; }
      if (parenDepth === 0 && bracketDepth === 0) {
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f'
          || ch === '>' || ch === '+' || ch === '~') {
          lastBoundary = i;
        }
      }
    }
    return text.slice(lastBoundary + 1).trim();
  }

  function bucketKeyForCompound(compound) {
    if (!compound || compound.includes('\\') || compound.includes('/*')) {
      return { kind: 'universal', key: '' };
    }
    let idKey = '';
    let classKey = '';
    let tagKey = '';
    let i = 0;
    const len = compound.length;

    if (i < len && isSimpleTagStart(compound[i])) {
      const start = i;
      while (i < len && isSimpleIdentChar(compound[i])) i += 1;
      if (i < len && compound[i] === '|') {
        return { kind: 'universal', key: '' };
      }
      tagKey = compound.slice(start, i).toLowerCase();
    } else if (i < len && compound[i] === '*') {
      i += 1;
      if (i < len && compound[i] === '|') return { kind: 'universal', key: '' };
    }

    let parenDepth = 0;
    let bracketDepth = 0;
    let quote = '';
    while (i < len) {
      const ch = compound[i];
      if (quote) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === quote) quote = '';
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; i += 1; continue; }
      if (ch === '(') { parenDepth += 1; i += 1; continue; }
      if (ch === ')' && parenDepth > 0) { parenDepth -= 1; i += 1; continue; }
      if (ch === '[') { bracketDepth += 1; i += 1; continue; }
      if (ch === ']' && bracketDepth > 0) { bracketDepth -= 1; i += 1; continue; }
      if (parenDepth === 0 && bracketDepth === 0 && (ch === '#' || ch === '.')) {
        const start = i + 1;
        let end = start;
        while (end < len && isSimpleIdentChar(compound[end])) end += 1;
        if (end > start) {
          const token = compound.slice(start, end).toLowerCase();
          if (ch === '#' && !idKey) idKey = token;
          else if (ch === '.' && !classKey) classKey = token;
        }
        i = end;
        continue;
      }
      i += 1;
    }

    if (idKey) return { kind: 'id', key: idKey };
    if (classKey) return { kind: 'class', key: classKey };
    if (tagKey) return { kind: 'tag', key: tagKey };
    return { kind: 'universal', key: '' };
  }

  function isSimpleTagStart(ch) {
    const code = ch.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  }

  function isSimpleIdentChar(ch) {
    const code = ch.charCodeAt(0);
    return (code >= 48 && code <= 57)
      || (code >= 65 && code <= 90)
      || (code >= 97 && code <= 122)
      || ch === '-'
      || ch === '_'
      || code >= 128;
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
    getStyleRuleIndex(rules);
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

  function authoredValue(styleDecl, propOrMeta, rawDecls) {
    const meta = typeof propOrMeta === 'string'
      ? (SNAPSHOT_PROP_META_BY_NAME.get(propOrMeta) || {
        prop: propOrMeta,
        cssName: cssPropertyName(propOrMeta),
        border: null,
      })
      : propOrMeta;
    const direct = styleDecl.getPropertyValue(meta.cssName) || styleDecl[meta.prop] || '';
    const rawDirect = rawDecls && rawDecls[meta.cssName];
    if (direct) return preciseLength(direct, rawDirect);
    if (rawDirect) return rawDirect;
    const border = meta.border;
    if (!border) return '';
    const side = border.side;
    const kind = border.kind;
    const rawSideShorthand = rawDecls && rawDecls[border.sideShorthand];
    if (rawSideShorthand) return borderShorthandValue(rawSideShorthand, kind);
    const rawBoxShorthand = rawDecls && rawDecls[border.boxShorthand];
    if (rawBoxShorthand) return borderBoxSideValue(rawBoxShorthand, side);
    const rawShorthand = rawDecls && rawDecls.border;
    if (rawShorthand) return borderShorthandValue(rawShorthand, kind);
    const sideShorthand = styleDecl.getPropertyValue(border.sideShorthand) || '';
    if (sideShorthand) return borderShorthandValue(sideShorthand, kind);
    const boxShorthand = styleDecl.getPropertyValue(border.boxShorthand) || '';
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
    const meta = SNAPSHOT_PROP_META_BY_NAME.get(prop);
    if (meta) return meta.cssName;
    return prop.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase());
  }

  const BORDER_SIDE_INDEX = { top: 0, right: 1, bottom: 2, left: 3 };

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
    return values[BORDER_SIDE_INDEX[side]] || '';
  }

  function borderShorthandValue(value, kind) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (kind === 'width') return parts.find((part) => BORDER_WIDTH_RE.test(part) || BORDER_WIDTH_KEYWORDS.has(part)) || '';
    if (kind === 'style') return parts.find((part) => BORDER_STYLE_KEYWORDS.has(part.toLowerCase())) || '';
    if (kind === 'color') return parts.find((part) => !BORDER_STYLE_KEYWORDS.has(part.toLowerCase()) && !BORDER_WIDTH_RE.test(part)) || '';
    return '';
  }

  function collectRawStyleBlocks() {
    const source = Array.from(document.querySelectorAll('style'))
      .map((el) => el.textContent || '')
      .join('\n');
    const blocks = new Map();
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
        const normalized = normalizeSelectorText(selectorText);
        let list = blocks.get(normalized);
        if (!list) {
          list = [];
          blocks.set(normalized, list);
        }
        list.push(declarations);
      }
      cursor = close;
    }
    return blocks;
  }

  function rawBlockForRule(selectorText, rawBlocks, used) {
    const normalized = normalizeSelectorText(selectorText);
    const list = rawBlocks.get(normalized);
    if (!list) return '';
    const next = used.get(normalized) || 0;
    if (next >= list.length) return '';
    used.set(normalized, next + 1);
    return list[next];
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
