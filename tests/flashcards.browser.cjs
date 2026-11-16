const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../study-srs.js');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const {KEY, MINUTE, DAY} = core;
const now = new Date(2026, 10, 16, 12).getTime();
const deck = 'mss-mid-anatomy-13';
const cards = Array.from({length: 16}, (_, i) => ({
  id: 'test-' + i, lecture: deck, topic: i ? 'Learn-ahead test' : 'First card', blanks: [], question: 'Card ' + i, answer: 'Answer ' + i
}));
const pages = {[deck]: {label: 'Lecture 13', title: 'Test deck', decks: [deck], file: 'index.html'}};
const learning = core.scheduleCard(null, 3, now);
const review = core.scheduleCard(learning, 3, now);
const order = (data, time = now) => core.queueFor(cards.slice(0, 4), data, time).cards.map(card => card.id);
const ids = cards.map(card => card.id);
const saved = new Map();
const store = {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)};
store.setItem('vitanova:flashcards:v1', JSON.stringify({version: 1, records: {[ids[0]]: {
  due: learning.due, interval: 10 * MINUTE / DAY, reviews: 1, lapses: 0, lastReview: now, rating: 3
}}}));
let history = core.load(store);
assert.equal(history.records[ids[0]].step, 1);
assert.equal(history.records[ids[0]].due, learning.due);
assert.equal(core.formatInterval(core.getNextIntervals(history.records[ids[0]], now)[2].due - now), '1d');
history.records[ids[0]] = review;
for (const days of [3, 8, 20]) {
  const previous = history.records[ids[0]];
  assert.equal(core.getNextIntervals(previous, previous.due)[2].interval, days);
  history.records[ids[0]] = core.scheduleCard(previous, 3, previous.due);
  assert(core.save(store, history));
  history = core.load(store);
  assert.equal(history.records[ids[0]].interval, days);
  assert.equal(history.records[ids[0]].ease, 2.5);
}
for (const [rating, delay, state, step, interval, ease] of [
  [2, 24 * DAY, 'Review', 0, 24, 2.35],
  [4, 65 * DAY, 'Review', 0, 65, 2.65],
  [1, 10 * MINUTE, 'Relearning', 0, 10, 2.3]
]) {
  const input = history.records[ids[0]];
  const next = core.scheduleCard(input, rating, now);
  assert.deepEqual([next.due - now, next.state, next.step, next.interval, next.ease],
    [delay, state, step, interval, ease]);
  if (rating === 1) {
    assert.equal(next.lapses, input.lapses + 1);
    assert.equal(core.scheduleCard(next, 3, next.due).interval, 10);
  }
}
const harder = core.scheduleCard(history.records[ids[0]], 2, now);
assert(core.save(store, {...history, records: {[ids[0]]: harder}}));
assert.deepEqual(core.load(store).records[ids[0]], harder);
const future = {...learning, due: now + 20 * MINUTE};
assert.deepEqual(order({records: {[ids[0]]: future, [ids[1]]: {...review, due: now},
  [ids[2]]: {...learning, due: now}}, decks: {}}), [ids[2], ids[1], ids[3]]);
const allFuture = {records: {
  [ids[0]]: future, [ids[1]]: {...review, due: now + MINUTE},
  [ids[2]]: {...learning, state: 'Relearning', interval: 1, due: now + MINUTE},
  [ids[3]]: {...learning, due: now + 21 * MINUTE}
}, decks: {}};
assert.deepEqual(order(allFuture), [ids[2], ids[0]]);
assert.deepEqual(order(allFuture, now + 1), [ids[2], ids[0]]);
assert.deepEqual(order({records: {
  [ids[0]]: {...future, due: future.due + 1},
  [ids[1]]: {...review, due: now + MINUTE},
  [ids[2]]: {...review, due: now + 2 * MINUTE},
  [ids[3]]: {...learning, due: now + 21 * MINUTE}
}, decks: {}}), []);

