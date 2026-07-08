# public API 与孤儿模块退役审计报告

## 审计元数据

- 工作区：`D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails`
- 分支：`codex/architecture-hardening-guardrails`
- HEAD：`d753a8407dbff2aa7c21805192ffcd0d429da46e`
- 审计方式：只读静态审计 + 定向 Node 测试；未修改代码、测试、配置、git index 或 HEAD。

## 当前结论

- **结论：退役入口清理完成，未发现 public API、plugin tool 或 require graph 中仍存活的旧 facade、旧目录或孤儿模块。**
- **总体风险等级：`none`**
- 关键 findings：
  1. 根 public API 只暴露当前协议化入口；旧 `pagedHtml` / `indesignReverse` / `historicalTemplate` 已从公开导出面移除。
  2. 插件 `tools/list` 只暴露 4 个正式 `html.*` 工具，且真实 InDesign 路径通过 `script.run` host action 交给宿主，不存在 Node 侧假成功或旁路调用。
  3. `src/indesign-pipeline/` 与 `src/reverse-pipeline/` 都有真实 owner，不是测试假入口；G8 孤儿模块基线为空，当前审计范围内无可删孤儿。

## 证据

### 1. public API 已切到当前入口，旧 facade 未暴露

- 根导出面只包含 `protocol`、`adapters`、`semanticModel`、`semanticReconstruction`、`writers`；其中 `writers.indesign.compileInstructions` 明确从 `src/indesign-pipeline` 接入，而不是恢复旧 facade：[index.js:1-33](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\index.js)
- `test/public-api.test.js` 明确断言旧 facade 为 `undefined`，并限制 `semanticModel` 只保留校验入口：[test/public-api.test.js:25-38](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\public-api.test.js)
- `test/protocol/baseline-imports.test.js` 明确断言 `src/paged-html` 与 `src/indesign-reverse` 目录不存在：[test/protocol/baseline-imports.test.js:20-23](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\protocol\baseline-imports.test.js)
- 定向 grep：

```text
rg -n "pagedHtml|indesignReverse|historicalTemplate|paged-html|indesign-reverse|legacy" index.js src/indesign-cli-plugin src/indesign-pipeline src/reverse-pipeline test/public-api.test.js test/protocol/baseline-imports.test.js
```

结果只命中两份测试断言：

- `test/public-api.test.js:26-28`
- `test/protocol/baseline-imports.test.js:20-23`

未命中 `index.js`、`src/indesign-cli-plugin/`、`src/indesign-pipeline/`、`src/reverse-pipeline/` 的 live entry。

### 2. 插件只暴露正式 `html.*` 工具，且仍通过 host action 调 InDesign

- `tool-catalog` 只登记 4 个工具：`html.authoring_lint`、`html.compile_instructions`、`html.build_indesign`、`html.reverse_export`：[src/indesign-cli-plugin/tool-catalog.js:1-70](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tool-catalog.js)
- `dispatcher` 的调用表与上面 4 个 id 一一对应，没有额外 plugin tool：[src/indesign-cli-plugin/dispatcher.js:1-12](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\dispatcher.js)
- 运行时枚举也只返回这 4 个 id：

```text
node -e "const { listTools } = require('./src/indesign-cli-plugin/tool-catalog'); console.log(listTools().map((tool) => tool.id).join('\n'));"
```

输出：

```text
html.authoring_lint
html.compile_instructions
html.build_indesign
html.reverse_export
```

- `tools/list` JSON-RPC 结果同样只返回这 4 个工具。
- `html.build_indesign` 只返回 `script.run` / `export.verify` host action，不在 Node 侧直接调用 InDesign：[test/indesign-cli-plugin/plugin-tools.test.js:64-90](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\indesign-cli-plugin\plugin-tools.test.js)
- `html.reverse_export` 的 `call()` 只生成 `reverse-snapshot.jsx` 并请求 `script.run`；`resume()` 再调用 `src/reverse-pipeline` 写出 HTML，不依赖退役 `src/indesign-reverse` 模块：[src/indesign-cli-plugin/tools/reverse-export.js:8-54](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\reverse-export.js)、[src/indesign-cli-plugin/tools/reverse-export.js:57-110](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\reverse-export.js)
- `html.reverse_export` 的插件测试同样验证 `script.run` host action 与 resume 产物，不存在“错误也返回 complete”的假成功：[test/indesign-cli-plugin/plugin-tools.test.js:132-187](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\indesign-cli-plugin\plugin-tools.test.js)

### 3. 新 pipeline 模块有真实 owner，不是测试假入口，也没有孤儿模块

