const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  AUTHOR_ENTRY_WRITE_BUSY,
  AUTHOR_ENTRY_WRITE_BUSY_HINT,
  checkAuthorPackageEntry,
  writeAuthorPackageEntry,
  writeRevealPresentation,
} = require('../../src/authoring');

const NO_WAIT = { sleep: () => {} };

function errno(code) {
  const error = new Error(`${code}: simulated`);
  error.code = code;
  return error;
}

function tempLeftovers(dir) {
  return fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'));
}

// 只对指定文件名的 rename 注入错误；其余文件走真实 fs。
function renameFailingFor(basename, code, failures = Infinity) {
  const calls = { rename: 0 };
  return {
    calls,
    fs: {
      ...fs,
      renameSync(from, to) {
        if (path.basename(to) === basename) {
          calls.rename += 1;
          if (calls.rename <= failures) throw errno(code);
        }
        return fs.renameSync(from, to);
      },
    },
  };
}

test('assembly does not create presentation.html when the package has none', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');

  const result = writeAuthorPackageEntry(configPath);

  assert.equal(result.entryPath, path.join(root, 'deck.html'));
  assert.equal(result.presentation.status, 'absent');
  assert.equal(fs.existsSync(path.join(root, 'presentation.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'vendor')), false);
  assert.equal(checkAuthorPackageEntry(configPath).ok, true);
});

test('assembly rewrites an existing presentation.html from the current pages and keeps its page size', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  // 模拟反向导出：按首页尺寸 1920x1080 写出预览，deck.config.json 不带 presentation 字段。
  writeRevealPresentation(configPath, { width: 1920, height: 1080 });
  const presentationPath = path.join(root, 'presentation.html');
  assert.doesNotMatch(fs.readFileSync(presentationPath, 'utf8'), /Revised agenda/);

  fs.writeFileSync(
    path.join(root, 'pages/01-agenda.html'),
    '<section class="page" data-page="agenda" id="agenda-page"><h2 data-id-object>Revised agenda</h2></section>\n',
    'utf8'
  );
  const result = writeAuthorPackageEntry(configPath);

  assert.deepEqual(result.presentation, {
    path: presentationPath,
    status: 'rewritten',
    width: 1920,
    height: 1080,
    sizeSource: 'existing-presentation',
  });
  const presentationHtml = fs.readFileSync(presentationPath, 'utf8');
  assert.match(presentationHtml, /Revised agenda/);
  assert.match(presentationHtml, /width: 1920,/);
  assert.match(presentationHtml, /height: 1080,/);
  assert.match(fs.readFileSync(path.join(root, 'deck.html'), 'utf8'), /Revised agenda/);
  assert.deepEqual(tempLeftovers(root), []);
});

test('assembly prefers deck.config.json presentation size over the existing preview size', () => {
  const root = makePackageFixture({ presentation: { width: 2560, height: 1440 } });
  const configPath = path.join(root, 'deck.config.json');
  writeRevealPresentation(configPath, { width: 1920, height: 1080 });

  const result = writeAuthorPackageEntry(configPath);

  assert.equal(result.presentation.status, 'rewritten');
  assert.equal(result.presentation.sizeSource, 'config');
  assert.equal(result.presentation.width, 2560);
  assert.equal(result.presentation.height, 1440);
  assert.match(fs.readFileSync(path.join(root, 'presentation.html'), 'utf8'), /width: 2560,/);
});

test('assembly falls back to the writer default size when nothing declares one', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  fs.writeFileSync(path.join(root, 'presentation.html'), '<!doctype html><p>hand-made stale preview</p>\n', 'utf8');

  const result = writeAuthorPackageEntry(configPath);

  assert.equal(result.presentation.status, 'rewritten');
  assert.equal(result.presentation.sizeSource, 'default');
  assert.equal(result.presentation.width, 1600);
  assert.equal(result.presentation.height, 900);
  const presentationHtml = fs.readFileSync(path.join(root, 'presentation.html'), 'utf8');
  assert.doesNotMatch(presentationHtml, /hand-made stale preview/);
  assert.match(presentationHtml, /data-page="agenda"/);
});

