# 语义重建算法路线图（InDesign → HTML）

- 日期：2026-07-06（2026-07-11 第二次修订：实施准入收口）
- 状态：修订提案（阶段 0 边界已收口，尚未实施；阶段 A–F 按前置任务逐阶段解锁）
- 类型：方案设计（过程文档，不自动等同长期规范；算法逐条落地后按规则沉淀进 `docs/规范/SEMANTIC_RECONSTRUCTION.md` §4/§2.5）
- 关联：`docs/规范/SEMANTIC_RECONSTRUCTION.md`、`docs/规范/SEMANTIC_OBJECT_GRAPH.md`、`docs/superpowers/plans/2026-07-11-semantic-reconstruction-stage0-implementation-plan.md`（0A–0F 轻量实施计划）、`docs/superpowers/specs/2026-07-06-agent-editability-benchmark-design.md`（基准是目标层验收，尚未实施，见 §4）、`docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md`

2026-07-11 修订依据：人类文件门禁（47 页真实汇报文档 `--indd` 一键回环）首次全绿后，对反向作者包的实测校准。主要变更：

- 新增阶段 0：把已落地算法接入真实链路 + 写出层收口（§4）。
- 新增硬约束：写回类算法必须确定性且幂等，人类文件门禁在重建开启状态下保持全绿（§2 原则 7、§5）。
- 验收改为双层：当前用静态审计 + 门禁，编辑任务基准落地后切换（§4）。
- 标注原生事实的采集通道缺口：串接、锚定、绕排当前无快照通道（§1）。
- 图层禁令推广为人类命名禁令，证据阶梯同步修正（§1）。
- R1/R8 增加实例级样式挪用检测（§2 原则 1、R1）。
- R6 组件词表按建筑汇报领域扩充（R6）。

2026-07-11 第二次修订依据：对“是否可直接进入实施”的方案与代码对照复核。结论是方向成立，但阶段 0 不能直接把现有 pass 默认打开，必须先修安全性、幂等、入口契约和写出层级联。主要变更：

- 阶段 0 拆成 0A–0F，先冻结基线，再依次收口 trusted-source、幂等、算法 profile、写出层去重和真实门禁。
- 明确 `safe / experimental / none` 三种重建 profile；底层 pipeline 不猜默认，所有调用方显式传 profile。
- 明确五个阶段 0 pass 的唯一顺序与依赖，禁止 `figure-grid` / `text-block` 隐式改全页阅读顺序。
- 修正 R2 网格字段：主网格写 `pages[].grid` 及 `data-id-grid` / gutter / margin / baseline，不再误用 `data-id-layout`。
- 增加 A0、B0、D0、E0 前置任务：补齐文字证据、原生结构采集与裁决规则 schema，再进入对应算法。
- 编辑任务基准改为 Phase 2 形成基线后才切换主判据，Phase 3 接入棘轮后才作为阶段收口硬门槛。
- 二次回环的 canonical 作者包源码零漂移与当前代码、AGENTS 统一为硬门槛。

## 1. 问题定性

InDesign 反向语义重建**不是视觉识别问题**。输入是 InDesign 快照：文本框带真实文本与样式摘要、表格是真表格、坐标精确、资源置入参数完整。这与 PDF/OCR 重建（从字形和线条起步）有本质差别，因此：

- **核心必须是确定性的几何 + 排版证据算法**：可单测、可回归、可被可编辑性基准和 effective-diff 门禁度量。这与既有规范"确定性启发式评分，不接入机器学习模型"（SEMANTIC_OBJECT_GRAPH §8）一致。
- **LLM 只放在模糊残余的裁决位**（§4 R8）：算法产出带证据的候选，Agent 只做接受/拒绝，裁决沉淀进项目语义库摊销。LLM 不做主分割器、不整页猜结构。
- **优先榨干 InDesign 原生结构事实**——这些是 PDF 世界没有的免费强证据。但"免费"以采集通道存在为前提，2026-07-11 对真实文档反向快照逐字段核查的通道现状如下，缺口必须先补齐再消费：

