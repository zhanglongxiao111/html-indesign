const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBuildJsx,
  buildCloseJsx,
  buildExportJsx,
  buildReverseSnapshotJsx,
} = require('../../src/indesign-cli-plugin/host-jsx');

function allTemplates() {
  return {
    build: buildBuildJsx({ repoRoot: 'D:/plugin', instructionsPath: 'D:/run/instructions.json', marker: 'run-1' }),
    export: buildExportJsx({ runDir: 'D:/run', outputBaseName: 'deck', expectedMarker: 'run-1' }),
    snapshot: buildReverseSnapshotJsx({ repoRoot: 'D:/plugin', outputPath: 'D:/run/snapshot.json', expectedMarker: 'run-1' }),
    close: buildCloseJsx({ expectedMarker: 'run-1' }),
  };
}

test('every host JSX template returns through finish(), which lifts errors[0] to a top-level code/message', () => {
  for (const [name, source] of Object.entries(allTemplates())) {
    assert.match(source, /function finish\(payload\) \{/, `${name} must define finish()`);
    assert.match(source, /payload\.code = payload\.errors\[0\]\.code;/, `${name} must lift code`);
    assert.match(source, /payload\.message = payload\.errors\[0\]\.message;/, `${name} must lift message`);
    assert.equal(source.includes('return JSON.stringify(result);'), false, `${name} must not bypass finish()`);
    assert.ok((source.match(/return finish\(result\);/g) || []).length >= 1, `${name} must return via finish()`);
  }
});
