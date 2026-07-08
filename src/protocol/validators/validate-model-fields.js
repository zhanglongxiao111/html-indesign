const { scanModelPaths } = require('../scanners/scan-model-paths');
const {
  modelFieldPathInDomains,
  normalizeModelFieldDomains,
} = require('./model-field-domains');

function validateModelFields(registry, paths, options = {}) {
  const strict = options.strict === true;
  const domains = normalizeModelFieldDomains(options.domains);
  const valueRecords = modelFieldValueRecords(paths);
  const valuesByPath = valuesByModelPath(valueRecords);
  const accepted = [];
  const unknown = [];
  const retired = [];
  const invalidValues = [];
  const warnings = [];
  const errors = [];

  for (const path of uniqueStrings(modelFieldPaths(paths))) {
    const field = registry.getByPath(path);
    const inDomain = modelFieldPathInDomains(path, field, domains);
    if (!field) {
      unknown.push(path);
      const issue = {
        code: 'MODEL_FIELD_NOT_REGISTERED',
        path,
        message: `Model field path is not registered: ${path}`,
      };
      warnings.push(issue);
      if (strict && inDomain) {
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
      if (strict && inDomain) {
        errors.push({ ...issue });
      }
      continue;
    }

    if (inDomain) {
      const invalidForPath = invalidAllowedValues(path, field, valuesByPath.get(path));
      if (invalidForPath.length) {
        invalidValues.push(...invalidForPath);
        for (const invalidValue of invalidForPath) {
          const issue = {
            code: 'MODEL_FIELD_VALUE_NOT_ALLOWED',
            path,
            field,
            value: invalidValue.value,
            allowedValues: invalidValue.allowedValues,
            message: `Model field value is not allowed for ${path}: ${String(invalidValue.value)}`,
          };
          warnings.push(issue);
          if (strict) {
            errors.push({ ...issue });
          }
        }
      } else {
        accepted.push(path);
      }
    }
  }

  return {
    valid: errors.length === 0,
    accepted,
    unknown,
    retired,
    invalidValues,
    warnings,
    errors,
  };
}

function modelFieldPaths(pathsOrModel) {
  if (Array.isArray(pathsOrModel)) {
    for (const path of pathsOrModel) {
      if (typeof path !== 'string' || path.trim().length === 0) {
        throw new Error('MODEL_FIELD_INPUT_INVALID');
      }
    }
    return pathsOrModel;
  }
  if (isDocumentModel(pathsOrModel)) {
    return scanModelPaths(pathsOrModel);
  }
  throw new Error('MODEL_FIELD_INPUT_INVALID');
}

function modelFieldValueRecords(pathsOrModel) {
  if (!isDocumentModel(pathsOrModel)) {
    return [];
  }
  const records = [];
  collectItemValueRecords(records, pathsOrModel.parentPages);
  collectItemValueRecords(records, pathsOrModel.pages);
  collectStyleValueRecords(records, pathsOrModel.styles);
  return records;
}

function collectItemValueRecords(records, containers) {
  forEachPlainObject(containers, (container) => {
    forEachPlainObject(container.items, (item) => {
      addValueRecord(records, 'items[].role', item.role);
      if (isPlainObject(item.effectiveLabel)) {
        addValueRecord(records, 'items[].effectiveLabel.role', item.effectiveLabel.role);
      }
    });
  });
}

function collectStyleValueRecords(records, styles) {
  if (!isPlainObject(styles)) return;
  forEachPlainObject(styles.synthesized, (style) => {
    addValueRecord(records, 'styles.synthesized[].kind', style.kind);
  });
}

function addValueRecord(records, path, value) {
  if (value == null) return;
  records.push({ path, value });
}

function valuesByModelPath(records) {
  const out = new Map();
  for (const record of records || []) {
    const list = out.get(record.path) || [];
    list.push(record.value);
    out.set(record.path, list);
  }
  return out;
}

function invalidAllowedValues(path, field, values) {
  if (!field || !Array.isArray(field.allowedValues) || !field.allowedValues.length) {
    return [];
  }
  if (!Array.isArray(values) || !values.length) {
    return [];
  }
  const allowed = new Set(field.allowedValues);
  return values
    .filter((value) => !allowed.has(value))
    .map((value) => ({
      path,
      value,
      allowedValues: field.allowedValues.slice(),
      field,
    }));
}

function isDocumentModel(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.kind === 'DocumentModel';
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

function forEachPlainObject(values, visit) {
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => {
    if (isPlainObject(value)) {
      visit(value, index);
    }
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = Object.freeze({
  validateModelFields,
});
