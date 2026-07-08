const { lintAuthoringPackage } = require('../../authoring');
const { resolveProjectPath } = require('../path-policy');

async function call(args, context) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const result = await lintAuthoringPackage({
    packagePath,
    strict: Boolean(args.strict),
    gridTolerance: args.gridTolerance,
  });

  return {
    status: 'complete',
    data: result,
    artifacts: [],
  };
}

module.exports = {
  call,
};
