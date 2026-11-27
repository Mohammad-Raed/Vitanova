/* Shared lecture controls and a single topic bar. */
(function () {
  'use strict';
  const lectures=window.VitanovaLectures||[];
  let file; try{file=decodeURIComponent(location.pathname.split('/').pop()||'');}catch{return;}
  const current=lectures.find(item=>item.file===file);
  document.body.classList.add('vn-sidebar-page');
  const side=document.createElement('aside');side.className='vn-global-sidebar';side.setAttribute('aria-label','Vitanova study navigation');
  side.innerHTML='<div class="vn-global-brand"><a href="index.html">✦ Vitanova</a><button type="button" class="vn-global-hide" aria-label="Hide navigation" title="Hide navigation">‹</button></div><p class="vn-global-caption">YOUR STUDY SPACE</p><nav aria-label="Study tools"><a href="index.html#home">⌂ <span>Overview</span></a><a href="index.html#mss-checklist">☑ <span>MSS Checklist</span></a><a href="index.html#search">⌕ <span>Find a lecture</span></a><a href="index.html#saved">☆ <span>Saved questions</span></a><a href="index.html#mistakes">↻ <span>Redo mistakes</span></a><a href="flashcards.html">▤ <span>Flashcards</span></a><a href="index.html#backup">⇩ <span>Backup</span></a></nav><p class="vn-global-caption">YOUR SYSTEMS</p><nav aria-label="Study systems"><a href="index.html#mss">🦴 <span>MSS System</span></a><a href="index.html#immunology">🧬 <span>Immunology</span></a></nav><button type="button" class="vn-global-show" aria-label="Show navigation" title="Show navigation">›</button>';
  let sidebarPref;try{sidebarPref=localStorage.getItem('vitanova:sidebar-hidden:v1');}catch{}
  const hidden=sidebarPref==='true'||(!sidebarPref&&matchMedia('(max-width:760px)').matches);
  function setSidebarHidden(value){document.body.classList.toggle('vn-sidebar-hidden',value);side.querySelector('.vn-global-show').hidden=!value;try{localStorage.setItem('vitanova:sidebar-hidden:v1',String(value));}catch{}}
  side.querySelector('.vn-global-hide').addEventListener('click',()=>setSidebarHidden(true));
  side.querySelector('.vn-global-show').addEventListener('click',()=>setSidebarHidden(false));
  document.body.append(side);setSidebarHidden(hidden);
  const railStyle=document.createElement('link');railStyle.rel='stylesheet';railStyle.href='study-sidebar.css?v=1';document.head.append(railStyle);
  if(!current)return;
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
  const main=document.querySelector('main');
  const header=document.querySelector('body > header')||main?.querySelector(':scope > .hero');
  const start=header||main;
  if(start&&!start.id)start.id='vn-lecture-start';
  if(header){
    header.classList.add('vn-lecture-hero');
    const heading=header.querySelector('h1');
    if(heading&&!header.querySelector('small,.k,.eyebrow,.vn-lecture-label')){
      const label=document.createElement('p');
      label.className='vn-lecture-label';
      label.textContent=[current.system,current.exam,current.subject,current.lectureLabel].join(' · ');
      heading.before(label);
    }
    if(header.parentElement!==document.body)document.body.insertBefore(header,main);
  }
  const trail=[[current.system,system],[current.exam,exam],[current.subject,current.category]];
  for(const [label,route] of trail) {
    context.append(link(label,'index.html#'+encodeURIComponent(route),'vn-breadcrumb'));
    const separator=document.createElement('span');separator.className='vn-breadcrumb-separator';
    separator.setAttribute('aria-hidden','true');separator.textContent='/';context.append(separator);
  }
  const here=link(current.lectureLabel,start?'#'+encodeURIComponent(start.id):'#','vn-breadcrumb');
  here.setAttribute('aria-current','page');context.append(here);
  const controls=document.createElement('div');controls.className='vn-lecture-controls';
  for(const [label,lecture,cls] of [['← Previous',previous,'vn-previous'],['Next →',next,'vn-next']]) {
    if(lecture)controls.append(link(label,encodeURIComponent(lecture.file),cls));
    else {const disabled=document.createElement('span');disabled.className=cls;disabled.textContent=label;disabled.setAttribute('aria-disabled','true');controls.append(disabled);}
  }
  const backLabel=current.exam==='Labs'?current.subject+' Lab':current.subject;
  nav.append(link('✦ Vitanova','index.html','vn-home'),link('← Back to '+backLabel,'index.html#'+encodeURIComponent(current.category),'vn-subject'),context,controls);
  // Remove only the two obsolete hub buttons, leaving all original section navigation.
  document.querySelectorAll('a[href]').forEach(anchor=>{
    const label=anchor.textContent.trim();
    if((label==='← Vitanova Learning Hub'||label==='← Back')&&/^index\.html(?:#|$)/.test(anchor.getAttribute('href')||''))anchor.remove();
  });
  if(start)start.before(nav);else document.body.prepend(nav);
  let sectionBar=[...document.querySelectorAll('nav')].find(bar=>bar.querySelector('a[href^="#"]'));
  if(!sectionBar){
    sectionBar=document.createElement('nav');
    for(const section of main?.querySelectorAll('section[id]')||[]){
      const heading=section.querySelector('h2,h3');
      if(heading)sectionBar.append(link(heading.textContent.trim(),'#'+encodeURIComponent(section.id),'vn-topic'));
    }
  }
  (header||nav).after(sectionBar);
  const topics=new Map();
  const flashcards=link('▤ Flashcards','flashcards.html?lecture='+encodeURIComponent(current.id),'vn-flashcards');
  sectionBar.classList.add('vn-lecture-topics');
  if(!sectionBar.hasAttribute('aria-label'))sectionBar.setAttribute('aria-label','Lecture topics');
  for(const a of sectionBar.querySelectorAll('a[href^="#"]')){
    let id;try{id=decodeURIComponent(a.hash.slice(1));}catch{continue;}
    const target=document.getElementById(id);
    if(!target||topics.has(id)){a.remove();continue;}
    topics.set(id,target);
  }
  sectionBar.append(flashcards);
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
  apply(document.documentElement.dataset.theme||(['dark','light'].includes(theme)?theme:window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'));
  toggle.addEventListener('click',()=>apply(document.documentElement.dataset.theme==='dark'?'light':'dark'));controls.append(toggle);
  const top=document.createElement('a');top.className='vn-back-to-top';top.href='#';top.textContent='↑ Top';top.setAttribute('aria-label','Back to top');
  top.addEventListener('click',event=>{event.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
  document.body.append(top);
  const appearance=document.createElement('script');appearance.src='study-appearance.js?v=3';document.body.append(appearance);
  if(storage&&!storage.isAvailable())storage.warning();
})();
