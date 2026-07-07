function formatGuardrailFailure(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('report must be an object');
  }

  const rule = requiredField(report, 'rule');
  const reason = requiredReason(report);
  const remediation = requiredField(report, 'remediation');
  const specPath = requiredField(report, 'specPath');
  const newViolations = optionalList(report.newViolations, 'newViolations');
  const expiredExemptions = optionalList(report.expiredExemptions, 'expiredExemptions');

  return [
    `Rule: ${rule}`,
    `Reason: ${reason}`,
    `Remediation: ${remediation}`,
    `Spec: ${specPath}`,
    '',
    'New violations:',
    formatList(newViolations),
    '',
    'Expired exemptions:',
    formatList(expiredExemptions),
  ].join('\n');
}

function requiredField(report, fieldName) {
  const value = report[fieldName];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

function requiredReason(report) {
  const reason = requiredField(report, 'reason');
  if (/[\r\n]/.test(reason)) {
    throw new Error('reason must be a single line');
  }
  const withoutFinalSentenceTerminator = reason.trim().replace(/[.!?。！？｡]\s*$/, '');
  if (/[.!?。！？｡]\s*\S/.test(withoutFinalSentenceTerminator)) {
    throw new Error('reason must be exactly one sentence');
  }
  return reason;
}

function optionalList(value, fieldName) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value;
}

function formatList(items) {
  if (items.length === 0) {
    return '- none';
  }
  return items.map((item) => `- ${formatItem(item)}`).join('\n');
}

function formatItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('report list items must be objects');
  }
  return Object.entries(item)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

module.exports = {
  formatGuardrailFailure,
};