test('assembly removes presentation.html and says so when the rewrite fails', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  writeRevealPresentation(configPath, { width: 1920, height: 1080 });
  const failing = renameFailingFor('presentation.html', 'ENOSPC');

  const result = writeAuthorPackageEntry(configPath, { writeOptions: { fs: failing.fs, ...NO_WAIT } });

  assert.equal(result.presentation.status, 'removed');
  assert.equal(result.presentation.errorCode, 'ENOSPC');
  assert.match(result.presentation.reason, /removed stale presentation\.html/);
  assert.equal(fs.existsSync(path.join(root, 'presentation.html')), false);
  assert.equal(checkAuthorPackageEntry(configPath).ok, true);
  assert.deepEqual(tempLeftovers(root), []);
});

test('assembly fails loudly when a stale presentation.html can be neither rewritten nor removed', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  writeRevealPresentation(configPath, { width: 1920, height: 1080 });
  const presentationPath = path.join(root, 'presentation.html');
  const locked = renameFailingFor('presentation.html', 'EBUSY');
  const lockedFs = {
    ...locked.fs,
    unlinkSync(filePath) {
      if (path.resolve(filePath) === presentationPath) throw errno('EBUSY');
      return fs.unlinkSync(filePath);
    },
  };

  assert.throws(
    () => writeAuthorPackageEntry(configPath, { writeOptions: { fs: lockedFs, ...NO_WAIT } }),
    (error) => error.code === AUTHOR_ENTRY_WRITE_BUSY
      && error.details.operation === 'remove'
      && error.details.path === presentationPath
      && error.hint === AUTHOR_ENTRY_WRITE_BUSY_HINT
  );
  assert.equal(checkAuthorPackageEntry(configPath).ok, true);
  assert.deepEqual(tempLeftovers(root), []);
});

test('assembly retries a busy deck.html and then succeeds', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  const flaky = renameFailingFor('deck.html', 'EBUSY', 2);
  const delays = [];

  const result = writeAuthorPackageEntry(configPath, {
    writeOptions: { fs: flaky.fs, sleep: (ms) => delays.push(ms) },
  });

  assert.equal(result.entryPath, path.join(root, 'deck.html'));
  assert.equal(flaky.calls.rename, 3);
  assert.deepEqual(delays, [100, 200]);
  assert.equal(checkAuthorPackageEntry(configPath).ok, true);
  assert.deepEqual(tempLeftovers(root), []);
});

test('assembly reports AUTHOR_ENTRY_WRITE_BUSY with hint when deck.html stays locked', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  writeAuthorPackageEntry(configPath);
  const before = fs.readFileSync(path.join(root, 'deck.html'), 'utf8');
  fs.writeFileSync(
    path.join(root, 'pages/00-cover.html'),
    '<section class="page" data-page="cover" id="cover-page"><h1 data-id-object>New cover</h1></section>\n',
    'utf8'
  );
  const locked = renameFailingFor('deck.html', 'EBUSY');

  let caught;
  try {
    writeAuthorPackageEntry(configPath, { writeOptions: { fs: locked.fs, ...NO_WAIT } });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught, 'expected AUTHOR_ENTRY_WRITE_BUSY');
  assert.equal(caught.code, AUTHOR_ENTRY_WRITE_BUSY);
  assert.equal(caught.code, 'AUTHOR_ENTRY_WRITE_BUSY');
  assert.equal(caught.hint, AUTHOR_ENTRY_WRITE_BUSY_HINT);
  assert.match(caught.hint, /文件被占用/);
  assert.match(caught.hint, /换 outDir/);
  assert.match(caught.hint, /不要改入口文件名/);
  assert.match(caught.message, /^AUTHOR_ENTRY_WRITE_BUSY: failed to write .*deck\.html after 6 attempt\(s\)/);
  assert.equal(locked.calls.rename, 6);
  assert.equal(fs.readFileSync(path.join(root, 'deck.html'), 'utf8'), before);
  assert.deepEqual(tempLeftovers(root), []);
});

function makePackageFixture(extraConfig = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-author-entry-'));
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'styles/tokens.css'), ':root { --ink: #123456; }\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'pages/00-cover.html'),
    '<section class="page" data-page="cover" id="cover-page"><h1 data-id-object>Cover</h1></section>\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'pages/01-agenda.html'),
    '<section class="page" data-page="agenda" id="agenda-page"><h2 data-id-object>Agenda</h2></section>\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'deck.config.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'entry-deck',
      title: 'Entry Deck',
      entry: 'deck.html',
      styles: ['styles/tokens.css'],
      pages: [
        { id: 'cover', file: 'pages/00-cover.html' },
        { id: 'agenda', file: 'pages/01-agenda.html' },
      ],
      ...extraConfig,
    }, null, 2),
    'utf8'
  );
  return root;
}
