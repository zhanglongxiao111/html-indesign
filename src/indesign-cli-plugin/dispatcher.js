const { listTools, getTool, getSchema } = require('./tool-catalog');

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
    return error('TOOL_NOT_IMPLEMENTED', `Tool call is not implemented yet: ${params.id}`);
  }

  if (method === 'tools/resume') {
    return error('RESUME_NOT_IMPLEMENTED', 'tools/resume is not implemented yet');
  }

  return error('METHOD_NOT_FOUND', `Unknown plugin method: ${method}`);
}

module.exports = {
  dispatch,
  error,
};
