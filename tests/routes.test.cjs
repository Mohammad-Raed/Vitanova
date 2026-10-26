const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const routeCode=fs.readFileSync(path.join(root,'study-routes.js'),'utf8');
function routes(extra=[]){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'study-data.js'),'utf8'),ctx);ctx.window.VitanovaLectures.push(...extra);vm.runInContext(routeCode,ctx);return ctx.window.VitanovaViews;}
function resource(system,subject,category){return {id:category+'-1',system,subject,category,exam:'Midterm',file:'new.html',order:1};}
function checkParents(views){for(const [key,view] of Object.entries(views)){const seen=new Set([key]);let parent=view.parent;while(parent){assert.ok(views[parent],`missing parent ${parent}`);assert.ok(!seen.has(parent),`cycle ${key}`);seen.add(parent);parent=views[parent].parent;}for(const card of view.cards||[])assert.ok(views[card[2]],`missing card route ${card[2]}`);}}
test('all standard empty routes and metadata categories exist',()=>{const views=routes();checkParents(views);for(const key of ['mss-mid','mss-final-biochemistry','mss-past-mid','mss-past-final','immunology-final','saved','mistakes','search','backup'])assert.ok(views[key]);});
test('new MSS subject joins existing midterm branch',()=>{const views=routes([resource('MSS','Biochemistry','mss-mid-biochemistry')]);assert.equal(views['mss-mid-biochemistry'].parent,'mss-mid');assert.ok(views['mss-mid'].cards.some(c=>c[2]==='mss-mid-biochemistry'));assert.equal(views['mss-midterm'],undefined);checkParents(views);});
test('new system with subjects derives system and exam branch',()=>{const views=routes([resource('CVS','Physiology','cvs-mid-physiology')]);assert.equal(views['cvs'].parent,'home');assert.equal(views['cvs-mid'].parent,'cvs');assert.equal(views['cvs-mid-physiology'].parent,'cvs-mid');checkParents(views);});
test('new single-subject system has no self parent cycle',()=>{const views=routes([resource('Neurology','Neurology','neurology-mid')]);assert.equal(views['neurology-mid'].parent,'neurology');assert.equal(views['neurology-mid'].category,'neurology-mid');checkParents(views);});
test('new subject under a single-subject exam keeps existing dashboard',()=>{const views=routes([resource('Immunology','Clinical','immunology-mid-clinical')]);assert.equal(views['immunology-mid'].category,'immunology-mid');assert.equal(views['immunology-mid-clinical'].parent,'immunology-mid');assert.ok(views['immunology-mid'].cards.some(c=>c[2]==='immunology-mid-clinical'));checkParents(views);});
