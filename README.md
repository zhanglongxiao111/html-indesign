# @sa/html-indesign

Sa fixed semantic HTML and InDesign bidirectional translation plugin for `indesign-cli`.

## Install

Install the InDesign CLI runtime first:

```powershell
pip install "git+https://github.com/zhanglongxiao111/indesign-cli.git"
indesign-cli server setup
indesign-cli server health
```

Install this plugin package:

```powershell
npm install -g @sa/html-indesign
```

Until `indesign-cli plugin install` supports npm package names directly, resolve the global package path and install from that directory:

```powershell
$pluginRoot = Join-Path (npm root -g) "@sa/html-indesign"
indesign-cli plugin validate $pluginRoot
indesign-cli plugin install $pluginRoot
indesign-cli tool list --domain html
```

For local development from this repository:

```powershell
npm install
npm run plugin:validate
npm run plugin:install
```

## Public Tools

- `html.authoring_lint`
- `html.compile_instructions`
- `html.build_indesign`
- `html.reverse_export`

Roundtrip audits, structural diffs, visual diffs, and P0/P1 gates remain internal project tests. They are not exposed as `indesign-cli` plugin tools.
