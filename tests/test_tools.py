"""Tooling tests exercise source safety, stable IDs and registration repeatability."""
import argparse
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from vitanova_tools import Literal, LiteralError, ROOT, SHARED_SCRIPTS, SHARED_STYLES, registry, extract, build_bank, bank_text, integrate_shared, read_assignment
from add_lecture import run

ROW=dict(id='mss-mid-anatomy-13-14',system='MSS',exam='Midterm',subject='Anatomy',category='mss-mid-anatomy',lectureLabel='Lectures 13 & 14',order=13,title='Nerves and vessels',description='Review nerves and vessels with questions and clinical explanations.',file='MSS-Midterm-Anatomy-Lectures-13-14-AI-Summary-MCQs.html',icon='📘')
DATA=[['Which nerve?', ['Alpha','Beta'],1,'The original explanation.'],['Which vessel?', ['Artery','Vein'],0,'The original vessel explanation.']]
def lecture(data=DATA, title='Nerves and vessels', name='Q'):
    return '<!doctype html><html><head><title>MSS Midterm Anatomy Lectures 13-14</title></head><body><h1>'+title+'</h1><script>const '+name+'='+json.dumps(data)+';</script></body></html>'
def args(path,**kw):
    values=dict(file=str(path),system=None,exam=None,subject=None,lectures=None,title=None,description=None,id=None,dry_run=False)
    values.update(kw)
    return argparse.Namespace(**values)

class ExtractionTests(unittest.TestCase):
    def test_all_original_questions_and_aliases(self):
        rows=registry()
        bank=build_bank()
        self.assertTrue(rows); self.assertTrue(bank)
        self.assertEqual(len(bank),len({q['id'] for q in bank}))
        self.assertEqual(len(rows),len({q['lectureId'] for q in bank}))
        self.assertTrue(all(q['legacyIds'] for q in bank))
    def test_literal_comments_unicode_and_trailing_commas(self):
        self.assertEqual({'a':['x\n',"it's",3]},Literal("{/*ok*/a:['x\\n','it\\'s',3,],}").read())
    def test_does_not_execute_javascript(self):
        with self.assertRaises(LiteralError): Literal('[process.exit(0)]').read()
        with self.assertRaises(LiteralError): Literal('[`template`]').read()
    def test_malformed_literal_fails(self):
        for source in ('[1,2','{"x": [1, }','{x:1,x:2}','{','[','{x:'):
            with self.subTest(source=source),self.assertRaises(LiteralError): Literal(source).read()
    def test_stable_ids_after_question_reorder(self):
        a=extract(ROW,lecture()); b=extract(ROW,lecture(list(reversed(DATA))))
        self.assertEqual({q['question']:q['id'] for q in a},{q['question']:q['id'] for q in b})
    def test_stable_ids_after_title_filename_and_group_change(self):
        a=extract(ROW,lecture()); changed=dict(ROW,title='Renamed',file='renamed.html')
        b=extract(changed,lecture(title='Renamed',name='Q2'))
        self.assertEqual([q['id'] for q in a],[q['id'] for q in b])
    def test_stable_ids_when_unrelated_added(self):
        a=extract(ROW,lecture()); other=extract(dict(ROW,id='unrelated'),lecture())
        self.assertEqual([q['id'] for q in a],[q['id'] for q in a+other][:len(a)])
    def test_invalid_answers_and_unsupported_records_fail(self):
        for data in ([['Question',['A','B'],2,'why']],[['Question',['A','B']]],[]):
            with self.subTest(data=data),self.assertRaises(ValueError): extract(ROW,lecture(data))
    def test_duplicate_questions_fail_loudly(self):
        with self.assertRaises(ValueError): extract(ROW,lecture([DATA[0],DATA[0]]))
    def test_preexisting_duplicate_assets_deduplicated(self):
        source=lecture().replace('</head>','<link rel="stylesheet" href="study-quiz.css"><link rel="stylesheet" href="study-quiz.css"></head>').replace('</body>','<script src="study-nav.js"></script><script src="study-nav.js"></script></body>')
        output=integrate_shared(source)
        for asset in SHARED_SCRIPTS+SHARED_STYLES:self.assertEqual(1,output.count('"'+asset+'"'))
    def test_dependency_injection_idempotent(self):
        source=lecture()
        output=integrate_shared(source)
        self.assertEqual(output,integrate_shared(output))
        self.assertIn('<script>const Q=',output)
        for asset in SHARED_SCRIPTS+SHARED_STYLES: self.assertEqual(1,output.count('"'+asset+'"'))
        self.assertEqual(sorted(output.index('src="'+s+'"') for s in SHARED_SCRIPTS),[output.index('src="'+s+'"') for s in SHARED_SCRIPTS])

