function createReport() {
  return {
    messages: [],
    errorCount: 0,
    warningCount: 0,
  };
}

function addMessage(report, level, code, message, details = {}) {
  const item = {
    level,
    code,
    message,
    details,
  };
  report.messages.push(item);
  if (level === 'error') report.errorCount += 1;
  if (level === 'warning') report.warningCount += 1;
  return item;
}

module.exports = {
  createReport,
  addMessage,
};
