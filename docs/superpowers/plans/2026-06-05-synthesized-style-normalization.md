# Synthesized Style Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把人工 InDesign 反向导出中的重复字体、段落、对象、线条、图框和置入属性归并为稳定的合成样式，InDesign 面板显示中文样式名，机器链路使用稳定 token；最终用真实人工 ID 的结构化 diff 证明 P0 为 0、二轮稳定错误为 0，并把样式相关 P1 清零，剩余 P1 必须被量化归类到非样式缺口或继续收敛到 0。

**Architecture:** 新增一个独立的合成样式层，位于格式适配器与统一语义模型之间。InDesign Adapter 提取对象原子样式并生成 `styles.synthesized`，HTML Writer/Reader 原样承载样式 token 与中文名，InDesign Writer 把合成样式编译为原生段落样式、字符样式、对象样式、图框样式和线条样式，Executor 只执行已验证 instructions，不做语义推理。`style-compiler.js` 不继续变成超大协调器，新增逻辑必须拆入小模块。

**Tech Stack:** Node.js CommonJS、`node:test`、协议字段注册表、固定语义 HTML 作者包、InDesign instructions、ExtendScript JSX、`indesign-cli` 真实 InDesign E2E。

---

## Scope

本计划实现 `docs/superpowers/specs/2026-06-05-synthesized-style-normalization-design.md` 中的合成样式规范。

纳入本轮：

- 文本样式原子：字体、字号、字重、颜色、行距、字距、段落对齐、缩进、段前段后。
- 对象样式原子：填充、描边、圆角、透明度、混合模式、投影等效果。
- 线条样式原子：线宽、线色、虚线样式、端点、箭头、线帽、线连接。
- 图框和资源置入原子：图框描边/填充、内容裁切框、缩放、偏移、拟合策略。
- 样式名策略：InDesign 面板展示中文名，协议与 diff 使用稳定 ASCII token。
- 样式与覆盖边界：相同配置归并为一个合成样式，单对象差异保留为 `styleOverrides`，不得吞掉为样式。
- 真实人工 ID 门禁：使用既有 `260331_永定湾展示中心汇报.indd` 反向快照和二轮回环链路量化效果。

不纳入本轮：

- 语义识别，例如把某个文字判断为标题、图注、注释。
- 根据图层名、图层顺序推断语义。
- 新增 PPTX 写出能力。
- 在 HTML 作者侧强迫用户写特殊结构来配合 InDesign。

## Current Baseline

执行前以当前主分支重新确认基线，不能直接相信旧报告。

建议基线命令：

```powershell
npm test
npm run audit:effective-diff -- --expected test/workspace/human-indesign-nested-parent-fix-20260605/original-reverse-snapshot.json --actual test/workspace/human-indesign-nested-parent-fix-20260605/second-pass-reverse-snapshot.json --stability-audit test/workspace/human-indesign-nested-parent-fix-20260605/reverse-snapshot-audit-second.json --out test/workspace/human-indesign-nested-parent-fix-20260605/effective-diff-audit-before-synth-style.json
```

预期基线形态：

- `p0.count === 0`
- 二轮稳定审计 `ok === true`
- P1 主要集中在 visual style、bounds、missing/extra、vector geometry、asset placement。

如果文件路径已变化，先用同一份真实人工 ID 重新跑完整 E2E，不允许改用小 fixture 代替最终验收。

## Target Metrics

硬门槛：

- `audit:effective-diff` 中 `p0.count === 0`。
- 二轮稳定审计错误数为 0。
- 合成样式审计通过：无未登记合成字段、无缺中文名、无 token 冲突、无孤儿样式引用。
- 样式相关 P1 为 0：
  - `REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED`
  - 由样式类型变化造成的 `REVERSE_SNAPSHOT_ITEM_MISSING`
  - 由样式类型变化造成的 `REVERSE_SNAPSHOT_ITEM_EXTRA`
  - `REVERSE_SNAPSHOT_VECTOR_GEOMETRY_CHANGED`
  - `REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED`
