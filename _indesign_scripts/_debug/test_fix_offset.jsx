// Test fixing override offset
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var out = "";
    
    try {
        // Create a new page
        var newPage = doc.pages.add(LocationOptions.AT_END);
        newPage.appliedMaster = doc.masterSpreads.itemByName("A-封面");
        
        // Get master items
        var mSpread = doc.masterSpreads.itemByName("A-封面");
        var mPage = mSpread.pages[0];
        
        for(var i=0; i<mPage.pageItems.length; i++){
            var mItem = mPage.pageItems[i];
            if(!mItem.label || mItem.label === "") continue;
            if(!mItem.allowOverrides) continue;
            
            var origBounds = mItem.geometricBounds;
            var overridden = mItem.override(newPage);
            
            // Fix position - move back to original bounds
            try {
                overridden.geometricBounds = origBounds;
            }catch(moveErr){
                out += "Move error for " + mItem.label.substring(0,15) + ": " + moveErr + "\n";
            }
        }
        
        out += "Override with position fix done.\n";
        
        // Verify
        var pItems = newPage.pageItems;
        for(var j=0; j<pItems.length; j++){
            if(pItems[j].label && pItems[j].label.indexOf("项目英文名") !== -1){
                out += "After fix '项目英文名': " + pItems[j].geometricBounds.join(",") + "\n";
                break;
            }
        }
        
    }catch(e){
        out += "Error: " + e + "\n";
    }
    
    return out;
})();

