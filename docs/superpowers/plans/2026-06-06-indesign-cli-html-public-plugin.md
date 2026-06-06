# InDesign CLI HTML Public Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `html-indesign` 仓库内新增一个 `indesign-cli` 插件，只对外暴露正式使用功能：作者包检查、编译 InDesign 指令、构建 InDesign 文件、从 InDesign 反向导出 HTML 作者包。

**Architecture:** 插件层只做协议适配、参数校验、路径约束、产物登记和 host action 编排；真实 HTML/InDesign 转换继续复用本仓库已有 adapter/writer/authoring/reverse 模块。需要 InDesign 的动作必须返回 `script.run` host action，由 `indesign-cli` 执行 JSX；Node 插件不得直接调用 COM、MCP 或旧 CLI。

**Tech Stack:** Node.js CommonJS、`indesign-cli-plugin.v1` JSON-RPC stdin/stdout 协议、现有 `src/adapters/html`、`src/writers/indesign`、`src/authoring`、`scripts/indesign-reverse-export.js`、Node `--test`、真实 `indesign-cli`。

## 执行进度（2026-06-06）

| 阶段 | 状态 | 验证证据 |
| --- | --- | --- |
| Task 1-6 | 已提交 | `6a3cdb3`、`71834d2`、`adc1ca2`、`c510f9f`、`a7de682`、`33703ac` |
| 宿主协议修正 | 已完成，待本轮提交 | 插件入口支持 JSON-RPC envelope；`tools/schema`/`tools/call` 接受 `tool_id`；handshake 顶层返回 `id/version/domain`；`side_effects` 改为数组；`export.verify` 使用 `args.path` |
| Node 测试 | 已通过 | `npm test`：753 pass，0 fail |
| CLI 插件验证 | 已通过 | `indesign-cli plugin validate D:\AI\html-indesign`：`ok: true`，4 tools，0 errors |
| CLI 工具暴露 | 已通过 | `indesign-cli tool list --domain html` 只暴露 `html.authoring_lint`、`html.compile_instructions`、`html.build_indesign`、`html.reverse_export` |
| 正式工具 smoke | 已通过 | `authoring_lint`、`compile_instructions`、`build_indesign`、`reverse_export` 均通过宿主 `tool call`；输出在 `test/workspace/plugin-*-cli-smoke/` |
| 内部门禁 E2E | 已通过 | `npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip`；runDir 为 `test/workspace/indesign-e2e-20260606-164640/`；canonical content/structure 报告均 `ok: true` 且差异为 0 |

宿主实测发现：`indesign-cli` 0.2.0 对插件使用 JSON-RPC 请求/响应 envelope，而不是本计划早期示例中的裸 JSON 返回；宿主参数名使用 `tool_id`，`export.verify` 的文件参数名是 `path`。后续实现和测试以实测宿主协议为准。

---

## 范围边界

对外暴露的工具只有以下四个：

| 工具 ID | 用途 | 是否需要真实 InDesign |
| --- | --- | --- |
| `html.authoring_lint` | 检查作者源码包是否满足固定分页 HTML 作者规范 | 否 |
| `html.compile_instructions` | 把作者源码包编译成 InDesign `instructions.json` 和摘要 | 否 |
| `html.build_indesign` | 把作者源码包构建为 INDD/PDF/IDML | 是，通过 host action |
| `html.reverse_export` | 把 INDD 反向导出为固定语义 HTML 作者包 | 是，通过 host action |

以下能力不得进入插件 `tools/list`：

- `audit:roundtrip`
- `audit:reverse-snapshot`
- `audit:effective-diff`
- `audit:parent-furniture`
- `audit:reverse-visual`
- `audit:author-editability`
- `audit:conversion-gate`
- 二轮回环、结构 diff、P1/P0 门禁、诊断报告聚合

这些仍然是本项目内部测试和质量门禁，可以在本计划的验证阶段运行，但不作为用户可调用插件工具。

## 文件结构

新增文件：

| 路径 | 职责 |
| --- | --- |
| `src/indesign-cli-plugin/manifest.json` | 插件 manifest，供 `indesign-cli plugin validate/install` 发现 |
| `src/indesign-cli-plugin/index.js` | JSON-RPC stdin/stdout 入口，只负责读取请求、调用 dispatcher、输出 JSON |
| `src/indesign-cli-plugin/dispatcher.js` | 实现 `plugin/handshake`、`tools/list`、`tools/schema`、`tools/call`、`tools/resume` |
| `src/indesign-cli-plugin/tool-catalog.js` | 四个公开工具的 metadata 和 JSON schema 唯一出口 |
| `src/indesign-cli-plugin/path-policy.js` | 路径解析、输出目录创建、禁止把产物写到仓库外的策略 |
| `src/indesign-cli-plugin/artifacts.js` | 标准 artifact 对象生成器 |
| `src/indesign-cli-plugin/host-jsx.js` | 构建、导出、反向快照 JSX 生成器；从 E2E 脚本抽出共享能力 |
| `src/indesign-cli-plugin/tools/authoring-lint.js` | `html.authoring_lint` 实现 |
| `src/indesign-cli-plugin/tools/compile-instructions.js` | `html.compile_instructions` 实现 |
| `src/indesign-cli-plugin/tools/build-indesign.js` | `html.build_indesign` call/resume 实现 |
| `src/indesign-cli-plugin/tools/reverse-export.js` | `html.reverse_export` call/resume 实现 |
| `src/authoring/lint.js` | 从 `scripts/lint-authoring.js` 提取的可复用作者检查服务 |
| `test/indesign-cli-plugin/plugin-protocol.test.js` | 插件协议、manifest、工具列表和 schema 测试 |
| `test/indesign-cli-plugin/plugin-tools.test.js` | 四个工具的直接调用、host action 和 resume 测试 |
| `test/fixtures/indesign-cli-plugin/reverse-snapshot.json` | 反向导出 resume 单测使用的最小 reverse snapshot |

修改文件：

| 路径 | 修改点 |
| --- | --- |
| `scripts/lint-authoring.js` | 改成 CLI wrapper，调用 `src/authoring/lint.js` |
| `scripts/indesign-e2e.js` | 改用 `src/indesign-cli-plugin/host-jsx.js` 生成构建/导出/反向 JSX，避免重复脚本字符串 |
| `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` | 增加插件层边界：正式工具暴露与内部门禁分离 |
| `AGENTS.md` | 增加 `src/indesign-cli-plugin/` 仓库地图和正式工具边界 |

## 协议约定

所有插件请求从 stdin 读取一个 JSON 对象，输出一个 JSON 对象到 stdout。入口不得向 stdout 写日志；调试信息只能放进返回 JSON 或 stderr。

请求格式：

```json
{
  "method": "tools/call",
  "params": {
    "id": "html.authoring_lint",
    "args": {
      "package": "test/fixtures/e2e/architecture-report/deck.config.json",
      "strict": true
    }
  },
  "context": {
    "cwd": "D:\\AI\\html-indesign"
  }
}
```

直接完成返回：

```json
{
  "status": "complete",
  "data": {
    "ok": true
  },
  "artifacts": []
}
```

需要 InDesign 返回：

```json
{
  "status": "requires_host_actions",
  "state": {
    "tool_id": "html.build_indesign",
    "runDir": "D:\\AI\\html-indesign\\test\\workspace\\html-plugin-build-20260606-000000",
    "instructionsPath": "D:\\AI\\html-indesign\\test\\workspace\\html-plugin-build-20260606-000000\\instructions.json"
  },
  "actions": [
    {
      "id": "html-build-script",
      "tool_id": "script.run",
      "args": {
        "file": "D:\\AI\\html-indesign\\test\\workspace\\html-plugin-build-20260606-000000\\build.jsx",
        "timeout": 300
      }
    }
  ],
  "resume": {
    "method": "tools/resume"
  }
}
```

