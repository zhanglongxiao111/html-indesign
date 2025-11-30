// Check document bleed settings
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var out = "";
    
    try {
        var dp = doc.documentPreferences;
        out += "Document preferences:\n";
        out += "  pageWidth: " + dp.pageWidth + "\n";
        out += "  pageHeight: " + dp.pageHeight + "\n";
        out += "  facingPages: " + dp.facingPages + "\n";
    }catch(e){
        out += "DocPref error: " + e + "\n";
    }
    
    try {
        var bleed = doc.documentPreferences.documentBleedTopOffset;
        out += "\nBleed settings:\n";
        out += "  top: " + doc.documentPreferences.documentBleedTopOffset + "\n";
        out += "  bottom: " + doc.documentPreferences.documentBleedBottomOffset + "\n";
        out += "  inside: " + doc.documentPreferences.documentBleedInsideOrLeftOffset + "\n";
        out += "  outside: " + doc.documentPreferences.documentBleedOutsideOrRightOffset + "\n";
    }catch(e2){
        out += "Bleed error: " + e2 + "\n";
    }
    
    try {
        out += "\nMaster A-封面 page:\n";
        var master = doc.masterSpreads.itemByName("A-封面");
        var mPage = master.pages[0];
        out += "  bounds: " + mPage.bounds.join(",") + "\n";
        
        out += "\nRegular page 0:\n";
        var p0 = doc.pages[0];
        out += "  bounds: " + p0.bounds.join(",") + "\n";
        
        out += "\nRegular page 1 (JSX created):\n";
        var p1 = doc.pages[1];
        out += "  bounds: " + p1.bounds.join(",") + "\n";
    }catch(e3){
        out += "Pages error: " + e3 + "\n";
    }
    
    return out;
})();

