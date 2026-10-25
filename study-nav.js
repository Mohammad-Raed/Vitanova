(function () {
  const lectures = window.VitanovaLectures || [];
  const currentFile = decodeURIComponent(window.location.pathname.split('/').pop() || '');
  const current = lectures.find((lecture) => lecture.file === currentFile);
  if (!current) return;

  if (!document.querySelector('link[href="study-shared.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'study-shared.css';
    document.head.append(stylesheet);
  }

  const ordered = lectures
    .filter((lecture) => lecture.system === current.system && lecture.exam === current.exam && lecture.subject === current.subject)
    .sort((left, right) => left.order - right.order);
  const index = ordered.findIndex((lecture) => lecture.id === current.id);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  const nav = document.createElement('div');
  nav.className = 'vn-lecture-navigation';
  nav.setAttribute('aria-label', 'Lecture navigation');

  function link(label, href, className, disabled) {
    const anchor = document.createElement('a');
    anchor.className = className;
    anchor.textContent = label;
    anchor.href = href || '#';
    if (disabled) {
      anchor.setAttribute('aria-disabled', 'true');
      anchor.tabIndex = -1;
    }
    return anchor;
  }

  const context = document.createElement('div');
  context.className = 'vn-lecture-context';
  context.setAttribute('aria-label', 'Current lecture');
  [current.system, current.exam, current.subject, current.lectureLabel].forEach((part) => {
    const item = document.createElement('span');
    item.textContent = part;
    context.append(item);
  });
  const controls = document.createElement('div');
  controls.className = 'vn-lecture-controls';
  controls.append(
    link('← Previous', previous?.file, 'vn-previous', !previous),
    link('Next →', next?.file, 'vn-next', !next)
  );
  nav.append(
    link('✦ Vitanova', 'index.html', 'vn-home', false),
    link(`← Back to ${current.subject}`, `index.html#${current.category}`, 'vn-subject', false),
    context,
    controls
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
