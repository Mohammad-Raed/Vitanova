/* Add revision tools beside original quizzes without replacing their handlers or educational content. */
(function () {
  'use strict';
  const lecture = (window.VitanovaLectures || []).find((item) => item.file === decodeURIComponent(location.pathname.split('/').pop() || ''));
  const bookmarks = window.VitanovaBookmarks; const mistakes = window.VitanovaMistakes;
  if (!lecture || !bookmarks || !mistakes) return;
  const bank = (window.VitanovaQuestionBank || []).filter((item) => item.lectureId === lecture.id);
  if (!bank.length) return;
  const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const stem = (text) => normalize(text).replace(/^\d+\s*[.)]\s*/, '');
  const questions = new Map(); const matched = new WeakMap(); const answered = new WeakSet();
  bank.forEach((q) => { const key = stem(q.question); if (!questions.has(key)) questions.set(key, []); questions.get(key).push(q); });
  function label(button, saved) {
    button.setAttribute('aria-pressed', String(saved));
    const text = saved ? '★ Saved question' : '☆ Save question';
    if (button.textContent !== text) button.textContent = text;
    button.title = saved ? 'Remove this bookmark' : 'Save this question for mixed revision';
  }
  function enhance() {
    document.querySelectorAll('.q:not([data-vn-question-id])').forEach((block) => {
      const heading = block.querySelector('p'); const options = [...block.querySelectorAll('button.o')];
      if (!heading || !options.length) return;
      const candidates = questions.get(stem(heading.textContent)) || [];
      const raw = options.map((o) => normalize(o.textContent));
      const noPrefix = raw.map((text) => text.replace(/^[A-Z][.)]\s*/, ''));
      let item; let mapping;
      for (const displayed of [raw, noPrefix]) {
        item = candidates.find((q) => q.options.length === displayed.length && q.options.every((text, i) => normalize(text) === displayed[i]));
        if (item) { mapping = displayed.map((_, i) => i); break; }
        // Accept reordering only when each displayed choice maps unambiguously.
        item = candidates.find((q) => q.options.length === displayed.length && new Set(q.options.map(normalize)).size === q.options.length && new Set(displayed).size === displayed.length && displayed.every((text) => q.options.map(normalize).includes(text)));
        if (item) { mapping = displayed.map((text) => item.options.map(normalize).indexOf(text)); break; }
      }
      if (!item) return;
      block.dataset.vnQuestionId = item.id; block.id = 'mcq-' + item.id;
      matched.set(block, { item, mapping });
      const button = document.createElement('button'); button.type = 'button'; button.className = 'vn-bookmark-toggle';
      label(button, bookmarks.has(item.id)); button.setAttribute('aria-label', `Bookmark question: ${item.question}`);
      button.addEventListener('click', (event) => { event.stopPropagation(); bookmarks.set(item.id, !bookmarks.has(item.id)); });
      block.classList.toggle('vn-is-bookmarked', bookmarks.has(item.id)); block.append(button);
    });
  }
  function refreshBookmarks() {
    document.querySelectorAll('.q[data-vn-question-id]').forEach((block) => {
      const saved = bookmarks.has(block.dataset.vnQuestionId); block.classList.toggle('vn-is-bookmarked', saved);
      const button = block.querySelector('.vn-bookmark-toggle'); if (button) label(button, saved);
    });
  }
  function addControls() {
    const nav = document.querySelector('.vn-lecture-navigation'); if (!nav || nav.querySelector('.vn-bookmarks-link')) return;
    const link = document.createElement('a'); link.className = 'vn-bookmarks-link'; link.href = 'index.html#saved';
    const redo = document.createElement('button'); redo.id = 'vn-redo-mistakes'; redo.type = 'button'; redo.className = 'vn-redo-mistakes'; redo.setAttribute('aria-expanded', 'false'); redo.setAttribute('aria-controls', 'vn-mistake-panel');
    const panel = document.createElement('section'); panel.id = 'vn-mistake-panel'; panel.className = 'vn-mistake-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Lecture mistake revision'); nav.after(panel);
    const update = () => {
      link.textContent = `★ Saved (${bookmarks.count()})`;
      const ids = new Set(bank.map((q) => q.id));
      const count = Object.entries(mistakes.all()).filter(([id, r]) => ids.has(id) && !r.mastered).length;
      redo.textContent = `Redo mistakes (${count})`;
    };
    update(); window.addEventListener('vitanova:bookmarks-changed', update); window.addEventListener('vitanova:mistakes-changed', update);
    redo.addEventListener('click', () => {
      if (!window.VitanovaSaved) { location.href = 'index.html#mistakes'; return; }
      panel.hidden = !panel.hidden; redo.setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) window.VitanovaSaved.render(panel, null, { mode: 'mistakes', lectureId: lecture.id });
    });
    const controls = nav.querySelector('.vn-lecture-controls');
    if (controls) controls.before(link, redo); else nav.append(link, redo);
  }
  function start() {
    enhance(); addControls();
    // In-place quiz resets allow a fresh attempt without counting repeat clicks.
    document.addEventListener("vitanova:question-reset", (event) => {
      if (event.target.matches?.(".q")) answered.delete(event.target);
    });
    // Capture before native handlers mark their question as locked, without altering their score/reset flow.
    document.addEventListener('click', (event) => {
      const option = event.target.closest('button.o'); if (!option) return;
      const block = option.closest('.q'); const match = matched.get(block);
      if (!match || answered.has(block) || block.dataset.l || block.dataset.d || block.dataset.done) return;
      const index = [...block.querySelectorAll('button.o')].indexOf(option);
      if (index < 0 || option.disabled) return;
      answered.add(block); mistakes.record(match.item.id, match.mapping[index] === match.item.answer, false);
    }, true);
    let scheduled = false;
    const observer = new MutationObserver((entries) => {
      if (!entries.some((entry) => [...entry.addedNodes].some((node) => node.nodeType === 1 && (node.matches('.q') || node.querySelector('.q'))))) return;
      if (scheduled) return; scheduled = true;
      requestAnimationFrame(() => { scheduled = false; enhance(); });
    });
    observer.observe(document.body, { subtree: true, childList: true });
    window.addEventListener('vitanova:bookmarks-changed', refreshBookmarks);
    window.addEventListener('vitanova:storage-changed', (event) => { if (event.detail?.external) refreshBookmarks(); });
    if (location.hash.startsWith('#mcq-')) {
      let requested = location.hash.slice(5);
      try { requested = decodeURIComponent(requested); } catch { /* Preserve malformed fragments as unmatched references. */ }
      const id = bookmarks.canonical(requested);
      requestAnimationFrame(() => document.getElementById('mcq-' + id)?.scrollIntoView({ block: 'center' }));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
