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
    if (!event.target.closest('[data-lab-theme]')) return;
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  }, true);

  return {
    connect(root) {
      root.querySelectorAll('.lab-atlas-card').forEach(connect);
    }
  };
})();
