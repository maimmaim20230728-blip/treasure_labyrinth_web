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

/* ---- 難易度テーブル（8段階・下記DIFFSに統合） ----
   w,h: 部屋数 / chestLo..chestHi: 宝箱数 / margin,flat: 目標タイム係数 / exp: 基礎EXP */
/* 難易度8段階。名前はi18nの diffs[] を使う（ここのnameは開発メモ）。
   宝箱数は chestLo〜chestHi のランダム。最高難易度は約5分かかる巨大迷宮 */
const DIFFS = [
  { name: 'やさしい',       w: 5,  h: 4,  chestLo: 1,  chestHi: 2,  margin: 3.2,  flat: 8, exp: 60  },
  { name: 'まだやさしい',   w: 8,  h: 7,  chestLo: 2,  chestHi: 3,  margin: 2.7,  flat: 6, exp: 110 },
  { name: 'ふつう',         w: 11, h: 9,  chestLo: 3,  chestHi: 4,  margin: 2.4,  flat: 5, exp: 170 },
  { name: 'やや難しい',     w: 15, h: 12, chestLo: 4,  chestHi: 5,  margin: 2.15, flat: 4, exp: 240 },
  { name: '難しい',         w: 19, h: 15, chestLo: 5,  chestHi: 7,  margin: 1.95, flat: 3, exp: 320 },
  { name: 'とても難しい',   w: 24, h: 19, chestLo: 7,  chestHi: 9,  margin: 1.8,  flat: 2, exp: 410 },
  { name: '難し過ぎる',     w: 30, h: 24, chestLo: 9,  chestHi: 12, margin: 1.7,  flat: 0, exp: 520 },
  { name: '最高難易度',     w: 48, h: 40, chestLo: 12, chestHi: 16, margin: 1.65, flat: 0, exp: 700 },
];
const CHAR_SPEED = 3;      // マス/秒（キビキビ・でも見て追える速度）
const TRACE_DELAY_MS = 500; // なぞりから追従までの遅れ

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
   コイン1枚=最終TIME×0.90、ダイヤ1個=×0.85 を所持数ぶん複利で適用。
   女性パッシブ「おたからマスター」有効時は係数がレベル×0.005ぶん強くなる */
