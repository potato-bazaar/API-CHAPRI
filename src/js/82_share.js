// ───────────────────────── SHARE YOUR WIN ─────────────────────────
// The results screen's SHARE button: a 1080×1920 brag card (the orbit shot of your rider behind the results, your
// position, track, time, best lap and top speed), shown as a preview with the phone's share sheet and a plain download.
let UI_NOTE = null;   // the UI's flash note, set once the UI is up
const SHARE = {
  W: 1080, H: 1920,
  // grab the 3D view right after drawing it (the WebGL buffer is only readable in the same task)
  grab(g) {
    // a close front-three-quarter hero angle on the player for this one frame, then the orbit camera comes back
    const C = g.camera, R = g.race, keep = { p: C.position.clone(), q: C.quaternion.clone(), fov: C.fov };
    if (R) { const P = R.player, T = R.track, rp = T.pos(P.s, P.d, new THREE.Vector3(), P.y - T.yAt(P.s)), yaw = T.yawAt(P.s) + P.psi;
      const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw), side = (this.side = -(this.side || 1));
      C.position.set(rp.x + fx * 2.9 + lx * 1.5 * side, rp.y + 1.3, rp.z + fz * 2.9 + lz * 1.5 * side); const cw = g.renderer.domElement.width, ch = g.renderer.domElement.height, sh = ch * Math.max(this.W / cw, this.H * 0.8 / ch);   // how tall the shot lands on the card
      C.fov = 2 * Math.atan(Math.tan(22 * Math.PI / 180) * sh / (this.H * 0.8)) * 180 / Math.PI; C.updateProjectionMatrix();   // same framing on a tall phone as on a wide screen
      C.lookAt(rp.x + fx * 0.2, rp.y + 0.95, rp.z + fz * 0.2); C.updateMatrixWorld(); }
    try { if (g.postOn()) g.comic.render(g.scene, g.camera); else g.renderer.render(g.scene, g.camera); } catch (e) { }
    const src = g.renderer.domElement, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    let ok = true; try { c.getContext('2d').drawImage(src, 0, 0); } catch (e) { ok = false; }
    C.position.copy(keep.p); C.quaternion.copy(keep.q); C.fov = keep.fov; C.updateProjectionMatrix(); C.updateMatrixWorld();
    return ok ? c : null;
  },
  async card(g, R, res) {
    const W = this.W, H = this.H, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const shot = this.grab(g);
    try { await Promise.race([Promise.all(['italic 700 200px Teko', '700 80px Teko', '800 60px "Baloo 2"', '600 40px "Baloo 2"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1200))]); } catch (e) { }
    // background: the 3D shot, cover-fitted and nudged so the rider sits in the upper two thirds
    x.fillStyle = '#140a1a'; x.fillRect(0, 0, W, H);
    if (shot) { const k = Math.max(W / shot.width, H * 0.8 / shot.height), sw = shot.width * k, sh = shot.height * k; x.drawImage(shot, (W - sw) / 2, Math.min(0, H * 0.42 - sh / 2), sw, sh); }   // the rider lands ~40% down, above the results
    let gr = x.createLinearGradient(0, 0, 0, 380); gr.addColorStop(0, 'rgba(20,10,26,.92)'); gr.addColorStop(1, 'rgba(20,10,26,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, 380);
    gr = x.createLinearGradient(0, H * 0.5, 0, H); gr.addColorStop(0, 'rgba(20,10,26,0)'); gr.addColorStop(0.32, 'rgba(20,10,26,.88)'); gr.addColorStop(1, 'rgba(20,10,26,1)'); x.fillStyle = gr; x.fillRect(0, H * 0.5, W, H * 0.5);
    const txt = (s, px, py, font, fill, stroke = 0, align = 'left') => { x.font = font; x.textAlign = align; x.textBaseline = 'alphabetic'; if (stroke) { x.lineJoin = 'round'; x.lineWidth = stroke; x.strokeStyle = '#120814'; x.strokeText(s, px, py); } x.fillStyle = fill; x.fillText(s, px, py); return x.measureText(s).width; };
    // wordmark
    txt('CHAPRI', 72, 150, 'italic 700 120px Teko', '#ff2e88', 14); const w1 = x.measureText('CHAPRI').width;
    txt('RACER', 72 + w1 + 22, 150, 'italic 700 120px Teko', '#ffc21a', 14);
    txt('BIKE RACING GAME', 76, 200, '800 34px "Baloo 2"', '#3fd0c9', 0);
    // result block
    const P = R.player, police = !!R.police, base = H - 640;
    const big = res.posText, suf = police ? res.posSuf : (res.posSuf || '').toUpperCase();
    x.font = 'italic 700 300px Teko'; let wb = x.measureText(big).width; x.font = 'italic 700 110px Teko'; const ws = suf ? x.measureText(suf).width + 16 : 0;
    const kb = Math.min(1, (W - 144) / (wb + ws));   // a police time + ESCAPED shrinks to fit the card
    const bw = txt(big, 72, base, `italic 700 ${Math.floor(300 * kb)}px Teko`, '#ffc21a', 22);
    if (suf) txt(suf, 72 + bw + 16, base - 150 * kb, `italic 700 ${Math.floor(110 * kb)}px Teko`, '#ffffff', 14);
    txt(res.title, 76, base + 92, '800 76px "Baloo 2"', '#ffffff', 12);
    txt(R.def.name, 78, base + 152, '600 40px "Baloo 2"', '#cdb8dc');
    // stat tiles
    const laps = P.laps || [], total = police ? (P.finishT || R.raceT) : laps.reduce((a, b) => a + b, 0);
    const stats = [['TIME', total > 0 ? fmtTime(total) : '—'], ['BEST LAP', isFinite(P.bestLap) ? fmtTime(P.bestLap) : '—'], ['TOP SPEED', Math.round((P.vMax || 0) * 3.6) + ' km/h']];
    const tw = (W - 72 * 2 - 24 * 2) / 3, ty = base + 210;
    stats.forEach(([k, v], i) => { const tx = 72 + i * (tw + 24); x.fillStyle = 'rgba(255,255,255,.08)'; this.round(x, tx, ty, tw, 170, 26); x.fill(); x.strokeStyle = i === 0 ? '#ff2e88' : i === 1 ? '#3fd0c9' : '#ffc21a'; x.lineWidth = 4; x.stroke();
      txt(k, tx + 28, ty + 56, '800 30px "Baloo 2"', '#cdb8dc');
      x.font = 'italic 700 84px Teko'; const fit = Math.min(84, Math.floor(84 * (tw - 50) / Math.max(1, x.measureText(v).width)));   // long values shrink to fit the tile
      txt(v, tx + 26, ty + 140, `italic 700 ${fit}px Teko`, '#ffffff'); });
    // rider + points
    const S = R.score || {}, bits = [`+${fmtNum(res.total || 0)} coins`, S.overtakeCount ? `${S.overtakeCount} overtake${S.overtakeCount > 1 ? 's' : ''}` : '', S.knockCount ? `${S.knockCount} knockdown${S.knockCount > 1 ? 's' : ''}` : ''].filter(Boolean);
    txt(bits.join('  ·  '), 76, ty + 250, '700 40px "Baloo 2"', '#6ee7a8');
    x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(72, H - 150, W - 144, 3);
    txt(`${SAVE.name || 'Chapri'} on Chapri Racer`, 76, H - 82, '800 44px "Baloo 2"', '#ffffff');
    txt('Beat that?', W - 72, H - 82, 'italic 700 64px Teko', '#ff2e88', 0, 'right');
    return cv;
  },
  round(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); },
  // make the card and show it with Share / Save
  async open(g) {
    const R = g.race, res = g.lastRes; if (!R || !res) return;
    const btn = $('#rShare'); btn.disabled = true;
    try {
      const cv = await this.card(g, R, res); const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('no image');
      if (this.url) URL.revokeObjectURL(this.url); this.url = URL.createObjectURL(blob); this.blob = blob;
      $('#shareImg').src = this.url;
      const file = new File([blob], `chapri-racer-${R.def.id}.jpg`, { type: 'image/jpeg' }); this.file = file;
      const can = !!(navigator.canShare && navigator.canShare({ files: [file] })); $('#shareGo').hidden = !can;
      // inside the claude.ai viewer a plain download link does nothing: saving goes through the viewer's own prompt
      const dl = await this.downloader(), framed = !!(window.claude && window.claude.use), canSave = !!dl || !framed;
      $('#shareSave').hidden = !canSave; $('#shareHint').hidden = can || canSave;
      g.ui.open('share');
    } catch (e) { console.warn('share', e); g.ui.flashNote('Could not make the share card here.'); }
    finally { btn.disabled = false; }
  },
  async go() {
    if (!this.file) return;
    try { await navigator.share({ files: [this.file], title: 'Chapri Racer', text: 'Beat that? 🏍️ Chapri Racer' }); } catch (e) { if (e && e.name !== 'AbortError') this.save(); }
  },
  // the viewer's download capability (claude.ai artifact), or null in the standalone/web builds
  downloader() {
    if (!this._dl) this._dl = (async () => { try { return window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { return null; } })();
    return this._dl;
  },
  async save() {
    if (!this.blob) return; const name = this.file ? this.file.name : 'chapri-racer.jpg', dl = await this.downloader();
    if (dl) { try { await dl.save({ filename: name, data: this.blob }); } catch (e) { const c = e && e.code; if (c !== 'declined' && c !== 'rate_limited' && typeof UI_NOTE === 'function') UI_NOTE('Could not save here. Press and hold the card instead.'); } return; }
    const a = document.createElement('a'); a.href = this.url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  },
};
