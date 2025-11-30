# 🔧 BUG修复快速指南

**给CODEX:** 这是你需要修复的烂摊子清单。

---

## 📁 涉及的文件

```
src/builder.js              # 需要修复 7 处
src/validator.js            # 需要修复 2 处
_indesign_scripts/build_from_instructions.jsx  # 需要修复 3 处
```

---

## 🧪 测试文件

**验证修复是否成功:**
```bash
# 1. 测试builder
node src/builder.js test/test_edge_cases.html test/artifacts/real_blueprint_v7.json test/output_fixed.json

# 2. 检查errors数组应该为空或显著减少
cat test/output_fixed.json | grep -A 20 '"errors"'

# 3. 测试validator
node -e "
const {validate} = require('./src/validator.js');
const fs = require('fs');
const html = fs.readFileSync('test/test_edge_cases.html', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('test/artifacts/real_blueprint_v7.json', 'utf8'));
console.log(JSON.stringify(validate(html, blueprint), null, 2));
"
```

---

## 🎯 必须立即修复的P0 BUG (3个)

### 1. `src/builder.js` 第209行

**当前代码 (错误):**
```javascript
const slotDef = freeSlots[raw] || Object.keys(freeSlots).find(k => norm(k) === norm(raw)) && freeSlots[Object.keys(freeSlots).find(k => norm(k) === norm(raw))];
```

**修复后:**
```javascript
let slotDef = freeSlots[raw];
if (!slotDef) {
  const normalizedKey = Object.keys(freeSlots).find(k => norm(k) === norm(raw));
  if (normalizedKey) {
    slotDef = freeSlots[normalizedKey];
  }
}
```

---

### 2. `src/builder.js` 第232-237行 + `src/validator.js` 第83-91行

**问题:** 槽位名称解析逻辑缺失，用户无法使用简短名称（如"项目英文名"）

**修复 builder.js 的 lookupSlot 函数:**
```javascript
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
```

**修复 validator.js 的槽位查找 (第84行附近):**
```javascript
// 在 validator.js 中也需要相同的三级查找逻辑
const lookupSlot = (slotName, slots) => {
  // 1. 精确匹配
  if (slots[slotName]) return slots[slotName];

  // 2. 标准化匹配
  const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
  const normName = normalize(slotName);
  let hit = Object.keys(slots).find(k => normalize(k) === normName);
  if (hit) return slots[hit];

  // 3. 解析简短名称后匹配
  const parseSlotName = (label) => {
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
  };

  hit = Object.keys(slots).find(k => {
    const parsedName = parseSlotName(k);
    return normalize(parsedName) === normName;
  });
  return hit ? slots[hit] : undefined;
};

// 然后在第84行使用:
const slotDef = lookupSlot(slotName, master.slots || {});
```

---

### 3. `_indesign_scripts/build_from_instructions.jsx` 第174行

**当前代码 (完全错误):**
```javascript
if(created && fItem.zIndex!==undefined){
  try{ created.zOrder(ZOrderMethod.SEND_TO_BACK); }catch(_z){}
}
```

**修复:** 收集所有元素后统一按zIndex排序

**替换第138-175行为:**
```javascript
var free=info.items||[];
var createdItems = []; // 收集所有创建的元素

for(var fi=0; fi<free.length; fi++){
    var fItem=free[fi];

    // ... (槽位处理逻辑保持不变) ...

    if (fItem.slot && String(fItem.slot).length) {
        // ... 现有的槽位填充逻辑 ...
        continue;
    }

    var gb=boundsToPts(fItem.bounds);
    if(!gb || gb.length !== 4){
        log("Invalid bounds: "+JSON.stringify(fItem.bounds));
        continue;
    }

    var created=null;
    if(fItem.type==="TEXT"){
        var tf=page.textFrames.add();
        tf.geometricBounds=gb;
        tf.contents=fItem.content||"";
        try{
            if(fItem.paragraphStyle) tf.appliedParagraphStyle=doc.paragraphStyles.itemByName(fItem.paragraphStyle);
            if(fItem.characterStyle) tf.appliedCharacterStyle=doc.characterStyles.itemByName(fItem.characterStyle);
            if(fItem.objectStyle) tf.appliedObjectStyle=doc.objectStyles.itemByName(fItem.objectStyle);
        }catch(_s){}
        created=tf;
    }else if(fItem.type==="IMAGE"){
        var rect=page.rectangles.add();
        rect.geometricBounds=gb;
        try{ if(fItem.objectStyle) rect.appliedObjectStyle=doc.objectStyles.itemByName(fItem.objectStyle); }catch(_os){}
        if(fItem.src){ if(!applyImage(rect,fItem.src)){ log("Free image missing:"+fItem.src); } }
        created=rect;
    }

    if(created){
        createdItems.push({
            item: created,
            zIndex: fItem.zIndex !== undefined ? Number(fItem.zIndex) : 0
        });
    }
}

// 所有元素创建完成后，按zIndex排序
if(createdItems.length > 0){
    createdItems.sort(function(a, b){ return a.zIndex - b.zIndex; });
    // 先全部置底
    for(var zi=0; zi<createdItems.length; zi++){
        try{ createdItems[zi].item.sendToBack(); }catch(_){}
    }
    // 再按zIndex顺序依次前移
    for(var zi=0; zi<createdItems.length; zi++){
        try{ createdItems[zi].item.bringToFront(); }catch(_){}
    }
}
```

