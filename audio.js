/* 宝の迷宮 - サウンド（Web Audio 合成・完全オフライン）
   BGM: タイトル / 迷路3種 / スキル画面 / クリア(盛大・ひかえめ)
   起動中は常に何かが鳴る方針。初回タップで自動アンロック。 */
const Snd = (() => {
'use strict';
let ctx = null, master = null, musG = null, schedT = null, stepIdx = 0, nextT = 0;
let cur = null, pending = 'title', enabled = true;

function midi2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

/* ---- 曲データ構築ヘルパ ---- */
function track(wave, vol, notes) {
  const byStep = {};
  for (const n of notes) { (byStep[n[0]] = byStep[n[0]] || []).push([n[1], n[2]]); }
  return { wave, vol, byStep };
}
function melTrack(wave, vol, arr) {
  const notes = [];
  arr.forEach((m, i) => { if (m) notes.push([i, m, 1]); });
  return track(wave, vol, notes);
}
function arpNotes(chords, stepsPerChord, pattern, stepLen) {
  const out = [];
  chords.forEach((ch, ci) => {
    pattern.forEach((p, k) => {
      if (p == null) return;
      out.push([ci * stepsPerChord + k * stepLen, ch[p % ch.length] + 12 * Math.floor(p / ch.length), stepLen]);
    });
  });
  return out;
}
function bassNotes(roots, stepsPerChord) {
  const out = [];
  roots.forEach((r, ci) => {
    out.push([ci * stepsPerChord, r, 3], [ci * stepsPerChord + stepsPerChord / 2, r + 7, 3]);
  });
  return out;
}

const SONGS = {};
/* タイトル：少し明るい 約16秒ループ */
(() => {
  const mel = [
    76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 72, 0, 74, 76,
    76, 0, 79, 0, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0, 74, 0,
    72, 0, 74, 76, 79, 0, 76, 0, 74, 0, 76, 79, 81, 0, 79, 76,
    84, 0, 81, 79, 76, 0, 79, 0, 74, 0, 76, 74, 72, 0, 0, 0];
  SONGS.title = { bpm: 126, loopSteps: 64, tracks: [
    melTrack('square', 0.12, mel),
    track('triangle', 0.16, bassNotes([48, 45, 53, 55, 48, 45, 50, 55], 8)),
  ]};
})();
/* 迷路BGM 3種（おとなしめ） */
SONGS.maze1 = { bpm: 84, loopSteps: 64, tracks: [
  track('triangle', 0.10, arpNotes([[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], 16, [0, 1, 2, 1, 3, 1, 2, 1], 2)),
  track('sine', 0.12, bassNotes([45, 41, 43, 40], 16)),
]};
SONGS.maze2 = { bpm: 74, loopSteps: 64, tracks: [
  track('sine', 0.11, arpNotes([[62, 65, 69], [58, 62, 65], [57, 60, 65], [60, 64, 67]], 16, [0, 1, 2, 3, 2, 1, 0, 1], 2)),
  track('triangle', 0.10, bassNotes([50, 46, 53, 48], 16)),
]};
SONGS.maze3 = { bpm: 92, loopSteps: 64, tracks: [
  track('sine', 0.10, arpNotes([[72, 76, 79], [71, 74, 79], [69, 72, 76], [69, 72, 77]], 16, [0, 1, 2, 1, 0, 2, 1, 2], 2)),
  track('triangle', 0.09, bassNotes([48, 43, 45, 41], 16)),
]};
/* パッシブスキル画面：専用の神秘的なBGM */
SONGS.skill = { bpm: 66, loopSteps: 64, tracks: [
  track('triangle', 0.10, arpNotes([[57, 61, 64], [59, 63, 66], [57, 61, 64], [55, 59, 62]], 16, [0, 1, 2, 3], 4)),
  track('sine', 0.07, [[8, 81, 2], [24, 79, 2], [40, 83, 2], [56, 78, 2]]),
]};
/* クリア（目標達成＝高揚感） */
(() => {
  const mel = [72, 0, 76, 0, 79, 0, 84, 0, 83, 81, 79, 81, 83, 0, 84, 0,
               84, 0, 79, 0, 81, 0, 76, 0, 79, 76, 74, 76, 72, 0, 0, 0];
  SONGS.clearBig = { bpm: 148, loopSteps: 32, tracks: [
    melTrack('square', 0.13, mel),
    track('triangle', 0.16, bassNotes([48, 55, 53, 48], 8)),
  ]};
})();
/* クリア（目標超過＝ひかえめ） */
SONGS.clearSoft = { bpm: 80, loopSteps: 32, tracks: [
  track('sine', 0.10, arpNotes([[72, 76, 79], [69, 72, 77]], 16, [0, 1, 2, 1], 4)),
  track('triangle', 0.09, bassNotes([48, 41], 16)),
]};

/* ---- エンジン ---- */
function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = enabled ? 0.9 : 0; master.connect(ctx.destination);
  musG = ctx.createGain(); musG.gain.value = 1; musG.connect(master);
  ctx.addEventListener('statechange', () => {
    if (ctx.state === 'running' && pending) { const p = pending; pending = null; bgm(p); }
  });
  return true;
}
function unlock() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
  else if (pending) { const p = pending; pending = null; bgm(p); }
}
document.addEventListener('pointerdown', unlock, true);

function bgm(name) {
  cur = name;
  if (!enabled) return;
  if (!ensure() || ctx.state !== 'running') { pending = name; return; }
  _stopSched();
  const s = SONGS[name]; if (!s) return;
  stepIdx = 0; nextT = ctx.currentTime + 0.06;
  const spb = 60 / s.bpm / 2;
  schedT = setInterval(() => _sched(s, spb), 90);
  _sched(s, spb);
}
function _stopSched() { if (schedT) { clearInterval(schedT); schedT = null; } }
function _sched(s, spb) {
  while (nextT < ctx.currentTime + 0.45) {
    const st = stepIdx % s.loopSteps;
    for (const tr of s.tracks) {
      const ns = tr.byStep[st];
      if (ns) for (const n of ns) _note(nextT, midi2f(n[0]), Math.max(0.05, n[1] * spb * 0.9), tr.wave, tr.vol, musG);
    }
    stepIdx++; nextT += spb;
  }
}
function _note(t, f, d, wave, vol, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(dest || musG);
  o.start(t); o.stop(t + d + 0.05);
}
function _noise(t, d, vol, fLow) {
  const len = (ctx.sampleRate * d) | 0;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource(); n.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fLow || 1200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  n.connect(f); f.connect(g); g.connect(master);
  n.start(t); n.stop(t + d);
}
function now() { return ctx ? ctx.currentTime : 0; }

/* ---- 効果音 ---- */
const FX = {
  tap()      { _note(now(), 880, 0.06, 'square', 0.08, master); },
  nope()     { _note(now(), 160, 0.15, 'square', 0.12, master); _note(now() + 0.12, 140, 0.15, 'square', 0.12, master); },
  coin()     { _note(now(), 988, 0.07, 'square', 0.12, master); _note(now() + 0.07, 1319, 0.16, 'square', 0.12, master); },
  diamond()  { [1319, 1568, 2093].forEach((f, i) => _note(now() + i * 0.07, f, 0.14, 'sine', 0.12, master)); },
  item()     { [659, 784, 988].forEach((f, i) => _note(now() + i * 0.06, f, 0.1, 'square', 0.1, master)); },
  empty()    { _note(now(), 220, 0.25, 'triangle', 0.12, master); },
  pickHit()  { _noise(now(), 0.08, 0.2, 900); _note(now(), 120, 0.09, 'triangle', 0.2, master); },
  thud()     { // 体当たりの鈍いドスン
    _noise(now(), 0.14, 0.32, 380);
    const t = now();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
  },
  crumble()  { _noise(now(), 0.45, 0.25, 500); },
  chest()    {
    const t = now();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t); o.frequency.linearRampToValueAtTime(420, t + 0.25);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  },
  ladder()   { [0, 0.09, 0.18].forEach((d, i) => _note(now() + d, 300 + i * 40, 0.07, 'triangle', 0.14, master)); },
  levelup()  { [523, 659, 784, 1047].forEach((f, i) => _note(now() + i * 0.09, f, 0.18, 'square', 0.11, master)); },
  fanfare()  {
    const t = now();
    [[0, [523, 659, 784]], [0.16, [587, 740, 880]], [0.32, [659, 831, 988]], [0.5, [784, 988, 1175]]]
      .forEach(pair => pair[1].forEach(f => _note(t + pair[0], f, 0.22, 'square', 0.07, master)));
    _noise(t, 0.5, 0.12, 3000);
  },
  clearSoft(){ [523, 659, 784].forEach((f, i) => _note(now() + i * 0.12, f, 0.25, 'sine', 0.1, master)); },
  goal()     { [784, 988, 1175, 1568].forEach((f, i) => _note(now() + i * 0.06, f, 0.14, 'sine', 0.1, master)); },
};
function sfx(name) {
  if (!enabled) return;
  if (!ensure() || ctx.state !== 'running') return;
  const f = FX[name]; if (f) f();
}
function setEnabled(on) {
  enabled = on;
  if (!on) { _stopSched(); if (master) master.gain.value = 0; }
  else { if (master) master.gain.value = 0.9; if (cur) bgm(cur); }
}

return { bgm, sfx, setEnabled, unlock, get current() { return cur; }, get enabled() { return enabled; } };
})();
