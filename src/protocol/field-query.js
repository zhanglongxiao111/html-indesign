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
  const field = fieldFor(registry, fieldPath);

  if (field.lifecycle !== 'retired') {
    return {
      lifecycle: field.lifecycle,
      fieldClass: field.fieldClass,
      canonicalPath: field.canonicalPath,
      readPolicy: null,
      writePolicy: null,
      replacedBy: null,
    };
  }

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

  return retiredAttr;
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
