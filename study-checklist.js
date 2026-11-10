/* Course plan and independent study/review marks. Uses the existing progress backup. */
(function () {
  'use strict';
  const lectures=window.VitanovaLectures||[], progress=window.VitanovaStudyProgress;
  const subjects=['Anatomy','Physiology','Pharmacology','Pathology','Microbiology','Biochemistry'];
  const plan={
    final:{Anatomy:11,Physiology:2,Pharmacology:2,Pathology:3,Microbiology:3,Biochemistry:2},
    labs:{Anatomy:6,Pathology:2,Microbiology:1}
  };
  const periods={mid:{title:'Midterm material',exam:'Midterm'},final:{title:'Final lectures',exam:'Final'},labs:{title:'Labs',exam:'Labs'}};
  const key={study:'mss-checklist-study',review:'mss-checklist-review'};
  const files=lectures.filter(l=>l.system==='MSS');
  const span=l=>{
    const ns=l.lectureLabel.match(/\d+/g)?.map(Number)||[];
    if(!ns.length)return [];
    if(ns.length===2&&/[–—-]/.test(l.lectureLabel)&&ns[1]>=ns[0]&&ns[1]-ns[0]<100) {
      return Array.from({length:ns[1]-ns[0]+1},(_,i)=>ns[0]+i);
    }
    return ns;
  };
  const sorted=(a,b)=>span(a).length-span(b).length||a.order-b.order||a.id.localeCompare(b.id);
  function group(period,subject) {
    const sources=files.filter(l=>l.exam===periods[period].exam&&l.subject===subject);
    const uploaded=[...new Set(sources.flatMap(span))].sort((a,b)=>a-b);
    const planned=plan[period]?.[subject]||0;
    const numbers=[...new Set([...Array.from({length:planned},(_,i)=>i+1),...uploaded])].sort((a,b)=>a-b);
    return numbers.map(n=>({n,id:period+'-'+subject.toLowerCase()+'-'+n,
      resources:sources.filter(l=>span(l).includes(n)).sort(sorted)}));
  }
  const make=(tag,label,cls)=>{
    const el=document.createElement(tag);if(label!==undefined)el.textContent=label;if(cls)el.className=cls;return el;
  };
  function anchor(label,href,cls){
    const a=make('a',label,cls);a.href=href;return a;
  }
  let onlyUnfinished=false;
  function render(host,count,mode){
    host.className='mss-checklist';
    const pageNav=make('nav',undefined,'mss-checklist-tabs');pageNav.setAttribute('aria-label','Checklist views');
    for(const [type,label,href] of [['mid','Midterm checklist','#mss-checklist-mid'],['final','Final checklist','#mss-checklist']]){
      const a=anchor(label,href);if(mode===type)a.setAttribute('aria-current','page');pageNav.append(a);
    }
    const top=make('div',undefined,'mss-checklist-top');
    const grades=make('dl',undefined,'mss-checklist-grades');grades.setAttribute('aria-label','Course grade breakdown');
    for(const [label,share] of [['Midterm','30%'],['Final exam','50%'],['Labs','20%']]){
      const item=make('div');item.append(make('dt',label),make('dd',share));grades.append(item);
    }
    const examNote=make('p','All midterm material is included in the final exam, with 10 multiple-choice questions (MCQs) on that material.','mss-checklist-note');
    const overall=make('p',undefined,'mss-checklist-overall');overall.setAttribute('role','status');
    const meter=make('progress');meter.setAttribute('aria-label','Overall review progress');
    const toggle=make('input');toggle.type='checkbox';toggle.checked=onlyUnfinished;
    const filter=make('label',undefined,'mss-checklist-filter');filter.append(toggle,make('span','Only unfinished'));
    const controls=make('div',undefined,'mss-checklist-controls');controls.append(overall,filter);
    top.append(pageNav,grades,examNote,controls,meter,
      make('p','Study and Review are separate. Opening a resource leaves both boxes unchanged. Marks are saved in this browser and included in Backup.','mss-checklist-note'));
    const empty=make('p','All items in this view are studied and reviewed.','mss-checklist-empty');empty.hidden=true;
    host.replaceChildren(top,empty);
    const groups=[], all=[];
    for(const period of mode==='mid'?['mid']:['final','mid','labs']){
      const section=make('section',undefined,'mss-checklist-section');
      const heading=make('h3',period==='mid'&&mode==='final'?'Midterm material on the final':periods[period].title);
      const subtotal=make('p',undefined,'mss-checklist-subtotal');
      const grid=make('div',undefined,'mss-checklist-grid');section.append(heading,subtotal,grid);host.append(section);
      const block={section,subtotal,groups:[]};groups.push(block);
      for(const subject of subjects){
        const items=group(period,subject);if(!items.length)continue;
        const card=make('section',undefined,'mss-checklist-subject');
        card.append(make('h4',subject));
        const table=make('table'), thead=table.createTHead(), hr=thead.insertRow();
        for(const label of [period==='labs'?'Lab':'Lecture','Study','Review']){
          const th=make('th',label);th.scope='col';hr.append(th);
        }
        const body=table.createTBody();card.append(table);grid.append(card);
        const state={card,rows:[]};block.groups.push(state);
        for(const item of items){
          const row=body.insertRow(), label=row.insertCell();
          const name=(period==='labs'?'Lab ':'Lecture ')+item.n;
          if(item.resources.length){
            const links=make('div',undefined,'mss-checklist-resources');
            const [primary,...alternates]=item.resources;
            const open=anchor('',encodeURIComponent(primary.file),'mss-checklist-primary');
            open.append(make('strong',name),make('span',primary.title));
            links.append(open);
            for(const l of alternates)links.append(anchor(l.title,encodeURIComponent(l.file)));
            label.append(links);
          }else{
            label.append(make('strong',name),make('span','Not uploaded','mss-checklist-pending'));
          }
          const inputs={};
          for(const type of ['study','review']){
            const cell=row.insertCell(), input=make('input');input.type='checkbox';
            input.setAttribute('aria-label',type+' '+periods[period].exam+' '+subject+' '+name);
            input.addEventListener('change',()=>{
              if(!progress?.setCompleted(key[type],item.id,input.checked))window.VitanovaStorage?.warning();
            });
            cell.append(input);inputs[type]=input;
          }
          const entry={item,row,inputs};all.push(entry);state.rows.push(entry);
        }
      }
    }
    function refresh(){
      const saved=progress?.all().categories||{};
      let studied=0,reviewed=0,visible=0;
      for(const block of groups){
        let total=0,blockStudy=0,blockReview=0,blockVisible=0;
        for(const subject of block.groups){
          let subjectVisible=0;
          for(const {item,row,inputs} of subject.rows){
            const study=saved[key.study]?.[item.id]??item.resources.some(r=>saved[r.category]?.[r.id]===true);
            const review=saved[key.review]?.[item.id]===true;
            inputs.study.checked=study;inputs.review.checked=review;
            row.hidden=onlyUnfinished&&study&&review;
            if(!row.hidden)subjectVisible++;
            total++;blockStudy+=Number(study);blockReview+=Number(review);
          }
          subject.card.hidden=!subjectVisible;blockVisible+=subjectVisible;
        }
        block.section.hidden=!blockVisible;
        block.subtotal.textContent=blockStudy+' / '+total+' studied · '+blockReview+' / '+total+' reviewed';
        studied+=blockStudy;reviewed+=blockReview;visible+=blockVisible;
      }
      count.textContent=all.length+(mode==='mid'?' lectures':' lectures and labs');
      overall.textContent=studied+' / '+all.length+' studied · '+reviewed+' / '+all.length+' reviewed';
      meter.max=all.length||1;meter.value=reviewed;meter.setAttribute('aria-valuetext',reviewed+' of '+all.length+' reviewed');
      empty.hidden=visible>0;
    }
    toggle.addEventListener('change',()=>{onlyUnfinished=toggle.checked;refresh();});
    host._vnChecklistRefresh=refresh;refresh();
  }
  window.VitanovaMSSChecklist={render};
})();
