# 协议字段注册表实施计划

状态：实施中（worktree：`.worktrees/protocol-field-registry`，分支：`codex/protocol-field-registry`）

来源：GPT Pro 外部审查回复，经本地仓库核对后整理为正式执行版

关联规格：

- `docs/superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md`

执行进度：

- [x] 创建隔离 worktree：`.worktrees/protocol-field-registry`
- [x] 创建执行分支：`codex/protocol-field-registry`
- [x] 设置 worktree 本地 `core.autocrlf=false`，避免 Windows CRLF 检出破坏 LF 敏感测试
- [x] 阶段 0 前置依赖检查：`rg --version`
- [x] 阶段 0 前置依赖安装：`npm install`
- [x] 阶段 0 前置基线测试：`npm test`，357 pass / 0 fail
- [x] 阶段 0：冻结现有事实源与基线测试（implementation：`983ddb3`；spec review 通过；code quality review 通过）
- [x] 阶段 1：实现协议字段注册表核心 API（implementation：`fa30750`；修复：`f13b7ae`、`e569799`、`355df73`；spec review 通过；code quality review 通过；controller 验证：protocol 24/24、npm test 381/381）
- [x] 阶段 2：登记当前事实字段，不接入强门禁（implementation：`68cde6b`；spec fixes：`9e05f2a`、`e5ad1cd`；quality fix：`d30df31`；spec review 通过；code quality review 通过；controller 验证：protocol focused 16/16、protocol 33/33、npm test 390/390）
- [x] 阶段 3：能力矩阵和生命周期策略门禁（implementation：`8648f27`；spec fixes：`50386a6`、`b22aa2c`；quality fixes：`b2fe754`、`d304e75`、`3f9d8ae`、`01cf80d`、`7e4d017`；spec review 通过；code quality review 通过；controller 验证：stage focused 51/51、protocol 57/57、npm test 414/414）
- [x] 阶段 4：字段扫描和仅警告门禁（implementation：`f8b2e9b`；spec fix：`5c33f35`；quality fixes：`4347e0a`、`6cd173d`、`b9880d8`；spec review 通过；code quality review 通过；controller 验证：stage focused 18/18、protocol 75/75、npm test 432/432）
- [x] 阶段 5：接入语义模型和标签白名单（implementation：`a8b4c0d`；spec fixes：`44ffe16`、`ad1ed4d`、`0687952`、`27deff8`、`d0994b1`、`e5fc097`；quality fixes：`6ca7c7e`、`e77dcf3`、`16147a1`、`9ca607a`、`5cec7c2`、`b2f40db`；controller 复验通过：raw label strict/warn 探针通过，validator 9/9、author-package 18/18、focused 78/78、focused 89/89、stage broad 149/149、blocker focused 82/82、`git diff --check` 通过、`npm test` 474/474 通过；quality re-review agent `019e8132-919f-7353-ab5e-0fa4338f821e` BLOCKED 项已修复；post-fix review agent `019e81ac-0c8a-7e83-ba2d-2a956d015450` PASS，focused 82/82 + protocol/model 28/28）
- [x] 阶段 6：退役字段集中登记与清理（implementation `af0065f`；implementation agent `019e81b1-af6e-7472-831a-dbfac7ae53d0` 完成；spec review agent `019e81b6-ff27-7380-a7f7-5b64ea04a8cd` PASS；quality review agent `019e81bb-599b-7ed1-a695-24d605de7265` BLOCKED：direction 空值静默当 read、retired policy 缺枚举校验、no-fallback grep 过脆弱；quality fix `75c941d`，controller 复验通过：fix focused 31/31、stage focused 70/70、protocol/semantic 105/105、`git diff --check` 通过；quality re-review agent `019e81c4-f70d-7651-ad97-a5ec8455052e` PASS；`npm test` 481/481）
- [x] 阶段 7：按域接入强校验（implementation `4b6ced8`；implementation agent `019e81cc-0141-7d83-982c-086c43cded14` 完成；controller 复验通过：focused 31/31、protocol/semantic 124/124、`git diff --check` 通过；spec review agent `019e81d9-162c-70f0-901e-b7c637e6d1d1` BLOCKED：`source.metadata` 域过宽、非法输入静默成功、`visualStyle` canonical/native 能力过度声明；spec fix `9730e67`，spec fix agent `019e81df-6b1a-7ca2-a49f-94fec02eb72f` DONE；controller 复验通过：focused 33/33、protocol/semantic 128/128、`git diff --check` 通过；spec re-review agent `019e81e8-04fa-7873-8ddb-21c6874d155a` PASS；quality review agent `019e81ef-af41-7473-b76d-959c08a6d0e6` BLOCKED：`SOURCE_METADATA_PATHS` 含未登记/未扫描的 `items[].effectiveLabel.*` 假路径，allowlist 事实漂移；quality fix `21f8d20`，quality fix agent `019e81f5-c348-74e1-90d8-33519d28def2` DONE；controller 复验通过：focused 34/34、protocol/semantic 129/129、reverse-model 25/25、`git diff --check` 通过；quality re-review agent `019e81fb-0c5b-7e93-935b-49df784abb4e` PASS；`npm test` 496/496）
- [x] 阶段 8：目录重构为适配器 / 写出器（implementation `5579da6`；implementation agent `019e8200-7c8e-72e0-b338-63eeca33fb25` DONE；controller 复验通过：baseline-imports 2/2、旧路径扫描 `NO_MATCHES`、旧目录与 PPTX 入口不存在、`git diff --check` 通过、`npm test` 497/497；spec review agent `019e820c-0621-70e2-9041-9d3c00080938` PASS；quality review agent `019e8210-de9d-7922-86d5-07e3e63a8b6c` BLOCKED：缺少退役公共 API 负向契约测试，无法防止 `pagedHtml`、`indesignReverse`、`adapters.pptx` 或 semanticModel writer/adapter 入口回流；quality fix `c1b5a87`，quality fix agent `019e8215-82bb-7ad2-bf15-586a56790de6` DONE；controller 复验通过：public API focused 4/4、旧路径扫描 `NO_MATCHES`、`git diff --check` 通过、`npm test` 498/498；quality re-review agent `019e821a-0e1f-7540-b605-90cb7e59605d` PASS）
- [ ] 阶段 9：拆分大文件并保持行为可验证（implementation `f8381bf`；implementation agent `019e821e-3b0e-7213-9ce1-84be3c8289e6` DONE；controller 复验通过：browser snapshot focused 23/23、writer focused 52/52、HTML writer focused 65/65、public API 4/4、旧路径扫描 `NO_MATCHES`、`git diff --check` 通过、`npm test` 498/498；spec review agent `019e8230-f006-7cb1-9fd9-b4289178b1ae` BLOCKED：`browser-snapshot.js` 仍集中 style capture / authored style / source node / candidate traversal / inline runs / table assembly，`author-html-tree.js` 仍集中 asset / PDF / vector / table / rich text 渲染热点；spec fix `a330556`，spec fix agent `019e8237-9e81-7440-b536-2231b1edb9bc` DONE：`browser-snapshot.js` 降至 170 行、`author-html-tree.js` 降至 41 行；controller 复验通过：browser focused 24/24、HTML writer focused 66/66、writer focused 52/52、public API 4/4、retired-fields 7/7、旧路径与 active API 扫描通过、`git diff --check` 通过、`npm test` 500/500；spec re-review agent `019e8249-03cd-7da0-8d68-55abbfcc3d06` PASS；quality review agent `019e824f-b8f8-7f32-8058-23b9cb5e4be9` BLOCKED：缺失 page selector 静默输出空快照、反向作者表格丢弃 rowspan/colspan/runs、browser snapshot 仍保留裸数组兼容分支；quality fix `64243ff`，quality fix agent `019e8257-8dd9-7011-a6ae-a3c167b8bba3` DONE：缺失页面选择器与非法 capture shape 显式失败，表格写出保留 rowspan/colspan/runs；controller 复验中）
- [ ] 阶段 10：PPTX 预留适配器 / 写出器契约
- [ ] 阶段 11：字段文档生成与长期规范收口
- [ ] 阶段 12：最终 E2E 和真实 InDesign 验证

执行原则：

- 计划必须用中文。
- 允许较大范围架构重构，但必须有清晰边界、阶段、验证门禁和退役代码清理策略。
- 注册表必须支持 `canonicalPath`、`currentPaths`、`fieldClass`、`lifecycle`、`read/write/persist` capability。
- 当前事实字段必须先登记清楚，不能靠口头约定。
- 退役字段必须登记并清理，不得继续作为读取兜底。
- 计划中的伪代码和移动命令是执行依据，不是免核对复制文本；每个阶段开始前必须用当前仓库实际导出、文件名、测试命令核对一次。
- 本仓库在 Windows / PowerShell 环境执行，门禁命令必须使用 `rg`、PowerShell 或 Node 测试；不得把 Unix `grep`、`test`、`mkdir -p`、`mv` 当作最终可运行命令。
- `rg` 是本计划的显式执行依赖；阶段 0 前必须运行 `rg --version` 确认可用，不能把“命令不存在”误判为“没有命中”。
- 执行必须在隔离 worktree 中完成，不能直接在 `main` 工作区改代码。
- 执行过程中必须实时更新本文 checklist；每个阶段结束前必须在 worktree 分支跑该阶段验证并提交一次可回溯提交。

## 正式实施计划：协议字段注册表与多格式能力矩阵

> **给执行 Agent：** 必须先使用 `using-git-worktrees` 创建隔离工作区，再使用 `executing-plans` 按任务执行，并实时更新 checkbox。本文在 worktree 分支推进，不直接在 `main` 工作区实施；最终合并、PR 或清理分支由收尾阶段决定。

**目标：** 实现协议字段注册表、多格式能力矩阵、字段生命周期门禁，并把当前 HTML / InDesign / 未来 PPTX 的转换边界重构为清晰的读取器、标准化器、语义模型、写出器、执行器架构。

**架构：** 以 `src/protocol/` 作为字段事实源，所有 canonical、sourceMetadata、formatExtension、observation、retired 字段都集中登记；HTML、InDesign、PPTX 都只能通过语义模型互转，禁止两两专用转换链路。当前代码已经有 `paged-html`、`semantic-model`、`indesign-reverse` 三条主边界，但注册表尚未实现，且 `validateSemanticModel` 目前只做最小结构检查，因此计划会先建立可测试的协议层，再重构目录和接入强门禁。

**技术栈：** Node.js CommonJS、`node --test`、现有 `npm test`、Playwright 浏览器快照、`indesign-cli` 真实 InDesign E2E、项目现有作者包与反向审核脚本。

---

## 0. 本地收口说明

- 采纳 GPT Pro 的主体计划，但本文是正式执行版，不再作为外部回复原文保存。
- 原计划中的 Unix 命令已替换为 Windows / PowerShell 可执行写法；后续如新增门禁，也必须保持同一标准。
- 目录大重构被保留为本计划目标：`src/paged-html/` 和 `src/indesign-reverse/` 只能阶段内短暂存在，阶段 8 完成时必须删除。
- 伪代码必须在执行阶段结合当前仓库核对后落地；如果发现函数名、导出名或文件名已经变化，优先修正计划 checklist，再改代码。
- 长期规范与生成文档的关系必须等注册表覆盖现有字段后再切换；不得在 registry 还不完整时删除现有静态事实说明。

### 0.1 Worktree 执行约定

执行前必须从 `main` 创建隔离 worktree：

```powershell
git status --short
git branch --show-current
git check-ignore -q .worktrees
if ($LASTEXITCODE -ne 0) { throw ".worktrees/ must be ignored before creating worktree" }
git worktree add .worktrees\protocol-field-registry -b codex/protocol-field-registry
Set-Location .worktrees\protocol-field-registry
```

约定：

- worktree 路径：`.worktrees/protocol-field-registry`
- 分支名：`codex/protocol-field-registry`
- `main` 工作区只作为源基线和最终集成目标；实施代码、测试、文档生成、checklist 更新和阶段提交都在 worktree 分支完成。
- 如果目标 worktree 或分支已存在，停止并先检查 `git worktree list --porcelain` 与 `git status --short`，不得覆盖或删除已有工作。
- 创建 worktree 后先运行：

```powershell
rg --version
npm install
npm test
```

预期：`rg` 可用，依赖安装成功，`npm test` PASS。若失败，不进入阶段 0；先区分是 worktree 创建问题、依赖问题，还是 `main` 基线已经损坏。

## 1. 摘要

本计划按已采纳的 `2026-05-31-protocol-field-registry-architecture-design.md` 落地。该 spec 已明确：它是已批准架构设计但不代表当前实现；注册表实现前，长期规范和当前代码仍是字段行为事实源；注册表接入后，重复字段表应迁移为注册表生成文档。

实施顺序采用“先测试和事实冻结，再 registry，再接入门禁，再目录重构，再文档生成，再 PPTX 预留”的路线。这样既符合 TDD 要求，也避免在字段事实没登记清楚前大规模移动文件。TDD skill 要求所有新功能、重构和行为变化都先写失败测试，并确认失败原因正确；verification skill 要求完成前必须有新鲜验证证据，不能用“应该通过”替代实际命令输出。

这不是保守渐进计划。项目尚未上线，可以接受大规模重构；但每一阶段都必须有明确可回滚边界：如果 registry 接入导致现有正向、反向、作者包或 E2E 流水线不可验证，则停止扩大改动，先修共享协议层，不允许在单个 fixture 或 writer 里堆补丁。`AGENTS.md` 已明确字段必须集中登记、格式能力必须显式声明、退役代码必须当场清理、失败要早于假成功、可验证才算完成。

本计划文件路径：

```text
docs/superpowers/plans/2026-05-31-protocol-field-registry-implementation-plan.md
```

---

## 2. 目标 / 不做事项

