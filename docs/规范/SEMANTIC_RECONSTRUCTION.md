# 语义重建层规范

## 1. 定位

语义重建层负责把 InDesign 反向观察模型转换为更适合继续编辑的作者语义模型。

它处理的是中间模型，不直接处理 InDesign 文档，也不以导出的 HTML 为事实源。

```text
InDesign
-> reverse snapshot
-> InDesign Adapter
-> Observed Document Model
-> Semantic Reconstruction
-> Reconstructed Author Model
-> HTML Writer
-> 作者源码包
```

当前实现包含四类 pass：

- `src/semantic-reconstruction/` 提供模型变换入口。
- `reconstructSemanticModel(model, options)` 返回 `{ model, report }`。
- 未配置算法时保持模型语义不变，生成 `observed-only` 报告。
- `page-object-graph` 只生成对象图证据，不改写模型。
- `caption-structure` 使用对象图中的高置信 `caption-candidate` 关系，把图像/置入资源和短说明文字写成作者 HTML 可编辑的 `figure + figcaption` 父子结构。
- `figure-grid` 使用已结构化的 captioned figure，把同页同尺寸、行列关系明确的多个 figure 包成作者 HTML 可编辑的 `section.figure-grid`。
- `text-block` 把同页、同列、同文字样式、垂直连续的页级文字框包成作者 HTML 可编辑的 `section.text-block`。
- 反向导出会写出 `reconstruction-report.json`。

## 2. 边界

### 2.1 InDesign Adapter

只负责读取事实和确定性归一化：

- 页面、母版、样式、参考线；InDesign 文档图层只作为观察事实保留，不作为语义证据。
- 对象类型、坐标、尺寸、z-order、可见性。
- 文本、文字 runs、表格、矢量路径、效果。
- 资源链接、预览、置入参数。
- `html_indesign` 标签和白名单校验结果。

不得在 adapter 或 JSX 中做页面语义猜测、组件识别、版式分类。

### 2.2 Semantic Reconstruction

负责算法识别和模型重建：

- 只读取 `Observed Document Model`。
- 只输出 `Reconstructed Author Model` 和结构化报告。
- 每个推断必须有置信度、证据和来源。
- 低置信度结果只能进入 `unresolved` 或候选报告，不能写成有效语义。

### 2.3 HTML Writer

只负责把模型写成 HTML、作者包和视觉页面。

不得从 `reverse-overrides.css`、DOM id、视觉兼容 wrapper 里反向猜语义。

### 2.4 第一阶段算法

第一阶段固定为页面对象图证据层，详见 `SEMANTIC_OBJECT_GRAPH.md`。

该阶段只生成页面对象节点、对象关系和可解释证据，不直接写入白名单语义。InDesign 文档图层名、图层编号和图层顺序不得参与语义评分、角色分类或组件识别。

### 2.5 作者 HTML 结构落地

`caption-structure` 是当前第一条写回作者模型的算法。

输入：

- `Observed Document Model`。
- `page-object-graph` 生成的 `caption-candidate` 边；如果调用方未显式先运行对象图，本 pass 会在内部生成对象图供本 pass 使用。

写回范围：

- 只写 `items[].structure.parentId`、`items[].structure.order`、可渲染 `sourceNode.tagName` 和 `tagName`。
- 不把 `items[].semantic` 从 `unknown` 改成图注语义；白名单语义仍由后续语义候选和用户确认流程处理。
- 不读取 InDesign 文档图层，不读取导出后的 HTML。

落地规则：

- 目标宿主必须是 `graphic` 或带有原位资源事实的对象。
- 目标文字必须是短文本，默认不超过 80 字。
- `caption-candidate.score` 默认必须不低于 `0.75`。
- 已经嵌套到其他父级的文字不移动。
- 同一宿主默认只接收一个 caption，同一文字只能被使用一次。
- 低分、非资源宿主、重复使用和已有父级冲突都必须写入 pass 的 `skipped`，不能静默忽略。

输出效果：