| 原生事实 | 语义价值 | 采集通道现状（2026-07-11 实测） |
| ---- | ---- | ---- |
| 串接文本框（threaded frames） | 串接顺序 = 阅读顺序的确定事实，R7 的加分证据 | **未采集**：快照无字段；接入前先扩展反向快照并登记 `src/protocol/` |
| 真表格对象 | 表格语义免费，无需重建 | 已采集（`table` 字段） |
| 段落/字符样式引用 | 只证明格式同源，不证明角色；作分组旁证并入文档级统计，R1 主输入是合成样式 token（有效格式） | 已采集 |
| 母版来源（master item） | 页面家具的确定证据，强于跨页统计 | 已采集，已走 parentPages 提升路径 |
| 锚定对象（anchored object） | 图文归属的确定事实 | **未采集**：同串接，先补通道再消费 |
| 文本绕排关系 | 图文空间关联证据 | **未采集**：同上 |

证据优先级阶梯（裁决器合并证据时的固定顺序）：

```text
可信作者标签（labelStatus accepted）
> 原生结构事实（串接 / 真表格 / 锚定 / 母版来源）
> 项目语义库已确认规则（preset，来自历史裁决）
> 强几何证据（containment / 点阵 / 网格吸附）
> 文档级统计（字号直方图、跨页重复）
> 位置先验（页首、页脚惯例）
```

声明式样式引用不单列层级：它只能作为"同格式分组"的旁证并入文档级统计，权重不得高于有效格式（合成 token）本身。

**人类命名禁令（图层禁令的推广）。** 多人协作的真实文档里，人类命名一律不可靠：样式可能只因"字号合适"就被挪用到无关角色，图层名、样式名反映的是"当时谁顺手用了什么"，不是对象的语义角色。InDesign 文档图层名/序继续按 SEMANTIC_OBJECT_GRAPH §2 排除在证据之外，只进 `observedFacts`；段落/字符/对象样式名、复合字体名等一切人类命名同样只作观察信息与显示名，不参与角色判断，任何算法不得因"名字看起来对"提升置信度。唯一可信层级是标签协议结构（`labelStatus: accepted`，即本项目模板/生成链路填充的结构），对应证据阶梯第一级。

## 2. 设计原则

1. **给样式分类，不给对象分类；token 角色只是先验。** 文本角色判断在合成样式 token 层做一次，经引用覆盖全部对象，天然全文档一致。绝不写"对每个文本框跑一遍角色判断"的算法。但单个实例显著偏离所属 token 的统计画像时（如标题格式出现在正文位置、单页实例数异常），该实例不得自动继承角色，必须进 unresolved / R8 裁决——这是对真实文档"样式挪用"的防线，不是给逐对象分类开口子。
2. **跨页证据强于单页证据，但允许分两轮收敛。** 阶段 A 先用全文档统计完成 R1/R2 初判；阶段 C 完成页面类型聚类后，必须按同一确定性规则重跑 R1/R2，并用类型内证据更新置信度。R5 之前不得把“页面类型未知”伪装成高置信结论。
3. **网格先行。** 页面网格是作者契约（AGENTS.md 硬规则），反向必须先恢复网格；网格确立后，分组、排序、容器落点全部吸附网格，直接改善基准的可定位性与 diff 局部性。
4. **相对统计，不用绝对阈值。** 所有排版判断基于文档自身分布（字号直方图、行高倍数、页面尺寸归一化），阈值必须命名并可测（延续 SEMANTIC_OBJECT_GRAPH §8）。
5. **每条算法一个独立 pass。** 禁止超大识别器（既有硬规则）；每个 pass 遵守现有报告形状（name/version/status/summary/skipped）、trusted-source 保护和"不满足规则进 skipped 不得兜底硬包"的纪律。
6. **基准驱动。** 每条算法立项时必须声明它服务哪些编辑任务。纯证据 pass 以候选准确性、覆盖率和可解释性改善为直接目标，编辑任务基准只要求不回退；写回 pass 必须让对应编辑任务成功率或 diff 局部性实际改善。基准未落地前按 §4 的阶段 0 验收执行。
7. **确定性与幂等是硬约束。** 人类文件门禁的二次回环要求作者包源码零漂移：任何写回类 pass 对同一输入必须产出逐字节一致的结果，对自身输出再跑一遍不得产生新改动。不满足即不得接入回环链路——这是门禁闭合后新增的前置条件，先于任何算法收益讨论。
8. **trusted-source 必须 fail-closed。** 任何 pass 只要改动 `labelStatus: "accepted"` 且带 `sourceNode` 的既有结构，整个反向导出必须失败；不能只在报告中写 `ok: false` 后继续返回成功。阅读顺序、容器分组和样式去重都必须遵守此规则。
9. **算法 profile 是唯一入口契约。** pass 名称、依赖、去重、执行顺序和默认启用范围只能在语义重建层集中定义；CLI、E2E、插件不得各自复制列表或自行排序。