## Task 1: 插件 manifest、协议入口和工具目录

**Files:**
- Create: `src/indesign-cli-plugin/manifest.json`
- Create: `src/indesign-cli-plugin/index.js`
- Create: `src/indesign-cli-plugin/dispatcher.js`
- Create: `src/indesign-cli-plugin/tool-catalog.js`
- Test: `test/indesign-cli-plugin/plugin-protocol.test.js`

- [ ] **Step 1: 写 manifest 和工具目录失败测试**

创建 `test/indesign-cli-plugin/plugin-protocol.test.js`：

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const pluginEntry = path.join(repoRoot, 'src', 'indesign-cli-plugin', 'index.js');
const manifestPath = path.join(repoRoot, 'src', 'indesign-cli-plugin', 'manifest.json');

function callPlugin(method, params = {}, context = { cwd: repoRoot }) {
  const result = spawnSync(process.execPath, [pluginEntry], {
    cwd: repoRoot,
    input: JSON.stringify({ method, params, context }),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), '');
  return JSON.parse(result.stdout);
}

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
    'html.reverse_export'
  ]);

  for (const forbidden of [
    'html.audit_roundtrip',
    'html.audit_second_pass',
    'html.conversion_gate',
    'html.reverse_snapshot_audit',
    'html.effective_diff'
  ]) {
    assert.equal(ids.includes(forbidden), false, forbidden);
  }
});

test('tools/schema returns stable schemas for every public tool', () => {
  for (const id of [
    'html.authoring_lint',
    'html.compile_instructions',
    'html.build_indesign',
    'html.reverse_export'
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
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-protocol.test.js
```

Expected:

```text
not ok 1 - manifest declares html-indesign as a host-only html domain plugin
# Error: ENOENT: no such file or directory
```

- [ ] **Step 3: 新增 manifest**

创建 `src/indesign-cli-plugin/manifest.json`：

```json
{
  "schema_version": 1,
  "protocol": "indesign-cli-plugin.v1",
  "id": "html-indesign",
  "name": "html-indesign",
  "version": "0.1.0",
  "kind": "node-plugin",
  "domain": "html",
  "entry": "src/indesign-cli-plugin/index.js",
  "description": "固定语义 HTML 与 InDesign 的双向翻译插件",
  "requires": {
    "indesign_cli": ">=0.2.0",
    "node": ">=18.0.0"
  },
  "capabilities": {
    "tools": true,
    "host_actions": ["script.run", "export.verify", "session.show"]
  },
  "permissions": {
    "filesystem": ["read_project", "write_project"],
    "indesign": "host_only",
    "network": false
  }
}
```

- [ ] **Step 4: 新增工具目录**

创建 `src/indesign-cli-plugin/tool-catalog.js`：

```js
const tools = [
  {
    id: 'html.authoring_lint',
    domain: 'html',
    name: '作者包规则检查',
    one_line_purpose: '检查固定分页 HTML 作者源码包是否满足项目作者规范。',
    arg_names: ['package', 'strict'],
    rank: 10,
    schema_size: 'small',
    callable: true,
    requires: [],
    side_effects: 'none',
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: false
  },
  {
    id: 'html.compile_instructions',
    domain: 'html',
    name: '编译 InDesign 指令',
    one_line_purpose: '把作者源码包编译成可由 InDesign executor 执行的 instructions.json。',
    arg_names: ['package', 'outDir', 'targetSize', 'unitMode'],
    rank: 20,
    schema_size: 'medium',
    callable: true,
    requires: [],
    side_effects: 'writes_artifacts',
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: true
  },
  {
    id: 'html.build_indesign',
    domain: 'html',
    name: '构建 InDesign 文件',
    one_line_purpose: '把作者源码包构建为 INDD/PDF/IDML，真实 InDesign 执行由 host action 完成。',
    arg_names: ['package', 'outDir', 'targetSize', 'unitMode', 'outputBaseName'],
    rank: 30,
    schema_size: 'medium',
    callable: true,
    requires: ['script.run'],
    side_effects: 'writes_artifacts',
    artifact_kinds: ['indd', 'pdf', 'idml', 'json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: true,
    produces_artifacts: true
  },
  {
    id: 'html.reverse_export',
    domain: 'html',
    name: 'InDesign 反向导出 HTML',
    one_line_purpose: '从 INDD 生成 reverse snapshot，再写出固定语义 HTML 作者包。',
    arg_names: ['indd', 'outDir', 'mode', 'assetPolicy'],
    rank: 40,
    schema_size: 'medium',
    callable: true,
    requires: ['script.run'],
    side_effects: 'writes_artifacts',
    artifact_kinds: ['html', 'json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: true,
    produces_artifacts: true
  }
];

const schemas = {
  'html.authoring_lint': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json，路径相对 context.cwd 或绝对路径。' },
      strict: { type: 'boolean', default: false, description: '开启严格检查，把网格偏移和语义 token 缺失作为错误。' }
    }
  },
  'html.compile_instructions': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json。' },
      outDir: { type: 'string', description: '输出目录，默认写入 test/workspace/html-plugin-compile-<timestamp>。' },
      targetSize: { type: 'string', default: 'same', description: '页面目标尺寸，例如 same、qhd、2048x1152。' },
      unitMode: { type: 'string', enum: ['presentation', 'print'], default: 'presentation' },
      outputName: { type: 'string', default: 'instructions.json' }
    }
  },
  'html.build_indesign': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json。' },
      outDir: { type: 'string', description: '输出目录，默认写入 test/workspace/html-plugin-build-<timestamp>。' },
      targetSize: { type: 'string', default: 'same' },
      unitMode: { type: 'string', enum: ['presentation', 'print'], default: 'presentation' },
      outputBaseName: { type: 'string', default: 'html-indesign-output' },
      exportPdf: { type: 'boolean', default: true },
      exportIdml: { type: 'boolean', default: true },
      timeout: { type: 'integer', default: 300, minimum: 1 }
    }
  },
  'html.reverse_export': {
    type: 'object',
    additionalProperties: false,
    required: ['indd'],
    properties: {
      indd: { type: 'string', description: '待反向导出的 INDD 文件路径。' },
      outDir: { type: 'string', description: '输出目录，默认写入 test/workspace/html-plugin-reverse-<timestamp>。' },
      mode: { type: 'string', enum: ['structured', 'inferred', 'observation'], default: 'structured' },
      assetPolicy: { type: 'string', enum: ['reference', 'copy'], default: 'reference' },
      sourceRoot: { type: 'string', description: '可选的原作者包目录，用于源码回环辅助报告。' },
      nasPublicRoot: { type: 'string', default: '/nas' },
      timeout: { type: 'integer', default: 300, minimum: 1 }
    }
  }
};

function listTools() {
  return tools.map((tool) => ({ ...tool }));
}

function getTool(id) {
  return tools.find((tool) => tool.id === id) || null;
}

function getSchema(id) {
  return schemas[id] || null;
}

module.exports = {
  listTools,
  getTool,
  getSchema
};
```

- [ ] **Step 5: 新增 dispatcher 和入口**

创建 `src/indesign-cli-plugin/dispatcher.js`：

```js
const { listTools, getTool, getSchema } = require('./tool-catalog');

function error(code, message, details = {}) {
  return {
    status: 'error',
    error: {
      code,
      message,
      details
    }
  };
}