```html
<figure id="image-1" data-id-object>
  <img class="placed-asset-content" src="..." data-id-ignore>
  <figcaption id="caption-1">材料名称</figcaption>
</figure>
```

这一步的目标是提升作者包可编辑性，而不是宣称语义已经完全恢复。

`figure-grid` 是当前第二条写回作者模型的算法。

输入：

- 已由 `caption-structure` 写成 `figure + figcaption` 的对象。
- 每个 figure 的原始 bounds 和 caption 子对象 bounds。

写回范围：

- 新增一个虚拟 `section.figure-grid` 容器 item。
- 把同组 figure 的 `items[].structure.parentId` 指向该容器，并按行优先顺序重排 `structure.order`。
- 不写 `data-id-layout`，不改 `items[].semantic`，不把矩阵直接命名为材料页、图纸页或组件白名单语义。

落地规则：

- 默认至少 3 个已带 figcaption 的 figure 才能成组。
- 同组 figure 的尺寸必须相近，默认宽高相对差不超过 `0.18`。
- 单行至少 3 个或多行排列明确时才成组。
- 已经属于其他页面级容器的 figure 不移动。
- 不满足规则的候选必须写入 pass 的 `skipped`。

输出效果：

```html
<section id="page-1-figure-grid-1" class="figure-grid">
  <figure>...</figure>
  <figure>...</figure>
  <figure>...</figure>
</section>
```

这一步只表达“这些图文对属于同一个可编辑矩阵”，不声明页面类型或白名单组件语义。

`text-block` 是当前第三条写回作者模型的算法。

输入：

- 页级文字对象。
- 每个文字对象的 bounds、段落样式引用和文字样式摘要。

写回范围：

- 新增一个虚拟 `section.text-block` 容器 item。
- 把同组文字对象的 `items[].structure.parentId` 指向该容器，并按从上到下顺序重排 `structure.order`。
- 不改 `items[].semantic`，不把文本块命名为正文、标题、材料说明或页面类型语义。

落地规则：

- 默认至少 2 个文字框才能成组。
- 文字框必须同页、页级、非 `figcaption`、有非空文本。
- 文字框必须同列，默认 x 坐标容差不超过 `8`，宽度相对差不超过 `0.12`。
- 相邻文字框必须垂直连续，默认间距不超过 `48`。
- 不满足规则的候选必须写入 pass 的 `skipped` 或保持原状，不能靠兜底硬包。

输出效果：

```html
<section id="page-1-text-block-1" class="text-block">
  <p>第一段文字</p>
  <p>第二段文字</p>
</section>
```

这一步只表达“这些文字框属于同一个可编辑文本块”，不判断页面是材料页、说明页或其他页面类型。

## 3. 报告

`reconstruction-report.json` 是语义重建层的固定输出。

当前字段：

```json
{
  "kind": "SemanticReconstructionReport",
  "version": 1,
  "status": "observed-only",
  "mode": "observation",
  "sourceModelId": "indesign-document",
  "profile": "architecture-report",
  "algorithms": [],
  "passes": [],
  "summary": {
    "pages": 47,
    "items": 537,
    "reconstructedItems": 0,
    "unresolvedItems": 537
  },
  "unresolved": [],
  "warnings": [],
  "errors": []
}
```

规则：

- `status: "observed-only"` 表示没有执行语义算法，不代表作者包已语义化。
- `reconstructedItems` 只能统计被算法明确重建的对象。
- `unresolved` 必须列出未识别或标签被拒绝的对象。
- 算法失败必须写入 `errors` 或直接抛错，不能吞掉后继续输出假成功。

## 4. 算法候选

后续算法按小模块逐个接入，禁止写成超大识别器。

