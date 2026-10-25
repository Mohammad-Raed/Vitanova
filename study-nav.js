(function () {
  const lectures = window.VitanovaLectures || [];
  const currentFile = decodeURIComponent(window.location.pathname.split('/').pop() || '');
  const current = lectures.find((lecture) => lecture.file === currentFile);
  if (!current) return;

  const ordered = lectures
    .filter((lecture) => lecture.system === current.system && lecture.exam === current.exam && lecture.subject === current.subject)
    .sort((left, right) => left.order - right.order);
  const index = ordered.findIndex((lecture) => lecture.id === current.id);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  const nav = document.createElement('div');
  nav.className = 'vn-lecture-navigation';
  nav.setAttribute('aria-label', 'Lecture navigation');

  function link(label, href, disabled) {
    const anchor = document.createElement('a');
    anchor.textContent = label;
    anchor.href = href || '#';
    if (disabled) {
      anchor.setAttribute('aria-disabled', 'true');
      anchor.tabIndex = -1;
    }
    return anchor;
  }

  nav.append(
    link('← Previous Lecture', previous?.file, !previous),
    link('← Subject Checklist', `index.html#${current.category}`, false),
    link('← Vitanova Learning Hub', 'index.html', false),
    link('Next Lecture →', next?.file, !next)
  );

  document.querySelectorAll('a[href]').forEach((anchor) => {
    const label = anchor.textContent.trim();
    if (/Vitanova Learning Hub|← Back/.test(label)) {
      const wrapper = anchor.parentElement;
      anchor.remove();
      if (wrapper && wrapper !== document.body && !wrapper.textContent.trim() && wrapper.children.length === 0) {
        wrapper.remove();
      }
    }
  });

  const insertionPoint = document.querySelector('nav, main, header');
  if (insertionPoint) insertionPoint.before(nav);
  else document.body.prepend(nav);

  const toggle = document.createElement('button');
  toggle.className = 'vn-theme-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle color theme');
  toggle.title = 'Toggle light and dark theme';
  function themeFromStorage() {
    try { return window.localStorage.getItem('vitanova:theme:v1'); } catch { return null; }
  }
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    toggle.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    try { window.localStorage.setItem('vitanova:theme:v1', theme); } catch { /* Theme still works for this page. */ }
  }
  const storedTheme = themeFromStorage();
  if (storedTheme === 'light' || storedTheme === 'dark') applyTheme(storedTheme);
  else {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    applyTheme(dark ? 'dark' : 'light');
  }
  toggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  document.body.append(toggle);
})();
