const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../study-backup.js'),'utf8');
function browser(initial={}) {
  const entries=new Map(Object.entries(initial));
  const events=[];
  let failAt=null, writes=0;
  const storage={getItem:k=>entries.has(k)?entries.get(k):null,
    setItem(k,v){writes++;if(writes===failAt)throw new Error('Quota');entries.set(k,String(v));},
    removeItem:k=>entries.delete(k)};
  const context=vm.createContext({console,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},
    window:{localStorage:storage,dispatchEvent:event=>events.push(event)}});
  vm.runInContext(script,context);
  return {entries,events,run:code=>vm.runInContext(code,context),failOnWrite:n=>failAt=n};
}
const progress={version:1,categories:{anatomy:{lecture1:true,lecture2:false}}};
const backup=data=>({format:'vitanova-study-backup',version:1,exportedAt:'2026-10-27T00:00:00.000Z',data});
function importCode(data,mode='merge'){return `window.VitanovaBackup.importData(JSON.parse(${JSON.stringify(JSON.stringify(data))}),${JSON.stringify(mode)})`;}
test('exports all supported data and preserves unknown student IDs',()=>{
  const b=browser({'vitanova:progress:v1':JSON.stringify(progress),'vitanova:bookmarks:v1':JSON.stringify({version:1,saved:{'missing-question':123}}),'vitanova:theme:v1':'dark'});
  const result=JSON.parse(b.run('JSON.stringify(window.VitanovaBackup.exportData())'));
  assert.equal(result.format,'vitanova-study-backup');
  assert.deepEqual(result.data.progress,progress);assert.equal(result.data.bookmarks.saved['missing-question'],123);
  assert.equal(result.data.theme,'dark');assert.equal(result.data.recent,null);
});
test('merge retains completed lectures and unions bookmarks',()=>{
  const b=browser({'vitanova:progress:v1':JSON.stringify(progress),'vitanova:bookmarks:v1':JSON.stringify({version:1,saved:{q1:100,q2:200}})});
  b.run(importCode(backup({progress:{version:1,categories:{anatomy:{lecture1:false,lecture2:true},other:{'new-lecture':true}}},bookmarks:{version:1,saved:{q1:300,q3:300}}})));
  const p=JSON.parse(b.entries.get('vitanova:progress:v1'));
  assert.equal(p.categories.anatomy.lecture1,true);assert.equal(p.categories.anatomy.lecture2,true);
  assert.equal(p.categories.other['new-lecture'],true);
  assert.deepEqual(JSON.parse(b.entries.get('vitanova:bookmarks:v1')).saved,{q1:100,q2:200,q3:300});
  assert.ok(b.events.some(e=>e.type==='vitanova:storage-changed'));
});
test('merge mistakes takes latest mastery status and maximum counters',()=>{
  const old={version:1,records:{q1:{wrong:4,correct:1,mastered:false,lastAttempt:100}}};
  const incoming={version:1,records:{q1:{wrong:2,correct:3,mastered:true,lastAttempt:200}}};
  const b=browser({'vitanova:mistakes:v1':JSON.stringify(old)});b.run(importCode(backup({mistakes:incoming})));
  assert.deepEqual(JSON.parse(b.entries.get('vitanova:mistakes:v1')).records.q1,{wrong:4,correct:3,mastered:true,lastAttempt:200});
});
test('replace changes included fields only and can clear optional preference',()=>{
  const b=browser({'vitanova:progress:v1':JSON.stringify(progress),'vitanova:theme:v1':'dark','unrelated':'keep'});
  b.run(importCode(backup({progress:{version:1,categories:{}},theme:null}),'replace'));
  assert.equal(b.entries.get('vitanova:progress:v1'),' {"version":1,"categories":{}}'.trim());
  assert.equal(b.entries.has('vitanova:theme:v1'),false);assert.equal(b.entries.get('unrelated'),'keep');
});
test('rejects malformed data and executable or prototype properties before writing',()=>{
  const b=browser({'vitanova:progress:v1':JSON.stringify(progress)});
  const cases=[backup({progress:{version:1,categories:{a:{b:'true'}}}}),backup({arbitrary:'<script>bad</script>'}),backup({bookmarks:{version:1,saved:{q:-1}}}),backup({recent:{version:1,lectureId:'q',hash:'javascript:alert(1)',openedAt:1}})];
  for(const data of cases)assert.throws(()=>b.run(importCode(data)));
  assert.throws(()=>b.run(`window.VitanovaBackup.importData(JSON.parse('{"format":"vitanova-study-backup","version":1,"exportedAt":"2026-10-27","data":{"bookmarks":{"version":1,"saved":{"__proto__":123}}}}'))`));
  assert.equal(b.entries.get('vitanova:progress:v1'),JSON.stringify(progress));
});
test('corrupt existing data is retained; export warns and import reports failure',()=>{
  const b=browser({'vitanova:progress:v1':'{broken'});
  const recovered=JSON.parse(b.run('JSON.stringify(window.VitanovaBackup.exportData())'));
  assert.equal(recovered.warnings.length,1);
  assert.match(recovered.warnings[0],/progress/);
  assert.deepEqual(recovered.data.progress,{version:1,categories:{}});
  assert.throws(()=>b.run(importCode(backup({progress:{version:1,categories:{}}}),'replace')),/corrupted/);
  assert.equal(b.entries.get('vitanova:progress:v1'),'{broken');
});
test('partial quota failure rolls back earlier writes',()=>{
  const initial={'vitanova:progress:v1':JSON.stringify(progress),'vitanova:bookmarks:v1':JSON.stringify({version:1,saved:{old:100}})};
  const b=browser(initial);b.failOnWrite(2);
  assert.throws(()=>b.run(importCode(backup({progress:{version:1,categories:{}},bookmarks:{version:1,saved:{}}}),'replace')),/restored/);
  assert.deepEqual(Object.fromEntries(b.entries),initial);
});
test('an unavailable browser store exports a clearly marked recovery backup',()=>{
  const b=browser();b.run('window.localStorage.getItem=()=>{throw new Error("blocked")}');
  const data=JSON.parse(b.run('JSON.stringify(window.VitanovaBackup.exportData())'));
  assert.equal(data.warnings.length,6);
  assert.deepEqual(data.data.progress,{version:1,categories:{}});
});

