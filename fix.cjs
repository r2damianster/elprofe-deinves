const fs = require('fs');
let c = fs.readFileSync('src/components/professor/studio/ActivityEditor.tsx', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/professor/studio/ActivityEditor.tsx', c);
