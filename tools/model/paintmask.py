# Mark the bike's paintwork (maroon tank, side panels, tail) in the base-colour alpha channel so the game can repaint it.
# alpha 255 = leave alone, alpha 128 = paint. (Half alpha rather than zero keeps RGB intact through premultiplying browsers.)
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(float) / 255
r, g = a[..., 0], a[..., 1]; mx = a.max(-1); mn = a.min(-1); s = (mx - mn) / (mx + 1e-6)
strong = (r >= mx - 1e-6) & (s > 0.45) & (mx > 0.12) & (g < 0.6 * r)
lab, n = ndimage.label(strong); keep = np.zeros_like(strong)
for i in range(1, n + 1):
  m = lab == i; cnt = m.sum()
  if cnt < 300: continue
  c = a[m].mean(0) * 255
  if 95 <= c[0] <= 135 and c[1] < 45: keep |= m   # maroon paint only: skips tail lens, reflectors, indicators
weak = (r >= mx - 1e-6) & (s > 0.25)
for _ in range(2): keep = keep | (ndimage.binary_dilation(keep) & weak)
lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
L = (lin @ np.array([0.2126, 0.7152, 0.0722]))[keep]
print('paint px', int(keep.sum()), 'ref linear luminance', round(float(np.median(L)), 5), 'mean', round(float(L.mean()), 5))
alpha = np.where(keep, 128, 255).astype(np.uint8)
Image.fromarray(np.dstack([np.asarray(im), alpha])).save(out)
print('saved', out)
