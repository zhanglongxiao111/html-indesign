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

const SOURCE_METADATA_SEGMENTS = new Set([
  'sourcePackage',
  'sourceFile',
  'sourceNode',
  'sourceAncestorNodes',
  'sourceText',
  'sourceHtml',
  'sourceRuns',
  'structure',
]);

const DOMAIN_DEFINITIONS = Object.freeze({
  'asset.placement': Object.freeze({
    owners: new Set(['asset-placement']),
    prefixes: ['items[].asset.placement.'],
  }),
  'source.metadata': Object.freeze({
    fieldClasses: new Set(['sourceMetadata']),
    matchPath: isSourceMetadataPath,
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

function isSourceMetadataPath(path) {
  const segment = lastPathSegment(path);
  return SOURCE_METADATA_SEGMENTS.has(segment) || /^source[A-Z]/.test(segment);
}

function lastPathSegment(path) {
  if (typeof path !== 'string') {
    return '';
  }
  const index = path.lastIndexOf('.');
  return index === -1 ? path : path.slice(index + 1);
}

module.exports = Object.freeze({
  MODEL_FIELD_DOMAIN_NAMES,
  modelFieldDomainsInclude,
  modelFieldPathInDomains,
  normalizeModelFieldDomains,
});
