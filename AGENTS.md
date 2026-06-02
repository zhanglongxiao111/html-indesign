# AGENTS 主入口

## 1. 项目定位

本项目当前是固定语义 HTML 与 InDesign 的双向翻译库；架构已收敛为以统一语义模型、格式适配器、格式写出器和协议字段注册表为中心的固定分页文档多格式转换库。HTML 与 InDesign 是当前主线，PPTX 等后续格式只能通过统一语义模型和格式适配器接入。

当前主线：

- 让 Agent 写自然、可预览、可校验的 HTML。
- 以统一语义模型和标签协议为中心，让 HTML 与 InDesign 可以双向翻译。
- 以统一语义模型作为长期事实源，让 HTML、InDesign、未来 PPTX 等格式读写同一组 canonical 字段。
- 把 HTML 语义、样式和资源编译成 InDesign 构建指令。
- 在 InDesign 端生成符合排版习惯的页面、样式、图框、表格和对象。
- 让 InDesign 输出携带 `html_indesign` 脚本标签，后续可反向导出固定语义 HTML。
- 支持人类与 Agent 循环协作：人类可先提供语义混乱或无语义的 InDesign，Agent 通过反向 HTML 观察、理解、重建白名单语义，再导回结构化 InDesign；人类后续手工调整造成的局部语义丢失或混乱，也必须在下一次回读时重新核对。
- 除了从混乱 HTML 中重建语义，Agent 也可以直接观察 InDesign 页面本身，基于版面、文字、图像、图层和样式推断每个元素应有的白名单语义标签，再导出结构化 HTML 或回写 InDesign；这是一条允许的语义化路径，可能比修复混乱 HTML 更直接。
- 真实 InDesign 执行复用外部 CLI，不在本项目重建 COM、MCP 或脚本传输层。

当前不做：

- 不支持任意网页完整还原。
- 不把复杂 HTML 解析、语义推理塞进 ExtendScript。
- 不为了方便转换，要求 Agent 写不自然的 HTML。
- 不在 InDesign 里堆叠临时补丁来掩盖翻译层缺陷。

## 2. 设计原则（硬规则）

