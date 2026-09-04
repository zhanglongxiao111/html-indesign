const assert = require('node:assert/strict');
const { test } = require('node:test');
const { listTools, getSchema } = require('../../src/indesign-cli-plugin/tool-catalog');

function schemaFor(id) {
  const schema = getSchema(id);
  assert.ok(schema, `schema missing for ${id}`);
  return schema;
}

test('arg_names matches the declared schema properties for every tool (set equality)', () => {
  for (const tool of listTools()) {
    const schema = schemaFor(tool.id);
    const declared = new Set(Object.keys(schema.properties));
    const reported = new Set(tool.arg_names);
    assert.deepEqual(
      [...reported].sort(),
      [...declared].sort(),
      `${tool.id}: arg_names ${JSON.stringify([...reported])} must equal schema properties ${JSON.stringify([...declared])}`,
    );
  }
});

test('gridTolerance is declared on html.authoring_lint and html.build_indesign schemas', () => {
  for (const id of ['html.authoring_lint', 'html.build_indesign']) {
    const schema = schemaFor(id);
    const prop = schema.properties.gridTolerance;
    assert.ok(prop, `${id} is missing gridTolerance in schema.properties`);
    assert.equal(prop.type, 'number');
    assert.equal(prop.default, 1);
    assert.match(prop.description, /mm/);
    assert.equal((schema.required || []).includes('gridTolerance'), false);
    assert.equal(tool_arg_names_include(id, 'gridTolerance'), true);
  }
});

function tool_arg_names_include(id, name) {
  const tool = listTools().find((entry) => entry.id === id);
  return Boolean(tool && tool.arg_names.includes(name));
}

test('html.reverse_export sourceRoot explains the structured-mode semanticPreset requirement', () => {
  const schema = schemaFor('html.reverse_export');
  const desc = schema.properties.sourceRoot.description;
  assert.match(desc, /SEMANTIC_PRESET_LOAD_FAILED/);
  assert.match(desc, /structured/);
  assert.match(desc, /semanticPreset/);
});

test('html.reverse_export nasPublicRoot documents it is a URL prefix, not a cwd-relative filesystem path', () => {
  const schema = schemaFor('html.reverse_export');
  const prop = schema.properties.nasPublicRoot;
  assert.ok(prop.description && prop.description.length > 0, 'nasPublicRoot must have a description');
  assert.match(prop.description, /nas/i);
});

test('outDir/package/indd path parameters state the cwd-relative resolution basis', () => {
  const cases = [
    ['html.authoring_lint', 'package'],
    ['html.compile_instructions', 'package'],
    ['html.compile_instructions', 'outDir'],
    ['html.build_indesign', 'package'],
    ['html.build_indesign', 'outDir'],
    ['html.reverse_export', 'indd'],
    ['html.reverse_export', 'outDir'],
  ];
  for (const [id, prop] of cases) {
    const desc = schemaFor(id).properties[prop].description;
    assert.ok(desc, `${id}.${prop} is missing a description`);
    assert.match(desc, /context\.cwd|工作目录/, `${id}.${prop} description should state the cwd-relative basis`);
  }
});

test('outDir parameters document the OUTPUT_OUTSIDE_PROJECT containment rule', () => {
  for (const id of ['html.compile_instructions', 'html.build_indesign', 'html.reverse_export']) {
    const desc = schemaFor(id).properties.outDir.description;
    assert.match(desc, /OUTPUT_OUTSIDE_PROJECT/);
  }
});

test('html.authoring_lint strict description credits GRID_ALIGNMENT_OFF and SEMANTIC_TOKEN_UNKNOWN, not a blanket SEMANTIC_TOKEN_MISSING claim, and notes build_indesign forces strict', () => {
  const desc = schemaFor('html.authoring_lint').properties.strict.description;
  assert.equal(desc.includes('把网格偏移和语义 token 缺失作为错误'), false, 'must drop the inaccurate old claim');
  assert.match(desc, /GRID_ALIGNMENT_OFF/);
  assert.match(desc, /SEMANTIC_TOKEN_UNKNOWN/);
  assert.match(desc, /SEMANTIC_TOKEN_MISSING/);
  assert.match(desc, /build_indesign/);
  assert.match(desc, /strict:\s*true/);
});

test('failure_example messages reflect the real formatted output for each tool', () => {
  const tools = Object.fromEntries(listTools().map((tool) => [tool.id, tool]));

  const lintMsg = tools['html.authoring_lint'].failure_example.message;
  assert.match(lintMsg, /Strict authoring checks found \d+ errors/);
  assert.match(lintMsg, /systemic cause/);
  assert.match(lintMsg, /First issue at/);
  // 首条消息实际给三条修法示例，示例里只写一条会让 Agent 以为要自己去翻报告才有第二条。
  assert.match(lintMsg, /Fix examples: .+ \| .+ \| .+ \(\+9 more/);

  const buildMsg = tools['html.build_indesign'].failure_example.message;
  assert.match(buildMsg, /at page .+, item .+, field .+; \d+ issue\(s\) found/);

  const compileMsg = tools['html.compile_instructions'].failure_example.message;
  assert.match(compileMsg, /^Compiled instructions failed validation: .+/);
  assert.ok(compileMsg.split(': ').slice(1).join(': ').length > 10, 'must retain the informative part after the colon');

  const reverseMsg = tools['html.reverse_export'].failure_example.message;
  assert.equal(reverseMsg, 'Reverse pipeline failed; refusing to report a successful export.');
});
