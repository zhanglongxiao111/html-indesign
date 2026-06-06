const { listTools, getTool, getSchema } = require('./tool-catalog');
const authoringLint = require('./tools/authoring-lint');
const compileInstructionsTool = require('./tools/compile-instructions');
const buildIndesign = require('./tools/build-indesign');
const reverseExport = require('./tools/reverse-export');

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

async function dispatch(request) {
  const method = request && request.method;
  const params = (request && request.params) || {};

  if (method === 'plugin/handshake') {
    const tools = listTools();
    return {
      protocol: 'indesign-cli-plugin.v1',
      plugin: {
        id: 'html-indesign',
        name: 'html-indesign',
        version: '0.1.0',
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
    const tool = getTool(params.id);
    const inputSchema = getSchema(params.id);
    if (!tool || !inputSchema) {
      return error('TOOL_NOT_FOUND', `Unknown html-indesign tool: ${params.id}`);
    }
    return {
      tool: { id: tool.id, name: tool.name },
      inputSchema,
    };
  }

  if (method === 'tools/call') {
    return await callTool(params, request.context || {});
  }

  if (method === 'tools/resume') {
    return await resumeTool(params);
  }

  return error('METHOD_NOT_FOUND', `Unknown plugin method: ${method}`);
}

async function resumeTool(params) {
  const state = params.state || {};
  const caller = callers[state.tool_id];
  if (!caller || typeof caller.resume !== 'function') {
    return error('RESUME_TOOL_NOT_FOUND', `No resume handler for tool: ${state.tool_id}`);
  }

  try {
    return await caller.resume(params);
  } catch (err) {
    return error(err.code || 'TOOL_RESUME_FAILED', err.message, { tool: state.tool_id });
  }
}

async function callTool(params, context) {
  const tool = getTool(params.id);
  if (!tool) {
    return error('TOOL_NOT_FOUND', `Unknown html-indesign tool: ${params.id}`);
  }

  const caller = callers[params.id];
  if (!caller || typeof caller.call !== 'function') {
    return error('TOOL_NOT_IMPLEMENTED', `Tool call is not implemented yet: ${params.id}`);
  }

  try {
    return await caller.call(params.args || {}, context || {});
  } catch (err) {
    return error(err.code || 'TOOL_CALL_FAILED', err.message, { tool: params.id });
  }
}

module.exports = {
  dispatch,
  error,
};
