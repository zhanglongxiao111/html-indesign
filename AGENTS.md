# AGENTS 主入口

## 0. 项目定位

- 本项目目标是实现 HTML 与 InDesign 的双向转换。
- 第一阶段先实现 HTML 到 InDesign：定义可校验、可测试、可编译的固定语义 HTML，并编译为 InDesign 构建指令。
- InDesign 到 HTML 是后续阶段能力，当前只保留 blueprint 提取和参考 HTML 生成作为语义来源，不扩展完整反向转换。
- `D:\AI\mcp-indesign\indesign-mcp-server` 是 InDesign 执行后端和 CLI 来源。
- `cli-anything-indesign` 是本项目调用真实 InDesign 的默认入口。
- 不在本项目复制 COM、MCP server、JSX 传输层或 InDesign 工具目录。

## 1. 真相顺序

| 优先级 | 依据 | 用法 |
| ------ | ---- | ---- |
| 1 | 当前用户指令 | 本轮任务最高优先级 |
| 2 | `AGENTS.md` | 项目级协作入口和边界 |
| 3 | 当前代码 | 校正文档和行为判断的最终依据 |
| 4 | `docs/HTML_INDESIGN_LIBRARY_SPEC.md` | html-indesign 库级目标、架构和转换规范 |
| 5 | `docs/SEMANTIC_PROTOCOL.md` | 当前固定语义 HTML 协议说明 |
| 6 | `test/reference/AGENT_SPEC.md` 与参考 HTML | 旧模板语义和槽位参考 |
| 7 | Git 历史 | 需要恢复旧内容时才查看 |

冲突处理：

| 冲突类型 | 处理方式 |
| -------- | -------- |
| 文档与代码不一致 | 以代码为准，顺手修正文档 |
| 旧流程资料与当前目标不一致 | 以当前目标为准 |
| 语义协议与具体 InDesign 母版名冲突 | 优先稳定语义，通过映射层兼容母版和槽位 |
| 编译逻辑与执行逻辑混在一起 | 把 HTML 解析、校验和语义推理留在宿主侧库，JSX 只执行已验证指令 |

## 2. 强制规则

### 2.1 沟通与文档

- 与用户沟通使用中文，短句，直接说结论。
- 文件名、命令、API 名保留原文，并用代码样式标出。
- 新增长期文档前先判断是否真的需要；当前阶段优先保持代码和测试清晰。
- 过程性、临时性材料不要堆到根目录。

### 2.2 代码边界

- `src/generator.js` 负责从 blueprint 生成参考 HTML。
- `src/spec-generator.js` 负责生成 Agent 可读的写作规范。
- `src/validator.js` 负责校验 HTML 是否符合 blueprint 或语义约束。
- `src/builder.js` 负责把 HTML 转成 InDesign build instructions。
- `src/types/` 放语义、blueprint、tag 等类型定义。
- `_indesign_scripts/` 只放 InDesign 端执行脚本和必要调试脚本。
- `test/reference/` 放参考 HTML 和旧模板语义样本。
- `test/artifacts/` 放可追溯的样本 blueprint。
- `test/workspace/` 放本地真实测试输出；该目录已进入 `.gitignore`。

不要在根目录新增一次性脚本、备份文件或临时测试文件。

### 2.3 固定语义 HTML

第一版目标是确定建筑设计汇报可用的固定语义。

设计原则：

- HTML 是受约束的语义输入，不是任意网页源码。
- 语义层应表达 `deck`、`section`、`page`、`title`、`body`、`image`、`caption`、`metric`、`table`、`case-study`、`image-grid` 等对象。
- CSS 主要作为样式 token 和受限布局表达，最终映射到 InDesign 段落样式、字符样式、对象样式和页面对象属性。
- 不支持完整浏览器 CSS；浏览器布局转换后续单独设计。
- 旧 `data-master`、`data-slot`、`data-template` 可以作为兼容层，但不应成为新语义协议的唯一表达。

推荐链路：

```text
固定语义 HTML
-> 语义校验
-> 样式和资源解析
-> InDesign 构建指令 JSON
-> cli-anything-indesign 执行 JSX
-> InDesign 内容页、样式和资源
```

### 2.4 InDesign CLI 使用

本项目使用已安装的 `cli-anything-indesign` 连接真实 InDesign。

常用命令：

| 动作 | 命令 |
| ---- | ---- |
| 健康检查 | `cli-anything-indesign server health` |
| JSON 输出 | `cli-anything-indesign --json --pretty server health` |
| 查看工具域 | `cli-anything-indesign tool domains` |
| 查看工具列表 | `cli-anything-indesign tool list --domain <domain>` |
| 查看工具 Schema | `cli-anything-indesign tool schema <tool_id>` |
| 调用工具 | `cli-anything-indesign tool call <tool_id> --args test\workspace\args.json` |
| 执行 JSX | `cli-anything-indesign script run <file.jsx>` |
| 执行构建脚本 | `cli-anything-indesign script run _indesign_scripts\build_from_instructions.jsx` |
| 验证导出产物 | `cli-anything-indesign export verify <path>` |

真实测试原则：

- 大型或多步实验放在 `test/workspace/<日期时间>/`。
- 生成 `instructions.json` 时，默认放到 `test/workspace/instructions.json`，以兼容现有构建脚本。
- 测试后清理临时 InDesign 文档、PDF、IDML 和中间资源。
- 不记录客户文档内容、客户名称或私有资产完整路径。

## 3. 执行基线

| 动作 | 命令 |
| ---- | ---- |
| 安装依赖 | `npm install` |
| 当前 npm 测试 | 暂无有效 `npm test` |
| CLI 安装来源 | `python -m pip install -e D:\AI\mcp-indesign\indesign-mcp-server\agent-harness` |
| CLI 健康检查 | `cli-anything-indesign server health` |
| 执行真实 JSX | `cli-anything-indesign script run <file.jsx>` |
| 验证导出文件 | `cli-anything-indesign export verify <path>` |

环境要求：

- Windows。
- Node.js 18 及以上。
- Python 3.10 及以上。
- Adobe InDesign 已安装，并与 CLI 运行在同一用户会话。
- `D:\AI\mcp-indesign\indesign-mcp-server\agent-harness` 已以 editable 方式安装。

## 4. 当前注意事项

| 事项 | 当前状态 | 处理原则 |
| ---- | -------- | -------- |
| 旧 blueprint / reference | 有价值，可作为语义种子 | 抽象成稳定语义，不原样绑定旧母版名 |
| `_indesign_scripts/build_from_instructions.jsx` | 可执行现有 build instructions | 作为执行后端参考，复杂校验留在 JS/Node 侧 |
| `docs/HTML_INDESIGN_LIBRARY_SPEC.md` | 当前库级设计规范 | 新功能和架构调整优先对齐该规范 |
| `docs/SEMANTIC_PROTOCOL.md` | 已收敛旧 `openspec/` 中仍有效的协议内容 | 作为长期语义说明，行为仍以当前代码为准 |
| `.gemini/settings.json` | 当前工作区已有未提交改动 | 不要回退或覆盖 |
| `test/workspace/` | 本地测试目录，已忽略 | 放真实测试临时产物 |
