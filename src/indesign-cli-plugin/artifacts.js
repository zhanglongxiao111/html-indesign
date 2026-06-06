const path = require('node:path');

function artifact(kind, filePath, label) {
  return {
    kind,
    path: path.resolve(filePath),
    label: label || path.basename(filePath),
  };
}

module.exports = {
  artifact,
};
