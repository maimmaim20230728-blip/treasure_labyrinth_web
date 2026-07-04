/* 宝の迷宮 - サウンド（Web Audio 合成・完全オフライン）
   BGM: タイトル / 迷路3種 / スキル画面 / クリア(盛大・ひかえめ)
   起動中は常に何かが鳴る方針。初回タップで自動アンロック。 */
const Snd = (() => {
'use strict';
/* out=最終出力 / musG=BGMバス / master=SFXバス（音量を別々に0〜3倍で調整できる） */
let ctx = null, out = null, master = null, musG = null, schedT = null, stepIdx = 0, nextT = 0;
let cur = null, pending = 'title', enabled = true, volBgm = 1, volSfx = 1;

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
function qTrack(wave, vol, quarters) { // 4分音符メロディ用
  const notes = [];
  quarters.forEach((m, i) => { if (m) notes.push([i * 2, m, 2]); });
  return track(wave, vol, notes);
}

const SONGS = {};
/* タイトル：明るく壮大な冒険のテーマ（ちょうど20秒ループ・80ステップ@120bpm）
   ファンファーレ→高らかなメロディ→駆け上がって冒頭へ戻る4層構成 */
(() => {
  const mel = [
    72, 0, 76, 0, 79, 0, 84, 0,   83, 0, 79, 0, 76, 0, 79, 0,   // ファンファーレ
    81, 0, 84, 0, 88, 0, 84, 0,   86, 0, 84, 81, 84, 0, 0, 0,   // 高らかに
    72, 0, 76, 0, 79, 0, 84, 0,   83, 81, 79, 81, 83, 0, 86, 0, // 再現部
    84, 0, 81, 0, 77, 0, 81, 0,   79, 0, 83, 0, 86, 0, 88, 0,   // 旅立ちの助走
    91, 0, 88, 0, 86, 0, 84, 0,   88, 86, 84, 83, 84, 0, 0, 0]; // クライマックス→ループ
  const CH = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 62, 65],
              [60, 64, 67], [59, 62, 67], [57, 62, 65], [59, 62, 67],
              [60, 64, 67], [60, 64, 67]];
  SONGS.title = { bpm: 120, loopSteps: 80, tracks: [
    melTrack('square', 0.12, mel),
    track('triangle', 0.07, [[0, 64, 6], [8, 62, 6], [16, 60, 6], [24, 65, 6], [32, 64, 6], [40, 62, 6], [48, 65, 6], [56, 62, 6], [64, 67, 6], [72, 64, 6]]),
    track('square', 0.04, arpNotes(CH, 8, [0, 1, 2, 1], 2)),
    track('triangle', 0.17, bassNotes([48, 55, 57, 53, 48, 55, 53, 55, 48, 48], 8)),
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
/* クリア（目標達成＝盛大に！リード+高速アルペジオ+ドライブするベースの3層） */
(() => {
  const mel = [84, 0, 84, 0, 88, 0, 91, 0, 96, 0, 93, 91, 93, 0, 96, 0,
               91, 0, 88, 0, 91, 93, 96, 0, 93, 91, 88, 86, 88, 0, 84, 0,
               86, 0, 86, 0, 88, 0, 91, 0, 93, 0, 91, 88, 91, 0, 93, 0,
               96, 0, 93, 0, 91, 0, 93, 96, 98, 0, 96, 93, 96, 0, 0, 0];
  SONGS.clearBig = { bpm: 160, loopSteps: 64, tracks: [
    melTrack('square', 0.12, mel),
    track('square', 0.05, arpNotes([[72, 76, 79], [72, 76, 79], [74, 77, 81], [76, 79, 84]], 16, [0, 1, 2, 3, 4, 3, 2, 1], 2)),
    track('triangle', 0.17, bassNotes([48, 48, 50, 52, 53, 53, 55, 55], 8)),
  ]};
})();
/* コングラチュレーション（最高難易度クリア・LV99）：さらに壮大な祝祭ループ */
(() => {
  const mel = [84, 84, 0, 84, 88, 0, 91, 0, 91, 91, 0, 91, 96, 0, 91, 0,
               93, 93, 0, 93, 96, 0, 98, 0, 96, 0, 93, 0, 91, 0, 88, 0,
               84, 84, 0, 84, 88, 0, 91, 0, 96, 96, 0, 96, 98, 0, 96, 0,
               100, 0, 98, 0, 96, 0, 98, 100, 103, 0, 0, 0, 96, 98, 100, 0];
  SONGS.congrats = { bpm: 172, loopSteps: 64, tracks: [
    melTrack('square', 0.11, mel),
    track('square', 0.05, arpNotes([[76, 79, 84], [77, 81, 84], [79, 84, 88], [81, 84, 89]], 16, [0, 1, 2, 3, 4, 3, 2, 1], 2)),
    track('triangle', 0.17, bassNotes([48, 55, 57, 55, 53, 55, 48, 55], 8)),
  ]};
})();
/* クリア（目標超過＝ひかえめ） */
SONGS.clearSoft = { bpm: 80, loopSteps: 32, tracks: [
  track('sine', 0.10, arpNotes([[72, 76, 79], [69, 72, 77]], 16, [0, 1, 2, 1], 4)),
  track('triangle', 0.09, bassNotes([48, 41], 16)),
]};

/* ---- 迷宮テーマ別BGM ---- */
/* 遺跡：低くミステリアス */
SONGS.mazeRuins = { bpm: 66, loopSteps: 64, tracks: [
  track('triangle', 0.10, arpNotes([[57, 60, 64], [56, 59, 63], [57, 60, 64], [53, 57, 62]], 16, [0, 1, 2, 1], 4)),
  track('sine', 0.12, bassNotes([45, 44, 45, 41], 16)),
]};
/* お菓子：はずむ長調 */
(() => {
  const mel = [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 77, 0, 81, 0, 77, 0,
               72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 74, 0,
               72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 77, 0, 81, 0, 84, 0,
               83, 0, 81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0];
  SONGS.mazeCandy = { bpm: 112, loopSteps: 64, tracks: [
    melTrack('square', 0.09, mel),
    track('triangle', 0.12, bassNotes([48, 53, 48, 43, 48, 53, 43, 48], 8)),
  ]};
})();
/* 夜：ゆっくり深い短調 */
SONGS.mazeNight = { bpm: 58, loopSteps: 64, tracks: [
  track('sine', 0.10, arpNotes([[45, 48, 52], [44, 47, 52], [45, 48, 52], [41, 45, 48]], 16, [0, 1, 2, 1], 4)),
  track('sine', 0.06, [[8, 76, 3], [24, 74, 3], [40, 79, 3], [56, 72, 3]]),
]};
/* 溶岩：低く刻む緊張感 */
SONGS.mazeLava = { bpm: 100, loopSteps: 64, tracks: [
  track('triangle', 0.13, (() => {
    const n = [];
    const seq = [45, 45, 48, 45, 44, 44, 47, 44, 45, 45, 48, 45, 51, 50, 47, 44];
    seq.forEach((m, i) => n.push([i * 4, m, 3]));
    return n;
  })()),
  track('square', 0.05, [[12, 69, 2], [28, 68, 2], [44, 69, 2], [60, 63, 2]]),
]};
/* 海：ゆったり寄せては返す */
SONGS.mazeSea = { bpm: 76, loopSteps: 64, tracks: [
  track('sine', 0.10, arpNotes([[57, 60, 64], [55, 59, 62], [57, 60, 64], [59, 62, 65]], 16, [0, 1, 2, 1, 2, 1, 0, 1], 2)),
  track('triangle', 0.10, bassNotes([45, 43, 45, 47], 16)),
]};
/* 桜：日本古謡「さくらさくら」全曲版（メロディはパブリックドメイン・Web Audioで自作合成）
   ララシ─ ララシ─ / ラシドシ ラシラファ / ミドミファ ミミドシ /
   ラシドシ ラシラファ / ミドミファ ミミドシ / ララシ─ ララシ─ / ラシドシ ラ─── */
(() => {
  const N = [ // [拍, MIDI, 拍数]
    [0, 69, 1], [1, 69, 1], [2, 71, 2],   [4, 69, 1], [5, 69, 1], [6, 71, 2],
    [8, 69, 1], [9, 71, 1], [10, 72, 1], [11, 71, 1],  [12, 69, 1], [13, 71, 1], [14, 69, 1], [15, 65, 1],
    [16, 64, 1], [17, 60, 1], [18, 64, 1], [19, 65, 1],  [20, 64, 1], [21, 64, 1], [22, 60, 1], [23, 59, 1],
    [24, 69, 1], [25, 71, 1], [26, 72, 1], [27, 71, 1],  [28, 69, 1], [29, 71, 1], [30, 69, 1], [31, 65, 1],
    [32, 64, 1], [33, 60, 1], [34, 64, 1], [35, 65, 1],  [36, 64, 1], [37, 64, 1], [38, 60, 1], [39, 59, 1],
    [40, 69, 1], [41, 69, 1], [42, 71, 2],  [44, 69, 1], [45, 69, 1], [46, 71, 2],
    [48, 69, 1], [49, 71, 1], [50, 72, 1], [51, 71, 1],  [52, 69, 4],
  ];
  SONGS.mazeSakura = { bpm: 76, loopSteps: 112, tracks: [
    track('sine', 0.13, N.map(x => [x[0] * 2, x[1], x[2] * 2])),
    track('triangle', 0.07, [[0, 45, 8], [16, 40, 8], [32, 45, 8], [48, 41, 8], [64, 45, 8], [80, 40, 8], [96, 45, 8]]),
  ]};
})();
/* 森：オルゴール調（maze3）を流用 */
SONGS.mazeForest = SONGS.maze3;

/* ---- エンジン ---- */
function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  out = ctx.createGain(); out.gain.value = enabled ? 0.9 : 0; out.connect(ctx.destination);
  musG = ctx.createGain(); musG.gain.value = volBgm; musG.connect(out);
  master = ctx.createGain(); master.gain.value = volSfx; master.connect(out); // SFXバス
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
  climbStep(){ _note(now(), 320, 0.06, 'triangle', 0.12, master); _noise(now(), 0.03, 0.08, 1600); },
  warp() { // 魔方陣のうねり上がるサウンド
    const t = now();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.55);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.72);
    [1175, 1568, 2093].forEach((f, i) => _note(t + 0.55 + i * 0.08, f, 0.12, 'sine', 0.09, master));
  },
  levelup()  { [523, 659, 784, 1047].forEach((f, i) => _note(now() + i * 0.09, f, 0.18, 'square', 0.11, master)); },
  fanfare()  { // 盛大版：5連コード+シンバル+駆け上がるグリッサンド
    const t = now();
    [[0, [523, 659, 784]], [0.14, [587, 740, 880]], [0.28, [659, 831, 988]], [0.42, [784, 988, 1175]], [0.6, [1047, 1319, 1568]]]
      .forEach(pair => pair[1].forEach(f => _note(t + pair[0], f, 0.3, 'square', 0.09, master)));
    _noise(t, 0.7, 0.2, 4000);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
  },
  bang() { // 花火の破裂音
    const t = now();
    _noise(t, 0.5, 0.35, 2500);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(650 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.5);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.52);
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
  if (!on) { _stopSched(); if (out) out.gain.value = 0; }
  else { if (out) out.gain.value = 0.9; if (cur) bgm(cur); }
}
function setVolumes(b, s) { // BGM/SFXの音量（0=ミュート〜3=3倍）
  volBgm = b; volSfx = s;
  if (musG) musG.gain.value = b;
  if (master) master.gain.value = s;
}

return { bgm, sfx, setEnabled, setVolumes, unlock, get current() { return cur; }, get enabled() { return enabled; }, get songs() { return Object.keys(SONGS); } };
})();