- 若最终 `p1.count` 未到 0，必须输出机器可读分类报告，证明剩余项不是合成样式层职责，并给出下一计划入口；不能用人工解释替代报告。

目标门槛：

- 真实人工 ID 的有效 P1 总数降到 0。
- 如果 text frame 高度类差异仍存在，必须通过报告证明内容未丢、文本框几何策略一致，并单独登记为文本框拟合缺陷，不混在样式缺陷中。

## Planned File Changes

新增文件：

- `src/semantic-model/style-atoms.js`：从语义模型 item 提取文本、对象、线条、图框、资源置入样式原子。
- `src/semantic-model/synthesized-styles.js`：生成 fingerprint、稳定 token、中文 displayName、合成样式 registry、item 样式引用和覆盖字段。
- `src/writers/html/synthesized-style-attrs.js`：HTML 作者包写出合成样式引用属性。
- `src/writers/indesign/synthesized-style-instructions.js`：把合成样式映射到现有 InDesign 原生样式 instructions。
- `src/adapters/indesign/audit/synthesized-style-audit.js`：合成样式完整性审计。
- `scripts/audit-synthesized-styles.js`：命令行审计入口。
- `test/semantic-model/synthesized-styles.test.js`
- `test/indesign-reverse/synthesized-style-normalizer.test.js`
- `test/indesign-reverse/synthesized-style-author-package.test.js`
- `test/paged-html/synthesized-style-compiler.test.js`
- `test/indesign-executor/synthesized-style-executor-static.test.js`

修改文件：

- `src/protocol/fields/styles.js`
- `src/protocol/scanners/model-surface-paths.js`
- `src/adapters/indesign/normalizer/snapshot-to-model.js`
- `src/writers/html/author-package-writer.js`
- `src/writers/html/author-node-attrs.js`
- `src/writers/html/author-css-writer.js`
- `src/adapters/html/normalizer/snapshot-to-model.js`
- `src/adapters/html/reader/source-metadata.js`
- `src/writers/indesign/style-compiler.js`
- `src/writers/indesign/style-identities.js`
- `src/writers/indesign/instruction-writer.js`
- `_indesign_scripts/lib/hi_styles.jsxinc`
- `_indesign_scripts/build_from_instructions.jsx`
- `package.json`
- `docs/规范/PROTOCOL_FIELD_REGISTRY.md`

约束：

- `src/writers/indesign/style-compiler.js` 只允许接线和小范围整理；新增主体逻辑必须进入 `synthesized-style-instructions.js` 或更小 helper。
- `_indesign_scripts/lib/hi_styles.jsxinc` 不继续堆长函数；虚线、箭头、混合模式等细节如需扩展，拆成独立 include。
- 所有新增 canonical 字段先进入 `src/protocol/`，再接入 adapter/writer/executor/tests。

## Implementation Tasks

### 0. 准备执行环境

- [x] 本轮用户已明确授权直接在 `main` 执行；确认不把临时文件写到用户主目录。
- [x] 运行 `git status --short --branch`，记录当前分支和脏文件：`main...origin/main [ahead 10]`，工作区干净。
- [x] 运行 `npm test`，确认主分支基线通过：675 个测试通过，0 失败。
- [x] 重新生成真实人工 ID 当前 effective diff 基线，保存为 `test/workspace/human-indesign-nested-parent-fix-20260605/effective-diff-audit-before-synth-style.json`：P0=0、P1=825、P2=632、二轮稳定通过；P1 分类为 visual style 528、bounds 135、missing 95、extra 59、vector geometry 4、asset placement 3、field 1。

验收命令：

```powershell
git status --short --branch
npm test
npm run audit:effective-diff -- --expected <original-reverse-snapshot.json> --actual <roundtrip-or-second-pass-reverse-snapshot.json> --stability-audit <reverse-snapshot-audit.json> --out <before-report.json>
```

预期：

