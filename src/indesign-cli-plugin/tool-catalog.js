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
    side_effects: 'none',
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: false,
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
    side_effects: 'writes_artifacts',
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: true,
  },
  {
    id: 'html.build_indesign',
    domain: 'html',
    name: '构建 InDesign 文件',
    one_line_purpose: '把作者源码包构建为 INDD/PDF/IDML，真实 InDesign 执行由 host action 完成。',
    arg_names: ['package', 'outDir', 'targetSize', 'unitMode', 'outputBaseName'],
    rank: 30,
    schema_size: 'medium',
    callable: true,
    requires: ['script.run'],
    side_effects: 'writes_artifacts',
    artifact_kinds: ['indd', 'pdf', 'idml', 'json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: true,
    produces_artifacts: true,
  },
  {
    id: 'html.reverse_export',
    domain: 'html',
    name: 'InDesign 反向导出 HTML',
    one_line_purpose: '从 INDD 生成 reverse snapshot，再写出固定语义 HTML 作者包。',
    arg_names: ['indd', 'outDir', 'mode', 'assetPolicy'],
    rank: 40,
    schema_size: 'medium',
    callable: true,
    requires: ['script.run'],
    side_effects: 'writes_artifacts',
    artifact_kinds: ['html', 'json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: true,
    produces_artifacts: true,
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
