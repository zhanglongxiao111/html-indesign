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

反向导出以 `docs/规范/LABEL_PROTOCOL.md` 为语义来源。

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

### 2.3 `blueprint-legacy`

兼容模式。

继续使用旧链路：

```text
extract_blueprint.jsx -> blueprint.json -> generator.js -> template preview HTML
```

用途：

- 查看旧模板。
- 迁移旧模板槽位。
- 兼容历史测试资产。

限制：

- 不作为新的双向转换主线。
- 不保证生成当前 `paged-html` 协议。

## 3. 来源等级

| 来源 | 输入特征 | 反向质量 | 处理策略 |
| ---- | -------- | -------- | -------- |
| 本项目生成的 InDesign | 有完整 `html_indesign` 标签 | 最高 | 必须完整读回 |
| 人工 InDesign，按协议打标签 | 有规范脚本标签 | 高 | 正式支持 |
| 人工 InDesign，只使用模板但无标签 | 有母版和样式，语义不完整 | 中 | 输出观察 HTML 和模板线索 |
| 普通未标注 InDesign | 只有视觉对象 | 低 | 输出观察 HTML，等待 Agent 语义化 |
| 旧 blueprint 模板 | 由 `extract_blueprint.jsx` 抽出 | 兼容 | 保留 legacy-template 路径 |

## 4. 产物目录

反向导出输出目录：

```text
reverse-export-<timestamp>/
  deck.html
  reverse-model.json
  report.json
  assets/
    ...
```

### 4.1 `deck.html`

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
    "mode": "structured",
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
```

内部流程：

```text
cli-anything-indesign script run _indesign_scripts/export_to_html_snapshot.jsx
-> read reverse-snapshot.json
-> compile to deck.html / reverse-model.json / report.json
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

Agent 不应直接修改 InDesign 标签。Agent 应修改 HTML，因为 HTML 更适合审阅、diff、测试和版本管理。

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
