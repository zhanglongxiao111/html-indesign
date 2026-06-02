function validateDataIdFields(registry, attrs, options = {}) {
  const strict = options.strict === true;
  const accepted = [];
  const unknown = [];
  const retired = [];
  const warnings = [];
  const errors = [];

  for (const attr of uniqueStrings(attrs)) {
    const field = registry.getByHtmlAttr(attr);
    if (field) {
      accepted.push(attr);
      continue;
    }

    const retiredPolicy = registry.getRetiredHtmlAttr(attr);
    if (retiredPolicy) {
      retired.push({
        name: attr,
        policy: retiredPolicy,
      });
      const issue = {
        code: 'DATA_ID_FIELD_RETIRED',
        name: attr,
        policy: retiredPolicy,
        message: `Retired data-id field is observe-only and must not be accepted: ${attr}`,
      };
      warnings.push(issue);
      if (strict) {
        errors.push({ ...issue });
      }
      continue;
    }

    unknown.push(attr);
    const issue = {
      code: 'DATA_ID_FIELD_NOT_REGISTERED',
      name: attr,
      message: `Data-id field is not registered: ${attr}`,
    };
    warnings.push(issue);
    if (strict) {
      errors.push({ ...issue });
    }
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
  validateDataIdFields,
});
