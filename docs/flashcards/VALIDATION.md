# Flashcard implementation validation

Local validation completed 2026-10-29. This report records local checks before publication; deployment status is verified separately.

- Static site links and JavaScript syntax: pass (19 lectures / 674 existing lecture MCQs).
- Lecture question-bank freshness: pass; no lecture question identities/content changed.
- Past-paper source accounting: pass (92 retained / 89 scored / 3 answer-only).
- Existing content review: pass for software checks (39 prior reviewed corrections retained).
- Flashcard source check: 3,323 unique stable GUID/cloze-based IDs, 2,508 notes, source audit accounts for every card, every cloze renders on both sides, generated image references resolve locally. IDs remain independent of catalogue iteration order.
- Python: 39 tests pass, including new importer sanitization, nested clozes and topic classification coverage.
- Node: 26 tests pass, including new scheduling, cloze/hint rendering, record validation and flashcard backup merge/legacy-backup compatibility.
- Existing lecture/hub browser regressions: 397 checks pass; all 674 lecture MCQs exercised for correct/wrong/reset/bookmark behavior and mobile overflow.
- Past-paper browser regressions: 48 checks pass.
- Flashcard browser regressions: 99 checks pass, including every imported cloze rendered, all 19 lecture links, keyboard reveal/rating, history persistence, undo (including final card), filters and search, skipped cards, collapsed setup, subject-only lazy content, deferred supplements, backup/export/import, mobile layouts, themes, handled network failure and retry, and no unexpected page errors.
- Source animation preserved: optimized WebP has 114 frames.
- Published content candidates about 680 MB, including optimized source media; no file approaches GitHub's 100 MB per-file Git limit. Ordinary lectures do not fetch catalogue/media.
- Diff whitespace check: pass.

Screenshots (local, ignored test artifacts): `test-results/flashcards-desktop.png`, `test-results/flashcards-mobile.png`.

## Limits of verification

This validates implementation and extraction, not comprehensive medical correctness or exact Anki scheduling parity. Lecture assignments are topic-based suggestions, not individually verified course coverage. No cross-device synchronization or original Anki review-history import is provided. Image conversion is lossy; full-size exported images remain accessible in a new tab, with originals in the source release. Three missing/inaccessible source illustrations are explicitly listed in the import report and shown as unavailable. External AnkiHub URLs were inaccessible (403). No public deployment checks have been performed for this feature.

## Lecture-bar and continuation update

The Flashcards link now follows the final quiz/MCQ tab in each of the 19 lecture section bars. A navigation fallback is retained for new layouts without quiz tabs.

Additional browser coverage uses a controlled 40-card lecture pool with the actual source note content: two 20-card sets cover all 40 identities without duplication, including a skipped card and a Repeat card that becomes due before continuation. Tests cover draft filter changes, a final partial set, later-set Undo, next-lecture order/context/return links, completion actions on mobile, end-of-subject behavior, and next lectures with no eligible due cards. No browser page errors occurred.

Repeat/Hard/Good/Easy now save exact 1-minute/6-minute/10-minute/2-day intervals for new ratings. Deterministic unit tests cover both new and previously reviewed cards, including review/lapse history preservation. Existing stored due dates are not rewritten automatically. Saved IDs, backup formats, lecture content and question banks are unchanged.

Current complete local result: **544 browser checks (397 lecture/hub + 48 past papers + 99 flashcards) and 65 unit tests (39 Python + 26 Node)** pass, with source freshness/accounting and static checks passing.
