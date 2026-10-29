# MSS flashcards

## Student experience

Open **Flashcards** in the hub sidebar, or **Flashcards** beside the last quiz tab in every registered lecture's section navigation (with a shared-navigation fallback for new layouts). A lecture link preselects its related set and includes a return link. An unrelated or empty lecture (including immunology) displays zero matches, with access to the full MSS library; it does not silently substitute an unrelated set.

Choose subject, lecture, text/topic search, review mode, shuffle and session size. **All lecture topics — exclude additional material** includes only cards assigned to at least one registered lecture (currently 1,935 cards), while still respecting subject/search/review filters. It excludes unmapped cards, not optional explanation fields within included cards. Topic assignments remain suggestions rather than an exact syllabus guarantee. Starting a session collapses settings. Changing choices does not replace the active queue until **Start new session**. Filters match all search words. All cards, including those outside current lectures, remain accessible centrally.

Reveal before rating. Space reveals; keys 1–4 rate Repeat/Hard/Good/Easy while a card or rating control has focus. Inputs and links retain their normal keyboard behavior. Skip does not write progress. Undo restores the most recent rating, including the last card in a completed session. New session/reload clears the transient queue/undo history, not saved review records.

After finishing a set, **Continue next N cards** advances through the original selected pool without repeating cards already shown in that series, including skipped cards or earlier Repeat cards that have become due. The final set may be smaller. Changing draft filters does not change this pool. Undo is available within the current set and resets when continuing to a new set.

For a specific lecture, **Next lecture** starts the next registered resource with mapped flashcards in the same subject/category/order. It keeps review mode, set size and shuffle, resets topic search, selects the next subject/lecture, and updates the return link and URL. Resources with no mapped cards are skipped. If the next lecture has no eligible cards in the current review mode, show its settings and a clear empty-state explanation instead of silently changing review modes. No Next lecture button appears for mixed/all-lecture sessions or after the last available resource.

Due + new prioritizes overdue cards before new cards. Repeat = 1 minute; Hard = 6 minutes; Good = 10 minutes; Easy = 2 days. These fixed intervals apply to each new rating, including previously reviewed cards. Repeat adds a lapse. Existing saved due dates remain unchanged until the student rates that card again. This is a transparent Vitanova schedule, **not Anki scheduling or FSRS**, and there is no Anki synchronization. Free practice also updates scheduling. Shared cards have one history across lecture sets. All deletions remain explicit backup replacement operations; no study records are cleared by changing settings.

## Source and integrity

- Release: https://github.com/Mohammad-Raed/Vitanova/releases/tag/mss-anki-source-v1
- Asset: `Musculoskeletal.apkg`, 995,714,038 bytes.
- SHA-256: `5eb595501d4f736a67a25a0f3210ebfc88fb38083493cf31438c250967abbdd0` (verified).
- 2,508 source notes; **3,323 separate cloze cards**, all retained. Source review history is not imported.
- `data/flashcards/source-map.json` records source card/note IDs, original note GUIDs, source decks and suggested lecture IDs.
- Card identity uses a hash of the original note GUID plus cloze ordinal, independent of wording, filenames, order, lecture mapping and source deck labels.
- `data/flashcards/lecture-rules.json` makes lecture mappings explicit and repeatable. Mappings use subject plus source topic/text, allow multiple lectures, and are **suggestions, not a claim of exact course coverage**. They have not all been individually medically reviewed. 1,388 cards remain unassigned to current lectures and available centrally.
- Subject counts, missing source references and mapping counts are in `data/flashcards/import-report.json`.
- Source HTML is sanitized at import and again on display. Original template JavaScript, external images, inline styles and handlers are not executed. Links are restricted to HTTP(S); images use local hashed filenames. Original field labels and attribution links are retained.
- 39 notes use a custom one-by-one source field. This implementation reveals all blanks for a cloze together; it does not execute that add-on behavior. Nested clozes and hints are supported.
- Source educational text and answers are preserved; no new medical accuracy certification is implied.

## Media

6,070 referenced media assets are included locally, approximately **668 MB**, down from about 993 MB of bundled media. All referenced supplementary fields are retained behind collapsed sections. Main card media loads when displayed, extra images after answer reveal, supplementary media only when expanded. No browser downloads the .apkg. Notes are fetched by subject only when needed; the catalogue contains metadata and searchable text.

Images use WebP, width capped at 1,600 pixels and height at 8,000 to preserve tall diagrams. The animated source is retained as animated WebP. One SVG is validated and rasterized; no SVG code is published. Images open at full exported size in a separate tab. This is lossy optimization, not byte-identical source media; originals remain in the source release.

Three illustrations cannot be recovered from this export: `Heberden's and Bouchard's_1566160514431.jpg` is not bundled, and two external AnkiHub S3 URLs return a network access denial (403). They are listed in the import report and replaced by **Source illustration unavailable**, not guessed replacements. Medical text and the cards remain accessible.

The published asset footprint is below GitHub Pages' 1 GB site limit, but future decks require a fresh size review. Reviewers should expect a large first source checkout. Ordinary lecture pages load none of this content or media.

## Files and regeneration

- `flashcards.html`, `study-flashcards.css`, `study-flashcards.js`: UI, lazy content and session behavior.
- `study-flashcard-core.js`: deterministic cloze renderer, scheduling and record validation.
- `study-nav.js`, `index.html`, `study-shared.css`: shared navigation links.
- `study-backup.js`: existing backup extended with optional `flashcards` records; old backups still work.
- `data/flashcards/catalog.json`: generated card catalogue.
- `data/flashcards/notes-*.json`: generated sanitized note content by subject.
- `flashcard-media/`: optimized local media.
- `tools/build_flashcards.py`: offline conversion; requires Python `zstandard`, Pillow and Inkscape for the source SVG. Validation uses the standard library only.

The original archive and decoded read-only inspection database are outside the repository at `/workspace/anki-source/`. Never commit the .apkg, decoded database, user schedules or source review logs.

To reproduce this source:

```sh
python3 tools/build_flashcards.py /path/to/Musculoskeletal.apkg
python3 tools/build_flashcards.py --check
node tests/flashcards.browser.cjs
```

For another source release, first inspect its checksum, package format, note types and media. The importer deliberately accepts only this reviewed checksum and expected card/note counts; adapt those checks and mappings for a reviewed replacement. Preserve GUID-based IDs. Changing media conversion settings requires rebuilding the media cache (remove only generated media, then regenerate before validation); cached assets are otherwise reused. Never renumber cards or reset browser records during an update.

## Persistence and compatibility

`vitanova:flashcards:v1` stores `{version:1, records:{[cardId]:{due,interval,reviews,lapses,lastReview,rating}}}`. Only review metadata is persisted. Shared `VitanovaStorage` provides corrupt-data preservation, temporary failed writes, warnings and cross-tab invalidation. Existing unknown card IDs are preserved for future recovery.

The existing version-1 Vitanova backup now optionally includes `flashcards`. Merge chooses the most recent complete schedule per card; replace overwrites only included fields. Old backups omit this field and leave flashcard progress unchanged. Import validation, rollback and recovery export remain shared. There is no new backup flow or competing MCQ bookmark/mistake system. Lecture completion remains manual and unchanged.
