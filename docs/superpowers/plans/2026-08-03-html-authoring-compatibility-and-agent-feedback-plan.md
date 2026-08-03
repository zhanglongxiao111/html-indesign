# 通用 HTML 编写兼容与 Agent 反馈实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让常见、含义唯一的 HTML/CSS 写法直接进入转换链路，并让 lint、compile、build 和统一 Skill 对自动归一化及阻断问题提供一致、可操作的反馈。

**Architecture:** 在 HTML adapter 下新增单一兼容审计模块，复用浏览器快照已经确认的资源、角色、frame 和 CSS 事实；安全归一化继续发生在 reader/shared asset 边界，审计模块只生成可见 provenance。CLI 三个正向工具复用同一兼容报告，不在 writer 或 executor 增加 HTML 特例。

**Tech Stack:** Node.js 20、`node:test`、Playwright 浏览器快照、JavaScript CLI 插件、Markdown 统一 Skill。

## Global Constraints

- 不修改作者源 HTML，不支持任意网页完整还原。
- 只自动处理含义唯一、可逆、可测试的事实；有歧义时必须阻断。
- 新逻辑只能引用 `src/protocol/` 已登记字段，不创建第二字段 allowlist 或能力矩阵。
- 兼容反馈必须含稳定 code、页面/对象、处理说明、`suggestedFix` 和 `ruleRef`。
- HTML adapter 负责兼容；InDesign writer、executor 不读取 HTML 特有兼容分支。
- 统一 Skill 唯一发布源仍为 `D:/AI/mcp-indesign/skills/indesign-cli/`。

---

### Task 1: 接住标准 object fallback 与单资源 wrapper

**Files:**
- Modify: `src/adapters/html/reader/browser-element-capture.js`
- Modify: `test/html-to-indesign/browser-snapshot.test.js`

**Interfaces:**
- Consumes: 浏览器 DOM、现有 `dataIdAttributes()` 和 candidate 列表。
- Produces: 快照中的单一 graphic item；`sourceNode.previewNode` 保存 object fallback，`sourceAncestorNodes` 保存 wrapper。

- [x] **Step 1: 写失败测试**

新增两个浏览器测试：标准 `<object data="drawing.pdf"><img src="preview.png"></object>` 只产生 object graphic，fallback 进入 `previewNode`；带 `data-id-role="graphic"`、frame style 和唯一 `img/object` 子元素的普通 wrapper 只产生一个 graphic，并继承 wrapper 的图框字段。

- [x] **Step 2: 运行测试确认 RED**

Run: `node --test test/html-to-indesign/browser-snapshot.test.js`

Expected: fallback `img` 仍是第二个 candidate，或带协议字段 wrapper 未被识别成唯一 visual frame。

- [x] **Step 3: 最小实现**

在浏览器 reader 中增加并复用以下判断：

```js
function isObjectFallbackPreview(el) {
  const parent = el && el.parentElement;
  if (!parent || String(el.tagName).toLowerCase() !== 'img') return false;
  if (!['object', 'embed'].includes(String(parent.tagName).toLowerCase())) return false;
  const images = Array.from(parent.children).filter((child) => String(child.tagName).toLowerCase() === 'img');
  return images.length === 1 && images[0] === el;
}
```

将该 fallback 从 candidates 排除，并允许 `sourcePreviewNodeFor` 读取 object 内唯一 fallback。把 `isNaturalSingleAssetFrame` 扩展为：wrapper 没有独立资源来源、无直接文字且只有一个资源子元素时，即使带已登记的 frame/role/fit 字段也可作为 visual frame；`data-id-asset-path` 等独立资源来源仍不得和子资源合并。

- [x] **Step 4: 运行测试确认 GREEN**

Run: `node --test test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/asset-detector.test.js`

Expected: PASS，现有 ignored wrapper 和 sibling preview 用例不回退。

- [x] **Step 5: 提交**

```powershell
git add src/adapters/html/reader/browser-element-capture.js test/html-to-indesign/browser-snapshot.test.js
git commit -m "feat: accept natural HTML asset frames"
```

### Task 2: 统一资源类型和兼容审计

**Files:**
- Create: `src/adapters/html/compatibility/audit.js`
- Modify: `src/adapters/html/index.js`
- Modify: `src/shared/assets.js`
- Modify: `src/adapters/html/validators/authoring-validator.js`
- Test: `test/html-to-indesign/html-compatibility-audit.test.js`
- Test: `test/shared/assets.test.js`
- Modify: `test/html-to-indesign/authoring-validator.test.js`

**Interfaces:**
- Produces: `auditHtmlCompatibility(snapshot) -> { summary, messages }`。
- Message contract: `{ level, code, action, pageId, itemId, message, suggestedFix, ruleRef }`。

