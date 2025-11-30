var doc=app.documents.length?app.activeDocument:null; var msg='no doc'; if(doc){try{msg=doc.extractLabel('build_last_result');}catch(e){msg='err:'+e;}} msg;
