(function installBrowserPseudoMaterialize(globalObject) {
  const HOST_MARKER_BEFORE = 'data-pseudo-materialized-before';
  const HOST_MARKER_AFTER = 'data-pseudo-materialized-after';
  const GENERATED_MARKER = 'data-pseudo-generated';
  const STYLE_MARKER = 'data-pseudo-materialize-style';

  // Layout-relevant properties copied from the pseudo-element onto the
  // generated span so that disabling the pseudo rule does not shift layout.
  const COPY_PROPS = [
    'position', 'top', 'right', 'bottom', 'left', 'display',
    'width', 'height', 'box-sizing',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-align', 'white-space',
    'color', 'background-color', 'border-radius', 'opacity', 'z-index',
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-right-width', 'border-right-style', 'border-right-color',
    'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
    'border-left-width', 'border-left-style', 'border-left-color',
  ];

  // Only a concatenation of quoted string literals is safe to materialize;
  // counter()/attr()/url()/quotes keep their unsupported status and block.
  function staticPseudoText(el, pseudo) {
    const style = getComputedStyle(el, pseudo);
    if (!style || style.display === 'none') return null;
    const content = String(style.content || '');
    if (!/^"(?:[^"\\]|\\.)*"(?:\s+"(?:[^"\\]|\\.)*")*$/.test(content)) return null;
    const text = (content.match(/"(?:[^"\\]|\\.)*"/g) || [])
      .map((part) => part.slice(1, -1).replace(/\\(.)/g, '$1'))
      .join('');
    if (!text.trim()) return null;
    const styleCopy = {};
    for (const name of COPY_PROPS) {
      const value = style.getPropertyValue(name);
      if (value != null && String(value).trim() !== '') styleCopy[name] = value;
    }
    return { text, styleCopy };
  }

  function materializePseudoContent(pageEl) {
    const doc = pageEl.ownerDocument || document;
    const targets = [];
    for (const el of [pageEl, ...Array.from(pageEl.querySelectorAll('*'))]) {
      for (const pseudo of ['::before', '::after']) {
        const marker = pseudo === '::before' ? HOST_MARKER_BEFORE : HOST_MARKER_AFTER;
        if (el.hasAttribute(marker)) continue;
        const found = staticPseudoText(el, pseudo);
        if (found) targets.push({ el, pseudo, marker, found });
      }
    }
    const materialized = [];
    for (const target of targets) {
      const span = doc.createElement('span');
      span.textContent = target.found.text;
      for (const name of Object.keys(target.found.styleCopy)) {
        span.style.setProperty(name, target.found.styleCopy[name]);
      }
      span.setAttribute(GENERATED_MARKER, target.pseudo === '::before' ? 'before' : 'after');
      if (target.pseudo === '::before') target.el.insertBefore(span, target.el.firstChild);
      else target.el.appendChild(span);
      target.el.setAttribute(target.marker, 'true');
      materialized.push({
        pseudo: target.pseudo === '::before' ? 'before' : 'after',
        text: target.found.text,
        hostTag: target.el.tagName.toLowerCase(),
        hostId: target.el.id || target.el.getAttribute('data-id') || null,
      });
    }
    if (materialized.length) ensureDisableRule(doc);
    return materialized;
  }

  function ensureDisableRule(doc) {
    if (doc.querySelector(`style[${STYLE_MARKER}]`)) return;
    const styleEl = doc.createElement('style');
    styleEl.setAttribute(STYLE_MARKER, 'true');
    styleEl.textContent = [
      `[${HOST_MARKER_BEFORE}]::before { content: none !important; }`,
      `[${HOST_MARKER_AFTER}]::after { content: none !important; }`,
    ].join('\n');
    doc.head.appendChild(styleEl);
  }

  const api = { materializePseudoContent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalObject) globalObject.htmlIndesignBrowserPseudoMaterialize = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
