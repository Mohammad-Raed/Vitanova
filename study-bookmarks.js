/* IDs are canonicalized through bank aliases without discarding missing references. */
(function () {
  'use strict';
  const storage = window.VitanovaStorage;
  const key = 'vitanova:bookmarks:v1';
  const mistakeKey = 'vitanova:mistakes:v1';
  const finite = (n) => Number.isFinite(n) && n >= 0;
  let indexedBank; let aliases = new Map();
  function canonical(id) {
    const bank = window.VitanovaQuestionBank || [];
    if (indexedBank !== bank) {
      indexedBank = bank; aliases = new Map();
      bank.forEach((q) => { aliases.set(q.id, q.id); (q.legacyIds || []).forEach((alias) => aliases.set(alias, q.id)); });
    }
    return aliases.get(id) || id;
  }
  function valid(value) { return storage.record(value) && value.version === 1 && storage.record(value.saved) && Object.values(value.saved).every(finite); }
  function read() { return storage.read(key, { version: 1, saved: {} }, valid); }
  function all() {
    const result = {};
    Object.entries(read().saved).forEach(([id, time]) => { const current = canonical(id); result[current] = Math.min(result[current] ?? time, time); });
    return result;
  }
  function has(id) { return Object.hasOwn(all(), canonical(id)); }
  function set(id, active) {
    if (!storage.safeName(id)) return false;
    const data = read(); const current = canonical(id);
    if (active) data.saved[current] = data.saved[current] || Date.now();
    else Object.keys(data.saved).filter((old) => canonical(old) === current).forEach((old) => delete data.saved[old]);
    const result = storage.write(key, data);
    window.dispatchEvent(new CustomEvent('vitanova:bookmarks-changed'));
    return result;
  }
  function validMistakes(value) {
    return storage.record(value) && value.version === 1 && storage.record(value.records) && Object.values(value.records).every((r) => storage.record(r) && Number.isInteger(r.wrong) && r.wrong >= 0 && Number.isInteger(r.correct) && r.correct >= 0 && typeof r.mastered === 'boolean' && finite(r.lastAttempt));
  }
  function mistakeData() { return storage.read(mistakeKey, { version: 1, records: {} }, validMistakes); }
  function mistakes() {
    const result = {};
    Object.entries(mistakeData().records).forEach(([id, record]) => {
      const current = canonical(id); const previous = result[current];
      if (!previous) result[current] = record;
      else result[current] = { ...((previous.lastAttempt > record.lastAttempt) ? previous : record), wrong: Math.max(previous.wrong, record.wrong), correct: Math.max(previous.correct, record.correct) };
    });
    return result;
  }
  function recordAnswer(id, correct, revision = false) {
    if (!storage.safeName(id)) return false;
    const data = mistakeData(); const current = canonical(id); const existing = mistakes()[current];
    if (correct && !existing) return true;
    const record = existing || { wrong: 0, correct: 0, mastered: false, lastAttempt: 0 };
    if (correct) { record.correct++; if (revision) record.mastered = true; }
    else { record.wrong++; record.mastered = false; }
    record.lastAttempt = Date.now();
    Object.keys(data.records).filter((old) => old !== current && canonical(old) === current).forEach((old) => delete data.records[old]);
    data.records[current] = record;
    const result = storage.write(mistakeKey, data);
    window.dispatchEvent(new CustomEvent('vitanova:mistakes-changed'));
    return result;
  }
  window.VitanovaBookmarks = { has, all, count: () => Object.keys(all()).length, set, canonical, isStorageAvailable: storage.isAvailable };
  window.VitanovaMistakes = { all: mistakes, record: recordAnswer, count: () => Object.values(mistakes()).filter((r) => !r.mastered).length };
})();
