/* 宝の迷宮 (Treasure Labyrinth) - 純ロジック層（ブラウザ/Node共通・依存なし）
   迷路生成・到達可能性・難易度テーブル・宝箱抽選・複利タイム計算・タイマー/演出制御 */
(function (root) {
'use strict';

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // 北・東・南・西

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---- 迷路生成（ブロック格子・完全迷路） ----
   幅w×高hの部屋。ブロック格子(2w+1)×(2h+1)。0=床 1=壁(壊せる) 2=外壁(壊せない)
   穴掘りDFS＝完全迷路（全部屋が一本につながる）なので
   「アイテム無しで必ずゴールできる」を構造的に保証する。
   つるはし(壁→床)もハシゴ(一方通行の追加)も通路を増やすだけなので、
   どう使っても詰みは発生しない（鉄則）。 */
function generate(w, h, seed) {
  const bw = 2 * w + 1, bh = 2 * h + 1;
  const g = new Uint8Array(bw * bh); g.fill(1);
  for (let x = 0; x < bw; x++) { g[x] = 2; g[(bh - 1) * bw + x] = 2; }
  for (let y = 0; y < bh; y++) { g[y * bw] = 2; g[y * bw + bw - 1] = 2; }
  const rnd = (seed == null) ? Math.random : mulberry32(seed);
  const vis = new Uint8Array(w * h);
  const st = [[0, 0]]; vis[0] = 1; g[bw + 1] = 0;
  while (st.length) {
    const c = st[st.length - 1];
    const dirs = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t; }
    let adv = false;
    for (let k = 0; k < 4; k++) {
      const d = dirs[k], nx = c[0] + DX[d], ny = c[1] + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || vis[ny * w + nx]) continue;
      vis[ny * w + nx] = 1;
      g[(2 * c[1] + 1 + DY[d]) * bw + (2 * c[0] + 1 + DX[d])] = 0;
      g[(2 * ny + 1) * bw + (2 * nx + 1)] = 0;
      st.push([nx, ny]); adv = true; break;
    }
    if (!adv) st.pop();
  }
  return { w, h, bw, bh, g, rnd };
}

function wallIndex(m, rx, ry, d) { return (2 * ry + 1 + DY[d]) * m.bw + (2 * rx + 1 + DX[d]); }

/* ladders: Uint8Array(bw*bh)。0=無し、d+1=方向dへだけ通れるハシゴ */
function canPass(m, rx, ry, d, ladders) {
  const nx = rx + DX[d], ny = ry + DY[d];
  if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) return false;
  const wi = wallIndex(m, rx, ry, d);
  if (m.g[wi] === 0) return true;
  if (ladders && ladders[wi] === d + 1) return true;
  return false;
}

function shortestPath(m, sx, sy, gx, gy, ladders) {
  const prev = new Int32Array(m.w * m.h).fill(-2);
  prev[sy * m.w + sx] = -1;
  const q = [sy * m.w + sx];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], cx = i % m.w, cy = (i / m.w) | 0;
    if (cx === gx && cy === gy) {
      const path = []; let p = i;
      while (p !== -1) { path.push([p % m.w, (p / m.w) | 0]); p = prev[p]; }
      return path.reverse();
    }
    for (let d = 0; d < 4; d++) {
      if (!canPass(m, cx, cy, d, ladders)) continue;
      const ni = (cy + DY[d]) * m.w + (cx + DX[d]);
      if (prev[ni] !== -2) continue;
      prev[ni] = i; q.push(ni);
    }
  }
  return null;
}

