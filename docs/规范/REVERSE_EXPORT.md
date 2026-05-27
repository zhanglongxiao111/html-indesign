# InDesign 反向导出规范

## 1. 目标

反向导出把 InDesign 文档转换为固定语义 HTML。

第一阶段目标不是任意 InDesign 文件无损还原，而是建立可验证的双向闭环：

```text
带标签 InDesign
-> reverse snapshot
-> semantic model
-> 固定语义 HTML
-> HTML-to-InDesign
-> 带标签 InDesign
```

反向导出的最高质量语义来源是 `docs/规范/LABEL_PROTOCOL.md`。无标签或弱标签输入不能恢复原始 authoring HTML，但仍必须能通过 InDesign 原生信息、旧 blueprint 和样式/几何事实生成可观察 HTML 与补标线索。

反向导出每次都必须按当前项目语义库复核 `html_indesign` 标签。符合白名单的字段进入有效标签；不符合白名单的字段只能作为观察标签保留，不参与后续 HTML-to-InDesign 编译。

## 2. 导出模式

### 2.1 `structured`

结构化模式。

要求：

- 文档、页面、核心对象有 `html_indesign` 标签。
- 缺少关键标签时报告 error。
- 不通过视觉猜测补语义。

用途：

- 本项目生成的 InDesign 回读。
- 人工按标签协议标注的 InDesign 回读。

输出：

- `deck.html`
- `reverse-model.json`
- `report.json`
- `assets/`

### 2.2 `observation`

观察模式。

要求：

- 不要求标签。
- 尽量保留视觉、坐标、图层、样式和资源。
- 所有未识别语义都标记为 `unknown`。

用途：

- 旧 InDesign 项目迁移。
- Agent 观察和语义化。

输出示例：

```html
<section class="page observed-page"
         data-page="observed-page-1"
         data-id-observed="true"
         data-id-margin="unknown"
         data-id-grid="unknown">
  <div class="observed-text"
       data-id-role="text"
       data-id-semantic="unknown"
       data-id-observed-id="page-1-item-12"
       style="left:20mm;top:30mm;width:100mm;height:20mm">
    项目标题
  </div>
</section>
```

### 2.3 `inferred`

推断模式。

要求：

- 不要求完整 `html_indesign` 标签。
- 可以读取旧 blueprint、旧槽位标签、母版、图层、参考线、样式、分组和几何关系。
- 每个推断出的槽位、语义、class 或容器关系必须有置信度和证据。
- 不得把推断结果冒充原始 authoring HTML。

用途：

- 迁移旧模板槽位。
- 把弱标签 InDesign 或旧 blueprint 接入新的 reverse model。
- 生成比 observation 更利于 Agent 补标的 HTML。

输出：

- `deck.html`
- `deck.inferred.html`
- `reverse-model.json`
- `report.json`
- `inferred-report.json`

## 3. 来源等级

| 来源 | 输入特征 | 反向质量 | 处理策略 |
| ---- | -------- | -------- | -------- |
| 本项目生成的 InDesign | 有完整 `html_indesign` 标签 | 最高 | 必须完整读回 |
| 人工 InDesign，按协议打标签 | 有规范脚本标签 | 高 | 正式支持 |
| 人工 InDesign，只使用模板但无标签 | 有母版和样式，语义不完整 | 中 | 输出观察 HTML 和模板线索 |
| 普通未标注 InDesign | 只有视觉对象 | 低 | 输出观察 HTML，等待 Agent 语义化 |
| 旧 blueprint 模板 | 由 `extract_blueprint.jsx` 抽出 | 中 | 通过 `legacyBlueprintToSemanticModel` 进入 `indesign-reverse`，输出 inferred/observation HTML |

首次来自人类用户的 InDesign 文档通常语义混乱，可能混入旧模板、复制来的脚本标签或不符合本项目协议的自定义标签。反向导出不得信任这些标签的存在本身，只能信任通过当前语义库白名单复核的字段。Agent 拿到观察 HTML 后，应根据页面视觉、图层、样式、资源和用户意图重建符合白名单的语义，再导回结构化 InDesign。

## 4. 产物目录

反向导出输出目录：

