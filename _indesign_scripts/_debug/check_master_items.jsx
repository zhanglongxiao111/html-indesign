// Check master page items positions
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var out = "";
    
    // Check A-封面 master
    try {
        var master = doc.masterSpreads.itemByName("A-封面");
        var mPage = master.pages[0];
        out += "Master A-封面 bounds: " + mPage.bounds.join(",") + "\n";
        out += "Items on master:\n";
        
        var items = mPage.pageItems;
        for(var i=0; i<items.length; i++){
            var item = items[i];
            var label = (item.label || "").substring(0, 20);
            out += "  - " + item.geometricBounds.join(",") + " [" + label + "]\n";
        }
    }catch(e){
        out += "Error: " + e + "\n";
    }
    
    out += "\n--- Page 1 (应该是原始模板) ---\n";
    try {
        var p0 = doc.pages[0];
        out += "Page 0 bounds: " + p0.bounds.join(",") + "\n";
        var items0 = p0.pageItems;
        for(var j=0; j<items0.length; j++){
            var it0 = items0[j];
            var lab0 = (it0.label || "").substring(0, 20);
            out += "  - " + it0.geometricBounds.join(",") + " [" + lab0 + "]\n";
        }
    }catch(e2){
        out += "Error: " + e2 + "\n";
    }
    
    out += "\n--- Page 2 (JSX创建的封面) ---\n";
    try {
        var p1 = doc.pages[1];
        out += "Page 1 bounds: " + p1.bounds.join(",") + "\n";
        var items1 = p1.pageItems;
        for(var k=0; k<items1.length; k++){
            var it1 = items1[k];
            var lab1 = (it1.label || "").substring(0, 20);
            out += "  - " + it1.geometricBounds.join(",") + " [" + lab1 + "]\n";
        }
    }catch(e3){
        out += "Error: " + e3 + "\n";
    }
    
    return out;
})();

