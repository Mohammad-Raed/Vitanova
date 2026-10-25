const progressStore = window.VitanovaStudyProgress;
const pageTitle = document.getElementById('page-title');
const cardsElement = document.getElementById('cards');
const countElement = document.getElementById('count');
const overviewElement = document.getElementById('dashboard-overview');
const subtitleElement = document.getElementById('page-subtitle');
const siteHeader = document.getElementById('site-header');
const heroContent = document.getElementById('hero-content');
const compactHeader = document.getElementById('compact-header');
const breadcrumbs = document.getElementById('breadcrumbs');
const hubMain = document.getElementById('hub-main');
const lectures = window.VitanovaLectures || [];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  button.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
  try { window.localStorage.setItem('vitanova:theme:v1', theme); } catch { /* Theme still works for this page. */ }
}

function renderThemeButton() {
  const button = document.createElement('button');
  button.className = 'vn-theme-toggle';
  button.type = 'button';
  button.title = 'Toggle light and dark theme';
  button.setAttribute('aria-label', button.title);
  let theme;
  try { theme = window.localStorage.getItem('vitanova:theme:v1'); } catch { theme = null; }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme, button);
  button.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', button));
  document.body.append(button);
}

function updateOverview(category) {
  const categoryLectures = lectures.filter((lecture) => lecture.category === category);
  const completed = categoryLectures.filter((lecture) => progressStore.isCompleted(category, lecture.id)).length;
  const total = categoryLectures.length;
  const percentage = total ? Math.round(completed / total * 100) : 0;
  const completedElement = document.getElementById('completed-count');
  const totalElement = document.getElementById('total-count');
  const percentElement = document.getElementById('completion-percent');
  const summaryElement = document.getElementById('progress-count');
  const progressElement = document.getElementById('completion-progress');
  if (completedElement) completedElement.textContent = String(completed);
  if (totalElement) totalElement.textContent = String(total);
  if (percentElement) percentElement.textContent = `${percentage}%`;
  if (summaryElement) summaryElement.textContent = `${completed} of ${total} ${total === 1 ? 'lecture resource' : 'lecture resources'} completed`;
  if (progressElement) {
    progressElement.value = percentage;
    progressElement.setAttribute('aria-label', `${percentage}% complete`);
    progressElement.setAttribute('aria-valuenow', String(percentage));
  }
  categoryLectures.forEach((lecture) => {
    const row = document.querySelector(`[data-resource-id="${CSS.escape(lecture.id)}"]`);
    if (!row) return;
    const done = progressStore.isCompleted(category, lecture.id);
    row.classList.toggle('is-complete', done);
    const status = row.querySelector('.resource-status');
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (status) status.textContent = done ? 'Completed' : 'Not completed';
    if (checkbox) checkbox.checked = done;
  });
}

