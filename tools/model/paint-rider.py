# Paint the rider's clothes onto the body texture.
# in: skin.png (original body texture), tris.json ([headish, u0,v0,u1,v1,u2,v2, x0,y0,z0, x1,y1,z1, x2,y2,z2] per triangle, bind pose)
# Each texel is classified from its interpolated 3D position, so hems, collar and belt are clean lines.
# out: base.png (skin kept; shirt + jeans as neutral grey shading; belt / sneakers / soles painted)
#      mask.png (R = shirt, G = jeans) — the game tints those with the rider's shirt pattern and jeans colour.
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage
skin_p, tris_p, base_p, mask_p = sys.argv[1:5]
im = Image.open(skin_p).convert('RGB'); W, H = im.size; a = np.asarray(im).astype(np.float32) / 255
tris = np.array(json.load(open(tris_p)), dtype=np.float64)
POS = np.full((H, W, 3), np.nan, np.float32); HEADISH = np.zeros((H, W), bool)
for t in tris:
  uv = t[1:7].reshape(3, 2) * [W, H]; P = t[7:16].reshape(3, 3)
  x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
  x0, y0 = max(x0 - 1, 0), max(y0 - 1, 0); x1, y1 = min(x1 + 1, W - 1), min(y1 + 1, H - 1)
  if x1 < x0 or y1 < y0: continue
  xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
  (ax, ay), (bx, by), (cx, cy) = uv
  den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
  if abs(den) < 1e-9: continue
  l0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den; l1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den; l2 = 1 - l0 - l1
  inside = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
  if not inside.any(): continue
  p = l0[..., None] * P[0] + l1[..., None] * P[1] + l2[..., None] * P[2]
  sub = POS[y0:y1 + 1, x0:x1 + 1]; sub[inside] = p[inside]
  if t[0] > 0.5: HEADISH[y0:y1 + 1, x0:x1 + 1][inside] = True
painted = ~np.isnan(POS[..., 0])
idx = ndimage.distance_transform_edt(~painted, return_distances=False, return_indices=True)   # pad islands with the nearest texel
POS = POS[idx[0], idx[1]]; HEADISH = HEADISH[idx[0], idx[1]]
x, y, z = POS[..., 0], POS[..., 1], POS[..., 2]; ax_ = np.abs(x)
L = np.full((H, W), 2, np.int8)                       # default jeans
L[y > 0.965] = 3                                      # belt
L[y > 0.995] = 1                                      # shirt
collar = (z > 0.0) & (y > 1.33) & (ax_ < 0.03 + (y - 1.33) * 0.8)
L[(y > 0.995) & ((y > 1.5) & (ax_ < 0.085) | collar)] = 0   # neck + open collar
L[(ax_ > 0.355) & (y > 0.9)] = 0                      # forearms + hands (half sleeves)
L[(y > 0.995) & (y <= 1.375) & (ax_ <= 0.2)] = 7     # white baniyan under the open shirt (the loose shirt panels are cloth in the game)
L[(y < 0.235) & (y > 0.13)] = 6                       # rolled-up cuff (turned-up denim)
L[(y < 0.205) & (y > 0.13)] = 0                       # bare ankle: skinny jeans pulled up
L[y < 0.13] = 4; L[y < 0.035] = 5                     # sneakers, soles
L[HEADISH] = 0
lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
blur = ndimage.gaussian_filter(lum, 4)
out = a.copy(); rng = np.random.default_rng(7)
def shade(r):
  m = L == r
  return m, np.clip(blur / np.median(blur[m]), 0.6, 1.25) if m.any() else None
m, s = shade(1); g = 0.5 * s
placket = (z > 0.02) & (ax_ < 0.007) & (y < 1.33)                              # button line
buttons = (z > 0.02) & (np.abs(x - 0.012) < 0.006) & (np.abs(((y - 1.02) % 0.075) - 0.0375) > 0.031) & (y < 1.31)
g = np.where(placket, g * 0.72, g); g = np.where(buttons, np.minimum(g * 1.5, 0.95), g)
edge = collar & (L == 1)
out[m] = g[m][:, None]
m, s = shade(2); tw = (np.sin((np.arange(W)[None, :] + np.arange(H)[:, None]) * 1.7) * 0.03 + rng.normal(0, 0.025, (H, W))).astype(np.float32)
out[m] = np.clip(0.5 * s[m] + tw[m], 0, 1)[:, None]
m6 = L == 6; out[m6] = np.array([0.62, 0.66, 0.72]) * np.clip(blur[m6] / max(1e-3, np.median(blur[m6])) if m6.any() else 1, 0.7, 1.2)[:, None] if m6.any() else out[m6]
m, s = shade(7)
if m.any():
  rib = 0.94 + 0.05 * np.sin((x + z) * 520)        # ribbed cotton
  out[m] = (np.array([0.93, 0.92, 0.88]) * (s * rib)[m][:, None])
m, s = shade(3); out[m] = np.array([0.22, 0.13, 0.08]) * s[m][:, None]
buckle = (L == 3) & (z > 0.03) & (ax_ < 0.025); out[buckle] = [0.78, 0.66, 0.32]
m, s = shade(4); out[m] = np.array([0.93, 0.93, 0.91]) * s[m][:, None]
m, s = shade(5); out[m] = np.array([0.30, 0.30, 0.32]) * s[m][:, None]
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(base_p)
mask = np.zeros((H, W, 3), np.uint8); mask[..., 0] = (L == 1) * 255; mask[..., 1] = (L == 2) * 255
Image.fromarray(mask).save(mask_p)
print('painted', {k: int((L == i).sum()) for i, k in enumerate(['skin', 'shirt', 'jeans', 'belt', 'shoes', 'sole', 'cuff', 'vest'])})
