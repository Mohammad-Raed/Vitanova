'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../study-flashcard-core.js');
test('clozes preserve hints, independent ordinals and repeated blanks',()=>{
 const s='{{c1::<b>Ia</b>::fibre}} conveys {{c2::stretch}}; {{c1::primary}}.';
 assert.equal(core.render(s,1),'<span class="fc-blank">[fibre]</span> conveys stretch; <span class="fc-blank">[…]</span>.');
 assert.equal(core.render(s,2),'<b>Ia</b> conveys <span class="fc-blank">[…]</span>; primary.');
 assert.match(core.render(s,1,true),/<mark class="fc-answer"><b>Ia<\/b><\/mark>/);
 assert(!core.render(s,1,true).includes('{{'));
});
test('nested clozes balance and reveal without dropping inner content',()=>{
 assert.equal(core.render('{{c1::outer {{c2::inner}}}}',2),'outer <span class="fc-blank">[…]</span>');
 assert.throws(()=>core.render('{{c1::broken',1),/Incomplete/);
});
test('Repeat, Hard, Good and Easy schedule the requested fixed intervals',()=>{
 const now=1000,a=core.schedule(null,1,now);assert.equal(a.due,now+60000);assert.equal(a.lapses,1);assert.equal(a.reviews,1);
 const g=core.schedule(a,3,now);assert.equal(g.interval,10/1440);assert.equal(g.lapses,1);assert.equal(g.reviews,2);
 for(const [rating,millis] of [[1,60000],[2,360000],[3,600000],[4,172800000]]){
  const fresh=core.schedule(null,rating,now),old=core.schedule({...g,interval:4000},rating,now);
  assert.equal(fresh.due,now+millis);assert.equal(old.due,now+millis);assert.equal(old.reviews,3);
 }
 for(const rating of [0,5,NaN,'1'])assert.throws(()=>core.schedule(null,rating,now));
});
test('persistent records validate without discarding unknown IDs',()=>{
 const record=core.schedule(null,4,1000);assert(core.validState({version:1,records:{'unresolved-deck-card':record}}));
 assert(!core.validState({version:1,records:{x:{...record,due:Infinity}}}));
 assert(!core.validState({version:1,records:{x:{...record,reviews:-1}}}));
 assert(!core.validState(JSON.parse('{"version":1,"records":{"__proto__":{}}}')));
});
