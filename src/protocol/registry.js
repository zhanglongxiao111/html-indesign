const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');

function createFieldRegistry(entries = []) {
  if (!Array.isArray(entries)) {
    throw new Error('FIELD_REGISTRY_ENTRIES_INVALID');
  }

  const normalizedEntries = Object.freeze(entries.map((entry) => {
    const validation = validateFieldEntry(entry);
    if (!validation.valid) {
      const codes = validation.errors.map((error) => error.code).join(',');
      throw new Error(`FIELD_ENTRY_INVALID:${codes}`);
    }
    return deepFreeze(cloneValue(normalizeFieldEntry(entry)));
  }));

  const byPath = new Map();
  const byHtmlAttr = new Map();
  const byRetiredHtmlAttr = new Map();

  for (const entry of normalizedEntries) {
    for (const fieldPath of entry.allPaths) {
      if (byPath.has(fieldPath)) {
        throw new Error(`FIELD_PATH_DUPLICATED:${fieldPath}`);
      }
      byPath.set(fieldPath, entry);
    }

    for (const attr of htmlAttrsFor(entry)) {
      if (byHtmlAttr.has(attr)) {
        throw new Error(`HTML_ATTR_DUPLICATED:${attr}`);
      }
      byHtmlAttr.set(attr, entry);
    }

    for (const retiredAttr of retiredHtmlAttrsFor(entry)) {
      const attr = retiredAttr && retiredAttr.name;
      if (!attr) continue;
      if (byRetiredHtmlAttr.has(attr)) {
        throw new Error(`RETIRED_HTML_ATTR_DUPLICATED:${attr}`);
      }
      byRetiredHtmlAttr.set(attr, retiredHtmlAttrRecord(entry, retiredAttr));
    }
  }

  return {
    entries: normalizedEntries,
    getByPath(fieldPath) {
      return byPath.get(fieldPath) || null;
    },
    getByHtmlAttr(attr) {
      return byHtmlAttr.get(attr) || null;
    },
    getRetiredHtmlAttr(attr) {
      return byRetiredHtmlAttr.get(attr) || null;
    },
    listByOwner(owner) {
      return normalizedEntries.filter((entry) => entry.owner === owner);
    },
    listByClass(fieldClass) {
      return normalizedEntries.filter((entry) => entry.fieldClass === fieldClass);
    },
    listByLifecycle(lifecycle) {
      return normalizedEntries.filter((entry) => entry.lifecycle === lifecycle);
    },
  };
}

function htmlAttrsFor(entry) {
  const html = entry.html || {};
  const attrs = [
    ...arrayOrEmpty(html.readAttrs),
    ...arrayOrEmpty(html.writeAttrs),
    ...arrayOrEmpty(html.persistAttrs),
  ];

  return Array.from(new Set(attrs));
}

function retiredHtmlAttrsFor(entry) {
  const html = entry.html || {};
  return arrayOrEmpty(html.retiredAttrs);
}

function retiredHtmlAttrRecord(entry, retiredAttr) {
  return deepFreeze({
    canonicalPath: entry.canonicalPath,
    owner: entry.owner,
    fieldClass: entry.fieldClass,
    lifecycle: entry.lifecycle,
    name: retiredAttr.name,
    readPolicy: retiredAttr.readPolicy,
    writePolicy: retiredAttr.writePolicy,
    reason: retiredAttr.reason,
  });
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (value && typeof value === 'object') {
    const clone = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = cloneValue(item);
    }
    return clone;
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const item of Object.values(value)) {
    deepFreeze(item);
  }
  return Object.freeze(value);
}

module.exports = {
  createFieldRegistry,
};