### 目标

- 建立 `src/protocol/`，实现机器可读字段注册表。

- 每个字段注册项支持：
  
  - `canonicalPath`
  
  - `currentPaths`
  
  - `fieldClass`
  
  - `lifecycle`
  
  - `owner`
  
  - `type`
  
  - `unit`
  
  - `html` / `indesign` / `pptx` carrier 信息
  
  - `capabilities.<format>.read/write/persist`
  
  - retired / alias 策略
  
  - validation 规则
  
  - test coverage metadata

- 先登记当前事实字段，不靠口头约定。

- 建立能力矩阵查询 API，支持 `native`、`lossless`、`approximate`、`fallback`、`observe-only`、`unsupported`。

- 建立生命周期门禁：
  
  - active canonical 必须可校验。
  
  - sourceMetadata 不得驱动视觉编译。
  
  - formatExtension 必须进入 `extensions.<format>.*`。
  
  - observation 不得进入 structured compilation。
  
  - retired 必须禁止写出，旧输入只能 observation/report。

- 把 HTML Reader、InDesign Reader、Normalizer、Semantic Model、Writer、Executor 边界梳理清楚。

- 拆分现有超大文件，阻止 `browser-snapshot.js`、`style-compiler.js`、`to-instructions.js`、`html-writer.js`、`author-html-tree.js` 继续膨胀。

- 将现有静态字段表迁移为 registry 生成文档或 registry 引用文档。

- 预留 PPTX adapter/writer contract、custom data carrier 和 capability matrix entry，但不实现完整 PPTX。

### 不做事项

- 不实现完整 PPTX package 读写。

- 不把项目改成通用 Office 文档模型。

- 不要求所有字段三格式无损。

- 不保留明显错误的旧结构作为“兼容层”。

- 不继续允许 `data-id-page` 作为 PDF 页码读取兜底；它必须只进入 retired/observation/report。

- 不让 `_indesign_scripts/` 承担语义推断、HTML 解析、CSS cascade 或字段迁移；Executor 只执行已验证指令。

---

## 3. 架构重构边界

目标架构按 spec 固定为：

```text
HTML Reader -> HTML Normalizer -> Semantic Model -> HTML Writer
InDesign Reader -> InDesign Normalizer -> Semantic Model -> InDesign Instruction Writer
PPTX Reader -> PPTX Normalizer -> Semantic Model -> PPTX Writer
```

禁止新增：

```text
HTML -> InDesign 专用字段旁路
InDesign -> PPTX 专用转换器
PPTX -> HTML 专用转换器
```

这是 spec 的核心边界。

### 3.1 允许的大规模目录重组

值得现在做目录重组，原因是项目尚未上线，且当前根入口仍直接暴露 `pagedHtml`、`semanticModel`、`indesignReverse`、`historicalTemplate` 这些旧边界；越晚迁移，外部依赖越多，清理成本越高。

目标目录：

```text
src/
  protocol/
    index.js
    registry.js
    field-entry.js
    field-query.js
    capability.js
    lifecycle.js
    path-utils.js
    validators/
      validate-field-entry.js
      validate-model-fields.js
      validate-label-fields.js
      validate-data-id-fields.js
      validate-instruction-fields.js
      validate-retired-fields.js
    scanners/
      scan-data-id-fields.js
      scan-model-paths.js
      scan-instruction-paths.js
    docs/
      generate-field-docs.js
    fields/
      document-page.js
      styles.js
      text.js
      table.js
      assets.js
      visual-style.js
      vector-geometry.js
      labels.js
      source-metadata.js
      observation.js
      retired.js
      pptx-extensions.js

  adapters/
    html/
      reader/
        browser-snapshot.js
        page-detector.js
        asset-detector.js
        source-metadata.js
      normalizer/
        snapshot-to-model.js
      validators/
        authoring-validator.js
      index.js
    indesign/
      reader/
        snapshot-reader.js
      normalizer/
        snapshot-to-model.js
        label-whitelist.js
      index.js
    pptx/
      contracts.js
      capabilities.js
      README.md

  semantic-model/
    index.js
    validator.js
    layout.js

  writers/
    indesign/
      instruction-writer.js
      instructions-validator.js
      style-compiler.js
      index.js
    html/
      visual-html-writer.js
      author-package-writer.js
      author-html-tree.js
      author-attribute-writer.js
      author-style-attrs.js
      vector-svg.js
      index.js

  historical-template/
    ...
```

`schema.js`、`model-paths.js` 等更细模型拆分属于后续可选扩展；本计划不创建这些文件，避免目标目录和实施步骤不一致。

### 3.2 不允许的重构方式

- 不允许保留 `src/paged-html/` 作为长期 facade。

- 不允许保留 `src/indesign-reverse/` 作为长期 facade。

- 不允许文件移动后留下双入口、双命名、双字段读取。

- 不允许新增 `legacy` 命名承载当前行为。

- 不允许“先搬文件再修测试”；必须先写路径/边界测试，确认移动后 API 与行为稳定。

- 不允许为了通过测试给单个 fixture 写字段绕路。

- 不允许在 writer 或 executor 私造未登记字段。

### 3.3 可接受的临时边界

因为执行过程中会分阶段移动文件，可以短期存在“重导出入口”，但仅限同一阶段内完成迁移和删除：

```text
阶段内允许：
src/paged-html/index.js -> require('../adapters/html')
src/indesign-reverse/index.js -> require('../adapters/indesign') + require('../writers/html')

阶段结束前必须：
- 更新所有 imports。
- 删除旧 facade。
- 删除旧目录里已迁移文件。
- 测试确认不存在旧路径 import。
```

如果某阶段无法删除旧 facade，本阶段不得标记完成。

---

## 4. 需要新增、移动、删除或改造的模块

### 4.1 新增模块

```text
src/protocol/index.js
src/protocol/registry.js
src/protocol/field-entry.js
src/protocol/field-query.js
src/protocol/capability.js
src/protocol/lifecycle.js
src/protocol/path-utils.js
src/protocol/validators/validate-field-entry.js
src/protocol/validators/validate-model-fields.js
src/protocol/validators/validate-label-fields.js
src/protocol/validators/validate-data-id-fields.js
src/protocol/validators/validate-instruction-fields.js
src/protocol/validators/validate-retired-fields.js
src/protocol/scanners/scan-data-id-fields.js
src/protocol/scanners/scan-model-paths.js
src/protocol/scanners/scan-instruction-paths.js
src/protocol/docs/generate-field-docs.js
src/protocol/fields/*.js
```

新增测试：

```text
test/protocol/field-entry.test.js
test/protocol/registry.test.js
test/protocol/capability.test.js
test/protocol/lifecycle.test.js
test/protocol/current-field-facts.test.js
test/protocol/validate-model-fields.test.js
test/protocol/validate-label-fields.test.js
test/protocol/validate-data-id-fields.test.js
test/protocol/validate-instruction-fields.test.js
test/protocol/validate-retired-fields.test.js
test/protocol/generated-docs.test.js
test/protocol/pptx-contracts.test.js
```

### 4.2 移动模块

```text
src/paged-html/browser-snapshot.js
-> src/adapters/html/reader/browser-snapshot.js

src/paged-html/page-detector.js
-> src/adapters/html/reader/page-detector.js

src/paged-html/asset-detector.js
-> src/adapters/html/reader/asset-detector.js

src/paged-html/source-metadata.js
-> src/adapters/html/reader/source-metadata.js

src/semantic-model/from-snapshot.js
-> src/adapters/html/normalizer/snapshot-to-model.js

src/paged-html/authoring-validator.js
-> src/adapters/html/validators/authoring-validator.js

src/paged-html/stacking.js
-> src/adapters/html/reader/stacking.js

src/paged-html/style-reader.js
-> src/adapters/html/reader/style-reader.js

src/paged-html/layout.js
-> src/semantic-model/layout.js

src/paged-html/style-utils.js
-> src/shared/style-utils.js

src/indesign-reverse/snapshot-reader.js
-> src/adapters/indesign/reader/snapshot-reader.js

src/indesign-reverse/reverse-model.js
-> src/adapters/indesign/normalizer/snapshot-to-model.js

src/indesign-reverse/label-whitelist.js
-> src/adapters/indesign/normalizer/label-whitelist.js

src/indesign-reverse/blueprint-migration.js
-> src/adapters/indesign/normalizer/blueprint-migration.js

src/semantic-model/to-instructions.js
-> src/writers/indesign/instruction-writer.js

src/paged-html/style-compiler.js
-> src/writers/indesign/style-compiler.js

src/paged-html/instructions-compiler.js
-> src/writers/indesign/instructions-compiler.js

src/paged-html/instructions-validator.js
-> src/writers/indesign/instructions-validator.js

src/indesign-reverse/html-writer.js
-> src/writers/html/visual-html-writer.js

src/indesign-reverse/author-package-writer.js
-> src/writers/html/author-package-writer.js

src/indesign-reverse/author-html-tree.js
-> src/writers/html/author-html-tree.js

src/indesign-reverse/author-attribute-writer.js
-> src/writers/html/author-attribute-writer.js

src/indesign-reverse/author-style-attrs.js
-> src/writers/html/author-style-attrs.js

src/indesign-reverse/vector-svg.js
-> src/writers/html/vector-svg.js

src/indesign-reverse/css-blend-mode.js
-> src/writers/html/css-blend-mode.js

src/indesign-reverse/asset-reference-policy.js
-> src/writers/html/asset-reference-policy.js

src/indesign-reverse/author-asset-packager.js
-> src/writers/html/author-asset-packager.js

src/indesign-reverse/author-css-writer.js
-> src/writers/html/author-css-writer.js

src/indesign-reverse/author-source-css.js
-> src/writers/html/author-source-css.js

src/indesign-reverse/reveal-presentation-writer.js
-> src/writers/html/reveal-presentation-writer.js

src/indesign-reverse/semantic-candidates.js
-> src/writers/html/semantic-candidates.js

src/indesign-reverse/author-audit.js
-> src/writers/html/audit/author-audit.js

src/indesign-reverse/source-roundtrip-diff.js
-> src/writers/html/audit/source-roundtrip-diff.js

src/indesign-reverse/visual-geometry-audit.js
-> src/writers/html/audit/visual-geometry-audit.js
```

### 4.3 改造模块

```text
index.js
src/semantic-model/index.js
src/semantic-model/validator.js
scripts/indesign-e2e.js
scripts/indesign-reverse-export.js
scripts/lint-authoring.js
scripts/audit-reverse-author-roundtrip.js
scripts/audit-reverse-visual.js
test/**/*.test.js
docs/规范/*.md
```

### 4.4 删除模块或旧入口

阶段结束后删除：

```text
src/paged-html/
src/indesign-reverse/
```

删除条件：

- 所有 import 已迁移。

- `npm test` 通过。

- `rg` 不再命中 `require('./src/paged-html')`、`require('../src/paged-html')`、`require('./src/indesign-reverse')`、`require('../src/indesign-reverse')` 等旧入口引用。

- `index.js` 改为导出新边界。

- 文档不再把旧目录称为当前架构，只可在迁移记录中提及历史。

---

## 5. 阶段检查清单

### 阶段 0：冻结现有事实源与基线测试

**目标：** 不改行为，先把现有字段、现有测试、现有数据流记录成可验证事实。

**文件：**

- Create: `test/protocol/current-field-facts.test.js`

- Create: `test/protocol/baseline-imports.test.js`

- Read/inspect: `src/paged-html/*`

- Read/inspect: `src/semantic-model/*`

- Read/inspect: `src/indesign-reverse/*`

- Read/inspect: `_indesign_scripts/*`

- Read/inspect: `docs/规范/*.md`

检查清单：

- **步骤 0.1：写当前字段事实测试，先只断言现有行为。**
  
  在 `test/protocol/current-field-facts.test.js` 写测试，覆盖至少这些事实：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { placementFromAttributes } = require('../../src/paged-html/asset-detector');
  
  test('current HTML asset placement reads data-id-pdf-page and not data-id-page', () => {
   const placement = placementFromAttributes({
     src: 'drawings/site.pdf',
     'data-id-pdf-page': '3',
     'data-id-page': '9',
     'data-id-crop': 'trim',
     'data-id-visible-layers': 'base|annotations',
     'data-id-hidden-layers': 'old'
   }, { objectFit: 'contain', objectPosition: '50% 50%' });
  
   assert.equal(placement.pageNumber, 3);
   assert.equal(placement.crop, 'trim');
   assert.deepEqual(placement.visibleLayers, ['base', 'annotations']);
   assert.deepEqual(placement.hiddenLayers, ['old']);
  });
  ```

- **步骤 0.2：运行当前字段事实测试。**
  
  运行：
  
  ```bash
  node --test test/protocol/current-field-facts.test.js
  ```
  
  预期： PASS。此测试是基线，不是新功能 RED；如果失败，先记录当前真实行为，再决定是否立即修规范或测试。

- **步骤 0.3：写旧入口基线测试。**
  
  在 `test/protocol/baseline-imports.test.js` 写：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  test('current public entry still exposes existing modules before refactor', () => {
   const api = require('../../index');
  
   assert.equal(typeof api.pagedHtml.renderSnapshot, 'function');
   assert.equal(typeof api.pagedHtml.compileInstructions, 'function');
   assert.equal(typeof api.semanticModel.snapshotToSemanticModel, 'function');
   assert.equal(typeof api.indesignReverse.reverseSnapshotToSemanticModel, 'function');
  });
  ```

- **步骤 0.4：运行旧入口基线测试。**
  
  运行：
  
  ```bash
  node --test test/protocol/baseline-imports.test.js
  ```
  
  预期： PASS。

- **步骤 0.5：运行全量单元测试。**
  
  运行：
  
  ```bash
  npm test
  ```
  
  预期： PASS。若失败，不进入阶段 1；先区分是 worktree 基线继承了 `main` 的既有问题，还是测试新增错误。

