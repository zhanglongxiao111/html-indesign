const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { fieldRegistry, validateRetiredFields } = require('../../src/protocol');

test('retired data-id-page is reported and forbidden as writer output', () => {
  const result = validateRetiredFields(fieldRegistry, {
    htmlAttrs: ['data-id-page'],
    direction: 'write',
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.code), ['RETIRED_FIELD_WRITE_FORBIDDEN']);
  assert.equal(result.errors[0].field, 'data-id-page');
  assert.equal(result.errors[0].replacedBy, 'data-id-pdf-page');
  assert.deepEqual(result.observations, []);
});

test('retired data-id-page is accepted only as observe-only read', () => {
  const result = validateRetiredFields(fieldRegistry, {
    htmlAttrs: ['data-id-page'],
    direction: 'read',
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].field, 'data-id-page');
  assert.equal(result.observations[0].readPolicy, 'observe-only');
  assert.equal(result.observations[0].writePolicy, 'forbidden');
  assert.equal(result.observations[0].replacedBy, 'data-id-pdf-page');
});

test('active and unknown attrs do not create retired facts', () => {
  const result = validateRetiredFields(fieldRegistry, {
    htmlAttrs: ['data-id-pdf-page', 'data-id-made-up'],
    direction: 'read',
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.observations, []);
});

test('source code does not read data-id-page as PDF page number fallback', () => {
  const files = collectRuntimeFiles([
    'src/paged-html',
    'src/indesign-reverse',
    'src/adapters/html',
    'src/adapters/indesign',
    'src/writers/html',
    'src/writers/indesign',
    'src/semantic-model',
    'src/shared',
  ]);

  assert.notEqual(files.length, 0, 'retired field scan must cover active runtime files');
  const relativeFiles = files.map((file) => relativePath(file));
  assert.equal(
    relativeFiles.some((file) => file.endsWith('/asset-detector.js')),
    true,
    'scan must cover asset detector',
  );
  assert.equal(
    relativeFiles.some((file) => file.endsWith('/author-html-tree.js') || file.endsWith('/visual-html-writer.js')),
    true,
    'scan must cover reverse HTML writer',
  );

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      assert.equal(/data-id-page['"\]]\s*(?:\|\||\?\?)/.test(line), false, relativePath(file));
      assert.equal(/data-id-page.*pageNumber/.test(line), false, relativePath(file));
    }
  }
});

function collectRuntimeFiles(relativeRoots) {
  const root = path.join(__dirname, '../..');
  const files = [];
  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    collectJsFiles(absoluteRoot, files);
  }
  return files;
}

function collectJsFiles(directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

function relativePath(file) {
  return path.relative(path.join(__dirname, '../..'), file).replace(/\\/g, '/');
}
