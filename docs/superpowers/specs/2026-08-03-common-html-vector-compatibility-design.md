# 常用 HTML 图形与内联 SVG 兼容设计

## 1. 背景与缺陷证据

Luna 在真实项目中使用了标准内联 SVG：

```html
<svg viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="23" fill="#c00000" stroke="#ffffff" stroke-width="8"></circle>
</svg>
```

浏览器显示为圆点，但当前 HTML reader 只采集 `<path>`，normalizer 也只解析 `<path>`。因此 `<circle>`、`<ellipse>`、`<rect>`、`<line>`、`<polyline>` 和 `<polygon>` 都会进入一个没有矢量几何、没有子元素画笔样式的矩形 SHAPE，造成错误输出。Luna 后来改成 `div + background + border-radius: 50%` 才得到可编辑 Oval；这证明问题在翻译层，而不是作者写法异常。

最小复现还确认了三类相邻风险：

- 方形元素使用常见的 `border-radius: 9999px` 时仍被写成 Rectangle；
- 只有 `::before` / `::after` 绘制内容的元素不会进入候选集，CLI 无法提醒；
- 所有内联 SVG 当前都返回 `INLINE_SVG_UNSUPPORTED`，即使 `<path>` 已成功转成原生矢量，反馈既有误报，也不能说明具体丢失内容。

审计还发现 paint-only 候选的透明色正则会把 `rgb(238, 153, 0)`、`rgb(192, 0, 0)` 的最后一个蓝色通道 `0` 误判为 alpha 0。没有边框或其他画笔事实的橙色、红色空 `div` 会因此完全不进入快照；这是与 Luna 圆点同类的静默丢失。

## 2. 目标与边界

目标是让 Agent 按常见、自然、可在浏览器预览的 HTML 写法创作，不需要记住模型专用补丁：

1. 简单内联 SVG 基础图元直接转成可编辑 InDesign 矢量对象；
2. CSS 圆和椭圆按浏览器实际圆角语义转成 Oval；
3. 暂不能可靠翻译的常见图形写法必须在 `html.authoring_lint`、compile 和 build 中返回同一条可执行反馈；
4. Skill 在创作前说明支持范围和 CLI 消息处理方法；
5. 不修改作者源码，不新增格式专用 canonical 字段，不用栅格图掩盖静默丢失。

本轮不承诺任意 SVG、任意 CSS 绘图或任意网页完整还原。复杂 SVG 若需要完整视觉保真，应改为外部 SVG 资源置入；需要可编辑原生对象时，应拆成当前支持的基础图元。

## 3. 方案比较

### 方案 A：只修 `<circle>`

改动小，但 `<ellipse>`、`<rect>`、线和多边形仍会以同一方式失败，下一位 Agent 仍会踩坑。拒绝。

### 方案 B：全部内联 SVG 自动栅格化

视觉覆盖面大，但丢失可编辑矢量、链接和对象语义，也违背项目“翻译层生成原生对象”的原则。拒绝作为默认路径。

### 方案 C：基础图元原生化，复杂写法明确阻断

支持日常标注和示意图最常见的基础图元；无法无损解释的 `<use>`、SVG 文本/图片、变换、裁切、滤镜、paint server、复杂 path 命令等不猜测，CLI 给出位置、原因和两种改法。采用此方案。

## 4. 转换设计

### 4.1 浏览器快照

将只表达 `<path>` 的 `vectorPaths` 内部快照字段完整退役，替换为 `vectorElements`。每个元素记录：

- `tagName`；
- 原始 attributes；
- 浏览器 computed paint style；
- 是否位于定义区；
- 影响几何但尚未支持的 transform、clip、mask、filter 或 paint server 事实。

支持集合为 `path`、`circle`、`ellipse`、`rect`、`line`、`polyline`、`polygon`。`defs`、`marker` 等定义内容不作为页面图形重复输出。

paint-only 候选的透明色判断必须区分 RGB 色彩通道与 alpha：只把 computed `rgba(..., 0)`、`rgb(... / 0)` 和标准 `transparent` 视为透明，不能依据最后一个 RGB 通道是否为 0。测试至少覆盖纯红、橙色、现代斜杠 alpha 和真正透明色。

