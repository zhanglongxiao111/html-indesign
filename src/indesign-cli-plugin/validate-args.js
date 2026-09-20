// 工具参数在进入 handler 之前按 tool-catalog 的 inputSchema 校验。
// 背景：dispatcher 过去把 params.args 原样递给 handler，schema 之外的键被静默忽略——
// Agent 传一个工具不认的参数（拼错、或臆造出来的 reportPath），调用照样返回成功，
// 直到它去读那个根本没人写过的目录才发现不对。2026-08-25 起遥测 67 次。
// 只覆盖 tool-catalog 实际用到的 JSON Schema 子集（type / enum / required /
// additionalProperties / minimum / maximum / items），不引入校验库：本仓运行期依赖
// 只有 cheerio、playwright、reveal.js，为四个 schema 加一个 ajv 不划算。
const TYPE_CHECKS = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  integer: (value) => typeof value === 'number' && Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value),
  object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
};

function validateArgs(schema, args) {
  // 没有 schema 就无从校验；照旧放行，不要凭空造出一个"未知工具"错误。
  if (!schema || typeof schema !== 'object') return [];
  const issues = [];
  const value = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  const properties = schema.properties || {};
  const known = Object.keys(properties);

  for (const name of schema.required || []) {
    if (value[name] === undefined) {
      issues.push({
        code: 'MISSING_REQUIRED_ARG',
        arg: name,
        message: `缺少必填参数 \`${name}\`。`,
      });
    }
  }

  if (schema.additionalProperties === false) {
    for (const name of Object.keys(value)) {
      if (Object.prototype.hasOwnProperty.call(properties, name)) continue;
      const suggestion = nearestName(name, known);
      issues.push({
        code: 'UNKNOWN_ARG',
        arg: name,
        ...(suggestion ? { didYouMean: suggestion } : {}),
        message: `本工具不接受参数 \`${name}\`${suggestion ? `，是否想写 \`${suggestion}\`？` : '。'}`
          + `传进来的未知参数不会有任何效果——不要据此推断它已生效。可用参数：${known.join('、')}。`,
      });
    }
  }

  for (const [name, spec] of Object.entries(properties)) {
    if (value[name] === undefined) continue;
    issues.push(...validateValue(value[name], spec, name));
  }

  return issues;
}

function validateValue(value, spec, argPath) {
  if (!spec || typeof spec !== 'object') return [];
  const issues = [];
  const check = TYPE_CHECKS[spec.type];

  if (check && !check(value)) {
    return [{
      code: 'ARG_TYPE_MISMATCH',
      arg: argPath,
      expected: spec.type,
      actual: actualTypeName(value),
      message: `参数 \`${argPath}\` 应为 ${spec.type}，实际收到 ${actualTypeName(value)}。`,
    }];
  }

  if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
    issues.push({
      code: 'ARG_NOT_IN_ENUM',
      arg: argPath,
      allowed: [...spec.enum],
      actual: value,
      message: `参数 \`${argPath}\` 只接受 ${spec.enum.map((item) => `\`${item}\``).join('、')}，实际收到 \`${value}\`。`,
    });
  }

  if (typeof value === 'number') {
    if (typeof spec.minimum === 'number' && value < spec.minimum) {
      issues.push({
        code: 'ARG_OUT_OF_RANGE',
        arg: argPath,
        minimum: spec.minimum,
        actual: value,
        message: `参数 \`${argPath}\` 不得小于 ${spec.minimum}，实际收到 ${value}。`,
      });
    }
    if (typeof spec.maximum === 'number' && value > spec.maximum) {
      issues.push({
        code: 'ARG_OUT_OF_RANGE',
        arg: argPath,
        maximum: spec.maximum,
        actual: value,
        message: `参数 \`${argPath}\` 不得大于 ${spec.maximum}，实际收到 ${value}。`,
      });
    }
  }

  if (spec.type === 'array' && spec.items && Array.isArray(value)) {
    value.forEach((entry, index) => {
      issues.push(...validateValue(entry, spec.items, `${argPath}[${index}]`));
    });
  }

  return issues;
}

function actualTypeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// 参数名写错时直接把最接近的候选给出来，Agent 才能一轮自纠而不是逐个试。
// 先按大小写不敏感命中，再退到编辑距离（阈值随名字长度放宽，但不超过 3）。
function nearestName(name, candidates) {
  const lowered = String(name).toLowerCase();
  const exact = candidates.find((candidate) => candidate.toLowerCase() === lowered);
  if (exact) return exact;

  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(lowered, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  const limit = Math.min(3, Math.floor(lowered.length / 2) || 1);
  return best && bestDistance <= limit ? best : null;
}

function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_unused, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[cols - 1];
}

// 把逐条 issue 收成一句可直接读的话：首条说清楚，其余给计数，完整清单在 details.issues。
function argsErrorMessage(toolId, issues) {
  const first = issues[0];
  const rest = issues.length - 1;
  return `${toolId} 的参数未通过 schema 校验：${first.message}`
    + (rest > 0 ? `（另有 ${rest} 处，见 error.details.issues）` : '');
}

module.exports = {
  validateArgs,
  argsErrorMessage,
};
