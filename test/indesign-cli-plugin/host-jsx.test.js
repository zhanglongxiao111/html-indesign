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
  assert.ok(source.indexOf('findOpenDocumentAt(targetIndd)') < source.indexOf('app.documents.add(false)'), 'pre-check must run before the document is created');
  // the pre-check warning (e.g. PREVIOUS_OUTPUT_CLOSED) must be concatenated, not overwritten, by the build report's own warnings
  assert.match(source, /result\.warnings = result\.warnings\.concat\(report\.warnings \|\| \[\]\);/);

  const withoutTarget = buildBuildJsx({ repoRoot: 'D:/plugin', instructionsPath: 'D:/run/instructions.json', marker: 'run-1' });
  assert.match(withoutTarget, /var targetIndd = null;/);
});

test('build template creates a windowless document and passes it to HI.runBuildFromInstructions', () => {
  const source = buildBuildJsx({
    repoRoot: 'D:/plugin',
    instructionsPath: 'D:/run/instructions.json',
    marker: 'run-1',
  });
  assert.match(source, /app\.documents\.add\(false\)/);
  assert.doesNotMatch(source, /app\.documents\.add\(\)/);
  assert.match(source, /HI\.runBuildFromInstructions\(app,\s*"D:\/run\/instructions\.json",\s*doc\)/);
});

test('export, snapshot and close templates locate windowless build documents by html_indesign_e2e_marker', () => {
  const exportSource = buildExportJsx({ runDir: 'D:/run', outputBaseName: 'deck', expectedMarker: 'run-1' });
  const snapshotSource = buildReverseSnapshotJsx({
    repoRoot: 'D:/plugin',
    outputPath: 'D:/run/snapshot.json',
    expectedMarker: 'run-1',
    closeDocument: false,
    closeOnFailure: true,
  });
  const closeSource = buildCloseJsx({ expectedMarker: 'run-1' });

  for (const [name, src] of [['export', exportSource], ['snapshot', snapshotSource], ['close', closeSource]]) {
    assert.match(src, /function findMarkedDocument\(marker\)/, `${name} must define findMarkedDocument`);
    assert.match(src, /findMarkedDocument\(expectedMarker\)/, `${name} must locate the build doc via findMarkedDocument(expectedMarker)`);
  }
  assert.match(snapshotSource, /app\.insertLabel\("html_indesign_reverse_marker",\s*expectedMarker\)/);

  // Run buildCloseJsx in a VM where activeDocument is the user's doc and documents[1] is our windowless build doc.
  const closed = [];
  const userDoc = {
    name: 'user.indd',
    extractLabel: () => '',
    close: () => closed.push('user'),
  };
  const buildDoc = {
    name: 'windowless-build',
    isValid: true,
    extractLabel: (key) => (key === 'html_indesign_e2e_marker' ? 'run-1' : ''),
    close: () => closed.push('build'),
  };
  const raw = vm.runInNewContext(closeSource, {
    SaveOptions: { NO: 'NO' },
    app: {
      activeDocument: userDoc,
      documents: [userDoc, buildDoc],
    },
  });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.closed, true);
  assert.deepEqual(closed, ['build']);
});

test('buildReverseSnapshotJsx passes skipPreviews label when requested and defaults to false', () => {
  const withSkip = buildReverseSnapshotJsx({
    repoRoot: 'D:/plugin',
    outputPath: 'D:/run/snapshot.json',
    expectedMarker: 'run-1',
    skipPreviews: true,
  });
  const defaultReverse = buildReverseSnapshotJsx({
    repoRoot: 'D:/plugin',
    outputPath: 'D:/run/snapshot.json',
  });

  assert.match(withSkip, /app\.insertLabel\("html_indesign_reverse_skip_previews",\s*"1"\)/);
  assert.match(withSkip, /app\.insertLabel\("html_indesign_reverse_skip_previews",\s*""\)/);
  assert.doesNotMatch(defaultReverse, /html_indesign_reverse_skip_previews",\s*"1"/);
});
