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
- 除了从混乱 HTML 中重建语义，Agent 也可以直接观察 InDesign 页面本身，基于版面、文字、图像、样式和对象关系推断每个元素应有的白名单语义标签，再导出结构化 HTML 或回写 InDesign；这是一条允许的语义化路径，可能比修复混乱 HTML 更直接。
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
| `src/semantic-reconstruction/` | 语义重建层：Observed Model 到可编辑作者语义模型的算法脚手架和报告 |
| `src/protocol/` | 协议字段注册表、能力矩阵和字段生命周期管理 |
| `src/adapters/pptx/` | PPTX 适配器 contract 与能力声明；不得绕过语义模型互转 |
| `src/indesign-cli-plugin/` | InDesign CLI 插件适配层：manifest、JSON-RPC 协议入口、正式 `html.*` 工具和 host action 编排；不得直接调用 InDesign COM |
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
InDesign snapshot -> src/adapters/indesign -> src/semantic-model -> src/semantic-reconstruction -> src/writers/html -> fixed semantic HTML / author package
PPTX -> src/adapters/pptx contracts / capabilities -> src/semantic-model（预留，不做 HTML/InDesign 与 PPTX 直接互转）
```

边界规则：

- `src/adapters/*` 只负责格式读入、快照读取、标签白名单和归一化到统一语义模型；不得直接写出另一个格式的产物。
- `src/writers/*` 只负责从统一语义模型写出目标格式、生成审核报告或执行指令；不得重新解析来源格式或发明未登记字段。
- `src/semantic-model/` 是 HTML、InDesign 和未来 PPTX 的共享事实层；格式独有能力只能放在 format extension，不得污染 canonical 字段。
- `src/semantic-reconstruction/` 只处理 InDesign Adapter 输出的中间模型，负责语义重建算法、证据、置信度和 unresolved 报告；不得把导出的 HTML 当事实源，也不得伪造白名单语义。
- `src/protocol/` 是字段、生命周期和格式能力唯一事实源；新增字段必须先登记 registry，再接入 adapter / writer / executor / fixture / tests。
- `src/indesign-cli-plugin/` 只暴露正式使用功能：`html.authoring_lint`、`html.compile_instructions`、`html.build_indesign`、`html.reverse_export`。二轮回环、结构 diff、视觉 diff、P0/P1 门禁和诊断审计属于本仓库内部测试工具，不得进入插件 `tools/list`。需要真实 InDesign 的插件工具必须返回 `script.run` host action，不得在 Node 插件内直接调用 COM、旧 MCP 或旧 CLI。
- `_indesign_scripts/` 只执行已验证 instructions 和反向 snapshot 导出；不得塞入 HTML 解析、CSS cascade、语义推理或临时视觉补丁。
- 旧 `src/paged-html/`、旧 `src/indesign-reverse/`、旧 `historicalTemplate` 公共出口、旧根层 blueprint 模板脚本、退役字段读取兜底和兼容双路径不得恢复；历史价值只进入观察信息、迁移报告或 `docs/legacy/`。

语义重建外部参考项目位于 `D:\AI\参考项目\html-indesign-semantic-reconstruction\`，当前包括 REIP、PdfPig、pdfminer.six 和 Docling。它们只能作为算法和架构参考，不能 vendoring 到本仓库，也不能直接复制大段实现。使用或更新这些参考项目时，必须同步查看 `docs/规范/SEMANTIC_RECONSTRUCTION.md` 的外部参考项目表。

语义重建第一阶段是页面对象图证据层，详见 `docs/规范/SEMANTIC_OBJECT_GRAPH.md`。该阶段不得把 InDesign 文档图层名、图层编号或图层顺序当作语义证据；图层只能作为观察事实或格式可见性事实保留。

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
| `docs/规范/AGENT_HTML_AUTHORING_GUIDE.md` | 固定文档 | Agent 编写固定分页 HTML 作者包的说明书和回读保护要求 |
| `docs/规范/SEMANTIC_PROTOCOL.md` | 固定文档 | 固定语义 HTML 协议 |
| `docs/规范/LABEL_PROTOCOL.md` | 固定文档 | HTML `data-id-*` 与 InDesign `html_indesign` 标签协议 |
| `docs/规范/PROTOCOL_FIELD_REGISTRY.md` | 生成文档 | 当前协议字段、生命周期和格式能力矩阵，由 `src/protocol/` 生成 |
| `docs/规范/REVERSE_EXPORT.md` | 固定文档 | InDesign 反向导出、观察模式和语义化迁移规范 |
| `docs/规范/SEMANTIC_RECONSTRUCTION.md` | 固定文档 | 语义重建层、算法边界、报告和候选算法 |
| `docs/规范/SEMANTIC_OBJECT_GRAPH.md` | 固定文档 | 语义重建第一阶段页面对象图证据层规范 |
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
| 反向结构快照对比 | `npm run audit:reverse-snapshot -- -- --expected <original-reverse-snapshot.json> --actual <roundtrip-reverse-snapshot.json> [--out <report.json>]` |
| 有效 diff 门禁 | `npm run audit:effective-diff -- -- --expected <original-reverse-snapshot.json> --actual <roundtrip-reverse-snapshot.json> [--baseline <effective-diff-report.json>] [--stability-audit <reverse-snapshot-audit.json>] [--out <report.json>]` |
| 规范母版家具指标 | `npm run audit:parent-furniture -- -- --source <original-reverse-snapshot.json> --actual <roundtrip-reverse-snapshot.json> [--second-pass <second-pass-reverse-snapshot.json>] [--out <report.json>]` |
| 反向作者包视觉几何对照 | `npm run audit:reverse-visual -- -- --reverse-html <reverse-html-dir> [--out <report.json>]` |
| 作者包可编辑性指标 | `npm run audit:author-editability -- -- --author-root <reverse-html/author> [--baseline <author-editability-report.json>] [--out <report.json>]` |
| 可信作者结构保护门禁 | `npm run audit:trusted-source-preservation -- -- --expected <before-reconstruction-model.json> --actual <after-reconstruction-model.json> [--out <report.json>]` |
| 转换总门禁 | `npm run audit:conversion-gate -- -- --case <conversion-gate.case.json> [--out <report.json>]` |
| 真实 InDesign E2E | `npm run e2e:indesign` |
| 真实 InDesign E2E + 回读 | `npm run e2e:indesign -- -- --reverse-roundtrip` |
| 真实 InDesign E2E + 二次回环 | `npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip` |
| 插件本地校验 | `npm run plugin:validate` |
| 插件本地安装 | `npm run plugin:install` |
| npm 发布包预检 | `npm run pack:dry-run` |

### 9.1 作者源码包

Agent 编写多页汇报时，先看 `docs/规范/AGENT_HTML_AUTHORING_GUIDE.md`。优先编辑作者源码包中的 `pages/*.html` 和 `styles/*.css`。`deck.html` 是组装生成物，仍作为浏览器预览、快照和 HTML-to-InDesign 转换入口。修改源码包后必须重新运行 `npm run assemble:authoring -- -- --package <deck.config.json>`。

Agent 新写或大改分页 HTML 后，应先跑 `npm run lint:authoring -- <deck.html>`。交付前或准备作为规范样例时，用 `npm run lint:authoring -- -- --html <deck.html> --strict`，把网格偏移和语义 token 缺失也当作错误处理。

### 9.2 真实 InDesign 验证

真实 InDesign 验证只在触及执行输出、样式映射、资源置入、导出或用户明确要求时运行。临时产物放 `test/workspace/`，不要把客户文档内容、客户名称或私有资产完整路径写入版本库、长期文档或测试 fixture。用户明确指定的内部 NAS 输出目录可以保留 UNC 原位资源引用，因为这是事务所内部工作产物，不等同于公开仓库样例。

真实 InDesign CLI 当前入口为 `indesign-cli`。如果本机未把该命令加入 `PATH`，用 `INDESIGN_CLI_BIN=<indesign-cli.exe 绝对路径>` 显式指定；不要回退到已退役的 `cli-anything-indesign` 入口。

### 9.3 资源路径策略

事务所内部路径统一优先使用 `\\主机名\共享目录\...` 形式的 UNC 路径，不使用映射盘路径作为协议前提。HTML 作者包和 InDesign 反向导出默认应保留可访问的原位资源路径；需要生成 PDF 预览图、转换格式、修复嵌入/断链资源或制作可移动交付包时，才显式启用复制或缓存策略，并在报告中说明原因和来源路径。

### 9.4 E2E 输出和回环

`npm run e2e:indesign` 默认读取 `test/fixtures/e2e/architecture-report/deck.html`，输出到 `test/workspace/indesign-e2e-<时间戳>/`。它会生成 `instructions.json`，调用真实 InDesign 构建，导出 `INDD`、`PDF`、`IDML`，并尽量生成 PDF 预览 contact sheet。加 `--reverse-roundtrip` 时还会生成 `reverse-snapshot.json`、`reverse-html/deck.visual.html` 和 `reverse-html/author/`。其中 `reverse-html/author/deck.html` 是由反向源码包组装出来的编辑入口，顶层 `reverse-html/deck.html` 仅保留为视觉兼容入口。

反向作者包审计会在 `reverse-html/author/reports/` 写出 `source-roundtrip-report.json`、`content-inventory-report.json` 和 `structure-signature-report.json`。内容库存是无丢失硬门槛；首轮源码 exact diff 和源作者结构差异只作为辅助 warning，不能替代内容库存判断。加 `--second-pass-roundtrip` 时，会把第一次回读出的 `reverse-html/author/deck.html` 再次送入 HTML-to-InDesign，并再次反向回读，用于验证 `HTML -> InDesign -> HTML -> InDesign -> HTML` 的作者包稳定性；二次回环硬门槛是 `canonical-content-inventory-report.json` 与 `canonical-structure-signature-report.json` 均通过，`canonical-source-drift-report.json` 只记录源码级格式漂移。

`audit:effective-diff` 用于衡量原始人工 InDesign 与规范化生成 InDesign 的有效损失：P0 内容损失必须为 0；P1 版面、对象、矢量、资源置入差异按 baseline 预算不得回退；P2 样式名、图层名、参考线等规范化差异只统计不拦截。二轮和再次回环结构稳定审计应通过 `--stability-audit` 接入，不能用原始 ID 总 diff 清零替代有效损失门禁。

`audit:author-editability` 用于量化反向作者包是否更适合继续编辑，指标包括语义容器覆盖率、顶层散落对象、内联样式、低层图片/PDF/矢量几何字段、矢量 SVG、图文配对和文本元素数量。默认只统计；接入算法升级门禁时，应通过 `--baseline` 或显式预算保证语义容器覆盖率不下降，散落对象、内联样式和低层几何字段不增加。

`audit:trusted-source-preservation` 用于保证语义重建算法不会改写 Agent 作者 HTML 回读得到的可信结构。`labelStatus: "accepted"` 且带 `sourceNode` 的页面或对象，其 `tagName`、`sourceNode`、`sourceAncestorNodes`、`structure` 和既有 `semantic` 在算法前后必须一致；算法只能处理未标注、观察、partial 或 rejected 对象。`reconstructSemanticModel` 会在 `reconstruction-report.json` 写入 `trustedSourcePreservation`，总门禁应通过 `--trusted-source <reconstruction-report.json>` 或独立报告接入。

`audit:conversion-gate` 用于汇总 `audit:effective-diff`、`audit:reverse-visual`、可选 `audit:author-editability` 和 `audit:trusted-source-preservation` 报告，输出单一 pass/fail 和失败原因。算法升级必须先保证 P0/P1、HTML 缺失、HTML 文本差异和可信作者结构不回退；HTML 几何差异和可编辑性指标可以按明确预算逐步收紧，严禁为了过门禁扩大预算或隐藏差异。

### 9.5 E2E 参数约定

真实 E2E 默认使用 `presentation` 模式：浏览器视觉 CSS px 映射为 InDesign point，页面尺寸默认保持浏览器捕获尺寸。通过 npm 转发参数时需要双 `--`，例如 `npm run e2e:indesign -- -- --target-size qhd` 输出 2560x1440，也可以传 `--target-size 2048x1152`；目标比例必须和 HTML 页面比例一致。用 `npm run e2e:indesign -- -- --html <deck.html>` 可以指定其他固定语义 HTML。建筑汇报 fixture 会默认把稳定样式 token 映射成人类可读中文样式名。

### 9.6 npm 插件发布

本项目作为公司内部 npm 插件包发布，包名为 `@sa/html-indesign`。`package.json` 的 `version` 必须和 `src/indesign-cli-plugin/manifest.json` 的 `version` 保持一致；当前 Node 运行时要求以 `package.json` 和 manifest 中的 `>=20.18.1` 为准。`playwright` 是 HTML 快照运行依赖，不得只放在 devDependencies。

发布包必须通过 `files` 白名单控制，只包含运行所需的 `index.js`、`src/`、`scripts/`、正式 `_indesign_scripts` 入口与 `lib/`、`presets/` 和必要规范文档；不得把 `test/`、`test/workspace/`、`.indesign-cli/`、`_indesign_scripts/_debug/`、客户输出或真实项目临时产物打入 npm 包。发布前至少运行 `npm test`、`npm run pack:dry-run`，并用打包后的 `.tgz` 临时安装后执行 `indesign-cli plugin validate <installed-package-root>`。

在 `indesign-cli plugin install` 原生支持 npm 包名之前，公司用户使用全局 npm 包路径安装：

```powershell
npm install -g @sa/html-indesign
$pluginRoot = Join-Path (npm root -g) "@sa/html-indesign"
indesign-cli plugin validate $pluginRoot
indesign-cli plugin install $pluginRoot
```

## 10. 当前关注点

| 事项 | 处理原则 |
| ---- | -------- |
| 固定语义协议 | 以 `docs/规范/SEMANTIC_PROTOCOL.md` 为当前说明，行为仍以代码和测试为准 |
| 库级架构 | 以 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 为当前说明，触及时同步修正 |
| 协议字段注册表与多格式扩展 | 已由 `src/protocol/` 注册表集中维护，并生成 `docs/规范/PROTOCOL_FIELD_REGISTRY.md`；新增字段、生命周期或格式能力必须先改 registry，再同步生成文档和测试 |
| 标签协议 | 以 `docs/规范/LABEL_PROTOCOL.md` 为当前说明，前向导出应写入可反向读取的 `html_indesign` 标签 |
| 反向导出 | 以 `docs/规范/REVERSE_EXPORT.md` 为当前说明，先支持带标签结构化回读和未标注观察 HTML |
| 语义重建 | 以 `docs/规范/SEMANTIC_RECONSTRUCTION.md` 为当前说明；当前 `src/semantic-reconstruction/` 只提供脚手架、unresolved 统计和报告，后续算法必须逐个可测接入 |
| 页面对象图 | 以 `docs/规范/SEMANTIC_OBJECT_GRAPH.md` 为当前说明；不得把 InDesign 文档图层作为语义证据 |
| HTML 与 InDesign 视觉差异 | 进入 `docs/review/` 或缺陷记录，按可验证问题修 |
| 真实测试输出 | 统一放 `test/workspace/`，不进版本库 |
