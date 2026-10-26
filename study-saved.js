/* Shared revision renderer: bookmarks and mistakes use the same original question bank. */
(function () {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function render(host, countNode, settings = {}) {
    host._vnRevisionCleanup?.();
    const bank = window.VitanovaQuestionBank || [];
    const registry = window.VitanovaLectures || [];
    const bookmarks = window.VitanovaBookmarks;
    const mistakes = window.VitanovaMistakes;
    const byId = new Map(bank.map((q) => [q.id, q]));
    const byLecture = new Map(registry.map((lecture) => [lecture.id, lecture]));
    let mode = settings.mode === 'mistakes' ? 'mistakes' : 'saved';
    const responses = { saved: new Map(), mistakes: new Map() };
    let order = [];
    let attemptIds = [];
    const filters = { system: 'all', subject: 'all', lecture: settings.lectureId || 'all' };
    const token = String(Math.random());
    host.classList.add('vn-saved-host');
    function captureMistakes() { attemptIds = Object.entries(mistakes.all()).filter(([, r]) => !r.mastered).map(([id]) => id); }
    captureMistakes();
    function selected() {
      const ids = mode === 'mistakes' ? attemptIds : Object.keys(bookmarks.all());
      return [...new Set(ids)].map((id) => byId.get(id)).filter((q) => q && (!settings.lectureId || q.lectureId === settings.lectureId));
    }
    function visible() {
      const items = selected().filter((q) => {
        const lecture = byLecture.get(q.lectureId);
        return (filters.system === 'all' || lecture?.system === filters.system) && (filters.subject === 'all' || lecture?.subject === filters.subject) && (filters.lecture === 'all' || q.lectureId === filters.lecture);
      });
      if (!order.length) return items;
      const indexed = new Map(items.map((q) => [q.id, q]));
      return order.map((id) => indexed.get(id)).filter(Boolean).concat(items.filter((q) => !order.includes(q.id)));
    }
    const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
    host.innerHTML = `<div class="vn-saved-toolbar" data-vn-revision="${token}">
      <div class="vn-saved-intro"><span class="eyebrow">YOUR REVISION COLLECTION</span><p>Practise original lecture questions. Answers and explanations appear after each choice. Correct mistake-revision answers are marked mastered.</p></div>
      <div class="vn-saved-tools">
        <label>Collection<select id="vn-saved-mode">${option('saved', 'Saved questions')}${option('mistakes', 'Redo mistakes')}</select></label>
        <label>System<select id="vn-saved-system">${option('all', 'All systems')}${[...new Set(registry.map((l) => l.system))].map((v) => option(v, v)).join('')}</select></label>
        <label>Subject<select id="vn-saved-filter">${option('all', 'All subjects')}${[...new Set(registry.map((l) => l.subject))].sort().map((v) => option(v, v)).join('')}</select></label>
        <label>Lecture<select id="vn-saved-lecture">${option('all', 'All lectures')}${registry.map((l) => option(l.id, `${l.system} · ${l.subject} · ${l.lectureLabel}`)).join('')}</select></label>
        <button id="vn-saved-mix" type="button">Shuffle questions</button><button id="vn-saved-reset" type="button">Start new attempt</button>
      </div><div class="vn-saved-stats" aria-live="polite"><strong id="vn-saved-score"></strong><span>Scores belong to this attempt. Bookmarks and mistakes stay on this device.</span></div>
      <p id="vn-missing-questions" class="vn-storage-warning" hidden></p>
    </div><div id="vn-saved-list" class="vn-saved-list"></div>`;
    host.querySelector('#vn-saved-mode').value = mode;
    host.querySelector('#vn-saved-lecture').value = filters.lecture;
    host.querySelector('#vn-saved-lecture').disabled = Boolean(settings.lectureId);
    function score() {
      const items = visible(); const answers = responses[mode];
      const answered = items.filter((q) => answers.has(q.id));
      const correct = answered.filter((q) => answers.get(q.id) === q.answer).length;
      host.querySelector('#vn-saved-score').textContent = `${correct} correct · ${answered.length} answered · ${items.length} questions · ${mode === 'mistakes' ? 'Mistake revision' : 'Saved revision'}`;
    }
    function draw(focus) {
      if (!host.querySelector(`[data-vn-revision="${token}"]`)) return;
      const items = visible(); const answers = responses[mode]; const mistakeRecords = mistakes.all(); const bookmarked = bookmarks.all();
      if (countNode) countNode.textContent = `${selected().length} ${mode === 'mistakes' ? 'mistake' : 'saved'} questions`;
      const sourceIds = mode === 'mistakes' ? Object.keys(mistakes.all()) : Object.keys(bookmarks.all());
      const missing = sourceIds.filter((id) => !byId.has(id)).length;
      const notice = host.querySelector('#vn-missing-questions');
      notice.hidden = !missing;
      notice.textContent = `${missing} question reference${missing === 1 ? ' is' : 's are'} unavailable in this version. Your saved records have been kept and will reappear if those questions return.`;
      const list = host.querySelector('#vn-saved-list');
      if (!items.length) {
        list.innerHTML = `<div class="vn-saved-empty"><span aria-hidden="true">${mode === 'mistakes' ? '✓' : '☆'}</span><h3>${selected().length ? 'No matching questions' : mode === 'mistakes' ? 'No mistakes to redo' : 'No saved questions yet'}</h3><p>${selected().length ? 'Try another system, subject, or lecture filter.' : mode === 'mistakes' ? 'Incorrect lecture answers will appear here. Correct revision answers mark them mastered.' : 'Select “Save question” beside a lecture MCQ to add it here.'}</p><a href="#home">Browse lectures →</a></div>`;
        score();
        if (focus) { const heading = list.querySelector('h3'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
        return;
      }
      list.innerHTML = items.map((q, index) => {
        const lecture = byLecture.get(q.lectureId); const answered = answers.has(q.id); const choice = answers.get(q.id);
        const mastered = mode === 'mistakes' && mistakeRecords[q.id]?.mastered;
        const href = lecture ? encodeURIComponent(lecture.file) + '#mcq-' + encodeURIComponent(q.id) : '#home';
        return `<article class="vn-review-question" data-question-id="${esc(q.id)}">
          <div class="vn-review-source"><span>QUESTION ${index + 1} OF ${items.length}</span><span>${esc(lecture?.system)} · ${esc(lecture?.subject)} · ${esc(lecture?.lectureLabel)}</span></div>
          <h3>${esc(q.question)}</h3><div class="vn-review-options">${q.options.map((text, i) => `<button type="button" class="vn-review-option${answered ? i === q.answer ? ' is-correct' : i === choice ? ' is-wrong' : '' : ''}" data-answer="${i}" ${answered ? 'disabled' : ''}><span class="vn-review-letter">${String.fromCharCode(65 + i)}</span><span>${esc(text)}</span></button>`).join('')}</div>
          ${answered ? `<div class="vn-review-explanation" role="status"><strong>${choice === q.answer ? '✓ Correct' : 'Correct answer: ' + String.fromCharCode(65 + q.answer) + ' — ' + esc(q.options[q.answer])}${mastered ? ' · Mastered' : ''}</strong><p>${esc(q.explanation)}</p></div>` : ''}
          <div class="vn-review-footer"><a href="${esc(href)}">View in original lecture ↗</a><button class="vn-review-remove" type="button">${Object.hasOwn(bookmarked, q.id) ? 'Remove bookmark' : 'Save question'}</button></div></article>`;
      }).join('');
      score();
      if (focus) {
        const card = [...list.querySelectorAll('.vn-review-question')].find((node) => node.dataset.questionId === focus.id) || list.querySelector('.vn-review-question');
        const target = focus.answer ? card?.querySelector('.vn-review-explanation') : card?.querySelector('.vn-review-remove');
        if (target) { if (focus.answer) target.tabIndex = -1; target.focus({ preventScroll: true }); }
      }
    }
    host.querySelector('#vn-saved-mode').addEventListener('change', (event) => {
      mode = event.target.value; order = []; if (mode === 'mistakes') captureMistakes(); draw();
    });
    [['system', '#vn-saved-system'], ['subject', '#vn-saved-filter'], ['lecture', '#vn-saved-lecture']].forEach(([name, selector]) => host.querySelector(selector).addEventListener('change', (event) => { filters[name] = event.target.value; order = []; draw(); }));
    host.querySelector('#vn-saved-reset').addEventListener('click', () => { responses[mode].clear(); order = []; if (mode === 'mistakes') captureMistakes(); draw(); });
    host.querySelector('#vn-saved-mix').addEventListener('click', () => {
      order = visible().map((q) => q.id);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      draw();
    });
    host.querySelector('#vn-saved-list').addEventListener('click', (event) => {
      const card = event.target.closest('.vn-review-question'); if (!card) return;
      const id = card.dataset.questionId; const q = byId.get(id); const answer = event.target.closest('[data-answer]');
      if (answer && !responses[mode].has(id)) {
        const choice = Number(answer.dataset.answer); responses[mode].set(id, choice);
        mistakes.record(id, choice === q.answer, mode === 'mistakes'); draw({ id, answer: true });
      } else if (event.target.closest('.vn-review-remove')) {
        const ids = visible().map((q) => q.id); const index = ids.indexOf(id);
        bookmarks.set(id, !bookmarks.has(id));
        draw({ id: mode === 'saved' ? ids[index + 1] || ids[index - 1] : id });
      }
    });
    const update = () => draw();
    window.addEventListener('vitanova:bookmarks-changed', update);
    host._vnRevisionCleanup = () => window.removeEventListener('vitanova:bookmarks-changed', update);
    draw();
  }
  window.VitanovaSaved = { render };
})();
