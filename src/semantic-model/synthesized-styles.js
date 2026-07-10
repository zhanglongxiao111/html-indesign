const { sortObject, styleAtomForItem } = require('./style-atoms');

const DISPLAY_NAME_PREFIX = Object.freeze({
  text: '文字样式',
  line: '线条样式',
  object: '对象样式',
  frame: '图框样式',
  asset: '置入样式',
});

function normalizeSynthesizedStyles(model) {
  const normalized = cloneValue(model);
  const items = collectItems(normalized);
  const registry = buildSynthesizedStyleRegistry(items);
  const referenceById = new Map(registry.references.map((reference) => [reference.itemId, reference]));

  normalized.styles = {
    ...(isPlainObject(normalized.styles) ? normalized.styles : {}),
    synthesized: registry.styles,
  };

  for (const item of items) {
    const reference = referenceById.get(item.id);
    if (!reference) {
      continue;
    }
    item.styleRefs = {
      ...(isPlainObject(item.styleRefs) ? item.styleRefs : {}),
      synthesizedToken: reference.token,
      synthesizedName: reference.displayName,
    };
    if (Object.keys(reference.overrides).length > 0) {
      item.styleOverrides = mergeObjects(item.styleOverrides, reference.overrides);
    }
  }

  return normalized;
}

function buildSynthesizedStyleRegistry(items) {
  const groups = new Map();
  const orderedGroups = [];

  for (const item of items || []) {
    const atom = synthesizedStyleFingerprint(item);
    if (!atom) {
      continue;
    }
    let group = groups.get(atom.fingerprint);
    if (!group) {
      group = {
        kind: atom.kind,
        fingerprint: atom.fingerprint,
        properties: atom.properties,
        overrideBaseline: atom.overrideCandidates,
        items: [],
      };
      groups.set(atom.fingerprint, group);
      orderedGroups.push(group);
    }
    group.items.push({
      item,
      overrideCandidates: atom.overrideCandidates,
    });
  }

  const counters = new Map();
  const takenTokens = new Set();
  const styles = [];
  const references = [];

  for (const group of orderedGroups) {
    const inherited = inheritedGroupToken(group, takenTokens);
    if (inherited) {
      group.token = inherited.token;
      group.number = inherited.number;
      takenTokens.add(inherited.token);
    }
  }

  for (const group of orderedGroups) {
    if (!group.token) {
      let count = (counters.get(group.kind) || 0) + 1;
      let token = `synth_${group.kind}_${String(count).padStart(3, '0')}`;
      while (takenTokens.has(token)) {
        count += 1;
        token = `synth_${group.kind}_${String(count).padStart(3, '0')}`;
      }
      counters.set(group.kind, count);
      takenTokens.add(token);
      group.token = token;
      group.number = count;
    }
    const token = group.token;
    const displayName = `${DISPLAY_NAME_PREFIX[group.kind] || '样式'} ${String(group.number).padStart(2, '0')}`;
    const properties = mergeObjects(group.properties, group.overrideBaseline);

    styles.push({
      token,
      displayName,
      kind: group.kind,
      fingerprint: group.fingerprint,
      source: 'observed-style-atom',
      properties,
    });

    for (const entry of group.items) {
      references.push({
        itemId: entry.item.id,
        token,
        displayName,
        overrides: overridesFor(group.kind, group.overrideBaseline, entry.overrideCandidates),
      });
    }
  }

  return { styles, references };
}

function inheritedGroupToken(group, takenTokens) {
  const pattern = new RegExp(`^synth_${group.kind}_(\\d{3,})$`);
  for (const entry of group.items) {
    const refs = entry.item && entry.item.styleRefs;
    const candidate = refs && refs.synthesizedToken ? String(refs.synthesizedToken) : '';
    const match = pattern.exec(candidate);
    if (match && !takenTokens.has(candidate)) {
      return { token: candidate, number: Number(match[1]) };
    }
  }
  return null;
}

function synthesizedStyleFingerprint(item) {
  const atom = styleAtomForItem(item);
  if (!atom || Object.keys(atom.properties).length === 0) {
    return null;
  }
  const properties = sortObject(atom.properties);
  return {
    kind: atom.kind,
    fingerprint: `${atom.kind}:${stableStringify(properties)}`,
    properties,
    overrideCandidates: sortObject(atom.overrideCandidates || {}),
  };
}

function overridesFor(kind, baseline, candidates) {
  const overrides = {};
  const changed = {};
  const candidateValues = candidates || {};
  for (const [key, value] of Object.entries(candidateValues)) {
    if (!valuesEqual(value, baseline[key])) {
      changed[key] = value;
    }
  }
  if (Object.keys(changed).length > 0) {
    overrides[kind] = changed;
  }
  return overrides;
}

function collectItems(model) {
  const items = [];
  for (const page of arrayOrEmpty(model.pages)) {
    for (const item of arrayOrEmpty(page.items)) {
      items.push(item);
    }
  }
  for (const parentPage of arrayOrEmpty(model.parentPages)) {
    for (const item of arrayOrEmpty(parentPage.items)) {
      items.push(item);
    }
  }
  return items;
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function mergeObjects(left, right) {
  return {
    ...(isPlainObject(left) ? left : {}),
    ...(isPlainObject(right) ? right : {}),
  };
}

function valuesEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (isPlainObject(value)) {
    const clone = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = cloneValue(item);
    }
    return clone;
  }
  return value;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  buildSynthesizedStyleRegistry,
  normalizeSynthesizedStyles,
  synthesizedStyleFingerprint,
});
