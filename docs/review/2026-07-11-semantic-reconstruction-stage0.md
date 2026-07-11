# 语义重建阶段 0 实施记录

日期：2026-07-11

分支：`codex/semantic-reconstruction-stage0`

本文只记录可公开复核的数量、门禁和结论。真实 InDesign 文件路径、客户名称和页面内容只保留在已忽略的 `test/workspace/semantic-reconstruction-stage0/` 本地证据中。

## 0A：observed-only 基线

基线提交：`5a96e33`

本地证据目录：`test/workspace/semantic-reconstruction-stage0/baseline/`

输入与运行状态：

- 页面：47
- 页面对象：537
- 资源：87
- 重建状态：`observed-only`
- 重建算法：空列表
- 完整测试：1033 项通过
- 真实人类文件双回环：通过

首轮和二轮作者包报告：

| 报告 | 结果 |
| --- | --- |
| `source-roundtrip-report.json` | 通过 |
| `content-inventory-report.json` | 通过 |
| `structure-signature-report.json` | 通过 |
| `canonical-content-inventory-report.json` | 通过 |
| `canonical-structure-signature-report.json` | 通过 |
| `canonical-source-drift-report.json` | 通过，源码漂移为 0 |

独立门禁：

| 门禁 | 基线结果 |
| --- | --- |
| reverse-snapshot stability | 通过，0 error / 0 warning |
| effective-diff | P0=0，P1=0，P2=467（仅统计） |
| reverse-visual | 537 个对象参与比较；缺失 0，文字差异 0，页面差异 0，几何差异 3 |
| author-editability | 通过；语义容器覆盖率 0.1158，顶层散落对象 528，inline 741，低层几何字段 774 |
| trusted-source | 通过；observed-only 输入中可信作者对象为 0 |
| conversion-gate | 通过 |

人工复核后将现存 3 个几何差异固定为 baseline 预算：1 个对象宽度差 5px，2 个对象高度差 7px。该预算只允许保持或收紧；候选运行不得改写 baseline 报告、扩大预算或隐藏差异。

## 0B：可信来源保护与 fail-closed

起点提交：`6690eaf`

实施提交：`7c43bbd`

本阶段先用失败测试证明两条现存问题，再修改实现：

- 当可信页级对象没有显式 `order`、旁边观察对象触发 text-block 分组时，共享排序函数会擅自给可信对象补 `order`。
- 底层语义重建即使报告可信结构审计失败，插件 resume 和 E2E 仍只检查作者包审计，存在包装成成功的路径。

收口结果：

- 共享排序跳过全部可信来源对象，混合 trusted/untrusted 分组不再改变可信对象任何字段。
- reverse pipeline 只有在 `trustedSourcePreservation.ok === true` 时才允许最终成功；报告缺失、值缺失或 false 都失败。
- standalone CLI 继承底层退出状态；插件 resume 返回 `REVERSE_PIPELINE_FAILED`；E2E 在继续回环前直接抛出原始失败证据。
- 作者包自身失败仍保留更具体的 `REVERSE_AUTHOR_AUDIT_FAILED`，没有被总门禁掩盖。
- 语义重建定向测试 20 项通过；CLI、插件和 E2E 定向测试 63 项通过；完整测试 1037 项通过。

## 0C：pass 幂等与 reading-order-lite

起点提交：`7c43bbd`

实施提交：`e7f1e09`

本阶段先用双跑测试复现 `caption-structure` 会把同一图注 order 从 1 增到 2，再完成以下收口：

- 已经是同一 `figure + figcaption` 父子结构的候选记录为 `caption-already-structured`，不再重复写回。
- 新增独立 `reading-order-lite` pass，以 `(y, x, originalIndex)` 稳定排序；宽页面、相同坐标、无 bounds 和 trusted 混排均有回归测试。
- `figure-grid` 和 `text-block` 不再隐式修改全页 order；需要排序时由调用方显式选择 `reading-order-lite`，且执行器把它放在结构 pass 之后。
- reading-order-lite 只改非可信页级对象，并避开可信对象已有 order；可信对象逐字段保持不变。
- `page-object-graph`、`caption-structure`、`figure-grid`、`text-block`、`reading-order-lite` 和目标组合列表全部通过模型级双跑字节稳定测试。

定向语义重建测试 27 项通过；完整测试 1044 项通过。

## 0D：统一 reconstruction profile 与入口

起点提交：`e7f1e09`

实施提交：`e54cd8c`

收口结果：

- `src/semantic-reconstruction/profiles.js` 成为 profile 名称、算法规范顺序、依赖、去重和 safe 列表的唯一事实源。
- `none` 明确解析为空列表；`safe` 在 0F 前也保持空列表；`experimental` 必须显式提供至少一个算法。
- `caption-structure` 自动补 `page-object-graph`；`figure-grid` 自动补 `caption-structure` 及其依赖；结果按统一顺序去重。
- 底层 reverse pipeline 必须收到已解析的 `reconstructionProfile`，缺失或非规范顺序直接失败，不再静默当成空列表。
- snapshot CLI、真实 INDD E2E、递归第二轮和插件 call/state/resume 全部透传同一份已解析对象；`--reconstruct` 在非 experimental 下直接拒绝。
- 插件 schema 和 CLI 帮助直接引用统一算法清单，没有维护第二份顺序。

本机新版 `indesign-cli plugin validate` 同时暴露了既有插件 manifest/tool catalog 缺少新版必填元数据。已按本机 CLI 规范补齐顶层 timeout、document-state、host-actions，以及四个工具的 preconditions、成功示例和失败示例；插件校验通过，4 个正式工具、2 个 InDesign 工具、0 error / 0 warning。

定向 profile、CLI、E2E 和插件测试 106 项通过；完整测试 1054 项通过。

## 0E：synth 覆盖与 inline 残差

起点提交：`e54cd8c`

收口结果：

- 新增 `author-style-residual.js`，统一生成 synth CSS 声明、解析声明、规范化颜色/数值精度并计算属性级残差。
- `components.css` 改为 paragraph/character/object 声明样式在前、synth 在后；真实 Chromium 计算样式证明 class 冲突时 synth 的字号和颜色生效。
- source style、grid 变量、不同值 override、文本框属性、z-index 和 synth 未覆盖属性保持 inline；只有同 token 的实际 synth rule 中存在且等值的属性才删除。
- 找不到 synth rule 时保留全部 inline，并在 `authoring-report.json.styleResidual.missingSynthRules` 记录 item 和 token；报告同时统计删除属性数和被精简对象数。
- accepted source node、rich-text run、table cell、vector 和 PDF wrapper 不参加本轮 item 残差去重；vector opacity 不再因为只有 token 就被提前删除。
- 合成文字样例删除 7 个重复 inline 属性，作者 HTML 最终格式由 synth class 提供；CSS、作者包、结构签名、可编辑性和视觉 writer 定向测试 88 项通过。

完整测试 1060 项通过。

## 0F

尚未实施。后续每个阶段完成后在本文件追加提交、验证命令、结果和剩余非阻塞项。
