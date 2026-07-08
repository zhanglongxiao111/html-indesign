const { DIRECTIONS, FORMATS, isCapabilityLevel } = require('./capability');

const hasOwn = Object.prototype.hasOwnProperty;

function fieldFor(registry, fieldPath) {
  const field = registry.getByPath(fieldPath);
  if (!field) {
    throw new Error(`FIELD_NOT_REGISTERED:${fieldPath}`);
  }
  return field;
}

function capabilityFor(registry, fieldPath, format) {
  if (!FORMATS.includes(format)) {
    throw new Error(`CAPABILITY_FORMAT_INVALID:${format}`);
  }

  const field = fieldFor(registry, fieldPath);
  const capabilities = field.capabilities;
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw invalidCapabilityDeclaration(fieldPath, format, 'capabilities');
  }

  const capability = capabilities[format];
  if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
    throw invalidCapabilityDeclaration(fieldPath, format, 'format');
  }

  for (const direction of DIRECTIONS) {
    if (!hasOwn.call(capability, direction)) {
      throw invalidCapabilityDeclaration(fieldPath, format, direction);
    }
    const level = capability[direction];
    if (!isCapabilityLevel(level)) {
      throw invalidCapabilityDeclaration(fieldPath, format, `${direction}:${level}`);
    }
  }

  return capability;
}

function assertWritable(registry, fieldPath, format) {
  const capability = capabilityFor(registry, fieldPath, format);
  const level = capability.write;

  if (level === 'unsupported' || level === 'observe-only') {
    throw new Error(`FIELD_WRITE_FORBIDDEN:${format}:${fieldPath}:${level}`);
  }

  return capability;
}

function lifecyclePolicyFor(registry, fieldPath) {
  const retiredModelPath = retiredModelPathRecordFor(registry, fieldPath);
  if (retiredModelPath) {
    return retiredModelPathPolicy(retiredModelPath);
  }

  const field = fieldFor(registry, fieldPath);

  if (field.lifecycle !== 'retired') {
    if (hasRetiredPolicyMetadata(field)) {
      throw invalidLifecyclePolicy(fieldPath);
    }

    return {
      lifecycle: field.lifecycle,
      fieldClass: field.fieldClass,
      canonicalPath: field.canonicalPath,
      readPolicy: null,
      writePolicy: null,
      replacedBy: null,
    };
  }

  if (hasRetiredHtmlAttrs(field)) {
    const retiredAttr = retiredHtmlAttrPolicy(field, fieldPath);

    return {
      lifecycle: field.lifecycle,
      fieldClass: field.fieldClass,
      canonicalPath: field.canonicalPath,
      name: retiredAttr.name,
      readPolicy: retiredAttr.readPolicy,
      writePolicy: retiredAttr.writePolicy,
      replacedBy: retiredAttr.replacedBy || null,
    };
  }

  return retiredModelPathPolicy(retiredModelPathPolicyFromField(field, fieldPath));
}

function retiredHtmlAttrPolicy(field, fieldPath) {
  const htmlAttrs = field.retired && field.retired.htmlAttrs;
  if (!Array.isArray(htmlAttrs) || htmlAttrs.length !== 1) {
    throw invalidLifecyclePolicy(fieldPath);
  }

  const retiredAttr = htmlAttrs[0];
  if (
    !retiredAttr
    || typeof retiredAttr.name !== 'string'
    || retiredAttr.name.length === 0
    || typeof retiredAttr.readPolicy !== 'string'
    || retiredAttr.readPolicy.length === 0
    || typeof retiredAttr.writePolicy !== 'string'
    || retiredAttr.writePolicy.length === 0
  ) {
    throw invalidLifecyclePolicy(fieldPath);
  }

  for (const key of ['replacedBy', 'reason']) {
    if (
      hasOwn.call(retiredAttr, key)
      && (typeof retiredAttr[key] !== 'string' || retiredAttr[key].length === 0)
    ) {
      throw invalidLifecyclePolicy(fieldPath);
    }
  }

  return retiredAttr;
}

function retiredModelPathRecordFor(registry, fieldPath) {
  if (!registry || typeof registry.getRetiredModelPath !== 'function') {
    return null;
  }
  return registry.getRetiredModelPath(fieldPath);
}

function retiredModelPathPolicyFromField(field, fieldPath) {
  const modelPaths = field.retired && field.retired.modelPaths;
  if (!Array.isArray(modelPaths) || modelPaths.length === 0) {
    throw invalidLifecyclePolicy(fieldPath);
  }

  const retiredPath = modelPaths.find((policy) => policy && policy.path === fieldPath)
    || (field.canonicalPath === fieldPath && modelPaths.length === 1 ? modelPaths[0] : null);
  if (!retiredPath) {
    throw invalidLifecyclePolicy(fieldPath);
  }

  return {
    canonicalPath: field.canonicalPath,
    fieldClass: field.fieldClass,
    lifecycle: field.lifecycle,
    path: retiredPath.path,
    readPolicy: retiredPath.readPolicy,
    writePolicy: 'forbidden',
    replacedBy: retiredPath.replacedBy,
    reason: retiredPath.reason,
  };
}

function retiredModelPathPolicy(policy) {
  if (
    !policy
    || typeof policy.path !== 'string'
    || policy.path.length === 0
    || typeof policy.readPolicy !== 'string'
    || policy.readPolicy.length === 0
    || typeof policy.replacedBy !== 'string'
    || policy.replacedBy.length === 0
    || typeof policy.reason !== 'string'
    || policy.reason.length === 0
  ) {
    throw invalidLifecyclePolicy(policy && policy.path || 'unknown');
  }

  return {
    lifecycle: policy.lifecycle,
    fieldClass: policy.fieldClass,
    canonicalPath: policy.canonicalPath,
    path: policy.path,
    readPolicy: policy.readPolicy,
    writePolicy: policy.writePolicy || 'forbidden',
    replacedBy: policy.replacedBy,
    reason: policy.reason,
  };
}

function hasRetiredHtmlAttrs(field) {
  const retired = field.retired;
  return retired
    && typeof retired === 'object'
    && !Array.isArray(retired)
    && hasOwn.call(retired, 'htmlAttrs');
}

function hasRetiredModelPaths(field) {
  const retired = field.retired;
  return retired
    && typeof retired === 'object'
    && !Array.isArray(retired)
    && hasOwn.call(retired, 'modelPaths');
}

function hasRetiredPolicyMetadata(field) {
  return hasRetiredHtmlAttrs(field) || hasRetiredModelPaths(field);
}

function invalidCapabilityDeclaration(fieldPath, format, detail) {
  return new Error(`CAPABILITY_DECLARATION_INVALID:${fieldPath}:${format}:${detail}`);
}

function invalidLifecyclePolicy(fieldPath) {
  return new Error(`LIFECYCLE_POLICY_INVALID:${fieldPath}`);
}

module.exports = Object.freeze({
  assertWritable,
  capabilityFor,
  fieldFor,
  lifecyclePolicyFor,
});
