const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { removeFileWithRetrySync, renameWithRetrySync, writeFileAtomicSync } = require('../../src/shared/atomic-write');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hi-atomic-write-'));
}

function tempLeftovers(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'));
}

function errno(code) {
  const error = new Error(`${code}: simulated`);
  error.code = code;
  return error;
}

// 包一层真实 fs：前 failures 次 renameSync 抛指定错误码，之后放行。
function flakyRenameFs(failures, code = 'EBUSY') {
  const calls = { rename: 0 };
  return {
    calls,
    fs: {
      ...fs,
      renameSync(from, to) {
        calls.rename += 1;
        if (calls.rename <= failures) throw errno(code);
        return fs.renameSync(from, to);
      },
    },
  };
}

test('writeFileAtomicSync writes through a same-directory temp file and leaves no temp behind', () => {
  const dir = tempDir();
  const target = path.join(dir, 'deck.html');
  fs.writeFileSync(target, 'old', 'utf8');
  const seen = [];
  const spyFs = {
    ...fs,
    renameSync(from, to) {
      seen.push({ from, to });
      return fs.renameSync(from, to);
    },
  };

  const written = writeFileAtomicSync(target, '新内容', { fs: spyFs });

  assert.equal(written, target);
  assert.equal(fs.readFileSync(target, 'utf8'), '新内容');
  assert.equal(seen.length, 1);
  assert.equal(path.dirname(seen[0].from), dir);
  assert.match(path.basename(seen[0].from), /^\.deck\.html\..+\.tmp$/);
  assert.equal(seen[0].to, target);
  assert.deepEqual(tempLeftovers(dir), []);
});

test('writeFileAtomicSync retries EBUSY with exponential backoff and then succeeds', () => {
  const dir = tempDir();
  const target = path.join(dir, 'deck.html');
  fs.writeFileSync(target, 'old', 'utf8');
  const flaky = flakyRenameFs(2, 'EBUSY');
  const delays = [];

  writeFileAtomicSync(target, 'new', { fs: flaky.fs, sleep: (ms) => delays.push(ms) });

  assert.equal(fs.readFileSync(target, 'utf8'), 'new');
  assert.equal(flaky.calls.rename, 3);
  assert.deepEqual(delays, [100, 200]);
  assert.deepEqual(tempLeftovers(dir), []);
});

test('writeFileAtomicSync treats EPERM and EACCES as retryable busy errors', () => {
  for (const code of ['EPERM', 'EACCES']) {
    const dir = tempDir();
    const target = path.join(dir, 'deck.html');
    const flaky = flakyRenameFs(1, code);
    writeFileAtomicSync(target, code, { fs: flaky.fs, sleep: () => {} });
    assert.equal(fs.readFileSync(target, 'utf8'), code);
    assert.deepEqual(tempLeftovers(dir), []);
  }
});

test('writeFileAtomicSync gives up after the retry budget with code, hint and no temp file', () => {
  const dir = tempDir();
  const target = path.join(dir, 'deck.html');
  fs.writeFileSync(target, 'old', 'utf8');
  const flaky = flakyRenameFs(Infinity, 'EBUSY');
  const delays = [];

  let caught;
  try {
    writeFileAtomicSync(target, 'new', {
      fs: flaky.fs,
      sleep: (ms) => delays.push(ms),
      busyCode: 'SAMPLE_BUSY',
      busyHint: 'close the preview',
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught, 'expected a busy error');
  assert.equal(caught.code, 'SAMPLE_BUSY');
  assert.equal(caught.hint, 'close the preview');
  assert.equal(caught.retryable, true);
  assert.match(caught.message, /^SAMPLE_BUSY: failed to write .*deck\.html after 6 attempt\(s\); last error EBUSY\. close the preview$/);
  assert.equal(caught.details.attempts, 6);
  assert.equal(caught.details.lastErrorCode, 'EBUSY');
  assert.equal(caught.cause.code, 'EBUSY');
  assert.equal(flaky.calls.rename, 6);
  assert.deepEqual(delays, [100, 200, 400, 800, 1600]);
  assert.equal(fs.readFileSync(target, 'utf8'), 'old');
  assert.deepEqual(tempLeftovers(dir), []);
});

test('writeFileAtomicSync rethrows non-busy errors immediately and still cleans the temp file', () => {
  const dir = tempDir();
  const target = path.join(dir, 'deck.html');
  const flaky = flakyRenameFs(Infinity, 'ENOSPC');
  const delays = [];

  assert.throws(
    () => writeFileAtomicSync(target, 'new', { fs: flaky.fs, sleep: (ms) => delays.push(ms) }),
    (error) => error.code === 'ENOSPC'
  );
  assert.equal(flaky.calls.rename, 1);
  assert.deepEqual(delays, []);
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(tempLeftovers(dir), []);
});

test('removeFileWithRetrySync retries busy unlink and reports missing files as not removed', () => {
  const dir = tempDir();
  const target = path.join(dir, 'presentation.html');
  fs.writeFileSync(target, 'stale', 'utf8');
  let unlinkCalls = 0;
  const flakyFs = {
    ...fs,
    unlinkSync(filePath) {
      unlinkCalls += 1;
      if (unlinkCalls === 1) throw errno('EBUSY');
      return fs.unlinkSync(filePath);
    },
  };

  assert.equal(removeFileWithRetrySync(target, { fs: flakyFs, sleep: () => {} }), true);
  assert.equal(unlinkCalls, 2);
  assert.equal(fs.existsSync(target), false);
  assert.equal(removeFileWithRetrySync(target, { sleep: () => {} }), false);
});

test('renameWithRetrySync retries a busy rename, then gives up with a move error that names the source', () => {
  const dir = tempDir();
  const source = path.join(dir, 'deck.indd');
  const target = path.join(dir, 'previous-output-deck.indd');
  fs.writeFileSync(source, 'old', 'utf8');

  const flaky = flakyRenameFs(1);
  assert.equal(renameWithRetrySync(source, target, { fs: flaky.fs, sleep: () => {} }), target);
  assert.equal(flaky.calls.rename, 2);
  assert.equal(fs.readFileSync(target, 'utf8'), 'old');

  fs.writeFileSync(source, 'locked', 'utf8');
  const locked = flakyRenameFs(Infinity, 'EPERM');
  assert.throws(
    () => renameWithRetrySync(source, target, { fs: locked.fs, retries: 2, sleep: () => {}, busyCode: 'MOVE_BUSY' }),
    (error) => error.code === 'MOVE_BUSY'
      && error.details.operation === 'rename'
      && error.details.path === source
      && error.details.lastErrorCode === 'EPERM'
      && /failed to move/.test(error.message)
  );
  assert.equal(locked.calls.rename, 3);
  assert.equal(fs.readFileSync(source, 'utf8'), 'locked');
});
