# 页面对象图证据层设计

## 0. 状态

本文件是可实施设计 spec，不是长期字段事实源。

长期边界见：

- `docs/规范/SEMANTIC_RECONSTRUCTION.md`
- `docs/规范/SEMANTIC_OBJECT_GRAPH.md`

当前实现状态：

- `src/semantic-reconstruction/reconstruct.js` 只做 pass-through。
- `reconstructSemanticModel(model, options)` 已返回 `{ model, report }`。
- `reconstruction-report.json` 已接入反向导出 CLI。

## 1. 目标

实现语义重建第一阶段：页面对象图证据层。

它把 `Observed Document Model` 的每一页对象转换为：

- 节点：页面对象的稳定事实摘要。
- 边：对象之间的几何、样式和顺序关系。
- 证据：每条边的来源、分数和原始计算依据。
- unresolved：缺少必要几何事实的对象。

本阶段不写入白名单语义，不创建组件，不创建 parent page，不判断页面类型。

## 2. 非目标

本轮不做：

- 页面类型分类。
- 跨页重复元素识别。
- 文本块合并和阅读顺序最终排序。
- 组件识别。
- 大模型识别。
- OCR 或截图识别。
- 从 HTML / CSS / DOM 反推结构。
- 根据 InDesign 文档图层名推断语义。

## 3. 参考项目取法

参考仓库位于：

```text
D:\AI\参考项目\html-indesign-semantic-reconstruction\
```

本轮只参考思路，不 vendoring，不复制大段实现。

| 项目 | 本轮取法 |
| ---- | -------- |
| REIP | 第一参考。采用对象级 visual element 思路：normalized bbox、z-order、尺寸、旋转、文本对齐。 |
| pdfminer.six | 参考几何合并思想：邻近、重叠、包围盒距离。 |
| PdfPig | 参考 debug pipeline：先抽对象，再生成 block/reading order，再可视化调试。 |
| Docling | 参考报告结构、confidence 和 pipeline 组织，不引入模型依赖。 |

## 4. 架构

新增独立子模块，不继续增大 `reconstruct.js`。

```text
src/semantic-reconstruction/
  reconstruct.js
  index.js
  object-graph/
    index.js
    bounds.js
    node-facts.js
    relationships.js
    report.js
```

职责：

| 文件 | 职责 |
| ---- | ---- |
| `object-graph/index.js` | 导出 `buildDocumentObjectGraph(model, options)` 和 `buildPageObjectGraph(page, context)` |
| `object-graph/bounds.js` | bounds 读取、归一化、面积、中心点、距离、重叠、包含 |
| `object-graph/node-facts.js` | 从 observed item 抽取节点事实 |
| `object-graph/relationships.js` | 生成 alignment、proximity、containment、overlap、same-style、caption-candidate、sequence 边 |
| `object-graph/report.js` | 生成 pass 报告摘要、warnings、unresolvedNodes |
| `reconstruct.js` | 根据 options 调用对象图算法，把 pass 写入 `report.passes` 和 `report.algorithms` |

`reconstruct.js` 只负责调度和汇总，不承载几何算法。

## 5. 开关

第一版使用显式开关，避免改变现有反向导出默认行为。

```js
reconstructSemanticModel(observedModel, {
  mode: 'observation',
  algorithms: ['page-object-graph'],
});
```

规则：

- 未传 `algorithms` 时保持现有 `observed-only` 行为。
- 传入 `page-object-graph` 时执行对象图 pass。
- 未知算法名必须抛错，不能静默忽略。
- 对象图 pass 成功后，`report.status` 仍可保持 `observed-only`，因为没有写入语义。
- `report.algorithms` 记录实际执行的算法名。

## 6. 输入模型假设

输入仍是 `DocumentModel`。

页面字段：

```js
{
  id: 'page-1',
  width: 1920,
  height: 1080,
  items: []
}
```

对象字段按当前 observed item 兼容读取：

```js
{
  id: 'item-1',
  role: 'text',
  type: 'text',
  semantic: 'unknown',
  bounds: { x: 100, y: 120, width: 400, height: 48 },
  zIndex: 3,
  content: { text: '项目标题' },
  style: {},
  visualStyle: {},
  asset: {},
  effectiveLabel: null,
  observedLabel: null,
  labelStatus: 'missing',
  rejectionReasons: []
}
```

