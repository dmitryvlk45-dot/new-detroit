const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
test('raw auth expiry is normalized, parallel requests share refresh, stale writes fail',async()=>{
 const storage=new Map(),calls=[];
 const ctx={window:{ND_CONFIG:{url:'https://example.supabase.co',key:'public-test'}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{
  calls.push({url,options});
  let result=[];
  if(url.includes('grant_type=password'))result={access_token:'old',refresh_token:'refresh',expires_in:1,user:{id:'owner'}};
  if(url.includes('grant_type=refresh_token')){await new Promise(r=>setTimeout(r,5));result={access_token:'new',refresh_token:'renewed',expires_in:3600,user:{id:'owner'}};}
  return {ok:true,text:async()=>JSON.stringify(result)};
 }};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/cloud.js'),'utf8'),ctx);
 const c=ctx.window.ND_CLOUD;
 await c.login('test@example.invalid','test');
 assert.ok(JSON.parse(storage.get('nd-session')).expires_at);
 await Promise.all([c.list(),c.list()]);
 assert.equal(calls.filter(x=>x.url.includes('grant_type=refresh_token')).length,1);
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer new');
 await assert.rejects(c.save('id',{},1),/другом окне/);
 await c.logout();assert.equal(c.user(),undefined);
});
