// Remove all pages except the first one for testing
(function(){
    if(app.documents.length === 0) return "No document";
    var doc = app.activeDocument;
    var count = doc.pages.length;
    if(count <= 1) return "Only 1 page, nothing to remove";
    
    // Remove pages from end to beginning (except first)
    for(var i = count - 1; i >= 1; i--){
        try{
            doc.pages[i].remove();
        }catch(e){}
    }
    return "Removed " + (count - 1) + " pages. Now have " + doc.pages.length + " page(s).";
})();

