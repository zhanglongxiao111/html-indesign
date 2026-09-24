'use strict';

// src/shared 公共入口：只暴露跨模块消费者（如 indesign-cli-plugin）需要的能力。
// shared 内部工具仍按文件粒度被上游模块直接引用，不在此全量转出口。
const { canonicalizePath, tryCanonicalizePath, isPathInside } = require('./path-containment');
const { createRunId, supersedeReports, writeReportFile } = require('./report-file');
const { removeFileWithRetrySync, renameWithRetrySync } = require('./atomic-write');

module.exports = {
  canonicalizePath,
  tryCanonicalizePath,
  isPathInside,
  createRunId,
  supersedeReports,
  writeReportFile,
  removeFileWithRetrySync,
  renameWithRetrySync,
};
