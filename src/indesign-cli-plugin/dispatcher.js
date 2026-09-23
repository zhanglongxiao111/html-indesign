const { listTools, getTool, getSchema } = require('./tool-catalog');
const { validateArgs, argsErrorMessage } = require('./validate-args');
const { createRunId, withRunId } = require('./run-context');
const authoringLint = require('./tools/authoring-lint');
const compileInstructionsTool = require('./tools/compile-instructions');
const buildIndesign = require('./tools/build-indesign');
const reverseExport = require('./tools/reverse-export');
const manifest = require('./manifest.json');

const callers = {
  'html.authoring_lint': authoringLint,
  'html.compile_instructions': compileInstructionsTool,
  'html.build_indesign': buildIndesign,
  'html.reverse_export': reverseExport,
};

function error(code, message, details = {}) {
  return {
    status: 'error',
    error: {
      code,
      message,
      details,
    },
  };
}

function toolId(params) {
  return params.id || params.tool_id;
}

async function dispatch(request) {
  const method = request && request.method;
  const params = (request && request.params) || {};

  if (method === 'plugin/handshake') {
    const tools = listTools();
    return {
      id: 'html-indesign',
      version: manifest.version,
      protocol: 'indesign-cli-plugin.v1',
      domain: 'html',
      plugin: {
        id: 'html-indesign',
        name: 'html-indesign',
        version: manifest.version,
        domain: 'html',
      },
      capabilities: {
        tools: true,
        host_actions: ['script.run', 'export.verify', 'session.show'],
      },
      tools: {
        count: tools.length,
      },
    };
  }

  if (method === 'tools/list') {
    return { tools: listTools() };
  }

  if (method === 'tools/schema') {
    const id = toolId(params);
    const tool = getTool(id);
    const inputSchema = getSchema(id);
    if (!tool || !inputSchema) {
      return error('TOOL_NOT_FOUND', `Unknown html-indesign tool: ${id}`);
    }
    return {
      tool: { id: tool.id, name: tool.name },
      inputSchema,
    };
  }

  if (method === 'tools/call') {
    return await callTool(params, request.context || params.context || {});
  }

  if (method === 'tools/resume') {
    return await resumeTool(params, request.context || params.context || {});
  }

  return error('METHOD_NOT_FOUND', `Unknown plugin method: ${method}`);
}

async function resumeTool(params, context) {
  const state = params.state || {};
  const id = state.tool_id || toolId(params);
  const caller = callers[id];
  if (!caller || typeof caller.resume !== 'function') {
    return error('RESUME_TOOL_NOT_FOUND', `No resume handler for tool: ${id}`);
  }

  // resume 沿用首次调用时写进 state 的 runId：一次构建跨多轮 resume，仍是同一次运行。
  const runId = state.runId || null;
  try {
    return withRunId(await caller.resume(params, context || {}), runId);
  } catch (err) {
    return withRunId(error(err.code || 'TOOL_RESUME_FAILED', err.message, errorDetails(err, id)), runId);
  }
}

async function callTool(params, context) {
  const id = toolId(params);
  const tool = getTool(id);
  if (!tool) {
    return error('TOOL_NOT_FOUND', `Unknown html-indesign tool: ${id}`);
  }

  const caller = callers[id];
  if (!caller || typeof caller.call !== 'function') {
    return error('TOOL_NOT_IMPLEMENTED', `Tool call is not implemented yet: ${id}`);
  }

  // handler 之前先按公开 schema 校验：未知字段必须报错退回，不得静默吞掉。
  // 调用方据此拿到的"成功"是假的——它会按自己以为生效的参数去找产物。
  const args = params.args || {};
  const runId = createRunId(id);
  const issues = validateArgs(getSchema(id), args);
  if (issues.length > 0) {
    return withRunId(error('TOOL_ARGS_INVALID', argsErrorMessage(id, issues), {
      tool: id,
      issues,
      allowedArgs: Object.keys((getSchema(id) || {}).properties || {}),
    }), runId);
  }

  try {
    return withRunId(await caller.call(args, { ...(context || {}), runId, toolId: id }), runId);
  } catch (err) {
    return withRunId(error(err.code || 'TOOL_CALL_FAILED', err.message, errorDetails(err, id)), runId);
  }
}

function errorDetails(err, tool) {
  const details = err && err.details && typeof err.details === 'object' && !Array.isArray(err.details)
    ? err.details
    : {};
  return { ...details, tool };
}

module.exports = {
  dispatch,
  error,
};
