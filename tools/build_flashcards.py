#!/usr/bin/env python3
"""Import modern Anki .apkg offline; never execute source templates or scripts.
Requires maintenance-only zstandard and Pillow. Runtime is static JSON + media.
"""
import argparse, subprocess, collections, concurrent.futures, hashlib, html, io, json, re, sqlite3, tempfile, zipfile
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE_SHA='5eb595501d4f736a67a25a0f3210ebfc88fb38083493cf31438c250967abbdd0'
LABELS=['Text','Extra','Lecture Notes','Missed Questions','Pathoma','Boards and Beyond','First Aid','Sketchy','Sketchy 2','Sketchy Extra','Picmonic','Pixorize','Physeo','Bootcamp','OnlineMedEd','Additional Resources']

def varint(data,i):
    n=s=0
    while True:
        b=data[i];i+=1;n|=(b&127)<<s
        if b<128:return n,i
        s+=7
        if s>70:raise ValueError('Invalid protobuf integer')

def wire(data):
    i=0
    while i<len(data):
        key,i=varint(data,i);kind=key&7
        if kind==2:
            size,i=varint(data,i);value=data[i:i+size];i+=size
        elif kind==0:value,i=varint(data,i)
        else:raise ValueError('Unsupported media metadata wire type')
        yield key>>3,value

class SafeHTML(HTMLParser):
    tags={'b','strong','i','em','u','s','sub','sup','br','p','div','span','ul','ol','li','table','thead','tbody','tr','td','th','blockquote','hr','a','img'}
    def __init__(self,media):
        super().__init__(convert_charrefs=True);self.media=media;self.out=[];self.drop=0
    def handle_starttag(self,tag,attrs):
        if tag in {'script','style','iframe','object','svg','math'}:self.drop+=1;return
        if self.drop or tag not in self.tags:return
        attrs=dict(attrs);extra=''
        if tag=='img':
            name=html.unescape(attrs.get('src','')).split('?')[0]
            if name not in self.media:
                self.out.append('<span>[Source illustration unavailable]</span>');return
            extra=' src="'+self.media[name]+'" loading="lazy" decoding="async" alt="'+html.escape(attrs.get('alt','Study illustration'),quote=True)+'"'
        elif tag=='a':
            href=attrs.get('href','')
            if re.match(r'^https?://',href,re.I):extra=' href="'+html.escape(href,quote=True)+'" target="_blank" rel="noopener noreferrer"'
        self.out.append('<'+tag+extra+'>')
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
    def handle_endtag(self,tag):
        if tag in {'script','style','iframe','object','svg','math'}:
            self.drop=max(0,self.drop-1);return
        if not self.drop and tag in self.tags and tag not in {'img','br','hr'}:self.out.append('</'+tag+'>')
    def handle_data(self,data):
        if not self.drop:self.out.append(html.escape(data))

