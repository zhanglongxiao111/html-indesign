# 语义重建算法路线图（InDesign → HTML）

- 日期：2026-07-06
- 状态：提案（未实施）
- 类型：方案设计（过程文档，不自动等同长期规范；算法逐条落地后按规则沉淀进 `docs/规范/SEMANTIC_RECONSTRUCTION.md` §4/§2.5）
- 关联：`docs/规范/SEMANTIC_RECONSTRUCTION.md`、`docs/规范/SEMANTIC_OBJECT_GRAPH.md`、`docs/superpowers/specs/2026-07-06-agent-editability-benchmark-design.md`（基准是本路线图的目标函数）、`docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md`

## 1. 问题定性

InDesign 反向语义重建**不是视觉识别问题**。输入是 InDesign 快照：文本框带真实文本与样式摘要、表格是真表格、坐标精确、资源置入参数完整。这与 PDF/OCR 重建（从字形和线条起步）有本质差别，因此：

- **核心必须是确定性的几何 + 排版证据算法**：可单测、可回归、可被可编辑性基准和 effective-diff 门禁度量。这与既有规范"确定性启发式评分，不接入机器学习模型"（SEMANTIC_OBJECT_GRAPH §8）一致。
- **LLM 只放在模糊残余的裁决位**（§4 R8）：算法产出带证据的候选，Agent 只做接受/拒绝，裁决沉淀进项目语义库摊销。LLM 不做主分割器、不整页猜结构。
- **优先榨干 InDesign 原生结构事实**——这些是 PDF 世界没有的免费强证据：

| 原生事实 | 语义价值 |
| ---- | ---- |
| 串接文本框（threaded frames） | 串接顺序 = 阅读顺序的确定事实，R7 直接消费 |
| 真表格对象 | 表格语义免费，无需重建 |
| 段落/字符样式引用 | 样式即角色的最强线索，R1 的输入 |
| 母版来源（master item） | 页面家具的确定证据，强于跨页统计 |
| 锚定对象（anchored object） | 图文归属的确定事实 |
| 文本绕排关系 | 图文空间关联证据 |

证据优先级阶梯（裁决器合并证据时的固定顺序）：

```text
可信作者标签（labelStatus accepted）
> 原生结构事实（串接 / 真表格 / 锚定 / 母版来源）
> 项目语义库已确认规则（preset，来自历史裁决）
> 强几何证据（containment / 点阵 / 网格吸附）
> 文档级统计（字号直方图、跨页重复）
> 位置先验（页首、页脚惯例）
```

InDesign 文档图层名/序继续按 SEMANTIC_OBJECT_GRAPH §2 排除在证据之外，只进 `observedFacts`。

## 2. 设计原则

1. **给样式分类，不给对象分类。** 文本角色判断在合成样式 token 层做一次，经引用覆盖全部对象，天然全文档一致。绝不写"对每个文本框跑一遍角色判断"的算法。
2. **跨页证据强于单页证据。** 汇报册是模板化的：先页面类型聚类，再在类型内重建；同类页面上重复确认的规则置信度随重复次数上升。
3. **网格先行。** 页面网格是作者契约（AGENTS.md 硬规则），反向必须先恢复网格；网格确立后，分组、排序、容器落点全部吸附网格，直接改善基准的可定位性与 diff 局部性。
4. **相对统计，不用绝对阈值。** 所有排版判断基于文档自身分布（字号直方图、行高倍数、页面尺寸归一化），阈值必须命名并可测（延续 SEMANTIC_OBJECT_GRAPH §8）。
5. **每条算法一个独立 pass。** 禁止超大识别器（既有硬规则）；每个 pass 遵守现有报告形状（name/version/status/summary/skipped）、trusted-source 保护和"不满足规则进 skipped 不得兜底硬包"的纪律。
6. **基准驱动。** 每条算法立项时必须声明它改善可编辑性基准的哪些任务/指标；验收以基准与审计指标不回退、目标指标改善为准。

## 3. 算法路线

编号 R1–R9。每条含：目标 / 方法 / 证据与输出 / 写回边界 / 验收。已落地的 `page-object-graph`、`caption-structure`、`figure-grid`、`text-block` 不在此重复，R 系列全部消费对象图证据。

### R1 文本角色分类（token 层）`text-role-classification`

