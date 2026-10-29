import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from build_flashcards import clean,cloze,subject
class FlashcardImportTests(unittest.TestCase):
 def test_sanitizer_strips_active_content_and_external_images(self):
  result=clean('<script>alert(1)</script><b onclick="bad()">Recall</b><img src="x.png"><img src="https://bad/image"><a href="javascript:bad()">no</a>',{'x.png':'flashcard-media/abc.webp'})
  self.assertNotIn('script',result);self.assertNotIn('onclick',result);self.assertNotIn('https://bad',result);self.assertIn('flashcard-media/abc.webp',result);self.assertNotIn('javascript',result)
 def test_cloze_preserves_multiple_ordinals_and_hints(self):
  s='{{c1::Ia::fibre}} {{c2::stretch}} {{c1::afferent}}'
  self.assertEqual(cloze(s,1),'<span class="fc-blank">[fibre]</span> stretch <span class="fc-blank">[…]</span>')
  self.assertIn('Ia',cloze(s,1,True));self.assertNotIn('{{',cloze(s,1,True))
 def test_nested_cloze(self):
  self.assertEqual(cloze('{{c1::outer {{c2::inner}}}}',2),'outer <span class="fc-blank">[…]</span>')
  with self.assertRaises(ValueError):cloze('{{c1::broken',1)
 def test_subject_assignment_prefers_explicit_deck(self):
  self.assertEqual(subject('MSS / Pharmacology / Gout Medications','drug inhibits uric acid',''),'Pharmacology')
  self.assertEqual(subject('MSS / Brachial Plexus','Erb palsy',''),'Anatomy')
  self.assertEqual(subject('MSS / Cell Bio / Skeletal Muscle','actin',''),'Physiology')
