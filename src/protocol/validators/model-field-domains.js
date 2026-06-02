const MODEL_FIELD_DOMAIN_NAMES = Object.freeze([
  'asset.placement',
  'source.metadata',
  'styleRefs',
  'labels',
  'visualStyle.vectorGeometry',
  'table.text',
]);

const MODEL_FIELD_DOMAIN_ALIASES = Object.freeze({
  'asset-placement': 'asset.placement',
  sourceMetadata: 'source.metadata',
  'source metadata': 'source.metadata',
  'style-refs': 'styleRefs',
  'visualStyle/vectorGeometry': 'visualStyle.vectorGeometry',
  'visual-style.vector-geometry': 'visualStyle.vectorGeometry',
  'table/text': 'table.text',
});

const SOURCE_METADATA_PATHS = new Set([
  'document.sourcePackage',
  'sourcePackage',
  'labels[].sourcePackage',
  'items[].sourceFile',
  'pages[].sourceFile',
  'labels[].sourceFile',
  'effectiveLabel.sourceFile',
  'pages[].effectiveLabel.sourceFile',
  'items[].sourceNode',
  'pages[].sourceNode',
  'labels[].sourceNode',
  'effectiveLabel.sourceNode',
  'pages[].effectiveLabel.sourceNode',
  'items[].sourceAncestorNodes',
  'labels[].sourceAncestorNodes',
  'effectiveLabel.sourceAncestorNodes',
  'pages[].effectiveLabel.sourceAncestorNodes',
  'items[].sourceText',
  'labels[].sourceText',
  'effectiveLabel.sourceText',
  'pages[].effectiveLabel.sourceText',
  'items[].sourceHtml',
  'labels[].sourceHtml',
  'effectiveLabel.sourceHtml',
  'pages[].effectiveLabel.sourceHtml',
  'items[].content.sourceHtml',
  'items[].sourceRuns',
  'labels[].sourceRuns',
  'effectiveLabel.sourceRuns',
  'pages[].effectiveLabel.sourceRuns',
  'items[].structure',
  'labels[].structure',
  'effectiveLabel.structure',
  'pages[].effectiveLabel.structure',
]);

const LABEL_DOMAIN_PATHS = new Set([
  'document.title',
  'document.profile',
  'document.sourcePackage',
  'document.unitMode',
  'document.coordinateUnit',
  'parentPages[].provides',
]);

const DOMAIN_DEFINITIONS = Object.freeze({
  'asset.placement': Object.freeze({
    owners: new Set(['asset-placement']),
    prefixes: ['items[].asset.placement.'],
  }),
  'source.metadata': Object.freeze({
    paths: SOURCE_METADATA_PATHS,
    prefixes: childPrefixes(SOURCE_METADATA_PATHS),
  }),
  styleRefs: Object.freeze({
    owners: new Set(['style-refs']),
    prefixes: [
      'items[].styleRefs.',
      'labels[].styleRefs.',
      'items[].effectiveLabel.styleRefs.',
    ],
  }),
  labels: Object.freeze({
    owners: new Set(['label-protocol']),
    paths: LABEL_DOMAIN_PATHS,
    prefixes: [
      'labels[].',
      'items[].effectiveLabel.',
      'items[].observedLabel.',
      'pages[].effectiveLabel.',
      'pages[].observedLabel.',
    ],
  }),
  'visualStyle.vectorGeometry': Object.freeze({
    owners: new Set(['visual-style', 'vector-geometry']),
    prefixes: [
      'items[].visualStyle.',
      'items[].vectorGeometry.',
    ],
  }),
  'table.text': Object.freeze({
    owners: new Set(['table-content', 'text-content']),
    prefixes: [
      'items[].table.',
      'items[].content.',
    ],
  }),
});

function normalizeModelFieldDomains(value) {
  if (typeof value === 'undefined' || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new Error('MODEL_FIELD_DOMAINS_INVALID');
  }
  if (value.length === 0) {
    throw new Error('MODEL_FIELD_DOMAINS_EMPTY');
  }

  const seen = new Set();
  const domains = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error('MODEL_FIELD_DOMAINS_INVALID');
    }

    const raw = item.trim();
    const domain = MODEL_FIELD_DOMAIN_ALIASES[raw] || raw;
    if (!DOMAIN_DEFINITIONS[domain]) {
      throw new Error(`MODEL_FIELD_DOMAIN_UNKNOWN:${raw}`);
    }
    if (seen.has(domain)) {
      continue;
    }
    seen.add(domain);
    domains.push(domain);
  }

  return Object.freeze(domains);
}

function modelFieldPathInDomains(path, field, domains) {
  if (domains === null) {
    return true;
  }

  return domains.some((domain) => pathInDomain(path, field, DOMAIN_DEFINITIONS[domain]));
}

function modelFieldDomainsInclude(domains, domainName) {
  const normalizedDomains = normalizeModelFieldDomains(domains);
  if (normalizedDomains === null) {
    return true;
  }
  const normalized = normalizeModelFieldDomains([domainName]);
  return normalizedDomains.includes(normalized[0]);
}

function pathInDomain(path, field, definition) {
  if (!definition) {
    return false;
  }
  if (typeof path === 'string' && definition.paths && definition.paths.has(path)) {
    return true;
  }
  if (field && definition.owners && definition.owners.has(field.owner)) {
    return true;
  }
  if (field && definition.fieldClasses && definition.fieldClasses.has(field.fieldClass)) {
    return true;
  }
  if (
    typeof path === 'string'
    && Array.isArray(definition.prefixes)
    && definition.prefixes.some((prefix) => path.startsWith(prefix))
  ) {
    return true;
  }
  if (typeof definition.matchPath === 'function' && definition.matchPath(path)) {
    return true;
  }
  return false;
}

function childPrefixes(paths) {
  return Array.from(paths, (path) => `${path}.`);
}

module.exports = Object.freeze({
  MODEL_FIELD_DOMAIN_NAMES,
  modelFieldDomainsInclude,
  modelFieldPathInDomains,
  normalizeModelFieldDomains,
});
