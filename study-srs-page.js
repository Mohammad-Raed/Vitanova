/* Connect the existing flashcard view to the live study queue. */
(() => {
'use strict';
const {cards, images, pages} = window.VitanovaCourseDeck;
const byId = id => document.getElementById(id);
const core = window.VitanovaSRS;
const store = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value)
};
let data = core.load(store), storageFailed = false;
let savedVersion = storageVersion();
let selection = [], current = null, options = null, lastCard = null;
let active = false, revealed = false, timer;
const request = new URLSearchParams(location.search).get('lecture');
const linked = Object.hasOwn(pages, request) ? pages[request] : null;
const linkedOption = '@page';
const lecture = byId('lecture'), topic = byId('topic'), exam = byId('exam'), origin = byId('origin');
const lectureNames = ['Musculoskeletal development','Limb development','Gluteal region and thigh','Knee joint','Lumbar plexus','Thigh compartments','Sacral plexus and lower-limb nerves','Anterior and lateral leg','Posterior leg, popliteal fossa and foot','Lower-limb blood supply','Lower-limb nerve injuries'];
const materials = {
  ...{"mss-mid-anatomy-01-02": "Anatomy · Lectures 1 & 2 · Skull & TMJ", "mss-mid-anatomy-03-04": "Anatomy · Lectures 3 & 4 · Vertebral Column", "mss-mid-anatomy-05-06": "Anatomy · Lectures 5 & 6 · Upper Limb Bones & Joints", "mss-mid-anatomy-07-08": "Anatomy · Lectures 7 & 8 · Upper Limb Joints & Back Muscles", "mss-mid-anatomy-09-10": "Anatomy · Lectures 9 & 10 · Arm, Cubital Fossa & Brachial Plexus", "mss-mid-anatomy-11-12": "Anatomy · Lectures 11 & 12 · The Hand & The Forearm", "mss-mid-pharmacology-01-03": "Pharmacology · Lectures 1–3 · Psoriasis, Anti-Rheumatoid Drugs & Muscle Relaxants", "mss-mid-physiology-01-03": "Physiology · Lectures 1–3 · Muscle Physiology & Touch", "mss-mid-pathology-01-03": "Pathology · Lectures 1–3 · Skeletal Muscle, Bone Disease & Arthritis", "immunology-mid-01": "Immunology · Lecture 1 · Course Introduction", "mss-mid-microbiology-01-02": "Microbiology · Lectures 1 & 2 · Skin Infections & Anaerobes", "mss-mid-physiology-04": "Physiology · Lecture 4 · Somatic Reflexes", "mss-mid-anatomy-14-15": "Anatomy · Lectures 14 & 15 · Lower Limb Bones & Hip, SI and Foot Joints", "mss-mid-anatomy-13": "Anatomy · Lecture 13 · Nerve Injuries of the Upper Limb", "immunology-mid-02": "Immunology · Lecture 2 · Immunity Overview", "immunology-mid-03": "Immunology · Lecture 3 · Barriers & Microbial Sensing", "immunology-mid-04": "Immunology · Lecture 4 · Phagocytes & Inflammation", "immunology-mid-05": "Immunology · Lecture 5 · Innate Cells & Introduction to Adaptive Immunity", "mss-mid-physiology-03-04-full": "Physiology · Lectures 3–4 · Sensory Receptors, Touch and Spinal Reflexes — Full Explanation", "immunology-mid-06": "Immunology · Lecture 6 · Adaptive Immunity: From Recognition to Memory", "immunology-mid-07": "Immunology · Lecture 7 · Organisation, Lymph & Lymph Nodes", "immunology-mid-08": "Immunology · Lecture 8 · Spleen, MALT & Clinical Lymphatics"},
  phys1:'Physiology 1 · Reflexes and locomotion', pharm1:'Pharmacology 1 · Acne treatment',
  pharm2:'Pharmacology 2 · Hair growth and reduction',
  path2:'Pathology 2 · Skin tumours', path3:'Pathology 3 · Bone and soft tissue tumours',
  path1:'Pathology 1 · Inflammatory skin disease', micro1:'Microbiology 1 · Skin viruses',
  micro2:'Microbiology 2 · Skin parasites', micro3:'Microbiology 3 · Fungal skin infections',
  bio1:'Biochemistry 1 · Muscle metabolism', bio2:'Biochemistry 2 · Bone biochemistry',
  anatlab1:'Anatomy Lab 1 · Skull', anatlab2:'Anatomy Lab 2 · Back and spine',
  anatlab3:'Anatomy Lab 3 · Shoulder and axilla', pathlab1:'Pathology Lab 1',
  microlab1:'Microbiology Lab 1'
};
const anatomyGroup = document.createElement('optgroup'), midGroup = document.createElement('optgroup');
midGroup.label = 'Midterm lectures';
anatomyGroup.label = 'Anatomy lectures';
lectureNames.forEach((name,i) => anatomyGroup.append(new Option((i+1)+' · '+name,String(i+1))));
const lectureGroup = document.createElement('optgroup'), labGroup = document.createElement('optgroup');
lectureGroup.label = 'Other Final lectures';
labGroup.label = 'Practical labs';
Object.entries(materials).forEach(([id,name]) => (id.includes('-mid-') ? midGroup : id.includes('lab') ? labGroup : lectureGroup).append(new Option(name,id)));
function inExam(card) { return !exam.value || (exam.value === 'mid') === card.lecture.includes('-mid-'); }
function materialsForExam() {
  lecture.replaceChildren(new Option('All in this exam',''));
  if (exam.value !== 'final') lecture.append(midGroup);
  if (exam.value !== 'mid') lecture.append(anatomyGroup, lectureGroup, labGroup);
  if (linked && (!exam.value || (exam.value === 'mid') === request.includes('-mid-'))) {
    lecture.add(new Option(linked.label + ' · ' + linked.title, linkedOption), 1);
  }
  topics();
}
function inLecture(card) {
  return lecture.value === linkedOption ? linked.decks.includes(card.lecture) : !lecture.value || card.lecture === lecture.value;
}

