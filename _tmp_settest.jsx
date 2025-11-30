var doc=app.activeDocument; var page=doc.pages[Math.max(0,doc.pages.length-3)]; var it=page.pageItems[5]; var ok='start'; try{ it.texts[0].contents='TEST'; ok='set'; }catch(e){ ok='err:'+e; } ok;