- **浏览器预览不能牺牲。** HTML 必须像正常网页一样自然、清楚、可维护；严禁为了方便 InDesign 转换，让 Agent 写反常结构或视觉补丁。
- **InDesign 输出不能凑合。** InDesign 端必须生成符合 ID 习惯的原生对象；能用段落样式、字符样式、对象样式、表格、图框和置入资源解决的，严禁改用叠遮罩、白块、重复图片等补丁。
- **翻译层必须承担复杂度。** CSS 与 InDesign 能力不一致时，只能在快照、编译、执行层解决；严禁把复杂度推给 HTML 作者、人类用户或后续手工修图。
- **视觉偏差就是缺陷。** 浏览器 HTML 与 InDesign 输出不一致时，先定位丢失的语义、样式或执行能力；不得把“能跑通”当作完成。
- **页面网格是作者契约。** 建筑汇报类页面必须声明主网格、栏间距和/或 baseline；Agent 排版应服从该网格，InDesign 输出应生成对应原生参考线，严禁把对象边缘反推线当作默认网格。
- **标签是协议，模板是载体。** HTML 侧 `data-id-*` 与 InDesign 侧 `html_indesign` 脚本标签必须保持可回读；模板只负责批量提供标签、样式和布局约束，不能替代标签协议。
- **协议字段必须集中登记。** 新增字段、`data-id-*`、`html_indesign` payload、语义模型路径和 instructions 派生字段必须进入 `src/protocol/` 注册表；生成文档 `docs/规范/PROTOCOL_FIELD_REGISTRY.md` 是注册表的只读呈现。严禁在单个格式适配器、writer、executor 或 fixture 里私造同义字段、局部 allowlist 或第二能力矩阵。
- **格式能力必须显式声明。** HTML、InDesign、未来 PPTX 对同一字段的支持能力必须通过能力矩阵表达；不能为了某个格式把 canonical 字段命名成格式专用字段。格式独有能力只能进入 format extension，不得污染通用模型。
- **语义库是白名单。** 反向导出必须用当前项目语义库或标准语义库逐页、逐对象、逐字段复核标签；不在白名单内的语义、布局、样式 token 和结构关系不得参与结构化编译。
- **混乱标签降级观察。** 人类复制模板、手工修改或跨项目粘贴造成的过期 `html_indesign` 标签可以保留为观察信息，但不能作为有效协议事实；合规字段局部保留，不合规字段降级为不起作用的观察标签，并在报告中说明原因。
- **退役代码必须当场清除。** 一旦协议字段、标签格式、模块入口、兼容路径或命名被判定退役，必须在同一轮清掉读取、写出、测试样例、执行端默认值和文档表述；严禁用“过渡兼容”“小清理”“以后再删”为理由保留旧分支、旧字段兜底、`legacy` 命名、死代码或看似无害的双路径。旧内容若仍有追溯价值，只能进入观察信息、迁移报告或历史文档，绝不能继续进入结构化模型、编译链路、执行器或规范示例。发现退役代码仍在运行路径中生效，按严重缺陷处理，不按普通技术债处理。
- **优先完整收口。** 如果根因在共享翻译链路，必须修链路；严禁在单个 fixture、单页模板或 JSX 末端堆局部补丁。
- **兜底默认有害。** 兜底只能用于明确的兼容边界，必须可见、可测、可解释；严禁吞掉错误后输出看似成功的结果。
- **样式映射必须原样负责。** `border` 应映射为描边，`background` 应映射为填充，`border-radius` 应映射为圆角，`table` 应映射为表格语义，PDF/图片外框必须保留为真实图框能力。
- **事务所素材默认原位引用。** 本项目面向事务所内部工作流，公共素材、图纸、PDF、PSD、AI、图片等默认使用主机名 UNC 路径原位引用；不要把 NAS 素材强制复制进 HTML 包，也不要依赖映射盘。只有 PDF 转图片预览、格式转换、降级渲染、缺失/嵌入资源补救等确实需要生成派生文件的场景，才允许写入缓存或导出副本，并必须保留原始来源记录。
- **失败要早于假成功。** 不支持的语义或样式应显式报错、警告或记录审核项；严禁静默丢弃。
- **可验证才算完成。** 翻译规则必须能通过快照、构建指令、静态测试或真实 InDesign 输出验证。

## 3. 真相顺序

| 优先级 | 依据 | 用法 |
| ------ | ---- | ---- |
| 1 | 当前用户指令 | 本轮任务最高优先级 |
| 2 | 当前代码与测试结果 | 判断真实行为 |
| 3 | 本文件 | 项目边界、硬规则、入口导航 |
| 4 | `docs/README.md` 指向的当前文档 | 规范、协议、审核、计划 |
| 5 | 历史资料和旧样例 | 只追溯，不直接当规范 |

冲突处理：

| 冲突类型 | 处理方式 |
| -------- | -------- |
| 文档与代码不一致 | 以代码和可复现实测为准，顺手修正文档 |
| 浏览器效果与 InDesign 输出不一致 | 视为翻译层问题，先定位丢失的语义或样式 |
| HTML 为转换绕路、ID 输出靠补丁凑 | 回到翻译层收口，不接受绕路方案 |
| 旧模板槽位与新语义冲突 | 优先稳定语义，通过映射层兼容槽位 |
| 快速补丁与长期边界冲突 | 优先收口长期边界 |

## 4. 仓库地图

| 路径 | 作用 |
| ---- | ---- |
| `src/adapters/html/` | HTML 适配器：浏览器快照、样式/资源读取、HTML snapshot 到语义模型归一化 |
| `src/writers/indesign/` | InDesign 写出器：语义模型到构建指令、样式编译和 instructions 校验 |
| `src/adapters/indesign/` | InDesign 适配器：反向 snapshot 读取、标签白名单、历史 blueprint 迁移 |
| `src/writers/html/` | HTML 写出器：语义模型到固定语义 HTML、视觉 HTML、作者包和审核报告 |
| `src/semantic-model/` | 统一语义模型层，承接 HTML 与 InDesign 双向事实 |
| `src/protocol/` | 协议字段注册表、能力矩阵和字段生命周期管理 |
| `src/adapters/pptx/` | PPTX 适配器 contract 与能力声明；不得绕过语义模型互转 |
| `src/` 根层旧模块 | blueprint、规范生成、校验、早期 builder |
| `_indesign_scripts/` | InDesign 端执行脚本和共享 JSX 库 |
| `test/fixtures/` | HTML、资源和语义样例 |
| `test/workspace/` | 本地真实测试输出，已忽略 |
| `test/` | Node 测试和执行器静态检查 |
| `docs/` | 当前规范、方案、审核和缺陷记录 |

