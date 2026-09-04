const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
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

function loadFinish() {
  const source = allTemplates().build;
  const snippet = source.match(/function finish\(payload\) \{[\s\S]*?\n {4}\}/);
  assert.ok(snippet, 'the build template must expose an extractable finish() definition');
  const context = {};
  vm.runInNewContext(snippet[0], context);
  assert.equal(typeof context.finish, 'function', 'finish() must evaluate to a function');
  return context.finish;
}

test('every host JSX template serializes its result only through finish()', () => {
  for (const [name, source] of Object.entries(allTemplates())) {
    assert.match(source, /function finish\(payload\) \{/, `${name} must define finish()`);
    assert.equal(
      (source.match(/return JSON\.stringify\(/g) || []).length,
      1,
      `${name} must not stringify a result outside finish()`,
    );
    assert.ok((source.match(/return finish\(result\);/g) || []).length >= 1, `${name} must return via finish()`);
  }
});

test('finish() lifts errors[0] to a top-level code/message without tripping over its shape', () => {
  const finish = loadFinish();

  const structured = JSON.parse(finish({ ok: false, errors: [{ code: 'INDD_SAVE_FAILED', message: 'file busy' }] }));
  assert.equal(structured.code, 'INDD_SAVE_FAILED');
  assert.equal(structured.message, 'file busy');

  const stringError = JSON.parse(finish({ ok: false, errors: ['file busy'] }));
  assert.equal(stringError.message, 'file busy');
  assert.equal(stringError.code, undefined);

  const nullError = JSON.parse(finish({ ok: false, errors: [null] }));
  assert.equal(nullError.message, undefined);

  const alreadyMessaged = JSON.parse(
    finish({ ok: false, message: 'kept', errors: [{ code: 'X', message: 'other' }] }),
  );
  assert.equal(alreadyMessaged.message, 'kept');
  assert.equal(alreadyMessaged.code, undefined);

  const success = JSON.parse(finish({ ok: true, errors: [{ code: 'X', message: 'warn-like' }] }));
  assert.equal(success.message, undefined);

  const empty = JSON.parse(finish({ ok: false, errors: [] }));
  assert.equal(empty.message, undefined);
});

test('build template checks whether the target INDD is already open before creating a document', () => {
  const source = buildBuildJsx({
    repoRoot: 'D:/plugin',
    instructionsPath: 'D:/run/instructions.json',
    marker: 'run-1',
    targetInddPath: 'D:\\run\\deck.indd',
  });
  assert.match(source, /var targetIndd = "D:\/run\/deck\.indd";/);
  assert.match(source, /function findOpenDocumentAt\(fsPath\)/);
  assert.match(source, /OUTPUT_TARGET_OPEN/);
  assert.match(source, /PREVIOUS_OUTPUT_CLOSED/);
  assert.ok(source.indexOf('findOpenDocumentAt(targetIndd)') < source.indexOf('app.documents.add()'), 'pre-check must run before the document is created');

  const withoutTarget = buildBuildJsx({ repoRoot: 'D:/plugin', instructionsPath: 'D:/run/instructions.json', marker: 'run-1' });
  assert.match(withoutTarget, /var targetIndd = null;/);
});
