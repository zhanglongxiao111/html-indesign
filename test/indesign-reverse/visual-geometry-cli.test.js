const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseArgs, resolveInputs } = require('../../scripts/audit-reverse-visual');

test('audit-reverse-visual cli resolves reverse-html directory defaults', () => {
  const root = path.resolve('test/workspace/reverse-html');
  const options = parseArgs(['--reverse-html', root, '--tolerance', '3', '--json']);

  const inputs = resolveInputs(options);

  assert.equal(inputs.referenceHtml, path.join(root, 'deck.visual.html'));
  assert.equal(inputs.candidateHtml, path.join(root, 'author/deck.html'));
  assert.equal(inputs.tolerance, 3);
  assert.equal(inputs.json, true);
});

test('audit-reverse-visual cli accepts explicit reference and candidate files', () => {
  const options = parseArgs([
    '--reference',
    'visual.html',
    '--candidate',
    'author.html',
    '--out',
    'report.json',
  ]);

  const inputs = resolveInputs(options);

  assert.equal(inputs.referenceHtml, path.resolve('visual.html'));
  assert.equal(inputs.candidateHtml, path.resolve('author.html'));
  assert.equal(inputs.outFile, path.resolve('report.json'));
});