| 模块 | 目标 | 主要证据 | 输出 |
| ---- | ---- | -------- | ---- |
| 页面对象图证据层 | 为每页对象生成节点、关系和证据底座 | 归一化 bbox、z-order、对象类型、文本摘要、资源事实、样式事实、几何关系 | `passes[].page-object-graph`，不改写语义 |
| 图注结构落地 | 把高置信图片/置入资源说明文字落成可编辑父子结构 | `caption-candidate`、短文本、资源宿主、间距、水平重叠、未被其他结构占用 | `items[].structure`、`figure + figcaption`，不改写白名单语义 |
| 图片矩阵结构落地 | 把多个已带图注的同类 figure 包成作者可编辑区块 | figure bounds、caption 子对象、尺寸相似度、行列关系、页面级父子结构 | 虚拟 `section.figure-grid` 和 figure 父子结构，不改写白名单语义 |
| 文本块结构落地 | 把同列、同样式、垂直连续的散落文字框包成可编辑区块 | bounds、段落样式、文字样式、列位置、垂直间距、页面级父子结构 | 虚拟 `section.text-block` 和文字父子结构，不改写白名单语义 |
| 页面类型聚类 | 识别封面、目录、图纸页、对比页、时间轴、材料页等 | 页面文字密度、主图数量、重复标题、对象分布 | `pages[].semantic`、页面类型候选 |
| 网格推断 | 推断主网格、边距、栏间距、baseline | 对齐线、对象边缘、参考线、重复坐标 | `pages[].grid`、`pages[].margins` |
| 重复元素识别 | 区分页眉页脚、页码、章节标识和母版装饰 | 跨页位置稳定性、样式一致性、母版来源 | `parentPages[]`、模板候选 |
| 几何分组 | 把散落对象组合为图文组、卡片、图纸组、注释组 | 包围盒、距离、包含关系、z-order、样式相似度 | `items[].structure` |
| 文本角色分类 | 识别标题、副标题、正文、图注、标注、指标 | 字号、字重、位置、文本长度、重复模式 | `items[].semantic`、文字样式 token |
| 资源角色分类 | 识别主视觉、图纸、效果图、材料图、logo | 资源格式、文件名、位置、裁切比例、页类型 | `items[].semantic`、asset kind 候选 |
| 样式 token 归并 | 把杂乱样式归并到项目白名单 token | 字体、颜色、字号、描边、填充、对象样式名 | style token 候选 |
| 组件识别 | 识别时间轴、图片矩阵、指标卡、对比板、图纸框 | 页面类型、分组、文本角色和资源角色组合 | 结构化组件候选 |

### 4.1 重复元素识别指标

重复元素识别的目标不是完整复刻人工 InDesign 文件中的母版数量、母版名称或页面结构模板。人工母版经常混入版式槽位、空框、说明文字和项目模板遗留对象；这些内容不能直接作为规范目标。

规范母版只承载跨页稳定、低编辑频率的页面家具，包括页码、页眉页脚、章节标识、固定装饰线、稳定重复背景和规范参考线。主图框、PDF 图纸、正文、材料图、页面版式槽位和页外说明文字不得因为来自人工母版或位置重复而被提升为规范母版对象。

`npm run audit:parent-furniture` 负责输出这类算法的量化指标：

- `promotionRate`：原始快照中被识别为规范母版家具的候选，有多少进入回环结果的 `parentPages[].items` 或等价母版事实。
- `falsePromotionRate`：回环结果母版对象中，有多少是主图、PDF、正文、版式槽位等内容型误提升。
- `pageFurnitureResidueRate`：应进入母版的固定家具，仍以每页对象形式残留的比例。
- `stability`：提供二次回环快照时，检查规范母版家具是否重复生成、丢失或展开回页面。

阶段目标应以这些指标收敛，而不是要求 `parentPages.length` 等于原始人工 InDesign。

## 5. 验收标准

一个算法接入前必须有测试覆盖：

- 输入是 `Observed Document Model`，不是导出的 HTML。
- 输出不修改无证据字段。
- 推断字段必须能解释证据和置信度。
- 不确定对象进入 `unresolved`。
- 生成的作者包能通过 authoring lint。
- 需要交付为样例时，继续跑反向视觉几何审核和真实 InDesign 回环。

### 5.1 人工 InDesign 无丢失回环

