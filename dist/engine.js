(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const J=root.ND_JOURNAL_MODEL||(typeof require==='function'?require('./journal-model.js'):null);
 const V=root.ND_CATALOG_V2||(typeof require==='function'?require('./catalog-v2.js'):null);
 const P=root.ND_CYBER_MODEL||(typeof require==='function'?require('./cyberpsychosis-model.js'):null);
 function derive(c,catalog){
  const stats=V.calculateCharacterStats(c,catalog),{maxHP,armor,currentArmor}=stats,{used,capacity}=stats.chrome;
  return {cyberpsychosis:P.state(used,capacity),maxHP,armor,currentArmor,used,capacity,freeChrome:capacity-used,psychosis:Math.max(0,used-capacity),skillPoints:4+c.attributes[2]-c.skills.reduce((a,b)=>a+b,0)+(c.developmentSkillOffset||0),validAttributes:c.attributes.slice().sort().join() === '0,1,1,2',stats};
 }
 function validate(c,data){
  if(!c||typeof c!=='object')throw Error('Некорректная карточка');
  for(const [k,len,max] of [['attributes',4,Number.MAX_SAFE_INTEGER],['skills',12,3]])if(!Array.isArray(c[k])||c[k].length!==len||c[k].some(x=>!Number.isSafeInteger(x)||x<0||x>max))throw Error('Некорректные характеристики или навыки');
  for(const k of ['name','nickname','age','bio'])if(typeof c[k]!=='string'||c[k].length>20000)throw Error('Некорректное поле '+k);
  for(const k of ['hp','armorSpent','money'])if(!Number.isFinite(c[k])||c[k]<0)throw Error('Некорректное число '+k);
  if(!Number.isInteger(c.hp)||!Number.isInteger(c.armorSpent))throw Error('Некорректное здоровье');
  for(const [k,len] of [['weapons',2],['implants',9],['programs',5],['perks',5],['consumables',6]]){
   if(!Array.isArray(c[k])||c[k].length!==len)throw Error('Неверное число слотов '+k);
   c[k].forEach(x=>{const name=typeof x==='string'?x:x?.name;if(typeof name!=='string'||name.length>20000)throw Error('Некорректный предмет '+k);if(k==='implants'&&(typeof x.quality!=='string'||x.quality.length>200))throw Error('Некорректное качество');if(k==='consumables'&&x.quantity!==''&&(!Number.isInteger(x.quantity)||x.quantity<0))throw Error('Некорректное количество');});
  }
  if(typeof c.armor!=='string'||c.armor.length>20000)throw Error('Некорректная броня');
  if(c.equipmentVersion!==undefined){V.normalizeCharacter(c,data.catalog);}
  if(c.resourceAdjustments!==undefined){const a=c.resourceAdjustments;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['hp','armor'].includes(k))||Object.values(a).some(v=>!Number.isSafeInteger(v)||Math.abs(v)>10000))throw Error('Некорректная поправка максимума ресурса');}
  const maximum=derive(c,data.catalog).maxHP;if(c.hp>maximum&&c.equipmentVersion!==2)throw Error('Некорректное здоровье');
  for(const [k,fields] of [['inventory',['name','description']]]){if(!Array.isArray(c[k])||c[k].length>500)throw Error('Слишком много записей');for(const row of c[k])for(const f of fields)if(typeof row[f]!=='string'||row[f].length>20000)throw Error('Некорректная запись');}
  for(const row of c.inventory)if(row.quantity!==undefined&&(!Number.isSafeInteger(row.quantity)||row.quantity<1))throw Error('Количество ручного предмета должно быть целым числом от 1');
  if(c.photo!==undefined&&(typeof c.photo!=='string'||c.photo.length>500000||(c.photo!==''&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.photo))))throw Error('Некорректный портрет');
  if(c.experience!==undefined&&(!Number.isSafeInteger(c.experience)||c.experience<0))throw Error('Опыт должен быть целым неотрицательным числом');
  const result=clone(data.initial);for(const k of Object.keys(result))result[k]=clone(c[k]);
  result.notes=J.normalize(c.notes);
  result.experience=c.experience??0;
  if(c.developmentSkillOffset!==undefined){if(!Number.isSafeInteger(c.developmentSkillOffset))throw Error('Некорректная поправка стартового бюджета');result.developmentSkillOffset=c.developmentSkillOffset;}
  if(c.resourceAdjustments!==undefined)result.resourceAdjustments=clone(c.resourceAdjustments);
  if(c.photo!==undefined)result.photo=c.photo;
  if(c.equipmentVersion!==undefined){result.equipmentVersion=c.equipmentVersion;result.equipmentItems=V.validateInstances(c.equipmentItems);result.hp=Math.min(result.hp,maximum);}
  return result;
 }
 function blank(data){const c=clone(data.initial);for(const k of ['name','nickname','age','bio','armor'])c[k]='';c.photo='';c.attributes=[0,0,0,0];c.skills=Array(12).fill(0);c.hp=3;c.armorSpent=0;c.money=0;c.experience=0;for(const k of ['weapons','programs','perks'])c[k]=c[k].map(()=>'');c.implants=c.implants.map(()=>({name:'',quality:''}));c.consumables=c.consumables.map(()=>({name:'',quantity:''}));c.inventory=[];c.notes=[];return c;}
 function validateCreation(c,data){validate(c,data);if(c.skills.some(x=>x>2))throw Error('При создании персонажа навык не может быть выше 2');const d=derive(c,data.catalog);if(!d.validAttributes)throw Error('Распредели характеристики: 2, 1, 1, 0');if(d.skillPoints!==0)throw Error(d.skillPoints<0?'Потрачено слишком много очков навыков':'Распредели все очки навыков');return c;}
 function clearCardCache(storage,id){for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('nd-draft-')&&key.endsWith('-'+id))storage.removeItem(key);}}
 const canSpendExperience=(c,catalog=root.ND_DATA?.catalog)=>{if(!Number.isSafeInteger(c.experience)||c.experience<0)return false;if(c.experience>=2)return true;const M=root.ND_PROGRESSION_MODEL||(typeof require==='function'?require('./progression-model.js'):null);return !!(M&&catalog&&M.options(c,catalog).some(x=>x.kind==='perk'&&!x.reasons.length));};
 root.ND_ENGINE={derive,validate,clone,blank,validateCreation,clearCardCache,canSpendExperience,calculateCharacterStats:V.calculateCharacterStats,calculateCheckModifier:V.calculateCheckModifier,normalizeCharacter:V.normalizeCharacter,migrateLegacyCharacter:V.normalizeCharacter};
 if(typeof module!=='undefined')module.exports=root.ND_ENGINE;
})(typeof window!=='undefined'?window:globalThis);
