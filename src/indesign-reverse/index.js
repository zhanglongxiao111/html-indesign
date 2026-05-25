const { readReverseSnapshot } = require('./snapshot-reader');
const { reverseSnapshotToSemanticModel } = require('./reverse-model');

module.exports = {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
};
