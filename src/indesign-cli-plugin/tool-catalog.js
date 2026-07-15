const {
  CANONICAL_ALGORITHM_ORDER,
  DEFAULT_RECONSTRUCTION_PROFILE,
  RECONSTRUCTION_PROFILE_NAMES,
} = require('../semantic-reconstruction');

const tools = [
  {
    id: 'html.authoring_lint',
    domain: 'html',
    name: '作者包规则检查',
    one_line_purpose: '检查固定分页 HTML 作者源码包是否满足项目作者规范。',
    arg_names: ['package', 'strict'],
    rank: 10,
    schema_size: 'small',
    callable: true,
    requires: [],
    side_effects: [],
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: false,
    preconditions: ['package 必须指向可读取的 deck.config.json。'],
    return_example: { status: 'complete', data: { ok: true, issueCount: 0 }, artifacts: [] },
    failure_example: { code: 'AUTHORING_LINT_FAILED', message: 'Authoring lint reported errors.' },
  },
  {
    id: 'html.compile_instructions',
    domain: 'html',
    name: '编译 InDesign 指令',
    one_line_purpose: '把作者源码包编译成可由 InDesign executor 执行的 instructions.json。',
    arg_names: ['package', 'outDir', 'targetSize', 'unitMode'],
    rank: 20,
    schema_size: 'medium',
    callable: true,
    requires: [],
    side_effects: ['filesystem_write'],
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: true,
    preconditions: ['package 必须是已组装且可读取的作者源码包。'],
    return_example: {
      status: 'complete',
      data: { ok: true, pageCount: 1 },
      artifacts: [{ kind: 'json', path: 'test/workspace/html-plugin-compile/instructions.json' }],
    },
    failure_example: { code: 'INSTRUCTIONS_VALIDATION_FAILED', message: 'Compiled instructions failed validation.' },
  },
  {
    id: 'html.build_indesign',
    domain: 'html',
    name: '构建 InDesign 文件',
    one_line_purpose: '严格检查作者包，构建 INDD/PDF/IDML，并核对真实 InDesign 内容是否忠于 HTML。',
    arg_names: ['package', 'outDir', 'targetSize', 'unitMode', 'outputBaseName', 'mode'],
    rank: 30,
    schema_size: 'medium',
    callable: true,
    requires: ['script.run'],
    side_effects: ['filesystem_write', 'indesign_mutation'],
    artifact_kinds: ['indd', 'pdf', 'idml', 'json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: true,
    produces_artifacts: true,
    preconditions: ['package 必须通过严格作者检查。', '宿主必须允许 manifest 声明的 script.run 和 export.verify actions。'],
    return_example: {
      status: 'requires_host_actions',
      actions: [{ id: 'html-build-script', tool_id: 'script.run' }],
      resume: { method: 'tools/resume' },
    },
    failure_example: { code: 'FIDELITY_GATE_FAILED', message: 'Built InDesign content differs from the HTML source.' },
  },
  {
    id: 'html.reverse_export',
    domain: 'html',
    name: 'InDesign 反向导出 HTML',
    one_line_purpose: '从 INDD 生成 reverse snapshot，再写出固定语义 HTML 作者包。',
    arg_names: ['indd', 'outDir', 'mode', 'assetPolicy', 'reconstructionProfile', 'reconstruct'],
    rank: 40,
    schema_size: 'medium',
    callable: true,
    requires: ['script.run'],
    side_effects: ['filesystem_write', 'indesign_read'],
    artifact_kinds: ['html', 'json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: true,
    produces_artifacts: true,
    preconditions: ['indd 必须指向可读取的 InDesign 文档。', '宿主必须允许 script.run action。'],
    return_example: {
      status: 'requires_host_actions',
      actions: [{ id: 'html-reverse-snapshot', tool_id: 'script.run' }],
      resume: { method: 'tools/resume' },
    },
    failure_example: { code: 'REVERSE_PIPELINE_FAILED', message: 'Reverse pipeline failed.' },
  },
];

const schemas = {
  'html.authoring_lint': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json，路径相对 context.cwd 或绝对路径。' },
      strict: { type: 'boolean', default: false, description: '开启严格检查，把网格偏移和语义 token 缺失作为错误。' },
    },
  },
  'html.compile_instructions': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json。' },
      outDir: { type: 'string', description: '输出目录，默认写入 test/workspace/html-plugin-compile-<timestamp>。' },
      targetSize: { type: 'string', default: 'same', description: '页面目标尺寸，例如 same、qhd、2048x1152。' },
      unitMode: { type: 'string', enum: ['presentation', 'print'], default: 'presentation' },
      outputName: { type: 'string', default: 'instructions.json' },
    },
  },
  'html.build_indesign': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json。' },
      outDir: { type: 'string', description: '输出目录，默认写入 test/workspace/html-plugin-build-<timestamp>。' },
      targetSize: { type: 'string', default: 'same' },
      unitMode: { type: 'string', enum: ['presentation', 'print'], default: 'presentation' },
      outputBaseName: { type: 'string', default: 'html-indesign-output' },
      mode: {
        type: 'string',
        enum: ['final', 'draft'],
        default: 'final',
        description: 'final 会核对真实 InDesign 内容后才导出；draft 跳过该核对，结果明确标记为未验证，不能作为交付成品。',
      },
      exportPdf: { type: 'boolean', default: true },
      exportIdml: { type: 'boolean', default: true },
      timeout: { type: 'integer', default: 300, minimum: 1 },
    },
  },
  'html.reverse_export': {
    type: 'object',
    additionalProperties: false,
    required: ['indd'],
    properties: {
      indd: { type: 'string', description: '待反向导出的 INDD 文件路径。' },
      outDir: { type: 'string', description: '输出目录，默认写入 test/workspace/html-plugin-reverse-<timestamp>。' },
      mode: { type: 'string', enum: ['structured', 'inferred', 'observation'], default: 'structured' },
      assetPolicy: { type: 'string', enum: ['reference', 'copy'], default: 'reference' },
      sourceRoot: { type: 'string', description: '可选的原作者包目录，用于源码回环辅助报告。' },
      nasPublicRoot: { type: 'string', default: '/nas' },
      reconstructionProfile: {
        type: 'string',
        enum: [...RECONSTRUCTION_PROFILE_NAMES],
        default: DEFAULT_RECONSTRUCTION_PROFILE,
      },
      reconstruct: {
        type: 'array',
        items: {
          type: 'string',
          enum: [...CANONICAL_ALGORITHM_ORDER],
        },
        description: '仅 experimental profile 可用的显式算法列表。',
      },
      timeout: { type: 'integer', default: 300, minimum: 1 },
    },
  },
};

function listTools() {
  return tools.map((tool) => ({ ...tool }));
}

function getTool(id) {
  return tools.find((tool) => tool.id === id) || null;
}

function getSchema(id) {
  return schemas[id] || null;
}

module.exports = {
  listTools,
  getTool,
  getSchema,
};
