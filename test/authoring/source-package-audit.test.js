const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { auditAuthorPackageSourceFormat } = require('../../src/authoring/source-package');

const SECTION = '<section class="page" data-page="cover" data-id-layout="cover" data-id-margin="10mm" data-id-grid="12x8">';

function makePackage({ styles, pageHtml }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-source-package-'));
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  for (const file of styles) fs.writeFileSync(path.join(root, file), '/* css */\n', 'utf8');
  fs.writeFileSync(path.join(root, 'pages', '00-cover.html'), pageHtml, 'utf8');
  fs.writeFileSync(path.join(root, 'deck.html'), '<!doctype html><html><body></body></html>', 'utf8');
  const configPath = path.join(root, 'deck.config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    schemaVersion: 1,
    id: 'source-package-fixture',
    title: 'Source Package Fixture',
    entry: 'deck.html',
    styles,
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }, null, 2), 'utf8');
  return configPath;
}

const ALL_STYLES = ['styles/tokens.css', 'styles/layout.css', 'styles/components.css', 'styles/pages.css'];

test('AUTHOR_PAGE_SECTION_INVALID reports how many page sections were found and what the root must be', () => {
  const configPath = makePackage({
    styles: ALL_STYLES,
    pageHtml: `<div class="page-wrapper">${SECTION}<h1>A</h1></section>${SECTION}<h1>B</h1></section></div>`,
  });

  const result = auditAuthorPackageSourceFormat(configPath, { strict: true });

  const issue = result.errors.find((entry) => entry.code === 'AUTHOR_PAGE_SECTION_INVALID');
  assert.ok(issue);
  assert.equal(issue.found, 2);
  assert.equal(issue.file, 'pages/00-cover.html');
  assert.equal(issue.message, 'Found 2 page section(s) in pages/00-cover.html; each page source file must contain exactly one <section class="page" data-page="..."> as its root, with all page content inside it.');
});

test('AUTHOR_PAGE_SECTION_INVALID with zero sections says so', () => {
  const configPath = makePackage({ styles: ALL_STYLES, pageHtml: '<div class="page"><h1>A</h1></div>' });

  const result = auditAuthorPackageSourceFormat(configPath, { strict: true });

  const issue = result.errors.find((entry) => entry.code === 'AUTHOR_PAGE_SECTION_INVALID');
  assert.ok(issue);
  assert.equal(issue.found, 0);
  assert.match(issue.message, /^Found 0 page section\(s\) in pages\/00-cover\.html;/);
});

test('AUTHOR_STYLE_BUCKET_MISSING stays a warning under strict while other warnings are promoted', () => {
  const configPath = makePackage({
    styles: ['styles/layout.css', 'styles/components.css', 'styles/pages.css'],
    pageHtml: `${SECTION}<h1>A</h1></section>`,
  });

  const result = auditAuthorPackageSourceFormat(configPath, { strict: true });

  assert.equal(result.errors.some((entry) => entry.code === 'AUTHOR_STYLE_BUCKET_MISSING'), false, JSON.stringify(result.errors));
  const warning = result.warnings.find((entry) => entry.code === 'AUTHOR_STYLE_BUCKET_MISSING');
  assert.ok(warning, 'the recommendation must still be visible');
  assert.equal(warning.strictBlocking, false);
  assert.equal(warning.file, 'styles/tokens.css');
});
