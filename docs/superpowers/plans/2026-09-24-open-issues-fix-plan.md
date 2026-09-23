# 未关闭 issue 修复计划（2026-09-24）

涉及三张单：html-indesign #9、#13，indesign-cli #10。
结论来自两轮子代理核查：#9 已在本机 InDesign 20 上复现；#13 按 file:line 逐项核对过。

## 总览

| 顺序 | 事项 | 单子 | 要不要 InDesign | 大小 | 批次 |
| --- | --- | --- | --- | --- | --- |
| 1 | 渐变色块让反向导出整体崩溃 | #9 | 要（复测） | 半天 | A |
| 2 | 报告带运行标识，防止读到上一轮的旧报告 | #13 P1-2 | 不要 | M | B |
| 3 | lint 默认只回摘要，全文放进报告文件 | #13 P1-1 | 不要 | S–M | B |
| 4 | 组装时顺手重写 presentation.html | #13 P1-4 | 不要 | M | B |
| 5 | NAS 上文件被占用（EBUSY）：原子覆写加重试 | indesign-cli #10 | 不要 | S | B |
| 6 | 反向导出包的 lint 模式（网格检查降级） | #13 P2 | 不要 | S–M | B |
| 7 | 反向导出产出内容清单 | #13 P1-3 | 第一期不要 | S（第一期） | C（以后） |

批次 A、B 各开一个 PR，合并后一起发版：html-indesign 0.2.14，runtime 0.5.16。

---

## 1. #9 渐变崩溃（最先做）

**根因**：ExtendScript 解释器有个缺陷。对 DOM 对象上不存在的属性求值时，只要写成 `if (!obj.prop)`、`return !obj.prop`、`!obj.prop ? a : b` 或 `while (!obj.prop)`，报错就会绕过同一函数里的 try/catch。
`_indesign_scripts/lib/hi_reverse_styles.jsxinc:273` 的 `if (!color.colorValue) return null;` 表面上有守卫，遇到 Gradient 还是直接抛出。报错沿两条路往上走，都没有接住的地方：`HI.reverseVisualStyle`（第 4 行）和 `paragraphStyleCss` / `characterStyleCss`（第 191、207 行）。结果是页面阶段、样式阶段整体失败。

**改法**
1. 改写 `HI.reverseColor`：
   - Swatch 先用 `getElements()[0]` 解析成具体对象；是 Gradient 就交给单独的渐变处理函数。
   - 读颜色值改成 `var v = HI.reverseSafeProperty(color, "colorValue"); if (!v || !v.length) return null;`。
2. 渐变的表示：
   - `fillColor`、`strokeColor`、`textColor` 等字段仍然只放 `#hex`，取第一个色标的颜色。
   - 另外附加 `fillGradient` / `strokeGradient`，内容是 `{type, angle, stops}`。
   - report 里记一条 warning：`REVERSE_GRADIENT_APPROXIMATED`，带对象 id。
   - 不输出多色 `linear-gradient`：正向流程的兼容审计（`src/adapters/html/compatibility/audit.js:194`）会拦下它，回程构建就过不去了。
3. 渐变处理函数放进 `hi_reverse_effects.jsxinc`：`hi_reverse_styles.jsxinc` 的静态测试上限是 340 行，现在已经 319 行。
4. **全仓扫同类写法**：`_indesign_scripts` 里符合这个模式的写法共 20 处，其中 reverse 相关的 7 处。已知 `hi_reverse.jsxinc:647` 的 `if (!graphic.graphicLayerOptions)` 会以同样的方式出问题。逐处判断取反的对象是不是 DOM 对象：是就改成「先赋给变量，再对变量取反」，普通 JS 对象不用动。

**测试**
- 静态守卫（真正防回归的一条）：在 `test/indesign-executor/executor-script-static.test.js` 里加正则，禁止 JSX 库里出现「对 `对象.属性` 取反后直接用于判断或 return」。
- Node 单测：在 `test/indesign-executor/reverse-styles-node.test.js` 里放一个假 Gradient（读 `colorValue` 就抛错，带 `gradientStops`），断言返回第一个色标的颜色，并产出 warning。
- 真机复测：用复现样例 `gradient-test.indd` 跑 `npm run e2e:indesign -- -- --indd <样例>`。样例里渐变用在框填色、描边、文字、段落样式、字符样式、对象样式、表格上，另外放了一个没用到的径向渐变。探测结果按 `test/fixtures/indesign-special-characters/` 的惯例存成 fixture。
  - 注意：复现样例现在放在会话的临时目录里，开工第一步先拷进 `test/fixtures/`。

## 2. #13 P1-2 报告带运行标识

**现状**：
- 报告主文件每次都会被覆盖，内容里没有 `generatedAt`，也没有 `requestId`，只能看文件修改时间来判断新旧。
- 宿主的 request_id 只在最外层信封里生成，没有传给插件：`router.py:236` 的 `_plugin_context()` 只传 `cwd`、`session_path` 和 `host_tools`。

**改法**（先只改插件，不跨仓）
1. 插件每次调用自己生成一个 `runId`，复用 `build-indesign.js` 里 `createRunMarker()` 的思路。
2. `report-archive.js` 写报告时，在顶层统一写入 `runId`、`generatedAt`、`tool`。lint 报告、保真报告、构建报告都走这一个入口。
3. 工具返回体里带上同一个 `runId`，Agent 可以拿它和报告核对。
4. 失败时，旧的成功报告不能留在原位让人误读。两种做法：写本次失败报告前，先删掉（或改名）旧的主报告；或者主报告始终是本次结果，失败时写失败内容。以后者为准。
5. 以后如果需要，再在 `_plugin_context()` 里把宿主的 request_id 传给插件（indesign-cli 那边的小改动），这一期不做。

