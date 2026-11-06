window.ND_CLOUD=(()=>{
 let session;try{session=JSON.parse(sessionStorage.getItem('nd-session')||'null');}catch{}
 const cfg=window.ND_CONFIG;
 const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&!!cfg.key;
 async function request(path,{method='GET',body,headers={},auth=true}={}){
  if(!configured())throw Error('Общее хранилище ещё не подключено');
  if(auth&&session&&session.expires_at*1000<Date.now()+60000){const r=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});setSession(r);}
  const response=await fetch(cfg.url+path,{method,headers:{apikey:cfg.key,'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  const raw=await response.text();let result;try{result=raw?JSON.parse(raw):null;}catch{throw Error('Сервис вернул неожиданный ответ');}
  if(!response.ok)throw Error(result?.msg||result?.message||result?.error_description||'Ошибка соединения');
  return result;
 }
 function setSession(s){session=s;sessionStorage.setItem('nd-session',JSON.stringify(s));}
 return {configured,user:()=>session?.user,
  async login(email,password){setSession(await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false}));},
  async signup(email,password){return request('/auth/v1/signup',{method:'POST',body:{email,password},auth:false});},
  async logout(){try{await request('/auth/v1/logout',{method:'POST'});}finally{session=null;sessionStorage.removeItem('nd-session');}},
  list:()=>request('/rest/v1/characters?select=id,owner_id,data,revision,updated_at&order=updated_at.desc'),
  async load(id){const r=await request('/rest/v1/characters?id=eq.'+encodeURIComponent(id)+'&select=*');if(!r?.[0])throw Error('Карточка не найдена или доступ ещё не выдан');return r[0];},
  async create(data){return (await request('/rest/v1/characters',{method:'POST',headers:{Prefer:'return=representation'},body:{owner_id:session.user.id,data}}))[0];},
  async save(id,data,revision){const r=await request('/rest/v1/characters?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:{data,revision:revision+1}});if(!r?.length)throw Error('Карточка изменена в другом окне или нет прав. Экспортируй свою копию и открой актуальную через «Мои карточки».');return r[0];},
  grant:(id,email,role)=>request('/rest/v1/character_access',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:{character_id:id,email:email.trim().toLowerCase(),role}}),
  grants:id=>request('/rest/v1/character_access?character_id=eq.'+encodeURIComponent(id)+'&select=email,role'),
  revoke:(id,email)=>request('/rest/v1/character_access?character_id=eq.'+encodeURIComponent(id)+'&email=eq.'+encodeURIComponent(email),{method:'DELETE'})
 };
})();
