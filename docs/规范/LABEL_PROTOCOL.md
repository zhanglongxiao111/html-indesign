# InDesign 标签协议

## 1. 定位

标签协议是 HTML 与 InDesign 双向转换的稳定边界。

```text
HTML data-id-* 标签
<-> 统一语义模型
<-> InDesign html_indesign 脚本标签
```

模板不是协议本身。模板只是批量提供标签、样式和布局约束的载体。

## 2. 标签键

新协议统一使用 InDesign 脚本标签键：

```text
html_indesign
```

值必须是 JSON 字符串。

兼容读取：

| 来源 | 处理 |
| ---- | ---- |
| `pageItem.label` 中的 `html-indesign:id=...` | 旧调试标签，作为对象 ID、role、type 的兜底 |
| `html_indesign_guide` | 旧参考线标签，继续读取为 guide 标签 |
| 母版对象 `label` | 旧 blueprint 槽位标签，读取为 `legacySlotLabel` |
| `build_last_result` | 构建报告，不作为语义标签 |

## 3. 通用字段

所有 `html_indesign` 标签必须包含：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "page-1-title",
  "source": "html-to-indesign"
}
```

| 字段 | 含义 |
| ---- | ---- |
| `protocol` | 固定为 `html-indesign` |
| `version` | 标签协议版本 |
| `kind` | `document`、`page`、`parentPage`、`item`、`style`、`layer`、`guide` |
| `id` | 稳定 ID，同一作用域内唯一 |
| `source` | `html-to-indesign`、`manual-tagged`、`legacy-blueprint`、`agent-semanticized` |

命名规则：

- `id`、`token`、`parentPageId`、`layerToken`、`styleRefs.*Token` 是稳定协议字段，供 HTML、语义模型和自动化工具使用。
- `name`、`displayName`、`parentPageName`、`layerName`、`styleRefs.*Name` 是 InDesign 面板显示名，可以本地化为中文。
- 双向转换不得只依赖中文显示名恢复语义。

单位规则：

- 标签中的裸数字几何值默认使用文档标签的 `coordinateUnit`。
- `presentation` 模式默认 `coordinateUnit: "pt"`，`print` 模式默认 `coordinateUnit: "mm"`。
- 字段名明确带 `Px`、`Mm`、`Pt`，或字段值写成 `{ "value": 12, "unit": "mm" }` 时，以字段自身单位为准。
- 反向导出写 HTML 时，应把 InDesign 几何值按 `coordinateUnit` 转回 CSS 或 `data-id-*` 可读单位。

## 4. 文档标签

目标对象：`Document`。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "document",
  "id": "architecture-report",
  "title": "建筑汇报",
  "profile": "architecture-report",
  "unitMode": "presentation",
  "coordinateUnit": "pt",
  "assetRoot": "assets",
  "createdBy": "html-indesign"
}
```

用途：

- 识别文档是否属于本协议。
- 记录单位模式和页面策略。
- 记录资源根目录。
- 记录项目 preset 或语义配置。

## 5. 页面标签

目标对象：`Page`。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "page",
  "id": "agenda-page",
  "semantic": "agenda",
  "htmlTag": "section",
  "className": "page",
  "parentPageId": "report-parent",
  "parentPageName": "汇报母版",
  "layout": "contents-grid",
  "margins": { "top": 14, "right": 16, "bottom": 10, "left": 18 },
  "grid": {
    "columns": 12,
    "rows": 8,
    "columnGutter": 6,
    "rowGutter": 5,
    "baseline": 4
  }
}
```

规则：

- `parentPageId` / `parentPageName` 对应 InDesign 母版页。
- `parentPageId` 是稳定引用；`parentPageName` 是 InDesign 面板显示名。
- `layout` 对应 HTML/Agent 侧页面结构模板，不自动变成 InDesign 母版。
- `margins`、`grid`、`baseline` 等裸数字使用文档 `coordinateUnit`，必须能反向生成 HTML 页面约束。

## 6. 母版页标签

目标对象：`MasterSpread` 或母版页对象。

母版页标签：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "parentPage",
  "id": "report-parent",
  "name": "汇报母版",
  "semantic": "report-parent",
  "provides": ["folio", "header-line", "chapter-marker"]
}
```

