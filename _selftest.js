/* 機械検証：迷路の鉄則（詰み無し）・宝箱分布・複利・タイマー/演出制御 */
const L = require('./logic.js');
let fails = 0;
function ok(cond, msg) { if (!cond) { fails++; console.log('NG: ' + msg); } }

// 1) 全難易度×60シード：アイテム無しで必ずゴール可能（完全迷路）
for (let di = 0; di < L.DIFFS.length; di++) {
  const d = L.DIFFS[di];
  for (let seed = 1; seed <= 60; seed++) {
    const m = L.generate(d.w, d.h, seed * 1000 + di);
    const p = L.shortestPath(m, 0, 0, d.w - 1, d.h - 1, null);
    ok(p && p.length >= 2, `難易度${di} seed${seed}: ゴール不能`);
  }
}
console.log('1) 全難易度×60シード ゴール可能: 済');

// 2) つるはし2枚＋ハシゴ3本をどう使っても、全部屋からゴール可能（詰み無しの鉄則）
const rnd = L.mulberry32(42);
for (let trial = 0; trial < 40; trial++) {
  const d = L.DIFFS[trial % 7];
  const m = L.generate(d.w, d.h, 7777 + trial);
  const ladders = new Uint8Array(m.bw * m.bh);
  const walls = [];
  for (let y = 1; y < m.bh - 1; y++) for (let x = 1; x < m.bw - 1; x++) {
    if (m.g[y * m.bw + x] === 1) walls.push(y * m.bw + x);
  }
  for (let i = 0; i < 2 && walls.length; i++) { const wi = walls[(rnd() * walls.length) | 0]; m.g[wi] = 0; }
  for (let i = 0; i < 3 && walls.length; i++) {
    const wi = walls[(rnd() * walls.length) | 0];
    if (m.g[wi] === 1) ladders[wi] = 1 + ((rnd() * 4) | 0);
  }
  for (let ry = 0; ry < m.h; ry++) for (let rx = 0; rx < m.w; rx++) {
    ok(L.shortestPath(m, rx, ry, m.w - 1, m.h - 1, ladders), `trial${trial}: (${rx},${ry})から詰み`);
  }
}
console.log('2) つるはし+ハシゴ乱用でも詰み無し: 済');

// 3) 宝箱抽選の均等性（5種 各20%±1%）
{
  const r = L.mulberry32(123); const cnt = {};
  for (let i = 0; i < 100000; i++) { const it = L.rollChest(r); cnt[it] = (cnt[it] || 0) + 1; }
  for (const k of L.CHEST_ITEMS) {
    const pct = cnt[k] / 1000;
    ok(pct > 19 && pct < 21, `宝箱${k}の出現率${pct}%`);
  }
  console.log('3) 宝箱5種均等20%: 済', cnt);
}

// 4) 複利タイム短縮
{
  const v = L.finalTimeMs(100000, 2, 1); // 100秒×0.9^2×0.85 = 68.85秒
  ok(Math.abs(v - 68850) < 1e-6, `複利計算 期待68850 実際${v}`);
  ok(L.finalTimeMs(60000, 0, 0) === 60000, '複利: アイテム無しは等倍');
  const v5 = L.finalTimeMs(100000, 5, 5);
  ok(Math.abs(v5 - 100000 * Math.pow(0.9, 5) * Math.pow(0.85, 5)) < 1e-6, '複利: 上限5+5');
  console.log('4) 複利計算: 済 (100秒+コイン2+ダイヤ1 →', (v / 1000).toFixed(2), '秒)');
}

// 5) タイマー＋演出制御（演出中は停止・最大5秒・タップスキップ可）
{
  const t = new L.StageTimer(); const c = new L.CutsceneCtrl(t);
  t.update(1000); ok(t.ms === 1000, 'タイマー通常加算');
  let ended = 0;
  c.start('break', 9999, {}, () => ended++);
  ok(c.active && c.active.dur === 5000, '演出は最大5秒でクランプ');
  t.update(2500); ok(t.ms === 1000, '演出中はタイマー停止');
  c.update(2500); ok(ended === 0, '演出まだ継続');
  c.skip(); ok(ended === 1, 'タップスキップで即終了');
  t.update(500); ok(t.ms === 1500, 'スキップ後は再開');
  c.start('chest', 3000, {}, () => ended++);
  c.update(3000); ok(ended === 2, '時間経過で自動終了');
  t.update(1); ok(t.ms === 1501, '自動終了後も再開');
  console.log('5) タイマー/演出制御: 済');
}

// 6) 難易度が上がるほど目標タイムの余裕係数が減る（単調性）
for (let i = 1; i < L.DIFFS.length; i++) {
  ok(L.DIFFS[i].margin <= L.DIFFS[i - 1].margin, 'margin単調減少');
}
console.log('6) 難易度テーブル単調性: 済');

console.log(fails === 0 ? 'ALL OK' : 'FAILURES: ' + fails);
process.exit(fails ? 1 : 0);