新增文件应靠近对应职责，不在根目录堆临时脚本、备份文件或一次性测试产物。

## 5. 当前架构边界

零记忆 Agent 进入仓库后，必须先按以下链路理解代码，不得恢复旧目录 facade、旧公共入口或两两格式直连：

```text
HTML -> src/adapters/html -> src/semantic-model -> src/writers/indesign -> InDesign instructions / executor
InDesign snapshot -> src/adapters/indesign -> src/semantic-model -> src/writers/html -> fixed semantic HTML / author package
PPTX -> src/adapters/pptx contracts / capabilities -> src/semantic-model（预留，不做 HTML/InDesign 与 PPTX 直接互转）
```

边界规则：

- `src/adapters/*` 只负责格式读入、快照读取、标签白名单和归一化到统一语义模型；不得直接写出另一个格式的产物。
- `src/writers/*` 只负责从统一语义模型写出目标格式、生成审核报告或执行指令；不得重新解析来源格式或发明未登记字段。
- `src/semantic-model/` 是 HTML、InDesign 和未来 PPTX 的共享事实层；格式独有能力只能放在 format extension，不得污染 canonical 字段。
- `src/protocol/` 是字段、生命周期和格式能力唯一事实源；新增字段必须先登记 registry，再接入 adapter / writer / executor / fixture / tests。
- `_indesign_scripts/` 只执行已验证 instructions 和反向 snapshot 导出；不得塞入 HTML 解析、CSS cascade、语义推理或临时视觉补丁。
- 旧 `src/paged-html/`、旧 `src/indesign-reverse/`、旧 facade、退役字段读取兜底和兼容双路径不得恢复；历史价值只进入观察信息、迁移报告或 `docs/legacy/`。

## 6. 文档入口

先看 `docs/README.md`。

长期规则写入当前规范文档；过程材料进入对应子目录。`AGENTS.md` 只保留项目边界和硬规则，不重复工具手册、执行流程和长篇协议。

## 7. 文档索引

| 路径 | 层级 | 用途 |
| ---- | ---- | ---- |
| `docs/README.md` | 固定文档 | 文档目录总入口，解释 `docs/` 下各目录职责 |
| `docs/规范/` | 固定目录 | 当前长期规范、协议和架构说明 |
| `docs/规范/README.md` | 固定文档 | 规范目录入口 |
| `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` | 固定文档 | 库级目标、架构边界、转换链路和执行器职责 |
| `docs/规范/SEMANTIC_PROTOCOL.md` | 固定文档 | 固定语义 HTML 协议 |
| `docs/规范/LABEL_PROTOCOL.md` | 固定文档 | HTML `data-id-*` 与 InDesign `html_indesign` 标签协议 |
| `docs/规范/PROTOCOL_FIELD_REGISTRY.md` | 生成文档 | 当前协议字段、生命周期和格式能力矩阵，由 `src/protocol/` 生成 |
| `docs/规范/REVERSE_EXPORT.md` | 固定文档 | InDesign 反向导出、观察模式和语义化迁移规范 |
| `docs/规范/FONT_POLICY.md` | 固定文档 | 项目公共字体库、字体 token、字体映射和预检规范 |
| `docs/AI协作/` | 固定目录 | 本地 Agent、外部咨询、用户反馈等协作过程材料 |
| `docs/AI协作/README.md` | 固定文档 | AI 协作目录结构、分类和生命周期 |
| `docs/AI协作/协作规范.md` | 固定文档 | 协作文档命名、流转和禁用事项 |
| `docs/AI协作/本地Agent/` | 过程目录 | 本地 Agent 任务和报告，分 `进行中/` 与 `归档/` |
| `docs/AI协作/外部咨询/` | 过程目录 | 外部 AI、专家或搜索工具的问答材料 |
| `docs/AI协作/用户反馈/` | 过程目录 | 用户反馈，分 `缺陷/`、`改进/`、`计划/` |
| `docs/review/` | 过程目录 | 审核、对照检查、翻译准确性评估；具体报告按日期和主题增长 |
| `docs/bugfix/` | 过程目录 | 复杂缺陷根因、修复过程和回归记录 |
| `docs/superpowers/specs/` | 过程目录 | 方案设计和边界分析，不自动等同长期规范 |
| `docs/superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md` | 过程文档 | 协议字段注册表、多格式能力矩阵和未来 PPTX 适配架构设计 |
| `docs/superpowers/plans/` | 过程目录 | 实施计划、阶段拆分和验证清单 |
| `docs/legacy/` | 追溯目录 | 历史资料，只追溯，不作为当前规范 |