/* なぞり補助：最大maxSteps歩までの最短経路（指が少し飛んでも壁沿いに繋ぐ） */
function bfsLimited(m, sx, sy, gx, gy, maxSteps, ladders) {
  if (sx === gx && sy === gy) return [];
  const start = sy * m.w + sx, goal = gy * m.w + gx;
  const prev = new Map(); prev.set(start, -1);
  let frontier = [start];
  for (let step = 0; step < maxSteps; step++) {
    const next = [];
    for (const i of frontier) {
      const cx = i % m.w, cy = (i / m.w) | 0;
      for (let d = 0; d < 4; d++) {
        if (!canPass(m, cx, cy, d, ladders)) continue;
        const ni = (cy + DY[d]) * m.w + (cx + DX[d]);
        if (prev.has(ni)) continue;
        prev.set(ni, i);
        if (ni === goal) {
          const path = []; let p = ni;
          while (p !== -1 && p !== start) { path.push([p % m.w, (p / m.w) | 0]); p = prev.get(p); }
          return path.reverse();
        }
        next.push(ni);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

/* ---- 難易度テーブル（7段階） ----
   w,h: 部屋数 / chestLo..chestHi: 宝箱数 / margin,flat: 目標タイム係数 / exp: 基礎EXP */
const DIFFS = [
  { name: 'やさしい',     w: 5,  h: 4,  chestLo: 1, chestHi: 2, margin: 3.2,  flat: 8, exp: 60  },
  { name: 'ふつう',       w: 8,  h: 7,  chestLo: 2, chestHi: 2, margin: 2.7,  flat: 6, exp: 110 },
  { name: 'やや難しい',   w: 11, h: 9,  chestLo: 3, chestHi: 3, margin: 2.4,  flat: 5, exp: 170 },
  { name: '難しい',       w: 15, h: 12, chestLo: 4, chestHi: 4, margin: 2.15, flat: 4, exp: 240 },
  { name: 'とても難しい', w: 19, h: 15, chestLo: 5, chestHi: 5, margin: 1.95, flat: 3, exp: 320 },
  { name: '難し過ぎる',   w: 24, h: 19, chestLo: 6, chestHi: 6, margin: 1.8,  flat: 2, exp: 410 },
  { name: '最高難易度',   w: 30, h: 24, chestLo: 8, chestHi: 8, margin: 1.7,  flat: 0, exp: 520 },
];
const CHAR_SPEED = 6; // マス/秒（キビキビ走る速度）

function targetSeconds(diff, pathLen) {
  return Math.ceil(pathLen / CHAR_SPEED * diff.margin + diff.flat);
}
function chestCount(diff, rnd) {
  return diff.chestLo + (((rnd || Math.random)() * (diff.chestHi - diff.chestLo + 1)) | 0);
}

/* ---- 宝箱抽選（5種 均等20%） ---- */
const CHEST_ITEMS = ['pick', 'ladder', 'coin', 'diamond', 'empty'];
function rollChest(rnd) { return CHEST_ITEMS[(((rnd || Math.random)()) * 5) | 0]; }
const ITEM_CAPS = { pick: 2, ladder: 3, coin: 5, diamond: 5 };

/* ---- 複利タイム短縮 ----
   コイン1枚=最終TIME×0.90、ダイヤ1個=×0.85 を所持数ぶん複利で適用 */
function finalTimeMs(rawMs, coins, diamonds) {
  return rawMs * Math.pow(0.90, coins) * Math.pow(0.85, diamonds);
}

/* ---- ステージタイマー（演出中は停止） ---- */
class StageTimer {
  constructor() { this.ms = 0; this.paused = false; }
  update(dt) { if (!this.paused) this.ms += dt; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
}

/* ---- 演出コントローラ ----
   開始で必ずタイマー停止→終了（時間経過 or タップskip）で必ず再開。
   演出は仕様どおり最大5秒で強制終了。 */
class CutsceneCtrl {
  constructor(timer) { this.timer = timer; this.cur = null; }
  get active() { return this.cur; }
  start(kind, durMs, data, onEnd) {
    this.cur = { kind, dur: Math.min(durMs, 5000), t: 0, data: data || {}, onEnd };
    this.timer.pause();
  }
  update(dt) { if (!this.cur) return; this.cur.t += dt; if (this.cur.t >= this.cur.dur) this._finish(); }
  skip() { if (this.cur) this._finish(); }
  _finish() { const c = this.cur; this.cur = null; this.timer.resume(); if (c.onEnd) c.onEnd(c); }
}

/* ---- レベルとパッシブ（LV5まで暫定・LV10帯は将来拡張） ---- */
const LV_EXP = [0, 120, 300, 560, 900]; // 累計EXP: LV1..LV5
function levelFor(exp) { let lv = 1; for (let i = 1; i < LV_EXP.length; i++) if (exp >= LV_EXP[i]) lv = i + 1; return lv; }
const PASSIVE = {
  m: { icon: '👊', name: 'かべパンチ',   desc: 'つるはし無しで かべを こわせる（クールタイムあり）', ct: [90, 70, 50, 35] },
  f: { icon: '✨', name: 'しゅうちゅう', desc: 'クリアで もらえるEXPが ふえる',                     mult: [1.5, 1.6, 1.8, 2.0] },
};
function passiveRank(level) { return Math.min(level, 4) - 1; } // 0..3

const api = {
  DX, DY, mulberry32, generate, wallIndex, canPass, shortestPath, bfsLimited,
  DIFFS, CHAR_SPEED, targetSeconds, chestCount,
  CHEST_ITEMS, rollChest, ITEM_CAPS, finalTimeMs,
  StageTimer, CutsceneCtrl,
  LV_EXP, levelFor, PASSIVE, passiveRank,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);