```text
reverse-export-<timestamp>/
  deck.visual.html
  deck.<mode>.html
  deck.html                  # compatibility alias of visual output
  reverse-model.json
  report.json
  <mode>-report.json
  author/
    deck.config.json
    deck.html                # generated from author source package
    styles/
      tokens.css
      layout.css
      components.css
      pages.css
      reverse-overrides.css
    pages/
      00-page.html
    reports/
      authoring-report.json
      inference-report.json
```

反向导出不得只生成单个超大 HTML。无论 `structured`、`inferred` 还是 `observation` 模式，都必须至少按页面拆出 `author/pages/*.html`，并生成可由组装器重建的 `author/deck.html`。

### 4.1 视觉 HTML 与作者入口

`deck.visual.html` 是视觉对照入口。`deck.<mode>.html` 是同一视觉 HTML 的模式命名入口。顶层 `deck.html` 只作为旧调用方的兼容别名，语义上仍是视觉输出。

`author/deck.html` 是可编辑作者源码包的组装结果。Agent 和人类后续维护应优先修改 `author/pages/*.html` 与 `author/styles/*.css`，再由组装器重建 `author/deck.html`。

作者源码包的目标不是像素对照，而是可继续编辑。`author/pages/*.html` 必须优先恢复原始作者标签、class、稳定属性、资源引用和可表达的父子结构。图片、PDF、SVG、AI/PSD 预览等资源元素不得退化为带 `src` 或 `data` 属性的 `div`。有网格信息的对象应保留为 CSS Grid 约束；绝对定位只用于缺少网格或无法映射的观察对象。

结构化模式输出固定语义 HTML：

```html
<main class="deck"
      data-id-document="architecture-report"
      data-id-profile="architecture-report">
  <section class="page"
           id="agenda-page"
           data-page="agenda"
           data-id-semantic="agenda"
           data-id-parent-page="report-parent"
           data-id-parent-page-name="汇报母版"
           data-id-layout="contents-grid"
           data-id-margin="14mm 16mm 10mm 18mm"
           data-id-grid="12x8"
           data-id-column-gutter="6mm"
           data-id-row-gutter="5mm"
           data-id-baseline="4mm">
    ...
  </section>
</main>
```

观察模式输出坐标保真 HTML：

```html
<main class="deck observed-deck" data-id-reverse-mode="observation">
  ...
</main>
```

### 4.2 `reverse-model.json`

完整中间模型。

`reverse-model.json` 必须是统一语义模型的序列化结果，而不是独立的第三套结构。反向导出可以在语义模型外附加 snapshot、诊断和 unresolved 信息，但 `document`、`parentPages`、`pages`、`styles`、`layers`、`assets`、`items` 的字段含义必须和 `HTML_INDESIGN_LIBRARY_SPEC.md` 中的 Canonical Mapping Model 保持一致。

旧 blueprint 输入也必须先转换成 `reverse-model.json`，不得直接绕过模型调用旧 `generator.js` 生成最终 HTML。

用途：

- 保留 HTML 不方便表达的 InDesign 信息。
- 支持 round-trip 验证。
- 支持后续工具做差异比较。

核心结构：

```json
{
  "metadata": {
    "sourceDocument": "report.indd",
    "exportedAt": "2026-05-25T00:00:00Z",
    "mode": "structured|inferred|observation",
    "semanticModelVersion": 1
  },
  "document": {
    "id": "architecture-report",
    "unitMode": "presentation",
    "coordinateUnit": "pt",
    "labels": []
  },
  "parentPages": [],
  "styles": {},
  "layers": [],
  "assets": [],
  "pages": [],
  "snapshot": {},
  "unresolved": []
}
```

### 4.3 `report.json`

诊断报告。

必须记录：

- 标签缺失。
- 标签 JSON 无效。
- 协议版本不匹配。
- 未识别对象类型。
- 资源链接丢失。
- 样式无法映射。
- 模板信息只能部分恢复。
- observation 模式中的 unknown 对象数量。
- inferred 模式中的推断来源、置信度和证据。
- 标签复核摘要：接受、局部接受、降级观察的数量和原因。

### 4.4 structured 标签矩阵

结构化模式按对象重要性决定缺失标签的处理方式：