规则：

- 固定文档改名或移动后，必须同步更新本索引和 `docs/README.md`。
- 过程目录新增报告时，不需要逐条写进 `AGENTS.md`；需要在对应目录入口保持命名规则清楚。
- 过程材料形成长期规则后，必须沉淀到 `docs/规范/` 或本文件。

## 8. Agent 协作

默认不启用多 Agent。只有用户明确要求、任务可以独立并行、或需要二次审核时才启用。

| 角色 | 模型 / 工具 | 用途 |
| ---- | ---- | ---- |
| 执行者 | `gpt-5.5` + `xhigh` | 实现、重构、复杂修复、批量验证 |
| 审核者 | `gpt-5.4` + `xhigh` | 方案审核、代码审查、翻译准确性对照、覆盖性检查 |
| 外审补充 | `OpenCode` | 长上下文复核、第三视角审查、主审之外的补充意见 |

硬规则：

- 执行者负责改代码或落地文档，必须写清文件范围、验证命令和不得回退他人改动。
- 审核者优先输出结论、证据、风险和修复建议；除非明确要求，不直接改实现代码。
- `OpenCode` 只作为外审补充，不替代本项目的主判断和可复现实测。
- 本地 Agent 任务和报告放 `docs/AI协作/本地Agent/`。
- `OpenCode` 外审材料优先放 `docs/AI协作/外部咨询/`。
- 审核形成的当前有效结论放 `docs/review/`；长期规则再沉淀到 `docs/规范/` 或本文件。

## 9. 执行基线

| 动作 | 命令 |
| ---- | ---- |
| 安装依赖 | `npm install` |
| 单元测试 | `npm test` |
| 作者源码包组装 | `npm run assemble:authoring -- -- --package <deck.config.json>` |
| 作者源码包一致性检查 | `npm run assemble:authoring -- -- --package <deck.config.json> --check` |
| HTML 作者侧规则检查 | `npm run lint:authoring -- <deck.html>` |
| 初始化项目语义库 | `npm run preset:init -- -- --package <deck.config.json>` |
| 源码回环 diff | `npm run audit:roundtrip -- -- --source <source-author-root> --reverse <reverse-author-root> [--strict]` |
| 反向作者包视觉几何对照 | `npm run audit:reverse-visual -- -- --reverse-html <reverse-html-dir> [--out <report.json>]` |
| 真实 InDesign E2E | `npm run e2e:indesign` |
| 真实 InDesign E2E + 回读 | `npm run e2e:indesign -- -- --reverse-roundtrip` |
| 真实 InDesign E2E + 二次回环 | `npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip` |

### 9.1 作者源码包

Agent 编写多页汇报时，优先编辑作者源码包中的 `pages/*.html` 和 `styles/*.css`。`deck.html` 是组装生成物，仍作为浏览器预览、快照和 HTML-to-InDesign 转换入口。修改源码包后必须重新运行 `npm run assemble:authoring -- -- --package <deck.config.json>`。

