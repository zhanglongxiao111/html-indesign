// 每次工具调用的运行标识（runId）。
// 背景：#13 P1-2。报告目录反复覆盖、报告里没有运行标识，Agent 在 lint 明确失败后读到
// 上一轮遗留的 valid:true 报告并据此误判。宿主的 request_id 目前不下发给插件
// （mcp-indesign router.py 的 _plugin_context 只给 cwd/session_path/host_tools），
// 所以由插件在 dispatcher 入口自己生成，经 context 传给工具，工具写报告时写进顶层，
// dispatcher 再把同一个值盖到返回体上，Agent 拿它和报告逐字核对。
const { createRunId: createPrefixedRunId } = require('../shared');

const TOOL_PREFIXES = Object.freeze({
  'html.authoring_lint': 'lint',
  'html.compile_instructions': 'compile',
  'html.build_indesign': 'build',
  'html.reverse_export': 'reverse',
});

function createRunId(toolId) {
  return createPrefixedRunId(TOOL_PREFIXES[toolId] || 'run');
}

// dispatcher 之外直接调用工具（单测）时 context 里没有 runId，这里补一个，
// 保证报告顶层永远有 runId；经 dispatcher 的调用始终使用 dispatcher 生成的那一个。
function runIdOf(context, toolId) {
  return (context && context.runId) || createRunId(toolId);
}

// 同一个 runId 盖到三种返回形状上：complete → data，error → error.details（宿主只读
// details），requires_host_actions → state（resume 时由 state 带回）。
// 工具抛出未带 code 的异常时，返回体与 BUILD_FAILED.json 共用的兜底错误码。
const TOOL_CALL_FAILED = 'TOOL_CALL_FAILED';

function withRunId(response, runId) {
  if (!response || !runId) return response;
  if (response.status === 'complete') {
    return { ...response, data: { ...(response.data || {}), runId } };
  }
  if (response.status === 'error' && response.error) {
    return { ...response, error: { ...response.error, details: { ...(response.error.details || {}), runId } } };
  }
  if (response.status === 'requires_host_actions') {
    return { ...response, state: { ...(response.state || {}), runId } };
  }
  return response;
}

module.exports = {
  TOOL_CALL_FAILED,
  createRunId,
  runIdOf,
  withRunId,
};