- **目标**：给每个合成文本样式 token 产出角色候选（title / subtitle / body / caption / annotation / page-number），带置信度与证据，供 R8 生成白名单语义候选。**本 pass 不改模型**，纯证据输出。
- **方法**：文档级统计——每个 token 的：总文本量、实例数、每页实例数、字号在全文档字号分布中的分位、实例位置分布（normalizedBounds.y 的均值/方差）、平均行数、平均文本长度。规则（全部相对判断）：
  - body：总文本量最大的字号簇；
  - title：字号 > body × `titleSizeRatio`（初始 1.3）、每页实例 ≤ `titleMaxPerPage`（初始 2）、位置上三分位加分；
  - caption：字号 ≤ body、短文本（沿用 caption 80 字约定）、实例与 graphic 节点的 `caption-candidate`/`proximity` 边命中率加分；
  - annotation：最小字号簇、稀疏分布；
  - page-number：命中 R5 家具位置 + 短数字模式文本。
- **证据与输出**：pass 报告中每 token 一条候选：`{ token, role, score, evidence: {sizePercentile, volumeShare, positionStats, edgeHitRate} }`。
- **写回边界**：不写 `items[].semantic`、不写 tagName；R8 之前任何 pass 不得据此改模型。
- **验收**：合成模型单测（构造三种字号分布，断言角色分派）；负例测试（图层名为"标题"不得加分——沿用既有测试要求）；指标：获得 score ≥ 阈值角色候选的文本对象占比；基准关联：T01/T02/T08 的可定位性。

### R2 页面网格推断 `grid-inference`

- **目标**：每页（R5 之后升级为每页面类型）推断栏格模型：栏数、栏边线、栏间距；baseline 网格列为 v2。
- **方法**：页级对象左右边缘投影到 X 轴做**坐标投票**（按对象面积加权），峰值聚类（容差沿用 `alignmentTolerance`）；对峰值集合做等差拟合（穷举栏数 k 与栏宽/gutter，最小化残差）；要求吸附覆盖率 ≥ `gridCoverageRatio`（初始 0.7）才产出网格候选。跨页强化：同类型页面网格一致时置信度上调。
- **证据与输出**：`{ pageId, columns, columnEdges, gutter, coverage, score }`。
- **写回边界**：v1 纯证据（供 R4/R6/R7 消费）。向作者包写网格声明（`data-id-layout` 族字段）属于独立后续 pass，且必须先确认字段已在 `src/protocol/` 登记、置信度达标或经 R8 裁决；对象图阶段"不创建 data-id-layout"的边界继续有效。
- **验收**：三栏/四栏合成 fixture 断言栏数与 gutter；architecture-report fixture 已知网格回归；指标：吸附覆盖率；基准关联：全部任务的 diff 局部性、T05。

### R3 宏观分区 `macro-region-segmentation`

- **目标**：把整页切成大区块树（头区/主区/侧栏/脚区级别的几何区域，不带语义命名），给 R7 提供排序骨架、给 R4/R6 提供分组约束。
- **方法**：递归 XY 切割（RXYC）——在对象投影的空白谷上交替横竖切分；空白谷宽度阈值用页面尺寸归一化命名容差。备选：Breuel 空白矩形法（PdfPig 有两者实现可参考）。
- **证据与输出**：区域树，每区域列成员节点 id、bounds、切割证据（谷位置与宽度）。
- **写回边界**：纯证据，不写回。
- **验收**：上下分区、左右分栏、嵌套区块三类合成 fixture；退化情形（满版单图）必须输出单区域而非报错。

### R4 排版感知几何分组 `gestalt-grouping`

- **目标**：把"背景框 + 图 + 标题 + 说明文字"这类视觉卡片单元聚成候选组（对象图 §10 第 5 步的落地），供 R6 挖掘重复组件。
- **方法**：DocStrum 思路的最近邻聚类，但距离函数排版感知：垂直间距按文本行高倍数度量（`textFacts` 提供行高摘要）、`alignment` 边加分、`same-style` 边加分、`containment` 边直接归组、跨 R3 区域边界罚分。
- **证据与输出**：候选组列表，每组含成员、内部结构签名（成员 sourceType 序列 + 相对位置摘要）、聚合分数。
- **写回边界**：v1 纯证据。通用容器写回（`section.content-grid` 等）由 R6 按 figure-grid 同款纪律执行。
- **验收**：卡片单元 fixture（背景+图+两行字 ×3）断言聚为 3 组；跨区域对象不得并组；trusted 对象不参与。

