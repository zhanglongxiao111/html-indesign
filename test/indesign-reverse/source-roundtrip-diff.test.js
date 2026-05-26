const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  auditAuthorSourceRoundtrip,
  measureAuthorSourceDrift,
} = require('../../src/indesign-reverse/source-roundtrip-diff');

test('auditAuthorSourceRoundtrip accepts equivalent source and reverse author packages', () => {
  const root = path.resolve('test/workspace/source-roundtrip-equivalent');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, equivalentPageHtml());
  writePackage(reverseRoot, equivalentPageHtml());

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.errors, []);
  assert.deepEqual(audit.warnings, []);
  assert.equal(audit.stats.pagesCompared, 1);
});

test('auditAuthorSourceRoundtrip reports source-level losses without failing default mode', () => {
  const root = path.resolve('test/workspace/source-roundtrip-losses');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, equivalentPageHtml());
  writePackage(reverseRoot, lossyPageHtml());

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });
  const warningCodes = audit.warnings.map((issue) => issue.code).sort();

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.errors, []);
  assert.deepEqual(warningCodes, [
    'ROUNDTRIP_CHARACTER_STYLE_CHANGED',
    'ROUNDTRIP_INLINE_STYLE_CHANGED',
    'ROUNDTRIP_TABLE_CELL_STYLE_CHANGED',
    'ROUNDTRIP_TAG_SEQUENCE_CHANGED',
    'ROUNDTRIP_TEXT_CHANGED',
  ].sort());
});

test('auditAuthorSourceRoundtrip accepts self-contained copied resources when file content is equivalent', () => {
  const root = path.resolve('test/workspace/source-roundtrip-resource-copy');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(path.join(root, 'smoke-assets/site.png'), 'same-image-bytes');
  writeFixtureFile(path.join(reverseRoot, 'assets/smoke-assets/site.png'), 'same-image-bytes');
  writePackage(sourceRoot, '<section class="page"><img class="photo" src="../smoke-assets/site.png" alt="Site"></section>');
  writePackage(reverseRoot, '<section class="page"><img class="photo" src="assets/smoke-assets/site.png" alt="Site"></section>');

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.warnings, []);
});

test('auditAuthorSourceRoundtrip resolves Windows absolute resource paths as files', () => {
  const root = path.resolve('test/workspace/source-roundtrip-absolute-resource');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  const imagePath = path.join(root, 'shared/site.png');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(imagePath, 'same-image-bytes');
  writeFixtureFile(path.join(reverseRoot, 'assets/site.png'), 'same-image-bytes');
  writePackage(sourceRoot, `<section class="page"><img class="photo" src="${slash(imagePath)}" alt="Site"></section>`);
  writePackage(reverseRoot, '<section class="page"><img class="photo" src="assets/site.png" alt="Site"></section>');

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.warnings, []);
});

test('auditAuthorSourceRoundtrip ignores generated reverse ids for preserved inline styles', () => {
  const root = path.resolve('test/workspace/source-roundtrip-generated-ids');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, '<section class="page"><div class="line" style="left:158mm;top:184mm;width:225mm;transform:rotate(0deg)"></div></section>');
  writePackage(reverseRoot, '<section class="page"><div id="p2-el16" class="line" style="left:158mm;top:184mm;width:225mm;transform:rotate(0deg)"></div></section>');

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.warnings, []);
});

test('auditAuthorSourceRoundtrip strict mode turns source losses into errors', () => {
  const root = path.resolve('test/workspace/source-roundtrip-strict');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, equivalentPageHtml());
  writePackage(reverseRoot, lossyPageHtml());

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot, strict: true });
  const errorCodes = audit.errors.map((issue) => issue.code);

  assert.equal(audit.ok, false);
  assert.equal(audit.warnings.length, 0);
  assert.ok(errorCodes.includes('ROUNDTRIP_TEXT_CHANGED'));
  assert.ok(errorCodes.includes('ROUNDTRIP_TAG_SEQUENCE_CHANGED'));
});

test('auditAuthorSourceRoundtrip strict mode rejects config metadata drift', () => {
  const root = path.resolve('test/workspace/source-roundtrip-config-drift');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, equivalentPageHtml(), {
    id: 'architecture-report',
    title: '冰球场首层平面排布汇报',
    profile: 'architecture-report',
  });
  writePackage(reverseRoot, equivalentPageHtml(), {
    id: 'deck',
    title: 'architecture-report-indesign.indd',
    profile: null,
  });

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot, strict: true });
  const errorCodes = audit.errors.map((issue) => issue.code);

  assert.equal(audit.ok, false);
  assert.ok(errorCodes.includes('ROUNDTRIP_CONFIG_METADATA_CHANGED'));
});

