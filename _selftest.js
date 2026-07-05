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
  const d = L.DIFFS[trial % L.DIFFS.length];
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

// 4) 複利タイム短縮（標準係数＋おたからマスター強化係数）
{
  const v = L.finalTimeMs(100000, 2, 1); // 100秒×0.9^2×0.85 = 68.85秒
  ok(Math.abs(v - 68850) < 1e-6, `複利計算 期待68850 実際${v}`);
  ok(L.finalTimeMs(60000, 0, 0) === 60000, '複利: アイテム無しは等倍');
  const v5 = L.finalTimeMs(100000, 5, 5);
  ok(Math.abs(v5 - 100000 * Math.pow(0.9, 5) * Math.pow(0.85, 5)) < 1e-6, '複利: 上限5+5');
  // ✨おたからマスター LV1: コイン0.895・ダイヤ0.845
  ok(Math.abs(L.coinFactor(1, true) - 0.895) < 1e-9, 'コイン係数 LV1=0.895');
  ok(Math.abs(L.diaFactor(1, true) - 0.845) < 1e-9, 'ダイヤ係数 LV1=0.845');
  ok(Math.abs(L.coinFactor(10, true) - 0.85) < 1e-9, 'コイン係数 LV10=0.850');
  ok(L.coinFactor(50, false) === 0.90 && L.diaFactor(50, false) === 0.85, 'パッシブ無効なら標準係数');
  const vf = L.finalTimeMs(100000, 1, 1, L.coinFactor(1, true), L.diaFactor(1, true));
  ok(Math.abs(vf - 100000 * 0.895 * 0.845) < 1e-6, `強化複利 LV1 期待75627.5 実際${vf}`);
  console.log('4) 複利計算: 済 (標準68.85秒 / マスターLV1で', (vf / 1000).toFixed(3), '秒)');
}

// 4b) 体当たりクールタイム：LV1=60秒→-0.5秒/LV→LV99カンスト11秒
{
  ok(L.tackleCT(1) === 60, '体当たりCT LV1=60');
  ok(L.tackleCT(2) === 59.5, '体当たりCT LV2=59.5');
  ok(L.tackleCT(50) === 35.5, '体当たりCT LV50=35.5');
  ok(L.tackleCT(99) === 11, '体当たりCT LV99=11（カンスト）');
  ok(L.tackleCT(150) === 11, '体当たりCT LV99超でも11で固定');
  console.log('4b) 体当たりCT: 済');
}