test('export includes session edits when persistent storage is unavailable',()=>{
  const b=browser();
  b.run(`window.localStorage.getItem=()=>{throw new Error('blocked')};
    const snapshots={
      'vitanova:progress:v1':{version:1,categories:{anatomy:{sessionLecture:true}}},
      'vitanova:bookmarks:v1':{version:1,saved:{sessionQuestion:200}},
      'vitanova:mistakes:v1':{version:1,records:{sessionQuestion:{wrong:1,correct:0,mastered:false,lastAttempt:200}}}
    };
    window.VitanovaStorage={snapshot:key=>snapshots[key]};`);
  const exported=JSON.parse(b.run('JSON.stringify(window.VitanovaBackup.exportData())'));
  assert.equal(exported.data.progress.categories.anatomy.sessionLecture,true);
  assert.equal(exported.data.bookmarks.saved.sessionQuestion,200);
  assert.equal(exported.data.mistakes.records.sessionQuestion.wrong,1);
  assert.equal(exported.warnings.length,6);
  assert.doesNotThrow(()=>b.run(`window.VitanovaBackup.validate(JSON.parse(${JSON.stringify(JSON.stringify(exported))}))`));
});
test('session edits are preferred to stale persistent data',()=>{
  const b=browser({'vitanova:progress:v1':JSON.stringify(progress)});
  b.run(`window.VitanovaStorage={snapshot:key=>key==='vitanova:progress:v1'?{version:1,categories:{anatomy:{lecture1:false,lecture2:true}}}:undefined};`);
  const exported=JSON.parse(b.run('JSON.stringify(window.VitanovaBackup.exportData())'));
  assert.equal(exported.data.progress.categories.anatomy.lecture1,false);
  assert.equal(exported.data.progress.categories.anatomy.lecture2,true);
});

test('flashcard backups preserve unknown IDs and merge the latest complete schedule',()=>{
  const r={due:1000,interval:3,reviews:2,lapses:1,lastReview:100,rating:3};
  const b=browser({'vitanova:flashcards:v1':JSON.stringify({version:1,records:{old:r,shared:r}})});
  const next={...r,lastReview:200,due:9999,reviews:3,rating:4};
  b.run(importCode(backup({flashcards:{version:1,records:{shared:next,new:next}}})));
  assert.deepEqual(JSON.parse(b.entries.get('vitanova:flashcards:v1')).records,{old:r,shared:next,new:next});
  const exp=JSON.parse(b.run('JSON.stringify(window.VitanovaBackup.exportData())'));
  assert.deepEqual(exp.data.flashcards.records.shared,next);
  b.run(importCode(backup({progress:{version:1,categories:{}}}),'replace'));
  assert.deepEqual(JSON.parse(b.entries.get('vitanova:flashcards:v1')).records.old,r);
  for(const invalid of [{...r,rating:5},{...r,due:-1},{...r,reviews:1.5}])
    assert.throws(()=>b.run(importCode(backup({flashcards:{version:1,records:{x:invalid}}}))));
});
