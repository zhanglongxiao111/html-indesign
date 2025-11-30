var f=File('"'"'D:/AI/html-indesign/_indesign_scripts/build_from_instructions.jsx'"'"');
f.open('"'"'r'"'"'); var txt=f.read(); f.close();
try{ eval(txt); $.writeln('"'"'ok'"'"'); }catch(e){ $.writeln('"'"'ERR:'"'"'+e+'"'"' line:'"'"'+ e.line); }