- `npm test` 通过。
- baseline 报告能列出 P1 分类。

### 1. 登记合成样式协议字段

- [x] 在 `src/protocol/fields/styles.js` 登记 `styles.synthesized[]` 字段族。
- [x] 登记 `items[].styleRefs.synthesizedToken` 和 `items[].styleRefs.synthesizedName`；`synthesizedName` 不重复占用已有 `data-id-style-name`，HTML 显示名继续走 `styleRefs.displayName`。
- [x] 登记 `items[].styleOverrides`，按 text/object/line/frame/asset 子域拆分。
- [x] 更新 `src/protocol/scanners/model-surface-paths.js`，让扫描器知道新增模型表面。
- [x] 添加协议测试，先让新增字段缺失时失败。
- [x] 重新生成 `docs/规范/PROTOCOL_FIELD_REGISTRY.md`。

建议测试文件：`test/protocol/synthesized-style-fields.test.js`

RED 测试要点：

```js
test('synthesized style fields are registered with lifecycle and capabilities', () => {
  const fields = loadProtocolFields();
  assertField(fields, 'styles.synthesized[].token');
  assertField(fields, 'styles.synthesized[].displayName');
  assertField(fields, 'styles.synthesized[].kind');
  assertField(fields, 'styles.synthesized[].fingerprint');
  assertField(fields, 'items[].styleRefs.synthesizedToken');
  assertField(fields, 'items[].styleOverrides');
});
```

验收命令：

```powershell
node --test test/protocol/synthesized-style-fields.test.js
node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
git diff -- docs/规范/PROTOCOL_FIELD_REGISTRY.md
```

预期：

- 新字段在 registry 和生成文档中同时出现。
- 每个字段都有 lifecycle、canonical 路径、HTML/InDesign 能力声明。

### 2. 实现样式原子提取与稳定 fingerprint

- [ ] 新建 `src/semantic-model/style-atoms.js`。
- [ ] 新建 `src/semantic-model/synthesized-styles.js`。
- [ ] 对文本、段落、对象、线条、图框、资源置入分别提取可比较原子。
- [ ] 对原子属性做稳定排序、单位归一和空值剔除。
- [ ] 生成稳定 fingerprint，不依赖对象 id、页面号、图层名或遍历顺序。
- [ ] 生成稳定 ASCII token，例如 `synth_text_001`、`synth_line_003`。
- [ ] 生成中文 displayName，例如 `文字样式 01`、`线条样式 03`、`图框样式 02`。
- [ ] 相同 fingerprint 必须归并为同一个合成样式。
- [ ] 单对象差异进入 `styleOverrides`，不得新造无意义样式。

建议测试文件：`test/semantic-model/synthesized-styles.test.js`

RED 测试要点：

```js
test('merges identical text atoms into one synthesized style with Chinese display name', () => {
  const model = buildModelWithTwoTextItemsUsingSameVisualTextStyle();
  const result = normalizeSynthesizedStyles(model);

  assert.equal(result.styles.synthesized.length, 1);
  assert.equal(result.styles.synthesized[0].kind, 'text');
  assert.equal(result.styles.synthesized[0].displayName, '文字样式 01');
  assert.match(result.styles.synthesized[0].token, /^synth_text_\d{3}$/);
  assert.equal(result.items[0].styleRefs.synthesizedToken, result.items[1].styleRefs.synthesizedToken);
});

test('keeps item-only difference as override instead of splitting semantic style', () => {
  const model = buildModelWithOneTextItemHavingLocalColorOverride();
  const result = normalizeSynthesizedStyles(model);

  assert.equal(result.styles.synthesized.length, 1);
  assert.deepEqual(result.items[1].styleOverrides.text.color, '#ff0000');
});
```

验收命令：

```powershell
node --test test/semantic-model/synthesized-styles.test.js
```

预期：

- 同配置归并。
- 中文 displayName 稳定。
- token 稳定。
- 覆盖字段只记录真实局部差异。

### 3. 接入 InDesign 反向 normalizer

