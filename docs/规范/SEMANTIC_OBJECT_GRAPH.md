# 页面对象图证据层规范

## 1. 定位

页面对象图证据层是语义重建的第一阶段算法。

它只把 `Observed Document Model` 中每一页的对象整理成可解释的节点、关系和证据，不直接把对象改写成白名单语义。

```text
Observed Document Model
-> Page Object Graph
-> graph evidence report
-> 后续重复元素识别 / 阅读顺序 / 几何分组 / 语义重建
```

第一阶段目标是建立稳定、可测、可调试的事实底座。后续算法可以使用这些证据，但不得把页面对象图本身当作最终语义结果。

可实施设计见 `docs/superpowers/specs/2026-06-03-semantic-object-graph-evidence-layer-design.md`。本文件保留长期边界、输出契约和验收规则。

## 2. 人类 InDesign 图层规则

InDesign 文档图层不作为本阶段语义证据。

原因：

- 事务所人类用户通常不会按语义维护 InDesign 图层。
- 图层名经常来自模板、复制文件、临时整理或默认图层。
- 图层顺序不能稳定表达标题、正文、图纸、图注、组件关系。

处理规则：

- InDesign Adapter 可以保留图层名、锁定、可见性等原始观察事实。
- 页面对象图不得把文档图层名、图层编号或图层顺序用于语义评分、角色分类、组件识别或分组判断。
- 图层事实只能进入 `observedFacts` 或诊断报告，不进入 `evidence` 主评分。
- z-order 仍然可用，因为它描述页面对象实际前后遮挡和绘制顺序，不等同于人类维护的文档图层。
- PDF、AI、PSD 等置入资源自身的图层显隐属于资源置入参数，不属于 InDesign 文档图层语义，可以继续按资源事实保留。

必须有测试证明：对象位于名为 `标题`、`正文`、`图纸` 等图层时，页面对象图不能因此生成标题、正文或图纸语义候选。

## 3. 参考项目结论

参考项目只用于算法和工程组织借鉴，不 vendoring 到本项目。

| 项目 | 参考点 | 本阶段使用方式 |
| ---- | ------ | -------------- |
| REIP | 信息展示页的 visual elements、归一化 bbox、z-index、尺寸、旋转、文本对齐和层级分组目标 | 作为第一参考；借鉴对象级特征和层级分组目标 |
| PdfPig | `NearestNeighbourWordExtractor`、`DocstrumBoundingBoxes`、`UnsupervisedReadingOrderDetector` 的调试和阅读顺序流程 | 第二阶段参考；用于后续文本块、阅读顺序和 debug overlay 思路 |
| pdfminer.six | `group_objects`、`group_textlines`、`group_textboxes` 中的邻近、重叠和包围盒距离合并 | 第二阶段参考；用于后续文本行/文本块合并 |
| Docling | layout cluster、confidence、postprocess、可视化调试和统一文档 pipeline | 工程参考；不把模型识别作为第一阶段依赖 |

第一阶段只借鉴 REIP 的对象特征思路和 pdfminer/PdfPig 的几何关系思想，按本项目的 `Observed Document Model` 重新实现。

## 4. 输入

输入是反向导出归一化后的页面模型。

要求：

- 来源必须是 `src/adapters/indesign/` 输出的 `Observed Document Model`。
- 不读取 `deck.visual.html`、`deck.html`、`reverse-overrides.css` 或浏览器 DOM。
- 不调用 InDesign。
- 不读取文件系统上的图片内容作为语义依据；图片路径、格式、尺寸、置入参数可以作为资源事实。

每个页面至少需要：

- 页面尺寸和坐标单位。
- 页面对象列表。
- 对象类型。
- 对象 bounds。
- 对象 z-order 或页面绘制顺序。
- 文本对象的纯文本、文字样式摘要和溢出状态。
- 资源对象的资源类型、路径、显示框和置入参数。
- 形状、线、表格等对象的基础视觉样式。
- 标签白名单校验结果。

缺少必要几何事实时，本页对象图必须标记为不可完整生成，并把对象写入 `unresolved`。

## 5. 输出

输出不是新的语义模型，而是语义重建报告中的一个 pass。

建议结构：

```json
{
  "name": "page-object-graph",
  "version": 1,
  "status": "completed",
  "source": "observed-model",
  "ignoredSignals": ["indesignLayerName", "indesignLayerIndex"],
  "summary": {
    "pages": 1,
    "nodes": 8,
    "edges": 14,
    "unresolvedNodes": 0
  },
  "pages": [
    {
      "pageId": "page-1",
      "nodes": [],
      "edges": [],
      "warnings": []
    }
  ]
}
```

规则：

- `status: "completed"` 只表示对象图生成完成，不表示语义化完成。
- `ignoredSignals` 必须显式列出被排除的高风险输入，其中必须包括 InDesign 文档图层信号。
- 每条边必须说明证据类型、来源对象、目标对象、分数和用于计算的原始几何事实。
- 对象图不得改写 `items[].semantic`、`pages[].semantic`、`items[].structure` 或 style token。
- 后续算法如果使用对象图结果写入语义，必须在自己的 pass 中重新记录证据链。

## 6. 节点

节点对应页面上的一个可观察对象。

节点字段：

