/* Shared scoring and revision renderer for lectures and curated recalled papers. */
(function () {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const subjects=['Anatomy','Microbiology','Pathology','Pharmacology','Physiology'];
  function render(host,countNode,settings={}) {
    host._vnRevisionCleanup?.();
    const registry=window.VitanovaLectures||[],bank=window.VitanovaQuestionBank||[];
    const data=window.VitanovaPastPapers||{sources:[],questions:[]};
    const papers=settings.collection==='past-paper';
    const bookmarks=window.VitanovaBookmarks,mistakes=window.VitanovaMistakes;
    const byId=new Map(bank.map(q=>[q.id,q]));
    const meta=q=>window.VitanovaQuestionCatalog?.metadata(q)||registry.find(l=>l.id===q.lectureId);
    const sourceKey=q=>window.VitanovaQuestionCatalog?.sourceKey(q)||q.lectureId;
    const href=q=>window.VitanovaQuestionCatalog?.href(q)||(registry.find(l=>l.id===q.lectureId)?encodeURIComponent(registry.find(l=>l.id===q.lectureId).file)+'#mcq-'+encodeURIComponent(q.id):'index.html#home');
    const eligible=q=>(!papers||q.kind==='past-paper')&&(!settings.lectureId||q.lectureId===settings.lectureId);
    let mode=papers?'practice':settings.mode==='mistakes'?'mistakes':'saved';
    const responses={saved:new Map(),mistakes:new Map(),practice:new Map(),review:new Map()};
    let order=[],attemptIds=[];const revealed=new Set();
    const filters={system:'all',subject:'all',lecture:settings.lectureId||'all',source:'all',batch:'all',year:'all',query:''};
    const chosenSubjects=new Set(subjects),token=String(Math.random());
    const batches=[...new Set(data.sources.map(s=>s.batch).filter(v=>v!==null&&v!==undefined).map(String))],years=[...new Set(data.sources.map(s=>s.year).filter(v=>v!==null&&v!==undefined).map(String))];
    const opt=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
    function capture(){attemptIds=Object.entries(mistakes.all()).filter(([,r])=>!r.mastered).map(([id])=>id);}
    capture();
    function selected(){
      if(mode==='review')return data.questions.filter(q=>q.status==='review');
      if(mode==='practice')return bank.filter(eligible);
      const ids=mode==='mistakes'?attemptIds:Object.keys(bookmarks.all());
      return [...new Set(ids)].map(id=>byId.get(id)).filter(q=>q&&eligible(q));
    }
    function visible(){
      const list=selected().filter(q=>{
        const m=meta(q);
        return (filters.system==='all'||m?.system===filters.system)&&(filters.subject==='all'||m?.subject===filters.subject)&&(filters.lecture==='all'||sourceKey(q)===filters.lecture)&&(!papers||chosenSubjects.has(q.subject))&&(filters.source==='all'||q.provenance?.some(r=>r.sourceId===filters.source))&&(filters.batch==='all'||q.provenance?.some(r=>String(data.sources.find(s=>s.id===r.sourceId)?.batch)===filters.batch))&&(filters.year==='all'||q.provenance?.some(r=>String(data.sources.find(s=>s.id===r.sourceId)?.year)===filters.year))&&(!filters.query||filters.query.toLowerCase().trim().split(/\s+/).every(t=>[q.question,...(q.tags||[]),...(q.options||[])].join(' ').toLowerCase().includes(t)));
      });
      const rank=new Map(order.map((id,i)=>[id,i]));return order.length?list.sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity)):list;
    }
    function sourceDetails(q){
      if(q.kind!=='past-paper')return '';
      return `<div class="vn-provenance">${q.provenance.map(r=>`<span class="vn-source-badge">${esc(data.sources.find(s=>s.id===r.sourceId)?.label||r.sourceId)} · Q${r.questionNumber} · p${r.page}</span>`).join('')}</div><details class="vn-source-details"><summary>Original recall and source notes</summary><p>${esc(q.editorial.note)}</p>${q.provenance.map(r=>`<p><strong>${esc(data.sources.find(s=>s.id===r.sourceId)?.fileName||r.sourceId)} · page ${r.page} · Q${r.questionNumber}</strong></p><pre>${esc(r.originalText)}</pre>`).join('')}</details>`;
    }
    host.classList.add('vn-saved-host');
    host.innerHTML=`<div class="vn-saved-toolbar" data-vn-revision="${token}"><div class="vn-saved-intro"><span class="eyebrow">${papers?'MSS MIDTERM · RECALLED PAPERS':'YOUR REVISION COLLECTION'}</span><p>${papers?'Practise every recalled question, including repetitions. Answers follow the supplied past-paper key for this exam.':'Answers and explanations appear after each choice. Correct mistake-revision answers are marked mastered.'}</p></div>
      <div class="vn-saved-tools"><label>Collection<select id="vn-saved-mode">${papers?opt('practice','Practice questions')+opt('mistakes','Redo mistakes')+opt('review','Answer-only recalls'):opt('saved','Saved questions')+opt('mistakes','Redo mistakes')}</select></label>
      ${papers?`<label>Source paper<select id="vn-past-source">${opt('all','All source papers')}${data.sources.map(s=>opt(s.id,s.label)).join('')}</select></label>${batches.length?`<label>Batch/cohort<select id="vn-past-batch">${opt('all','All supplied batches')}${batches.map(v=>opt(v,v)).join('')}</select></label>`:''}${years.length?`<label>Year<select id="vn-past-year">${opt('all','All supplied years')}${years.map(v=>opt(v,v)).join('')}</select></label>`:''}<label>Search topics or questions<input id="vn-past-search" type="search" placeholder="For example: median nerve"></label>`:`<label>System<select id="vn-saved-system">${opt('all','All systems')}${[...new Set(registry.map(l=>l.system))].map(x=>opt(x,x)).join('')}</select></label><label>Subject<select id="vn-saved-filter">${opt('all','All subjects')}${[...new Set(registry.map(l=>l.subject))].sort().map(x=>opt(x,x)).join('')}</select></label><label>Lecture or collection<select id="vn-saved-lecture">${opt('all','All lectures and papers')}${registry.map(l=>opt(l.id,`${l.system} · ${l.subject} · ${l.lectureLabel}`)).join('')}${data.questions.length?opt('past-mss-mid','MSS Midterm Past Papers'):''}</select></label>`}
      <button id="vn-saved-mix" type="button">Shuffle questions</button><button id="vn-saved-reset" type="button">${papers?'Reset Current Quiz':'Start new attempt'}</button></div>
      ${papers?`<fieldset class="vn-past-subjects"><legend>Choose one or several subjects</legend><div><button type="button" id="vn-past-all">Select all</button><button type="button" id="vn-past-none">Clear selection</button></div>${subjects.map(s=>`<label><input type="checkbox" value="${s}" checked> ${s} <small>(${data.questions.filter(q=>q.subject===s&&q.status==='ready').length} MCQs / ${data.questions.filter(q=>q.subject===s&&q.status==='review').length} answer-only)</small></label>`).join('')}</fieldset><p class="progress-note">Filters change the visible score; answers are retained for this page session. Reset clears only the selected collection’s attempt answers, never bookmarks or mistake history. Mistake mastery is saved on this device.</p>`:''}
      <div class="vn-saved-stats" aria-live="polite"><strong id="vn-saved-score"></strong><span>Bookmarks and mistakes stay on this device.</span></div><p id="vn-missing-questions" class="vn-storage-warning" hidden></p></div><div id="vn-saved-list" class="vn-saved-list"></div>`;
    host.querySelector('#vn-saved-mode').value=mode;
    if(!papers){host.querySelector('#vn-saved-lecture').value=filters.lecture;host.querySelector('#vn-saved-lecture').disabled=Boolean(settings.lectureId);}
    function draw(focus){
      if(!host.querySelector(`[data-vn-revision="${token}"]`))return;
      const items=visible(),answers=responses[mode],records=mistakes.all(),saved=bookmarks.all();
      if(countNode)countNode.textContent=`${items.length} ${mode==='review'?'answer-only recalls':mode==='practice'?'practice questions':mode==='mistakes'?'mistake questions':'saved questions'}`;
      const scored=items.filter(q=>q.status!=='review'),answered=scored.filter(q=>answers.has(q.id)),correct=answered.filter(q=>answers.get(q.id)===q.answer).length;
      host.querySelector('#vn-saved-score').textContent=mode==='review'?`${items.length} answer-only recalls`:`${correct} correct · ${answered.length} answered · ${scored.length} questions · ${mode==='mistakes'?'Mistake revision':mode==='practice'?'Past-paper practice':'Saved revision'}`;
      const missing=(mode==='saved'?Object.keys(saved):mode==='mistakes'?Object.keys(records):[]).filter(id=>!byId.has(id)).length;
      const warning=host.querySelector('#vn-missing-questions');warning.hidden=!missing;warning.textContent=`${missing} question references are unavailable in this version. Your original records have been kept.`;
      const list=host.querySelector('#vn-saved-list');
      if(!items.length)list.innerHTML=`<div class="vn-saved-empty"><h3>${selected().length?'No matching questions':mode==='mistakes'?'No mistakes to redo':mode==='review'?'No unresolved questions':'No saved questions yet'}</h3><p>${papers?'Choose a subject or broaden the filters. Incorrect answers will become available in Redo Mistakes.':'Save questions in a lecture or past-paper practice to add them here.'}</p><a href="index.html#home">Browse lectures →</a></div>`;
      else list.innerHTML=items.map((q,i)=>{
        const m=meta(q),attempted=answers.has(q.id),choice=answers.get(q.id),unresolved=q.status==='review';
        return `<article class="vn-review-question" id="${esc(q.id)}" data-question-id="${esc(q.id)}"><div class="vn-review-source"><span>QUESTION ${i+1} OF ${items.length}</span><span>${esc(m?.system||q.system)} · ${esc(m?.subject||q.subject)} · ${esc(m?.lectureLabel||'Midterm Past Papers')}</span></div>${q.kind==='past-paper'?`<div class="vn-provenance">${q.provenance.map(r=>`<span class="vn-source-badge">${esc(data.sources.find(s=>s.id===r.sourceId)?.label||r.sourceId)} · Q${r.questionNumber} · p${r.page}</span>`).join('')}</div>`:''}<h3>${esc(q.question)}</h3>
        ${unresolved?`<p class="progress-note">Answer-only recall</p><button type="button" data-reveal="true">Show recalled answer</button>${revealed.has(q.id)?`<div class="vn-review-explanation" role="status"><strong>Recalled answer: ${esc(q.editorial.recalledAnswer)}</strong></div>`:''}<div class="vn-review-footer"><button class="vn-review-remove" type="button">${Object.hasOwn(saved,q.id)?'Remove bookmark':'Save question'}</button></div>`:`<div class="vn-review-options">${q.options.map((text,j)=>`<button type="button" class="vn-review-option${attempted?(j===q.answer?' is-correct':j===choice?' is-wrong':''):''}" data-answer="${j}" ${attempted?'disabled':''}><span class="vn-review-letter">${String.fromCharCode(65+j)}</span><span>${esc(text)}</span></button>`).join('')}</div>${attempted?`<div class="vn-review-explanation" role="status"><strong>${choice===q.answer?'✓ Correct':'Correct answer: '+String.fromCharCode(65+q.answer)+' — '+esc(q.options[q.answer])}${mode==='mistakes'&&records[q.id]?.mastered?' · Mastered':''}</strong><p>${esc(q.explanation)}</p></div>`:''}<div class="vn-review-footer"><a href="${esc(href(q))}">${q.kind==='past-paper'?'View in Past Papers ↗':'View in original lecture ↗'}</a><button class="vn-review-remove" type="button">${Object.hasOwn(saved,q.id)?'Remove bookmark':'Save question'}</button></div>`}
        ${q.kind==='past-paper'?sourceDetails(q).replace(/<div class="vn-provenance">[\s\S]*?<\/div>/,''):''}</article>`;
      }).join('');
      if(focus){const card=[...list.querySelectorAll('.vn-review-question')].find(c=>c.dataset.questionId===focus.id)||list.querySelector('.vn-review-question');const target=focus.answer?card?.querySelector('.vn-review-explanation'):card?.querySelector('.vn-review-remove');if(target){if(focus.answer)target.tabIndex=-1;target.focus({preventScroll:true});}else if(list.querySelector('h3')){list.querySelector('h3').tabIndex=-1;list.querySelector('h3').focus({preventScroll:true});}}
    }
    host.querySelector('#vn-saved-mode').addEventListener('change',e=>{mode=e.target.value;order=[];if(mode==='mistakes')capture();draw();});
    if(papers){
      host.querySelector('#vn-past-source').addEventListener('change',e=>{filters.source=e.target.value;draw();});
      for(const field of ['batch','year'])host.querySelector('#vn-past-'+field)?.addEventListener('change',e=>{filters[field]=e.target.value;draw();});
      host.querySelector('#vn-past-search').addEventListener('input',e=>{filters.query=e.target.value;draw();});
      host.querySelector('.vn-past-subjects').addEventListener('change',e=>{if(e.target.type!=='checkbox')return;e.target.checked?chosenSubjects.add(e.target.value):chosenSubjects.delete(e.target.value);draw();});
      for(const [id,all]of [['vn-past-all',true],['vn-past-none',false]])host.querySelector('#'+id).addEventListener('click',()=>{chosenSubjects.clear();host.querySelectorAll('.vn-past-subjects input').forEach(c=>{c.checked=all;if(all)chosenSubjects.add(c.value);});draw();});
    }else for(const [name,selector]of [['system','#vn-saved-system'],['subject','#vn-saved-filter'],['lecture','#vn-saved-lecture']])host.querySelector(selector).addEventListener('change',e=>{filters[name]=e.target.value;order=[];draw();});
    host.querySelector('#vn-saved-reset').addEventListener('click',()=>{responses[mode].clear();order=[];if(mode==='mistakes')capture();draw();});
    host.querySelector('#vn-saved-mix').addEventListener('click',()=>{order=visible().map(q=>q.id);for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}draw();});
    host.querySelector('#vn-saved-list').addEventListener('click',e=>{const card=e.target.closest('.vn-review-question');if(!card)return;const id=card.dataset.questionId,q=byId.get(id);if(!q)return;if(e.target.closest('[data-reveal]')){revealed.add(id);draw();return;}if(q.status==='review'){if(e.target.closest('.vn-review-remove')){bookmarks.set(id,!bookmarks.has(id));draw();}return;}const option=e.target.closest('[data-answer]');if(option&&!responses[mode].has(id)){const answer=Number(option.dataset.answer);responses[mode].set(id,answer);mistakes.record(id,answer===q.answer,mode==='mistakes');draw({id,answer:true});}else if(e.target.closest('.vn-review-remove')){const ids=visible().map(x=>x.id),i=ids.indexOf(id);bookmarks.set(id,!bookmarks.has(id));draw({id:mode==='saved'?ids[i+1]||ids[i-1]:id});}});
    const update=()=>draw();window.addEventListener('vitanova:bookmarks-changed',update);
    const external=e=>{if(e.detail?.external||e.detail?.imported){capture();draw();}};window.addEventListener('vitanova:storage-changed',external);
    host._vnRevisionCleanup=()=>{window.removeEventListener('vitanova:bookmarks-changed',update);window.removeEventListener('vitanova:storage-changed',external);};
    draw();
    if(papers){const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('question');if(requested){const node=[...host.querySelectorAll('[data-question-id]')].find(n=>n.dataset.questionId===requested);if(node){node.tabIndex=-1;node.focus({preventScroll:true});node.scrollIntoView({block:'start'});}}}
  }
  window.VitanovaSaved={render};
})();