- [x] **Step 1: 写资源类型 RED 测试**

```js
assert.equal(inferAssetKind('site-plan.ai', 'pdf'), 'ai');
assert.equal(inferAssetKind('drawing.pdf', 'ai'), 'pdf');
assert.equal(inferAssetKind('preview.png', 'fallback'), 'fallback');
```

扩展名确定实际格式时覆盖冲突的格式声明；`fallback`、`vector` 等行为声明继续优先。

- [x] **Step 2: 写兼容报告 RED 测试**

构造 snapshot，覆盖：AI 缺少 kind、AI 错标 pdf、CSS `object-fit: contain` 缺少 fit、neutral `div` 被安全识别为 text、带协议字段的唯一资源 wrapper。断言稳定 code：

- `HTML_ASSET_KIND_INFERRED`
- `HTML_ASSET_KIND_CANONICALIZED`
- `HTML_FIT_INFERRED_FROM_CSS`
- `HTML_ROLE_INFERRED`
- `HTML_SINGLE_ASSET_WRAPPER_NORMALIZED`

每条消息必须包含 `suggestedFix` 和 `ruleRef`；summary 统计 `normalized`、`warnings`、`blocked`。

- [x] **Step 3: 写严格 lint RED 测试**

把原有“anonymous leaf text 在 strict 下失败”改为：安全 role 推断仍返回 warning/compatibility message，但不升级成 error；`GRID_ALIGNMENT_OFF` 等真实风险仍在 strict 下失败。

- [x] **Step 4: 运行测试确认 RED**

Run: `node --test test/shared/assets.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-validator.test.js`

Expected: 新模块不存在、kind 冲突仍采用错误显式类型、strict 仍提升所有 warning。

- [x] **Step 5: 最小实现**

在 `src/shared/assets.js` 提取 `inferAssetKindFromExtension(src)`，实现优先级：`fallback/vector` 行为声明 > 已知扩展名 > 其他显式类型 > unknown。

`auditHtmlCompatibility` 只读取 snapshot 和 `src/protocol` 常量。安全推断产生 `level: "warning"`、`action: "normalized"`；阻断项继续由现有 validator 产生，不重复错误。

在 authoring validator 的 warning 上增加 `strictBlocking`。严格模式只提升 `strictBlocking !== false` 的 warning；`SEMANTIC_TOKEN_MISSING` 对已经有稳定 id 且 role 可由自然 HTML 唯一判断的对象标记为非阻断，并给出显式写法建议。

- [x] **Step 6: 运行测试确认 GREEN**

Run: `node --test test/shared/assets.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-validator.test.js`

Expected: PASS。

- [x] **Step 7: 提交**

```powershell
git add src/shared/assets.js src/adapters/html/compatibility/audit.js src/adapters/html/index.js src/adapters/html/validators/authoring-validator.js test/shared/assets.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-validator.test.js
git commit -m "feat: report safe HTML normalizations"
```

### Task 3: 让 lint、compile、build 返回同一反馈

**Files:**
- Modify: `src/authoring/lint.js`
- Modify: `src/indesign-cli-plugin/tools/authoring-lint.js`
- Modify: `src/indesign-cli-plugin/tools/compile-instructions.js`
- Modify: `src/indesign-cli-plugin/tools/build-indesign.js`
- Modify: `test/indesign-cli-plugin/plugin-tools.test.js`
- Modify: `test/html-to-indesign/authoring-lint-cli.test.js`

**Interfaces:**
- Consumes: `auditHtmlCompatibility(snapshot)`。
- Produces: lint payload、compile summary/data、build success/error details 中同一 `compatibility` 对象。

- [x] **Step 1: 写 CLI contract RED 测试**

断言：lint success 和 error details 都保留 compatibility；compile summary 和 call data 返回 compatibility；build 在 lint 后把相同报告传入 compile，并在最终 success `data.compatibility` 返回；错误时完整报告仍在 `error.details`。

- [x] **Step 2: 运行测试确认 RED**

Run: `node --test test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js`

Expected: CLI payload 不含 compatibility。

- [x] **Step 3: 最小实现**

`lintAuthoringHtml` 在拿到 snapshot 后调用一次 `auditHtmlCompatibility`，把其 messages 合入 warnings，并保留汇总对象。`compileAuthoringPackage` 复用传入的 compatibility，未传时对 snapshot 调用同一函数。`compileSummary`、compile call data 和 build state/result 只透传，不重新判断。

metrics 增加 `compatibility_normalized` 和 `compatibility_blocked` 数值；现有 error/warning 数量语义保持不变。

- [x] **Step 4: 运行测试确认 GREEN**

Run: `node --test test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js`

Expected: PASS，三个工具 code、位置、建议完全一致。

