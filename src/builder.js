/**
 * HTML → InDesign Build Instruction Generator
 * Converts validated content.html + blueprint.json into executable build instructions.
 *
 * Instruction schema (per page):
 * {
 *   master: "A-Cover"            // for fixed templates
 *   template: "free"             // for free templates
 *   items: [
 *     { slot: "Title", type: "TEXT", content: "Hello" },
 *     { slot: "Hero", type: "IMAGE", src: "hero.jpg" },
 *     { type: "TEXT", bounds: {x,y,width,height}, content: "...", zIndex: 1000 }, // free page
 *     { type: "IMAGE", bounds: {...}, src: "cover.png" }
 *   ]
 * }
 *
 * CLI:
 *   node src/builder.js <content.html> <blueprint.json> <out.json>
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function parseSizeToken(token) {
  if (!token) return null;
  const m = token.trim().match(/^([\d.+-]+)\s*(mm|px)?$/i);
  if (!m) return null;
  return { value: parseFloat(m[1]), unit: (m[2] || 'mm').toLowerCase() };
}

function parseBounds(raw, ratioX = 1, ratioY = 1) {
  if (!raw) return null;
  const parts = raw.split(',').map(s => s.trim());
  if (parts.length !== 4) return null;
  const tokens = parts.map(parseSizeToken);
  if (tokens.some(t => !t || isNaN(t.value))) return null;
  const toMmX = (t) => t.unit === 'px' ? t.value * ratioX : t.value;
  const toMmY = (t) => t.unit === 'px' ? t.value * ratioY : t.value;
  const [xTok, yTok, wTok, hTok] = tokens;
  const x = toMmX(xTok);
  const y = toMmY(yTok);
  const width = toMmX(wTok);
  const height = toMmY(hTok);
  return { x, y, width, height };
}

function firstImageSource($el) {
  const img = $el.is('img') ? $el : $el.find('img').first();
  return img && img.attr ? img.attr('src') || null : null;
}

function parseSlotName(label) {
  if (!label) return label;
  const segments = label.split(/[;；\n]/);
  for (const segRaw of segments) {
    const seg = segRaw.trim();
    if (!seg) continue;
    const parts = seg.split(/[:=：]/);
    if (parts.length < 2) continue;
    const key = parts.shift().trim();
    const val = parts.join('=').trim();
    if (!val) continue;
    if (['名称', '名字', '槽位', 'slot', 'name'].includes(key)) {
      return val;
    }
  }
  return label;
}

/**
 * Build instructions from HTML + blueprint.
 * @param {string} html
 * @param {object} blueprint
 * @param {object} opts
 * @returns {{metadata: object, pages: Array, errors: Array}}
 */
