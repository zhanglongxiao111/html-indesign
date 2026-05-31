# 审核结论

结论：通过

## 必改问题

- 无

## 建议问题

- **3.1 目标目录结构与实施计划不完全一致**：`docs/superpowers/plans/2026-05-31-protocol-field-registry-implementation-plan.md` 第 157-241 行目标架构列出了 `src/semantic-model/schema.js` 和 `src/semantic-model/model-paths.js`，但第 4.1 节新增模块清单和任何阶段步骤中均未安排创建这两个文件。若为下一轮扩展预留，应标注为"未来"；若本轮需要，必须安排创建步骤。
- **阶段 6.5 退役扫描测试的路径生命周期**：`test/protocol/validate-retired-fields.test.js` 中 `collectRuntimeFiles` 同时扫描旧路径（`src/paged-html`、`src/indesign-reverse`）和新路径（`src/adapters/html` 等）。阶段 6 时仅旧路径存在，阶段 8 后仅新路径存在，阶段间该测试会暂时失败。计划已用注释提到这一点（`test/protocol/validate-retired-fields.test.js` 第 1971 行"这个测试必须扫描阶段 6 的旧路径和阶段 8 后的新路径，不能因为旧目录已删除而空扫通过"），但未给出阶段间过渡的具体处理方式（如临时放宽断言、或要求执行者在阶段 8 更新测试）。建议补一句"阶段 8 迁移完成后必须同步更新本测试的文件路径列表"。
- **`test/indesign-e2e-runner.test.js` 的迁移指令不够显式**：该文件第 23 行 `require('../src/paged-html')` 和第 198 行 `require('../src/indesign-reverse')` 都需要在阶段 8 更新。计划第 8.9 节以通配形式提到了 `test/**/*.test.js`，但与其他被显式列出路径的脚本文件相比，这个 328 行的核心 E2E 测试文件应获得显式迁移提示，降低遗漏风险。
- **根层历史模块处置结论未写清**：计划第 8.9 节（第 2342-2344 行）要求对 `src/builder.js`、`src/validator.js`、`src/generator.js`、`src/spec-generator.js` 执行 rg 扫描，但未在输出中明确声明"已确认这 4 个文件无 paged-html / indesign-reverse 依赖，保留为历史 blueprint 工具"。当前实测确认它们不依赖旧目录，但计划本身没有写入这一确认结论。

## 证据

### 规格覆盖完整性

- 架构规格 `docs/superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md` 定义的核心条目——字段注册表（第 4 节）、字段分类 canonical/sourceMetadata/formatExtension/observation/retired（第 5 节）、能力矩阵 native/lossless/approximate/fallback/observe-only/unsupported（第 6 节）、生命周期门禁（第 8 节）、迁移计划阶段 0-6（第 9 节）——在实施计划中均有对应阶段或步骤覆盖。
- 实施计划的 12 个阶段对 spec 全部 6 个迁移阶段形成了真子集覆盖：阶段 0 对应 spec 阶段 0，阶段 1-2 对应 spec 阶段 1，阶段 3-4 对应 spec 阶段 2，阶段 5-7 对应 spec 阶段 3，阶段 6 对应 spec 阶段 4，阶段 9-11 对应 spec 阶段 5，阶段 10 对应 spec 阶段 6。无遗漏。

### 阶段顺序合理性

- **阶段 0 冻结事实源** → **阶段 1-4 注册表核心 API 与扫描器** → **阶段 5-7 接入门禁与强校验** → **阶段 8 目录重构** → **阶段 9 大文件拆分** → **阶段 10 PPTX 契约** → **阶段 11 文档生成** → **阶段 12 E2E 验证**：先建立不可变事实基线，再构建注册表核心并登记字段，再接入现有链路但仅警告，再逐域升级为强校验，最后才移动文件。文件移动在所有字段行为被登记和约束之后执行，避免了"搬完才发现行为变化"的故障模式。顺序合理。

### 第 4.2 节移动清单覆盖验证

- `src/paged-html/` 共 13 个条目（12 模块 + 1 facade index.js）：所有 12 个模块在第 4.2 节 (`docs/superpowers/plans/2026-05-31-protocol-field-registry-implementation-plan.md` 第 323-353 行) 均有明确去向。`index.js` 在第 4.4 节作为 facade 删除。
- `src/indesign-reverse/` 共 21 个条目（20 模块 + 1 facade index.js）：所有 20 个模块在第 4.2 节（第 354-425 行）均有明确去向。`index.js` 在第 4.4 节作为 facade 删除。
- 实测 `src/paged-html` 目录内容（`asset-detector.js`, `authoring-validator.js`, `browser-snapshot.js`, `index.js`, `instructions-compiler.js`, `instructions-validator.js`, `layout.js`, `page-detector.js`, `source-metadata.js`, `stacking.js`, `style-compiler.js`, `style-reader.js`, `style-utils.js`）与移动清单一一对应。
- 实测 `src/indesign-reverse` 目录内容（`asset-reference-policy.js`, `author-asset-packager.js`, `author-attribute-writer.js`, `author-audit.js`, `author-css-writer.js`, `author-html-tree.js`, `author-package-writer.js`, `author-source-css.js`, `author-style-attrs.js`, `blueprint-migration.js`, `css-blend-mode.js`, `html-writer.js`, `index.js`, `label-whitelist.js`, `reveal-presentation-writer.js`, `reverse-model.js`, `semantic-candidates.js`, `snapshot-reader.js`, `source-roundtrip-diff.js`, `vector-svg.js`, `visual-geometry-audit.js`）与移动清单一一对应。