人工 InDesign 反向作者包进入 `HTML -> InDesign -> HTML` 回环时，必须生成以下作者包审计报告：

- `source-roundtrip-report.json`：源码 exact diff 和格式漂移报告，作为辅助信号。
- `content-inventory-report.json`：页面、文字、资源和关键内容库存对照，是无丢失硬门槛。
- `structure-signature-report.json`：作者 HTML 可编辑结构签名对照。

首轮从人工 InDesign 重建出的作者包，允许源码 exact diff 和源作者结构差异作为 advisory warning 写入报告；这类差异不能掩盖内容丢失。硬失败条件是内容库存丢页、丢文字、丢资源或真实 InDesign 构建出现 overset / unresolved text fit。

二次回环验证第一轮作者包是否稳定。`--second-pass-roundtrip` 必须写出：

- `canonical-source-drift-report.json`
- `canonical-content-inventory-report.json`
- `canonical-structure-signature-report.json`

二次回环的硬门槛是 `canonical-content-inventory-report.json` 和 `canonical-structure-signature-report.json` 均为 `ok: true`。源码 exact drift 继续保留为辅助报告；PSD 预览缓存文件名变化、极小浮点排版数值漂移等不改变内容库存和结构签名的变化，不得单独导致二次回环失败。

### 5.2 有效 diff 门禁

原始人工 InDesign 与规范化生成 InDesign 的结构 diff 不要求清零；人工文件中的样式名、图层名、z-order、参考线和母版实现方式可以与规范化输出不同。必须使用 `audit:effective-diff` 把差异分级：

- P0 内容损失：页数、文字、资源身份变化，硬门槛必须为 0。
- P1 有效版面损失：资源置入、矢量几何、关键视觉样式、对象 bounds、真实对象缺失或多出，按 baseline 预算逐轮收紧，不得回退。
- P2 规范化差异：样式名、段落样式名、图层名、参考线等，只统计和归档，不作为硬失败。

`EDI = P0 * 100 + P1 * 10 + P2` 只用于趋势观察；是否通过以 P0、P1 预算和二轮/再次回环结构稳定门禁为准。后续算法修复应优先把 P0 清零，再降低 P1；不得为了降低总 diff 去复刻人工 InDesign 的噪音。

## 6. 外部参考项目

语义重建算法参考项目放在仓库外部，不进入本项目源码树：

```text
D:\AI\参考项目\html-indesign-semantic-reconstruction\
```

当前已拉取：

| 项目 | 路径 | 当前 commit | 许可证文件 | 本项目参考点 |
| ---- | ---- | ----------- | ---------- | ------------ |
| REIP | `D:\AI\参考项目\html-indesign-semantic-reconstruction\reip` | `93bbe37fe3f4` | `LICENSE`（CC0 1.0） | PPT 风格 visual elements 的层次分组、对象关系特征 |
| PdfPig | `D:\AI\参考项目\html-indesign-semantic-reconstruction\PdfPig` | `bb406a9444dc` | `LICENSE`、`NOTICES.txt`（Apache 2.0） | Recursive XY Cut、Docstrum、nearest-neighbour 等版面分析思路 |
| pdfminer.six | `D:\AI\参考项目\html-indesign-semantic-reconstruction\pdfminer.six` | `a18de2a9c479` | `LICENSE` | 字符、行、文本框、reading order 的几何合并策略 |
| Docling | `D:\AI\参考项目\html-indesign-semantic-reconstruction\docling` | `5b27d9782f22` | `LICENSE`（MIT） | 统一文档模型、pipeline、reading order 和 HTML/JSON 导出设计 |

使用规则：

- 这些仓库只作算法和架构参考，不 vendoring 到本项目。
- 不直接复制大段实现；需要借鉴时，先写清楚本项目输入、输出、证据和测试，再按本项目模型重新实现。
- 引入任何第三方运行时代码前，必须重新核验许可证、维护状态、依赖体积和可测试性。
- 更新这些参考仓库后，必须同步更新上表的 commit 和用途说明。
