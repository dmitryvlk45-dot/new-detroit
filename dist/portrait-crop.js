/* Fixed portrait framing. Original files remain local until the crop is accepted. */
window.ND_PORTRAIT={crop(file){return new Promise(async(resolve,reject)=>{
 let bitmap,dialog,finished=false;
 const finish=value=>{if(finished)return;finished=true;bitmap?.close();if(dialog){dialog.close();dialog.remove();}resolve(value);};
 try{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Выбери JPG, PNG или WebP до 10 МБ');
  bitmap=await createImageBitmap(file);
  const W=528,H=624,base=Math.max(W/bitmap.width,H/bitmap.height);
  let zoom=1,cx=bitmap.width/2,cy=bitmap.height/2;
  const pointers=new Map();let gesture=null;
  dialog=document.createElement('dialog');dialog.className='crop-dialog';dialog.setAttribute('aria-labelledby','crop-title');
  dialog.innerHTML=`<div class="dialog-heading"><h2 id="crop-title">Кадрировать портрет</h2><button type="button" id="crop-close" aria-label="Отменить кадрирование">×</button></div><p class="crop-hint">Перемещай фото внутри рамки. Масштаб — ползунком или двумя пальцами.</p><div class="crop-frame"><canvas id="crop-canvas" width="528" height="624" tabindex="0" aria-label="Область портрета. Перемещайте фото мышью, пальцем или клавишами со стрелками."></canvas><div class="crop-grid" aria-hidden="true"></div></div><label class="crop-zoom" for="crop-scale"><span>Масштаб</span><output id="crop-percent">100%</output></label><input id="crop-scale" type="range" min="1" max="4" step="0.01" value="1" aria-label="Масштаб портрета"><div class="crop-controls"><button type="button" id="crop-reset">Сбросить</button><button type="button" id="crop-cancel">Отмена</button><button type="button" id="crop-apply" class="yellow">Использовать</button></div><p class="crop-error" role="alert"></p>`;
  document.body.append(dialog);dialog.showModal();
  const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),slider=dialog.querySelector('#crop-scale');
  function draw(){const scale=base*zoom,halfW=W/scale/2,halfH=H/scale/2;cx=Math.max(halfW,Math.min(bitmap.width-halfW,cx));cy=Math.max(halfH,Math.min(bitmap.height-halfH,cy));ctx.fillStyle='#111417';ctx.fillRect(0,0,W,H);ctx.drawImage(bitmap,W/2-cx*scale,H/2-cy*scale,bitmap.width*scale,bitmap.height*scale);slider.value=String(zoom);dialog.querySelector('#crop-percent').textContent=Math.round(zoom*100)+'%';}
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};};
  function beginGesture(){const a=[...pointers.values()];if(!a.length){gesture=null;return;}const mid=a.length>1?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:a[0];gesture={mid,cx,cy,zoom,distance:a.length>1?Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y):0};}
  canvas.onpointerdown=e=>{e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));beginGesture();};
  canvas.onpointermove=e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,point(e));const a=[...pointers.values()],mid=a.length>1?{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}:a[0];if(a.length>1&&gesture.distance>0)zoom=Math.max(1,Math.min(4,gesture.zoom*Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y)/gesture.distance));const oldScale=base*gesture.zoom,newScale=base*zoom;cx=gesture.cx+(gesture.mid.x-W/2)/oldScale-(mid.x-W/2)/newScale;cy=gesture.cy+(gesture.mid.y-H/2)/oldScale-(mid.y-H/2)/newScale;draw();};
  const release=e=>{pointers.delete(e.pointerId);beginGesture();};canvas.onpointerup=release;canvas.onpointercancel=release;canvas.onlostpointercapture=release;
  canvas.onkeydown=e=>{const step=(e.shiftKey?30:10)/(base*zoom);if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();cx+=e.key==='ArrowLeft'?step:e.key==='ArrowRight'?-step:0;cy+=e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0;draw();};
  slider.oninput=()=>{zoom=+slider.value;draw();};
  dialog.querySelector('#crop-reset').onclick=()=>{zoom=1;cx=bitmap.width/2;cy=bitmap.height/2;draw();};
  dialog.querySelector('#crop-close').onclick=dialog.querySelector('#crop-cancel').onclick=()=>finish(null);
  dialog.oncancel=e=>{e.preventDefault();finish(null);};
  dialog.querySelector('#crop-apply').onclick=()=>{try{let photo=canvas.toDataURL('image/jpeg',.86);if(photo.length>500000)photo=canvas.toDataURL('image/jpeg',.7);if(photo.length>500000)throw Error('Не удалось уменьшить фото. Выбери другой файл.');finish(photo);}catch(e){dialog.querySelector('.crop-error').textContent=e.message;}};
  draw();
 }catch(e){bitmap?.close();dialog?.remove();reject(e);}
});}};
