const assert = require('node:assert/strict');
const { test } = require('node:test');
const dispatcher = require('../../src/indesign-cli-plugin/dispatcher');
const reverseExport = require('../../src/indesign-cli-plugin/tools/reverse-export');

test('tools/resume forwards the request context to the tool resume handler', async () => {
  const originalResume = reverseExport.resume;
  let capturedArgs = null;
  reverseExport.resume = async (params, context) => {
    capturedArgs = { params, context };
    return { status: 'complete', data: { ok: true } };
  };

  try {
    const context = { cwd: 'Z:\\fake\\project\\root' };
    const response = await dispatcher.dispatch({
      method: 'tools/resume',
      params: { state: { tool_id: 'html.reverse_export' } },
      context,
    });

    assert.equal(response.status, 'complete');
    assert.ok(capturedArgs, 'reverseExport.resume must have been called');
    assert.deepEqual(capturedArgs.context, context);
  } finally {
    reverseExport.resume = originalResume;
  }
});

test('tools/resume falls back to params.context when request.context is absent', async () => {
  const originalResume = reverseExport.resume;
  let capturedContext = null;
  reverseExport.resume = async (params, context) => {
    capturedContext = context;
    return { status: 'complete', data: { ok: true } };
  };

  try {
    const context = { cwd: 'Z:\\another\\project' };
    const response = await dispatcher.dispatch({
      method: 'tools/resume',
      params: { state: { tool_id: 'html.reverse_export' }, context },
    });

    assert.equal(response.status, 'complete');
    assert.deepEqual(capturedContext, context);
  } finally {
    reverseExport.resume = originalResume;
  }
});

test('tools/resume passes an empty object when no context is available anywhere', async () => {
  const originalResume = reverseExport.resume;
  let capturedContext = 'unset';
  reverseExport.resume = async (params, context) => {
    capturedContext = context;
    return { status: 'complete', data: { ok: true } };
  };

  try {
    const response = await dispatcher.dispatch({
      method: 'tools/resume',
      params: { state: { tool_id: 'html.reverse_export' } },
    });

    assert.equal(response.status, 'complete');
    assert.deepEqual(capturedContext, {});
  } finally {
    reverseExport.resume = originalResume;
  }
});
