const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');

function createFieldRegistry(entries = []) {
  if (!Array.isArray(entries)) {
    throw new Error('FIELD_REGISTRY_ENTRIES_INVALID');
  }

  const normalizedEntries = entries.map((entry) => {
    const validation = validateFieldEntry(entry);
    if (!validation.valid) {
      const codes = validation.errors.map((error) => error.code).join(',');
      throw new Error(`FIELD_ENTRY_INVALID:${codes}`);
    }
    return normalizeFieldEntry(entry);
  });

  const byPath = new Map();
  const byHtmlAttr = new Map();

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
  }

  return {
    entries: normalizedEntries.slice(),
    getByPath(fieldPath) {
      return byPath.get(fieldPath) || null;
    },
    getByHtmlAttr(attr) {
      return byHtmlAttr.get(attr) || null;
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
    ...arrayOrEmpty(html.retiredAttrs)
      .map((retiredAttr) => retiredAttr && retiredAttr.name)
      .filter(Boolean),
  ];

  return Array.from(new Set(attrs));
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = {
  createFieldRegistry,
};
