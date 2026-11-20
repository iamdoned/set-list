#!/usr/bin/env python3
"""
Start a new show from the template and add it to the archive.

usage: python3 tools/new_show.py 2026-12-24-xmas "크리스마스 공연" --event 오픈마이크 --theme midnight
"""
import argparse, json, shutil, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('slug', help='folder name, e.g. 2026-12-24-xmas (starts with the date)')
ap.add_argument('title'); ap.add_argument('--event', default='오픈마이크'); ap.add_argument('--theme', default='paper')
o = ap.parse_args()
dst = root / 'shows' / o.slug
if dst.exists(): raise SystemExit(f'{dst} already exists')
shutil.copytree(root / 'templates' / 'new-show', dst)
date = o.slug[:10]
show = json.loads((dst / 'show.json').read_text())
show.update(title=o.title, date=date, event=o.event, theme=o.theme)
(dst / 'show.json').write_text(json.dumps(show, ensure_ascii=False, indent=2) + '\n')
idx_path = root / 'shows' / 'index.json'
idx = json.loads(idx_path.read_text())
idx.append({'path': f'{o.slug}/', 'date': date, 'title': o.title, 'event': o.event, 'heading': 'ink/title.png'})
idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + '\n')
print(f'created shows/{o.slug}/ — put handwriting PNGs in ink/ and fill show.json')