async function dispatch(request) {
  const method = request && request.method;
  const params = (request && request.params) || {};

  if (method === 'plugin/handshake') {
    const tools = listTools();
    return {
      protocol: 'indesign-cli-plugin.v1',
      plugin: {
        id: 'html-indesign',
        name: 'html-indesign',
        version: '0.1.0',
        domain: 'html'
      },
      capabilities: {
        tools: true,
        host_actions: ['script.run', 'export.verify', 'session.show']
      },
      tools: {
        count: tools.length
      }
    };
  }

  if (method === 'tools/list') {
    return { tools: listTools() };
  }

  if (method === 'tools/schema') {
    const tool = getTool(params.id);
    const inputSchema = getSchema(params.id);
    if (!tool || !inputSchema) {
      return error('TOOL_NOT_FOUND', `Unknown html-indesign tool: ${params.id}`);
    }
    return {
      tool: { id: tool.id, name: tool.name },
      inputSchema
    };
  }

  if (method === 'tools/call') {
    return error('TOOL_NOT_IMPLEMENTED', `Tool call is not implemented yet: ${params.id}`);
  }

  if (method === 'tools/resume') {
    return error('RESUME_NOT_IMPLEMENTED', 'tools/resume is not implemented yet');
  }

  return error('METHOD_NOT_FOUND', `Unknown plugin method: ${method}`);
}

module.exports = {
  dispatch,
  error
};
```

创建 `src/indesign-cli-plugin/index.js`：

```js
#!/usr/bin/env node
const { dispatch } = require('./dispatcher');

async function readStdin() {
  return await new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

async function main() {
  try {
    const raw = await readStdin();
    const request = raw.trim() ? JSON.parse(raw) : {};
    const response = await dispatch(request);
    process.stdout.write(JSON.stringify(response));
  } catch (err) {
    process.stdout.write(JSON.stringify({
      status: 'error',
      error: {
        code: 'PLUGIN_PROCESS_ERROR',
        message: err && err.message ? err.message : String(err)
      }
    }));
  }
}

main();
```

- [ ] **Step 6: 运行协议测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-protocol.test.js
```

Expected:

```text
# pass 5
# fail 0
```

- [ ] **Step 7: 提交 Task 1**

Run:

```powershell
git add src/indesign-cli-plugin/manifest.json src/indesign-cli-plugin/index.js src/indesign-cli-plugin/dispatcher.js src/indesign-cli-plugin/tool-catalog.js test/indesign-cli-plugin/plugin-protocol.test.js
git commit -m "feat: add indesign cli plugin protocol shell"
```

## Task 2: 作者包 lint 服务和 `html.authoring_lint`

**Files:**
- Create: `src/authoring/lint.js`
- Create: `src/indesign-cli-plugin/path-policy.js`
- Create: `src/indesign-cli-plugin/artifacts.js`
- Create: `src/indesign-cli-plugin/tools/authoring-lint.js`
- Modify: `scripts/lint-authoring.js`
- Modify: `src/indesign-cli-plugin/dispatcher.js`
- Test: `test/indesign-cli-plugin/plugin-tools.test.js`

- [ ] **Step 1: 写 `authoring_lint` 失败测试**

创建 `test/indesign-cli-plugin/plugin-tools.test.js`：

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const pluginEntry = path.join(repoRoot, 'src', 'indesign-cli-plugin', 'index.js');
const workspaceRoot = path.join(repoRoot, 'test', 'workspace');

function callPlugin(method, params = {}, context = { cwd: repoRoot }) {
  const result = spawnSync(process.execPath, [pluginEntry], {
    cwd: repoRoot,
    input: JSON.stringify({ method, params, context }),
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr.trim(), '');
  return JSON.parse(result.stdout);
}

test('html.authoring_lint validates the architecture report author package', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      strict: true
    }
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(response.data.packagePath.endsWith('test\\fixtures\\e2e\\architecture-report\\deck.config.json') || response.data.packagePath.endsWith('test/fixtures/e2e/architecture-report/deck.config.json'), true);
  assert.equal(Number.isInteger(response.data.issueCount), true);
  assert.equal(response.artifacts.length, 0);
});

test('html.authoring_lint reports missing package without pretending success', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/missing.config.json'
    }
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'PACKAGE_NOT_FOUND');
});

module.exports = {
  callPlugin,
  repoRoot,
  workspaceRoot
};
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
not ok 1 - html.authoring_lint validates the architecture report author package
# TOOL_NOT_IMPLEMENTED
```

- [ ] **Step 3: 提取可复用作者检查服务**

创建 `src/authoring/lint.js`。把 `scripts/lint-authoring.js` 里当前读取作者包、组装或检查 deck、调用 `validateAuthoringRules`、汇总 issue 的逻辑搬到这个文件，导出以下 API：

```js
const fs = require('node:fs');
const path = require('node:path');
const { validateAuthoringRules } = require('../adapters/html');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveAuthoringEntry(packagePath) {
  const absolutePackagePath = path.resolve(packagePath);
  if (!fs.existsSync(absolutePackagePath)) {
    const err = new Error(`Authoring package config not found: ${absolutePackagePath}`);
    err.code = 'PACKAGE_NOT_FOUND';
    throw err;
  }

  const config = readJson(absolutePackagePath);
  const packageDir = path.dirname(absolutePackagePath);
  const htmlPath = path.resolve(packageDir, config.output || 'deck.html');
  if (!fs.existsSync(htmlPath)) {
    const err = new Error(`Assembled deck html not found: ${htmlPath}`);
    err.code = 'HTML_NOT_FOUND';
    throw err;
  }

  return {
    packagePath: absolutePackagePath,
    packageDir,
    htmlPath,
    config
  };
}

async function lintAuthoringPackage(options) {
  const entry = resolveAuthoringEntry(options.packagePath);
  const result = await validateAuthoringRules(entry.htmlPath, {
    strict: Boolean(options.strict),
    packagePath: entry.packagePath
  });

  const issues = Array.isArray(result.issues) ? result.issues : [];
  const errors = issues.filter((issue) => issue.severity === 'error');

  return {
    ok: errors.length === 0,
    packagePath: entry.packagePath,
    htmlPath: entry.htmlPath,
    issueCount: issues.length,
    errorCount: errors.length,
    issues
  };
}

