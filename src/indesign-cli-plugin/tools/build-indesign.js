const fs = require('node:fs');
const path = require('node:path');
const { compileAuthoringPackage } = require('./compile-instructions');
const { getCwd } = require('../path-policy');
const { artifact } = require('../artifacts');
const { buildBuildJsx, buildExportJsx } = require('../host-jsx');

async function call(args, context) {
  const outputBaseName = args.outputBaseName || 'html-indesign-output';
  const compile = await compileAuthoringPackage({
    ...args,
    outputName: 'instructions.json',
  }, context, 'html-plugin-build');

  const cwd = getCwd(context);
  const buildScriptPath = path.join(compile.outDir, 'build.jsx');
  const exportScriptPath = path.join(compile.outDir, 'export.jsx');
  const exportPdf = args.exportPdf !== false;
  const exportIdml = args.exportIdml !== false;
  const timeout = args.timeout || 300;

  fs.writeFileSync(buildScriptPath, buildBuildJsx({
    repoRoot: cwd,
    instructionsPath: compile.instructionsPath,
  }), 'utf8');

  fs.writeFileSync(exportScriptPath, buildExportJsx({
    runDir: compile.outDir,
    outputBaseName,
    exportPdf,
    exportIdml,
    closeDocument: true,
  }), 'utf8');

  const actions = [
    {
      id: 'html-build-script',
      tool_id: 'script.run',
      args: {
        file: buildScriptPath,
        timeout,
      },
    },
    {
      id: 'html-export-script',
      tool_id: 'script.run',
      args: {
        file: exportScriptPath,
        timeout,
      },
    },
  ];

  if (exportPdf) {
    actions.push({
      id: 'html-export-verify',
      tool_id: 'export.verify',
      args: {
        path: path.join(compile.outDir, `${outputBaseName}.pdf`),
      },
    });
  }

  return {
    status: 'requires_host_actions',
    state: {
      tool_id: 'html.build_indesign',
      runDir: compile.outDir,
      outputBaseName,
      exportPdf,
      exportIdml,
      instructionsPath: compile.instructionsPath,
      summaryPath: compile.summaryPath,
      buildScriptPath,
      exportScriptPath,
    },
    actions,
    resume: {
      method: 'tools/resume',
    },
  };
}

async function resume(params) {
  const state = params.state || {};
  const failedHostResult = firstFailedHostResult(params.host_results || []);
  if (failedHostResult) {
    return {
      status: 'error',
      error: {
        code: 'HOST_ACTION_FAILED',
        message: `Host action failed: ${failedHostResult.id || failedHostResult.tool_id || 'unknown'}`,
        details: failedHostResult,
      },
    };
  }

  const runDir = state.runDir;
  const outputBaseName = state.outputBaseName || 'html-indesign-output';
  const inddPath = path.join(runDir, `${outputBaseName}.indd`);
  const pdfPath = path.join(runDir, `${outputBaseName}.pdf`);
  const idmlPath = path.join(runDir, `${outputBaseName}.idml`);

  const missing = [];
  if (!fs.existsSync(inddPath)) missing.push(inddPath);
  if (state.exportPdf && !fs.existsSync(pdfPath)) missing.push(pdfPath);
  if (state.exportIdml && !fs.existsSync(idmlPath)) missing.push(idmlPath);

  if (missing.length > 0) {
    return {
      status: 'error',
      error: {
        code: 'BUILD_ARTIFACTS_MISSING',
        message: `Expected build artifacts are missing: ${missing.join(', ')}`,
      },
    };
  }

  const artifacts = [];
  if (state.instructionsPath && fs.existsSync(state.instructionsPath)) {
    artifacts.push(artifact('json', state.instructionsPath, 'InDesign instructions'));
  }
  if (state.summaryPath && fs.existsSync(state.summaryPath)) {
    artifacts.push(artifact('json', state.summaryPath, 'Compile summary'));
  }
  artifacts.push(artifact('indd', inddPath, 'InDesign document'));
  if (state.exportPdf) artifacts.push(artifact('pdf', pdfPath, 'PDF export'));
  if (state.exportIdml) artifacts.push(artifact('idml', idmlPath, 'IDML export'));

  return {
    status: 'complete',
    data: {
      ok: true,
      runDir,
      inddPath,
      pdfPath: state.exportPdf ? pdfPath : null,
      idmlPath: state.exportIdml ? idmlPath : null,
    },
    artifacts,
  };
}

function firstFailedHostResult(hostResults) {
  return hostResults.find((result) => {
    if (!result) return false;
    if (result.status && result.status !== 'complete' && result.status !== 'ok') return true;
    if (result.ok === false) return true;
    if (result.data && result.data.ok === false) return true;
    return false;
  }) || null;
}

module.exports = {
  call,
  resume,
};
