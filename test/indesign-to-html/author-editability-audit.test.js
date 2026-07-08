const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  auditAuthorEditability,
} = require('../../src/writers/html/audit/author-editability');

const {
  parseArgs,
  run,
} = require('../../scripts/audit-author-editability');

test('auditAuthorEditability measures semantic containers and low-level geometry in an author package', () => {
  const root = fixtureRoot('author-editability-metrics');
  writeAuthorPackage(root);

  const report = auditAuthorEditability(root);

  assert.equal(report.ok, true);
  assert.equal(report.summary.pages, 1);
  assert.equal(report.summary.sourcePageFiles, 1);
  assert.equal(report.summary.objectIdElements, 6);
  assert.equal(report.summary.semanticContainerElements, 2);
  assert.equal(report.summary.looseTopLevelObjects, 2);
  assert.equal(report.summary.inlineStyleElements, 4);
  assert.equal(report.summary.lowLevelGeometryAttrs, 5);
  assert.equal(report.summary.vectorSvgElements, 1);
  assert.equal(report.summary.figureCaptionPairs, 1);
  assert.equal(report.summary.textElements, 3);
  assert.equal(report.summary.characterStyleSpans, 1);
  assert.deepEqual(report.summary.semanticContainerCoverage, {
    covered: 4,
    total: 6,
    ratio: 0.6667,
  });
});

test('auditAuthorEditability can gate algorithm upgrades with explicit editability budgets', () => {
  const root = fixtureRoot('author-editability-thresholds');
  writeAuthorPackage(root);

  const report = auditAuthorEditability(root, {
    thresholds: {
      maxLooseTopLevelObjects: 1,
      minSemanticContainerCoverage: 0.8,
    },
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.failures.map((failure) => failure.code), [
    'AUTHOR_EDITABILITY_LOOSE_TOP_LEVEL_OVER_BUDGET',
    'AUTHOR_EDITABILITY_CONTAINER_COVERAGE_BELOW_BUDGET',
  ]);
});

test('audit-author-editability CLI writes a report and returns a compact summary', () => {
  const root = fixtureRoot('author-editability-cli');
  writeAuthorPackage(root);
  const out = path.join(root, 'editability-report.json');

  const summary = JSON.parse(run(parseArgs([
    '--author-root', root,
    '--max-loose-top-level', '2',
    '--min-semantic-container-coverage', '0.5',
    '--out', out,
  ])));
  const report = JSON.parse(fs.readFileSync(out, 'utf8'));

  assert.equal(summary.ok, true);
  assert.equal(summary.out, out);
  assert.equal(summary.metrics.looseTopLevelObjects, 2);
  assert.equal(summary.metrics.semanticContainerCoverage, 0.6667);
  assert.equal(report.summary.lowLevelGeometryAttrs, 5);
});

test('audit-author-editability invalid-input 必须 fail', () => {
  const root = fixtureRoot('author-editability-invalid-input');
  fs.writeFileSync(path.join(root, 'deck.config.json'), '{ "pages": [', 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-author-editability.js'),
    '--author-root', root,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTHOR_EDITABILITY_INVALID_INPUT/);
});

test('audit-author-editability rejects parseable config without pages', () => {
  const root = fixtureRoot('author-editability-config-without-pages');
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'missing-pages',
    entry: 'deck.html',
  }, null, 2), 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-author-editability.js'),
    '--author-root', root,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTHOR_EDITABILITY_INVALID_INPUT/);
});

function fixtureRoot(name) {
  const root = path.resolve('test/workspace', name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  return root;
}

function writeAuthorPackage(root) {
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    pages: [{ id: 'p1', file: 'pages/00-p1.html' }],
    styles: ['styles/layout.css'],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'styles/layout.css'), '.page{display:grid}', 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-p1.html'), [
    '<section id="p1" class="page" data-page="p1">',
    '  <figure id="hero" style="left:10px" data-id-content-x="0px" data-id-content-y="0px" data-id-content-width="100px" data-id-content-height="80px">',
    '    <img src="hero.png">',
    '    <figcaption id="cap">主图说明</figcaption>',
    '  </figure>',
    '  <section id="copy-block" class="text-block" style="left:20px">',
    '    <p id="copy"><span data-id-character-style="bold">正文</span></p>',
    '  </section>',
    '  <p id="loose-copy" style="left:30px">散落文字</p>',
    '  <svg id="arrow" style="left:40px"><path data-id-vector-points="[]"></path></svg>',
    '</section>',
  ].join('\n'), 'utf8');
}
