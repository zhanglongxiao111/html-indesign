'use strict';

// 原子覆写：先写同目录临时文件，再 rename 覆盖目标。
// NAS/SMB 与 Windows 上目标文件被预览窗口、杀毒或共享锁占用时，rename/unlink 会报
// EBUSY / EPERM / EACCES；这里按指数退避重试，耗尽后抛出带错误码和 hint 的明确错误，
// 并保证不残留临时文件。调用方负责提供业务错误码与 hint。

const nodeFs = require('fs');
const path = require('path');

const RETRYABLE_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
const DEFAULT_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 100;
const DEFAULT_BUSY_CODE = 'FILE_WRITE_BUSY';

function writeFileAtomicSync(filePath, content, options = {}) {
  const fs = options.fs || nodeFs;
  const encoding = options.encoding === undefined ? 'utf8' : options.encoding;
  const target = path.resolve(filePath);
  return withBusyRetry(target, 'write', options, () => {
    const tempPath = tempPathFor(target);
    try {
      fs.writeFileSync(tempPath, content, encoding);
      fs.renameSync(tempPath, target);
    } catch (error) {
      removeQuietly(fs, tempPath);
      throw error;
    }
    return target;
  });
}

function removeFileWithRetrySync(filePath, options = {}) {
  const fs = options.fs || nodeFs;
  const target = path.resolve(filePath);
  return withBusyRetry(target, 'remove', options, () => {
    try {
      fs.unlinkSync(target);
      return true;
    } catch (error) {
      if (error && error.code === 'ENOENT') return false;
      throw error;
    }
  });
}

// 同目录（同卷）内移动文件或目录。目标已存在的文件由 rename 直接替换；目标是目录时
// rename 替换不了，由调用方先清掉。占用重试口径与写入/删除一致。
function renameWithRetrySync(fromPath, toPath, options = {}) {
  const fs = options.fs || nodeFs;
  const source = path.resolve(fromPath);
  const target = path.resolve(toPath);
  return withBusyRetry(source, 'rename', options, () => {
    fs.renameSync(source, target);
    return target;
  });
}

function withBusyRetry(target, operation, options, attempt) {
  const retries = nonNegativeInteger(options.retries, DEFAULT_RETRIES);
  const initialDelayMs = nonNegativeInteger(options.initialDelayMs, DEFAULT_INITIAL_DELAY_MS);
  const sleep = options.sleep || sleepSync;
  const attempts = [];
  for (let index = 0; index <= retries; index += 1) {
    try {
      return attempt();
    } catch (error) {
      if (!isRetryableBusyError(error)) throw error;
      attempts.push(error.code);
      if (index === retries) throw busyError(target, operation, attempts, error, options);
      sleep(initialDelayMs * (2 ** index));
    }
  }
  throw new Error('unreachable');
}

function busyError(target, operation, attempts, lastError, options) {
  const code = options.busyCode || DEFAULT_BUSY_CODE;
  const hint = options.busyHint || '文件被占用，关闭占用该文件的程序后重试。';
  const verb = { remove: 'remove', rename: 'move' }[operation] || 'write';
  const error = new Error(
    `${code}: failed to ${verb} ${target} after ${attempts.length} attempt(s); last error ${lastError.code}. ${hint}`
  );
  error.code = code;
  error.hint = hint;
  error.retryable = true;
  error.details = {
    path: target,
    operation,
    attempts: attempts.length,
    errorCodes: attempts,
    lastErrorCode: lastError.code,
    hint,
  };
  error.cause = lastError;
  return error;
}

function isRetryableBusyError(error) {
  return Boolean(error && RETRYABLE_CODES.has(error.code));
}

function tempPathFor(target) {
  const suffix = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(path.dirname(target), `.${path.basename(target)}.${suffix}.tmp`);
}

function removeQuietly(fs, filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (_error) {
    // 临时文件可能根本没写出来；清理失败不能掩盖原始错误。
  }
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function sleepSync(ms) {
  if (!(ms > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

module.exports = {
  RETRYABLE_CODES,
  isRetryableBusyError,
  removeFileWithRetrySync,
  renameWithRetrySync,
  writeFileAtomicSync,
};
