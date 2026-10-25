const progressStore = window.VitanovaStudyProgress;
const pageTitle = document.getElementById('page-title');
const cardsElement = document.getElementById('cards');
const countElement = document.getElementById('count');
const overviewElement = document.getElementById('dashboard-overview');
const backArea = document.getElementById('back-area');
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
  const progressElement = document.getElementById('completion-progress');
  if (completedElement) completedElement.textContent = String(completed);
  if (totalElement) totalElement.textContent = String(total);
  if (percentElement) percentElement.textContent = `${percentage}%`;
  if (progressElement) {
    progressElement.value = percentage;
    progressElement.setAttribute('aria-label', `${percentage}% complete`);
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
  pageTitle.textContent = sample ? sample.subject : view.title.split(' · ').pop();
  countElement.textContent = `${categoryLectures.length} ${categoryLectures.length === 1 ? 'lecture resource' : 'lecture resources'}`;
  overviewElement.hidden = false;
  const intro = sample
    ? `${sample.system} ${sample.exam} · ${sample.subject} study resources. Pick up where you left off, or open any lecture.`
    : `Welcome to ${view.title.split(' · ').pop()}. Study resources will appear here when they are uploaded.`;
  overviewElement.innerHTML = `<p class="dashboard-intro">${esc(intro)}</p>
    <div class="progress-summary"><div><span class="eyebrow">YOUR PROGRESS</span><h3><span id="completed-count">0</span> of <span id="total-count">0</span> resources completed</h3></div>
    <strong id="completion-percent">0%</strong></div>
    <progress id="completion-progress" max="100" value="0" aria-label="0% complete"></progress>
    <p class="progress-note">Progress is stored locally in this browser and may be lost if website data is cleared.</p>`;

  if (!categoryLectures.length) {
    cardsElement.innerHTML = '<div class="empty">No lectures uploaded yet.</div>';
    return;
  }
  cardsElement.innerHTML = categoryLectures.map((lecture) => {
    const done = progressStore.isCompleted(category, lecture.id);
    const href = encodeURI(lecture.file).replace(/#/g, '%23').replace(/\?/g, '%3F').replace(/&/g, '%26');
    return `<article class="card study-resource${done ? ' is-complete' : ''}" data-resource-id="${esc(lecture.id)}">
      <div class="resource-main"><div class="resource-kicker">${esc(lecture.lectureLabel)}</div>
      <h3><a href="${esc(href)}">${esc(lecture.title)}</a></h3><p>${esc(lecture.description)}</p>
      <a class="action" href="${esc(href)}">Open lecture →</a></div>
      <label class="completion-control"><input type="checkbox" ${done ? 'checked' : ''} aria-label="Mark ${esc(lecture.lectureLabel)} ${esc(lecture.title)} completed">
      <span>Completed</span></label><span class="resource-status">${done ? 'Completed' : 'Not completed'}</span>
    </article>`;
  }).join('');
  updateOverview(category);
}

function render() {
  const key = decodeURIComponent(location.hash.slice(1)) || 'home';
  const view = views[key] || views.home;
  pageTitle.textContent = view.title;
  backArea.innerHTML = view.parent ? `<a class="back" href="#${esc(view.parent)}">← Back</a>` : '';
  overviewElement.hidden = true;

  if (view.category) {
    renderDashboard(view, key);
    return;
  }

  const cards = view.cards.map(([title, description, to, icon, tag]) => ({ title, description, to, icon, tag }));
  countElement.textContent = `${cards.length} ${cards.length === 1 ? 'resource' : 'resources'}`;
  cardsElement.innerHTML = cards.length ? cards.map((card) => `<article class="card">
    <div class="icon">${esc(card.icon)}</div><span class="tag">${esc(card.tag)}</span><h3>${esc(card.title)}</h3>
    <p>${esc(card.description)}</p><a class="action" href="#${encodeURIComponent(card.to)}">Explore →</a></article>`).join('')
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
