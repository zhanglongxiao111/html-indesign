function validateInstructionFields(registry, paths, options = {}) {
  const strict = options.strict === true;
  const accepted = [];
  const unknown = [];
  const retired = [];
  const warnings = [];
  const errors = [];

  for (const path of uniqueStrings(paths)) {
    const registryPath = `instructions.${path}`;
    const field = registry.getByPath(registryPath);
    if (!field) {
      unknown.push(path);
      const issue = {
        code: 'INSTRUCTION_FIELD_NOT_REGISTERED',
        path,
        registryPath,
        message: `Instruction field path is not registered: ${registryPath}`,
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
        registryPath,
        field,
      });
      const issue = {
        code: 'INSTRUCTION_FIELD_RETIRED',
        path,
        registryPath,
        field,
        message: `Retired instruction field path must not be accepted: ${registryPath}`,
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
  validateInstructionFields,
});
