function auditSynthesizedStyles(model) {
  const issues = [];
  const styles = Array.isArray(model && model.styles && model.styles.synthesized)
    ? model.styles.synthesized
    : [];
  const styleByToken = new Map();
  const fingerprintByKey = new Map();

  styles.forEach((style, index) => {
    const token = style && style.token;
    if (!token) {
      issues.push(issue('SYNTHESIZED_STYLE_TOKEN_MISSING', { styleIndex: index }));
      return;
    }
    if (styleByToken.has(token)) {
      issues.push(issue('SYNTHESIZED_STYLE_TOKEN_DUPLICATED', { token, styleIndex: index }));
    } else {
      styleByToken.set(token, style);
    }
    if (!style.displayName) {
      issues.push(issue('SYNTHESIZED_STYLE_DISPLAY_NAME_MISSING', { token, styleIndex: index }));
    }
    if (!style.kind) {
      issues.push(issue('SYNTHESIZED_STYLE_KIND_MISSING', { token, styleIndex: index }));
    }
    if (!style.fingerprint) {
      issues.push(issue('SYNTHESIZED_STYLE_FINGERPRINT_MISSING', { token, styleIndex: index }));
    } else {
      const key = `${style.kind || ''}:${style.fingerprint}`;
      if (fingerprintByKey.has(key)) {
        issues.push(issue('SYNTHESIZED_STYLE_FINGERPRINT_DUPLICATED', {
          token,
          otherToken: fingerprintByKey.get(key),
          fingerprint: style.fingerprint,
          styleIndex: index,
        }));
      } else {
        fingerprintByKey.set(key, token);
      }
    }
    if (!isPlainObject(style.properties)) {
      issues.push(issue('SYNTHESIZED_STYLE_PROPERTIES_INVALID', { token, styleIndex: index }));
    }
  });

  let referenceCount = 0;
  for (const item of collectItems(model)) {
    const refs = item.styleRefs || {};
    if (!refs.synthesizedToken) {
      continue;
    }
    referenceCount += 1;
    const style = styleByToken.get(refs.synthesizedToken);
    if (!style) {
      issues.push(issue('SYNTHESIZED_STYLE_REF_MISSING', {
        itemId: item.id || null,
        token: refs.synthesizedToken,
      }));
      continue;
    }
    if (refs.synthesizedName && style.displayName && refs.synthesizedName !== style.displayName) {
      issues.push(issue('SYNTHESIZED_STYLE_NAME_MISMATCH', {
        itemId: item.id || null,
        token: refs.synthesizedToken,
        expected: style.displayName,
        actual: refs.synthesizedName,
      }));
    }
  }

  return {
    kind: 'SynthesizedStyleAuditReport',
    ok: issues.length === 0,
    summary: {
      styleCount: styles.length,
      referenceCount,
      issueCount: issues.length,
    },
    issues,
  };
}

function collectItems(model) {
  const items = [];
  for (const page of arrayOrEmpty(model && model.pages)) {
    for (const item of arrayOrEmpty(page.items)) items.push(item);
  }
  for (const parentPage of arrayOrEmpty(model && model.parentPages)) {
    for (const item of arrayOrEmpty(parentPage.items)) items.push(item);
  }
  return items;
}

function issue(code, extra = {}) {
  return {
    code,
    ...extra,
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  auditSynthesizedStyles,
});
