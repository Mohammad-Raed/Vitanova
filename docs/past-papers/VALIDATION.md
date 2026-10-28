# Local validation results

The user explicitly authorized publication after reviewing the question-retention policy. Newer Immunology material on remote main was preserved before publication.

## Passed checks

- `python3 tools/build_past_papers.py --check`: generated asset matches the curated data; all 92 source occurrences are accounted for exactly once across 92 separate source appearances (89 MCQs, 3 answer-only recalls).
- `python3 tools/validate_site.py`: unchanged 18-lecture/612-question bank, 652 historical aliases, local assets, JavaScript syntax and redirects valid.
- `python3 tools/refresh_question_bank.py --check`: lecture bank remains unchanged and current.
- `python3 -m unittest discover -s tests -p 'test_*.py'`: **35 passed**, including 8 new past-paper data tests.
- `node --test tests/*.test.cjs`: **21 passed**.
- `node tests/browser.cjs`: **382 passed**, preserving the existing lecture and revision workflows; every current lecture question exercised with correct/incorrect answers.
- `node tests/past-papers.browser.cjs`: **40 passed**, covering scored/answer-only separation with all recalls visible, original provenance, multiple subjects, source/search filtering, answer retention, shuffling, reset versus persistent records, shared mistakes/mastery, central bookmarks, backup merge/replace, deep links, mobile overflow and unexpected runtime/local HTTP errors. The existing missing `/favicon.ico` request is excluded from runtime-error accounting, consistently with the original suite.
- Text-PDF extraction and an image-page OCR smoke test executed successfully; repeating extraction of the same exact source was a no-op.
- `git -c core.whitespace=cr-at-eol diff --check`: passed.
- Desktop/mobile screenshots inspected; captures are in ignored `test-results/past-papers-{desktop,mobile}.png`.

## Diagnosed and fixed during verification

- A question deep-link initially lost focus to the hub heading on hash navigation. The hub now lets the past-paper renderer retain question focus for that route.
- Initial OCR suffered thread oversubscription. Evidence was reprocessed with one OpenMP thread per OCR process.
- Shared bank consumers needed explicit past-paper metadata instead of fake lecture entries. The catalog supplies revision metadata without adding completion resources.

## Limits

The 89 scored items follow the supplied recalled-paper keys for exam preparation. Medical evidence and inaccessible references are documented in `EDITORIAL_REVIEW.md`. Three “All the above” recalls without choices remain visible, revealable and bookmarkable but have no numerical grade. Software checks cannot certify their medical accuracy.

Safari/Firefox, screen-reader and physical-device testing were not performed. Publication and GitHub workflow status are verified separately when pushing the authorized update. The CI definition now includes the new generator check and browser suite for a future authorized push.