module.exports = {
  lintAuthoringPackage,
  resolveAuthoringEntry
};
```

实施时保留原 CLI 当前已有的输出格式；如果当前 `validateAuthoringRules` 返回字段和上面不同，统一在 `lintAuthoringPackage` 内归一化，不要在插件层散落兜底。

- [ ] **Step 4: 修改 `scripts/lint-authoring.js` 成 CLI wrapper**

保留原命令行参数解析，核心调用改成：

```js
const { lintAuthoringPackage } = require('../src/authoring/lint');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await lintAuthoringPackage({
    packagePath: options.packagePath,
    strict: options.strict
  });

  for (const issue of result.issues) {
    const prefix = issue.severity === 'error' ? 'ERROR' : 'WARN';
    console.log(`${prefix}: ${issue.message}`);
  }

  console.log(JSON.stringify({
    ok: result.ok,
    issueCount: result.issueCount,
    errorCount: result.errorCount,
    htmlPath: result.htmlPath
  }, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}
```

要求：原有 `npm run lint:authoring -- <deck.html>` 和 `npm run lint:authoring -- -- --html <deck.html> --strict` 不能断；如果当前 CLI 同时支持 `--html`，在 `src/authoring/lint.js` 同时导出 `lintAuthoringHtml({ htmlPath, strict })`，CLI wrapper 继续支持旧入口，但插件第一版只接受 `package`。

- [ ] **Step 5: 新增路径和 artifact 小工具**

创建 `src/indesign-cli-plugin/path-policy.js`：

```js
const fs = require('node:fs');
const path = require('node:path');

function getCwd(context) {
  return path.resolve((context && context.cwd) || process.cwd());
}

function resolveProjectPath(context, inputPath, fieldName) {
  if (!inputPath || typeof inputPath !== 'string') {
    const err = new Error(`${fieldName} must be a non-empty string`);
    err.code = 'INVALID_ARGS';
    throw err;
  }
  return path.resolve(getCwd(context), inputPath);
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function ensureOutputDir(context, requestedOutDir, prefix) {
  const cwd = getCwd(context);
  const outDir = requestedOutDir
    ? path.resolve(cwd, requestedOutDir)
    : path.join(cwd, 'test', 'workspace', `${prefix}-${timestamp()}`);

  const workspaceRoot = path.join(cwd, 'test', 'workspace');
  const relative = path.relative(cwd, outDir);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    const err = new Error(`Output directory must stay inside project cwd: ${outDir}`);
    err.code = 'OUTPUT_OUTSIDE_PROJECT';
    throw err;
  }

  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

module.exports = {
  getCwd,
  resolveProjectPath,
  ensureOutputDir
};
```

创建 `src/indesign-cli-plugin/artifacts.js`：

```js
const path = require('node:path');

function artifact(kind, filePath, label) {
  return {
    kind,
    path: path.resolve(filePath),
    label: label || path.basename(filePath)
  };
}

module.exports = {
  artifact
};
```

- [ ] **Step 6: 实现 `html.authoring_lint`**

创建 `src/indesign-cli-plugin/tools/authoring-lint.js`：

```js
const { lintAuthoringPackage } = require('../../authoring/lint');
const { resolveProjectPath } = require('../path-policy');

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const result = await lintAuthoringPackage({
    packagePath,
    strict: Boolean(args.strict)
  });

  return {
    status: 'complete',
    data: result,
    artifacts: []
  };
}

module.exports = {
  call
};
```

修改 `src/indesign-cli-plugin/dispatcher.js` 的 `tools/call` 分支：

```js
const authoringLint = require('./tools/authoring-lint');

const callers = {
  'html.authoring_lint': authoringLint
};

async function callTool(params, context) {
  const tool = getTool(params.id);
  if (!tool) {
    return error('TOOL_NOT_FOUND', `Unknown html-indesign tool: ${params.id}`);
  }

  const caller = callers[params.id];
  if (!caller || typeof caller.call !== 'function') {
    return error('TOOL_NOT_IMPLEMENTED', `Tool call is not implemented yet: ${params.id}`);
  }

  try {
    return await caller.call(params.args || {}, context || {});
  } catch (err) {
    return error(err.code || 'TOOL_CALL_FAILED', err.message, { tool: params.id });
  }
}
```

并让 `tools/call` 返回：

```js
if (method === 'tools/call') {
  return await callTool(params, request.context || {});
}
```

- [ ] **Step 7: 运行作者检查相关测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-protocol.test.js test/indesign-cli-plugin/plugin-tools.test.js
npm run lint:authoring -- -- --package test/fixtures/e2e/architecture-report/deck.config.json --strict
```

Expected:

```text
# pass
```

第二个命令应输出 `ok: true` 或等价成功摘要，退出码为 0。

- [ ] **Step 8: 提交 Task 2**

Run:

```powershell
git add src/authoring/lint.js scripts/lint-authoring.js src/indesign-cli-plugin/path-policy.js src/indesign-cli-plugin/artifacts.js src/indesign-cli-plugin/tools/authoring-lint.js src/indesign-cli-plugin/dispatcher.js test/indesign-cli-plugin/plugin-tools.test.js
git commit -m "feat: expose authoring lint plugin tool"
```

## Task 3: `html.compile_instructions`

**Files:**
- Create: `src/indesign-cli-plugin/tools/compile-instructions.js`
- Modify: `src/indesign-cli-plugin/dispatcher.js`
- Test: `test/indesign-cli-plugin/plugin-tools.test.js`

- [ ] **Step 1: 写编译工具失败测试**

在 `test/indesign-cli-plugin/plugin-tools.test.js` 追加：

```js
test('html.compile_instructions writes validated instructions and summary', () => {
  const outDir = path.join('test', 'workspace', 'plugin-compile-smoke');
  fs.rmSync(path.join(repoRoot, outDir), { recursive: true, force: true });

  const response = callPlugin('tools/call', {
    id: 'html.compile_instructions',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      targetSize: 'same',
      unitMode: 'presentation'
    }
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(fs.existsSync(response.data.instructionsPath), true);
  assert.equal(fs.existsSync(response.data.summaryPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'json' && item.path.endsWith('instructions.json')), true);

  const instructions = JSON.parse(fs.readFileSync(response.data.instructionsPath, 'utf8'));
  assert.equal(Array.isArray(instructions.pages), true);
  assert.equal(instructions.pages.length > 0, true);
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
not ok - html.compile_instructions writes validated instructions and summary
# TOOL_NOT_IMPLEMENTED
```

- [ ] **Step 3: 实现编译工具**

创建 `src/indesign-cli-plugin/tools/compile-instructions.js`：

```js
const fs = require('node:fs');
const path = require('node:path');
const { renderSnapshot } = require('../../adapters/html');
const { compileInstructions, validateInstructions } = require('../../writers/indesign');
const { resolveAuthoringEntry } = require('../../authoring/lint');
const { resolveProjectPath, ensureOutputDir } = require('../path-policy');
const { artifact } = require('../artifacts');

async function compileAuthoringPackage(args, context, prefix = 'html-plugin-compile') {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const entry = resolveAuthoringEntry(packagePath);
  const outDir = ensureOutputDir(context, args.outDir, prefix);
  const outputName = args.outputName || 'instructions.json';
  const instructionsPath = path.join(outDir, outputName);
  const summaryPath = path.join(outDir, 'compile-summary.json');

  const snapshot = await renderSnapshot(entry.htmlPath, {
    targetSize: args.targetSize || 'same'
  });

  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: args.unitMode || 'presentation',
    targetSize: args.targetSize || 'same'
  });

  const validation = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: entry.packageDir
  });

  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  if (errors.length > 0) {
    const err = new Error(`Compiled instructions failed validation: ${errors.map((item) => item.message || item).join('; ')}`);
    err.code = 'INSTRUCTIONS_VALIDATION_FAILED';
    throw err;
  }

  fs.writeFileSync(instructionsPath, JSON.stringify(instructions, null, 2));
  fs.writeFileSync(summaryPath, JSON.stringify({
    ok: true,
    packagePath: entry.packagePath,
    htmlPath: entry.htmlPath,
    instructionsPath,
    pageCount: Array.isArray(instructions.pages) ? instructions.pages.length : 0,
    validation
  }, null, 2));

  return {
    outDir,
    packagePath: entry.packagePath,
    htmlPath: entry.htmlPath,
    instructionsPath,
    summaryPath,
    instructions,
    validation
  };
}

async function call(args, context) {
  const result = await compileAuthoringPackage(args, context);
  return {
    status: 'complete',
    data: {
      ok: true,
      outDir: result.outDir,
      packagePath: result.packagePath,
      htmlPath: result.htmlPath,
      instructionsPath: result.instructionsPath,
      summaryPath: result.summaryPath,
      pageCount: Array.isArray(result.instructions.pages) ? result.instructions.pages.length : 0
    },
    artifacts: [
      artifact('json', result.instructionsPath, 'InDesign instructions'),
      artifact('json', result.summaryPath, 'Compile summary')
    ]
  };
}

module.exports = {
  call,
  compileAuthoringPackage
};
```

如果当前 `renderSnapshot` 的参数名不是 `targetSize`，按 `scripts/indesign-e2e.js` 当前调用方式接入；不要新建第二套浏览器快照逻辑。

- [ ] **Step 4: 接入 dispatcher**

修改 `src/indesign-cli-plugin/dispatcher.js`：

```js
const authoringLint = require('./tools/authoring-lint');
const compileInstructionsTool = require('./tools/compile-instructions');

const callers = {
  'html.authoring_lint': authoringLint,
  'html.compile_instructions': compileInstructionsTool
};
```

- [ ] **Step 5: 运行编译测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
# pass
```

确认生成：

```powershell
Test-Path test/workspace/plugin-compile-smoke/instructions.json
Test-Path test/workspace/plugin-compile-smoke/compile-summary.json
```

Expected:

```text
True
True
```

- [ ] **Step 6: 提交 Task 3**

Run:

```powershell
git add src/indesign-cli-plugin/tools/compile-instructions.js src/indesign-cli-plugin/dispatcher.js test/indesign-cli-plugin/plugin-tools.test.js
git commit -m "feat: expose instructions compile plugin tool"
```

## Task 4: host JSX 生成器和 `html.build_indesign`

**Files:**
- Create: `src/indesign-cli-plugin/host-jsx.js`
- Create: `src/indesign-cli-plugin/tools/build-indesign.js`
- Modify: `src/indesign-cli-plugin/dispatcher.js`
- Modify: `scripts/indesign-e2e.js`
- Test: `test/indesign-cli-plugin/plugin-tools.test.js`
- Test: `test/indesign-e2e-runner.test.js`

- [ ] **Step 1: 写 build 工具 host action 失败测试**

在 `test/indesign-cli-plugin/plugin-tools.test.js` 追加：

```js
test('html.build_indesign returns script.run host actions instead of calling InDesign directly', () => {
  const outDir = path.join('test', 'workspace', 'plugin-build-smoke');
  fs.rmSync(path.join(repoRoot, outDir), { recursive: true, force: true });

  const response = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true,
      timeout: 300
    }
  });

  assert.equal(response.status, 'requires_host_actions');
  assert.equal(response.state.tool_id, 'html.build_indesign');
  assert.equal(fs.existsSync(response.state.instructionsPath), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'build.jsx')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'export.jsx')), true);
  assert.deepEqual(response.actions.map((action) => action.tool_id), ['script.run', 'script.run', 'export.verify']);
  assert.equal(response.resume.method, 'tools/resume');
});

