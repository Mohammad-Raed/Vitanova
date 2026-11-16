/* Timestamp-based SM-2 scheduling and deck queues. */
(function (root) {
  'use strict';
  const MINUTE = 60000, DAY = 1440 * MINUTE;
  const LEARN_AHEAD = 20 * MINUTE;
  const KEY = 'vitanova_srs_v1', LEGACY_KEY = 'vitanova:flashcards:v1';
  const defaults = {
    learning: [1, 10], relearning: [10], newLimit: 20, reviewLimit: 200,
    graduating: 1, easy: 4, ease: 2.5, easyBonus: 1.3, hardMultiplier: 1.2, modifier: 1
  };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const safeKey = key => key && !['__proto__', 'constructor', 'prototype'].includes(key);
  const nonnegative = value => Number.isFinite(value) && value >= 0;
  const count = value => Number.isSafeInteger(value) && value >= 0;

  function newCard(config) {
    return {state: 'New', due: 0, interval: 0, ease: config.ease, reps: 0, lapses: 0, step: 0, lastReviewed: 0};
  }

  function scheduleCard(card, rating, now = Date.now()) {
    const config = defaults;
    if (![1, 2, 3, 4].includes(rating)) throw new RangeError('Invalid rating');
    const next = {...(card || newCard(config))};
    next.reps++;
    next.lastReviewed = now;
    const shortStep = (state, step, minutes) => ({
      ...next, state, step, due: now + Math.round(minutes * MINUTE)
    });
    const review = interval => ({...next, state: 'Review', interval, step: 0, due: now + interval * DAY});

    if (next.state === 'Review') {
      const previous = next.interval;
      if (rating === 1) {
        next.lapses++;
        next.ease = Math.max(1.3, next.ease - 0.20);
        next.interval = Math.max(1, Math.round(previous * 0.5));
        return shortStep('Relearning', 0, config.relearning[0]);
      }
      const multiplier = rating === 2 ? config.hardMultiplier : next.ease * (rating === 4 ? config.easyBonus : 1);
      if (rating === 2) next.ease = Math.max(1.3, next.ease - 0.15);
      if (rating === 4) next.ease += 0.15;
      const interval = Math.round(previous * multiplier);
      return review(Math.max(rating >= 3 ? previous + 1 : 1, interval));
    }

    const relearning = next.state === 'Relearning';
    const state = relearning ? 'Relearning' : 'Learning';
    const steps = relearning ? config.relearning : config.learning;
    const step = Math.min(next.step, steps.length - 1);
    if (rating === 1) return shortStep(state, 0, steps[0]);
    if (rating === 2) {
      return shortStep(state, step, steps[step]);
    }
    if (rating === 4) return review(relearning ? Math.max(next.interval, config.easy) : config.easy);
    if (step + 1 < steps.length) return shortStep(state, step + 1, steps[step + 1]);
    return review(relearning ? next.interval : config.graduating);
  }

  function getNextIntervals(card, now = Date.now()) {
    return [1, 2, 3, 4].map(rating => scheduleCard(card, rating, now));
  }

  function formatInterval(delay) {
    if (delay <= MINUTE) return delay < MINUTE ? '<1m' : '1m';
    if (delay < 60 * MINUTE) return Math.ceil(delay / MINUTE) + 'm';
    if (delay < DAY) return Math.round(delay / (60 * MINUTE)) + 'h';
    if (delay < 30 * DAY) return Math.round(delay / DAY) + 'd';
    if (delay < 365 * DAY) return Math.round(delay / (30 * DAY)) + 'mo';
    return Math.round(delay / (365 * DAY)) + 'y';
  }

  function dayKey(now) {
    const date = new Date(now);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
  }
  function midnight(now) {
    const date = new Date(now);
    return date.setHours(24, 0, 0, 0);
  }
  function daily(deck, now) {
    return deck.stats?.date === dayKey(now) ? deck.stats : {date: dayKey(now), new: 0, review: 0};
  }

  // Switching decks or filters still counts toward the same daily new-card limit.
  function queueFor(cards, data, now) {
    const learning = [], learningAhead = [], review = [], fresh = [];
    const budgets = new Map();
    let nextDue = Infinity;
    for (const card of cards) {
      const record = data.records[card.id];
      if (record && record.state !== 'Review') {
        if (record.due <= now) learning.push(card);
        else if (record.due <= now + LEARN_AHEAD) {
          learningAhead.push(card);
          nextDue = Math.min(nextDue, record.due);
        } else nextDue = Math.min(nextDue, record.due - LEARN_AHEAD);
      } else if (record) review.push(card);
      else fresh.push(card);
    }
    const byDue = (a, b) => data.records[a.id].due - data.records[b.id].due;
    const reviewAvailable = card => {
      if (!budgets.has(card.lecture)) {
        const stats = daily(data.decks[card.lecture] || {}, now);
        budgets.set(card.lecture, defaults.reviewLimit - stats.review);
      }
      const budget = budgets.get(card.lecture);
      if (budget > 0) {
        budgets.set(card.lecture, budget - 1);
        return true;
      }
      nextDue = Math.min(nextDue, midnight(now));
      return false;
    };
    const due = review.sort(byDue).filter(card => {
      const timestamp = data.records[card.id].due;
      if (timestamp <= now) return reviewAvailable(card);
      const deck = data.decks[card.lecture] || {};
      const budget = budgets.get(card.lecture) ?? (defaults.reviewLimit - daily(deck, now).review);
      nextDue = Math.min(nextDue, budget <= 0 ? Math.max(timestamp, midnight(now)) : timestamp);
      return false;
    });
    const studiedToday = Object.values(data.decks).reduce((total, deck) => total + daily(deck, now).new, 0);
    const available = fresh.slice(0, Math.max(0, defaults.newLimit - studiedToday));
    if (available.length < fresh.length) nextDue = Math.min(nextDue, midnight(now));
    const availableNow = [...learning.sort(byDue), ...due, ...available];
    // Learn ahead only after exhausting due steps, due reviews and new cards.
    learningAhead.sort(byDue);
    return {
      cards: availableNow.length ? availableNow : learningAhead,
      learningAhead, new: available.length, learning: learning.length + learningAhead.length,
      due: due.length, nextDue
    };
  }

  function validRecord(record) {
    return object(record) && ['Learning', 'Review', 'Relearning'].includes(record.state) &&
      nonnegative(record.due) && record.due <= 8640000000000000 &&
      nonnegative(record.lastReviewed) && count(record.interval) &&
      (record.state === 'Learning' || record.interval >= 1) &&
      Number.isFinite(record.ease) && record.ease >= 1.3 &&
      [record.reps, record.lapses, record.step].every(count);
  }

  function migrate(legacy) {
    const records = Object.create(null);
    for (const [id, old] of Object.entries(legacy?.records || {})) {
      if (!safeKey(id) || !object(old) || !nonnegative(old.due) || !nonnegative(old.lastReview)) continue;
      const delay = old.due - old.lastReview;
      const state = ({1: 'Learning', 2: 'Review', 3: 'Relearning'})[old.memory?.state] ||
        (delay >= DAY || old.interval >= 1 ? 'Review' : old.lapses > 0 ? 'Relearning' : 'Learning');
      // Older rows had the rating and due time, but no saved learning-step index.
      const step = count(old.memory?.steps) ? old.memory.steps :
        Number(state === 'Learning' && old.rating === 3 && delay >= defaults.learning[1] * MINUTE);
      const record = {
        state, due: old.due, interval: state === 'Learning' ? 0 : Math.max(1, Math.round(old.interval || 0)),
        ease: defaults.ease, reps: old.reviews, lapses: old.lapses,
        step, lastReviewed: old.lastReview
      };
      if (validRecord(record)) records[id] = record;
    }
    return records;
  }

  function load(store) {
    const data = {version: 1, records: Object.create(null), decks: Object.create(null)};
    try {
      const saved = JSON.parse(store.getItem(KEY));
      if (saved?.version === 1 && object(saved.records) && object(saved.decks)) {
        for (const [id, record] of Object.entries(saved.records)) {
          if (safeKey(id) && validRecord(record)) data.records[id] = record;
        }
        for (const [id, deck] of Object.entries(saved.decks)) {
          if (!safeKey(id) || !object(deck)) continue;
          // Keep the settings field for compatibility with existing backup files.
          data.decks[id] = {settings: defaults};
          if (typeof deck.stats?.date === 'string' && count(deck.stats.new) && count(deck.stats.review)) {
            data.decks[id].stats = deck.stats;
          }
        }
      } else {
        data.records = migrate(JSON.parse(store.getItem(LEGACY_KEY)));
      }
    } catch {
      // A malformed save or disabled storage cannot prevent studying.
    }
    return data;
  }
  function save(store, data) {
    try {
      store.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  const api = {MINUTE, DAY, KEY, defaults, daily, dayKey, scheduleCard, getNextIntervals, formatInterval, queueFor, load, save};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VitanovaSRS = api;
})(typeof window === 'undefined' ? globalThis : window);
