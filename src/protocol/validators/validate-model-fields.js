function validateModelFields(registry, paths, options = {}) {
  const strict = options.strict === true;
  const accepted = [];
  const unknown = [];
  const retired = [];
  const warnings = [];
  const errors = [];

  for (const path of uniqueStrings(paths)) {
    const field = registry.getByPath(path);
    if (!field) {
      unknown.push(path);
      const issue = {
        code: 'MODEL_FIELD_NOT_REGISTERED',
        path,
        message: `Model field path is not registered: ${path}`,
      };
      warnings.push(issue);
      if (strict) {
        errors.push({ ...issue });
      }
      continue;
    }

    if (field.lifecycle === 'retired') {
      retired.push({
        path,
        field,
      });
      const issue = {
        code: 'MODEL_FIELD_RETIRED',
        path,
        field,
        message: `Retired model field path must not be accepted: ${path}`,
      };
      warnings.push(issue);
      if (strict) {
        errors.push({ ...issue });
      }
      continue;
    }

    accepted.push(path);
  }

  return {
    valid: errors.length === 0,
    accepted,
    unknown,
    retired,
    warnings,
    errors,
  };
}

function uniqueStrings(values) {
  const list = Array.isArray(values) ? values : [];
  const seen = new Set();
  const unique = [];

  for (const value of list) {
    if (typeof value !== 'string' || seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }

  return unique;
}

module.exports = Object.freeze({
  validateModelFields,
});