test('html.build_indesign resume returns generated artifacts after host success', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-resume');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const inddPath = path.join(outDir, 'plugin-smoke.indd');
  const pdfPath = path.join(outDir, 'plugin-smoke.pdf');
  const idmlPath = path.join(outDir, 'plugin-smoke.idml');
  fs.writeFileSync(inddPath, 'fake');
  fs.writeFileSync(pdfPath, 'fake');
  fs.writeFileSync(idmlPath, 'fake');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      runDir: outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true
    },
    host_results: [
      { id: 'html-build-script', status: 'complete', data: { ok: true } },
      { id: 'html-export-script', status: 'complete', data: { ok: true } },
      { id: 'html-export-verify', status: 'complete', data: { ok: true } }
    ]
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(response.artifacts.some((item) => item.kind === 'indd' && item.path === inddPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'pdf' && item.path === pdfPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'idml' && item.path === idmlPath), true);
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
not ok - html.build_indesign returns script.run host actions instead of calling InDesign directly
# TOOL_NOT_IMPLEMENTED
```

- [ ] **Step 3: 抽出 host JSX 生成器**

创建 `src/indesign-cli-plugin/host-jsx.js`，把 `scripts/indesign-e2e.js` 中已有的 `buildBuildJsx`、`buildExportJsx`、`buildReverseSnapshotJsx` 的脚本字符串搬到这里，并让导出脚本支持 `outputBaseName`：

```js
function escapeJsString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildBuildJsx({ repoRoot, instructionsPath }) {
  const escapedRepoRoot = escapeJsString(repoRoot);
  const escapedInstructionsPath = escapeJsString(instructionsPath);
  return [
    '#target indesign',
    `(function () {`,
    `  var repoRoot = '${escapedRepoRoot}';`,
    `  var instructionsPath = '${escapedInstructionsPath}';`,
    `  var instructionsFile = File(instructionsPath);`,
    `  if (!instructionsFile.exists) { throw new Error('Instructions file not found: ' + instructionsPath); }`,
    `  $.evalFile(File(repoRoot + '/_indesign_scripts/json2.jsx'));`,
    `  $.evalFile(File(repoRoot + '/_indesign_scripts/lib/geometry.jsx'));`,
    `  $.evalFile(File(repoRoot + '/_indesign_scripts/lib/document.jsx'));`,
    `  $.evalFile(File(repoRoot + '/_indesign_scripts/build_from_instructions.jsx'));`,
    `  var result = htmlIndesignBuildFromInstructions(instructionsFile);`,
    `  $.writeln(JSON.stringify({ ok: true, result: result }));`,
    `})();`
  ].join('\n');
}

function buildExportJsx({ runDir, outputBaseName, exportPdf = true, exportIdml = true, closeDocument = true }) {
  const escapedRunDir = escapeJsString(runDir);
  const escapedOutputBaseName = escapeJsString(outputBaseName || 'html-indesign-output');
  return [
    '#target indesign',
    `(function () {`,
    `  var runDir = Folder('${escapedRunDir}');`,
    `  if (!runDir.exists) { runDir.create(); }`,
    `  if (app.documents.length === 0) { throw new Error('No active document to export.'); }`,
    `  var doc = app.activeDocument;`,
    `  var baseName = '${escapedOutputBaseName}';`,
    `  var inddFile = File(runDir.fsName + '/' + baseName + '.indd');`,
    `  doc.save(inddFile);`,
    exportPdf ? `  var pdfFile = File(runDir.fsName + '/' + baseName + '.pdf');\n  doc.exportFile(ExportFormat.PDF_TYPE, pdfFile, false);` : '',
    exportIdml ? `  var idmlFile = File(runDir.fsName + '/' + baseName + '.idml');\n  doc.exportFile(ExportFormat.INDESIGN_MARKUP, idmlFile, false);` : '',
    closeDocument ? `  doc.close(SaveOptions.YES);` : '',
    `  $.writeln(JSON.stringify({ ok: true, indd: inddFile.fsName, pdf: ${exportPdf ? 'pdfFile.fsName' : 'null'}, idml: ${exportIdml ? 'idmlFile.fsName' : 'null'} }));`,
    `})();`
  ].filter(Boolean).join('\n');
}

function buildReverseSnapshotJsx({ repoRoot, inddPath, outputPath, closeDocument = true }) {
  const escapedRepoRoot = escapeJsString(repoRoot);
  const escapedInddPath = escapeJsString(inddPath);
  const escapedOutputPath = escapeJsString(outputPath);
  return [
    '#target indesign',
    `(function () {`,
    `  var repoRoot = '${escapedRepoRoot}';`,
    `  var inddFile = File('${escapedInddPath}');`,
    `  if (!inddFile.exists) { throw new Error('INDD file not found: ' + inddFile.fsName); }`,
    `  var doc = app.open(inddFile);`,
    `  doc.insertLabel('html_indesign_reverse_output', '${escapedOutputPath}');`,
    `  $.evalFile(File(repoRoot + '/_indesign_scripts/export_to_html_snapshot.jsx'));`,
    closeDocument ? `  doc.close(SaveOptions.NO);` : '',
    `  $.writeln(JSON.stringify({ ok: true, snapshot: '${escapedOutputPath}' }));`,
    `})();`
  ].filter(Boolean).join('\n');
}