class MediaRefs(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.names=set()
    def handle_starttag(self,tag,attrs):
        if tag=='img':
            src=dict(attrs).get('src','')
            if src:self.names.add(src.split('?')[0])

def clean(text,media):
    p=SafeHTML(media);p.feed(text);p.close();return ''.join(p.out)

def cloze(text,ordinal,reveal=False):
    # Parse balanced clozes, including nested deletions, without evaluating Anki templates.
    out=[];i=0
    while i<len(text):
        match=re.search(r'\{\{c(\d+)::',text[i:])
        if not match:out.append(text[i:]);break
        start=i+match.start();content=i+match.end();out.append(text[i:start]);j=content;depth=1
        while j<len(text) and depth:
            if text.startswith('{{',j):depth+=1;j+=2
            elif text.startswith('}}',j):depth-=1;j+=2
            else:j+=1
        if depth:raise ValueError('Unbalanced cloze')
        body=text[content:j-2];level=0;split=None;k=0
        while k<len(body):
            if body.startswith('{{',k):level+=1;k+=2
            elif body.startswith('}}',k):level-=1;k+=2
            elif body.startswith('::',k) and level==0:split=k;break
            else:k+=1
        answer=body if split is None else body[:split];hint='' if split is None else body[split+2:]
        if int(match.group(1))==ordinal:
            out.append('<mark class="fc-answer">'+cloze(answer,ordinal,True)+'</mark>' if reveal else '<span class="fc-blank">['+(re.sub('<[^>]*>','',hint) or '…')+']</span>')
        else:out.append(cloze(answer,ordinal,reveal))
        i=j
    return ''.join(out)

def plain(s):return html.unescape(re.sub('<[^>]*>',' ',re.sub(r'\{\{c\d+::(.*?)(?:::[^{}]*)?\}\}',r'\1',s))).strip()

def subject(deck,text,tags):
    d=re.sub(r'\s+',' ',deck.lower().replace('_',' ').replace('&','and'));t=text.lower()
    if re.search(r'pharmacology|medications| drugs|nsaids|aspirin.and.celecoxib|tnf.alpha.inhib',d):return 'Pharmacology'
    if re.search(r'(?:^|::)\^systems::.*::pharmacology',tags,re.I):return 'Pharmacology'
    if re.search(r'microbiology|infectious|bacterial|viral|fungal|parasite',d):return 'Microbiology'
    if re.search(r'\b(staphylococcus|streptococcus|clostridium|corynebacterium|pseudomonas|bacillus.anthracis|cutaneous.mycos|impetigo|erysipelas|gas.gangrene|tetanus)\b',t):return 'Microbiology'
    if re.search(r'anatomy|brachial.plexus|lumbosacral.plexus|radiculopathy|wrist.and.hand|shoulder.and.elbow|nerve.injur|extremity.nerves',d):return 'Anatomy'
    if re.search(r'cell.bio|physiology|muscle.contraction|sarcomere|muscle.proprioception|skeletal.muscle.depolarization',d) and not re.search(r'pathology|disease|disorder',d):return 'Physiology'
    if re.search(r'pathology|disease|disorder|tumor|arthritis|gout|dermat|\bderm\b|rheumat|osteoporosis|fracture|vasculit|arteritis',d):return 'Pathology'
    if re.search(r'hip.and.knee|foot.and.ankle|shoulder.and.elbow|wrist.*hand|spine|skin.layers|epithelial.cell.junction',d):return 'Anatomy'
    if re.search(r'agonist|antagonist|inhibitor|treatment|drug|toxicity|adverse.effect',t):return 'Pharmacology'
    if re.search(r'reflex|spindle|sarcomere|myosin|troponin|tropomyosin|muscle.contraction|action.potential',t):return 'Physiology'
    return 'Other MSS topics'

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('archive',nargs='?');ap.add_argument('--check',action='store_true');args=ap.parse_args()
    dest=ROOT/'data/flashcards';dest.mkdir(exist_ok=True,parents=True)
    if args.check:
        catalog=json.loads((dest/'catalog.json').read_text());ids=set();notes={}
        for sub,path in catalog['subjects'].items():notes.update(json.loads((ROOT/path).read_text()))
        for card in catalog['cards']:
            assert card['id'] not in ids;ids.add(card['id']);assert card['note'] in notes
            assert card['id']=='fc-'+card['note']+'-c'+str(card['ordinal'])
            note=notes[card['note']];assert card['ordinal'] in note['ordinals']
            for face in [cloze(note['text'],card['ordinal']),cloze(note['text'],card['ordinal'],True)]:assert '{{c' not in face
        for p in dest.glob('notes-*.json'):
            for src in re.findall(r'src=\\?"([^"\\]+)',p.read_text()):assert (ROOT/src).is_file(),src
        audit=json.loads((dest/'source-map.json').read_text())
        assert {a['id'] for a in audit}==ids and len(audit)==len(ids)
        for a in reversed(audit):
            key='mss-'+hashlib.sha256(a['guid'].encode()).hexdigest()[:20]
            assert a['id'].startswith('fc-'+key+'-c')
        assert len(ids)==3323 and len(notes)==2508
        print(f'PASS: {len(ids)} stable flashcards; {len(notes)} notes; all clozes render and local media resolve');return
    import zstandard
    from PIL import Image,ImageOps,ImageSequence
    archive=Path(args.archive);checksum=hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()
    if checksum!=SOURCE_SHA:raise ValueError('Unexpected source checksum; review source before importing')
    rules=json.loads((dest/'lecture-rules.json').read_text());media_dir=ROOT/'flashcard-media';media_dir.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as z,tempfile.TemporaryDirectory() as tmp:
        db=Path(tmp)/'collection.sqlite'
        with z.open('collection.anki21b') as src,db.open('wb') as dst:zstandard.ZstdDecompressor().copy_stream(src,dst)
        con=sqlite3.connect(str(db));con.create_collation('unicase',lambda a,b:(a.casefold()>b.casefold())-(a.casefold()<b.casefold()))
        note_rows=con.execute('select id,guid,tags,flds from notes order by id').fetchall();decks=dict(con.execute('select id,name from decks'))
        source_cards=con.execute('select id,nid,did,ord from cards order by id').fetchall();source_guids={row[0]:row[1] for row in note_rows}
        used=set()
        for _,_,_,flds in note_rows:
            for field in flds.split('\x1f')[:16]:
                refs=MediaRefs();refs.feed(field);used.update(refs.names)
        entries=[]
        raw=zstandard.ZstdDecompressor().stream_reader(z.open('media')).read()
        for index,(_,entry) in enumerate(wire(raw)):
            name=dict(wire(entry))[1].decode()
            if name in used:entries.append((str(index),name))
        missing=used-{name for _,name in entries};print('Referenced media',len(used),'present',len(entries),'missing',len(missing),flush=True)
        def process(entry):
            index,name=entry;target='flashcard-media/'+hashlib.sha256(name.encode()).hexdigest()[:24]+'.webp';path=ROOT/target
            if not path.exists():
                raw=zstandard.ZstdDecompressor().stream_reader(io.BytesIO(z.read(index))).read()
                if name.lower().endswith('.svg'):
                    import xml.etree.ElementTree as ET
                    tree=ET.fromstring(raw)
                    for node in tree.iter():
                        if node.tag.split('}')[-1] in ['script','foreignObject']:raise ValueError('Unsafe SVG')
                        for attr,value in node.attrib.items():
                            if attr.lower().startswith('on') or ('href' in attr and not value.startswith(('data:image/','#'))):raise ValueError('External SVG content')
                    with tempfile.TemporaryDirectory() as svgtemp:
                        svg=Path(svgtemp)/'image.svg';png=Path(svgtemp)/'image.png';svg.write_bytes(raw)
                        subprocess.run(['inkscape',str(svg),'--export-type=png','--export-filename='+str(png)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                        raw=png.read_bytes()
                image=Image.open(io.BytesIO(raw))
                if getattr(image,'is_animated',False):
                    frames=[];durations=[]
                    for frame in ImageSequence.Iterator(image):
                        durations.append(frame.info.get('duration',100));f=frame.convert('RGBA');f.thumbnail((1600,8000),Image.Resampling.LANCZOS);frames.append(f)
                    frames[0].save(path,'WEBP',save_all=True,append_images=frames[1:],duration=durations,loop=image.info.get('loop',0),quality=82,method=4)
                    return name,target
                image=ImageOps.exif_transpose(image)
                if image.mode not in ['RGB','RGBA']:image=image.convert('RGBA' if 'transparency' in image.info else 'RGB')
                image.thumbnail((1600,8000),Image.Resampling.LANCZOS)
                image.save(path,'WEBP',quality=82,method=4)
            return name,target
        media={}
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for i,(name,path) in enumerate(pool.map(process,entries)):
                media[name]=path
                if i%250==0:print('Optimized media',i,'/',len(entries),flush=True)
        notes={};card_notes={};grouped=collections.defaultdict(dict);cards=[];counts=collections.Counter();lecture_counts=collections.Counter();audit=[]
        for nid,guid,tags,flds in note_rows:
            fields=flds.split('\x1f');key='mss-'+hashlib.sha256(guid.encode()).hexdigest()[:20];text=clean(fields[0],media)
            note={'text':text,'extra':clean(fields[1],media),'supplements':[{ 'title':LABELS[i],'html':clean(s,media)} for i,s in enumerate(fields[2:16],2) if s.strip()], 'ordinals':sorted(set(int(n) for n in re.findall(r'\{\{c(\d+)::',text))), 'oneByOne':bool(len(fields)>16 and fields[16].strip())}
            if not note['ordinals']:raise ValueError('Missing cloze '+guid)
            notes[nid]=(key,note,tags,fields[0]);card_notes[nid]=key
        for source_id,nid,did,ordinal in source_cards:
            key,note,tags,text=notes[nid];deck=decks[did].replace('\x1f',' / ');sub=subject(deck,plain(text),tags)
            hay=(deck+' '+plain(text)).lower().replace('_',' ')
            links=[lid for lid,rule in rules.items() if rule['subject']==sub and re.search(rule['pattern'],hay,re.I)]
            grouped[sub][key]=note;ident='fc-'+key+'-c'+str(ordinal+1)
            assert ordinal+1 in note['ordinals'],ident
            card={'id':ident,'note':key,'ordinal':ordinal+1,'subject':sub,'topic':deck.split(' / ')[-1].replace('_',' '),'lectures':links,'search':re.sub(r'\s+',' ',plain(text)+' '+deck.replace('_',' '))}
            cards.append(card);counts[sub]+=1;lecture_counts.update(links);audit.append({'id':ident,'sourceCardId':str(source_id),'sourceNoteId':str(nid),'guid':source_guids[nid],'deck':deck,'lectureIds':links,'mapping':'topic/content rule; related practice, not confirmed lecture coverage'})
        subjects={}
        for i,(sub,ns) in enumerate(sorted(grouped.items())):
            path='data/flashcards/notes-'+str(i)+'.json';(ROOT/path).write_text(json.dumps(ns,ensure_ascii=False,separators=(',',':')));subjects[sub]=path
        catalog={'version':1,'source':'mss-anki-source-v1','subjects':subjects,'cards':cards}
        (dest/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
        report={'sourceSHA256':checksum,'notes':len(notes),'cards':len(cards),'subjects':dict(counts),'lectureCounts':dict(lecture_counts),'unassigned':sum(not c['lectures'] for c in cards),'missingMedia':sorted(missing),'mediaFiles':len(media),'mediaBytes':sum((ROOT/p).stat().st_size for p in set(media.values())),'policy':'All source cards retained. Topic-based lecture suggestions; unmatched cards remain in central library. One-by-one cards reveal together on answer. Ratings use Vitanova intervals, not Anki/FSRS. Supplementary fields collapsed and images loaded lazily.'}
        (dest/'import-report.json').write_text(json.dumps(report,indent=2));(dest/'source-map.json').write_text(json.dumps(audit,ensure_ascii=False,separators=(',',':')))
        print(json.dumps(report,indent=2),flush=True)
if __name__=='__main__':main()
