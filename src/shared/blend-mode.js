'use strict';

const SUPPORTED_BLEND_MODES = Object.freeze(new Set([
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]));

const BLEND_MODE_ALIASES = Object.freeze({
  正片叠底: 'multiply',
});

function normalizeBlendMode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const alias = BLEND_MODE_ALIASES[raw];
  const token = String(alias || raw)
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
  if (!token || token === 'normal') return '';
  return SUPPORTED_BLEND_MODES.has(token) ? token : '';
}

function blendModeCss(value) {
  const mode = normalizeBlendMode(value);
  return mode ? `mix-blend-mode:${mode}` : '';
}

module.exports = {
  blendModeCss,
  normalizeBlendMode,
  SUPPORTED_BLEND_MODES,
};
