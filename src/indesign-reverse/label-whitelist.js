'use strict';

const { fieldRegistry, validateLabelFields } = require('../protocol');

function validateReverseLabel(label = {}, options = {}) {
  const preset = options.preset || {};
  const known = knownTokens(preset);
  const effective = {};
  const observed = {};
  const rejectedFields = {};
  const rejectionReasons = [];
  const warnings = [];
  const errors = [];
  let fieldValidation = null;

  if (shouldValidateFields(options)) {
    fieldValidation = validateLabelFields(fieldRegistry, label, {
      strict: options.strictFields === true,
      mode: options.mode,
    });
    warnings.push(...fieldValidation.warnings);
    errors.push(...fieldValidation.errors);
    applyFieldValidation(label, fieldValidation, observed, rejectedFields, rejectionReasons);
  }
  applySemantic(label, known, effective, observed, rejectedFields, rejectionReasons);
  applyLayout(label, known, effective, observed, rejectedFields, rejectionReasons);
  applyStyleRefs(label, known, effective, observed, rejectedFields, rejectionReasons);
  applySourceFields(label, effective, observed);
  applyPageFields(label, effective, options, fieldValidation);

  return {
    status: statusFor(effective, observed, rejectionReasons),
    effective: normalizeLabelShape(effective),
    observed,
    rejectedFields,
    rejectionReasons,
    valid: errors.length === 0,
    warnings,
    errors,
    fieldValidation,
  };
}

function shouldValidateFields(options) {
  return options.strictFields === true
    || options.warnFields === true
    || options.mode === 'observation';
}

function applyFieldValidation(label, validation, observed, rejectedFields, reasons) {
  for (const path of [...validation.unknown, ...validation.retired.map((entry) => entry.path)]) {
    observeRejectedPayloadPath(label, path, observed);
    rejectedFields[path] = 'label-field-not-registered';
    if (!reasons.includes('label-field-not-registered')) {
      reasons.push('label-field-not-registered');
    }
  }
}

function observeRejectedPayloadPath(label, path, observed) {
  const parts = String(path || '').split('.');
  if (!parts.length) return;
  if (parts.length === 1) {
    const key = parts[0];
    if (Object.prototype.hasOwnProperty.call(label, key)) {
      observed[key] = clone(label[key]);
    }
    return;
  }

  const [head, ...tail] = parts;
  const value = valueAtPath(label, [head, ...tail]);
  if (value === undefined) return;
  if (!observed[head] || typeof observed[head] !== 'object' || Array.isArray(observed[head])) {
    observed[head] = {};
  }
  setValueAtPath(observed[head], tail, clone(value));
}

