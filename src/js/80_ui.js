// ───────────────────────── MENUS, GARAGE, STORE, SETUP, RESULTS ─────────────────────────
const STAT_ICONS = {
  speed: '<svg viewBox="0 0 24 24"><path d="M12 4a10 10 0 0 0-10 10h3a7 7 0 0 1 14 0h3A10 10 0 0 0 12 4zm4.6 4.4-5.3 4.3a1.6 1.6 0 1 0 2 2z"/></svg>',
  accel: '<svg viewBox="0 0 24 24"><path d="M21 6.5a5 5 0 0 1-6.8 4.7L6 19.4a2 2 0 1 1-2.8-2.8l8.2-8.2A5 5 0 0 1 17.5 2l-3 3 .7 3.8 3.8.7z"/></svg>',
  grip: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke-width="2.6"/><circle cx="12" cy="12" r="3.5"/></svg>',
  brake: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke-width="2.4"/><path d="M12 5v7l5 3" fill="none" stroke-width="2.4"/></svg>',
};
const coinI = '<i class="ico-coin"></i>';
const DAILY_ICON = {
  races: '<svg viewBox="0 0 24 24"><path d="M4 21V3M4 4h13l-2.5 4L17 12H4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 4h3v3H6zM12 4h3v3h-3zM9 7h3v3H9zM6 10h3v2H6zM12 10h3v2h-3z" fill="currentColor"/></svg>',
  wheelies: '<svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="11" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 17l5-6h5l3 0M10 11l-1-3h3M13 11l2-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  knockdowns: '<svg viewBox="0 0 24 24"><path d="M12 2l2 6 6-3-3 6 5 2-6 2 2 6-6-4-6 4 2-6-6-2 5-2-3-6 6 3z" fill="currentColor"/></svg>' };

class UI {
  constructor(game) {
    this.game = game; this.stack = [];
    // generic open / close / back
    document.addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]'); if (o) { AUDIO.click(); this.open(o.dataset.open); return; }
      const c = e.target.closest('[data-close]'); if (c) { AUDIO.click(); this.closeModal(); return; }
      const b = e.target.closest('[data-back]'); if (b) { AUDIO.click(); this.game.toMenu(); return; }
      const soon = e.target.closest('[data-soon]'); if (soon) { this.flashNote(`${soon.dataset.soon} circuits are coming soon. Mumbai is open now.`); return; }
    });
    $('#modalBack').addEventListener('click', () => this.closeModal());
    $('#startBtn').addEventListener('click', () => { AUDIO.click(); this.game.startFromSetup(); });
    $('#rainTog').addEventListener('click', () => { AUDIO.click(); SAVE.setup.weather = SAVE.setup.weather === 'monsoon' ? 'clear' : 'monsoon'; persist(); this.renderMenu(); this.game.previewTrack(SAVE.setup.track); });
    $('#sStart').addEventListener('click', () => { this.closeModal(); this.game.startFromSetup(); });
    $('#policeBtn').addEventListener('click', () => { AUDIO.click(); SAVE.setup.mode = 'police'; persist(); this.renderMenu(); this.game.startFromSetup(); });
    $('#buildPrev').addEventListener('click', () => this.cycleBuild(-1)); $('#buildNext').addEventListener('click', () => this.cycleBuild(1));
    $('#upgradeBtn').addEventListener('click', () => this.open('garage'));
    $('#soundPill').addEventListener('click', () => { AUDIO.init(); this.game.onFirstInteract(); });
    $('#bell').addEventListener('click', () => this.claimLogin());
    $('#profileBtn').addEventListener('click', () => this.open('settings'));
    $$('.nav[data-nav]').forEach(n => n.addEventListener('click', () => { if (n.dataset.nav === 'cup') this.openCup(); }));
    $('#pResume').addEventListener('click', () => this.game.resume());
    $('#pRestart').addEventListener('click', () => { this.closeModal(); this.game.restart(); });
    $('#pSettings').addEventListener('click', () => { this.closeModal(); this.open('settings', true); });
    $('#pQuit').addEventListener('click', () => { this.closeModal(); this.game.quitRace(); });
    $('#pauseBtn').addEventListener('click', () => this.game.pause());
    $('#rAgain').addEventListener('click', () => this.game.restart());
    $('#rNext').addEventListener('click', () => this.game.nextTrack());
    $('#rGarage').addEventListener('click', () => { this.game.toMenu(); this.open('garage'); });
    $('#rMenu').addEventListener('click', () => this.game.toMenu());
    $('#cupGo').addEventListener('click', () => { this.closeModal(); this.game.startCup(); });
    $('#cfNo').addEventListener('click', () => { this.closeModal(); this._cf && this._cf(false); });
    $('#cfYes').addEventListener('click', () => { this.closeModal(); this._cf && this._cf(true); });
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.modalOpen() && this.game.state !== 'race') this.closeModal(); });
    this.garageYaw = 0.6; this.setupDrag();
  }
  modalOpen() { return $$('.modal').some(m => !m.hidden); }
  open(id, fromPause = false) {
    if (id === 'garage') { this.game.showScreen('garage'); this.renderGarage(); return; }
    if (id === 'store') { this.game.showScreen('store'); this.renderStore(); return; }
    if (id === 'setup') this.renderSetup(); if (id === 'settings') this.renderSettings(); if (id === 'howto') this.renderHow(); if (id === 'board') this.renderBoard();
    $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = false; $('#' + id).hidden = false; this.returnToPause = fromPause;
    const f = $('#' + id).querySelector('button'); if (f) f.focus({ preventScroll: true });
  }
  closeModal() { $$('.modal').forEach(m => (m.hidden = true)); $('#modalBack').hidden = true; if (this.returnToPause && this.game.state === 'paused') { this.returnToPause = false; this.open('pause'); } this.renderMenu(); }
  confirm(title, text, yes = 'Yes') { $('#cfTitle').textContent = title; $('#cfText').textContent = text; $('#cfYes').textContent = yes; this.open('confirm'); return new Promise(r => (this._cf = r)); }
  flashNote(text) { { const n = document.createElement('div'); n.className = 'callout info'; n.style.cssText = 'position:absolute;left:50%;top:18%;translate:-50% 0;z-index:40;font-size:1.6rem;white-space:normal;max-width:80vw;text-align:center'; n.textContent = text; $('#app').appendChild(n); setTimeout(() => n.remove(), 1700); } }
  // ── main menu ──
  renderMenu() {
    $$('#coins, .coinsMirror').forEach(e => (e.textContent = fmtNum(SAVE.coins))); $$('#parts, .partsMirror').forEach(e => (e.textContent = SAVE.parts));
    const st = buildStats(SAVE.build); const b = st.build;
    $('#bcName').textContent = BIKE_NAME; $('#bcTag').textContent = b.name.toUpperCase();
    $('#bcStats').innerHTML = this.statRows(st, false);
    const L = levelFromXp(SAVE.xp); $('#lvNum').textContent = L.lvl; $('#xpTxt').textContent = `${fmtNum(L.into)} / ${fmtNum(L.need)}`; $('#xpBar').style.width = (L.into / L.need * 100).toFixed(1) + '%';
    $('#pName').textContent = SAVE.name; $('#pLv').textContent = L.lvl; $('#pXp').style.width = (L.into / L.need * 100).toFixed(1) + '%';
    $('#upDot').hidden = !this.canUpgradeSomething();
    const s = SAVE.setup; const M = MODES[s.mode]; const t = TRACKS.find(x => x.id === (M.track || s.track)) || TRACKS[0];
    { const wet = SAVE.setup.weather === 'monsoon'; const rt = $('#rainTog'); rt.classList.toggle('on', wet); rt.setAttribute('aria-pressed', wet); rt.querySelector('span').textContent = wet ? 'Rain on' : 'Rain off'; }
    $('#setupLine').textContent = `${M.label} · ${t.short} · ${M.fixedLaps || s.laps} lap${(M.fixedLaps || s.laps) > 1 ? 's' : ''} · ${DIFFICULTY[s.diff].label}${s.weather === 'monsoon' ? ' · Rain' : ''}`;
    // daily challenges
    const d = SAVE.daily; let html = ''; let allDone = true;
    for (const c of DAILY) { const p = Math.min(c.goal, d.prog[c.id] || 0); const done = p >= c.goal; if (!d.claimed[c.id]) allDone = false;
      html += `<li class="${done ? 'done' : ''}"><span class="chk">${DAILY_ICON[c.id] || ''}</span><span class="lbl">${c.label}<i class="dbar"><b style="width:${(p / c.goal * 100).toFixed(0)}%"></b></i></span><span class="prog">${p} / ${c.goal}</span>${done && !d.claimed[c.id] ? `<button class="claim" data-claim="${c.id}" type="button">CLAIM ${c.reward}</button>` : `<span class="rw">${d.claimed[c.id] ? '✓' : ''}${coinI}${c.reward}</span>`}</li>`; }
    $('#dailyList').innerHTML = html;
    $$('[data-claim]').forEach(btn => btn.addEventListener('click', () => { const c = DAILY.find(x => x.id === btn.dataset.claim); SAVE.daily.claimed[c.id] = true; SAVE.coins += c.reward; persist(); AUDIO.pickup(); this.renderMenu(); }));
    const bonus = $('#dailyBonus');
    if (allDone && !d.bonus) { bonus.innerHTML = `<button class="claim" type="button" id="claimBonus">CLAIM +${DAILY_BONUS_ALL} BONUS</button>`; $('#claimBonus').addEventListener('click', () => { SAVE.daily.bonus = true; SAVE.coins += DAILY_BONUS_ALL; persist(); AUDIO.pickup(); this.renderMenu(); }); }
    else bonus.textContent = d.bonus ? 'All done for today. New challenges tomorrow.' : `→ ALL 3 DONE → +${DAILY_BONUS_ALL} BONUS`;
    $('#bellDot').hidden = SAVE.lastLogin === todayStr();
  }
  statRows(st, withUp) {
    const rows = [['speed', 'SPEED', st.top / 140, Math.round(st.top)], ['accel', 'ACCEL', clamp((12 - st.zeroTo100) / 8, 0.05, 1), st.zeroTo100.toFixed(1) + 's'], ['grip', 'GRIP', (st.lean - 38) / 18, (st.grip * 4.2).toFixed(1)], ['brake', 'BRAKES', (st.brake - 0.6) / 0.9, (st.brake * 4.1).toFixed(1)]];
    return rows.map(([k, label, f, val]) => `<div class="stat">${STAT_ICONS[k]}<span>${label}</span><span class="bar"><i class="${withUp ? 'up' : ''}" style="width:${(clamp(f, 0.04, 1) * 100).toFixed(0)}%"></i></span><b>${val}</b></div>`).join('');
  }
  cycleBuild(dir) { const owned = BUILDS.filter(b => SAVE.owned[b.id]); let i = owned.findIndex(b => b.id === SAVE.build); i = (i + dir + owned.length) % owned.length; SAVE.build = owned[i].id; persist(); AUDIO.click(); this.renderMenu(); this.game.refreshMenuRig(); }
  canUpgradeSomething() { const b = BUILDS.find(x => x.id === SAVE.build); const u = SAVE.upgrades[b.id] || {}; return UPGRADES.some(up => (u[up.id] || 0) < 5 && SAVE.coins >= upgradeCost(b, u[up.id] || 0) && SAVE.parts > 0); }
  claimLogin() {
    if (SAVE.lastLogin === todayStr()) { this.flashNote('Daily bonus already collected. Come back tomorrow!'); return; }
    const y = new Date(); y.setDate(y.getDate() - 1); const yStr = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    SAVE.loginDays = SAVE.lastLogin === yStr ? Math.min(7, SAVE.loginDays + 1) : 1; SAVE.lastLogin = todayStr();
    const amt = [100, 200, 300, 450, 600, 800, 1000][SAVE.loginDays - 1]; SAVE.coins += amt; persist(); AUDIO.pickup();
    this.flashNote(`Day ${SAVE.loginDays} bonus: +${amt} coins`); this.renderMenu();
  }
  // ── garage ──
  renderGarage(selId) {
    this.gSel = selId || this.gSel || SAVE.build; const b = BUILDS.find(x => x.id === this.gSel); const owned = !!SAVE.owned[b.id];
    $$('.coinsMirror').forEach(e => (e.textContent = fmtNum(SAVE.coins))); $$('.partsMirror').forEach(e => (e.textContent = SAVE.parts));
    $('#buildList').innerHTML = BUILDS.map(x => `<button type="button" class="bl-item ${x.id === this.gSel ? 'sel' : ''} ${x.id === SAVE.build ? 'riding' : ''}" data-b="${x.id}"><span class="sw" style="background:${SAVE.paint[x.id] || x.tank}"></span><span><b>${x.name}</b><small>${x.tag}</small></span><span class="cost">${x.id === SAVE.build ? 'RIDING' : SAVE.owned[x.id] ? 'OWNED' : coinI + fmtNum(x.cost)}</span></button>`).join('');
    $$('#buildList [data-b]').forEach(el => el.addEventListener('click', () => { AUDIO.click(); this.renderGarage(el.dataset.b); this.game.refreshMenuRig(el.dataset.b); }));
    const st = buildStats(b.id); $('#gName').textContent = b.name; $('#gNote').textContent = b.note; $('#gStats').innerHTML = this.statRows(st, true);
    const u = SAVE.upgrades[b.id] || {};
    $('#upgrades').innerHTML = UPGRADES.map(up => { const lvl = u[up.id] || 0; const cost = lvl < 5 ? upgradeCost(b, lvl) : 0; const can = owned && lvl < 5 && SAVE.coins >= cost && SAVE.parts > 0;
      return `<div class="up-row"><span><b>${up.name}</b> <small>${up.desc}</small></span><button type="button" data-up="${up.id}" ${can ? '' : 'disabled'}>${lvl >= 5 ? 'MAX' : `${coinI}${fmtNum(cost)} +<i class="ico-wrench dark"></i>1`}</button><span class="pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></div>`; }).join('');
    $$('[data-up]').forEach(btn => btn.addEventListener('click', () => { const id = btn.dataset.up; const lvl = (SAVE.upgrades[b.id] || {})[id] || 0; const cost = upgradeCost(b, lvl); if (SAVE.coins < cost || SAVE.parts < 1) return; SAVE.coins -= cost; SAVE.parts -= 1; SAVE.upgrades[b.id] = Object.assign({}, SAVE.upgrades[b.id], { [id]: lvl + 1 }); persist(); AUDIO.pickup(); this.renderGarage(); }));
    // custom mods: bought once, fitted to any owned bike
    const md = modsFor(b.id), ownMod = (slot, it) => it.cost === 0 || SAVE.ownedMods[slot + ':' + it.id] || (slot === 'finish' && it.id === 'chrome' && b.chrome);
    $('#mods').innerHTML = Object.entries(MODS).map(([slot, S]) => `<div class="mod-row"><span>${S.label}</span><div class="chips">${S.items.map(it => `<button type="button" class="chip ${md[slot] === it.id ? 'on' : ''} ${ownMod(slot, it) ? '' : 'locked'}" data-mod="${slot}:${it.id}">${it.name}${ownMod(slot, it) ? '' : `<small>${coinI}${fmtNum(it.cost)}</small>`}</button>`).join('')}</div></div>`).join('');
    $('#modNote').textContent = this.modNote || (owned ? 'Tap a part to fit it. Parts you buy fit every bike you own.' : 'Unlock this build to fit parts.');
    $$('[data-mod]').forEach(btn => btn.addEventListener('click', async () => { const [slot, id] = btn.dataset.mod.split(':'); const it = modItem(slot, id);
      if (!owned) { this.modNote = 'Unlock this build first.'; this.renderGarage(); return; }
      if (!ownMod(slot, it)) { if (SAVE.coins < it.cost) { this.modNote = `${it.name} costs ${fmtNum(it.cost)} coins. Win races to earn more.`; AUDIO.warn(); this.renderGarage(); return; }
        if (!(await this.confirm(`Buy ${it.name}?`, `${it.note ? it.note + ". " : ""}Spend ${fmtNum(it.cost)} coins? It fits every bike you own.`, 'Buy'))) return;
        SAVE.coins -= it.cost; SAVE.ownedMods[slot + ':' + id] = true; AUDIO.pickup(); this.game.showScreen('garage'); }
      else AUDIO.click();
      SAVE.mods[b.id] = Object.assign({}, md, { [slot]: id }); persist(); this.modNote = `${MODS[slot].label}: ${it.name}${it.note ? ' — ' + it.note : ''}`; this.renderGarage(); this.game.refreshMenuRig(b.id); }));
    $('#paints').innerHTML = PAINTS.map(p => `<button type="button" aria-label="Paint ${p}" data-paint="${p}" class="${(SAVE.paint[b.id] || b.tank) === p ? 'on' : ''}" style="background:${p}"></button>`).join('');
    $$('[data-paint]').forEach(btn => btn.addEventListener('click', () => { if (!owned) return; SAVE.paint[b.id] = btn.dataset.paint; persist(); AUDIO.click(); this.renderGarage(); this.game.refreshMenuRig(b.id); }));
    const act = $('#gAction');
    if (b.id === SAVE.build) { act.textContent = 'RIDING THIS BUILD'; act.disabled = true; }
    else if (owned) { act.textContent = 'RIDE THIS BUILD'; act.disabled = false; act.onclick = () => { SAVE.build = b.id; persist(); AUDIO.pickup(); this.renderGarage(); this.game.refreshMenuRig(b.id); }; }
    else { act.innerHTML = `UNLOCK ${coinI} ${fmtNum(b.cost)}`; act.disabled = SAVE.coins < b.cost; act.onclick = async () => { if (SAVE.coins < b.cost) return; if (!(await this.confirm('Unlock build?', `Spend ${fmtNum(b.cost)} coins on the ${b.name}?`, 'Unlock'))) return; SAVE.coins -= b.cost; SAVE.owned[b.id] = true; SAVE.build = b.id; persist(); AUDIO.finish(true); this.game.showScreen('garage'); this.renderGarage(); this.game.refreshMenuRig(b.id); }; }
  }
  setupDrag() { const stage = $('.garage-stage'); let x0 = null; stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; stage.setPointerCapture(e.pointerId); }); stage.addEventListener('pointermove', (e) => { if (x0 === null) return; this.garageYaw += (e.clientX - x0) * 0.01; x0 = e.clientX; this.dragT = 2; }); stage.addEventListener('pointerup', () => (x0 = null)); }
  // ── store ──
  renderStore() {
    $$('.coinsMirror').forEach(e => (e.textContent = fmtNum(SAVE.coins)));
    const col = (key, title) => `<div class="panel store-col"><h3>${title}</h3>${COSMETICS[key].map(it => { const own = SAVE.ownedCos[it.id] || it.cost === 0; const on = SAVE.cos[key] === it.id;
      return `<button type="button" class="store-item ${on ? 'on' : ''}" data-cos="${key}:${it.id}"><span class="sw" style="background:${it.base || it.color || 'repeating-linear-gradient(45deg,#333 0 6px,#444 6px 12px)'}"></span><span><b>${it.name}</b></span><span class="cost">${on ? 'WEARING' : own ? 'OWNED' : coinI + fmtNum(it.cost)}</span></button>`; }).join('')}</div>`;
    $('#storeBody').innerHTML = col('shirt', 'SHIRTS') + col('hair', 'HAIR') + col('helmet', 'HELMETS') + col('shades', 'SHADES');
    $$('[data-cos]').forEach(btn => btn.addEventListener('click', async () => { const [key, id] = btn.dataset.cos.split(':'); const it = COSMETICS[key].find(x => x.id === id); const own = SAVE.ownedCos[id] || it.cost === 0;
      if (!own) { if (SAVE.coins < it.cost) { this.flashNote('Not enough coins yet. Race to earn more.'); return; } if (!(await this.confirm('Buy?', `Spend ${fmtNum(it.cost)} coins on ${it.name}?`, 'Buy'))) { this.game.showScreen('store'); return; } SAVE.coins -= it.cost; SAVE.ownedCos[id] = true; this.game.showScreen('store'); }
      SAVE.cos[key] = id; persist(); AUDIO.pickup(); this.renderStore(); this.game.refreshMenuRig(); }));
  }
  // ── race setup ──
  renderSetup() {
    const s = SAVE.setup; const M = MODES[s.mode];
    const seg = (el, opts, cur, cb, disabled = () => false) => { $(el).innerHTML = opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" ${disabled(v) ? 'disabled' : ''}>${l}</button>`).join(''); $$(el + ' button').forEach(b => b.addEventListener('click', () => { cb(b.dataset.v); persist(); AUDIO.click(); this.renderSetup(); })); };
    seg('#sMode', Object.entries(MODES).filter(([k]) => k !== 'cup').map(([k, m]) => [k, m.label]), s.mode, v => { s.mode = v; if (MODES[v].track) this.game.previewTrack(MODES[v].track); });
    $('#sModeDesc').textContent = M.desc;
    const tSel = M.track || s.track;
    $('#sTracks').innerHTML = TRACKS.map(t => `<button type="button" class="tcard ${t.id === tSel ? 'on' : ''}" ${M.track && t.id !== M.track ? 'disabled' : ''} data-track="${t.id}">${trackThumb(t)}<b>${t.short}</b><small>${(t.target / 1000).toFixed(1)} km · ${t.lapTarget}</small></button>`).join('');
    $$('[data-track]').forEach(b => b.addEventListener('click', () => { s.track = b.dataset.track; persist(); AUDIO.click(); this.renderSetup(); this.game.previewTrack(s.track); }));
    const lapOpts = [[1, '1'], [3, '3'], [5, '5']]; if (M.fixedLaps && ![1, 3, 5].includes(M.fixedLaps)) lapOpts.splice(1, 0, [M.fixedLaps, String(M.fixedLaps)]);
    seg('#sLaps', lapOpts, M.fixedLaps || s.laps, v => (s.laps = +v), () => !!M.fixedLaps);
    seg('#sDiff', [['easy', 'Easy 0.8×'], ['normal', 'Normal 1×'], ['hard', 'Hard 1.5×']], s.diff, v => (s.diff = v), () => !M.rivals && !M.police);
    seg('#sTime', [['auto', 'Track default'], ['morning', 'Morning'], ['golden', 'Golden hour'], ['night', 'Night']], s.time, v => { s.time = v; this.game.previewTrack(s.track); });
    seg('#sWeather', [['clear', 'No rain'], ['monsoon', 'Rain']], s.weather, v => { s.weather = v; this.game.previewTrack(s.track); });
    seg('#sCombat', [['true', 'On'], ['false', 'Off']], M.combat === 'force' ? true : M.combat ? s.combat : false, v => (s.combat = v === 'true'), () => M.combat === 'force' || !M.combat);
  }
  // ── championship ──
  openCup() {
    const s = SAVE.setup; const best = SAVE.records.cupBest;
    $('#cupBody').innerHTML = `<p>Race all five Mumbai circuits back to back against the same seven rivals. Points carry over: ${CUP_POINTS.join(' · ')} for 1st to 8th. Coins are paid after every round, plus a cup bonus at the end.</p>
      <table class="cup-table"><tr><th>#</th><th>Track</th><th>Length</th></tr>${CUP_TRACKS.map((t, i) => `<tr><td>${i + 1}</td><td>${t.short}</td><td class="n">${(t.target / 1000).toFixed(1)} km</td></tr>`).join('')}</table>
      <h4>Settings</h4><p class="muted small">${s.laps} laps per round · ${DIFFICULTY[s.diff].label} rivals · combat ${s.combat ? 'on' : 'off'} (change these in Race Setup)${best ? ` · Your best cup finish: ${best}${ordinal(best).toLowerCase()}` : ''}</p>`;
    this.open('cupModal');
  }
  // ── settings ──
  renderSettings() {
    const S = SAVE.settings;
    const tog = (id, label, val, hint = '') => `<div class="set-row"><label for="${id}">${label}${hint ? `<br><small class="muted">${hint}</small>` : ''}</label><div class="seg"><button type="button" id="${id}" data-tog="${id}" class="${val ? 'on' : ''}">On</button><button type="button" data-tog-off="${id}" class="${!val ? 'on' : ''}">Off</button></div></div>`;
    const keys = keymap(); const nice = (c) => (c || '').replace('Key', '').replace('Arrow', '').replace('Left', ' L').replace('Right', ' R').replace('Digit', '');
    $('#settingsBody').innerHTML = `
      <div class="set-row"><label for="setName">Rider name</label><input id="setName" type="text" maxlength="16" value="${SAVE.name.replace(/"/g, '')}"></div>
      <div class="set-row"><label for="setSfx">Effects volume</label><input id="setSfx" type="range" min="0" max="1" step="0.05" value="${S.sfx}"></div>
      <div class="set-row"><label for="setEng">Engine volume</label><input id="setEng" type="range" min="0" max="1" step="0.05" value="${S.engine}"></div>
      <div class="set-row"><label for="setMusic">Music volume<br><small class="muted">Original chapri DJ beats</small></label><input id="setMusic" type="range" min="0" max="1" step="0.05" value="${S.music ?? 0.6}"></div>
      <div class="set-row"><label>Camera</label><div class="seg" id="setCam">${['Chase', 'Far', 'Helmet'].map((n, i) => `<button type="button" data-cam="${i}" class="${S.camera === i ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="set-row"><label>Graphics quality<br><small class="muted">Auto picks a tier from a short benchmark${S.detected ? ` (picked ${S.detected})` : ''}</small></label><div class="seg" id="setQ">${['auto', 'low', 'medium', 'high'].map(q => `<button type="button" data-q="${q}" class="${S.quality === q ? 'on' : ''}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
      ${tog('setComic', 'Comic-book style', S.comic, 'Ink outlines, halftone shading and DHISHOOM pop-ups. Off on Low graphics')}
      ${tog('setWA', 'Wheelie assist', S.wheelieAssist, 'Holds the balance point for you')}
      ${tog('setMG', 'Manual gears', S.manualGears, 'Shift with X / Z')}
      ${IS_TOUCH ? tog('setTilt', 'Tilt to lean', S.tilt, 'Steer by tilting your phone') : ''}
      ${tog('setVib', 'Vibration', S.vibration)}
      <h4>Keyboard (click a key to change it)</h4><div class="keys">${Object.keys(KEY_LABELS).map(a => `<div class="k"><span>${KEY_LABELS[a]}</span><button type="button" data-key="${a}">${nice(keys[a][0])}</button></div>`).join('')}</div>
      <div class="set-row"><label>Progress</label><div style="display:flex;gap:.5rem"><button class="btn-dark" type="button" id="resetKeys">Reset keys</button><button class="btn-dark" type="button" id="resetAll">Reset progress</button></div></div>`;
    $('#setName').addEventListener('change', (e) => { SAVE.name = (e.target.value || 'Rider').slice(0, 16); persist(); this.renderMenu(); });
    $('#setSfx').addEventListener('input', (e) => { S.sfx = +e.target.value; AUDIO.applyVolumes(); persist(); });
    $('#setEng').addEventListener('input', (e) => { S.engine = +e.target.value; AUDIO.applyVolumes(); persist(); });
    $('#setMusic').addEventListener('input', (e) => { S.music = +e.target.value; AUDIO.applyVolumes(); persist(); });
    $$('[data-cam]').forEach(b => b.addEventListener('click', () => { S.camera = +b.dataset.cam; persist(); this.renderSettings(); }));
    $$('[data-q]').forEach(b => b.addEventListener('click', () => { S.quality = b.dataset.q; persist(); this.renderSettings(); this.game.applyQuality(true); }));
    const map = { setComic: 'comic', setWA: 'wheelieAssist', setMG: 'manualGears', setTilt: 'tilt', setVib: 'vibration' };
    $$('[data-tog]').forEach(b => b.addEventListener('click', async () => { const k = map[b.dataset.tog]; S[k] = true; if (k === 'tilt' && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { try { await DeviceOrientationEvent.requestPermission(); } catch (_) {} } persist(); this.renderSettings(); }));
    $$('[data-tog-off]').forEach(b => b.addEventListener('click', () => { S[map[b.dataset.togOff]] = false; persist(); this.renderSettings(); }));
    $$('[data-key]').forEach(b => b.addEventListener('click', () => { b.classList.add('listen'); b.textContent = 'press…'; INPUT.listenCb = (code) => { const a = b.dataset.key; S.keys = Object.assign({}, S.keys || {}, { [a]: [code] }); persist(); this.renderSettings(); }; }));
    $('#resetKeys').addEventListener('click', () => { S.keys = null; persist(); this.renderSettings(); });
    $('#resetAll').addEventListener('click', async () => { if (await this.confirm('Reset all progress?', 'This clears coins, builds, upgrades, records and settings on this device.', 'Reset')) { const keep = SAVE.settings; SAVE = defaultSave(); SAVE.settings = keep; persist(); this.renderMenu(); this.game.refreshMenuRig(); } else this.open('settings'); });
  }
  renderHow() {
    const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
    $('#howBody').innerHTML = `<div class="how-grid">
      <div><h4>Riding</h4><table>${row('Throttle', 'W / ↑ · GAS')}${row('Front brake (hard at speed = stoppie)', 'S / ↓ · BRAKE')}${row('Lean left / right', 'A D / ← → · ◀ ▶')}${row('Rear brake + lean + throttle = power-slide', 'Space · DRIFT')}${row('Weight back: wheelie in 1st/2nd', 'Q · bike icon')}${row('Two-stroke kick (boost)', 'Shift · yellow bottle')}${row('Camera / respawn / horn', 'C / R / H')}${row('Pause', 'P / Esc')}</table></div>
      <div><h4>Fighting</h4><table>${row('Hit left / right (kick, chain or belt)', 'J / L · MAAR')}${row('Throw bottle / spit gutka', 'K · THROW')}${row('Kick: 1 m reach, 1 s cooldown', '∞')}${row('Belt: 1.5 m, 3 quick hits = combo', '×8')}${row('Chain: 2 m, heavy, slow wind-up', '×6')}${row('Beer bottle: thrown up to 15 m, misses leave glass', '×1')}${row('Gutka thuk: 3 m, blinds for 1.5 s', '×3')}</table>
        <p class="muted small">No fighting in the first 10 seconds. Pick up weapons by riding through them. Lean away or brake to dodge; a red ! marks a rival winding up.</p></div>
      <div><h4>Points (× difficulty)</h4><table>${row('Finish 1st → 8th', '500 … 20')}${row('Overtake (+25 chained)', '50')}${row('Squeeze pass in a narrow lane', '+30')}${row('Knockdown (Gali Rumble: 400)', '150')}${row('Hit landed / dodge', '20 / 25')}${row('Wheelie (1 per metre)', '≤ 150')}${row('Power-slide (½ per metre)', '≤ 150')}${row('Air time / stoppie', '30–50 / 20–80')}${row('Clean race / lap record', '150 / 100')}</table></div>
      <div><h4>The road</h4><table>${row('Gaddha (pothole): drops you in, costs speed. Big ones throw you up', '⚠')}${row('Speed breakers, single or teen-in-a-row: slow down or fly', '50 km/h')}${row('Kichad (mud): slippery, slows you, rear steps out. Worse in rain', '⚠')}${row('Shortcut: a kachha lane past the stalls on some corners. Shorter, but rough', '⇢')}${row('Plank ramps: hit them straight and fly over the autos and carts. Grab the coins in the air', '↗')}${row('Rooftops (Dharavi), halls and the railway under Sion flyover: keep your speed up to clear the gaps', '!')}${row('Rain (button on the home screen): the road turns to a mirror and grip drops. Brake early, lean less', '☔')}</table></div>
      <div><h4>Police Express+</h4><table>${row('Solo escape on Bhaag Chapri Bhaag. Finish 2 laps before the BUSTED meter fills', '🚨')}${row('Cops close to you fill the meter; crashing near them fills it fast. Get 12 m clear and it drains', '12 m')}${row('Nakabandi: hit the yellow ramps and fly over the barricades. Smashing through costs speed and heat', '↗')}${row('A red laser means a rifle is locked on you. Swerve before the shot', '⦿')}${row('Kick or hit the cops off their bikes. Watch for stray dogs, the steps and the flooded nala', '🐕')}</table></div>
      <div><h4>Garage mods</h4><table>${row('Silencers: lambi pipe, twin upswept, dragon mouth (fire on boost)', '🔥')}${row('Mota or racing tyres, crash guard with fog lamps, café cowl', '⚙')}${row('Paint and finish: gloss, matte, metal flake, chrome. Bought once, fits every bike', '🎨')}</table></div>
      <div><h4>Tips</h4><table>${row('Brake upright, then lean. Braking and leaning share one grip budget.', '')}${row('Keep the needle in the yellow powerband out of corners.', '')}${row('Slide 90° gali corners instead of braking to a crawl.', '')}${row('Sit in a rival\'s slipstream to fill the kick meter.', '')}${row('A full wobble meter throws you off. Straighten up to recover.', '')}</table></div></div>
      <p class="muted small credits">3D bike: <a href="https://sketchfab.com/3d-models/rx100-bike-06a03105792a418bba751e67506d4e86" target="_blank" rel="noopener">“RX100 BIKE”</a> by <a href="https://sketchfab.com/patilaryush" target="_blank" rel="noopener">patilaryush</a>, licensed <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Modified for this game: rebadged CR100, repaintable tank, centre stand removed, resized and simplified.${BIKE_MODEL.ready ? '' : ' (Not loaded on this device; the built-in bike is shown.)'}<br>Riders: base body and hair from <a href="https://quaternius.com/packs/universalbasecharacters.html" target="_blank" rel="noopener">Universal Base Characters</a> by Quaternius (CC0), slimmed down and dressed for Chapri Racer.<br>Music: original chapri DJ beats, made for this game.</p>`;
  }
  renderBoard() {
    const rows = TRACKS.map(t => { const r = SAVE.records[t.id] || {}; return `<tr><td>${t.short}</td><td class="n">${r.bestLap ? fmtTime(r.bestLap) : '—'}</td><td class="n">${r.bestStunt ? fmtNum(r.bestStunt) : '—'}</td><td class="n">${r.bestPos ? r.bestPos + ordinal(r.bestPos).toLowerCase() : '—'}</td></tr>`; }).join('');
    $('#boardBody').innerHTML = `<div class="board-tabs seg"><button type="button" class="on">Your records</button><button type="button" disabled>Global</button><button type="button" disabled>Friends</button><button type="button" disabled>Weekly</button></div>
      <table class="board-table"><tr><th>Track</th><th style="text-align:right">Best lap</th><th style="text-align:right">Best stunt run</th><th style="text-align:right">Best finish</th></tr>${rows}</table>
      <p class="muted small">Races won: ${SAVE.wins} · Races finished: ${SAVE.races}. Global, friends and weekly boards switch on with the online room server.</p>`;
  }
  // ── results ──
  renderResults(R, res) {
    $('#rPos').textContent = res.posText; $('#rPosSuf').textContent = res.posSuf; $('#rTitle').textContent = res.title; $('#rSub').textContent = res.sub;
    $('#rList').innerHTML = res.items.map(([l, v]) => `<li><span>${l}</span><b>+${fmtNum(v)}</b></li>`).join('') || '<li><span>No points this time</span><b>+0</b></li>';
    $('#rTotal').textContent = '+' + fmtNum(res.total); $('#rMult').textContent = res.multText;
    $('#rOrder').innerHTML = res.order.map((r, i) => `<li class="${r.isPlayer ? 'me' : ''}"><span>${i + 1}</span><b>${r.isPlayer ? SAVE.name + ' (You)' : r.name}</b><small>${r.eliminated ? 'OUT' : r.finished ? fmtTime(r.laps.reduce((a, b) => a + b, 0)) : 'racing'}</small></li>`).join('');
    const d = SAVE.daily; $('#rDaily').innerHTML = '<h3>DAILY CHALLENGES</h3>' + DAILY.map(c => `<div>${(d.prog[c.id] || 0) >= c.goal ? '✅' : '⬜'} ${c.label} <span class="muted">${Math.min(c.goal, d.prog[c.id] || 0)}/${c.goal}</span></div>`).join('') + (res.cupTable || '');
    $('#rNext').textContent = this.game.cup ? (this.game.cup.idx < CUP_TRACKS.length - 1 ? 'NEXT ROUND ›' : 'CUP RESULTS ›') : 'NEXT TRACK ›';
  }
}
function trackThumb(t) {
  const P = []; let raw = t.pts; let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; raw.forEach(([x, z]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); });
  const sc = 80 / Math.max(maxX - minX, maxZ - minZ); const c = new THREE.CatmullRomCurve3(raw.map(([x, z]) => new THREE.Vector3((x - (minX + maxX) / 2) * sc + 60, 0, (z - (minZ + maxZ) / 2) * sc + 50)), true, 'centripetal');
  const pts = c.getPoints(80).map(p => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' ');
  const bg = { city: '#5b2c86,#e0589a', market: '#c96f4a,#ffb067', basti: '#3e8e8a,#c96f4a', sea: '#0b1a30,#3a6f8a', flyover: '#4a2a5c,#ff8a1f' }[t.theme].split(',');
  return `<svg viewBox="0 0 120 100" aria-hidden="true"><defs><linearGradient id="g${t.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="120" height="100" fill="url(#g${t.id})"/><polyline points="${pts}" fill="none" stroke="#160a12" stroke-width="7" stroke-linejoin="round"/><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
}
