/* Presentation state, derived only from the existing chrome calculation. */
(function(root){
 'use strict';
 function state(used,max){
  if(!Number.isFinite(used)||!Number.isFinite(max))return {stage:0,excess:0,label:'Норма',roman:''};
  const excess=Math.max(0,used-max),stage=excess===0?0:excess<=3?1:excess<=7?2:3;
  return {stage,excess,label:['Норма','Помехи','Дестабилизация','Критическая'][stage],roman:['','I','II','III'][stage]};
 }
 root.ND_CYBER_MODEL={state};if(typeof module!=='undefined')module.exports=root.ND_CYBER_MODEL;
})(typeof window!=='undefined'?window:globalThis);
