const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { canonicalizePath, isPathInside, tryCanonicalizePath } = require('../../src/shared/path-containment');
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

// 用注入的假 fs.realpathSync.native 模拟 NAS 抖动/超时/权限错误：
// 对 failingPath 精确匹配时抛 errorToThrow，其余路径落回真实实现。
// `node --test` 默认每个测试文件独立进程，全局猴补丁不会串到其它文件。
function withStubbedRealpathNative(failingPath, errorToThrow, run) {
  const originalNative = fs.realpathSync.native;
  fs.realpathSync.native = (candidate) => {
    if (candidate === failingPath) throw errorToThrow;
    return originalNative(candidate);
  };
  try {
    return run();
  } finally {
    fs.realpathSync.native = originalNative;
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

test('tryCanonicalizePath keeps walking past ENOENT the way canonicalizePath always has', () => {
  const root = makeTempDir('path-containment-try-enoent-');
  const deep = path.join(root, 'not-created-yet', 'build');
  const result = tryCanonicalizePath(deep);
  assert.equal(result.ok, true);
  assert.equal(result.error, null);
  assert.equal(result.path, canonicalizePath(deep));
});

test('tryCanonicalizePath flags non-ENOENT errors instead of silently walking past them', () => {
  const root = makeTempDir('path-containment-try-degrade-');
  const target = path.join(root, 'build');
  const boom = Object.assign(new Error('simulated NAS timeout'), { code: 'ETIMEDOUT' });

  withStubbedRealpathNative(target, boom, () => {
    const result = tryCanonicalizePath(target);
    assert.equal(result.ok, false);
    assert.equal(result.error, boom);
    assert.equal(result.path, target);
  });
});

test('canonicalizePath keeps returning a plain string fallback (no throw) when degraded', () => {
  const root = makeTempDir('path-containment-canon-degrade-');
  const target = path.join(root, 'build');
  const boom = Object.assign(new Error('simulated permission denial'), { code: 'EACCES' });

  withStubbedRealpathNative(target, boom, () => {
    const result = canonicalizePath(target);
    assert.equal(typeof result, 'string');
    assert.equal(result, target);
  });
});

test('isPathInside stays a non-throwing boolean when canonicalization degrades', () => {
  const root = makeTempDir('path-containment-inside-degrade-');
  const target = path.join(root, 'build');
  const boom = Object.assign(new Error('simulated network error'), { code: 'ENETUNREACH' });

  withStubbedRealpathNative(target, boom, () => {
    assert.doesNotThrow(() => isPathInside(root, target));
    assert.equal(isPathInside(root, target), true);
  });
});

test('degraded canonicalization still resolves through an indirection layer instead of falling back to the literal path', () => {
  // 上面两个降级用例的临时目录没有间接层，字面路径恰好等于物理路径，因此
  // 无法区分「继续向上归一化」与「就地退回字面路径」。这里用 junction 造出
  // 两种写法指向同一目录——归一化一旦就地停下，本来在项目内的 outDir 就会
  // 被判成越界（2026-08-06 那次误判换个方向重演）。
  const root = makeTempDir('path-containment-indirection-');
  const real = path.join(root, 'realproj');
  const link = path.join(root, 'linkproj');
  fs.mkdirSync(real, { recursive: true });
  try {
    fs.symlinkSync(real, link, 'junction');
  } catch {
    return; // 无权限建 junction 的环境跳过，不伪装成通过
  }

  const target = path.join(link, 'out');
  const boom = Object.assign(new Error('simulated NAS timeout'), { code: 'ETIMEDOUT' });

  withStubbedRealpathNative(target, boom, () => {
    const result = tryCanonicalizePath(target);
    assert.equal(result.ok, false, '非 ENOENT 错误必须如实标记为降级');
    assert.equal(result.error, boom, '原始错误必须带出');
    assert.equal(
      result.path,
      path.join(fs.realpathSync.native(real), 'out'),
      '降级不等于放弃归一化：仍应解析到物理路径',
    );
    assert.equal(isPathInside(real, target), true, '同一目录的两种写法不得因降级被判成越界');
  });
});

test('ensureOutputDir names the canonical paths and flags degraded canonicalization instead of promising equivalence', () => {
  const cwd = makeTempDir('path-policy-degrade-cwd-');
  const outside = makeTempDir('path-policy-degrade-outside-');
  const boom = Object.assign(new Error('simulated permission denial'), { code: 'EACCES' });

  withStubbedRealpathNative(outside, boom, () => {
    assert.throws(
      () => ensureOutputDir({ cwd }, outside, 'test'),
      (error) => {
        assert.equal(error.code, 'OUTPUT_OUTSIDE_PROJECT');
        assert.equal(error.canonicalizationDegraded, true);
        assert.equal(error.canonicalOutDir, outside);
        assert.equal(error.canonicalCwd, canonicalizePath(cwd));
        assert.equal(error.message.includes('EACCES'), true);
        assert.equal(
          error.message.includes('UNC and mapped-drive spellings of the same location are treated as equal'),
          false,
        );
        return true;
      },
    );
  });
});
