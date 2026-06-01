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

test('retired field validation rejects explicit invalid directions', () => {
  for (const direction of ['', false, 0]) {
    assert.throws(
      () => validateRetiredFields(fieldRegistry, {
        htmlAttrs: ['data-id-page'],
        direction,
      }),
      new RegExp(`RETIRED_FIELD_DIRECTION_INVALID:${String(direction)}`),
    );
  }
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

test('retired data-id-page source scanner flags aliases and multiline fallbacks', () => {
  const source = `
const retiredPageAttr = 'data-id-page';
const pageNumber = attrs[
  'data-id-page'
] ?? attrs['data-id-pdf-page'];
`;

  const violations = findRetiredDataIdPageViolations(source, 'src/example.js');

  assert.deepEqual(
    violations.map((violation) => violation.source),
    [
      "const retiredPageAttr = 'data-id-page';",
      "'data-id-page'",
    ],
  );
});

test('retired data-id-page source scanner allows explicit cleanup only', () => {
  const source = "if (kind === 'pdf' || kind === 'ai') delete attrs['data-id-page'];";

  assert.deepEqual(
    findRetiredDataIdPageViolations(source, 'src/indesign-reverse/author-html-tree.js'),
    [],
  );
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
    relativeFiles.includes('src/paged-html/asset-detector.js'),
    true,
    'scan must cover asset detector',
  );
  assert.equal(
    relativeFiles.includes('src/indesign-reverse/author-html-tree.js'),
    true,
    'scan must cover reverse author HTML tree writer',
  );
  assert.equal(
    relativeFiles.includes('src/indesign-reverse/html-writer.js'),
    true,
    'scan must cover reverse visual HTML writer',
  );

  const occurrences = [];
  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relativeFile = relativePath(file);
    occurrences.push(...findDataIdPageLiteralOccurrences(source, relativeFile));
    violations.push(...findRetiredDataIdPageViolations(source, relativeFile));
  }

  assert.deepEqual(violations, []);
  assert.deepEqual(
    occurrences.map((occurrence) => `${occurrence.file}:${occurrence.source}`),
    ["src/indesign-reverse/author-html-tree.js:if (kind === 'pdf' || kind === 'ai') delete attrs['data-id-page'];"],
  );
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

function findRetiredDataIdPageViolations(source, relativeFile) {
  return findDataIdPageLiteralOccurrences(source, relativeFile)
    .filter((occurrence) => !isAllowedDataIdPageCleanup(occurrence));
}

function findDataIdPageLiteralOccurrences(source, relativeFile) {
  const occurrences = [];
  const pattern = /(['"`])data-id-page\1/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    occurrences.push({
      file: relativeFile,
      line: lineNumberAt(source, match.index),
      source: sourceLineAt(source, match.index).trim(),
    });
  }

  return occurrences;
}

function isAllowedDataIdPageCleanup(occurrence) {
  return occurrence.file === 'src/indesign-reverse/author-html-tree.js'
    && occurrence.source === "if (kind === 'pdf' || kind === 'ai') delete attrs['data-id-page'];";
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function sourceLineAt(source, index) {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const lineEnd = source.indexOf('\n', index);
  return source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
}
