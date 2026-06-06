# 规范

放当前长期有效的项目规范、协议和架构说明。

这里的文档用于指导后续实现。方案落地后，如果规则会长期存在，应从 `superpowers/` 或 `review/` 同步沉淀到这里。

协议字段事实源是 `PROTOCOL_FIELD_REGISTRY.md` 及其生成来源 `src/protocol/` registry。规范文档只保留长期原则、边界、流程和关键示例，不继续维护重复静态字段表。

当前文档：

| 文档 | 用途 |
| ---- | ---- |
| `HTML_INDESIGN_LIBRARY_SPEC.md` | 库级目标、边界和转换架构 |
| `AGENT_HTML_AUTHORING_GUIDE.md` | Agent 编写固定分页 HTML 作者包的长期说明书和回读保护要求 |
| `PROTOCOL_FIELD_REGISTRY.md` | 由 registry 生成的协议字段清单和 HTML/InDesign/PPTX 能力矩阵 |
| `SEMANTIC_PROTOCOL.md` | 固定语义 HTML 协议 |
| `LABEL_PROTOCOL.md` | HTML `data-id-*` 与 InDesign `html_indesign` 脚本标签协议 |
| `REVERSE_EXPORT.md` | InDesign 反向导出、观察模式和语义化迁移规范 |
| `SEMANTIC_RECONSTRUCTION.md` | 语义重建层、算法边界、报告和候选算法 |
| `SEMANTIC_OBJECT_GRAPH.md` | 语义重建第一阶段页面对象图证据层规范 |
| `FONT_POLICY.md` | 项目公共字体库、字体 token、映射和预检规范 |

相关架构设计：

| 文档 | 用途 |
| ---- | ---- |
| `../superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md` | 已落地的协议字段注册表、多格式能力矩阵和 PPTX 适配边界设计，作为追溯和边界参考；当前事实以代码、registry 和生成文档为准 |