- [x] **Step 5: 提交**

```powershell
git add src/authoring/lint.js src/indesign-cli-plugin/tools/authoring-lint.js src/indesign-cli-plugin/tools/compile-instructions.js src/indesign-cli-plugin/tools/build-indesign.js test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js
git commit -m "feat: expose HTML compatibility feedback in CLI"
```

### Task 4: 同步规范与统一 Skill

**Files:**
- Modify: `docs/规范/AGENT_HTML_AUTHORING_GUIDE.md`
- Modify: `D:/AI/html-indesign/.worktrees/mcp-indesign-issue-12-authoring-rule/skills/indesign-cli/references/html-authoring.md`

**Interfaces:**
- Consumes: Task 2 稳定 rule codes 和 Task 3 CLI 输出。
- Produces: Agent 创作前规则和看到 CLI 反馈后的处理顺序。

- [x] **Step 1: 做更新前 Skill 行为基线**

用不泄漏答案的任务要求 Agent 编写包含 figure/img、object fallback、CSS Grid/Flex 和文本 div 的两页作者包，并处理一项有歧义的资源 wrapper。记录是否会写自然 HTML、先 lint、读取反馈并修正阻断项。

- [x] **Step 2: 更新项目规范**

新增“先写自然 HTML”与三档处理说明，列出原生标签、资源、Grid/Flex、自动归一化、必须阻断及 CLI feedback 字段。明确零源码漂移声明前应把 suggestedFix 写回作者包。

- [x] **Step 3: 更新统一 Skill**

在唯一发布源增加相同工作方法和最小示例；要求 Agent：组装后先 lint、读取全部 compatibility messages、只修 blocked 和需要长期稳定的建议，再 build；不得对未修改输入反复重试。

- [x] **Step 4: 验证 Skill**

运行 Skill quick validator；若它只被既有 frontmatter `tags` 阻断，记录该既有问题且不扩大本轮范围。再用新鲜 Agent 做相同前向任务，确认行为相对基线改善。

- [x] **Step 5: 分仓提交**

```powershell
git add docs/规范/AGENT_HTML_AUTHORING_GUIDE.md
git commit -m "docs: explain general HTML compatibility feedback"
```

统一 Skill worktree：

```powershell
git add skills/indesign-cli/references/html-authoring.md
git commit -m "docs: teach natural HTML compatibility workflow"
```

### Task 5: 完整验证和收口

**Files:**
- Verify: `test/`
- Verify: package/plugin artifacts
- Modify: this plan checklist

- [x] **Step 1: 运行针对性测试**

Run: `node --test test/shared/assets.test.js test/html-to-indesign/browser-snapshot.test.js test/html-to-indesign/html-compatibility-audit.test.js test/html-to-indesign/authoring-validator.test.js test/html-to-indesign/authoring-lint-cli.test.js test/indesign-cli-plugin/plugin-tools.test.js`

Expected: PASS。

- [x] **Step 2: 运行全量验证**

Run: `npm test`

Expected: 0 failures。

Run: `npm run pack:dry-run`

Expected: package dry-run success，未包含 workspace/customer artifacts。

Run: `indesign-cli-agent --json --pretty plugin validate .`

Expected: `ok: true`，无 plugin errors/warnings。

- [x] **Step 3: 运行真实 InDesign E2E**

用仓库安全的自然 HTML fixture 或标准 architecture fixture 运行 `npm run e2e:indesign`，确认 INDD/PDF/IDML、forward fidelity 和 PDF preview 全部成功。若自然 fixture 缺少可置入二进制资源，使用现有安全 fixture，并明确单元/浏览器测试覆盖的自然 HTML 边界。

- [x] **Step 4: 审查并提交计划完成状态**

运行 `git diff --check`、`git status --short --branch`、敏感路径/密钥扫描，勾选本计划完成项并提交。不得推送、合并或发布 Skill，除非用户另行授权。

## Verification Record

- Targeted tests: 91/91 passed.
- Full suite: 1167/1167 passed.
- Package dry-run: passed; 228 files, no workspace or customer artifacts.
- Plugin validation: passed; 4 tools, 0 errors, 0 warnings.
- Real InDesign E2E: passed; 7 pages, 115 items, 9 assets, 0 overset text frames, INDD/PDF/IDML and 7-page preview generated.
- Unified Skill forward test: improved from over-annotating natural HTML and skipping lint to preserving normal HTML, requiring lint, reading compatibility feedback, and blocking ambiguous multi-resource wrappers.
- Unified Skill quick validator: content loading reached the existing frontmatter check and was blocked only by the pre-existing top-level `tags` key; this unrelated metadata migration remains outside Issue #12.
- Secret scan: no matching credentials in either branch's changed files.