- **步骤 0.6：输出字段盘点清单。**
  
  在执行报告或后续计划文件中记录当前字段来源：
  
  ```text
  HTML data-id:
  - data-id-pdf-page
  - data-id-crop
  - data-id-artboard
  - data-id-layer-comp
  - data-id-visible-layers
  - data-id-hidden-layers
  - data-id-preserve-vector
  - data-id-content-x/y/width/height
  - data-id-content-scale-x/y
  - data-id-parent-page
  - data-id-parent-page-name
  - data-id-layout
  - data-id-semantic
  - data-id-margin / data-id-margins discrepancy
  - data-id-grid
  - data-id-column-gutter
  - data-id-row-gutter
  - data-id-baseline
  
  Labels:
  - protocol
  - version
  - kind
  - id
  - source
  - sourcePackage
  - semanticPreset
  - styleRefs
  - sourceNode
  - sourceAncestorNodes
  - structure
  - observedLabel / effectiveLabel
  
  Instructions:
  - pages[].items[].placed.pageNumber
  - pages[].items[].placed.crop
  - pages[].items[].placed.visibleLayers
  - pages[].items[].placed.hiddenLayers
  - pages[].items[].labels
  ```

回退 / 停止条件：

- 如果阶段 0 基线失败，停止后续重构，先在 worktree 中修复基线问题，或回到 `main` 确认当前事实后修正测试理解。

---

### 阶段 1：实现协议字段注册表核心 API

**目标：** TDD 建立 `src/protocol/` 核心，不接入现有链路。

**文件：**

- Create: `src/protocol/index.js`

- Create: `src/protocol/registry.js`

- Create: `src/protocol/field-entry.js`

- Create: `src/protocol/capability.js`

- Create: `src/protocol/lifecycle.js`

- Create: `src/protocol/path-utils.js`

- Test: `test/protocol/field-entry.test.js`

- Test: `test/protocol/registry.test.js`

- Test: `test/protocol/capability.test.js`

- Test: `test/protocol/lifecycle.test.js`

检查清单：

- **步骤 1.1：写字段 entry RED 测试。**
  
  `test/protocol/field-entry.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { normalizeFieldEntry, validateFieldEntry } = require('../../src/protocol');
  
  test('field entry requires canonicalPath currentPaths fieldClass lifecycle owner and capabilities', () => {
   const result = validateFieldEntry({
     canonicalPath: 'items[].asset.placement.pageNumber',
     currentPaths: ['items[].asset.pageNumber'],
     fieldClass: 'canonical',
     lifecycle: 'active',
     owner: 'asset-placement',
     type: 'integer',
     capabilities: {
       html: { read: 'native', write: 'native', persist: 'native' },
       indesign: { read: 'native', write: 'native', persist: 'native' },
       pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless' }
     }
   });
  
   assert.equal(result.valid, true);
   assert.deepEqual(result.errors, []);
  });
  
  test('field entry rejects unknown fieldClass and capability level', () => {
   const result = validateFieldEntry({
     canonicalPath: 'items[].bad',
     currentPaths: [],
     fieldClass: 'legacy',
     lifecycle: 'active',
     owner: 'test',
     capabilities: {
       html: { read: 'maybe', write: 'native', persist: 'native' }
     }
   });
  
   assert.equal(result.valid, false);
   assert.match(result.errors.map((e) => e.code).join(','), /FIELD_CLASS_INVALID/);
   assert.match(result.errors.map((e) => e.code).join(','), /CAPABILITY_LEVEL_INVALID/);
  });
  
  test('field entry rejects entries without explicit capabilities', () => {
   const result = validateFieldEntry({
     canonicalPath: 'items[].asset.placement.pageNumber',
     currentPaths: [],
     fieldClass: 'canonical',
     lifecycle: 'active',
     owner: 'asset-placement'
   });
  
   assert.equal(result.valid, false);
   assert.match(result.errors.map((e) => e.code).join(','), /CAPABILITIES_MISSING/);
  });
  
  test('normalizeFieldEntry always includes canonicalPath in allPaths', () => {
   const entry = normalizeFieldEntry({
     canonicalPath: 'document.id',
     currentPaths: ['labels.document.id'],
     fieldClass: 'canonical',
     lifecycle: 'active',
     owner: 'document',
     capabilities: {
       html: { read: 'native', write: 'native', persist: 'native' }
     }
   });
  
   assert.deepEqual(entry.allPaths, ['document.id', 'labels.document.id']);
  });
  ```

- **步骤 1.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/field-entry.test.js
  ```
  
  预期： FAIL because `src/protocol` does not exist.

- **步骤 1.3：实现最小 entry API。**
  
  `src/protocol/capability.js`：
  
  ```js
  const CAPABILITY_LEVELS = new Set([
   'native',
   'lossless',
   'approximate',
   'fallback',
   'observe-only',
   'unsupported',
  ]);
  
  const FORMATS = ['html', 'indesign', 'pptx'];
  const DIRECTIONS = ['read', 'write', 'persist'];
  
  function isCapabilityLevel(value) {
   return CAPABILITY_LEVELS.has(value);
  }
  
  function normalizeCapabilities(capabilities = {}) {
   const out = {};
   for (const format of FORMATS) {
     const input = capabilities[format] || {};
     out[format] = {};
     for (const direction of DIRECTIONS) {
       out[format][direction] = input[direction] || 'unsupported';
     }
     if (input.fallbackKind) out[format].fallbackKind = input.fallbackKind;
     if (input.risk) out[format].risk = input.risk;
   }
   return out;
  }
  
  module.exports = {
   CAPABILITY_LEVELS,
   FORMATS,
   DIRECTIONS,
   isCapabilityLevel,
   normalizeCapabilities,
  };
  ```
  
  `src/protocol/lifecycle.js`：
  
  ```js
  const FIELD_CLASSES = new Set(['canonical', 'sourceMetadata', 'formatExtension', 'observation']);
  const LIFECYCLES = new Set(['active', 'candidate', 'deprecated', 'retired']);
  
  function isFieldClass(value) {
   return FIELD_CLASSES.has(value);
  }
  
  function isLifecycle(value) {
   return LIFECYCLES.has(value);
  }
  
  module.exports = {
   FIELD_CLASSES,
   LIFECYCLES,
   isFieldClass,
   isLifecycle,
  };
  ```
  
  `src/protocol/field-entry.js`：
  
  ```js
  const { normalizeCapabilities, DIRECTIONS, isCapabilityLevel } = require('./capability');
  const { isFieldClass, isLifecycle } = require('./lifecycle');
  
  function normalizeFieldEntry(input) {
   const currentPaths = Array.isArray(input.currentPaths) ? input.currentPaths.slice() : [];
   const allPaths = Array.from(new Set([input.canonicalPath, ...currentPaths].filter(Boolean)));
   return {
     ...input,
     currentPaths,
     allPaths,
     capabilities: normalizeCapabilities(input.capabilities || {}),
     lifecycle: input.lifecycle || 'active',
   };
  }
  
  function validateFieldEntry(input) {
   const errors = [];
   if (!input || typeof input !== 'object') {
     return { valid: false, errors: [{ code: 'FIELD_ENTRY_INVALID', message: 'Field entry must be an object.' }] };
   }
   if (!input.canonicalPath) errors.push({ code: 'CANONICAL_PATH_MISSING', message: 'canonicalPath is required.' });
   if (!Array.isArray(input.currentPaths)) errors.push({ code: 'CURRENT_PATHS_INVALID', message: 'currentPaths must be an array.' });
   if (!isFieldClass(input.fieldClass)) errors.push({ code: 'FIELD_CLASS_INVALID', message: `Invalid fieldClass: ${input.fieldClass}` });
   if (!isLifecycle(input.lifecycle)) errors.push({ code: 'LIFECYCLE_INVALID', message: `Invalid lifecycle: ${input.lifecycle}` });
   if (!input.owner) errors.push({ code: 'OWNER_MISSING', message: 'owner is required.' });
  
   const capabilities = input.capabilities || {};
   if (Object.keys(capabilities).length === 0) {
     errors.push({ code: 'CAPABILITIES_MISSING', message: 'capabilities must explicitly declare at least one format.' });
   }
   for (const [format, formatCaps] of Object.entries(capabilities)) {
     for (const direction of DIRECTIONS) {
       const value = formatCaps && formatCaps[direction];
       if (value && !isCapabilityLevel(value)) {
         errors.push({
           code: 'CAPABILITY_LEVEL_INVALID',
           message: `Invalid capability ${format}.${direction}: ${value}`,
         });
       }
     }
   }
  
   return { valid: errors.length === 0, errors };
  }
  
  module.exports = {
   normalizeFieldEntry,
   validateFieldEntry,
  };
  ```
  
  `src/protocol/index.js`：
  
  ```js
  const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
  
  module.exports = {
   normalizeFieldEntry,
   validateFieldEntry,
  };
  ```

- **步骤 1.4：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/field-entry.test.js
  ```
  
  预期： PASS.

- **步骤 1.5：写 registry RED 测试。**
  
  `test/protocol/registry.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { createFieldRegistry } = require('../../src/protocol');
  
  test('registry finds field by canonicalPath currentPath and html attr', () => {
   const registry = createFieldRegistry([
     {
       canonicalPath: 'items[].asset.placement.pageNumber',
       currentPaths: ['items[].asset.pageNumber'],
       fieldClass: 'canonical',
       lifecycle: 'active',
       owner: 'asset-placement',
       html: { readAttrs: ['data-id-pdf-page'], writeAttrs: ['data-id-pdf-page'] },
       capabilities: {
         html: { read: 'native', write: 'native', persist: 'native' }
       }
     }
   ]);
  
   assert.equal(registry.getByPath('items[].asset.placement.pageNumber').owner, 'asset-placement');
   assert.equal(registry.getByPath('items[].asset.pageNumber').owner, 'asset-placement');
   assert.equal(registry.getByHtmlAttr('data-id-pdf-page').canonicalPath, 'items[].asset.placement.pageNumber');
  });
  
  test('registry rejects duplicate path ownership', () => {
   assert.throws(() => createFieldRegistry([
     {
       canonicalPath: 'document.id',
       currentPaths: [],
       fieldClass: 'canonical',
       lifecycle: 'active',
       owner: 'document',
       capabilities: {}
     },
     {
       canonicalPath: 'document.id',
       currentPaths: [],
       fieldClass: 'canonical',
       lifecycle: 'active',
       owner: 'other',
       capabilities: {}
     }
   ]), /FIELD_PATH_DUPLICATED/);
  });
  ```

- **步骤 1.6：确认 registry RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/registry.test.js
  ```
  
  预期： FAIL because `createFieldRegistry` is missing.

- **步骤 1.7：实现 registry API。**
  
  `src/protocol/registry.js`：
  
  ```js
  const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
  
  function createFieldRegistry(entries = []) {
    const normalized = entries.map((entry) => {
      const validation = validateFieldEntry(entry);
      if (!validation.valid) {
        const codes = validation.errors.map((error) => error.code).join(',');
        throw new Error(`FIELD_ENTRY_INVALID:${codes}`);
      }
      return normalizeFieldEntry(entry);
    });

    const byPath = new Map();
    const byHtmlAttr = new Map();
    const byRetiredHtmlAttr = new Map();

    for (const entry of normalized) {
      for (const fieldPath of entry.allPaths) {
        if (byPath.has(fieldPath)) throw new Error(`FIELD_PATH_DUPLICATED:${fieldPath}`);
        byPath.set(fieldPath, entry);
      }
      for (const attr of htmlAttrsFor(entry)) {
        if (byHtmlAttr.has(attr)) throw new Error(`HTML_ATTR_DUPLICATED:${attr}`);
        byHtmlAttr.set(attr, entry);
      }
      for (const retiredHtmlAttr of retiredHtmlAttrsFor(entry)) {
        const attr = retiredHtmlAttr && retiredHtmlAttr.name;
        if (!attr) continue;
        if (byRetiredHtmlAttr.has(attr)) throw new Error(`RETIRED_HTML_ATTR_DUPLICATED:${attr}`);
        byRetiredHtmlAttr.set(attr, retiredHtmlAttrRecord(entry, retiredHtmlAttr));
      }
    }

    return {
      entries: normalized.slice(),
      getByPath: (fieldPath) => byPath.get(fieldPath) || null,
      getByHtmlAttr: (attr) => byHtmlAttr.get(attr) || null,
      getRetiredHtmlAttr: (attr) => byRetiredHtmlAttr.get(attr) || null,
      listByOwner: (owner) => normalized.filter((entry) => entry.owner === owner),
      listByClass: (fieldClass) => normalized.filter((entry) => entry.fieldClass === fieldClass),
      listByLifecycle: (lifecycle) => normalized.filter((entry) => entry.lifecycle === lifecycle),
    };
  }

  function htmlAttrsFor(entry) {
    const html = entry.html || {};
    return [
      ...(html.readAttrs || []),
      ...(html.writeAttrs || []),
      ...(html.persistAttrs || []),
    ];
  }

  function retiredHtmlAttrsFor(entry) {
    if (entry.lifecycle !== 'retired') return [];
    return ((entry.retired || {}).htmlAttrs || []);
  }

  function retiredHtmlAttrRecord(entry, retiredHtmlAttr) {
    return {
      canonicalPath: entry.canonicalPath,
      owner: entry.owner,
      fieldClass: entry.fieldClass,
      lifecycle: entry.lifecycle,
      name: retiredHtmlAttr.name,
      readPolicy: retiredHtmlAttr.readPolicy,
      writePolicy: retiredHtmlAttr.writePolicy,
      replacedBy: retiredHtmlAttr.replacedBy,
      reason: retiredHtmlAttr.reason,
      entry,
    };
  }
  
  module.exports = {
    createFieldRegistry,
  };
  ```
  
  更新 `src/protocol/index.js`：
  
  ```js
  const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
  const { createFieldRegistry } = require('./registry');
  
  module.exports = {
   normalizeFieldEntry,
   validateFieldEntry,
   createFieldRegistry,
  };
  ```

- **步骤 1.8：确认 registry GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/registry.test.js
  ```
  
  预期： PASS.

