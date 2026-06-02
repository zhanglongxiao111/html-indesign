const path = require('path');

const browserSnapshotScriptPaths = [
  path.join(__dirname, 'browser-style-capture.js'),
  path.join(__dirname, 'browser-element-capture.js'),
  path.join(__dirname, 'browser-snapshot-capture.js'),
];

module.exports = {
  browserSnapshotScriptPaths,
};