module.exports = {
  buildBuildJsx,
  buildExportJsx,
  buildReverseSnapshotJsx
};
```

实施时保留 `scripts/indesign-e2e.js` 原有脚本逻辑的必要 evalFile 顺序和错误处理；上面代码块是目标接口和输出路径命名，具体 evalFile 清单必须以当前脚本为准完整迁移，不能少加载 `_indesign_scripts/lib/*`。

- [ ] **Step 4: 修改 E2E 脚本复用 host-jsx**

在 `scripts/indesign-e2e.js` 顶部引入：

```js
const {
  buildBuildJsx,
  buildExportJsx,
  buildReverseSnapshotJsx
} = require('../src/indesign-cli-plugin/host-jsx');
```

删除本文件内同名函数定义，原调用处保持函数名不变。为了不改变现有 E2E 输出，调用 `buildExportJsx` 时传：

```js
outputBaseName: 'architecture-report-indesign'
```

- [ ] **Step 5: 实现 `html.build_indesign`**

创建 `src/indesign-cli-plugin/tools/build-indesign.js`：

```js
const fs = require('node:fs');
const path = require('node:path');
const { compileAuthoringPackage } = require('./compile-instructions');
const { getCwd } = require('../path-policy');
const { artifact } = require('../artifacts');
const { buildBuildJsx, buildExportJsx } = require('../host-jsx');

async function call(args, context) {
  const outputBaseName = args.outputBaseName || 'html-indesign-output';
  const compile = await compileAuthoringPackage({
    ...args,
    outDir: args.outDir,
    outputName: 'instructions.json'
  }, context, 'html-plugin-build');

  const cwd = getCwd(context);
  const buildScriptPath = path.join(compile.outDir, 'build.jsx');
  const exportScriptPath = path.join(compile.outDir, 'export.jsx');

  fs.writeFileSync(buildScriptPath, buildBuildJsx({
    repoRoot: cwd,
    instructionsPath: compile.instructionsPath
  }));

  fs.writeFileSync(exportScriptPath, buildExportJsx({
    runDir: compile.outDir,
    outputBaseName,
    exportPdf: args.exportPdf !== false,
    exportIdml: args.exportIdml !== false,
    closeDocument: true
  }));

  const actions = [
    {
      id: 'html-build-script',
      tool_id: 'script.run',
      args: {
        file: buildScriptPath,
        timeout: args.timeout || 300
      }
    },
    {
      id: 'html-export-script',
      tool_id: 'script.run',
      args: {
        file: exportScriptPath,
        timeout: args.timeout || 300
      }
    }
  ];

  if (args.exportPdf !== false) {
    actions.push({
      id: 'html-export-verify',
      tool_id: 'export.verify',
      args: {
        file: path.join(compile.outDir, `${outputBaseName}.pdf`)
      }
    });
  }

  return {
    status: 'requires_host_actions',
    state: {
      tool_id: 'html.build_indesign',
      runDir: compile.outDir,
      outputBaseName,
      exportPdf: args.exportPdf !== false,
      exportIdml: args.exportIdml !== false,
      instructionsPath: compile.instructionsPath,
      summaryPath: compile.summaryPath
    },
    actions,
    resume: {
      method: 'tools/resume'
    }
  };
}

async function resume(params) {
  const state = params.state || {};
  const runDir = state.runDir;
  const outputBaseName = state.outputBaseName || 'html-indesign-output';
  const inddPath = path.join(runDir, `${outputBaseName}.indd`);
  const pdfPath = path.join(runDir, `${outputBaseName}.pdf`);
  const idmlPath = path.join(runDir, `${outputBaseName}.idml`);

  const artifacts = [
    artifact('json', state.instructionsPath, 'InDesign instructions'),
    artifact('json', state.summaryPath, 'Compile summary')
  ];

  if (fs.existsSync(inddPath)) artifacts.push(artifact('indd', inddPath, 'InDesign document'));
  if (state.exportPdf && fs.existsSync(pdfPath)) artifacts.push(artifact('pdf', pdfPath, 'PDF export'));
  if (state.exportIdml && fs.existsSync(idmlPath)) artifacts.push(artifact('idml', idmlPath, 'IDML export'));

  const missing = [];
  if (!fs.existsSync(inddPath)) missing.push(inddPath);
  if (state.exportPdf && !fs.existsSync(pdfPath)) missing.push(pdfPath);
  if (state.exportIdml && !fs.existsSync(idmlPath)) missing.push(idmlPath);

  if (missing.length > 0) {
    return {
      status: 'error',
      error: {
        code: 'BUILD_ARTIFACTS_MISSING',
        message: `Expected build artifacts are missing: ${missing.join(', ')}`
      }
    };
  }

  return {
    status: 'complete',
    data: {
      ok: true,
      runDir,
      inddPath,
      pdfPath: state.exportPdf ? pdfPath : null,
      idmlPath: state.exportIdml ? idmlPath : null
    },
    artifacts
  };
}

module.exports = {
  call,
  resume
};
```

- [ ] **Step 6: 接入 dispatcher resume**

修改 `src/indesign-cli-plugin/dispatcher.js`：

```js
const buildIndesign = require('./tools/build-indesign');

const callers = {
  'html.authoring_lint': authoringLint,
  'html.compile_instructions': compileInstructionsTool,
  'html.build_indesign': buildIndesign
};

async function resumeTool(params) {
  const state = params.state || {};
  const caller = callers[state.tool_id];
  if (!caller || typeof caller.resume !== 'function') {
    return error('RESUME_TOOL_NOT_FOUND', `No resume handler for tool: ${state.tool_id}`);
  }
  try {
    return await caller.resume(params);
  } catch (err) {
    return error(err.code || 'TOOL_RESUME_FAILED', err.message, { tool: state.tool_id });
  }
}
```

并让 `tools/resume` 返回：

```js
if (method === 'tools/resume') {
  return await resumeTool(params);
}
```

- [ ] **Step 7: 运行 build 单测和 E2E runner 静态测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js test/indesign-e2e-runner.test.js
```

Expected:

```text
# pass
```

- [ ] **Step 8: 提交 Task 4**

Run:

```powershell
git add src/indesign-cli-plugin/host-jsx.js src/indesign-cli-plugin/tools/build-indesign.js src/indesign-cli-plugin/dispatcher.js scripts/indesign-e2e.js test/indesign-cli-plugin/plugin-tools.test.js test/indesign-e2e-runner.test.js
git commit -m "feat: expose indesign build plugin tool"
```

## Task 5: `html.reverse_export`

**Files:**
- Create: `src/indesign-cli-plugin/tools/reverse-export.js`
- Create: `test/fixtures/indesign-cli-plugin/reverse-snapshot.json`
- Modify: `src/indesign-cli-plugin/dispatcher.js`
- Test: `test/indesign-cli-plugin/plugin-tools.test.js`

- [ ] **Step 1: 写 reverse 工具 host action 和 resume 失败测试**

创建 `test/fixtures/indesign-cli-plugin/reverse-snapshot.json`：

```json
{
  "version": 1,
  "document": {
    "name": "plugin-reverse-smoke.indd",
    "pages": [
      {
        "index": 0,
        "bounds": [0, 0, 720, 1280],
        "items": [
          {
            "id": "text-1",
            "type": "textFrame",
            "bounds": [64, 64, 120, 520],
            "contents": "插件反向导出烟测",
            "label": {
              "protocol": "html_indesign",
              "role": "title",
              "semantic": "title"
            }
          }
        ]
      }
    ]
  }
}
```

在 `test/indesign-cli-plugin/plugin-tools.test.js` 追加：

```js
test('html.reverse_export returns script.run host action for an INDD file', () => {
  const outDir = path.join('test', 'workspace', 'plugin-reverse-smoke');
  const absoluteOutDir = path.join(repoRoot, outDir);
  fs.rmSync(absoluteOutDir, { recursive: true, force: true });
  fs.mkdirSync(absoluteOutDir, { recursive: true });

  const fakeIndd = path.join(absoluteOutDir, 'input.indd');
  fs.writeFileSync(fakeIndd, 'fake');

  const response = callPlugin('tools/call', {
    id: 'html.reverse_export',
    args: {
      indd: fakeIndd,
      outDir,
      mode: 'structured',
      assetPolicy: 'reference',
      timeout: 300
    }
  });

  assert.equal(response.status, 'requires_host_actions');
  assert.equal(response.state.tool_id, 'html.reverse_export');
  assert.equal(fs.existsSync(response.state.reverseScriptPath), true);
  assert.equal(response.actions.length, 1);
  assert.equal(response.actions[0].tool_id, 'script.run');
});

test('html.reverse_export resume writes author html from reverse snapshot', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-reverse-resume');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const snapshotPath = path.join(outDir, 'reverse-snapshot.json');
  fs.copyFileSync(path.join(repoRoot, 'test', 'fixtures', 'indesign-cli-plugin', 'reverse-snapshot.json'), snapshotPath);

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.reverse_export',
      outDir,
      snapshotPath,
      mode: 'structured',
      assetPolicy: 'reference',
      sourceRoot: null,
      nasPublicRoot: '/nas'
    },
    host_results: [
      { id: 'html-reverse-snapshot', status: 'complete', data: { ok: true } }
    ]
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'author', 'deck.html')), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'html' && item.path.endsWith('author\\deck.html') || item.path.endsWith('author/deck.html')), true);
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
not ok - html.reverse_export returns script.run host action for an INDD file
# TOOL_NOT_IMPLEMENTED
```

- [ ] **Step 3: 实现 reverse 工具**

创建 `src/indesign-cli-plugin/tools/reverse-export.js`：

```js
const fs = require('node:fs');
const path = require('node:path');
const { compileReverseSnapshotToHtml } = require('../../../scripts/indesign-reverse-export');
const { buildReverseSnapshotJsx } = require('../host-jsx');
const { ensureOutputDir, getCwd, resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');

async function call(args, context) {
  const cwd = getCwd(context);
  const inddPath = resolveProjectPath(context, args.indd, 'indd');
  if (!fs.existsSync(inddPath)) {
    const err = new Error(`INDD file not found: ${inddPath}`);
    err.code = 'INDD_NOT_FOUND';
    throw err;
  }

  const outDir = ensureOutputDir(context, args.outDir, 'html-plugin-reverse');
  const snapshotPath = path.join(outDir, 'reverse-snapshot.json');
  const reverseScriptPath = path.join(outDir, 'reverse-snapshot.jsx');

  fs.writeFileSync(reverseScriptPath, buildReverseSnapshotJsx({
    repoRoot: cwd,
    inddPath,
    outputPath: snapshotPath,
    closeDocument: true
  }));

  return {
    status: 'requires_host_actions',
    state: {
      tool_id: 'html.reverse_export',
      outDir,
      inddPath,
      snapshotPath,
      reverseScriptPath,
      mode: args.mode || 'structured',
      assetPolicy: args.assetPolicy || 'reference',
      sourceRoot: args.sourceRoot ? resolveProjectPath(context, args.sourceRoot, 'sourceRoot') : null,
      nasPublicRoot: args.nasPublicRoot || '/nas'
    },
    actions: [
      {
        id: 'html-reverse-snapshot',
        tool_id: 'script.run',
        args: {
          file: reverseScriptPath,
          timeout: args.timeout || 300
        }
      }
    ],
    resume: {
      method: 'tools/resume'
    }
  };
}

async function resume(params) {
  const state = params.state || {};
  if (!fs.existsSync(state.snapshotPath)) {
    return {
      status: 'error',
      error: {
        code: 'REVERSE_SNAPSHOT_MISSING',
        message: `Reverse snapshot missing: ${state.snapshotPath}`
      }
    };
  }

  await compileReverseSnapshotToHtml({
    snapshotPath: state.snapshotPath,
    outDir: state.outDir,
    mode: state.mode || 'structured',
    sourceRoot: state.sourceRoot || undefined,
    assetPolicy: state.assetPolicy || 'reference',
    nasPublicRoot: state.nasPublicRoot || '/nas'
  });

  const authorDeckPath = path.join(state.outDir, 'author', 'deck.html');
  const visualDeckPath = path.join(state.outDir, 'deck.visual.html');
  const reportPath = path.join(state.outDir, 'report.json');
  const reverseModelPath = path.join(state.outDir, 'reverse-model.json');

  const artifacts = [
    artifact('json', state.snapshotPath, 'Reverse snapshot')
  ];
  if (fs.existsSync(authorDeckPath)) artifacts.push(artifact('html', authorDeckPath, 'Author deck html'));
  if (fs.existsSync(visualDeckPath)) artifacts.push(artifact('html', visualDeckPath, 'Visual deck html'));
  if (fs.existsSync(reportPath)) artifacts.push(artifact('json', reportPath, 'Reverse report'));
  if (fs.existsSync(reverseModelPath)) artifacts.push(artifact('json', reverseModelPath, 'Reverse model'));

  if (!fs.existsSync(authorDeckPath)) {
    return {
      status: 'error',
      error: {
        code: 'AUTHOR_HTML_MISSING',
        message: `Reverse export did not produce author deck: ${authorDeckPath}`
      }
    };
  }

  return {
    status: 'complete',
    data: {
      ok: true,
      outDir: state.outDir,
      snapshotPath: state.snapshotPath,
      authorDeckPath,
      visualDeckPath: fs.existsSync(visualDeckPath) ? visualDeckPath : null,
      reportPath: fs.existsSync(reportPath) ? reportPath : null
    },
    artifacts
  };
}

module.exports = {
  call,
  resume
};
```

如果 `compileReverseSnapshotToHtml` 当前不是 async，仍然可以 `await`；这样后续内部实现改成异步不会影响插件协议。

- [ ] **Step 4: 接入 dispatcher**

修改 `src/indesign-cli-plugin/dispatcher.js`：

```js
const reverseExport = require('./tools/reverse-export');

const callers = {
  'html.authoring_lint': authoringLint,
  'html.compile_instructions': compileInstructionsTool,
  'html.build_indesign': buildIndesign,
  'html.reverse_export': reverseExport
};
```

- [ ] **Step 5: 运行 reverse 单测**

Run:

```powershell
node --test test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
# pass
```

- [ ] **Step 6: 提交 Task 5**

Run:

```powershell
git add src/indesign-cli-plugin/tools/reverse-export.js src/indesign-cli-plugin/dispatcher.js test/fixtures/indesign-cli-plugin/reverse-snapshot.json test/indesign-cli-plugin/plugin-tools.test.js
git commit -m "feat: expose reverse export plugin tool"
```

## Task 6: 文档边界和 AGENTS 入口

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`

- [ ] **Step 1: 更新 `AGENTS.md` 仓库地图**

在仓库地图表格增加：

```md
| `src/indesign-cli-plugin/` | InDesign CLI 插件适配层：manifest、JSON-RPC 协议入口、正式 html.* 工具、host action 编排；不得直接调用 InDesign COM |
```

- [ ] **Step 2: 更新 `AGENTS.md` 架构边界**

在当前架构边界增加：

```md
插件层只暴露正式使用功能：`html.authoring_lint`、`html.compile_instructions`、`html.build_indesign`、`html.reverse_export`。二轮回环、结构 diff、视觉 diff、P0/P1 门禁和诊断审计属于本仓库内部测试工具，不得进入插件 `tools/list`。需要真实 InDesign 的插件工具必须返回 `script.run` host action，不得在 Node 插件内直接调用 COM、旧 MCP 或旧 CLI。
```

- [ ] **Step 3: 更新库级规范**

在 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 的执行器/外部 CLI 边界章节增加：

```md
### InDesign CLI 插件边界

`src/indesign-cli-plugin/` 是面向 `indesign-cli` 的正式使用入口，只做协议适配和 host action 编排。插件工具以 `html.*` 命名，第一版只暴露作者包检查、编译指令、构建 InDesign 文件、反向导出 HTML 作者包。

内部质量门禁不进入插件工具目录。`audit:roundtrip`、`audit:effective-diff`、`audit:conversion-gate`、二次回环和视觉/结构诊断继续作为本仓库测试命令使用，用来验证插件和转换链路可靠性，但不面向最终使用者。

插件不得直接调用 InDesign COM。所有真实 InDesign 执行通过 `script.run` host action 交给 `indesign-cli`；插件只生成位于项目输出目录内的 JSX、instructions 和报告。
```

- [ ] **Step 4: 运行文档和测试基础检查**

Run:

```powershell
git diff --check
node --test test/indesign-cli-plugin/plugin-protocol.test.js test/indesign-cli-plugin/plugin-tools.test.js
```

Expected:

```text
warning: in the working copy...
# pass
```

`git diff --check` 不得输出 trailing whitespace 或 whitespace error。

- [ ] **Step 5: 提交 Task 6**

Run:

```powershell
git add AGENTS.md docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md
git commit -m "docs: document indesign cli plugin boundary"
```

## Task 7: 本机 CLI 验证和真实 InDesign 冒烟

**Files:**
- No source changes expected
- Temporary outputs: `test/workspace/plugin-*.json` and `test/workspace/plugin-*/`

- [ ] **Step 1: 运行完整 Node 测试**

Run:

```powershell
npm test
```

Expected:

```text
# tests ...
# pass ...
# fail 0
```

- [ ] **Step 2: 验证插件 manifest**

Run:

```powershell
indesign-cli plugin validate D:\AI\html-indesign
```

Expected:

```text
valid
```

如果输出 JSON，以 `status` 为 `ok` 或 `valid` 为准；不得出现 `PLUGIN_MANIFEST_NOT_FOUND`、`PLUGIN_ENTRY_NOT_FOUND`、`PLUGIN_PROTOCOL_ERROR`。

- [ ] **Step 3: 安装插件**

Run:

```powershell
indesign-cli plugin install D:\AI\html-indesign
```

Expected:

```text
installed
```

不得安装到主目录下的临时副本；安装记录应指向 `D:\AI\html-indesign`。

- [ ] **Step 4: 检查只暴露四个正式工具**

Run:

```powershell
indesign-cli tool list --domain html
```

Expected IDs:

```text
html.authoring_lint
html.compile_instructions
html.build_indesign
html.reverse_export
```

不得出现：

```text
html.audit_roundtrip
html.audit_second_pass
html.conversion_gate
html.effective_diff
```

- [ ] **Step 5: 检查四个 schema**

Run:

```powershell
indesign-cli tool schema html.authoring_lint
indesign-cli tool schema html.compile_instructions
indesign-cli tool schema html.build_indesign
indesign-cli tool schema html.reverse_export
```

Expected:

```text
inputSchema
additionalProperties: false
```

每个 schema 都必须能显示 `required` 字段；不得返回 `TOOL_NOT_FOUND`。

- [ ] **Step 6: 调用 authoring_lint**

写入 `test/workspace/plugin-authoring-lint-args.json`：

```json
{
  "package": "test/fixtures/e2e/architecture-report/deck.config.json",
  "strict": true
}
```

Run:

```powershell
indesign-cli tool call html.authoring_lint --args test/workspace/plugin-authoring-lint-args.json
```

Expected:

```text
ok
```

返回 JSON 时，确认：

```json
{
  "status": "complete",
  "data": {
    "ok": true
  }
}
```

- [ ] **Step 7: 调用 compile_instructions**

写入 `test/workspace/plugin-compile-args.json`：

```json
{
  "package": "test/fixtures/e2e/architecture-report/deck.config.json",
  "targetSize": "same",
  "unitMode": "presentation",
  "outDir": "test/workspace/plugin-compile-cli-smoke"
}
```

Run:

```powershell
indesign-cli tool call html.compile_instructions --args test/workspace/plugin-compile-args.json
```

Expected:

```text
status: complete
```

确认：

```powershell
Test-Path test/workspace/plugin-compile-cli-smoke/instructions.json
Test-Path test/workspace/plugin-compile-cli-smoke/compile-summary.json
```

Expected:

```text
True
True
```

- [ ] **Step 8: 调用 build_indesign 真实构建**

写入 `test/workspace/plugin-build-args.json`：

```json
{
  "package": "test/fixtures/e2e/architecture-report/deck.config.json",
  "targetSize": "same",
  "unitMode": "presentation",
  "outDir": "test/workspace/plugin-build-cli-smoke",
  "outputBaseName": "plugin-smoke",
  "exportPdf": true,
  "exportIdml": true,
  "timeout": 300
}
```

Run:

```powershell
indesign-cli tool call html.build_indesign --args test/workspace/plugin-build-args.json
```

Expected:

```text
status: complete
```

确认：

```powershell
Test-Path test/workspace/plugin-build-cli-smoke/plugin-smoke.indd
Test-Path test/workspace/plugin-build-cli-smoke/plugin-smoke.pdf
Test-Path test/workspace/plugin-build-cli-smoke/plugin-smoke.idml
```

Expected:

```text
True
True
True
```

如果本机 InDesign 未启动或 `indesign-cli` host 不可用，本步骤必须报告真实错误，例如 `script.run` 超时或 host unavailable；不得改成假成功。

- [ ] **Step 9: 调用 reverse_export 真实反向导出**

写入 `test/workspace/plugin-reverse-args.json`：

```json
{
  "indd": "test/workspace/plugin-build-cli-smoke/plugin-smoke.indd",
  "outDir": "test/workspace/plugin-reverse-cli-smoke",
  "mode": "structured",
  "assetPolicy": "reference",
  "timeout": 300
}
```

Run:

```powershell
indesign-cli tool call html.reverse_export --args test/workspace/plugin-reverse-args.json
```

Expected:

```text
status: complete
```

确认：

```powershell
Test-Path test/workspace/plugin-reverse-cli-smoke/reverse-snapshot.json
Test-Path test/workspace/plugin-reverse-cli-smoke/author/deck.html
Test-Path test/workspace/plugin-reverse-cli-smoke/deck.visual.html
```

Expected:

```text
True
True
True
```

- [ ] **Step 10: 运行内部门禁但不导出为插件工具**

Run:

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip
```

