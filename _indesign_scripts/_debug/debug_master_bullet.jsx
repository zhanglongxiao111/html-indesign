// Debug bullet style in master page
(function() {
    var doc = app.activeDocument;
    var result = [];
    
    result.push("=== Debug Master Bullet Character Style ===\n");
    
    // Find D-左说明图右现状照片群组 master
    var targetMaster = null;
    for (var i = 0; i < doc.masterSpreads.length; i++) {
        var ms = doc.masterSpreads[i];
        if (ms.name.indexOf("D-") === 0) {
            targetMaster = ms;
            result.push("Found master: " + ms.name);
            break;
        }
    }
    
    if (!targetMaster) {
        return "Master D-* not found";
    }
    
    // Find text frames with label containing "要点说明"
    for (var p = 0; p < targetMaster.pages.length; p++) {
        var page = targetMaster.pages[p];
        for (var j = 0; j < page.textFrames.length; j++) {
            var tf = page.textFrames[j];
            if (tf.label && tf.label.indexOf("要点说明") !== -1) {
                result.push("\nFound text frame: " + tf.label.substring(0, 50) + "...");
                
                // Check applied paragraph style
                try {
                    for (var k = 0; k < tf.paragraphs.length; k++) {
                        var para = tf.paragraphs[k];
                        var ps = para.appliedParagraphStyle;
                        
                        result.push("  Paragraph " + k + " style: " + ps.name);
                        
                        // Check list type
                        var listType = ps.bulletsAndNumberingListType;
                        result.push("    List Type: " + listType + " (Bullet=1280598644, Numbered=1280601709)");
                        
                        // Check bullet character style directly from paragraph style
                        try {
                            var bcs = ps.bulletsCharacterStyle;
                            result.push("    bulletsCharacterStyle: " + (bcs ? bcs.name : "null"));
                            if (bcs && bcs.isValid) {
                                result.push("    bulletsCharacterStyle.isValid: true");
                                result.push("    bulletsCharacterStyle.name: " + bcs.name);
                                // Get style details
                                try {
                                    if (bcs.fillColor && bcs.fillColor.isValid) {
                                        result.push("    bulletsCharacterStyle.fillColor: " + bcs.fillColor.name);
                                    }
                                    if (bcs.pointSize) {
                                        result.push("    bulletsCharacterStyle.pointSize: " + bcs.pointSize);
                                    }
                                } catch(e) {}
                            }
                        } catch(e) {
                            result.push("    bulletsCharacterStyle Error: " + e.message);
                        }
                        
                        // Check bullet text font
                        try {
                            result.push("    bulletsTextFont: " + (ps.bulletsTextFont || "null"));
                        } catch(e) {}
                        
                        // Check bullet character value
                        try {
                            result.push("    bulletChar.characterValue: " + ps.bulletChar.characterValue);
                        } catch(e) {}
                        
                        break; // Just check first paragraph
                    }
                } catch(e) {
                    result.push("  Error checking paragraph: " + e.message);
                }
            }
        }
    }
    
    // Also list all paragraph styles to see which ones have bullets
    result.push("\n=== All Paragraph Styles with Bullets ===");
    for (var s = 0; s < doc.paragraphStyles.length; s++) {
        var ps = doc.paragraphStyles[s];
        try {
            var listType = ps.bulletsAndNumberingListType;
            if (listType === 1280598644 || listType === 1280601709) {
                result.push("\n" + ps.name);
                result.push("  bulletsAndNumberingListType: " + listType);
                try {
                    var bcs = ps.bulletsCharacterStyle;
                    result.push("  bulletsCharacterStyle: " + (bcs && bcs.isValid ? bcs.name : "[无]"));
                } catch(e) {
                    result.push("  bulletsCharacterStyle: Error - " + e.message);
                }
            }
        } catch(e) {}
    }
    
    return result.join("\n");
})();
