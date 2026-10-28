# Immunology sessions 1–5

Split the supplied standalone.html into five independent Midterm lecture pages, following the supplied session numbering. Preserve the full explanations, summaries, slide-number mapping, missing-slide warnings and labelled extra material. The separate note-taker appendix and its 13 bonus questions live on Lecture 5; they are not presented as a sixth course lecture.

Lecture 1 replaces the original content at the same URL and permanent lecture ID, retaining the existing compatibility redirect and completion record. Its new course-introduction quiz has different questions; old question bookmarks and mistakes remain stored as unresolved references, not reassigned to unrelated questions. This deliberately replaces the old educational page rather than claiming the old content is unchanged.

Question counts: 17, 23, 20, 27, and 28 main questions, plus 13 separately labelled bonus questions on Lecture 5 (128 total). Site totals: 18 resources, 612 questions. All supplied question text, choices, correct answers and explanations are preserved; compiled question text normalizes HTML entities as usual. Other lecture questions and their aliases remain unchanged.

The original shuffled-option quiz engine is retained. Only the combined-file routing is removed; each page uses ordinary section anchors so shared question deep links work. Shared navigation, theme, bookmarks, saved revision, mistakes, manual completion, search, and backup integration use existing site scripts. New registrations were rerun to confirm idempotency.

Validation: static assets/links/JavaScript/registry checks, question-bank freshness, content consistency, and source question equality passed. Local Chromium installation failed, so full browser/layout checks are not claimed.

Focused DOM interaction checks passed for all 128 uploaded questions: shuffled answer mapping, wrong/correct answer handling, explanations, bookmark persistence, mistake tracking, reset and re-enhancement. Also checked per-lecture previous/next, theme toggle, mistake revision mastery, hub registration, manual completion, and backup export. These checks used jsdom temporarily outside the repository; no runtime dependency was added. They do not establish visual layout or real-browser coverage.
