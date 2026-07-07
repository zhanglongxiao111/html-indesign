const fs = require('node:fs');
const path = require('node:path');

const {
  FORMATS,
  capabilityFor,
  fieldRegistry: defaultFieldRegistry,
} = require('..');

const SECTION_ORDER = Object.freeze([
  'canonical',
  'sourceMetadata',
  'formatExtension',
  'observation',
  'retired',
]);

function generateFieldDocsMarkdown(fieldRegistry) {
  assertRegistry(fieldRegistry);

  const lines = [
    '# 协议字段注册表',
    '',
    '本文件由 `src/protocol/docs/generate-field-docs.js` 从协议字段注册表和能力矩阵生成。',
    '字段事实以 registry 为准；本文件只记录生成结果，不维护第二份字段清单。',
    '分节名对应 `fieldClass`，`retired` 分节按 `lifecycle=retired` 收拢退役字段。',
    '',
  ];

  const entriesBySection = groupEntries(fieldRegistry.entries);
  for (const section of SECTION_ORDER) {
    const sectionNotes = [];

    lines.push(`## ${section}`);
    lines.push('');
    lines.push(tableHeader());

    for (const entry of entriesBySection.get(section) || []) {
      lines.push(tableRow(fieldRegistry, entry));
      for (const note of notesFor(entry)) {
        sectionNotes.push(note);
      }
    }

    if (sectionNotes.length > 0) {
      lines.push('');
      lines.push('退役 HTML 属性：');
      for (const note of sectionNotes) {
        lines.push(`- ${note}`);
      }
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function groupEntries(entries) {
  const sections = new Map(SECTION_ORDER.map((section) => [section, []]));

  for (const entry of entries) {
    const section = entry.lifecycle === 'retired' ? 'retired' : entry.fieldClass;
    if (!sections.has(section)) {
      throw new Error(`FIELD_REGISTRY_DOCS_SECTION_UNSUPPORTED:${section}`);
    }
    sections.get(section).push(entry);
  }

  for (const sectionEntries of sections.values()) {
    sectionEntries.sort(compareEntries);
  }

  return sections;
}

function compareEntries(left, right) {
  return left.canonicalPath.localeCompare(right.canonicalPath, 'en');
}

function tableHeader() {
  return [
    '| canonicalPath | currentPaths | owner | lifecycle | HTML read/write/persist | InDesign read/write/persist | PPTX read/write/persist | notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ].join('\n');
}

function tableRow(registry, entry) {
  return [
    entry.canonicalPath,
    entry.currentPaths.length > 0 ? entry.currentPaths.join(', ') : 'n/a',
    entry.owner,
    entry.lifecycle,
    capabilityCell(registry, entry, 'html'),
    capabilityCell(registry, entry, 'indesign'),
    capabilityCell(registry, entry, 'pptx'),
    rowNotes(entry),
  ].map(escapeTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |');
}

function capabilityCell(registry, entry, format) {
  if (!FORMATS.includes(format)) {
    throw new Error(`CAPABILITY_FORMAT_INVALID:${format}`);
  }

  const capability = capabilityFor(registry, entry.canonicalPath, format);
  const level = `${capability.read}/${capability.write}/${capability.persist}`;
  const metadata = [];

  if (capability.fallbackKind) {
    metadata.push(`fallbackKind=${capability.fallbackKind}`);
  }
  if (capability.risk) {
    metadata.push(`risk=${capability.risk}`);
  }

  return metadata.length > 0 ? `${level} (${metadata.join('; ')})` : level;
}

function notesFor(entry) {
  const notes = [];
  const retiredHtmlAttrs = entry.retired && entry.retired.htmlAttrs;
  const retiredModelPaths = entry.retired && entry.retired.modelPaths;

  if (Array.isArray(retiredHtmlAttrs)) {
    for (const retiredAttr of retiredHtmlAttrs) {
      const parts = [
        `retiredHtmlAttr=${retiredAttr.name}`,
        `readPolicy=${retiredAttr.readPolicy}`,
        `writePolicy=${retiredAttr.writePolicy}`,
      ];

      if (retiredAttr.replacedBy) {
        parts.push(`replacedBy=${retiredAttr.replacedBy}`);
      }
      if (retiredAttr.reason) {
        parts.push(`reason=${retiredAttr.reason}`);
      }

      notes.push(parts.join('; '));
    }
  }

  if (Array.isArray(retiredModelPaths)) {
    for (const retiredPath of retiredModelPaths) {
      const parts = [
        `retiredModelPath=${retiredPath.path}`,
        `readPolicy=${retiredPath.readPolicy}`,
      ];

      if (retiredPath.replacedBy) {
        parts.push(`replacedBy=${retiredPath.replacedBy}`);
      }
      if (retiredPath.reason) {
        parts.push(`reason=${retiredPath.reason}`);
      }

      notes.push(parts.join('; '));
    }
  }

  return notes;
}

function rowNotes(entry) {
  const notes = [];

  if (entry.description) {
    notes.push(entry.description);
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'defaultValue')) {
    notes.push(`default=${formatValue(entry.defaultValue)}`);
  }
  if (Array.isArray(entry.allowedKeys) && entry.allowedKeys.length > 0) {
    notes.push(`allowedKeys=${entry.allowedKeys.join(', ')}`);
  }
  if (entry.contract && typeof entry.contract === 'object' && !Array.isArray(entry.contract)) {
    notes.push(`contract=${Object.entries(entry.contract).map(([key, value]) => `${key}:${formatValue(value)}`).join(', ')}`);
  }
  if (entry.migration && typeof entry.migration === 'object' && !Array.isArray(entry.migration)) {
    const from = entry.migration.from || 'n/a';
    const to = entry.migration.to || 'n/a';
    const status = entry.migration.status ? ` (${entry.migration.status})` : '';
    notes.push(`migration=${from} -> ${to}${status}`);
  }

  return notes.length > 0 ? notes.join('; ') : 'n/a';
}

function formatValue(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

function assertRegistry(registry) {
  if (
    !registry
    || typeof registry !== 'object'
    || Array.isArray(registry)
    || !Array.isArray(registry.entries)
    || typeof registry.getByPath !== 'function'
  ) {
    throw new Error('FIELD_REGISTRY_DOCS_INVALID_REGISTRY');
  }
}

function runCli(argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex === -1 || !argv[outIndex + 1]) {
    throw new Error('FIELD_REGISTRY_DOCS_OUT_REQUIRED');
  }

  const outPath = path.resolve(argv[outIndex + 1]);
  fs.writeFileSync(outPath, generateFieldDocsMarkdown(defaultFieldRegistry), 'utf8');
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  generateFieldDocsMarkdown,
};