- [ ] 在 `src/adapters/indesign/normalizer/snapshot-to-model.js` 中调用合成样式层。
- [ ] 保留原始 InDesign 样式名作为观察事实和优先样式来源。
- [ ] 有有效原始样式时，优先把原始样式映射为 styleRef；合成样式只补齐未样式化或样式不完整对象。
- [ ] 原始样式内无法表达的局部属性进入 `styleOverrides`。
- [ ] 不把图层名、对象名或页面号纳入 fingerprint。
- [ ] 对 shape/text/image/pdf/line 都覆盖测试。

建议测试文件：`test/indesign-reverse/synthesized-style-normalizer.test.js`

RED 测试要点：

```js
test('reverse snapshot creates synthesized line style from unstyled dashed arrows', () => {
  const snapshot = reverseSnapshotWithTwoDashedArrowLines();
  const model = reverseSnapshotToSemanticModel(snapshot);

  const lineStyles = model.styles.synthesized.filter((style) => style.kind === 'line');
  assert.equal(lineStyles.length, 1);
  assert.equal(lineStyles[0].displayName, '线条样式 01');
  assert.equal(model.items[0].styleRefs.synthesizedToken, lineStyles[0].token);
  assert.equal(model.items[1].styleRefs.synthesizedToken, lineStyles[0].token);
});
```

验收命令：

```powershell
node --test test/indesign-reverse/synthesized-style-normalizer.test.js
```

预期：

- 反向模型中有 `styles.synthesized`。
- 对象有 `styleRefs.synthesizedToken`。
- 视觉属性仍完整保留，不能因为生成样式而删掉原始可验证事实。

### 4. HTML 作者包写出合成样式

- [ ] 在 `src/writers/html/author-package-writer.js` 中把 `styles.synthesized` 写入作者包元数据。
- [ ] 在 `src/writers/html/author-node-attrs.js` 中写出对象级 `data-id-style-token` 和 `data-id-style-name`。
- [ ] 在 `src/writers/html/author-css-writer.js` 中生成中文注释或结构化映射，但 CSS class 仍使用稳定 token。
- [ ] 确保 `deck.html` 仍可浏览器自然预览。
- [ ] 不把合成样式误写成语义标签，例如 title/caption/material。

建议测试文件：`test/indesign-reverse/synthesized-style-author-package.test.js`

RED 测试要点：

```js
test('author package preserves synthesized style token and Chinese name', () => {
  const output = writeReverseAuthorPackage(modelWithSynthesizedStyles());

  assert.match(output.deckHtml, /data-id-style-token="synth_line_001"/);
  assert.match(output.deckHtml, /data-id-style-name="线条样式 01"/);
  assert.match(output.deckConfig, /"displayName": "线条样式 01"/);
});
```

验收命令：

```powershell
node --test test/indesign-reverse/synthesized-style-author-package.test.js
```

预期：

- 作者包里能看到中文样式名。
- CSS/HTML 的机器引用稳定。
- 浏览器预览不依赖 InDesign 特殊补丁。

### 5. HTML Adapter 回读合成样式

- [ ] 在 `src/adapters/html/reader/source-metadata.js` 读取作者包中的合成样式 registry。
- [ ] 在 `src/adapters/html/normalizer/snapshot-to-model.js` 恢复 `styleRefs.synthesizedToken`、`synthesizedName` 和 `styleOverrides`。
- [ ] 若 HTML 中引用不存在的 token，必须报审核问题，不得静默生成新样式。
- [ ] 若 token 和中文名不一致，以 token 为机器事实、中文名为显示事实，并记录审核项。

建议测试文件：`test/paged-html/synthesized-style-reader.test.js`

RED 测试要点：

```js
test('html adapter restores synthesized style references from author package metadata', () => {
  const model = htmlAuthorPackageToSemanticModel(authorPackageWithSynthesizedStyles());

  assert.equal(model.styles.synthesized[0].token, 'synth_text_001');
  assert.equal(model.items[0].styleRefs.synthesizedToken, 'synth_text_001');
  assert.equal(model.items[0].styleRefs.synthesizedName, '文字样式 01');
});
```