### 阶段 8 与阶段 10 公共入口无 MODULE_NOT_FOUND

- **阶段 8.8 根 `index.js`**（第 2287-2307 行）：只导出 `protocol`、`adapters.html`、`adapters.indesign`、`semanticModel`、`writers.html`、`writers.indesign`、`historicalTemplate`。**不含 PPTX**。
- **阶段 10.4**（第 2608-2618 行）：在 `src/adapters/pptx/contracts.js` 创建完成后，才将 `pptx` 加入 `adapters` 对象。
- `npm test` 通配 `test/**/*.test.js`（`package.json` 第 14 行）会在阶段 8 执行，此时 `test/protocol/pptx-contracts.test.js` 如果已存在（阶段 10 才创建），会因 PPTX contract 尚未存在而失败。计划中的测试文件创建顺序（阶段 10 创建 `test/protocol/pptx-contracts.test.js`）与阶段 10 实现同步，不会出现阶段间 MODULE_NOT_FOUND。

### Windows / PowerShell 命令兼容性

- `npm test`、`node --test`（`package.json` 第 14 行）：Node.js 原生测试运行器，Windows 兼容。
- `New-Item -ItemType Directory -Force`（如第 2161 行）：PowerShell 5.1 原生 cmdlet，Windows 兼容。
- `git mv`（如第 2162 行）：Windows git 内置命令，前提是 git 在 PATH 中。
- `rg -n`（如第 2347 行）：ripgrep 需要在 Windows 中安装。计划阶段 0 前要求确认 `rg --version`（第 20 行），已将此声明为显式依赖。
- `Test-Path`、`if ($LASTEXITCODE ...)` 门禁（第 3378-3383 行）：PowerShell 5.1 兼容语法。
- 阶段 11.3 明确要求文档生成器使用 `fs.writeFileSync(..., 'utf8')` 写出 UTF-8 文件（第 2713 行），避免 PowerShell `>` 重定向在不同版本下产生编码差异。符合 AGENTS.md 要求。

### 退役字段清理验证

- 当前 `src/paged-html/asset-detector.js` 第 92 行：`pageNumber: positiveIntegerOrUndefined(attributes['data-id-pdf-page'])`——只从 `data-id-pdf-page` 读取 PDF 页码，不读取 `data-id-page`。
- `rg "data-id-page.*pageNumber|pageNumber.*data-id-page" src/` 命中 0 行——源文件无退役字段兜底。
- 测试文件中的 `data-id-page` 引用（`test/semantic-model/to-instructions.test.js` 第 177-207 行、`test/paged-html/asset-detector.test.js` 第 61-71 行）均为**退役验证测试**（明确断言 `data-id-page` 不作为有效 PDF 页码字段使用），而非功能兜底。
- `src/indesign-reverse/author-html-tree.js` 第 507 行显式删除 `data-id-page` 属性——写路径主动禁止退役字段。

### 当前实际依赖关系确认

- `src/semantic-model/from-snapshot.js` 第 1、8、14 行依赖 `../paged-html/style-compiler.js`、`../paged-html/layout.js`、`../paged-html/source-metadata.js`。阶段 8 将这些模块移动后，`from-snapshot.js` 自身也会被移动到 `src/adapters/html/normalizer/snapshot-to-model.js`，相对路径需要更新。计划第 8.3 节对此有明确要求。
- `src/semantic-model/to-instructions.js` 第 3、4、12 行依赖 `../paged-html/asset-detector.js`、`../paged-html/style-utils.js`、`../paged-html/layout.js`。同理，阶段 8 移动后相对路径需更新。
- `scripts/indesign-e2e.js` 第 10 行导入 `../src/paged-html`，第 343-344 行导入 `../src/indesign-reverse/author-audit` 和 `../src/indesign-reverse/source-roundtrip-diff`，第 632 行导入 `../src/indesign-reverse/source-roundtrip-diff`。计划第 8.9 节全部列出。
- 全仓库共 32 处 `test/` 下旧路径 import，计划第 8.9 节以通配形式纳入迁移范围。

### 无空扫通过、静默兜底、legacy 双路径问题

- 阶段 6.5 退役扫描测试明确要求 `assert.notEqual(files.length, 0, 'retired field scan must cover active runtime files')`（第 1955 行），防止因空目录导致空扫通过。
- 计划第 3.2 节明确规定"不允许保留 `src/paged-html/` 作为长期 facade"、"不允许保留 `src/indesign-reverse/` 作为长期 facade"、"不允许新增 `legacy` 命名承载当前行为"。
- 阶段 8.11-8.12 要求在 `npm test` 和旧目录不存在测试通过后，才删除旧 facade 目录。删除后无法被任何代码引用，杜绝双路径。

### 能力声明强制

- 阶段 1 的 `validateFieldEntry` 测试（`test/protocol/field-entry.test.js` 第 691-702 行）明确断言 capabilities 完全缺失时 `validateFieldEntry` 返回 `CAPABILITIES_MISSING` 错误。
- `capability.js` 的 `normalizeCapabilities` 函数（第 751-763 行）对未声明的 format/direction 填入默认 `'unsupported'`，但字段级 validation 要求至少一个格式的 capabilities 对象非空，无完全隐式兜底。
