"""Reviewed corrections retain question identity without fuzzy content matching."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from vitanova_tools import bank_text, build_bank, extract

LECTURE = {'id': 'test-mid-01', 'file': 'test.html'}


def page(question='Which answer?', answer=0, explanation='Original explanation.'):
    return '<html><head></head><body><script>const Q=' + json.dumps([
        [question, ['First', 'Second'], answer, explanation]
    ]) + ';</script></body></html>'


class EditorialMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.original = extract(LECTURE, page())[0]
        (self.root / 'study-questions-data.js').write_text(bank_text([self.original]))

    def tearDown(self):
        self.temp.cleanup()

    def manifest(self, **changes):
        row = dict(lectureId=LECTURE['id'], questionId=self.original['id'],
                   contentFingerprint=extract(LECTURE, page(answer=1))[0]['id'],
                   reason='Reviewed correction of the answer.')
        row.update(changes)
        (self.root / 'study-question-migrations.json').write_text(json.dumps({'version': 1, 'corrections': [row]}))

    def build(self, source=None):
        return build_bank(self.root, [LECTURE], {'test.html': source or page(answer=1)})

    def test_corrected_answer_keeps_identity_and_old_aliases(self):
        self.manifest()
        corrected = self.build()[0]
        self.assertEqual(corrected['id'], self.original['id'])
        self.assertEqual(corrected['answer'], 1)
        self.assertTrue(set(self.original['legacyIds']).issubset(corrected['legacyIds']))
        self.assertIn(extract(LECTURE, page(answer=1))[0]['id'], corrected['legacyIds'])

    def test_regeneration_is_repeatable_after_correction(self):
        self.manifest()
        first = self.build()
        (self.root / 'study-questions-data.js').write_text(bank_text(first))
        self.assertEqual(first, self.build())

    def test_corrected_stem_requires_explicit_identity_record(self):
        source = page(question='Which answer is correct?', answer=1)
        self.manifest(contentFingerprint=extract(LECTURE, source)[0]['id'])
        self.assertEqual(self.original['id'], self.build(source)[0]['id'])

    def test_explanation_only_correction_does_not_change_identity(self):
        source = page(explanation='A more precise explanation.')
        self.manifest(contentFingerprint=self.original['id'])
        self.assertEqual(self.original['id'], self.build(source)[0]['id'])
        self.assertNotIn(self.original['id'], self.build(source)[0]['legacyIds'])

    def test_stale_fingerprint_fails_instead_of_guessing(self):
        self.manifest(contentFingerprint=LECTURE['id']+'-not-the-content')
        with self.assertRaisesRegex(ValueError, 'no longer matches'):
            self.build()

    def test_cross_lecture_identity_is_rejected(self):
        self.manifest(questionId='other-lecture-1234')
        with self.assertRaisesRegex(ValueError, 'crosses lecture'):
            self.build()

    def test_duplicate_permanent_identity_is_rejected(self):
        self.manifest()
        path = self.root / 'study-question-migrations.json'
        payload = json.loads(path.read_text())
        payload['corrections'].append(dict(payload['corrections'][0]))
        path.write_text(json.dumps(payload))
        with self.assertRaisesRegex(ValueError, 'Duplicate or ambiguous'):
            self.build()


if __name__ == '__main__':
    unittest.main()
