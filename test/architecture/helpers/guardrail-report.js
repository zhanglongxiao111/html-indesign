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
  if (hasMultipleSentences(reason)) {
    throw new Error('reason must be exactly one sentence');
  }
  return reason;
}

function hasMultipleSentences(reason) {
  const withoutFinalSentenceTerminator = reason.trim().replace(/[.!?。！？｡]\s*$/, '');
  for (let index = 0; index < withoutFinalSentenceTerminator.length; index += 1) {
    const character = withoutFinalSentenceTerminator[index];
    if (!isSentenceTerminator(character)) {
      continue;
    }
    if (character === '.' && isInternalPeriod(withoutFinalSentenceTerminator, index)) {
      continue;
    }
    return true;
  }
  return false;
}

function isSentenceTerminator(character) {
  return /[.!?。！？｡]/.test(character);
}

function isInternalPeriod(text, index) {
  const previous = text[index - 1];
  const next = text[index + 1];
  if (!previous || !next) {
    return false;
  }

  const token = periodTokenAt(text, index);
  if (isAbbreviationToken(token)) {
    return true;
  }

  return /[a-z0-9]/.test(previous) && /[a-z0-9]/.test(next);
}

function periodTokenAt(text, index) {
  let start = index;
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start -= 1;
  }

  let end = index + 1;
  while (end < text.length && !/\s/.test(text[end])) {
    end += 1;
  }

  return text.slice(start, end);
}

function isAbbreviationToken(token) {
  return /^(?:[A-Za-z]\.){2,}[A-Za-z]?$/.test(token);
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
