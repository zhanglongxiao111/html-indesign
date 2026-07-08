# adapter 反向归一化退役路径审计报告

## 审计结论

结论：**存在观察/迁移路径但整体合理，未发现退役 `items[].type` 或白名单外标签继续进入 current model / writer decision path 的运行中双路径。**

当前风险等级：**none**

补充判断：

- `items[].type` 已被协议层明确退役，严格校验会直接报错，不再作为 current model 活跃字段。
- `items[].sourceType` 仍是活跃字段，但注册表已将其限定为 `sourceMetadata`/观察事实，且下游关键路径已加护栏，不再从 `sourceType` 或退役 `type` 回推语义角色或 current style refs。
- `observedLabel`、`migration.*` 仍保留，但边界清楚：只用于观察、报告或迁移，不参与结构化编译。

## 审计范围与命令

范围：

- `src/adapters/html/`
- `src/adapters/indesign/`
- `src/semantic-reconstruction/`
- `src/writers/html/author-package-writer.js`
- 相关测试与协议校验

主要命令：

1. `rg -n "label\.type|label\.token|item\.type|sourceType|effectiveLabel|observedLabel|roleFromInDesignType" src/adapters src/semantic-reconstruction src/writers/html test/indesign-to-html test/semantic-reconstruction`
2. `git diff -U8 5d4757a6f7efbe8c8410f816d462a90813567fb7..HEAD -- src/adapters src/semantic-reconstruction src/writers/html/author-package-writer.js`
3. 只读单测验证：

   `node --test "test/indesign-to-html/reverse-model.test.js" "test/indesign-to-html/label-whitelist.test.js" "test/semantic-reconstruction/object-graph.test.js" "test/protocol/validate-model-fields.test.js" "test/protocol/current-field-facts.test.js" "test/semantic-model/synthesized-styles.test.js"`

结果摘要：

- `rg` 未发现 scoped runtime path 中仍读取 `label.type`。
- `label.token` 命中仅剩 layer/style token 归一化，不在 item semantic/current role 决策链。
- 单测 **110/110 通过**，exit code `0`。

## 关键 findings

### Finding 1：退役 `items[].type` 已被注册表与严格校验双重封死

风险等级：**none**

证据：

- `src/protocol/fields/retired.js:3-24` 将 `items[].type` 定义为 `lifecycle: 'retired'`，并声明替代字段为 `items[].sourceType`。
- `src/protocol/fields/reverse-surfaces.js:71-73` 将 `items[].sourceType` 定义为 `sourceMetadata`，描述明确为 “Observed source-format object type, not a semantic role.”
- `test/protocol/current-field-facts.test.js:134-151` 断言 `items[].role` 为 canonical，`items[].sourceType` 为 active sourceMetadata，`items[].type` 为 retired。
- `test/protocol/validate-model-fields.test.js:449-498` 断言严格模式下 `items[].type` 被识别为 retired，而不是 active accepted。

判断：

- 退役字段 `items[].type` 仍保留为“被识别并拒绝”的历史表面，不再是 current model 的合法运行字段。

### Finding 2：reverse adapter 把白名单外标签压入 `observedLabel`，不进入 effective/current 字段

风险等级：**none**

证据：

- `src/adapters/indesign/normalizer/label-whitelist.js:51-76`：标签先经过字段校验，再分别写入 `effective` 与 `observed`。
- `src/adapters/indesign/normalizer/label-whitelist.js:87-100`：unknown/retired/disallowed/invalidValues 全部进入 `observed` 与 `rejectedFields`。
- `src/adapters/indesign/normalizer/label-whitelist.js:149-174`：未知 semantic 进入 `observed.semantic`，`effective.semantic` 被置空。
- `src/adapters/indesign/normalizer/label-whitelist.js:235-247`：sourceNode/sourceRuns/sourceHtml 等 source fields 只有在可信任时进入 `effective`，否则进入 `observed`。
- `src/adapters/indesign/normalizer/snapshot-to-model.js:84-121` 与 `205-263`：page/item 输出只把 `validation.effective` 放进 `semantic`、`sourceNode`、`structure`、`layout` 等 current surfaces，同时把 `observedLabel` 单独挂出。
- `test/indesign-to-html/label-whitelist.test.js:48-55`：未知 semantic `foreign-slot` 仅进入 `observed`。
- `test/indesign-to-html/reverse-model.test.js:1394-1405`：白名单外 copied label 不进入 `item.semantic`、`item.effectiveLabel.semantic`、`item.sourceNode`、`item.structure`，但保留在 `observedLabel`。

判断：

- “旧标签只能观察”的规则在 reverse label path 上已落实。
- 这条线还被 exit validator 兜住：`test/indesign-to-html/reverse-model.test.js:679-718`、`637-677` 证明 adapter 输出带未注册字段时会直接抛 `SEMANTIC_MODEL_VALIDATION_FAILED`，不会假成功。

### Finding 3：semantic reconstruction 与 synthesized styles 已切断从退役 `type`/观察 `sourceType` 回推 current 决策

风险等级：**none**

证据：