Expected:

```text
canonical-content-inventory-report.json passed
canonical-structure-signature-report.json passed
```

这个命令用于证明插件依赖的转换链路仍稳定；命令本身不出现在 `indesign-cli tool list --domain html`。

- [ ] **Step 11: 最终 diff 检查**

Run:

```powershell
git diff --check
git status --short
```

Expected:

```text
```

`git status --short` 允许显示本计划产生的源代码和文档改动；不应显示插件验证误写到仓库根目录的临时文件。临时产物只能位于 `test/workspace/`。

- [ ] **Step 12: 提交 Task 7 验证收口**

如果 Task 7 没有源代码改动，只记录验证结果，不提交。如果因为 CLI 验证暴露了实现缺陷并修复了代码，提交：

```powershell
git add <修复涉及的源代码或测试文件>
git commit -m "fix: pass indesign cli plugin validation"
```

## 自检结果

- 需求覆盖：计划覆盖 manifest、`plugin/handshake`、`tools/list`、`tools/schema`、`tools/call`、`tools/resume`，并覆盖四个正式工具。真实 InDesign 只通过 host action 执行。
- 对外边界：二轮回环、diff、门禁、诊断审计没有进入 `tool-catalog.js`，只作为内部验证命令存在。
- 架构一致：插件层不新增 HTML 解析、不新增 InDesign COM 层、不恢复旧 CLI；核心转换继续走 adapter、writer、authoring、reverse 模块。
- 文件膨胀控制：每个公开工具一个文件，dispatcher 只做路由；E2E JSX 字符串抽到 `host-jsx.js`，避免继续增大 `scripts/indesign-e2e.js`。
- 可验证性：每个任务先写失败测试，再实现，再跑命令；最终包含 `indesign-cli plugin validate/install/list/schema/call` 和真实 InDesign 冒烟。
