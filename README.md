# @sa/html-indesign

<p align="right">
  <a href="#chinese">中文</a> | <a href="#english">English</a>
</p>

## <a id="chinese"></a>中文

`@sa/html-indesign` 是 Sa 内部使用的 `indesign-cli` 插件包，用于固定语义 HTML 与 Adobe InDesign 之间的双向转换。

它面向两类使用场景：

- Agent 或设计人员先编写可在浏览器预览的固定分页 HTML，再生成 InDesign 构建指令和正式 INDD/PDF/IDML。
- 设计人员已经有 InDesign 文件时，通过反向导出得到可观察、可整理、可再次编辑的 HTML 作者包。

项目内部的回环审计、结构 diff、视觉 diff 和 P0/P1 门禁是研发测试工具，不作为普通插件工具暴露给日常使用者。

### 公司用户安装

公司提供的 `indesign-cli-agent-setup.exe` 已包含 CLI、Node、HTML 插件和生产依赖。用户只需安装 Adobe InDesign；系统 Microsoft Edge 用于 HTML 快照，不需要另装 Node、Python、npm 或 Git。

```powershell
& "<setup-path>\indesign-cli-agent-setup.exe"
indesign-cli-agent tool list --domain html
```

普通命令启动前会自动检查运行环境更新。IT 如需固定受控 Edge，可设置 `HTML_INDESIGN_BROWSER_EXECUTABLE` 为 `msedge.exe` 的绝对路径；Edge 不可用时返回 `EDGE_NOT_AVAILABLE`，不会静默换用其他浏览器。

### 独立开发安装

仓库开发者可以使用 Node.js `>=20.18.1` 和 npm 单独安装插件：

```powershell
npm install -g @sa/html-indesign
$pluginRoot = Join-Path (npm root -g) "@sa/html-indesign"
indesign-cli plugin validate $pluginRoot
indesign-cli plugin install $pluginRoot
```

### 可用工具

| 工具 | 用途 |
| ---- | ---- |
| `html.authoring_lint` | 检查 HTML 作者包是否符合项目协议 |
| `html.compile_instructions` | 把固定语义 HTML 编译为 InDesign 构建指令 |
| `html.build_indesign` | 严格检查并构建 INDD/PDF/IDML；正式模式核对真实 InDesign 对象后才返回已验证 |
| `html.reverse_export` | 请求宿主从 INDD 反向导出 HTML 作者包 |

查看工具和参数：

```powershell
indesign-cli tool list --domain html
indesign-cli tool schema html.authoring_lint
indesign-cli tool schema html.compile_instructions
```

### 本地开发

在仓库目录内：

```powershell
npm install
npm test
npm run plugin:validate
npm run pack:dry-run
```

`npm run plugin:install` 会把当前仓库作为本地插件安装到 `indesign-cli`，适合开发调试时使用。

---

## <a id="english"></a>English

`@sa/html-indesign` is Sa's internal `indesign-cli` plugin package for bidirectional conversion between fixed semantic HTML and Adobe InDesign.

It is built for two workflows:

- An agent or designer authors fixed-page HTML that remains easy to preview in a browser, then compiles it into InDesign build instructions and formal INDD/PDF/IDML outputs.
- A designer starts from an existing InDesign document, then reverse-exports it into an observable and editable HTML authoring package.

Internal roundtrip audits, structural diffs, visual diffs, and P0/P1 gates are project verification tools. They are not exposed as normal plugin tools for daily users.

### Company Installation

The company-provided `indesign-cli-agent-setup.exe` already contains the CLI, Node, the HTML plugin, and production dependencies. Users only need Adobe InDesign; system Microsoft Edge is used for HTML snapshots. Node, Python, npm, and Git are not required on user workstations.

```powershell
& "<setup-path>\indesign-cli-agent-setup.exe"
indesign-cli-agent tool list --domain html
```

Normal commands check for runtime updates automatically. IT may set `HTML_INDESIGN_BROWSER_EXECUTABLE` to an approved absolute `msedge.exe` path. If Edge cannot launch, the plugin returns `EDGE_NOT_AVAILABLE` and does not silently change browsers.

### Standalone Development Install

Repository developers may install the plugin separately with Node.js `>=20.18.1` and npm:

```powershell
npm install -g @sa/html-indesign
$pluginRoot = Join-Path (npm root -g) "@sa/html-indesign"
indesign-cli plugin validate $pluginRoot
indesign-cli plugin install $pluginRoot
```

### Tools

| Tool | Purpose |
| ---- | ------- |
| `html.authoring_lint` | Check whether an HTML authoring package follows the project protocol |
| `html.compile_instructions` | Compile fixed semantic HTML into InDesign build instructions |
| `html.build_indesign` | Strict-check and build INDD/PDF/IDML; final mode verifies the real InDesign objects before reporting success |
| `html.reverse_export` | Ask the host to reverse-export an INDD file into an HTML authoring package |

Inspect available tools and schemas:

```powershell
indesign-cli tool list --domain html
indesign-cli tool schema html.authoring_lint
indesign-cli tool schema html.compile_instructions
```

### Local Development

From this repository:

```powershell
npm install
npm test
npm run plugin:validate
npm run pack:dry-run
```

`npm run plugin:install` installs the current repository as a local `indesign-cli` plugin for development and debugging.