function valueAtPath(value, parts) {
  let current = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function setValueAtPath(target, parts, value) {
  let current = target;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
}

function applySemantic(label, known, effective, observed, rejectedFields, reasons) {
  const semantic = clean(label.semantic);
  const role = clean(label.role);
  if (role) effective.role = role;
  if (!semantic) {
    effective.semantic = null;
    return;
  }
  if (!isKnown(known.semantic, semantic)) {
    observed.semantic = semantic;
    rejectedFields.semantic = 'unknown-semantic';
    reasons.push('unknown-semantic');
    effective.semantic = null;
    return;
  }
  const allowedRoles = known.semanticRoles.get(semantic);
  if (role && allowedRoles && allowedRoles.size && !allowedRoles.has(role)) {
    observed.semantic = semantic;
    rejectedFields.semantic = 'role-mismatch';
    reasons.push('role-mismatch');
    effective.semantic = null;
    return;
  }
  effective.semantic = semantic;
}

function applyLayout(label, known, effective, observed, rejectedFields, reasons) {
  const layout = label.layout == null ? null : label.layout;
  if (!layout) {
    effective.layout = null;
    return;
  }
  if (known.enforceLayouts && !isKnown(known.layouts, layout)) {
    observed.layout = layout;
    rejectedFields.layout = 'unknown-layout';
    reasons.push('unknown-layout');
    effective.layout = null;
    return;
  }
  effective.layout = layout;
}

function applyStyleRefs(label, known, effective, observed, rejectedFields, reasons) {
  const input = label.styleRefs || styleRefsFromLabel(label);
  const output = {};
  const rejected = {};
  for (const [field, tokenSetName, reason] of [
    ['paragraphStyle', 'paragraphStyles', 'unknown-paragraph-style'],
    ['characterStyle', 'characterStyles', 'unknown-character-style'],
    ['objectStyle', 'objectStyles', 'unknown-object-style'],
    ['frameStyle', 'frameStyles', 'unknown-frame-style'],
    ['tableStyle', 'tableStyles', 'unknown-table-style'],
    ['cellStyle', 'cellStyles', 'unknown-cell-style'],
    ['layer', 'layers', 'unknown-layer'],
  ]) {
    const value = clean(input[field] || input[`${field}Token`]);
    if (!value) continue;
    if (known.enforcedStyleKinds.has(tokenSetName) && !isKnown(known[tokenSetName], value)) {
      rejected[field] = value;
      rejectedFields[field] = reason;
      reasons.push(reason);
    } else {
      output[field] = value;
    }
  }
  if (Object.keys(output).length) effective.styleRefs = output;
  if (Object.keys(rejected).length) observed.styleRefs = rejected;
}

function applySourceFields(label, effective, observed) {
  for (const name of ['sourceNode', 'sourceAncestorNodes', 'sourceFile', 'sourceText', 'sourceHtml', 'sourceRuns', 'structure']) {
    if (label[name] == null) continue;
    if (canTrustSourceFields(effective, observed)) {
      effective[name] = clone(label[name]);
    } else {
      observed[name] = clone(label[name]);
    }
  }
  if (label.htmlTag && canTrustSourceFields(effective, observed)) effective.htmlTag = label.htmlTag;
  if (label.className && canTrustSourceFields(effective, observed)) effective.className = label.className;
  if (label.htmlTag && !canTrustSourceFields(effective, observed)) observed.htmlTag = label.htmlTag;
  if (label.className && !canTrustSourceFields(effective, observed)) observed.className = label.className;
}

function applyPageFields(label, effective, options = {}, fieldValidation = null) {
  if (options.kind !== 'page') return;
  for (const name of ['parentPage', 'parentPageId', 'parentPageName', 'grid', 'margins']) {
    if (label[name] == null) continue;
    if (!isAcceptedPageLabelField(name, fieldValidation)) continue;
    effective[name] = clone(label[name]);
  }
}

function isAcceptedPageLabelField(name, fieldValidation) {
  const field = fieldRegistry.getByPath(`labels[].${name}`);
  if (!field || field.lifecycle !== 'active') return false;
  if (!fieldValidation) return true;
  return fieldValidation.accepted.includes(name);
}

function canTrustSourceFields(effective, observed) {
  return Boolean(effective.semantic) || !observed.semantic;
}

function normalizeLabelShape(effective) {
  return {
    ...effective,
    semantic: effective.semantic || null,
    layout: Object.prototype.hasOwnProperty.call(effective, 'layout') ? effective.layout : null,
  };
}

function statusFor(effective, observed, reasons) {
  if (reasons.length && hasAnyEffectiveProtocolField(effective)) return 'partial';
  if (reasons.length || Object.keys(observed).length) return 'observed';
  return 'accepted';
}

function hasAnyEffectiveProtocolField(effective) {
  return Boolean(
    effective.semantic
      || effective.layout
      || effective.styleRefs
      || effective.sourceNode
      || effective.structure
      || effective.parentPage
      || effective.parentPageId
      || effective.parentPageName
      || effective.grid
      || effective.margins,
  );
}

function styleRefsFromLabel(label) {
  return {
    paragraphStyle: label.paragraphStyle || label.paragraphStyleToken || dataAttr(label.sourceNode, 'data-id-paragraph-style'),
    characterStyle: label.characterStyle || label.characterStyleToken || dataAttr(label.sourceNode, 'data-id-character-style'),
    objectStyle: label.objectStyle || label.objectStyleToken || dataAttr(label.sourceNode, 'data-id-object-style'),
    frameStyle: label.frameStyle || label.frameStyleToken || dataAttr(label.sourceNode, 'data-id-frame-style'),
    tableStyle: label.tableStyle || label.tableStyleToken || dataAttr(label.sourceNode, 'data-id-table-style'),
    cellStyle: label.cellStyle || label.cellStyleToken || dataAttr(label.sourceNode, 'data-id-cell-style'),
    layer: label.layer || label.layerToken || dataAttr(label.sourceNode, 'data-id-layer'),
  };
}

function dataAttr(sourceNode, name) {
  return sourceNode && sourceNode.attributes && sourceNode.attributes[name];
}

function knownTokens(preset) {
  const out = {
    semantic: new Set(),
    semanticRoles: new Map(),
    layouts: new Set(),
    paragraphStyles: new Set(),
    characterStyles: new Set(),
    objectStyles: new Set(),
    frameStyles: new Set(),
    tableStyles: new Set(),
    cellStyles: new Set(),
    layers: new Set(),
    enforcedStyleKinds: new Set(),
    enforceLayouts: false,
  };

  addSemanticDefinitions(out, preset.semantics);
  addTokenList(out.semantic, preset.tokens && preset.tokens.semantic);
  addTokenList(out.layouts, preset.tokens && preset.tokens.layouts);
  addObjectKeys(out.layouts, preset.layouts);
  out.enforceLayouts = out.layouts.size > 0;

  const styleNameMap = preset.styleNameMap || {};
  const styles = preset.styles || {};
  for (const kind of ['paragraphStyles', 'characterStyles', 'objectStyles', 'frameStyles', 'tableStyles', 'cellStyles', 'layers']) {
    addObjectKeys(out[kind], styleNameMap[kind]);
    addObjectKeys(out[kind], styles[kind]);
    if (out[kind].size) out.enforcedStyleKinds.add(kind);
    for (const token of out[kind]) out.semantic.add(token);
  }
  return out;
}

function addSemanticDefinitions(out, definitions) {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) return;
  for (const [token, def] of Object.entries(definitions)) {
    const cleanToken = clean(token);
    if (!cleanToken) continue;
    out.semantic.add(cleanToken);
    const roles = def && Array.isArray(def.roles) ? def.roles.map(clean).filter(Boolean) : [];
    if (roles.length) out.semanticRoles.set(cleanToken, new Set(roles));
  }
}

function addObjectKeys(set, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const token of Object.keys(value)) {
    const cleanToken = clean(token);
    if (cleanToken) set.add(cleanToken);
  }
}

function addTokenList(set, value) {
  if (!Array.isArray(value)) return;
  for (const token of value) {
    const cleanToken = clean(token);
    if (cleanToken) set.add(cleanToken);
  }
}

function isKnown(set, value) {
  return set.has(clean(value));
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  validateReverseLabel,
};
