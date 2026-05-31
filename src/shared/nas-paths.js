'use strict';

function uncToNasUrl(value, options = {}) {
  const input = String(value || '').trim();
  const nasRoot = String(options.nasRoot || '/nas').replace(/\/+$/g, '') || '/nas';
  if (!input) return '';
  if (input === nasRoot || input.startsWith(`${nasRoot}/`)) return canonicalNasPath(input, nasRoot);

  const fileParts = fileUrlParts(input);
  if (fileParts) return nasUrl(fileParts.host, fileParts.parts, nasRoot);

  const slash = input.replace(/\\/g, '/');
  if (!slash.startsWith('//')) return input;
  if (/^\/\/[a-z][a-z0-9+.-]*:/i.test(slash)) return input;
  const parts = slash.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts.length < 2) return input;
  const host = parts.shift();
  return nasUrl(host, parts, nasRoot);
}

function toBrowserAssetPath(value, options = {}) {
  const input = String(value || '');
  if (!input) return '';
  if (isRemoteUrl(input) && !/^file:/i.test(input)) return input;
  const converted = uncToNasUrl(input, options);
  return converted || input;
}

function isNasReference(value) {
  const input = String(value || '').trim();
  return input.startsWith('\\\\') || input.startsWith('//') || input.startsWith('/nas/') || /^file:\/\/[^/]/i.test(input);
}

function fileUrlParts(value) {
  if (!/^file:/i.test(value)) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    return null;
  }
  if (!parsed.hostname) return null;
  const parts = parsed.pathname.split('/').filter(Boolean).map(safeDecode);
  if (!parts.length) return null;
  return { host: parsed.hostname, parts };
}

function nasUrl(host, parts, nasRoot) {
  const encoded = parts.map((part) => encodeURIComponent(safeDecode(part)));
  return `${nasRoot}/${String(host || '').toLowerCase()}/${encoded.join('/')}`;
}

function canonicalNasPath(input, nasRoot) {
  const path = String(input || '');
  if (path === nasRoot) return path;
  const parts = path.slice(nasRoot.length + 1).split('/');
  if (!parts.length || !parts[0]) return path;
  parts[0] = safeDecode(parts[0]).toLowerCase();
  return `${nasRoot}/${parts.join('/')}`;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch (_error) {
    return String(value || '');
  }
}

function isRemoteUrl(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(String(value || '')) && !/^[a-z]:[\\/]/i.test(String(value || ''));
}

module.exports = {
  uncToNasUrl,
  toBrowserAssetPath,
  isNasReference,
};
