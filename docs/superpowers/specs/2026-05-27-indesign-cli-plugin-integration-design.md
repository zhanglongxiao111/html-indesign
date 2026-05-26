# html-indesign 作为 indesign-cli 插件的集成设计

## 1. 背景

`html-indesign` 当前定位是固定语义 HTML 与 InDesign 的双向翻译库。它已经依赖真实 InDesign CLI 执行 JSX、导出 PDF/IDML、做真实 E2E。

`indesign-cli` 当前定位是 Agent 友好的 InDesign 自动化底座。它负责：

- 发现工具目录。
- 执行 JSX。
- 调用 MCP / handler 能力。
- 验证导出产物。
- 安装项目级 InDesign Skill。
- 维护 `.indesign-cli/session.json`。

两者职责不同：

| 项目 | 核心责任 |
| ---- | -------- |
| `indesign-cli` | 真实 InDesign 通道和通用自动化底座 |
| `html-indesign` | HTML 作者包、语义 preset、双向翻译和回环验证 |

因此 `html-indesign` 不应并入 `indesign-cli` 核心，而应作为一等插件接入。

## 2. 当前 indesign-cli 状态

当前 `indesign-cli` 的工具来源基本固定：

- `cli` primitive。
- `script` primitive。
- `advanced` MCP backend。
- `classic` MCP backend。
- `hidden_handler` bridge。

相关入口在 `D:/AI/mcp-indesign/agent-harness/cli_anything/indesign/indesign_cli.py`、`core/catalog.py`、`core/router.py`。

当前没有通用插件发现机制。因此要让 `html-indesign` 成为插件，需要先在 `indesign-cli` 增加插件宿主层。

## 3. 目标

建立一个插件模型，让 `html-indesign` 可以被 `indesign-cli` 发现、列入工具目录，并通过统一 CLI 调用。

目标用户体验：

```powershell
indesign-cli plugin list
indesign-cli html preset init --profile architecture-report --package deck.config.json
indesign-cli html lint --package deck.config.json --strict
indesign-cli html build --package deck.config.json --target-size qhd
indesign-cli html reverse --out reverse-html
indesign-cli html roundtrip --package deck.config.json
```

工具目录体验：

```powershell
indesign-cli tool domains
indesign-cli tool list --domain html
indesign-cli tool schema html.roundtrip
indesign-cli tool call html.roundtrip --args args.json
```

## 4. 非目标

本设计不做：

- 不把 `html-indesign` 源码搬进 `indesign-cli/src`。
- 不让 `html-indesign` 重新实现 InDesign COM、MCP 或脚本执行层。
- 不要求普通 `indesign-cli` 用户默认安装 Playwright、HTML 解析、PDF 预览等重依赖。
- 不让插件绕过 `indesign-cli` 的 JSON envelope、session 和错误报告。
- 不把 HTML 翻译能力塞进 `template`、`presentation` 等既有域里。

## 5. 插件边界

`html-indesign` 插件负责：

- 作者源码包组装。
- 作者规则检查。
- 语义 preset 初始化、校验和候选合并。
- HTML 快照和语义模型生成。
- HTML -> InDesign instructions。
- instructions -> JSX 构建脚本准备。
- InDesign reverse snapshot -> HTML 作者包。
- 双向回环和源码漂移审计。

`indesign-cli` 宿主负责：

- 插件发现。
- 插件命令解析。
- 插件工具目录暴露。
- 执行插件请求。
- 执行真实 JSX。
- 导出、验证 PDF/IDML。
- 统一 JSON envelope。
- 统一 session 记录。

关键边界：

```text
html-indesign 生成要执行的 JSX 或 instructions
-> indesign-cli 负责送进真实 InDesign
-> html-indesign 读取结果并继续生成 HTML / report
```

## 6. 插件协议

插件应提供 manifest：

```json
{
  "id": "html-indesign",
  "name": "html-indesign",
  "version": "1.0.0",
  "domain": "html",
  "kind": "node-plugin",
  "entry": "dist/plugin/index.js",
  "description": "固定语义 HTML 与 InDesign 的双向翻译插件",
  "commands": [
    "preset.init",
    "preset.validate",
    "authoring.assemble",
    "authoring.lint",
    "compile.instructions",
    "build.indesign",
    "reverse.export",
    "roundtrip.run"
  ]
}
```

插件入口建议实现类 MCP 协议：