const buttons = ['Again', 'Hard', 'Good', 'Easy'].map((name, index) => {
  const button = document.createElement('button'), interval = document.createElement('span');
  button.type = 'button';
  button.append(name, interval);
  button.onclick = () => rate(index + 1);
  byId('ratings').append(button);
  return interval;
});
const historyFor = card => data.records[card.id];
function persist() {
  storageFailed = !core.save(store, data);
  if (!storageFailed) savedVersion = storageVersion();
}
function storageVersion() {
  try { return store.getItem(core.KEY); } catch { return null; }
}
function sync() {
  const version = storageVersion();
  if (version === savedVersion) return;
  const previous = current && historyFor(current);
  data = core.load(store);
  savedVersion = version;
  if (current && JSON.stringify(previous) !== JSON.stringify(historyFor(current))) {
    current = options = null;
    revealed = false;
  }
  tick(true);
}
// Serialize writes across tabs where the browser supports origin-wide locks.
function change(action) {
  const run = () => { sync(); action(); };
  if (navigator.locks) navigator.locks.request(core.KEY, run);
  else run();
}
function topics() {
  topic.replaceChildren(new Option('All topics', ''));
  for (const name of new Set(cards.filter(card => inExam(card) && inLecture(card)).map(card => card.topic))) {
    topic.add(new Option(name, name));
  }
}
function overview() {
  selection = cards.filter(card => inExam(card) && inLecture(card) && (!topic.value || card.topic === topic.value) &&
    (!origin.value || Boolean(card.anking) === (origin.value === 'anking')));
  byId('reset').disabled = !selection.length;
  byId('reset-status').textContent = '';
  active = false;
  current = options = lastCard = null;
  revealed = false;
  byId('study').hidden = true;
  tick();
}
function start() {
  active = true;
  byId('study').hidden = false;
  tick(true);
}
function render(card) {
  const source = card ? (materials[card.lecture] || 'Anatomy ' + card.lecture) + ' · ' + card.topic + (card.pages ? ' · PDF pp. ' + card.pages : '') : '';
  byId('source').textContent = source;
  if (card?.anking) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'AnKing';
    byId('source').append(badge);
  }
  const heading = byId('question');
  heading.textContent = card?.question ?? '';
  if (card?.blanks.length) {
    heading.replaceChildren();
    card.question.split('[…]').forEach((part, index) => {
      if (index) {
        const blank = document.createElement('span');
        blank.className = 'cloze';
        blank.textContent = revealed ? card.blanks[index - 1] : '[…]';
        heading.append(blank);
      }
      heading.append(part);
    });
  }
  byId('answer').textContent = card?.answer ?? '';
  byId('answer').hidden = !revealed || !card?.answer;
  byId('ratings').hidden = !card || !revealed;
  byId('reveal').hidden = !card || revealed;
  byId('shortcut').hidden = !card;
  const figure = byId('figure');
  figure.hidden = !card?.image || !(card.imageOnFront || revealed);
  if (!figure.hidden) {
    const image = byId('image');
    image.src = images[card.image];
    image.alt = (card.caption || 'Original slide figure') + ' for ' + card.topic;
    byId('image-caption').textContent = (card.caption || 'Original slide figure') + ' · Open full size';
    figure.href = images[card.image];
  }

}
function tick(focus = false) {
  clearTimeout(timer);
  const now = Date.now();
  const queue = core.queueFor(selection, data, now);
  byId('counts').textContent = 'New ' + queue.new + ' · Learning ' + queue.learning + ' · To Review (Due) ' + queue.due;
  byId('start').disabled = !selection.length;
  if (active) {
    const previous = current;
    // Keep an early learning card already on screen if another card becomes due.
    if (current && !queue.cards.includes(current) && !queue.learningAhead.includes(current)) {
      current = options = null;
      revealed = false;
    }
    if (!current) current = queue.cards.find(card => card.id !== lastCard) || queue.cards[0] || null;
    if (previous !== current || focus) render(current);
    const remaining = queue.cards.length + Number(Boolean(current && !queue.cards.includes(current)));
    byId('progress-text').textContent = remaining + (remaining === 1 ? ' card left' : ' cards left')
      + (storageFailed ? ' · Progress available for this session only' : '');
    const heading = byId('question');
    if (!current) {
      heading.textContent = selection.length ? 'Congratulations! You’ve finished for now.' : 'No cards match this set';
    }
    if (focus) heading.focus({preventScroll:true});
  }
  // Rebuild from timestamps after background throttling or a day rollover.
  timer = setTimeout(tick, Math.max(1, Math.min(15000, queue.nextDue - now)));
}
function reveal() {
  if (!current || revealed) return;
  const now = Date.now();
  options = core.getNextIntervals(historyFor(current), now);
  buttons.forEach((label, index) => label.textContent = core.formatInterval(options[index].due - now));
  revealed = true;
  render(current);
  byId('question').focus({preventScroll:true});
}
function rate(rating) {
  if (!current || !revealed) return;
  const requested = options;
  change(() => {
    if (options === requested) applyRating(rating);
  });
}
function applyRating(rating) {
  const now = Date.now(), card = current;
  // Check eligibility again in case a different tab answered it or the limits changed.
  const queue = core.queueFor(selection, data, now);
  if (!queue.cards.includes(card) && !queue.learningAhead.includes(card)) return tick(true);
  const previous = historyFor(card), previousDeck = data.decks[card.lecture];
  const deck = {...previousDeck, settings: core.defaults};
  const stats = {...core.daily(deck, now)};
  if (!previous) stats.new++;
  else if (previous.state === 'Review') stats.review++;
  deck.stats = stats;
  const next = core.scheduleCard(previous, rating, now);
  data.records[card.id] = next;
  data.decks[card.lecture] = deck;
  persist();
  // Temporary trace for verifying that the same card advances between rounds.
  console.log('[Vitanova SRS]', {
    cardId: card.id, rating,
    old: {state: previous?.state ?? 'New', step: previous?.step ?? 0, interval: previous?.interval ?? 0},
    next: {state: next.state, step: next.step, interval: next.interval},
    due: next.due
  });
  lastCard = card.id;
  current = options = null;
  revealed = false;
  tick(true);
}
byId('reset').onclick = () => {
  const ids = new Set(selection.map(card => card.lecture));
  if (!ids.size || !confirm('Reset flashcard progress and daily counts for ' + ids.size +
      (ids.size === 1 ? ' deck?' : ' decks?'))) return;
  change(() => {
    for (const card of cards) if (ids.has(card.lecture)) delete data.records[card.id];
    for (const id of ids) delete data.decks[id];
    persist();
    overview();
    byId('reset-status').textContent = storageFailed ? 'Progress reset for this session only.' : 'Deck progress reset.';
  });
};
lecture.onchange = () => { topics(); overview(); };
topic.onchange = overview;
origin.onchange = overview;
exam.onchange = () => { materialsForExam(); overview(); };
byId('start').onclick = start;
byId('reveal').onclick = reveal;
window.addEventListener('focus', () => { sync(); tick(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { sync(); tick(); } });
window.addEventListener('storage', event => {
  if (event.key === core.KEY || event.key === null) sync();
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.repeat || event.target.closest('select,a,input,textarea,summary,[contenteditable]')) return;
  if (event.ctrlKey || event.metaKey || !active || !current) return;
  if (event.code === 'Space' && !revealed) {
    if (event.target.closest('button')) return;
    event.preventDefault();
    reveal();
  } else if (/^[1-4]$/.test(event.key) && revealed) {
    event.preventDefault();
    rate(Number(event.key));
  }
});
if (linked) {
  const back = byId('return-to-lecture'), button = byId('start-linked');
  back.href = linked.file;
  back.hidden = false;
  button.hidden = false;
  button.textContent = 'Study ' + linked.label;
  button.onclick = () => { openLinked(); start(); };
  openLinked();
} else {
  materialsForExam();
  overview();
}
function openLinked() {
  exam.value = request.includes('-mid-') ? 'mid' : 'final';
  materialsForExam();
  lecture.value = linkedOption;
  origin.value = '';
  topics();
  overview();
}
})();