| 对象 | 标签要求 | 缺失处理 |
| ---- | -------- | -------- |
| Document | 必须有 `kind=document` | error |
| Page | 必须有 `kind=page` | error |
| ParentPage / 母版页 | 本项目生成或被页面引用时必须有 | error；未被引用的手工母版可 warning |
| Layer | 推荐有 `kind=layer` | warning；可用图层名观察导出 |
| Style | 推荐有 `kind=style` 和稳定 token | warning；无法恢复 token 时生成 observed style |
| Guide | 网格/边距参考线必须有标签或可由页面 grid 重建 | warning；未知参考线作为 observed guide |
| Core PageItem | 文本、图框、表格、形状、线、组必须有 `kind=item` | error |
| Decorative PageItem | 纯背景、装饰线、非核心视觉元素 | warning；保留视觉但标记 `unknown` |

核心对象缺标签时，`structured` 模式不得用视觉猜测补语义；应失败或要求改用 `observation` 模式。

### 4.5 标签白名单与观察标签

`html_indesign` 标签不是通行证。反向导出必须把标签拆成两类事实：

| 类型 | 字段 | 用途 |
| ---- | ---- | ---- |
| 有效标签 | `effectiveLabel` | 通过当前语义库复核，可参与结构化 HTML 和后续正向编译 |
| 观察标签 | `observedLabel` | 未通过复核，只供 Agent、人类和报告观察，不参与编译 |

字段级规则：

- 合规字段局部有效；同一标签里不合规字段不得拖垮已经合规的语义字段。
- 不合规语义、未知布局、未知样式 token、来源不明的结构关系必须进入 `observedLabel`。
- 反向 HTML 可写出 `data-id-observed-label-status` 和 `data-id-observed-reasons`，但这些属性不等于有效语义。
- 每次从 InDesign 回读都要重新复核标签，不能因为某个标签来自上一次导出就跳过校验。
- 缺少标签的对象也必须导出视觉事实、样式事实和资源事实，不能因为没有语义而空白。

报告必须记录每个观察标签的降级原因，帮助 Agent 判断是保留、重建还是删除。

### 4.6 NAS 原位资源引用

事务所内部项目默认使用主机名 UNC 路径引用公共素材，例如：

```text
\\daga-nas5\project\assets\plan.pdf
```

反向作者 HTML 默认不打包这些原始素材。资源策略为 `reference` 时：

- `data-id-asset-path` 保留原始 UNC 或原始 InDesign 链接路径。
- 浏览器可访问路径写成发布网关约定的 `/nas/...`。
- 不把 NAS 上的图片、PDF、PSD、AI、SVG 原件复制到导出目录。
- 只有 PDF 预览图、格式转换预览图、缺少浏览器可直接显示能力的派生物，才写入导出目录缓存。

只有显式选择 `assetPolicy=copy` 时，才复制可复制素材到作者包；复制行为必须写入资源报告。

## 5. 流程

### 5.1 InDesign 侧快照脚本

新增脚本：

```text
_indesign_scripts/export_to_html_snapshot.jsx
```

职责：

- 读取当前打开的 InDesign 文档。
- 读取文档、页面、母版、样式、图层、参考线、页面对象的 `html_indesign` 标签。
- 对未标注对象抽取视觉信息。
- 输出 `reverse-snapshot.json`。

不做：

- 不生成最终 HTML。
- 不推断复杂语义。
- 不读取浏览器。

### 5.2 Node 侧反向编译器

新增模块：

```text
src/indesign-reverse/
  snapshot-reader.js
  label-protocol.js
  reverse-model.js
  legacy-blueprint.js
  html-writer.js
  asset-exporter.js
  report.js
```

职责：

- 校验 InDesign 侧 snapshot。
- 把脚本标签恢复为 semantic model。
- 把无标签对象转换为 observed item。
- 生成 `deck.html`。
- 生成 `reverse-model.json`。
- 生成 `report.json`。

### 5.3 CLI 封装

新增脚本：

```text
scripts/indesign-reverse-export.js
```

建议命令：

```powershell
node scripts/indesign-reverse-export.js --mode structured --out test/workspace/reverse-export
node scripts/indesign-reverse-export.js --mode observation --out test/workspace/reverse-observed
node scripts/indesign-reverse-export.js --blueprint test/artifacts/blueprint.json --mode inferred --out test/workspace/reverse-blueprint
```

内部流程：

```text
indesign-cli script run _indesign_scripts/export_to_html_snapshot.jsx
-> read reverse-snapshot.json
-> compile to deck.html / reverse-model.json / report.json
```

旧 blueprint 输入流程：

