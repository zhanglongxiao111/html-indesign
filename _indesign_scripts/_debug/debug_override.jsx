// Debug override behavior
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var out = "";
    
    try {
        // Create a new page
        var newPage = doc.pages.add(LocationOptions.AT_END);
        newPage.appliedMaster = doc.masterSpreads.itemByName("A-封面");
        
        out += "New page created (before override):\n";
        out += "  newPage.bounds: " + newPage.bounds.join(",") + "\n";
        out += "  newPage.pageItems.length: " + newPage.pageItems.length + "\n";
        
        // Get master items
        var mSpread = doc.masterSpreads.itemByName("A-封面");
        var mPage = mSpread.pages[0];
        var targetMasterItem = null;
        
        for(var i=0; i<mPage.pageItems.length; i++){
            if(mPage.pageItems[i].label && mPage.pageItems[i].label.indexOf("项目英文名") !== -1){
                targetMasterItem = mPage.pageItems[i];
                out += "\nFound master item '项目英文名':\n";
                out += "  geometricBounds: " + targetMasterItem.geometricBounds.join(",") + "\n";
                out += "  allowOverrides: " + targetMasterItem.allowOverrides + "\n";
                break;
            }
        }
        
        if(targetMasterItem){
            // Override single item
            var overridden = targetMasterItem.override(newPage);
            out += "\nAfter override:\n";
            out += "  overridden.geometricBounds: " + overridden.geometricBounds.join(",") + "\n";
            out += "  overridden.parentPage.name: " + overridden.parentPage.name + "\n";
            
            // Calculate offset
            var origBounds = targetMasterItem.geometricBounds;
            var newBounds = overridden.geometricBounds;
            out += "\nOffset calculation:\n";
            out += "  top offset: " + (newBounds[0] - origBounds[0]) + "\n";
            out += "  left offset: " + (newBounds[1] - origBounds[1]) + "\n";
            out += "  bottom offset: " + (newBounds[2] - origBounds[2]) + "\n";
            out += "  right offset: " + (newBounds[3] - origBounds[3]) + "\n";
        }
        
        // Clean up - remove test page
        newPage.remove();
        out += "\nTest page removed.\n";
        
    }catch(e){
        out += "Error: " + e + "\n";
    }
    
    return out;
})();