## 3. 算法路线

编号 R1–R9。每条含：目标 / 方法 / 证据与输出 / 写回边界 / 验收。已落地的 `page-object-graph`、`caption-structure`、`figure-grid`、`text-block` 不在此重复展开。当前只有独立 snapshot CLI 支持显式 `--reconstruct`；底层默认算法表仍为空，真实 `--indd` 与插件链路没有 algorithms 通道，2026-07-11 全绿轮实测 `reconstruction-report.json` 为 `observed-only`、540/540 unresolved。

现有 pass 也不能原样默认开启：实测 `caption-structure` 对自身输出重跑会再次增加同一图注的 `structure.order`；`figure-grid` / `text-block` 会通过共享 helper 隐式改写未参与分组的页级顺序；现有 `reading-order.js` 既不保护 trusted-source，也不是稳定的二维比较器。这些都是阶段 0 的前置修复，不得把“接线”理解为只改默认开关。R 系列全部消费对象图证据。

### R1 文本角色分类（token 层）`text-role-classification`

- **前置**：A0 必须先把对象图 `textFacts.fontSize` 统一映射自反向模型的 `textStyle.pointSize`，并新增 `textFacts.leading`；真实 snapshot 上两者不得因字段名不一致变成 `null`。R1 候选阈值命名为 `textRoleCandidateScore`（初始 0.75）；实例位置偏离阈值命名为 `textRoleOutlierPositionDistance`（归一化页高初始 0.15）；单页数量偏离阈值命名为 `textRoleOutlierPageCountMultiplier`（初始 2，且最少 3 个实例才触发）。
- **目标**：给每个合成文本样式 token 产出角色候选（title / subtitle / body / caption / annotation / page-number），带置信度与证据，供 R8 生成白名单语义候选。**本 pass 不改模型**，纯证据输出。
- **方法**：文档级统计——每个 token 的：总文本量、实例数、每页实例数、字号在全文档字号分布中的分位、实例位置分布（normalizedBounds.y 的均值/方差）、平均行数、平均文本长度。规则（全部相对判断）：
  - body：总文本量最大的字号簇；
  - title：字号 > body × `titleSizeRatio`（初始 1.3）、每页实例 ≤ `titleMaxPerPage`（初始 2）、位置上三分位加分；
  - caption：字号 ≤ body、短文本（沿用 caption 80 字约定）、实例与 graphic 节点的 `caption-candidate`/`proximity` 边命中率加分；
  - annotation：最小字号簇、稀疏分布；
  - page-number：命中 R5 家具位置 + 短数字模式文本；R5 完成前只允许输出 `pending-evidence`，不得自动达到候选阈值，阶段 C 后重跑再决定。
  - 人类命名禁令适用：样式名、图层名不参与任何规则与加分；声明式样式引用只作同格式分组旁证，不改变角色得分。
- **证据与输出**：pass 报告中每 token 一条候选：`{ token, role, score, evidence: {sizePercentile, volumeShare, positionStats, edgeHitRate} }`；同时输出实例级偏离清单 `instanceOutliers`（偏离所属 token 画像的对象及偏离维度），供 R8 按实例送裁决而非继承 token 角色。
- **写回边界**：不写 `items[].semantic`、不写 tagName；R8 之前任何 pass 不得据此改模型。
- **验收**：合成模型单测（构造三种字号分布，断言角色分派）；负例测试（图层名或段落样式名为"标题"不得加分——人类命名禁令）；实例挪用单测（标题 token 的实例出现在正文位置时进 instanceOutliers，不直接标 title）；指标：获得 score ≥ 阈值角色候选的文本对象占比；基准关联：T01/T02/T08 的可定位性。

### R2 页面网格推断 `grid-inference`

