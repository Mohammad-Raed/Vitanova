/* Real Chromium checks. Run: node tests/browser.cjs (requires Playwright for testing only). */
'use strict';
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.BASE_URL || process.env.VITANOVA_TEST_URL || 'http://127.0.0.1:8765';
const server = (process.env.BASE_URL || process.env.VITANOVA_TEST_URL) ? null : spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' });
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
const normalize = x => String(x).replace(/^\s*[A-Z][.)]\s*/, '').replace(/\s+/g, ' ').trim();
async function untilServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base + '/index.html')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Static test server did not start');
}
async function main() {
  await untilServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.location().url?.endsWith('/favicon.ico')) errors.push(message.text()); });
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push('HTTP '+response.status()+': '+response.url()); });
  page.on('requestfailed', request => { if (request.url().startsWith(base) && !request.url().endsWith('/favicon.ico')) errors.push('Request failed: '+request.url()); });
  const goto = async file => { await page.goto(base + '/' + file); await page.waitForTimeout(70); };
  const noOverflow = async label => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' document has no horizontal overflow');
  const reset = async () => {
    await page.evaluate(() => [...document.querySelectorAll('button.r')].forEach(button => button.click()));
    await page.waitForTimeout(70);
  };
  try {
    await goto('index.html');
    const lectures = await page.evaluate(() => window.VitanovaLectures);
    const bank = await page.evaluate(() => window.VitanovaQuestionBank);
    check(lectures.length > 0 && bank.length > 0, 'Actual lecture registry and question bank loaded');
    check(await page.locator('#study-snapshot').isVisible(), 'Overview displays the study snapshot');
    await page.setViewportSize({width:390,height:844});
    const menu=page.locator('#study-menu-toggle');
    await page.waitForFunction(() => document.getElementById('study-menu-toggle').getAttribute('aria-expanded') === 'false');
    check(await menu.getAttribute('aria-expanded')==='false','Mobile study menu starts collapsed');
    await menu.click();
    check(await menu.getAttribute('aria-expanded')==='true','Mobile study menu opens');
    await page.keyboard.press('Escape');
    check(await menu.getAttribute('aria-expanded')==='false','Escape closes mobile study menu');
    await page.setViewportSize({width:1280,height:900});
    await page.evaluate(() => localStorage.clear());
    await goto('index.html#mss-mid-anatomy');
    const anatomyCount = lectures.filter(lecture => lecture.category === 'mss-mid-anatomy').length;
    check(await page.locator('.study-resource').count() === anatomyCount, 'Anatomy checklist matches registry');
    await page.locator('.study-resource input[type="checkbox"]').first().check();
    check(page.url().endsWith('#mss-mid-anatomy'), 'Checking progress does not navigate');
    check(await page.locator('#completion-percent').textContent() === Math.round(100/anatomyCount)+'%', 'Progress rounds one of all registered Anatomy resources');
    await page.reload();
    check(await page.locator('.study-resource input[type="checkbox"]').first().isChecked(), 'Completion persists after refresh');
    await page.locator('#completion-filter').selectOption('completed');
    check(await page.locator('.study-resource').count() === 1, 'Completed filter includes checked resource');
    await page.locator('#completion-filter').selectOption('incomplete');
    check(await page.locator('.study-resource').count() === anatomyCount-1, 'Incomplete filter excludes checked resource');
    await goto('index.html#mss-mid-physiology');
    check(!await page.locator('.study-resource input[type="checkbox"]').first().isChecked(), 'Subjects keep independent progress');
    await goto('index.html#search');
    await page.locator('#lecture-search').fill('brachial');
    check(await page.locator('.study-resource').count() === lectures.filter(l=>[l.title,l.description,l.system,l.exam,l.subject,l.lectureLabel].join(' ').toLowerCase().includes('brachial')).length, 'Search returns all matching lecture topics and titles');
    await page.locator('#lecture-search').fill('Immunology Midterm');
    check(await page.locator('.study-resource').count() === lectures.filter(l=>l.system==='Immunology' && l.exam==='Midterm').length, 'Search matches system and exam');
    await goto('index.html#mss-mid-anatomy');
    await page.locator('.study-resource input[type="checkbox"]').first().uncheck();
    await page.reload();
    check(!await page.locator('.study-resource input[type="checkbox"]').first().isChecked(), 'Unchecking completion persists');
    const routes = await page.evaluate(() => Object.keys(VitanovaViews));
    for (const route of routes) {
      await goto('index.html#' + encodeURIComponent(route));
      check(await page.locator('#page-title').textContent(), 'Route ' + route + ' renders a heading');
      if (route !== 'home') check(await page.locator('#hero-content').isHidden(), 'Route ' + route + ' has compact header');
    }

    console.log('Portal routes, search, and completion checks passed.');
    let totalRendered = 0;
    for (const lecture of lectures) {
      await goto(encodeURIComponent(lecture.file));
      await page.waitForFunction(() => document.querySelectorAll('.q').length > 0 && document.querySelectorAll('.q:not([data-vn-question-id])').length === 0);
      const expected = bank.filter(q => q.lectureId === lecture.id);
      const count = await page.locator('.q').count();
      totalRendered += count;
      check(count === expected.length, lecture.id + ': all original MCQs match extracted bank');
      check(await page.locator('.vn-bookmark-toggle').count() === count, lecture.id + ': every question supports bookmarks');
      check(await page.locator('.vn-lecture-navigation').count() === 1, lecture.id + ': one shared navigation bar');
      const ordered = lectures.filter(item => item.system === lecture.system && item.exam === lecture.exam && item.subject === lecture.subject).sort((a,b) => a.order-b.order);
      const index = ordered.findIndex(item => item.id === lecture.id);
      for (const [selector, target] of [['.vn-previous', ordered[index-1]], ['.vn-next', ordered[index+1]]]) {
        const link = page.locator(selector);
        if (target) check(decodeURIComponent(await link.getAttribute('href')) === target.file, lecture.id + ': navigation remains within subject/exam/system');
        else check(await link.getAttribute('aria-disabled') === 'true', lecture.id + ': boundary navigation disabled');
      }
      await page.evaluate(() => [...document.querySelectorAll('.vn-bookmark-toggle')].forEach(button => { if(button.getAttribute('aria-pressed') !== 'true') button.click(); }));
      check(await page.locator('.vn-bookmark-toggle[aria-pressed="true"]').count() === count, lecture.id + ': all bookmark buttons save');
      const answered = await page.evaluate(() => {
        const byId = new Map(VitanovaQuestionBank.map(question => [question.id, question]));
        const plain = value => String(value).replace(/\s+/g, ' ').trim();
        const matches = (displayed, answer) => [plain(displayed), plain(displayed).replace(/^[A-Z][.)]\s*/, '')].includes(plain(answer));
        return [...document.querySelectorAll('.q')].map(block => {
          const q = byId.get(block.dataset.vnQuestionId);
          const options = [...block.querySelectorAll('button.o')];
          const correct = options.find(button => matches(button.textContent, q.options[q.answer]));
          if (!correct) return {id:q.id, correct:false};
          correct.click();
          return {id:q.id,correct:correct.classList.contains('ok') && !block.querySelector('.no'),explanation:getComputedStyle(block.querySelector('.ex')).display !== 'none'};
        });
      });
      check(answered.every(item => item.correct && item.explanation), lecture.id + ': every correct answer preserves feedback/explanation');
      const scores = await page.locator('.sc,#sc,[id^="sc-"]').allTextContents();
      check(scores.length > 0 && scores.reduce((sum,text) => sum + Number(text.match(/(?:Score|Finished)[: ]+(\d+)/)?.[1] || 0),0) === count, lecture.id + ': original scores count all correct answers');
      await reset();
      check(await page.locator('.q .ok,.q .no').count() === 0, lecture.id + ': reset clears original answer feedback');
      check(await page.locator('.vn-bookmark-toggle[aria-pressed="true"]').count() === count, lecture.id + ': bookmarks survive quiz reset');
      const wrong = await page.evaluate(() => {
        const byId = new Map(VitanovaQuestionBank.map(q => [q.id,q]));
        const plain = value => String(value).replace(/\s+/g, ' ').trim();
        const matches = (displayed, answer) => [plain(displayed), plain(displayed).replace(/^[A-Z][.)]\s*/, '')].includes(plain(answer));
        return [...document.querySelectorAll('.q')].map(block => {
          const q=byId.get(block.dataset.vnQuestionId);
          const button=[...block.querySelectorAll('button.o')].find(option=>!matches(option.textContent, q.options[q.answer]));
          button.click();
          return button.classList.contains('no') && !!block.querySelector('.ok') && getComputedStyle(block.querySelector('.ex')).display !== 'none';
        });
      });
      check(wrong.every(Boolean), lecture.id + ': every wrong answer preserves feedback/explanation');
      await page.waitForTimeout(70);
      check(await page.evaluate(id => Object.entries(VitanovaMistakes.all()).filter(([qid,record]) => !record.mastered && VitanovaQuestionBank.find(q=>q.id===qid)?.lectureId===id).length, lecture.id) === count, lecture.id + ': mistakes persist for every incorrectly answered question');
      await page.reload();
      await page.waitForTimeout(70);
      check(await page.locator('.vn-bookmark-toggle[aria-pressed="true"]').count() === count, lecture.id + ': bookmarks persist across refresh');
      await page.setViewportSize({width:390,height:844});
      await noOverflow(lecture.id + ' mobile');
      await page.setViewportSize({width:1280,height:900});
      await noOverflow(lecture.id + ' desktop');
      console.log('Verified '+lecture.id+': '+count+' original MCQs, correct/wrong/reset/bookmark behavior.');
    }
    check(totalRendered === bank.length, 'Browser rendered the complete extracted question bank: ' + totalRendered);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('vitanova:progress:v1')).categories['mss-mid-anatomy']['mss-mid-anatomy-01-02']) === false, 'Lecture visits never automatically complete resources');
    await goto('index.html');
    check(await page.locator('#continue-studying').isVisible(), 'Portal offers Continue Studying after a lecture visit');
    await goto('index.html#saved');
    check(await page.locator('.vn-review-question').count() === bank.length, 'All saved questions appear across lectures');
    await page.locator('#vn-saved-system').selectOption('Immunology');
    check(await page.locator('.vn-review-question').count() === bank.filter(q=>q.lectureId.startsWith('immunology')).length, 'Saved system filter works');
    await page.locator('#vn-saved-system').selectOption('all');
    await page.locator('#vn-saved-filter').selectOption('Anatomy');
    check(await page.locator('.vn-review-question').count() === bank.filter(q=>lectures.find(l=>l.id===q.lectureId).subject==='Anatomy').length, 'Saved subject filter works');
    const firstLecture=lectures[0];
    await page.locator('#vn-saved-lecture').selectOption(firstLecture.id);
    check(await page.locator('.vn-review-question').count() === bank.filter(q=>q.lectureId===firstLecture.id).length, 'Saved lecture filter works');
    const beforeShuffle=await page.locator('.vn-review-question').evaluateAll(nodes=>nodes.map(n=>n.dataset.questionId));
    await page.locator('#vn-saved-mix').click();
    const afterShuffle=await page.locator('.vn-review-question').evaluateAll(nodes=>nodes.map(n=>n.dataset.questionId));
    check([...beforeShuffle].sort().join() === [...afterShuffle].sort().join(), 'Shuffle retains exactly the selected question set');
    const firstQuestion=bank.find(q=>q.id===afterShuffle[0]);
    await page.locator('.vn-review-question').first().locator('[data-answer="'+firstQuestion.answer+'"]').click();
    check((await page.locator('#vn-saved-score').textContent()).includes('1 correct'), 'Revision score counts correct selection');
    check(await page.locator('.vn-review-question').first().locator('.vn-review-explanation').isVisible(), 'Revision reveals original answer explanation');
    await page.locator('#vn-saved-reset').click();
    check(!(await page.locator('#vn-saved-score').textContent()).includes('1 correct'), 'Revision reset clears attempt score');
    await page.locator('.vn-review-question').first().locator('.vn-review-remove').click();
    check(await page.locator('.vn-review-question').count() === beforeShuffle.length-1, 'Removing bookmark updates saved collection');
    await goto('index.html#mistakes');
    const mistakeBefore=await page.locator('.vn-review-question').count();
    check(mistakeBefore>0, 'Central mistakes revision includes native quiz errors');
    const mistakeId=await page.locator('.vn-review-question').first().getAttribute('data-question-id');
    const mistakeQuestion=bank.find(q=>q.id===mistakeId);
    await page.locator('.vn-review-question').first().locator('[data-answer="'+mistakeQuestion.answer+'"]').click();
    check(await page.evaluate(id=>VitanovaMistakes.all()[id].mastered,mistakeId), 'Correct mistake revision marks question mastered');
    check((await page.locator('#vn-saved-score').textContent()).includes('1 correct'), 'Mistake revision maintains separate attempt score');
    await page.reload();
    check(await page.locator('.vn-review-question').count()===mistakeBefore-1, 'Mastered questions leave the next mistake revision');
    await goto(encodeURIComponent(lectures[1].file));
    await page.locator('#vn-redo-mistakes').click();
    check(await page.locator('#vn-mistake-panel .vn-review-question').count()>0, 'Individual lecture Redo Mistakes opens only its revision questions');
    check(await page.locator('#vn-mistake-panel .vn-review-question').evaluateAll((nodes,lectureId)=>nodes.every(n=>VitanovaQuestionBank.find(q=>q.id===n.dataset.questionId).lectureId===lectureId),lectures[1].id), 'Inline mistakes stay in current lecture');

    await goto('index.html#backup');
    const exported=await page.evaluate(()=>VitanovaBackup.exportData());
    check(exported.format==='vitanova-study-backup' && exported.data.bookmarks && exported.data.progress && exported.data.mistakes, 'Backup includes versioned progress, bookmarks, and mistakes');
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Export study backup',exact:true}).click();
    const download=await downloadPromise;
    check(download.suggestedFilename().endsWith('.json'), 'Export produces downloadable JSON');
    const beforeInvalid=await page.evaluate(()=>JSON.stringify(VitanovaBackup.exportData().data));
    await page.locator('input[type="file"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"vitanova-study-backup","version":1,"data":{"progress":"bad"}}')});
    await page.getByRole('button',{name:'Import backup',exact:true}).click();
    await page.getByRole('status').filter({hasText:/not a supported|No data was changed/}).waitFor();
    check(await page.evaluate(()=>JSON.stringify(VitanovaBackup.exportData().data)) === beforeInvalid, 'Invalid import cannot overwrite existing study data');
    await page.locator('input[type="file"]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
    await page.getByRole('button',{name:'Import backup',exact:true}).click();
    await page.getByRole('status').filter({hasText:/Backup imported using merge/}).waitFor();
    check(await page.evaluate(()=>Object.keys(VitanovaBookmarks.all()).length)>0, 'Merge import preserves bookmark data');
    await page.getByLabel('Import method').selectOption('replace');
    const cancelDialog=page.waitForEvent('dialog');
    await page.getByRole('button',{name:'Import backup',exact:true}).click();
    await (await cancelDialog).dismiss();
    check(await page.evaluate(()=>JSON.stringify(VitanovaBackup.exportData().data))===beforeInvalid, 'Cancelling replace preserves all study data');
    const replaceDialog=page.waitForEvent('dialog');
    await page.getByRole('button',{name:'Import backup',exact:true}).click();
    await (await replaceDialog).accept();
    await page.getByRole('status').filter({hasText:/Backup imported using replace/}).waitFor();
    check(await page.evaluate(()=>VitanovaBackup.exportData().data.progress.categories['mss-mid-anatomy']['mss-mid-anatomy-01-02'])===false, 'Confirmed replace restores completion data');

    // Fresh context: migration of ZIP-era bookmarks and honest handling of corrupt/unavailable storage.
    const migration=await browser.newContext();
    const migrationPage=await migration.newPage();
    await migrationPage.goto(base+'/index.html');
    const legacy=bank.find(q=>q.legacyIds?.length);
    check(!!legacy, 'Historical question aliases retained');
    await migrationPage.evaluate(({legacy,id})=>{
      localStorage.setItem('vitanova:bookmarks:v1',JSON.stringify({version:1,saved:{[legacy]:1,'unresolved-old-question':2}}));
    },{legacy:legacy.legacyIds[0],id:legacy.id});
    await migrationPage.reload();
    const migrated=await migrationPage.evaluate(id=>({has:VitanovaBookmarks.has(id),all:VitanovaBookmarks.all()}),legacy.id);
    check(migrated.has,'ZIP-era bookmark resolves through stable question alias');
    check(Object.prototype.hasOwnProperty.call(migrated.all,'unresolved-old-question'),'Unresolved bookmark is preserved');
    await migrationPage.evaluate(()=>localStorage.setItem('vitanova:progress:v1','{broken'));
    await migrationPage.goto(base+'/index.html#mss-mid-anatomy');
    await migrationPage.reload();
    await migrationPage.locator('.study-resource input[type="checkbox"]').first().check();
    check(await migrationPage.evaluate(()=>localStorage.getItem('vitanova:progress:v1'))==='{broken','Corrupt progress is not silently overwritten');
    check(await migrationPage.locator('[role="status"]').filter({hasText:/storage|save|recover|corrupt|damaged/i}).count()>0,'Corrupt storage shows visible warning');
    await migration.close();
    const blocked=await browser.newContext();
    await blocked.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Blocked','SecurityError')}});Object.defineProperty(Storage.prototype,'getItem',{value(){throw new DOMException('Blocked','SecurityError')}})});
    const blockedPage=await blocked.newPage();
    const blockedErrors=[];blockedPage.on('pageerror',e=>blockedErrors.push(e.message));
    await blockedPage.goto(base+'/index.html#mss-mid-anatomy');
    await blockedPage.locator('.study-resource input[type="checkbox"]').first().check();
    check(blockedErrors.length===0,'Unavailable localStorage does not crash the hub');
    check(await blockedPage.locator('[role="status"]').filter({hasText:/storage|save|browser/i}).count()>0,'Unavailable storage shows visible warning');
    await blocked.close();
    await page.setViewportSize({width:390,height:844});
    for(const route of ['home','mss-mid-anatomy','search','saved','mistakes','backup']){
      await goto('index.html#'+route);await noOverflow('Portal '+route+' mobile');
    }
    // Exercise registration through the actual CLI helper, then load the generated site below a subpath.
    const fixtureParent=path.join(root,'test-results');fs.mkdirSync(fixtureParent,{recursive:true});
    const fixtureRoot=fs.mkdtempSync(path.join(fixtureParent,'integration-'));
    try {
      for(const name of fs.readdirSync(root)) if(/\.(html|js|css)$/.test(name)) fs.copyFileSync(path.join(root,name),path.join(fixtureRoot,name));
      const source=path.join(fixtureRoot,'input.html');
      const lastAnatomy=lectures.filter(l=>l.category==='mss-mid-anatomy').sort((a,b)=>b.order-a.order)[0];
      const fixtureNumber=Math.max(...lectures.filter(l=>l.category==='mss-mid-anatomy').flatMap(l=>l.lectureLabel.match(/\d+/g).map(Number)))+1;
      fs.writeFileSync(source,`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>MSS Midterm Anatomy Lecture ${fixtureNumber}</title><style>.ex{display:none}.ok{color:green}.no{color:red}</style></head><body><header><h1>Synthetic integration fixture</h1></header><main><div id="quiz"></div><button class="r" onclick="build()">Reset</button><div id="sc"></div></main><script>const Q=[["Which test option is correct?",["First option","Second option"],1,"The second option is the test answer."]];function build(){quiz.innerHTML='';Q.forEach(q=>{const block=document.createElement('div');block.className='q';const p=document.createElement('p');p.textContent='1. '+q[0];block.append(p);q[1].forEach((text,i)=>{const button=document.createElement('button');button.className='o';button.textContent=text;button.onclick=()=>{if(block.dataset.done)return;block.dataset.done=1;button.classList.add(i===q[2]?'ok':'no');block.querySelectorAll('.o')[q[2]].classList.add('ok');block.querySelector('.ex').style.display='block';sc.textContent='Score: '+(i===q[2]?1:0)+' / 1';};block.append(button)});const ex=document.createElement('div');ex.className='ex';ex.textContent=q[3];block.append(ex);quiz.append(block)});sc.textContent='Score: 0 / 1'}build();</script></body></html>`);
      const register=spawnSync('python3',['-c',`import argparse,json,sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from add_lecture import run;root=Path(sys.argv[2]);args=argparse.Namespace(file=str(root/'input.html'),system=None,exam=None,subject=None,lectures=None,title=None,description=None,id=None,dry_run=False);row,count,changes=run(args,root);print(json.dumps(row))`,path.join(root,'tools'),fixtureRoot],{encoding:'utf8'});
      check(register.status===0,'Actual lecture registration succeeds for browser fixture: '+register.stderr);
      const fixture=JSON.parse(register.stdout.trim());
      const fixtureBase='test-results/'+path.basename(fixtureRoot)+'/';
      await goto(fixtureBase+encodeURIComponent(fixture.file));
      await page.locator('.vn-bookmark-toggle').waitFor();
      check(await page.locator('.vn-lecture-navigation').count()===1,'New lecture inherits shared navigation below a GitHub Pages style subpath');
      check(decodeURIComponent(await page.locator('.vn-previous').getAttribute('href'))===lastAnatomy.file,'New lecture joins Previous/Next ordering automatically');
      await page.locator('.vn-bookmark-toggle').click();
      await page.reload();
      check(await page.locator('.vn-bookmark-toggle').getAttribute('aria-pressed')==='true','Newly registered MCQ inherits persistent bookmarks');
      await page.locator('.q .o').first().click();
      await page.locator('#vn-redo-mistakes').click();
      check(await page.locator('#vn-mistake-panel .vn-review-question').count()===1,'New lecture inherits mistake revision');
      await page.locator('#vn-mistake-panel [data-answer="1"]').click();
      check((await page.locator('#vn-mistake-panel #vn-saved-score').textContent()).includes('1 correct'),'New lecture revision uses original extracted answer');
      await goto(fixtureBase+'index.html#mss-mid-anatomy');
      check(await page.locator('.study-resource').count()===anatomyCount+1,'New lecture automatically joins its subject checklist');
      await page.locator('.study-resource[data-resource-id="'+fixture.id+'"] input').check();
      await page.reload();
      check(await page.locator('.study-resource[data-resource-id="'+fixture.id+'"] input').isChecked(),'New lecture inherits persistent manual completion');
      await goto(fixtureBase+'index.html#search');
      await page.locator('#lecture-search').fill('Synthetic integration');
      check(await page.locator('.study-resource').count()===1,'New lecture automatically joins search');
      await page.setViewportSize({width:390,height:844});await noOverflow('New registered lecture dashboard mobile');
    } finally { fs.rmSync(fixtureRoot,{recursive:true,force:true}); }
    await goto('index.html#home');
    const artifacts=path.join(root,'test-results');fs.mkdirSync(artifacts,{recursive:true});
    await page.setViewportSize({width:1280,height:900});
    await goto('index.html#home');await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});
    await page.evaluate(()=>localStorage.setItem('vitanova:theme:v1','dark'));
    await page.reload();await page.screenshot({path:path.join(artifacts,'home-dark-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await goto('index.html#mss-mid-anatomy');await page.screenshot({path:path.join(artifacts,'anatomy-mobile.png'),fullPage:true});
    await goto('index.html#saved');await page.screenshot({path:path.join(artifacts,'saved-mobile.png'),fullPage:false});
    check(errors.length===0,'No browser page errors across tested portal and lecture pages: '+errors.join('; '));
    console.log('PASS: '+checks+' browser checks; '+lectures.length+' lectures; '+totalRendered+' original MCQs, all correct/wrong feedback tested.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{if(server)server.kill();});