- `src/semantic-reconstruction/object-graph/node-facts.js:20-25` 现在只取 `item.role || 'unknown'`，不再回退 `item.type` 或 `item.sourceType`。
- `src/semantic-reconstruction/object-graph/relationships.js:165-188` 后续几何关系只消费 object graph 内已经归一化的 `node.sourceType`。
- `test/semantic-reconstruction/object-graph.test.js:84-109` 明确断言 retired `type` / `sourceType` 不会让 object graph 自动推断 text role。
- `test/semantic-model/synthesized-styles.test.js:158-217` 明确断言 `sourceType` only observation 不会写 current synthesized refs。
- `test/indesign-to-html/reverse-model.test.js:110-180` 明确断言 current role 来自 sanitize 后的有效 label role，非法 role 会在严格校验下失败。

判断：

- 共享下游链路已经不再把退役 `type` 或观察 `sourceType` 当成 current semantic/current style decision input。

### Finding 4：writer 消费面已去掉 `label.type/token` 与 `semantic === 'unknown'` 这类旧决策支点；剩余观察路径只用于报告

风险等级：**none**

证据：

- `src/writers/html/author-package-writer.js:324-331`：母版文字保留判断只看 `item.semantic` 和 `label.semantic/label.role`，不再读取 `label.token`/`label.type`。
- `src/writers/html/author-package-writer.js:391-416`：页面观察态只由 `options.mode === 'observation'` 决定，不再把 `page.semantic === 'unknown'` 当作控制分支。
- `src/writers/html/author-node-attrs.js:82-88`：`observedLabel` 仅被写回 `data-id-observed-label-status` / `data-id-observed-reasons`，属于报告性输出。
- `src/protocol/fields/observation.js:1-17`、`109-127`：`items[].observedLabel*` 明确标记 `mayDriveStructuredCompilation: false`。
- `test/protocol/current-field-facts.test.js:107-114`：再次断言 `observedLabel` 是 observation boundary，不是 canonical/current。

补充说明：

- `src/writers/html/audit/author-audit.js:155-164` 仍使用 `sourceType` 做 `AUTHOR_UNSUPPORTED_VECTOR_FALLBACK` 诊断，这是**观察/审核路径**，不是 `author-package-writer.js` 的结构化写出决策。
- `test/indesign-to-html/author-audit.test.js:133-170` 还专门防止 audit 误用 retired `item.type` 代替 current `sourceType`。

判断：

- writer 主决策面没有发现退役字段双路径。
- 剩余 `sourceType` 消费点属于 observation/audit，不构成 current model 或 writer decision path 泄漏。

## blueprint migration 结论

风险等级：**none**

证据：

- `src/adapters/indesign/normalizer/blueprint-migration.js:21-26`：历史 blueprint 在无 source-structure labels 时禁止走 authoring mode。
- `src/adapters/indesign/normalizer/blueprint-migration.js:131-179`：`item.type` 只在 migration adapter 内部一次性归一化为 canonical `role`，同时把 `slotType`、`label`、`evidence`、`confidence` 记录进 `migration.*`。
- `src/adapters/indesign/normalizer/blueprint-migration.js:74-76`：出口同样经过 `validateSemanticModel(...strictFields: true)`。

判断：

- 这是明确声明的迁移路径，不是 current runtime 双路径。
- 当前没有看到 blueprint migration 把退役字段直接带入 current model surface。

## 可删候选

### 1. `src/writers/html/audit/author-audit.js:155-164`

分类：**观察报告路径**

说明：

- 这里依赖 `sourceType` 给反向作者包做 vector fallback 告警。
- 如果未来能完全改成几何/矢量事实驱动，而不需要 `sourceType === 'PageItem'/'unknown'` 这个观察信号，这一小段可继续收缩。

当前是否建议立即删除：**否**

### 2. 无其他立即可删候选

说明：

- 本轮 scoped runtime path 未发现“删掉即可更正确”的退役运行分支。
- 现有保留项要么是注册表退役声明，要么是 observation/migration surface，本身就是护栏的一部分。

## 不可删理由

### 1. `items[].sourceType` 不能删

理由：

- 它是 active `sourceMetadata`，不是 retired field。
- 其职责是保留来源格式物种信息，供 observation/audit 使用；协议已明确“not a semantic role”。
- 删除它会削弱 reverse audit、问题定位和迁移报告能力。

### 2. `items[].observedLabel*` 不能删

理由：

- 它承担“保留 copied/foreign/unknown label 证据但不进入 current model”的边界职责。
- 删除它会把“严格拒绝但保留观察证据”退化成“直接丢弃”，不利于诊断，也违背“失败要早于假成功，但观察信息可保留”的原则。

### 3. `items[].migration*` / blueprint migration 不能删

理由：

- 这是显式迁移面，且 authoring mode 已被挡住。
- 它不是兼容双路径，而是受控迁移输入的事实记录。

## 是否需要沉淀长期规范

结论：**需要，建议小幅沉淀。**

建议沉淀内容：

- 在 `docs/规范/REVERSE_EXPORT.md` 或 `docs/规范/SEMANTIC_RECONSTRUCTION.md` 增加一句明确规则：
  - **raw snapshot `page/item.type` 只允许在 adapter 内部一次性归一化为 canonical `role`；归一化后只保留 `sourceType` 作为观察事实，下游不得再从 `sourceType` 或退役 `items[].type` 回推 current role/semantic/style decisions。**

原因：

- 代码和测试已经这样做了，但该边界目前更多体现在实现与测试里，文档层可再补一句，避免以后重新引入双路径。

## 最终判断

- 当前结论：**存在观察路径但合理**
- 风险等级：**none**
- 是否发现运行路径风险：**否**
- 是否发现可立即删除的退役运行分支：**否**
