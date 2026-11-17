'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
module.exports=function createCache(load,dir){
 const entries=new Map();
 return async function get(query,field){
  const key=JSON.stringify([query,field]);
  if(!entries.has(key)){
   const file=path.join(dir,crypto.createHash('sha256').update(key).digest('hex')+'.json');
   const entry={file,rows:null,checkedAt:null,pending:null};
   entry.ready=fs.readFile(file,'utf8').then(JSON.parse).then(saved=>{
    if(saved.key===key&&Array.isArray(saved.rows)&&Number.isFinite(saved.checkedAt)&&Date.now()-saved.checkedAt<86400000){
     entry.rows=saved.rows;entry.checkedAt=saved.checkedAt;
    }
   }).catch(()=>{});
   entries.set(key,entry);
   if(entries.size>100)entries.delete(entries.keys().next().value);
  }
  const entry=entries.get(key);await entry.ready;
  function refresh(){
   if(entry.pending)return entry.pending;
   entry.pending=(async()=>{
    const rows=await load(query,field),checkedAt=Date.now();
    entry.rows=rows;entry.checkedAt=checkedAt;
    try{
     await fs.mkdir(dir,{recursive:true});
     const tmp=entry.file+'.'+crypto.randomUUID()+'.tmp';
     await fs.writeFile(tmp,JSON.stringify({key,rows,checkedAt}));
     await fs.rename(tmp,entry.file);
    }catch{}
   })().finally(()=>{entry.pending=null});
   return entry.pending;
  }
  const stale=entry.rows!==null&&Date.now()-entry.checkedAt>300000;
  if(entry.rows===null||Date.now()-entry.checkedAt>86400000)await refresh();
  else if(stale)refresh().catch(()=>{});
  return {rows:entry.rows,checkedAt:entry.checkedAt,stale};
 };
};
