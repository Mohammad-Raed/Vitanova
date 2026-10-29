(function(){
  'use strict';
  const $=id=>document.getElementById(id), core=window.VitanovaFlashcardCore, storage=window.VitanovaStorage;
  const lectures=window.VitanovaLectures||[], params=new URLSearchParams(location.search);
  let catalog,queue=[],position=0,reviewed=0,skipped=0,revealed=false,active=false,busy=false,revision=0,undo=[],series=null;
  const noteCache=new Map(),pending=new Map();
  const state=()=>storage.read(core.KEY,{version:1,records:{}},core.validState);
  function message(text){$('fc-error').textContent=text;$('fc-error').hidden=!text;}
  function choices(open){$('fc-settings').hidden=!open;$('fc-settings-toggle').setAttribute('aria-expanded',String(open));$('fc-settings-toggle').textContent=open?'Hide choices':'Change selection';}
  function theme(value){document.documentElement.dataset.theme=value;$('fc-theme').textContent=value==='dark'?'☀ Light':'☾ Dark';try{localStorage.setItem('vitanova:theme:v1',value);}catch{storage.warning();}}
  let initial;try{initial=localStorage.getItem('vitanova:theme:v1');}catch{}
  theme(['dark','light'].includes(initial)?initial:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  $('fc-theme').addEventListener('click',()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  function option(select,value,text){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
  function filtered(){
    if(!catalog)return[];
    const records=state().records,now=Date.now(),search=$('fc-search').value.trim().toLowerCase(),lecture=$('fc-lecture').value,subject=$('fc-subject').value,mode=$('fc-mode').value;
    return catalog.cards.filter(c=>(!subject||c.subject===subject)&&(!lecture||(lecture==='__lectures__'?c.lectures.length>0:c.lectures.includes(lecture)))&&(!search||search.split(/\s+/).every(word=>c.search.toLowerCase().includes(word)))&&(mode==='all'||(mode==='learning'?records[c.id]?.rating===1:!records[c.id]||records[c.id].due<=now)));
  }
  function count(){if(!catalog)return;const n=filtered().length;$('fc-match-count').textContent=n?n+' matching '+(n===1?'card':'cards'):'No matching cards. Try All cards, All topics, or a broader search.';$('fc-start').disabled=!n||busy;$('fc-start').textContent=active?'Start new session':'Start session';}
  async function getNotes(subject){
    if(noteCache.has(subject))return noteCache.get(subject);
    if(!pending.has(subject))pending.set(subject,(async()=>{const r=await fetch(catalog.subjects[subject]);if(!r.ok)throw new Error('Card content could not load. Check your connection and try again.');const ns=await r.json();noteCache.set(subject,ns);return ns;})().finally(()=>pending.delete(subject)));
    return pending.get(subject);
  }
  // Defense in depth: only importer-generated local images and safe formatting reach the DOM.
  function content(target,markup){
    const template=document.createElement('template');template.innerHTML=markup;
    const allowed=new Set(['B','STRONG','I','EM','U','S','SUB','SUP','BR','P','DIV','SPAN','UL','OL','LI','TABLE','THEAD','TBODY','TR','TD','TH','BLOCKQUOTE','HR','A','IMG','MARK']);
    for(const node of [...template.content.querySelectorAll('*')]){
      if(!allowed.has(node.tagName)){node.remove();continue;}
      for(const a of [...node.attributes])if(!['src','alt','href','class'].includes(a.name))node.removeAttribute(a.name);
      if(node.tagName==='IMG'){
        const src=node.getAttribute('src')||'';
        if(!/^flashcard-media\/[a-f0-9]{24}\.webp$/.test(src)){node.remove();continue;}
        node.loading='lazy';node.decoding='async';
        const zoom=document.createElement('a');zoom.href=src;zoom.target='_blank';zoom.rel='noopener noreferrer';zoom.title='Open illustration at full size';zoom.setAttribute('aria-label','Open illustration at full size');
        node.replaceWith(zoom);zoom.append(node);
      }
      if(node.tagName==='A'){
        if(!/^https?:\/\//i.test(node.getAttribute('href')||''))node.removeAttribute('href');
        else{node.target='_blank';node.rel='noopener noreferrer';}
      }
      if(node.hasAttribute('class')&&!['fc-answer','fc-blank'].includes(node.className))node.removeAttribute('class');
    }
    target.replaceChildren(template.content);
  }
  function intervalLabel(days){if(days<1)return Math.round(days*1440)+' min';return Math.round(days)+' '+(Math.round(days)===1?'day':'days');}
  function showUndo(){$('fc-undo').disabled=!undo.length;}
  async function draw(){
    const token=++revision;revealed=false;busy=true;message('');$('fc-retry').hidden=true;$('fc-ratings').hidden=true;$('fc-answer').hidden=true;$('fc-reveal').hidden=false;$('fc-reveal').disabled=true;$('fc-skip').disabled=true;showUndo();
    $('fc-finished').hidden=true;
    if(position>=queue.length){
      busy=false;active=false;$('fc-practice').hidden=true;$('fc-finished').hidden=false;$('fc-finished-text').textContent=reviewed+' rated · '+skipped+' skipped. Your next due times are saved on this device.';
      // Keep Undo accessible after the final card.
      $('fc-finished').append($('fc-undo'));showUndo();finishActions();count();$('fc-finished').querySelector('h2').tabIndex=-1;$('fc-finished').querySelector('h2').focus();return;
    }
    if($('fc-undo').parentElement.id==='fc-finished')document.querySelector('.fc-progress').append($('fc-undo'));
    $('fc-practice').hidden=false;$('fc-front').textContent='Loading card…';$('fc-extra').replaceChildren();$('fc-supplements').replaceChildren();
    const card=queue[position];$('fc-practice').dataset.cardId=card.id;$('fc-topic').textContent=card.subject+' · '+card.topic;$('fc-counter').textContent=(position+1)+' of '+queue.length+' · '+reviewed+' rated · '+skipped+' skipped';
    try{
      const notes=await getNotes(card.subject);if(token!==revision)return;
      const note=notes[card.note];if(!note)throw new Error('This card is missing its note. Try reloading the library.');
      $('fc-format').textContent=note.oneByOne?'Grouped cloze recall':'Cloze recall';
      content($('fc-front'),core.render(note.text,card.ordinal));busy=false;$('fc-reveal').disabled=false;$('fc-skip').disabled=false;count();$('fc-card-heading').focus({preventScroll:true});
    }catch(error){if(token===revision){busy=false;message(error.message);$('fc-retry').hidden=false;$('fc-skip').disabled=false;count();}}
  }
  function reveal(){
    if(busy||revealed||position>=queue.length)return;
    const card=queue[position],note=noteCache.get(card.subject)?.[card.note];if(!note)return;
    revealed=true;content($('fc-front'),core.render(note.text,card.ordinal,true));content($('fc-extra'),note.extra);
    for(const supplemental of note.supplements){
      const detail=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');summary.textContent=supplemental.title;detail.append(summary,body);
      let mounted=false;detail.addEventListener('toggle',()=>{if(detail.open&&!mounted){content(body,supplemental.html);mounted=true;}});$('fc-supplements').append(detail);
    }
    $('fc-answer').hidden=false;$('fc-reveal').hidden=true;$('fc-ratings').replaceChildren();const record=state().records[card.id];
    ['Repeat','Hard','Good','Easy'].forEach((label,i)=>{const button=document.createElement('button');button.type='button';button.dataset.rating=String(i+1);const span=document.createElement('span');span.textContent=label;const small=document.createElement('small');small.textContent=intervalLabel(core.schedule(record,i+1).interval)+' · '+(i+1);button.append(span,small);button.addEventListener('click',()=>rate(i+1));$('fc-ratings').append(button);});
    $('fc-ratings').hidden=false;$('fc-ratings').querySelector('button').focus({preventScroll:true});
  }
  function rate(rating){
    if(!revealed||busy||position>=queue.length)return;
    revealed=false;const card=queue[position],snapshot=state(),previous=snapshot.records[card.id]||null,next=core.schedule(previous,rating);
    undo.push({position,previous,next,id:card.id});snapshot.records[card.id]=next;storage.write(core.KEY,snapshot);reviewed++;position++;draw();
  }
  function undoRating(){
    if(busy||!undo.length)return;
    const last=undo[undo.length-1],snapshot=state();
    if(JSON.stringify(snapshot.records[last.id])!==JSON.stringify(last.next)){message('This rating changed in another tab or import. Undo was stopped to preserve that newer record.');return;}
    undo.pop();if(last.previous)snapshot.records[last.id]=last.previous;else delete snapshot.records[last.id];storage.write(core.KEY,snapshot);position=last.position;reviewed--;skipped=queue.slice(0,position).length-reviewed;active=true;draw();
  }
  function shuffle(list){for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
  function config(){return {lecture:$('fc-lecture').value,subject:$('fc-subject').value,search:$('fc-search').value,mode:$('fc-mode').value,size:$('fc-size').value,shuffle:$('fc-shuffle').checked};}
  function scope(settings){
    const lecture=lectures.find(l=>l.id===settings.lecture);
    return lecture?lecture.lectureLabel+' · '+lecture.title:settings.lecture==='__lectures__'?(settings.subject?settings.subject+' · ':'')+'All lecture topics':settings.subject||'All MSS topics';
  }
  function batch(offset){
    series.offset=offset;queue=series.cards.slice(offset,offset+series.size);position=reviewed=skipped=0;undo=[];active=true;
    $('fc-selection').textContent=scope(series.config)+' · '+queue.length+' cards · set '+(Math.floor(offset/series.size)+1);
    $('fc-session-warning').hidden=false;choices(false);draw();
  }
  function nextLecture(){
    const current=lectures.find(l=>l.id===series?.config.lecture);if(!current)return null;
    const ordered=lectures.filter(l=>l.category===current.category&&l.system===current.system&&l.exam===current.exam&&l.subject===current.subject).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
    return ordered.slice(ordered.findIndex(l=>l.id===current.id)+1).find(l=>catalog.cards.some(c=>c.lectures.includes(l.id)))||null;
  }
  function finishActions(){
    const remaining=series?Math.max(0,series.cards.length-series.offset-queue.length):0;
    $('fc-continue').hidden=!remaining;
    if(remaining)$('fc-continue').textContent='Continue next '+Math.min(series.size,remaining)+' cards · '+remaining+' remaining';
    const next=nextLecture();$('fc-next-lecture').hidden=!next;
    if(next)$('fc-next-lecture').textContent='Next lecture → '+next.lectureLabel;
  }
  function lectureContext(lecture){
    $('fc-context').textContent=lecture?'Related practice for '+lecture.lectureLabel+' · '+lecture.title:'Recall first. Reveal the answer, then choose how well you remembered.';
    $('fc-back').href=lecture?encodeURIComponent(lecture.file):'index.html#mss';$('fc-back').textContent=lecture?'← Back to lecture':'MSS library';
  }
  function start(event){
    event?.preventDefault();if(busy)return false;
    const matches=filtered();if(!matches.length){message('No matching cards are ready. Try All cards, a different subject, or a broader search.');return false;}
    const settings=config(),records=state().records;if(settings.shuffle)shuffle(matches);
    if(settings.mode==='due')matches.sort((a,b)=>(records[a.id]?.due??Infinity)-(records[b.id]?.due??Infinity));
    series={cards:matches,size:settings.size==='all'?matches.length:Number(settings.size),offset:0,config:settings};
    const lecture=lectures.find(l=>l.id===settings.lecture);lectureContext(lecture);
    const url=new URL(location.href);if(lecture)url.searchParams.set('lecture',lecture.id);else url.searchParams.delete('lecture');history.replaceState(null,'',url);
    batch(0);return true;
  }
  function continueSet(){if(busy||active||!series)return;const offset=series.offset+queue.length;if(offset<series.cards.length)batch(offset);}
  function advanceLecture(){
    if(busy||active)return;const next=nextLecture();if(!next)return;
    const settings=series.config;
    $('fc-lecture').value=next.id;$('fc-subject').value=next.subject;$('fc-search').value='';$('fc-mode').value=settings.mode;$('fc-size').value=settings.size;$('fc-shuffle').checked=settings.shuffle;
    if(!start()){
      series=null;queue=[];position=reviewed=skipped=0;undo=[];revision++;
      $('fc-practice').hidden=true;$('fc-finished').hidden=true;choices(true);lectureContext(next);$('fc-selection').textContent=scope(config())+' · no cards ready';$('fc-session-warning').hidden=true;count();
      const url=new URL(location.href);url.searchParams.set('lecture',next.id);history.replaceState(null,'',url);
      message('No cards are ready for '+next.lectureLabel+' in this review mode. Choose All cards for free practice, or return when cards are due.');
    }
  }
  async function load(){
    message('');$('fc-retry').hidden=true;
    try{
      const r=await fetch('data/flashcards/catalog.json');if(!r.ok)throw new Error('The flashcard library could not load. Check your connection and retry.');catalog=await r.json();
      if(catalog.version!==1||!Array.isArray(catalog.cards))throw new Error('Unsupported flashcard library version.');
      $('fc-subject').length=1;for(const sub of Object.keys(catalog.subjects))option($('fc-subject'),sub,sub+' ('+catalog.cards.filter(c=>c.subject===sub).length+')');
      $('fc-lecture').length=2;for(const l of lectures){const n=catalog.cards.filter(c=>c.lectures.includes(l.id)).length;option($('fc-lecture'),l.id,l.subject+' · '+l.lectureLabel+' · '+l.title+' ('+n+')');}
      const requested=lectures.find(l=>l.id===params.get('lecture'));
      if(requested){$('fc-lecture').value=requested.id;lectureContext(requested);}
      $('fc-selection').textContent=catalog.cards.length.toLocaleString()+' cards · MSS topic library';count();
    }catch(error){message(error.message);$('fc-retry').hidden=false;}
  }
  $('fc-settings').addEventListener('submit',start);$('fc-settings').addEventListener('input',count);$('fc-settings').addEventListener('change',count);
  $('fc-settings-toggle').addEventListener('click',()=>choices($('fc-settings').hidden));
  $('fc-reveal').addEventListener('click',reveal);$('fc-skip').addEventListener('click',()=>{if(busy||position>=queue.length)return;skipped++;position++;draw();});
  $('fc-undo').addEventListener('click',undoRating);$('fc-another').addEventListener('click',()=>{choices(true);count();$('fc-start').focus();});
  $('fc-continue').addEventListener('click',continueSet);$('fc-next-lecture').addEventListener('click',advanceLecture);
  $('fc-retry').addEventListener('click',()=>catalog&&queue.length?draw():load());
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY','A'].includes(event.target.tagName)||event.target.isContentEditable)return;
    if(!$('fc-practice').hidden){if(event.code==='Space'&&!revealed){event.preventDefault();reveal();}else if(revealed&&/^[1-4]$/.test(event.key)){event.preventDefault();rate(Number(event.key));}}
  });
  // Rating shortcuts remain usable while a rating button has focus; Space retains native button activation.
  $('fc-ratings').addEventListener('keydown',event=>{if(/^[1-4]$/.test(event.key)&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();rate(Number(event.key));}});
  window.addEventListener('vitanova:storage-changed',event=>{if(event.detail?.external||event.detail?.imported)count();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)count();});
  window.setInterval(count,30000);
  load();
})();
