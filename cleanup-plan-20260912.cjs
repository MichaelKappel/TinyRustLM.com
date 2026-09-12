const fs=require('node:fs'),path=require('node:path');
const root='E:\\Source\\Rust\\TinyRustLM.com', audit=path.join(root,'artifacts','cleanup-20260912');
const rows=fs.readFileSync(path.join(audit,'drive-inventory.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const moves=JSON.parse(fs.readFileSync(path.join(audit,'junction-moves.json')));
const modelRoot='D:\\LLMs\\TinyRustLM';
const plan=[];
// Translate inventoried paths after verified junction materialization.
function current(p){for(const m of moves)if(p.startsWith(m.source+'\\'))return m.destination+p.slice(m.source.length);return p;}
// Preserve model identities and adjacent configuration under the designated model store.
function modelDestination(p){
 if(p.startsWith(root+'\\artifacts\\external\\'))return path.join(modelRoot,'sources',p.slice((root+'\\artifacts\\external\\').length));
 if(p.startsWith(root+'\\artifacts\\training\\'))return path.join(modelRoot,'training',p.slice((root+'\\artifacts\\training\\').length));
 if(p.startsWith(root+'\\'))return path.join(modelRoot,'models',path.basename(p));
 return path.join(modelRoot,'experiments',path.relative('E:\\',p));
}
const payload=/\.(safetensors|slm2?|gguf|onnx|pt|pth|ckpt|tokenizer2|template2|sampling2|prompt2|acg2)$/i;
const generated=/[\\/](site-packages|node_modules|playwright-transform-cache|bootstrap-site|bootstrap|extract|obj|\.fingerprint|incremental|deps|home|AppData|frozen-corpus|working-corpus)[\\/]|[\\/]release[\\/]build[\\/]/i;
for(const row of rows){
 if(row.kind!=='file'||!row.candidate||row.candidate==='E:\\Source\\Rust\\TinyRustLM.MiRust.com')continue;
 const p=current(row.path); if(!fs.existsSync(p))continue;
 const isMaterialized=p!==row.path;
 let action='delete',reason='Superseded generated test/build output',destination;
 const oldModel=/qwen3-composition-c1899de-(157b96b|20260825|d8ab21c)|qwen2\.5-0\.5b-base-structural-[abc]|checkpoint-(12|30)[\\/]/i.test(p);
 const modelContext=payload.test(p)||(/(?:tokenizer|vocab|merges|config|generation_config|special_tokens_map|added_tokens|chat_template|tokenizer_config|adapter_config)\.(json|txt|jinja)$/i.test(p)&&!generated.test(p));
 if(oldModel&&payload.test(p)){reason='Superseded model/conversion checkpoint; latest successor and original source retained';}
 else if(modelContext&&!generated.test(p)&&!row.candidate.includes('vnext-tools')&&!/\\(Temp|\.tmp|\.codex-tmp)\\/i.test(p)){
   action='model';destination=modelDestination(p);reason='Model payload/configuration belongs only in D:\\LLMs\\TinyRustLM';
 } else if(isMaterialized){continue;}
 else if(row.candidate==='E:\\TinyRustLM-vnext-tools'){
   reason=p.endsWith('ecosystem-public-readback-v1.mjs')?'Unique retired script preserved in Git archive/cleanup-20260912-readback':'Reproducible third-party tooling environment or compiled cache';
 } else if(!generated.test(p)&&/\.(json|jsonl|ndjson|txt|log|md|csv|manifest|receipt|inspect|out|err|uai|eval)$/i.test(p)&&row.bytes<25*1024*1024){
   action='evidence';destination=path.join(root,'artifacts','retained-evidence',path.relative('E:\\',p));reason='Unique bounded historical receipt/report; no source checkout retained';
 }
 plan.push({source:p,original:row.path,bytes:row.bytes,action,reason,...(destination?{destination}:{})});
}
fs.writeFileSync(path.join(audit,'file-plan.json'),JSON.stringify(plan,null,2));
const sums={};for(const p of plan){let s=sums[p.action]||{files:0,bytes:0};s.files++;s.bytes+=p.bytes;sums[p.action]=s;}console.log(sums);
