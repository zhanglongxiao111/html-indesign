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

test('auditReverseAuthorPackage does not treat quoted asset text as duplicate attributes', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-quoted-values');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'quoted-values',
    entry: 'deck.html',
    styles: ['styles/layout.css'],
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }), 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'pages/00-cover.html'),
    '<section class="page"><img id="asset" alt="Generated Image February Image March" data-id-asset-path="\\\\nas\\Combined Combined.ai"></section>',
    'utf8',
  );
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { display:grid; grid-template-columns:repeat(12, 1fr); }', 'utf8');

  const audit = auditReverseAuthorPackage(outDir);

  assert.equal(audit.ok, true);
  assert.equal(audit.errors.some((error) => error.code === 'AUTHOR_DUPLICATE_ATTRIBUTE'), false);
});

test('auditReverseAuthorPackage rejects observed positioned items without fallback geometry', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-geometry');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'geometry',
    entry: 'deck.html',
    styles: ['styles/layout.css', 'styles/reverse-overrides.css'],
    pages: [{ id: 'page-1', file: 'pages/00-page.html' }],
  }), 'utf8');
  fs.writeFileSync(path.join(outDir, 'pages/00-page.html'), '<section class="page"><p id="floating-title">标题</p></section>', 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { display:grid; grid-template-columns:repeat(12, 1fr); }');
  fs.writeFileSync(path.join(outDir, 'styles/reverse-overrides.css'), '');

  const audit = auditReverseAuthorPackage(outDir, {
    model: {
      pages: [
        {
          id: 'page-1',
          items: [
            {
              id: 'floating-title',
              role: 'text',
              semantic: 'unknown',
              bounds: { x: 40, y: 50, width: 360, height: 72 },
              layout: null,
              sourceNode: null,
            },
          ],
        },
      ],
    },
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.errors.some((error) => error.code === 'AUTHOR_OBSERVED_ITEM_GEOMETRY_MISSING'), true);
});

test('auditReverseAuthorPackage warns when unknown InDesign PageItem geometry is downgraded to a rectangle', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-vector');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'vector',
    entry: 'deck.html',
    styles: ['styles/layout.css', 'styles/reverse-overrides.css'],
    pages: [{ id: 'page-1', file: 'pages/00-page.html' }],
  }), 'utf8');
  fs.writeFileSync(path.join(outDir, 'pages/00-page.html'), '<section class="page"><div id="complex-vector"></div></section>', 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { display:grid; grid-template-columns:repeat(12, 1fr); }');
  fs.writeFileSync(path.join(outDir, 'styles/reverse-overrides.css'), '#complex-vector { position:absolute; left:10px; top:10px; width:20px; height:20px; }');

  const audit = auditReverseAuthorPackage(outDir, {
    model: {
      pages: [
        {
          id: 'page-1',
          items: [
            {
              id: 'complex-vector',
              role: 'shape',
              type: 'PageItem',
              semantic: 'unknown',
              bounds: { x: 10, y: 10, width: 20, height: 20 },
              visualStyle: { fillColor: '#000000' },
            },
          ],
        },
      ],
    },
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.warnings.some((warning) => warning.code === 'AUTHOR_UNSUPPORTED_VECTOR_FALLBACK'), true);
});

test('auditReverseAuthorPackage does not warn for PageItem vectors with preserved path geometry', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-vector-preserved');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'vector-preserved',
    entry: 'deck.html',
    styles: ['styles/layout.css', 'styles/reverse-overrides.css'],
    pages: [{ id: 'page-1', file: 'pages/00-page.html' }],
  }), 'utf8');
  fs.writeFileSync(path.join(outDir, 'pages/00-page.html'), '<section class="page"><svg id="complex-vector" data-id-vector="polygon"></svg></section>', 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { display:grid; grid-template-columns:repeat(12, 1fr); }');
  fs.writeFileSync(path.join(outDir, 'styles/reverse-overrides.css'), '[id="complex-vector"] { position:absolute; left:10px; top:10px; width:20px; height:20px; }');

  const audit = auditReverseAuthorPackage(outDir, {
    model: {
      pages: [
        {
          id: 'page-1',
          items: [
            {
              id: 'complex-vector',
              role: 'shape',
              type: 'PageItem',
              sourceType: 'PageItem',
              bounds: { x: 10, y: 10, width: 20, height: 20 },
              vectorGeometry: {
                kind: 'polygon',
                paths: [
                  { closed: true, points: [{ anchor: { x: 10, y: 10 } }, { anchor: { x: 30, y: 10 } }] },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.warnings.some((warning) => warning.code === 'AUTHOR_UNSUPPORTED_VECTOR_FALLBACK'), false);
});

test('auditReverseAuthorPackage does not warn for degenerate invisible vector leftovers', () => {
  const outDir = path.resolve('test/workspace/reverse-author-audit-vector-degenerate');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'vector-degenerate',
    entry: 'deck.html',
    styles: ['styles/layout.css', 'styles/reverse-overrides.css'],
    pages: [{ id: 'page-1', file: 'pages/00-page.html' }],
  }), 'utf8');
  fs.writeFileSync(path.join(outDir, 'pages/00-page.html'), '<section class="page"></section>', 'utf8');
  fs.writeFileSync(path.join(outDir, 'styles/layout.css'), '.page { display:grid; grid-template-columns:repeat(12, 1fr); }');
  fs.writeFileSync(path.join(outDir, 'styles/reverse-overrides.css'), '[id="empty-vector"] { position:absolute; left:10px; top:10px; width:0; height:0; }');

  const audit = auditReverseAuthorPackage(outDir, {
    model: {
      pages: [
        {
          id: 'page-1',
          items: [
            {
              id: 'empty-vector',
              role: 'shape',
              type: 'PageItem',
              sourceType: 'PageItem',
              bounds: { x: 10, y: 10, width: 0, height: 0 },
              visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
              vectorGeometry: {
                kind: 'path',
                paths: [
                  { closed: false, points: [{ anchor: { x: 10, y: 10 } }] },
                ],
              },
            },
          ],
        },
      ],
    },
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.warnings.some((warning) => warning.code === 'AUTHOR_UNSUPPORTED_VECTOR_FALLBACK'), false);
});
