// ───────────────────────── RACE HUD ─────────────────────────
const CROWN_SVG = '<svg class="crown-i" viewBox="0 0 64 40" aria-hidden="true"><path d="M3 37V11l15 13L32 3l14 21 15-13v26z"/></svg>';
class HUD {
  constructor(game) {
    this.game = game; this.root = $('#hud');
    this.el = { pos: $('#hPos'), suf: $('#hPosSuf'), of: $('#hPosOf'), lap: $('#hLap'), time: $('#hTime'), best: $('#hBest'), speed: $('#hSpeed'), gear: $('#hGear'), kick: $('#hKick'), arcFill: $('#arcFill'), arcBand: $('#arcBand'), needle: $('#needle'), wob: $('#wobIco'), stand: $('#standings'), mm: $('#mmSvg'), mmName: $('#mmName'), big: $('#bigText'), wrong: $('#wrongWay'), warnL: $('#warnL'), warnR: $('#warnR'), splat: $('#splat'), pops: $('#pops'), callouts: $('#callouts'), toast: $('#toast'), toastTxt: $('#toastTxt'), toastPts: $('#toastPts'), slots: $('#wSlots'), throwIco: $('#throwIco'), throwUses: $('#throwUses'), maarUses: $('#maarUses'), boostBtn: $('[data-t="boost"]') };
    this.iconURL = {}; for (const k of ['chain', 'belt', 'bottle', 'gutka', 'oil', 'rod', 'katta']) this.iconURL[k] = TEX['icon_' + k].image.toDataURL();
    this.el.throwIco.style.backgroundImage = `url(${this.iconURL.bottle})`;
    // powerband arc on the dial (5,500–7,500 rpm of 10,500)
    const arcPt = (f, r) => { const a = Math.PI * (1 - f); return [150 + r * Math.cos(a), 150 - r * Math.sin(a)]; };
    const [x1, y1] = arcPt(5500 / 10500, 134), [x2, y2] = arcPt(7500 / 10500, 134);
    this.el.arcBand.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} A134 134 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    this.pops = []; this.lastStand = 0; this.warnT = { left: 0, right: 0 };
  }
  setupRace(race) {
    this.race = race; const T = race.track;
    this.root.classList.toggle('no-combat', !race.combatOn); this.root.classList.toggle('police', !!race.police); this.heatEl = $('#heat'); this.heatEl.hidden = !race.police; this.boostEl = $('#boostBanner'); this.boostEl.hidden = true; this.boostOn = false;
    this.root.classList.toggle('touch', IS_TOUCH);
    this.el.stand.innerHTML = ''; this.rows = [];
    const n = race.police ? 1 : race.riders.length; this.el.stand.hidden = n < 2;
    for (let i = 0; i < n && n > 1; i++) { const li = document.createElement('li'); li.innerHTML = `<span>${i + 1}</span><em></em><i class="gap"></i>`; this.el.stand.appendChild(li); this.rows.push(li); }
    this.el.of.textContent = n > 1 ? `/${n}` : '';
    // minimap
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < T.N; i += 8) { minX = Math.min(minX, T.px[i]); maxX = Math.max(maxX, T.px[i]); minZ = Math.min(minZ, T.pz[i]); maxZ = Math.max(maxZ, T.pz[i]); }
    const sc = 84 / Math.max(maxX - minX, maxZ - minZ); const ox = 50 - (minX + maxX) / 2 * sc, oz = 50 - (minZ + maxZ) / 2 * sc;
    this.mmMap = (x, z) => [(x * sc + ox), (z * sc + oz)];
    let d = ''; for (let i = 0; i <= T.N; i += 8) { const j = i % T.N; const [x, y] = this.mmMap(T.px[j], T.pz[j]); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    let narrow = ''; for (let i = 0; i < T.N; i += 8) { if (T.w[i] < 5) { const [x, y] = this.mmMap(T.px[i], T.pz[i]); const j = (i + 8) % T.N; const [x2, y2] = this.mmMap(T.px[j], T.pz[j]); narrow += `M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`; } }
    let cps = ''; for (let c = 1; c < 8; c++) { const i = Math.floor(T.N * c / 8); const [x, y] = this.mmMap(T.px[i], T.pz[i]); cps += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="#ff2e88"/>`; }
    const [sx, sy] = this.mmMap(T.px[0], T.pz[0]);
    let dots = ''; for (let i = race.riders.length - 1; i >= 0; i--) dots += `<circle id="mmd${i}" r="${race.riders[i].isPlayer ? 3.2 : 2.2}" fill="${race.riders[i].isPlayer ? '#ffc21a' : race.riders[i].cfg.cop ? '#2a58ff' : race.riders[i].net ? '#3fe8ff' : '#ffffff'}" stroke="${race.riders[i].isPlayer ? '#ff2e88' : '#20112a'}" stroke-width="1"/>`;
    this.el.mm.innerHTML = `<path d="${d}" fill="none" stroke="#20112a" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#f4f0f6" stroke-width="3.6" stroke-linejoin="round"/><path d="${narrow}" fill="none" stroke="#ffc21a" stroke-width="2" stroke-dasharray="2 2"/>${cps}<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.6" fill="#28c76f" stroke="#fff" stroke-width=".8"/>${dots}`;
    this.mmDots = race.riders.map((_, i) => $('#mmd' + i, this.el.mm));
    this.el.mmName.innerHTML = `${race.def.short}<br><small>${(T.L / 1000).toFixed(1)} km · ${race.laps} lap${race.laps > 1 ? 's' : ''}</small>`;
    this.el.callouts.innerHTML = ''; this.el.pops.innerHTML = ''; this.pops = []; this.el.toast.hidden = true; this.el.big.hidden = true; this.el.splat.hidden = true; this.el.wrong.hidden = true;
    const rec = SAVE.records[race.def.id]; this.el.best.textContent = rec && rec.bestLap ? fmtTime(rec.bestLap) : '--:--';
    // friends race: a name tag over every remote racer's bike (names from the network go in as text only)
    this.tags = null;
    if (race.mp) this.tags = race.riders.filter(r => r.net).map(r => {
      const el = document.createElement('div'); el.className = 'mp-tag'; el.textContent = r.short; el.hidden = true;
      el.style.cssText = 'position:absolute;translate:-50% -100%;padding:.12em .5em .02em;border-radius:6px;background:rgba(20,10,26,.74);box-shadow:inset 0 0 0 1.5px #3fe8ff;color:#fff;font-family:var(--f-num);font-weight:600;font-size:1.2rem;line-height:1.1;letter-spacing:.04em;white-space:nowrap;pointer-events:none';
      this.el.pops.appendChild(el); return { r, el };
    });
  }
  // name tags: over the bike, shown within 90 m and in front of the lens, fading with distance
  updateTags(camera) {
    const R = this.race, T = R.track, W = this.game.vw, H = this.game.vh, v = this._tv || (this._tv = new THREE.Vector3());
    for (const t of this.tags) {
      const r = t.r; let show = !r.eliminated && r.rig.root.visible;
      if (show) { T.pos(r.s, r.d, v, r.y - T.yAt(r.s) + 2.05); const dist = v.distanceTo(camera.position); v.project(camera); show = dist < 90 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        if (show) { t.el.style.left = ((v.x + 1) / 2 * W).toFixed(0) + 'px'; t.el.style.top = ((1 - v.y) / 2 * H).toFixed(0) + 'px'; t.el.style.opacity = clamp(1.4 - dist / 75, 0.35, 1).toFixed(2); } }
      if (t.el.hidden === show) t.el.hidden = !show;
    }
  }
  update(dt, camera) {
    const R = this.race; if (!R) return; const P = R.player;
    const rank = R.ranking(); const pos = rank.indexOf(P) + 1;
    const multi = R.riders.length > 1 && !R.police;
    this.el.pos.textContent = multi ? (R.playerPos || pos) : (R.police ? '🚨' : R.mode === 'stunt' ? '★' : '⏱');
    this.el.suf.textContent = multi ? ordinal(R.playerPos || pos) : '';
    if (R.police) { const PO = R.police, h = PO.heat; this.heatEl.style.setProperty('--heat', (h / 100).toFixed(3)); $('#heatFill').style.width = h.toFixed(1) + '%'; this.heatEl.classList.toggle('hot', h > 65);
      $('#copGap').textContent = PO.copDist > 300 || !isFinite(PO.copDist) ? 'lost' : `${Math.round(PO.copDist)} m`; $('#heatLbl').textContent = PO.busted ? 'PAKDA GAYA!' : h > 65 ? 'BHAAG! BUSTED METER' : 'BUSTED METER'; }
    // boost: banner on top + the dial turns electric
    if (P.boosting !== this.boostOn) { this.boostOn = P.boosting; const sp = this.el.speed.closest('.speedo'); sp.classList.toggle('boosting', P.boosting);
      if (P.boosting && !REDUCED_MOTION) { this.boostEl.hidden = false; this.boostEl.classList.remove('go'); void this.boostEl.offsetWidth; this.boostEl.classList.add('go'); } else if (!P.boosting) { clearTimeout(this._bbT); this._bbT = setTimeout(() => { if (!this.boostOn) this.boostEl.hidden = true; }, 250); } }
    const lapShown = clamp(Math.max(0, P.lap) + 1, 1, R.laps); this.el.lap.textContent = `${lapShown}/${R.laps}`;
    const lt = R.state === 'racing' ? R.raceT - P.lapStart : R.state === 'finished' ? (P.laps[P.laps.length - 1] || 0) : 0;
    this.el.time.textContent = fmtTimeLong(Math.max(0, R.mode === 'stunt' ? R.raceT : lt));
    if (isFinite(P.bestLap)) { const rec = SAVE.records[R.def.id]; this.el.best.textContent = fmtTime(Math.min(P.bestLap, rec && rec.bestLap || 1e9)); }
    if (R.mode === 'stunt') this.el.best.textContent = fmtNum(R.score.stunts || 0) + ' pts';
    // speedo
    const kmh = Math.round(P.v * 3.6); this.el.speed.textContent = kmh; this.el.gear.textContent = P.gear;
    const f = clamp(P.rpm / 10500, 0, 1); this.el.arcFill.setAttribute('stroke-dasharray', `${(f * 100).toFixed(1)} 100`);
    this.el.needle.setAttribute('transform', `rotate(${(-90 + f * 180).toFixed(1)} 150 150)`);
    const inBand = P.rpm >= 5500 && P.rpm <= 7500; this.el.arcBand.setAttribute('stroke-width', inBand ? 8 : 4); this.el.arcBand.setAttribute('opacity', inBand ? 1 : 0.55);
    this.el.kick.style.width = P.boost.toFixed(1) + '%'; this.el.kick.parentElement.classList.toggle('burn', P.boosting); this.el.boostBtn.classList.toggle('ready', P.boost > 30);
    this.el.wob.className = 'wob' + (P.wobble > 65 ? ' warn2' : P.wobble > 30 ? ' warn1' : '');
    this.el.wrong.hidden = !(P.wrongT > 1);
    // standings (5 Hz)
    this.lastStand -= dt;
    if (this.lastStand <= 0 && this.rows.length) { this.lastStand = 0.2;
      const lead = rank[0];
      rank.forEach((r, i) => { const li = this.rows[i]; if (!li) return; li.className = (r.isPlayer ? 'me' : '') + (r.eliminated ? ' out' : '') + (r.crashed ? ' down' : '') + (i === 0 ? ' lead' : ''); li.children[1].textContent = r.isPlayer ? 'You' : r.short;
        const gap = i === 0 ? '' : r.finished && lead.finished ? '+' + (r.finishT - lead.finishT).toFixed(2) + 's' : r.eliminated ? 'OUT' : '+' + Math.min(99.99, (lead.dist - r.dist) / Math.max(6, (lead.v + r.v) / 2)).toFixed(2) + 's';
        li.children[2].innerHTML = i === 0 ? CROWN_SVG : gap; }); }
    // minimap dots
    R.riders.forEach((r, i) => { const dot = this.mmDots[i]; if (!dot) return; const T = R.track; const [ii, jj, ff] = T.idx(r.s); const x = lerp(T.px[ii], T.px[jj], ff), z = lerp(T.pz[ii], T.pz[jj], ff); const [mx, my] = this.mmMap(x, z); dot.setAttribute('cx', mx.toFixed(1)); dot.setAttribute('cy', my.toFixed(1)); dot.style.display = r.eliminated ? 'none' : ''; });
    // weapons
    const w = P.weapons; const key = (w.melee ? w.melee.kind + w.melee.uses : '-') + (w.throw ? w.throw.kind + w.throw.uses : '-');
    if (key !== this.wKey) { this.wKey = key; let h = '';
      const NM = { chain: 'CHAIN', belt: 'BELT', rod: 'SARIA', lathi: 'LATHI', bottle: 'BOTTLE', gutka: 'GUTKA', katta: 'KATTA' };
      if (w.melee) h += `<span class="wslot"><img src="${this.iconURL[w.melee.kind]}" alt="">${NM[w.melee.kind] || w.melee.kind.toUpperCase()} ×${w.melee.uses}</span>`;
      if (w.throw) h += `<span class="wslot"><img src="${this.iconURL[w.throw.kind]}" alt="">${NM[w.throw.kind] || 'BOTTLE'} ×${w.throw.uses}</span>`;
      this.el.slots.innerHTML = h; const tb = this.el.throwIco.parentElement; tb.classList.toggle('armed', !!w.throw); this.el.throwIco.style.backgroundImage = `url(${this.iconURL[w.throw ? w.throw.kind : 'bottle']})`; this.el.throwUses.textContent = w.throw ? w.throw.uses : ''; this.el.maarUses.textContent = w.melee ? w.melee.uses : '';
    }
    // world-anchored pops
    const W = this.game.vw, H = this.game.vh; const v = new THREE.Vector3();
    for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; if (p.t > p.life) { p.el.remove(); this.pops.splice(i, 1); continue; }
      R.track.pos(p.r.s, p.r.d, v, p.r.y - R.track.yAt(p.r.s) + 2.3); v.project(camera); if (v.z > 1) { p.el.style.display = 'none'; continue; } p.el.style.display = ''; p.el.style.left = ((v.x + 1) / 2 * W).toFixed(0) + 'px'; p.el.style.top = ((1 - v.y) / 2 * H).toFixed(0) + 'px'; }
    // attacker wind-up markers over rivals targeting the player
    for (const r of R.riders) { if (r.isPlayer || !r.attack || r.attack.target !== P || r.attack.hit) continue; if (!r._bang) { const el = document.createElement('div'); el.className = 'bang'; el.textContent = '!'; this.el.pops.appendChild(el); r._bang = { el, r, t: 0, life: r.attack.W.strike + 0.15 }; this.pops.push(r._bang); } }
    for (const r of R.riders) if (r._bang && r._bang.t > r._bang.life - 0.01) r._bang = null;
    for (const side of ['left', 'right']) { if (this.warnT[side] > 0) { this.warnT[side] -= dt; if (this.warnT[side] <= 0) this.el[side === 'left' ? 'warnL' : 'warnR'].hidden = true; } }
    if (this.tags) this.updateTags(camera);
  }
  coinTick(n) { $$('.coinsMirror').forEach(e => { e.textContent = fmtNum(SAVE.coins); const p = e.closest('.pill'); if (p) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }); }
  callout(text, pts, cls = 'good') {
    const el = document.createElement('div'); el.className = 'callout ' + cls; el.innerHTML = `${text}${pts ? `<em>${pts}</em>` : ''}`;
    this.el.callouts.prepend(el); while (this.el.callouts.children.length > 3) this.el.callouts.lastChild.remove();
    setTimeout(() => el.remove(), 1650);
  }
  toast(text) {
    const m = text.match(/^(.*?)(\+\d[\d,]* pts)?$/); this.el.toastTxt.textContent = m ? m[1].trim() : text; this.el.toastPts.textContent = m && m[2] ? m[2] : '';
    this.el.toast.hidden = false; this.el.toast.style.animation = 'none'; void this.el.toast.offsetWidth; this.el.toast.style.animation = '';
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { this.el.toast.hidden = true; }, 2200);
  }
  popAt(r, text, pts) { const el = document.createElement('div'); el.className = 'pop3d'; el.innerHTML = `${text}<small>${pts || ''}</small>`; this.el.pops.appendChild(el); this.pops.push({ el, r, t: 0, life: 1.2 }); }
  countdown(k) { this.big(k ? String(k) : 'CHALO!', null, k ? 0.9 : 1.1); }
  big(text, sub, dur = 1.5) { const b = this.el.big; b.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(this._bigT); this._bigT = setTimeout(() => (b.hidden = true), dur * 1000); }
  lapFlash(text, t) { this.big(text, `Lap ${fmtTime(t)}`, 1.6); }
  finish(pos, n, mode) {
    if (this.race.police) { if (!this.race.police.busted) this.big('BACH GAYA!', 'Nakabandi se nikal gaya', 3.4); return; }
    if (this.race.mp) { this.big('FINISHED!', 'Waiting for the results…', 3.4); return; }   // the place is the server's to give
    if (mode === 'stunt') this.big('STUNT RUN', `${fmtNum(this.race.score.stunts || 0)} pts`, 3.4);
    else if (n) this.big(pos === 1 ? 'JEET GAYA!' : `${pos}${ordinal(pos)}`, pos === 1 ? 'Mumbai ka asli Chapri Raja' : 'FINISHED', 3.4);
    else this.big('FINISHED', fmtTime(this.race.player.bestLap), 3.4);
  }
  warn(side) { const el = side === 'left' ? this.el.warnL : this.el.warnR; el.hidden = false; this.warnT[side] = 0.5; }
  splat(dur) { const s = this.el.splat; s.hidden = false; s.classList.remove('go'); void s.offsetWidth; s.style.setProperty('--dur', dur + 's'); s.classList.add('go'); clearTimeout(this._spT); this._spT = setTimeout(() => (s.hidden = true), dur * 1000); }
  flashHit(side) { const f = $('#flash'); f.hidden = false; f.className = 'flash ' + (side > 0 ? 'l' : 'r'); clearTimeout(this._flT); this._flT = setTimeout(() => (f.hidden = true), 360); }
}
