/**
 * spec-generator.js
 * 
 * 从 Blueprint JSON 生成 AI Agent 约束规范文档 (AGENT_SPEC.md)
 * 该文档作为 AI 编写 HTML 时的强制参考
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析槽位标签中的简短名称
 */
function parseSlotShortName(label) {
  if (!label) return label;
  const segments = label.split(/[;；\n\r]/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[:=：]/);
    if (parts.length < 2) continue;
    const key = parts.shift().trim();
    const val = parts.join('=').trim();
    if (['名称', '名字', '槽位', 'slot', 'name'].includes(key.toLowerCase())) {
      return val;
    }
  }
  return label;
}

/**
 * 解析槽位标签中的类型
 */
function parseSlotType(label) {
  if (!label) return 'TEXT';
  const segments = label.split(/[;；\n\r]/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    const parts = trimmed.split(/[:=：]/);
    if (parts.length < 2) continue;
    const key = parts.shift().trim();
    const val = parts.join('=').trim().toUpperCase();
    if (['类型', 'type'].includes(key.toLowerCase())) {
      if (val.includes('图') || val.includes('IMAGE')) return 'IMAGE';
      return 'TEXT';
    }
  }
  return 'TEXT';
}

/**
 * 解析槽位标签中的说明
 */
function parseSlotDescription(label) {
  if (!label) return '';
  const segments = label.split(/[;；\n\r]/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    const parts = trimmed.split(/[:=：]/);
    if (parts.length < 2) continue;
    const key = parts.shift().trim();
    const val = parts.join('=').trim();
    if (['说明', 'description', 'desc'].includes(key.toLowerCase())) {
      return val;
    }
  }
  return '';
}

/**
 * 生成 AGENT_SPEC.md 内容
 */
function generateSpec(blueprint) {
  const lines = [];
  
  // Header
  lines.push('# AI Agent 内容编写规范');
  lines.push('');
  lines.push('> ⚠️ **强制约束**：本文档定义的样式名称、母版名称、槽位名称必须**完全匹配**，任何拼写错误都会导致构建失败。');
  lines.push('');
  lines.push(`> 📅 生成时间: ${new Date().toISOString()}`);
  lines.push(`> 📄 源文档: ${blueprint.metadata?.documentName || 'Unknown'}`);
  lines.push('');
  
  // 段落样式
  lines.push('---');
  lines.push('');
  lines.push('## 1. 段落样式 (Paragraph Styles)');
  lines.push('');
  lines.push('在 `data-paragraph-style` 属性中使用以下**精确名称**：');
  lines.push('');
  lines.push('| 样式名称 | CSS 类名 | 用途说明 |');
  lines.push('|----------|----------|----------|');
  
  const paraStyles = blueprint.paragraphStyles || {};
  for (const [name, style] of Object.entries(paraStyles)) {
    if (name.startsWith('[')) continue; // Skip system styles
    const safeName = style.safeName || name.replace(/[()（）]/g, '-');
    const desc = style.list ? `列表样式(${style.list.type})` : 
                 style.dropCap ? '首字下沉' :
                 style.nestedStyles ? '嵌套样式' : '普通段落';
    lines.push(`| \`${name}\` | \`.pstyle-${safeName}\` | ${desc} |`);
  }
  lines.push('');
  
  // 对象样式
  lines.push('## 2. 对象样式 (Object Styles)');
  lines.push('');
  lines.push('在 `data-object-style` 属性中使用以下**精确名称**：');
  lines.push('');
  lines.push('| 样式名称 | 视觉效果 |');
  lines.push('|----------|----------|');
  
  const objStyles = blueprint.objectStyles || {};
  for (const [name, style] of Object.entries(objStyles)) {
    const css = style.css || '无特殊样式';
    lines.push(`| \`${name}\` | ${css} |`);
  }
  lines.push('');
  
  // 母版列表
  lines.push('## 3. 可用母版 (Master Templates)');
  lines.push('');
  
  const masters = blueprint.masters || {};
  for (const [masterName, master] of Object.entries(masters)) {
    lines.push(`### ${masterName}`);
    lines.push('');
    lines.push(`- 页面尺寸: ${master.width}mm × ${master.height}mm`);
    
    const slots = master.slots || {};
    const slotCount = Object.keys(slots).length;
    
    if (slotCount === 0) {
      lines.push('- 槽位: 无（参考线页面或无需填充）');
    } else {
      lines.push(`- 槽位数量: ${slotCount}`);
      lines.push('');
      lines.push('| 槽位简称 | 类型 | 说明 |');
      lines.push('|----------|------|------|');
      
      for (const [label, slot] of Object.entries(slots)) {
        const shortName = parseSlotShortName(label);
        const type = parseSlotType(label) || slot.type || 'TEXT';
        const desc = parseSlotDescription(label) || '';
        lines.push(`| \`${shortName}\` | ${type} | ${desc} |`);
      }
    }
    lines.push('');
  }
  
  // 自由页说明
  lines.push('## 4. 自由页规范 (Free Page)');
  lines.push('');
  lines.push('当使用 `F-自由页` 母版时，可以动态创建元素：');
  lines.push('');
  lines.push('```html');
  lines.push('<section data-template="free" data-master="F-自由页">');
  lines.push('  <!-- 填充母版槽位 -->');
  lines.push('  <div data-slot="分页标题">页面标题 / Page Title</div>');
  lines.push('  ');
  lines.push('  <!-- 动态创建文本框 -->');
  lines.push('  <div class="free-item" data-type="TEXT"');
  lines.push('       data-paragraph-style="小节标题（36点左对齐）"');
  lines.push('       data-bounds="15mm,30mm,200mm,20mm">');
  lines.push('    文本内容');
  lines.push('  </div>');
  lines.push('  ');
  lines.push('  <!-- 动态创建图片框 -->');
  lines.push('  <div class="free-item" data-type="IMAGE"');
  lines.push('       data-object-style="[基本图形框架]"');
  lines.push('       data-bounds="15mm,55mm,180mm,120mm">');
  lines.push('    <img src="image.jpg"/>');
  lines.push('  </div>');
  lines.push('</section>');
  lines.push('```');
  lines.push('');
  lines.push('### data-bounds 格式');
  lines.push('');
  lines.push('`data-bounds="x,y,width,height"` - 所有值使用 mm 单位');
  lines.push('');
  lines.push('- `x`: 元素左边距到页面左边的距离');
  lines.push('- `y`: 元素上边距到页面上边的距离');
  lines.push('- `width`: 元素宽度');
  lines.push('- `height`: 元素高度');
  lines.push('');
  
  return lines.join('\n');
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node spec-generator.js <blueprint.json> <output-dir>');
    process.exit(1);
  }
  
  const [bpPath, outDir] = args;
  const blueprint = JSON.parse(fs.readFileSync(bpPath, 'utf-8'));
  const spec = generateSpec(blueprint);
  
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'AGENT_SPEC.md');
  fs.writeFileSync(outPath, spec, 'utf-8');
  console.log(`Generated: ${outPath}`);
}

module.exports = { generateSpec };

