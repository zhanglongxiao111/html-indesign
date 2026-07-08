function validateLabelFields(registry, label, options = {}) {
  if (!registry || !Array.isArray(registry.entries)) {
    throw new Error('LABEL_FIELD_REGISTRY_INVALID');
  }

  const strict = options.strict === true;
  const paths = scanLabelPayloadPaths(label);
  const labelFields = labelFieldMap(registry);
  const accepted = [];
  const unknown = [];
  const retired = [];
  const disallowed = [];
  const invalidValues = [];
  const observed = [];
  const warnings = [];
  const errors = [];
  const labelKind = cleanLabelKind(options.kind || label.kind);

  for (const path of uniqueStrings(paths)) {
    const record = labelFields.get(path);
    if (!record) {
      unknown.push(path);
      observed.push(path);
      const issue = {
        code: 'LABEL_FIELD_NOT_REGISTERED',
        path,
        message: `InDesign label payload field is not registered: ${path}`,
      };
      warnings.push(issue);
      if (strict) errors.push({ ...issue });
      continue;
    }

    const activeEntries = record.entries.filter((entry) => entry.field.lifecycle !== 'retired');
    if (!activeEntries.length) {
      const field = record.entries[0].field;
      retired.push({ path, field });
      observed.push(path);
      const issue = {
        code: 'LABEL_FIELD_RETIRED',
        path,
        field,
        message: `Retired InDesign label payload field must not be accepted: ${path}`,
      };
      warnings.push(issue);
      if (strict) errors.push({ ...issue });
      continue;
    }

    const allowedEntries = activeEntries.filter((entry) => labelKindAllowed(entry, labelKind));
    if (!allowedEntries.length) {
      disallowed.push({
        path,
        labelKind,
        allowedLabelKinds: allowedLabelKindsFor(activeEntries),
        field: activeEntries[0].field,
      });
      observed.push(path);
      const issue = {
        code: 'LABEL_FIELD_KIND_NOT_ALLOWED',
        path,
        labelKind,
        allowedLabelKinds: allowedLabelKindsFor(activeEntries),
        field: activeEntries[0].field,
        message: `InDesign label payload field is not allowed on ${labelKind || 'unknown'} labels: ${path}`,
      };
      warnings.push(issue);
      if (strict) errors.push({ ...issue });
      continue;
    }

    const invalidValue = invalidAllowedValue(path, label[path], allowedEntries);
    if (invalidValue) {
      invalidValues.push(invalidValue);
      observed.push(path);
      const issue = {
        code: 'LABEL_FIELD_VALUE_NOT_ALLOWED',
        path,
        value: invalidValue.value,
        allowedValues: invalidValue.allowedValues,
        field: invalidValue.field,
        message: `InDesign label payload field value is not allowed for ${path}: ${String(invalidValue.value)}`,
      };
      warnings.push(issue);
      if (strict) errors.push({ ...issue });
      continue;
    }

    accepted.push(path);
  }

  return {
    valid: errors.length === 0,
    accepted,
    unknown,
    retired,
    disallowed,
    invalidValues,
    observed,
    warnings,
    errors,
  };
}

function scanLabelPayloadPaths(label) {
  const paths = [];
  const seen = new Set();
  if (!isPlainObject(label)) return paths;

  for (const [key, value] of Object.entries(label)) {
    addPath(paths, seen, key);
    if (key === 'styleRefs') {
      scanNestedObject(paths, seen, value, 'styleRefs');
    }
  }

  return paths;
}

function scanNestedObject(paths, seen, value, prefix) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    addPath(paths, seen, `${prefix}.${key}`);
  }
}

function labelFieldMap(registry) {
  const map = new Map();
  for (const entry of registry.entries) {
    for (const labelPath of labelPathsForEntry(entry)) {
      const record = map.get(labelPath.path) || { entries: [] };
      if (!record.entries.some((item) => item.field === entry)) {
        record.entries.push({
          path: labelPath.path,
          field: entry,
          labelKinds: labelPath.labelKinds,
        });
      }
      map.set(labelPath.path, record);
    }
  }
  return map;
}

function labelPathsForEntry(entry) {
  const paths = [];
  const indesign = entry.indesign || {};
  const labelKinds = normalizeLabelKinds(indesign.labelKinds);
  for (const path of arrayOrEmpty(indesign.labelPaths)) {
    paths.push({ path, labelKinds });
  }
  for (const path of entry.allPaths || []) {
    const labelPath = labelPayloadPathFromRegisteredPath(path);
    if (labelPath) paths.push({ path: labelPath, labelKinds });
  }
  return uniqueLabelPathRecords(paths);
}

function labelPayloadPathFromRegisteredPath(path) {
  if (typeof path !== 'string') return null;
  if (path.startsWith('labels[].')) {
    return path.slice('labels[].'.length);
  }
  if (path.startsWith('effectiveLabel.')) {
    return path.slice('effectiveLabel.'.length);
  }
  if (path.startsWith('items[].effectiveLabel.')) {
    return path.slice('items[].effectiveLabel.'.length);
  }
  return null;
}

function uniqueStrings(values) {
  const list = Array.isArray(values) ? values : [];
  const seen = new Set();
  const unique = [];

  for (const value of list) {
    if (typeof value !== 'string' || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function uniqueLabelPathRecords(records) {
  const seen = new Set();
  const unique = [];
  for (const record of records) {
    if (!record || typeof record.path !== 'string' || record.path.length === 0) continue;
    const key = `${record.path}\0${record.labelKinds.join('\0')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function labelKindAllowed(entry, labelKind) {
  if (!labelKind) return false;
  return entry.labelKinds.includes(labelKind);
}

function allowedLabelKindsFor(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    for (const kind of entry.labelKinds) {
      if (seen.has(kind)) continue;
      seen.add(kind);
      out.push(kind);
    }
  }
  return out;
}

function invalidAllowedValue(path, value, entries) {
  const fields = entries
    .map((entry) => entry.field)
    .filter((field) => Array.isArray(field.allowedValues) && field.allowedValues.length);
  if (!fields.length) return null;
  const normalized = normalizeAllowedValue(value);
  if (fields.some((field) => field.allowedValues.includes(normalized))) {
    return null;
  }
  const field = fields[0];
  return {
    path,
    value,
    normalizedValue: normalized,
    allowedValues: field.allowedValues.slice(),
    field,
  };
}

function normalizeLabelKinds(value) {
  return uniqueStrings(value).map(cleanLabelKind).filter(Boolean);
}

function cleanLabelKind(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAllowedValue(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function addPath(paths, seen, path) {
  if (seen.has(path)) return;
  seen.add(path);
  paths.push(path);
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  validateLabelFields,
});
