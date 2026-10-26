# Vitanova audit and review notes

## Source and baseline

The Git checkout was inspected before changes. It had 10 permanent lecture registry entries, the portal/subject hierarchy, original interactive quizzes, manual completion storage, shared navigation, and legacy redirect pages. It did **not** contain the Saved Questions scripts or compiled bank. Those features were present in the supplied upgrade ZIP, so they were integrated and refined rather than treated as already deployed repository features.

The actual source contains **378 MCQs in 10 lectures**:

| Lecture resource | MCQs |
| --- | ---: |
| MSS Anatomy 1–2 | 30 |
| MSS Anatomy 3–4 | 32 |
| MSS Anatomy 5–6 | 32 |
| MSS Anatomy 7–8 | 32 |
| MSS Anatomy 9–10 | 40 |
| MSS Anatomy 11–12 | 30 |
| MSS Pharmacology 1–3 | 45 |
| MSS Physiology 1–3 | 50 |
| MSS Pathology 1–3 | 72 |
| Immunology 1 | 15 |

A Chromium baseline against an isolated copy of Git HEAD confirmed that the lecture quizzes render all 378 questions. Representative original correct/wrong feedback, explanations, and resets worked. The Pathology page overflowed to 409px at a 390px viewport. No original medical content needed correction.

## Confirmed problems addressed

- The upload's question IDs included array positions. Reordering questions could orphan bookmarks. IDs now fingerprint permanent lecture identity and question content; all 378 supplied legacy IDs remain resolvable aliases.
- The upload's enhancer could match a question by stem alone after an option mismatch. Matching now requires a compatible complete option set, and shuffled choices map back to the original answer safely.
- The upload's mutation observer responded to its own control updates. It now reacts to added question elements and coalesces enhancement work.
- Failed storage writes could lose subsequent temporary edits when the next read returned stale persisted data. Session state is retained and can be exported. Corrupt original records are preserved with a visible warning.
- Unavailable question IDs were silently absent from the upload's revision view. They are now retained and reported rather than deleted.
- Pathology's mobile timeline text overflowed. Shared responsive rules fix its layout while leaving wide medical tables independently scrollable and keyboard focusable.
- Shared navigation now uses explicit subject links, encoded file URLs, disabled boundary controls, and category-aware Previous/Next. Original lecture section navigation remains intact.

## New and refined capabilities

- A consistent purple/lavender/teal portal, compact internal headings and breadcrumbs, readable subject rows, category counters, and responsive revision controls.
- Global lecture search and manual-completion filters, plus compact continuation of the most recently opened lecture/anchor without automatic completion.
- Saved-question revision across lectures with system, subject, and lecture filters, shuffling, separate attempt answers/scores, original explanations, source links, and bookmark removal.
- Persistent mistake tracking, a dedicated mistake collection, and inline lecture mistake revision. Correct mistake-revision answers mark mastery; native resets and scoring remain independent.
- Validated JSON backup export and merge/replace import, replacement confirmation, prototype-property rejection, unknown-ID retention, and rollback when an import write fails.
- One-command registration, non-executing literal extraction, collision/ambiguity checks, idempotent shared asset insertion, bank regeneration, and registry-derived future categories.
- Focus indicators, answer/removal focus management, accessible empty states, storage warnings, reduced-motion support, and a compact back-to-top control.

## Content and compatibility evidence

All 10 educational HTML bodies and their original inline quiz scripts were compared with Git HEAD. Only shared external script/style references changed. No lecture was removed or renamed. All 10 legacy redirects still resolve without loops.

All 378 generated question stems, option sequences, correct answer indexes, and explanations were compared with the supplied upgrade bank and match. Every supplied old question ID resolves through the new aliases. The existing `vitanova:progress:v1` and `vitanova:bookmarks:v1` keys remain supported. Unknown student IDs stay in storage and backups.

## Validation

Results from the current cloud checkout are recorded below. Re-run the commands in `README.md` after later edits.

- Static validation: 10 lectures, 378 valid MCQs, 378 historical aliases, 21 HTML files, 10 redirects; registry categories, local file references, redirect loops, script multiplicity, and JavaScript syntax checked.
- Bank regeneration freshness: passed without changing the generated output.
- Python tooling tests: 20 passed. Coverage includes stable IDs under reorder/rename/unrelated additions, legacy aliases, supported extraction, unsafe or malformed inputs, repeated registration, duplicate assets, collisions, ambiguous metadata, dry runs, and temporary-file preservation.
- Node tests: 21 passed across storage, backup, and registry-derived routes. Coverage includes persistence, unchecking completion, aliases and missing IDs, corrupt/unavailable storage, temporary edits, mastery, safe imports, merge/replace semantics, and rollback.
- Chromium browser regression: **258 checks passed**, exercising every original question with both a correct and an incorrect answer (378 of each), original scores and resets, bookmark persistence through reset/reload, all hub routes, search/completion independence, Previous/Next, saved filters/shuffle/removal, mistake mastery, backup download/invalid rejection/merge/cancelled and confirmed replacement, aliases, missing IDs, and damaged/unavailable storage. Mobile hub and all lecture pages were checked at 390px; no page JavaScript errors, console errors, or failed local HTTP requests were observed.
- New-lecture integration: an isolated synthetic lecture was registered with the actual CLI helper, loaded in Chromium under a project-style subpath, and checked for inherited navigation ordering, bookmarks, completion, mistake revision, search, and dashboard counts. Temporary fixture files were removed afterward.
- Desktop and mobile portal, subject, and revision screenshots were inspected. `git -c core.whitespace=cr-at-eol diff --check` passed, preserving the existing CRLF line endings in Anatomy 7–8. CI configuration was added, but has not run on GitHub.

## Limits and deferred work

- The registration tool supports the current literal quiz formats and `.q`/`button.o` layouts. A substantially different lecture implementation needs an extractor/adapter and browser tests. It fails on unsupported extraction rather than pretending every future HTML document is compatible.
- Ambiguous lecture classification needs explicit metadata flags. Past-paper registration needs reviewed registry metadata; the CLI currently classifies Midterm/Final summary lectures.
- Student data remains local to one browser origin. There is no account or sync service. Browser-cleared data cannot be recovered without a backup. Corrupt original records may require manual recovery; the site retains those raw records and can export temporary session state separately.
- Medical accuracy was not independently reviewed; educational wording, answers, and explanations were intentionally preserved.
- Automated Chromium checks cannot replace manual Safari/Firefox, screen-reader, physical-device, or visual contrast testing. Hosted GitHub Pages behavior and GitHub Actions execution have not been observed because nothing was pushed or deployed.
- No commit, push, deployment, or environment publication was performed. Review the working tree and documentation before authorizing those steps.