| 字段 | 含义 |
| ---- | ---- |
| `id` | 稳定对象 id，来自 observed item id |
| `pageId` | 页面 id |
| `sourceType` | `text`、`graphic`、`shape`、`line`、`table`、`group`、`unknown` |
| `bounds` | 原始坐标 bounds |
| `normalizedBounds` | 归一化 bbox，范围 `[0, 1]` |
| `size` | 宽高和面积 |
| `rotation` | 旋转角度 |
| `zOrder` | 页面对象前后顺序 |
| `textFacts` | 文本长度、行数、首行、字号摘要、字重摘要、对齐方式、溢出状态 |
| `assetFacts` | 资源类型、路径、比例、置入页码、crop、fitting |
| `visualFacts` | 填充、描边、透明度、圆角、线型 |
| `labelFacts` | effectiveLabel / observedLabel / rejected reasons 摘要 |
| `observedFacts` | 只观察不评分的事实，例如 InDesign 文档图层名 |

节点不得包含算法猜测出的 `semantic`。如果需要记录候选语义，必须由后续 pass 输出。

## 7. 边

边描述两个对象之间的可解释关系。

第一阶段支持以下边类型：

| 边类型 | 目标 | 主要证据 |
| ------ | ---- | -------- |
| `alignment` | 判断对象是否共享左、右、上、下、中线或文本基线 | 归一化坐标、容差、页面尺寸 |
| `proximity` | 判断对象是否可能属于同一区域 | 水平/垂直间距、最近边距离、间距与对象尺寸比例 |
| `containment` | 判断对象是否位于容器、背景框或图框内部 | 包含率、面积比、z-order |
| `overlap` | 判断遮挡、叠放或背景关系 | 交叠面积、交叠比例、z-order |
| `same-style` | 判断对象视觉或文本样式是否相近 | 字体摘要、颜色、描边、填充、对象样式 token |
| `caption-candidate` | 判断文本是否可能是图注或说明 | 文本长度、位置、距离、对齐、目标对象类型 |
| `sequence` | 判断同类对象是否形成列表、矩阵或阅读顺序候选 | 坐标排序、间距一致性、尺寸一致性 |

边的 `score` 是证据强度，不是语义置信度。

示例：

```json
{
  "type": "alignment",
  "from": "page-1-item-3",
  "to": "page-1-item-4",
  "score": 0.92,
  "evidence": {
    "axis": "left",
    "delta": 1.2,
    "tolerance": 2,
    "unit": "pt"
  }
}
```

## 8. 分数规则

本阶段使用确定性启发式评分，不接入机器学习模型。

规则：

- 分数范围是 `0..1`。
- 分数只表达某类关系的证据强度。
- 分数不能直接升级为白名单语义。
- 所有阈值必须命名，并在报告或测试中可追溯。
- 阈值优先使用页面尺寸归一化、对象尺寸比例和稳定最小容差组合，不能写死只适合某个 fixture 的像素值。

推荐初始容差：

| 名称 | 含义 | 初始值 |
| ---- | ---- | ------ |
| `alignmentTolerance` | 边缘或中心线对齐容差 | `max(1.5pt, 0.004 * min(pageWidth, pageHeight))` |
| `proximityTolerance` | 近邻候选最大距离 | `0.035 * min(pageWidth, pageHeight)` |
| `containmentTolerance` | 容器边缘误差 | `max(2pt, 0.006 * min(pageWidth, pageHeight))` |
| `minimumOverlapRatio` | 有效重叠比例 | `0.08` |

这些数值是第一版默认值，必须通过测试固定。后续调整阈值时必须说明影响，并补充回归用例。

## 9. 不做

第一阶段不做：

- 不判断页面类型。
- 不把对象改成标题、正文、图纸、图注、logo 等白名单语义。
- 不创建 `data-id-layout`。
- 不创建 parent page。
- 不做跨页重复元素识别。
- 不根据 InDesign 文档图层名推断语义。
- 不读取导出的 HTML 反推结构。
- 不调用大模型或视觉 OCR。
- 不吞掉缺失几何事实后输出假成功。

## 10. 后续算法衔接

页面对象图完成后，算法顺序如下：

1. 跨页重复元素识别：使用对象图中的 normalized bounds、文本摘要、样式和资源事实，识别页码、页眉页脚、章节标识和重复装饰。
2. 文本块结构落地：`text-block` 使用同页、同列、同文字样式和垂直连续关系，把散落文字框写成 `section.text-block` 作者结构，但不判断正文、标题或页面类型。
3. 图注结构落地：`caption-structure` 使用高置信 `caption-candidate` 边，把图片/置入资源和短说明文字写成 `figure + figcaption` 作者结构，但不改写白名单语义。
4. 图片矩阵结构落地：`figure-grid` 使用已带图注的同类 figure，把明确行列关系写成 `section.figure-grid` 作者结构，但不声明页面类型或白名单组件语义。
5. 几何分组：使用对象图边和重复元素结果，把图片、文字、背景框、图注组合成候选组。
6. 语义候选生成：在已有分组、文本角色、资源事实和页面上下文基础上生成白名单语义候选。
7. 作者模型重建：只有高置信度候选才能写入 `Reconstructed Author Model`；其余继续进入 unresolved。

每个后续算法都必须是独立 pass，不能把所有判断塞进一个超大识别器。

## 11. 测试要求

最小测试集：

- 图片对象下方短文本生成 `caption-candidate` 边，但不写入图注语义。
- 两列卡片对象生成对齐、近邻和序列边。
- 背景矩形包含多个文本和图片时生成 `containment` 边。
- 两个重叠对象生成 `overlap` 边，并记录 z-order。
- 对象位于名为 `标题` 的 InDesign 图层时，不生成标题语义候选，不提高任何文本角色分数。
- 缺少 bounds 的对象进入 `unresolvedNodes`。

验证命令应至少覆盖：

```powershell
node --test test/semantic-reconstruction/object-graph.test.js
npm test
```

触及真实反向导出链路时，再运行真实 InDesign E2E 或指定用户文档导出，不把客户路径写入 fixture。
