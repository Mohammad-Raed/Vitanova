/* Shared lecture controls and a single topic bar. */
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
  const context=document.createElement('div');context.className='vn-lecture-context';context.setAttribute('role','navigation');context.setAttribute('aria-label','Lecture breadcrumbs');
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const system=slug(current.system);
  const exam=system+'-'+(current.exam==='Midterm'?'mid':slug(current.exam));
  const header=document.querySelector('header')||document.querySelector('main');
  if(header&&!header.id)header.id='vn-lecture-start';
  const trail=[[current.system,system],[current.exam,exam],[current.subject,current.category]];
  for(const [label,route] of trail) {
    context.append(link(label,'index.html#'+encodeURIComponent(route),'vn-breadcrumb'));
    const separator=document.createElement('span');separator.className='vn-breadcrumb-separator';
    separator.setAttribute('aria-hidden','true');separator.textContent='/';context.append(separator);
  }
  const here=link(current.lectureLabel,header?'#'+encodeURIComponent(header.id):'#','vn-breadcrumb');
  here.setAttribute('aria-current','page');context.append(here);
  const controls=document.createElement('div');controls.className='vn-lecture-controls';
  for(const [label,lecture,cls] of [['← Previous',previous,'vn-previous'],['Next →',next,'vn-next']]) {
    if(lecture)controls.append(link(label,encodeURIComponent(lecture.file),cls));
    else {const disabled=document.createElement('span');disabled.className=cls;disabled.textContent=label;disabled.setAttribute('aria-disabled','true');controls.append(disabled);}
  }
  nav.append(link('✦ Vitanova','index.html','vn-home'),link('← Back to '+current.subject,'index.html#'+encodeURIComponent(current.category),'vn-subject'),context,controls);
  // Remove only the two obsolete hub buttons, leaving all original section navigation.
  document.querySelectorAll('a[href]').forEach(anchor=>{
    const label=anchor.textContent.trim();
    if((label==='← Vitanova Learning Hub'||label==='← Back')&&/^index\.html(?:#|$)/.test(anchor.getAttribute('href')||''))anchor.remove();
  });
  const insertion=document.querySelector('header')||document.querySelector('nav,main');if(insertion)insertion.before(nav);else document.body.prepend(nav);
  const sectionBar=[...document.querySelectorAll('nav')].find(bar=>bar.querySelector('a[href^="#"]'));
  const topics=new Map();
  const flashcards=link('▤ Flashcards','flashcards.html?lecture='+encodeURIComponent(current.id),'vn-flashcards');
  if(sectionBar){
    sectionBar.classList.add('vn-lecture-topics');
    if(!sectionBar.hasAttribute('aria-label'))sectionBar.setAttribute('aria-label','Lecture topics');
    for(const a of sectionBar.querySelectorAll('a[href^="#"]')){
      let id;try{id=decodeURIComponent(a.hash.slice(1));}catch{continue;}
      const target=document.getElementById(id);
      if(!target)continue;
      if(topics.has(id)){a.remove();continue;}
      topics.set(id,target);
    }
    sectionBar.append(flashcards);
  }else{
    controls.prepend(flashcards);
    for(const section of document.querySelectorAll('main section[id]')){
      if(section.querySelector('h2,h3'))topics.set(section.id,section);
    }
  }
  if(topics.size){
    let frame=0,active=null;
    const track=()=>{
      frame=0;
      if(window.scrollY<120){active=null;return;}
      let visible;
      for(const [id,target] of topics){
        const rect=target.getBoundingClientRect();
        if(rect.top<=155&&rect.bottom>0)visible=id;
      }
      if(visible&&visible!==active){active=visible;remember('#'+visible);}
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