- **目标**：每页（R5 之后升级为每页面类型）推断栏格模型：栏数、栏边线、栏间距；baseline 网格列为 v2。
- **方法**：页级对象左右边缘投影到 X 轴做**坐标投票**（按对象面积加权），峰值聚类（容差沿用 `alignmentTolerance`）；对峰值集合做等差拟合（穷举栏数 k 与栏宽/gutter，最小化残差）；要求吸附覆盖率 ≥ `gridCoverageRatio`（初始 0.7）才产出网格候选。跨页强化：同类型页面网格一致时置信度上调。
- **证据与输出**：`{ pageId, columns, columnEdges, gutter, coverage, score }`。
- **写回边界**：v1 纯证据（供 R4/R6/R7 消费）。`columnEdges` 和拟合残差只留在证据报告；确认后的栏数、行数、gutter、margin、baseline 分别写入既有 canonical `pages[].grid` / `pages[].margins`，并由 HTML writer 映射为 `data-id-grid`、`data-id-column-gutter`、`data-id-row-gutter`、`data-id-margin`、`data-id-baseline`。`data-id-layout` 只表示“左文右图/图片矩阵”等页面结构模板，不承载主网格。网格写回必须独立成 pass，达到自动接受阈值或经 R8 裁决后才启用；对象图阶段仍不得创建任何作者契约字段。
- **验收**：三栏/四栏合成 fixture 断言栏数与 gutter；architecture-report fixture 已知网格回归；指标：吸附覆盖率；基准关联：全部任务的 diff 局部性、T05。

### R3 宏观分区 `macro-region-segmentation`

- **目标**：把整页切成大区块树（头区/主区/侧栏/脚区级别的几何区域，不带语义命名），给 R7 提供排序骨架、给 R4/R6 提供分组约束。
- **方法**：递归 XY 切割（RXYC）——在对象投影的空白谷上交替横竖切分；空白谷宽度阈值用页面尺寸归一化命名容差。备选：Breuel 空白矩形法（PdfPig 有两者实现可参考）。
- **证据与输出**：区域树，每区域列成员节点 id、bounds、切割证据（谷位置与宽度）。
- **写回边界**：纯证据，不写回。
- **验收**：上下分区、左右分栏、嵌套区块三类合成 fixture；退化情形（满版单图）必须输出单区域而非报错。

### R4 排版感知几何分组 `gestalt-grouping`

- **目标**：把"背景框 + 图 + 标题 + 说明文字"这类视觉卡片单元聚成候选组（对象图 §10 第 5 步的落地），供 R6 挖掘重复组件。
- **方法**：DocStrum 思路的最近邻聚类，但距离函数排版感知：垂直间距按文本行高倍数度量（`textFacts` 提供行高摘要）、`alignment` 边加分、`same-style` 边加分、`containment` 边直接归组、跨 R3 区域边界罚分；D0 贯通后，锚定关系作为直接归属证据，文本绕排作为图文邻接加分证据。
- **证据与输出**：候选组列表，每组含成员、内部结构签名（成员 sourceType 序列 + 相对位置摘要）、聚合分数。
- **写回边界**：v1 纯证据。通用容器写回（`section.content-grid` 等）由 R6 按 figure-grid 同款纪律执行。
- **验收**：卡片单元 fixture（背景+图+两行字 ×3）断言聚为 3 组；跨区域对象不得并组；trusted 对象不参与。

### R5 跨页重复与页面类型聚类 `cross-page-repetition` / `page-type-clustering`

- **目标**：(a) 把跨页位置稳定的对象识别为页面家具候选（页码/页眉页脚/装饰），走既有 parentPages 提升路径；(b) 把布局签名相近的页面聚成匿名页面类型（type-A/B/C，不命名"封面/材料页"——命名是 R8 的事）。
- **方法**：家具——normalizedBounds + 样式 token + 文本模式（如递增数字）在 ≥ `furnitureMinPages`（初始 3）页面重复即候选；母版来源原生事实直接确定。页面类型——布局签名向量（各 sourceType 对象数、4×4 粗网格占用图、主图面积占比、文本量）凝聚聚类。真实文档实测中家具基本已由母版原生事实经 parentPages 路径覆盖，跨页统计主要捕获"人肉复制未进母版"的对象；R5 的主要增量在页面类型聚类。
- **证据与输出**：家具候选（含跨页命中列表）；页面类型分组（含类内布局方差）。
- **写回边界**：家具经确认走 `parentPages[]`（`audit:parent-furniture` 的 promotionRate 已是现成量化门禁）；页面类型 v1 纯证据。
- **验收**：多页 fixture 断言页码/页眉进家具候选、正文不进；页面类型聚类在 architecture-report fixture 上把封面与内容页分开；指标：promotionRate 不回退。

### R6 重复结构挖掘 / 组件候选 `component-mining`