function renderDashboard(view, key) {
  const category = view.category;
  const categoryLectures = lectures
    .filter((lecture) => lecture.category === category)
    .sort((left, right) => left.order - right.order);
  const sample = categoryLectures[0];
  pageTitle.textContent = sample ? sample.subject : emptyCategoryTitle(key, view);
  subtitleElement.textContent = sample
    ? `${sample.system} ${sample.exam} · ${sample.subject} lecture resources.`
    : 'No lectures uploaded yet. Resources will appear here when added.';
  countElement.textContent = `${categoryLectures.length} ${categoryLectures.length === 1 ? 'lecture resource' : 'lecture resources'}`;
  overviewElement.hidden = categoryLectures.length === 0;
  overviewElement.innerHTML = `<div class="progress-topline"><div><span class="eyebrow">YOUR PROGRESS</span><p id="progress-count">0 of 0 lecture resources completed</p></div>
    <strong id="completion-percent">0%</strong></div>
    <progress id="completion-progress" max="100" value="0" aria-label="0% complete" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></progress>
    <p class="progress-note">Progress saved on this device</p>`;

  if (!categoryLectures.length) {
    cardsElement.innerHTML = '<div class="empty">No lectures uploaded yet.</div>';
    return;
  }
  cardsElement.innerHTML = categoryLectures.map((lecture) => {
    const done = progressStore.isCompleted(category, lecture.id);
    const href = encodeURI(lecture.file).replace(/#/g, '%23').replace(/\?/g, '%3F').replace(/&/g, '%26');
    return `<article class="study-resource${done ? ' is-complete' : ''}" data-resource-id="${esc(lecture.id)}">
      <label class="completion-control"><input type="checkbox" ${done ? 'checked' : ''} aria-label="Mark ${esc(lecture.lectureLabel)} ${esc(lecture.title)} completed"><span class="checkmark" aria-hidden="true"></span></label>
      <div class="resource-main"><div class="resource-meta"><span class="resource-kicker">${esc(lecture.lectureLabel)}</span><span class="resource-status" aria-live="polite">${done ? 'Completed' : 'Not completed'}</span></div>
      <h3><a href="${esc(href)}">${esc(lecture.title)}</a></h3><p>${esc(lecture.description)}</p></div>
      <a class="resource-open" href="${esc(href)}">Open <span aria-hidden="true">→</span></a>
    </article>`;
  }).join('');
  updateOverview(category);
}

function emptyCategoryTitle(key, view) {
  if (key.startsWith('immunology-')) return 'Immunology';
  return view.title.split(' · ').pop();
}

function breadcrumbLabel(key) {
  if (key === 'home') return 'Vitanova';
  if (key === 'mss') return 'MSS';
  if (key === 'mss-mid') return 'Midterm';
  if (key === 'mss-final') return 'Final';
  if (key === 'mss-past') return 'Past Papers';
  if (key === 'mss-past-mid') return 'Midterm';
  if (key === 'mss-past-final') return 'Final';
  if (key === 'immunology') return 'Immunology';
  if (key === 'immunology-mid') return 'Midterm';
  if (key === 'immunology-final') return 'Final';
  const lecture = lectures.find((item) => item.category === views[key]?.category);
  return lecture?.subject || views[key]?.title.split(' · ').pop() || key;
}

function renderBreadcrumbs(key) {
  const chain = [];
  let current = key;
  while (current && views[current]) {
    chain.unshift(current);
    current = views[current].parent;
  }
  breadcrumbs.innerHTML = chain.map((route, index) => {
    const currentPage = index === chain.length - 1;
    return `${index ? '<span class="breadcrumb-separator" aria-hidden="true">/</span>' : ''}<a href="#${encodeURIComponent(route)}"${currentPage ? ' aria-current="page"' : ''}>${esc(breadcrumbLabel(route))}</a>`;
  }).join('');
}

function render() {
  const requestedKey = decodeURIComponent(location.hash.slice(1)) || 'home';
  const key = views[requestedKey] ? requestedKey : 'home';
  const view = views[key];
  const isHome = key === 'home';
  siteHeader.classList.toggle('is-home', isHome);
  siteHeader.classList.toggle('is-internal', !isHome);
  heroContent.hidden = !isHome;
  compactHeader.hidden = isHome;
  hubMain.classList.toggle('is-dashboard', Boolean(view.category));
  renderBreadcrumbs(key);
  pageTitle.textContent = view.title;
  subtitleElement.textContent = view.subtitle || '';
  overviewElement.hidden = true;

  if (view.category) {
    renderDashboard(view, key);
    return;
  }

  const cards = view.cards.map(([title, description, to, icon, tag]) => ({ title, description, to, icon, tag }));
  countElement.textContent = `${cards.length} ${cards.length === 1 ? 'resource' : 'resources'}`;
  cardsElement.innerHTML = cards.length ? cards.map((card) => {
    const targetView = views[card.to];
    const targetLectures = targetView?.category ? lectures.filter((lecture) => lecture.category === targetView.category) : [];
    const completed = targetLectures.filter((lecture) => progressStore.isCompleted(targetView.category, lecture.id)).length;
    const completion = targetView?.category && targetLectures.length
      ? `<span class="category-progress">${completed}/${targetLectures.length} completed</span>` : '';
    return `<article class="card category-card">
    <div class="icon">${esc(card.icon)}</div><span class="tag">${esc(card.tag)}</span><h3>${esc(card.title)}</h3>
    <p>${esc(card.description)}</p>${completion}<a class="action" href="#${encodeURIComponent(card.to)}">Explore →</a></article>`;
  }).join('')
    : '<div class="empty">No resources uploaded here yet.</div>';
}

cardsElement.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  const row = checkbox?.closest('[data-resource-id]');
  if (!checkbox || !row) return;
  const key = decodeURIComponent(location.hash.slice(1)) || 'home';
  const category = views[key]?.category;
  if (!category) return;
  const saved = progressStore.setCompleted(category, row.dataset.resourceId, checkbox.checked);
  updateOverview(category);
  let notice = document.getElementById('progress-save-notice');
  if (!saved) {
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'progress-save-notice';
      notice.className = 'progress-note storage-warning';
      overviewElement.append(notice);
    }
    notice.textContent = 'This browser could not save progress. The change may not persist after leaving this page.';
  } else if (notice) {
    notice.remove();
  }
});

window.addEventListener('hashchange', render);
render();
renderThemeButton();