function buildInstructions(html, blueprint, opts = {}) {
  const $ = cheerio.load(html);
  const pages = [];
  const errors = [];

  const sections = $('section[data-master], section[data-template]');
  if (sections.length === 0) {
    errors.push({ code: 'NO_SECTION', message: 'No section with data-master or data-template found.' });
  }

  sections.each((i, section) => {
    const $sec = $(section);
    const masterName = $sec.attr('data-master');
    const template = $sec.attr('data-template');

    const masterLooksFree = masterName && masterName.indexOf('自由') !== -1;

    if ((template && template.toLowerCase() === 'free') || (!template && masterLooksFree)) {
      let masterFree = $sec.attr('data-master');
      const mastersMap = blueprint.masters || {};
      // If not specified, try to pick a master whose name contains "自由"
      if (!masterFree) {
        const candidates = Object.keys(mastersMap || {}).filter((m) => m.indexOf('自由') !== -1);
        if (candidates.length > 0) {
          masterFree = candidates[0];
        }
      }
      if (!masterFree) {
        errors.push({ code: 'MISSING_MASTER', message: `Free page missing data-master at page ${i + 1}, and no master with '自由' found.` });
        return;
      }
      const masterDef = mastersMap[masterFree];
      if (!masterDef) {
        errors.push({ code: 'MASTER_NOT_FOUND', message: `Free page master '${masterFree}' not found in blueprint.` });
        return;
      }
      // Section size: prefer data-width/height; fallback to master width/height; capture source size for px scaling
      const secStyle = ($sec.attr('style') || '');
      const styleMap = {};
      secStyle.split(';').forEach(part => {
        const idx = part.indexOf(':');
        if (idx > -1) styleMap[part.substring(0, idx).trim().toLowerCase()] = part.substring(idx + 1).trim();
      });
      const parseCssSize = (v) => {
        if (!v) return null;
        const m = v.trim().match(/^([\d.+-]+)\s*(mm|px)?$/i);
        if (!m) return null;
        return { value: parseFloat(m[1]), unit: (m[2] || 'mm').toLowerCase() };
      };
      const secWidthToken = parseCssSize($sec.attr('data-width')) || parseCssSize(styleMap.width);
      const secHeightToken = parseCssSize($sec.attr('data-height')) || parseCssSize(styleMap.height);

      const page = {
        template: 'free',
        master: masterFree,
        width: (secWidthToken && secWidthToken.unit === 'mm' ? secWidthToken.value : null) || masterDef.width || null,
        height: (secHeightToken && secHeightToken.unit === 'mm' ? secHeightToken.value : null) || masterDef.height || null,
        items: [],
      };

      const ratioX = secWidthToken && secWidthToken.unit === 'px' && masterDef.width
        ? masterDef.width / secWidthToken.value
        : 1;
      const ratioY = secHeightToken && secHeightToken.unit === 'px' && masterDef.height
        ? masterDef.height / secHeightToken.value
        : 1;

      // Helper to parse bounds from data-bounds or style
      function boundsFromEl($el) {
        const raw = $el.attr('data-bounds');
        let b = parseBounds(raw, ratioX, ratioY);
        if (b) return b;
        const style = ($el.attr('style') || '');
        const map = {};
        style.split(';').forEach(part => {
          const idx = part.indexOf(':');
          if (idx > -1) map[part.substring(0, idx).trim().toLowerCase()] = part.substring(idx + 1).trim();
        });
        const leftTok = parseSizeToken(map.left);
        const topTok = parseSizeToken(map.top);
        const widthTok = parseSizeToken(map.width);
        const heightTok = parseSizeToken(map.height);
        if (leftTok && topTok && widthTok && heightTok) {
          return parseBounds([map.left, map.top, map.width, map.height].join(','), ratioX, ratioY);
        }
        return null;
      }

      $sec.find('[data-type]').each((idx, el) => {
        const $el = $(el);
        const type = ($el.attr('data-type') || '').toUpperCase();
        const bounds = boundsFromEl($el);
        if (!bounds) {
          errors.push({ code: 'MISSING_BOUNDS', message: `Free item missing bounds at page ${i + 1}.` });
          return;
        }
        const zIndex = $el.attr('data-z') || $el.attr('data-zindex');
        const item = { type, bounds };
        if (zIndex !== undefined) item.zIndex = Number(zIndex);
        // Optional style references (use InDesign style names)
        const paragraphStyle = $el.attr('data-paragraph-style');
        const characterStyle = $el.attr('data-character-style');
        const objectStyle = $el.attr('data-object-style');
        const swatch = $el.attr('data-swatch');
        if (paragraphStyle) item.paragraphStyle = paragraphStyle;
        if (characterStyle) item.characterStyle = characterStyle;
        if (objectStyle) item.objectStyle = objectStyle;
        if (swatch) item.swatch = swatch;
        if (type === 'TEXT') {
          item.content = $el.text().trim();
          const style = $el.attr('style');
          if (style) item.inlineCSS = style;
        } else if (type === 'IMAGE') {
          const src = firstImageSource($el);
          if (src) {
            item.src = src;
          }
          // Allow empty image frames as placeholders (no src is OK)
        }
        page.items.push(item);
      });

      // Also include labeled slots if present (e.g., free master title)
      const freeSlots = masterDef && masterDef.slots ? masterDef.slots : {};
      const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();

      // Helper function to lookup slot with three-level matching (BUG-001 fix)
      const lookupFreeSlot = (name) => {
        // 1. 精确匹配
        if (freeSlots[name]) return freeSlots[name];
        // 2. 标准化匹配（去空格+小写）
        const normName = norm(name);
        let hit = Object.keys(freeSlots).find(k => norm(k) === normName);
        if (hit) return freeSlots[hit];
        // 3. 解析后匹配（从完整label提取简短名并比较）
        hit = Object.keys(freeSlots).find(k => {
          const parsedName = parseSlotName(k);
          return norm(parsedName) === normName;
        });
        return hit ? freeSlots[hit] : undefined;
      };

      $sec.find('[data-slot]').each((idx, el) => {
        const $slot = $(el);
        const raw = $slot.attr('data-slot');
        const slotKey = parseSlotName(raw) || raw;
        const slotDef = lookupFreeSlot(raw);
        const slotType = (slotDef && slotDef.type) || 'TEXT';
        if (slotType === 'IMAGE') {
          const src = firstImageSource($slot);
          if (src) page.items.push({ slot: slotKey, type: 'IMAGE', src });
        } else {
          page.items.push({ slot: slotKey, type: 'TEXT', content: $slot.text().trim() });
        }
      });

      pages.push(page);
      return;
    }

    if (masterName) {
      const master = (blueprint.masters || {})[masterName];
      if (!master) {
        errors.push({ code: 'MASTER_NOT_FOUND', message: `Master '${masterName}' not found in blueprint.` });
        return;
      }

      // Slot lookup tolerant to line-ending differences (BUG-002 fix: add parseSlotName)
      const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
      const lookupSlot = (name) => {
        const slots = master.slots || {};
        // 1. 精确匹配
        if (slots[name]) return slots[name];
        // 2. 标准化匹配（去空格+小写）
        const normName = normalize(name);
        let hit = Object.keys(slots).find(k => normalize(k) === normName);
        if (hit) return slots[hit];
        // 3. 解析后匹配（从完整label提取简短名并比较）
        hit = Object.keys(slots).find(k => {
          const parsedName = parseSlotName(k);
          return normalize(parsedName) === normName;
        });
        return hit ? slots[hit] : undefined;
      };

      const items = [];
      $sec.find('[data-slot]').each((idx, el) => {
        const $slot = $(el);
        const slotName = $slot.attr('data-slot');
        const slotDef = lookupSlot(slotName);
        if (!slotDef) {
          errors.push({ code: 'SLOT_NOT_FOUND', message: `Slot '${slotName}' not found on master '${masterName}'.` });
          return;
        }

        const slotKey = parseSlotName(slotName) || slotName;
        const type = slotDef.type || 'TEXT';
        if (type === 'IMAGE') {
          const src = firstImageSource($slot);
          if (!src) {
            errors.push({ code: 'TYPE_MISMATCH', message: `Slot '${slotName}' expects IMAGE but no <img> found.` });
            return;
          }
          items.push({ slot: slotKey, type: 'IMAGE', src });
        } else {
          items.push({ slot: slotKey, type: 'TEXT', content: $slot.text().trim() });
        }
      });

      pages.push({
        master: masterName,
        items,
      });
    }
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: opts.source || 'builder',
    },
    pages,
    errors,
  };
}

if (require.main === module) {
  const [, , htmlPath, blueprintPath, outPath] = process.argv;
  if (!htmlPath || !blueprintPath || !outPath) {
    console.error('Usage: node src/builder.js <content.html> <blueprint.json> <out.json>');
    process.exit(1);
  }
  try {
    const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
    const blueprint = JSON.parse(fs.readFileSync(path.resolve(blueprintPath), 'utf8'));
    const instructions = buildInstructions(html, blueprint);
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(instructions, null, 2), 'utf8');
    console.log(`Generated instructions -> ${outPath}`);
    if (instructions.errors.length) {
      console.warn('Completed with warnings/errors:', instructions.errors);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

module.exports = { buildInstructions };
