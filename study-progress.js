(function () {
  const storageKey = 'vitanova:progress:v1';

  function readProgress() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { version: 1, categories: {} };
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !parsed.categories || typeof parsed.categories !== 'object') {
        return { version: 1, categories: {} };
      }
      return parsed;
    } catch {
      return { version: 1, categories: {} };
    }
  }

  function isCompleted(category, id) {
    return readProgress().categories[category]?.[id] === true;
  }

  function setCompleted(category, id, completed) {
    const progress = readProgress();
    if (!progress.categories[category] || typeof progress.categories[category] !== 'object') {
      progress.categories[category] = {};
    }
    progress.categories[category][id] = Boolean(completed);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(progress));
      return true;
    } catch {
      return false;
    }
  }

  window.VitanovaStudyProgress = { isCompleted, setCompleted };
})();
