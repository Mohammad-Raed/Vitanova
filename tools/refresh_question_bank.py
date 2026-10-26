#!/usr/bin/env python3
"""Regenerate the central MCQ bank from the authoritative lecture registry."""
import argparse
from vitanova_tools import ROOT, build_bank, bank_text

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Fail if the committed bank needs refreshing; change no files')
    args=parser.parse_args()
    try:
        bank=build_bank()
        output=bank_text(bank)
        target=ROOT/'study-questions-data.js'
        if args.check:
            if not target.exists() or target.read_text(encoding='utf-8')!=output:
                raise ValueError('Question bank is stale. Run python3 tools/refresh_question_bank.py')
        else:
            target.write_text(output,encoding='utf-8')
        print(f"Validated {len(bank)} MCQs from {len({r['lectureId'] for r in bank})} lectures.")
    except (ValueError,OSError) as exc:
        parser.exit(1,f'Error: {exc}\n')
if __name__=='__main__': main()
