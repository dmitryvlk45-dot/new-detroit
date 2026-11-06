(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function derive(c,catalog){
  const maxHP=3+c.attributes[0];
  const armor=catalog.armor.find(x=>x.name===c.armor)?.armor||0;
  const used=c.implants.reduce((n,x)=>n+(catalog.implants.find(i=>i.name===x.name)?.slots||0),0);
  const capacity=3+2*c.attributes[0];
  return {maxHP,armor,currentArmor:Math.max(0,armor-c.armorSpent),used,capacity,freeChrome:capacity-used,psychosis:Math.max(0,used-capacity),skillPoints:4+c.attributes[2]-c.skills.reduce((a,b)=>a+b,0),validAttributes:c.attributes.slice().sort().join() === '0,1,1,2'};
 }
 function validate(c,data){
  if(!c||typeof c!=='object')throw Error('Некорректная карточка');
  for(const [k,len,max] of [['attributes',4,2],['skills',12,3]])if(!Array.isArray(c[k])||c[k].length!==len||c[k].some(x=>!Number.isInteger(x)||x<0||x>max))throw Error('Некорректные характеристики или навыки');
  for(const k of ['name','nickname','age','bio'])if(typeof c[k]!=='string'||c[k].length>20000)throw Error('Некорректное поле '+k);
  for(const k of ['hp','armorSpent','money'])if(!Number.isFinite(c[k])||c[k]<0)throw Error('Некорректное число '+k);
  if(!Number.isInteger(c.hp)||!Number.isInteger(c.armorSpent)||c.hp>3+c.attributes[0])throw Error('Некорректное здоровье');
  for(const [k,len] of [['weapons',2],['implants',9],['programs',5],['perks',5],['consumables',6]]){
   if(!Array.isArray(c[k])||c[k].length!==len)throw Error('Неверное число слотов '+k);
   c[k].forEach(x=>{const name=typeof x==='string'?x:x?.name;if(typeof name!=='string'||(name&&!data.catalog[k].some(i=>i.name===name)))throw Error('Неизвестный предмет '+k);if(k==='implants'&&(typeof x.quality!=='string'||x.quality.length>200))throw Error('Некорректное качество');if(k==='consumables'&&x.quantity!==''&&(!Number.isInteger(x.quantity)||x.quantity<0))throw Error('Некорректное количество');});
  }
  if(c.armor!==''&&!data.catalog.armor.some(x=>x.name===c.armor))throw Error('Неизвестная броня');
  for(const [k,fields] of [['inventory',['name','description']],['notes',['location','npc','text']]]){if(!Array.isArray(c[k])||c[k].length>500)throw Error('Слишком много записей');for(const row of c[k])for(const f of fields)if(typeof row[f]!=='string'||row[f].length>20000)throw Error('Некорректная запись');}
  const result=clone(data.initial);for(const k of Object.keys(result))result[k]=clone(c[k]);return result;
 }
 root.ND_ENGINE={derive,validate,clone};
 if(typeof module!=='undefined')module.exports=root.ND_ENGINE;
})(typeof window!=='undefined'?window:globalThis);
