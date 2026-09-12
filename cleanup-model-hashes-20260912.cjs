const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const audit=path.join('artifacts','cleanup-20260912');
const files=JSON.parse(fs.readFileSync(path.join(audit,'d-model-inventory.json')));
const moved=new Set(['file-plan.json','model-store-plan.json'].flatMap(n=>JSON.parse(fs.readFileSync(path.join(audit,n))).filter(r=>r.action==='model').map(r=>r.destination.toLowerCase())));
const groups=new Map();for(const f of files){const g=groups.get(f.bytes)||[];g.push(f);groups.set(f.bytes,g);}
// Stream model bytes; compare only size groups containing newly consolidated files.
async function hash(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
(async()=>{const duplicates=[],identities=[];let bytes=0,count=0;for(const group of groups.values()){
 if(group.length<2||!group.some(f=>moved.has(f.path.toLowerCase())))continue;
 group.sort((a,b)=>Number(moved.has(a.path.toLowerCase()))-Number(moved.has(b.path.toLowerCase()))||a.path.localeCompare(b.path));
 const known=new Map();for(const f of group){const sha256=await hash(f.path);bytes+=f.bytes;count++;identities.push({...f,sha256});
 if(known.has(sha256)&&moved.has(f.path.toLowerCase()))duplicates.push({source:f.path,retained:known.get(sha256),bytes:f.bytes,sha256});else if(!known.has(sha256))known.set(sha256,f.path);
 if(count%10===0)console.log(`Hashed ${count} model files (${Math.round(bytes/1e9)} GB)`);
 }}fs.writeFileSync(path.join(audit,'model-hash-identities.json'),JSON.stringify(identities,null,2));fs.writeFileSync(path.join(audit,'duplicate-model-plan.json'),JSON.stringify(duplicates,null,2));console.log({duplicates:duplicates.length,bytes:duplicates.reduce((s,r)=>s+r.bytes,0)});})();