母版对象标签：

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "parent-folio",
  "role": "text",
  "semantic": "folio",
  "scope": "parentPage",
  "htmlTag": "span",
  "className": "page-number"
}
```

母版页只承载跨页重复结构：

- 页码。
- 页眉页脚。
- 章节标识。
- 固定装饰线。
- 永远重复的背景元素。
- 页面参考线。

不应为“左文右图”“四图矩阵”“单图页”等页面结构模板批量创建 InDesign 母版。

## 7. 样式标签

目标对象：

- 段落样式。
- 字符样式。
- 对象样式。
- 框架样式。
- 表格样式。
- 单元格样式。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "style",
  "id": "style-paragraph-page-title",
  "styleKind": "paragraph",
  "token": "page-title",
  "displayName": "页面标题",
  "htmlClass": "page-title"
}
```

用途：

- 从 InDesign 中文样式名恢复稳定 token。
- 从 token 恢复 HTML class 和 `data-id-*`。
- 避免每个 Agent 自行维护语义映射表。

## 8. 图层标签

目标对象：`Layer`。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "layer",
  "id": "drawing",
  "token": "drawing",
  "displayName": "图纸",
  "order": 20
}
```

图层 token 应稳定，面板显示名可以本地化。

## 9. 对象标签

目标对象：页面对象。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "item",
  "id": "agenda-title",
  "role": "text",
  "semantic": "page-title",
  "htmlTag": "h2",
  "className": "page-title grid-item",
  "layerToken": "text",
  "layerName": "文字",
  "styleRefs": {
    "paragraphStyleToken": "page-title",
    "paragraphStyleName": "页面标题",
    "objectStyleToken": null,
    "objectStyleName": null,
    "frameStyleToken": null,
    "frameStyleName": null
  },
  "grid": {
    "col": 1,
    "span": 4,
    "row": 2,
    "rowSpan": 1
  }
}
```

### 文本对象扩展

```json
{
  "role": "text",
  "text": {
    "preserveRuns": true,
    "runs": true
  }
}
```

### 图框对象扩展

```json
{
  "role": "graphic",
  "asset": {
    "kind": "pdf",
    "relativePath": "drawings/floor-01.pdf",
    "pageNumber": 1,
    "crop": "trim",
    "fit": "contain"
  }
}
```

### 表格对象扩展

```json
{
  "role": "table",
  "table": {
    "headerRows": 1,
    "source": "native-table"
  }
}
```

### 组对象扩展

```json
{
  "role": "group",
  "semantic": "case-card",
  "children": ["case-title", "case-image", "case-caption"]
}
```

## 10. 参考线标签

目标对象：InDesign guide。

```json
{
  "protocol": "html-indesign",
  "version": 1,
  "kind": "guide",
  "id": "page-1-grid-x-01",
  "source": "grid",
  "axis": "x",
  "position": 18,
  "pageId": "agenda-page"
}
```

`position` 使用文档 `coordinateUnit`。参考线必须来自页面约束、网格、边距或显式 guide。不得默认用对象边缘反推主网格。

## 11. 校验错误

| 检查 | 等级 | 说明 |
| ---- | ---- | ---- |
| `LABEL_PROTOCOL_MISSING` | warning/error | structured 模式为 error，observation 模式为 warning |
| `LABEL_JSON_INVALID` | error | 标签不是合法 JSON |
| `LABEL_VERSION_UNSUPPORTED` | error | 协议版本不支持 |
| `LABEL_KIND_MISMATCH` | error | 标签 kind 与宿主对象类型不符 |
| `LABEL_ID_DUPLICATED` | error | 同一作用域 ID 重复 |
| `STYLE_TOKEN_MISSING` | warning | 样式没有稳定 token |

## 12. 写入要求

HTML -> InDesign 前向导出时，必须写入：

- 文档标签。
- 页面标签。
- 母版页标签。
- 母版对象标签。
- 样式标签。
- 图层标签。
- 参考线标签。
- 页面对象标签。

紧凑 `pageItem.label` 只用于人类面板和旧调试兼容，不能替代 `html_indesign` JSON 标签。

前向 instructions 必须显式携带这些标签，或携带足以由 executor 确定性合成相同标签的稳定字段。关键标签写入失败必须进入 error 并阻止假成功；非关键兼容标签写入失败至少进入 warning 和执行报告。
