const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { canonicalizePath, isPathInside } = require('../../src/shared/path-containment');
const { ensureOutputDir } = require('../../src/indesign-cli-plugin/path-policy');

const isWindows = process.platform === 'win32';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeJunction(target) {
  const linkPath = path.join(makeTempDir('path-containment-link-'), 'alias');
  fs.symlinkSync(target, linkPath, 'junction');
  return linkPath;
}

function makeSubstDrive(target) {
  for (const letter of 'ZYXWVUTSRQPONM') {
    if (fs.existsSync(`${letter}:\\`)) continue;
    try {
      execFileSync('subst', [`${letter}:`, target], { stdio: 'ignore' });
      return `${letter}:`;
    } catch (_error) {
      return null;
    }
  }
  return null;
}

function removeSubstDrive(drive) {
  try {
    execFileSync('subst', ['/d', drive], { stdio: 'ignore' });
  } catch (_error) {
    // 留给系统会话回收；不因清理失败拖垮测试。
  }
}

test('isPathInside accepts plain containment and rejects escape', () => {
  const root = makeTempDir('path-containment-root-');
  assert.equal(isPathInside(root, path.join(root, 'build')), true);
  assert.equal(isPathInside(root, root), true);
  assert.equal(isPathInside(root, path.join(root, '..', 'elsewhere')), false);
  assert.equal(isPathInside(path.join(root, 'build'), root), false);
});

test('canonicalizePath resolves the nearest existing ancestor for missing tails', () => {
  const root = makeTempDir('path-containment-missing-');
  const deep = path.join(root, 'not-created-yet', 'build');
  const canonical = canonicalizePath(deep);
  assert.equal(canonical.endsWith(path.join('not-created-yet', 'build')), true);
  assert.equal(isPathInside(root, deep), true);
});

test('isPathInside treats junction alias and physical path as the same location', { skip: !isWindows }, () => {
  const realRoot = makeTempDir('path-containment-real-');
  const alias = makeJunction(realRoot);

  assert.equal(isPathInside(realRoot, path.join(alias, 'build')), true);
  assert.equal(isPathInside(alias, path.join(realRoot, 'build')), true);
  assert.equal(isPathInside(alias, makeTempDir('path-containment-other-')), false);
});

test('isPathInside treats subst drive alias and physical path as the same location', { skip: !isWindows }, (t) => {
  const realRoot = makeTempDir('path-containment-subst-');
  const drive = makeSubstDrive(realRoot);
  if (!drive) {
    t.skip('no free drive letter or subst unavailable');
    return;
  }
  try {
    assert.equal(isPathInside(realRoot, `${drive}\\build`), true);
    assert.equal(isPathInside(`${drive}\\`, path.join(realRoot, 'build')), true);
  } finally {
    removeSubstDrive(drive);
  }
});

test('ensureOutputDir accepts an outDir spelled through an alias of the project cwd', { skip: !isWindows }, () => {
  const realRoot = makeTempDir('path-policy-alias-');
  const alias = makeJunction(realRoot);

  const outDir = ensureOutputDir({ cwd: alias }, path.join(realRoot, 'build'), 'test');
  assert.equal(fs.existsSync(outDir), true);
  assert.equal(isPathInside(realRoot, outDir), true);
});

test('ensureOutputDir still rejects an outDir outside the project and names both paths', () => {
  const cwd = makeTempDir('path-policy-cwd-');
  const outside = makeTempDir('path-policy-outside-');
  assert.throws(
    () => ensureOutputDir({ cwd }, outside, 'test'),
    (error) => {
      assert.equal(error.code, 'OUTPUT_OUTSIDE_PROJECT');
      assert.equal(error.message.includes(cwd), true);
      assert.equal(error.message.includes(outside), true);
      return true;
    },
  );
});
