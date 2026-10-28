# Vitanova Learning Hub

A lightweight medical revision library for GitHub Pages. The site uses static HTML, CSS, and JavaScript: no build step, account, backend, paid API, or analytics service.

## Run locally

Use Python 3.10+ to serve the existing checkout:

```sh
cd /path/to/Vitanova
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the served `index.html` in your browser. Use HTTP rather than opening files directly so all pages share one storage origin. Python 3.10+ and Node.js 20+ are also used by development checks; neither is needed by visitors.

## Study features

- Browse MSS Midterm, Final, and Past Papers, or Immunology Midterm and Final. Empty categories remain available for future material.
- Mark lectures completed manually. Opening a lecture never changes its completion status. Search by title, system, subject, lecture number, or topic, and filter by completion.
- Use **Continue studying** to return to the most recently opened lecture. Use the compact lecture bar for Home, subject, Previous/Next, Saved Questions, and mistake revision.
- Save questions from the original lecture quizzes, then revise them together on **Saved Questions**. Filter by system, subject, and lecture; shuffle or reset the current attempt.
- Incorrect answers are recorded locally. **Redo Mistakes** uses a separate revision attempt; a correct revision answer marks that mistake mastered. A later wrong answer reopens it. Original quiz resets keep their original behavior.
- Use **Back up study data** to export a JSON backup or import one. Merge keeps completed lectures and combines bookmarks; replace overwrites only data types included in the backup and asks for confirmation.

Data stays on this browser and origin; it does not sync between devices. Changing domain, browser profile, or clearing site data can make existing records unavailable. Export a backup first. Storage failures show a warning; corrupt records are retained rather than silently overwritten. Keep backups private and outside this repository.

## Architecture

| File | Responsibility |
| --- | --- |
| `study-data.js` | Single authoritative lecture registry with permanent IDs |
| `study-routes.js` | Standard hierarchy and registry-derived navigation |
| `study-hub.js`, `study-hub.css` | Portal, subject checklists, search, continuation |
| `study-nav.js`, `study-shared.css` | Shared lecture navigation, theme, responsive controls |
| `study-storage.js`, `study-progress.js` | Safe local persistence and existing completion records |
| `study-bookmarks.js` | Bookmarks, legacy ID resolution, and mistake records |
| `study-questions-data.js` | Generated MCQ bank; regenerate from lecture HTML |
| `study-quiz-enhance.js`, `study-quiz.css` | Shared controls around original quizzes |
| `study-saved.js`, `study-saved.css` | Combined saved-question and mistake revision |
| `study-backup.js` | Validated JSON import/export |
| `tools/` | Non-executing data reader, registration, regeneration, validation |

There are currently 18 lecture resources and 612 extracted questions. Counts are checked from the actual registry and sources, not hardcoded in the interface. Lecture medical content and original quiz implementations remain the source of truth.

## Add a lecture

```sh
python3 tools/add_lecture.py /path/to/NEW-LECTURE.html --dry-run
python3 tools/add_lecture.py /path/to/NEW-LECTURE.html
```

The tool reads supported quiz data without executing uploaded scripts, classifies unambiguous metadata, registers a permanent ID, adds shared assets, and regenerates the bank. If classification is ambiguous, it stops with the missing flags rather than guessing. Run it again to verify that it reports no changes. See [Adding lectures](docs/ADDING_LECTURES.md) for explicit metadata, supported quiz formats, stable IDs, and safety limits.

## Validate changes

Run these from the repository root:

```sh
python3 tools/validate_site.py
python3 tools/refresh_question_bank.py --check
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.cjs
```

The checks cover registered files and categories, local assets and redirect loops, JavaScript syntax, MCQ validity, bank freshness, stable IDs and aliases, repeated registration, unsafe inputs, and student-data import/storage behavior.

For actual browser interactions, install the development-only browser dependency outside the checkout, then run:

```sh
npm install --prefix /tmp/vitanova-browser playwright
/tmp/vitanova-browser/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/vitanova-browser/node_modules node tests/browser.cjs
```

The browser test starts and stops its own Python server on port 8765. An existing system Chromium is also supported. Set `CHROMIUM_PATH` to select its executable and `BASE_URL` to use an already running server instead. The application itself never loads Playwright or an npm dependency. GitHub Actions runs the same checks on pushes and pull requests; it does not deploy.

Browser tests exercise the original quiz templates, persistence, navigation, shared revision, backups, and mobile overflow. Automated checks do not certify the medical accuracy of lecture material or cover every browser/assistive technology. See [Audit and validation](docs/AUDIT.md) for this update's evidence and limits.

## Deployment and review

Keep `index.html`, the lecture HTML files, shared assets, and generated question bank together at the GitHub Pages site root. No bundling or generated distribution folder is required. Existing legacy HTML redirect pages are retained to preserve shared links. Shared links and navigation also work under a GitHub Pages project subpath.

Review changes and run the checks needed for the affected material before committing. The user has given standing permission to commit, push, and publish routine material uploads automatically unless they specify otherwise. Unrelated feature releases still follow their own authorized scope.

## Editorial corrections

See [the content review](docs/CONTENT_REVIEW.md). Reviewed question corrections are recorded in `study-question-migrations.json`; keep this file with the source. Regeneration uses it to retain permanent bookmark identities when question wording or answers are corrected.
