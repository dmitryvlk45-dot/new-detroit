// Explicitly run against the configured project; creates one disposable QA account.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/config.js'),'utf8'),ctx);
const {url,key}=ctx.window.ND_CONFIG;
const login='ndqa_'+Date.now();
(async()=>{
 const r=await fetch(url+'/functions/v1/register-player',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({login,password:'111111'})});
 const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));
 const a=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:login+'@players.new-detroit.invalid',password:'111111'})});
 const session=await a.json();assert.equal(a.status,200,'Login failed');
 const headers={apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};
 const role=await fetch(url+'/rest/v1/rpc/is_master',{method:'POST',headers,body:'{}'});assert.equal(await role.json(),false);
 const cards=await fetch(url+'/rest/v1/characters?select=id',{headers});assert.deepEqual(await cards.json(),[]);
 console.log(JSON.stringify({result:'PASS registration with 111111, login, player role, empty cards',login,id:session.user.id}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
