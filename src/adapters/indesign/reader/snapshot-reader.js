const fs = require('fs');
const path = require('path');

function readReverseSnapshot(filePath) {
  const absolute = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

module.exports = {
  readReverseSnapshot,
};
