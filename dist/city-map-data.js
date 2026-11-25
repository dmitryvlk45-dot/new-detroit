(function(root){'use strict';
 const categories={shop:'Магазин',club:'Клуб / Бар',clinic:'Клиника',contact:'Контакт / NPC',corporation:'Корпорация',industrial:'Завод / Промзона',warehouse:'Склад',shelter:'Укрытие / База',info:'Информационный объект',special:'Особая локация',danger:'Опасность',quest:'Квест / Событие',transport:'Транспортный узел',docks:'Доки / Порт',research:'Исследовательский комплекс',service:'Сервис / Ремонт'};
 const marker=c=>'assets/city-map/markers/categories/'+(['docks','research','service'].includes(c)?'neutral':c in categories?c:'neutral')+'.png';
 function search(data,query,selected=[]){const q=query.trim().toLocaleLowerCase('ru');return {districts:data.districts.filter(d=>!q||[d.name,d.short_description,d.description,d.activity].some(s=>(s||'').toLocaleLowerCase('ru').includes(q))),locations:data.locations.filter(l=>(!selected.length||selected.includes(l.category))&&(!q||[l.name,l.short_description,l.description,l.npc,categories[l.category]].some(s=>(s||'').toLocaleLowerCase('ru').includes(q))))};}
 const position=(latlng)=>({x:Math.min(1,Math.max(0,latlng.lng/6636)),y:Math.min(1,Math.max(0,1-latlng.lat/3792))});
 const latlng=p=>[(1-p.y)*3792,p.x*6636];
 const image=p=>{if(typeof p!=='string')return null;if(p.length<=700000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p))return p;try{const u=new URL(p);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 const locationsAt=(locations,p)=>p?locations.filter(l=>l.position&&Math.abs(l.position.x-p.x)<=1e-7&&Math.abs(l.position.y-p.y)<=1e-7):[];
 const api={categories,marker,search,position,latlng,image,locationsAt,bounds:[[0,0],[3792,6636]]};root.ND_MAP_DATA=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
