const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, callPluginRpc, repoRoot } = require('./plugin-test-helper');

const manifestPath = path.join(repoRoot, 'src', 'indesign-cli-plugin', 'manifest.json');

test('manifest declares html-indesign as a host-only html domain plugin', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.protocol, 'indesign-cli-plugin.v1');
  assert.equal(manifest.id, 'html-indesign');
  assert.equal(manifest.domain, 'html');
  assert.equal(manifest.entry, 'src/indesign-cli-plugin/index.js');
  assert.equal(manifest.permissions.indesign, 'host_only');
  assert.deepEqual(manifest.capabilities.host_actions, ['script.run', 'export.verify', 'session.show']);
});

test('plugin handshake returns protocol and public tool count', () => {
  const response = callPlugin('plugin/handshake');
  assert.equal(response.id, 'html-indesign');
  assert.equal(response.protocol, 'indesign-cli-plugin.v1');
  assert.equal(response.plugin.id, 'html-indesign');
  assert.equal(response.capabilities.tools, true);
  assert.equal(response.capabilities.host_actions.includes('script.run'), true);
  assert.equal(response.tools.count, 4);
});

test('tools/list exposes only formal public html tools', () => {
  const response = callPlugin('tools/list');
  const ids = response.tools.map((tool) => tool.id);
  assert.deepEqual(ids, [
    'html.authoring_lint',
    'html.compile_instructions',
    'html.build_indesign',
    'html.reverse_export',
  ]);
  assert.equal(response.tools.every((tool) => Array.isArray(tool.side_effects)), true);

  for (const forbidden of [
    'html.audit_roundtrip',
    'html.audit_second_pass',
    'html.conversion_gate',
    'html.reverse_snapshot_audit',
    'html.effective_diff',
  ]) {
    assert.equal(ids.includes(forbidden), false, forbidden);
  }
});

test('tools/schema returns stable schemas for every public tool', () => {
  for (const id of [
    'html.authoring_lint',
    'html.compile_instructions',
    'html.build_indesign',
    'html.reverse_export',
  ]) {
    const response = callPlugin('tools/schema', { id });
    assert.equal(response.tool.id, id);
    assert.equal(response.inputSchema.type, 'object');
    assert.equal(response.inputSchema.additionalProperties, false);
  }
});

test('unknown method and unknown tool fail explicitly', () => {
  const unknownMethod = callPlugin('tools/nope');
  assert.equal(unknownMethod.status, 'error');
  assert.equal(unknownMethod.error.code, 'METHOD_NOT_FOUND');

  const unknownTool = callPlugin('tools/schema', { id: 'html.audit_roundtrip' });
  assert.equal(unknownTool.status, 'error');
  assert.equal(unknownTool.error.code, 'TOOL_NOT_FOUND');
});

test('plugin entry responds with JSON-RPC result envelopes for indesign-cli host requests', () => {
  const handshake = callPluginRpc('plugin/handshake', { host: { name: 'indesign-cli' } });
  assert.equal(handshake.jsonrpc, '2.0');
  assert.equal(handshake.id, 'test-request');
  assert.equal(handshake.result.protocol, 'indesign-cli-plugin.v1');

  const schema = callPluginRpc('tools/schema', { tool_id: 'html.authoring_lint' });
  assert.equal(schema.jsonrpc, '2.0');
  assert.equal(schema.result.tool.id, 'html.authoring_lint');
  assert.equal(schema.result.inputSchema.type, 'object');
});
