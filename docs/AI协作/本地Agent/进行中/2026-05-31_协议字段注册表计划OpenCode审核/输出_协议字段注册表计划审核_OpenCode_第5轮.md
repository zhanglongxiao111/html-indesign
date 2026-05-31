# 审核结论

结论：**通过**

## 必改问题

- 无

## 建议问题

- 无

## 证据

### 第 4 轮 3 个建议修复确认

**建议 1 修复：文档生成使用 `--out` 标志，由 Node 直接写 UTF-8**

原计划使用 `node script.js > file.md`（第 4 轮建议 1 指出 PowerShell `>` 重定向默认 UTF-16LE 编码风险）。当前计划已将所有文档生成为：

```bash
node src/protocol/docs/generate-field-docs.js --out docs/规范/PROTOCOL_FIELD_REGISTRY.md
```

三处调用均已更新（第 2704、2746、3238 行）。`grep ' > .*\.(md|json|js)'` 在计划全文中零命中——无残留 PowerShell 重定向写文件命令。

**建议 2 修复：阶段 4 交叉引用修正为"阶段 7"**

第 1619 行：`强校验按阶段 7 逐域打开。`

原为"阶段 6"（第 4 轮建议 2 指出阶段 6 是退役清理而非域强校验）。现正确指向计划中实际执行域强校验的阶段 7（第 1967 行起"阶段 7：按域接入强校验"）。匹配。

**建议 3 修复：退役字段扫描目录加入 `src/shared`**

第 1928-1937 行的 `collectRuntimeFiles` 扫描根路径列表现包含 `'src/shared'`：

```js
const files = collectRuntimeFiles([
  'src/paged-html',
  'src/indesign-reverse',
  'src/adapters/html',
  'src/adapters/indesign',
  'src/writers/html',
  'src/writers/indesign',
  'src/semantic-model',
  'src/shared'           // ← 新增
]);
```

与 section 4.2 移动表中 `style-utils.js` 的目标路径 `src/shared/style-utils.js`（第 351-352 行）一致，补全了扫描盲区。匹配。

### 全量重审汇总

以下为从零开始的完整审核结论，未受前几轮输出约束：

**规格覆盖**（对照 `2026-05-31-protocol-field-registry-architecture-design.md`）：

| 规格要求 | 计划覆盖 | 行号 |
|---|---|---|
| 字段注册表结构（canonicalPath/currentPaths/fieldClass/lifecycle/capabilities） | 阶段 1-2 | 617-1289 |
| 能力矩阵 6 等级 | 阶段 3 | 1292-1466 |
| 字段分类（canonical/sourceMetadata/formatExtension/observation） | 阶段 2 fields/ | 1011-1289 |
| 生命周期门禁（active/candidate/deprecated/retired） | 阶段 3 | 1292-1466 |
| 观察字段隔离 | 阶段 2 observation.js | 1209-1230 |
| 退役字段策略（readPolicy/writePolicy/forbidden） | 阶段 6 | 1788-1963 |
| PPTX contract/capability/customData | 阶段 10 | 2470-2590 |
| 文档生成（registry → markdown） | 阶段 11 | 2594-2748 |
| Reader/Normalizer/Writer/Executor 分层 | section 3 + 阶段 8 | 131-275 |

**AGENTS.md 硬规则合规**：

- "协议字段必须集中登记" → `src/protocol/` 唯一事实源 ✓
- "格式能力必须显式声明" → `capabilityFor`/`assertWritable` ✓
- "退役代码必须当场清除" → 阶段 6 清理 + 阶段 8 删目录 ✓
- "兜底默认有害" → `unsupported` 显式默认，避免静默成功 ✓
- "失败要早于假成功" → 各阶段 STOP 条件，strict 模式 ✓
- "语义库是白名单" → label whitelist 接入 registry ✓
- "可验证才算完成" → TDD RED→GREEN 每阶段 ✓

**阶段顺序**（无先删除后迁移、先强门禁后登记的逆序错误）：

```
0.freeze → 1-2.registry → 3.capability → 4.warning → 5.semantic
→ 6.retired → 7.strong → 8.refactor → 9.split → 10.pptx → 11.docs → 12.E2E
```

退役清理（6）在目录重构（8）之前执行，清理后的代码随 `git mv` 携带到新位置。域强校验（7）在退役清理（6）之后，避免退役字段干扰校验。文档生成（11）在所有字段登记完成后执行。

**文件移动覆盖**（section 4.2 vs step 8.3-8.5，逐目录核对）：

- `src/paged-html/` 12 .js 文件（除 index facade）均有目标位置，与 step 8.3 的 10 条 git mv 完全一致
- `src/indesign-reverse/` 20 .js 文件（除 index facade）均有目标位置，与 step 8.4-8.5 的 20 条 git mv 完全一致
- `src/semantic-model/from-snapshot.js` → adapters/html，`to-instructions.js` → writers/indesign（已确认当前仓库存在）
- `src/paged-html/layout.js` → `src/semantic-model/layout.js`（目标目录存在，新文件）
- `src/paged-html/style-utils.js` → `src/shared/style-utils.js`（目标目录存在，新文件）

**Scripts 依赖迁移**（步骤 8.9，经仓库验证）：

5 个 scripts 的旧路径 → 新路径映射与目标 index 导出函数集合一致。`indesign-e2e.js` 实际导入的 `renderSnapshot`/`compileInstructions`/`validateInstructions` 均在新 `adapters/html/index.js` 和 `writers/indesign/index.js` 中，`auditReverseAuthorPackage`/`auditAuthorSourceRoundtrip` 在新 `writers/html/audit/` 中。

**Windows/PowerShell 兼容性**：

- 全部 git mv 用反斜杠路径，New-Item 为合法 PowerShell
- `rg` 已在执行原则显式声明依赖 + `rg --version` 预检（第 20 行）
- 文档生成改为 `--out` 标志（Node `fs.writeFileSync`），不再依赖 PowerShell `>` 重定向
- 零 Unix 专属命令作为最终门禁

**无文本矛盾**：

- "临时 facade"（3.3 节允许）vs "长期 facade"（3.2 节禁止）→ 边界清晰，阶段 8 完成前必须删除
- "生成文档作为事实源" vs "保留静态表" → 第 41 行明确"不得在 registry 还不完整时删除现有静态事实说明"，阶段 11 只替换字段清单部分
- 目标 API（步骤 8.1，8 断言）与各 index 实际导出 → 逐一匹配
- section 4.2 vs step 8.x → 逐文件匹配
