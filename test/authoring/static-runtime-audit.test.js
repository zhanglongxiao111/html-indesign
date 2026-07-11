const test = require('node:test');
const assert = require('node:assert/strict');

const { auditStaticAuthoringRuntime } = require('../../src/authoring/static-runtime-audit');

test('strict static authoring rejects executable inline and local scripts with a stable code', () => {
  const audit = auditStaticAuthoringRuntime(`
    <section class="page">
      <script>window.renderDeck()</script>
      <script type="module" src="./deck.js"></script>
    </section>
  `, { strict: true, file: 'pages/cover.html' });

  assert.equal(audit.valid, false);
  assert.equal(audit.errors.length, 2);
  assert.equal(audit.errors.every((issue) => issue.code === 'AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN'), true);
  assert.equal(audit.errors.every((issue) => issue.file === 'pages/cover.html'), true);
});

test('strict static authoring rejects canvas and remote browser dependencies with stable codes', () => {
  const audit = auditStaticAuthoringRuntime(`
    <section class="page">
      <canvas></canvas>
      <script src="https://cdn.example.com/chart.js"></script>
      <link rel="stylesheet" href="https://cdn.example.com/theme.css">
    </section>
  `, { strict: true });

  assert.deepEqual(audit.errors.map((issue) => issue.code), [
    'AUTHOR_CANVAS_FORBIDDEN',
    'AUTHOR_REMOTE_RUNTIME_SCRIPT_FORBIDDEN',
    'AUTHOR_REMOTE_STYLESHEET_FORBIDDEN',
  ]);
});

test('static authoring allows application/json protocol payloads', () => {
  const audit = auditStaticAuthoringRuntime(`
    <script type="application/json" data-id-source-package-layers>
      [{"id":"content"}]
    </script>
  `, { strict: true });

  assert.equal(audit.valid, true);
  assert.deepEqual(audit.errors, []);
  assert.deepEqual(audit.warnings, []);
});

test('strict static authoring rejects every non-JSON script type and classifies remote src first', () => {
  const audit = auditStaticAuthoringRuntime(`
    <script type="text/babel">renderDeck()</script>
    <script type="text/babel" src="https://cdn.example.com/deck.jsx"></script>
    <script type="application/x-javascript" src="./legacy.js"></script>
  `, { strict: true });

  assert.deepEqual(audit.errors.map((issue) => ({ code: issue.code, type: issue.type, src: issue.src })), [
    {
      code: 'AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN',
      type: 'text/babel',
      src: undefined,
    },
    {
      code: 'AUTHOR_REMOTE_RUNTIME_SCRIPT_FORBIDDEN',
      type: 'text/babel',
      src: 'https://cdn.example.com/deck.jsx',
    },
    {
      code: 'AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN',
      type: 'application/x-javascript',
      src: './legacy.js',
    },
  ]);
});

test('non-strict static authoring reports dynamic runtime findings as warnings', () => {
  const audit = auditStaticAuthoringRuntime('<canvas></canvas><script src="./local.js"></script>');

  assert.equal(audit.valid, true);
  assert.deepEqual(audit.errors, []);
  assert.deepEqual(audit.warnings.map((issue) => issue.code), [
    'AUTHOR_CANVAS_FORBIDDEN',
    'AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN',
  ]);
});
