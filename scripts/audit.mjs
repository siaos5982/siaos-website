import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const files=[];
async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){if(['.git','node_modules','dist'].includes(entry.name))continue;const p=path.join(folder,entry.name);if(entry.isDirectory())await walk(p);else files.push(path.relative(root,p));}}
await walk(root);
let inventory=[];try{inventory=JSON.parse(await readFile(path.join(root,'audit/repository-inventory.json'),'utf8')).files.map(f=>f.path);}catch{}
const known=new Set([...files,...inventory]),pages=[],missing=[];let forms=0;
for(const file of files.filter(f=>f.endsWith('.html'))){
  const content=await readFile(path.join(root,file),'utf8');
  const refs=[...content.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]);
  const ids=[...content.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const formIds=[...content.matchAll(/<form\b[^>]*>/g)].map(m=>m[0]);forms+=formIds.length;
  for(const ref of refs){if(/^(?:https?:|data:|mailto:|tel:|#|\/\/)/.test(ref))continue;const dest=decodeURIComponent(ref.split(/[?#]/)[0]);if(dest&&!known.has(path.normalize(path.join(path.dirname(file),dest))))missing.push({page:file,target:dest});}
  pages.push({file,title:content.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'',forms:formIds.length,scripts:refs.filter(r=>/\.js(?:\?|$)/.test(r)),duplicateIds:ids.filter((id,i)=>ids.indexOf(id)!==i)});
}
const scripts=[];
for(const file of files.filter(f=>f.endsWith('.js')&&!f.startsWith('assets/'))){
  const content=await readFile(path.join(root,file),'utf8');
  const endpoints=[...content.matchAll(/fetch\(([^\n]{1,180})/g)].map(m=>m[1]);
  const storageKeys=[...content.matchAll(/(?:getItem|setItem|removeItem)\(['"]([^'"]+)['"]/g)].map(m=>m[1]);
  scripts.push({file,bytes:Buffer.byteLength(content),endpoints,storageKeys:[...new Set(storageKeys)]});
  for(const m of content.matchAll(/(?:href|src)=["']([a-z][a-z0-9-]*\.(?:html|js))(?:["'?#])/gi))if(!known.has(m[1]))missing.push({page:file,target:m[1]});
}
const output={sourceFiles:files.filter(f=>/\.(?:html|js|css|sql|md|mjs|json|toml)$/.test(f)).length,pageCount:pages.length,formCount:forms,pages,scripts,missingReferences:missing};
console.log(JSON.stringify(output,null,2));