| 方法 | 作用 |
| ---- | ---- |
| `tools/list` | 返回插件工具清单 |
| `tools/schema` | 返回单个工具 schema |
| `tools/call` | 调用插件工具 |

这样 `indesign-cli` 可以复用现有 MCP backend 的思路，而不是为每个插件写 Python 适配器。

## 7. CLI 命令映射

插件工具 ID 使用 `html.*` 域：

| CLI 命令 | tool id | 说明 |
| -------- | ------- | ---- |
| `html preset init` | `html.preset_init` | 从标准语义库生成项目语义库 |
| `html preset validate` | `html.preset_validate` | 校验项目语义库 |
| `html assemble` | `html.authoring_assemble` | 组装作者包 `deck.html` |
| `html lint` | `html.authoring_lint` | 检查作者包和 token |
| `html compile` | `html.compile_instructions` | 生成 instructions |
| `html build` | `html.build_indesign` | HTML -> InDesign/PDF/IDML |
| `html reverse` | `html.reverse_export` | InDesign -> HTML 作者包 |
| `html roundtrip` | `html.roundtrip_run` | 前向、反向和二次回环 |

`indesign-cli html ...` 是人类友好短命令。`tool call html.*` 是 Agent 和自动化稳定入口。

## 8. 插件安装

支持三类安装来源：

| 来源 | 示例 | 用途 |
| ---- | ---- | ---- |
| 内置插件 | 随 `indesign-cli[html]` 安装 | 官方一起发布 |
| 用户级插件 | `%USERPROFILE%/.indesign-cli/plugins/*.json` | 本机所有项目可用 |
| 项目级插件 | `<project>/.indesign-cli/plugins/*.json` | 当前项目固定插件版本 |

本地开发安装：

```powershell
indesign-cli plugin install D:\AI\html-indesign
```

写入项目级配置：

```json
{
  "id": "html-indesign",
  "kind": "node-plugin",
  "root": "D:/AI/html-indesign",
  "entry": "src/indesign-cli-plugin/index.js",
  "domain": "html"
}
```

规则：

- 插件 root 必须是显式路径或已安装包位置。
- 插件不能默认访问宿主 repo 的内部源码。
- 插件执行工作目录默认是用户当前项目目录。
- 插件临时产物写到当前项目 `test/workspace/` 或显式 `--out`。

## 9. 发布打包

推荐发布模型是“底座 + 可选官方插件”。

### 9.1 基础包

```powershell
pip install indesign-cli
```

只包含：

- CLI。
- 通用 InDesign 工具目录。
- JSX 执行。
- 导出验证。
- Skill 安装。

不包含 HTML 转换重依赖。

### 9.2 HTML 插件包

```powershell
pip install indesign-html-plugin
```

该包包含：

- `html-indesign` 插件 dist。
- 标准语义库。
- 作者包工具。
- 反向导出工具。
- 插件 Skill。

安装后通过 Python entry point 或插件 manifest 被 `indesign-cli` 发现。

### 9.3 Extra 安装

```powershell
pip install "indesign-cli[html]"
```

`indesign-cli[html]` 不把 `html-indesign` 变成核心代码，只声明额外依赖，让用户一次安装底座和官方 HTML 插件。

### 9.4 一体化发行版

可选提供：

```powershell
pip install indesign-cli-full
```

`full` 包用于需要开箱即用的 Agent 环境，包含常用官方插件。它不改变核心架构。

## 10. Wheel 内部结构

`indesign-cli[html]` 安装后，包内结构可以是：

```text
cli_anything/
  indesign/
    core/
    server/
    plugins/
      html_indesign/
        manifest.json
        package.json
        dist/
        presets/
        skills/
```

插件也可以作为独立包安装到 site-packages：

```text
indesign_html_plugin/
  manifest.json
  dist/
  presets/
  skills/
```

`indesign-cli` 通过 entry point 找到它：

```toml
[project.entry-points."indesign_cli.plugins"]
html-indesign = "indesign_html_plugin:plugin_manifest"
```

## 11. 宿主发现顺序

插件发现顺序：

1. 项目级 `.indesign-cli/plugins/*.json`。
2. 用户级 `.indesign-cli/plugins/*.json`。
3. Python entry points `indesign_cli.plugins`。
4. `indesign-cli` 包内置插件目录。

同 ID 插件冲突时：

- 项目级优先。
- 用户级其次。
- entry point 其次。
- 内置最后。
- 冲突必须出现在 `plugin list` 的 warning 中。