// 4c) レベルカーブ（LV99上限・単調増加）
{
  ok(L.levelFor(0) === 1 && L.levelFor(119) === 1 && L.levelFor(120) === 2, 'LV2は累計120EXP');
  ok(L.levelFor(1e9) === 99, 'LV上限99');
  let mono = true;
  for (let n = 2; n <= 99; n++) if (L.lvCum(n) <= L.lvCum(n - 1)) mono = false;
  ok(mono, '必要EXP単調増加');
  console.log('4c) レベルカーブ: 済 (LV5=' + L.lvCum(5) + ' / LV99=' + L.lvCum(99) + ' EXP)');
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

// 5b) 追加パッシブスキル③〜⑩の計算式
{
  // ③スピードアップ：装備中は4、LV10から5レベルごとに+1（未装備の3はゲーム側でゲート）
  ok(L.speedCells(1) === 4 && L.speedCells(9) === 4, '速度: LV1-9は4');
  ok(L.speedCells(10) === 5 && L.speedCells(15) === 6, '速度: LV10=5/LV15=6');
  ok(L.speedCells(99) === 22, '速度: LV99=22');
  // ④宝箱出現：LV7で+1%、以降+1%/LV
  ok(L.chestRateBonus(6) === 0 && Math.abs(L.chestRateBonus(7) - 0.01) < 1e-9, '宝箱率: LV7=+1%');
  ok(Math.abs(L.chestRateBonus(8) - 0.02) < 1e-9 && Math.abs(L.chestRateBonus(99) - 0.93) < 1e-9, '宝箱率: LV8=+2%/LV99=+93%');
  // ⑤からっぽ率：LV10で19%、LV15から5レベルごとに-1%
  ok(L.emptyRatePct(9) === 20 && L.emptyRatePct(10) === 19, 'からっぽ: LV10=19%');
  ok(L.emptyRatePct(14) === 19 && L.emptyRatePct(15) === 18 && L.emptyRatePct(99) === 2, 'からっぽ: LV15=18%/LV99=2%');
  // 重み付き抽選の分布（からっぽ10%指定）
  const r = L.mulberry32(777); const cnt = { empty: 0 };
  for (let i = 0; i < 50000; i++) { const it = L.rollChestWeighted(10, r); cnt[it] = (cnt[it] || 0) + 1; }
  const ePct = cnt.empty / 500;
  ok(ePct > 9 && ePct < 11, `重み抽選: からっぽ${ePct}%（期待10%）`);
  // ⑥鷹の目：LV12で8、以降+1/LV（上限40）
  ok(L.viewRangeFor(11) === 7 && L.viewRangeFor(12) === 8 && L.viewRangeFor(13) === 9, '視界: LV12=8/LV13=9');
  ok(L.viewRangeFor(99) === 40, '視界: 上限40で頭打ち');
  // ⑦精密作業：LV15/30/50/70で2/3/4/5回
  ok(L.toolUses(14) === 1 && L.toolUses(15) === 2 && L.toolUses(30) === 3 && L.toolUses(50) === 4 && L.toolUses(70) === 5, '道具回数 2/3/4/5');
  // ⑧ワープ：CT LV17=60秒→LV18から-0.5秒/LV（LV99=19秒）・近リング確率0.1%+0.1%/LV
  ok(L.warpCT(17) === 60 && L.warpCT(18) === 59.5 && L.warpCT(99) === 19, 'ワープCT 60→19');
  ok(L.warpClosestPct(16) === 0 && Math.abs(L.warpClosestPct(17) - 0.1) < 1e-9 && Math.abs(L.warpClosestPct(99) - 8.3) < 1e-9, 'ワープ近リング率');
  // ⑨ヘンゼル：LV20/25/30で1/2/3段
  ok(L.hanselShades(19) === 0 && L.hanselShades(20) === 1 && L.hanselShades(25) === 2 && L.hanselShades(30) === 3, 'ヘンゼル段階');
  // ⑩分身：LV20から10LVごとに+1・LV99で9人
  ok(L.cloneCount(19) === 0 && L.cloneCount(20) === 1 && L.cloneCount(30) === 2 && L.cloneCount(50) === 4, '分身人数 前半');
  ok(L.cloneCount(90) === 8 && L.cloneCount(98) === 8 && L.cloneCount(99) === 9, '分身人数 LV90=8/LV99=9');
  ok(L.CLONE_SPEED === 1, '分身は1マス/秒固定');
  // 装備スロット数：LV10-19=2 / 20-29=3 / 30-39=4 / 40-49=5 / 50+=6
  ok(L.slotCount(9) === 1 && L.slotCount(10) === 2 && L.slotCount(19) === 2, 'スロット: LV10-19=2');
  ok(L.slotCount(20) === 3 && L.slotCount(29) === 3 && L.slotCount(30) === 4 && L.slotCount(39) === 4, 'スロット: 20-29=3/30-39=4');
  ok(L.slotCount(40) === 5 && L.slotCount(49) === 5 && L.slotCount(50) === 6 && L.slotCount(99) === 6, 'スロット: 40-49=5/50+=6');
  // 習得判定：自分の性別は最初から・異性はLV5・③はLV5
  ok(L.skillAcquired('m', 1, 'm') && !L.skillAcquired('f', 1, 'm'), '習得: 自キャラのみLV1');
  ok(L.skillAcquired('f', 5, 'm'), '習得: LV5で他キャラの技も');
  ok(!L.skillAcquired('speed', 4, 'm') && L.skillAcquired('speed', 5, 'm'), '習得: ③はLV5');
  ok(L.skillAcquired('speed', 1, 'n'), '習得: 中性キャラnはスピードをLV1から');
  ok(!L.skillAcquired('m', 1, 'n') && !L.skillAcquired('f', 1, 'n') && L.skillAcquired('m', 5, 'n'), '習得: nのm/fはLV5');
  ok(!L.skillAcquired('clone', 19, 'f') && L.skillAcquired('clone', 20, 'f'), '習得: ⑩はLV20');
  console.log('5b) 追加スキル③〜⑩+装備スロット: 済');
}

// 5c) 取得EXP倍率（目標タイムの何割以内か）
{
  const T = 100000; // 目標10万ms
  ok(L.expMultiplier(120000, T) === 1, 'EXP倍率: 未達成(>10割)は×1');
  ok(L.expMultiplier(100000, T) === 1.5, 'EXP倍率: ちょうど10割は×1.5');
  ok(L.expMultiplier(95000, T) === 1.5, 'EXP倍率: 9.5割は×1.5');
  ok(L.expMultiplier(80000, T) === 2, 'EXP倍率: 8割は×2');
  ok(L.expMultiplier(70000, T) === 2, 'EXP倍率: 7割(6割超8割以下)は×2');
  ok(L.expMultiplier(60000, T) === 3, 'EXP倍率: 6割は×3');
  ok(L.expMultiplier(40000, T) === 5, 'EXP倍率: 4割は×5');
  ok(L.expMultiplier(20000, T) === 7, 'EXP倍率: 2割は×7');
  ok(L.expMultiplier(10000, T) === 10, 'EXP倍率: 1割は×10');
  ok(L.expMultiplier(5000, T) === 10, 'EXP倍率: 1割未満も×10');
  console.log('5c) 取得EXP倍率: 済');
}

// 6) 難易度が上がるほど目標タイムの余裕係数が減る（単調性）
for (let i = 1; i < L.DIFFS.length; i++) {
  ok(L.DIFFS[i].margin <= L.DIFFS[i - 1].margin, 'margin単調減少');
}
console.log('6) 難易度テーブル単調性: 済');

// 7) 19言語辞書の整合性（キー欠落・配列長・プレースホルダ保持）
{
  const I = require('./i18n.js');
  const langs = I.langs.map(p => p[0]);
  ok(langs.length === 19, `言語数19（実際${langs.length}）`);
  const ja = I.dict.ja;
  const jaKeys = Object.keys(ja);
  let issues = 0;
  for (const lg of langs) {
    const d = I.dict[lg];
    if (!d) { ok(false, lg + ' 辞書なし'); continue; }
    for (const k of jaKeys) {
      if (d[k] == null) { issues++; console.log('NG: ' + lg + ' キー欠落 ' + k); }
      else if (Array.isArray(ja[k]) && (!Array.isArray(d[k]) || d[k].length !== ja[k].length)) {
        issues++; console.log('NG: ' + lg + ' 配列長ちがい ' + k);
      }
    }
    for (const id of Object.keys(ja.sk)) {
      if (!d.sk || !Array.isArray(d.sk[id]) || d.sk[id].length !== 2) { issues++; console.log('NG: ' + lg + ' sk.' + id); }
    }
    for (const k of ['got', 'full', 'ctWait', 'newSkill', 'slotsUp', 'equipNote', 'learnAt',
      'vSpeed', 'vChest', 'vLucky', 'vHawk', 'vCraft', 'vWarp', 'vHansel', 'vClone', 'vCT', 'vMaster']) {
      const phs = String(ja[k]).match(/\{[a-z]+\}/g) || [];
      for (const ph of phs) if (!String(d[k]).includes(ph)) {
        issues++; console.log('NG: ' + lg + ' ' + k + ' プレースホルダ欠落 ' + ph);
      }
    }
  }
  ok(issues === 0, `辞書整合性 問題${issues}件`);
  console.log('7) 19言語辞書の整合性: 済');
}

console.log(fails === 0 ? 'ALL OK' : 'FAILURES: ' + fails);
process.exit(fails ? 1 : 0);
