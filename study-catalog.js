/* Extend revision metadata without adding past papers to the lecture/progress registry. */
(function () {
  'use strict';
  const lectures=window.VitanovaLectures||[];
  const past=window.VitanovaPastPapers?.questions||[];
  const existing=window.VitanovaQuestionBank||[];
  const seen=new Set(existing.map(q=>q.id));
  window.VitanovaQuestionBank=existing.concat(past.filter(q=>!seen.has(q.id)));
  window.VitanovaQuestionCatalog={
    metadata(q){return q.kind==='past-paper'?{system:q.system,exam:q.exam,subject:q.subject,lectureLabel:'Midterm Past Papers'}:lectures.find(l=>l.id===q.lectureId);},
    sourceKey(q){return q.kind==='past-paper'?'past-mss-mid':q.lectureId;},
    href(q){const l=lectures.find(l=>l.id===q.lectureId);return q.kind==='past-paper'?'index.html#mss-past-mid?question='+encodeURIComponent(q.id):l?encodeURIComponent(l.file)+'#mcq-'+encodeURIComponent(q.id):'index.html#home';}
  };
})();
