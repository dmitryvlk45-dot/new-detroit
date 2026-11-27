const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../dist/cyberpsychosis-model.js'),E=require('../dist/engine.js'),V=require('../dist/catalog-v2.js');
const raw={window:{}};vm.runInNewContext(fs.readFileSync('dist/data.js','utf8'),raw);const D=raw.window.ND_DATA;
test('Official stage boundaries and variable limits, including zero capacity',()=>{
 for(const [u,m,s] of [[6,7,0],[7,7,0],[8,7,1],[10,7,1],[11,7,2],[14,7,2],[15,7,3],[10,10,0],[11,10,1],[14,10,2],[18,10,3],[1,0,1],[8,0,3]])assert.equal(P.state(u,m).stage,s,`${u}/${m}`);
 assert.equal(P.state(NaN,7).stage,0);
});
test('Installing and removing actual equipment recalculates stages without changing game data',()=>{
 const catalog=V.normalizeCatalog(D.catalog);let c=E.blank(D);c.attributes=[2,1,1,0];
 for(let i=0;i<3;i++)catalog.implants.push(V.normalizeItem({name:'psy-qa-'+i,classId:'implant',slots:[8,3,4][i],effects:[]},'implants'));
 const states=[];
 for(let i=0;i<3;i++){const item=catalog.implants.find(x=>x.name==='psy-qa-'+i);c=V.addEquipment(c,catalog,item.catalogId);c=V.setEquipmentState(c,catalog,c.equipmentItems.at(-1).instanceId,'installed');const before=JSON.stringify(c);states.push(E.derive(c,catalog).cyberpsychosis.stage);assert.equal(JSON.stringify(c),before);}
 assert.deepEqual(states,[1,2,3]);
 c=V.setEquipmentState(c,catalog,c.equipmentItems.at(-1).instanceId,'inventory');assert.equal(E.derive(c,catalog).cyberpsychosis.stage,2);
 for(const x of c.equipmentItems)c=V.setEquipmentState(c,catalog,x.instanceId,'inventory');assert.equal(E.derive(c,catalog).cyberpsychosis.stage,0);
 assert.equal(c.hp,3);assert.equal(c.experience,0);assert.deepEqual(c.skills,Array(12).fill(0));
});
function fixture(){const events={},stored={},root={dataset:{},querySelector:()=>null};const ctx={window:{addEventListener:(n,f)=>events[n]=f,matchMedia:()=>({matches:false,addEventListener:(n,f)=>events.motion=f})},document:{hidden:false,querySelector:()=>root,addEventListener:(n,f)=>events[n]=f},localStorage:{getItem:k=>stored[k],setItem:(k,v)=>stored[k]=v}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/cyberpsychosis-ui.js','utf8'),ctx);return{ctx,root,events,stored,ui:ctx.window.ND_CYBER_UI};}
test('Warning is real accessible HTML and norm emits no effects; stage is not persisted in card',()=>{
 const f=fixture();assert.equal(f.ui.layers(P.state(7,7)),'');assert.equal(f.ui.metric({cyberpsychosis:P.state(7,7)}),'');
 for(const [used,stage] of [[8,1],[11,2],[15,3]]){const d={used,capacity:7,cyberpsychosis:P.state(used,7)};assert.match(f.ui.attrs(d.cyberpsychosis,'overview'),new RegExp(`data-cyber-stage="${stage}"`));const html=f.ui.metric(d);assert.match(html,/КИБЕРПСИХОЗ/);assert.match(html,/aria-hidden="true"/);assert.match(html,new RegExp('Хром: '+used+' / 7'));assert.match(html,/Превышение: \+/);}
});
test('Hidden tabs pause decoration, cross-tab preference persists, all six sections share derived state',()=>{
 const f=fixture();f.ctx.document.hidden=true;f.events.visibilitychange();assert.equal(f.root.dataset.cyberPaused,'true');f.events.storage({key:'nd-reduce-cyber-effects',newValue:'true'});assert.equal(f.root.dataset.cyberEffects,'reduced');
 for(const tab of ['overview','inventory','chrome','network','notes','city-map'])assert.match(f.ui.attrs(P.state(15,7),tab),/data-cyber-stage="3"/);
});
test('PNG inventory is complete, decorative layers cannot receive clicks, reduced motion is scoped',()=>{
 const manifest=JSON.parse(fs.readFileSync('asset-sources/cyberpsychosis-manifest.json','utf8').replace(/^\uFEFF/,''));assert.equal(manifest.length,19);
 for(const row of manifest)assert(fs.existsSync('dist/assets/cyberpsychosis/'+row.file));
 const css=fs.readFileSync('dist/cyberpsychosis.css','utf8');assert.match(css,/pointer-events:none!important/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/body:has\(dialog\[open\]\)/);assert.match(css,/@media\(max-width:700px\)/);assert.doesNotMatch(css,/\.character-sheet\s*\{[^}]*transform:/);
});
