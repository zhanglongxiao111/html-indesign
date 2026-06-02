const { round } = require('../../shared/geometry');
const { parseCssLinearGradient } = require('../../shared/style-utils');

function compileEffects(item, report, addMessage) {
  const style = item.computedStyle || {};
  const gradient = parseCssLinearGradient(style.backgroundImage);
  if (!gradient) return null;
  if (!gradientHasSingleColor(gradient)) {
    addMessage(report, 'warning', 'GRADIENT_COLOR_UNSUPPORTED', 'Multi-color CSS gradients are not mapped to InDesign gradient feather effects', {
      itemId: item.id,
      backgroundImage: style.backgroundImage,
    });
    return null;
  }
  return {
    gradientFeather: {
      type: 'linear',
      scope: 'fill',
      angle: cssGradientAngleToIndesign(gradient.angle),
      start: gradientStartForBounds(item.boundsMm, cssGradientAngleToIndesign(gradient.angle)),
      length: 0,
      stops: gradient.stops.map((stop) => ({
        location: stop.location,
        opacity: stop.opacity,
      })),
    },
  };
}

function cssGradientAngleToIndesign(angle) {
  const normalized = ((Number(angle) % 360) + 360) % 360;
  return (normalized + 270) % 360;
}

function gradientStartForBounds(bounds, angle) {
  const normalized = ((Number(angle) % 360) + 360) % 360;
  const x = Number(bounds && bounds.x || 0);
  const y = Number(bounds && bounds.y || 0);
  const width = Number(bounds && bounds.width || 0);
  const height = Number(bounds && bounds.height || 0);
  if (normalized === 0) return { x: round(x - width / 2, 2), y: round(y + height / 2, 2) };
  if (normalized === 180) return { x: round(x + width * 1.5, 2), y: round(y + height / 2, 2) };
  if (normalized === 90) return { x: round(x + width / 2, 2), y: round(y + height * 1.5, 2) };
  if (normalized === 270) return { x: round(x + width / 2, 2), y: round(y - height / 2, 2) };
  return { x: round(x - width / 2, 2), y: round(y + height / 2, 2) };
}

function gradientHasSingleColor(gradient) {
  const names = new Set((gradient.stops || []).map((stop) => stop.color && stop.color.name).filter(Boolean));
  return names.size <= 1;
}

module.exports = {
  compileEffects,
  gradientHasSingleColor,
};
