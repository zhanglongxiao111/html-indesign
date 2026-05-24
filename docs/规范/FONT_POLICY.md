# 字体规范

## 1. 定位

字体是 HTML 到 InDesign 视觉一致性的前置条件。

本项目不应依赖每台电脑“刚好装了差不多的字体”。团队协作时，必须使用统一字体库、统一字体 token、统一映射和转换前预检。

## 2. 强制原则

- HTML 和 InDesign 应使用同源字体。
- 项目字体优先使用授权明确的 `.ttf` / `.otf`。
- 不把 `.woff` / `.woff2` 当作 InDesign 可直接使用的字体源。
- Agent 不应随意写具体字体名，应使用项目规定的字体 token 或受控 `font-family`。
- 转换层必须保留 HTML 原始字体栈，不只保留一个猜测字体。
- 转换前必须预检 InDesign 字体可用性。缺字体时不能静默 fallback。
- 中英混排不能只套一个字体。必要时应拆分 text run，分别应用中文、英文、数字字体。

## 3. 字体库

建议建立项目字体目录：

```text
assets/fonts/
```

目录只放团队可使用、授权明确、版本固定的 `.ttf` / `.otf` 字体文件。

推荐同时维护字体清单：

| 字段 | 说明 |
| ---- | ---- |
| 字体用途 | 中文标题、中文正文、英文正文、数字、图注等 |
| CSS family | HTML 中使用的字体族名称 |
| InDesign family | InDesign 中识别的字体族名称 |
| 可用字重 | Regular、Medium、Bold 等 |
| 字体文件 | 对应 `.ttf` / `.otf` 文件 |
| 授权状态 | 是否允许团队和项目使用 |
| 替代字体 | 缺字体时的明确替代方案 |

## 4. HTML 使用方式

HTML 应优先使用字体 token，而不是散写字体名。

示例：

```css
:root {
  --font-cn-heading: "Microsoft YaHei";
  --font-cn-body: "Microsoft YaHei";
  --font-en-body: "Arial";
  --font-number: "Arial";
}

.page {
  font-family: var(--font-en-body), var(--font-cn-body), sans-serif;
}
```

对于更稳定的同源字体，应使用 `.ttf` / `.otf` 通过 `@font-face` 引入，且同一字体也要安装或暴露给 InDesign。

```css
@font-face {
  font-family: "Project Sans";
  src: url("../fonts/ProjectSans-Regular.otf") format("opentype");
  font-weight: 400;
}
```

## 5. 字体映射

转换层应维护 CSS 字体名到 InDesign 字体名的映射。

示例：

| CSS family | InDesign family | 说明 |
| ---------- | --------------- | ---- |
| `Microsoft YaHei` | `微软雅黑` | Windows 中文字体常见显示差异 |
| `Arial` | `Arial` | 英文字体 |
| `Project Sans` | `Project Sans` | 项目自带字体 |

字重和斜体也必须映射：

| CSS | InDesign 目标 |
| --- | ------------- |
| `font-weight: 400` + `normal` | `Regular` |
| `font-weight: 700` + `normal` | `Bold` |
| `font-weight: 400` + `italic` | `Italic` |
| `font-weight: 700` + `italic` | `Bold Italic` |

如果某个字体没有对应字重，转换层应报告 warning 或 error，由项目配置决定是否允许替代。

## 6. 混排规则

浏览器会按字符 fallback 字体。InDesign 不能只靠段落样式自动复现这个行为。

转换层应保留字体栈：

```json
{
  "fontFamilyStack": ["Arial", "Microsoft YaHei", "sans-serif"],
  "fontWeight": "700",
  "fontStyle": "normal"
}
```

当同一段文本包含中英混排时，转换层应按字符类别拆分 run：

| 文本类别 | 字体策略 |
| -------- | -------- |
| 中文 | 中文字体 token 或字体栈中的中文字体 |
| 英文 | 英文字体 token 或字体栈中的英文字体 |
| 数字 | 数字字体 token；未配置时跟随英文 |
| 标点 | 优先跟随相邻文本；无法判断时跟随中文 |

## 7. 预检

执行 InDesign 构建前必须检查：

- 指令中引用的字体 family 是否可用。
- 指令中引用的字重和斜体样式是否可用。
- 项目字体文件是否存在。
- CSS family 到 InDesign family 的映射是否完整。

预检输出必须结构化，至少包含：

```json
{
  "valid": false,
  "errors": [
    {
      "code": "FONT_NOT_AVAILABLE",
      "cssFamily": "Project Sans",
      "indesignFamily": "Project Sans",
      "fontStyleName": "Bold"
    }
  ]
}
```

## 8. 团队使用

面向同事交付时，应先完成字体准备：

1. 确认项目公共字体清单。
2. 确认字体授权。
3. 把字体文件纳入受控目录或统一安装包。
4. 提供一键字体检查脚本。
5. 在转换前强制跑字体预检。

没有完成字体准备时，不能承诺 HTML 与 InDesign 视觉一致。
