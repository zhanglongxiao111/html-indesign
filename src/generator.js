/**
 * Reference HTML Generator
 * Converts Blueprint JSON -> Visual HTML Template
 * V3: Enhanced style support with inlineCSS
 */

const fs = require('fs');
const path = require('path');

// Helper: Convert mm to CSS value
const u = (val) => `${val}mm`;

// Helper: Check if a character is CJK (Chinese/Japanese/Korean)
function isCJK(char) {
    const code = char.charCodeAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
           (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Unified Ideographs Extension A
           (code >= 0x3000 && code <= 0x303F) ||  // CJK Punctuation
           (code >= 0xFF00 && code <= 0xFFEF);    // Fullwidth Forms
}

// Helper: Wrap English/Latin text with span for composite font styling
function wrapEnglishText(text) {
    if (!text) return text;
    
    let result = '';
    let inEnglish = false;
    let englishBuffer = '';
    
    for (const char of text) {
        if (isCJK(char) || char === '\n' || char === '\r') {
            if (inEnglish && englishBuffer.trim()) {
                result += `<span class="en-text">${englishBuffer}</span>`;
                englishBuffer = '';
            } else if (englishBuffer) {
                result += englishBuffer;
                englishBuffer = '';
            }
            inEnglish = false;
            result += char;
        } else {
            inEnglish = true;
            englishBuffer += char;
        }
    }
    
    // Handle remaining English text
    if (englishBuffer.trim()) {
        result += `<span class="en-text">${englishBuffer}</span>`;
    } else if (englishBuffer) {
        result += englishBuffer;
    }
    
    return result;
}

/**
 * Generates a complete HTML set from a Blueprint object.
 * @param {object} blueprint - The parsed blueprint JSON.
 * @param {string} outputDir - The directory to save files to.
 */
function generateHTMLSet(blueprint, outputDir) {
    console.log("Starting generation...");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Support both old "styles" and new "paragraphStyles" keys
    const paragraphStyles = blueprint.paragraphStyles || blueprint.styles || {};
    const objectStyles = blueprint.objectStyles || {};
    const masters = blueprint.masters || {};
    const compositeFonts = blueprint.compositeFonts || {};
    
    console.log("Keys in masters:", Object.keys(masters));
    console.log(`Found ${Object.keys(masters).length} masters.`);


    // 1. Generate Global CSS Block
    let cssBlock = `
    /* Reset & Base */
    body { margin: 0; padding: 20px; background: #e0e0e0; font-family: sans-serif; display: flex; justify-content: center; }
    .page-container { 
        background: white; 
        position: relative; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.15); 
        overflow: hidden;
    }
    
    /* InDesign Item Types */
    .id-item { position: absolute; box-sizing: border-box; overflow: hidden; }
    .id-rect { }
    .id-image { display: flex; align-items: center; justify-content: center; color: #999; font-size: 14px; }
    .id-image.empty-slot { background: #f0f0f0; border: 1px dashed #ccc; }
    .id-text { white-space: pre-wrap; overflow: hidden; } 
    .id-line { /* Lines get their color from inlineCSS */ }
    
    /* Z-Index Layering */
    .layer-static { z-index: 1; }
    .layer-slot { z-index: 100; border: 2px dashed #007bff; background-color: rgba(0, 123, 255, 0.03); }
    
    /* Toggle slot visibility - add .hide-slots to body to hide slot frames */
    /* Use transparent border instead of none to avoid layout shift */
    body.hide-slots .layer-slot { border-color: transparent; background-color: transparent; }
    body.hide-slots .id-image { border-color: transparent; background: transparent; color: transparent; }

    /* Generated Paragraph Styles */
    `;

    for (const [name, styleDef] of Object.entries(paragraphStyles)) {
        // Use safeName if available, otherwise generate from name
        const className = styleDef.safeName 
            ? `pstyle-${styleDef.safeName}` 
            : `pstyle-${name.replace(/[\[\]]/g, '').replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '-')}`;
        
        let css = styleDef.css || '';
        
        cssBlock += `.${className} { ${css} }\n    `;
        
        // Add drop cap styling with .dropcap-chars (supports multi-character)
        // Use CSS Grid for InDesign-like drop cap layout (number on left, text lines on right)
        if (styleDef.dropCap && styleDef.dropCap.chars > 0) {
            const lines = styleDef.dropCap.lines || 2;
            // Grid-based drop cap: dropcap spans multiple rows, text flows in right column
            let dropCapCSS = `font-size: ${lines * 2.5}em; line-height: 0.8; grid-row: span ${lines}; align-self: start;`;
            
            // Extract character style properties but filter out font-size
            if (styleDef.dropCap.styleCSS) {
                const styleParts = styleDef.dropCap.styleCSS.split(';')
                    .map(s => s.trim())
                    .filter(s => s && !s.startsWith('font-size'));
                if (styleParts.length > 0) {
                    dropCapCSS += ' ' + styleParts.join('; ') + ';';
                }
            }
            // Grid layout: dropcap column + text column, text aligned to top of dropcap
            cssBlock += `.${className}.has-dropcap { display: grid; grid-template-columns: auto 1fr; gap: 0 0.5em; align-content: center; }\n    `;
            cssBlock += `.${className}.has-dropcap .dropcap-chars { ${dropCapCSS} }\n    `;
            cssBlock += `.${className}.has-dropcap .dropcap-rest { display: flex; flex-direction: column; justify-content: flex-start; align-self: center; }\n    `;
        }
        
        // Add bullet list styles - applies to each .list-item
        if (styleDef.list && styleDef.list.type === 'bullet') {
            // Build bullet ::before styles with character style if available
            let bulletStyles = 'content: "●"; margin-right: 0.5em; display: inline-block;';
            if (styleDef.list.charStyleCSS) {
                bulletStyles += ' ' + styleDef.list.charStyleCSS;
            }
            cssBlock += `.${className} .list-item.has-bullet::before { ${bulletStyles} }\n    `;
            // Extract paragraph spacing and apply to list items
            const marginMatch = css.match(/margin-bottom:\s*([^;]+)/);
            if (marginMatch) {
                cssBlock += `.${className} .list-item { margin-bottom: ${marginMatch[1]}; }\n    `;
            }
            const marginTopMatch = css.match(/margin-top:\s*([^;]+)/);
            if (marginTopMatch) {
                cssBlock += `.${className} .list-item:first-child { margin-top: ${marginTopMatch[1]}; }\n    `;
            }
        }
        
        // Add numbered list styles - applies to each .list-item
        if (styleDef.list && styleDef.list.type === 'numbered') {
            // Build number ::before styles with character style if available
            let numberStyles = '';
            if (styleDef.list.charStyleCSS) {
                numberStyles = styleDef.list.charStyleCSS;
            }
            if (styleDef.list.isCircle) {
                // Circle Numbering: ①②③④⑤⑥⑦⑧⑨⑩
                cssBlock += `.${className} .list-item.has-number::before { content: attr(data-circle); margin-right: 0.3em; ${numberStyles} }\n    `;
            } else {
                cssBlock += `.${className} .list-item.has-number::before { content: attr(data-number) ". "; margin-right: 0.3em; font-weight: bold; ${numberStyles} }\n    `;
            }
            // Extract paragraph spacing and apply to list items
            const marginMatch = css.match(/margin-bottom:\s*([^;]+)/);
            if (marginMatch) {
                cssBlock += `.${className} .list-item { margin-bottom: ${marginMatch[1]}; }\n    `;
            }
            const marginTopMatch = css.match(/margin-top:\s*([^;]+)/);
            if (marginTopMatch) {
                cssBlock += `.${className} .list-item:first-child { margin-top: ${marginTopMatch[1]}; }\n    `;
            }
        }
        
        // Composite font handling - detect from font-family and apply correct scaling/weight
        // Check if font-family references a composite font
        const fontFamilyMatch = css.match(/font-family:\s*'([^']+)'/);
        if (fontFamilyMatch) {
            const fontName = fontFamilyMatch[1];
            if (compositeFonts[fontName]) {
                const cf = compositeFonts[fontName];
                // Find Roman/Latin scale and weight (罗马字)
                const romanEntry = cf.entries && cf.entries.find(e => e.name === '罗马字');
                const romanScale = romanEntry ? romanEntry.size / 100 : 0.8;
                const romanWeight = romanEntry && romanEntry.weight ? romanEntry.weight : 'normal';
                
                // Find CJK weight (汉字)
                const cjkEntry = cf.entries && cf.entries.find(e => e.name === '汉字');
                const cjkWeight = cjkEntry && cjkEntry.weight ? cjkEntry.weight : 'normal';
                
                // Apply font-weight to the main style if CJK is bold
                if (cf.hasBoldCJK || cjkWeight === 'bold') {
                    cssBlock += `.${className} { font-weight: bold; }\n    `;
                }
                
                // English text scaling and weight
                let enStyles = `font-size: ${romanScale}em;`;
                if (romanWeight !== cjkWeight) {
                    enStyles += ` font-weight: ${romanWeight};`;
                }
                cssBlock += `.${className} .en-text { ${enStyles} }\n    `;
            }
        }
        
        // Legacy compositeFont flag handling
        if (styleDef.compositeFont && !fontFamilyMatch) {
            cssBlock += `.${className} .en-text { font-size: 0.8em; }\n    `;
        }
    }
    
    // Add list item base styles and drop cap line styles
    cssBlock += `
    .list-item { display: block; padding: 0; }
    /* Drop cap grid layout helper classes */
    .dropcap-rest { display: contents; }
    .dropcap-line { display: block; }
    `;

    // Add object styles (including system defaults)
    cssBlock += `\n    /* Generated Object Styles */\n    `;
    for (const [name, styleDef] of Object.entries(objectStyles)) {
        const className = styleDef.safeName 
            ? `ostyle-${styleDef.safeName}` 
            : `ostyle-${name.replace(/[\[\]]/g, '').replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '-')}`;
        cssBlock += `.${className} { ${styleDef.css || ''} }\n    `;
    }

    // 2. Generate Index File
    let indexHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Index</title><style>body{display:block;font-family:sans-serif;padding:40px;} a{display:block;margin:10px 0;font-size:18px;text-decoration:none;color:#007bff;} a:hover{text-decoration:underline;}</style></head><body><h1>Templates</h1>`;

    // Collect all pages for all-in-one view
    const allPages = [];

    // 3. Generate Individual Master Files
    for (const [masterName, master] of Object.entries(masters)) {
        // Safe filename: Allow letters, numbers, chinese, underscore, hyphen
        // Hyphen at end of character class to prevent range interpretation
        const safeName = masterName.replace(new RegExp("[^a-zA-Z0-9\\u4e00-\u9fa5_-]", "g"), '_'); 
        const fileName = `${safeName}.html`;
        
        if (!master.width || !master.height) {
            console.warn(`Skipping master '${masterName}': Missing dimensions.`);
            continue;
        }
        
        console.log(`Generating: ${fileName}`);

        let pageContent = `<section class="page-container" style="width: ${u(master.width)}; height: ${u(master.height)};" data-master="${masterName}">
`;
        
        // Render Static (Background)
        const staticItems = master.staticItems || [];
        for (const item of staticItems) {
            pageContent += renderItem(item, false, paragraphStyles, compositeFonts);
        }

        // Render Slots (Foreground)
        const slots = master.slots || {};
        for (const [label, slot] of Object.entries(slots)) {
            pageContent += renderItem(slot, true, paragraphStyles, compositeFonts);
        }
        
        pageContent += `</section>`;

        const toggleScript = `<script>
document.addEventListener('keydown', function(e) {
    // Press 'H' or 'h' to toggle slot visibility
    if (e.key === 'h' || e.key === 'H') {
        document.body.classList.toggle('hide-slots');
    }
});
</script>`;

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${masterName}</title>
    <style>${cssBlock}</style>
</head>
<body>
    <div style="position:fixed;top:10px;left:10px;background:#333;color:#fff;padding:5px 10px;border-radius:4px;font-size:12px;z-index:9999;">按 H 键切换槽位边框</div>
    ${pageContent}
    ${toggleScript}
</body>
</html>`;

        fs.writeFileSync(path.join(outputDir, fileName), fullHtml);
        indexHtml += `<a href="${encodeURIComponent(fileName)}" target="_blank">${masterName}</a>`;
        
        // Collect for all-in-one page
        allPages.push({ name: masterName, content: pageContent });
    }
    
    indexHtml += `</body></html>`;
    fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);
    
    // 4. Generate All-in-One Preview Page
    let allInOneHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>All Templates Preview</title>
    <style>
    ${cssBlock}
    
    /* All-in-One Page Styles */
    body { 
        margin: 0; 
        padding: 20px; 
        background: #333; 
        font-family: sans-serif; 
    }
    .template-section {
        margin-bottom: 40px;
        background: #444;
        padding: 20px;
        border-radius: 8px;
    }
    .template-title {
        color: #fff;
        font-size: 24px;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #007bff;
    }
    .template-wrapper {
        overflow: auto;
        background: #e0e0e0;
        padding: 20px;
        border-radius: 4px;
    }
    .page-container {
        margin: 0 auto;
        overflow: hidden; /* Ensure images are clipped within frame */
    }
    /* Navigation */
    .nav-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #222;
        padding: 10px 20px;
        z-index: 1000;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    .nav-bar a {
        color: #007bff;
        text-decoration: none;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 14px;
    }
    .nav-bar a:hover {
        background: #007bff;
        color: #fff;
    }
    .content {
        margin-top: 60px;
    }
    /* Scale control */
    .scale-control {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #222;
        padding: 10px;
        border-radius: 8px;
        z-index: 1000;
    }
    .scale-control label {
        color: #fff;
        margin-right: 10px;
    }
    </style>
</head>
<body>
    <nav class="nav-bar">
        <strong style="color:#fff;margin-right:20px;">Templates:</strong>
`;

    // Add navigation links
    for (const page of allPages) {
        const anchor = page.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-');
        allInOneHtml += `        <a href="#${anchor}">${page.name}</a>\n`;
    }

    allInOneHtml += `    </nav>
    <div class="content">
`;

    // Add all template sections
    for (const page of allPages) {
        const anchor = page.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-');
        allInOneHtml += `
        <div class="template-section" id="${anchor}">
            <h2 class="template-title">${page.name}</h2>
            <div class="template-wrapper">
                ${page.content}
            </div>
        </div>
`;
    }

    allInOneHtml += `    </div>
    <div class="scale-control">
        <label>Scale:</label>
        <input type="range" id="scaleSlider" min="10" max="100" value="30" oninput="updateScale(this.value)">
        <span id="scaleValue">30%</span>
        <span style="margin-left:20px;color:#888;">| 按 H 键隐藏槽位边框</span>
    </div>
    <script>
    function updateScale(val) {
        document.getElementById('scaleValue').textContent = val + '%';
        document.querySelectorAll('.page-container').forEach(el => {
            el.style.transform = 'scale(' + (val/100) + ')';
            el.style.transformOrigin = 'top left';
        });
        // Adjust wrapper height
        document.querySelectorAll('.template-wrapper').forEach(wrapper => {
            const container = wrapper.querySelector('.page-container');
            if (container) {
                const height = container.offsetHeight * (val/100);
                wrapper.style.height = (height + 40) + 'px';
            }
        });
    }
    // Initial scale
    updateScale(30);
    
    // Toggle slot visibility with H key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'h' || e.key === 'H') {
            document.body.classList.toggle('hide-slots');
        }
    });
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(outputDir, 'all-templates.html'), allInOneHtml);
    console.log(`Generated all-in-one preview: all-templates.html`);
}

function renderItem(item, isSlot, paragraphStyles, compositeFonts) {
    const b = item.bounds;
    
    let content = '';
    let classes = ['id-item'];
    classes.push(isSlot ? 'layer-slot' : 'layer-static');

    let attrs = '';
    if (isSlot && item.label) {
        const safeLabel = item.label.replace(/"/g, '&quot;').replace(/\n/g, ' ');
        attrs += ` data-slot="${safeLabel}" title="${safeLabel}"`;
    }

    // Start with position/size styles
    let inlineStyles = [`left: ${u(b.x)}`, `top: ${u(b.y)}`, `width: ${u(b.width)}`, `height: ${u(b.height)}`];
    
    // Use z-index from InDesign, but ensure slots are always above static items
    // Slots get a base offset of 1000 to ensure they're above static elements
    if (typeof item.zIndex === 'number') {
        const zOffset = isSlot ? 1000 : 0;
        inlineStyles.push(`z-index: ${item.zIndex + zOffset}`);
    } else if (isSlot) {
        // Fallback: ensure slots without zIndex are still above static
        inlineStyles.push(`z-index: 1000`);
    }
    
    // Properties that should be controlled by paragraph style class, not inlineCSS
    const paragraphStyleProps = ['font-family', 'font-size', 'font-weight', 'line-height', 'text-align', 'color', 'letter-spacing', 'margin-top', 'margin-bottom'];
    
    // Flex properties that interfere with list layouts
    const flexProps = ['display', 'flex-direction', 'justify-content', 'align-items'];
    
    // Basic paragraph styles that should NOT trigger filtering (their actual styles are in inlineCSS)
    const basicStyles = ['[无段落样式]', '[基本段落]'];
    
    // Check if paragraph style has list (bullet or numbered)
    const styleDef = item.appliedParagraphStyle ? paragraphStyles[item.appliedParagraphStyle] : null;
    const hasListStyle = styleDef && styleDef.list;
    
    // Parse paragraph style CSS into a map for comparison
    const styleDefCSS = styleDef && styleDef.css ? styleDef.css : '';
    const styleCSSMap = {};
    styleDefCSS.split(';').forEach(part => {
        const [prop, val] = part.split(':').map(s => s.trim());
        if (prop && val) styleCSSMap[prop.toLowerCase()] = val;
    });
    
    // Filter inlineCSS to remove properties that match paragraph style
    // But keep properties that are DIFFERENT from paragraph style (local overrides)
    let filteredInlineCSS = item.inlineCSS || '';
    const isBasicStyle = !item.appliedParagraphStyle || basicStyles.includes(item.appliedParagraphStyle);
    
    // Track if we need vertical centering for lists (handled separately)
    let needsListVerticalCenter = false;
    
    if (item.type === 'TEXT' && !isBasicStyle && filteredInlineCSS) {
        const parts = filteredInlineCSS.split(';').map(s => s.trim()).filter(s => s);
        const filtered = parts.filter(part => {
            const colonIdx = part.indexOf(':');
            if (colonIdx === -1) return true;
            const propName = part.substring(0, colonIdx).trim().toLowerCase();
            const propValue = part.substring(colonIdx + 1).trim();
            
            // For list styles, handle vertical centering differently
            if (hasListStyle && flexProps.includes(propName)) {
                // Check if this is for vertical centering
                if (propName === 'justify-content' && propValue === 'center') {
                    needsListVerticalCenter = true;
                }
                return false; // Remove all flex props for lists
            }
            
            // For paragraph style props, only remove if value matches style definition
            if (paragraphStyleProps.includes(propName)) {
                const styleValue = styleCSSMap[propName];
                return styleValue !== propValue;
            }
            return true;
        });
        filteredInlineCSS = filtered.join('; ');
        
        // Add grid-based vertical centering for lists
        if (needsListVerticalCenter) {
            filteredInlineCSS = filteredInlineCSS 
                ? filteredInlineCSS + '; display:grid; align-content:center' 
                : 'display:grid; align-content:center';
        }
    }
    
    if (filteredInlineCSS) {
        inlineStyles.push(filteredInlineCSS);
    }

    // Always apply object style class if available
    if (item.appliedObjectStyle) {
        const osClassName = item.appliedObjectStyle.replace(/[\[\]]/g, '').replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '-');
        classes.push(`ostyle-${osClassName}`);
    }

    if (item.type === 'TEXT') {
        classes.push('id-text');
        let psClassName = '';
        let styleDef = null;
        let hasDropCap = false;
        
        if (item.appliedParagraphStyle) {
            psClassName = item.appliedParagraphStyle.replace(/[\[\]]/g, '').replace(/[^a-zA-Z0-9-_\u4e00-\u9fa5]/g, '-');
            classes.push(`pstyle-${psClassName}`);
            styleDef = paragraphStyles[item.appliedParagraphStyle];
        }
        
        // Check for drop cap, bullet, or numbered list features
        if (styleDef) {
            if (styleDef.dropCap && styleDef.dropCap.chars > 0) {
                classes.push('has-dropcap');
                hasDropCap = true;
            }
            if (styleDef.list && styleDef.list.type === 'bullet') {
                classes.push('has-bullet-list');
            }
            if (styleDef.list && styleDef.list.type === 'numbered') {
                classes.push('has-numbered-list');
            }
        }
        
        // If has drop cap with vertical centering, remove flex styles (Grid handles centering)
        if (hasDropCap) {
            // Remove flex-related styles since drop cap uses CSS Grid
            for (let i = inlineStyles.length - 1; i >= 0; i--) {
                if (inlineStyles[i].includes('display:flex') || 
                    inlineStyles[i].includes('display: flex') ||
                    inlineStyles[i].includes('flex-direction') || 
                    inlineStyles[i].includes('justify-content')) {
                    inlineStyles.splice(i, 1);
                }
            }
        }
        
        // Circle numbers ①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳
        const circleNumbers = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
        
        // Check if using composite font
        let usesCompositeFont = false;
        if (styleDef && styleDef.css) {
            const fontMatch = styleDef.css.match(/font-family:\s*'([^']+)'/);
            if (fontMatch && compositeFonts && compositeFonts[fontMatch[1]]) {
                usesCompositeFont = true;
            }
        }
        
        // Render content with paragraph-level list markers
        const rawContent = item.content || "";
        if (styleDef && styleDef.list) {
            // Split by line breaks and wrap each paragraph
            const paragraphs = rawContent.split(/\r\n|\r|\n/);
            let counter = 1;
            content = paragraphs.map(p => {
                if (!p.trim()) return '';
                let escaped = escapeHtml(p);
                if (usesCompositeFont) escaped = wrapEnglishText(escaped);
                if (styleDef.list.type === 'bullet') {
                    return `<p class="list-item has-bullet">${escaped}</p>`;
                } else if (styleDef.list.type === 'numbered') {
                    const circleNum = styleDef.list.isCircle ? circleNumbers[counter-1] || `(${counter})` : '';
                    const num = counter++;
                    if (styleDef.list.isCircle) {
                        return `<p class="list-item has-number" data-number="${num}" data-circle="${circleNum}">${escaped}</p>`;
                    } else {
                        return `<p class="list-item has-number" data-number="${num}">${escaped}</p>`;
                    }
                }
                return `<p>${escaped}</p>`;
            }).filter(p => p).join('\n');
        } else if (hasDropCap && styleDef && styleDef.dropCap) {
            // Handle multi-character drop cap with CSS Grid layout
            const dropCapChars = styleDef.dropCap.chars || 1;
            let escaped = escapeHtml(rawContent);
            // Wrap first N characters in a span, rest in separate line spans
            if (escaped.length >= dropCapChars) {
                const dropCapText = escaped.substring(0, dropCapChars);
                let restText = escaped.substring(dropCapChars);
                // Split rest by newlines first, then wrap each line
                const lines = restText.split(/\r\n|\r|\n/);
                const lineSpans = lines.map(line => {
                    let processedLine = line;
                    if (usesCompositeFont) processedLine = wrapEnglishText(line);
                    return `<span class="dropcap-line">${processedLine}</span>`;
                }).join('');
                content = `<span class="dropcap-chars">${dropCapText}</span><span class="dropcap-rest">${lineSpans}</span>`;
            } else {
                content = escaped;
            }
        } else {
            let escaped = escapeHtml(rawContent);
            
            // Apply GREP styles - handle first-line pattern
            if (styleDef && styleDef.grepStyles && styleDef.grepStyles.length > 0) {
                const lines = escaped.split(/\r\n|\r|\n/);
                for (const grepStyle of styleDef.grepStyles) {
                    // Common pattern: first line special styling
                    if (grepStyle.pattern && grepStyle.pattern.includes('^.+?(?=\\n|\\r)')) {
                        if (lines.length > 0) {
                            // Build first line style - combine charStyleCSS with firstLineFont if available
                            let firstLineStyle = grepStyle.charStyleCSS || '';
                            
                            // Check if item has a different first line font (e.g., from GREP style with composite font)
                            if (item.firstLineFont && compositeFonts && compositeFonts[item.firstLineFont]) {
                                // This is a composite font, add font-weight hints based on cjkWeight
                                const cf = compositeFonts[item.firstLineFont];
                                if (cf.cjkWeight === 'bold' || cf.hasBoldCJK) {
                                    firstLineStyle = `font-weight:bold; ${firstLineStyle}`;
                                }
                            } else if (item.firstLineFont) {
                                // Regular font override
                                firstLineStyle = `font-family:'${item.firstLineFont}',sans-serif; ${firstLineStyle}`;
                            }
                            
                            // Wrap first line with inline style
                            let firstLine = lines[0];
                            // Check if first line uses composite font (either from item or style)
                            const firstLineUsesComposite = (item.firstLineFont && compositeFonts && compositeFonts[item.firstLineFont]) || usesCompositeFont;
                            if (firstLineUsesComposite) firstLine = wrapEnglishText(firstLine);
                            
                            if (firstLineStyle) {
                                lines[0] = `<span class="grep-first-line" style="${firstLineStyle}">${firstLine}</span>`;
                            } else {
                                lines[0] = `<span class="grep-first-line">${firstLine}</span>`;
                            }
                        }
                    }
                }
                // Join lines with <br> for proper display
                const processedLines = lines.map((line, idx) => {
                    if (idx === 0) return line; // Already processed
                    if (usesCompositeFont) return wrapEnglishText(line);
                    return line;
                });
                content = processedLines.join('<br>');
            } else {
                if (usesCompositeFont) escaped = wrapEnglishText(escaped);
                content = escaped;
            }
        }
    } else if (item.type === 'IMAGE') {
        classes.push('id-image');
        // Check if there's an embedded image
        if (item.imagePath) {
            // Has actual image - no placeholder styling needed
            inlineStyles.push('display: block');
            inlineStyles.push('overflow: hidden');
            // Note: position: absolute is already set by .id-item class
            
            // Check if it's a PDF file
            const isPDF = item.imagePath.toLowerCase().endsWith('.pdf');
            
            if (isPDF) {
                // For PDF, use an object tag or show a placeholder with link
                content = `<object data="${item.imagePath}" type="application/pdf" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                    <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #f5f5f5; color: #666; font-size: 12px; flex-direction: column;">
                        <span style="font-size: 24px;">📄</span>
                        <span>PDF: ${item.imagePath.split(/[/\\]/).pop()}</span>
                    </div>
                </object>`;
            } else {
                // Use object-fit: cover to fill the frame and crop
                const imgStyle = item.imageCropped 
                    ? 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;' 
                    : 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;';
                // Note: onerror replaces img with a placeholder that stays within the container bounds
                content = `<img src="${item.imagePath}" style="${imgStyle}" alt="Image" onerror="this.onerror=null; this.style.display='none'; var p=document.createElement('div'); p.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;font-size:12px;'; p.textContent='📷 Image not found'; this.parentElement.appendChild(p);">`;
            }
        } else {
            // Empty image slot - add placeholder styling
            classes.push('empty-slot');
            content = '📷 IMAGE';
        }
    } else if (item.type === 'LINE') {
        classes.push('id-line');
        // Lines are typically thin, ensure minimum visibility
        if (b.width === 0) inlineStyles.push('width: 1px');
        if (b.height === 0) inlineStyles.push('height: 1px');
    } else {
        classes.push('id-rect');
    }

    // Add visual properties not in inlineCSS
    if (item.visuals && item.visuals.fillColor && item.visuals.fillColor !== 'transparent') {
        inlineStyles.push(`background-color: ${item.visuals.fillColor}`);
    }

    attrs += ` style="${inlineStyles.join('; ')}"`;

    return `        <div class="${classes.join(' ')}"${attrs}>${content}</div>\n`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node generator.js <input.json> <output_dir>");
        process.exit(1);
    }
    
    try {
        const json = fs.readFileSync(args[0], 'utf8');
        const blueprint = JSON.parse(json);
        generateHTMLSet(blueprint, args[1]);
        console.log(`Successfully generated HTML set in: ${args[1]}`);
    } catch (e) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}

module.exports = { generateHTMLSet };