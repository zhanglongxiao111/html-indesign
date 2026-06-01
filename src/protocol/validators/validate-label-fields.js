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
  const observed = [];
  const warnings = [];
  const errors = [];

  for (const path of uniqueStrings(paths)) {
    const field = labelFields.get(path);
    if (!field) {
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

    if (field.lifecycle === 'retired') {
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

    accepted.push(path);
  }

  return {
    valid: errors.length === 0,
    accepted,
    unknown,
    retired,
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
    for (const path of labelPathsForEntry(entry)) {
      if (!map.has(path) || map.get(path).lifecycle === 'retired') {
        map.set(path, entry);
      }
    }
  }
  return map;
}

function labelPathsForEntry(entry) {
  const paths = [];
  const indesign = entry.indesign || {};
  for (const path of arrayOrEmpty(indesign.labelPaths)) {
    paths.push(path);
  }
  for (const path of entry.allPaths || []) {
    const labelPath = labelPayloadPathFromRegisteredPath(path);
    if (labelPath) paths.push(labelPath);
  }
  return uniqueStrings(paths);
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