class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.root=Path(self.temp.name)/'site'; self.root.mkdir()
        (self.root/'study-data.js').write_text('window.VitanovaLectures = [];')
        for asset in SHARED_SCRIPTS+SHARED_STYLES:
            if not (self.root/asset).exists(): (self.root/asset).write_text('')
        (self.root/'study-questions-data.js').write_text('window.VitanovaQuestionBank = [];')
        self.input=Path(self.temp.name)/'MSS-Midterm-Anatomy-Lectures-13-14.html';self.input.write_text(lecture())
    def tearDown(self): self.temp.cleanup()
    def test_repeat_registration_is_noop_and_inherits_features(self):
        row,count,changes=run(args(self.input),self.root)
        self.assertEqual(2,count); self.assertEqual('mss-mid-anatomy',row['category'])
        self.assertIn('study-data.js',changes)
        self.assertTrue(all(asset in (self.root/row['file']).read_text() for asset in SHARED_SCRIPTS))
        before={p.name:p.read_bytes() for p in self.root.iterdir()}
        row,count,changes=run(args(self.input),self.root)
        self.assertEqual([],changes)
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.root.iterdir()})
        self.assertEqual(1,len(registry(self.root)))
    def test_dry_run_writes_nothing(self):
        before={p.name:p.read_bytes() for p in self.root.iterdir()}
        run(args(self.input,dry_run=True),self.root)
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.root.iterdir()})
    def test_ambiguity_blocks_without_writes(self):
        source=Path(self.temp.name)/'unknown.html';source.write_text(lecture().replace('MSS Midterm Anatomy Lectures 13-14','Nerves'))
        before={p.name:p.read_bytes() for p in self.root.iterdir()}
        with self.assertRaisesRegex(ValueError,'Ambiguous'):run(args(source),self.root)
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.root.iterdir()})
    def test_destination_collision_preserves_file(self):
        dest=self.root/ROW['file'];dest.write_text('user content')
        with self.assertRaisesRegex(ValueError,'Destination'):run(args(self.input),self.root)
        self.assertEqual('user content',dest.read_text())
    def test_existing_temporary_files_preserved(self):
        protected=self.root/'study-data.js.tmp';protected.write_text('user work')
        run(args(self.input),self.root)
        self.assertEqual('user work',protected.read_text())
    def test_contradictory_exam_words_block_without_writes(self):
        self.input.write_text(lecture(title='Final revision'))
        before=(self.root/'study-data.js').read_bytes()
        with self.assertRaisesRegex(ValueError,'Ambiguous exam'):run(args(self.input),self.root)
        self.assertEqual(before,(self.root/'study-data.js').read_bytes())
    def test_unresolved_asset_blocks_without_writes(self):
        self.input.write_text(lecture().replace('</body>','<a href="missing.html">Next</a></body>'))
        before=(self.root/'study-data.js').read_bytes()
        with self.assertRaisesRegex(ValueError,'Unresolved'):run(args(self.input),self.root)
        self.assertEqual(before,(self.root/'study-data.js').read_bytes())
    def test_aliases_survive_regeneration_and_reordering(self):
        row,_,_=run(args(self.input),self.root)
        old=build_bank(self.root)
        original=(self.root/row['file']).read_text()
        (self.root/row['file']).write_text(integrate_shared(lecture(list(reversed(DATA)))))
        regenerated=build_bank(self.root)
        byid={q['id']:q for q in old}
        for q in regenerated:
            self.assertTrue(set(byid[q['id']]['legacyIds'])<=set(q['legacyIds']))
    def test_file_metadata_can_be_renamed_without_id_change(self):
        row,_,_=run(args(self.input),self.root)
        old=build_bank(self.root)
        (self.root/row['file']).rename(self.root/'renamed.html')
        rows=read_assignment(self.root/'study-data.js','VitanovaLectures')
        rows[0]['file']='renamed.html';rows[0]['title']='New title'
        (self.root/'study-data.js').write_text('window.VitanovaLectures = '+json.dumps(rows)+';')
        self.assertEqual([q['id'] for q in old],[q['id'] for q in build_bank(self.root)])

if __name__=='__main__': unittest.main()
