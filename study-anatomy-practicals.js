/* Checklist data stays on this browser, independent of lecture completion. */
(() => {
  const key = document.body.dataset.studyChecklist;
  if (!key) return;
  const checks = [...document.querySelectorAll('[data-anat-item]')];
  const rows = checks.map(box => box.closest('li'));
  const details = [...document.querySelectorAll('.anat-key')];
  const markers = [...document.querySelectorAll('.anat-marker')];
  const progress = document.getElementById('anat-progress');
  const status = document.getElementById('anat-status');
  const filter = document.getElementById('anat-filter');
  const selfTest = document.getElementById('anat-self-test');
  const storage = window.VitanovaStorage;
  const record = storage?.read(key, []);
  const known = new Set(checks.map(box => box.dataset.anatItem));
  const selected = new Set(Array.isArray(record) ? record.filter(id => known.has(id)) : []);
  function update() {
    progress.max = checks.length; progress.value = selected.size;
    status.textContent = selected.size + ' / ' + checks.length + ' reviewed';
  }
  checks.forEach(box => {
    const id = box.dataset.anatItem;
    box.checked = selected.has(id);
    box.addEventListener('change', () => {
      if (box.checked) selected.add(id); else selected.delete(id);
      storage?.write(key, [...selected]); update();
    });
  });
  function search() {
    const query = filter.value.trim().toLowerCase();
    rows.forEach(row => row.hidden = query !== '' && !row.textContent.toLowerCase().includes(query));
    details.forEach(panel => {
      const visible = !!panel.querySelector('li:not([hidden])');
      panel.hidden = !visible;
      if (query && visible) panel.open = true;
    });
    document.querySelectorAll('.anat-main section:not(#quiz)').forEach(section => {
      section.hidden = query !== '' && !section.querySelector('li:not([hidden])');
    });
  }
  filter.addEventListener('input', search);
  selfTest.addEventListener('change', () => {
    filter.value = ''; search(); filter.disabled = selfTest.checked;
    details.forEach(panel => panel.open = !selfTest.checked);
    rows.forEach(row => row.classList.remove('is-target'));
    markers.forEach(marker => marker.setAttribute('aria-pressed', 'false'));
  });
  markers.forEach(marker => marker.addEventListener('click', () => {
    const row = document.getElementById(marker.dataset.reveal);
    if (!row) return;
    filter.value = ''; search();
    rows.forEach(item => item.classList.toggle('is-target', item === row));
    markers.forEach(item => item.setAttribute('aria-pressed', String(item === marker)));
    row.closest('details').open = true;
    row.querySelector('input').focus({preventScroll:true});
    row.scrollIntoView({block:'nearest'});
  }));
  update();
})();
