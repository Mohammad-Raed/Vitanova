#!/usr/bin/env python3
"""Check registry, generated MCQs, local assets, redirects, and JS syntax."""
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.redirects = []
        self.ids = set()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        for key in ('href', 'src'):
            if attrs.get(key):
                self.references.append(attrs[key])
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            target = re.search(r'url\s*=\s*(.*)', attrs.get('content', ''), re.I)
            if target:
                self.redirects.append(target[1].strip(' \"\''))


def data():
    source = '''const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}}; vm.createContext(context);
for(const file of ['study-data.js','study-routes.js','study-questions-data.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{timeout:2000});
console.log(JSON.stringify({lectures:context.window.VitanovaLectures,views:context.window.VitanovaViews,bank:context.window.VitanovaQuestionBank}));'''
    return json.loads(subprocess.check_output(['node', '-e', source], cwd=ROOT, text=True))


def validate():
    errors = []
    payload = data()
    lectures, bank = payload['lectures'], payload['bank']
    views = payload['views']
    for key, view in views.items():
        seen = set()
        current = key
        while current:
            if current not in views or current in seen:
                errors.append(f'Invalid route parent chain: {key}')
                break
            seen.add(current)
            current = views[current].get('parent')
        for card in view.get('cards', []):
            if card[2] not in views:
                errors.append(f'{key}: missing card target {card[2]}')
    lecture_ids = {item['id'] for item in lectures}
    if len(lecture_ids) != len(lectures):
        errors.append('Duplicate lecture IDs')
    if len({item['file'] for item in lectures}) != len(lectures):
        errors.append('Duplicate lecture files')
    grouped = {}
    for item in lectures:
        for field in ('id', 'system', 'exam', 'subject', 'category', 'lectureLabel', 'title', 'description', 'file'):
            if not isinstance(item.get(field), str) or not item[field].strip():
                errors.append(f'{item.get("id")}: invalid {field}')
        path = ROOT / item['file']
        if not path.is_file() or not path.resolve().is_relative_to(ROOT):
            errors.append(f'Missing or unsafe lecture file: {item["file"]}')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', item['category']):
            errors.append(f'Invalid category: {item["category"]}')
        if views.get(item['category'], {}).get('category') != item['category']:
            errors.append(f'Lecture category has no dashboard route: {item["category"]}')
        if not isinstance(item.get('order'), (int, float)):
            errors.append(f'{item["id"]}: invalid lecture order')
        group = (item['system'], item['exam'], item['subject'], item['category'])
        grouped.setdefault(group, []).append(item)
        if path.is_file():
            content = path.read_text()
            for script in ('study-data.js', 'study-storage.js', 'study-bookmarks.js',
                           'study-questions-data.js', 'study-nav.js', 'study-quiz-enhance.js'):
                if len(re.findall(r'<script\b[^>]*\bsrc=[\"\']' + re.escape(script) + r'[\"\']', content)) != 1:
                    errors.append(f'{item["file"]}: expected one {script}')
    for group, items in grouped.items():
        orders = [item['order'] for item in items]
        if len(set(orders)) != len(orders):
            errors.append(f'Ambiguous lecture ordering: {group}')

    ids = set()
    aliases = {}
    counts = {key: 0 for key in lecture_ids}
    for question in bank:
        qid = question['id']
        if qid in ids:
            errors.append(f'Duplicate question ID: {qid}')
        ids.add(qid)
        if question['lectureId'] not in counts:
            errors.append(f'{qid}: unknown lecture')
        else:
            counts[question['lectureId']] += 1
        options = question.get('options')
        answer = question.get('answer')
        if (not isinstance(options, list) or len(options) < 2 or
                not all(isinstance(value, str) and value.strip() for value in options) or
                type(answer) is not int or not 0 <= answer < len(options)):
            errors.append(f'{qid}: invalid MCQ options or answer')
        if not question.get('question') or not isinstance(question.get('explanation'), str):
            errors.append(f'{qid}: invalid stem or explanation')
        for alias in question.get('legacyIds', []):
            if alias in aliases and aliases[alias] != qid:
                errors.append(f'Ambiguous question alias: {alias}')
            aliases[alias] = qid

    redirects = {}
    html_files = list(ROOT.glob('*.html'))
    for path in html_files:
        refs = References()
        refs.feed(path.read_text())
        for reference in refs.references + refs.redirects:
            url = urlsplit(reference)
            if url.scheme or url.netloc or not url.path:
                continue
            target = (path.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file():
                errors.append(f'{path.name}: broken local reference {reference}')
        if refs.redirects:
            redirects[path.name] = unquote(urlsplit(refs.redirects[0]).path)
    for start in redirects:
        seen = set()
        current = start
        while current in redirects:
            if current in seen:
                errors.append(f'Redirect loop from {start}')
                break
            seen.add(current)
            current = redirects[current]

    for path in ROOT.glob('*.js'):
        result = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
        if result.returncode:
            errors.append(result.stderr.strip())
    if errors:
        raise SystemExit('\n'.join(errors))
    print(f'PASS: {len(lectures)} lectures, {len(bank)} valid MCQs, {len(aliases)} legacy question aliases, '
          f'{len(html_files)} HTML files, {len(redirects)} redirects; local links and JavaScript syntax valid.')
    for lecture in lectures:
        print(f'  {lecture["id"]}: {counts[lecture["id"]]} MCQs')


if __name__ == '__main__':
    validate()
