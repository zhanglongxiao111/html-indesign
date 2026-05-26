const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { auditAuthorSourceRoundtrip } = require('../../src/indesign-reverse/source-roundtrip-diff');

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

function writePackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'roundtrip-fixture',
    entry: 'deck.html',
    styles: ['styles/layout.css'],
    pages: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-agenda.html'), pageHtml, 'utf8');
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
