var out=[]; if(app.documents.length){var doc=app.activeDocument; for(var i=0;i<doc.masterSpreads.length;i++){ var m=doc.masterSpreads[i]; out.push(i+':'+m.name); }} out.join('\\n');
