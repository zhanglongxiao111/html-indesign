const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { collectRequireGraph } = require('./helpers/require-graph');

function makeSampleProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-require-graph-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, 'utf8');
  }
  return root;
}

test('collectRequireGraph resolves static relative require edges and records dynamic require separately', () => {
  const root = makeSampleProject({
    'entry.js': `
      const child = require('./lib/child');
      const json = require('./data/config.json');
      const builtin = require('node:path');
      const packageDep = require('cheerio');
      const dynamic = require('./plugins/' + name);
    `,
    'lib/child.js': `module.exports = require('../nested');`,
    'nested/index.js': `module.exports = {};`,
    'data/config.json': `{ "ok": true }`,
  });

  const graph = collectRequireGraph([root]);
  const relativeEdges = graph.edges.map((edge) => ({
    from: path.relative(root, edge.from).replaceAll(path.sep, '/'),
    to: path.relative(root, edge.to).replaceAll(path.sep, '/'),
  }));
  const observations = graph.observations.map((observation) => ({
    from: path.relative(root, observation.from).replaceAll(path.sep, '/'),
    expression: observation.expression,
  }));

  assert.deepEqual(relativeEdges, [
    { from: 'entry.js', to: 'lib/child.js' },
    { from: 'entry.js', to: 'data/config.json' },
    { from: 'lib/child.js', to: 'nested/index.js' },
  ]);
  assert.deepEqual(observations, [
    { from: 'entry.js', expression: "'./plugins/' + name" },
  ]);
});

test('collectRequireGraph treats legal static relative require syntaxes as edges', () => {
  const root = makeSampleProject({
    'entry.js': `
      const templateLiteral = require(\`./lib/template-child\`);
      const commented = require(/* static local edge */ './lib/commented-child');
      const dynamicTemplate = require(\`./plugins/\${name}\`);
    `,
    'lib/template-child.js': `module.exports = {};`,
    'lib/commented-child.js': `module.exports = {};`,
  });

  const graph = collectRequireGraph([root]);
  const relativeEdges = graph.edges.map((edge) => ({
    from: path.relative(root, edge.from).replaceAll(path.sep, '/'),
    to: path.relative(root, edge.to).replaceAll(path.sep, '/'),
  }));
  const observations = graph.observations.map((observation) => ({
    from: path.relative(root, observation.from).replaceAll(path.sep, '/'),
    expression: observation.expression,
  }));

  assert.deepEqual(relativeEdges, [
    { from: 'entry.js', to: 'lib/template-child.js' },
    { from: 'entry.js', to: 'lib/commented-child.js' },
  ]);
  assert.deepEqual(observations, [
    { from: 'entry.js', expression: '`./plugins/${name}`' },
  ]);
});

test('collectRequireGraph fails visibly when a static relative require cannot be resolved', () => {
  const root = makeSampleProject({
    'entry.js': `require('./missing');`,
  });

  assert.throws(
    () => collectRequireGraph([root]),
    /Cannot resolve relative require '\.\/missing' from .*entry\.js/
  );
});
