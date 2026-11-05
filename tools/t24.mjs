// Render the music offline (no speakers needed): race song at levels 1→2 and the menu groove; writes WAVs + levels
import { openGame } from './serve-test.mjs';
import fs from 'fs';
const { browser, page, logs } = await openGame({ query: '?test&q=low', width: 320, height: 180 });
try {
  await page.waitForSelector('#menu.show', { timeout: 90000 });
  for (const [name, mode, song, levels, secs] of [['race', 'race', 0, [1, 1, 2, 2], 15], ['race2', 'race', 1, [1, 2], 15], ['menu', 'menu', 2, [0.6], 12]]) {
    const res = await page.evaluate(async ([mode, song, levels, secs]) => {
      const { AUDIO, MUSIC } = window.__audio; const sr = 44100; const oc = new OfflineAudioContext(2, sr * secs, sr);
      const master = oc.createGain(); const comp = oc.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp); comp.connect(oc.destination);
      const len = sr * 2; const nb = oc.createBuffer(1, len, sr); const ch = nb.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      const saved = { ctx: AUDIO.ctx, master: AUDIO.master, noiseBuf: AUDIO.noiseBuf, on: MUSIC.on, timer: MUSIC.timer };
      AUDIO.ctx = oc; AUDIO.master = master; AUDIO.noiseBuf = nb; MUSIC.on = false; clearInterval(MUSIC.timer); MUSIC.init(); clearInterval(MUSIC.timer);
      MUSIC.mode = mode; MUSIC.song = song; MUSIC.out.gain.value = 0.6 * 0.75; MUSIC.tone.frequency.value = 18000;
      let t = 0.05, step = 0, bar = 0; const bpm = mode === 'race' ? 128 : 98, six = 60 / bpm / 4;
      while (t < secs - 0.5) { const sec = Math.floor(t / (secs / levels.length)); MUSIC.level = levels[Math.min(sec, levels.length - 1)];
        MUSIC.dly.delayTime.value = six * 3; MUSIC.playStep(t, step, bar); t += six * (step % 2 ? 0.92 : 1.08); step++; if (step === 16) { step = 0; bar = (bar + 1) % 8; } }
      const buf = await oc.startRendering(); Object.assign(AUDIO, { ctx: saved.ctx, master: saved.master, noiseBuf: saved.noiseBuf }); MUSIC.on = saved.on;
      const L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0, sum = 0; for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); peak = Math.max(peak, v); sum += L[i] * L[i]; }
      const n = L.length, out = new DataView(new ArrayBuffer(44 + n * 4)); const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
      let bin = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return { peak: peak.toFixed(3), rms: Math.sqrt(sum / n).toFixed(4), wav: btoa(bin) };
    }, [mode, song, levels, secs]);
    fs.writeFileSync(`/tmp/claude-0/-home-claude/d0068754-e91d-5433-95b6-3ca794e92c94/scratchpad/music_${name}.wav`, Buffer.from(res.wav, 'base64'));
    console.log(name, 'peak', res.peak, 'rms', res.rms);
  }
} catch (e) { console.log('ERR', e.message.split('\n')[0]); }
if (logs.length) console.log(logs.slice(0, 6).join('\n'));
await browser.close();