验收命令：

```powershell
node --test test/paged-html/synthesized-style-reader.test.js
```

预期：

- HTML -> model 不丢合成样式。
- 无效引用会进入报告或错误。

### 6. InDesign Writer 编译为原生样式

- [ ] 新建 `src/writers/indesign/synthesized-style-instructions.js`，把合成样式拆到 paragraph/character/object/frame/table/line 等现有 style instruction。
- [ ] 更新 `src/writers/indesign/style-identities.js`，样式 identity 使用 token，displayName 使用中文。
- [ ] 修改 `src/writers/indesign/style-compiler.js`，只负责调用新增 helper 和合并结果。
- [ ] 对 item 先应用合成样式，再应用 `styleOverrides`。
- [ ] 对原始有效样式和合成样式冲突做显式诊断。
- [ ] 保证 InDesign 面板里的样式名为中文。

建议测试文件：`test/paged-html/synthesized-style-compiler.test.js`

RED 测试要点：

```js
test('compiles synthesized line style to native InDesign style with Chinese display name', () => {
  const instructions = modelToInDesignInstructions(modelWithSynthesizedLineStyle());

  const style = instructions.styles.objectStyles.find((item) => item.name === '线条样式 01');
  assert.ok(style);
  assert.equal(style.identity, 'synth_line_001');
  assert.equal(style.properties.strokeWeight, 0.2834645669);
  assert.equal(style.properties.strokeStyle, '虚线（3 和 2）');
});
```

验收命令：

```powershell
node --test test/paged-html/synthesized-style-compiler.test.js
npm test
```

预期：

- instructions 中的 style name 是中文。
- identity/token 稳定。
- `style-compiler.js` 体量没有明显膨胀，新增主体逻辑在 helper 文件。

### 7. 精确执行线条、混合模式和资源置入属性

- [ ] 审查 `_indesign_scripts/lib/hi_styles.jsxinc` 中当前虚线样式映射，修复把 `虚线（3 和 2）` 退化为普通虚线或实线的问题。
- [ ] 必要时新增 `_indesign_scripts/lib/hi_stroke_styles.jsxinc`，专门创建和复用精确 stroke style。
- [ ] 支持 line end marker、arrow、stroke alignment、line cap、line join。
- [ ] 支持 blend mode、opacity、fill/stroke tint。
- [ ] 保留 PDF/图片相对于 frame 的 crop、scale、offset、fit policy。
- [ ] 增加 executor 静态测试，验证 include 顺序和函数存在。

建议测试文件：`test/indesign-executor/synthesized-style-executor-static.test.js`

RED 测试要点：

```js
test('executor exposes exact stroke style helper and does not coerce named dash style', () => {
  const source = readExecutorIncludes();

  assert.match(source, /HI\.ensureStrokeStyle/);
  assert.match(source, /虚线（3 和 2）/);
  assert.doesNotMatch(source, /return "\$ID\/Dashed";\s*\/\/.*all dashed/);
});
```

验收命令：

```powershell
node --test test/indesign-executor/synthesized-style-executor-static.test.js
npm test
```

预期：

- 线条样式不再被粗略映射。
- 资源置入属性能进入 instructions 并由 executor 应用。
- 静态测试能防止以后恢复粗略映射。

### 8. 文本框几何和样式覆盖边界

- [ ] 确认合成样式不会改变 text frame 的原始 bounds。
- [ ] 若段落样式应用后 InDesign 自动改变文本框高度，必须在 instructions 中保留 frame bounds 并在 executor 后置恢复。
- [ ] overset 只作为显式报告项，不能通过扩大文本框假装成功。
- [ ] 对高度仅变化的 P1 添加分类，判断是否由样式应用、文本 fit 或坐标单位造成。

建议测试文件：`test/paged-html/text-frame-bounds-after-synth-style.test.js`

