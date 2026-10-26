(function () {
  'use strict';
  const key = 'vitanova:progress:v1';
  const storage = window.VitanovaStorage;
  const valid = (value) => storage.record(value) && value.version === 1 && storage.record(value.categories) && Object.values(value.categories).every((category) => storage.record(category) && Object.values(category).every((done) => typeof done === 'boolean'));
  function all() { return storage.read(key, { version: 1, categories: {} }, valid); }
  function isCompleted(category, id) { return all().categories[category]?.[id] === true; }
  function setCompleted(category, id, completed) {
    if (!storage.safeName(category) || !storage.safeName(id)) return false;
    const progress = all();
    progress.categories[category] ||= {};
    progress.categories[category][id] = Boolean(completed);
    const stored = storage.write(key, progress);
    window.dispatchEvent(new CustomEvent('vitanova:progress-changed'));
    return stored;
  }
  window.VitanovaStudyProgress = { isCompleted, setCompleted, all };
})();
