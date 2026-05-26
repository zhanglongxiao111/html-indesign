---
name: html-indesign-authoring
description: 当 Agent 编写或修改 html-indesign 固定分页 HTML 作者包时使用，尤其是需要浏览器预览、转换到 InDesign、再反向导回 HTML 的建筑汇报页面。
---

# HTML InDesign 作者规则

## 核心规则

写作者源码包，不要写一次性的巨大 HTML 文件。HTML 必须能自然浏览器预览，同时用稳定语义和网格规则让翻译层能生成高质量 InDesign 文档。

## 作者包结构

使用这个结构：

```text
deck.config.json
pages/*.html
styles/tokens.css
styles/layout.css
styles/components.css
styles/pages.css
assets/
deck.html
```

只编辑 `pages/*.html` 和 `styles/*.css`。`deck.html` 是组装产物，不要手改。

## 页面规则

每个页面片段只能有一个 `<section class="page">`。不要在 `pages/*.html` 里写 `<!doctype>`、`<html>`、`<head>` 或 `<body>`。

每页必须声明页面身份、布局意图、边距和主网格。母版页和 baseline 按需要声明：

```html
data-page="stable-page-id"
data-id-layout="stable-layout-token"
data-id-margin="top right bottom left"
data-id-grid="columns 或 columnsxrows"
data-id-column-gutter="可选栏间距"
data-id-row-gutter="可选行间距"
data-id-baseline="可选 baseline"
data-id-parent-page="可选母版稳定 ID"
```

## 可变网格，不是固定模板

网格是版面契约，不是死模板。`12x8` 只是建筑汇报的常用默认；也可以根据页面选择 `6x6`、`12x6`、`16x9`、只声明 `12` 列，或用可解析的 CSS Grid。栏间距、行间距、边距和 baseline 也应按页面需求设置。

先定网格，再放元素。推荐用 `.grid-item` 表达顶层元素占用的网格区域；只要使用 `.grid-item`，就必须声明四个网格变量：

```html
style="--grid-col:1;--grid-span:4;--grid-row:2;--grid-row-span:1"
```

如果不用 `.grid-item`，仍要保证浏览器布局清楚、元素关键边缘贴合页面声明的主网格，并通过 `lint:authoring --strict`。这样能给 Agent 保留排版自由，但不会牺牲可转换性。

## 语义字段边界

字段名是协议，token 值是项目稳定标识。不要把下面的示例理解成唯一词表。

固定字段名：

- 文字：`data-id-paragraph-style`、`data-id-character-style`
- 对象：`data-id-object`、`data-id-object-style`、`data-id-frame-style`
- 图层：`data-id-layer`
- 表格：`data-id-table-style`、`data-id-cell-style`
- 资源：`data-id-asset-kind`、`data-id-fit`、`data-id-pdf-page`、`data-id-crop`

大多数 token 值可以由项目扩展，例如 `page-title`、`metric-card`、`site-plan-frame`、`section-note`。它们必须稳定、可复用，并由 CSS、项目 preset 或测试覆盖支撑。少数字段有枚举含义，例如 `data-id-asset-kind` 通常是 `raster`、`pdf`、`psd`、`ai`、`svg`，`data-id-fit` 通常是 `cover`、`contain`、`fill`、`none`，`data-id-crop` 对 PDF/AI 有固定导入含义。

样式优先放到 CSS 类里，内联 style 主要保留给网格定位变量或确实局部的几何信息。

图片、SVG、PDF、AI、PSD 置入应使用真实资源元素和相对路径。除非用户明确要求只做预览假图，否则不要用装饰截图替代可置入资源。

## 必跑自检

修改源码后必须先组装，再严格检查：

```powershell
npm run assemble:authoring -- -- --package <deck.config.json>
npm run lint:authoring -- -- --package <deck.config.json> --strict
```

需要给工具或 Agent 解析结果时用 JSON：

```powershell
npm run lint:authoring -- -- --package <deck.config.json> --strict --json
```

`lint:authoring` 会检查作者包源码格式、`deck.html` 是否同步、浏览器快照规则、网格对齐和语义 token 覆盖。

## 互转流程

编辑时先用轻量自检。只有用户要求生成 ID/PDF、你修改了转换链路、或你要声明页面可回环时，才运行真实 InDesign。

HTML 转 InDesign：

```powershell
npm run e2e:indesign -- -- --html <deck.html>
```

常用选项：

```powershell
npm run e2e:indesign -- -- --html <deck.html> --target-size qhd
npm run e2e:indesign -- -- --html <deck.html> --skip-preview
```

真实 E2E 会在 `test/workspace/indesign-e2e-<timestamp>/` 下写出 `INDD`、`PDF`、`IDML`、`instructions.json` 和报告。判断结果时要看 `counts.oversetTextFrames`、缺失资源、PDF 验证和 warning。

HTML 转 InDesign 再转 HTML：

```powershell
npm run e2e:indesign -- -- --html <deck.html> --reverse-roundtrip
```

稳定回环门禁：

```powershell
npm run e2e:indesign -- -- --html <deck.html> --reverse-roundtrip --second-pass-roundtrip
```

用这个检查反向出来的作者包是否进入无漂移状态。反向作者入口是 `reverse-html/author/deck.html`；视觉兼容入口是 `reverse-html/deck.html`。

已有 InDesign snapshot 转 HTML：

```powershell
npm run reverse:indesign -- -- --snapshot <reverse-snapshot.json> --out <out-dir> --source-root <author-root>
```

这会把已导出的反向快照转成视觉 HTML 和可编辑作者包。知道原始作者包目录时必须传 `--source-root`，这样才能保留资源、配置元数据和源码结构。

源码漂移审计：

```powershell
node scripts/audit-reverse-author-roundtrip.js --source <source-author-root> --reverse <reverse-author-root> --strict --drift
```

比较规范化后的反向作者包和后续反向包时，加 `--fail-on-drift`。原始手写源码和第一轮反向包可能存在预期规范化差异；第一轮反向包到后续反向包应该保持稳定。

## 禁止事项

- 不要手改生成的 `deck.html`。
- 不要把页面片段写成完整 HTML 文档。
- 不要遗漏 `.grid-item` 的网格坐标。
- 不要在已有稳定语义 token 时临时发明一次性 class。
- 不要用白块、重复图片、浏览器专用补丁掩盖转换缺口。
