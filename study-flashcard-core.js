/* Stable cloze rendering and transparent, lightweight review intervals; not Anki/FSRS. */
(function(root){
  'use strict';
  const DAY=86400000, KEY='vitanova:flashcards:v1';
  function validRecord(r){return r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>['due','interval','reviews','lapses','lastReview','rating'].includes(k))&&['due','interval','lastReview'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&['reviews','lapses'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=4;}
  function validState(v){return v&&v.version===1&&Object.keys(v).every(k=>['version','records'].includes(k))&&v.records&&typeof v.records==='object'&&!Array.isArray(v.records)&&Object.entries(v.records).every(([id,r])=>!['__proto__','constructor','prototype'].includes(id)&&id.length>0&&id.length<=500&&validRecord(r));}
  function schedule(previous,rating,now=Date.now()){
    if(!Number.isInteger(rating)||rating<1||rating>4||!Number.isFinite(now)||now<0)throw new Error('Invalid review');
    const p=previous||{interval:0,reviews:0,lapses:0};
    const interval=rating===1?10/1440:rating===2?Math.max(1,p.interval*1.2):rating===3?Math.max(3,p.interval*2.5):Math.max(7,p.interval*3);
    const bounded=Math.min(3650,interval);
    return {due:now+bounded*DAY,interval:bounded,reviews:p.reviews+1,lapses:p.lapses+(rating===1?1:0),lastReview:now,rating};
  }
  function render(text,ordinal,reveal=false){
    let out='',i=0;
    while(i<text.length){
      const match=/\{\{c(\d+)::/.exec(text.slice(i));if(!match){out+=text.slice(i);break;}
      const start=i+match.index,content=start+match[0].length;out+=text.slice(i,start);let j=content,depth=1;
      while(j<text.length&&depth){if(text.startsWith('{{',j)){depth++;j+=2;}else if(text.startsWith('}}',j)){depth--;j+=2;}else j++;}
      if(depth)throw new Error('Incomplete cloze card');
      const body=text.slice(content,j-2);let split=-1,level=0;
      for(let k=0;k<body.length;k++){if(body.startsWith('{{',k)){level++;k++;}else if(body.startsWith('}}',k)){level--;k++;}else if(!level&&body.startsWith('::',k)){split=k;break;}}
      const answer=split<0?body:body.slice(0,split),hint=split<0?'':body.slice(split+2).replace(/<[^>]*>/g,'');
      out+=Number(match[1])===ordinal?(reveal?'<mark class="fc-answer">'+render(answer,ordinal,true)+'</mark>':'<span class="fc-blank">['+(hint||'…')+']</span>'):render(answer,ordinal,reveal);i=j;
    }
    return out;
  }
  const api={DAY,KEY,validRecord,validState,schedule,render};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VitanovaFlashcardCore=api;
})(typeof window==='undefined'?globalThis:window);
