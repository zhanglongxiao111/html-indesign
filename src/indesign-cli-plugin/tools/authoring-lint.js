const { lintAuthoringPackage } = require('../../authoring');
const { resolveProjectPath } = require('../path-policy');

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const result = await lintAuthoringPackage({
    packagePath,
    strict: Boolean(args.strict),
    gridTolerance: args.gridTolerance,
  });

  if (result && result.ok === false) {
    return {
      status: 'error',
      error: {
        code: 'AUTHORING_LINT_FAILED',
        message: 'Authoring lint reported errors; fix the package before compiling.',
        details: result,
      },
    };
  }

  return {
    status: 'complete',
    data: result,
    artifacts: [],
  };
}

module.exports = {
  call,
};
