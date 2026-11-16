/* Hash routes keep deep links refreshable on static GitHub Pages. */
'use strict';
window.ND_ROUTER=(()=>{
 let active='',index=0,busy=false,queued=null,profile='',loginReturn='',initial=true,renderCount=0,lastError=null;
 const views={showWelcome,showLibrary,showMasterHub,showAllCharacters,showCampaigns,showCampaign,showAccounts,showCatalogAdmin,startWizard,openCard};
 const steps=['identity','attributes','skills','equipment'];
 const clean=path=>typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//')?path:'/';
 function read(){
  const hash=location.hash.slice(1);
  const legacy=hash.startsWith('/')?null:new URLSearchParams(hash).get('card')||new URLSearchParams(location.search).get('card');
  return legacy?'/characters/'+encodeURIComponent(legacy)+'/overview':clean(hash||'/');
 }
 function viewRoute(){
  if(portalView==='editor')return '/characters/'+(cloudRecord?.id||'local')+'/'+tab;
  if(portalView==='wizard')return '/create/'+steps[wizardStep];
  if(portalView==='campaign')return '/master/campaigns/'+(portalCampaignId||'unassigned');
  if(portalView==='login')return (portalRegister?'/register':'/login')+(loginReturn?'?next='+encodeURIComponent(loginReturn):'');
  return ({welcome:'/',library:'/characters',master:'/master','master-characters':'/master/characters',campaigns:'/master/campaigns',accounts:'/master/accounts',catalog:'/master/catalog'})[portalView]||active||'/';
 }
 function url(path){return location.pathname+'#'+path;}
 function stamp(path,replace=false){
  if(!replace&&active===path&&location.hash==='#'+path)return;
  if(!replace){history.replaceState({...history.state,wd:true,wdIndex:index,scrollY:window.scrollY},'',location.href);index++;}
  history[replace?'replaceState':'pushState']({wd:true,wdIndex:index,scrollY:0},'',url(path));active=path;
 }
 function commit(){renderCount++;
  const path=viewRoute();
  const title=document.querySelector('h1')?.textContent||'Wicked Detroit';
  document.title=title+' · Wicked Detroit';
  if(!busy)stamp(path,initial);
 }
 async function leave(){
  if(portalView==='wizard'&&wizard)rememberWizard();
  if(portalView==='editor'){
   await save();
   if(dirty||saving)throw Error('Переход отложен: дождись синхронизации карточки. При ошибке нажми на статус сохранения. Черновик остаётся в браузере.');
  }
  const dialog=document.querySelector('#dialog');if(dialog?.open&&dialog.querySelector('form'))throw Error('Сначала сохрани изменения в открытом окне или закрой его. Введённые данные сохранены в форме.');if(document.querySelector('.crop-dialog[open]'))throw Error('Сначала заверши или отмени кадрирование.');if(dialog?.open)closeModal();
 }
 async function ensureProfile(){
  const user=C.user();if(!user){profile='';portalMaster=false;return;}
  if(profile!==user.id){await loadCatalog();portalMaster=await C.isMaster();profile=user.id;}
 }
 async function display(path){
  const parsed=new URL(path,'https://routes.invalid'),parts=parsed.pathname.split('/').filter(Boolean);
  await ensureProfile();
  if(!C.user()&&!['login','register'].includes(parts[0])&&parts.length){loginReturn=path;portalRole='player';showLogin();return;}
  if(parts[0]==='login'||parts[0]==='register'){
   loginReturn=clean(parsed.searchParams.get('next')||'/');if(loginReturn==='/')loginReturn='';
   if(C.user()){await display('/');return;}portalRole='player';showLogin(parts[0]==='register');return;
  }
  if(!parts.length){loginReturn='';cloudRecord=null;if(C.user()&&portalMaster){portalRole='master';await views.showMasterHub();}else await views.showWelcome();return;}
  if(parts[0]==='master'){
   if(!portalMaster){portalRole='player';await views.showLibrary();notify('Этот раздел доступен только мастеру.');return;}
   portalRole='master';cloudRecord=null;
   if(parts.length===1)return views.showMasterHub();
   if(parts[1]==='characters'&&parts.length===2)return views.showAllCharacters();
   if(parts[1]==='accounts'&&parts.length===2)return views.showAccounts();
   if(parts[1]==='catalog'&&parts.length===2)return views.showCatalogAdmin();
   if(parts[1]==='campaigns'&&parts.length===2)return views.showCampaigns();
   if(parts[1]==='campaigns'&&parts.length===3)return views.showCampaign(parts[2]==='unassigned'?null:parts[2]);
  }
  if(parts[0]==='characters'){
   if(parts.length===1){portalRole='player';return views.showLibrary();}
   if(parts.length===2||parts.length===3){
    const selected=parts[2]||'overview';if(!tabs.some(t=>t[0]===selected))throw Error('Такого раздела карточки нет.');
    if(parts[1]==='local'){cloudRecord=null;card=E.blank(D);try{const local=localStorage.getItem('nd-local-v1');if(local)card=E.validate(JSON.parse(local),D);}catch{}portalView='editor';canEdit=true;tab=selected;render();return;}
    if(cloudRecord?.id===parts[1]&&portalView==='editor'){tab=selected;render();return;}
    await views.openCard(parts[1],selected);return;
   }
  }
  if(parts[0]==='create'&&parts.length<=2){
   portalRole='player';cloudRecord=null;
   if(!wizard)views.startWizard();
   let requested=parts[1]?steps.indexOf(parts[1]):wizardStep;if(requested<0)throw Error('Такого шага создания нет.');
   // A direct link must not bypass the creation rules.
   if(requested>=2&&!E.derive(wizard,D.catalog).validAttributes)requested=1;
   if(requested>=3){try{E.validateCreation(wizard,D);}catch{requested=2;}}
   wizardStep=requested;rememberWizard();showWizard();return;
  }
  throw Error('Страница не найдена. Проверь ссылку или вернись на главную.');
 }
 async function navigate(path,{replace=false,pop=false,scrollY=0}={}){
  path=clean(path);
  if(busy){queued={path,options:{replace,pop,scrollY}};return;}
  const previous=active,previousIndex=index;busy=true;
  try{
   await leave();
   const beforeRender=renderCount;lastError=null;await display(path);if(renderCount===beforeRender&&lastError)throw lastError;
   const rendered=viewRoute();
   if(pop){index=Number.isInteger(history.state?.wdIndex)?history.state.wdIndex:index;active=rendered;if(location.hash!=='#'+rendered)stamp(rendered,true);}
   else{busy=false;stamp(rendered,replace||initial);busy=true;}
   window.scrollTo(0,scrollY);
  }catch(e){
   if(previous){queued=null;const targetIndex=history.state?.wdIndex;index=previousIndex;if(pop&&Number.isInteger(targetIndex)&&targetIndex!==previousIndex){history.go(previousIndex-targetIndex);}else stamp(previous,true);portalError(e);if(document.querySelector('#dialog')?.open)error(e);}
   else{portalView='route-error';active=path;portalShell('Не удалось открыть страницу.',e.message,'<button id="route-home">На главную</button>');document.querySelector('#route-home').onclick=()=>navigate('/');stamp(path,true);}
  }finally{busy=false;initial=false;if(queued){const next=queued;queued=null;await navigate(next.path,next.options);}}
 }
 function onHistory(){const path=read();if(path===active)return;navigate(path,{pop:true,scrollY:history.state?.scrollY||0});}
 window.addEventListener('popstate',onHistory);
 window.addEventListener('hashchange',onHistory);
 showMasterHub=()=>navigate('/master');showAllCharacters=()=>navigate('/master/characters');showCampaigns=()=>navigate('/master/campaigns');showCampaign=id=>navigate('/master/campaigns/'+(id||'unassigned'));showAccounts=()=>navigate('/master/accounts');showCatalogAdmin=()=>navigate('/master/catalog');showLibrary=()=>navigate(portalMaster&&portalRole==='master'?'/master':'/characters');startWizard=()=>navigate('/create');openCard=(id,selected='overview')=>navigate('/characters/'+id+'/'+selected);
 return {commit,navigate,read,reloadCard:id=>views.openCard(id,tab,true),reportError:e=>{lastError=e;},afterLogin:()=>{profile='';return navigate(loginReturn||'/',{replace:true});},back(){if(history.state?.wd&&history.state.wdIndex>0){history.back();return;}if(portalView==='campaign')return navigate('/master/campaigns');if(['campaigns','accounts','catalog','master-characters'].includes(portalView))return navigate('/master');if(portalView==='editor'||portalView==='wizard')return navigate('/characters');return navigate('/');},start(){index=history.state?.wdIndex||0;return navigate(read(),{replace:true});}};
})();
window.ND_ROUTER.start();

