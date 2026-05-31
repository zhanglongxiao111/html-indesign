# 审核结论

结论：不通过

## 必改问题

- **【必改-1】阶段 8 根 index.js 依赖阶段 10 才创建的 PPTX contracts，阶段 8 完成后必崩。**
  计划阶段 8.8（第 2265-2271 行）的根 `index.js` 包含：
  ```js
  pptx: require('./src/adapters/pptx/contracts'),
  ```
  但 PPTX contracts 模块在阶段 10（第 2484-2488 行 / 步骤 10.3）才创建。阶段 8 完成后任一 `require('./index')` 或 `npm test`（它加载了 `index.js` 的测试）都会直接抛出 MODULE_NOT_FOUND 错误。即使 `npm test` 默认不经根 `index.js`，`test/public-api.test.js` 和 `test/protocol/baseline-imports.test.js` 步骤 8.1 明确要求加载 `require('../../index')`，必然失败。修复方式：要么将 PPTX contracts 创建前移至阶段 8（在步骤 8.8 之前），要么在阶段 8 步骤 8.8 先用 `null` / 占位直至阶段 10 替换；无论哪种都必须显式写入检查清单。

## 建议问题

- **【建议-1】风险 7 控制措施与阶段检查清单自相矛盾。**
  计划风险 7（第 3064-3067 行）明确写"触及 instruction writer、标签、资源、executor 字段后必须跑真实 E2E"。但阶段 5（第 1642-1648 行）修改 `reverse-model.js`（标签协议）和 `label-whitelist.js`（标签校验），阶段 6（第 1792-1803 行）修改 `asset-detector.js`（资源读取）和 `author-html-tree.js`（写出 writer），这些阶段的检查清单都只跑 `npm test` 和 Node 单测，没有任何一步包含 `npm run e2e:indesign`。真实 E2E 只在阶段 12 才跑。虽然当前代码行为上 `data-id-pdf-page` 已正确（无需大量改动），但计划自身的承诺和检查清单不一致，执行 Agent 会感到困惑。建议：或删除风险 7 的"必须跑真实 E2E"表述，或在阶段 5/6 中增加"可选 E2E 冒烟"步骤并注明可跳过条件。

- **【建议-2】阶段 8.7 `src/semantic-model/index.js` 未导出 `layout.js`。**
  计划第 8.3 步（第 2148 行）把 `src/paged-html/layout.js` 移到 `src/semantic-model/layout.js`，但步骤 8.7（第 2253-2261 行）新 `semantic-model/index.js` 只导出 `validateSemanticModel`，不导出 `layout.js` 的任何函数。实际代码中 `to-instructions.js` 和 `from-snapshot.js` 大量导入 layout 函数（`resolveLayout`, `pageDimensions`, `itemBounds`, `cssLengthToTarget`, `cssLengthToMm` 等——见 `src/semantic-model/from-snapshot.js:2-8`, `src/semantic-model/to-instructions.js:7-12`）。它们搬迁后只能直接 require `../../semantic-model/layout.js`（绕过 index）。这不阻塞执行但在设计上不干净；如果计划意图是保持 `layout.js` 为内部实现细节则应注明，否则应在 8.7 中补充导出清单。

- **【建议-3】阶段 6.5 退役字段 grep 测试可能空扫通过但设计可接受。**
  第 1928-1946 行退役字段扫描测试同时扫描旧路径（`src/paged-html`、`src/indesign-reverse`）和新路径（`src/adapters/`、`src/writers/`）。`fs.existsSync` 跳过不存在的目录，所以阶段 6（文件尚未移动）只扫旧路径，阶段 8 后（旧目录已删除）只扫新路径。但如果执行 Agent 错误地在阶段 8 后才跑阶段 6 的测试，两个目录都不存在就会空扫通过——虽然第 1939 行 `assert.notEqual(files.length, 0)` 做了防护，但该断言对空目录集合无效。建议：为阶段 6 增加"必须至少命中 N 个文件"的具体下界，并使阶段 8 后该测试自动更新为新路径集。

- **【建议-4】计划未覆盖 `src/` 根层旧模块的导入分析。**
  当前 `src/` 目录有 `builder.js`、`validator.js`、`generator.js`、`spec-generator.js` 四个根层旧模块（见仓库实际文件列表）。它们是否引用 `src/paged-html/` 或 `src/indesign-reverse/` 路径尚未在该计划中被分析。阶段 8.9 的 `rg` 门禁（第 2320、3335 行）会在范围 `src test scripts index.js` 内捕获旧路径引用，但计划 4.3"改造模块"清单和 4.4"删除模块"清单中未提及这些文件。若它们有旧路径引用，执行 Agent 会在门禁阶段被迫处理但计划未预留步骤。建议：在执行前对这四个文件做一次 `rg` 预检，确认是否需要纳入 4.3 清单。

- **【建议-5】`capability.js` 中 `normalizeCapabilities` 对缺失声明的静默设为 `unsupported`。**
  第 739-750 行：字段条目缺少 capabilities 对象或其格式/方向声明时，`normalizeCapabilities` 自动填充为 `unsupported`，不会发出任何 warning。这意味着注册表构建时不会报错，但后续 `assertWritable` 会抛出运行时错误，且报错链路回溯不到注册表源头。建议在 `createFieldRegistry` 或 `validateFieldEntry` 中对 capabilities 全部缺失或只有默认值的字段增加 warning 级别报告，让注册阶段就能发现。

