/**
 * debug_all_textframes.jsx - List ALL textframes on the last page
 */
(function(){
    if(app.documents.length===0) return "No document.";
    var doc=app.activeDocument;
    var pageIndex = doc.pages.length - 1;
    var page = doc.pages[pageIndex];
    
    var result = [];
    result.push("Page "+(pageIndex+1)+" checking all textFrames");
    result.push("page.textFrames.length = "+page.textFrames.length);
    
    // Try to iterate with everyItem
    try {
        var allTF = page.textFrames.everyItem().getElements();
        result.push("everyItem count = "+allTF.length);
        for(var i=0; i<allTF.length; i++){
            var tf = allTF[i];
            var b = tf.geometricBounds;
            var topMM = Math.round(b[0]/2.8346);
            var leftMM = Math.round(b[1]/2.8346);
            result.push("TF"+(i+1)+": ["+leftMM+"mm,"+topMM+"mm] \""+String(tf.contents).substring(0,30)+"\"");
        }
    } catch(e) {
        result.push("Error: "+e);
    }
    
    // Also check spread - NO conversion, raw values
    try {
        var spread = page.parent;
        result.push("--- Spread textFrames: "+spread.textFrames.length+" (RAW bounds) ---");
        var spreadTF = spread.textFrames.everyItem().getElements();
        for(var j=0; j<spreadTF.length; j++){
            var stf = spreadTF[j];
            var sb = stf.geometricBounds;
            // Raw bounds: [top, left, bottom, right]
            result.push("SpreadTF"+(j+1)+": bounds=["+sb[0]+","+sb[1]+","+sb[2]+","+sb[3]+"] \""+String(stf.contents).substring(0,20)+"\"");
        }
    } catch(e2) {
        result.push("Spread error: "+e2);
    }

    return result.join("\n");
})();

