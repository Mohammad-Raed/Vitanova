/* Student-owned backup files. Imports accept only validated study data, never HTML or code. */
(function () {
  'use strict';
  const FORMAT = 'vitanova-study-backup';
  const MAX_BYTES = 5 * 1024 * 1024;
  const keys = {
    progress: 'vitanova:progress:v1', bookmarks: 'vitanova:bookmarks:v1',
    mistakes: 'vitanova:mistakes:v1', flashcards: 'vitanova:flashcards:v1', recent: 'vitanova:recent:v1', theme: 'vitanova:theme:v1'
  };
  const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 500 && !forbidden.has(value);
  function safeTree(value, depth = 0) {
    if (depth > 12) throw new Error('The backup is nested too deeply.');
    if (typeof value === 'string' && value.length > 10000) throw new Error('The backup contains an oversized value.');
    if (value && typeof value === 'object') {
      if (!plain(value) && !Array.isArray(value)) throw new Error('Unsupported backup data.');
      for (const name of Object.keys(value)) {
        if (forbidden.has(name)) throw new Error('Unsafe property in backup.');
        safeTree(value[name], depth + 1);
      }
    }
  }
  function only(value, names) { return Object.keys(value).every(name => names.includes(name)); }
  function schema(name, value) {
    if (name === 'theme') return value === null || value === 'light' || value === 'dark';
    if (name === 'recent') return value === null || (plain(value) && only(value, ['version','lectureId','hash','openedAt']) &&
      value.version === 1 && identifier(value.lectureId) && finite(value.openedAt) &&
      (value.hash === undefined || (typeof value.hash === 'string' && value.hash.length <= 500 && (!value.hash || value.hash.startsWith('#')))));
    if (!plain(value) || value.version !== 1) return false;
    const field = {progress: 'categories', bookmarks: 'saved', mistakes: 'records', flashcards: 'records'}[name];
    if (!field || !only(value, ['version',field]) || !plain(value[field])) return false;
    return Object.entries(value[field]).every(([id, entry]) => {
      if (!identifier(id)) return false;
      if (name === 'progress') return plain(entry) && Object.entries(entry).every(([lecture, completed]) => identifier(lecture) && typeof completed === 'boolean');
      if (name === 'bookmarks') return finite(entry);
      if (name === 'flashcards') return plain(entry) && only(entry,['due','interval','reviews','lapses','lastReview','rating']) &&
        ['due','interval','lastReview'].every(k=>finite(entry[k])) && ['reviews','lapses'].every(k=>Number.isSafeInteger(entry[k])&&entry[k]>=0) &&
        Number.isInteger(entry.rating)&&entry.rating>=1&&entry.rating<=4;
      return plain(entry) && only(entry, ['wrong','correct','mastered','lastAttempt']) &&
        Number.isSafeInteger(entry.wrong) && entry.wrong >= 0 && Number.isSafeInteger(entry.correct) && entry.correct >= 0 &&
        typeof entry.mastered === 'boolean' && finite(entry.lastAttempt);
    });
  }
  function validate(data) {
    safeTree(data);
    if (!plain(data) || data.format !== FORMAT || data.version !== 1 || !plain(data.data) ||
        !only(data, ['format','version','exportedAt','data','warnings']) ||
        (data.warnings !== undefined && (!Array.isArray(data.warnings) || data.warnings.length > 10 || !data.warnings.every(item => typeof item === 'string' && item.length <= 1000))) ||
        typeof data.exportedAt !== 'string' || !Number.isFinite(Date.parse(data.exportedAt)) ||
        !Object.keys(data.data).length || !Object.keys(data.data).every(name => name in keys && schema(name, data.data[name]))) {
      throw new Error('This is not a supported Vitanova study backup. No data was changed.');
    }
    if (JSON.stringify(data).length > MAX_BYTES) throw new Error('The backup is larger than 5 MB.');
    return data;
  }
  function empty(name) {
    if (name === 'recent' || name === 'theme') return null;
    return {version: 1, [{progress:'categories',bookmarks:'saved',mistakes:'records',flashcards:'records'}[name]]: {}};
  }
  function rawRead(name) {
    let raw;
    try { raw = window.localStorage.getItem(keys[name]); }
    catch { throw new Error('Browser storage is unavailable. Backups need access to this browser’s study data.'); }
    if (raw === null) return empty(name);
    let result;
    try { result = name === 'theme' ? raw : JSON.parse(raw); }
    catch { throw new Error(`Existing ${name} data is corrupted. Its original value was preserved; recover it in browser storage before importing.`); }
    try { safeTree(result); } catch { throw new Error(`Existing ${name} data is invalid and was preserved.`); }
    if (!schema(name, result)) throw new Error(`Existing ${name} data is invalid and was preserved. Recover it in browser storage before importing.`);
    return result;
  }
  function exportData() {
    const warnings = [];
    const data = {};
    for (const name of Object.keys(keys)) {
      let stored = empty(name);
      try { stored = rawRead(name); }
      catch {
        warnings.push(`${name}: browser data was unavailable or invalid. This export contains accessible session data only; any original browser value was left unchanged.`);
      }
      const snapshot = window.VitanovaStorage?.snapshot?.(keys[name]);
      if (snapshot !== undefined) {
        try {
          safeTree(snapshot);
          if (schema(name, snapshot)) stored = snapshot;
          else warnings.push(`${name}: session data was invalid and could not be included.`);
        } catch { warnings.push(`${name}: session data was invalid and could not be included.`); }
      }
      data[name] = stored;
    }
    const result = {format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data};
    if (warnings.length) result.warnings = warnings;
    return result;
  }
  function merge(name, current, incoming) {
    if (incoming === null) return current;
    if (name === 'theme') return current || incoming;
    if (name === 'recent') return !current || incoming.openedAt > current.openedAt ? incoming : current;
    if (name === 'progress') {
      const categories = {...current.categories};
      for (const [category, records] of Object.entries(incoming.categories)) {
        categories[category] = {...categories[category]};
        for (const [id, completed] of Object.entries(records)) categories[category][id] = categories[category][id] === true || completed;
      }
      return {version: 1, categories};
    }
    if (name === 'bookmarks') {
      const saved = {...current.saved};
      for (const [id, time] of Object.entries(incoming.saved)) saved[id] = Object.hasOwn(saved,id) ? Math.min(saved[id],time) : time;
      return {version: 1, saved};
    }
    if (name === 'flashcards') {
      const records = {...current.records};
      for (const [id, next] of Object.entries(incoming.records)) {
        if (!records[id] || next.lastReview > records[id].lastReview) records[id] = next;
      }
      return {version:1, records};
    }
    const records = {...current.records};
    for (const [id, next] of Object.entries(incoming.records)) {
      const prev = records[id];
      records[id] = prev ? {...(next.lastAttempt > prev.lastAttempt ? next : prev),
        wrong: Math.max(prev.wrong,next.wrong), correct: Math.max(prev.correct,next.correct)} : next;
    }
    return {version: 1, records};
  }
  function importData(backup, mode = 'merge') {
    validate(backup);
    if (mode !== 'merge' && mode !== 'replace') throw new Error('Choose merge or replace.');
    const names = Object.keys(backup.data);
    const prepared = {};
    const previous = {};
    // Validate all existing fields and calculate the full update before changing any browser value.
    for (const name of names) {
      const current = rawRead(name);
      prepared[name] = mode === 'merge' ? merge(name,current,backup.data[name]) : backup.data[name];
      previous[name] = window.localStorage.getItem(keys[name]);
    }
    const changed = [];
    try {
      for (const name of names) {
        const value = prepared[name];
        if (value === null) window.localStorage.removeItem(keys[name]);
        else window.localStorage.setItem(keys[name], name === 'theme' ? value : JSON.stringify(value));
        changed.push(name);
      }
    } catch {
      let restored = true;
      for (const name of changed.reverse()) {
        try {
          if (previous[name] === null) window.localStorage.removeItem(keys[name]);
          else window.localStorage.setItem(keys[name], previous[name]);
        } catch { restored = false; }
      }
      window.VitanovaStorage?.invalidate?.();
      throw new Error(restored ? 'Browser storage could not save this backup. Existing data was restored.' : 'Browser storage failed during import and recovery. Keep your backup file and check available browser storage.');
    }
    window.VitanovaStorage?.invalidate?.();
    window.dispatchEvent(new CustomEvent('vitanova:storage-changed', {detail: {imported: names}}));
    for (const type of ['progress','bookmarks','mistakes']) window.dispatchEvent(new CustomEvent(`vitanova:${type}-changed`));
    return {mode, imported: names};
  }
  function mount(container) {
    container.replaceChildren();
    container.classList.add('vn-backup');
    const title = document.createElement('h3'); title.textContent = 'Keep a copy of your study data';
    const intro = document.createElement('p'); intro.textContent = 'Your progress stays in this browser. Export a JSON backup to move completion, saved questions, mistakes, flashcard reviews, and preferences to another device. Backups contain no medical content or executable code.';
    const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Export study backup';
    const label = document.createElement('label'); label.textContent = 'Import a Vitanova JSON backup';
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; label.append(file);
    const modeLabel = document.createElement('label'); modeLabel.textContent = 'Import method';
    const mode = document.createElement('select');
    for (const [value,text] of [['merge','Merge with existing study data'],['replace','Replace fields included in the backup']]) {
      const option = document.createElement('option'); option.value=value; option.textContent=text; mode.append(option);
    }
    modeLabel.append(mode);
    const help = document.createElement('p'); help.textContent = 'Merge keeps completed lectures, combines bookmarks, and keeps the latest flashcard review for each card. Replace overwrites only the data types present in your backup. Export first if you want to keep the current state.';
    const upload = document.createElement('button'); upload.type = 'button'; upload.textContent = 'Import backup';
    const status = document.createElement('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    download.addEventListener('click', () => {
      try {
        const backup = exportData();
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)], {type:'application/json'}));
        const anchor = document.createElement('a'); anchor.href=url; anchor.download=`vitanova-backup-${new Date().toISOString().slice(0,10)}.json`;
        document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
        status.textContent=backup.warnings?.length ? 'Recovery backup downloaded. Some browser data was unavailable or damaged; the file includes accessible session data and lists any limitations. Original stored values were preserved.' : 'Backup downloaded. Keep this file somewhere safe.';
      } catch (error) { status.textContent=error.message; }
    });
    upload.addEventListener('click', async () => {
      const chosen=file.files?.[0];
      if (!chosen) { status.textContent='Choose a JSON backup file first.'; return; }
      if (chosen.size>MAX_BYTES) { status.textContent='Choose a backup smaller than 5 MB.'; return; }
      try {
        const data=validate(JSON.parse(await chosen.text()));
        if (mode.value==='replace' && !window.confirm('Replace the study data types included in this backup? Export the current data first if you may need it later.')) return;
        importData(data,mode.value);
        status.textContent=`Backup imported using ${mode.value}. Your study data is available immediately.`;
      } catch (error) { status.textContent=error instanceof SyntaxError ? 'The selected file is not valid JSON. No data was changed.' : error.message; }
    });
    container.append(title,intro,download,label,modeLabel,help,upload,status);
  }
  window.VitanovaBackup={exportData,importData,mount,validate};
})();
