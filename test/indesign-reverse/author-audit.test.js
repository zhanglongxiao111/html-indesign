const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { auditReverseAuthorPackage } = require('../../src/indesign-reverse/author-audit');

test('auditReverseAuthorPackage rejects div resource placeholders and duplicate attributes', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-bad');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'bad',
    entry: 'deck.html',
    styles: ['styles/layout.css'],
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }), 'utf8');
  fs.writeFileSync(path.join(outDir, 'pages/00-cover.html'), '<section data-id-grid="12x8" data-id-grid="12x8"><div src="../a.jpg"></div></section>', 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { position: relative; }', 'utf8');

  const audit = auditReverseAuthorPackage(outDir);

  assert.equal(audit.ok, false);
  assert.deepEqual(audit.errors.map((error) => error.code).sort(), ['AUTHOR_DIV_RESOURCE_PLACEHOLDER', 'AUTHOR_DUPLICATE_ATTRIBUTE', 'AUTHOR_GRID_CSS_MISSING'].sort());
});