Agent 新写或大改分页 HTML 后，应先跑 `npm run lint:authoring -- <deck.html>`。交付前或准备作为规范样例时，用 `npm run lint:authoring -- -- --html <deck.html> --strict`，把网格偏移和语义 token 缺失也当作错误处理。

### 9.2 真实 InDesign 验证

真实 InDesign 验证只在触及执行输出、样式映射、资源置入、导出或用户明确要求时运行。临时产物放 `test/workspace/`，不要把客户文档内容、客户名称或私有资产完整路径写入版本库、长期文档或测试 fixture。用户明确指定的内部 NAS 输出目录可以保留 UNC 原位资源引用，因为这是事务所内部工作产物，不等同于公开仓库样例。

真实 InDesign CLI 当前入口为 `indesign-cli`。如果本机未把该命令加入 `PATH`，用 `INDESIGN_CLI_BIN=<indesign-cli.exe 绝对路径>` 显式指定；不要回退到已退役的 `cli-anything-indesign` 入口。

### 9.3 资源路径策略

事务所内部路径统一优先使用 `\\主机名\共享目录\...` 形式的 UNC 路径，不使用映射盘路径作为协议前提。HTML 作者包和 InDesign 反向导出默认应保留可访问的原位资源路径；需要生成 PDF 预览图、转换格式、修复嵌入/断链资源或制作可移动交付包时，才显式启用复制或缓存策略，并在报告中说明原因和来源路径。

### 9.4 E2E 输出和回环

`npm run e2e:indesign` 默认读取 `test/fixtures/e2e/architecture-report/deck.html`，输出到 `test/workspace/indesign-e2e-<时间戳>/`。它会生成 `instructions.json`，调用真实 InDesign 构建，导出 `INDD`、`PDF`、`IDML`，并尽量生成 PDF 预览 contact sheet。加 `--reverse-roundtrip` 时还会生成 `reverse-snapshot.json`、`reverse-html/deck.visual.html` 和 `reverse-html/author/`。其中 `reverse-html/author/deck.html` 是由反向源码包组装出来的编辑入口，顶层 `reverse-html/deck.html` 仅保留为视觉兼容入口。加 `--second-pass-roundtrip` 时，会把第一次回读出的 `reverse-html/author/deck.html` 再次送入 HTML-to-InDesign，并再次反向回读，用于验证 `HTML -> InDesign -> HTML -> InDesign -> HTML` 的源码包稳定性。

### 9.5 E2E 参数约定

真实 E2E 默认使用 `presentation` 模式：浏览器视觉 CSS px 映射为 InDesign point，页面尺寸默认保持浏览器捕获尺寸。通过 npm 转发参数时需要双 `--`，例如 `npm run e2e:indesign -- -- --target-size qhd` 输出 2560x1440，也可以传 `--target-size 2048x1152`；目标比例必须和 HTML 页面比例一致。用 `npm run e2e:indesign -- -- --html <deck.html>` 可以指定其他固定语义 HTML。建筑汇报 fixture 会默认把稳定样式 token 映射成人类可读中文样式名。

## 10. 当前关注点

| 事项 | 处理原则 |
| ---- | -------- |
| 固定语义协议 | 以 `docs/规范/SEMANTIC_PROTOCOL.md` 为当前说明，行为仍以代码和测试为准 |
| 库级架构 | 以 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 为当前说明，触及时同步修正 |
| 协议字段注册表与多格式扩展 | 已由 `src/protocol/` 注册表集中维护，并生成 `docs/规范/PROTOCOL_FIELD_REGISTRY.md`；新增字段、生命周期或格式能力必须先改 registry，再同步生成文档和测试 |
| 标签协议 | 以 `docs/规范/LABEL_PROTOCOL.md` 为当前说明，前向导出应写入可反向读取的 `html_indesign` 标签 |
| 反向导出 | 以 `docs/规范/REVERSE_EXPORT.md` 为当前说明，先支持带标签结构化回读和未标注观察 HTML |
| HTML 与 InDesign 视觉差异 | 进入 `docs/review/` 或缺陷记录，按可验证问题修 |
| 真实测试输出 | 统一放 `test/workspace/`，不进版本库 |