test('auditAuthorSourceRoundtrip strict mode rejects reverse author source noise', () => {
  const root = path.resolve('test/workspace/source-roundtrip-source-noise');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, equivalentPageHtml());
  writePackage(reverseRoot, `
<section class="page" data-page="agenda" data-id-layout="contents-grid" data-id-reverse-mode="structured">
  <h2 class="page-title">Contents</h2>
  <div class="legend-item" data-id-object="">
    <span class="swatch" style="background:#c8102e" data-id-semantic="unknown"></span>
    <span class="label"><span class="accent" data-id-character-style="term-accent">PDF 置入</span></span>
  </div>
  <table>
    <tbody><tr><td data-id-paragraph-style="table-body">110</td></tr></tbody>
  </table>
  <div id="timeline" class="timeline" style="left:158mm;top:184mm;width:225mm;transform:rotate(0deg)"></div>
  <img class="photo" src="../assets/site.png" alt="Site">
  <object class="pdf" data="../assets/site.pdf" type="application/pdf"></object>
</section>
`);

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot, strict: true });
  const errorCodes = audit.errors.map((issue) => issue.code);

  assert.equal(audit.ok, false);
  assert.ok(errorCodes.includes('ROUNDTRIP_REVERSE_MODE_LEAKED'));
  assert.ok(errorCodes.includes('ROUNDTRIP_UNKNOWN_SEMANTIC_LEAKED'));
  assert.ok(errorCodes.includes('ROUNDTRIP_EMPTY_DATA_ATTRIBUTE_SERIALIZED'));
});

test('measureAuthorSourceDrift reports exact source changes even when semantic audit passes', () => {
  const root = path.resolve('test/workspace/source-roundtrip-drift');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, '<section class="page"><h1>Contents</h1></section>');
  writePackage(reverseRoot, [
    '<section class="page">',
    '  <h1>Contents</h1>',
    '</section>',
    '',
  ].join('\n'));

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot, strict: true });
  const drift = measureAuthorSourceDrift({ sourceRoot, reverseRoot });
  const changedPage = drift.files.find((entry) => entry.file === 'pages/01-agenda.html');

  assert.equal(audit.ok, true);
  assert.equal(drift.ok, true);
  assert.equal(drift.stable, false);
  assert.equal(drift.stats.filesChanged, 1);
  assert.equal(drift.stats.normalizedFilesChanged, 1);
  assert.equal(changedPage.exactEqual, false);
  assert.equal(changedPage.normalizedEqual, false);
  assert.equal(changedPage.sourceLines, 1);
  assert.equal(changedPage.reverseLines, 4);
});

test('measureAuthorSourceDrift treats identical canonical packages as stable', () => {
  const root = path.resolve('test/workspace/source-roundtrip-drift-stable');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });

  writePackage(sourceRoot, equivalentPageHtml());
  writePackage(reverseRoot, equivalentPageHtml());

  const drift = measureAuthorSourceDrift({ sourceRoot, reverseRoot });

  assert.equal(drift.ok, true);
  assert.equal(drift.stable, true);
  assert.equal(drift.stats.filesCompared, 2);
  assert.equal(drift.stats.filesChanged, 0);
  assert.equal(drift.stats.normalizedFilesChanged, 0);
  assert.equal(drift.stats.lineEditDistance, 0);
});

function writePackage(root, pageHtml, configOverrides = {}) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'roundtrip-fixture',
    title: 'Roundtrip Fixture',
    profile: 'roundtrip',
    entry: 'deck.html',
    styles: ['styles/layout.css'],
    pages: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
    ...configOverrides,
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-agenda.html'), pageHtml, 'utf8');
}

function writeFixtureFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function slash(value) {
  return String(value).replace(/\\/g, '/');
}

function equivalentPageHtml() {
  return `
<section class="page" data-page="agenda" data-id-layout="contents-grid">
  <h2 class="page-title">Contents</h2>
  <div class="legend-item" data-id-object>
    <span class="swatch" style="background:#c8102e"></span>
    <span class="label"><span class="accent" data-id-character-style="term-accent">PDF 置入</span></span>
  </div>
  <table>
    <tbody><tr><td data-id-paragraph-style="table-body">110</td></tr></tbody>
  </table>
  <div id="timeline" class="timeline" style="left:158mm;top:184mm;width:225mm;transform:rotate(0deg)"></div>
  <img class="photo" src="../assets/site.png" alt="Site">
  <object class="pdf" data="../assets/site.pdf" type="application/pdf"></object>
</section>
`;
}

function lossyPageHtml() {
  return `
<section class="page" data-page="agenda" data-id-layout="contents-grid">
  <h2 class="page-title" data-id-semantic="page-title">CONTENTS</h2>
  <span class="swatch" style="background:#c8102e"></span>
  <span class="label"><span data-id-character-style="术语强调">PDF 置入</span></span>
  <table>
    <tbody><tr><td>110</td></tr></tbody>
  </table>
  <div id="timeline" class="timeline"></div>
  <img class="photo" src="../assets/site.png" alt="Site" data-id-semantic="photo">
  <object class="pdf" data="../assets/site.pdf" type="application/pdf"></object>
</section>
`;
}
