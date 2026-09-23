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
    arg_names: ['package', 'strict', 'gridTolerance', 'outDir', 'format'],
    rank: 10,
    schema_size: 'small',
    callable: true,
    requires: [],
    // 写出 authoring-lint-report.json：format:"summary"（默认）时总是写；format:"full" 时失败必写，
    // 通过时只在显式传了 outDir 或该位置已有旧报告时才写。
    side_effects: ['filesystem_write'],
    artifact_kinds: ['json'],
    destructive: false,
    target_scope: 'project',
    needs_indesign: false,
    produces_artifacts: true,
    preconditions: ['package 必须指向可读取的 deck.config.json。'],
    // 不声明的话，宿主会按 side_effects 含 filesystem_write 自动追加
    // "Run indesign-cli export verify"——本工具产出的是 JSON 报告，不是可校验的成品。
    common_next_steps: [
      '默认返回摘要（format:"summary"）：先看首条消息、topCodes 与 firstErrors，按 code 分类看分布，不要逐条改；'
        + '完整清单在 reportPath 指向的报告里，读之前核对报告顶层 runId 与返回体一致。',
      '同一 code 高度集中时是单一系统性成因：先看首条消息里的 Fix examples 与每条的 edgeOffsets/suggestedFix；'
        + 'GRID_ALIGNMENT_OFF 量的是承担网格放置的块（grid-item / --grid-col 的元素），'
        + '块内内容不查，改由承担放置的块负责；没有放置祖先的条目仍逐条量，'
        + '所以通常是块本身没坐在网格上或网格声明与 CSS 不符。gridTolerance 只用于确认版式正确后的取整误差。',
      '通过后再调用 html.build_indesign；本工具默认 strict:false，而 build 内部固定 strict:true。',
    ],
    // 默认 summary 形态；不传 outDir 时报告落在作者包根目录下的 .indesign-cli/。
    return_example: {
      status: 'complete',
      data: {
        ok: true,
        format: 'summary',
        errorCount: 0,
        warningCount: 2,
        topCodes: [{ code: 'SEMANTIC_TOKEN_MISSING', level: 'warning', count: 2 }],
        firstErrors: [],
        reportPath: '<outDir>\\authoring-lint-report.json',
        runId: 'lint-20260924T081500-3fa9c1',
      },
      artifacts: [{ kind: 'json', path: '<outDir>\\authoring-lint-report.json' }],
    },
    failure_example: {
      code: 'AUTHORING_LINT_FAILED',
      message: 'Strict authoring checks found 12 errors (GRID_ALIGNMENT_OFF: 12). '
        + 'All 12 errors share code GRID_ALIGNMENT_OFF — this is one systemic cause, not 12 independent fixes. '
        + 'Affected: page-2 (7), page-3 (5); edges left/top. '
        + 'First issue at page-2 / p2-el1: Item edges do not align to the declared authoring grid: left at 13mm is 3mm right of the column line at 10mm. '
        // 三条示例 + 未列出的条数：与 lint-feedback 的 fixExamplesSentence 一致（上限 3 条，
        // 12 条错误就还剩 9 条）。只写一条会让人以为首条消息只给一条修法。
        + 'Fix examples: page-2 / p2-el1: Move #p2-el1 left edge to 10mm (-3mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked. '
        + '| page-2 / p2-el4: Move #p2-el4 top edge to 41mm (+2mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked. '
        + '| page-3 / p3-el1: Move #p3-el1 left edge to 10mm (-1.5mm), or place it with --grid-col/--grid-row so the block itself sits on the grid; content inside a placed block is not checked. '
        + '(+9 more: errors[].suggestedFix in the full report) '
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
    // 产出 instructions.json，不是 PDF/IDML；对它跑 export verify 没有意义。
    common_next_steps: [
      '校验失败时读 error.details.validation，按 pageId/itemId 定位到具体元素再改。',
      '成功后把 instructions.json 交给 html.build_indesign，不要对它运行 export verify。',
    ],
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
      'exportPdf', 'exportIdml', 'timeout', 'gridTolerance', 'format',
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
    // mode:'final' 时内部已经调过 export.verify，宿主自动追加的"再跑一次"是误导。
    common_next_steps: [
      '失败时先看 error.details.stage 决定重跑范围：lint/compile 阶段改作者源码即可，无需重开 InDesign。',
      'lint 阶段失败默认只回摘要（topCodes、firstErrors），完整清单读 error.details.reportPath；'
        + '读 outDir 里的任何报告前先核对报告顶层 runId 与 error.details.runId / data.runId 一致，'
        + 'status 为 not-produced 表示本次没走到那一步。',
      'stage 为 fidelity 时读 forward-fidelity-report.json，按报告命名的页/对象/字段改源码，不要用相同输入重试。',
      '导出阶段失败时看 details.partialArtifacts：INDD 可能已经落盘，不必重走整条链路。',
      'mode 为 final 时本工具内部已执行 export.verify，无需再手动运行一次。',
    ],
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
    // 产出 HTML 作者包，不是 PDF/IDML；对它跑 export verify 没有意义。
    common_next_steps: [
      'structured 模式要求语义 profile：源 INDD 若非由带 profile 的正向构建产生，必须传 sourceRoot 指向配置了 semanticPreset 的作者包目录，否则报 SEMANTIC_PRESET_LOAD_FAILED。',
      '失败时读 details.reportPath 指向的 report.json，按其中命名的页/对象定位。',
      '产出的是 HTML 作者包，不要对它运行 export verify；要回到 InDesign 请接 html.build_indesign。',
    ],
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

// html.authoring_lint 与 html.build_indesign 共用（#13 P1-1）。
const LINT_FORMAT_ARG = Object.freeze({
  type: 'string',
  enum: ['summary', 'full'],
  default: 'summary',
  description: 'lint 结果的返回形态。summary（默认）只回 ok、errorCount、warningCount、topCodes、firstErrors（前 3 条）、'
    + 'reportPath 与 runId，完整的 errors/warnings/normalized/messages 只写进 authoring-lint-report.json；'
    + 'full 在返回体里带完整数组（体积可达数十 KB）。',
});

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
        description: '网格对齐容差，单位 mm，默认 1mm。GRID_ALIGNMENT_OFF 量的是承担网格放置的块（grid-item / --grid-col 元素），'
          + '块内内容不查，改由承担放置的块负责；没有放置祖先的条目仍逐条量。'
          + '条目自带 edgeOffsets 与 suggestedFix。放宽容差只用于确认版式正确后的取整误差，不要用它盖住真实偏差。',
      },
      outDir: {
        type: 'string',
        description: 'authoring-lint-report.json 的写入目录，相对 CLI 调用时的工作目录解析，'
          + '且必须落在该工作目录内（否则报 OUTPUT_OUTSIDE_PROJECT）。显式传入时，检查通过与失败都会写报告，'
          + '路径同时回在 data.reportPath / error.details.reportPath 与 artifacts 上；'
          + '省略时落到作者包根目录下的 .indesign-cli/（format:"full" 且检查通过时不新建该文件）。',
      },
      format: {
        ...LINT_FORMAT_ARG,
        description: `${LINT_FORMAT_ARG.description}报告一定会写：省略 outDir 时写到作者包根目录下的 .indesign-cli/。`,
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
        description: '网格对齐容差，单位 mm，默认 1mm。GRID_ALIGNMENT_OFF 量的是承担网格放置的块（grid-item / --grid-col 元素），'
          + '块内内容不查，改由承担放置的块负责；没有放置祖先的条目仍逐条量。'
          + '条目自带 edgeOffsets 与 suggestedFix。放宽容差只用于确认版式正确后的取整误差，不要用它盖住真实偏差。',
      },
      format: {
        ...LINT_FORMAT_ARG,
        description: `只影响 lint 阶段失败时的返回体。${LINT_FORMAT_ARG.description}`
          + '报告写在 outDir（省略 outDir 时写到作者包根目录下的 .indesign-cli/）。',
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
