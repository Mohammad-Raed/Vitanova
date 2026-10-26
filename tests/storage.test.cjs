const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(seed = {}) {
  const saved = new Map(Object.entries(seed)); let blocked = false;
  const context = { console, Map, Set, Date, Math, JSON, Object, Number, String, Boolean, CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, document: { body: null, addEventListener() {} }, addEventListener() {}, dispatchEvent() {}, localStorage: { getItem(key) { if (blocked) throw Error('disabled'); return saved.get(key) ?? null; }, setItem(key, value) { if (blocked) throw Error('quota'); saved.set(key, value); } } };
  context.window = context; vm.createContext(context);
  for (const file of ['study-storage.js', 'study-progress.js', 'study-bookmarks.js']) vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8'), context);
  context.VitanovaQuestionBank = [{ id: 'stable', legacyIds: ['old'], lectureId: 'lecture' }];
  return { app: context, saved, block: () => { blocked = true; } };
}
test('progress changes preserve unknown IDs and allow uncheck independently', () => {
  const { app } = setup({ 'vitanova:progress:v1': JSON.stringify({ version: 1, categories: { anatomy: { oldLecture: true } } }) });
  app.VitanovaStudyProgress.setCompleted('anatomy', 'lecture', true);
  app.VitanovaStudyProgress.setCompleted('physiology', 'lecture', false);
  assert.equal(app.VitanovaStudyProgress.isCompleted('anatomy', 'oldLecture'), true);
  assert.equal(app.VitanovaStudyProgress.isCompleted('anatomy', 'lecture'), true);
  assert.equal(app.VitanovaStudyProgress.isCompleted('physiology', 'lecture'), false);
  app.VitanovaStudyProgress.setCompleted('anatomy', 'lecture', false);
  assert.equal(app.VitanovaStudyProgress.isCompleted('anatomy', 'lecture'), false);
});
test('bookmark aliases survive lookup/removal and retain unavailable references', () => {
  const { app } = setup({ 'vitanova:bookmarks:v1': JSON.stringify({ version: 1, saved: { old: 1, missing: 2 } }) });
  assert.equal(app.VitanovaBookmarks.has('stable'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(app.VitanovaBookmarks.all())), { stable: 1, missing: 2 });
  app.VitanovaBookmarks.set('stable', false);
  assert.equal(app.VitanovaBookmarks.has('old'), false);
  assert.equal(app.VitanovaBookmarks.has('missing'), true);
});
test('unavailable writes keep multiple local edits in this session', () => {
  const { app, block } = setup(); block();
  assert.equal(app.VitanovaStudyProgress.setCompleted('anatomy', 'a', true), false);
  app.VitanovaStudyProgress.setCompleted('anatomy', 'b', true);
  assert.equal(app.VitanovaStudyProgress.isCompleted('anatomy', 'a'), true);
  assert.equal(app.VitanovaStudyProgress.isCompleted('anatomy', 'b'), true);
  app.VitanovaBookmarks.set('stable', true); app.VitanovaBookmarks.set('missing', true);
  assert.equal(app.VitanovaBookmarks.count(), 2);
});
test('corrupt raw data is retained when editing a fallback record', () => {
  const { app, saved } = setup({ 'vitanova:progress:v1': '{damaged' });
  assert.equal(app.VitanovaStudyProgress.setCompleted('anatomy', 'a', true), false);
  assert.equal(saved.get('vitanova:progress:v1'), '{damaged');
  assert.equal(app.VitanovaStudyProgress.isCompleted('anatomy', 'a'), true);
  assert.equal(app.VitanovaStorage.isCorrupt('vitanova:progress:v1'), true);
});
test('mistakes persist and mastery requires a correct revision attempt', () => {
  const { app, saved } = setup();
  app.VitanovaMistakes.record('old', false);
  assert.equal(app.VitanovaMistakes.count(), 1);
  app.VitanovaMistakes.record('stable', true);
  assert.equal(app.VitanovaMistakes.count(), 1);
  app.VitanovaMistakes.record('stable', true, true);
  assert.equal(app.VitanovaMistakes.count(), 0);
  assert.equal(JSON.parse(saved.get('vitanova:mistakes:v1')).records.stable.mastered, true);
  app.VitanovaMistakes.record('stable', false);
  assert.equal(app.VitanovaMistakes.count(), 1);
});
test('prototype-bearing corrupt progress cannot mutate global prototypes', () => {
  const { app } = setup({ 'vitanova:progress:v1': '{"version":1,"categories":{"__proto__":{"polluted":true}}}' });
  assert.equal(app.VitanovaStudyProgress.setCompleted('__proto__', 'polluted', true), false);
  assert.equal({}.polluted, undefined);
  app.VitanovaStudyProgress.setCompleted('safe', 'lecture', true);
  assert.equal(app.VitanovaStorage.isCorrupt('vitanova:progress:v1'), true);
});
