# Paint out the Yamaha / RX100 badges and number plate on the RX100 base-colour texture, then add CHAPRI / CR100 badges.
import sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stickers import ROIS, find
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB'); A = np.asarray(img).copy()
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
T = Image.Transpose
# readable orientation of each badge as found on the texture (X maps texture crop -> readable)
PLAN = {
  'tankL': ('CHAPRI', T.TRANSVERSE), 'tankR': ('CHAPRI', T.TRANSPOSE),
  'rxA': ('=CR100=', T.TRANSVERSE), 'rxB': ('=CR100=', T.TRANSVERSE),
  'stripA': (None, None), 'stripB': (None, None), 'engA': (None, None), 'engB': (None, None), 'yeisA': (None, None), 'yeisB': (None, None), 'clusterBadge': (None, None),
}
FIXED = {'yeisB': (617, 742, 624, 773), 'clusterBadge': (315, 32, 322, 50)}  # split-letter label: components don't merge, so use a measured box
INV = {T.TRANSVERSE: T.TRANSVERSE, T.TRANSPOSE: T.TRANSPOSE, T.ROTATE_90: T.ROTATE_270, T.ROTATE_270: T.ROTATE_90}
def ring_color(a, b, pad=3):
  x0, y0, x1, y1 = b; H, W = a.shape[:2]
  X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
  reg = a[Y0:Y1, X0:X1].reshape(-1, 3).astype(int); m = np.ones((Y1 - Y0, X1 - X0), bool); m[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = False
  ring = reg[m.reshape(-1)]; lum = ring.mean(1); ring = ring[lum > np.percentile(lum, 30)]
  return np.median(ring, 0).astype(np.uint8)
def sticker(text, w, h):
  # readable sticker: black plate, thin white border, bold white letters
  S = 8; im = Image.new('RGB', (w * S, h * S), (12, 12, 12)); d = ImageDraw.Draw(im)
  d.rectangle([S, S, w * S - S - 1, h * S - S - 1], outline=(235, 235, 235), width=max(2, S // 2))
  size = int(h * S * 0.78)
  while size > 6:
    f = ImageFont.truetype(FONT, size); bb = d.textbbox((0, 0), text, font=f)
    if bb[2] - bb[0] <= w * S * 0.86 and bb[3] - bb[1] <= h * S * 0.7: break
    size -= 2
  bb = d.textbbox((0, 0), text, font=f); d.text(((w * S - (bb[2] - bb[0])) / 2 - bb[0], (h * S - (bb[3] - bb[1])) / 2 - bb[1]), text, font=f, fill=(245, 245, 245))
  return im.resize((w, h), Image.LANCZOS)
for name, (text, X) in PLAN.items():
  b = FIXED.get(name) or find(img, ROIS[name], 70); x0, y0, x1, y1 = b
  c = ring_color(A, b); A[y0 - 1:y1 + 1, x0 - 1:x1 + 1] = c
  if text:
    w, h = x1 - x0, y1 - y0
    rw, rh = (h, w) if X in (T.TRANSPOSE, T.TRANSVERSE, T.ROTATE_90, T.ROTATE_270) else (w, h)
    st = sticker(text, rw, rh).transpose(INV[X]); A[y0:y1, x0:x1] = np.asarray(st)
  print(name, b, 'fill', c.tolist(), 'text', text)
# number plate: blank the old registration and print a new one (plate reads with TRANSPOSE)
px0, py0, px1, py1 = 214, 302, 254, 354
plate = A[py0:py1, px0:px1]; bg = np.median(plate.reshape(-1, 3)[plate.reshape(-1, 3).mean(1) > 170], 0).astype(np.uint8)
A[py0:py1, px0:px1] = bg
w, h = px1 - px0, py1 - py0; S = 8; R = Image.new('RGB', (h * S, w * S), tuple(int(v) for v in bg)); d = ImageDraw.Draw(R)
f = ImageFont.truetype(FONT, int(w * S * 0.27))
for i, line in enumerate(['MH 02', 'CR 1987']):
  bb = d.textbbox((0, 0), line, font=f); d.text(((h * S - (bb[2] - bb[0])) / 2 - bb[0], w * S * (0.12 + i * 0.44) - bb[1]), line, font=f, fill=(20, 20, 20))
A[py0:py1, px0:px1] = np.asarray(R.resize((h, w), Image.LANCZOS).transpose(T.TRANSPOSE))
Image.fromarray(A).save(dst)
print('saved', dst)
