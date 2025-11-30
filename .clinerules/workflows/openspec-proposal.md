# OpenSpec: Proposal

\u521b\u5efa\u65b0\u7684 OpenSpec \u53d8\u66f4\u5e76\u8fdb\u884c\u4e25\u683c\u9a8c\u8bc1
<!-- OPENSPEC:START -->
**防护栏**
- 优先提供直接、最小可行的实现，只在确有需求时再增加复杂度。
- 将改动范围收敛到请求的目标，避免额外扩展。
- 如需更多约定或澄清，参考 `openspec/AGENTS.md`（位于 `openspec/` 目录，若缺失请先运行 `ls openspec` 或 `openspec update`）。
- 遇到含糊或不明确的点先提问澄清，再动手改文件。
- 提案阶段不要写代码，仅产出设计文档（proposal.md、tasks.md、design.md 以及规范 delta）。实现需在获批后在 apply 阶段完成。

**步骤**
1. 阅读 `openspec/project.md`，运行 `openspec list` 与 `openspec list --specs`，并查看相关代码或文档（如用 `rg`/`ls`）以对齐当前行为，记录需要澄清的空缺。
2. 选择唯一的动词开头 `change-id`，在 `openspec/changes/<id>/` 下搭建 `proposal.md`、`tasks.md`，必要时添加 `design.md`。
3. 将变更拆解为可交付的能力或需求，跨范围的工作拆成独立的规范 delta，并写清关系和顺序。
4. 若方案跨多个系统、引入新模式或需权衡取舍，在 `design.md` 记录架构理由后再落地规范。
5. 在 `changes/<id>/specs/<capability>/spec.md` 中撰写规范 delta（每个能力单独目录），使用 `## ADDED|MODIFIED|REMOVED Requirements`，每个需求至少包含一个 `#### Scenario:`，必要时交叉引用相关能力。
6. 将 `tasks.md` 写成可验证的小步清单，确保有用户可见的推进、验证方式（测试/工具），并标注依赖或可并行项。
7. 执行 `openspec validate <id> --strict`，修复全部问题后再分享提案。

**参考**
- 若校验失败，可用 `openspec show <id> --json --deltas-only` 或 `openspec show <spec> --type spec` 查看详情。
- 在撰写前用 `rg -n "Requirement:|Scenario:" openspec/specs` 搜索现有需求，避免重复。
- 用 `rg <keyword>`、`ls` 或直接读文件探索代码库，确保提案贴合现状。
<!-- OPENSPEC:END -->
