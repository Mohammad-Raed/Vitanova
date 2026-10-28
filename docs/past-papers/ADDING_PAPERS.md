# Current question-retention and exam-key policy

The user revised the initial brief: retain every question appearance, including duplicates and formerly unresolved recalls; use supplied past-paper answers as the scoring authority for this exam; keep routine ambiguity/editorial notes out of the main reading experience.

All **92 source appearances** are now separate entries: 31 Coronary, 31 Mid MSS, and 30 Adrenaline. No repeated question is merged or suppressed. Previously assigned IDs are retained for one occurrence; additional occurrences have explicit permanent IDs and optional duplicateOf metadata without deduplication.

**89 questions have four reconstructed choices and a supplied-key answer. Three acetabulum recalls retain “All the above” without fabricating the missing alternatives.** They appear in the default collection, can be bookmarked and reveal the recalled answer, but are excluded from numerical scoring because no valid choice set exists. The optional Answer-only recalls filter is a convenience, not the only way to see them.

Routine source/editorial notes are collapsed. Source badges remain. A supplied exam key is used as an exam convention, not asserted to be an independently verified clinical guideline. No invented key is presented as source-provided.

The original 92 transcripts, locations and PDF hashes remain unchanged. Earlier consolidation and Needs Review counts are superseded by this policy.

## Maintenance workflow

# Add another recalled paper

The workflow is static and deliberately separates source evidence from reviewed practice content. Do not register a PDF as a lecture or change lecture completion counters.

1. Preserve the PDF outside the checkout. Extract evidence with the maintenance helper:

   ```sh
   python3 tools/extract_past_papers.py /path/to/paper.pdf --source-id permanent-source-id --out-dir /tmp/vitanova-paper-evidence
   ```

   This uses development-only PyMuPDF and, for image pages, Tesseract. Neither is a site dependency. OCR is single-threaded per process to avoid resource oversubscription. Repeating the command for the same source ID and exact PDF is a no-op; a different PDF under that ID is rejected.

2. Inspect every page image and validate OCR, especially handwritten questions/answers. Distinguish the numbered recalled prompt from surrounding teaching notes. Keep an explicit record for illegible or missing items; do not count every note as a separate exam question. If numbers are missing, assign a durable source-location identifier and document it.
3. Add source metadata and page evidence to `data/past-papers/source-transcripts.json` and source metadata to `mss-midterm.json`. Retain original filename and SHA-256. Batch/year must be explicitly supported by the source; use null otherwise. Adding supplied metadata enables the corresponding filter; do not infer it from a vague filename.
4. Give each unique question a permanent opaque ID such as `pp-mss-mid-0059`; never regenerate IDs from text, order, source labels, or filenames. A corrected question retains its identity. Keep an explicit editorial before/after record for later corrections; use legacyIds if a prior published identity must be migrated.
5. Review duplicates by full intent. Keep every source occurrence separate, including repeats; use duplicateOf only as metadata. Keep similar questions separate when they test distinct facts. Every extracted occurrence must be referenced exactly once in the curated collection.
6. Put original text only in provenance. Write the student-facing stem separately. Mark reconstructed choices and substantive changes. A practice-ready item needs four or five plausible choices, one best answer, an explanation and medical editorial review. A selected source answer is not automatically correct. Use the lecture registry for course context, not as unquestionable medical evidence.
7. If uncertain, use `status: "review"`, `answer: null`, `options: []`, and an actionable `editorial.reviewReason`. These items remain visible in the default collection and shared bookmark catalog, but have no numerical score; retain an explicitly recalled answer when present. Do not supply speculative answers as verified.
8. Run:

   ```sh
   python3 tools/build_past_papers.py
   python3 tools/build_past_papers.py --check
   python3 tools/validate_site.py
   python3 -m unittest discover -s tests -p 'test_*.py'
   node --test tests/*.test.cjs
   node tests/browser.cjs
   node tests/past-papers.browser.cjs
   ```

   Fixture counts in `tests/test_past_papers.py` intentionally describe the current audit; update them with a reviewed new extraction manifest. Generated assets are reproducible; do not hand-edit `study-past-data.js`. Lecture bank regeneration remains independent.

9. Update the extraction audit and Needs Review list, inspect mobile/keyboard behavior, and obtain user review before committing, pushing or publishing.

The collection renderer and central Saved Questions share the same bookmark and mistake keys. No new storage schema is needed; the existing backup/export automatically includes the permanent paper question IDs. Resets clear attempt answers only. Filters change visible scores without deleting retained session answers; reloading starts a new attempt. Mistake revision snapshots its current unmastered set so answered questions stay visible with feedback until a new attempt is started.
