/* One shared navigation bar; original lecture sections and quizzes remain intact. */
(function () {
  'use strict';
  const lectures=window.VitanovaLectures||[];
  let file; try{file=decodeURIComponent(location.pathname.split('/').pop()||'');}catch{return;}
  const current=lectures.find(item=>item.file===file);if(!current)return;
  document.body.classList.add('vn-lecture-page');
  const storage=window.VitanovaStorage;
  function remember(section=location.hash) {
    const hash=/^#[a-zA-Z][\w:.-]*$/.test(section)?section:'';
    const record={version:1,lectureId:current.id,hash,openedAt:Date.now()};
    if(storage)storage.write('vitanova:recent:v1',record);
    else try{localStorage.setItem('vitanova:recent:v1',JSON.stringify(record));}catch{}
  }
  remember();window.addEventListener('hashchange',()=>remember());
  if(document.querySelector('.vn-lecture-navigation'))return;
  const ordered=lectures.filter(l=>l.system===current.system&&l.exam===current.exam&&l.subject===current.subject&&l.category===current.category).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  const index=ordered.findIndex(l=>l.id===current.id),previous=ordered[index-1],next=ordered[index+1];
  const nav=document.createElement('div');nav.className='vn-lecture-navigation';nav.setAttribute('role','navigation');nav.setAttribute('aria-label','Lecture navigation');
  function link(label,href,cls) {const anchor=document.createElement('a');anchor.textContent=label;anchor.href=href;anchor.className=cls;return anchor;}
  const context=document.createElement('div');context.className='vn-lecture-context';context.setAttribute('aria-label','Current lecture');
  [current.system,current.exam,current.subject,current.lectureLabel].forEach(part=>{const span=document.createElement('span');span.textContent=part;context.append(span);});
  const controls=document.createElement('div');controls.className='vn-lecture-controls';
  for(const [label,lecture,cls] of [['← Previous',previous,'vn-previous'],['Next →',next,'vn-next']]) {
    if(lecture)controls.append(link(label,encodeURIComponent(lecture.file),cls));
    else {const disabled=document.createElement('span');disabled.className=cls;disabled.textContent=label;disabled.setAttribute('aria-disabled','true');controls.append(disabled);}
  }
  nav.append(link('✦ Vitanova','index.html','vn-home'),link('← Back to '+current.subject,'index.html#'+encodeURIComponent(current.category),'vn-subject'),context,controls);
  const flashcards=link('▤ Flashcards','flashcards.html?lecture='+encodeURIComponent(current.id),'vn-flashcards');
  const quizTabs=[...document.querySelectorAll('nav a[href^="#"]')].filter(anchor=>/quiz|mcq/i.test(anchor.textContent));
  const lastQuiz=quizTabs.at(-1);
  if(lastQuiz){flashcards.classList.add('vn-section-flashcards');lastQuiz.after(flashcards);}
  else controls.prepend(flashcards);
  // Remove only the two obsolete hub buttons, leaving all original section navigation.
  document.querySelectorAll('a[href]').forEach(anchor=>{
    const label=anchor.textContent.trim();
    if((label==='← Vitanova Learning Hub'||label==='← Back')&&/^index\.html(?:#|$)/.test(anchor.getAttribute('href')||''))anchor.remove();
  });
  const insertion=document.querySelector('header')||document.querySelector('nav,main');if(insertion)insertion.before(nav);else document.body.prepend(nav);
  const topics=new Map();
  for(const a of document.querySelectorAll('nav a[href^="#"]')){
    const id=a.getAttribute('href').slice(1);
    if(id&&document.getElementById(id))topics.set(id,a.textContent.trim());
  }
  if(!topics.size)for(const section of document.querySelectorAll('main section[id], section[id]')){
    const heading=section.querySelector('h2,h3');
    if(heading)topics.set(section.id,heading.textContent.trim());
  }
  if(topics.size){
    const bar=document.createElement('div');bar.className='vn-study-sections';
    bar.setAttribute('role','navigation');bar.setAttribute('aria-label','Study sections');
    const entries=[...topics];
    const practice=entries.find(([id,label])=>/quiz|mcq|practice|questions/i.test(id+' '+label));
    const summary=entries.find(([id,label])=>/summary|recap|high.yield|quick review/i.test(id+' '+label));
    const explanation=entries.find(entry=>entry!==practice&&entry!==summary);
    for(const [label,entry] of [['Full explanation',explanation],['Quick review',summary],['Practice',practice]]){
      if(entry)bar.append(link(label,'#'+encodeURIComponent(entry[0]),'vn-study-jump'));
    }
    const jump=document.createElement('select');jump.setAttribute('aria-label','Jump to topic');
    jump.append(new Option('Jump to topic',''));
    for(const [id,label] of topics)jump.append(new Option(label,id));
    jump.addEventListener('change',()=>{if(jump.value)location.hash=encodeURIComponent(jump.value);});
    bar.append(jump);
    const header=document.querySelector('header');if(header)header.after(bar);else nav.after(bar);
    let frame=0;
    const track=()=>{
      frame=0;
      if(window.scrollY<120)return;
      let active;
      for(const [id] of topics){
        const rect=document.getElementById(id)?.getBoundingClientRect();
        if(rect&&rect.top<=155&&rect.bottom>0)active=id;
      }
      if(active&&jump.value!==active){jump.value=active;remember('#'+active);}
    };
    window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(track);},{passive:true});
  }
  document.querySelectorAll('.tbl').forEach(wrapper=>{wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Scrollable medical table');});
  const toggle=document.createElement('button');toggle.className='vn-theme-toggle';toggle.type='button';toggle.setAttribute('aria-label','Toggle light and dark theme');
  let theme;try{const raw=localStorage.getItem('vitanova:theme:v1');theme=['dark','light'].includes(raw)?raw:JSON.parse(raw);}catch{}
  function apply(value){document.documentElement.dataset.theme=value;toggle.textContent=value==='dark'?'☀ Light':'☾ Dark';try{localStorage.setItem('vitanova:theme:v1',value);}catch{storage?.warning();}}
  apply(['dark','light'].includes(theme)?theme:window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light');
  toggle.addEventListener('click',()=>apply(document.documentElement.dataset.theme==='dark'?'light':'dark'));controls.append(toggle);
  const top=document.createElement('a');top.className='vn-back-to-top';top.href='#';top.textContent='↑ Top';top.setAttribute('aria-label','Back to top');
  top.addEventListener('click',event=>{event.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  document.body.append(top);
  const appearance=document.createElement('script');appearance.src='study-appearance.js?v=2';document.body.append(appearance);
  if(storage&&!storage.isAvailable())storage.warning();
})();
