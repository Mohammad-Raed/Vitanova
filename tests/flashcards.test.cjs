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
test('FSRS graduates learned cards and grows intervals with successful reviews',()=>{
 const now=Date.UTC(2026,0,1);
 const learning=core.schedule(null,3,now), review=core.schedule(learning,3,learning.due), mature=core.schedule(review,3,review.due);
 assert.equal(learning.memory.state,1);
 assert.equal(review.memory.state,2);
 assert(mature.interval>review.interval);
 const lapse=core.schedule(mature,1,mature.due);
 assert.equal(lapse.memory.state,3);
 assert.equal(lapse.lapses,1);
 assert(lapse.interval<review.interval);
 const legacy={due:now,interval:2,reviews:9,lapses:2,lastReview:now-2*core.DAY,rating:4};
 assert(core.validRecord(legacy));
 const migrated=core.schedule(legacy,3,now);
 assert.equal(migrated.reviews,10);assert.equal(migrated.lapses,2);assert(core.validRecord(migrated));
 for(const rating of [0,5,NaN,'1'])assert.throws(()=>core.schedule(null,rating,now));
});
test('persistent records validate without discarding unknown IDs',()=>{
 const record=core.schedule(null,4,1000);assert(core.validState({version:1,records:{'unresolved-deck-card':record}}));
 assert(!core.validState({version:1,records:{x:{...record,due:Infinity}}}));
 assert(!core.validState({version:1,records:{x:{...record,reviews:-1}}}));
 assert(!core.validState(JSON.parse('{"version":1,"records":{"__proto__":{}}}')));
});
