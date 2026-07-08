# style-synthesis 与 shared helper 重复审计报告

## 审计范围

- `src/style-synthesis/`
- `src/shared/`
- `src/writers/indesign/`
- `src/writers/html/`
- `src/adapters/html/`
- `test/architecture/single-implementation.test.js`
- `test/shared/`
- `test/semantic-model/synthesized-styles.test.js`

## 执行命令

1. `git diff --summary 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- src/style-synthesis src/shared src/writers src/adapters`
2. `rg -n "function normalize|function clean|function parse|bordersAreUniform|parseZIndex|normalizeLineEndings|collapseWhitespace" src`
3. `rg -n "style-synthesis|shared/|shared-helper|normalizeLineEndings|collapseWhitespace|parseZIndex|bordersAreUniform" src test`
4. `node --test test/architecture/single-implementation.test.js test/shared/style-utils.test.js test/shared/text.test.js test/semantic-model/synthesized-styles.test.js`
5. `node --test test/public-api.test.js test/protocol/baseline-imports.test.js`

## 验证结果摘要

- 命令 4 通过：`22/22` tests pass。
- 命令 5 通过：`5/5` tests pass。
- 未运行真实 InDesign E2E，符合任务约束。

## 当前结论

**结论：存在重复实现。**

`style-synthesis` 主链抽取本身已经落地，旧 `style-compiler` / `instructions-compiler` 运行路径也基本退役；但“共享逻辑单一来源”尚未成立。当前至少还有三组活跃重复：

1. `writers/html` 资产路径 helper 簇仍是多份实现。
2. `style-synthesis` 与 `writers/indesign` 之间仍保留局部 helper 双路径。
3. G6 门禁当前只盯固定名字列表，已经出现“改名后重复仍然绿灯”的假通过。

**总体风险等级：P1。**  
原因不是已有线上崩溃证据，而是架构硬化门禁已出现假绿，且重复 helper 已经在同一语义域内发生轻微漂移。

## 正向证据：本轮抽取并非空转

- `git diff --summary` 显示：
  - 删除 `src/adapters/html/reader/stacking.js`
  - 删除 `src/adapters/html/reader/style-reader.js`
  - 创建 `src/shared/text.js`
  - 将 `src/writers/indesign/style-compiler.js` 相关实现重命名迁入 `src/style-synthesis/`
  - 删除 `src/writers/indesign/instructions-compiler.js`
- `src/adapters/html/normalizer/snapshot-to-model.js:1,593-596` 已直接依赖 `../../../style-synthesis`，不是继续走旧 writer 内部路径。
- `rg -n "writers/indesign/style-compiler|writers/indesign/instructions-compiler|style-compiler\\.js|instructions-compiler\\.js" src test index.js` 结果只命中 `test/architecture/dependency-direction.test.js` 的人造样本；真实 `src/` 运行代码未再引用这些旧路径。

这说明“旧实现仍在运行”的主问题基本已清掉；现在的问题是**新抽取后仍残留平行 helper**。

## Findings

### 1. `writers/html` 资产路径 helper 仍是多份实现，且已出现语义漂移

**风险等级：P1**

**证据**

- `src/writers/html/asset-reference-policy.js:336-387`
  - `normalizePathKey`
  - `slash`
  - `sourceFileKey`
  - `sanitizeRelative`
  - `unique`
  - `normalizePositiveInteger`
- `src/writers/html/author-asset-packager.js:166-206`
  - 同名/同义 `normalizePathKey`
  - `sourceFileKey`
  - `sanitizeRelative`
  - `unique`
  - `normalizePositiveInteger`
- `src/writers/html/author-resource-paths.js:19-26`
  - 第三份 `normalizePathKey`
- `src/writers/html/audit/source-roundtrip-diff.js:325-331`
  - 第三套远程 URL 判定逻辑

**已经出现的漂移**

- `src/writers/html/asset-reference-policy.js:350-351` 的 `isRemoteReference` 明确排除 `file:`
- `src/writers/html/author-asset-packager.js:182-183` 的 `isRemoteUrl` 不排除 `file:`
- `src/writers/html/audit/source-roundtrip-diff.js:329-331` 也不排除 `file:`

这不是“只是分散”，而是**同一资产路径语义已经分裂**：reference 流、copy 流、audit 流对同一个 `file:` 输入的归类不一致。

**影响**