---

## 🔧 P1 高危BUG (5个) - 本周必须完成

### 4. 换行符标准化

**修复 `src/builder.js` 第231行和第204行的 normalize 函数:**
```javascript
const normalize = (s) => (s || '').replace(/[\r\n]/g, '').replace(/\s+/g, '').toLowerCase();
```

**同样修复 `src/validator.js` (如果有类似函数)**

---

### 5. bounds验证

**在 `_indesign_scripts/build_from_instructions.jsx` 第162行之前增加:**
```javascript
if(!fItem.bounds || typeof fItem.bounds !== 'object'){
  log("Free item missing valid bounds: "+JSON.stringify(fItem));
  continue;
}
var gb=boundsToPts(fItem.bounds);
if(!gb || gb.length !== 4){
  log("Invalid bounds conversion: "+JSON.stringify(fItem.bounds));
  continue;
}
```

---

### 6. 图片路径处理

**修复 `_indesign_scripts/build_from_instructions.jsx` 的 applyImage 函数 (第54行):**
```javascript
function applyImage(target,src){
    var f=new File(src);
    if(!f.exists){
        log("Image file not found: "+src);
        return false;
    }
    // ... 其余逻辑保持不变
}
```

---

### 7. 混合单位支持

**修复 `src/builder.js` 第37-43行:**
```javascript
const toMmX = (t) => {
  if(t.unit === 'px') return t.value * ratioX;
  if(t.unit === 'cm') return t.value * 10;
  if(t.unit === 'in') return t.value * 25.4;
  return t.value; // 默认mm
};
const toMmY = (t) => {
  if(t.unit === 'px') return t.value * ratioY;
  if(t.unit === 'cm') return t.value * 10;
  if(t.unit === 'in') return t.value * 25.4;
  return t.value; // 默认mm
};
```

**同时修改 parseSizeToken (第26行) 的正则表达式:**
```javascript
const m = token.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*(mm|px|cm|in)?$/i);
```

---

### 8. validator增加bounds检查

**在 `src/validator.js` 自由模板处理部分 (第115行附近) 增加:**
```javascript
const $items = $sec.find('[data-type]');
$items.each((j, item) => {
  const $item = $(item);
  const itemLoc = `${location} -> Free item ${j + 1}`;

  // 验证bounds
  const bounds = $item.attr('data-bounds');
  const style = $item.attr('style');

  if(!bounds && !style){
    errors.push({
      code: 'MISSING_BOUNDS',
      location: itemLoc,
      message: 'Free page item missing data-bounds or position styles.',
      suggestion: 'Add data-bounds="x,y,width,height" or style="left:x;top:y;width:w;height:h"'
    });
  }

  if(bounds){
    const parts = bounds.split(',');
    if(parts.length !== 4){
      errors.push({
        code: 'INVALID_BOUNDS',
        location: itemLoc,
        message: `Invalid bounds format: "${bounds}". Expected "x,y,width,height".`
      });
    }
  }

  // ... 现有的样式验证逻辑
});
```

---

## ✅ 验证修复

修复完成后运行：

```bash
# 1. 运行builder测试
node src/builder.js test/test_edge_cases.html test/artifacts/real_blueprint_v7.json test/test_fixed.json

# 2. 检查错误应该大幅减少
echo "=== Builder Errors ==="
cat test/test_fixed.json | grep -A 50 '"errors"'

# 3. 运行validator测试
echo "=== Validator Errors ==="
node -e "
const {validate} = require('./src/validator.js');
const fs = require('fs');
const html = fs.readFileSync('test/test_edge_cases.html', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('test/artifacts/real_blueprint_v7.json', 'utf8'));
const result = validate(html, blueprint);
console.log('Valid:', result.valid);
console.log('Error count:', result.errors.length);
if(result.errors.length > 0) console.log(JSON.stringify(result.errors, null, 2));
"

# 4. 理想结果
# - 简短槽位名 "项目英文名" 应该能正确匹配
# - bounds缺失应该被提前捕获
# - zIndex应该正确排序
```

---

## 📊 预计修复时间

- P0 (3个BUG): **1-2小时**
- P1 (5个BUG): **2-3小时**
- **总计: 3-5小时**

---

## 📝 修复后的checklist

修复完成后，确认以下测试通过：

- [ ] 简短槽位名 "项目英文名" 可以正确匹配完整label
- [ ] 完整label也能正确匹配
- [ ] 标准化匹配（忽略空格和大小写）正常工作
- [ ] 自由页元素按zIndex从小到大正确叠放
- [ ] 缺少bounds的自由页元素被validator提前捕获
- [ ] 图片路径不存在时有清晰的错误提示
- [ ] 支持 mm、px、cm、in 混合单位
- [ ] Windows (CRLF) 和 Unix (LF) 换行符都能正确处理

---

**完整详细报告见:** `docs/BUG_AUDIT_REPORT.md`

**测试用例:** `test/test_edge_cases.html`

祝修复顺利！ 🔧
