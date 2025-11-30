// Check page offset and bounds
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var result = [];
    
    for(var i=0; i<doc.pages.length; i++){
        var p = doc.pages[i];
        var info = {
            pageIndex: i,
            pageName: p.name,
            bounds: p.bounds.join(","),
            marginPref: null
        };
        try {
            info.marginPref = {
                top: p.marginPreferences.top,
                left: p.marginPreferences.left,
                bottom: p.marginPreferences.bottom,
                right: p.marginPreferences.right
            };
        }catch(_){}
        
        // Check first item position
        if(p.pageItems.length > 0){
            var item = p.pageItems[0];
            info.firstItemBounds = item.geometricBounds.join(",");
            info.firstItemLabel = (item.label || "").substring(0, 30);
        }
        
        result.push(info);
    }
    
    // ExtendScript doesn't have JSON, build string manually
    var out = "";
    for(var r=0; r<result.length; r++){
        var ri = result[r];
        out += "Page " + ri.pageIndex + " (" + ri.pageName + "): bounds=" + ri.bounds;
        if(ri.firstItemBounds) out += " | firstItem=" + ri.firstItemBounds + " [" + ri.firstItemLabel + "]";
        out += "\n";
    }
    return out;
})();

