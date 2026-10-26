"""Dependency-free, non-executing readers for Vitanova's JS data literals."""
from pathlib import Path
from html import unescape
from html.parser import HTMLParser
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent

class LiteralError(ValueError):
    pass

class Literal:
    """Read data literals, never evaluate JavaScript or imported lecture code."""
    def __init__(self, source, start=0):
        self.source, self.pos = source, start

    def space(self):
        while self.pos < len(self.source):
            m = re.match(r'\s+|//[^\n]*(?:\n|$)|/\*[\s\S]*?\*/', self.source[self.pos:])
            if not m:
                return
            self.pos += m.end()

    def read(self):
        self.space()
        if self.pos >= len(self.source):
            raise LiteralError('Unexpected end of data')
        ch = self.source[self.pos]
        if ch in "\"'":
            return self.string()
        if ch in '[{':
            return self.collection(ch)
        m = re.match(r'-?(?:\d+(?:\.\d+)?)(?:[eE][+-]?\d+)?|true\b|false\b|null\b', self.source[self.pos:])
        if m:
            self.pos += m.end()
            return json.loads(m.group())
        raise LiteralError('Expected a data literal near ' + repr(self.source[self.pos:self.pos+40]))

    def string(self):
        quote = self.source[self.pos]
        self.pos += 1
        out = []
        escapes = {'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','0':'\0'}
        while self.pos < len(self.source):
            ch = self.source[self.pos]
            self.pos += 1
            if ch == quote:
                return ''.join(out)
            if ch == '\\':
                if self.pos >= len(self.source):
                    break
                ch = self.source[self.pos]
                self.pos += 1
                if ch in 'ux':
                    count = 4 if ch == 'u' else 2
                    token = self.source[self.pos:self.pos+count]
                    if len(token) != count or not re.fullmatch('[0-9a-fA-F]+', token):
                        raise LiteralError('Invalid string escape')
                    out.append(chr(int(token,16)))
                    self.pos += count
                elif ch == '\n':
                    continue
                elif ch == '\r':
                    if self.source[self.pos:self.pos+1] == '\n': self.pos += 1
                else:
                    out.append(escapes.get(ch,ch))
            else:
                out.append(ch)
        raise LiteralError('Unterminated string')

    def collection(self, opener):
        self.pos += 1
        closer = ']' if opener == '[' else '}'
        out = [] if opener == '[' else {}
        while True:
            self.space()
            if self.source[self.pos:self.pos+1] == closer:
                self.pos += 1
                return out
            if opener == '{':
                if self.source[self.pos:self.pos+1] and self.source[self.pos:self.pos+1] in "\"'":
                    key = self.string()
                else:
                    m = re.match(r'[A-Za-z_$][\w$]*|\d+',self.source[self.pos:])
                    if not m: raise LiteralError('Invalid object key')
                    key = m.group()
                    self.pos += m.end()
                self.space()
                if self.source[self.pos:self.pos+1] != ':': raise LiteralError('Expected colon')
                self.pos += 1
                if key in out: raise LiteralError('Duplicate object key: ' + key)
                out[key] = self.read()
            else:
                out.append(self.read())
            self.space()
            ch = self.source[self.pos:self.pos+1]
            if ch == ',': self.pos += 1
            elif ch != closer: raise LiteralError('Expected comma or closing bracket')

class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.scripts, self.links, self.ids, self.h1, self.title = [], [], set(), [], []
        self.current_script, self.capture = None, None
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'): self.ids.add(attrs['id'])
        if tag == 'script' and not attrs.get('src'): self.current_script = []
        if tag in ('h1','title'): self.capture = tag
        if tag in ('script','link','a'):
            value = attrs.get('src') if tag == 'script' else attrs.get('href')
            if value: self.links.append(value)
    def handle_endtag(self, tag):
        if tag == 'script' and self.current_script is not None:
            self.scripts.append(''.join(self.current_script)); self.current_script = None
        if tag == self.capture: self.capture = None
    def handle_data(self, data):
        if self.current_script is not None: self.current_script.append(data)
        if self.capture: getattr(self,self.capture).append(data)

