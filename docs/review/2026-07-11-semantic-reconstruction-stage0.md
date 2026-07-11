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

## 0B–0F

尚未实施。后续每个阶段完成后在本文件追加提交、验证命令、结果和剩余非阻塞项。