## 12. 安全与稳定性

插件调用必须保持 `indesign-cli` 的输出契约：

- 成功和失败都返回 JSON envelope。
- 失败必须有 `code`、`message` 和可审计 details。
- 插件工具必须声明 side effects。
- 需要真实 InDesign 的工具必须声明 `needs_indesign: true`。
- 生成文件必须显式返回路径。
- 插件不能吞掉 `script run` 的失败。

插件工具目录项应包含：

```json
{
  "id": "html.roundtrip_run",
  "domain": "html",
  "source": "plugin",
  "plugin": "html-indesign",
  "needs_indesign": true,
  "side_effects": ["filesystem_write", "indesign_mutation"],
  "artifact_kinds": ["indd", "pdf", "idml", "html", "json"]
}
```

## 13. html-indesign 仓库要求

`html-indesign` 需要新增：

```text
src/indesign-cli-plugin/
  index.js
  manifest.json
```

插件入口应只做适配：

- 调用现有 `scripts/` 或库 API。
- 不重复实现 CLI 参数解析大逻辑。
- 不直接调用 InDesign COM。
- 需要 InDesign 时调用宿主能力或生成宿主可执行任务。

长期应把 `scripts/indesign-e2e.js` 中可复用逻辑下沉到库 API，让插件和 npm scripts 共用。

## 14. indesign-cli 仓库要求

`indesign-cli` 需要新增：

- `plugin` 命令组。
- 插件 manifest schema。
- 插件发现器。
- 插件 backend。
- `html` 动态子命令转发。
- `tool domains/list/schema/call` 对 `source: plugin` 的支持。
- 插件安装和卸载命令。

新增命令：

```powershell
indesign-cli plugin list
indesign-cli plugin install <path-or-package>
indesign-cli plugin remove <id>
indesign-cli plugin doctor <id>
```

## 15. 测试要求

`indesign-cli` 侧测试：

- 插件 manifest 加载。
- 项目级插件优先于内置插件。
- `tool list --domain html` 能列出插件工具。
- `tool schema html.authoring_lint` 返回 schema。
- 插件调用失败时返回统一 envelope。
- 没安装插件时 `html` 命令给出清晰错误。

`html-indesign` 侧测试：

- 插件 manifest 有效。
- `tools/list` 包含核心工具。
- `tools/schema` 与 npm scripts 参数一致。
- `tools/call html.authoring_lint` 调用现有 lint。
- `tools/call html.roundtrip_run` 能走现有 E2E 逻辑。

真实 E2E：

- 本地项目安装插件。
- `indesign-cli html build --package ...` 生成 INDD/PDF/IDML。
- `indesign-cli html roundtrip --package ...` 生成反向作者包和漂移报告。

## 16. 实施顺序

第一阶段：本地插件协议

1. 在 `html-indesign` 新增插件 manifest 和 Node 插件入口。
2. 在 `indesign-cli` 增加项目级插件发现。
3. 支持 `tool list/schema/call` 调用 `html` 域工具。
4. 支持 `plugin list/install/remove`。

第二阶段：命令体验

1. 增加 `indesign-cli html ...` 快捷命令。
2. 把 `html-indesign` npm scripts 映射为插件工具。
3. 保持 `npm run ...` 仍可单独使用。

第三阶段：发布打包

1. 发布独立 `indesign-html-plugin` 包。
2. 给 `indesign-cli` 增加 `[html]` extra。
3. 可选发布 `indesign-cli-full`。

## 17. 成功标准

完成后应满足：

- `html-indesign` 可以作为本地插件接入 `indesign-cli`。
- Agent 可以通过 `indesign-cli tool list --domain html` 发现 HTML 双向转换工具。
- 用户可以通过 `indesign-cli html ...` 使用高层命令。
- 普通 `indesign-cli` 安装仍保持轻量。
- `indesign-cli[html]` 可以一次安装 CLI 和官方 HTML 插件。
- 插件不复制 InDesign 通信层，不破坏两个项目的职责边界。

## 18. 关键决策

- `html-indesign` 是官方插件，不是 `indesign-cli` 核心模块。
- 插件可以随发行版一起安装，但架构上保持隔离。
- 默认基础包轻量，HTML 能力通过插件或 extra 安装。
- 插件工具必须进入统一 tool catalog。
- 真实 InDesign 执行仍由 `indesign-cli` 宿主负责。
