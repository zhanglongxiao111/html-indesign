function validateRetiredFields(registry, input = {}) {
  if (
    !registry
    || typeof registry.getRetiredHtmlAttr !== 'function'
    || typeof registry.getRetiredModelPath !== 'function'
  ) {
    throw new Error('RETIRED_FIELD_REGISTRY_INVALID');
  }

  const htmlAttrs = uniqueStrings(input.htmlAttrs);
  const modelPaths = uniqueStrings(input.modelPaths);
  const direction = input.direction === undefined ? 'read' : input.direction;
  if (direction !== 'read' && direction !== 'write') {
    throw new Error(`RETIRED_FIELD_DIRECTION_INVALID:${direction}`);
  }

  const errors = [];
  const observations = [];

  for (const attr of htmlAttrs) {
    const policy = registry.getRetiredHtmlAttr(attr);
    if (!policy) continue;

    if (direction === 'write' && policy.writePolicy === 'forbidden') {
      errors.push({
        code: 'RETIRED_FIELD_WRITE_FORBIDDEN',
        field: attr,
        canonicalPath: policy.canonicalPath,
        replacedBy: policy.replacedBy || null,
        reason: policy.reason || null,
        policy,
      });
      continue;
    }

    observations.push({
      field: attr,
      canonicalPath: policy.canonicalPath,
      readPolicy: policy.readPolicy,
      writePolicy: policy.writePolicy,
      replacedBy: policy.replacedBy || null,
      reason: policy.reason || null,
      policy,
    });
  }

  for (const path of modelPaths) {
    const policy = registry.getRetiredModelPath(path);
    if (!policy) {
      errors.push({
        code: 'RETIRED_MODEL_PATH_UNKNOWN',
        field: path,
        message: `Retired model path is not registered: ${path}`,
      });
      continue;
    }

    if (direction === 'write' && policy.writePolicy === 'forbidden') {
      errors.push({
        code: 'RETIRED_FIELD_WRITE_FORBIDDEN',
        field: path,
        canonicalPath: policy.canonicalPath,
        replacedBy: policy.replacedBy || null,
        reason: policy.reason || null,
        policy,
      });
      continue;
    }

    observations.push({
      field: path,
      canonicalPath: policy.canonicalPath,
      readPolicy: policy.readPolicy,
      writePolicy: policy.writePolicy,
      replacedBy: policy.replacedBy || null,
      reason: policy.reason || null,
      policy,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    observations,
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
  validateRetiredFields,
});