## 证据

**必改-1 证据：**

- 阶段 8 步骤 8.8（计划第 2265-2271 行）：根 `index.js` 中 `pptx: require('./src/adapters/pptx/contracts')`
- 阶段 10 步骤 10.3（计划第 2529-2572 行）：才创建 `src/adapters/pptx/contracts.js`
- 阶段 8 步骤 8.10 要求 `npm test` PASS，但阶段 8 步骤 8.1 `baseline-imports.test.js` 通过 `require('../../index')` 加载根入口
- 执行顺序为 0→1→2→…→12，阶段 10 在阶段 8 **之后**
- 规格（architecture-design.md 第 40 行）允许本轮不实现完整 PPTX，但不要求 PPTX contracts 在前置阶段就存在

**建议-1 证据：**

- 风险 7 控制措施（计划第 3064-3067 行）："触及 instruction writer、标签、资源、executor 字段后必须跑真实 E2E"
- 阶段 5 文件清单（第 1642-1648 行）：修改 `src/indesign-reverse/reverse-model.js`、`src/indesign-reverse/label-whitelist.js`，涉及标签协议字段
- 阶段 6 文件清单（第 1792-1803 行）：修改 `asset-detector.js`（资源读取）、`author-html-tree.js`（写出）
- 阶段 5 检查清单（第 1655-1785 行）：只跑 `node --test`、`npm test`，无 E2E
- 阶段 6 检查清单（第 1806-1964 行）：只跑 `node --test`，无 E2E
- 阶段 12（第 2759-2858 行）：为首次包含 `npm run e2e:indesign`
- 实际代码已确认 `data-id-pdf-page` 用法正确（`src/paged-html/asset-detector.js:92` 读 `data-id-pdf-page`，`src/indesign-reverse/author-html-tree.js:507-509` 清理 `data-id-page` 但不兜底），行为改动风险可控但文本承诺未兑现

**建议-2 证据：**

- 步骤 8.3（第 2148 行）：`git mv src\paged-html\layout.js src\semantic-model\layout.js`
- 步骤 8.7（第 2253-2261 行）：新 `semantic-model/index.js` 只导出 `validateSemanticModel`
- 实际代码 `src/semantic-model/from-snapshot.js:2-8` 和 `src/semantic-model/to-instructions.js:7-12` 大量导入 layout 函数
- layout.js 搬迁后这些文件也搬迁到不同目录，无法通过 semantic-model/index.js 聚合取用

**建议-3 证据：**

- 步骤 6.5（第 1928-1946 行）：`collectRuntimeFiles` 同时包含旧路径和新路径
- 第 1939 行：`assert.notEqual(files.length, 0)` —— 但不检查何种文件被命中
- 计划第 1949 行注释："这个测试必须扫描阶段 6 的旧路径和阶段 8 后的新路径" —— 承认双模式但未给出阶段间自动切换机制

**建议-4 证据：**

- 仓库实际文件：`src/builder.js`、`src/validator.js`、`src/generator.js`、`src/spec-generator.js`
- 计划 4.3"改造模块"清单（第 428-440 行）未包含上述四个文件
- 计划 4.4"删除模块"清单（第 444-462 行）未包含上述四个文件
- 阶段 8.9 的 rg 门禁语法（第 2320 行）覆盖 `src test scripts index.js`，可捕获但未规划处理步骤

**建议-5 证据：**

- `normalizeCapabilities`（第 738-750 行）：`out[format][direction] = input[direction] || 'unsupported'`
- `validateFieldEntry`（第 801-826 行）：检查 capability 级别合法性，但 capabilities 整体缺失时 for 循环不迭代（无报错）
- `createFieldRegistry`（第 924-956 行）：先 validate 再 normalize，但 validation 对缺少 capabilities 沉默
- 规格（architecture-design.md 第 354-355 行）：能力等级 `unsupported` 定义为"不支持，必须报告，不能静默丢弃"——默认值本身是 `unsupported` 违反了这一语义

**其他辅助证据：**

- 计划 4.2 移动清单与仓库实际文件一一可对照，未发现遗漏（通过 `glob src/paged-html/*.js`、`glob src/indesign-reverse/*.js` 与计划逐项比对确认）
- 计划阶段顺序整体合理（先冻结事实→建 registry→登记字段→能力矩阵→扫描→接入语义→退役清理→强校验→目录重构→拆分→PPTX→文档→E2E），符合"先登记事实后强门禁"原则
- 命令语法已改用 PowerShell，`New-Item -Force`、`git mv`、`rg -n`、`Test-Path`、条件判断均可执行
- `rg --version` 前置检查在计划第 20 行明确要求
- `data-id-page` 仅在 `author-html-tree.js:507` 作为清理操作出现（`delete attrs['data-id-page']`），不构成读取兜底
- `assert.doesNotMatch` 在当前 Node 环境可用（实测通过）
- 计划 3.2"不允许的重构方式"明确禁止 legacy facade、双入口、双命名、先搬后修等，符合 AGENTS.md 退役代码清理规则
- 计划第 41 行 ("长期规范与生成文档的关系必须等注册表覆盖现有字段后再切换") 和阶段 11 顺序（先覆盖字段事实再删除静态表）合理
- 计划未发现退化为 legacy 双路径、过度宽松 warning、静默吞错的设计
