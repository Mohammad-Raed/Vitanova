/* Registry-driven navigation and manual lecture progress. No lecture open marks completion. */
(function () {
  'use strict';
  const lectures = window.VitanovaLectures || [];
  const progress = window.VitanovaStudyProgress;
  const storage = window.VitanovaStorage;
  const $ = (id) => document.getElementById(id);
  const cards = $('cards');
  // Retained in HTML so a cached pre-refresh script can still start.
  $('continue-studying')?.remove();
  const views = window.VitanovaViews || {};
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fileHref=(file)=>encodeURIComponent(file);
  let current='home', query='', completion='all';
  function route() { try { return decodeURIComponent(location.hash.slice(1).split('?')[0]) || 'home'; } catch { return 'home'; } }
  function ordered(items) { return [...items].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)); }
  function done(lecture) { return progress?.isCompleted(lecture.category,lecture.id) === true; }
  function matches(lecture) {
    const haystack=[lecture.title,lecture.system,lecture.exam,lecture.subject,lecture.lectureLabel,lecture.description].join(' ').toLowerCase();
    return query.toLowerCase().trim().split(/\s+/).every(term=>haystack.includes(term)) && (completion==='all'||done(lecture)===(completion==='completed'));
  }
  function breadcrumbs(key) {
    const chain=[]; const seen=new Set();
    while (key && views[key] && !seen.has(key)) { seen.add(key); chain.unshift(key); key=views[key].parent; }
    $('breadcrumbs').innerHTML=chain.map((id,i)=>`${i?'<span aria-hidden="true">/</span>':''}<a href="#${encodeURIComponent(id)}"${i===chain.length-1?' aria-current="page"':''}>${esc(id==='home'?'Home':views[id].title)}</a>`).join('');
  }
  const isLab=key=>typeof key==='string'&&(key==='mss-labs'||key.startsWith('mss-labs-'));
  const resourceCount=(number,lab=false)=>number+' '+(lab?'lab':'lecture')+' '+(number===1?'resource':'resources');
  function overview(category) {
    const list=lectures.filter(l=>l.category===category), count=list.filter(done).length;
    const pct=list.length?Math.round(100*count/list.length):0;
    $('dashboard-overview').innerHTML=`<div class="progress-topline"><div><span class="eyebrow">YOUR PROGRESS</span><p id="progress-count">${count} of ${resourceCount(list.length,isLab(category))} completed</p></div><strong id="completion-percent">${pct}%</strong></div><progress id="completion-progress" max="100" value="${pct}" aria-label="${pct}% complete"></progress><p class="progress-note">Mark completion yourself. Opening a lecture never changes progress.</p>`;
    $('dashboard-overview').hidden=!list.length;
  }
  function drawLectures(items) {
    const visible=ordered(items).filter(matches);
    $('search-summary').textContent=`${visible.length} of ${resourceCount(items.length,isLab(current))} shown`;
    cards.innerHTML=visible.length ? visible.map(lecture=>`<article class="study-resource${done(lecture)?' is-complete':''}" data-resource-id="${esc(lecture.id)}"><label class="completion-control"><input type="checkbox" ${done(lecture)?'checked':''} aria-label="Mark ${esc(lecture.lectureLabel+' '+lecture.title)} completed"></label><div class="resource-main"><div class="resource-meta"><span class="resource-kicker">${esc(lecture.lectureLabel)}</span><span class="resource-status">${done(lecture)?'Completed':'Not completed'}</span></div><h3><a href="${esc(fileHref(lecture.file))}">${esc(lecture.title)}</a></h3><p>${esc(lecture.description)}</p>${current==='search'?`<small class="resource-context">${esc(lecture.system+' · '+lecture.exam+' · '+lecture.subject)}</small>`:''}</div><a class="resource-open" href="${esc(fileHref(lecture.file))}" aria-label="Open ${esc(lecture.title)}">Open <span aria-hidden="true">→</span></a></article>`).join('') : `<div class="empty">${items.length?'No lectures match these filters. Try another search or completion filter.':isLab(current)?'No labs uploaded yet. New resources will appear here when added.':'No lectures uploaded yet. New resources will appear here when added.'}</div>`;
    if (views[current]?.category && views[current]?.cards?.length) cards.insertAdjacentHTML('beforeend', '<section class="more-subjects"><h3>More subjects</h3>'+views[current].cards.map(([title,,to])=>`<a class="resource-open" href="#${encodeURIComponent(to)}">${esc(title)} →</a>`).join(' ')+'</section>');
  }
  function descendants(key) {
    const view=views[key];
    return [...(view?.category ? lectures.filter(l=>l.category===view.category) : []),...(view?.cards||[]).flatMap(card=>descendants(card[2]))];
  }
  function studyOverview() {
    const host=$('study-snapshot');
    host.hidden=current!=='home';
    if(host.hidden)return;
    const completed=lectures.filter(done).length;
    const mistakes=window.VitanovaMistakes?.count()||0;
    const core=window.VitanovaFlashcardCore;
    const records=(core&&storage?.read(core.KEY,{version:1,records:{}},core.validState)?.records)||{};
    const now=Date.now(), due=Object.values(records).filter(r=>r.due<=now).length;
    const record=storage?.read('vitanova:recent:v1',null);
    const lecture=lectures.find(l=>l.id===record?.lectureId);
    const hash=typeof record?.hash==='string'&&/^#[a-zA-Z][\w:.-]*$/.test(record.hash)?record.hash:'';
    host.innerHTML=`<div class="today-heading"><div><span class="eyebrow">YOUR NEXT SESSION</span><h2>Study Today</h2></div><span class="today-progress">${completed} / ${lectures.length} lectures complete</span></div>
    <a class="snapshot-card today-resume"${lecture?' id="continue-studying"':''} href="${lecture?esc(fileHref(lecture.file)+hash):'#search'}"><span class="snapshot-label">${lecture?'RESUME LECTURE':'START STUDYING'}</span><strong>${lecture?esc(lecture.title):'Find a lecture'}</strong><span class="snapshot-detail">${lecture?esc(lecture.system+' · '+lecture.exam+' · '+lecture.lectureLabel):'Search by subject or topic'} <span aria-hidden="true">→</span></span></a>
    <a class="snapshot-card" href="flashcards.html${due?'?mode=due-only':''}"><span class="snapshot-label">FLASHCARDS</span><strong>${due}<small> due</small></strong><span class="snapshot-detail">${due?'Review due cards':'Explore the flashcard library'} →</span></a>
    <a class="snapshot-card" href="#mistakes"><span class="snapshot-label">MISSED QUESTIONS</span><strong>${mistakes}<small> to review</small></strong><span class="snapshot-detail">Redo mistakes →</span></a>`;
  }
  function sidebarSystems() {
    const ancestors=new Set();let key=current;
    while(key&&views[key]&&!ancestors.has(key)){ancestors.add(key);key=views[key].parent;}
    $('sidebar-systems').innerHTML=(views.home?.cards||[]).map(([title,,to,icon])=>{
      const list=descendants(to), completed=list.filter(done).length;
      const paperSummary=['mss-past','mss-past-mid'].includes(to)&&window.VitanovaPastPapers?window.VitanovaPastPapers.questions.length+' recalled questions · repetitions retained':null;
      return `<a href="#${encodeURIComponent(to)}"${ancestors.has(to)?' aria-current="page"':''}><span class="sidebar-system-icon" aria-hidden="true">${esc(icon)}</span><span>${esc(title)}<small>${completed} / ${list.length} completed</small></span></a>`;
    }).join('');
  }
  function drawCards(view) {
    cards.innerHTML=(view.cards||[]).map(([title,description,to,icon,tag])=>{
      const list=descendants(to), completed=list.filter(done).length;
      const paperSummary=['mss-past','mss-past-mid'].includes(to)&&window.VitanovaPastPapers?window.VitanovaPastPapers.questions.length+' recalled questions · repetitions retained':null;
      const summary=views[to]?.checklist?'Midterm and Final views':paperSummary||(isLab(to)||list.length?`${resourceCount(list.length,isLab(to))}${list.length?' · '+completed+' completed':''}`:'Resources coming soon');
      return `<article class="card category-card"><div class="card-top"><div class="icon" aria-hidden="true">${esc(icon)}</div><span class="tag">${esc(tag)}</span></div><h3>${esc(title)}</h3><p>${esc(description)}</p><span class="category-progress">${summary}</span>${list.length?`<progress class="category-meter" max="${list.length}" value="${completed}" aria-label="${esc(title)}: ${completed} of ${resourceCount(list.length,isLab(to))} completed"></progress>`:''}<a class="action" href="#${encodeURIComponent(to)}">Explore <span aria-hidden="true">→</span></a></article>`;
    }).join('');
    $('count').textContent=current==='mss-past'?'Midterm question collection':resourceCount(descendants(current).length,isLab(current));
  }
  function render() {
    const requested=route(); current=views[requested]?requested:'home'; const view=views[current];
    cards._vnRevisionCleanup?.();cards._vnRevisionCleanup=null;cards._vnChecklistRefresh=null;
    cards.className='grid';
    const isHome=current==='home';
    $('site-header').classList.toggle('is-home',isHome); $('site-header').classList.toggle('is-internal',!isHome);
    $('hero-content').hidden=!isHome; $('compact-header').hidden=isHome;
    $('hub-main').classList.toggle('is-dashboard',Boolean(view.category)||current==='search');
    breadcrumbs(current);
    $('page-eyebrow').textContent=['saved','mistakes'].includes(current)?'YOUR REVISION':current==='backup'?'YOUR DATA':view.checklist?'STUDY PLANNER':'EXPLORE FILE LIBRARY';
    $('page-title').textContent=view.title; $('page-subtitle').textContent=view.subtitle||'';
    $('dashboard-overview').hidden=true; $('lecture-filters').hidden=!(view.category||current==='search');
    const shortcut=$('mss-checklist-shortcut');
    if(shortcut){
      const show=['mss-mid','mss-final','mss-labs'].some(key=>current===key||current.startsWith(key+'-'));
      shortcut.hidden=!show;
      shortcut.href=current.startsWith('mss-mid')?'#mss-checklist-mid':'#mss-checklist';
    }
    if(view.checklist){window.VitanovaMSSChecklist?.render(cards,$('count'),view.checklist);}
    else if(view.pastPaper){window.VitanovaSaved.render(cards,$('count'),{collection:'past-paper'});}
    else if (view.category||current==='search') {
      const items=view.category?lectures.filter(l=>l.category===view.category):lectures;
      if(view.category) {
        const sample=items[0]; $('page-subtitle').textContent=sample?`${sample.system} · ${sample.exam} · ${sample.subject}`:isLab(view.category)?'No labs uploaded yet.':'No lectures uploaded yet.';
        overview(view.category);
      }
      $('count').textContent=resourceCount(items.length,isLab(view.category)); drawLectures(items);
    } else if (current==='saved'||current==='mistakes') {
      const params=new URLSearchParams(location.hash.split('?')[1]||'');
      window.VitanovaSaved?.render(cards,$('count'),{mode:current==='mistakes'?'mistakes':'saved',lectureId:params.get('lecture')||undefined});
    } else if (current==='backup') { $('count').textContent='Local data only'; window.VitanovaBackup?.mount(cards); }
    else drawCards(view);
    document.title=(isHome?'':view.title+' · ')+'Vitanova Learning Hub';
    document.querySelectorAll('.hub-links a').forEach(a=>{if(a.hash==='#'+current||(view.checklist&&a.hash==='#mss-checklist'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    studyOverview();sidebarSystems();
    if(storage && !storage.isAvailable())storage.warning();
  }
  cards.addEventListener('change',event=>{
    const checkbox=event.target.closest('input[type="checkbox"]'), row=checkbox?.closest('[data-resource-id]'); if(!row)return;
    const lecture=lectures.find(l=>l.id===row.dataset.resourceId); if(!lecture)return;
    const success=progress.setCompleted(lecture.category,lecture.id,checkbox.checked);
    const view=views[current]; if(view.category)overview(view.category);
    row.classList.toggle('is-complete',checkbox.checked); row.querySelector('.resource-status').textContent=checkbox.checked?'Completed':'Not completed';
    if(completion!=='all')drawLectures(view.category?lectures.filter(l=>l.category===view.category):lectures);
    if(!success)storage?.warning('Progress could not be saved permanently in this browser. Export a backup before leaving.');
  });
  $('lecture-search').addEventListener('input',event=>{query=event.target.value; const view=views[current]; drawLectures(view.category?lectures.filter(l=>l.category===view.category):lectures);});
  $('completion-filter').addEventListener('change',event=>{completion=event.target.value;const view=views[current];drawLectures(view.category?lectures.filter(l=>l.category===view.category):lectures);});
  function savedCount(){const count=window.VitanovaBookmarks?.count()||0;$('saved-count').textContent=count?`(${count})`:'';studyOverview();}
  window.addEventListener('vitanova:bookmarks-changed',savedCount);
  window.addEventListener('vitanova:mistakes-changed',studyOverview);
  window.addEventListener('vitanova:progress-changed',()=>{studyOverview();sidebarSystems();if(views[current]?.checklist)cards._vnChecklistRefresh?.();if(!views[current]?.category&&views[current]?.cards)drawCards(views[current]);});
  window.addEventListener('storage',()=>{render();savedCount();});
  window.addEventListener('hashchange',()=>{query='';completion='all';$('lecture-search').value='';$('completion-filter').value='all';render();if(!(views[route()]?.pastPaper&&new URLSearchParams(location.hash.split('?')[1]||'').has('question'))){$('page-title').tabIndex=-1;$('page-title').focus({preventScroll:true});window.scrollTo(0,0);}});
  const menuButton=$('study-menu-toggle'),sidebar=document.querySelector('.study-sidebar'),mobileMenu=window.matchMedia('(max-width:900px)');
  function setMenu(open){sidebar.classList.toggle('is-open',open);menuButton.setAttribute('aria-expanded',String(!mobileMenu.matches||open));}
  menuButton.addEventListener('click',()=>setMenu(!sidebar.classList.contains('is-open')));
  sidebar.addEventListener('click',event=>{if(event.target.closest('a[href^="#"]')&&mobileMenu.matches)setMenu(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileMenu.matches&&sidebar.classList.contains('is-open')){setMenu(false);menuButton.focus();}});
  mobileMenu.addEventListener('change',()=>setMenu(false));setMenu(false);
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('hub-main').focus();$('hub-main').scrollIntoView({block:'start'});});
  const toggle=document.createElement('button'); toggle.className='vn-theme-toggle';toggle.type='button';toggle.setAttribute('aria-label','Toggle light and dark theme');
  let theme;try{const raw=localStorage.getItem('vitanova:theme:v1');theme=['dark','light'].includes(raw)?raw:JSON.parse(raw);}catch{}
  function apply(value){document.documentElement.dataset.theme=value;toggle.textContent=value==='dark'?'☀ Light':'☾ Dark';try{localStorage.setItem('vitanova:theme:v1',value);}catch{storage?.warning();}}
  apply(['dark','light'].includes(theme)?theme:'dark'); toggle.addEventListener('click',()=>apply(document.documentElement.dataset.theme==='dark'?'light':'dark'));$('sidebar-appearance').append(toggle);
  window.addEventListener('vitanova:storage-changed',event=>{
    if(event.detail?.external || event.detail?.imported?.includes('theme')){
      let imported;try{imported=localStorage.getItem('vitanova:theme:v1');}catch{}
      const value=['dark','light'].includes(imported)?imported:'dark';
      document.documentElement.dataset.theme=value;toggle.textContent=value==='dark'?'☀ Light':'☾ Dark';
    }
  });
  window.addEventListener('pageshow',studyOverview);
  render();savedCount();
})();
