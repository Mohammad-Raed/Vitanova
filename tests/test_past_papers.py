"""Accounting, editorial status and stable explicit identities for recalled papers."""
import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from build_past_papers import validate
class PastPapersTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((ROOT/'data/past-papers/mss-midterm.json').read_text())
        self.transcripts=json.loads((ROOT/'data/past-papers/source-transcripts.json').read_text())
    def test_all_source_questions_are_accounted_for_once(self):
        validate(self.data,self.transcripts)
        self.assertEqual(92,len(self.transcripts['occurrences']))
        self.assertEqual(92,len(self.data['questions']))
    def test_status_separates_practice_and_unresolved(self):
        self.assertEqual(89,sum(q['status']=='ready' for q in self.data['questions']))
        self.assertEqual(3,sum(q['status']=='review' for q in self.data['questions']))
        for q in self.data['questions']:
            if q['status']=='review':self.assertIsNone(q['answer']);self.assertFalse(q['options'])
    def test_identity_not_generated_from_wording_order_or_source_label(self):
        before={q['id'] for q in self.data['questions']}
        self.data['questions'].reverse();self.data['questions'][0]['question']='Clarified wording preserving the editorial identity'
        self.data['sources'][0]['label']='Renamed display label'
        validate(self.data,self.transcripts)
        self.assertEqual(before,{q['id'] for q in self.data['questions']})
    def test_missing_or_duplicate_source_accounting_is_rejected(self):
        for duplicate in (False,True):
            d=copy.deepcopy(self.data)
            if duplicate:d['questions'][0]['provenance'].append(d['questions'][0]['provenance'][0])
            else:d['questions'][0]['provenance'].pop()
            with self.assertRaises(AssertionError):validate(d,self.transcripts)
    def test_unresolved_answer_cannot_be_silently_promoted(self):
        q=next(q for q in self.data['questions'] if q['status']=='review');q['answer']=0
        with self.assertRaises(AssertionError):validate(self.data,self.transcripts)
    def test_invalid_practice_answer_or_choice_count_rejected(self):
        q=next(q for q in self.data['questions'] if q['status']=='ready');q['options']=q['options'][:3]
        with self.assertRaises(AssertionError):validate(self.data,self.transcripts)
    def test_source_original_text_is_immutable_in_curated_copy(self):
        self.data['questions'][0]['provenance'][0]['originalText']='Silently rewritten recall'
        with self.assertRaises(AssertionError):validate(self.data,self.transcripts)
    def test_explicit_new_metadata_allowed_without_guessing_existing(self):
        self.assertTrue(all(s['batch'] is None and s['year'] is None for s in self.data['sources']))
        self.data['sources'][0]['batch']='Explicit supplied cohort';self.data['sources'][0]['year']=2025
        validate(self.data,self.transcripts)
if __name__=='__main__':unittest.main()
