#!/usr/bin/env python3
"""Register one trusted HTML lecture and inherit Vitanova's shared study features."""
import argparse
import json
import re
import tempfile
from pathlib import Path
from vitanova_tools import ROOT, Page, registry, category, slug, extract, build_bank, bank_text, integrate_shared

SUBJECTS=('Anatomy','Pharmacology','Physiology','Pathology','Microbiology','Biochemistry','Immunology')

def metadata(source, filename, args):
    page=Page(source)
    body=' '.join(page.title+page.h1)
    # Classification comes from explicit flags or unambiguous filename/title words.
    combined=filename+' '+body
    def choose(flag, choices, label):
        if flag: return flag
        matches=[x for x in choices if re.search(r'(?<![a-z])'+re.escape(x)+r'(?![a-z])',combined,re.I)]
        if len(matches)!=1: raise ValueError(f'Ambiguous {label}. Supply --{label.lower()}.')
        return matches[0]
    system=choose(args.system,('MSS','Immunology'),'system')
    exam=choose(args.exam,('Midterm','Final'),'exam')
    subject=choose(args.subject,SUBJECTS,'subject')
    label=args.lectures
    if not label:
        found=re.search(r'Lectures?[- _]+(\d+(?:(?:[- _]*(?:&|–|to|-)[- _]*|[- _]+)\d+)*)',combined,re.I)
        if found: label=found.group(1)
    if not label: raise ValueError('Ambiguous lecture numbers. Supply --lectures, e.g. "13-14".')
    if not re.fullmatch(r'\d+(?:\s*(?:-|&|–|to|,)\s*\d+)*',label): raise ValueError('Invalid lecture numbers')
    numbers=[int(n) for n in re.findall(r'\d+',label)]
    if any(n<1 for n in numbers) or numbers!=sorted(set(numbers)): raise ValueError('Lecture numbers must be positive and increasing')
    title=args.title or ' '.join(page.h1).strip()
    if not title: raise ValueError('Missing lecture title. Supply --title.')
    description=args.description
    if not description:
        words=re.findall(r'[^\W_]+(?:[’\'-][^\W_]+)*',title,flags=re.U)
        description='Review '+ ' '.join(words[:6]) + ' with explanations and practice questions.'
    cat=category(system,exam,subject)
    ident=args.id or cat+'-'+'-'.join(f'{n:02}' for n in numbers)
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*',ident): raise ValueError('ID must use lowercase letters, numbers and hyphens')
    fileparts=[system,exam]+([] if subject.lower()==system.lower() else [subject])+['Lecture' if len(numbers)==1 else 'Lectures']+[str(n) for n in numbers]+['AI','Summary','MCQs']
    filename='-'.join(re.sub(r'[^A-Za-z0-9]+','-',x).strip('-') for x in fileparts)+'.html'
    separator='–' if re.search(r'[-–]|\bto\b',label) and len(numbers)==2 else ' & '
    return dict(id=ident,system=system,exam=exam,subject=subject,category=cat,lectureLabel=('Lecture ' if len(numbers)==1 else 'Lectures ')+separator.join(map(str,numbers)),order=numbers[0],title=title,description=description,file=filename,icon='📘')

def run(args, root=ROOT):
    path=Path(args.file).resolve()
    if not path.is_file() or path.suffix.lower()!='.html': raise ValueError('Input must be an existing HTML lecture')
    source=path.read_text(encoding='utf-8')
    rows=registry(root)
    existing=next((row for row in rows if (root/row['file']).resolve()==path or (args.id and row['id']==args.id)),None)
    if existing:
        row=dict(existing)
        # A registered path is updated only for shared assets, preserving source content.
        if path!=(root/row['file']).resolve() and integrate_shared(source)!=integrate_shared((root/row['file']).read_text(encoding='utf-8')):
            raise ValueError('Permanent ID already belongs to different content. No files were changed.')
    else:
        row=metadata(source,path.name,args)
        sameid=next((item for item in rows if item['id']==row['id']),None)
        if sameid:
            if integrate_shared(source)!=integrate_shared((root/sameid['file']).read_text(encoding='utf-8')):
                raise ValueError('Lecture ID collision. Use a distinct --id. No files were changed.')
            row=dict(sameid); existing=sameid
        elif (root/row['file']).exists() and (root/row['file']).resolve()!=path:
            raise ValueError('Destination filename exists. No files were changed.')
        elif any(item['file']==row['file'] for item in rows):
            raise ValueError('Filename is already registered. No files were changed.')
    output=integrate_shared(source)
    # Parse and validate before writing anything. Never execute uploaded HTML/scripts.
    questions=extract(row,output)
    from urllib.parse import urlsplit, unquote
    for link in Page(output).links:
        parts=urlsplit(link)
        if parts.scheme or parts.netloc or not parts.path: continue
        target=(root/unquote(parts.path)).resolve()
        if not target.is_relative_to(root.resolve()) or (not target.exists() and target.name!=row['file']):
            raise ValueError('Unresolved local lecture link: '+link+'. Copy its assets first. No files were changed.')
    updated=rows if existing else rows+[row]
    bank=build_bank(root,updated,{row['file']:output})
    targets={root/row['file']:output,root/'study-questions-data.js':bank_text(bank)}
    if not existing:
        targets[root/'study-data.js']='/* Permanent lecture IDs: keep IDs when renaming files or titles. */\nwindow.VitanovaLectures = '+json.dumps(updated,ensure_ascii=False,indent=2)+';\n'
    changes=[p for p,text in targets.items() if not p.exists() or p.read_text(encoding='utf-8')!=text]
    if not args.dry_run:
        # Stage all files under unique names; never remove someone else's .tmp file.
        staged={}
        originals={dest:dest.read_bytes() if dest.exists() else None for dest in changes}
        replaced=[]
        try:
            for dest in changes:
                with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=dest.parent,prefix='.vitanova-',delete=False) as stream:
                    staged[dest]=Path(stream.name)
                    stream.write(targets[dest])
            for dest,temp in staged.items():
                temp.replace(dest); replaced.append(dest)
        except OSError:
            for dest in reversed(replaced):
                if originals[dest] is None: dest.unlink()
                else: dest.write_bytes(originals[dest])
            raise
        finally:
            for temp in staged.values():
                if temp.exists(): temp.unlink()
    return row,len(questions),[str(x.relative_to(root)) for x in changes]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file')
    parser.add_argument('--system')
    parser.add_argument('--exam',choices=('Midterm','Final'))
    parser.add_argument('--subject')
    parser.add_argument('--lectures',help='A lecture number or range, e.g. 13-14')
    parser.add_argument('--title')
    parser.add_argument('--description')
    parser.add_argument('--id',help='Permanent ID; keep this through title/filename changes')
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    try:
        row,count,changes=run(args)
        print(f"{row['title']} → {row['category']} ({count} MCQs)")
        print(('Would change: ' if args.dry_run else 'Changed: ')+(', '.join(changes) or 'none (already integrated)'))
        if args.dry_run: print('Dry run: no files were changed.')
        print('Review metadata and run python3 tools/validate_site.py, then browser tests before publishing.')
    except (ValueError,OSError) as exc: parser.exit(1,f'Error: {exc}\n')
if __name__=='__main__': main()
