/* Navigation derives from the lecture registry; empty standard categories stay visible. */
(function () {
  const lectures = window.VitanovaLectures || [];
  const views = {
    home: {title:'Explore file library', parent:null, subtitle:'Choose a system to browse its study resources.', cards:[['MSS System','Midterm, final, and past-paper study resources.','mss','🦴','SYSTEM'],['Immunology','Midterm and final immunology study resources.','immunology','🧬','SYSTEM']]},
    mss: {title:'MSS System', parent:'home', cards:[['Midterm Summary + AI MCQs','Lecture summaries and questions for the midterm.','mss-mid','📘','MIDTERM'],['Final Summary + AI MCQs','Lecture summaries and questions for the final.','mss-final','📗','FINAL'],['Past Papers','Practice papers from previous MSS examinations.','mss-past','📝','PAST PAPERS']]},
    immunology: {title:'Immunology', parent:'home', cards:[['Midterm','Immunology resources for the midterm examination.','immunology-mid','🧬','MIDTERM'],['Final','Immunology resources for the final examination.','immunology-final','🧬','FINAL']]},
    'mss-past': {title:'MSS Past Papers', parent:'mss', cards:[['Midterm Questions','Past-paper questions for the MSS midterm.','mss-past-mid','📝','PAST PAPERS'],['Final Questions','Past-paper questions for the MSS final.','mss-past-final','📝','PAST PAPERS']]},
    saved: {title:'Saved Questions', parent:'home', subtitle:'Your personal collection, ready for a focused revision session.'},
    mistakes: {title:'Redo Mistakes', parent:'home', subtitle:'Practise difficult questions. A correct revision answer marks a mistake mastered.'},
    search: {title:'Find a lecture', parent:'home', subtitle:'Search every registered lecture by title, system, subject, number, or topic.'},
    backup: {title:'Back up your study data', parent:'home', subtitle:'Export progress, bookmarks, mistakes, and preferences to keep a copy or move devices.'}
  };
  const subjects = [['anatomy','Anatomy','🦴'],['pharmacology','Pharmacology','💊'],['physiology','Physiology','❤️'],['pathology','Pathology','🔬'],['microbiology','Microbiology','🦠']];
  for (const exam of ['mid','final']) {
    const key = 'mss-' + exam;
    const list = exam === 'final' ? [...subjects,['biochemistry','Biochemistry','🧪']] : subjects;
    views[key] = {title:'MSS ' + (exam==='mid'?'Midterm':'Final'), parent:'mss', cards:list.map(([id,title,icon]) => [title,'Browse '+title.toLowerCase()+' lecture resources.',key+'-'+id,icon,'SUBJECT'])};
    for (const [id,title] of list) views[key+'-'+id]={title, parent:key, category:key+'-'+id};
  }
  for (const exam of ['mid','final']) {
    views['immunology-'+exam] = {title:'Immunology · '+(exam==='mid'?'Midterm':'Final'),parent:'immunology',category:'immunology-'+exam};
    views['mss-past-'+exam] = {title:exam==='mid'?'Midterm':'Final',parent:'mss-past',category:'mss-past-'+exam};
  }
  views['mss-past-mid']={title:'MSS Midterm Past Papers',parent:'mss-past',pastPaper:true,subtitle:'Choose subjects and practise all recalled questions using the supplied exam keys.'};
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  // New systems and subjects are derived from the registry, keeping empty standard categories.
  for (const lecture of lectures) {
    if (views[lecture.category]) continue;
    const system = slug(lecture.system), exam = system+'-'+(lecture.exam==='Midterm'?'mid':lecture.exam==='Final'?'final':slug(lecture.exam));
    if (!views[system]) {
      views[system] = {title:lecture.system,parent:'home',cards:[]};
      views.home.cards.push([lecture.system,'Explore '+lecture.system+' study resources.',system,lecture.icon||'📚','SYSTEM']);
    }
    if (!views[exam]) {
      views[exam]={title:lecture.system+' · '+lecture.exam,parent:system,cards:[]};
      views[system].cards.push([lecture.exam,'Summaries and MCQs for '+lecture.exam+'.',exam,'📘','EXAM']);
    }
    if (lecture.category===exam) {
      views[exam].category=exam;
      views[exam].parent=system;
    } else {
      views[lecture.category]={title:lecture.subject,parent:exam,category:lecture.category};
      views[exam].cards ||= [];
      views[exam].cards.push([lecture.subject,'Browse '+lecture.subject.toLowerCase()+' resources.',lecture.category,lecture.icon||'📚','SUBJECT']);
    }
  }
  window.VitanovaViews = views;
})();