```text
read blueprint.json
-> legacyBlueprintToSemanticModel
-> semanticModelToHtml
-> write deck.html / deck.inferred.html / reverse-model.json / report.json / inferred-report.json
```

## 6. 模板和母版

模板分为两类：

| 类型 | 归属 | 作用 | 是否导出为 InDesign 母版 |
| ---- | ---- | ---- | ------------------------ |
| 跨页重复模板 | InDesign 母版页 | 页码、页眉页脚、章节标识、固定装饰线、永远重复的背景元素、页面参考线 | 是 |
| 页面结构模板 | HTML/Agent 侧布局约束 | 左文右图、主图图片区、多图矩阵、指标卡片区、图纸页区域等页面组织方式 | 默认否 |

规则：

- InDesign 母版只承载跨页重复结构。
- 页面结构模板属于 HTML/Agent 侧布局约束。
- `data-id-parent-page` 对应 InDesign 母版。
- `data-id-layout` 对应页面结构模板。
- 不因为 `data-id-layout="左文右图"`、`data-id-layout="四图矩阵"` 等页面结构模板自动创建同名 InDesign 母版。
- 页面结构模板应记录到页面标签和 `reverse-model.json`。
- 反向导出不根据视觉自动创建 `data-id-layout`，除非 Agent 语义化阶段明确补写。

## 7. Agent 语义化流程

未标注 InDesign 的推荐迁移流程：

```text
1. observation 模式反向导出。
2. 打开 deck.html 供 Agent 视觉检查。
3. Agent 给对象补 data-id 语义标签、class、grid、group。
4. 运行 HTML authoring validator。
5. HTML-to-InDesign 导回结构化 InDesign。
6. 新 InDesign 写入脚本标签。
7. 以后走 structured 模式双向维护。
```

如果输入是旧 blueprint，可先使用 `inferred` 模式获得槽位名、样式和资源线索，再进入补标流程。

另一条可选路径是 Agent 直接观察 InDesign 文档，根据页面结构、图层、样式和对象关系推断合规语义，并通过脚本或工具给对象写入白名单标签，再导出 HTML。该路径适合人类已经在 InDesign 中完成大量整理、但没有稳定 HTML 作者包的场景。

默认仍推荐 Agent 修改 HTML，因为 HTML 更适合审阅、diff、测试和版本管理。无论选择哪条路径，最终写回 InDesign 的都只能是通过当前语义库复核的标签。

## 8. 校验

### 8.1 标签校验

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `LABEL_PROTOCOL_MISSING` | warning/error | structured 模式为 error，observation 模式为 warning |
| `LABEL_JSON_INVALID` | error | 标签不是合法 JSON |
| `LABEL_VERSION_UNSUPPORTED` | error | 协议版本不支持 |
| `LABEL_KIND_MISMATCH` | error | 标签 kind 与宿主对象类型不符 |
| `LABEL_ID_DUPLICATED` | error | 同一作用域 ID 重复 |
| `STYLE_TOKEN_MISSING` | warning | 样式没有稳定 token |

### 8.2 反向对象校验

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `ITEM_SEMANTIC_UNKNOWN` | warning | 对象缺少语义 |
| `ITEM_TYPE_UNSUPPORTED` | warning/error | 对象类型无法映射 |
| `ASSET_LINK_MISSING` | warning/error | 链接资源丢失 |
| `TEXT_RUN_LOSSY` | warning | 局部字符样式无法完整表达 |
| `TABLE_EXPORT_LOSSY` | warning | 表格结构无法完整还原 |
| `GROUP_RELATIONSHIP_MISSING` | warning | 组关系缺失或无法恢复 |

## 9. 回环验证

反向导出完成后，应支持：

```text
HTML -> InDesign -> HTML
```

比较：

- 页面数量。
- 页面尺寸。
- 页面标签。
- 主网格和页边距。
- 对象数量。
- 对象 ID。
- 样式 token。
- 资源引用。
- 文本内容。
- 表格结构。

视觉比较作为后续增强，不作为第一阶段硬门槛。

## 10. 实施顺序

推荐阶段：

1. 前向导出写完整标签。
2. 结构化反向导出本项目生成的 InDesign。
3. observation 模式支持未标注 InDesign。
4. Agent 语义化回写。
5. 母版和页面结构模板增强。

高级 InDesign 原生能力应后移。先建立标签协议和反向骨架，再逐项补齐高级能力。