RED 测试要点：

```js
test('applying synthesized paragraph style keeps text frame bounds fixed', () => {
  const instructions = modelToInDesignInstructions(modelWithFixedTextFrameAndSynthStyle());
  const textFrame = instructions.pages[0].items.find((item) => item.type === 'text');

  assert.deepEqual(textFrame.bounds, [120, 80, 220, 380]);
  assert.equal(textFrame.applyStyle, '文字样式 01');
  assert.deepEqual(textFrame.postApplyBounds, [120, 80, 220, 380]);
});
```

验收命令：

```powershell
node --test test/paged-html/text-frame-bounds-after-synth-style.test.js
```

预期：

- 应用样式不改变对象几何。
- 文本溢出有报告，不用扩大框体掩盖。

### 9. 合成样式审计门禁

- [ ] 新建 `src/adapters/indesign/audit/synthesized-style-audit.js`。
- [ ] 新建 `scripts/audit-synthesized-styles.js`。
- [ ] 在 `package.json` 增加 `audit:synthesized-styles`。
- [ ] 审计项目包括 token 唯一、中文名存在、fingerprint 唯一、引用存在、属性无丢失、覆盖字段可解释。
- [ ] 审计输出 JSON，供 `audit:effective-diff` 或 E2E 报告引用。

建议测试文件：`test/indesign-reverse/synthesized-style-audit.test.js`

RED 测试要点：

```js
test('audit fails when item references missing synthesized style token', () => {
  const report = auditSynthesizedStyles(modelWithMissingSynthesizedStyle());

  assert.equal(report.ok, false);
  assert.equal(report.issues[0].code, 'SYNTHESIZED_STYLE_REF_MISSING');
});
```

验收命令：

```powershell
node --test test/indesign-reverse/synthesized-style-audit.test.js
npm run audit:synthesized-styles -- --model <semantic-model.json> --out <synthesized-style-audit.json>
```

预期：

- 审计失败会给出具体 code 和 item/style 路径。
- 无效合成样式不能进入成功报告。

### 10. 接入真实 E2E 报告

- [ ] 更新真实 E2E 脚本，让反向作者包报告包含合成样式审计结果。
- [ ] `audit:effective-diff` 把样式相关 P1 与非样式 P1 分开统计。
- [ ] 增加 baseline 比对，样式相关 P1 不允许回退。
- [ ] 二轮回环时要求合成样式 registry 不漂移。

修改候选：

- `scripts/indesign-e2e.js`
- `src/adapters/indesign/audit/effective-diff.js`
- `test/indesign-reverse/effective-diff-audit.test.js`

验收命令：

```powershell
node --test test/indesign-reverse/effective-diff-audit.test.js
npm run e2e:indesign -- -- --html <reverse-html-author-deck.html> --reverse-roundtrip --second-pass-roundtrip
npm run audit:effective-diff -- --expected <original-reverse-snapshot.json> --actual <second-pass-reverse-snapshot.json> --stability-audit <reverse-snapshot-audit.json> --out <after-report.json>
```

预期：

- 报告中明确列出 style-related P1。
- 二轮合成样式 registry 不漂移。

### 11. 真实人工 ID 收敛

- [ ] 使用用户给定的真实人工 ID 重新导出反向快照。
- [ ] 从反向 HTML 作者包再次导回 InDesign。
- [ ] 对回环后的 InDesign 再反向导出。
- [ ] 执行 effective diff。
- [ ] 对 P1 做逐类收敛，优先处理样式、线条、资源置入和样式导致的 missing/extra。
- [ ] 若 P1 未清零，输出 `remaining-p1-classification.json`，其中每一类都有责任层级、数量、样例 item id 和下一步文件入口。

验收命令：

