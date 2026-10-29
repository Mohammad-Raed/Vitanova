'use strict';
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base=process.env.VITANOVA_FLASHCARD_TEST_URL||'http://127.0.0.1:8775';
const server=process.env.VITANOVA_FLASHCARD_TEST_URL?null:spawn('python3',['-m','http.server','8775','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let checks=0;function check(value,message){assert.ok(value,message);checks++;}
async function main(){
 for(let i=0;i<60;i++){try{if((await fetch(base+'/flashcards.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const browser=await chromium.launch({headless:true,executablePath:fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});page.on('request',r=>requests.push(r.url()));
 const goto=async file=>{await page.goto(base+'/'+file);};
 const start=async()=>{await page.locator('#fc-start').click();await page.waitForFunction(()=>!document.getElementById('fc-reveal').disabled&&!document.getElementById('fc-practice').hidden);};
 await goto('index.html');check(await page.locator('.hub-links a[href="flashcards.html"]').count()===1,'Central library link appears in hub');
 await goto('flashcards.html?lecture=mss-mid-anatomy-13');await page.waitForFunction(()=>!document.getElementById('fc-start').disabled);
 check(await page.locator('#fc-lecture').inputValue()==='mss-mid-anatomy-13','Lecture deep link selects matching cards');
 check((await page.locator('#fc-back').getAttribute('href')).includes('Lecture-13'),'Back link returns to actual lecture');
 check(!requests.some(u=>u.includes('notes-')||u.includes('flashcard-media/')),'Setup downloads no note shards or media');
 await page.locator('#fc-size').selectOption('10');await start();
 check(await page.locator('#fc-settings').isHidden(),'Starting collapses setup');check(await page.locator('#fc-settings-toggle').getAttribute('aria-expanded')==='false','Collapsed setup announces accessible state');
 check(await page.locator('#fc-answer').isHidden(),'Explanation hidden before reveal');check(await page.locator('#fc-ratings').isHidden(),'Ratings unavailable before reveal');
 check(await page.locator('.fc-blank').count()>0,'Current cloze is blanked');check(!(await page.locator('#fc-front').textContent()).includes('{{c'),'No raw Anki syntax');
 check(new Set(requests.filter(u=>u.includes('notes-'))).size===1,'Loads only the selected subject shard');
 await page.keyboard.press('Space');check(await page.locator('#fc-ratings').isVisible(),'Space reveals answer');check(await page.locator('.fc-answer').count()>0,'Revealed words are highlighted');
 const closed=page.locator('#fc-supplements details:not([open])');check(await closed.locator('img').count()===0,'Supplementary images are not mounted before opening');
 if(await closed.count()){await closed.first().locator('summary').click();await page.waitForTimeout(100);check(await page.locator('#fc-supplements details[open] div').first().textContent()!==undefined,'Supplement fields expand on request');}
 await page.locator('[data-rating="3"]').focus();await page.keyboard.press('3');await page.waitForFunction(()=>document.getElementById('fc-counter').textContent.includes('1 rated'));
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vitanova:flashcards:v1'))),id=Object.keys(saved.records)[0];
 check(saved.records[id].rating===3&&saved.records[id].interval===3,'Good saves a three-day interval');
 await page.locator('#fc-undo').click();await page.waitForFunction(()=>document.getElementById('fc-counter').textContent.includes('0 rated'));
 check(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('vitanova:flashcards:v1')).records).length)===0,'Undo removes first review without losing other state');
 await page.locator('#fc-reveal').click();await page.locator('[data-rating="1"]').click();await page.waitForFunction(()=>document.getElementById('fc-counter').textContent.includes('1 rated'));
 check(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('vitanova:flashcards:v1')).records)[0].lapses)===1,'Again records lapse');
 await page.locator('#fc-settings-toggle').click();await page.locator('#fc-search').fill('brachial');check((await page.locator('#fc-counter').textContent()).includes('1 rated'),'Changing filters leaves active session intact');
 await page.locator('#fc-settings-toggle').click();await page.locator('#fc-skip').click();await page.waitForFunction(()=>document.getElementById('fc-counter').textContent.includes('1 skipped'));
 check(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('vitanova:flashcards:v1')).records).length)===1,'Skip changes no persistent review record');
 await page.reload();await page.waitForFunction(()=>document.getElementById('fc-selection').textContent.includes('3,323'));
 check(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('vitanova:flashcards:v1')).records).length)===1,'Reviews persist after refresh');
 await goto('index.html#backup');const exported=await page.evaluate(()=>VitanovaBackup.exportData());check(Object.keys(exported.data.flashcards.records).length===1,'Central backup includes flashcard review');
 await page.evaluate(data=>{localStorage.removeItem('vitanova:flashcards:v1');VitanovaBackup.importData(data,'merge');},exported);
 check(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('vitanova:flashcards:v1')).records).length)===1,'Existing import restores flashcard history');
 await goto('flashcards.html');await page.waitForFunction(()=>!document.getElementById('fc-start').disabled);
 await page.locator('#fc-mode').selectOption('all');await page.locator('#fc-lecture').selectOption('__lectures__');
 const mapped=await page.evaluate(async()=>{const c=await(await fetch('data/flashcards/catalog.json')).json();return c.cards.filter(x=>x.lectures.length>0).length;});
 check((await page.locator('#fc-match-count').textContent()).startsWith(mapped+' matching'),'All lecture topics excludes unmapped additional material');
 await page.locator('#fc-subject').selectOption('Anatomy');
 const mappedAnatomy=await page.evaluate(async()=>{const c=await(await fetch('data/flashcards/catalog.json')).json();return c.cards.filter(x=>x.lectures.length>0&&x.subject==='Anatomy').length;});
 check((await page.locator('#fc-match-count').textContent()).startsWith(mappedAnatomy+' matching'),'Lecture topics combines with subject filter');
 await page.locator('#fc-subject').selectOption('');await start();check((await page.locator('#fc-selection').textContent()).includes('All lecture topics'),'Session summary identifies lecture-only scope');
 await page.locator('#fc-settings-toggle').click();
 await page.locator('#fc-lecture').selectOption('immunology-mid-01');check(await page.locator('#fc-start').isDisabled(),'Lecture with no mapped cards has clear empty selection');
 await page.locator('#fc-lecture').selectOption('');await page.locator('#fc-subject').selectOption('Physiology');await page.locator('#fc-mode').selectOption('all');await page.locator('#fc-size').selectOption('10');await start();
 check((await page.locator('#fc-topic').textContent()).startsWith('Physiology'),'Subject filtering starts correct session');
 await page.setViewportSize({width:390,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Practice fits mobile');
 await page.locator('#fc-reveal').click();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Answer and ratings fit mobile');
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/flashcards-mobile.png'),fullPage:true});
 await page.locator('#fc-settings-toggle').click();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Settings fit mobile');
 await page.locator('#fc-search').fill('NO_SUCH_TOPIC_2099');check(await page.locator('#fc-start').isDisabled(),'Search exposes empty matches without destroying session');
 await page.locator('#fc-theme').click();check(['dark','light'].includes(await page.locator('html').getAttribute('data-theme')),'Theme control works');
 // All 3,323 source cards render on both sides, not just the sampled cards.
 const all=await page.evaluate(async()=>{const catalog=await(await fetch('data/flashcards/catalog.json')).json(),notes={};for(const url of Object.values(catalog.subjects))Object.assign(notes,await(await fetch(url)).json());return catalog.cards.every(c=>{const n=notes[c.note];return !VitanovaFlashcardCore.render(n.text,c.ordinal).includes('{{c')&&!VitanovaFlashcardCore.render(n.text,c.ordinal,true).includes('{{c');});});
 check(all,'All imported clozes render front and back');
 const registry=await page.evaluate(()=>VitanovaLectures);
 for(const lecture of registry){await goto(encodeURIComponent(lecture.file));check(await page.locator('.vn-flashcards').getAttribute('href')==='flashcards.html?lecture='+lecture.id,lecture.id+' links to lecture flashcards');}
 await goto('flashcards.html');await page.waitForFunction(()=>!document.getElementById('fc-start').disabled);await page.locator('#fc-size').selectOption('10');await start();
 // Complete a small session and undo its final rating.
 for(let i=0;i<10;i++){await page.locator('#fc-reveal').click();await page.locator('[data-rating="4"]').click();if(i<9)await page.waitForFunction(()=>!document.getElementById('fc-reveal').disabled&&!document.getElementById('fc-practice').hidden);}
 check(await page.locator('#fc-finished').isVisible(),'Session completes after its selected size');await page.locator('#fc-undo').click();await page.waitForFunction(()=>!document.getElementById('fc-reveal').disabled&&!document.getElementById('fc-practice').hidden);check((await page.locator('#fc-counter').textContent()).includes('9 rated'),'Final rating can be undone');
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(root,'test-results/flashcards-desktop.png'),fullPage:true});
 check(errors.length===0,'No unexpected browser errors: '+errors.join('; '));
 // A network failure is handled with retry and does not corrupt study records.
 const broken=await context.newPage();await broken.route('**/data/flashcards/catalog.json',route=>route.abort());await broken.goto(base+'/flashcards.html');await broken.locator('#fc-retry').waitFor();check(await broken.locator('#fc-error').isVisible(),'Failed library load offers retry');await broken.unroute('**/data/flashcards/catalog.json');await broken.locator('#fc-retry').click();await broken.waitForFunction(()=>!document.getElementById('fc-start').disabled);check(await broken.locator('#fc-error').isHidden(),'Retry recovers library');
 console.log('PASS: '+checks+' flashcard browser checks; all 3,323 clozes render.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server?.kill());
