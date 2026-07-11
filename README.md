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

### 安装前准备

本插件需要先安装并配置 `indesign-cli`。如果本机还没有配置过：

```powershell
pip install "git+https://github.com/zhanglongxiao111/indesign-cli.git"
indesign-cli server setup
indesign-cli server health
```

同时需要：

- Node.js `>=20.18.1`
- npm
- Microsoft Edge（浏览器快照默认使用系统 `msedge` 通道）
- 需要真实构建或反向导出时，本机必须能正常启动 Adobe InDesign

IT 如需固定受控 Edge，可设置 `HTML_INDESIGN_BROWSER_EXECUTABLE` 为 `msedge.exe` 的绝对路径。Edge 不可用时插件返回 `EDGE_NOT_AVAILABLE`，不会静默改用 Playwright Chromium。

### 安装插件

```powershell
npm install -g @sa/html-indesign
```

当前 `indesign-cli plugin install` 还没有直接支持 npm 包名，因此先解析全局 npm 安装目录，再把插件目录交给 `indesign-cli`：

```powershell
$pluginRoot = Join-Path (npm root -g) "@sa/html-indesign"
indesign-cli plugin validate $pluginRoot
indesign-cli plugin install $pluginRoot
indesign-cli tool list --domain html
```

以后 `indesign-cli` 支持 npm 包名解析后，目标安装方式会收敛为：

```powershell
indesign-cli plugin install @sa/html-indesign
```

### 可用工具

| 工具 | 用途 |
| ---- | ---- |
| `html.authoring_lint` | 检查 HTML 作者包是否符合项目协议 |
| `html.compile_instructions` | 把固定语义 HTML 编译为 InDesign 构建指令 |
| `html.build_indesign` | 请求宿主执行 InDesign 构建，生成 INDD/PDF/IDML |
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

### Prerequisites

Install and configure `indesign-cli` first:

```powershell
pip install "git+https://github.com/zhanglongxiao111/indesign-cli.git"
indesign-cli server setup
indesign-cli server health
```

You also need:

- Node.js `>=20.18.1`
- npm
- Microsoft Edge (browser snapshots use the system `msedge` channel by default)
- Adobe InDesign available on the same machine when building or reverse-exporting real documents

IT may set `HTML_INDESIGN_BROWSER_EXECUTABLE` to an approved absolute `msedge.exe` path. If Edge cannot launch, the plugin returns `EDGE_NOT_AVAILABLE` and does not silently fall back to Playwright Chromium.

### Install

```powershell
npm install -g @sa/html-indesign
```

`indesign-cli plugin install` does not yet resolve npm package names directly. For now, resolve the global npm package directory and install from that path:

```powershell
$pluginRoot = Join-Path (npm root -g) "@sa/html-indesign"
indesign-cli plugin validate $pluginRoot
indesign-cli plugin install $pluginRoot
indesign-cli tool list --domain html
```

After npm package-name resolution is added to `indesign-cli`, the target flow will be:

```powershell
indesign-cli plugin install @sa/html-indesign
```

### Tools

| Tool | Purpose |
| ---- | ------- |
| `html.authoring_lint` | Check whether an HTML authoring package follows the project protocol |
| `html.compile_instructions` | Compile fixed semantic HTML into InDesign build instructions |
| `html.build_indesign` | Ask the host to build INDD/PDF/IDML through InDesign |
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