- **目标**：从 R4 候选组中找同构重复（同尺寸 ± 容差、同内部结构签名、规则行列点阵），产出组件候选：卡片阵、指标卡组、时间轴（沿轴的 sequence 边 + 连接线）、对比板；以及建筑汇报领域的高频组件——尺寸标注组（标注线/箭头 + 短数字文本沿轴成列）、轴网标注、图例块。真实文档图解页单页可达约 90 个对象且大半属此类，不聚组则可编辑性无实质改善。词表可经项目语义库扩展（新容器类名先登记 `src/protocol/`）。泛化已落地的 figure-grid。
- **方法**：点阵检测——组质心坐标在 X/Y 轴上的等差拟合；结构签名一致性校验；时间轴附加"沿轴 line/connector 对象"证据。
- **证据与输出**：组件候选（种类、成员组、点阵参数、分数）。
- **写回边界**：只写通用容器（`section.content-grid` 及既有容器词表），纪律与 figure-grid 完全一致：最少成员数、尺寸相近容差、skipped 记录、trusted 保护；**不写白名单组件语义**（那是 R8 的候选）。
- **验收**：指标卡 ×4、时间轴、对比板三类 fixture；不足最少成员数进 skipped；基准关联：T05/T06。

### R7 阅读顺序 `reading-order`

- **目标**：产出页内 DOM 顺序（`structure.order`），让导出 HTML 的源码顺序符合人的阅读预期。
- **前置与既有工具**：B0 必须先把串接 id、前后 frame id 和 story 内顺序从 JSX 快照贯通到 protocol registry、InDesign adapter、对象图与 fixture，之后 R7 才能把“串接顺序不被覆盖”列为验收项。建筑汇报类文档串接使用率虽低，缺失通道也不能用几何猜测冒充原生事实。`src/semantic-reconstruction/reading-order.js` 现有 helper 只可作为重写起点：阶段 0 注册 `reading-order-lite` 前，必须改为稳定元组比较 `(y, x, originalIndex)`、保护 trusted 相对顺序、消除重复 order，并移除其他 pass 对它的隐式调用；R7 在此基础上升级，不另起炉灶。
- **方法**：按确定性从高到低叠加——串接文本框内部顺序（通道补齐后为原生事实，直接固定）；R3 区域树先序；区域内按 R2 网格单元行优先；剩余对象用"上方/左侧"空间关系拓扑排序（PdfPig `UnsupervisedReadingOrderDetector`、Docling reading order 为参考）；背景/装饰（containment + z-order 底层大面积对象）排最前。
- **写回边界**：只重排页级非 trusted 对象的 `structure.order`；页面存在 trusted 结构时保持 trusted 项相对顺序不动（顺序也是 `structure` 的一部分，受 trusted-source-preservation 门禁保护）；不改 parentId、不改语义。
- **验收**：双栏页 fixture 断言先左栏后右栏；串接文本框顺序不被几何排序推翻；`audit:trusted-source-preservation` 通过；基准关联：导出源码可读性、编辑定位速度。

### R8 语义候选生成与裁决 `semantic-candidates` + `adjudication`

- **前置**：E0 先登记裁决规则的数据契约：schemaVersion、规则 key、适用 scope（项目/文档）、来源文档、命中/拒绝计数、置信度、冲突降级和迁移规则。未完成 E0 前，裁决结果只能留在报告，不得写入 semantic preset。
- **目标**：把 R1 角色、R5 页面类型与家具、R6 组件、资源角色启发（格式/路径/裁切比例/页面上下文，即候选表"资源角色分类"）合并为**白名单语义候选**，附完整证据链与置信度；高置信自动接受，其余进裁决队列。R1 输出的 `instanceOutliers` 实例一律不自动继承 token 角色，逐实例进裁决队列（§2 原则 1 的落点）。
- **裁决设计（LLM 的唯一位置）**：
  - 算法产出候选："对象 X 疑似 `caption`，score 0.62，证据：距图 4pt、左对齐、字号 P20 分位"；
  - Agent（可多模态看页面预览图）只回答接受/拒绝/改判，不自由发挥新语义（白名单约束）；
  - **裁决结果写入项目语义库（semantic preset）**成为持久规则（如 "token synth_text_003 → caption"），下次运行时按 §1 阶梯以 preset 优先级直接生效——人与 Agent 的判断被跨页、跨文档摊销，且重跑结果确定（LLM 不在重放路径上）。
