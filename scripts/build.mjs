import {readdir,mkdir,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'dist');await mkdir(out,{recursive:true});
for(const entry of await readdir(root,{withFileTypes:true})){
  if(entry.isFile()&&/\.(html|css|js)$/.test(entry.name)&&!entry.name.endsWith('.example.js'))await copyFile(path.join(root,entry.name),path.join(out,entry.name));
}
await cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
console.log('Static output built in dist/. Backend, database SQL, tests and documentation are excluded.');
