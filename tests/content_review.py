#!/usr/bin/env python3
"""Check content-review invariants; optionally compare an explicitly chosen Git baseline.

This checks preservation and reviewed changes, not medical correctness. Use
--abbreviations to print candidate terms for human contextual review.
"""
import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from vitanova_tools import Literal, Page, build_bank, extract, registry  # noqa: E402

DATA_ASSIGNMENT = re.compile(r'\b(?:const|let|var)\s+(QZ|Q\d*|L\d+|D)\s*=\s*(?=[\[{])')
QUIZ_SECTION = re.compile(r'(?:q\d+|qz\d+|hq|fq|quiz(?:-.*)?|mcq)')
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}


class Summary(HTMLParser):
    """Readable nonquiz text; avoid counting CSS/JavaScript/navigation as teaching text."""
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.stack, self.parts, self.ids, self.abbrs = [], [], [], []
        self.skip = 0
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'abbr':
            self.abbrs.append(attrs.get('title', '').strip())
        skip = tag in {'script','style','header','nav','footer'} or (
            tag == 'section' and bool(QUIZ_SECTION.fullmatch(attrs.get('id', ''))))
        if tag not in VOID:
            self.stack.append((tag, skip))
            self.skip += skip

    def handle_endtag(self, tag):
        positions = [index for index, item in enumerate(self.stack) if item[0] == tag]
        if positions:
            index = positions[-1]
            self.skip -= sum(item[1] for item in self.stack[index:])
            self.stack = self.stack[:index]
        if not self.skip:
            self.parts.append(' ')

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data + ' ')

    @property
    def text(self):
        return re.sub(r'\s+', ' ', ''.join(self.parts)).strip()


def non_data_code(source):
    """Mask only known literal quiz datasets, preserving all original quiz handlers."""
    scripts = []
    for script in Page(source).scripts:
        spans = []
        for match in DATA_ASSIGNMENT.finditer(script):
            literal = Literal(script, match.end())
            literal.read()
            spans.append((match.end(), literal.pos))
        for start, end in reversed(spans):
            script = script[:start] + '[REVIEWED_QUIZ_DATA]' + script[end:]
        scripts.append(script.replace('\r\n', '\n'))
    return scripts


def git_text(ref, filename):
    return subprocess.check_output(['git', 'show', f'{ref}:{filename}'], cwd=ROOT, text=True)


def candidates(text):
    tokens = re.findall(r'\b(?:[A-Z]{2,}[A-Z0-9]*|n?AChR?|RyR\d?|Vd|[A-Z]{1,4}-[A-Z0-9αβ]+)\b', text)
    common = {'MSS','AI','MCQ','MCQs','DR','OR','NOT','ONLY','NO','ALL','NEVER','LOW','HIGH','MOST','IMP'}
    return [token for token in dict.fromkeys(tokens) if token not in common and not re.fullmatch(r'[IVXLCDM]+', token)]


def check(baseline=None, abbreviations=False):
    lectures = registry(ROOT)
    bank = build_bank(ROOT)
    by_id = {question['id']: question for question in bank}
    alias_map = {}
    for question in bank:
        for alias in [question['id']] + question.get('legacyIds', []):
            if alias in alias_map and alias_map[alias] != question['id']:
                raise AssertionError(f'Ambiguous question identity: {alias}')
            alias_map[alias] = question['id']
    manifest_path = ROOT / 'study-question-migrations.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'version': 1, 'corrections': []}
    assert manifest.get('version') == 1 and isinstance(manifest.get('corrections'), list), 'Unsupported review manifest'
    corrections = {item['questionId']: item for item in manifest['corrections']}
    assert len(corrections) == len(manifest['corrections']), 'Duplicate reviewed question IDs'
    changed = []
    for lecture in lectures:
        source = (ROOT / lecture['file']).read_text()
        summary = Summary(source)
        assert summary.text, f'{lecture["id"]}: missing readable summary'
        assert not [key for key, count in Counter(summary.ids).items() if count > 1], f'{lecture["id"]}: duplicate element IDs'
        assert all(len(title.split()) >= 2 for title in summary.abbrs), f'{lecture["id"]}: abbreviation title needs a full name'
        if abbreviations:
            print(f'{lecture["id"]}: ' + ', '.join(candidates(summary.text)))
        if not baseline:
            continue
        before = git_text(baseline, lecture['file'])
        previous_summary = Summary(before)
        assert set(previous_summary.ids) <= set(summary.ids), f'{lecture["id"]}: original section or quiz anchor removed'
        assert non_data_code(before) == non_data_code(source), f'{lecture["id"]}: original non-data quiz code changed'
        previous_questions, current_questions = extract(lecture, before), extract(lecture, source)
        assert len(previous_questions) == len(current_questions), f'{lecture["id"]}: question count changed'
        fields = ('question','options','answer','explanation')
        for previous, current in zip(previous_questions, current_questions):
            assert previous['group'] == current['group'], f'{lecture["id"]}: question grouping changed'
            differences = [field for field in fields if previous[field] != current[field]]
            if not differences:
                continue
            review = corrections.get(previous['id'])
            assert review and review.get('reason', '').strip(), f'Unreviewed question edit: {previous["id"]}'
            assert review['lectureId'] == lecture['id'], f'Wrong lecture in correction: {previous["id"]}'
            assert review['contentFingerprint'] == current['id'], f'Stale reviewed content fingerprint: {previous["id"]}'
            if 'changedFields' in review:
                assert set(review['changedFields']) == set(differences), f'Incomplete changed-field review: {previous["id"]}'
            assert previous['id'] in by_id, f'Permanent question identity lost: {previous["id"]}'
            assert all(by_id[previous['id']][field] == current[field] for field in fields), f'Question bank not updated: {previous["id"]}'
            changed.append(previous['id'])
    if baseline:
        old_source = git_text(baseline, 'study-questions-data.js')
        match = re.search(r'window\.VitanovaQuestionBank\s*=\s*', old_source)
        old_bank = Literal(old_source, match.end()).read()
        for question in old_bank:
            for old_id in [question['id']] + question.get('legacyIds', []):
                assert old_id in alias_map, f'Previously saved identity no longer resolves: {old_id}'
        print(f'PASS: {len(lectures)} summaries retain original anchors and quiz handlers; {len(changed)} question edits reviewed; '
              f'all previous question identities resolve ({baseline}).')
    else:
        print(f'PASS: {len(lectures)} readable summaries; {len(bank)} unique, resolvable questions; {len(corrections)} reviewed corrections. '
              'Use --baseline REF for historical preservation checks.')
    print('Medical accuracy and contextual abbreviation definitions require human review; token presence alone is not certification.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', help='Explicit Git revision to compare; no historical dependency by default')
    parser.add_argument('--abbreviations', action='store_true', help='List candidate nonquiz terms for contextual review')
    args = parser.parse_args()
    check(args.baseline, args.abbreviations)