- `src/indesign-pipeline/index.js` 是极薄编排入口，只负责 `snapshot -> semantic model -> instructions`，被根 public API 显式接入：[src/indesign-pipeline/index.js:1-11](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-pipeline\index.js)、[index.js:17-24](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\index.js)
- `src/indesign-cli-plugin/tools/compile-instructions.js` 直接依赖 `../../indesign-pipeline`，说明 pipeline 被正式插件路径使用，不是测试专用：[src/indesign-cli-plugin/tools/compile-instructions.js:3-5](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\compile-instructions.js)、[src/indesign-cli-plugin/tools/compile-instructions.js:26-34](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\compile-instructions.js)
- `scripts/indesign-e2e.js` 也直接依赖 `src/indesign-pipeline`，并在回环时复用 reverse CLI wrapper：[scripts/indesign-e2e.js:6-11](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-e2e.js)、[scripts/indesign-e2e.js:342-359](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-e2e.js)
- `src/reverse-pipeline/index.js` 被插件 `resume()` 正式依赖：[src/indesign-cli-plugin/tools/reverse-export.js:81-88](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\reverse-export.js)
- `scripts/indesign-reverse-export.js` 只是薄 CLI wrapper，顶层直接转发到 `src/reverse-pipeline`：[scripts/indesign-reverse-export.js:1-4](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-reverse-export.js)、[scripts/indesign-reverse-export.js:70-83](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-reverse-export.js)
- CLI 测试明确断言 wrapper 复用的是同一个 `compileReverseSnapshotToHtml` 函数对象：[test/indesign-to-html/cli.test.js:5-15](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\indesign-to-html\cli.test.js)
- `package.json` 仍把 `scripts/indesign-reverse-export.js` 挂在正式 npm script `reverse:indesign` 下，说明它是 live script target，不是孤儿：[package.json:21-30](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\package.json)
- G8 规则会把 `index.js`、`src/indesign-cli-plugin/index.js`、`package.json` scripts、显式 `require.main` CLI 都当 owner roots，并遍历 `src/` + `scripts/` 的静态 require graph：[test/architecture/orphan-modules.test.js:115-157](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\architecture\orphan-modules.test.js)
- G8 baseline 无豁免，表示当前没有被接受的孤儿模块债务：[test/architecture/baselines/G8.json](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\architecture\baselines\G8.json)
- 定向测试全部通过：

```text
node --test test/architecture/orphan-modules.test.js test/public-api.test.js test/protocol/baseline-imports.test.js
```

结果：`10` 个测试全部通过，`0 fail`。

### 4. 定向 diff 与任务目标一致

```text
git diff -U8 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- index.js src/indesign-cli-plugin src/indesign-pipeline src/reverse-pipeline test/public-api.test.js test/protocol/baseline-imports.test.js
```

摘要：

- `index.js` 新增对 `src/indesign-pipeline` 的显式接入。
- `src/indesign-cli-plugin/tools/reverse-export.js` 从旧 `scripts/indesign-reverse-export.js` 依赖改为 `../../reverse-pipeline`。
- `src/indesign-cli-plugin/tools/authoring-lint.js` 从内部文件直连改为 `../../authoring` 公共入口。
- 新增 `src/indesign-pipeline/index.js` 与 `src/reverse-pipeline/index.js`，都已被 live owner 接入。

这与“旧公共入口不得恢复；退役模块不得通过 public API、plugin tool 或 require graph 存活”的目标一致。

## 风险分级

- `P0`：无
- `P1`：无
- `P2`：无
- `none`：当前审计范围内未发现残留旧入口、双路径兼容或孤儿模块。

## 可删候选

- **无。**
- 当前 `test/architecture/baselines/G8.json` 为空，且定向 G8 测试通过；本轮没有命中任何真实孤儿模块或“只被测试引用”的假入口。

## 不可删理由

- `src/indesign-pipeline/index.js`
  - 由根 public API 暴露为 `api.writers.indesign.compileInstructions`：[index.js:17-24](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\index.js)
  - 由正式插件编译工具使用：[src/indesign-cli-plugin/tools/compile-instructions.js:3-5](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\compile-instructions.js)
  - 由正式 E2E 编排使用：[scripts/indesign-e2e.js:6-9](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-e2e.js)
- `src/reverse-pipeline/index.js`
  - 由正式插件 `html.reverse_export` 的 `resume()` 使用：[src/indesign-cli-plugin/tools/reverse-export.js:81-88](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\src\indesign-cli-plugin\tools\reverse-export.js)
  - 由 CLI wrapper 使用：[scripts/indesign-reverse-export.js:3](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-reverse-export.js)
  - 由 CLI 契约测试锁定为同一函数对象：[test/indesign-to-html/cli.test.js:13-15](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\test\indesign-to-html\cli.test.js)
- `scripts/indesign-reverse-export.js`
  - 仍是正式 npm script target：[package.json:27](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\package.json)
  - 被 E2E 回环编排复用：[scripts/indesign-e2e.js:353-359](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-e2e.js)
  - 现状是“薄 CLI 包装”，不是退役 `src/indesign-reverse` 模块的存活形式：[scripts/indesign-reverse-export.js:1-4](D:\AI\html-indesign\.worktrees\architecture-hardening-guardrails\scripts\indesign-reverse-export.js)

## 是否需要沉淀长期规范

- **否。**
- 现有 `AGENTS.md` 已写清 `src/indesign-pipeline/`、`src/reverse-pipeline/` 和插件仅暴露 4 个正式 `html.*` 工具的边界，且本轮测试已把这些边界变成可执行 guardrail。
- 后续只有在下面两种情况之一发生时，才需要新增长期规范：
  1. 根 public API 计划进一步缩减或重命名 `writers.indesign.compileInstructions`；
  2. `reverse:indesign` CLI 脚本准备正式退役或更名。
