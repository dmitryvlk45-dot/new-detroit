/* Development previews; the database independently authorizes every purchase. */
(function(root){
'use strict';
const V=root.ND_CATALOG_V2||(typeof require==='function'?require('./catalog-v2.js'):null);
const names={attribute:['Тело','Рефлексы','Нейропластичность','Харизма'],skill:['Потасовка','Закалка','Атлетика','Стрельба','Скрытность','Пилотирование','Взлом','Инженерия','Дедукция','Общение','Прессинг','Чуйка']};
function requirements(item,c){
 const req=item.requirements??[];
 if(!Array.isArray(req))return ['Требования должен формализовать Мастер'];
 const errors=[];
 if(item.requirementsText||item.availability?.restrictions)errors.push('Текстовые условия требуют уточнения Мастером в справочнике');
 for(const r of req){const ids=r.kind==='attribute'?V.attributeIds:r.kind==='skill'?V.skillIds:[],i=ids.indexOf(r.targetId);if(i<0||!Number.isSafeInteger(r.minimum)||r.minimum<0){errors.push('Неподдерживаемое требование: обратитесь к Мастеру');continue;}if(c[r.kind==='attribute'?'attributes':'skills'][i]<r.minimum)errors.push(`${names[r.kind][i]}: базовое значение от ${r.minimum}`);}
 return errors;
}
function options(c,catalog,history=[]){
 const counts=kind=>history.filter(x=>x.kind===kind).length;
 const rows=[];
 for(const kind of ['attribute','skill']){const ids=kind==='attribute'?V.attributeIds:V.skillIds,values=c[kind==='attribute'?'attributes':'skills'],cost=kind==='attribute'?8:5;
 ids.forEach((id,i)=>{const before=values[i],after=before+1,reasons=[];if(counts(kind)>=2)reasons.push('Лимит за кампанию: 2 из 2');if(kind==='skill'){if(before!==2)reasons.push('Доступно только повышение базового ранга 2 → 3');if(history.some(x=>x.kind===kind&&x.target_id===id))reasons.push('Этот навык уже улучшен за кампанию');}if(c.experience<cost)reasons.push(`Не хватает ${cost-c.experience} ОО`);rows.push({kind,id,name:names[kind][i],before,after,cost,reasons});});}
 const owned=V.normalizeCharacter(c,catalog).equipmentItems.filter(x=>x.snapshot?.classId==='perk'||V.resolve(catalog,x.catalogId)?.classId==='perk');
 for(const item of V.all(catalog).filter(x=>x.classId==='perk'&&!x.archived)){
 const cost=item.economy?.price,reasons=requirements(item,c),learned=owned.filter(x=>x.metadata?.learned||x.location==='learned'||x.legacySlot?.category==='perks');
 if(!Number.isSafeInteger(cost)||cost<0)reasons.push('Мастер должен указать стоимость ОО');else if(c.experience<cost)reasons.push(`Не хватает ${cost-c.experience} ОО`);
 if(owned.filter(x=>x.location==='learned'&&x.equipped!==false&&x.quantity>0).length>=5)reasons.push('Все 5 слотов перков заняты');
 if(!item.repeatable&&(learned.some(x=>x.catalogId===item.catalogId)||history.some(x=>x.kind==='perk'&&x.target_id===item.catalogId)))reasons.push('Перк уже изучен');
 rows.push({kind:'perk',id:item.catalogId,name:item.displayName||item.name,cost,item,reasons});
 }
 return rows;
}
root.ND_PROGRESSION_MODEL={names,requirements,options};
if(typeof module!=='undefined')module.exports=root.ND_PROGRESSION_MODEL;
})(typeof window!=='undefined'?window:globalThis);
