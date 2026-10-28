#!/usr/bin/env python3
"""Extract PDF evidence for human curation; never invent or auto-score recalled answers."""
import argparse,hashlib,json,os,re,subprocess,tempfile
from pathlib import Path

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('pdf',type=Path);p.add_argument('--source-id',required=True);p.add_argument('--out-dir',type=Path,required=True);a=p.parse_args()
    if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',a.source_id):p.error('Use a stable lowercase source ID')
    digest=hashlib.sha256(a.pdf.read_bytes()).hexdigest();target=a.out_dir/(a.source_id+'-extraction.json')
    if target.exists():
        previous=json.loads(target.read_text())
        if previous.get('sha256')==digest:print('Already extracted this exact PDF; no files changed.');return
        p.error('Source ID already refers to another PDF. Preserve it and use a new source ID.')
    try:import fitz
    except ImportError:p.error('Maintenance-only dependency missing: install pymupdf in your development environment')
    pages=[];doc=fitz.open(a.pdf)
    with tempfile.TemporaryDirectory() as temp:
        for i,page in enumerate(doc,1):
            text=page.get_text(sort=True);method='PDF text'
            if len(text.strip())<200 and page.get_images():
                image=Path(temp)/f'page-{i}.png';page.get_pixmap(matrix=fitz.Matrix(2,2)).save(image)
                try:r=subprocess.run(['tesseract',str(image),'stdout','--psm','3'],env={**os.environ,'OMP_THREAD_LIMIT':'1'},capture_output=True,text=True,check=True)
                except (OSError,subprocess.CalledProcessError) as exc:p.error('OCR failed; install/check Tesseract. No extraction record saved. '+str(exc))
                text=r.stdout;method='OCR; needs visual verification'
            pages.append(dict(sourceId=a.source_id,page=i,method=method,text=text))
    a.out_dir.mkdir(parents=True,exist_ok=True)
    with target.open('x') as stream:json.dump(dict(sourceId=a.source_id,fileName=a.pdf.name,sha256=digest,pages=pages),stream,ensure_ascii=False,indent=2)
    print(f'Extracted {len(pages)} pages to {target}. Visually verify, identify every recall, then curate before generating practice data.')
if __name__=='__main__':main()