async function run() {
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({executablePath});
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({viewport: {width, height: 840}});
      const serveFile = route => {
        const file = new URL(route.request().url()).pathname.slice(1);
        return route.fulfill({path: path.join(root, file)});
      };
      await context.route('http://vitanova.test/**', serveFile);
      const page = await context.newPage(), errors = [];
      const logs = [];
      page.on('console', message => {
        if (message.type() === 'log' && message.text().startsWith('[Vitanova SRS]')) {
          logs.push(message.args()[1].jsonValue());
        }
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({time: now});
      const url = 'http://vitanova.test/flashcards.html?lecture=' + deck;
      await page.goto('http://vitanova.test/flashcards.html');
      const navigation = page.getByRole('navigation', {name: 'Flashcard navigation'});
      assert.equal(await navigation.getByRole('link', {name: 'Vitanova Learning Hub'}).getAttribute('href'), 'index.html');
      assert(await page.locator('#return-to-lecture').isHidden());
      await page.goto(url);
      const lectureFile = await page.evaluate(id => VitanovaCourseDeck.pages[id].file, deck);
      assert.equal(await navigation.getByRole('link', {name: 'Back to lecture'}).getAttribute('href'), lectureFile);
      await page.locator('#start-linked').click();
      await page.locator('#reveal').click();
      assert.deepEqual(await page.locator('#ratings span').allTextContents(), ['1m', '1m', '10m', '4d']);

      // Use a controlled deck to exercise every queue transition without relying on card counts in the course data.
      await context.route('**/data/flashcards/course-deck.js*', route => route.fulfill({
        body: 'window.VitanovaCourseDeck = ' + JSON.stringify({cards, pages, images: {}}),
        contentType: 'application/javascript'
      }));
      await page.goto(url);
      const q = page.locator('#question'), counts = page.locator('#counts'), progress = page.locator('#progress-text');
      const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
      const seed = async (records, total) => {
        await page.evaluate(({key, value}) => localStorage.setItem(key, JSON.stringify(value)), {
          key: KEY, value: {version: 1, records, decks: {[deck]: {settings: core.defaults,
            stats: {date: core.dayKey(now), new: total, review: 0}}}}
        });
        await page.reload();
        await page.locator('#start').click();
      };
      const grade = async (rating, target) => {
        await page.keyboard.press('Space');
        await page.locator('#ratings').waitFor();
        const labels = await page.locator('#ratings span').allTextContents();
        await page.keyboard.press(String(rating));
        await page.locator('#ratings').waitFor({state: 'hidden'});
        await page.waitForFunction(front => document.querySelector('#question').textContent === front, target);
        return labels;
      };
      await seed({}, 17);
      assert.equal(await q.textContent(), 'Card 0');
      assert.equal(await progress.textContent(), '3 cards left');
      assert.deepEqual(await grade(1, 'Card 1'), ['1m', '1m', '10m', '4d']);
      const first = (await read()).records[ids[0]];
      assert.equal(first.due - first.lastReviewed, MINUTE);
      assert.equal(await counts.textContent(), 'New 2 · Learning 1 · To Review (Due) 0');
      await grade(4, 'Card 2');
      await grade(4, 'Card 0');
      assert(await page.evaluate(() => Date.now()) < first.due);
      assert.equal(await progress.textContent(), '1 card left');
      await page.reload();
      assert.deepEqual((await read()).records[ids[0]], first);
      await page.locator('#start').click();
      assert.equal(await q.textContent(), 'Card 0');
      assert.equal((await grade(3, 'Card 0'))[2], '10m');
      const second = (await read()).records[ids[0]];
      assert.equal(second.due - second.lastReviewed, 10 * MINUTE);
      assert.equal(second.step, 1);
      await page.reload();
      assert.deepEqual((await read()).records[ids[0]], second);
      await page.locator('#start').click();
      assert.equal((await grade(3, 'Congratulations! You’ve finished for now.'))[2], '1d');
      const graduated = (await read()).records[ids[0]];
      assert.equal(graduated.due - graduated.lastReviewed, DAY);
      assert.equal(await progress.textContent(), '0 cards left');
      const firstCardLogs = (await Promise.all(logs)).filter(log => log.cardId === ids[0]);
      assert.deepEqual(firstCardLogs.map(log => [log.rating, log.old.state, log.old.step, log.next.state, log.next.step,
        log.next.interval, log.due]), [
        [1, 'New', 0, 'Learning', 0, 0, first.due],
        [3, 'Learning', 0, 'Learning', 1, 0, second.due],
        [3, 'Learning', 1, 'Review', 0, 1, graduated.due]
      ]);

      await seed(Object.fromEntries(ids.map((id, i) => [id, {...learning, due: now + MINUTE * 2 + i * 1000}])), 20);
      assert.equal(await progress.textContent(), '16 cards left');
      for (let i = 0; i < cards.length; i++) {
        assert.equal(await q.textContent(), 'Card ' + i);
        assert.equal(await counts.textContent(), 'New 0 · Learning ' + (16 - i) + ' · To Review (Due) 0');
        const next = i === 15 ? 'Congratulations! You’ve finished for now.' : 'Card ' + (i + 1);
        await grade(3, next);
      }
      assert.equal(await page.locator('#waiting, progress').count(), 0);
      await page.evaluate(({key, legacy}) => {
        localStorage.removeItem(key);
        localStorage.setItem('vitanova:flashcards:v1', legacy);
      }, {key: KEY, legacy: store.getItem('vitanova:flashcards:v1')});
      await page.reload();
      await page.locator('#topic').selectOption('First card');
      await page.locator('#start').click();
      assert.equal(await q.textContent(), 'Card 0');
      assert.deepEqual(await grade(3, 'Congratulations! You’ve finished for now.'), ['1m', '10m', '1d', '4d']);
      const migrated = (await read()).records[ids[0]];
      assert.equal(migrated.reps, 2);
      assert.equal(migrated.due - migrated.lastReviewed, DAY);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
run().then(() => console.log('Learn-ahead, queue order, saved due times, and all 16 learning cards passed on desktop and mobile'))
  .catch(error => { console.error(error); process.exitCode = 1; });
