"""Cut a sheet of stickers drawn on a plain background into separate transparent PNGs.

A sheet is a grid of pictures, each with a white sticker border, on one flat colour
(what the image model was asked for). The background is whatever is connected to the
edge of the sheet, so a green frog on a green sheet is still safe inside its border.

Usage: python scripts/cut-art.py <sheet.png> <outdir> <name1,name2,...> [size]
Names are in reading order (left to right, top to bottom). Needs pillow, numpy, scipy.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sheet, outdir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
size = int(sys.argv[4]) if len(sys.argv) > 4 else 384

img = Image.open(sheet).convert("RGB")
a = np.asarray(img).astype(np.int32)
h, w, _ = a.shape
# the background colour: the median of the four edges
edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
bg = np.median(edge, axis=0)
dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
like_bg = dist < 110
# only background that reaches the edge of the sheet counts
lab, _ = ndimage.label(like_bg)
edge_labels = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
outside = np.isin(lab, edge_labels[edge_labels > 0])
fg = ndimage.binary_opening(~outside, iterations=2)
objs, n = ndimage.label(fg)
areas = ndimage.sum(fg, objs, range(1, n + 1))
boxes = ndimage.find_objects(objs)
# a real sticker is big; specks and the model's corner mark are not
big = max(areas)
keep = [i for i in range(n) if areas[i] > big * 0.12]
if len(keep) != len(names):
    sys.exit(f"found {len(keep)} pictures on the sheet, expected {len(names)} ({', '.join(names)})")

# reading order: group into rows by the vertical centre, then left to right
centres = [((boxes[i][0].start + boxes[i][0].stop) / 2, (boxes[i][1].start + boxes[i][1].stop) / 2, i) for i in keep]
centres.sort()
rows, row = [], [centres[0]]
for c in centres[1:]:
    if c[0] - row[-1][0] > h * 0.12:
        rows.append(row)
        row = []
    row.append(c)
rows.append(row)
order = [c[2] for r in rows for c in sorted(r, key=lambda c: c[1])]

os.makedirs(outdir, exist_ok=True)
rgb = np.asarray(img)
for name, i in zip(names, order):
    ys, xs = boxes[i]
    mask = objs[ys, xs] == i + 1
    mask = ndimage.binary_fill_holes(mask)
    # soften the cut edge by one pixel so it is not jagged, and pull it in off the background colour
    alpha = ndimage.gaussian_filter(ndimage.binary_erosion(mask, iterations=2).astype(np.float32), 1.2)
    cut = np.dstack([rgb[ys, xs], (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    pic = Image.fromarray(cut, "RGBA")
    # centre on a square canvas with a little margin, then scale down
    side = int(max(pic.size) * 1.06)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(pic, ((side - pic.width) // 2, (side - pic.height) // 2))
    canvas.resize((size, size), Image.LANCZOS).save(os.path.join(outdir, f"{name}.png"), optimize=True)
    print(name, pic.size)
