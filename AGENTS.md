# Working on Vitanova

Vitanova is a static HTML/CSS/JavaScript study hub hosted on GitHub Pages. Keep it usable without a backend, accounts, paid APIs, tracking, or a frontend build step.

- Use this existing checkout. Cloud tasks are already isolated; do not create a Git worktree unless requested.
- Inspect `study-data.js` (the authoritative lecture registry), `study-routes.js`, and the relevant shared scripts before changing navigation.
- Preserve lecture medical content, original questions, correct answers, explanations, and original quiz implementations. Add shared controls around them.
- Permanent lecture IDs and student storage keys are compatibility contracts. Never derive IDs from titles or filenames. Retain question aliases and unresolved bookmarks; never reset student data on upgrade.
- Add lectures with `python3 tools/add_lecture.py FILE.html`; see `docs/ADDING_LECTURES.md`. Review uncertain metadata rather than guessing. Test again after adding a new quiz template.
- Regenerate the question bank from lecture sources; do not hand-edit compiled MCQ text.
- Run `python3 tools/validate_site.py`, Python tooling tests, Node storage tests, and browser regressions described in `README.md`. Report unrun checks honestly.
- Use escaped text/DOM APIs for data and validate imported JSON. No secrets or student backups in the repository.
- Do not commit, push, or deploy until the user has reviewed the changes and authorized it.