### R5 跨页重复与页面类型聚类 `cross-page-repetition` / `page-type-clustering`

- **目标**：(a) 把跨页位置稳定的对象识别为页面家具候选（页码/页眉页脚/装饰），走既有 parentPages 提升路径；(b) 把布局签名相近的页面聚成匿名页面类型（type-A/B/C，不命名"封面/材料页"——命名是 R8 的事）。
- **方法**：家具——normalizedBounds + 样式 token + 文本模式（如递增数字）在 ≥ `furnitureMinPages`（初始 3）页面重复即候选；母版来源原生事实直接确定。页面类型——布局签名向量（各 sourceType 对象数、4×4 粗网格占用图、主图面积占比、文本量）凝聚聚类。
- **证据与输出**：家具候选（含跨页命中列表）；页面类型分组（含类内布局方差）。
- **写回边界**：家具经确认走 `parentPages[]`（`audit:parent-furniture` 的 promotionRate 已是现成量化门禁）；页面类型 v1 纯证据。
- **验收**：多页 fixture 断言页码/页眉进家具候选、正文不进；页面类型聚类在 architecture-report fixture 上把封面与内容页分开；指标：promotionRate 不回退。

### R6 重复结构挖掘 / 组件候选 `component-mining`

- **目标**：从 R4 候选组中找同构重复（同尺寸 ± 容差、同内部结构签名、规则行列点阵），产出组件候选：卡片阵、指标卡组、时间轴（沿轴的 sequence 边 + 连接线）、对比板。泛化已落地的 figure-grid。
- **方法**：点阵检测——组质心坐标在 X/Y 轴上的等差拟合；结构签名一致性校验；时间轴附加"沿轴 line/connector 对象"证据。
- **证据与输出**：组件候选（种类、成员组、点阵参数、分数）。
- **写回边界**：只写通用容器（`section.content-grid` 及既有容器词表），纪律与 figure-grid 完全一致：最少成员数、尺寸相近容差、skipped 记录、trusted 保护；**不写白名单组件语义**（那是 R8 的候选）。
- **验收**：指标卡 ×4、时间轴、对比板三类 fixture；不足最少成员数进 skipped；基准关联：T05/T06。

### R7 阅读顺序 `reading-order`

- **目标**：产出页内 DOM 顺序（`structure.order`），让导出 HTML 的源码顺序符合人的阅读预期。
- **方法**：按确定性从高到低叠加——串接文本框内部顺序（原生事实，直接固定）；R3 区域树先序；区域内按 R2 网格单元行优先；剩余对象用"上方/左侧"空间关系拓扑排序（PdfPig `UnsupervisedReadingOrderDetector`、Docling reading order 为参考）；背景/装饰（containment + z-order 底层大面积对象）排最前。
- **写回边界**：只重排页级非 trusted 对象的 `structure.order`；页面存在 trusted 结构时保持 trusted 项相对顺序不动（顺序也是 `structure` 的一部分，受 trusted-source-preservation 门禁保护）；不改 parentId、不改语义。
- **验收**：双栏页 fixture 断言先左栏后右栏；串接文本框顺序不被几何排序推翻；`audit:trusted-source-preservation` 通过；基准关联：导出源码可读性、编辑定位速度。

### R8 语义候选生成与裁决 `semantic-candidates` + `adjudication`

- **目标**：把 R1 角色、R5 页面类型与家具、R6 组件、资源角色启发（格式/路径/裁切比例/页面上下文，即候选表"资源角色分类"）合并为**白名单语义候选**，附完整证据链与置信度；高置信自动接受，其余进裁决队列。
- **裁决设计（LLM 的唯一位置）**：
  - 算法产出候选："对象 X 疑似 `caption`，score 0.62，证据：距图 4pt、左对齐、字号 P20 分位"；
  - Agent（可多模态看页面预览图）只回答接受/拒绝/改判，不自由发挥新语义（白名单约束）；
  - **裁决结果写入项目语义库（semantic preset）**成为持久规则（如 "token synth_text_003 → caption"），下次运行时按 §1 阶梯以 preset 优先级直接生效——人与 Agent 的判断被跨页、跨文档摊销，且重跑结果确定（LLM 不在重放路径上）。