### 4.2 统一矢量几何

HTML normalizer 把基础图元映射到现有 `items[].vectorGeometry`，不新增 canonical 字段：

| HTML | canonical / InDesign |
| --- | --- |
| `circle`、`ellipse` | `kind: oval`，四段 Bézier 几何，Oval page item |
| `rect` | `kind: rectangle`，Rectangle；`rx/ry` 用 Bézier 圆角路径保留 |
| `line` | `kind: line`，GraphicLine |
| `polyline` | 开放 path |
| `polygon` | 闭合 polygon |
| `path` | 保留现有 M/L/C/Z 多子路径解析 |

坐标统一从 SVG `viewBox` 映射到页面坐标。每个图元保留自己的 fill、stroke、opacity、dash、line cap/join 和 marker 事实；多个图元继续使用现有 native group 输出。

### 4.3 CSS 圆形

- `border-radius: 50%` 的矩形在浏览器中就是椭圆，输出 Oval，不再要求宽高相等；
- 方形元素使用足以覆盖半边长的绝对圆角（例如 `9999px`、`999rem` 的计算结果可确定时）输出 Oval；
- 非方形的大绝对圆角通常是胶囊形，继续输出 rounded Rectangle，不能误判成椭圆。

### 4.4 明确阻断

以下可见内容若尚不能无损解释，兼容审计返回 `level: error`、`action: blocked`：

- 内联 SVG 中存在未支持的可见元素或几何变换；
- 仅由 `::before` / `::after` 绘制的图形；
- `clip-path`、mask、filter 或不能翻译的多色渐变；
- 依赖 CSS 边框拼出的三角形等非矩形轮廓。

消息必须包含稳定 code、pageId、itemId/sourcePath、具体不支持事实、`suggestedFix` 和 `ruleRef`。优先建议改用已支持的 SVG 基础图元；需要复杂视觉时建议保存为外部 SVG 资源。不得建议添加无关 `data-id-*` 来伪装成功。

支持的内联 SVG 返回一次 `HTML_INLINE_SVG_NORMALIZED` 非阻断消息，说明生成了哪些 native vector primitives；不再返回笼统的 `INLINE_SVG_UNSUPPORTED`。

## 5. CLI 与 Skill

`auditHtmlCompatibility` 是 lint、compile、build 的统一反馈源。浏览器 reader 的诊断事实进入该审计，不再只停留在 snapshot report。严格 lint 对 `blocked` 必须失败；安全 native 化只计入 `normalized`。

统一 Skill 的 `references/html-authoring.md` 增加：

- 基础 SVG 图元可直接使用，不需要先改写成协议专用 div；
- CSS `border-radius: 50%` 和常见圆点 div 可直接使用；
- 复杂 SVG 使用外部 `.svg` 资源，或根据 CLI 建议拆为基础图元；
- 每次先运行 lint，读取全部 `compatibility.messages`，`blocked > 0` 时必须改作者源再继续。

## 6. 验证

1. 浏览器快照与 semantic model 测试覆盖所有七种基础图元、CSS 圆/椭圆和 `9999px` 圆点；
2. paint-only 测试覆盖蓝色通道为 0 的纯色和 alpha 为 0 的透明色，确认前者被捕获、后者不产生对象；
3. 失败测试覆盖 `<use>`、伪元素圆点、clip-path 和边框三角形，确认 lint 返回可执行阻断消息；
4. instructions 测试确认 circle/ellipse 为 Oval、line 为 LINE、polygon/polyline 为原生路径；
5. 全量 `npm test`、`npm run pack:dry-run`、插件校验通过；
6. 用真实 InDesign 构建包含 Luna 原始 `<svg><circle>` 的安全样例，核对 INDD 对象类型、fill/stroke、几何和导出 PDF。

## 7. 自审结论

- 无 TBD/TODO 或双义兼容路径；
- 未新增协议字段或第二能力矩阵；
- 支持与阻断边界明确，复杂能力不以静默 fallback 冒充成功；
- 改动限定在 HTML adapter、统一 semantic geometry、InDesign writer 判型、CLI 兼容反馈、测试和统一 Skill。
