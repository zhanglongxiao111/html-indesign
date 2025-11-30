---
description: \u5f52\u6863\u5df2\u90e8\u7f72\u7684 OpenSpec \u53d8\u66f4\u5e76\u66f4\u65b0\u89c4\u8303
---

$ARGUMENTS
<!-- OPENSPEC:START -->
**防护栏**
- 优先提供直接、最小可行的实现，只在确有需求时再增加复杂度。
- 将改动范围收敛到请求的目标，避免额外扩展。
- 如需更多约定或澄清，参考 `openspec/AGENTS.md`（位于 `openspec/` 目录，若缺失请先运行 `ls openspec` 或 `openspec update`）。

**步骤**
1. 确定要归档的 change ID：
   - 如果当前提示已经给出明确的 change ID（例如 slash 参数生成的 `<ChangeId>`），去除空白后直接使用。
   - 如果对话仅模糊提到变更（标题或摘要），运行 `openspec list` 找出候选，分享并确认用户意图。
   - 其它情况：先回顾对话，再运行 `openspec list`，向用户确认要归档的变更；未确认前不要继续。
   - 若仍无法定位唯一 ID，停止并告知暂无法归档。
2. 运行 `openspec list`（或 `openspec show <id>`）验证 change ID，若缺失、已归档或状态不合适则停止。
3. 执行 `openspec archive <id> --yes`，让 CLI 无提示移动变更并更新规范（仅工具类工作时才加 `--skip-specs`）。
4. 检查命令输出，确认目标规范已更新且变更进入 `changes/archive/`。
5. 运行 `openspec validate --strict`，若异常再用 `openspec show <id>` 复查。

**参考**
- 归档前用 `openspec list` 确认 change ID。
- 归档后用 `openspec list --specs` 检查更新的规范，解决任何校验问题再交付。
<!-- OPENSPEC:END -->
