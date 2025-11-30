/**
 * debug_graphics.jsx
 * Debug script to check all graphics (images, PDFs) in master spreads
 */
(function() {
    if (app.documents.length === 0) return "Error: No documents open";
    var doc = app.activeDocument;
    
    var results = [];
    
    for (var i = 0; i < doc.masterSpreads.length; i++) {
        var m = doc.masterSpreads[i];
        if (!m.name) continue;
        
        for (var j = 0; j < m.allPageItems.length; j++) {
            var it = m.allPageItems[j];
            
            // Check if it's a graphic frame
            if (it instanceof Rectangle || it instanceof Oval || it instanceof Polygon) {
                var info = {
                    master: m.name,
                    id: it.id,
                    label: it.label || "(no label)",
                    contentType: String(it.contentType),
                    hasGraphics: it.allGraphics ? it.allGraphics.length : 0
                };
                
                if (it.allGraphics && it.allGraphics.length > 0) {
                    var gr = it.allGraphics[0];
                    info.graphicType = gr.constructor.name;
                    
                    try {
                        if (gr.itemLink) {
                            info.linkPath = gr.itemLink.filePath;
                            info.linkName = gr.itemLink.name;
                            info.linkStatus = String(gr.itemLink.status);
                        }
                    } catch (e) {
                        info.linkError = e.message;
                    }
                    
                    // Check graphic bounds
                    try {
                        var gb = gr.geometricBounds;
                        info.graphicBounds = {
                            top: gb[0],
                            left: gb[1],
                            bottom: gb[2],
                            right: gb[3],
                            width: gb[3] - gb[1],
                            height: gb[2] - gb[0]
                        };
                    } catch (e) {
                        info.boundsError = e.message;
                    }
                }
                
                // Frame bounds
                var b = it.geometricBounds;
                info.frameBounds = {
                    top: b[0],
                    left: b[1],
                    bottom: b[2],
                    right: b[3],
                    width: b[3] - b[1],
                    height: b[2] - b[0]
                };
                
                results.push(info);
            }
        }
    }
    
    // Output as text
    var lines = [];
    for (var k = 0; k < results.length; k++) {
        var r = results[k];
        var line = "Master: " + r.master + " | ID: " + r.id + " | Label: " + r.label;
        line += " | ContentType: " + r.contentType + " | HasGraphics: " + r.hasGraphics;
        if (r.graphicType) line += " | GraphicType: " + r.graphicType;
        if (r.linkPath) line += " | LinkPath: " + r.linkPath;
        if (r.linkName) line += " | LinkName: " + r.linkName;
        if (r.linkStatus) line += " | Status: " + r.linkStatus;
        lines.push(line);
    }
    
    var output = lines.join("\n");
    
    var f = new File("D:/AI/html-indesign/test/artifacts/debug_graphics.txt");
    f.open("w");
    f.encoding = "UTF-8";
    f.write(output);
    f.close();
    
    return "Found " + results.length + " graphic frames. Output: " + f.fsName;
})();
