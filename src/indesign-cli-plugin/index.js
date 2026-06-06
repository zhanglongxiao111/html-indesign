#!/usr/bin/env node
const { dispatch } = require('./dispatcher');

function isJsonRpcRequest(request) {
  return Boolean(request && (request.jsonrpc || Object.prototype.hasOwnProperty.call(request, 'id')));
}

function jsonRpcId(request) {
  return request && Object.prototype.hasOwnProperty.call(request, 'id') ? request.id : null;
}

function wrapJsonRpcResponse(request, response) {
  if (response && response.status === 'error' && response.error) {
    return {
      jsonrpc: '2.0',
      id: jsonRpcId(request),
      error: response.error,
    };
  }

  return {
    jsonrpc: '2.0',
    id: jsonRpcId(request),
    result: response || {},
  };
}

function formatProcessError(err, request) {
  const error = {
    code: 'PLUGIN_PROCESS_ERROR',
    message: err && err.message ? err.message : String(err),
  };

  if (isJsonRpcRequest(request)) {
    return {
      jsonrpc: '2.0',
      id: jsonRpcId(request),
      error,
    };
  }

  return {
    status: 'error',
    error,
  };
}

async function readStdin() {
  return await new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

async function main() {
  let request;
  try {
    const raw = await readStdin();
    request = raw.trim() ? JSON.parse(raw) : {};
    const response = await dispatch(request);
    process.stdout.write(JSON.stringify(isJsonRpcRequest(request) ? wrapJsonRpcResponse(request, response) : response));
  } catch (err) {
    process.stdout.write(JSON.stringify(formatProcessError(err, request)));
  }
}

main();
