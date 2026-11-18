(() => {
  'use strict';

  const {figs: figures, secs: sections, quiz: questions} = window.VitanovaAnatomyLab5;
  const byId = id => document.getElementById(id);
  const atlas = byId('atlas');
  const topics = byId('lab-topics');
  const search = byId('figure-search');
  const filters = byId('figure-filters');
  const quizList = byId('lab-questions');
  const zoom = byId('lab-zoom');
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const figuresById = new Map(figures.map(figure => [figure.id, figure]));
  const structureRows = new Map();
  const stateKey = 'vitanova:mss-labs-anatomy-05:v1';
  const reviewed = new Set();
  const mistakes = new Set();
  let filter = '';
  let activeStructure;
  let showingMistakes = false;
  let questionCount = 0;
  let answered = 0;
  let score = 0;

  function element(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }

  function button(label, attributes = {}) {
    return element('button', {type: 'button', ...attributes}, label);
  }

  function imagePath(figure) {
    return 'assets/anatomy-lab-5/figure-' + String(figure.id).padStart(2, '0') + '.webp';
  }

  function masks(figure, target, enlarged) {
    const layer = document.createElementNS(svgNamespace, 'svg');
    layer.setAttribute('viewBox', '0 0 100 100');
    layer.setAttribute('preserveAspectRatio', 'none');
    layer.setAttribute('aria-hidden', 'true');
    layer.classList.add('lab-masks');
    for (const [x, y, width, height] of figure.masks) {
      const rect = document.createElementNS(svgNamespace, 'rect');
      for (const [name, value] of Object.entries({x, y, width, height})) rect.setAttribute(name, value);
      layer.append(rect);
    }
    if (target) {
      // Keep the tissue at the target visible when a printed label ends nearby.
      const mask = document.createElementNS(svgNamespace, 'mask');
      mask.id = 'mask-' + (enlarged ? 'zoom' : target.c);
      const full = document.createElementNS(svgNamespace, 'path');
      full.setAttribute('d', 'M0 0H100V100H0Z');
      full.setAttribute('fill', 'white');
      const opening = document.createElementNS(svgNamespace, 'ellipse');
      opening.setAttribute('cx', target.x);
      opening.setAttribute('cy', target.y);
      opening.setAttribute('rx', '4');
      opening.setAttribute('ry', 4 * figure.width / figure.height);
      opening.setAttribute('fill', 'black');
      mask.append(full, opening);
      const group = document.createElementNS(svgNamespace, 'g');
      group.append(...layer.children);
      group.setAttribute('mask', 'url(#' + mask.id + ')');
      layer.append(mask, group);
    }
    return layer;
  }

  function picture(figure, {study = true, target, enlarged = false} = {}) {
    const wrapper = element('div', {class: 'lab-picture'});
    wrapper.style.setProperty('--ratio', figure.width / figure.height);
    wrapper.style.setProperty('--pixels', figure.width + 'px');
    if (study) wrapper.dataset.study = '';
    const image = element('img', {
      src: imagePath(figure),
      width: figure.width,
      height: figure.height,
      loading: enlarged || (study && figure.id === 1) ? 'eager' : 'lazy',
      decoding: 'async',
      alt: study ? figure.t : 'Practical figure with a ring around the target structure'
    });
    wrapper.append(image, masks(figure, target, enlarged));
    if (study) {
      for (const marker of figure.m) {
        const pin = button(marker.c, {
          class: 'lab-pin',
          'data-marker': marker.c,
          'aria-label': 'Reveal structure ' + marker.c,
          'aria-controls': 'structure-' + marker.c,
          'aria-pressed': String(activeStructure === marker.c)
        });
        pin.style.left = marker.x + '%';
        pin.style.top = marker.y + '%';
        wrapper.append(pin);
      }
    }
    if (target) {
      const ring = element('span', {class: 'lab-quiz-target', 'aria-hidden': 'true'});
      ring.style.left = target.x + '%';
      ring.style.top = target.y + '%';
      wrapper.append(ring);
    }
    return wrapper;
  }

  function enlarge(figure, target) {
    const isStudy = !target;
    byId('zoom-title').textContent = isStudy ? 'Figure ' + figure.id + ' · ' + figure.t : 'Practical figure';
    byId('zoom-picture').replaceChildren(picture(figure, {study: isStudy, target, enlarged: true}));
    zoom.showModal();
  }

  function makeStructure(figure, structure, index) {
    const code = structure.c || figure.id + '-extra-' + (index + 1);
    const checkbox = element('input', {type: 'checkbox', 'aria-label': 'Mark structure ' + code + ' reviewed'});
    const reveal = button('Reveal', {class: 'lab-reveal-name', 'aria-label': 'Reveal structure ' + code});
    const row = element('li', {id: 'structure-' + code},
      checkbox,
      element('span', {class: 'lab-code'}, structure.c || '—'),
      element('div', {},
        element('span', {class: 'lab-answer'},
          element('strong', {class: 'lab-name'}, structure.n),
          element('span', {class: 'lab-description'}, structure.d)
        ),
        reveal
      )
    );
    if (structure.c) {
      const locate = button('Locate', {class: 'lab-link-button', 'aria-label': 'Locate structure ' + code + ' on image'});
      locate.addEventListener('click', () => highlight(code, true));
      row.append(locate);
    }
    structureRows.set(code, {row, checkbox, name: structure.n.toLowerCase(), figureId: figure.id});
    reveal.addEventListener('click', () => highlight(code, false));
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) reviewed.add(code);
      else reviewed.delete(code);
      row.classList.toggle('is-reviewed', checkbox.checked);
      updateProgress();
      persist();
    });
    return row;
  }

  function makeFigure(figure) {
    const expand = button('Enlarge', {'aria-label': 'Enlarge figure ' + figure.id});
    expand.addEventListener('click', () => enlarge(figure));
    const image = picture(figure);
    const controls = element('div', {class: 'lab-figure-tools'},
      expand,
      element('a', {href: imagePath(figure), target: '_blank', rel: 'noopener'}, 'Open full size'),
      element('span', {class: 'lab-kind'}, figure.k)
    );
    const heading = element('h3', {}, 'Figure ' + figure.id + ' · ' + figure.t);
    const visual = element('div', {}, image, heading, element('p', {class: 'lab-caption'}, figure.cap), controls);
    const key = element('ul', {class: 'lab-key'},
      ...figure.m.map((marker, index) => makeStructure(figure, marker, index)),
      ...figure.x.map((structure, index) => makeStructure(figure, structure, index))
    );
    const details = element('div', {}, element('h4', {}, 'Identification key & checklist'), key);
    if (figure.n.length) {
      details.append(element('div', {class: 'lab-notes'}, element('h4', {}, 'Notes'),
        element('ul', {}, ...figure.n.map(note => element('li', {}, note)))));
    }
    return element('article', {class: 'lab-panel lab-figure', id: 'fig' + figure.id, 'data-kind': figure.k}, visual, details);
  }

  function pelvisFacts() {
    const facts = [
      'Bony pelvis = two hip bones (lateral and anterior walls) + sacrum and coccyx (posterior wall).',
      'Hip bones meet anteriorly at the pubic symphysis and the sacrum posteriorly at the sacroiliac joints.',
      'The pelvic brim divides the false (greater) pelvis above from the true (lesser) pelvis below.',
      'In anatomical position, the anterior superior iliac spines and the front of the pubic symphysis lie in the same vertical plane.'
    ];
    const contrasts = [
      ['General', 'Thick and heavy', 'Thin and light'],
      ['Greater pelvis', 'Deep', 'Shallow'],
      ['Lesser pelvis', 'Narrow, deep, tapering', 'Wide, shallow, cylindrical'],
      ['Pelvic inlet', 'Heart-shaped, narrow', 'Oval, rounded, wide'],
      ['Pelvic outlet', 'Comparatively small', 'Comparatively large'],
      ['Pubic arch / subpubic angle', 'Narrow (<70°)', 'Wide (>80°)'],
      ['Obturator foramen', 'Round', 'Oval'],
      ['Acetabulum', 'Large', 'Small'],
      ['Greater sciatic notch', 'Narrow (~70°), inverted V', 'Almost 90°']
    ];
    const table = element('table', {class: 'lab-table'}, element('caption', {}, 'Male and female bony pelvis'),
      element('thead', {}, element('tr', {}, ...['Feature', 'Male', 'Female'].map(label => element('th', {scope: 'col'}, label)))),
      element('tbody', {}, ...contrasts.map(([feature, male, female]) =>
        element('tr', {}, element('th', {scope: 'row'}, feature), element('td', {}, male), element('td', {}, female))))
    );
    return element('div', {class: 'lab-panel lab-facts lab-notes'}, element('h4', {}, 'Pelvis quick facts'),
      element('ul', {}, ...facts.map(fact => element('li', {}, fact))), table);
  }

  for (const [id, name] of sections) {
    const section = element('section', {id}, element('h2', {}, name));
    if (id === 'glu') {
      section.append(element('p', {class: 'lab-hint'}, 'In the posterior view, use piriformis as the landmark for structures leaving the pelvis.'));
    }
    section.append(...figures.filter(figure => figure.sec === id).map(makeFigure));
    if (id === 'pel') section.append(pelvisFacts());
    atlas.append(section);
    topics.append(element('a', {href: '#' + id}, name));
  }
  topics.prepend(element('a', {href: '#quiz', class: 'lab-quiz-link'}, 'Practical quiz'));

  function updateProgress() {
    const progress = byId('review-progress');
    progress.max = structureRows.size;
    progress.value = reviewed.size;
    byId('review-count').textContent = reviewed.size + ' / ' + structureRows.size + ' reviewed';
  }

  function persist() {
    window.VitanovaStorage.write(stateKey, {reviewed: [...reviewed], mistakes: [...mistakes]});
  }

  function highlight(code, goToMarker) {
    const {row, figureId} = structureRows.get(code);
    if (row.hidden) showAll();
    const previous = structureRows.get(activeStructure);
    previous?.row.classList.remove('is-selected');
    atlas.querySelector('.lab-pin[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
    activeStructure = code;
    row.classList.add('is-selected', 'is-revealed');
    const pin = byId('fig' + figureId).querySelector('[data-marker="' + code + '"]');
    pin?.setAttribute('aria-pressed', 'true');
    if (goToMarker && pin) {
      pin.focus({preventScroll: true});
      pin.scrollIntoView({block: 'center', inline: 'nearest'});
    } else {
      row.scrollIntoView({block: 'nearest'});
    }
  }

  function filterFigures() {
    const query = search.value.trim().toLowerCase();
    const matchingFigures = new Set();
    for (const {row, name, figureId} of structureRows.values()) {
      row.hidden = Boolean(query && !name.includes(query));
      if (!row.hidden) matchingFigures.add(figureId);
    }
    for (const figure of figures) {
      byId('fig' + figure.id).hidden = Boolean((filter && figure.k !== filter) || !matchingFigures.has(figure.id));
    }
    let visible = false;
    for (const section of atlas.children) {
      section.hidden = !section.querySelector('.lab-figure:not([hidden])');
      topics.querySelector('[href="#' + section.id + '"]').hidden = section.hidden;
      visible ||= !section.hidden;
    }
    byId('no-results').hidden = visible;
  }

  function chooseFilter(kind) {
    filter = kind;
    filters.querySelectorAll('button').forEach(control =>
      control.setAttribute('aria-pressed', String(control.dataset.filter === kind)));
    filterFigures();
  }

  function showAll() {
    search.value = '';
    chooseFilter('');
  }

  filters.addEventListener('click', event => {
    const control = event.target.closest('[data-filter]');
    if (control) chooseFilter(control.dataset.filter);
  });
  search.addEventListener('input', filterFigures);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') atlas.querySelector('.lab-figure:not([hidden]) li:not([hidden])')?.scrollIntoView({block: 'center'});
  });
  for (const container of [atlas, zoom]) {
    container.addEventListener('click', event => {
      const pin = event.target.closest('[data-marker]');
      if (!pin) return;
      if (container === zoom) zoom.close();
      highlight(pin.dataset.marker, false);
    });
  }
  zoom.addEventListener('close', () => byId('zoom-picture').replaceChildren());
  byId('test-mode').addEventListener('change', event => {
    document.body.classList.toggle('lab-self-test', event.target.checked);
    for (const {row, checkbox} of structureRows.values()) {
      row.classList.remove('is-revealed');
      checkbox.setAttribute('aria-label', event.target.checked
        ? 'Mark ' + row.id.replace('structure-', '') + ' reviewed'
        : 'Mark ' + row.querySelector('.lab-name').textContent + ' reviewed');
    }
  });
  byId('notes-toggle').addEventListener('change', event =>
    document.body.classList.toggle('lab-hide-notes', !event.target.checked));

  function shuffledOptions(options) {
    const choices = options.map((label, index) => ({label, correct: index === 0}));
    for (let index = choices.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [choices[index], choices[swap]] = [choices[swap], choices[index]];
    }
    return choices;
  }

  function updateScore() {
    byId('quiz-score').textContent = (showingMistakes ? 'Mistake review · ' : '') +
      score + ' correct · ' + answered + ' / ' + questionCount + ' answered';
  }

  function questionCard(question, index, number) {
    const prompt = element('p', {class: 'lab-prompt'}, number + '. ' + question.q);
    const feedbackStatus = element('strong');
    const feedback = element('p', {class: 'lab-feedback', hidden: '', role: 'status'}, feedbackStatus, ' ' + question.e);
    const controls = element('div');
    const layout = element('div', {class: 'lab-quiz-layout'});
    const figure = figuresById.get(question.f);
    if (figure) {
      const target = figure.m.find(marker => marker.c === question.m);
      const expand = button('Enlarge figure');
      expand.addEventListener('click', () => enlarge(figure, target));
      layout.classList.add('has-image');
      layout.append(element('div', {}, picture(figure, {study: false, target}), expand));
      const link = element('a', {href: '#fig' + figure.id}, 'Open in atlas');
      link.addEventListener('click', () => {
        showAll();
        if (target) highlight(target.c, false);
      });
      feedback.append(' ', link);
    }

    const options = shuffledOptions(question.o);
    const buttons = options.map(option => button(option.label, {class: 'o'}));
    buttons.forEach((choice, choiceIndex) => choice.addEventListener('click', () => {
      const correct = options[choiceIndex].correct;
      answered++;
      if (correct) {
        score++;
        mistakes.delete(index);
      } else {
        mistakes.add(index);
        choice.classList.add('no');
      }
      buttons.forEach((candidate, optionIndex) => {
        candidate.disabled = true;
        if (options[optionIndex].correct) candidate.classList.add('ok');
      });
      feedbackStatus.textContent = correct ? 'Correct.' : 'Incorrect.';
      feedback.hidden = false;
      updateScore();
      persist();
      window.VitanovaLabAtlas.refreshReview();
    }));
    controls.append(...buttons, feedback);
    layout.append(controls);
    return element('article', {class: 'q lab-panel', 'data-question': index}, prompt, layout);
  }

  function renderQuiz(review = showingMistakes) {
    showingMistakes = review;
    answered = score = 0;
    const cards = [];
    questions.forEach((question, index) => {
      if (!review || mistakes.has(index)) cards.push(questionCard(question, index, cards.length + 1));
    });
    questionCount = cards.length;
    quizList.replaceChildren(...cards);
    if (!cards.length) quizList.textContent = 'No mistakes left to review.';
    byId('quiz-all').hidden = !review;
    updateScore();
  }

  byId('quiz-reset').addEventListener('click', () => renderQuiz());
  byId('quiz-all').addEventListener('click', () => renderQuiz(false));

  const stored = window.VitanovaStorage.read(stateKey, {reviewed: [], mistakes: []},
    value => window.VitanovaStorage.record(value) && Array.isArray(value.reviewed) && Array.isArray(value.mistakes));
  for (const code of stored.reviewed) {
    if (!structureRows.has(code)) continue;
    reviewed.add(code);
    const {row, checkbox} = structureRows.get(code);
    checkbox.checked = true;
    row.classList.add('is-reviewed');
  }
  for (const index of stored.mistakes) {
    if (Number.isInteger(index) && index >= 0 && index < questions.length) mistakes.add(index);
  }
  updateProgress();
  renderQuiz();

  document.addEventListener('DOMContentLoaded', () => {
    window.VitanovaLabAtlas.addHeaderReview({
      count: () => mistakes.size,
      retry: () => renderQuiz(true),
      quiz: byId('quiz')
    });
    const flashcards = topics.querySelector('.vn-flashcards');
    if (flashcards) {
      flashcards.href = 'flashcards.html?lecture=mss-final-anatomy-03-04';
      flashcards.textContent = 'Related flashcards';
      flashcards.removeAttribute('aria-label');
    }
  });
})();