- **写回边界**：只有"自动接受阈值以上"或"已裁决接受"的候选写 `items[].semantic` / `pages[].semantic`；其余保持 unresolved。自动接受阈值按项目 preset 配置，默认保守（初始 0.9）。
- **命名边界**：资源格式、路径是否为 UNC、扩展名、裁切比例和页面上下文属于技术事实；文件名中的自然语言词汇属于人类命名，不能单独提高语义置信度，必须与几何或页面类型证据共同命中。
- **验收**：候选生成的确定性单测；裁决持久化到 preset 后重跑免裁决的回归测试；`audit:trusted-source-preservation` 与内容库存门禁全过；基准关联：全部任务的可定位性（语义命名是 Agent 找编辑点的最强信号）。

### R9 假表格重建 `ruled-table-reconstruction`（低优先级）

- **目标**：把"线段画格 + 散文本框"的伪表格重建为表格语义。真 InDesign 表格已原生覆盖，本条只处理少数手画情形。
- **方法**：线段构建格网图（交点/闭合胞元），文本框按 bounds 归格；胞元覆盖率与文本归格率双阈值，不达标整体放弃进 unresolved。
- **写回边界**：达标才写 table 结构；绝不把"差不多像表格"的东西硬写成表格。
- **验收**：手画三行表 fixture；打散线段不足闭合时必须放弃；基准关联：T04 边缘情形。

## 4. 实施阶段

| 阶段 | 内容 | 理由 |
| ---- | ---- | ---- |
| 0A | 冻结可复现基线：保存 observed-only 的真实 47 页门禁输入、author-editability、effective-diff、reverse-visual、trusted-source、二次稳定性和 conversion-gate case；同步修正当前规范的验收口径 | 后续所有“改善/不回退”必须对同一输入、同一预算、同一 required gates 比较，不能只引用文档里的几个数字 |
| 0B | 安全性收口：所有顺序/分组 helper 跳过 trusted-source；`trustedSourcePreservation.ok !== true` 时 reverse pipeline、CLI、插件和 E2E 全部失败 | 先保证算法不能破坏可信作者结构，也不能报告假成功 |
| 0C | 幂等与顺序收口：修复 `caption-structure` 重跑增序；为四个已落地 pass 增加模型级双跑测试；把 `reading-order-lite` 重写成独立 pass，使用稳定元组排序并移除 `figure-grid` / `text-block` 的隐式全页排序 | 当前实现不满足默认启用条件；先把 pass 本身变成可重复执行的确定性单元 |
| 0D | profile 与入口收口：集中定义 `none / safe / experimental`、唯一依赖图和规范顺序；贯通 snapshot CLI、`--indd` E2E、插件 state/resume 与底层 pipeline | 防止不同入口运行不同算法或顺序，消除隐藏默认值 |
| 0E | 写出层精确去重：调整声明样式与 synth 的 CSS 级联；只移除被实际输出的 synth rule 完全覆盖的 item 级声明，保留实例残差、布局、文本框和 z-index | 直接删除 inline style 会让声明段落样式重新覆盖有效格式，造成视觉回退 |
| 0F | 真实准入：以 `experimental` 跑同一 47 页文档的首轮、二轮、conversion gate 和静态可编辑性；全部通过后把同一有序列表提升为 `safe`，用户入口才默认 `safe` | “默认开启”是阶段 0 的结果，不是阶段 0 的起点 |
| A0 | 补对象图文字证据；完成编辑任务基准 Phase 1–2 并人工复核首个 baseline | R1/R4 需要真实 `pointSize` / `leading`；算法阶段需要行为基准而不只看静态代理 |
| A | R1 + R2；结束前完成编辑任务基准 Phase 3 并接入棘轮 | 工作量小、覆盖面大；本阶段先建立可测证据，编辑任务要求不回退，不要求纯证据立即改变作者包 |
| B0 | 贯通串接文本框快照、registry、adapter、对象图和 fixture | R7 的串接顺序验收必须有真实采集通道 |
| B | R3 + R7 | R7 依赖 R2/R3 与 B0；阅读顺序改善所有导出的源码自然度 |
| C | R5，并按页面类型证据确定性重跑 R1/R2 | 跨页与类型内证据反哺早期候选；家具已有 audit 指标护航 |
| D0 | 贯通锚定对象与文本绕排快照、registry、adapter、对象图和 fixture | R4 已明确消费这些原生事实；必须先有真实通道，不得用几何猜测冒充原生事实 |
| D | R4 + R6 | 结构编辑类基准任务（T05/T06）的主要改善来源 |
| E0 | 定义并登记裁决回答与 preset 规则 schema、作用域、统计、冲突和迁移；把 `unresolved` / `reconstructedItems` 改为所有 pass 完成后按最终模型计算 | R8 不能把未登记的临时 JSON 当成长期项目语义库，也不能用 pass 前的 unresolved 快照报告假进度 |
| E | R8 | 依赖 A–D 的证据积累与 E0；裁决与 preset 摊销机制在此闭环 |
| F | R9 | 按真实文档中伪表格出现频率决定是否做 |

