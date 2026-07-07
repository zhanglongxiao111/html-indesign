const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { generateFieldDocsMarkdown } = require('../../src/protocol/docs/generate-field-docs');
const { fieldRegistry } = require('../../src/protocol');

const ROOT_DIR = path.join(__dirname, '../..');
const FIELD_DOCS_CLI = path.join(ROOT_DIR, 'src/protocol/docs/generate-field-docs.js');
const GENERATED_DOC = path.join(ROOT_DIR, 'docs/规范/PROTOCOL_FIELD_REGISTRY.md');

function assertBytesEqual(actual, expected) {
  assert.equal(
    Buffer.compare(actual, expected),
    0,
    `byte content mismatch: actual=${actual.length} expected=${expected.length}`,
  );
}

test('generated field docs include registry fields, lifecycle, field class, and format capabilities', () => {
  const markdown = generateFieldDocsMarkdown(fieldRegistry);

  assert.match(markdown, /^# 协议字段注册表$/m);
  assert.match(markdown, /^## canonical$/m);
  assert.match(markdown, /^## sourceMetadata$/m);
  assert.match(markdown, /^## observation$/m);
  assert.match(markdown, /^## retired$/m);
  assert.match(markdown, /fieldClass/);
  assert.match(
    markdown,
    /\| canonicalPath \| currentPaths \| owner \| lifecycle \| HTML read\/write\/persist \| InDesign read\/write\/persist \| PPTX read\/write\/persist \| notes \|/,
  );

  assert.match(markdown, /items\[\]\.asset\.placement\.pageNumber/);
  assert.match(markdown, /items\[\]\.asset\.pageNumber, instructions\.pages\[\]\.items\[\]\.placed\.pageNumber/);
  assert.match(markdown, /asset-placement/);
  assert.match(markdown, /active/);
  assert.match(markdown, /## canonical/);
  assert.match(markdown, /HTML read\/write\/persist/);
  assert.match(markdown, /native\/native\/native/);
  assert.match(markdown, /PPTX read\/write\/persist/);
  assert.match(markdown, /unsupported\/fallback\/lossless/);
});

test('generated field docs include retired data-id-page as observe-only observation fact', () => {
  const markdown = generateFieldDocsMarkdown(fieldRegistry);

  assert.match(markdown, /retired\.htmlAttrs\.dataIdPage/);
  assert.match(markdown, /退役 HTML 属性/);
  assert.match(markdown, /data-id-page/);
  assert.match(markdown, /observe-only\/unsupported\/unsupported/);
  assert.match(markdown, /retired/);
});

test('generated field docs render retired model paths separately from retired HTML attrs', () => {
  const markdown = generateFieldDocsMarkdown(fieldRegistry);

  assert.match(markdown, /^退役 HTML 属性：$/m);
  assert.match(markdown, /^退役模型路径：$/m);

  const htmlAttrSection = markdown.slice(
    markdown.indexOf('退役 HTML 属性：'),
    markdown.indexOf('退役模型路径：'),
  );
  assert.match(htmlAttrSection, /retiredHtmlAttr=data-id-page/);
  assert.doesNotMatch(htmlAttrSection, /retiredModelPath=items\[\]\.type/);
});

test('generated field docs render W1 registry adjudication metadata', () => {
  const markdown = generateFieldDocsMarkdown(fieldRegistry);

  assert.match(markdown, /items\[\]\.semantic/);
  assert.match(markdown, /default=null/);
  assert.match(markdown, /items\[\]\.styleRefs/);
  assert.match(markdown, /allowedKeys=paragraphStyle, characterStyle, objectStyle, frameStyle, tableStyle, cellStyle/);
  assert.match(markdown, /paragraphStyleDisplayName, characterStyleDisplayName, objectStyleDisplayName, frameStyleDisplayName, tableStyleDisplayName/);
  assert.match(markdown, /displayName, genericStyle, synthesizedToken, synthesizedName, layer/);
  assert.match(markdown, /items\[\]\.bounds/);
  assert.match(markdown, /contract=coordinateSystem:absolute-page, unit:pt/);
  assert.match(markdown, /items\[\]\.extensions\.indesign\.effects/);
  assert.match(markdown, /migration=items\[\]\.effects -> items\[\]\.extensions\.indesign\.effects/);
  assert.match(markdown, /retired\.model\.itemsType/);
  assert.match(markdown, /retiredModelPath=items\[\]\.type/);
});

test('generated field docs are deterministic', () => {
  assert.equal(
    generateFieldDocsMarkdown(fieldRegistry),
    generateFieldDocsMarkdown(fieldRegistry),
  );
});

test('generated field docs file is byte-for-byte synchronized with registry output', () => {
  assertBytesEqual(
    fs.readFileSync(GENERATED_DOC),
    Buffer.from(generateFieldDocsMarkdown(fieldRegistry), 'utf8'),
  );
});

test('generated field docs require an explicit valid registry for library calls', () => {
  for (const invalidRegistry of [undefined, null, { entries: [] }]) {
    assert.throws(
      () => generateFieldDocsMarkdown(invalidRegistry),
      /FIELD_REGISTRY_DOCS_INVALID_REGISTRY/,
    );
  }
});

test('generated field docs reject unrendered field classes instead of dropping fields', () => {
  const registry = {
    entries: [{
      canonicalPath: 'future.field',
      currentPaths: [],
      fieldClass: 'futureClass',
      lifecycle: 'active',
      owner: 'future-owner',
      capabilities: {
        html: { read: 'native', write: 'native', persist: 'native' },
        indesign: { read: 'native', write: 'native', persist: 'native' },
        pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
      },
    }],
    getByPath(fieldPath) {
      return this.entries.find((entry) => entry.canonicalPath === fieldPath) || null;
    },
  };

  assert.throws(
    () => generateFieldDocsMarkdown(registry),
    /FIELD_REGISTRY_DOCS_SECTION_UNSUPPORTED:futureClass/,
  );
});

test('generated field docs reject fields missing a format capability declaration', () => {
  const registry = {
    entries: [{
      canonicalPath: 'field.without.pptx',
      currentPaths: [],
      fieldClass: 'canonical',
      lifecycle: 'active',
      owner: 'test-owner',
      capabilities: {
        html: { read: 'native', write: 'native', persist: 'native' },
        indesign: { read: 'native', write: 'native', persist: 'native' },
      },
    }],
    getByPath(fieldPath) {
      return this.entries.find((entry) => entry.canonicalPath === fieldPath) || null;
    },
  };

  assert.throws(
    () => generateFieldDocsMarkdown(registry),
    /CAPABILITY_DECLARATION_INVALID:field\.without\.pptx:pptx/,
  );
});

test('generated field docs CLI fails when --out is missing', () => {
  const result = spawnSync(process.execPath, [FIELD_DOCS_CLI], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /FIELD_REGISTRY_DOCS_OUT_REQUIRED/);
});

test('generated field docs CLI writes exact UTF-8 registry output', (t) => {
  const tempDir = path.join(ROOT_DIR, 'test/workspace/generated-docs-stage-11');
  const outFile = path.join(tempDir, 'PROTOCOL_FIELD_REGISTRY.md');

  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [FIELD_DOCS_CLI, '--out', outFile], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assertBytesEqual(
    fs.readFileSync(outFile),
    Buffer.from(generateFieldDocsMarkdown(fieldRegistry), 'utf8'),
  );
});

test('long-term specs reference generated protocol field registry', () => {
  for (const file of [
    'docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md',
    'docs/规范/SEMANTIC_PROTOCOL.md',
    'docs/规范/LABEL_PROTOCOL.md',
    'docs/规范/REVERSE_EXPORT.md',
    'docs/README.md',
    'docs/规范/README.md',
  ]) {
    const text = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
    assert.match(text, /PROTOCOL_FIELD_REGISTRY\.md/, file);
  }
});
