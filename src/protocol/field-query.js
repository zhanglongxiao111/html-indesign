const { FORMATS } = require('./capability');

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
  const capabilities = field.capabilities || {};
  if (!hasOwn.call(capabilities, format)) {
    throw new Error(`CAPABILITY_MISSING:${format}:${fieldPath}`);
  }

  return capabilities[format];
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

  const retiredAttr = firstRetiredHtmlAttr(field);
  if (!retiredAttr || !retiredAttr.readPolicy || !retiredAttr.writePolicy) {
    throw new Error(`RETIRED_POLICY_MISSING:${fieldPath}`);
  }

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

function firstRetiredHtmlAttr(field) {
  const htmlAttrs = field.retired && field.retired.htmlAttrs;
  return Array.isArray(htmlAttrs) ? htmlAttrs[0] : null;
}

module.exports = Object.freeze({
  assertWritable,
  capabilityFor,
  fieldFor,
  lifecyclePolicyFor,
});
