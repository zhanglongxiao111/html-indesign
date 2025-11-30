// Debug bullet and numbering character styles
(function() {
    var doc = app.activeDocument;
    var result = [];
    
    result.push("=== Paragraph Styles with Bullets/Numbering ===\n");
    
    // Specifically check these styles
    var targetStyles = ["目录段落", "要点罗列段落（18号左对齐）"];
    
    for (var i = 0; i < doc.paragraphStyles.length; i++) {
        var ps = doc.paragraphStyles[i];
        try {
            // Check all styles or specific ones
            var listType = ps.bulletsAndNumberingListType;
            var isBullet = (listType === 1280598644);
            var isNumbered = (listType === 1280601709);
            
            if (isBullet || isNumbered) {
                result.push("\nStyle: " + ps.name);
                result.push("  List Type: " + (isBullet ? "Bullet" : "Numbered"));
                
                // Check bullet character style
                try {
                    var bcs = ps.bulletsCharacterStyle;
                    if (bcs && bcs.isValid && bcs.name !== "[无]") {
                        result.push("  Bullet CharStyle: " + bcs.name);
                    } else {
                        result.push("  Bullet CharStyle: [无] or invalid");
                    }
                } catch(e) {
                    result.push("  Bullet CharStyle Error: " + e.message);
                }
                
                // Check numbering character style
                try {
                    var ncs = ps.numberingCharacterStyle;
                    if (ncs && ncs.isValid && ncs.name !== "[无]") {
                        result.push("  Numbering CharStyle: " + ncs.name);
                    } else {
                        result.push("  Numbering CharStyle: [无] or invalid");
                    }
                } catch(e) {
                    result.push("  Numbering CharStyle Error: " + e.message);
                }
            }
        } catch(e) {
            result.push("Error on style " + ps.name + ": " + e.message);
        }
    }
    
    if (result.length === 1) {
        result.push("\nNo bullet/numbered styles found in current document.");
        result.push("Total paragraph styles: " + doc.paragraphStyles.length);
        for (var j = 0; j < Math.min(doc.paragraphStyles.length, 10); j++) {
            result.push("  - " + doc.paragraphStyles[j].name);
        }
    }
    
    return result.join("\n");
})();
