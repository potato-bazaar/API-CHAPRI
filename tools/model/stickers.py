# Locate the black brand stickers inside hand-picked regions of the RX100 base-colour texture.
import numpy as np
from PIL import Image
ROIS = {  # name: (x0, y0, x1, y1) generous boxes around each sticker
  'tankL': (80, 280, 106, 340), 'tankR': (155, 285, 186, 348),
  'rxA': (476, 532, 498, 606), 'rxB': (166, 532, 187, 606),
  'stripA': (650, 395, 680, 456), 'stripB': (24, 560, 50, 622),
  'engA': (178, 660, 202, 696), 'engB': (250, 660, 290, 696),
  'yeisA': (500, 738, 517, 775), 'yeisB': (608, 736, 632, 782),
  'plate': (212, 300, 262, 358),
}
from scipy import ndimage
def find(img, roi, dark=70):
  # the sticker = black plate + white lettering; take the dark component nearest the ROI centre, then close holes
  a = np.asarray(img.crop(roi).convert('L')).astype(int)
  m = a < dark
  m = ndimage.binary_closing(m, iterations=2)
  lab, n = ndimage.label(m)
  if n == 0: return None
  cy, cx = a.shape[0] / 2, a.shape[1] / 2; best = None
  for i in range(1, n + 1):
    ys, xs = np.where(lab == i)
    if len(xs) < 20: continue
    d = (ys.mean() - cy) ** 2 + (xs.mean() - cx) ** 2
    if best is None or d < best[0]: best = (d, xs.min(), ys.min(), xs.max(), ys.max())
  if best is None: return None
  _, x0, y0, x1, y1 = best
  return (roi[0] + int(x0), roi[1] + int(y0), roi[0] + int(x1) + 1, roi[1] + int(y1) + 1)
if __name__ == '__main__':
  import sys
  img = Image.open(sys.argv[1]).convert('RGB')
  out = {}
  for k, r in ROIS.items():
    out[k] = find(img, r, 70 if k != 'plate' else 90)
    print(k, out[k])
  # dihedral variants for orientation reading
  tiles = []
  for k in ['tankL', 'tankR', 'rxA', 'rxB', 'stripA', 'stripB', 'engA', 'engB', 'yeisA', 'yeisB', 'plate']:
    b = out[k]; c = img.crop(b); row = []
    for i, t in enumerate([None, Image.ROTATE_90, Image.ROTATE_180, Image.ROTATE_270, Image.FLIP_LEFT_RIGHT, Image.TRANSPOSE, Image.FLIP_TOP_BOTTOM, Image.TRANSVERSE]):
      v = c if t is None else c.transpose(t); s = 110 / max(v.size); v = v.resize((max(1, int(v.width * s)), max(1, int(v.height * s))), Image.NEAREST); row.append(v)
    tiles.append(row)
  W = 8 * 120 + 60; H = len(tiles) * 120
  sheet = Image.new('RGB', (W, H), (90, 90, 90))
  from PIL import ImageDraw; d = ImageDraw.Draw(sheet)
  for r, row in enumerate(tiles):
    d.text((2, r * 120 + 50), list(ROIS)[r] if r < len(ROIS) else '', fill=(255, 255, 0))
    for i, v in enumerate(row): sheet.paste(v, (60 + i * 120, r * 120 + 5)); d.text((60 + i * 120, r * 120 + 108), str(i), fill=(0, 255, 255))
  sheet.save(sys.argv[2])