- reference / copy / audit 三条链路对同一路径的归类可能不同。
- 后续任何一个地方修 UNC、`file:`、路径去重或 PDF preview 规则时，都有高概率漏改其它副本。
- 这直接违反 `AGENTS.md` 的“共享逻辑必须单一来源”。

### 2. `style-synthesis` 与 `writers/indesign` 之间仍有局部 helper 双路径

**风险等级：P1**

**证据 A：同名 helper 已分叉**

- `src/style-synthesis/index.js:495-515` 定义 `normalizeTableWidths`
- `src/writers/indesign/table-instructions.js:35-47,91-99` 也定义 `normalizeTableWidths`

两者并非单纯复制粘贴：

- 前者阈值条件：`Math.abs(delta) < 1`
- 后者阈值条件：`Math.abs(delta) <= Math.max(1, targetWidth * 0.01)`

即：**同名同领域 helper，行为已不同。**

**证据 B：border 可见性仍是双实现**

- `src/style-synthesis/box-model.js:75-95`
  - `bordersAreUniform`
  - `visibleBorder`
- `src/writers/indesign/instruction-writer.js:718-745,813-818`
  - 消费 `bordersAreUniform`
  - 但又本地重写一份 `visibleBorder`

这里不是历史兼容，而是新的抽取完成后仍保留 writer 内部副本。

**证据 C：文本归一化未复用 shared**

- `src/shared/text.js:1-7` 定义 `normalizeLineEndings` / `collapseWhitespace`
- `src/writers/indesign/instruction-writer.js:789-810` 另外定义 `normalizeInstructionText`

而 `test/shared/text.test.js:9-16` 已把 shared 语义钉死为：

- `normalizeLineEndings` 负责 CRLF/CR 归一
- `collapseWhitespace` 负责 NBSP 与空白折叠

`normalizeInstructionText` 只做 `replace(/\s+/g, ' ').trim()`，没有复用 shared 既有语义。

**影响**

- `compileStyles`、`semanticModelToInstructions`、后续审计在表格宽度、边框可见性、文本对齐判断上，已经不是单一事实源。
- 这类重复非常容易演变为“样式编译判定”和“指令写出判定”不一致。

### 3. 当前 G6 门禁已出现假绿，挡不住改名后的重复

**风险等级：P1**

**证据**

- `test/architecture/single-implementation.test.js:14-30` 只扫描固定名字白名单：
  - `normalizeLineEndings`
  - `collapseWhitespace`
  - `safe*`
  - `cssLengthTo*`
  - `parseZIndex`
- `test/architecture/baselines/G6.json:1-3` 当前豁免为空。
- 本轮命令 4 仍然 `22/22` 通过。

但同一轮审计里可以直接看到白名单外的重复：

- `src/adapters/html/reader/visual-geometry-capture.js:29-39,54-56`
  - `normalizedText`
- `src/writers/html/audit/visual-geometry-audit.js:409-429`
  - `normalizeTextValue`
- `src/shared/text.js:5-6`
  - `collapseWhitespace`

前两者都在做 NBSP + 空白折叠，只是换了名字，因此 G6 完全看不见。

同理，G6 也看不见：

- `normalizeTableWidths`
- `visibleBorder`
- 资产路径 helper 簇

**结论**

当前 G6 只能证明“固定 helper 名单没有新增重复”，**不能证明共享逻辑单一来源成立**。  
对于本任务目标，这就是门禁假通过。

## 可删候选

### 候选 1：`writers/html` 资产路径 helper 簇的本地副本

**候选文件**

- `src/writers/html/author-asset-packager.js:166-206`
- `src/writers/html/author-resource-paths.js:19-26`
- `src/writers/html/audit/source-roundtrip-diff.js:325-331`

**建议**

- 统一收敛到一个 helper 模块；若只服务 HTML writer，可放 `src/writers/html/asset-path-helpers.js`。
- 若项目坚持“共享逻辑进 `src/shared`”，则应直接上收 `src/shared/`。

**删除风险**

- 中。
- 原因：当前 reference/copy/audit 三链路已有轻微语义漂移，硬删任一份前必须先裁定 canonical 语义。

**现有覆盖**

- `test/indesign-to-html/asset-reference-policy.test.js:10-239`
- `test/indesign-to-html/author-html-tree.test.js:20-37`

### 候选 2：`src/writers/indesign/table-instructions.js:91-99` 的本地 `normalizeTableWidths`

**建议**

- 若语义应一致，合并到单一实现。
- 若 presentation 指令阶段确实需要更宽松阈值，则必须改名，避免继续冒充同一 helper。

