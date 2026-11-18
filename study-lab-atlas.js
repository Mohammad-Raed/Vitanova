/* Add keyboard-accessible links between the original annotations and notes. */
window.VitanovaLabAtlas = (() => {
  const number = element => element.dataset.n ?? element.closest('[data-g]')?.dataset.g;
  const selected = (card, pin) => pin.classList.contains('act') || card.dataset.lock === number(pin);
  function update(card) {
    card.querySelectorAll('.lab-atlas-picture .lab-atlas-pin').forEach(pin => {
      pin.setAttribute('aria-pressed', String(selected(card, pin)));
    });
  }

  function addSvgPins(picture) {
    const svg = picture.querySelector('.fig svg');
    if (!svg) return;
    const {x, y, width, height} = svg.viewBox.baseVal;
    picture.style.setProperty('--lab-ratio', width / height);
    svg.querySelectorAll('.nb').forEach(group => {
      const dot = group.querySelector('circle');
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'lab-atlas-pin nb';
      pin.dataset.n = group.dataset.n;
      pin.dataset.b = group.dataset.b;
      pin.style.left = (dot.cx.baseVal.value - x) / width * 100 + '%';
      pin.style.top = (dot.cy.baseVal.value - y) / height * 100 + '%';
      pin.textContent = group.dataset.n;
      picture.append(pin);
    });
  }

  function connect(card, index) {
    const picture = card.querySelector('.lab-atlas-picture');
    addSvgPins(picture);
    const pins = [...picture.querySelectorAll('.lab-atlas-pin')];
    const notes = [...card.querySelectorAll('.lab-atlas-key li')];
    notes.forEach((note, noteIndex) => {
      const matches = pins.filter(pin => number(pin) === number(note));
      const pin = matches[0];
      if (!pin) return;
      note.id = (card.id || 'lab-figure-' + index) + '-note-' + noteIndex;
      matches.forEach(match => {
        match.setAttribute('aria-controls', note.id);
        match.setAttribute('aria-label', 'Show note ' + number(match));
      });
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'lab-show-marker';
      link.textContent = 'Show on image';
      link.setAttribute('aria-label', 'Show marker ' + number(pin) + ' on image');
      link.addEventListener('click', event => {
        event.stopPropagation();
        if (!selected(card, pin)) pin.click();
        pin.focus({preventScroll:true});
        pin.scrollIntoView({block:'nearest', inline:'nearest'});
      });
      note.append(link);
    });

    const zoom = picture.querySelector('.fig, .iw > img');
    zoom.tabIndex = 0;
    zoom.setAttribute('role', 'button');
    zoom.setAttribute('aria-label', 'Zoom ' + (zoom.alt || card.querySelector('.lab-atlas-visual h3').textContent));
    zoom.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      zoom.click();
    });
    update(card);
  }

  document.addEventListener('click', event => {
    const card = event.target.closest('.lab-atlas-card');
    if (card) {
      const pin = event.target.closest('.hs .lab-atlas-pin');
      setTimeout(() => {
        update(card);
        if (pin && event.isTrusted && selected(card, pin)) {
          document.getElementById(pin.getAttribute('aria-controls'))?.scrollIntoView({block:'nearest'});
        }
      }, 0);
    }
  }, true);

  let refreshReview = () => {};
  function addHeaderReview({count, retry, quiz}) {
    const controls = document.querySelector('.vn-lecture-controls');
    if (!controls) return;
    const saved = document.createElement('a');
    saved.className = 'vn-bookmarks-link';
    saved.href = 'index.html#saved';
    function refreshSaved() {
      saved.textContent = `★ Saved (${window.VitanovaBookmarks.count()})`;
    }
    refreshSaved();
    window.addEventListener('vitanova:bookmarks-changed', refreshSaved);
    window.addEventListener('vitanova:storage-changed', refreshSaved);
    window.addEventListener('pageshow', refreshSaved);

    const redo = document.createElement('button');
    redo.className = 'vn-redo-mistakes';
    redo.type = 'button';
    redo.setAttribute('aria-controls', quiz.id);
    refreshReview = () => {
      const mistakes = count();
      redo.textContent = `Redo mistakes (${mistakes})`;
      redo.disabled = !mistakes;
    };
    refreshReview();
    window.addEventListener('vitanova:mistakes-changed', () => refreshReview());
    window.addEventListener('vitanova:storage-changed', () => refreshReview());
    redo.addEventListener('click', () => {
      retry();
      const heading = quiz.querySelector('h2');
      heading.tabIndex = -1;
      heading.focus({preventScroll: true});
      quiz.scrollIntoView();
    });
    controls.before(saved, redo);

    const flashcards = document.querySelector('.vn-lecture-topics .vn-flashcards');
    if (flashcards) flashcards.setAttribute('aria-label', 'Flashcards related to this lab');
  }

  function quizRevision(lectureId, length) {
    const ids = Array.from({length}, (_, index) => lectureId + '-quiz-' + (index + 1));
    const bookmarks = () => window.VitanovaBookmarks;
    const mistakes = () => window.VitanovaMistakes;

    function pending() {
      const records = mistakes().all();
      return ids.flatMap((id, index) => records[id] && !records[id].mastered ? [index] : []);
    }

    function refreshSaved(button, id) {
      const saved = bookmarks().has(id);
      button.textContent = saved ? 'Saved question' : 'Save question';
      button.setAttribute('aria-pressed', String(saved));
    }

    function attach(card, index) {
      const id = ids[index];
      card.id = 'mcq-' + id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vn-bookmark-toggle';
      button.dataset.labBookmark = id;
      button.addEventListener('click', () => bookmarks().set(id, !bookmarks().has(id)));
      card.append(button);
      if (bookmarks()) refreshSaved(button, id);
    }

    function start(previousMistakes, openQuiz) {
      const records = mistakes().all();
      for (const index of new Set(previousMistakes)) {
        const id = ids[index];
        if (id && !records[id]) mistakes().record(id, false);
      }
      const refresh = () => {
        document.querySelectorAll('[data-lab-bookmark]').forEach(button => {
          refreshSaved(button, button.dataset.labBookmark);
        });
      };
      const open = () => {
        const index = ids.findIndex(id => location.hash === '#mcq-' + id);
        if (index < 0) return;
        openQuiz(index);
        document.getElementById('mcq-' + ids[index])?.scrollIntoView({block: 'center'});
      };
      refresh();
      window.addEventListener('vitanova:bookmarks-changed', refresh);
      window.addEventListener('vitanova:storage-changed', refresh);
      window.addEventListener('pageshow', refresh);
      window.addEventListener('hashchange', open);
      requestAnimationFrame(open);
    }

    return {
      attach, start, pending,
      record(index, correct, revision) {
        const id = ids[index];
        mistakes().record(id, correct, revision || location.hash === '#mcq-' + id);
      }
    };
  }

  return {
    quizRevision,
    addHeaderReview,
    refreshReview: () => refreshReview(),
    connect(root) {
      root.querySelectorAll('.lab-atlas-card').forEach(connect);
    }
  };
})();