- **写回边界**：只有"自动接受阈值以上"或"已裁决接受"的候选写 `items[].semantic` / `pages[].semantic`；其余保持 unresolved。自动接受阈值按项目 preset 配置，默认保守（初始 0.9）。
- **验收**：候选生成的确定性单测；裁决持久化到 preset 后重跑免裁决的回归测试；`audit:trusted-source-preservation` 与内容库存门禁全过；基准关联：全部任务的可定位性（语义命名是 Agent 找编辑点的最强信号）。

### R9 假表格重建 `ruled-table-reconstruction`（低优先级）

- **目标**：把"线段画格 + 散文本框"的伪表格重建为表格语义。真 InDesign 表格已原生覆盖，本条只处理少数手画情形。
- **方法**：线段构建格网图（交点/闭合胞元），文本框按 bounds 归格；胞元覆盖率与文本归格率双阈值，不达标整体放弃进 unresolved。
- **写回边界**：达标才写 table 结构；绝不把"差不多像表格"的东西硬写成表格。
- **验收**：手画三行表 fixture；打散线段不足闭合时必须放弃；基准关联：T04 边缘情形。

## 4. 实施阶段

| 阶段 | 内容 | 理由 |
| ---- | ---- | ---- |
| A | R1 + R2 | 工作量最小、覆盖面最大、纯统计易测；直接改善基准可定位性与 diff 局部性 |
| B | R3 + R7 | R7 依赖 R2/R3；阅读顺序改善所有导出的源码自然度 |
| C | R5 | 跨页证据反哺 R1/R2 置信度；家具已有 audit 指标护航 |
| D | R4 + R6 | 结构编辑类基准任务（T05/T06）的主要改善来源 |
| E | R8 | 依赖 A–D 的证据积累；裁决与 preset 摊销机制在此闭环 |
| F | R9 | 按真实文档中伪表格出现频率决定是否做 |

每阶段收口条件：新 pass 单测全绿；`npm test` 全绿；可编辑性基准成功率与 diff 局部性不回退（目标改善项达成）；`audit:conversion-gate` 通过；触及回环行为时真实 InDesign E2E 回归一次。

## 5. 与现有机制的咬合

- **报告与 skipped 纪律**：每个 R-pass 输出格式沿用 SEMANTIC_RECONSTRUCTION §3；不满足规则的候选必须进 `skipped`，禁止兜底硬包。
- **trusted-source 保护**：所有写回类 pass（R6/R7/R8 及 R2 的网格声明子步）不得触碰 `labelStatus: "accepted"` 结构，违例由 `audit:trusted-source-preservation` 拦截。
- **阈值纪律**：本文出现的 `titleSizeRatio`、`gridCoverageRatio`、`furnitureMinPages` 等均为命名阈值初始值，按 SEMANTIC_OBJECT_GRAPH §8 的规则测试固定、调整需回归用例。
- **协议纪律**：任何新字段（网格声明、组件容器类名扩充、preset 规则字段）先登记 `src/protocol/`，再接入 pass 与 writer——受架构加固 G2 护栏约束。
- **图层禁令**：所有 R-pass 继承"文档图层不作证据"规则与其负例测试。
- **参考项目**：使用 REIP/PdfPig/pdfminer.six/Docling 时同步核对 SEMANTIC_RECONSTRUCTION §6 外部参考项目表；只借思路，不 vendoring。

## 6. 开放问题

| 问题 | 当前立场 |
| ---- | ---- |
| 网格声明写回作者包的时机 | 保守：R2 证据成熟 + R8 裁决通道建立后再开写回，避免错误网格污染作者契约 |
| 页面类型的白名单命名词表 | 由 R8 阶段与 `SEMANTIC_PROTOCOL.md` 词表对齐后定，聚类阶段保持匿名 |
| 裁决队列的交互形态 | v1 用报告文件 + Agent 批处理回答；是否做成 CLI 交互流程视使用频率再定 |
| 多文档 preset 规则冲突 | preset 规则带来源文档与命中统计，冲突时低置信规则降级观察，不静默覆盖 |
