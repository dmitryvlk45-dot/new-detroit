// Public registration only. Roles and existing accounts cannot be changed here.
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply = (status:number,message:string) => new Response(JSON.stringify({message}),{status,headers});
Deno.serve(async (req:Request) => {
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,'Метод не поддерживается');
 try {
  const raw=await req.text();
  if(raw.length>2048)return reply(400,'Слишком длинный запрос');
  const {login,password}=JSON.parse(raw);
  const username=typeof login==='string'?login.trim().toLowerCase():'';
  if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username))return reply(400,'Логин: 3–32 латинские буквы, цифры, дефис или подчёркивание');
  if(typeof password!=='string'||password.length<6||password.length>128)return reply(400,'Пароль: от 6 до 128 символов');
  const url=Deno.env.get('SUPABASE_URL')!;
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminHeaders={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  const limit=await fetch(url+'/rest/v1/rpc/claim_signup_slot',{method:'POST',headers:adminHeaders,body:'{}'});
  if(!limit.ok)return reply(503,'Регистрация временно недоступна');
  if(await limit.json()!==true)return reply(429,'Лимит регистраций за час исчерпан. Попробуй позже');
  const result=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:adminHeaders,body:JSON.stringify({email:username+'@players.new-detroit.invalid',password,email_confirm:true})});
  if(!result.ok){const error=await result.json();return reply(400,error.code==='email_exists'||error.code==='email_address_not_authorized'||result.status===422?'Логин занят или недоступен. Выбери другой':'Не удалось зарегистрироваться. Попробуй другой логин');}
  return reply(200,'Аккаунт создан');
 }catch{return reply(400,'Не удалось обработать регистрацию');}
});
