# 保真度门禁:无描边 strokeWeight 误报与文本 overset 真失败

日期:2026-08-07。来源:内部工位一次 21 页汇报重排版构建连续两次被 `FIDELITY_GATE_FAILED` 拒绝。门禁失败不进入导出阶段,INDD/PDF/IDML 从未落盘;但 outDir 保留了 instructions、读回快照和保真报告,配合遥测足以离线复现。

## 现象

`html.build_indesign` 构建成功、读回成功,门禁报 29 条差异:

- 1 × `FORWARD_VECTOR_GEOMETRY_CHANGED`(`vectorGeometry.paths`,首页整页背景路径)
- 14 × `FORWARD_TEXT_CHANGED` + 14 × `FORWARD_TEXT_RUNS_CHANGED`(连续 14 页的标题框,读回文本全部为空)

报错 headline 取 errors[0],指向矢量字段,掩盖了占 28/29 的文本问题,agent 反复改矢量与网格无效。

## 根因 A(已修):无描边路径的 strokeWeight 比对误报

SVG 规范默认 `stroke-width: 1`、`stroke: none`。期望侧事实保留 `strokeWeight: 1`,InDesign 无描边读回为 `null`;`deepEqualWithTolerance` 对"数字 vs null"直接判不等(容差只作用于双数字),单条路径即误报。坐标侧的 1e-12 级读回噪声本就在容差(1pt)内,不是失败原因。

修复:`forward-fidelity.js` 新增 `withoutPaintlessStrokeWeight`,期望与实际两侧在 `strokeColor == null` 时把 `strokeWeight` 归一为 `null` 后再比对。既有"期望 0 / 实际 null 视为 0"的特例保留。

回归:新增单测 `forward fidelity audit ignores stroke weight on a path without stroke paint`;用真实产物离线重跑审计,errors 29 → 28,消失的正是矢量误报;全量 `npm test` 通过。

## 根因 B(未修,真实缺口):行高排不进 inset 内高时整行 overset,浏览器却正常显示

失败的 14 个标题框几何一致:框高 42、上下 inset 各 10(来自 CSS `padding: 10px 14px`)、字号 24、行距 26.4。内高 42−20=22 < 26.4:

- 浏览器:行盒溢出内容盒但仍在 42px 边框盒内(`overflow: visible`),预览完全正常。
- InDesign:inset 是硬边界,整行 overset,帧内可见文本为空。

同文档另外几页标题 inset 为 0(内高 42 ≥ 行距),全部正常——对照确认机制。

门禁行为正确(拦下了真实视觉丢失),缺口在于 `authoring_lint` strict 0 error 通过,没有在作者阶段检查"行高 + 上下 padding 是否超出声明高度",agent 要等约 2 分钟真实构建后才拿到失败,且 headline 被根因 A 挤到看不见。

深层原因:编译层其实已有单行溢出自愈机制(`textFitPolicy` → `expand-frame-to-content`,保真度审计对扩帧只记 warning),但触发条件要求 `overflow: visible`;而作者框架基类 `layout.css` 对所有协议对象写死 `.id-object { overflow: hidden }`,恰好把最常见形态排除在救援之外。浏览器 `overflow: hidden` 裁到 padding 盒(字形仍可见),InDesign inset 是排版硬边界,两边语义在此错位。

已落地(0.2.7):`authoring_lint` 新增 `TEXT_FIRST_LINE_CANNOT_FIT` 规则——文本对象首行行高排不进内高(`height − 上下 padding/border`)报 error,消息含具体数值,`suggestedFix` 给出改高度/减 padding/减行高三选一;单行且 `overflow: visible`(textFit 可救)与观察态回读文本跳过。已在真实作者包上验证精确命中全部问题标题、零误报,全量单测通过。

后续方向(待定):把 textFit 救援扩展到"`overflow: hidden` 但行盒仍在 padding 盒内"的形态(浏览器可见即应构建可见),或在编译层按浏览器实际绘制收窄 inset;两者都改构建行为,必须先过真实 InDesign E2E 再评审放行。

## 关联

- 同一晚暴露的 `OUTPUT_OUTSIDE_PROJECT` 映射盘/UNC 误拒已另行修复(`path-policy.js` + `src/shared/path-containment.js`)。
- "构建被放弃时无成品、但中间产物保留"此前只体现在代码流程里,外部据此误判为版本差异;已在 `build-indesign.js` 的 `cleanupThenError` 显式标注 `artifactsExported`、`artifactNote` 和 `intermediateDir`。
- 两项修复随下一次插件版本发布;发布前该文档所述文本 overset 行为仍会导致此类构建按预期失败,headline 修复后将直接指向 `content.text`。
