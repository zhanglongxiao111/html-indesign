#!/usr/bin/env node
const readline = require('node:readline');
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

async function handleRawRequest(raw) {
  let request;
  try {
    request = raw.trim() ? JSON.parse(raw) : {};
    const response = await dispatch(request);
    return JSON.stringify(isJsonRpcRequest(request) ? wrapJsonRpcResponse(request, response) : response);
  } catch (err) {
    return JSON.stringify(formatProcessError(err, request));
  }
}

async function runStdioSession() {
  process.stdin.setEncoding('utf8');
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    const out = await handleRawRequest(line);
    process.stdout.write(`${out}\n`);
  }
}

async function main() {
  if (process.argv.includes('--stdio-session')) {
    await runStdioSession();
    return;
  }
  const raw = await readStdin();
  const out = await handleRawRequest(raw);
  process.stdout.write(out);
}

main();
