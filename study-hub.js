/* Registry-driven navigation and manual lecture progress. No lecture open marks completion. */
(function () {
  'use strict';
  const lectures = window.VitanovaLectures || [];
  const progress = window.VitanovaStudyProgress;
  const storage = window.VitanovaStorage;
  const $ = (id) => document.getElementById(id);
  const cards = $('cards');
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
  function overview(category) {
    const list=lectures.filter(l=>l.category===category), count=list.filter(done).length;
    const pct=list.length?Math.round(100*count/list.length):0;
    $('dashboard-overview').innerHTML=`<div class="progress-topline"><div><span class="eyebrow">YOUR PROGRESS</span><p id="progress-count">${count} of ${list.length} lecture resources completed</p></div><strong id="completion-percent">${pct}%</strong></div><progress id="completion-progress" max="100" value="${pct}" aria-label="${pct}% complete"></progress><p class="progress-note">Mark completion yourself. Opening a lecture never changes progress.</p>`;
    $('dashboard-overview').hidden=!list.length;
  }
  function drawLectures(items) {
    const visible=ordered(items).filter(matches);
    $('search-summary').textContent=`${visible.length} of ${items.length} lecture resources shown`;
    cards.innerHTML=visible.length ? visible.map(lecture=>`<article class="study-resource${done(lecture)?' is-complete':''}" data-resource-id="${esc(lecture.id)}"><label class="completion-control"><input type="checkbox" ${done(lecture)?'checked':''} aria-label="Mark ${esc(lecture.lectureLabel+' '+lecture.title)} completed"></label><div class="resource-main"><div class="resource-meta"><span class="resource-kicker">${esc(lecture.lectureLabel)}</span><span class="resource-status">${done(lecture)?'Completed':'Not completed'}</span></div><h3><a href="${esc(fileHref(lecture.file))}">${esc(lecture.title)}</a></h3><p>${esc(lecture.description)}</p>${current==='search'?`<small class="resource-context">${esc(lecture.system+' · '+lecture.exam+' · '+lecture.subject)}</small>`:''}</div><a class="resource-open" href="${esc(fileHref(lecture.file))}" aria-label="Open ${esc(lecture.title)}">Open <span aria-hidden="true">→</span></a></article>`).join('') : `<div class="empty">${items.length?'No lectures match these filters. Try another search or completion filter.':'No lectures uploaded yet. New resources will appear here when added.'}</div>`;
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
    const saved=window.VitanovaBookmarks?.count()||0;
    const mistakes=window.VitanovaMistakes?.count()||0;
    host.innerHTML=`<div class="snapshot-card"><span class="snapshot-label">Explore file library</span><strong>${lectures.length}<small> lectures</small></strong><span class="snapshot-detail">Across ${new Set(lectures.map(l=>l.system)).size} systems</span></div><div class="snapshot-card"><span class="snapshot-label">Completed</span><strong>${completed}<small> / ${lectures.length}</small></strong><span class="snapshot-detail">Marked complete by you</span></div><a class="snapshot-card" href="#saved"><span class="snapshot-label">Saved questions</span><strong>${saved}</strong><span class="snapshot-detail">Your personal revision collection <span aria-hidden="true">→</span></span></a><a class="snapshot-card" href="#mistakes"><span class="snapshot-label">Mistakes to revisit</span><strong>${mistakes}</strong><span class="snapshot-detail">Practise until you feel confident <span aria-hidden="true">→</span></span></a>`;
  }
  function sidebarSystems() {
    const ancestors=new Set();let key=current;
    while(key&&views[key]&&!ancestors.has(key)){ancestors.add(key);key=views[key].parent;}
    $('sidebar-systems').innerHTML=(views.home?.cards||[]).map(([title,,to,icon])=>{
      const list=descendants(to), completed=list.filter(done).length;
      return `<a href="#${encodeURIComponent(to)}"${ancestors.has(to)?' aria-current="page"':''}><span class="sidebar-system-icon" aria-hidden="true">${esc(icon)}</span><span>${esc(title)}<small>${completed} / ${list.length} completed</small></span></a>`;
    }).join('');
  }
  function drawCards(view) {
    cards.innerHTML=(view.cards||[]).map(([title,description,to,icon,tag])=>{
      const list=descendants(to), completed=list.filter(done).length;
      return `<article class="card category-card"><div class="card-top"><div class="icon" aria-hidden="true">${esc(icon)}</div><span class="tag">${esc(tag)}</span></div><h3>${esc(title)}</h3><p>${esc(description)}</p><span class="category-progress">${list.length?`${list.length} lecture ${list.length===1?'resource':'resources'} · ${completed} completed`:'Resources coming soon'}</span>${list.length?`<progress class="category-meter" max="${list.length}" value="${completed}" aria-label="${esc(title)}: ${completed} of ${list.length} lectures completed"></progress>`:''}<a class="action" href="#${encodeURIComponent(to)}">Explore <span aria-hidden="true">→</span></a></article>`;
    }).join('');
    $('count').textContent=descendants(current).length+' lecture resources';
  }
  function recent() {
    const host=$('continue-studying'); host.hidden=true;
    let record; try { record=storage?.read('vitanova:recent:v1',null)||JSON.parse(localStorage.getItem('vitanova:recent:v1')); } catch { return; }
    const lecture=lectures.find(l=>l.id===record?.lectureId); if(!lecture)return;
    const hash=typeof record.hash==='string'&&/^#[a-zA-Z][\w:.-]*$/.test(record.hash)?record.hash:'';
    host.innerHTML=`<div><span class="eyebrow">CONTINUE STUDYING</span><p>${esc(lecture.title)}</p><small>${esc(lecture.system+' · '+lecture.subject+' · '+lecture.lectureLabel)}</small></div><a class="resource-open" href="${esc(fileHref(lecture.file)+hash)}">Continue →</a>`;
    host.hidden=false;
  }
  function render() {
    const requested=route(); current=views[requested]?requested:'home'; const view=views[current];
    cards.className='grid'; $('continue-studying').hidden=true;
    const isHome=current==='home';
    $('site-header').classList.toggle('is-home',isHome); $('site-header').classList.toggle('is-internal',!isHome);
    $('hero-content').hidden=!isHome; $('compact-header').hidden=isHome;
    $('hub-main').classList.toggle('is-dashboard',Boolean(view.category)||current==='search');
    breadcrumbs(current);
    $('page-eyebrow').textContent=['saved','mistakes'].includes(current)?'YOUR REVISION':current==='backup'?'YOUR DATA':'EXPLORE FILE LIBRARY';
    $('page-title').textContent=view.title; $('page-subtitle').textContent=view.subtitle||'';
    $('dashboard-overview').hidden=true; $('lecture-filters').hidden=!(view.category||current==='search');
    if (view.category||current==='search') {
      const items=view.category?lectures.filter(l=>l.category===view.category):lectures;
      if(view.category) {
        const sample=items[0]; $('page-subtitle').textContent=sample?`${sample.system} · ${sample.exam} · ${sample.subject}`:'No lectures uploaded yet.';
        overview(view.category);
      }
      $('count').textContent=items.length+' lecture resources'; drawLectures(items);
    } else if (current==='saved'||current==='mistakes') {
      const params=new URLSearchParams(location.hash.split('?')[1]||'');
      window.VitanovaSaved?.render(cards,$('count'),{mode:current==='mistakes'?'mistakes':'saved',lectureId:params.get('lecture')||undefined});
    } else if (current==='backup') { $('count').textContent='Local data only'; window.VitanovaBackup?.mount(cards); }
    else {drawCards(view); if(isHome)recent();}
    document.title=(isHome?'':view.title+' · ')+'Vitanova Learning Hub';
    document.querySelectorAll('.hub-links a').forEach(a=>{if(a.hash==='#'+current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
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
  window.addEventListener('vitanova:progress-changed',()=>{studyOverview();sidebarSystems();if(!views[current]?.category&&views[current]?.cards)drawCards(views[current]);});
  window.addEventListener('storage',()=>{render();savedCount();});
  window.addEventListener('hashchange',()=>{query='';completion='all';$('lecture-search').value='';$('completion-filter').value='all';render();$('page-title').tabIndex=-1;$('page-title').focus({preventScroll:true});window.scrollTo(0,0);});
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
  render();savedCount();
})();
