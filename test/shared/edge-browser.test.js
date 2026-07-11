const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EDGE_NOT_AVAILABLE,
  EdgeNotAvailableError,
  launchEdgeBrowser,
} = require('../../src/shared/edge-browser');

test('launchEdgeBrowser uses the system Edge channel by default', async () => {
  const calls = [];
  const browser = { close() {} };
  const result = await launchEdgeBrowser({
    playwright: {
      chromium: {
        launch: async (options) => {
          calls.push(options);
          return browser;
        },
      },
    },
    env: {},
    launchOptions: { headless: true },
  });

  assert.equal(result, browser);
  assert.deepEqual(calls, [{ channel: 'msedge', headless: true }]);
});

test('launchEdgeBrowser honors HTML_INDESIGN_BROWSER_EXECUTABLE without selecting a channel', async () => {
  const calls = [];
  await launchEdgeBrowser({
    playwright: {
      chromium: {
        launch: async (options) => {
          calls.push(options);
          return {};
        },
      },
    },
    env: { HTML_INDESIGN_BROWSER_EXECUTABLE: 'C:\\Managed\\msedge.exe' },
  });

  assert.deepEqual(calls, [{ executablePath: 'C:\\Managed\\msedge.exe' }]);
});

test('launchEdgeBrowser does not allow generic launch options to bypass the Edge selection', async () => {
  const calls = [];
  await launchEdgeBrowser({
    playwright: {
      chromium: {
        launch: async (options) => {
          calls.push(options);
          return {};
        },
      },
    },
    env: {},
    launchOptions: { channel: 'chromium', executablePath: 'chromium.exe' },
  });

  assert.deepEqual(calls, [{ channel: 'msedge' }]);
});

test('launchEdgeBrowser exposes stable EDGE_NOT_AVAILABLE errors and does not retry Chromium', async () => {
  let attempts = 0;
  const cause = new Error('browser executable missing');

  await assert.rejects(
    launchEdgeBrowser({
      playwright: {
        chromium: {
          launch: async () => {
            attempts += 1;
            throw cause;
          },
        },
      },
      env: {},
    }),
    (error) => {
      assert.equal(error instanceof EdgeNotAvailableError, true);
      assert.equal(error.code, EDGE_NOT_AVAILABLE);
      assert.equal(error.cause, cause);
      assert.equal(error.details.channel, 'msedge');
      return true;
    },
  );

  assert.equal(attempts, 1);
});

test('all production browser call sites use the shared Edge launcher and preserve startup failures', () => {
  const browserSnapshot = fs.readFileSync(path.resolve('src/adapters/html/reader/browser-snapshot.js'), 'utf8');
  const geometryCapture = fs.readFileSync(path.resolve('src/adapters/html/reader/visual-geometry-capture.js'), 'utf8');
  const e2eRunner = fs.readFileSync(path.resolve('scripts/indesign-e2e.js'), 'utf8');

  for (const source of [browserSnapshot, geometryCapture, e2eRunner]) {
    assert.match(source, /launchEdgeBrowser/);
    assert.doesNotMatch(source, /require\(['"]playwright['"]\)|chromium\.launch/);
  }
  assert.match(e2eRunner, /error\.code === EDGE_NOT_AVAILABLE/);
  assert.match(e2eRunner, /throw error/);
});
