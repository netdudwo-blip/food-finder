const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const create=require('./lib/search-cache');
test('stored search survives reload and stale response survives upstream failure',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'search-check-'));
 let calls=0;
 const first=create(async()=>{calls++;return [{PRDLST_NM:'검증'}]},dir);
 await Promise.all([first('검증','all'),first('검증','all')]);assert.equal(calls,1);
 const file=path.join(dir,(await fs.readdir(dir))[0]),data=JSON.parse(await fs.readFile(file));
 data.checkedAt=Date.now()-600000;await fs.writeFile(file,JSON.stringify(data));
 const reload=create(async()=>{throw Error('timeout')},dir);
 const result=await reload('검증','all');assert.equal(result.stale,true);assert.equal(result.rows[0].PRDLST_NM,'검증');
});
