#!/usr/bin/env python3
"""Validate curated source accounting and generate the static past-paper data asset."""
import argparse
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SUBJECTS={'Anatomy','Microbiology','Pathology','Pharmacology','Physiology'}
def validate(payload,transcripts):
    assert payload['version']==1 and transcripts['version']==1
    sources={s['id']:s for s in payload['sources']}
    assert len(sources)==len(payload['sources'])
    occurrences={x['id']:x for x in transcripts['occurrences']}
    assert len(occurrences)==len(transcripts['occurrences'])
    for s in sources.values():
        assert len(s['sha256'])==64
        assert all(s[k] is None or isinstance(s[k],(str,int)) and str(s[k]).strip() for k in ('batch','year')),'Batch/year must be explicit source metadata or null'
        assert {p['page'] for p in transcripts['pages'] if p['sourceId']==s['id']}==set(range(1,s['pages']+1)), 'Every source page must be accounted for'
    ids=set();accounted=[]
    for q in payload['questions']:
        assert q['id'].startswith('pp-mss-mid-') and q['id'] not in ids,'Stable IDs must be explicit and unique'
        ids.add(q['id']);assert q['subject'] in SUBJECTS
        assert q['kind']=='past-paper' and q['system']=='MSS' and q['exam']=='Midterm'
        assert q['question'].strip() and q['status'] in ('ready','review')
        assert q['provenance'] and q['editorial']['note'].strip()
        for ref in q['provenance']:
            assert ref==occurrences[ref['id']],'Original source transcription may not be silently rewritten'
            assert ref['sourceId'] in sources and 1<=ref['page']<=sources[ref['sourceId']]['pages']
            assert ref['originalText'].strip();accounted.append(ref['id'])
        if q['status']=='ready':
            assert len(q['options']) in (4,5) and len(set(q['options']))==len(q['options'])
            assert all(isinstance(o,str) and o.strip() for o in q['options'])
            assert type(q['answer']) is int and 0<=q['answer']<len(q['options'])
            assert q['explanation'].strip() and not q['editorial']['reviewReason']
        else:
            assert q['answer'] is None and q['options']==[] and q['editorial']['reviewReason'].strip()
    assert len(accounted)==len(set(accounted)) and set(accounted)==set(occurrences),'Each extracted recall must map to exactly one curated item'
    return payload

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    payload=validate(json.loads((ROOT/'data/past-papers/mss-midterm.json').read_text()),json.loads((ROOT/'data/past-papers/source-transcripts.json').read_text()))
    output='/* Generated from data/past-papers/mss-midterm.json; keep stable IDs. */\nwindow.VitanovaPastPapers = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n'
    target=ROOT/'study-past-data.js'
    if args.check:
        if not target.exists() or target.read_text()!=output:raise SystemExit('Past-paper generated data is stale; run python3 tools/build_past_papers.py')
    else:target.write_text(output)
    print(f"PASS: {len(payload['questions'])} retained source questions; {sum(q['status']=='ready' for q in payload['questions'])} scored; {sum(q['status']=='review' for q in payload['questions'])} answer-only recalls; every source occurrence accounted for.")
if __name__=='__main__':main()
