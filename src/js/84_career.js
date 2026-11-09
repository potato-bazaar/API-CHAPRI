// ───────────────────────── SAFAR: THE CAREER ─────────────────────────
// Five chapters, four events each (three races and a one-on-one boss). Every event has three goals = three stars.
// The first goal clears the event and opens the next one; stars open chapters and pay coins; bosses pay prizes.
// Saved in SAVE.career: stars[eventId] = bitmask of goals ever met, paid[eventId] = boss prize taken.
const CAREER = {
  // goal conditions: ['pos', n] finish nth or better · ['win'] · ['clean'] no falls · ['over', n] overtakes · ['ko', n] knockdowns
  // ['lap', s] best lap ≤ s · ['stunt', pts] · ['escape'] not busted · ['naka', n] nakas jumped · ['lead', m] metres clear at the flag · ['boss'] finish ahead of Toofan
  chapters: [
    { id: 'c1', name: 'Gali ka Launda', line: 'Naya launda, purani bike. Pehle gali jeeto.', need: 0, diff: 'easy', events: [
      { id: 'c1e1', name: 'Pehli Race', track: 'mumbai-central', mode: 'quick', laps: 1, time: 'golden', goals: [[['pos', 5]], [['pos', 3]], [['win']]] },
      { id: 'c1e2', name: 'Gali Seekh', track: 'dharavi-lanes', mode: 'timetrial', laps: 2, time: 'morning', goals: [[['lap', 84]], [['lap', 76]], [['lap', 70]]] },
      { id: 'c1e3', name: 'Stunt Dikha', track: 'bandstand-rush', mode: 'stunt', time: 'golden', goals: [[['stunt', 250]], [['stunt', 600]], [['stunt', 1000]]] },
      { id: 'c1e4', name: 'Bunty Bhai', boss: 'Bunty', k: 0.97, say: 'Ae chhote! Yeh gali meri hai.', track: 'mumbai-central', mode: 'quick', laps: 2, time: 'night', goals: [[['win']], [['win'], ['clean']], [['win'], ['lead', 40]]], prize: { coins: 1500, parts: 3 } },
    ] },
    { id: 'c2', name: 'Naka King', line: 'Ab signal pe sab tera naam jaante hain.', need: 5, diff: 'normal', events: [
      { id: 'c2e1', name: 'Sea Link Sprint', track: 'bandstand-rush', mode: 'quick', laps: 2, time: 'golden', goals: [[['pos', 3]], [['win']], [['over', 8]]] },
      { id: 'c2e2', name: 'Gali Rumble', track: 'dharavi-lanes', mode: 'rumble', time: 'night', goals: [[['ko', 1]], [['ko', 3]], [['win']]] },
      { id: 'c2e3', name: 'Baarish', track: 'sion-flyover', mode: 'quick', laps: 2, time: 'golden', weather: 'monsoon', goals: [[['pos', 4]], [['pos', 2]], [['pos', 4], ['clean']]] },
      { id: 'c2e4', name: 'Sunny Speed', boss: 'Sunny', k: 0.99, say: 'Meri bike ki sirf tail-light dekhega tu.', track: 'bandstand-rush', mode: 'quick', laps: 2, time: 'morning', goals: [[['win']], [['win'], ['clean']], [['win'], ['lead', 50]]], prize: { coins: 2500, parts: 4, cape: 'hero' } },
    ] },
    { id: 'c3', name: 'Market Dada', line: 'Crawford se Dharavi tak, hafta tujhe milta hai.', need: 11, diff: 'normal', events: [
      { id: 'c3e1', name: 'Market Night', track: 'crawford-market', mode: 'quick', laps: 3, time: 'night', goals: [[['pos', 3]], [['win']], [['boss']]] },
      { id: 'c3e2', name: 'Aakhri Banda', track: 'mumbai-central', mode: 'elimination', time: 'golden', goals: [[['pos', 5]], [['pos', 3]], [['win']]] },
      { id: 'c3e3', name: 'Bhaag!', track: 'bhaag-chapri', mode: 'police', time: 'night', goals: [[['escape']], [['escape'], ['naka', 3]], [['escape'], ['clean']]] },
      { id: 'c3e4', name: 'Raju Rocket', boss: 'Raju', k: 1.0, say: 'Baarish mein sirf Rocket udta hai.', track: 'crawford-market', mode: 'quick', laps: 2, time: 'night', weather: 'monsoon', goals: [[['win']], [['win'], ['clean']], [['win'], ['lead', 50]]], prize: { coins: 3500, parts: 5, cape: 'neon' } },
    ] },
    { id: 'c4', name: 'Flyover Raja', line: 'Ab upar wali sadak bhi teri.', need: 18, diff: 'hard', events: [
      { id: 'c4e1', name: 'Sion Showdown', track: 'sion-flyover', mode: 'quick', laps: 3, time: 'golden', goals: [[['pos', 3]], [['win']], [['win'], ['clean']]] },
      { id: 'c4e2', name: 'Underground Lap', track: 'mumbai-underground', mode: 'timetrial', laps: 2, time: 'night', goals: [[['lap', 90]], [['lap', 83]], [['lap', 78]]] },
      { id: 'c4e3', name: 'Danga', track: 'bandstand-rush', mode: 'rumble', time: 'night', goals: [[['ko', 2]], [['ko', 4]], [['win']]] },
      { id: 'c4e4', name: 'Lucky Lambu', boss: 'Lambu', k: 1.02, say: 'Lambi race, lamba haath. Aaja.', track: 'dharavi-lanes', mode: 'quick', laps: 3, time: 'night', goals: [[['win']], [['win'], ['clean']], [['win'], ['lead', 60]]], prize: { coins: 5000, parts: 6 } },
    ] },
    { id: 'c5', name: 'Mumbai ka Don', line: 'Ek hi naam bacha hai. Toofan.', need: 26, diff: 'hard', events: [
      { id: 'c5e1', name: 'Toofan se Pehle', track: 'mumbai-underground', mode: 'quick', laps: 2, time: 'night', weather: 'monsoon', goals: [[['pos', 3]], [['win']], [['boss']]] },
      { id: 'c5e2', name: 'Hawa ka Raja', track: 'sion-flyover', mode: 'stunt', time: 'golden', goals: [[['stunt', 600]], [['stunt', 1200]], [['stunt', 2000]]] },
      { id: 'c5e3', name: 'Most Wanted', track: 'bhaag-chapri', mode: 'police', time: 'night', goals: [[['escape']], [['escape'], ['naka', 4]], [['escape'], ['clean']]] },
      { id: 'c5e4', name: 'Toofan Bhai', boss: 'Toofan', say: 'Don banna hai? Pehle mujhse aage nikal.', track: 'mumbai-underground', mode: 'quick', laps: 2, time: 'night', diff: 'normal', goals: [[['win']], [['win'], ['clean']], [['win'], ['lead', 30]]], prize: { coins: 10000, parts: 10, cape: 'raja', don: true } },
    ] },
  ],
  STAR_COINS: 150,   // × chapter number, for every star earned for the first time
  all() { return this.chapters.flatMap((c, ci) => c.events.map((e, ei) => Object.assign(e, { ch: c, ci, ei }))); },
  find(id) { return this.all().find(e => e.id === id); },
  save() { if (!SAVE.career || !SAVE.career.stars) SAVE.career = { stars: {}, paid: {} }; if (!SAVE.career.paid) SAVE.career.paid = {}; return SAVE.career; },
  bits(id) { return this.save().stars[id] || 0; },
  starsOf(id) { const b = this.bits(id); return (b & 1) + (b >> 1 & 1) + (b >> 2 & 1); },
  total() { return this.all().reduce((a, e) => a + this.starsOf(e.id), 0); },
  max() { return this.all().length * 3; },
  // an event is open when its chapter is (enough stars) and the event before it has been cleared (its first goal met)
  chapterOpen(c) { return this.total() >= c.need; },
  open(e) { if (!this.chapterOpen(e.ch)) return false; if (e.ei === 0) return e.ci === 0 || (this.bits(this.chapters[e.ci - 1].events[3].id) & 1) === 1; return (this.bits(e.ch.events[e.ei - 1].id) & 1) === 1; },
  next() { return this.all().find(e => this.open(e) && !(this.bits(e.id) & 1)) || null; },   // the first open event not yet cleared
  setupOf(e) { return { mode: e.mode, track: e.track, laps: e.laps || 2, diff: e.diff || e.ch.diff, time: e.time || 'auto', weather: e.weather || 'clear', combat: true, duel: e.boss || null, duelK: e.k || 1, career: e.id }; },
  // ── goals ──
  condText(c) { const n = c[1]; switch (c[0]) {
    case 'pos': return `Finish ${n}${ordinal(n).toLowerCase()} or better`; case 'win': return 'Win'; case 'clean': return 'no falls'; case 'over': return `${n} overtakes`; case 'ko': return `${n} knockdown${n > 1 ? 's' : ''}`;
    case 'lap': return `Lap under ${fmtTime(n).replace(/\.\d+$/, '')}`; case 'stunt': return `${fmtNum(n)} stunt points`; case 'escape': return 'Escape the police'; case 'naka': return `jump ${n} nakas`; case 'lead': return `by ${n} m`; case 'boss': return 'Finish ahead of Toofan Bhai'; } return ''; },
  goalText(g) { const t = g.map(c => this.condText(c)); return t[0] + (t.length > 1 ? (['clean', 'naka'].includes(g[1][0]) ? ', ' : ' ') + t.slice(1).join(', ') : ''); },
  // live state of one condition during the race: 1 met (for now), 0 not yet, -1 gone for good
  condLive(c, R) { const P = R.player, S = R.score, n = c[1], rank = R.ranking(), pos = R.playerPos || rank.indexOf(P) + 1; switch (c[0]) {
    case 'pos': return pos <= n ? 1 : 0; case 'win': return pos === 1 ? 1 : 0; case 'clean': return R.clean ? 1 : -1; case 'over': return (S.overtakeCount || 0) >= n ? 1 : 0; case 'ko': return (S.knockCount || 0) >= n ? 1 : 0;
    case 'lap': return isFinite(P.bestLap) && P.bestLap <= n ? 1 : 0; case 'stunt': return (S.stunts || 0) >= n ? 1 : 0; case 'escape': return R.police && R.police.busted ? -1 : 1; case 'naka': return (S.nakaCount || 0) >= n ? 1 : 0;
    case 'lead': { const o = R.riders.find(r => !r.isPlayer); return o && P.dist - o.dist >= n ? 1 : 0; }
    case 'boss': return R.boss ? (R.boss.dist < P.dist ? 1 : 0) : 1; } return 0; },
  // the verdict at the flag
  condDone(c, R) { const P = R.player; switch (c[0]) {
    case 'pos': case 'win': return !!MODES[R.mode].rivals && this.condLive(c, R) === 1;
    case 'lead': return (R.finishLead || 0) >= c[1]; case 'boss': return !R.boss || (P.finished && (!R.boss.finished || P.finishT < R.boss.finishT));
    case 'escape': return !!R.police && !R.police.busted; default: return this.condLive(c, R) === 1; } },
  // ── results: bank the stars, pay out, and describe it ──
  finish(game, R) {
    const e = this.find(game.career); if (!e) return ''; const C = this.save(), before = this.bits(e.id), wasTotal = this.total();
    const met = e.goals.map(g => g.every(c => this.condDone(c, R))); let now = before; met.forEach((m, i) => { if (m) now |= 1 << i; });
    const fresh = [0, 1, 2].filter(i => (now >> i & 1) && !(before >> i & 1)).length, coins = fresh * this.STAR_COINS * (e.ci + 1); C.stars[e.id] = now; SAVE.coins += coins;
    let prize = ''; if (e.prize && (now & 1) && !C.paid[e.id]) { C.paid[e.id] = true; const p = e.prize; SAVE.coins += p.coins; SAVE.parts += p.parts; const bits = [`${coinI}${fmtNum(p.coins)}`, `${p.parts} parts`];
      if (p.cape) { const cp = COSMETICS.cape.find(x => x.id === p.cape); if (cp && !SAVE.ownedCos[cp.id]) { SAVE.ownedCos[cp.id] = true; bits.push(`the ${cp.name} cape`); } }
      if (p.don) { C.don = true; bits.push('the title Mumbai ka Don'); }
      prize = `<p class="cr-prize">${e.boss === 'Toofan' ? 'TOOFAN GIRA DIYA!' : e.ch.events[3].name.toUpperCase() + ' HARA DIYA!'} Prize: ${bits.join(' + ')}</p>`; }
    const opened = this.chapters.filter(c => wasTotal < c.need && this.total() >= c.need && c.need > 0).map(c => c.name);
    const nx = this.next(); game.careerNext = (now & 1) && nx && nx.id !== e.id ? nx.id : null;
    return `<div class="cr-res${now & 1 ? '' : ' fail'}"><h3>SAFAR · ${e.ch.name.toUpperCase()}</h3><b class="cr-ev">${e.boss ? 'BOSS: ' : ''}${e.name}</b>
      <ul>${e.goals.map((g, i) => `<li class="${met[i] ? 'ok' : (now >> i & 1) ? 'had' : ''}"><i>★</i><span>${this.goalText(g)}</span>${met[i] && !(before >> i & 1) ? '<em>NEW</em>' : ''}</li>`).join('')}</ul>
      ${coins ? `<p class="cr-coins">${fresh} new star${fresh > 1 ? 's' : ''}: +${coinI}${fmtNum(coins)}</p>` : ''}${prize}${opened.length ? `<p class="cr-prize">Chapter open: ${opened.join(', ')}</p>` : ''}
      ${now & 1 ? '' : `<p class="muted small">Not cleared yet: ${this.goalText(e.goals[0])} to move on.</p>`}</div>`;
  },
  // ── the map (a modal) ──
  render(game) {
    const tot = this.total(), nx = this.next(), sel = this.sel != null ? this.sel : (nx ? nx.ci : this.chapters.length - 1); this.sel = sel; const c = this.chapters[sel];
    const star = (on) => `<i class="${on ? 'on' : ''}">★</i>`;
    $('#crStars').innerHTML = `★ ${tot}<small>/${this.max()}</small>`;
    $('#crBody').innerHTML = `<div class="cr-tabs">${this.chapters.map((ch, i) => { const got = ch.events.reduce((a, e) => a + this.starsOf(e.id), 0), op = this.chapterOpen(ch) && (i === 0 || (this.bits(this.chapters[i - 1].events[3].id) & 1));
        return `<button type="button" class="${i === sel ? 'on' : ''}${op ? '' : ' lock'}" data-ch="${i}"><b>${i + 1}</b><span>${ch.name}</span><small>${op ? `★ ${got}/12` : `🔒 ${tot < ch.need ? ch.need + '★' : 'beat the boss'}`}</small></button>`; }).join('')}</div>
      <p class="cr-line">${c.line}${this.chapterOpen(c) ? '' : ` <b>Needs ${c.need} stars (you have ${tot}).</b>`}</p>
      <div class="cr-list">${c.events.map(e0 => { const e = this.find(e0.id), op = this.open(e), b = this.bits(e.id), t = TRACKS.find(x => x.id === e.track), M = MODES[e.mode], laps = M.fixedLaps || e.laps || 2;
        return `<article class="cr-card${e.boss ? ' boss' : ''}${op ? '' : ' lock'}${nx && nx.id === e.id ? ' next' : ''}">
          <div class="cr-thumb">${trackThumb(t)}</div>
          <div class="cr-info"><h4>${e.boss ? '<em>BOSS</em> ' : ''}${e.name}</h4><p class="cr-meta">${e.boss ? 'One on one' : M.label} · ${t.short} · ${laps} lap${laps > 1 ? 's' : ''}${e.weather === 'monsoon' ? ' · Rain' : ''} · ${DIFFICULTY[e.diff || c.diff].label}</p>
            ${e.boss ? `<p class="cr-say">“${e.say}”</p>` : ''}
            <ul>${e.goals.map((g, i) => `<li class="${b >> i & 1 ? 'ok' : ''}"><i>★</i>${this.goalText(g)}</li>`).join('')}</ul></div>
          <div class="cr-go"><span class="cr-st">${star(b & 1)}${star(b & 2)}${star(b & 4)}</span>${op ? `<button type="button" class="${b & 1 ? 'btn-dark' : 'btn-yellow'}" data-ev="${e.id}">${b & 1 ? 'REPLAY' : 'RACE ›'}</button>` : `<span class="cr-lock">🔒 ${this.chapterOpen(c) ? 'Clear the one before' : c.need + ' stars'}</span>`}</div></article>`; }).join('')}</div>
      ${this.save().don ? '<p class="cr-don">👑 MUMBAI KA DON. Toofan rides behind you now. Go back for every star.</p>' : ''}`;
    $$('#crBody [data-ch]').forEach(b => b.addEventListener('click', () => { AUDIO.click(); this.sel = +b.dataset.ch; this.render(game); }));
    $$('#crBody [data-ev]').forEach(b => b.addEventListener('click', () => { AUDIO.click(); game.ui.closeModal(); game.startCareer(b.dataset.ev); }));
  },
  // the home-screen button: where you are in the story
  renderButton() {
    const el = $('#safarBtn'); if (!el) return; const nx = this.next(), tot = this.total();
    $('#safarSub').textContent = this.save().don && !nx ? 'Mumbai ka Don · every event cleared' : nx ? `${nx.boss ? 'Boss: ' : ''}${nx.name} · ${nx.ch.name}` : `Earn ${this.chapters.find(c => !this.chapterOpen(c)).need} stars to open the next chapter`;
    $('#safarStars').textContent = `★ ${tot}/${this.max()}`;
  },
  // ── in the race: an intro card with the three goals, then three live stars under the minimap ──
  hudStart(game, R) {
    this.hudStop(); const e = this.find(game.career); if (!e) return;
    const el = document.createElement('div'); el.id = 'safarHud'; el.className = 'safar-hud intro';
    el.innerHTML = `<div class="sh-card"><small>SAFAR · ${e.ch.name}</small><b>${e.boss ? 'BOSS: ' : ''}${e.name}</b>${e.boss ? `<q>${e.say}</q>` : ''}<ul>${e.goals.map(g => `<li><i>★</i>${this.goalText(g)}</li>`).join('')}</ul></div>
      <div class="sh-stars" aria-hidden="true">${e.goals.map(() => '<i>★</i>').join('')}</div>`;
    $('#hud').appendChild(el); this.hudEl = el; this.hudState = [0, 0, 0];
    const place = () => { const mm = $('.minimap'); if (!mm) return; const r = mm.getBoundingClientRect(), a = $('#app').getBoundingClientRect(); el.querySelector('.sh-stars').style.cssText = `top:${Math.round(r.bottom - a.top + 6)}px;right:${Math.round(a.right - r.right)}px`; }; place();
    this.hudTimer = setInterval(() => {
      if (game.race !== R || !el.isConnected) return this.hudStop(); if (game.state !== 'race') return;
      if (el.classList.contains('intro')) { place(); if (R.raceT > 1.2) el.classList.remove('intro'); }   // the card stays through the countdown, then gets out of the way
      const stars = el.querySelectorAll('.sh-stars i');
      e.goals.forEach((g, i) => { const st = g.map(c => this.condLive(c, R)), v = st.includes(-1) ? -1 : st.every(x => x === 1) ? 1 : 0;
        if (v !== this.hudState[i]) { this.hudState[i] = v; stars[i].className = v === 1 ? 'on' : v === -1 ? 'off' : ''; if (v === 1 && R.raceT > 2 && !['pos', 'win', 'lead', 'boss', 'clean', 'escape'].includes(g[0][0])) { R.hud.callout('★ ' + this.goalText(g).toUpperCase(), '', 'gold'); AUDIO.pickup(); } } });
    }, 400);
  },
  hudStop() { clearInterval(this.hudTimer); this.hudTimer = 0; if (this.hudEl) this.hudEl.remove(); this.hudEl = null; },
};