兼容规则：

- `role` 和 `type` 都可能存在，`sourceType` 优先取 `role`，再取 `type`。
- `bounds` 必须能读出 `x`、`y`、`width`、`height`。
- 如现有模型使用 `left/top/right/bottom`，`bounds.js` 可支持确定性归一化。
- 缺少 bounds 或页面尺寸的对象进入 `unresolvedNodes`。

## 7. 输出结构

对象图作为 `reconstruction-report.json` 的一个 pass。

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
      "unresolvedNodes": [],
      "warnings": []
    }
  ]
}
```

`model` 本身不变。这个 pass 只写报告，不写 `items[].semantic`、`items[].structure` 或 `pages[].semantic`。

## 8. 节点字段

节点结构：

```js
{
  id: 'item-1',
  pageId: 'page-1',
  sourceType: 'text',
  bounds: { x: 100, y: 120, width: 400, height: 48 },
  normalizedBounds: { x: 0.0521, y: 0.1111, width: 0.2083, height: 0.0444 },
  size: { width: 400, height: 48, area: 19200 },
  rotation: 0,
  zOrder: 3,
  textFacts: {
    length: 4,
    lineCount: 1,
    firstLine: '项目标题',
    align: 'unknown',
    fontSize: null,
    fontWeight: null,
    overset: false
  },
  assetFacts: null,
  visualFacts: {},
  labelFacts: {
    labelStatus: 'missing',
    hasEffectiveLabel: false,
    hasObservedLabel: false,
    rejectionReasons: []
  },
  observedFacts: {
    indesignLayerName: '标题'
  }
}
```

规则：

- `observedFacts.indesignLayerName` 可以保留，但不得参与任何边分数。
- 节点不得出现 `semanticCandidate`、`semantic` 或白名单 role 判断。
- 文本 `firstLine` 要截断，避免报告过大；建议最多 80 字符。

## 9. 边字段

边结构：

```js
{
  type: 'alignment',
  from: 'item-1',
  to: 'item-2',
  score: 0.92,
  evidence: {
    axis: 'left',
    delta: 1.2,
    tolerance: 2,
    unit: 'pt'
  }
}
```

第一版边类型：

| 类型 | 生成条件 |
| ---- | -------- |
| `alignment` | 左、右、上、下、水平中心、垂直中心任一对齐 |
| `proximity` | 两对象最近边距离小于 proximity tolerance |
| `containment` | 一个对象几何上大比例包含另一个对象 |
| `overlap` | 交叠面积超过最小比例 |
| `same-style` | 文本或视觉样式摘要一致 |
| `caption-candidate` | 文本对象位于图片/图形下方或附近，短文本，距离合理 |
| `sequence` | 同类型对象在同一轴线上形成稳定间距 |

`score` 只代表关系强度，不代表语义置信度。

## 10. 阈值

默认阈值集中在 `relationships.js` 顶部或导出的 config 中。

```js
const DEFAULT_OBJECT_GRAPH_OPTIONS = {
  minimumOverlapRatio: 0.08,
  maxCaptionTextLength: 80,
  maxSequenceSpacingVariance: 0.18,
};
```

页面相关容差由函数计算：

```js
alignmentTolerance = max(1.5, 0.004 * min(pageWidth, pageHeight))
proximityTolerance = 0.035 * min(pageWidth, pageHeight)
containmentTolerance = max(2, 0.006 * min(pageWidth, pageHeight))
```

阈值必须通过测试固定。后续调参必须改测试或新增测试解释影响。

## 11. 图层硬规则

必须实现一条反回归测试：

输入对象：

```js
{
  id: 'text-1',
  role: 'text',
  bounds: { x: 100, y: 100, width: 300, height: 40 },
  content: { text: '普通文字' },
  layerName: '标题'
}
```

期望：

- 节点可在 `observedFacts.indesignLayerName` 记录 `标题`。
- 不生成标题语义。
- 不生成文本角色候选。
- 不因 layerName 产生任何边。
- `ignoredSignals` 包含 `indesignLayerName`。

## 12. 实施切片

这不是完整 plan，但可以直接按切片实施。

### 切片 1：bounds 和节点

新增：

- `src/semantic-reconstruction/object-graph/bounds.js`
- `src/semantic-reconstruction/object-graph/node-facts.js`
- `test/semantic-reconstruction/object-graph.test.js`

验证：

```powershell
node --test test/semantic-reconstruction/object-graph.test.js
```

通过标准：

- 能为有 bounds 的对象生成 normalizedBounds。
- 缺少 bounds 的对象进入 unresolvedNodes。
- 图层名只进入 observedFacts。

### 切片 2：基础关系边

新增：

- `src/semantic-reconstruction/object-graph/relationships.js`

验证：

```powershell
node --test test/semantic-reconstruction/object-graph.test.js
```

通过标准：

- 图片下方短文本生成 `caption-candidate`。
- 两列卡片生成 `alignment`、`proximity`、`sequence`。
- 背景矩形生成 `containment`。
- 重叠对象生成 `overlap` 并记录 zOrder。

### 切片 3：接入重建报告

修改：

- `src/semantic-reconstruction/object-graph/index.js`
- `src/semantic-reconstruction/object-graph/report.js`
- `src/semantic-reconstruction/reconstruct.js`
- `src/semantic-reconstruction/index.js`

验证：

```powershell
node --test test/semantic-reconstruction/reconstruct.test.js test/semantic-reconstruction/object-graph.test.js
```

通过标准：

- 未传算法时保持现有 pass-through 报告。
- 传 `algorithms: ['page-object-graph']` 时写入一个 pass。
- 未知算法名抛错。
- `model` 不被修改。

### 切片 4：CLI 可选开关

修改：

- `scripts/indesign-reverse-export.js`
- `test/indesign-reverse/cli.test.js`

建议参数：

```powershell
node scripts/indesign-reverse-export.js --snapshot <reverse-snapshot.json> --out <dir> --mode observation --reconstruct page-object-graph
```

通过标准：

- 不传 `--reconstruct` 时保持当前输出。
- 传 `--reconstruct page-object-graph` 时 `reconstruction-report.json` 包含 pass。
- 传未知算法时报错。

## 13. 测试矩阵

| 测试 | 文件 | 断言 |
| ---- | ---- | ---- |
| 节点归一化 | `object-graph.test.js` | normalizedBounds 正确 |
| 缺失 bounds | `object-graph.test.js` | unresolvedNodes 记录对象 id 和 reason |
| 图层忽略 | `object-graph.test.js` | layerName 不影响语义和边 |
| caption 候选 | `object-graph.test.js` | 只生成边，不写语义 |
| containment | `object-graph.test.js` | 背景框与子对象生成 containment |
| overlap | `object-graph.test.js` | 记录 overlap ratio 和 zOrder |
| sequence | `object-graph.test.js` | 同类等距对象生成 sequence |
| reconstruct 默认行为 | `reconstruct.test.js` | 不传算法仍 observed-only |
| reconstruct 算法接入 | `reconstruct.test.js` | pass 写入 report.passes |
| CLI 参数 | `cli.test.js` | `--reconstruct` 正确传入算法列表 |

## 14. 验收命令

最小验收：

```powershell
node --test test/semantic-reconstruction/object-graph.test.js test/semantic-reconstruction/reconstruct.test.js test/indesign-reverse/cli.test.js
git diff --check
```

完整回归：

```powershell
npm test
```

触及真实 InDesign 导出时，再跑：

```powershell
npm run e2e:indesign -- -- --reverse-roundtrip
```

真实客户文档验证只输出到用户指定目录或 `test/workspace/`，不把客户路径写入 fixture。

## 15. 完成标准

完成时必须满足：

- 页面对象图算法独立成小模块。
- `reconstruct.js` 没有变成超大识别器。
- 默认反向导出行为不变。
- 开启算法后报告可解释。
- 所有推断停留在 report pass，不污染语义模型。
- InDesign 文档图层不参与语义证据。
- 测试覆盖图层忽略、缺 bounds、caption、containment、overlap、sequence。
