const fs = require('node:fs');
const path = require('node:path');
const { compileReverseSnapshotToHtml } = require('../../reverse-pipeline');
const { resolveReconstructionProfile } = require('../../semantic-reconstruction');
const { buildReverseSnapshotJsx } = require('../host-jsx');
const { ensureOutputDir, getPluginRoot, resolveProjectPath } = require('../path-policy');
const { artifact } = require('../artifacts');

async function call(args, context) {
  const pluginRoot = getPluginRoot();
  const inddPath = resolveProjectPath(context, args.indd, 'indd');
  if (!fs.existsSync(inddPath)) {
    const err = new Error(`INDD file not found: ${inddPath}`);
    err.code = 'INDD_NOT_FOUND';
    throw err;
  }

  const outDir = ensureOutputDir(context, args.outDir, 'html-plugin-reverse');
  const snapshotPath = path.join(outDir, 'reverse-snapshot.json');
  const reverseScriptPath = path.join(outDir, 'reverse-snapshot.jsx');
  const reconstructionProfile = resolveReconstructionProfile({
    profile: args.reconstructionProfile,
    algorithms: args.reconstruct,
  });

  fs.writeFileSync(reverseScriptPath, buildReverseSnapshotJsx({
    repoRoot: pluginRoot,
    inddPath,
    outputPath: snapshotPath,
    closeDocument: true,
  }), 'utf8');

  return {
    status: 'requires_host_actions',
    state: {
      tool_id: 'html.reverse_export',
      outDir,
      inddPath,
      snapshotPath,
      reverseScriptPath,
      mode: args.mode || 'structured',
      assetPolicy: args.assetPolicy || 'reference',
      sourceRoot: args.sourceRoot ? resolveProjectPath(context, args.sourceRoot, 'sourceRoot') : null,
      nasPublicRoot: args.nasPublicRoot || '/nas',
      reconstructionProfile,
    },
    actions: [
      {
        id: 'html-reverse-snapshot',
        tool_id: 'script.run',
        args: {
          file: reverseScriptPath,
          timeout: args.timeout || 300,
        },
      },
    ],
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

  if (!fs.existsSync(state.snapshotPath)) {
    return {
      status: 'error',
      error: {
        code: 'REVERSE_SNAPSHOT_MISSING',
        message: `Reverse snapshot missing: ${state.snapshotPath}`,
      },
    };
  }

  const result = compileReverseSnapshotToHtml({
    snapshotPath: state.snapshotPath,
    outDir: state.outDir,
    mode: state.mode || 'structured',
    sourceRoot: state.sourceRoot || undefined,
    assetPolicy: state.assetPolicy || 'reference',
    nasPublicRoot: state.nasPublicRoot || '/nas',
    reconstructionProfile: state.reconstructionProfile,
  });
  const authorDeckPath = result.files && result.files.author ? result.files.author.entry : path.join(state.outDir, 'author', 'deck.html');
  const visualDeckPath = result.files ? result.files.visualHtml : path.join(state.outDir, 'deck.visual.html');
  const reportPath = result.files ? result.files.report : path.join(state.outDir, 'report.json');
  const reverseModelPath = result.files ? result.files.model : path.join(state.outDir, 'reverse-model.json');
  const authorAudit = result.files && result.files.author && result.files.author.audit;

  if (!(authorAudit && authorAudit.ok === true)) {
    return {
      status: 'error',
      error: {
        code: 'REVERSE_AUTHOR_AUDIT_FAILED',
        message: authorAudit
          ? 'Reverse author package audit failed.'
          : 'Reverse author package audit evidence is missing; refusing to report success without it.',
        details: authorAudit || null,
      },
    };
  }

  const pipelineFailure = reversePipelineFailureResponse(result);
  if (pipelineFailure) return pipelineFailure;

  if (!fs.existsSync(authorDeckPath)) {
    return {
      status: 'error',
      error: {
        code: 'AUTHOR_HTML_MISSING',
        message: `Reverse export did not produce author deck: ${authorDeckPath}`,
      },
    };
  }

  const artifacts = [
    artifact('json', state.snapshotPath, 'Reverse snapshot'),
    artifact('html', authorDeckPath, 'Author deck html'),
  ];
  if (visualDeckPath && fs.existsSync(visualDeckPath)) artifacts.push(artifact('html', visualDeckPath, 'Visual deck html'));
  if (reportPath && fs.existsSync(reportPath)) artifacts.push(artifact('json', reportPath, 'Reverse report'));
  if (reverseModelPath && fs.existsSync(reverseModelPath)) artifacts.push(artifact('json', reverseModelPath, 'Reverse model'));

  return {
    status: 'complete',
    data: {
      ok: true,
      outDir: state.outDir,
      snapshotPath: state.snapshotPath,
      authorDeckPath,
      visualDeckPath: visualDeckPath && fs.existsSync(visualDeckPath) ? visualDeckPath : null,
      reportPath: reportPath && fs.existsSync(reportPath) ? reportPath : null,
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

function reversePipelineFailureResponse(result) {
  if (result && result.ok === true) return null;
  return {
    status: 'error',
    error: {
      code: 'REVERSE_PIPELINE_FAILED',
      message: 'Reverse pipeline failed; refusing to report a successful export.',
      details: result && result.report ? result.report : result || null,
    },
  };
}

module.exports = {
  call,
  resume,
  reversePipelineFailureResponse,
};
