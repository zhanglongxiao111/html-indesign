---
name: indesign-cli
description: 在 html-indesign 项目中需要用真实 Adobe InDesign 验证生成的 JSX、构建指令、导出文件或 HTML-to-InDesign 编译结果时使用。
---

# InDesign CLI

## 用途

使用已安装的 `indesign-cli` 作为本项目连接真实 Adobe InDesign 的执行桥。当前项目专注语义 HTML、校验器和编译输出，不在这里重建 COM、MCP 或 JSX 传输层。

## 边界

- `html-indesign` 负责语义 HTML、schema、validator、preview、compiler output 和 build-instruction JSON。
- `mcp-indesign` 负责通过 COM、JSX、MCP handler 和 CLI 实际执行 InDesign 操作。
- ExtendScript 只接收已经校验过的构建指令；不要把 HTML 解析、语义推理或大段校验逻辑塞进 JSX。
- 临时真实测试文件放在 `test/workspace/`，该目录已进入 `.gitignore`。

## 常用命令

除非任务明确要求其他目录，默认在 `D:\AI\html-indesign` 下运行。

```powershell
indesign-cli server health
indesign-cli --json --pretty server health
indesign-cli tool domains
indesign-cli tool list --domain utility
indesign-cli tool schema <tool_id>
indesign-cli tool call <tool_id> --args test\workspace\args.json
indesign-cli script run _indesign_scripts\build_from_instructions.jsx
indesign-cli script run test\workspace\probe.jsx
indesign-cli export verify test\workspace\output.pdf
```

需要给测试脚本解析结果时，优先加 `--json --pretty`。

如果 JSX 最后一行返回 JSON 字符串，CLI 会保留原始 `data.parsed.result`，并额外提供已解析的 `data.result_json`。Agent 后续判断优先读 `data.result_json`。

## 现有构建脚本

`_indesign_scripts\build_from_instructions.jsx` 默认读取 `D:/AI/html-indesign/test/workspace/instructions.json`，除非脚本或文档标签覆盖路径。编译器 E2E 默认流程：

1. 生成 `test\workspace\instructions.json`。
2. 运行 `indesign-cli script run _indesign_scripts\build_from_instructions.jsx`。
3. 检查 CLI 返回值或 InDesign 文档中的结果标签。
4. 如需导出，导出后运行 `indesign-cli export verify <path>`。

## 测试卫生

- 较大的实验放到 `test/workspace/<日期时间>/`。
- fixture 里尽量使用相对资源路径。
- 不记录客户文档内容、客户名称或私有资产完整路径。
- 真实测试创建了临时 InDesign 文档后，要关闭或清理。
- `server health` 失败时，报告环境阻塞，不要在本项目绕过 CLI 重写执行层。
