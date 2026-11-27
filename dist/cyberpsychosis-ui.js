/* Adapted from the supplied Animation Kit. Effects never mutate character data. */
window.ND_CYBER_UI=(()=>{
 'use strict';
 const key='nd-reduce-cyber-effects';
 const path='assets/cyberpsychosis/';
 let reduced=false;try{reduced=localStorage.getItem(key)==='true';}catch{}
 const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 function attrs(s,page){return `data-cyber-stage="${s.stage}" data-cyber-page="${page}" data-cyber-effects="${reduced||motion?.matches?'reduced':'full'}" data-cyber-paused="${document.hidden?'true':'false'}"`;}
 function layers(s){return s.stage?'<div class="cyber-background" aria-hidden="true"></div><div class="cyber-strip" aria-hidden="true"></div>':'';}
 function title(s){return `<strong class="cyber-title">КИБЕРПСИХОЗ<span class="cyber-title-copy" aria-hidden="true">КИБЕРПСИХОЗ</span></strong><span class="cyber-stage-label">Стадия ${s.roman} — ${s.label}</span>`;}
 function metric(d){const s=d.cyberpsychosis;if(!s.stage)return '';return `<div class="cyber-metric-status">${title(s)}<span class="cyber-chrome-values">Хром: ${d.used} / ${d.capacity}</span><span class="cyber-excess">Превышение: +${s.excess}</span></div>`;}
 function frame(kind){return `<span class="cyber-frame cyber-frame-${kind}" aria-hidden="true"></span>`;}
 function preferences(){const root=document.querySelector('.character-sheet');if(!root)return;root.dataset.cyberEffects=reduced||motion?.matches?'reduced':'full';root.dataset.cyberPaused=document.hidden?'true':'false';const input=root.querySelector('[data-cyber-reduce]');if(input)input.checked=reduced;}
 function apply(d,page){
  const root=document.querySelector('.character-sheet');if(!root)return;
  preferences();
  const sync=root.querySelector('.sheet-sync');
  if(sync&&!sync.querySelector('.cyber-preference')){
   sync.insertAdjacentHTML('beforeend',`<label class="cyber-preference"><input type="checkbox" data-cyber-reduce ${reduced?'checked':''}><span>Снизить визуальные искажения</span></label>`);
   sync.querySelector('[data-cyber-reduce]').onchange=e=>{reduced=e.target.checked;try{localStorage.setItem(key,String(reduced));}catch{}preferences();};
  }
  if(!d.cyberpsychosis.stage)return;
  const chrome=root.querySelector('.dossier-chrome,.chrome-load');
  if(chrome){chrome.classList.add('cyber-chrome');chrome.insertAdjacentHTML('beforeend',frame('warning')+frame('emergency'));}
  if(page==='chrome'&&chrome){chrome.insertAdjacentHTML('beforeend',`<div class="cyber-chrome-summary">${title(d.cyberpsychosis)}<span class="cyber-excess">Превышение: +${d.cyberpsychosis.excess}</span></div>`);}
  const portrait=root.querySelector('.dossier-portrait');
  if(portrait){portrait.classList.add('cyber-portrait');portrait.insertAdjacentHTML('beforeend','<span class="cyber-portrait-layer" aria-hidden="true"></span>');}
  // Bound the compositor work even for inventories with hundreds of items.
  const selectors=page==='overview'?'.dossier-attributes,.dossier-skills,.dossier-weapons':page==='inventory'?'.inventory-categories,.inventory-summary':page==='chrome'?'.chrome-body,.chrome-installed':page==='network'?'.network-panel.network-hardware,.network-panel.network-programs':null;
  if(selectors)[...root.querySelectorAll(selectors)].slice(0,3).forEach(el=>{el.classList.add('cyber-panel');el.insertAdjacentHTML('beforeend',frame('panel'));});
 }
 document.addEventListener('visibilitychange',preferences);
 motion?.addEventListener?.('change',preferences);
 window.addEventListener('storage',e=>{if(e.key===key){reduced=e.newValue==='true';preferences();}});
 return {attrs,layers,metric,apply};
})();
