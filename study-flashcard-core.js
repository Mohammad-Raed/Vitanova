/* Stable cloze rendering and FSRS-6 scheduling. */
(function(root){
  'use strict';
  const DAY=86400000, KEY='vitanova:flashcards:v1';
  const engine=typeof module==='object'&&module.exports?require('./vendor/ts-fsrs-5.4.2.js'):root.FSRS;
  const scheduler=engine?.fsrs({request_retention:0.9,enable_fuzz:false,enable_short_term:true,learning_steps:['1m','10m'],relearning_steps:['10m']});
  function validMemory(m){return m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).every(k=>['stability','difficulty','state','steps','days'].includes(k))&&Number.isFinite(m.stability)&&m.stability>0&&Number.isFinite(m.difficulty)&&m.difficulty>=1&&m.difficulty<=10&&[1,2,3].includes(m.state)&&[m.steps,m.days].every(n=>Number.isSafeInteger(n)&&n>=0);}
  function validRecord(r){return r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>['due','interval','reviews','lapses','lastReview','rating','memory'].includes(k))&&['due','interval','lastReview'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&['reviews','lapses'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=4&&(!Object.hasOwn(r,'memory')||validMemory(r.memory));}
  function validState(v){return v&&v.version===1&&Object.keys(v).every(k=>['version','records'].includes(k))&&v.records&&typeof v.records==='object'&&!Array.isArray(v.records)&&Object.entries(v.records).every(([id,r])=>!['__proto__','constructor','prototype'].includes(id)&&id.length>0&&id.length<=500&&validRecord(r));}
  function schedule(previous,rating,now=Date.now()){
    if(!Number.isInteger(rating)||rating<1||rating>4||!Number.isFinite(now)||now<0)throw new Error('Invalid review');
    const date=new Date(now), card=engine.createEmptyCard(date), m=previous?.memory;
    if(m)Object.assign(card,{due:new Date(previous.due),last_review:new Date(Math.min(previous.lastReview,now)),reps:previous.reviews,lapses:previous.lapses,stability:m.stability,difficulty:m.difficulty,state:m.state,learning_steps:m.steps,scheduled_days:m.days});
    const c=scheduler.next(card,date,rating).card, due=c.due.getTime();
    return {due,interval:(due-now)/DAY,reviews:(previous?.reviews||0)+1,lapses:m?c.lapses:(previous?.lapses||0),lastReview:now,rating,memory:{stability:c.stability,difficulty:c.difficulty,state:c.state,steps:c.learning_steps,days:c.scheduled_days}};
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
