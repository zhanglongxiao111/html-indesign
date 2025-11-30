/**
 * Debug: Check actual text in G-对标案例图文页 master
 */
(function() {
    if (app.documents.length === 0) return "Error: No documents open";
    var doc = app.activeDocument;
    
    var result = [];
    
    // Find the master spread
    var master = null;
    for (var i = 0; i < doc.masterSpreads.length; i++) {
        if (doc.masterSpreads[i].name === "G-对标案例图文页") {
            master = doc.masterSpreads[i];
            break;
        }
    }
    
    if (!master) return "Master not found";
    
    result.push("=== G-对标案例图文页 Master ===");
    
    // Find text frames with label containing "正文描述"
    for (var i = 0; i < master.allPageItems.length; i++) {
        var it = master.allPageItems[i];
        if (it instanceof TextFrame && it.label && it.label.indexOf("正文描述") !== -1) {
            result.push("\n--- Found: " + it.label.substring(0, 50) + "... ---");
            
            // Check paragraphs
            for (var p = 0; p < Math.min(it.paragraphs.length, 2); p++) {
                var para = it.paragraphs[p];
                result.push("Paragraph " + p + ":");
                result.push("  Applied Paragraph Style: " + para.appliedParagraphStyle.name);
                
                // Check first few characters
                for (var c = 0; c < Math.min(para.characters.length, 5); c++) {
                    var ch = para.characters[c];
                    var fontName = "null";
                    try {
                        if (ch.appliedFont && ch.appliedFont.isValid) {
                            fontName = ch.appliedFont.name;
                        }
                    } catch(e) {}
                    result.push("  Char " + c + " '" + ch.contents + "': font=" + fontName);
                }
            }
        }
    }
    
    return result.join("\n");
})();
