# 规范

放当前长期有效的项目规范、协议和架构说明。

这里的文档用于指导后续实现。方案落地后，如果规则会长期存在，应从 `superpowers/` 或 `review/` 同步沉淀到这里。

字段注册表实现前，本目录中的静态字段表仍记录当前行为边界。字段注册表和能力矩阵落地后，重复字段表应迁移为注册表集中维护或生成文档，不能继续各文档各写一份。

当前文档：

| 文档 | 用途 |
| ---- | ---- |
| `HTML_INDESIGN_LIBRARY_SPEC.md` | 库级目标、边界和转换架构 |
| `SEMANTIC_PROTOCOL.md` | 固定语义 HTML 协议 |
| `LABEL_PROTOCOL.md` | HTML `data-id-*` 与 InDesign `html_indesign` 脚本标签协议 |
| `REVERSE_EXPORT.md` | InDesign 反向导出、观察模式和语义化迁移规范 |
| `FONT_POLICY.md` | 项目公共字体库、字体 token、映射和预检规范 |

相关架构设计：

| 文档 | 用途 |
| ---- | ---- |
| `../superpowers/specs/2026-05-31-protocol-field-registry-architecture-design.md` | 协议字段注册表、多格式能力矩阵和未来 PPTX 适配架构设计 |