function finalTimeMs(rawMs, coins, diamonds, coinF, diaF) {
  if (coinF == null) coinF = 0.90;
  if (diaF == null) diaF = 0.85;
  return rawMs * Math.pow(coinF, coins) * Math.pow(diaF, diamonds);
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

/* ---- レベルとパッシブ（LV99カンスト） ---- */
const MAX_LV = 99;
/* LVnに到達するのに必要な累計EXP（LV2=120、以降なだらかに増加） */
function lvCum(n) { return 120 * (n - 1) + 10 * (n - 1) * (n - 2); }
function levelFor(exp) { let lv = 1; while (lv < MAX_LV && exp >= lvCum(lv + 1)) lv++; return lv; }
const PASSIVE = {
  m: { icon: '💥', name: 'たいあたり',       desc: 'つるはし無しで 体当たりで かべを こわせる（クールタイムあり）' },
  f: { icon: '✨', name: 'おたからマスター', desc: 'コインとダイヤの タイムカットが つよくなる' },
};
/* 体当たりCT：LV1=60秒→1LVごとに-0.5秒→LV99カンストで11秒 */
function tackleCT(level) {
  return Math.max(11, 60 - 0.5 * (Math.min(level, MAX_LV) - 1));
}
/* おたからマスター：LV×0.005ずつ係数が下がる（＝カットが強くなる） */
function coinFactor(level, isF) { return isF ? 0.90 - 0.005 * Math.min(level, MAX_LV) : 0.90; }
function diaFactor(level, isF)  { return isF ? 0.85 - 0.005 * Math.min(level, MAX_LV) : 0.85; }

/* ---- 追加パッシブスキル（③〜⑩・レベルで自動取得） ---- */
const SKILLS = [
  { id: 'speed',  lv: 5,  icon: '🥾' }, // ③スピードアップ（ミントはLV1）
  { id: 'chest',  lv: 7,  icon: '🎁' }, // ④宝箱出現アップ
  { id: 'lucky',  lv: 10, icon: '🍀' }, // ⑤からっぽ率低下
  { id: 'hawk',   lv: 12, icon: '🦅' }, // ⑥鷹の目（LV15でゴール矢印）
  { id: 'craft',  lv: 15, icon: '🛠️' }, // ⑦精密作業
  { id: 'warp',   lv: 17, icon: '🌀' }, // ⑧ワープ（クールタイム制）
  { id: 'hansel', lv: 20, icon: '🍞' }, // ⑨ヘンゼル
  { id: 'clone',  lv: 20, icon: '👥' }, // ⑩分身の術
];
/* ③装備中は4マス/秒。LV10から5レベルごとに+1
   （習得可否はskillAcquired側で判定。中性キャラはLV1から使える） */
function speedCells(level) {
  return 4 + Math.floor(Math.max(0, Math.min(level, MAX_LV) - 5) / 5);
}
/* ④LV7で+1%。LV8から1レベルごとに+1%（宝箱の数に掛ける倍率で表現） */
function chestRateBonus(level) {
  return level >= 7 ? (Math.min(level, MAX_LV) - 6) / 100 : 0;
}
/* ⑤LV10で20%→19%。LV15から5レベルごとに-1% */
function emptyRatePct(level) {
  if (level < 10) return 20;
  return Math.max(1, 19 - Math.floor((Math.min(level, MAX_LV) - 10) / 5));
}
/* からっぽ率を指定して宝箱を抽選（残りは4種で均等割り） */
function rollChestWeighted(emptyPct, rnd) {
  const r = (rnd || Math.random)() * 100;
  if (r < emptyPct) return 'empty';
  return CHEST_ITEMS[(((rnd || Math.random)()) * 4) | 0]; // empty以外の4種
}
/* ⑥LV12で視界7→8。LV13から1レベルごとに+1（全部見えたら頭打ち）
   LV15からはゴールの方向を矢印で示す（ゲーム側で描画） */
function viewRangeFor(level, base) {
  const b = base == null ? 7 : base;
  if (level < 12) return b;
  return Math.min(40, (b + 1) + (Math.min(level, MAX_LV) - 12));
}
/* ⑦LV15:2回 LV30:3回 LV50:4回 LV70:5回（つるはしの使用回数／ハシゴの再設置回数） */
function toolUses(level) {
  if (level >= 70) return 5;
  if (level >= 50) return 4;
  if (level >= 30) return 3;
  if (level >= 15) return 2;
  return 1;
}
/* ⑧ワープのクールタイム：LV17=60秒→LV18から-0.5秒/LV */
function warpCT(level) {
  return Math.max(5, 60 - 0.5 * (Math.max(Math.min(level, MAX_LV), 17) - 17));
}
/* ⑧「ゴールから11マス」の最寄りリングへワープできる確率(%)。LV17=0.1%、以降+0.1%/LV */
function warpClosestPct(level) {
  if (level < 17) return 0;
  return Math.min(100, 0.1 + 0.1 * (Math.min(level, MAX_LV) - 17));
}
/* ⑨LV20:1段 LV25:2段 LV30:3段（足あとの濃さの段階数） */
function hanselShades(level) {
  if (level >= 30) return 3;
  if (level >= 25) return 2;
  if (level >= 20) return 1;
  return 0;
}
/* ⑩LV20:1人→10レベルごとに+1（LV90:8人）→LV99で9人（分身は1マス/秒固定） */
function cloneCount(level) {
  if (level >= 99) return 9;
  if (level < 20) return 0;
  return Math.min(8, 1 + Math.floor((level - 20) / 10));
}
const CLONE_SPEED = 1;

/* ---- スキル装備スロット（選んだスキルだけが効く） ----
   LV10〜19=2 / LV20〜29=3 / LV30〜39=4 / LV40〜49=5 / LV50以降=6（それ以前は1） */
function slotCount(level) {
  if (level >= 50) return 6;
  if (level >= 40) return 5;
  if (level >= 30) return 4;
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}
/* 習得済みか（①②のm/fは自分のキャラなら最初から・LV5で両方解禁。
   中性キャラnの初期パッシブは③スピードアップ） */
function skillAcquired(id, level, gender) {
  if (id === 'm' || id === 'f') return level >= 5 || gender === id;
  if (id === 'speed' && gender === 'n') return true;
  const sk = SKILLS.find(s => s.id === id);
  return !!sk && level >= sk.lv;
}

const api = {
  DX, DY, mulberry32, generate, wallIndex, canPass, shortestPath, bfsLimited,
  DIFFS, CHAR_SPEED, TRACE_DELAY_MS, targetSeconds, chestCount,
  CHEST_ITEMS, rollChest, ITEM_CAPS, finalTimeMs,
  StageTimer, CutsceneCtrl,
  MAX_LV, lvCum, levelFor, PASSIVE, tackleCT, coinFactor, diaFactor,
  SKILLS, speedCells, chestRateBonus, emptyRatePct, rollChestWeighted,
  viewRangeFor, toolUses, warpCT, warpClosestPct, hanselShades, cloneCount, CLONE_SPEED,
  slotCount, skillAcquired,
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);
