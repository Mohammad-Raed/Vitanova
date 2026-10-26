/* Shared local persistence. Existing keys remain readable; failed writes stay usable in this tab. */
(function () {
  'use strict';
  const memory = new Map();
  const corrupt = new Set();
  let available = true;
  let pendingWarning = '';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const safeName = (key) => !['__proto__', 'constructor', 'prototype'].includes(key);
  const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(safeName);
  function warning(message) {
    pendingWarning = message || 'Study data cannot be saved permanently in this browser. Keep this tab open and export a backup before leaving.';
    if (!document.body) return;
    let notice = document.getElementById('vn-storage-warning');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'vn-storage-warning'; notice.className = 'vn-storage-warning';
      notice.setAttribute('role', 'status'); document.body.prepend(notice);
    }
    if (notice.textContent !== pendingWarning) notice.textContent = pendingWarning;
  }
  function read(key, fallback, validate = () => true) {
    if (memory.has(key)) return clone(memory.get(key));
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        let value;
        try { value = JSON.parse(raw); } catch { corrupt.add(key); }
        if (!corrupt.has(key) && validate(value)) { memory.set(key, clone(value)); return clone(value); }
        corrupt.add(key);
        warning('Some stored study data is damaged. Its original value has been kept unchanged; changes to that record are temporary until it is recovered.');
      }
    } catch { available = false; warning(); }
    memory.set(key, clone(fallback));
    return clone(fallback);
  }
  function write(key, value) {
    // A first write (for example Continue Studying) must also detect damaged raw data.
    if (!memory.has(key)) read(key, value);
    memory.set(key, clone(value));
    let stored = false;
    if (!corrupt.has(key)) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); stored = true; available = true; }
      catch { available = false; warning(); }
    }
    window.dispatchEvent(new CustomEvent('vitanova:storage-changed', { detail: { key } }));
    return stored;
  }
  function invalidate() { memory.clear(); corrupt.clear(); }
  window.addEventListener('storage', () => {
    invalidate(); window.dispatchEvent(new CustomEvent('vitanova:storage-changed', { detail: { external: true } }));
  });
  document.addEventListener('DOMContentLoaded', () => { if (pendingWarning) warning(pendingWarning); });
  window.VitanovaStorage = { read, write, warning, record, safeName, invalidate, snapshot: (key) => memory.has(key) ? clone(memory.get(key)) : undefined, isAvailable: () => available, isCorrupt: (key) => corrupt.has(key) };
})();
