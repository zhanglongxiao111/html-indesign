function compareViolationsToBaseline({ actualViolations, baseline }) {
  if (!Array.isArray(actualViolations)) {
    throw new Error('actualViolations must be an array');
  }
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    throw new Error('baseline must be an object');
  }
  if (!Array.isArray(baseline.exemptions)) {
    throw new Error('baseline.exemptions must be an array');
  }

  actualViolations.forEach((violation, index) => validateViolation(violation, `actualViolations[${index}]`));
  baseline.exemptions.forEach((exemption, index) => {
    validateViolation(exemption, `baseline.exemptions[${index}]`);
    requireString(exemption.reason, `baseline.exemptions[${index}].reason`);
    requireString(exemption.cleanupRef, `baseline.exemptions[${index}].cleanupRef`);
  });

  const baselineKeys = new Set(baseline.exemptions.map(violationKey));
  const actualKeys = new Set(actualViolations.map(violationKey));
  const newViolations = actualViolations.filter((violation) => !baselineKeys.has(violationKey(violation)));
  const expiredExemptions = baseline.exemptions.filter((exemption) => !actualKeys.has(violationKey(exemption)));

  return {
    passed: newViolations.length === 0 && expiredExemptions.length === 0,
    newViolations,
    expiredExemptions,
  };
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
