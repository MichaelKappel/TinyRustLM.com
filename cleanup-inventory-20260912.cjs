const fs = require('node:fs');
const path = require('node:path');
const root = 'E:\\Source\\Rust\\TinyRustLM.com';
const output = path.join(root, 'artifacts', 'cleanup-20260912', ...(process.argv.includes('--final') ? ['final-scan'] : []));
fs.mkdirSync(output, {recursive:true});
const stream = fs.createWriteStream(path.join(output, 'drive-inventory.jsonl'));
const counts = {directories:0,files:0,errors:0,links:0};
// Inventory identities without reading file contents or traversing reparse links.
async function scan(dir, candidate) {
  let entries;
  try { entries = fs.readdirSync(dir, {withFileTypes:true}); }
  catch(e) { counts.errors++; stream.write(JSON.stringify({kind:'error',path:dir,code:e.code})+'\n'); return; }
  for(const ent of entries) {
    const p=path.join(dir,ent.name);
    if(ent.isSymbolicLink()) {counts.links++;stream.write(JSON.stringify({kind:'link',path:p})+'\n');continue;}
    if(ent.isDirectory()) {
      counts.directories++;
      let next=candidate;
      if(!candidate && /tinyrustlm/i.test(ent.name) && !p.toLowerCase().startsWith(root.toLowerCase()+'\\') && p.toLowerCase()!==root.toLowerCase()) {
        next=p;stream.write(JSON.stringify({kind:'candidate',path:p})+'\n');
      }
      if(ent.name==='.git') {stream.write(JSON.stringify({kind:'git',path:dir,candidate})+'\n');continue;}
      await scan(p,next);
    } else {
      counts.files++;
      if(candidate || /^(taboo\.uai|AGENTS\.md|Cargo\.toml|workspace\.uai)$/i.test(ent.name) || /tinyrustlm/i.test(ent.name)) {
        try {const s=fs.statSync(p);stream.write(JSON.stringify({kind:'file',path:p,bytes:s.size,candidate})+'\n');}catch(e){counts.errors++;stream.write(JSON.stringify({kind:'error',path:p,code:e.code})+'\n');}
      }
    }
  }
  if(counts.directories%2000===0) await new Promise(r=>setImmediate(r));
}
(async()=>{await scan('E:\\',null);stream.end();fs.writeFileSync(path.join(output,'scan-summary.json'),JSON.stringify(counts,null,2));console.log(JSON.stringify(counts));})();
