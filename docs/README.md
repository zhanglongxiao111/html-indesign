# 文档入口

`docs/` 根目录只保留本入口。具体文档必须进入子目录。

## 目录职责

| 路径 | 用途 |
| ---- | ---- |
| `规范/` | 当前长期规范、协议和架构说明 |
| `AI协作/` | 本地 Agent、外部咨询、用户反馈等协作过程材料 |
| `review/` | 审核、对照检查、翻译准确性评估 |
| `bugfix/` | 复杂缺陷的根因、修复过程和回归记录 |
| `superpowers/specs/` | 方案设计和边界分析，不自动等同长期规范 |
| `superpowers/plans/` | 实施计划、阶段拆分和验证清单 |
| `legacy/` | 只追溯的历史资料 |

## 当前关键文档

| 文档 | 用途 |
| ---- | ---- |
| `规范/HTML_INDESIGN_LIBRARY_SPEC.md` | 库级目标、边界和转换架构 |
| `规范/PROTOCOL_FIELD_REGISTRY.md` | 由 registry 生成的协议字段清单和格式能力矩阵 |
| `规范/SEMANTIC_PROTOCOL.md` | 固定语义 HTML 协议 |
| `规范/LABEL_PROTOCOL.md` | HTML 与 InDesign 双向标签协议 |
| `规范/REVERSE_EXPORT.md` | InDesign 反向导出和语义化迁移规范 |
| `规范/FONT_POLICY.md` | 项目公共字体库、字体 token、映射和预检规范 |
| `superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md` | 已落地的协议字段注册表、多格式能力矩阵和 PPTX 适配边界设计，作为追溯和边界参考 |
| `AI协作/README.md` | AI 协作材料的分类、命名和流转规则 |

## 参考过程材料

| 文档 | 用途 |
| ---- | ---- |
| `review/html-to-indesign-translation-audit-20260524.md` | 历史 HTML 到 InDesign 翻译准确性审核，只作问题追溯，不作为当前架构事实源 |

## 写作规则

- 中文，短句，直接写结论。
- 长期约束沉淀到规范文档，不藏在计划或审核里。
- `docs/` 根目录不新增专题文档。
- 方案落地后，如产生长期规则，同步更新 `AGENTS.md` 或对应规范文档。
- 协议字段事实源是 `规范/PROTOCOL_FIELD_REGISTRY.md` 及其生成来源 `src/protocol/` registry；长期规范只保留原则、边界和关键示例。
- 文档与代码不一致时，以代码和可复现实测为准，并顺手修正文档。
