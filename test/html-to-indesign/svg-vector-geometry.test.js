const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const modulePath = path.resolve(__dirname, '../../src/adapters/html/normalizer/svg-vector-geometry.js');

test('inline SVG with an unsupported path command fails explicitly instead of hanging or losing geometry', () => {
  const script = `
    const { vectorFactsFromSvgItem } = require(${JSON.stringify(modulePath)});
    try {
      vectorFactsFromSvgItem({
        tagName: 'svg',
        attributes: { 'data-id-vector': 'path', viewBox: '0 0 20 20' },
        sourceHtml: '<svg viewBox="0 0 20 20"><path d="M0 0 A10 10 0 0 1 20 20" /></svg>',
      }, { x: 0, y: 0, width: 20, height: 20 });
      process.stdout.write('NO_ERROR');
    } catch (error) {
      process.stdout.write(JSON.stringify({ code: error.code, message: error.message }));
    }
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  });

  assert.notEqual(result.error && result.error.code, 'ETIMEDOUT', 'unsupported SVG command must not hang');
  assert.equal(result.status, 0, result.stderr);
  const error = JSON.parse(result.stdout);
  assert.equal(error.code, 'UNSUPPORTED_SVG_PATH_COMMAND');
  assert.match(error.message, /A/);
});