## 3. #13 P1-1 lint 默认只回摘要

**现状**：失败文案已经做了按错误码聚合，但 `html.authoring_lint`（`tools/authoring-lint.js:44-89`）和 `build_indesign` 的 lint 阶段（`build-indesign.js:86-107`）仍然把完整的 errors / warnings / messages 数组塞进返回体，一次就有 76–85KB。

**改法**
1. `tool-catalog.js` 的 schema 里新增 `format: "summary" | "full"`。不加的话，宿主会用 `ARGS_UNKNOWN_KEY` 拒掉这个参数。
2. summary 只回 `{ok, errorCount, warningCount, topCodes[], firstErrors[≤3], reportPath, runId}`，全文写进报告文件。**只要返回摘要，就一定落盘报告**：没传 outDir 时写到包内默认的 build 目录。

**需要你拍板**：默认值用 `summary` 还是 `full`？
- 我建议默认用 `summary`：Agent 基本不会主动传可选参数，默认值不变等于没修。
- 代价：现有依赖返回体里完整数组的调用方要改成读 reportPath。要先查 SA 那边的技能文档，以及「制作汇报文本」有没有直接读 `data.errors`。

## 4. #13 P1-4 陈旧的 presentation.html

**现状**：组装（`source-package.js:146` 的 `writeAuthorPackageEntry`，也就是 `scripts/assemble-authoring.js` 走的路径）只写 deck.html。presentation.html 只在反向导出时生成一次，之后改稿再组装，它永远停在导出那一刻。

**改法**：组装时，如果包里已经有 presentation.html，就用 `writeRevealPresentation` 同步重写。需要补一段从 deck.config.json 推出页面尺寸的逻辑；推不出来就删掉 presentation.html，并在输出里说明删了。不存在的就不新建。

## 5. indesign-cli #10 EBUSY

**改法**
- html-indesign：`writeAuthorPackageEntry` 改为先写临时文件，再改名覆盖。遇到 EBUSY / EPERM 时退避重试几次，比如 5 次、间隔逐步变长。仍然失败就报一个明确的错误码，并带 hint：「文件被占用，关闭预览或换 outDir 后重试，不要改入口文件名」。
- indesign-cli：在 `skills/indesign-cli/references/html-authoring.md` 里补一段标准处置，并写明禁止改 entry 文件名。

## 6. #13 P2 反向导出包的 lint 模式

**现状**：网格豁免已经能计数、能看见。但带观察态标记的对象（`OBSERVED` / `REVERSE_MODE==='observation'`，已有 `isObservedReverseTextItem` 这类判断）在 strict/build 下照样按 error 报网格偏移，所以当时才会一次冒出 120 条。

**改法**
1. lint 新增 `profile: "reverse-export"` 参数，要同步加进 schema。
2. 这个模式下，观察态对象的 `GRID_ALIGNMENT_OFF` 降为提示，并单独计数 `gridObservedDowngradedCount`，在首条消息里说明，保证豁免不会悄悄发生。
3. 非观察态对象照常检查。

## 7. #13 P1-3 内容清单（放到以后）

- 第一期：从 reverse-model.json 聚合出 `content-manifest.json`，内容是每页的文字块和图片路径。纯 Node 实现，规模 S。
- 「真实像素尺寸 / 长宽比」这期不做：要么在 JSX 里采 `effectivePpi`（需要真机验证），要么新增读图片文件头的依赖；PDF、AI 这类矢量素材本来也谈不上像素尺寸。
- 建议 #13 本批做完后，把 P1-3 拆成一张新单，#13 关闭。

---

## 验证与发版

- **每个 PR**：`npm test`；静态守卫和新增单测都要通过。
- **批次 A**：本机 InDesign 上跑渐变样例的 e2e。
- **批次 B**：走真实 CLI 宿主验收，不直连插件。解压新的 runtime ZIP，设好 `INDESIGN_CLI_RUNTIME_ROOT` / `INDESIGN_CLI_NODE` / `INDESIGN_CLI_SERVER_ROOT`，关掉遥测，逐项调用：
  - lint 摘要：返回体大小、reportPath 能读到全文。
  - 报告里的 runId 和返回体一致。
  - 失败时不残留旧的成功报告。
  - presentation.html 会被重写。
  - 用只读占用模拟 EBUSY，看是否触发重试和报错。
  - `profile: reverse-export` 下，观察态对象的网格偏移降为提示。
- **发版**：
  1. html-indesign 升到 0.2.14。
  2. indesign-cli 捆绑它并升到 0.5.16。
  3. 同步发到 NAS 和 SA 工具箱货架，流程照旧，别漏了 `--scope assistant`。
  4. 同步更新 indesign-cli 的技能文档：新参数 `format`、`profile`，EBUSY 处置。
- **关单**：
  - #9：发版后回复并关闭。
  - #13：做完 P1-1、P1-2、P1-4、P2 后，拆出 P1-3，然后关闭。
  - indesign-cli #10：随 0.5.16 关闭。
  - 下一期按 `cli_version>=0.5.16` 切遥测复核，不看痛点单的「still_present」。
