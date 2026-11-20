#!/usr/bin/env python3
"""
Cut handwriting out of a photo of the notebook and save it as transparent PNGs
(black ink + alpha). Paper, shadows and staff lines are removed; the page tints
the ink with the theme colour.

usage:
  python3 tools/extract_ink.py photo.jpg boxes.json shows/<show>/ink [--sheet preview.jpg]

boxes.json  (pixel coordinates in the photo: left, top, right, bottom)
  [
    {"name": "title",  "box": [1224, 1094, 1886, 1253]},
    {"name": "song-1", "box": [749, 1426, 2189, 1584]},
    {"name": "theme",  "box": [202, 2851, 2765, 3038], "words": true}
  ]
"words": true also writes theme-1.png, theme-2.png ... one per word, all with the
same height so they sit on one baseline and can wrap like text.

Needs: opencv-python, numpy.
"""
import cv2, numpy as np, json, sys, argparse

def normalise(gray):
    small = cv2.resize(gray, None, fx=.125, fy=.125)
    bg = cv2.resize(cv2.medianBlur(small, 31), (gray.shape[1], gray.shape[0]))
    return cv2.divide(gray, bg, scale=255)

def staff_angle(win):
    e = cv2.Canny(win, 40, 120)
    L = cv2.HoughLinesP(e, 1, np.pi / 3600, 150, minLineLength=win.shape[1] * .5, maxLineGap=15)
    if L is None: return 0.
    a = [np.degrees(np.arctan2(y2 - y1, x2 - x1)) for x1, y1, x2, y2 in L.reshape(-1, 4)]
    a = [x for x in a if abs(x) < 6]
    return float(np.median(a)) if a else 0.

def cut(norm, box):
    x0, y0, x1, y1 = box
    wy0, wy1 = max(0, y0 - 250), min(norm.shape[0], y1 + 250)
    win = norm[wy0:wy1, x0:x1]
    ang = staff_angle(win)
    h, w = win.shape
    win = cv2.warpAffine(win, cv2.getRotationMatrix2D((w / 2, h / 2), ang, 1), (w, h), borderValue=255, flags=cv2.INTER_CUBIC)
    sub = win[y0 - wy0:y1 - wy0]
    dark = 255 - sub.astype(np.int16)
    m = ((dark > 65) * 255).astype(np.uint8)
    lines = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (150, 1)))
    lines = cv2.dilate(lines, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5)))
    ink = cv2.subtract(m, lines)
    ink = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 9)))
    k, lab, st, _ = cv2.connectedComponentsWithStats(ink, 8)
    keep = np.zeros(k, bool); keep[1:] = st[1:, 4] > 80
    ink = (keep[lab] * 255).astype(np.uint8)
    alpha = np.clip((dark.astype(float) - 35) * 2.4, 0, 255).astype(np.uint8)
    alpha = cv2.bitwise_and(alpha, cv2.dilate(ink, np.ones((3, 3), np.uint8)))
    return alpha, ang

def trim(a, pad=6, vertical=True):
    ys, xs = np.where(a > 40)
    if not len(xs): return a
    y0, y1 = (max(ys.min() - pad, 0), ys.max() + pad + 1) if vertical else (0, a.shape[0])
    return a[y0:y1, max(xs.min() - pad, 0):xs.max() + pad + 1]

def save(a, path):
    cv2.imwrite(path, np.dstack([np.zeros_like(a)] * 3 + [a]), [cv2.IMWRITE_PNG_COMPRESSION, 9])

def words(a, min_gap=None):
    a = trim(a, 0)
    cols = (a > 40).sum(0) > 0
    xs = np.where(cols)[0]
    gaps = [(xs[i], xs[i + 1]) for i in range(len(xs) - 1) if xs[i + 1] - xs[i] > (min_gap or a.shape[0] * .22)]
    edges = [0] + [(g0 + g1) // 2 for g0, g1 in gaps] + [a.shape[1]]
    return [trim(a[:, edges[i]:edges[i + 1]], 4, vertical=False) for i in range(len(edges) - 1)]

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('photo'); ap.add_argument('boxes'); ap.add_argument('out')
    ap.add_argument('--sheet', help='write a preview contact sheet here')
    o = ap.parse_args()
    norm = normalise(cv2.cvtColor(cv2.imread(o.photo), cv2.COLOR_BGR2GRAY))
    made = []
    for b in json.load(open(o.boxes)):
        a, ang = cut(norm, b['box'])
        if b.get('words'):
            for i, wa in enumerate(words(a), 1):
                p = f"{o.out}/{b['name']}-{i}.png"; save(wa, p); made.append((p, wa))
        else:
            a = trim(a); p = f"{o.out}/{b['name']}.png"; save(a, p); made.append((p, a))
        print(f"{b['name']}: rotated {ang:.2f}°")
    if o.sheet:
        W = 1400; rows = []
        for p, a in made:
            s = min(1, (W - 20) / a.shape[1]); a = cv2.resize(a, None, fx=s, fy=s) / 255.
            r = np.full((a.shape[0] + 30, W, 3), 245, np.uint8)
            r[25:25 + a.shape[0], 10:10 + a.shape[1]] = (245 * (1 - a[..., None]) + 30 * a[..., None]).astype(np.uint8)
            cv2.putText(r, p.split('/')[-1], (10, 18), 0, .55, (0, 0, 200), 1); rows.append(r)
        cv2.imwrite(o.sheet, np.vstack(rows))
    for p, _ in made: print(p)