### 4.1 阶段 0 profile 与执行顺序契约

底层 `compileReverseSnapshotToHtml` 不再用“未传参数 = 空算法表”的隐式默认。所有调用方必须显式传 `reconstructionProfile`：

| profile | 用途 | 规则 |
| ---- | ---- | ---- |
| `none` | 纯观察诊断、旧基线复现 | 不运行任何 pass，报告必须明确 `observed-only` |
| `experimental` | 阶段开发和 0F 准入验证 | 必须显式提供算法名；可生成证据，但在提升为 `safe` 前不能作为发布默认 |
| `safe` | 正式反向导出 | 只包含已通过模型双跑、trusted-source、全量测试和真实人类文件门禁的 pass |

用户入口（snapshot CLI、`--indd`、插件）在 0F 完成前保持显式 `none`；0F 通过并在同一变更中提升列表后，统一默认 `safe`。诊断仍可显式选 `none`。任何算法一旦进入 `safe`，后续门禁不得通过临时关闭它、换顺序或放宽预算恢复绿色。

阶段 0 目标 `safe` 顺序固定为：

```text
page-object-graph
-> caption-structure
-> figure-grid
-> text-block
-> reading-order-lite
```

依赖规则集中维护：`caption-structure` 依赖 `page-object-graph`，`figure-grid` 依赖 `caption-structure`，所有结构写回完成后才运行 `reading-order-lite`。显式算法列表先做依赖闭包、去重，再按上述规范顺序执行；重复名称不能导致重复执行，未知名称直接报错。`figure-grid` 和 `text-block` 不得再自行调用全页阅读顺序 helper。

### 4.2 阶段 0 写出层去重契约

去重以“浏览器最终有效格式不变”为前提，按 CSS 属性逐条处理：

- `components.css` 先写声明式 paragraph / character / object style，再写 synth rule；同等选择器权重下由 synth 表达当前有效格式。
- 只有当对应 synth rule 确实写入作者包，且属性名和规范化后的值完全相等时，才从 item inline style 删除该声明。
- 单位、颜色、浮点精度先走共享规范化再比较；不能用原始字符串相等代替 CSS 值等价。
- source style、grid CSS 变量、文本框 padding/columns/vertical justification、z-index、`styleOverrides` 和 synth 未覆盖或值不同的实例残差必须保留。
- trusted source 的原始 style 不参与去重；rich-text run、table cell、vector、PDF wrapper 分属独立写出层，阶段 0 不借 item synth 顺手删除其样式。
- 找不到对应 synth rule 时 fail-safe 保留 inline 声明并写入审核项，不能为了降低计数删除视觉事实。

### 4.3 阶段 0 可复现门禁证据

客户源文件路径不入库，证据统一留在已忽略目录：

```text
test/workspace/semantic-reconstruction-stage0/
  baseline/   # reconstructionProfile=none
  candidate/  # reconstructionProfile=experimental，目标 safe 列表
```

0A 必须在 `baseline/` 保存同一份 reverse snapshot、author-editability、effective-diff、reverse-visual、trusted-source、二次回环稳定性和 `conversion-gate.case.json`。case 的 `requiredGates` 固定包含 `editability`、`trustedSource`、`stability`；P0、HTML 缺失、HTML 文本和页面差异预算固定为 0，P1 与 HTML 几何预算取人工复核后的 baseline 实值，只能保持或收紧。`candidate/` 复用同一 snapshot、预算和 required gates，只切换重建 profile。

每阶段收口条件：新 pass 单测全绿；模型对自身输出双跑逐字节稳定；`npm test` 全绿；`audit:conversion-gate` 使用上述 case 通过；触及回环行为时真实 InDesign E2E 回归一次；人类文件门禁在实际启用该阶段 pass 的状态下保持首轮三报告与二次三份 canonical 报告全绿，其中 canonical 作者包源码必须零漂移。

### 4.4 验收度量切换