- **步骤 1.9：运行 protocol 核心测试。**
  
  运行：
  
  ```bash
  node --test test/protocol/*.test.js
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果 registry 核心 API 需要引入第三方依赖，停止并重新评估；当前需求用纯 JS 足够。

---

### 阶段 2：登记当前事实字段，不接入强门禁

**目标：** 按 spec 阶段 0/1，把当前事实字段先登记，允许 `currentPaths` 和 retired aliases，扫描只 warning。spec 明确阶段 1 新建 `src/protocol/`、先登记当前已有字段、允许 `currentPaths / aliases`、扫描只 warning。

**文件：**

- Create: `src/protocol/fields/document-page.js`

- Create: `src/protocol/fields/styles.js`

- Create: `src/protocol/fields/assets.js`

- Create: `src/protocol/fields/labels.js`

- Create: `src/protocol/fields/source-metadata.js`

- Create: `src/protocol/fields/visual-style.js`

- Create: `src/protocol/fields/vector-geometry.js`

- Create: `src/protocol/fields/text.js`

- Create: `src/protocol/fields/table.js`

- Create: `src/protocol/fields/observation.js`

- Create: `src/protocol/fields/retired.js`

- Create: `src/protocol/fields/pptx-extensions.js`

- Modify: `src/protocol/index.js`

- Test: `test/protocol/current-field-facts.test.js`

- Test: `test/protocol/registry.test.js`

检查清单：

- **步骤 2.1：写 registry current facts RED 测试。**
  
  扩展 `test/protocol/current-field-facts.test.js`：
  
  ```js
  const { fieldRegistry } = require('../../src/protocol');
  
  test('registry contains current PDF page number facts separate from retired data-id-page facts', () => {
   const field = fieldRegistry.getByPath('items[].asset.placement.pageNumber');
  
   assert.equal(field.fieldClass, 'canonical');
   assert.equal(field.lifecycle, 'active');
   assert.deepEqual(field.html.readAttrs, ['data-id-pdf-page']);
   assert.equal(fieldRegistry.getByHtmlAttr('data-id-page'), null);

   const retiredLookup = fieldRegistry.getRetiredHtmlAttr('data-id-page');
   assert.equal(retiredLookup.canonicalPath, 'retired.htmlAttrs.dataIdPage');
   assert.equal(retiredLookup.fieldClass, 'observation');
   assert.equal(retiredLookup.lifecycle, 'retired');
   assert.equal(retiredLookup.name, 'data-id-page');
   assert.equal(retiredLookup.readPolicy, 'observe-only');
   assert.equal(retiredLookup.writePolicy, 'forbidden');
   assert.equal(retiredLookup.replacedBy, 'data-id-pdf-page');
  });
  
  test('registry contains sourceNode as sourceMetadata not canonical', () => {
   const field = fieldRegistry.getByPath('items[].sourceNode');
   assert.equal(field.fieldClass, 'sourceMetadata');
   assert.equal(field.lifecycle, 'active');
   assert.equal(field.capabilities.indesign.write, 'observe-only');
  });
  
  test('registry contains effectiveLabel and observedLabel observation boundaries', () => {
   assert.equal(fieldRegistry.getByPath('items[].effectiveLabel').fieldClass, 'sourceMetadata');
   assert.equal(fieldRegistry.getByPath('items[].observedLabel').fieldClass, 'observation');
  });
  ```

- **步骤 2.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/current-field-facts.test.js
  ```
  
  预期： FAIL because `fieldRegistry` and field definitions are missing.

- **步骤 2.3：实现字段定义文件。**
  
  先登记最小必要字段，不一次登记所有 CSS 属性。每个文件输出数组：
  
  `src/protocol/fields/assets.js` 示例：
  
  ```js
  module.exports = [
   {
     canonicalPath: 'assets[].path',
     currentPaths: ['assets[].src', 'assets[].resolvedPath', 'items[].asset.path'],
     fieldClass: 'canonical',
     lifecycle: 'active',
     owner: 'asset-placement',
     type: 'string',
     capabilities: {
       html: { read: 'native', write: 'native', persist: 'native' },
       indesign: { read: 'native', write: 'native', persist: 'native' },
       pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData', risk: 'external-link-policy' },
     },
     html: {
       readAttrs: ['src', 'href', 'data', 'data-id-asset-path'],
       writeAttrs: ['src', 'href', 'data', 'data-id-asset-path'],
     },
     indesign: {
       snapshotPaths: ['placedAsset.path', 'asset.path'],
       labelPaths: ['asset.path'],
       instructionPaths: ['placed.assetId'],
     },
     pptx: {
       customDataPaths: ['htmlIndesign.assets[].path'],
     },
   },
   {
     canonicalPath: 'items[].asset.placement.pageNumber',
     currentPaths: [
       'items[].asset.pageNumber',
       'items[].asset.placement.pageNumber',
       'instructions.pages[].items[].placed.pageNumber',
     ],
     fieldClass: 'canonical',
     lifecycle: 'active',
     owner: 'asset-placement',
     type: 'integer',
     validation: { min: 1, integer: true },
     html: {
       readAttrs: ['data-id-pdf-page'],
       writeAttrs: ['data-id-pdf-page'],
     },
     indesign: {
       snapshotPaths: ['placedAsset.placement.pageNumber', 'graphic.pdfAttributes.pageNumber'],
       labelPaths: ['asset.pageNumber'],
       instructionPaths: ['placed.pageNumber'],
     },
     pptx: {
       customDataPaths: ['htmlIndesign.items[].asset.placement.pageNumber'],
     },
     capabilities: {
       html: { read: 'native', write: 'native', persist: 'native' },
       indesign: { read: 'native', write: 'native', persist: 'native' },
       pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'preview-image', risk: 'editable-loss' },
     },
   },
  ];
  ```
  
  `src/protocol/fields/retired.js` 单独登记退役 HTML 属性；它不属于
  active PDF page number 字段，也不进入 `getByHtmlAttr()`：

  ```js
  module.exports = [
   {
     canonicalPath: 'retired.htmlAttrs.dataIdPage',
     currentPaths: [],
     fieldClass: 'observation',
     lifecycle: 'retired',
     owner: 'asset-placement',
     type: 'attribute',
     capabilities: {
       html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
       indesign: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
       pptx: { read: 'unsupported', write: 'unsupported', persist: 'unsupported' },
     },
     retired: {
       htmlAttrs: [{
         name: 'data-id-page',
         replacedBy: 'data-id-pdf-page',
         readPolicy: 'observe-only',
         writePolicy: 'forbidden',
         reason: 'ambiguous-with-page-identity',
       }],
     },
   },
  ];
  ```

  `src/protocol/fields/source-metadata.js` 示例：
  
  ```js
  module.exports = [
   {
     canonicalPath: 'items[].sourceNode',
     currentPaths: ['labels[].sourceNode', 'effectiveLabel.sourceNode'],
     fieldClass: 'sourceMetadata',
     lifecycle: 'active',
     owner: 'source-metadata',
     type: 'object',
     capabilities: {
       html: { read: 'native', write: 'native', persist: 'native' },
       indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
       pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
     },
   },
   {
     canonicalPath: 'items[].sourceAncestorNodes',
     currentPaths: ['labels[].sourceAncestorNodes', 'effectiveLabel.sourceAncestorNodes'],
     fieldClass: 'sourceMetadata',
     lifecycle: 'active',
     owner: 'source-metadata',
     type: 'array',
     capabilities: {
       html: { read: 'native', write: 'native', persist: 'native' },
       indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
       pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
     },
   },
   {
     canonicalPath: 'items[].effectiveLabel',
     currentPaths: ['pages[].items[].effectiveLabel'],
     fieldClass: 'sourceMetadata',
     lifecycle: 'active',
     owner: 'label-protocol',
     type: 'object',
     capabilities: {
       html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
       indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
       pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
     },
   },
  ];
  ```
  
  `src/protocol/fields/observation.js` 示例：
  
  ```js
  module.exports = [
   {
     canonicalPath: 'items[].observedLabel',
     currentPaths: ['pages[].items[].observedLabel'],
     fieldClass: 'observation',
     lifecycle: 'active',
     owner: 'label-protocol',
     type: 'object',
     capabilities: {
       html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
       indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
       pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
     },
     validation: {
       mayDriveStructuredCompilation: false,
     },
   },
  ];
  ```

- **步骤 2.4：聚合 fieldRegistry。**
  
  `src/protocol/index.js`：
  
  ```js
  const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
  const { createFieldRegistry } = require('./registry');
  
  const fieldEntries = [
   ...require('./fields/document-page'),
   ...require('./fields/styles'),
   ...require('./fields/assets'),
   ...require('./fields/labels'),
   ...require('./fields/source-metadata'),
   ...require('./fields/visual-style'),
   ...require('./fields/vector-geometry'),
   ...require('./fields/text'),
   ...require('./fields/table'),
   ...require('./fields/observation'),
   ...require('./fields/retired'),
   ...require('./fields/pptx-extensions'),
  ];
  
  const fieldRegistry = createFieldRegistry(fieldEntries);
  
  module.exports = {
   normalizeFieldEntry,
   validateFieldEntry,
   createFieldRegistry,
   fieldEntries,
   fieldRegistry,
  };
  ```

- **步骤 2.5：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/current-field-facts.test.js test/protocol/registry.test.js
  ```
  
  预期： PASS.

- **步骤 2.6：运行全量测试。**
  
  运行：
  
  ```bash
  npm test
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果登记字段时发现同义路径冲突，不允许绕过 duplicate path 检查；必须决定 canonicalPath 或 retired alias。

---

### 阶段 3：能力矩阵和生命周期策略门禁

**目标：** 实现 read/write/persist 能力查询和 lifecycle policy，不接入写出器强拦截前先测试 API。

**文件：**

- Modify: `src/protocol/capability.js`

- Modify: `src/protocol/lifecycle.js`

- Create: `src/protocol/field-query.js`

- Test: `test/protocol/capability.test.js`

- Test: `test/protocol/lifecycle.test.js`

检查清单：

- **步骤 3.1：写 capability RED 测试。**
  
  `test/protocol/capability.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { fieldRegistry, capabilityFor, assertWritable } = require('../../src/protocol');
  
  test('capabilityFor returns read write persist per format', () => {
   const capability = capabilityFor(fieldRegistry, 'items[].asset.placement.pageNumber', 'pptx');
  
   assert.equal(capability.read, 'unsupported');
   assert.equal(capability.write, 'fallback');
   assert.equal(capability.persist, 'lossless');
   assert.equal(capability.fallbackKind, 'preview-image');
  });
  
  test('assertWritable rejects observe-only and unsupported fields', () => {
   assert.throws(
     () => assertWritable(fieldRegistry, 'items[].observedLabel', 'indesign'),
     /FIELD_WRITE_FORBIDDEN/
   );
  });
  ```

- **步骤 3.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/capability.test.js
  ```
  
  预期： FAIL because `capabilityFor` / `assertWritable` are missing.

- **步骤 3.3：实现 capability 查询。**
  
  `src/protocol/field-query.js`：
  
  ```js
  function fieldFor(registry, fieldPath) {
   const field = registry.getByPath(fieldPath);
   if (!field) throw new Error(`FIELD_NOT_REGISTERED:${fieldPath}`);
   return field;
  }
  
  function capabilityFor(registry, fieldPath, format) {
   const field = fieldFor(registry, fieldPath);
   return field.capabilities[format] || { read: 'unsupported', write: 'unsupported', persist: 'unsupported' };
  }
  
  function assertWritable(registry, fieldPath, format) {
   const capability = capabilityFor(registry, fieldPath, format);
   if (capability.write === 'unsupported' || capability.write === 'observe-only') {
     throw new Error(`FIELD_WRITE_FORBIDDEN:${format}:${fieldPath}:${capability.write}`);
   }
   return capability;
  }
  
  module.exports = {
   fieldFor,
   capabilityFor,
   assertWritable,
  };
  ```
  
  更新 `src/protocol/index.js` 导出。

- **步骤 3.4：确认 capability GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/capability.test.js
  ```
  
  预期： PASS.

- **步骤 3.5：写 lifecycle RED 测试。**
  
  `test/protocol/lifecycle.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { fieldRegistry, lifecyclePolicyFor } = require('../../src/protocol');
  
  test('retired fields are observe-only and write-forbidden', () => {
   const policy = lifecyclePolicyFor(fieldRegistry, 'retired.htmlAttrs.dataIdPage');

   assert.equal(policy.lifecycle, 'retired');
   assert.equal(policy.readPolicy, 'observe-only');
   assert.equal(policy.writePolicy, 'forbidden');
   assert.equal(policy.replacedBy, 'data-id-pdf-page');
  });
  ```

