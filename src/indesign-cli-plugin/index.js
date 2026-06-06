#!/usr/bin/env node
const { dispatch } = require('./dispatcher');

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
  try {
    const raw = await readStdin();
    const request = raw.trim() ? JSON.parse(raw) : {};
    const response = await dispatch(request);
    process.stdout.write(JSON.stringify(response));
  } catch (err) {
    process.stdout.write(JSON.stringify({
      status: 'error',
      error: {
        code: 'PLUGIN_PROCESS_ERROR',
        message: err && err.message ? err.message : String(err),
      },
    }));
  }
}

main();
