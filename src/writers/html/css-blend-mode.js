'use strict';

function blendModeCss(value) {
  const mode = cssBlendMode(value);
  return mode ? `mix-blend-mode:${mode}` : '';
}

function cssBlendMode(value) {
  const token = String(value || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  if (!token || token === 'normal') return '';
  if (token === '正片叠底') return 'multiply';
  const supported = new Set([
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
  ]);
  return supported.has(token) ? token : '';
}

module.exports = {
  blendModeCss,
  cssBlendMode,
};