- **阶段 0 当前层**：使用 `audit:author-editability` 静态指标 + 人类文件门禁。2026-07-11 文档中的 47 页指标只作方向参考；0A 生成的 machine-readable baseline 才是实施比较事实源。所有静态指标只许改善，`reverse-overrides.css` 的几何行数只作进度观察，不单独代表成功。
- **进入阶段 A 的前置**：编辑任务基准 Phase 1–2 完成，8 个 case 的 `forward-control` 全绿，`reverse-author` 首个 baseline 经人工复核并落库。Phase 1 只有两个 case，不能据此切换主判据。
- **阶段 A 收口前**：完成 Phase 3，把成功率、已通过任务不得回退和 diff 预算棘轮接入 conversion gate。此后写回类 pass 以任务成功率与 diff 局部性改善为主判据；纯证据 pass 以候选准确性、覆盖率和证据完整性改善为主判据，同时保证编辑任务不回退。静态指标继续作为廉价代理和回归护栏，不能替代行为基准。

## 5. 与现有机制的咬合

- **报告与 skipped 纪律**：每个 R-pass 输出格式沿用 SEMANTIC_RECONSTRUCTION §3；不满足规则的候选必须进 `skipped`，禁止兜底硬包。
- **trusted-source 保护**：所有写回类 pass（包括阶段 0 的 caption / figure-grid / text-block / reading-order-lite、R6/R7/R8 及 R2 的网格声明子步）不得触碰 `labelStatus: "accepted"` 结构；违例必须让 reverse pipeline、CLI、插件和 E2E 同步失败，不能只留下失败报告。
- **与人类文件门禁的咬合**：`--indd` 一键回环（真实汇报文档）是所有重建算法的回归底线；任何 pass 接入后，首轮三份硬报告与二次回环三份 canonical 门槛必须保持全绿，作者包源码零漂移蕴含 pass 必须确定性且幂等（§2 原则 7）。严禁为过门禁关闭已接入的 pass、放宽预算或隐藏差异。
- **人类命名禁令（含图层禁令）**：所有 R-pass 继承"文档图层不作证据"规则与其负例测试，并按 §1 推广到一切人类命名；负例测试从图层名扩展到样式名（"样式名为'标题'不得加分"与图层负例同权重）。
- **阈值纪律**：本文出现的 `titleSizeRatio`、`gridCoverageRatio`、`furnitureMinPages`、`textRoleCandidateScore`、`textRoleOutlierPositionDistance`、`textRoleOutlierPageCountMultiplier` 等均为命名阈值初始值，按 SEMANTIC_OBJECT_GRAPH §8 的规则测试固定、调整需回归用例。
- **协议纪律**：任何新字段（网格声明、组件容器类名扩充、preset 规则字段）先登记 `src/protocol/`，再接入 pass 与 writer——受架构加固 G2 护栏约束。
- **参考项目**：使用 REIP/PdfPig/pdfminer.six/Docling 时同步核对 SEMANTIC_RECONSTRUCTION §6 外部参考项目表；只借思路，不 vendoring。

## 6. 已冻结决策与允许延后事项

| 事项 | 已定规则 | 允许延后的部分 |
| ---- | ---- | ---- |
| 网格声明写回 | R2 v1 只产证据；写回使用 `pages[].grid` / `pages[].margins` 与对应 `data-id-grid`、gutter、margin、baseline 字段，达到自动接受阈值或经 R8 裁决后才启用 | baseline 网格作为 v2，不阻塞栏格 v1 |
| 页面类型命名 | R5 聚类只输出匿名 type-A/B/C；白名单名称由 R8 对齐 `SEMANTIC_PROTOCOL.md` 后写入 | 可按项目 preset 扩展已登记词表 |
| 裁决队列交互 | v1 固定为报告文件 + Agent 批处理回答，格式由 E0 schema 约束 | 使用频率足够高时再设计交互式 CLI |
| 多文档 preset 冲突 | 规则记录来源文档、命中/拒绝计数和置信度；冲突时低置信规则降级观察，禁止静默覆盖 | 跨项目共享规则不进入 v1 |
| 内联样式去重 | 完全按 §4.2 的属性级残差规则执行；不允许实现者自行选择“整段删除”或“按 class 存在即删除” | rich-text run、table cell、vector、PDF wrapper 的独立去重不进入阶段 0 |
| 串接/锚定/绕排采集 | 串接在 B0 完成；锚定与绕排在 D0 完成；每项都必须走 JSX → registry → adapter → 对象图 → fixture 全链路 | 不一次性在阶段 0 打开三个通道 |
| R9 是否实施 | 先统计真实文档中伪表格频率；频率为 0 时 F 阶段可以明确关闭并记录证据 | 不影响 0–E 阶段实施 |