- **步骤 3.6：确认 lifecycle RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/lifecycle.test.js
  ```
  
  预期： FAIL because retired path query is missing.

- **步骤 3.7：实现 retired lifecycle 查询。**
  
  retired lifecycle 必须以阶段 2 的 retired entry 为唯一事实源：`retired.htmlAttrs.dataIdPage`。不得把旧 HTML 属性名拼成 currentPath，不得从 active entry 读取退役属性策略，不得让 `data-id-page` 进入 `getByHtmlAttr()`。如需按退役 HTML 属性名查询，只能复用 `getRetiredHtmlAttr()` 这类独立 retired metadata surface。在 `src/protocol/field-query.js` 增加：
  
  ```js
  function lifecyclePolicyFor(registry, fieldPath) {
   const active = registry.getByPath(fieldPath);
   if (active) {
     return {
       lifecycle: active.lifecycle,
       readPolicy: active.readPolicy || 'read',
       writePolicy: active.writePolicy || 'write',
       replacedBy: active.replacedBy || null,
     };
   }
  
   throw new Error(`FIELD_NOT_REGISTERED:${fieldPath}`);
  }
  ```

- **步骤 3.8：确认 lifecycle GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/lifecycle.test.js
  ```
  
  预期： PASS.

- **步骤 3.9：运行 protocol 测试。**
  
  运行：
  
  ```bash
  node --test test/protocol/*.test.js
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果一个字段无法明确 read/write/persist，不能登记为 active canonical；先登记为 candidate 或 observation。

---

### 阶段 4：字段扫描和仅警告门禁

**目标：** 扫描代码中的 `data-id-*`、label 字段、instructions 字段、模型路径，先 warning，不阻断现有链路。spec 阶段 2 要求新增字段未注册 error、历史未知字段 warning；本阶段先完成 warning 报告，为强门禁做准备。

**文件：**

- Create: `src/protocol/scanners/scan-data-id-fields.js`

- Create: `src/protocol/scanners/scan-model-paths.js`

- Create: `src/protocol/scanners/scan-instruction-paths.js`

- Create: `src/protocol/validators/validate-data-id-fields.js`

- Create: `src/protocol/validators/validate-model-fields.js`

- Create: `src/protocol/validators/validate-instruction-fields.js`

- Test: `test/protocol/validate-data-id-fields.test.js`

- Test: `test/protocol/validate-model-fields.test.js`

- Test: `test/protocol/validate-instruction-fields.test.js`

检查清单：

- **步骤 4.1：写 data-id scanner RED 测试。**
  
  `test/protocol/validate-data-id-fields.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { validateDataIdFields, fieldRegistry } = require('../../src/protocol');
  
  test('validateDataIdFields reports registered, unknown and retired data-id attrs', () => {
   const result = validateDataIdFields(fieldRegistry, [
     'data-id-pdf-page',
     'data-id-made-up',
     'data-id-page'
   ]);
  
   assert.deepEqual(result.accepted, ['data-id-pdf-page']);
   assert.deepEqual(result.unknown, ['data-id-made-up']);
   assert.deepEqual(result.retired.map((item) => item.name), ['data-id-page']);
  });
  ```

- **步骤 4.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-data-id-fields.test.js
  ```
  
  预期： FAIL.

- **步骤 4.3：实现 data-id validator。**
  
  `src/protocol/validators/validate-data-id-fields.js`：
  
  ```js
  function validateDataIdFields(registry, attrs = []) {
   const accepted = [];
   const unknown = [];
   const retired = [];
  
   for (const attr of attrs) {
     const active = registry.getByHtmlAttr(attr);
     if (active && active.lifecycle !== 'retired') {
       accepted.push(attr);
       continue;
     }
     const policy = registry.getRetiredByPath && registry.getRetiredByPath(`html.${attr}`);
     if (policy) {
       retired.push({ name: attr, ...policy });
       continue;
     }
     unknown.push(attr);
   }
  
   return { accepted, unknown, retired };
  }
  
  module.exports = { validateDataIdFields };
  ```
  
  更新 `src/protocol/index.js` 导出。

- **步骤 4.4：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-data-id-fields.test.js
  ```
  
  预期： PASS.

- **步骤 4.5：实现模型和 instructions validator 的 RED/GREEN。**
  
  `test/protocol/validate-model-fields.test.js` 断言：
  
  ```js
  test('validateModelFields rejects unknown canonical field in strict mode', () => {
   const model = {
     kind: 'DocumentModel',
     id: 'doc',
     pages: [{ id: 'p1', items: [{ id: 'i1', madeUpField: 1 }] }]
   };
  
   const result = validateModelFields(fieldRegistry, model, { strict: true });
  
   assert.equal(result.valid, false);
   assert.match(result.errors.map((error) => error.code).join(','), /MODEL_FIELD_NOT_REGISTERED/);
  });
  ```
  
  `test/protocol/validate-instruction-fields.test.js` 断言：
  
  ```js
  test('validateInstructionFields allows registered placed pageNumber path', () => {
   const instructions = {
     pages: [{ items: [{ type: 'GRAPHIC', placed: { pageNumber: 2 } }] }]
   };
  
   const result = validateInstructionFields(fieldRegistry, instructions, { strict: true });
  
   assert.equal(result.valid, true);
  });
  ```
  
  实现策略：
  
  - 先只扫描已知关键路径：
    
    - `pages[].items[].placed.*`
    
    - `pages[].items[].labels[]`
    
    - `document.labels[]`
    
    - `pages[].labels[]`
    
    - `styles.*`
  
  - 未覆盖路径先 warning，不做泛型深度扫描阻塞。
  
  - 强校验按阶段 7 逐域打开。

- **步骤 4.6：运行扫描 validator 测试。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-data-id-fields.test.js test/protocol/validate-model-fields.test.js test/protocol/validate-instruction-fields.test.js
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果 scanner 报出大量未知字段，不要关闭 scanner；把未知字段归类到 `candidate`、`observation` 或 `retired`，直到报告收敛。

---

### 阶段 5：接入语义模型和标签白名单

**目标：** 把 registry 接入模型校验和反向标签复核，但先按字段域 warning，不立即全局 error。长期规范要求反向导出每次按语义库复核标签，不合规字段只能观察，不参与后续编译。

**文件：**

- Modify: `src/semantic-model/validator.js`

- Modify: `src/indesign-reverse/label-whitelist.js`

- Modify: `src/indesign-reverse/reverse-model.js`

- Test: `test/semantic-model/validator.test.js`

- Test: `test/indesign-reverse/label-whitelist.test.js`

- Test: `test/protocol/validate-label-fields.test.js`

检查清单：

- **步骤 5.1：写 Semantic Model registry RED 测试。**
  
  `test/semantic-model/validator.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { validateSemanticModel } = require('../../src/semantic-model');
  
  test('validateSemanticModel reports unknown fields when protocol strictFields is true', () => {
   const result = validateSemanticModel({
     kind: 'DocumentModel',
     id: 'doc',
     labels: [{ kind: 'document', id: 'doc' }],
     pages: [{
       id: 'p1',
       labels: [{ kind: 'page', id: 'p1' }],
       items: [{
         id: 'i1',
         role: 'text',
         labels: [{ kind: 'item', id: 'i1' }],
         unknownProtocolField: 'x'
       }]
     }]
   }, { strictFields: true });
  
   assert.equal(result.valid, false);
   assert.match(result.errors.map((error) => error.code).join(','), /MODEL_FIELD_NOT_REGISTERED/);
  });
  ```

- **步骤 5.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/semantic-model/validator.test.js
  ```
  
  预期： FAIL because validator ignores unknown fields.

- **步骤 5.3：接入 `validateModelFields`。**
  
  `src/semantic-model/validator.js` 改造：
  
  ```js
  const { fieldRegistry, validateModelFields } = require('../protocol');
  
  function validateSemanticModel(model, options = {}) {
   const errors = [];
   const warnings = [];
  
   // 保留现有结构检查。
  
   if (options.strictFields || options.warnFields) {
     const fieldResult = validateModelFields(fieldRegistry, model, {
       strict: Boolean(options.strictFields),
     });
     errors.push(...fieldResult.errors);
     warnings.push(...fieldResult.warnings);
   }
  
   return { valid: errors.length === 0, errors, warnings };
  }
  ```

- **步骤 5.4：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/semantic-model/validator.test.js
  ```
  
  预期： PASS.

- **步骤 5.5：写 label validator RED 测试。**
  
  `test/protocol/validate-label-fields.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { validateLabelFields, fieldRegistry } = require('../../src/protocol');
  
  test('validateLabelFields allows registered common label fields and rejects unknown label payload field', () => {
   const result = validateLabelFields(fieldRegistry, {
     protocol: 'html-indesign',
     version: 1,
     kind: 'item',
     id: 'item-1',
     source: 'html-to-indesign',
     semantic: 'page-title',
     imaginaryLabelField: true
   }, { strict: true });
  
   assert.equal(result.valid, false);
   assert.match(result.errors.map((error) => error.code).join(','), /LABEL_FIELD_NOT_REGISTERED/);
  });
  ```

- **步骤 5.6：实现 `validateLabelFields` 并接入 `label-whitelist`。**
  
  要求：
  
  - `protocol/version/kind/id/source` 必须登记为 label common fields。
  
  - `semantic/layout/styleRefs/sourceNode/sourceFile/sourceText/sourceHtml/sourceRuns/structure` 必须登记。
  
  - unknown label payload 在 structured strict 模式为 error。
  
  - observation 模式为 warning/report。

- **步骤 5.7：确认 label GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-label-fields.test.js test/indesign-reverse/label-whitelist.test.js
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果反向导出 structured 模式开始吞掉有效字段，停止；优先修 `validateLabelFields` 的字段映射，不允许在 `html-writer` 中绕过。

---

### 阶段 6：退役字段集中登记与清理

**目标：** 按 `AGENTS.md` 和 spec 清理退役字段。退役字段可以识别，但只能 observation/report，不能写出，不能作为读取兜底。`LABEL_PROTOCOL.md` 明确旧 `data-id-page` 不能作为 PDF 页码读取兜底；`REVERSE_EXPORT.md` 也要求旧字段只能观察或迁移清单。

**文件：**

- Modify: `src/protocol/fields/retired.js`

- Modify: `src/adapters/html/reader/asset-detector.js` or current `src/paged-html/asset-detector.js` before move

- Modify: `src/writers/html/author-html-tree.js` or current `src/indesign-reverse/author-html-tree.js` before move

- Test: `test/protocol/validate-retired-fields.test.js`

- Test: `test/paged-html/asset-detector.test.js`

- Test: `test/indesign-reverse/author-html-tree.test.js`

检查清单：

- **步骤 6.1：写 retired RED 测试。**
  
  `test/protocol/validate-retired-fields.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { fieldRegistry, validateRetiredFields } = require('../../src/protocol');
  
  test('retired data-id-page is reported and forbidden as writer output', () => {
   const result = validateRetiredFields(fieldRegistry, {
     htmlAttrs: ['data-id-page'],
     direction: 'write'
   });
  
   assert.equal(result.valid, false);
   assert.deepEqual(result.errors.map((error) => error.code), ['RETIRED_FIELD_WRITE_FORBIDDEN']);
  });
  
  test('retired data-id-page is accepted only as observe-only read', () => {
   const result = validateRetiredFields(fieldRegistry, {
     htmlAttrs: ['data-id-page'],
     direction: 'read'
   });
  
   assert.equal(result.valid, true);
   assert.equal(result.observations[0].readPolicy, 'observe-only');
  });
  ```

- **步骤 6.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-retired-fields.test.js
  ```
  
  预期： FAIL.

- **步骤 6.3：实现 retired validator。**
  
  `src/protocol/validators/validate-retired-fields.js`：
  
  ```js
  function validateRetiredFields(registry, input = {}) {
   const htmlAttrs = input.htmlAttrs || [];
   const direction = input.direction || 'read';
   const errors = [];
   const observations = [];
  
   for (const attr of htmlAttrs) {
     const policy = registry.getRetiredByPath && registry.getRetiredByPath(`html.${attr}`);
     if (!policy) continue;
     if (direction === 'write' && policy.writePolicy === 'forbidden') {
       errors.push({
         code: 'RETIRED_FIELD_WRITE_FORBIDDEN',
         field: attr,
         replacedBy: policy.replacedBy,
       });
     } else {
       observations.push({
         field: attr,
         readPolicy: policy.readPolicy,
         replacedBy: policy.replacedBy,
         reason: policy.reason,
       });
     }
   }
  
   return { valid: errors.length === 0, errors, observations };
  }
  
  module.exports = { validateRetiredFields };
  ```