class Text(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.parts=[]
    def handle_data(self,data): self.parts.append(data)

def plain(value):
    parser = Text(); parser.feed(unescape(str(value)))
    return re.sub(r'\s+', ' ', ' '.join(parser.parts)).strip()

def read_assignment(path, name):
    source = Path(path).read_text(encoding='utf-8')
    marker = re.search(r'window\.'+re.escape(name)+r'\s*=\s*',source)
    if not marker: raise LiteralError('Missing ' + name + ' in ' + str(path))
    return Literal(source,marker.end()).read()

def registry(root=ROOT):
    rows = read_assignment(root/'study-data.js','VitanovaLectures')
    if not isinstance(rows,list): raise ValueError('Lecture registry must be an array')
    seen, files = set(), set()
    for row in rows:
        for field in ('id','system','exam','subject','category','lectureLabel','title','description','file'):
            if not isinstance(row.get(field),str) or not row[field].strip(): raise ValueError('Invalid lecture field '+field)
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*',row['id']): raise ValueError('Invalid permanent lecture ID')
        if row['id'] in seen or row['file'] in files: raise ValueError('Duplicate lecture ID or filename')
        if not isinstance(row.get('order'),(int,float)) or isinstance(row['order'],bool): raise ValueError('Invalid lecture ordering')
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*',row['category']): raise ValueError('Invalid category')
        if row['exam'] not in ('Midterm','Final'): raise ValueError('Exam must be Midterm or Final')
        expected = category(row['system'],row['exam'],row['subject'])
        if row['category'] not in (expected, f"{slug(row['system'])}-past-{'mid' if row['exam']=='Midterm' else 'final'}"):
            raise ValueError('Category does not match lecture metadata: '+row['id'])
        target = (root/row['file']).resolve()
        if target.parent != root.resolve() or target.suffix.lower() != '.html': raise ValueError('Lecture must be a root HTML file')
        if not target.is_file(): raise ValueError('Missing lecture '+row['file'])
        seen.add(row['id']); files.add(row['file'])
    return rows

def slug(value):
    return re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-')

def category(system, exam, subject):
    prefix=f"{slug(system)}-{'mid' if exam=='Midterm' else 'final'}"
    return prefix if system.lower()==subject.lower() else prefix+'-'+slug(subject)

def extract(lecture, source):
    page = Page(source)
    inline = '\n'.join(page.scripts)
    pattern = re.compile(r'\b(?:const|let|var)\s+(QZ|Q\d*|L\d+|D)\s*=\s*(?=[\[{])')
    bank = []
    for match in pattern.finditer(inline):
        value = Literal(inline,match.end()).read()
        groups = value.items() if isinstance(value,dict) else [(match.group(1),value)]
        for group, rows in groups:
            if not isinstance(rows,list): raise ValueError('Unsupported MCQ group '+str(group))
            for index,row in enumerate(rows):
                if not isinstance(row,list) or len(row)!=4 or not isinstance(row[0],str) or not isinstance(row[1],list):
                    raise ValueError('Unsupported MCQ record in '+lecture['file'])
                question, options, answer, explanation = row
                if len(options)<2 or not all(isinstance(x,str) and x.strip() for x in options): raise ValueError('Invalid answer options')
                if not isinstance(answer,int) or isinstance(answer,bool) or not 0<=answer<len(options): raise ValueError('Invalid answer index')
                if not isinstance(explanation,str): raise ValueError('Invalid explanation')
                question, options, explanation = plain(question), [plain(x) for x in options], plain(explanation)
                identity = json.dumps([lecture['id'],question,sorted(options),options[answer]],ensure_ascii=False,separators=(',',':'))
                ident = lecture['id']+'-'+hashlib.sha256(identity.encode()).hexdigest()[:16]
                old = lecture['id']+'-'+hashlib.sha256((str(group)+':'+str(index)+':'+question).encode()).hexdigest()[:12]
                bank.append(dict(id=ident,lectureId=lecture['id'],group=str(group),question=question,options=options,answer=answer,explanation=explanation,legacyIds=[old]))
    if not bank:
        raise ValueError('No supported MCQs found in '+lecture['file']+'. Supported data: literal Q/QZ/Q1/L1/D arrays of [question, options, answerIndex, explanation]. No files were changed.')
    if len({x['id'] for x in bank}) != len(bank):
        raise ValueError('Identical duplicate questions need explicit distinct source IDs: '+lecture['file'])
    return bank

def build_bank(root=ROOT, lectures=None, sources=None):
    lectures = lectures if lectures is not None else registry(root)
    oldpath = root/'study-questions-data.js'
    previous = read_assignment(oldpath,'VitanovaQuestionBank') if oldpath.exists() else []
    oldbycontent = {}
    for row in previous:
        identity = (row['lectureId'],row['question'],tuple(sorted(row['options'])),row['options'][row['answer']])
        oldbycontent.setdefault(identity,set()).update([row['id']]+row.get('legacyIds',[]))
    bank = []
    for lecture in lectures:
        source = (sources or {}).get(lecture['file'])
        if source is None: source=(root/lecture['file']).read_text(encoding='utf-8')
        rows=extract(lecture,source)
        for row in rows:
            identity=(row['lectureId'],row['question'],tuple(sorted(row['options'])),row['options'][row['answer']])
            row['legacyIds']=sorted((set(row['legacyIds'])|oldbycontent.get(identity,set()))-{row['id']})
        bank.extend(rows)
    return bank

def bank_text(bank):
    return '/* Generated from original lecture MCQs. Regenerate with python3 tools/refresh_question_bank.py. */\nwindow.VitanovaQuestionBank = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n'

SHARED_SCRIPTS = ('study-data.js','study-storage.js','study-progress.js','study-bookmarks.js','study-questions-data.js','study-nav.js','study-saved.js','study-quiz-enhance.js')
SHARED_STYLES = ('study-shared.css','study-quiz.css','study-saved.css')

def integrate_shared(source):
    """Keep educational markup/inline quiz scripts intact; add shared assets once."""
    result=source
    # Remove only these exact local external assets, then insert in dependency order.
    for asset in SHARED_SCRIPTS:
        result=re.sub(r'<script\b(?=[^>]*\bsrc\s*=\s*[\"\']'+re.escape(asset)+r'[\"\'])[^>]*>\s*</script\s*>','',result,flags=re.I)
    for asset in SHARED_STYLES:
        result=re.sub(r'<link\b(?=[^>]*\bhref\s*=\s*[\"\']'+re.escape(asset)+r'[\"\'])[^>]*>','',result,flags=re.I)
        if not re.search(r'</head\s*>',result,re.I): raise ValueError('Lecture is missing </head>')
        result=re.sub(r'</head\s*>',f'<link rel="stylesheet" href="{asset}"></head>',result,count=1,flags=re.I)
    if not re.search(r'</body\s*>',result,re.I): raise ValueError('Lecture is missing </body>')
    scripts=''.join(f'<script src="{asset}"></script>' for asset in SHARED_SCRIPTS)
    return re.sub(r'</body\s*>',scripts+'</body>',result,count=1,flags=re.I)
