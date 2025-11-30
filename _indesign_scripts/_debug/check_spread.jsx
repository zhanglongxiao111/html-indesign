// Check spread coordinate differences
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var out = "";
    
    try {
        // Master spread
        var mSpread = doc.masterSpreads.itemByName("A-封面");
        var mPage = mSpread.pages[0];
        out += "Master spread 'A-封面':\n";
        out += "  mPage.bounds: " + mPage.bounds.join(",") + "\n";
        
        // Get an item from master
        var mItems = mPage.allPageItems;
        for(var i=0; i<mItems.length; i++){
            if(mItems[i].label && mItems[i].label.indexOf("项目英文名") !== -1){
                out += "  '项目英文名' on master: " + mItems[i].geometricBounds.join(",") + "\n";
                break;
            }
        }
        
        // Regular page spread
        var p1 = doc.pages[1];
        var spread1 = p1.parent; // Get parent spread
        out += "\nPage 1 spread:\n";
        out += "  p1.bounds: " + p1.bounds.join(",") + "\n";
        
        // Get overridden item
        var pItems = p1.allPageItems;
        for(var j=0; j<pItems.length; j++){
            if(pItems[j].label && pItems[j].label.indexOf("项目英文名") !== -1){
                out += "  '项目英文名' on page: " + pItems[j].geometricBounds.join(",") + "\n";
                out += "  item.parentPage: " + (pItems[j].parentPage ? pItems[j].parentPage.name : "none") + "\n";
                break;
            }
        }
        
        // Check if there's a transform issue
        out += "\nPage coordination check:\n";
        out += "  doc.zeroPoint: " + doc.zeroPoint.join(",") + "\n";
        out += "  doc.viewPreferences.rulerOrigin: " + doc.viewPreferences.rulerOrigin + "\n";
        
    }catch(e){
        out += "Error: " + e + "\n";
    }
    
    return out;
})();

