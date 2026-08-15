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
    arg_names: ['package', 'strict', 'gridTolerance', 'outDir'],
    rank: 10,
    schema_size: 'small',
    callable: true,
    requires: [],
    // 失败时写出 authoring-lint-report.json（成功路径不产出）。
    side_effects: ['filesystem_write'],
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: true,
    preconditions: ['package 必须指向可读取的 deck.config.json。'],
    return_example: { status: 'complete', data: { ok: true, issueCount: 0 }, artifacts: [] },
    failure_example: {
      code: 'AUTHORING_LINT_FAILED',
      message: 'Strict authoring checks found 73 errors (GRID_ALIGNMENT_OFF: 73). '
        + 'All errors share code GRID_ALIGNMENT_OFF — this is one systemic cause, not 73 independent fixes. '
        + 'Affected: page-2 (27), page-3 (15), page-4 (31); edges top/left/right. '
        + 'First issue at page-2 / p2-el1: Item edges do not align to the declared authoring grid. '
        + 'Full report: <outDir>\\authoring-lint-report.json',
    },
  },
  {
    id: 'html.compile_instructions',
    domain: 'html',
    name: '编译 InDesign 指令',
    one_line_purpose: '把作者源码包编译成可由 InDesign executor 执行的 instructions.json。',
    arg_names: ['package', 'outDir', 'targetSize', 'unitMode', 'outputName'],
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
    failure_example: {
      code: 'INSTRUCTIONS_VALIDATION_FAILED',
      message: "Compiled instructions failed validation: Paragraph style 'body-copy' was not found; "
        + "Asset 'hero-image' file was not found.",
    },
  },
  {
    id: 'html.build_indesign',
    domain: 'html',
    name: '构建 InDesign 文件',
    one_line_purpose: '严格检查作者包，构建 INDD/PDF/IDML，并核对真实 InDesign 内容是否忠于 HTML。',
    arg_names: [
      'package', 'outDir', 'targetSize', 'unitMode', 'outputBaseName', 'mode',
      'exportPdf', 'exportIdml', 'timeout', 'gridTolerance',
    ],
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
    failure_example: {
      code: 'FIDELITY_GATE_FAILED',
      message: 'Built InDesign content differs from the HTML source at page page-2, item p2-el1, field fill; 3 issue(s) found.',
    },
  },
  {
    id: 'html.reverse_export',
    domain: 'html',
    name: 'InDesign 反向导出 HTML',
    one_line_purpose: '从 INDD 生成 reverse snapshot，再写出固定语义 HTML 作者包。',
    arg_names: [
      'indd', 'outDir', 'mode', 'assetPolicy', 'sourceRoot', 'nasPublicRoot',
      'reconstructionProfile', 'reconstruct', 'timeout',
    ],
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
    failure_example: {
      code: 'REVERSE_PIPELINE_FAILED',
      message: 'Reverse pipeline failed; refusing to report a successful export.',
    },
  },
];

const schemas = {
  'html.authoring_lint': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: { type: 'string', description: '作者源码包 deck.config.json，路径相对 context.cwd 或绝对路径。' },
      strict: {
        type: 'boolean',
        default: false,
        description: '开启严格检查后，网格偏移（GRID_ALIGNMENT_OFF）与未登记的语义 token（SEMANTIC_TOKEN_UNKNOWN，即样式/图层类'
          + '属性用了语义库词表之外的值）会被提升为 error；语义 token 缺失（SEMANTIC_TOKEN_MISSING，即角色靠内容推断、未显式标注）'
          + '始终只是 warning，不会被 strict 提升。html.build_indesign 内部固定 strict: true，即使本工具用默认参数报告通过，'
          + 'build 阶段仍可能因严格检查失败。',
      },
      gridTolerance: {
        type: 'number',
        default: 1,
        minimum: 0,
        description: '网格对齐容差，单位 mm；用于放宽 GRID_ALIGNMENT_OFF 的判定阈值，默认 1mm。',
      },
      outDir: {
        type: 'string',
        description: '检查失败时 authoring-lint-report.json 的写入目录，相对 CLI 调用时的工作目录解析，'
          + '且必须落在该工作目录内（否则报 OUTPUT_OUTSIDE_PROJECT）。省略时写入作者包根目录下的 .indesign-cli/。',
      },
    },
  },
  'html.compile_instructions': {
    type: 'object',
    additionalProperties: false,
    required: ['package'],
    properties: {
      package: {
        type: 'string',
        description: '作者源码包 deck.config.json。路径相对 CLI 调用时的工作目录（context.cwd，缺省回落进程 cwd）解析，也可传绝对路径。',
      },
      outDir: {
        type: 'string',
        description: '输出目录，默认写入 test/workspace/html-plugin-compile-<timestamp>。路径相对 CLI 调用时的工作目录（context.cwd）'
          + '解析，也可传绝对路径；必须落在该工作目录内，否则返回 OUTPUT_OUTSIDE_PROJECT。',
      },
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
      package: {
        type: 'string',
        description: '作者源码包 deck.config.json。路径相对 CLI 调用时的工作目录（context.cwd，缺省回落进程 cwd）解析，也可传绝对路径。',
      },
      outDir: {
        type: 'string',
        description: '输出目录，默认写入 test/workspace/html-plugin-build-<timestamp>。路径相对 CLI 调用时的工作目录（context.cwd）'
          + '解析，也可传绝对路径；必须落在该工作目录内，否则返回 OUTPUT_OUTSIDE_PROJECT。',
      },
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
      gridTolerance: {
        type: 'number',
        default: 1,
        minimum: 0,
        description: '网格对齐容差，单位 mm；用于放宽严格作者检查阶段 GRID_ALIGNMENT_OFF 的判定阈值，默认 1mm。',
      },
    },
  },
  'html.reverse_export': {
    type: 'object',
    additionalProperties: false,
    required: ['indd'],
    properties: {
      indd: {
        type: 'string',
        description: '待反向导出的 INDD 文件路径，路径相对 CLI 调用时的工作目录（context.cwd，缺省回落进程 cwd）解析，也可传绝对路径。',
      },
      outDir: {
        type: 'string',
        description: '输出目录，默认写入 test/workspace/html-plugin-reverse-<timestamp>。路径相对 CLI 调用时的工作目录（context.cwd）'
          + '解析，也可传绝对路径；必须落在该工作目录内，否则返回 OUTPUT_OUTSIDE_PROJECT。',
      },
      mode: { type: 'string', enum: ['structured', 'inferred', 'observation'], default: 'structured' },
      assetPolicy: { type: 'string', enum: ['reference', 'copy'], default: 'reference' },
      sourceRoot: {
        type: 'string',
        description: '可选的原作者包目录，用于源码回环辅助报告与语义预设（semanticPreset）来源；路径相对 CLI 调用时的工作目录'
          + '（context.cwd）解析，也可传绝对路径。mode 为 structured（默认）或 inferred 时需要 semanticProfile：若 INDD 是由 '
          + 'html.build_indesign 构建、其文档标签自带该信息则可省略，否则必须指定 sourceRoot（指向配置了 semanticPreset 的作者'
          + '包目录），缺失时首次调用会以 SEMANTIC_PRESET_LOAD_FAILED:profile-required 失败；仅 mode=observation 不需要。',
      },
      nasPublicRoot: {
        type: 'string',
        default: '/nas',
        description: '生成的作者/可视化 HTML 中，NAS 与 UNC 资源路径改写成的浏览器可访问 URL 前缀；这是一个 URL 前缀，不是文件系统'
          + '路径，不按 context.cwd 解析。默认 /nas。',
      },
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
