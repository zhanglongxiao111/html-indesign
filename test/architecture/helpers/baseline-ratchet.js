function compareViolationsToBaseline({
  actualViolations,
  baseline,
  approvedBaseline,
  forbidNewExemptions = false,
}) {
  if (!Array.isArray(actualViolations)) {
    throw new Error('actualViolations must be an array');
  }
  validateBaseline(baseline, 'baseline');
  if (forbidNewExemptions) {
    validateBaseline(approvedBaseline, 'approvedBaseline');
  }

  actualViolations.forEach((violation, index) => validateViolation(violation, `actualViolations[${index}]`));
  validateExemptions(baseline.exemptions, 'baseline.exemptions');
  if (forbidNewExemptions) {
    validateExemptions(approvedBaseline.exemptions, 'approvedBaseline.exemptions');
  }

  const baselineKeys = new Set(baseline.exemptions.map(violationKey));
  const actualKeys = new Set(actualViolations.map(violationKey));
  const approvedBaselineKeys = new Set((approvedBaseline?.exemptions || []).map(violationKey));
  const newViolations = actualViolations.filter((violation) => !baselineKeys.has(violationKey(violation)));
  const expiredExemptions = baseline.exemptions.filter((exemption) => !actualKeys.has(violationKey(exemption)));
  const baselineExpansion = forbidNewExemptions
    ? baseline.exemptions.filter((exemption) => !approvedBaselineKeys.has(violationKey(exemption)))
    : [];

  return {
    passed: newViolations.length === 0 && expiredExemptions.length === 0 && baselineExpansion.length === 0,
    newViolations,
    expiredExemptions,
    baselineExpansion,
  };
}

function validateBaseline(baseline, path) {
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    throw new Error(`${path} must be an object`);
  }
  if (!Array.isArray(baseline.exemptions)) {
    throw new Error(`${path}.exemptions must be an array`);
  }
}

function validateExemptions(exemptions, path) {
  exemptions.forEach((exemption, index) => {
    validateViolation(exemption, `${path}[${index}]`);
    requireString(exemption.reason, `${path}[${index}].reason`);
    requireString(exemption.cleanupRef, `${path}[${index}].cleanupRef`);
  });
}

function validateViolation(violation, path) {
  if (!violation || typeof violation !== 'object' || Array.isArray(violation)) {
    throw new Error(`${path} must be an object`);
  }
  requireString(violation.rule, `${path}.rule`);
  requireString(violation.file, `${path}.file`);
  requireString(violation.detail, `${path}.detail`);
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} is required`);
  }
}

function violationKey(violation) {
  return JSON.stringify({
    rule: violation.rule,
    file: violation.file,
    detail: violation.detail,
  });
}

module.exports = {
  compareViolationsToBaseline,
};