- **步骤 6.4：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-retired-fields.test.js
  ```
  
  预期： PASS.

- **步骤 6.5：写 no-fallback grep 测试。**
  
  在 `test/protocol/validate-retired-fields.test.js` 增加：
  
  ```js
  const fs = require('node:fs');
  const path = require('node:path');
  
  function collectRuntimeFiles(relativeRoots) {
   const root = path.join(__dirname, '../..');
   const files = [];
   for (const relativeRoot of relativeRoots) {
     const absoluteRoot = path.join(root, relativeRoot);
     if (!fs.existsSync(absoluteRoot)) continue;
     collect(absoluteRoot, files);
   }
   return files;
  }
  
  function collect(directory, files) {
   for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
     const fullPath = path.join(directory, entry.name);
     if (entry.isDirectory()) {
       collect(fullPath, files);
       continue;
     }
     if (entry.isFile() && entry.name.endsWith('.js')) {
       files.push(fullPath);
     }
   }
  }
  
  test('source code does not read data-id-page as PDF page number fallback', () => {
   const files = collectRuntimeFiles([
     'src/paged-html',
     'src/indesign-reverse',
     'src/adapters/html',
     'src/adapters/indesign',
     'src/writers/html',
     'src/writers/indesign',
     'src/semantic-model',
     'src/shared'
   ]);
  
  assert.notEqual(files.length, 0, 'retired field scan must cover active runtime files');
   const relativeFiles = files.map((file) => file.replace(/\\/g, '/'));
   assert.ok(relativeFiles.some((file) => file.endsWith('/asset-detector.js')), 'scan must cover asset detector');
   assert.ok(
     relativeFiles.some((file) => file.endsWith('/author-html-tree.js') || file.endsWith('/visual-html-writer.js')),
     'scan must cover reverse HTML writer'
   );
  
  for (const file of files) {
     const source = fs.readFileSync(file, 'utf8');
     assert.equal(/data-id-page['"\]]\s*\|\|/.test(source), false, file);
     assert.equal(/data-id-page.*pageNumber/.test(source), false, file);
   }
  });
  ```

  这个测试必须扫描阶段 6 的旧路径和阶段 8 后的新路径，不能因为旧目录已删除而空扫通过。阶段 8 迁移完成后不重写测试路径清单；该测试通过“旧路径 + 新路径 + 核心文件断言”覆盖两种目录生命周期。

- **步骤 6.6：运行 retired 相关测试。**
  
  运行：
  
  ```bash
  node --test test/protocol/validate-retired-fields.test.js test/paged-html/asset-detector.test.js test/indesign-reverse/author-html-tree.test.js
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果有旧字段仍在结构化编译中生效，本阶段不能完成；必须按 `AGENTS.md` 当严重缺陷清理。

---

### 阶段 7：按域接入强校验

**目标：** 按 spec 阶段 3 逐域启用 error：asset.placement、source metadata、styleRefs、labels、visualStyle/vectorGeometry、table/text。

**文件：**

- Modify: `src/protocol/validators/*`

- Modify: `src/semantic-model/validator.js`

- Modify: writer / normalizer 调用点

- Test: domain-specific existing tests plus new protocol tests

检查清单：

- **步骤 7.1：asset.placement 强校验。**
  
  红灯测试：
  
  ```js
  test('asset placement unknown field is error in strict asset domain', () => {
   const result = validateModelFields(fieldRegistry, {
     kind: 'DocumentModel',
     pages: [{
       id: 'p1',
       items: [{
         id: 'i1',
         role: 'graphic',
         asset: { placement: { fakePlacement: true } }
       }]
     }]
   }, { strict: true, domains: ['asset.placement'] });
  
   assert.equal(result.valid, false);
   assert.match(result.errors.map((error) => error.code).join(','), /MODEL_FIELD_NOT_REGISTERED/);
  });
  ```
  
  绿灯： register valid placement fields and reject unknown.

- **步骤 7.2：source metadata 强校验。**
  
  红灯： unknown source metadata path cannot pass strict mode.
  
  绿灯： allow `sourcePackage`、`sourceFile`、`sourceNode`、`sourceAncestorNodes`、`sourceText`、`sourceHtml`、`sourceRuns`、`structure` only.

- **步骤 7.3：styleRefs 强校验。**
  
  红灯： `styleRefs.fakeStyleToken` error.
  
  绿灯： allow paragraph/character/object/frame/table/cell/layer token/name pairs.

- **步骤 7.4：labels 强校验。**
  
  红灯： unknown label field error in structured mode.
  
  绿灯： observation mode warning/report only.

- **步骤 7.5：visualStyle/vectorGeometry 强校验。**
  
  红灯： unknown `visualStyle.rawIndesignBlendMode` error unless under `extensions.indesign.*`.
  
  绿灯： allow standardized fields:
  
  - `fillColor`
  
  - `fillOpacity`
  
  - `strokeColor`
  
  - `strokeWeight`
  
  - `strokeOpacity`
  
  - `strokeStyle`
  
  - `strokeLineCap`
  
  - `strokeLineJoin`
  
  - `strokeMiterLimit`
  
  - `strokeAlignment`
  
  - `lineStartMarker`
  
  - `lineEndMarker`
  
  - `blendMode`
  
  - `effects`
  
  - `vectorGeometry.kind`
  
  - `vectorGeometry.paths`

- **步骤 7.6：table/text 强校验。**
  
  红灯： unknown text/table field error.
  
  绿灯： allow current static spec fields.

- **步骤 7.7：每个域启用后跑该域测试和全量测试。**
  
  Run after each domain:
  
  ```bash
  node --test test/protocol/*.test.js
  npm test
  ```
  
  预期： PASS.

回退 / 停止条件：

- 若某域强校验导致大量 false positive，不能关闭强校验；应补齐 registry 的 currentPaths 或把字段登记为 observation/candidate。

---

### 阶段 8：目录重构为适配器 / 写出器

**目标：** 在 registry 已经约束字段后，移动模块，删除旧目录，更新 imports。当前 `AGENTS.md` 已把 `src/protocol/` 和 `src/adapters/` 标为计划边界；spec 也要求格式 reader/normalizer/writer 分层。

**文件：**

- 移动第 4.2 节列出的全部文件。

- 修改：`index.js`

- 修改：`scripts/`

- 修改：`test/`

- 所有导入更新后删除旧目录。

检查清单：

- **步骤 8.1：写新 public API RED 测试。**
  
  `test/protocol/baseline-imports.test.js` 改为目标 API：
  
  ```js
  test('public entry exposes protocol adapters semanticModel and writers after refactor', () => {
   const api = require('../../index');
  
   assert.equal(typeof api.protocol.fieldRegistry.getByPath, 'function');
   assert.equal(typeof api.adapters.html.renderSnapshot, 'function');
   assert.equal(typeof api.adapters.html.snapshotToSemanticModel, 'function');
   assert.equal(typeof api.adapters.indesign.reverseSnapshotToSemanticModel, 'function');
   assert.equal(typeof api.adapters.indesign.blueprintMigrationToSemanticModel, 'function');
   assert.equal(typeof api.writers.indesign.semanticModelToInstructions, 'function');
   assert.equal(typeof api.writers.indesign.compileStyles, 'function');
   assert.equal(typeof api.writers.html.semanticModelToHtml, 'function');
  });
  ```

- **步骤 8.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/baseline-imports.test.js
  ```
  
  预期： FAIL because public API has old names.

- **步骤 8.3：移动 HTML reader / normalizer。**
  
  移动：
  
  ```powershell
  New-Item -ItemType Directory -Force src\adapters\html\reader, src\adapters\html\normalizer, src\adapters\html\validators, src\semantic-model, src\shared | Out-Null
  git mv src\paged-html\browser-snapshot.js src\adapters\html\reader\browser-snapshot.js
  git mv src\paged-html\page-detector.js src\adapters\html\reader\page-detector.js
  git mv src\paged-html\asset-detector.js src\adapters\html\reader\asset-detector.js
  git mv src\paged-html\source-metadata.js src\adapters\html\reader\source-metadata.js
  git mv src\semantic-model\from-snapshot.js src\adapters\html\normalizer\snapshot-to-model.js
  git mv src\paged-html\authoring-validator.js src\adapters\html\validators\authoring-validator.js
  git mv src\paged-html\stacking.js src\adapters\html\reader\stacking.js
  git mv src\paged-html\style-reader.js src\adapters\html\reader\style-reader.js
  git mv src\paged-html\layout.js src\semantic-model\layout.js
  git mv src\paged-html\style-utils.js src\shared\style-utils.js
  ```
  
  更新相对导入。

- **步骤 8.4：移动 InDesign reader / normalizer。**
  
  ```powershell
  New-Item -ItemType Directory -Force src\adapters\indesign\reader, src\adapters\indesign\normalizer | Out-Null
  git mv src\indesign-reverse\snapshot-reader.js src\adapters\indesign\reader\snapshot-reader.js
  git mv src\indesign-reverse\reverse-model.js src\adapters\indesign\normalizer\snapshot-to-model.js
  git mv src\indesign-reverse\label-whitelist.js src\adapters\indesign\normalizer\label-whitelist.js
  git mv src\indesign-reverse\blueprint-migration.js src\adapters\indesign\normalizer\blueprint-migration.js
  ```

- **步骤 8.5：移动 writers。**
  
  ```powershell
  New-Item -ItemType Directory -Force src\writers\indesign, src\writers\html, src\writers\html\audit | Out-Null
  git mv src\semantic-model\to-instructions.js src\writers\indesign\instruction-writer.js
  git mv src\paged-html\style-compiler.js src\writers\indesign\style-compiler.js
  git mv src\paged-html\instructions-compiler.js src\writers\indesign\instructions-compiler.js
  git mv src\paged-html\instructions-validator.js src\writers\indesign\instructions-validator.js
  
  git mv src\indesign-reverse\html-writer.js src\writers\html\visual-html-writer.js
  git mv src\indesign-reverse\author-package-writer.js src\writers\html\author-package-writer.js
  git mv src\indesign-reverse\author-html-tree.js src\writers\html\author-html-tree.js
  git mv src\indesign-reverse\author-attribute-writer.js src\writers\html\author-attribute-writer.js
  git mv src\indesign-reverse\author-style-attrs.js src\writers\html\author-style-attrs.js
  git mv src\indesign-reverse\vector-svg.js src\writers\html\vector-svg.js
  git mv src\indesign-reverse\css-blend-mode.js src\writers\html\css-blend-mode.js
  git mv src\indesign-reverse\asset-reference-policy.js src\writers\html\asset-reference-policy.js
  git mv src\indesign-reverse\author-asset-packager.js src\writers\html\author-asset-packager.js
  git mv src\indesign-reverse\author-css-writer.js src\writers\html\author-css-writer.js
  git mv src\indesign-reverse\author-source-css.js src\writers\html\author-source-css.js
  git mv src\indesign-reverse\reveal-presentation-writer.js src\writers\html\reveal-presentation-writer.js
  git mv src\indesign-reverse\semantic-candidates.js src\writers\html\semantic-candidates.js
  git mv src\indesign-reverse\author-audit.js src\writers\html\audit\author-audit.js
  git mv src\indesign-reverse\source-roundtrip-diff.js src\writers\html\audit\source-roundtrip-diff.js
  git mv src\indesign-reverse\visual-geometry-audit.js src\writers\html\audit\visual-geometry-audit.js
  ```

- **步骤 8.6：创建新 index 文件。**
  
  `src/adapters/html/index.js`：
  
  ```js
  const { renderSnapshot } = require('./reader/browser-snapshot');
  const { snapshotToSemanticModel } = require('./normalizer/snapshot-to-model');
  const { validateAuthoringRules } = require('./validators/authoring-validator');
  
  module.exports = {
   renderSnapshot,
   snapshotToSemanticModel,
   validateAuthoringRules,
  };
  ```
  
  `src/adapters/indesign/index.js`：
  
  ```js
  const { readReverseSnapshot } = require('./reader/snapshot-reader');
  const { reverseSnapshotToSemanticModel } = require('./normalizer/snapshot-to-model');
  const { blueprintMigrationToSemanticModel } = require('./normalizer/blueprint-migration');
  const { validateReverseLabel } = require('./normalizer/label-whitelist');
  
  module.exports = {
   readReverseSnapshot,
   reverseSnapshotToSemanticModel,
   blueprintMigrationToSemanticModel,
   validateReverseLabel,
  };
  ```
  
  `src/writers/indesign/index.js`：
  
  ```js
  const { semanticModelToInstructions } = require('./instruction-writer');
  const { compileStyles } = require('./style-compiler');
  const { compileInstructions } = require('./instructions-compiler');
  const { validateInstructions } = require('./instructions-validator');
  
  module.exports = {
   semanticModelToInstructions,
   compileStyles,
   compileInstructions,
   validateInstructions,
  };
  ```
  
  `src/writers/html/index.js`：
  
  ```js
  const { semanticModelToHtml } = require('./visual-html-writer');
  const { writeReverseAuthorPackage } = require('./author-package-writer');
  
  module.exports = {
   semanticModelToHtml,
   writeReverseAuthorPackage,
  };
  ```

- **步骤 8.7：更新 `src/semantic-model/index.js`。**
  
  新 `src/semantic-model/index.js` 只保留 semantic model schema / validator：
  
  ```js
  const { validateSemanticModel } = require('./validator');
  
  module.exports = {
   validateSemanticModel,
  };
  ```

- **步骤 8.8：更新根 `index.js`。**
  
  ```js
  const protocol = require('./src/protocol');
  const adapters = {
   html: require('./src/adapters/html'),
   indesign: require('./src/adapters/indesign'),
  };
  const semanticModel = require('./src/semantic-model');
  const writers = {
   html: require('./src/writers/html'),
   indesign: require('./src/writers/indesign'),
  };
  const historicalTemplate = require('./src/historical-template');
  
  module.exports = {
   protocol,
   adapters,
   semanticModel,
   writers,
   historicalTemplate,
  };
  ```
  
  PPTX 入口不得在阶段 8 提前写入根 `index.js`，因为 `src/adapters/pptx/contracts.js` 在阶段 10 才创建。阶段 10 负责把 `adapters.pptx` 加回公共入口。

- **步骤 8.9：更新 scripts 和 tests imports。**
  
  全部迁移到新路径，不保留旧路径。
  
  必须显式更新这些当前依赖路径：
  
  ```text
  scripts/indesign-e2e.js
  - ../src/paged-html -> ../src/adapters/html + ../src/writers/indesign
  - ../src/indesign-reverse/author-audit -> ../src/writers/html/audit/author-audit
  - ../src/indesign-reverse/source-roundtrip-diff -> ../src/writers/html/audit/source-roundtrip-diff
  
  scripts/indesign-reverse-export.js
  - ../src/indesign-reverse -> ../src/adapters/indesign + ../src/writers/html
  - blueprintMigrationToSemanticModel -> ../src/adapters/indesign 或 ../src/adapters/indesign/normalizer/blueprint-migration
  - ../src/indesign-reverse/author-audit -> ../src/writers/html/audit/author-audit
  
  scripts/audit-reverse-visual.js
  - ../src/indesign-reverse/visual-geometry-audit -> ../src/writers/html/audit/visual-geometry-audit
  
  scripts/audit-reverse-author-roundtrip.js
  - ../src/indesign-reverse/source-roundtrip-diff -> ../src/writers/html/audit/source-roundtrip-diff
  
  scripts/lint-authoring.js
  - ../src/paged-html -> ../src/adapters/html
  
  test/**/*.test.js
  - test/indesign-e2e-runner.test.js 中的 ../src/paged-html 和 ../src/indesign-reverse 必须显式迁移
  - compileStyles -> ../src/writers/indesign 或 ../src/writers/indesign/style-compiler
  - ../../src/paged-html/* -> 新的 adapters / writers / semantic-model / shared 路径
  - ../../src/indesign-reverse/* -> 新的 adapters / writers/html 路径
  
  src 根层历史模块预检
  - rg -n "paged-html|indesign-reverse" src/builder.js src/validator.js src/generator.js src/spec-generator.js
  - 当前预检结论：这四个历史 blueprint 工具不依赖 `src/paged-html/` 或 `src/indesign-reverse/`，本轮不纳入新公共入口；如果执行时出现新命中，必须在本阶段纳入迁移或删除。
  ```
  
  阶段 8 完成前运行 `rg -n "src[/\\]paged-html|src[/\\]indesign-reverse|require\(['""]\.\.?[/\\]paged-html['""]\)|require\(['""]\.\.?[/\\]indesign-reverse['""]\)" src test scripts index.js`，必须没有活跃导入命中。

- **步骤 8.10：确认 import GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/baseline-imports.test.js
  npm test
  ```
  
  预期： PASS.

- **步骤 8.11：删除旧 facade 和空目录。**
  
  删除：
  
  ```text
  src/paged-html/
  src/indesign-reverse/
  ```

- **步骤 8.12：写并运行旧路径不存在测试。**
  
  `test/protocol/baseline-imports.test.js` 增加：
  
  ```js
  const fs = require('node:fs');
  const path = require('node:path');
  
  test('old paged-html and indesign-reverse directories are removed after refactor', () => {
   assert.equal(fs.existsSync(path.join(__dirname, '../../src/paged-html')), false);
   assert.equal(fs.existsSync(path.join(__dirname, '../../src/indesign-reverse')), false);
  });
  ```
  
  运行：
  
  ```bash
  node --test test/protocol/baseline-imports.test.js
  npm test
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果旧目录无法删除，不能把阶段 8 标记完成；必须更新所有 import 或重新评估是否某功能尚未被迁移。

---

### 阶段 9：拆分大文件并保持行为可验证

**目标：** 控制长期复杂度，不继续扩大超大文件。拆分必须在阶段 8 后进行，以新目录边界为准。

**文件：**

- Split: `src/adapters/html/reader/browser-snapshot.js`

- Split: `src/writers/indesign/style-compiler.js`

- Split: `src/writers/indesign/instruction-writer.js`

- Split: `src/writers/html/visual-html-writer.js`

- Split: `src/writers/html/author-html-tree.js`

- Tests: existing relevant tests

Suggested splits:

```text
src/adapters/html/reader/
  browser-snapshot.js
  snapshot-style-props.js
  dom-source-node.js
  candidate-elements.js
  table-snapshot.js
  unsupported-css.js

src/writers/indesign/
  style-compiler.js
  style-identities.js
  text-style-mapping.js
  object-style-mapping.js
  table-style-mapping.js
  effect-style-mapping.js
  box-model.js

src/writers/indesign/
  instruction-writer.js
  item-instructions.js
  graphic-instructions.js
  text-instructions.js
  table-instructions.js
  layer-instructions.js
  guide-instructions.js

src/writers/html/
  visual-html-writer.js
  visual-style-css.js
  asset-html.js
  table-html.js
  rich-text-html.js

src/writers/html/
  author-html-tree.js
  author-tree-builder.js
  author-node-renderer.js
  author-asset-renderer.js
  author-vector-renderer.js
```

检查清单：

- **步骤 9.1：为每个大文件先运行现有测试，记录基线。**
  
  运行：
  
  ```bash
  npm test
  ```
  
  预期： PASS.

- **步骤 9.2：每拆一个文件，先加 focused test 或确认已有 focused test 覆盖。**
  
  示例：拆 `asset-html.js` 前新增：
  
  ```js
  test('HTML writer preserves PDF page number as data-id-pdf-page', () => {
   const html = semanticModelToHtml(modelWithPdfPageNumber(), {});
   assert.match(html, /data-id-pdf-page="3"/);
   assert.doesNotMatch(html, /data-id-page=/);
  });
  ```

- **步骤 9.3：移动纯函数，不改行为。**
  
  每次只移动一组函数，更新 require，运行对应测试。

- **步骤 9.4：每拆完一个文件运行局部 + 全量测试。**
  
  运行：
  
  ```bash
  node --test test/<relevant-test-file>.test.js
  npm test
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果拆分过程中发现行为测试不够，先补测试再继续拆；不允许“先拆完再统一修”。

---

### 阶段 10：PPTX 预留适配器 / 写出器契约

**目标：** 不实现完整 PPTX，只定义接口、能力矩阵、custom data carrier 和 fallback 资源策略。spec 明确本轮不实现完整 PPTX，阶段 6 只定义 PptxReader / PptxWriter contract、slide/page/master/layout 映射、自定义数据、fallback 策略和 capability entries。

**文件：**

- Create: `src/adapters/pptx/contracts.js`

- Create: `src/adapters/pptx/capabilities.js`

- Create: `src/adapters/pptx/README.md`

- Create: `test/protocol/pptx-contracts.test.js`

检查清单：

- **步骤 10.1：写 PPTX contract RED 测试。**
  
  `test/protocol/pptx-contracts.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  
  const { PptxReaderContract, PptxWriterContract } = require('../../src/adapters/pptx/contracts');
  const { fieldRegistry, capabilityFor } = require('../../src/protocol');
  
  test('PPTX contracts define reader and writer boundary without implementation', () => {
   assert.equal(PptxReaderContract.input, 'pptx-package');
   assert.equal(PptxReaderContract.output, 'pptx-raw-snapshot');
   assert.equal(PptxWriterContract.input, 'semantic-model');
   assert.equal(PptxWriterContract.output, 'pptx-package');
  });
  
  test('PPTX PDF pageNumber capability is fallback write and lossless persist', () => {
   const cap = capabilityFor(fieldRegistry, 'items[].asset.placement.pageNumber', 'pptx');
   assert.equal(cap.write, 'fallback');
   assert.equal(cap.persist, 'lossless');
  });
  
  test('public API exposes PPTX contract only after PPTX contract phase', () => {
   const api = require('../../index');
  
   assert.equal(api.adapters.pptx.PptxReaderContract.input, 'pptx-package');
   assert.equal(api.adapters.pptx.PptxWriterContract.input, 'semantic-model');
  });
  ```

- **步骤 10.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/pptx-contracts.test.js
  ```
  
  预期： FAIL.

- **步骤 10.3：实现 PPTX contracts。**
  
  `src/adapters/pptx/contracts.js`：
  
  ```js
  const PptxReaderContract = {
   input: 'pptx-package',
   output: 'pptx-raw-snapshot',
   normalizerOutput: 'semantic-model',
   supportedFacts: [
     'slides',
     'masters',
     'layouts',
     'shapes',
     'textBoxes',
     'tables',
     'charts',
     'media',
     'customData',
   ],
   formatExtensions: [
     'extensions.pptx.animation',
     'extensions.pptx.transition',
     'extensions.pptx.placeholder',
     'extensions.pptx.speakerNotes',
   ],
  };
  
  const PptxWriterContract = {
   input: 'semantic-model',
   output: 'pptx-package',
   customDataCarrier: 'pptx-custom-data',
   fallbackStrategies: [
     'preview-image',
     'custom-data-roundtrip',
     'unsupported-warning',
   ],
  };
  
  module.exports = {
   PptxReaderContract,
   PptxWriterContract,
  };
  ```

- **步骤 10.4：把 PPTX contract 接入根公共入口。**
  
  更新 `index.js` 的 `adapters`：
  
  ```js
  const adapters = {
   html: require('./src/adapters/html'),
   indesign: require('./src/adapters/indesign'),
   pptx: require('./src/adapters/pptx/contracts'),
  };
  ```

- **步骤 10.5：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/pptx-contracts.test.js
  ```
  
  预期： PASS.

- **步骤 10.6：写 PPTX README。**
  
  `src/adapters/pptx/README.md` 必须写清：
  
  ```text
  PPTX adapter is contract-only in this phase.
  No PPTX package read/write implementation exists yet.
  PPTX must use Semantic Model and protocol registry.
  PPTX-only fields must live under extensions.pptx.*.
  PDF/AI/PSD are fallback visual outputs but metadata persists losslessly through custom data.
  ```

回退 / 停止条件：

- 如果任何实现开始读取或写出 PPTX package，本阶段范围失控；停止并拆成新的 PPTX implementation spec。

---

### 阶段 11：字段文档生成与长期规范收口

**目标：** 注册表生成字段清单，长期规范只保留原则、边界和关键示例。`docs/README.md` 和规范目录要求注册表落地前静态字段表仍是事实源，落地后重复字段表迁移为注册表集中维护或生成文档；`AGENTS.md` 也要求过程材料形成长期规则后沉淀到规范。

**文件：**

- Create: `docs/规范/PROTOCOL_FIELD_REGISTRY.md`

- Create: `src/protocol/docs/generate-field-docs.js`

- Modify: `docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md`

- Modify: `docs/规范/SEMANTIC_PROTOCOL.md`

- Modify: `docs/规范/LABEL_PROTOCOL.md`

- Modify: `docs/规范/REVERSE_EXPORT.md`

- Modify: `docs/README.md`

- Modify: `docs/规范/README.md`

- Test: `test/protocol/generated-docs.test.js`

检查清单：

- **步骤 11.1：写 generated docs RED 测试。**
  
  `test/protocol/generated-docs.test.js`：
  
  ```js
  const test = require('node:test');
  const assert = require('node:assert/strict');
  const { generateFieldDocsMarkdown } = require('../../src/protocol/docs/generate-field-docs');
  const { fieldRegistry } = require('../../src/protocol');
  
  test('generated field docs include canonical path current paths class lifecycle and capabilities', () => {
   const markdown = generateFieldDocsMarkdown(fieldRegistry);
  
   assert.match(markdown, /items\[\]\.asset\.placement\.pageNumber/);
   assert.match(markdown, /fieldClass/);
   assert.match(markdown, /lifecycle/);
   assert.match(markdown, /read/);
   assert.match(markdown, /write/);
   assert.match(markdown, /persist/);
   assert.match(markdown, /data-id-page/);
   assert.match(markdown, /observe-only/);
  });
  ```

- **步骤 11.2：确认 RED。**
  
  运行：
  
  ```bash
  node --test test/protocol/generated-docs.test.js
  ```
  
  预期： FAIL.

- **步骤 11.3：实现 Markdown 生成器。**
  
  生成器必须支持两种用法：
  
  - `generateFieldDocsMarkdown(fieldRegistry)` 返回 Markdown 字符串，供测试调用。
  - CLI 参数 `--out <path>` 直接用 Node `fs.writeFileSync(..., 'utf8')` 写出 UTF-8 文件，避免 PowerShell `>` 重定向在不同版本下产生编码差异。
  
  输出结构：
  
  ```markdown
  # 协议字段注册表
  
  ## canonical
  
  | canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist |
  | --- | --- | --- | --- | --- | --- | --- |
  
  ## sourceMetadata
  ...
  
  ## observation
  ...
  
  ## retired
  ...
  ```

- **步骤 11.4：确认 GREEN。**
  
  运行：
  
  ```bash
  node --test test/protocol/generated-docs.test.js
  ```
  
  预期： PASS.

- **步骤 11.5：生成 `docs/规范/PROTOCOL_FIELD_REGISTRY.md`。**
  
  运行：
  
  ```powershell
  node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
  ```
  
  预期： file generated.

- **步骤 11.6：更新长期规范。**
  
  修改原则：
  
  - `HTML_INDESIGN_LIBRARY_SPEC.md` 保留架构、模型说明、关键示例，不再手写完整字段表。
  
  - `SEMANTIC_PROTOCOL.md` 保留固定语义规则、authoring 约束、历史迁移说明。
  
  - `LABEL_PROTOCOL.md` 保留标签载体、写入位置、校验错误，不再手写完整 payload 字段清单。
  
  - `REVERSE_EXPORT.md` 保留模式、观察规则、作者包目标和反向流程。
  
  - 所有字段清单链接到 `PROTOCOL_FIELD_REGISTRY.md`。

- **步骤 11.7：文档一致性测试。**
  
  添加测试确认规范文档引用 registry：
  
  ```js
  test('long-term specs reference generated protocol field registry', () => {
   for (const file of [
     'docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md',
     'docs/规范/SEMANTIC_PROTOCOL.md',
     'docs/规范/LABEL_PROTOCOL.md',
     'docs/规范/REVERSE_EXPORT.md'
   ]) {
     const text = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
     assert.match(text, /PROTOCOL_FIELD_REGISTRY\.md/, file);
   }
  });
  ```

- **步骤 11.8：运行文档生成和测试。**
  
  运行：
  
  ```powershell
  node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
  node --test test/protocol/generated-docs.test.js
  npm test
  ```
  
  预期： PASS.

回退 / 停止条件：

- 如果生成文档无法覆盖静态表里的关键字段，不删除静态字段表；先补 registry。

---

### 阶段 12：最终 E2E 和真实 InDesign 验证

**目标：** 用现有执行基线验证正向、反向、二次回环、作者包检查和文档生成都可复现。`AGENTS.md` 已列出真实 E2E、反向回读、二次回环、authoring lint、roundtrip diff 等命令。

检查清单：

- **步骤 12.1：运行全量单元测试。**
  
  运行：
  
  ```bash
  npm test
  ```
  
  预期： PASS.

- **步骤 12.2：运行作者侧规则检查。**
  
  运行：
  
  ```bash
  npm run lint:authoring -- test/fixtures/e2e/architecture-report/deck.html
  ```
  
  预期： PASS or known warnings only. If strict mode is expected for release gate:
  
  ```bash
  npm run lint:authoring -- -- --html test/fixtures/e2e/architecture-report/deck.html --strict
  ```
  
  预期： PASS.

- **步骤 12.3：运行作者源码包组装一致性检查。**
  
  运行：
  
  ```bash
  npm run assemble:authoring -- -- --package test/fixtures/e2e/architecture-report/deck.config.json --check
  ```
  
  预期： PASS.

- **步骤 12.4：运行真实 InDesign E2E。**
  
  运行：
  
  ```bash
  npm run e2e:indesign
  ```
  
  预期： PASS and output under `test/workspace/`.

- **步骤 12.5：运行真实 InDesign E2E + 回读。**
  
  运行：
  
  ```bash
  npm run e2e:indesign -- -- --reverse-roundtrip
  ```
  
  预期： PASS.

- **步骤 12.6：运行二次回环。**
  
  运行：
  
  ```bash
  npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip
  ```
  
  预期： PASS.

- **步骤 12.7：运行源码回环 diff。**
  
  用 Step 12.5 输出目录替换 `<reverse-output>`：
  
  ```bash
  npm run audit:roundtrip -- -- --source test/fixtures/e2e/architecture-report --reverse <reverse-output>/reverse-html/author --strict
  ```
  
  预期： PASS.

- **步骤 12.8：运行反向视觉几何对照。**
  
  ```bash
  npm run audit:reverse-visual -- -- --reverse-html <reverse-output>/reverse-html --out test/workspace/reverse-visual-report.json
  ```
  
  预期： PASS or documented accepted diffs.

回退 / 停止条件：

- 任一真实 E2E 失败，不得宣称完成。

- 如果失败由 registry 强校验导致，修 registry 或 validator。

- 如果失败由目录移动导致，修 import / module boundary。

- 如果失败由视觉差异导致，按共享链路修，不允许 fixture 局部补丁。

---

## 6. 测试策略

### 6.1 测试分层

1. **Protocol unit tests**
   
   - `field-entry`
   
   - `registry`
   
   - `capability`
   
   - `lifecycle`
   
   - `validators`
   
   - `scanners`
   
   - `generated-docs`

2. **Current fact regression tests**
   
   - HTML `data-id-*` 读取。
   
   - `html_indesign` label fields。
   
   - reverse `effectiveLabel` / `observedLabel`。
   
   - PDF pageNumber 不从 `data-id-page` 兜底。

3. **Adapter / writer behavior tests**
   
   - HTML reader snapshot。
   
   - HTML normalizer。
   
   - InDesign normalizer。
   
   - InDesign instruction writer。
   
   - HTML visual writer。
   
   - HTML author package writer。

4. **Refactor safety tests**
   
   - public API tests。
   
   - old path deletion tests。
   
   - import grep tests。
   
   - no duplicate field path tests。

5. **E2E tests**
   
   - `npm test`
   
   - authoring lint
   
   - authoring assemble check
   
   - real InDesign E2E
   
   - reverse roundtrip
   
   - second-pass roundtrip
   
   - source roundtrip diff
   
   - reverse visual audit

### 6.2 本轮测试驱动规则

每个阶段必须遵守：

```text
1. 写失败测试。
2. 运行测试，确认失败原因正确。
3. 写最小实现。
4. 运行局部测试，确认通过。
5. 运行相关回归测试。
6. 阶段结束运行 npm test。
```

不允许：

- 实现后补测试。

- 没看见 RED 就继续。

- 用快照更新掩盖字段漂移。

- 用 writer 特判绕过 registry。

- 用 `legacy` 或双路径保留退役字段。

### 6.3 新增测试文件清单

```text
test/protocol/field-entry.test.js
test/protocol/registry.test.js
test/protocol/capability.test.js
test/protocol/lifecycle.test.js
test/protocol/current-field-facts.test.js
test/protocol/baseline-imports.test.js
test/protocol/validate-data-id-fields.test.js
test/protocol/validate-model-fields.test.js
test/protocol/validate-label-fields.test.js
test/protocol/validate-instruction-fields.test.js
test/protocol/validate-retired-fields.test.js
test/protocol/generated-docs.test.js
test/protocol/pptx-contracts.test.js
```

---

## 7. 迁移风险

### 风险 1：字段路径标准化导致当前行为被误删

风险：把目标 `canonicalPath` 当成唯一事实路径，忽略 `currentPaths`，导致当前代码使用的 `asset.pageNumber`、`placed.pageNumber`、`data-id-pdf-page` 等路径失效。

控制：

- 阶段 0 先写当前事实测试。

- 阶段 2 使用 `currentPaths`。

- 阶段 7 才逐域强校验。

- 删除旧字段前必须登记 retired policy。

### 风险 2：目录重构后 import 双入口长期存在

风险：为了通过测试保留 `src/paged-html/` 或 `src/indesign-reverse/` facade，形成长期双入口。

控制：

- 阶段 8 明确阶段内允许临时 facade，但阶段完成前必须删除。

- 增加旧路径不存在测试。

- grep 检查旧 require。

### 风险 3：observation 污染 canonical

风险：反向导出中未通过白名单字段被 writer 当成有效语义输出。

控制：

- `observedLabel` 注册为 `fieldClass: observation`。

- `assertWritable` 禁止 observation 写入 structured writer。

- label whitelist 保持字段级 partial accept，但 unknown 字段只能 observed/report。

### 风险 4：sourceMetadata 被当作视觉兜底

风险：`sourceNode`、`sourceHtml`、`structure` 被 writer 用来绕过 canonical style/layout。

控制：

- sourceMetadata capability 对 InDesign/PPTX write 默认 `observe-only` 或 `unsupported`。

- 测试证明 sourceMetadata 不改变视觉编译。

- writer 只能用 sourceMetadata 恢复 author package，不用于 InDesign instructions。

### 风险 5：retired 字段继续隐性生效

风险：`data-id-page` 或旧 label 字段在某个路径继续作为读取兜底。

控制：

- retired validator。

- grep 测试。

- writer 输出测试。

- reverse report 测试。

- 按 AGENTS 作为严重缺陷处理。

### 风险 6：PPTX 抽象过度

风险：为了未来 PPTX 过早设计完整 Office 模型，拖慢当前 HTML/InDesign 质量。

控制：

- 阶段 10 只做 contract。

- 不实现 package read/write。

- PPTX-only fields 必须 `extensions.pptx.*`。

- PDF/AI/PSD 用 fallback + lossless customData，不改当前 HTML/InDesign 字段命名。

### 风险 7：真实 InDesign E2E 成为最后才发现的问题

风险：纯 Node 测试通过，但 JSX 执行、标签写入或资源置入失败。

控制：

- 触及 instruction writer、资源置入、JSX executor 或真实输出结构的实际行为时，在对应阶段跑 `npm run e2e:indesign` 冒烟；仅注册表、扫描器、路径迁移或测试代码变更不强制逐阶段跑真实 E2E。

- 阶段 12 必跑 reverse roundtrip 和 second-pass roundtrip。

- 失败不得用“本地环境问题”跳过；必须记录命令输出和原因。

---

## 8. 完成标准

### 8.1 功能完成标准

- `src/protocol/` 存在并导出 `fieldRegistry`。

- 所有当前事实字段已登记到 registry。

- 每个字段至少包含：
  
  - `canonicalPath`
  
  - `currentPaths`
  
  - `fieldClass`
  
  - `lifecycle`
  
  - `owner`
  
  - `capabilities.html.read/write/persist`
  
  - `capabilities.indesign.read/write/persist`
  
  - `capabilities.pptx.read/write/persist`

- retired 字段已登记，旧输入只能 observation/report。

- `data-id-page` 不再作为 PDF 页码读取兜底，不再写出。

- registry 可以查询字段、HTML attr、capability、lifecycle。

- Semantic Model validator 接入 registry。

- label validator / whitelist 接入 registry。

- writer 禁止写 unknown / observation / retired fields。

- static 字段表迁移为 `PROTOCOL_FIELD_REGISTRY.md` 或明确引用 registry 生成文档。

- PPTX contract 存在，但没有完整 PPTX package 实现。

- `src/paged-html/` 和 `src/indesign-reverse/` 不再作为长期当前架构目录存在。

- 新架构导出为：
  
  - `protocol`
  
  - `adapters.html`
  
  - `adapters.indesign`
  
  - `adapters.pptx`
  
  - `semanticModel`
  
  - `writers.html`
  
  - `writers.indesign`

### 8.2 架构完成标准

- Reader 只读 raw facts。

- Normalizer 只把 raw snapshot 转 Semantic Model。

- Semantic Model 不依赖具体格式 writer。

- Writer 不发明未登记字段。

- Executor 不做语义推断、HTML 解析、CSS cascade 或字段迁移。

- PPTX 只能通过 Semantic Model 接入。

- 没有 HTML -> InDesign、InDesign -> PPTX、PPTX -> HTML 两两专用转换器。

### 8.3 文档完成标准

- `docs/规范/PROTOCOL_FIELD_REGISTRY.md` 由 registry 生成或可由命令重新生成。

- `HTML_INDESIGN_LIBRARY_SPEC.md` 不再手写重复字段表。

- `SEMANTIC_PROTOCOL.md` 不再手写重复字段表。

- `LABEL_PROTOCOL.md` 不再手写重复 payload 字段清单。

- `REVERSE_EXPORT.md` 链接 registry，保留反向模式和观察规则。

- `docs/README.md` 和 `docs/规范/README.md` 指向 `PROTOCOL_FIELD_REGISTRY.md`。

---

## 9. 验证命令

完成前必须新鲜运行并读取输出。不能只说“应该通过”。

### 9.1 单元测试

```bash
npm test
```

预期：

```text
exit code 0
all node --test suites pass
```

### 9.2 协议专项测试

```bash
node --test test/protocol/*.test.js
```

预期：

```text
exit code 0
all protocol tests pass
```

### 9.3 作者包规则检查

```bash
npm run lint:authoring -- test/fixtures/e2e/architecture-report/deck.html
```

预期：

```text
exit code 0
no blocking authoring errors
```

Strict gate:

```bash
npm run lint:authoring -- -- --html test/fixtures/e2e/architecture-report/deck.html --strict
```

预期：

```text
exit code 0
strict authoring checks pass
```

### 9.4 作者包组装检查

```bash
npm run assemble:authoring -- -- --package test/fixtures/e2e/architecture-report/deck.config.json --check
```

预期：

```text
exit code 0
assembled author package matches generated deck
```

### 9.5 生成字段文档

```powershell
node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
node --test test/protocol/generated-docs.test.js
```

预期：

```text
exit code 0
generated registry docs include registered canonical/current/retired/capability facts
```

### 9.6 真实 InDesign E2E

```bash
npm run e2e:indesign
```

预期：

```text
exit code 0
instructions, INDD/PDF/IDML and report generated under test/workspace/
```

### 9.7 真实 InDesign 反向回环

```bash
npm run e2e:indesign -- -- --reverse-roundtrip
```

预期：

```text
exit code 0
reverse-snapshot.json and reverse-html/author/ generated
```

### 9.8 二次回环

```bash
npm run e2e:indesign -- -- --reverse-roundtrip --second-pass-roundtrip
```

预期：

```text
exit code 0
HTML -> InDesign -> HTML -> InDesign -> HTML chain completes
```

### 9.9 源码回环 diff

把 `<reverse-output>` 替换为 9.7 或 9.8 实际输出目录：

```bash
npm run audit:roundtrip -- -- --source test/fixtures/e2e/architecture-report --reverse <reverse-output>/reverse-html/author --strict
```

预期：

```text
exit code 0
no strict source roundtrip diff failures
```

### 9.10 反向视觉审核

```bash
npm run audit:reverse-visual -- -- --reverse-html <reverse-output>/reverse-html --out test/workspace/reverse-visual-report.json
```

预期：

```text
exit code 0
visual geometry audit passes or reports only documented accepted differences
```

### 9.11 退役字段 rg 门禁

```powershell
rg -n "data-id-page" src test docs/规范 docs/superpowers/specs
```

预期：

```text
only references that explicitly mark data-id-page as retired / observe-only / forbidden
no source code path uses data-id-page as PDF pageNumber fallback
```

### 9.12 旧路径删除门禁

```powershell
if (Test-Path src\paged-html) { throw "src/paged-html still exists" }
if (Test-Path src\indesign-reverse) { throw "src/indesign-reverse still exists" }

rg -n "src[/\\]paged-html|src[/\\]indesign-reverse|require\(['""]\.\.?[/\\]paged-html['""]\)|require\(['""]\.\.?[/\\]indesign-reverse['""]\)" src test scripts index.js
if ($LASTEXITCODE -eq 0) { throw "old import references remain" }
if ($LASTEXITCODE -gt 1) { exit $LASTEXITCODE }
```

预期：

```text
old directories absent
rg returns no active import references
```

---

## 10. 执行时的阶段提交建议

用户要求在 worktree 中执行；每个阶段必须在 `codex/protocol-field-registry` 分支形成可回滚提交点：

```text
test: capture current protocol field facts
feat: add protocol field registry core
feat: register current protocol fields
feat: add capability and lifecycle gates
feat: add protocol field validators
fix: retire forbidden legacy protocol fields
refactor: move html and indesign boundaries into adapters and writers
refactor: split protocol-sensitive writer modules
feat: add pptx adapter contracts
docs: generate protocol field registry spec
```

每个提交前必须运行该阶段指定测试；完成整项前必须运行第 9 节全部验证命令。最终如何集成到 `main` 不在阶段提交中假定，完成后使用收尾流程决定直接合并、创建 PR 或保留 worktree 分支。