**删除风险**

- 中到高。
- 原因：这里已不是机械重复，而是已带行为差异。

**现有覆盖**

- `test/semantic-model/to-instructions.test.js:457-460`
- `test/html-to-indesign/instructions-compiler.test.js:823-858`

### 候选 3：`src/writers/indesign/instruction-writer.js:809-818` 的 `normalizeInstructionText` / `visibleBorder`

**建议**

- `visibleBorder` 与 `box-model` 统一来源。
- `normalizeInstructionText` 直接复用 `shared/text`，或明确声明为不同语义并改名。

**删除风险**

- 低到中。
- 逻辑短，但会影响结构化文本子项合并和边框装饰生成。

**现有覆盖**

- `test/shared/text.test.js:9-16`
- `test/html-to-indesign/style-compiler.test.js:732-817`

### 候选 4：视觉几何链路的本地文本归一化

**候选文件**

- `src/adapters/html/reader/visual-geometry-capture.js:29-39`
- `src/writers/html/audit/visual-geometry-audit.js:423-429`

**建议**

- 直接复用 `src/shared/text.js`，或把“审计文本归一化”明确成单独 helper 并统一引用。

**删除风险**

- 中。
- 原因：capture 端跑在浏览器上下文，若直接共用 Node helper，需要确认注入方式；但这不构成保留三份同义逻辑的理由。

**现有覆盖**

- 仅见间接覆盖；本轮未找到针对这两个函数本身的单测。

## 不可删理由

### 1. `src/style-synthesis/` 模块本体不应回退

- `src/adapters/html/normalizer/snapshot-to-model.js:1,593-596` 已直接把样式编译当作独立阶段调用。
- 这符合 `HTML -> adapters/html -> semantic-model -> writers/indesign` 的链路边界。
- 把它并回 writer 会重新制造 adapter 直连 writer 内部实现的问题。

### 2. `src/shared/text.js` 与 `src/shared/style-utils.js` 不应回退到各层本地 helper

- `test/shared/text.test.js:9-16`、`test/shared/style-utils.test.js:11-35` 已把 shared helper 语义显式固定。
- `src/adapters/html/reader/browser-snapshot.js:6,146-147` 已使用 `parseZIndex` 单一来源。
- `src/writers/html/audit/content-inventory.js:6,110,177,376`、`src/writers/html/audit/source-roundtrip-diff.js:6,350,360,373,385`、`src/writers/html/audit/structure-signature.js:5,130` 已使用 `collapseWhitespace`。

这些是“抽取后降低重复、改善边界”的正例，不应回退。

### 3. `src/writers/indesign/index.js` 的 `compileStyles` 导出当前不能直接删

- `src/writers/indesign/index.js:1-8` 只是 re-export，不是第二份实现。
- `test/public-api.test.js:7-23` 与 `test/protocol/baseline-imports.test.js:8-18` 明确要求公共 API 继续暴露 `api.writers.indesign.compileStyles`。

因此它不是“旧 helper 双路径”，而是当前公共 API 兼容面。

## 是否需要沉淀长期规范

**需要。**

建议沉淀两条长期规则，并同步补门禁：

1. **G6 不得只靠固定 helper 名字白名单。**  
   当前 `test/architecture/single-implementation.test.js:14-30` 的名字白名单不足以覆盖“改名后重复”。应至少把以下语义族纳入：
   - 文本归一化
   - 资产路径/远程路径判定
   - 表格列宽收口
   - border 可见性 / uniformity

2. **同名 helper 不能允许行为分叉。**  
   像 `normalizeTableWidths` 这种同名但阈值不同的情况，要么合并，要么强制改名并说明语义差异；不能继续共存。

这与 `docs/superpowers/specs/2026-07-06-architecture-hardening-guardrails-design.md:144-148,176-180` 的方向一致，但当前规则落地还不够。

## 最终裁定

- **当前结论**：存在重复实现
- **旧实现退役状态**：`style-synthesis` 主抽取已成功，旧 `style-compiler` / `instructions-compiler` 真实运行路径基本退役
- **核心未收口点**：资产路径 helper 簇、table width helper、border/text normalization helper、G6 假绿
- **建议优先级**：
  1. 先裁定资产路径 helper canonical 语义并抽单一来源
  2. 再收 `normalizeTableWidths` / `visibleBorder` / `normalizeInstructionText`
  3. 最后升级 G6，防止重复再用改名绕过
