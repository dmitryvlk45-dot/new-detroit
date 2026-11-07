window.ND_CLOUD=(()=>{
 let session;try{session=JSON.parse(sessionStorage.getItem('nd-session')||'null');}catch{}
 const cfg=window.ND_CONFIG;
 let refreshPending=null;
 const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&!!cfg.key;
 async function request(path,{method='GET',body,headers={},auth=true}={}){
  if(!configured())throw Error('Общее хранилище ещё не подключено');
  if(auth&&session&&(!session.expires_at||session.expires_at*1000<Date.now()+60000)){
   if(!refreshPending)refreshPending=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false}).then(setSession).finally(()=>{refreshPending=null;});
   await refreshPending;
  }
  const controller=typeof AbortController==='function'?new AbortController():null;
  const timeout=controller?setTimeout(()=>controller.abort(),15000):null;
  let response;
  try{response=await fetch(cfg.url+path,{method,headers:{apikey:cfg.key,'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.access_token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),...(controller?{signal:controller.signal}:{})});}
  catch(e){if(e.name==='AbortError')throw Error('Сервер не ответил вовремя. Проверь соединение и попробуй ещё раз.');throw e;}
  finally{if(timeout)clearTimeout(timeout);}
  const raw=await response.text();let result;try{result=raw?JSON.parse(raw):null;}catch{throw Error('Сервис вернул неожиданный ответ');}
  if(!response.ok)throw Error(result?.msg||result?.message||result?.error_description||'Ошибка соединения');
  return result;
 }
 function setSession(s){session={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)};sessionStorage.setItem('nd-session',JSON.stringify(session));}
 const address=login=>login.trim().toLowerCase().includes('@')?login.trim().toLowerCase():login.trim().toLowerCase()+'@players.new-detroit.invalid';
 return {configured,user:()=>session?.user,
  isMaster:()=>request('/rest/v1/rpc/is_master',{method:'POST',body:{}}),
  async login(login,password){setSession(await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:address(login),password},auth:false}));},
  async signup(login,password){return request('/functions/v1/register-player',{method:'POST',body:{login,password},auth:false});},
  async logout(){try{await request('/auth/v1/logout',{method:'POST'});}finally{session=null;sessionStorage.removeItem('nd-session');}},
  list:()=>request('/rest/v1/characters?select=id,owner_id,data,revision,updated_at&order=updated_at.desc'),
  async load(id){const r=await request('/rest/v1/characters?id=eq.'+encodeURIComponent(id)+'&select=*');if(!r?.[0]){const e=Error('Карточка удалена или доступ к ней закрыт');e.code='CARD_UNAVAILABLE';throw e;}return r[0];},
  async remove(id,revision){const r=await request('/rest/v1/characters?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!r?.length)throw Error('Карточка уже изменена, удалена или нет прав. Обнови список перед повторной попыткой.');},
  async create(data){return (await request('/rest/v1/characters',{method:'POST',headers:{Prefer:'return=representation'},body:{owner_id:session.user.id,data}}))[0];},
  async save(id,data,revision){const r=await request('/rest/v1/characters?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+revision,{method:'PATCH',headers:{Prefer:'return=representation'},body:{data,revision:revision+1}});if(!r?.length)throw Error('Карточка изменена в другом окне или нет прав. Экспортируй свою копию и открой актуальную через «Мои карточки».');return r[0];},
  grant:(id,email,role)=>request('/rest/v1/character_access',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:{character_id:id,email:address(email),role}}),
  grants:id=>request('/rest/v1/character_access?character_id=eq.'+encodeURIComponent(id)+'&select=email,role'),
  revoke:(id,email)=>request('/rest/v1/character_access?character_id=eq.'+encodeURIComponent(id)+'&email=eq.'+encodeURIComponent(email),{method:'DELETE'})
 };
})();