```powershell
npm run e2e:indesign -- -- --html <real-reverse-html-author-deck.html> --reverse-roundtrip --second-pass-roundtrip
npm run audit:synthesized-styles -- --model <second-pass-semantic-model.json> --out <synthesized-style-audit.json>
npm run audit:effective-diff -- --expected <original-reverse-snapshot.json> --actual <second-pass-reverse-snapshot.json> --stability-audit <reverse-snapshot-audit.json> --out <effective-diff-audit-after-synth-style.json>
```

预期：

- `synthesized-style-audit.json.ok === true`
- `effective-diff-audit-after-synth-style.json.p0.count === 0`
- 二轮稳定审计错误数为 0
- 样式相关 P1 为 0
- 目标状态下 `p1.count === 0`

### 12. 文档与退役清理

- [ ] 更新 `docs/规范/SEMANTIC_RECONSTRUCTION.md`，说明合成样式层是结构化还原的一部分，不是语义推理。
- [ ] 更新 `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md` 的链路图。
- [ ] 更新 `AGENTS.md` 中架构边界和执行基线，如新增审计命令或字段规则。
- [ ] 清理被替代的粗略虚线映射、重复样式生成逻辑、旧测试 fixture。
- [ ] 搜索退役路径和局部私造字段，确认没有残留。

验收命令：

```powershell
rg "legacy|historical|fallback|TODO|TBD" src _indesign_scripts test docs/规范 AGENTS.md
rg "synthesizedStyle|synthesizedToken|styleOverrides" src test docs/规范 AGENTS.md
git diff --check
npm test
```

预期：

- 没有新增退役路径和未解释占位。
- 文档与代码字段一致。

## Commit Plan

按风险分段提交，不要等全部完成后一次提交：

1. `protocol: register synthesized style fields`
2. `semantic-model: add synthesized style registry`
3. `indesign-reverse: synthesize styles from snapshots`
4. `html: preserve synthesized style references`
5. `indesign-writer: compile synthesized native styles`
6. `indesign-executor: preserve precise stroke and placement styles`
7. `audit: gate synthesized style normalization`
8. `docs: document synthesized style normalization`

每次提交前至少运行：

```powershell
git diff --check
node --test <changed-test-files>
```

最后提交前运行完整验证：

```powershell
npm test
npm run audit:synthesized-styles -- --model <second-pass-semantic-model.json> --out <synthesized-style-audit.json>
npm run audit:effective-diff -- --expected <original-reverse-snapshot.json> --actual <second-pass-reverse-snapshot.json> --stability-audit <reverse-snapshot-audit.json> --out <effective-diff-audit-after-synth-style.json>
```

## Risks And Controls

| 风险 | 控制 |
| ---- | ---- |
| 合成样式被误当成页面语义 | 字段命名只使用 style，不进入 semantic role；测试断言不生成 title/caption/material |
| 中文名变化导致 diff 漂移 | token 作为机器事实，中文名由 token 顺序稳定生成 |
| 原始 InDesign 样式被覆盖 | normalizer 中保留原始 styleRef 优先级，合成样式只补齐缺口 |
| `style-compiler.js` 继续变大 | 主体逻辑进入 `synthesized-style-instructions.js`，compiler 只接线 |
| Executor 粗略映射继续吞差异 | 为虚线、箭头、混合模式、资源置入加静态和真实 E2E 门禁 |
| P1 没有真实收敛 | effective diff 增加样式相关分类，不允许只看总数或人工截图 |

## Completion Criteria

- [ ] 新协议字段已登记并生成文档。
- [ ] InDesign 反向模型能生成稳定合成样式。
- [ ] HTML 作者包能保存和回读合成样式。
- [ ] InDesign Writer 能生成中文原生样式并应用 token identity。
- [ ] Executor 精确保留虚线、箭头、混合模式、填充、描边和资源置入属性。
- [ ] 合成样式审计命令可运行，且纳入真实 E2E 报告。
- [ ] 真实人工 ID 的样式相关 P1 为 0。
- [ ] 二轮回环稳定审计错误为 0。
- [ ] 文档和 AGENTS 已同步。
- [ ] 退役代码和粗略映射已清理。
