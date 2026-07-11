const cheerio = require('cheerio');
const { isRemoteReference } = require('../shared/assets');

const ISSUE_DEFINITIONS = Object.freeze({
  AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN: 'Executable scripts must be rendered to static authoring HTML before conversion.',
  AUTHOR_CANVAS_FORBIDDEN: 'Canvas content must be converted to static SVG or native HTML before conversion.',
  AUTHOR_REMOTE_RUNTIME_SCRIPT_FORBIDDEN: 'Remote runtime scripts are not allowed in a static authoring package.',
  AUTHOR_REMOTE_STYLESHEET_FORBIDDEN: 'Remote stylesheets are not allowed in a static authoring package.',
});

function auditStaticAuthoringRuntime(html, options = {}) {
  const strict = options.strict === true;
  const findings = [];
  const $ = cheerio.load(String(html || ''), {
    decodeEntities: false,
    xmlMode: false,
  });

  $('canvas, script, link').each((index, element) => {
    const node = $(element);
    const tagName = String(element.name || '').toLowerCase();
    if (tagName === 'canvas') {
      findings.push(runtimeIssue('AUTHOR_CANVAS_FORBIDDEN', options.file, { tagName }));
      return;
    }

    if (tagName === 'script') {
      const type = String(node.attr('type') || '').trim().toLowerCase();
      if (type === 'application/json') return;
      if (!isExecutableScriptType(type)) return;
      const src = String(node.attr('src') || '').trim();
      const code = isRemoteReference(src) || /^\/\//.test(src)
        ? 'AUTHOR_REMOTE_RUNTIME_SCRIPT_FORBIDDEN'
        : 'AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN';
      findings.push(runtimeIssue(code, options.file, {
        tagName,
        ...(type ? { type } : {}),
        ...(src ? { src } : {}),
      }));
      return;
    }

    const rel = String(node.attr('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
    const href = String(node.attr('href') || '').trim();
    if (rel.includes('stylesheet') && (isRemoteReference(href) || /^\/\//.test(href))) {
      findings.push(runtimeIssue('AUTHOR_REMOTE_STYLESHEET_FORBIDDEN', options.file, {
        tagName,
        href,
      }));
    }
  });

  const errors = strict
    ? findings.map((finding) => ({ ...finding, level: 'error' }))
    : [];
  const warnings = strict
    ? []
    : findings.map((finding) => ({ ...finding, level: 'warning' }));
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    messages: errors.concat(warnings),
  };
}

function isExecutableScriptType(type) {
  if (!type) return true;
  return type === 'module'
    || /^(?:application|text)\/(?:javascript|ecmascript)$/.test(type);
}

function runtimeIssue(code, file, extra) {
  return {
    level: 'warning',
    code,
    message: ISSUE_DEFINITIONS[code],
    ...(file ? { file } : {}),
    ...extra,
  };
}

module.exports = {
  ISSUE_DEFINITIONS,
  auditStaticAuthoringRuntime,
};
