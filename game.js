/* 宝の迷宮 (Treasure Labyrinth) - ゲーム本体
   レトロ2Dドット絵 × 2.5D風俯瞰 × なぞり移動の迷路ゲーム */
(function () {
'use strict';

const L = window.Logic;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ---- 多言語（i18n.js の19言語辞書を参照） ---- */
function t(key) {
  const d = (S.save && I18N.dict[S.save.lang]) || I18N.dict.ja;
  return d[key] != null ? d[key] : I18N.dict.ja[key];
}
function tf(key, vars) {
  let s = t(key);
  for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
function detectLang() {
  const cands = (navigator.languages || [navigator.language || 'ja']).map(x => String(x).toLowerCase());
  for (const c of cands) {
    if (c.startsWith('zh')) return (c.includes('tw') || c.includes('hant') || c.includes('hk')) ? 'zh-TW' : 'zh';
    const two = c.slice(0, 2);
    if (I18N.dict[two]) return two;
  }
  return 'en';
}

/* ---- 定数 ---- */
const T = 32;      // 部屋1マスのワールドpx
const H = T / 2;   // 壁の厚み＝部屋の半分（ハシゴが見やすく・なぞりも楽）
const P = T + H;   // 部屋間の周期（壁1枚+部屋1マス）
const WH = 14;     // 壁の見た目の高さ（2.5D風に側面が見える）
/* ブロック格子は 偶数=壁(厚みH)・奇数=部屋(幅T) の交互配置 */
const bPos = b => (((b + 1) >> 1) * H) + ((b >> 1) * T);
const bSize = b => (b & 1) ? T : H;
const rowAt = wy => { const k = Math.floor(wy / P); const rem = wy - k * P; return 2 * k + (rem < H ? 0 : 1); };

const THEMES = [
  { name: 'いしの迷宮',   floor: '#d9d0aa', floor2: '#cfc59c', top: '#9aa0aa', top2: '#8a8f98', front: '#666c78', front2: '#565b66', line: '#474b55' },
  { name: 'もりの迷宮',   floor: '#c2e0a5', floor2: '#b5d896', top: '#4aa85a', top2: '#3f984f', front: '#2f7a3c', front2: '#276633', line: '#1f5429' },
  { name: 'こおりの迷宮', floor: '#e4f0fb', floor2: '#d7e9f8', top: '#a5d3f0', top2: '#95c6e8', front: '#5f9fd0', front2: '#5490bf', line: '#47799f' },
  { name: 'いせきの迷宮', floor: '#ead9b0', floor2: '#e2cfa0', top: '#cfa763', top2: '#c19a58', front: '#97713b', front2: '#856434', line: '#6d522b' },
  { name: 'おかしの迷宮', floor: '#fdeaf1', floor2: '#fbdfe9', top: '#f5aac6', top2: '#ef9cbc', front: '#d97399', front2: '#c9668c', line: '#a75273' },
  { name: 'よるの迷宮',   floor: '#454a6d', floor2: '#3e4364', top: '#8577d6', top2: '#7869c9', front: '#554a9e', front2: '#4a408c', line: '#3a3170' },
  { name: 'ようがんの迷宮', floor: '#5c4a42', floor2: '#54423a', top: '#b85c2e', top2: '#a84f26', front: '#6e2f18', front2: '#5e2712', line: '#47200e' },
  { name: 'うみの迷宮',   floor: '#f2e6c0', floor2: '#eaddb2', top: '#4a9ad4', top2: '#418cc4', front: '#2f6da0', front2: '#28608e', line: '#22507a' },
  { name: 'さくらの迷宮', floor: '#dcecc0', floor2: '#d2e4b4', top: '#f6c6d8', top2: '#f0b8cd', front: '#96604a', front2: '#875540', line: '#6e4433' },
];
const CONF_COLS = ['#f5c542', '#ff6b6b', '#4ecdc4', '#7bd44a', '#6f9dff', '#e08bff'];
/* テーマ順（石/森/氷/遺跡/菓子/夜/溶岩/海/桜）に対応するBGM */
const THEME_BGM = ['maze1', 'mazeForest', 'maze2', 'mazeRuins', 'mazeCandy', 'mazeNight', 'mazeLava', 'mazeSea', 'mazeSakura'];

/* 説明文（言語切替に追従するようgetterで遅延参照） */
const DESCS = {
  get default() { return t('dDefault'); },
  get pick() { return t('dPick'); },
  get ladder() { return t('dLadder'); },
  get coin() { return t('dCoin'); },
  get diamond() { return t('dDia'); },
  get tackle() { return t('dTackle'); },
  get warp() { return t('dWarp'); },
  get pickTarget() { return t('dPickT'); },
  get ladderTarget() { return t('dLadderT'); },
};

/* 全スキル（①②＋③〜⑩）の表示情報（名前・説明は19言語辞書から） */
function mkSkill(id, val) {
  return { get name() { return t('sk')[id][0]; }, get desc() { return t('sk')[id][1]; }, val };
}
const SKILL_INFO = {
  m: mkSkill('m', lv => tf('vCT', { n: L.tackleCT(lv) })),
  f: mkSkill('f', lv => tf('vMaster', { a: L.coinFactor(lv, true).toFixed(3), b: L.diaFactor(lv, true).toFixed(3) })),
  speed: mkSkill('speed', lv => tf('vSpeed', { n: L.speedCells(lv) })),
  chest: mkSkill('chest', lv => tf('vChest', { n: Math.round(L.chestRateBonus(lv) * 100) })),
  lucky: mkSkill('lucky', lv => tf('vLucky', { n: L.emptyRatePct(lv) })),
  hawk: mkSkill('hawk', lv => tf('vHawk', { n: L.viewRangeFor(lv) })),
  craft: mkSkill('craft', lv => tf('vCraft', { n: L.toolUses(lv) })),
  warp: mkSkill('warp', lv => tf('vCT', { n: L.warpCT(lv) })),
  hansel: mkSkill('hansel', lv => tf('vHansel', { n: L.hanselShades(lv) })),
  clone: mkSkill('clone', lv => tf('vClone', { n: L.cloneCount(lv) })),
};
const SKILL_ICONS = { m: '💥', f: '✨' };
const SKILL_ORDER = ['m', 'f'];
L.SKILLS.forEach(sk => { SKILL_ICONS[sk.id] = sk.icon; SKILL_ORDER.push(sk.id); });
const ITEM_IDX = { pick: 0, ladder: 1, coin: 2, diamond: 3 };
const ITEM_EMO = { pick: '⛏️', ladder: '🪜', coin: '🪙', diamond: '💎' };

/* ---- ドット絵キャラ（10×14・2フレーム歩行） ---- */
const PIX = {
  down: [[
    '..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.HSKSSKSH.', '.SSSSSSSS.',
    '..SSSSSS..', '..BBBBBB..', '.BBBBBBBB.', '.SBBBBBBS.', '..BBBBBB..',
    '..LLLLLL..', '..LL..LL..', '..KK..KK..', '..........',
  ], [
    '..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.HSKSSKSH.', '.SSSSSSSS.',
    '..SSSSSS..', '..BBBBBB..', '.BBBBBBBB.', '.SBBBBBBS.', '..BBBBBB..',
    '..LLLLLL..', '.LL....LL.', '.KK....KK.', '..........',
  ]],
  up: [[
    '..HHHHHH..', '.HHHHHHHH.', '.HHHHHHHH.', '.HHHHHHHH.', '.SHHHHHHS.',
    '..SSSSSS..', '..BBBBBB..', '.BBBBBBBB.', '.SBBBBBBS.', '..BBBBBB..',
    '..LLLLLL..', '..LL..LL..', '..KK..KK..', '..........',
  ], [
    '..HHHHHH..', '.HHHHHHHH.', '.HHHHHHHH.', '.HHHHHHHH.', '.SHHHHHHS.',
    '..SSSSSS..', '..BBBBBB..', '.BBBBBBBB.', '.SBBBBBBS.', '..BBBBBB..',
    '..LLLLLL..', '.LL....LL.', '.KK....KK.', '..........',
  ]],
  side: [[
    '..HHHHHH..', '.HHHHHHHH.', '.HHSSSSS..', '.HHSSKSS..', '.HHSSSSS..',
    '..SSSSS...', '..BBBBB...', '..BBBBBB..', '..BBBBSB..', '..BBBBB...',
    '...LLLL...', '...LL.L...', '...KK.K...', '..........',
  ], [
    '..HHHHHH..', '.HHHHHHHH.', '.HHSSSSS..', '.HHSSKSS..', '.HHSSSSS..',
    '..SSSSS...', '..BBBBB...', '..BBBBBB..', '..BBBBSB..', '..BBBBB...',
    '...LLLL...', '..LL..LL..', '..KK...K..', '..........',
  ]],
};
const PAL_M = { H: '#4a3020', S: '#f2c9a0', K: '#20242c', B: '#3b6fd6', L: '#27407e' };
const PAL_F = { H: '#6b3b1e', S: '#f2c9a0', K: '#20242c', B: '#e0526b', L: '#93304a' };
/* 中性キャラ「ロボ」：金属グレーのボディ＋水色に光るアイ＋アンテナ。
   人種・性別・文化に依存しないロボットで多様性に配慮 */
const PAL_N = {
  H: '#9aa4b0', // 頭部の金属
  S: '#c3ccd6', // 明るい面
  K: '#22262c', // 使わないが一応
  B: '#7c8794', // ボディ金属
  L: '#5a6470', // 脚・影
  E: '#3fe0ff', // 発光アイ（シアン）
  A: '#f5c542', // アンテナ先端の球
  P: '#4a525e', // パネルの線
};
/* ロボ専用ドット絵（H=頭金属 S=明面 B=胴 L=脚 E=光る目 A=アンテナ球 P=パネル） */
const PIX_N = {
  down: [[
    '...A......', '...A......', '..HHHHHH..', '.HHHHHHHH.', '.HEEHHEEH.',
    '..HHHHHH..', '..BBBBBB..', '.BBPBBPBB.', '.BBBBBBBB.', '..BBBBBB..',
    '..LLLLLL..', '..LL..LL..', '..LL..LL..', '..........',
  ], [
    '......A...', '......A...', '..HHHHHH..', '.HHHHHHHH.', '.HEEHHEEH.',
    '..HHHHHH..', '..BBBBBB..', '.BBPBBPBB.', '.BBBBBBBB.', '..BBBBBB..',
    '..LLLLLL..', '.LL....LL.', '.LL....LL.', '..........',
  ]],
  up: [[
    '...A......', '...A......', '..HHHHHH..', '.HHHHHHHH.', '.HHHHHHHH.',
    '..HHHHHH..', '..BBBBBB..', '.BBBBBBBB.', '.BBPPPPBB.', '..BBBBBB..',
    '..LLLLLL..', '..LL..LL..', '..LL..LL..', '..........',
  ], [
    '......A...', '......A...', '..HHHHHH..', '.HHHHHHHH.', '.HHHHHHHH.',
    '..HHHHHH..', '..BBBBBB..', '.BBBBBBBB.', '.BBPPPPBB.', '..BBBBBB..',
    '..LLLLLL..', '.LL....LL.', '.LL....LL.', '..........',
  ]],
  side: [[
    '...A......', '...A......', '..HHHHHH..', '.HHHHHHHH.', '.HHEEHH...',
    '..HHHHH...', '..BBBBB...', '..BBPBBB..', '..BBBBBB..', '..BBBBB...',
    '...LLLL...', '...LL.L...', '...LL.L...', '..........',
  ], [
    '...A......', '...A......', '..HHHHHH..', '.HHHHHHHH.', '.HHEEHH...',
    '..HHHHH...', '..BBBBB...', '..BBPBBB..', '..BBBBBB..', '..BBBBB...',
    '...LLLL...', '..LL..LL..', '..LL...L..', '..........',
  ]],
};
const SPR = {};

function pixCanvas(rows, pal) {
  const cnv = document.createElement('canvas');
  cnv.width = rows[0].length; cnv.height = rows.length;
  const c2 = cnv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]; if (ch === '.') continue;
      c2.fillStyle = pal[ch] || '#000'; c2.fillRect(x, y, 1, 1);
    }
  });
  return cnv;
}
const mirror = rows => rows.map(r => r.split('').reverse().join(''));
function buildSprites() {
  const set = (pal, px) => {
    const src = px || PIX;
    return {
      down:  src.down.map(f => pixCanvas(f, pal)),
      up:    src.up.map(f => pixCanvas(f, pal)),
      right: src.side.map(f => pixCanvas(f, pal)),
      left:  src.side.map(f => pixCanvas(mirror(f), pal)),
    };
  };
  SPR.m = set(PAL_M); SPR.f = set(PAL_F);
  SPR.n = set(PAL_N, PIX_N);                              // 明るい目
  SPR.n2 = set(Object.assign({}, PAL_N, { E: '#1f8fb5' }), PIX_N); // 少し暗い目
}
/* キャラのスプライト取得。ロボ(n)は目が1秒ごとに明↔暗で点滅 */
function charSet(g) {
  if (g === 'n') return (Math.floor(performance.now() / 1000) % 2) ? SPR.n2 : SPR.n;
  return SPR[g];
}

/* ---- 状態 ---- */
const S = {
  screen: 'title', save: null, stage: null,
  zoom: 1, tracing: false, pointers: new Map(), pinchD: 0,
  targetMode: null, confetti: [], fireworks: [],
  keysHeld: new Map(), lastKeyDir: -1, // dir→押した時刻（長押し判定用）
  congratsUntil: 0, nextBurst: 0,
};
const SAVE_KEY = 'tlab.v1';
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  const nd = L.DIFFS.length;
  S.save = Object.assign({ gender: 'm', exp: 0, badges: [], equipped: null, sound: true, fontScale: 0, volBgm: 1, volSfx: 1 }, s || {});
  if (!Array.isArray(S.save.badges)) S.save.badges = [];
  while (S.save.badges.length < nd) S.save.badges.push(0); // 難易度が増えても進捗を保持
  if (!Array.isArray(S.save.equipped)) S.save.equipped = [defaultSkill(S.save.gender)];
  if (!S.save.lang || !I18N.dict[S.save.lang]) S.save.lang = detectLang();
  sanitizeEquip();
  Snd.setEnabled(true); // 音のON/OFFは廃止。ミュートは設定の音量スライダー(0%)で行う
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.save)); } catch (e) {} }
/* 装備スキルの整合性：習得済みだけ・スロット数まで（0個も可）
   （中性キャラnの初期装備はスピードアップ） */
function defaultSkill(g) { return g === 'n' ? 'speed' : g; }
function sanitizeEquip() {
  const lv = L.levelFor(S.save.exp), g = S.save.gender;
  let eq = (S.save.equipped || []).filter((id, i, a) => a.indexOf(id) === i && L.skillAcquired(id, lv, g));
  S.save.equipped = eq.slice(0, L.slotCount(lv));
}

/* ---- キャンバス ---- */
const cv = $('cv');
const ctx = cv.getContext('2d');
function resize() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(cv.clientWidth * dpr);
  cv.height = Math.round(cv.clientHeight * dpr);
}
const roomX = rx => bPos(2 * rx + 1) + T / 2;
const roomY = ry => bPos(2 * ry + 1) + T / 2;
const worldW = m => bPos(m.bw - 1) + H;
const worldH = m => bPos(m.bh - 1) + H;
function viewScale() {
  // 基本倍率＝スマホ縦で部屋5マスぶんが見える程度
  const base = clamp(Math.min(cv.clientWidth, cv.clientHeight) / (5 * P + H), 0.9, 2.4);
  return base * S.zoom;
}
function setZoom(z) { S.zoom = clamp(z, 1 / 3, 1.4); } // ズームアウトは最大3倍まで
function resetView() { // 視点リセット：ワンタップでキャラ中心・基本倍率へ一瞬で
  if (!S.stage) return;
  S.zoom = 1;
  S.stage.cam.x = S.stage.char.x; S.stage.cam.y = S.stage.char.y;
  clampCam(S.stage);
  Snd.sfx('tap');
}
function clampCam(st) {
  const sc = viewScale();
  const vw = cv.clientWidth / sc, vh = cv.clientHeight / sc;
  const ww = worldW(st.m), wh2 = worldH(st.m);
  st.cam.x = (vw >= ww + 2 * T) ? ww / 2 : clamp(st.cam.x, vw / 2 - T, ww - vw / 2 + T);
  st.cam.y = (vh >= wh2 + 2 * T) ? wh2 / 2 : clamp(st.cam.y, vh / 2 - T, wh2 - vh / 2 + T);
}
function updateCam(dt) {
  const st = S.stage; if (!st) return;
  const k = 1 - Math.pow(0.002, dt / 1000); // キャラ中心に追従
  st.cam.x += (st.char.x - st.cam.x) * k;
  st.cam.y += (st.char.y - st.cam.y) * k;
  clampCam(st);
}

/* ---- ステージ開始 ---- */
function startStage(di, simple) {
  simple = !!simple;
  const diff = L.DIFFS[di];
  const m = L.generate(diff.w, diff.h, null, { rooms: !simple }); // シンプルは部屋なしの純粋な迷路
  // スタート＝四隅のどこかランダム／ゴール＝残り三隅 or 真ん中付近からランダム
  const corners = [[0, 0], [diff.w - 1, 0], [0, diff.h - 1], [diff.w - 1, diff.h - 1]];
  const si = (Math.random() * 4) | 0;
  const start = { rx: corners[si][0], ry: corners[si][1] };
  const gOpts = corners.filter((c, i) => i !== si).map(c => ({ rx: c[0], ry: c[1] }));
  gOpts.push({
    rx: clamp(((diff.w / 2) | 0) + ((Math.random() * 3) | 0) - 1, 1, diff.w - 2),
    ry: clamp(((diff.h / 2) | 0) + ((Math.random() * 3) | 0) - 1, 1, diff.h - 2),
  });
  // 最高難易度は必ず対角の隅＝最長ルートを確保（本当に歯ごたえのある巨大迷宮）
  const goal = (di === L.DIFFS.length - 1)
    ? { rx: diff.w - 1 - start.rx, ry: diff.h - 1 - start.ry }
    : gOpts[(Math.random() * gOpts.length) | 0];
  const path = L.shortestPath(m, start.rx, start.ry, goal.rx, goal.ry, null);
  const lv = L.levelFor(S.save.exp);
  sanitizeEquip();
  // シンプルモードはスキルを一切使わない（装備を外さずに素の迷路を楽しめる）
  const eq = simple ? new Set() : new Set(S.save.equipped);
  const st = {
    diffIdx: di, diff, m, start, goal, lv, eq, simple,
    ladders: new Uint8Array(m.bw * m.bh),
    chests: new Map(),
    timer: new L.StageTimer(),
    plan: [], gameTime: 0,
    targetMs: L.targetSeconds(diff, path.length - 1) * 1000,
    counts: { pick: 0, ladder: 0, coin: 0, diamond: 0 },
    char: { rx: start.rx, ry: start.ry, x: roomX(start.rx), y: roomY(start.ry), dir: 2, frame: 0, animT: 0, moving: null },
    cam: { x: roomX(start.rx), y: roomY(start.ry) },
    themeIdx: (Math.random() * THEMES.length) | 0,
    particles: [], shake: 0, cleared: false, tackleReadyAt: 0,
    // ---- 装備スキルだけ反映 ----
    speed: (eq.has('speed') ? L.speedCells(lv) : L.CHAR_SPEED)
         + (eq.has('hansel') ? L.hanselWalkBonus(lv) : 0),            // ③スピード ＋ ⑨LV70で歩行+2
    viewRange: eq.has('hawk') ? L.viewRangeFor(lv) : 7,                // ⑥鷹の目
    pickCharges: 0,                                                    // ⑦精密作業：つるはしの残り追加使用
    ladderRetrievals: eq.has('craft') ? Math.max(0, L.toolUses(lv) - 1) : 0, // ⑦ハシゴ回収の残り回数
    warpReadyAt: 0, warpOk: false,                                     // ⑧ワープ（クールタイム制）
    hanselShades: eq.has('hansel') ? L.hanselShades(lv) : 0,           // ⑨ヘンゼル
    visits: new Uint8Array(diff.w * diff.h),
    clones: [], cloneSpeed: L.cloneSpeed(lv),                          // ⑩分身の術（速度はLVで加速）
  };
  st.theme = THEMES[st.themeIdx];
  st.cuts = new L.CutsceneCtrl(st.timer);
  // 宝箱配置（シンプルモードは宝箱なし）。④宝箱出現アップ＋⑨ヘンゼルLV99で増量・宝箱部屋を優先的に満たす
  const sIdx = start.ry * diff.w + start.rx, gIdx = goal.ry * diff.w + goal.rx;
  if (!simple) {
    const chestBonus = (eq.has('chest') ? L.chestRateBonus(lv) : 0)
                     + (eq.has('hansel') ? L.hanselChestBonus(lv) : 0);
    const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    const rooms = m.rooms || [];
    // 部屋ぶんだけ宝を増量（部屋数＝難しさ依存）
    const n = Math.max(1, Math.round((L.chestCount(diff) + rooms.length) * (1 + chestBonus)));
    const roomSet = new Set();
    for (const room of rooms) for (const ci of room.cells) if (ci !== sIdx && ci !== gIdx) roomSet.add(ci);
    const roomCand = shuffle([...roomSet]);        // 宝箱部屋のマス
    const openCand = [];                           // 通路のマス
    for (let i = 0; i < diff.w * diff.h; i++) if (i !== sIdx && i !== gIdx && !roomSet.has(i)) openCand.push(i);
    shuffle(openCand);
    // 宝の約6割は部屋へ（宝箱部屋らしく）、残りは通路へ。余れば残りの部屋マスへ
    const roomShare = Math.min(roomCand.length, Math.round(n * 0.6));
    const order = roomCand.slice(0, roomShare).concat(openCand, roomCand.slice(roomShare));
    for (let i = 0; i < Math.min(n, order.length); i++) st.chests.set(order[i], { opened: false, result: null });
  }
  st.visits[sIdx] = 1;
  st.trailCol = makeTrail(st.theme);
  // 宝箱部屋の床：テーマに馴染む範囲で少し色を変え、通路と区別できるようにする
  st.roomFloor = mixHex(st.theme.floor, st.theme.top, 0.33);
  st.roomFloor2 = mixHex(st.theme.floor2, st.theme.top2, 0.33);
  st.roomMask = new Uint8Array(m.bw * m.bh);
  for (const room of (m.rooms || [])) {
    for (let by = 2 * room.y + 1; by <= 2 * (room.y + room.h - 1) + 1; by++)
      for (let bx = 2 * room.x + 1; bx <= 2 * (room.x + room.w - 1) + 1; bx++)
        st.roomMask[by * m.bw + bx] = 1;
  }
  st.goalDist = distMap(m, goal.rx, goal.ry);
  // ⑧ワープ ＋ ⑨ヘンゼルLV90のワープ能力（CTは短い方を採用・近リング率は合算）
  st.warpAbility = eq.has('warp') || (eq.has('hansel') && L.hanselWarp(lv));
  st.warpOk = st.warpAbility && st.goalDist.some(dv => dv >= 11);
  { let ct = Infinity, pct = 0;
    if (eq.has('warp')) { ct = L.warpCT(lv); pct = L.warpClosestPct(lv); }
    if (eq.has('hansel') && L.hanselWarp(lv)) { ct = Math.min(ct, L.HANSEL_WARP_CT); pct += L.HANSEL_WARP_PCT; }
    st.warpPct = Math.min(100, pct); st.warpCT = ct; }
  st.goalArrow = (eq.has('hawk') && lv >= 15) || (eq.has('hansel') && L.hanselGoalArrow(lv)); // 🦅LV15 / 🍞LV50
  spawnClones(st);
  S.stage = st; S.zoom = 1; S.targetMode = null; S.tracing = false;
  showScreen('play');
  updateSlots(); descDefault();
  $('diffName').textContent = t('diffs')[di] + (simple ? '（' + t('simple') + '）' : '');
  $('timeTarget').textContent = t('target') + ' ' + fmt(st.targetMs);
  showStageName(t('themes')[st.themeIdx]); // 画面中央に大きく→ゆっくりフェード
  Snd.bgm(THEME_BGM[st.themeIdx]); // 迷宮の雰囲気に合ったBGM
}

/* ---- 移動（なぞった軌跡を約1秒遅れで追いかける） ---- */
function committedPos() { const c = S.stage.char; return c.moving ? { rx: c.moving.tx, ry: c.moving.ty } : { rx: c.rx, ry: c.ry }; }
function chainLast() { const st = S.stage; return st.plan.length ? st.plan[st.plan.length - 1] : committedPos(); }
function dirBetween(ax, ay, bx, by) {
  if (bx === ax && by === ay - 1) return 0;
  if (bx === ax + 1 && by === ay) return 1;
  if (bx === ax && by === ay + 1) return 2;
  if (bx === ax - 1 && by === ay) return 3;
  return -1;
}
function handleTracePoint(e) {
  const st = S.stage; if (!st || st.cleared || st.cuts.active) return;
  const w = ptWorld(e);
  const rx = clamp(Math.round((w.x - H - T / 2) / P), 0, st.m.w - 1);
  const ry = clamp(Math.round((w.y - H - T / 2) / P), 0, st.m.h - 1);
  const last = chainLast();
  if (rx === last.rx && ry === last.ry) return;
  // ひとつ前のマスへ戻ったら取り消し
  if (st.plan.length) {
    const prev = st.plan.length >= 2 ? st.plan[st.plan.length - 2] : committedPos();
    if (prev && rx === prev.rx && ry === prev.ry) { st.plan.pop(); return; }
  }
  // 壁は越えられない（少しの指飛びだけ最短4歩まで補間）
  const seg = L.bfsLimited(st.m, last.rx, last.ry, rx, ry, 10, st.ladders); // 10マス先タップでも追尾
  if (seg && seg.length) for (const p of seg) st.plan.push({ rx: p[0], ry: p[1], t: st.gameTime });
}
function moveChar(dt) {
  const st = S.stage, c = st.char;
  let budget = dt / 1000 * st.speed * P; // 一定速度（③スピードアップで加速）
  while (budget > 0) {
    if (!c.moving) {
      const nxt = st.plan[0];
      if (!nxt) { c.animT = 0; c.frame = 0; break; }
      if (st.gameTime < nxt.t + L.TRACE_DELAY_MS) break; // 約0.5秒遅れて追いかける
      const d = dirBetween(c.rx, c.ry, nxt.rx, nxt.ry);
      if (d < 0 || !L.canPass(st.m, c.rx, c.ry, d, st.ladders)) { st.plan.shift(); continue; }
      st.plan.shift();
      const wiL = L.wallIndex(st.m, c.rx, c.ry, d);
      if (st.m.g[wiL] !== 0 && st.ladders[wiL] === d + 1) {
        // ハシゴ越え：2秒かけて上る。演出中はタイマー停止→上り終えたら即再開
        c.dir = d;
        Snd.sfx('ladder');
        st.cuts.start('climb', 2000, { d, wi: wiL, fx: c.x, fy: c.y, tx: nxt.rx, ty: nxt.ry, steps: 0 }, cut => {
          c.rx = cut.data.tx; c.ry = cut.data.ty;
          c.x = roomX(c.rx); c.y = roomY(c.ry);
          c.moving = null;
          // ⑦精密作業：上ったハシゴを回収して もう一度つかえる
          if (st.ladderRetrievals > 0) {
            st.ladderRetrievals--;
            st.ladders[cut.data.wi] = 0;
            st.counts.ladder++;
            toast(t('ladderBack'));
            updateSlots();
          }
          onEnterRoom();
        });
        break;
      }
      c.moving = { fx: c.x, fy: c.y, tx: nxt.rx, ty: nxt.ry, prog: 0, dist: P };
      c.dir = d;
    }
    const mv = c.moving;
    const step = Math.min(budget, mv.dist - mv.prog);
    mv.prog += step; budget -= step;
    const k = mv.prog / mv.dist;
    c.x = mv.fx + (roomX(mv.tx) - mv.fx) * k;
    c.y = mv.fy + (roomY(mv.ty) - mv.fy) * k;
    c.animT += step;
    c.frame = ((c.animT / (T * 0.8)) | 0) % 2; // 歩行アニメ
    if (mv.prog >= mv.dist) {
      c.rx = mv.tx; c.ry = mv.ty; c.x = roomX(c.rx); c.y = roomY(c.ry); c.moving = null;
      onEnterRoom();
      if (st.cuts.active || st.cleared) break;
    }
  }
}
function onEnterRoom() {
  const st = S.stage, c = st.char;
  const ri = c.ry * st.m.w + c.rx;
  st.visits[ri] = Math.min(3, st.visits[ri] + 1); // ⑨ヘンゼルの足あと
  const chest = st.chests.get(ri);
  if (chest && !chest.opened) {
    chest.opened = true;
    chest.result = L.rollChestWeighted(stEmptyPct(st)); // ⑤からっぽガード反映
    st.plan.length = 0;
    Snd.sfx('chest');
    st.cuts.start('chest', 3000, { ri, revealAt: 900, res: chest.result }, () => {
      applyChest(chest.result);
      chest.fading = true; chest.fadeT = 0; // タイム再開と同時にフェードアウト開始
    });
    return;
  }
  if (c.rx === st.goal.rx && c.ry === st.goal.ry) doClear();
}
function stEmptyPct(st) {
  let p = st.eq.has('lucky') ? L.emptyRatePct(st.lv) : 20;
  if (st.eq.has('hansel')) p -= L.hanselEmptyReduce(st.lv); // ⑨LV80：からっぽ率-5%
  return Math.max(1, p);
}
function applyChest(res) {
  const st = S.stage;
  if (res === 'empty') { toast(t('empty2')); Snd.sfx('empty'); return; }
  const cap = L.ITEM_CAPS[res];
  const nm = ITEM_EMO[res] + t('items')[ITEM_IDX[res]];
  if (st.counts[res] >= cap) {
    toast(tf('full', { item: nm }));
    Snd.sfx('empty');
  } else {
    st.counts[res]++;
    toast(tf('got', { item: nm }));
    Snd.sfx(res === 'coin' ? 'coin' : res === 'diamond' ? 'diamond' : 'item');
  }
  updateSlots();
}

/* ---- アイテム使用（ターゲットモード） ---- */
function playActive() { return S.screen === 'play' && S.stage && !S.stage.cleared && !S.stage.cuts.active; }
function setTarget(mode) {
  S.targetMode = mode;
  updateSlots();
  if (mode === 'pick' || mode === 'tackle') desc(DESCS.pickTarget);
  else if (mode === 'ladder') desc(DESCS.ladderTarget);
  else descDefault();
}
function candidates() {
  const st = S.stage; if (!st || !S.targetMode) return [];
  const c = st.char, out = [];
  for (let d = 0; d < 4; d++) {
    const wi = L.wallIndex(st.m, c.rx, c.ry, d);
    if (st.m.g[wi] !== 1) continue; // 外壁(2)と床(0)は不可
    if (st.ladders[wi]) continue;   // ハシゴ済みの壁は対象外
    out.push({ wi, d, bx: wi % st.m.bw, by: (wi / st.m.bw) | 0 });
  }
  return out;
}
function tryTargetTap(wx, wy) {
  const st = S.stage;
  for (const cand of candidates()) {
    const x = bPos(cand.bx), y = bPos(cand.by) - WH;
    const w = bSize(cand.bx), h = bSize(cand.by) + WH;
    if (wx >= x && wx <= x + w && wy >= y && wy <= y + h) {
      const mode = S.targetMode; setTarget(null);
      if (mode === 'ladder') {
        st.counts.ladder--; // 置いたら再配置不可・通行は何度でも（再利用可）
        st.ladders[cand.wi] = cand.d + 1;
        Snd.sfx('ladder');
        st.cuts.start('ladder', 900, { wi: cand.wi }, () => {});
      } else {
        const via = (mode === 'pick') ? 'pick' : 'tackle';
        if (via === 'pick') {
          // ⑦精密作業（装備時）：1本のつるはしを複数回つかえる
          if (st.pickCharges > 0) st.pickCharges--;
          else { st.counts.pick--; st.pickCharges = st.eq.has('craft') ? L.toolUses(st.lv) - 1 : 0; }
        } else st.tackleReadyAt = st.gameTime + L.tackleCT(st.lv) * 1000;
        st.plan.length = 0;
        st.char.dir = cand.d; // 体当たりは壁の方を向く
        // つるはし=3回叩く2秒 / 体当たり=2回突進1.5秒
        st.cuts.start('break', via === 'pick' ? 2000 : 1500, { wi: cand.wi, via, d: cand.d, hitsDone: 0 }, () => {
          st.m.g[cand.wi] = 0; // 壁1枚破壊
          spawnCrumble(cand.wi);
          Snd.sfx('crumble');
        });
      }
      updateSlots();
      return true;
    }
  }
  return false;
}

/* ---- 入力 ---- */
function ptWorld(e) {
  const r = cv.getBoundingClientRect();
  const sc = viewScale(), st = S.stage;
  return {
    x: (e.clientX - r.left - r.width / 2) / sc + st.cam.x,
    y: (e.clientY - r.top - r.height / 2) / sc + st.cam.y,
  };
}
function pinchDist() {
  const pts = [...S.pointers.values()];
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}
function attachInput() {
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.pointers.size === 2) { S.tracing = false; S.pinchD = pinchDist(); return; }
    if (S.screen !== 'play' || !S.stage) return;
    const st = S.stage;
    if (st.cuts.active) { st.cuts.skip(); return; } // タップで演出を即スキップ
    if (st.cleared) return;
    if (S.targetMode) {
      const w = ptWorld(e);
      if (!tryTargetTap(w.x, w.y)) setTarget(null);
      return;
    }
    S.tracing = true;
    handleTracePoint(e);
  });
  window.addEventListener('pointermove', e => {
    if (!S.pointers.has(e.pointerId)) return;
    S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.pointers.size === 2) { // ピンチズーム
      const d = pinchDist();
      if (S.pinchD > 0) setZoom(S.zoom * d / S.pinchD);
      S.pinchD = d;
      return;
    }
    if (S.tracing && S.screen === 'play') handleTracePoint(e);
  });
  const endPointer = e => {
    S.pointers.delete(e.pointerId);
    if (S.pointers.size < 2) S.pinchD = 0;
    if (S.pointers.size === 0) S.tracing = false;
  };
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  // ---- キーボード操作（PC向け）：矢印 / WASD / ZQSD。押しっぱなしで連続移動・ラグなし ----
  const KEYMAP = {
    arrowup: 0, w: 0, z: 0,
    arrowright: 1, d: 1,
    arrowdown: 2, s: 2,
    arrowleft: 3, a: 3, q: 3,
  };
  window.addEventListener('keydown', e => {
    const d = KEYMAP[e.key.toLowerCase()];
    if (d == null) return;
    if (S.screen !== 'play' || !S.stage) return;
    e.preventDefault();
    if (e.repeat) return; // 押しっぱなしはtick側で毎フレーム処理（OSのリピート待ちを排除）
    S.keysHeld.set(d, S.stage.gameTime); S.lastKeyDir = d;
    keyStep(d, false);
  });
  window.addEventListener('keyup', e => {
    const d = KEYMAP[e.key.toLowerCase()];
    if (d != null) S.keysHeld.delete(d);
  });
  window.addEventListener('blur', () => S.keysHeld.clear());
}
/* キー1歩ぶんの入力。cont=押しっぱなしからの自動連続 */
function keyStep(d, cont) {
  const st = S.stage; if (!st) return;
  if (st.cuts.active) { if (!cont) st.cuts.skip(); return; } // 演出はキーでもスキップ
  if (st.cleared) return;
  if (S.targetMode) { // ターゲット中は方向キーでその方向の壁を選択
    if (cont) return;
    const c = candidates().find(x => x.d === d);
    if (c) tryTargetTap(bPos(c.bx) + bSize(c.bx) / 2, bPos(c.by) - WH + 2);
    return;
  }
  const last = chainLast();
  if (st.plan.length >= 3) return; // 先行入力は3マスまで
  const nx = last.rx + L.DX[d], ny = last.ry + L.DY[d];
  if (nx < 0 || ny < 0 || nx >= st.m.w || ny >= st.m.h) return;
  if (!L.canPass(st.m, last.rx, last.ry, d, st.ladders)) return;
  st.plan.push({ rx: nx, ry: ny, t: st.gameTime - L.TRACE_DELAY_MS }); // キーはラグなし即応
}

/* ---- クリア ---- */
function doClear() {
  const st = S.stage;
  st.cleared = true; st.timer.pause();
  Snd.sfx('goal');
  const raw = st.timer.ms;
  const prevLv = L.levelFor(S.save.exp);
  // 複利計算（✨おたからマスター装備中なら係数がレベルぶん強化）
  const isF = st.eq.has('f');
  const coinF = L.coinFactor(st.lv, isF), diaF = L.diaFactor(st.lv, isF);
  const fin = L.finalTimeMs(raw, st.counts.coin, st.counts.diamond, coinF, diaF);
  const ok = fin <= st.targetMs;
  const isUlt = st.diffIdx === L.DIFFS.length - 1;
  const rew = L.expReward(st.diff.exp, fin, st.targetMs, isUlt); // {exp, mult, fixed}
  const e = st.simple ? Math.round(rew.exp * 1.5) : rew.exp; // シンプルモードは基本EXP1.5倍
  const prevScore = L.masteryScore(S.save.exp);
  // LV99到達(=530000)で経験値は打ち止め。超過分はやりこみスコアとして累計上限まで貯まる
  S.save.exp = Math.min(L.EXP_TOTAL_MAX, S.save.exp + e); S.save.badges[st.diffIdx]++; persist();
  const newLv = L.levelFor(S.save.exp);
  const newScore = L.masteryScore(S.save.exp);
  const gotMaster = newScore >= L.SCORE_MAX && prevScore < L.SCORE_MAX; // トレジャーマスター達成の瞬間
  // レベルアップ演出はクリア結果を閉じてから（同時だと見にくいので分離）
  S.pendingLevelUp = (newLv > prevLv) ? { prevLv, newLv } : null;
  setTimeout(() => {
    if (ok) { Snd.sfx('fanfare'); Snd.bgm('clearBig'); spawnConfetti(150); } // 盛大に祝う
    else    { Snd.sfx('clearSoft'); Snd.bgm('clearSoft'); spawnConfetti(25); } // ひかえめ
    buildClearOverlay(raw, fin, ok, e, newLv, coinF, diaF, rew);
    showScreen('clear');
    // 🎉最高難易度クリア or LV99到達 or 🏆トレジャーマスター達成 → 大演出
    const gotLv99 = newLv >= 99 && prevLv < 99;
    if (isUlt || gotLv99 || gotMaster) setTimeout(() => showCongrats(isUlt, gotLv99, gotMaster), 1100);
  }, 650);
}
/* クリア結果を閉じたあとにレベルアップ演出を再生（分離表示） */
function playPendingLevelUp() {
  const p = S.pendingLevelUp; if (!p) return;
  S.pendingLevelUp = null;
  showLvup(p.newLv); Snd.sfx('levelup');
  if (p.newLv >= 5 && p.prevLv < 5) setTimeout(() => toast(t('skillFree')), 1300);
  const learned = L.SKILLS.filter(sk => p.prevLv < sk.lv && p.newLv >= sk.lv);
  learned.forEach((sk, i) => setTimeout(() => toast(tf('newSkill', { s: sk.icon + SKILL_INFO[sk.id].name })), 2000 + i * 1900));
  if ([10, 20, 30, 40, 50].some(b => p.prevLv < b && p.newLv >= b)) {
    setTimeout(() => toast(tf('slotsUp', { n: L.slotCount(p.newLv) })), 2000 + learned.length * 1900);
  }
}
function buildClearOverlay(raw, fin, ok, e, lv, coinF, diaF, rew) {
  const st = S.stage, c = st.counts;
  $('clearTitle').textContent = ok ? t('clearBig') : t('clearSoft');
  // クリアした迷宮のなまえ（○○の迷宮）
  let html = '<div class="crow cmaze">～ ' + t('themes')[st.themeIdx] + ' ～</div>';
  html += '<div class="crow">' + t('mazeTime') + ' <b>' + fmt(raw) + '</b></div>';
  if (c.coin) html += '<div class="crow">🪙×' + c.coin + '　×' + Math.pow(coinF, c.coin).toFixed(3) + ' ' + t('compound') + '</div>';
  if (c.diamond) html += '<div class="crow">💎×' + c.diamond + '　×' + Math.pow(diaF, c.diamond).toFixed(3) + ' ' + t('compound') + '</div>';
  html += '<div class="crow cbig">' + t('finalTime') + ' <b>' + fmt(fin) + '</b></div>';
  html += '<div class="crow">' + t('goalTime') + ' ' + fmt(st.targetMs) + '　' + (ok ? t('achieved') : t('challenge')) + '</div>';
  // 目標達成時は「目標タイムの◯%＝EXP×N（固定EXPなら🏆）」を大きく強調
  if (ok) {
    const pct = Math.max(1, Math.round(fin / st.targetMs * 100));
    const tag = rew.fixed ? '🏆 スペシャル' : 'EXP ×' + rew.mult;
    html += '<div class="crow cbig">' + pct + '% → ' + tag + '</div>';
  }
  html += '<div class="crow">EXP <b>+' + e + '</b>　(LV ' + lv + ')' + (st.simple ? '　<span class="tag">' + t('simple') + ' ×1.5</span>' : '') + '</div>';
  // LV99カンスト後は やりこみスコア（累計EXP−530000・最大999999）を金色で表示
  const sc = L.masteryScore(S.save.exp);
  if (sc > 0) html += '<div class="crow cbig">' + t('masteryScore') + ' <b>' + sc + '</b> / ' + L.SCORE_MAX + '</div>';
  $('clearBody').innerHTML = html;
}

/* ---- スキル本体（⑧ワープ・⑨ヘンゼル・⑩分身の術） ---- */
function hexRgb(hx) { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function makeTrail(th) { // ⑨足あと色：迷宮ごとに壁色から作る（壁と見分けがつく濃さ）
  const c = hexRgb(th.front);
  return [0.24, 0.42, 0.6].map(a => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')');
}
function mixHex(a, b, t) { // 2色をtの比率で混ぜる（#rrggbb）
  const A = hexRgb(a), B = hexRgb(b), ch = i => Math.round(A[i] + (B[i] - A[i]) * t);
  return '#' + ((1 << 24) + (ch(0) << 16) + (ch(1) << 8) + ch(2)).toString(16).slice(1);
}
function distMap(m, gx, gy) { // ゴールからの歩行距離（アイテム無しの通路のみ）
  const dist = new Int32Array(m.w * m.h).fill(-1);
  dist[gy * m.w + gx] = 0;
  const q = [gy * m.w + gx];
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], cx = i % m.w, cy = (i / m.w) | 0;
    for (let d = 0; d < 4; d++) {
      if (!L.canPass(m, cx, cy, d, null)) continue;
      const ni = (cy + L.DY[d]) * m.w + (cx + L.DX[d]);
      if (dist[ni] >= 0) continue;
      dist[ni] = dist[i] + 1; q.push(ni);
    }
  }
  return dist;
}
function doWarp() { // ⑧1回だけランダムワープ。ゴールから10マス以内には飛ばない
  const st = S.stage;
  const dist = st.goalDist, cRoom = st.char.ry * st.m.w + st.char.rx;
  const cands = []; let minD = 1e9;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] >= 11 && i !== cRoom) { cands.push(i); if (dist[i] < minD) minD = dist[i]; }
  }
  if (!cands.length) { toast(t('warpNo')); Snd.sfx('nope'); return; }
  st.warpReadyAt = st.gameTime + st.warpCT * 1000; // 使うたびクールタイム（⑧/⑨で決定）
  // レベルが高いほど「いちばんゴール寄り(11マス)のリング」へ飛べる確率が上がる
  const ring = cands.filter(i => dist[i] === minD);
  const pool = (Math.random() < st.warpPct / 100) ? ring : cands;
  const dest = pool[(Math.random() * pool.length) | 0];
  st.plan.length = 0;
  setTarget(null);
  Snd.sfx('warp');
  st.cuts.start('warp', 1400, { fx: st.char.x, fy: st.char.y, tx: dest % st.m.w, ty: (dest / st.m.w) | 0, moved: false }, () => {
    toast(t('warped'));
    onEnterRoom();
  });
  updateSlots();
}
function spawnClones(st) { // ⑩分身＋⑨ヘンゼルLV60の分身：装備中＆宝箱がある間だけ働く
  const n = (st.eq.has('clone') ? L.cloneCount(st.lv) : 0)
          + (st.eq.has('hansel') ? L.hanselCloneCount(st.lv) : 0);
  if (!n || !st.chests.size) return;
  for (let i = 0; i < n; i++) {
    st.clones.push({
      rx: st.start.rx, ry: st.start.ry, x: roomX(st.start.rx), y: roomY(st.start.ry),
      dir: 2, animT: 0, frame: 0, target: -1, path: [], fade: 1, dying: false,
    });
  }
}
function cloneOpenChest(st, cl) {
  const chd = st.chests.get(cl.target);
  cl.target = -1;
  if (!chd || chd.opened) return;
  chd.opened = true;
  chd.result = L.rollChestWeighted(stEmptyPct(st));
  applyChest(chd.result); // 分身は演出なしで取ってくる（タイマーは止まらない）
  chd.fading = true; chd.fadeT = 0;
}
function updateClones(st, dt) {
  if (!st.clones.length) return;
  for (let ci = st.clones.length - 1; ci >= 0; ci--) {
    const cl = st.clones[ci];
    if (cl.dying) { // 宝箱が無くなったら すうっと消える
      cl.fade -= dt / 600;
      if (cl.fade <= 0) st.clones.splice(ci, 1);
      continue;
    }
    if (cl.target < 0 || !st.chests.has(cl.target) || st.chests.get(cl.target).opened) {
      // 他の分身が狙っていない、いちばん近い宝箱へ
      const claimed = new Set(st.clones.map(c2 => c2.target));
      let best = null, bestLen = 1e9;
      for (const pair of st.chests) {
        if (pair[1].opened || claimed.has(pair[0])) continue;
        const p = L.shortestPath(st.m, cl.rx, cl.ry, pair[0] % st.m.w, (pair[0] / st.m.w) | 0, st.ladders);
        if (p && p.length < bestLen) { bestLen = p.length; best = { ri: pair[0], p }; }
      }
      if (!best) { cl.dying = true; continue; }
      cl.target = best.ri; cl.path = best.p.slice(1);
    }
    // 移動速度はLVで加速（⑩レベル50=2/70=3/90=5マス/秒）
    let budget = dt / 1000 * st.cloneSpeed * P;
    while (budget > 0 && cl.path.length) {
      const nx = cl.path[0];
      const txx = roomX(nx[0]), tyy = roomY(nx[1]);
      const dx = txx - cl.x, dy = tyy - cl.y;
      const dd = Math.hypot(dx, dy);
      if (dd <= budget) {
        cl.x = txx; cl.y = tyy; cl.rx = nx[0]; cl.ry = nx[1];
        budget -= dd; cl.animT += dd;
        cl.path.shift();
        if (!cl.path.length) cloneOpenChest(st, cl);
      } else {
        cl.x += dx / dd * budget; cl.y += dy / dd * budget;
        cl.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        cl.animT += budget; budget = 0;
      }
      cl.frame = ((cl.animT / (T * 0.8)) | 0) % 2;
    }
  }
}

/* ---- パーティクル ---- */
function spawnCrumble(wi) {
  const st = S.stage, bx = wi % st.m.bw, by = (wi / st.m.bw) | 0;
  for (let i = 0; i < 12; i++) {
    st.particles.push({
      x: bPos(bx) + bSize(bx) / 2, y: bPos(by) + bSize(by) / 2 - WH / 2,
      vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 160 - 40,
      g: 420, life: 0.7 + Math.random() * 0.3, col: st.theme.front, size: 3 + Math.random() * 3,
    });
  }
  st.shake = 6;
}
function updateParticles(st, dt) {
  const s = dt / 1000;
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const p = st.particles[i];
    p.life -= s;
    if (p.life <= 0) { st.particles.splice(i, 1); continue; }
    p.vy += p.g * s; p.x += p.vx * s; p.y += p.vy * s;
  }
}
function spawnConfetti(n) {
  const cw = cv.clientWidth;
  for (let i = 0; i < n; i++) {
    S.confetti.push({
      x: Math.random() * cw, y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 140,
      rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 8,
      col: CONF_COLS[(Math.random() * CONF_COLS.length) | 0],
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 4,
    });
  }
}
function updateConfetti(dt) {
  const s = dt / 1000, ch = cv.clientHeight;
  for (let i = S.confetti.length - 1; i >= 0; i--) {
    const p = S.confetti[i];
    p.x += p.vx * s; p.y += p.vy * s; p.rot += p.vr * s;
    if (p.y > ch + 30) S.confetti.splice(i, 1);
  }
}

/* ---- コングラチュレーション（最高難易度クリア・LV99）＋花火 ---- */
function showCongrats(gotMax, gotLv99, gotMaster) {
  const cg = I18N.congrats[S.save.lang] || I18N.congrats.ja;
  const subs = [];
  if (gotMaster) subs.push(cg[2]);
  if (gotMax) subs.push(cg[0]);
  if (gotLv99) subs.push(cg[1]);
  $('congratsSub').textContent = subs.join('　');
  // 🏆トレジャーマスター達成時は最大級：金色見出し＋長め＆多めの花火
  $('congratsMain').textContent = gotMaster ? ('🏆 ' + t('treasureMaster') + ' 🏆') : '🎉 CONGRATULATIONS!! 🎉';
  $('congratsMain').classList.toggle('master', !!gotMaster);
  $('congrats').classList.remove('hidden');
  S.congratsUntil = performance.now() + (gotMaster ? 13000 : 9500); // 花火の打ち上げ時間
  S.nextBurst = 0;
  Snd.bgm('congrats');
  Snd.sfx('fanfare');
  spawnConfetti(gotMaster ? 420 : 260);
}
function hideCongrats() {
  $('congrats').classList.add('hidden');
  S.congratsUntil = 0;
  S.fireworks.length = 0;
  Snd.bgm('clearBig');
}
function updateFireworks(dt) {
  const s = dt / 1000;
  if (S.congratsUntil && performance.now() < S.congratsUntil) {
    if (performance.now() >= S.nextBurst) { // 次の打ち上げ
      S.nextBurst = performance.now() + 420 + Math.random() * 380;
      const cw = cv.clientWidth, chh = cv.clientHeight;
      const x = cw * (0.15 + Math.random() * 0.7), y = chh * (0.1 + Math.random() * 0.45);
      const col = CONF_COLS[(Math.random() * CONF_COLS.length) | 0];
      for (let i = 0; i < 44; i++) {
        const a = Math.random() * 6.283, v = 60 + Math.random() * 170;
        S.fireworks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + Math.random() * 0.5, col, size: 2.5 + Math.random() * 2.2 });
      }
      Snd.sfx('bang');
      spawnConfetti(26);
    }
  }
  for (let i = S.fireworks.length - 1; i >= 0; i--) {
    const p = S.fireworks[i];
    p.life -= s;
    if (p.life <= 0) { S.fireworks.splice(i, 1); continue; }
    p.vy += 100 * s; p.x += p.vx * s; p.y += p.vy * s;
  }
}

/* ---- 毎フレーム更新 ---- */
function tick(dt) {
  const st = S.stage;
  if (st && S.screen === 'play' && !st.cleared) {
    st.cuts.update(dt);
    const cutA = st.cuts.active;
    if (cutA) {
      if (cutA.kind === 'break') { // つるはし=3回叩く / 体当たり=2回突進
        const pick = cutA.data.via === 'pick';
        const hits = pick ? Math.min(3, 1 + ((cutA.t / 650) | 0))
                          : Math.min(2, 1 + ((cutA.t / 700) | 0));
        if (hits > cutA.data.hitsDone) {
          cutA.data.hitsDone = hits;
          Snd.sfx(pick ? 'pickHit' : 'thud');
          st.shake = pick ? 5 : 7;
        }
      } else if (cutA.kind === 'climb') { // のぼり中の足音
        const stp = Math.min(4, 1 + ((cutA.t / 500) | 0));
        if (stp > (cutA.data.steps || 0)) { cutA.data.steps = stp; Snd.sfx('climbStep'); }
      } else if (cutA.kind === 'warp') { // 半分すぎたら瞬間移動（あとは出現演出）
        if (cutA.t >= cutA.dur / 2 && !cutA.data.moved) {
          cutA.data.moved = true;
          const c = st.char;
          c.rx = cutA.data.tx; c.ry = cutA.data.ty;
          c.x = roomX(c.rx); c.y = roomY(c.ry); c.moving = null;
          st.cam.x = c.x; st.cam.y = c.y; clampCam(st);
          st.visits[c.ry * st.m.w + c.rx] = Math.min(3, st.visits[c.ry * st.m.w + c.rx] + 1);
        }
      }
    } else {
      st.timer.update(dt); // 演出中はタイマーが止まっている
      st.gameTime += dt;
      // 開封済みの宝箱は箱ごとフェードアウト→消滅
      for (const pair of st.chests) {
        const chd = pair[1];
        if (chd.fading) { chd.fadeT += dt; if (chd.fadeT >= 700) st.chests.delete(pair[0]); }
      }
      moveChar(dt);
      updateClones(st, dt); // ⑩分身の術
      // キー押しっぱなし（260ms以上の長押しのみ）：計画が尽きたら次の1歩を足す
      // →「1回押し＝きっちり1マス」「押しっぱなし＝連続移動」の両立
      if (S.keysHeld.size && st.plan.length < 1) {
        const d = S.keysHeld.has(S.lastKeyDir) ? S.lastKeyDir : [...S.keysHeld.keys()][0];
        if (st.gameTime - S.keysHeld.get(d) > 260) keyStep(d, true); // 長押しのみ連続
      }
    }
  }
  if (st) {
    updateCam(dt);
    updateParticles(st, dt);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 0.02);
  }
  updateConfetti(dt);
  updateFireworks(dt);
  updateHud();
}
function updateHud() {
  const st = S.stage;
  if (!st || (S.screen !== 'play' && S.screen !== 'clear')) return;
  $('timeNow').textContent = fmt(st.timer.ms);
  if (st.eq.has('m')) {
    const remain = Math.max(0, st.tackleReadyAt - st.gameTime);
    $('cntFist').textContent = remain > 0 ? Math.ceil(remain / 1000) + 's' : 'OK';
    $('slotFist').classList.toggle('dim', remain > 0);
  }
  if (st.warpAbility && st.warpOk) {
    const remainW = Math.max(0, st.warpReadyAt - st.gameTime);
    $('cntWarp').textContent = remainW > 0 ? Math.ceil(remainW / 1000) + 's' : 'OK';
    $('slotWarp').classList.toggle('dim', remainW > 0);
  }
}

/* ---- 描画 ---- */
function render() {
  const dpr = window.devicePixelRatio || 1;
  const cw = cv.clientWidth, ch = cv.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#101223'; ctx.fillRect(0, 0, cw, ch);
  const st = S.stage;
  if (st) {
    const sc = viewScale();
    let shx = 0, shy = 0;
    if (st.shake > 0) { shx = (Math.random() - 0.5) * st.shake; shy = (Math.random() - 0.5) * st.shake; }
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (cw / 2 - (st.cam.x + shx) * sc), dpr * (ch / 2 - (st.cam.y + shy) * sc));
    ctx.imageSmoothingEnabled = false;
    const m = st.m, th = st.theme;
    const x0 = clamp(2 * Math.floor((st.cam.x - cw / 2 / sc) / P) - 1, 0, m.bw - 1);
    const x1 = clamp(2 * Math.ceil((st.cam.x + cw / 2 / sc) / P) + 1, 0, m.bw - 1);
    const y0 = clamp(2 * Math.floor((st.cam.y - ch / 2 / sc) / P) - 2, 0, m.bh - 1);
    const y1 = clamp(2 * Math.ceil((st.cam.y + ch / 2 / sc) / P) + 2, 0, m.bh - 1);
    // 床
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      if (m.g[by * m.bw + bx] !== 0) continue;
      const rm = st.roomMask[by * m.bw + bx]; // 宝箱部屋のマスは少し違う床色
      ctx.fillStyle = ((bx + by) & 1) ? (rm ? st.roomFloor : th.floor) : (rm ? st.roomFloor2 : th.floor2);
      ctx.fillRect(bPos(bx), bPos(by), bSize(bx), bSize(by));
      // ⑨ヘンゼル：歩いた部屋の床に足あと色（通った回数で濃くなる）
      if (st.hanselShades > 0 && (bx & 1) && (by & 1)) {
        const v = st.visits[((by - 1) >> 1) * m.w + ((bx - 1) >> 1)];
        if (v > 0) {
          ctx.fillStyle = st.trailCol[Math.min(v, st.hanselShades) - 1];
          ctx.fillRect(bPos(bx), bPos(by), bSize(bx), bSize(by));
        }
      }
    }
    drawPlan(st);
    // 行ごとに 壁→エンティティ（2.5D風の前後関係）
    const charRow = clamp(rowAt(st.char.y), 0, m.bh - 1);
    const goalRow = 2 * st.goal.ry + 1;
    const cutNow = st.cuts.active;
    const climbing = cutNow && cutNow.kind === 'climb';
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        const v = m.g[by * m.bw + bx];
        if (v === 0) continue;
        drawWallBlock(st, bx, by, v);
      }
      if (by === goalRow) drawGoal(st);
      for (const pair of st.chests) {
        const ry = (pair[0] / m.w) | 0;
        if (2 * ry + 1 === by) drawChest(st, pair[0], pair[1]);
      }
      for (const cl of st.clones) {
        if (clamp(rowAt(cl.y), 0, m.bh - 1) === by) drawClone(cl);
      }
      if (by === charRow && !climbing) drawChar(st);
    }
    if (climbing) drawChar(st); // のぼり中は壁のさらに上に見える
    drawTargets(st);
    drawCutFx(st);
    for (const p of st.particles) {
      ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // 視界：7マスまでハッキリ→8マス以降は遠いほど暗く、遥か遠くはほぼ見えない（クリア後も維持）
    {
      const vr = st.viewRange;
      const rIn = vr * P, rOut = (vr + 9) * P; // 7マス〜16マスにかけて漆黒へ
      const span = rOut - rIn;
      const fg = ctx.createRadialGradient(st.char.x, st.char.y, rIn, st.char.x, st.char.y, rOut);
      fg.addColorStop(0, 'rgba(8,8,22,0)');
      fg.addColorStop((1 * P) / span, 'rgba(8,8,22,0.35)'); // 8マス：薄暗い
      fg.addColorStop((3 * P) / span, 'rgba(8,8,22,0.6)');  // 10マス：かなり暗い
      fg.addColorStop((5 * P) / span, 'rgba(8,8,22,0.82)'); // 12マス：ほの見える程度
      fg.addColorStop(1, 'rgba(8,8,22,0.97)');              // 16マス以降：ほぼ見えない
      ctx.fillStyle = fg;
      ctx.fillRect(st.cam.x - cw / 2 / sc - 12, st.cam.y - ch / 2 / sc - 12, cw / sc + 24, ch / sc + 24);
    }
    // 🦅たかのめLV15：ゴールの方向を金の矢印で示す（霧の上に描く）
    if (st.goalArrow && !st.cleared) {
      const dxg = roomX(st.goal.rx) - st.char.x, dyg = roomY(st.goal.ry) - st.char.y;
      if (Math.hypot(dxg, dyg) > T * 1.5) {
        const angG = Math.atan2(dyg, dxg);
        const rrG = T * 1.3 + Math.sin(performance.now() / 280) * 3;
        ctx.save();
        ctx.translate(st.char.x + Math.cos(angG) * rrG, st.char.y + Math.sin(angG) * rrG - T * 0.2);
        ctx.rotate(angG);
        ctx.fillStyle = 'rgba(245,197,66,0.95)';
        ctx.strokeStyle = 'rgba(60,40,0,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // 紙吹雪・花火（スクリーン座標）
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const p of S.confetti) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  for (const p of S.fireworks) {
    ctx.globalAlpha = Math.min(1, p.life * 1.6);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawWallBlock(st, bx, by, v) {
  const m = st.m, th = st.theme;
  const x = bPos(bx), y = bPos(by), w = bSize(bx), h = bSize(by);
  const below = (by + 1 < m.bh) ? m.g[(by + 1) * m.bw + bx] : 0;
  if (below === 0) { // 壁の側面（前面）が見える
    ctx.fillStyle = (v === 2) ? th.front2 : th.front;
    ctx.fillRect(x, y + h - WH, w, WH);
    ctx.fillStyle = th.line;
    ctx.fillRect(x, y + h - WH + ((WH / 2) | 0), w, 1);
    ctx.fillRect(x + ((bx & 1) ? (w >> 2) : (3 * w >> 2)), y + h - WH, 1, (WH / 2) | 0);
  }
  ctx.fillStyle = (v === 2) ? th.top2 : th.top;
  ctx.fillRect(x, y - WH, w, h);
  ctx.strokeStyle = th.line; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y - WH + 0.5, w - 1, h - 1);
  const cutA = st.cuts.active;
  if (cutA && cutA.kind === 'break' && cutA.data.wi === by * m.bw + bx) {
    drawCracks(x, y - WH, w, h + WH, cutA.data.hitsDone || 1);
  }
  const lv = st.ladders[by * m.bw + bx];
  if (lv) drawLadder(bx, by, lv - 1);
}
function drawCracks(x, y, w, h, lvl) {
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.15); ctx.lineTo(x + w * 0.35, y + h * 0.45); ctx.lineTo(x + w * 0.55, y + h * 0.6);
  if (lvl >= 2) {
    ctx.moveTo(x + w * 0.35, y + h * 0.45); ctx.lineTo(x + w * 0.15, y + h * 0.7);
    ctx.moveTo(x + w * 0.55, y + h * 0.6); ctx.lineTo(x + w * 0.75, y + h * 0.85);
  }
  if (lvl >= 3) {
    ctx.moveTo(x + w * 0.5, y + h * 0.15); ctx.lineTo(x + w * 0.72, y + h * 0.35);
    ctx.moveTo(x + w * 0.15, y + h * 0.7); ctx.lineTo(x + w * 0.3, y + h * 0.9);
  }
  ctx.stroke();
}
function ladderShape(baseX, baseY, len, angle) {
  // 基点(足もと)から上へ伸びるハシゴを描く。angleで傾けて「立てかけ」感を出す
  ctx.save(); ctx.translate(baseX, baseY); ctx.rotate(angle);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(-7, -len, 3, len);
  ctx.fillRect(4, -len, 3, len);
  ctx.fillStyle = '#b8834a';
  const n = Math.max(2, Math.round(len / 9));
  for (let i = 0; i < n; i++) ctx.fillRect(-7, -len + 3 + i * ((len - 6) / Math.max(1, n - 1)), 14, 2.5);
  ctx.restore();
}
function ladderSide(bX, bY, tX, tY) {
  // 真横から見た立てかけハシゴ＝支柱だけが見え、踏み板は見えない
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(bX, bY); ctx.lineTo(tX, tY); ctx.stroke();
  ctx.strokeStyle = '#b8834a'; ctx.lineWidth = 1.5; // 奥側の支柱がわずかにのぞく
  ctx.beginPath(); ctx.moveTo(bX, bY - 2.5); ctx.lineTo(tX, tY - 2.5); ctx.stroke();
}
function drawLadder(bx, by, d) {
  // 設置した側から壁に「立てかけた」ハシゴ。d=とおれる方向
  const x = bPos(bx), y = bPos(by), yTop = y - WH, w = bSize(bx), h = bSize(by);
  const cx = x + w / 2, cy = yTop + h / 2;
  if (d === 0) {
    // 南側から北へ：手前の面に立てかける＝全身が見える
    ladderShape(cx, y + h + 3, h + WH + 10, 0);
  } else if (d === 2) {
    // 北側から南へ：壁のむこう側なので、先端だけ壁の上からのぞく
    ladderShape(cx, yTop + 7, 15, 0);
  } else if (d === 1) {
    // 西側から東へ：西の床から斜めに立てかけ＝真横から見えるのは支柱だけ
    ladderSide(x - 9, y + h * 0.78, x + 5, yTop + 2);
  } else {
    // 東側から西へ：東の床から斜めに立てかけ
    ladderSide(x + w + 9, y + h * 0.78, x + w - 5, yTop + 2);
  }
  // とおれる方向の矢印（壁の上面）
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  const a = 5;
  if (d === 0) { ctx.moveTo(cx, cy - a); ctx.lineTo(cx - a, cy + a); ctx.lineTo(cx + a, cy + a); }
  if (d === 2) { ctx.moveTo(cx, cy + a); ctx.lineTo(cx - a, cy - a); ctx.lineTo(cx + a, cy - a); }
  if (d === 1) { ctx.moveTo(cx + a, cy); ctx.lineTo(cx - a, cy - a); ctx.lineTo(cx - a, cy + a); }
  if (d === 3) { ctx.moveTo(cx - a, cy); ctx.lineTo(cx + a, cy - a); ctx.lineTo(cx + a, cy + a); }
  ctx.closePath(); ctx.fill();
}
function drawPlan(st) {
  if (!st.plan.length) return;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (const p of st.plan) {
    ctx.beginPath(); ctx.arc(roomX(p.rx), roomY(p.ry), 3.2, 0, 6.3); ctx.fill();
  }
  const lastP = st.plan[st.plan.length - 1];
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(roomX(lastP.rx), roomY(lastP.ry), 6, 0, 6.3); ctx.stroke();
}
function drawGoal(st) {
  const gx = roomX(st.goal.rx), gy = roomY(st.goal.ry);
  const t2 = performance.now() / 1000; // ※tはi18n関数なので別名
  // 大きな金の宝箱（部屋幅を少しはみ出すくらい堂々と）
  const w = T * 1.15, h = T * 0.9, x = gx - w / 2, y = gy + T * 0.42 - h;
  const lidH = h * 0.4;
  // 後光（明滅する金色のオーラ）
  const glow = 0.22 + 0.13 * Math.sin(t2 * 2.4);
  ctx.fillStyle = 'rgba(255,220,90,' + glow.toFixed(3) + ')';
  ctx.beginPath(); ctx.arc(gx, gy - h * 0.2, w * 0.85, 0, 6.3); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,160,' + (glow * 0.8).toFixed(3) + ')';
  ctx.beginPath(); ctx.arc(gx, gy - h * 0.2, w * 0.55, 0, 6.3); ctx.fill();
  // クリア後はふたが奥へ開く
  if (st.cleared) {
    ctx.fillStyle = '#c79a2e';
    ctx.fillRect(x - 1, y - lidH * 0.8, w + 2, lidH * 0.8);
    ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y - lidH * 0.8, w + 2, lidH * 0.8);
    ctx.fillStyle = '#3a2a08';
    ctx.fillRect(x + 3, y + lidH - 3, w - 6, 7); // 開いた口
  }
  // 本体（金＋濃金の縁取り）
  ctx.fillStyle = '#e8b93a';
  ctx.fillRect(x, y + (st.cleared ? lidH : 0), w, h - (st.cleared ? lidH : 0));
  if (!st.cleared) { // 閉じたふた（明るめの金）
    ctx.fillStyle = '#f7d35e';
    ctx.fillRect(x - 1, y, w + 2, lidH);
  }
  ctx.strokeStyle = '#8a5a1c'; ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y + (st.cleared ? lidH : 0), w + 2, h - (st.cleared ? lidH : 0));
  ctx.fillStyle = '#a87818';
  ctx.fillRect(x, y + h - 5, w, 5); // 底の影
  // 赤い宝石の錠前
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(gx, y + lidH + 2, 4.5, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#ff9d8a';
  ctx.fillRect(gx - 2.5, y + lidH - 0.5, 2, 2);
  // キラーン（十字の輝き2つ・交互に瞬く）
  const tw1 = Math.max(0, Math.sin(t2 * 3.1));
  const tw2 = Math.max(0, Math.sin(t2 * 3.1 + 2.2));
  ctx.fillStyle = 'rgba(255,255,230,' + (0.4 + 0.6 * tw1).toFixed(3) + ')';
  drawTwinkle(x + w * 0.16, y + 3, 4 + 3 * tw1);
  ctx.fillStyle = 'rgba(255,255,230,' + (0.4 + 0.6 * tw2).toFixed(3) + ')';
  drawTwinkle(x + w * 0.88, y + h * 0.5, 3.5 + 3 * tw2);
  // 立ちのぼるきらめき
  ctx.fillStyle = 'rgba(255,236,150,' + (0.5 + 0.5 * Math.sin(t2 * 3)).toFixed(3) + ')';
  ctx.fillRect(gx - 2, gy - T * 0.95 - ((t2 * 12) % 12), 3.5, 3.5);
  ctx.fillRect(gx + 11, gy - T * 0.7 - ((t2 * 15) % 13), 3, 3);
  ctx.fillRect(gx - 13, gy - T * 0.75 - ((t2 * 9) % 10), 3, 3);
  // 「ゴール」ラベル（ふわふわ上下・多言語）
  const gTxt = t('goalLbl');
  const ly = y - 22 + Math.sin(t2 * 2) * 2;
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lw = ctx.measureText(gTxt).width + 14;
  ctx.fillStyle = 'rgba(20,16,40,0.75)';
  ctx.fillRect(gx - lw / 2, ly - 9, lw, 18);
  ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1;
  ctx.strokeRect(gx - lw / 2 + 0.5, ly - 8.5, lw - 1, 17);
  ctx.fillStyle = '#f5c542';
  ctx.fillText(gTxt, gx, ly + 0.5);
}
function drawTwinkle(cx, cy, r) {
  ctx.fillRect(cx - r, cy - 1, r * 2, 2);
  ctx.fillRect(cx - 1, cy - r, 2, r * 2);
}
function drawChest(st, ri, chd) {
  const m = st.m, rx = ri % m.w, ry = (ri / m.w) | 0;
  const cx = roomX(rx), cyB = roomY(ry) + T * 0.36;
  const w = T * 0.62, h = T * 0.5, x = cx - w / 2, y = cyB - h;
  const cutA = st.cuts.active;
  let k = chd.opened ? 1 : 0; // ふたの開き具合 0=閉 1=全開
  if (cutA && cutA.kind === 'chest' && cutA.data.ri === ri) k = Math.min(1, cutA.t / 800);
  // 開封後はタイム再開とともにフェードアウト
  const alpha = chd.fading ? Math.max(0, 1 - chd.fadeT / 700) : 1;
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const RED = '#a83434', RED_L = '#bf4646', RED_D = '#7c2626', GOLD = '#f5c542', INNER = '#3a1414';
  const lidH = h * 0.42;
  // 開いたふた（蝶番＝箱の奥の辺。半分をこえたら奥へパタンと倒れて内側が見える）
  if (k > 0.5) {
    const bh = lidH * 0.85 * (k - 0.5) * 2;
    ctx.fillStyle = RED_D;
    ctx.fillRect(x - 1, y - bh, w + 2, bh);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 0.5, y - bh + 0.5, w + 1, Math.max(1, bh - 1));
  }
  // 本体（赤＋金の縁取り）
  ctx.fillStyle = RED;
  ctx.fillRect(x, y + lidH, w, h - lidH);
  ctx.fillStyle = RED_D;
  ctx.fillRect(x, y + h - 4, w, 4); // 底の影
  // 中身の暗がり（開きはじめたら見える）
  if (k > 0.15) { ctx.fillStyle = INNER; ctx.fillRect(x + 2, y + lidH - 2, w - 4, 6); }
  // 閉じている間のふた（奥の蝶番を軸に起き上がる＝手前の高さが縮む）
  if (k < 0.5) {
    const fh = lidH * (1 - k * 2);
    ctx.fillStyle = RED_L;
    ctx.fillRect(x - 1, y + (lidH - fh), w + 2, fh);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 0.5, y + (lidH - fh) + 0.5, w + 1, Math.max(1, fh - 1));
  }
  // 金の縁取り・帯・錠前
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + lidH + 0.5, w - 1, h - lidH - 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x + w * 0.44, y + lidH, w * 0.12, h - lidH);
  if (k < 0.3) ctx.fillRect(x + w * 0.4, y + lidH - 2, w * 0.2, 5); // 錠前
  ctx.globalAlpha = 1;
}
function drawChar(st) {
  const c = st.char;
  const set = charSet(S.save.gender);
  const cutA = st.cuts.active;
  if (cutA && cutA.kind === 'climb') {
    // ハシゴのぼり：2秒かけて壁を乗り越える（山なりに持ち上がる）
    const dd = cutA.data;
    const k = Math.min(1, cutA.t / cutA.dur);
    const ex = roomX(dd.tx), ey = roomY(dd.ty);
    const px = dd.fx + (ex - dd.fx) * k;
    const py = dd.fy + (ey - dd.fy) * k;
    const hump = Math.sin(Math.PI * k) * (WH + 6);
    const key2 = dd.d === 0 ? 'up' : dd.d === 1 ? 'right' : dd.d === 3 ? 'left' : 'down';
    const f2 = ((cutA.t / 180) | 0) % 2; // 手足をバタバタ
    ctx.drawImage(set[key2][f2], Math.round(px - 10), Math.round(py + T * 0.4 - 28 - hump), 20, 28);
    return;
  }
  const key = c.dir === 0 ? 'up' : c.dir === 1 ? 'right' : c.dir === 3 ? 'left' : 'down';
  let frame = c.moving ? c.frame : 0;
  let ox = 0, oy = 0;
  if (cutA && cutA.kind === 'break' && cutA.data.via === 'tackle') {
    // 体当たり：壁に向かって突進→跳ね返るを繰り返す
    const cyc = (cutA.t % 700) / 700;
    const lunge = cyc < 0.4 ? (cyc / 0.4) : Math.max(0, 1 - (cyc - 0.4) / 0.35);
    const amp = lunge * (H + T * 0.2);
    ox = L.DX[cutA.data.d] * amp;
    oy = L.DY[cutA.data.d] * amp;
    frame = 1; // 走りポーズ
  }
  if (cutA && cutA.kind === 'warp') { // ワープ：消えて→出てくる
    const k = cutA.t / cutA.dur;
    ctx.globalAlpha = k < 0.5 ? Math.max(0, 1 - k * 2.2) : Math.min(1, (k - 0.5) * 2.2);
  }
  ctx.drawImage(set[key][frame], Math.round(c.x - 10 + ox), Math.round(c.y + T * 0.4 - 28 + oy), 20, 28);
  ctx.globalAlpha = 1;
}
function drawClone(cl) {
  const set = charSet(S.save.gender);
  const key = cl.dir === 0 ? 'up' : cl.dir === 1 ? 'right' : cl.dir === 3 ? 'left' : 'down';
  ctx.globalAlpha = 0.45 * cl.fade; // 半透明の分身
  ctx.drawImage(set[key][cl.frame], Math.round(cl.x - 10), Math.round(cl.y + T * 0.4 - 28), 20, 28);
  ctx.globalAlpha = 1;
}
function drawTargets(st) {
  if (!S.targetMode) return;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
  for (const c of candidates()) {
    const x = bPos(c.bx), y = bPos(c.by) - WH;
    const w = bSize(c.bx), h = bSize(c.by) + WH;
    ctx.strokeStyle = 'rgba(255,220,80,' + (0.45 + 0.5 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(255,220,80,' + (0.12 + 0.15 * pulse).toFixed(3) + ')';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  }
}
function drawCutFx(st) {
  const c = st.cuts.active; if (!c) return;
  const m = st.m;
  if (c.kind === 'break') {
    const bx = c.data.wi % m.bw, by = (c.data.wi / m.bw) | 0;
    const wx = bPos(bx) + bSize(bx) / 2, wy = bPos(by) + bSize(by) / 2;
    if (c.data.via === 'pick') {
      // つるはし：振り下ろしアニメ
      const swing = Math.sin(c.t / 650 * Math.PI * 2) * 0.9;
      ctx.save();
      ctx.translate(wx + T * 0.35, wy - WH - T * 0.3);
      ctx.rotate(-0.6 + swing);
      ctx.font = ((T * 0.9) | 0) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⛏️', 0, 0);
      ctx.restore();
    } else {
      // 体当たり：衝突の瞬間に火花マーク
      const cyc = (c.t % 700) / 700;
      if (cyc >= 0.35 && cyc < 0.62) {
        const k = (cyc - 0.35) / 0.27;
        ctx.font = ((T * (0.5 + 0.4 * k)) | 0) + 'px serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1 - k;
        ctx.fillText('💥', wx, wy - WH);
        ctx.globalAlpha = 1;
      }
    }
  } else if (c.kind === 'chest' && c.t >= c.data.revealAt) {
    const ri = c.data.ri, rx = ri % m.w, ry = (ri / m.w) | 0;
    const k = (c.t - c.data.revealAt) / (c.dur - c.data.revealAt);
    const x = roomX(rx), y = roomY(ry) - T * 0.45 - k * T * 0.5;
    const EM = { pick: '⛏️', ladder: '🪜', coin: '🪙', diamond: '💎', empty: '💨' };
    ctx.font = ((T * 0.8) | 0) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(EM[c.data.res], x, y);
    const label = c.data.res === 'empty' ? t('rvEmpty') : t('items')[ITEM_IDX[c.data.res]] + '!';
    ctx.font = 'bold 12px sans-serif';
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - tw / 2, y - T * 0.9, tw, 16);
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - T * 0.9 + 8);
  } else if (c.kind === 'ladder') {
    const bx = c.data.wi % m.bw, by = (c.data.wi / m.bw) | 0;
    const t = c.t / 900;
    ctx.strokeStyle = 'rgba(255,220,120,' + (1 - t).toFixed(3) + ')'; ctx.lineWidth = 2;
    ctx.strokeRect(bPos(bx) - 4, bPos(by) - WH - 4, bSize(bx) + 8, bSize(by) + WH + 8);
  } else if (c.kind === 'warp') {
    // 魔方陣：前半は足もと、後半はワープ先で回る
    const k = c.t / c.dur, half = k < 0.5;
    const px = half ? c.data.fx : roomX(c.data.tx);
    const py = (half ? c.data.fy : roomY(c.data.ty)) + T * 0.3;
    const ang = performance.now() / 260;
    const rr = T * (half ? 0.5 + 0.25 * k * 2 : 0.75 - 0.3 * (k - 0.5) * 2);
    ctx.save();
    ctx.translate(px, py); ctx.scale(1, 0.45); // 床に寝かせる
    ctx.strokeStyle = 'rgba(160,130,255,0.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,180,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.62, 0, 6.3); ctx.stroke();
    ctx.beginPath(); // 回転する三角の紋様
    for (let i = 0; i < 3; i++) {
      const a1 = ang + i * 2.094;
      ctx.moveTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
      ctx.lineTo(Math.cos(a1 + 2.094) * rr, Math.sin(a1 + 2.094) * rr);
    }
    ctx.stroke();
    ctx.restore();
    // 立ちのぼる光の粒
    ctx.fillStyle = 'rgba(180,150,255,0.8)';
    for (let i = 0; i < 4; i++) {
      const sy = ((c.t / 3 + i * 37) % 46);
      ctx.fillRect(px - 14 + i * 9, py - sy, 2.5, 2.5);
    }
  }
}

/* ---- HUD・画面 ---- */
function fmt(ms) {
  const t = Math.max(0, ms);
  const mn = (t / 60000) | 0, s = ((t % 60000) / 1000) | 0, d = ((t % 1000) / 100) | 0;
  return mn + ':' + String(s).padStart(2, '0') + '.' + d;
}
function desc(t) { $('desc').textContent = t; }
function descDefault() { desc(DESCS.default); }
let toastTm = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTm) clearTimeout(toastTm);
  toastTm = setTimeout(() => el.classList.remove('show'), 2200);
}
function showLvup(lv) {
  const el = $('lvup');
  el.textContent = '⬆ LEVEL UP!  LV ' + lv;
  el.classList.remove('pop'); void el.offsetWidth;
  el.classList.add('pop');
}
function showStageName(name) { // 画面中央に大きく出してゆっくりフェードアウト
  const el = $('stagename');
  el.textContent = name;
  el.classList.remove('show'); void el.offsetWidth;
  el.classList.add('show');
}
function updateSlots() {
  const st = S.stage; if (!st) return;
  $('cntPick').textContent = '×' + st.counts.pick + (st.pickCharges > 0 ? '+' + st.pickCharges : '');
  $('cntLadder').textContent = '×' + st.counts.ladder;
  $('cntCoin').textContent = '×' + st.counts.coin;
  $('cntDia').textContent = '×' + st.counts.diamond;
  $('slotPick').classList.toggle('dim', st.counts.pick <= 0 && st.pickCharges <= 0);
  $('slotLadder').classList.toggle('dim', st.counts.ladder <= 0);
  $('slotCoin').classList.toggle('dim', st.counts.coin <= 0);
  $('slotDia').classList.toggle('dim', st.counts.diamond <= 0);
  $('slotPick').classList.toggle('sel', S.targetMode === 'pick');
  $('slotLadder').classList.toggle('sel', S.targetMode === 'ladder');
  $('slotFist').classList.toggle('sel', S.targetMode === 'tackle');
  $('slotFist').classList.toggle('hidden', !st.eq.has('m'));
  // ⑧ワープ／⑨ヘンゼルLV90（クールタイム制）
  const warpVis = st.warpAbility;
  $('slotWarp').classList.toggle('hidden', !warpVis);
  if (warpVis && !st.warpOk) { $('cntWarp').textContent = 'ー'; $('slotWarp').classList.add('dim'); }
}
function showScreen(name) {
  S.screen = name;
  ['title', 'diffSel', 'skillSel', 'clearOv', 'langSel', 'setSel'].forEach(id => $(id).classList.add('hidden'));
  ['hudTop', 'hudBottom'].forEach(id => $(id).classList.add('hidden'));
  if (name === 'title') { $('title').classList.remove('hidden'); refreshTitle(); Snd.bgm('title'); }
  else if (name === 'diff') { $('diffSel').classList.remove('hidden'); buildDiffList(); Snd.bgm('title'); }
  else if (name === 'skill') { $('skillSel').classList.remove('hidden'); buildSkillCards(); Snd.bgm('skill'); } // 専用BGM
  else if (name === 'lang') { $('langSel').classList.remove('hidden'); buildLangList(); Snd.bgm('title'); }
  else if (name === 'set') { $('setSel').classList.remove('hidden'); buildSettings(); Snd.bgm('title'); }
  else if (name === 'play') { $('hudTop').classList.remove('hidden'); $('hudBottom').classList.remove('hidden'); }
  else if (name === 'clear') { $('clearOv').classList.remove('hidden'); }
}
/* ---- 設定（文字サイズ・音量） ---- */
function applyFont() {
  document.documentElement.style.fontSize = [16, 18.5, 21][S.save.fontScale || 0] + 'px';
}
function buildSettings() {
  document.querySelector('#setSel h2').textContent = '🔧 ' + t('settings');
  $('fsLabel').textContent = t('fontSize');
  $('bgmLabel').textContent = t('volBgm');
  $('sfxLabel').textContent = t('volSfx');
  const names = [t('fontN'), t('fontL'), t('fontXL')];
  const el = $('fontBtns'); el.innerHTML = '';
  names.forEach((nm, i) => {
    const b = document.createElement('button');
    b.className = 'langBtn' + (S.save.fontScale === i ? ' sel' : '');
    b.textContent = nm;
    b.onclick = () => { S.save.fontScale = i; persist(); applyFont(); Snd.sfx('tap'); buildSettings(); };
    el.appendChild(b);
  });
  $('volBgmR').value = S.save.volBgm;
  $('volSfxR').value = S.save.volSfx;
  $('volBgmV').textContent = Math.round(S.save.volBgm * 100) + '%';
  $('volSfxV').textContent = Math.round(S.save.volSfx * 100) + '%';
}
/* ---- 言語の適用と切替 ---- */
function applyLang() {
  document.documentElement.lang = S.save.lang;
  document.documentElement.dir = S.save.lang === 'ar' ? 'rtl' : 'ltr'; // アラビア語は右→左
  document.querySelector('#title .sub').textContent = t('sub');
  $('pickBlue').querySelector('span').textContent = t('blue');
  $('pickNeutral').querySelector('span').textContent = I18N.mids[S.save.lang] || I18N.mids.ja;
  $('pickRed').querySelector('span').textContent = t('red');
  $('btnStart').textContent = t('start');
  $('btnBackTitle').textContent = t('back');
  $('btnBackTitle2').textContent = t('back');
  $('btnBackTitle3').textContent = t('back');
  document.querySelector('#diffSel h2').textContent = t('chooseMaze');
  document.querySelector('#skillSel h2').textContent = t('skillsTitle');
  document.querySelector('#langSel h2').textContent = t('chooseLang');
  $('btnRetry').textContent = t('retry');
  $('btnNext').textContent = t('next');
  const it = t('items');
  $('lblPick').textContent = it[0]; $('lblLadder').textContent = it[1];
  $('lblCoin').textContent = it[2]; $('lblDia').textContent = it[3];
  $('lblFist').textContent = t('sk').m[0]; $('lblWarp').textContent = t('sk').warp[0];
  if (S.screen === 'play' && S.stage) {
    $('diffName').textContent = t('diffs')[S.stage.diffIdx] + (S.stage.simple ? '（' + t('simple') + '）' : '');
    $('timeTarget').textContent = t('target') + ' ' + fmt(S.stage.targetMs);
    descDefault();
  }
}
function buildLangList() {
  const el = $('langList'); el.innerHTML = '';
  I18N.langs.forEach(pair => {
    const b = document.createElement('button');
    b.className = 'langBtn' + (S.save.lang === pair[0] ? ' sel' : '');
    b.textContent = pair[1];
    b.onclick = () => {
      S.save.lang = pair[0]; persist();
      applyLang(); Snd.sfx('tap');
      showScreen('title');
    };
    el.appendChild(b);
  });
}
function refreshTitle() {
  const lv = L.levelFor(S.save.exp);
  $('lvNum').textContent = lv;
  const curBase = L.lvCum(lv);
  const next = (lv < L.MAX_LV) ? L.lvCum(lv + 1) : null;
  $('expFill').style.width = next ? Math.min(100, 100 * (S.save.exp - curBase) / (next - curBase)) + '%' : '100%';
  // LV99以降はEXPを530000で打ち止め表示（超過分は やりこみスコア に変換されている設定）
  $('expTxt').textContent = next ? ('EXP ' + S.save.exp + ' / ' + next) : ('EXP ' + L.EXP_CAP + ' ' + t('expMax'));
  // やりこみスコア（LV99カンスト後・別枠）とトレジャーマスターの金きらきらバッジ
  const score = L.masteryScore(S.save.exp), mBox = $('masteryBox'), mBadge = $('masterBadge');
  if (score > 0) { mBox.classList.remove('hidden'); mBox.textContent = t('masteryScore') + ' ' + score + ' / ' + L.SCORE_MAX; }
  else mBox.classList.add('hidden');
  if (score >= L.SCORE_MAX) { mBadge.classList.remove('hidden'); mBadge.querySelector('.mbTxt').textContent = '✨ ' + t('treasureMaster') + ' ✨'; }
  else mBadge.classList.add('hidden');
  sanitizeEquip();
  $('passiveNow').textContent = t('equip') + ' (' + S.save.equipped.length + '/' + L.slotCount(lv) + '): '
    + S.save.equipped.map(id => SKILL_ICONS[id] + SKILL_INFO[id].name).join(' / ');
  $('pickBlue').classList.toggle('sel', S.save.gender === 'm');
  $('pickNeutral').classList.toggle('sel', S.save.gender === 'n');
  $('pickRed').classList.toggle('sel', S.save.gender === 'f');
  $('btnSkill').textContent = '⚙ ' + t('skills');
  $('btnLang').textContent = '🌐 ' + (I18N.langs.find(p => p[0] === S.save.lang) || ['', '?'])[1];
  $('btnSet').textContent = '🔧 ' + t('settings');
}
function buildDiffList() {
  const el = $('diffList'); el.innerHTML = '';
  L.DIFFS.forEach((d, i) => {
    const locked = i > 0 && S.save.badges[i - 1] <= 0;
    const row = document.createElement('div'); row.className = 'diffRow';
    const b = document.createElement('button');
    b.className = 'diffBtn' + (locked ? ' locked' : '');
    const badge = S.save.badges[i] > 0 ? '<span class="badge">🏅×' + S.save.badges[i] + '</span>' : '<span class="badge"></span>';
    b.innerHTML = '<span>' + (locked ? '🔒 ' : '') + t('diffs')[i] + '</span><small>' + d.w + '×' + d.h + '</small>' + badge;
    b.onclick = () => {
      if (locked) { toast(t('locked')); Snd.sfx('nope'); return; }
      Snd.sfx('tap'); startStage(i, false);
    };
    // シンプルモード：スキル・宝箱なしの素の迷路。装備を外さず遊べてEXPは×1.5
    const s = document.createElement('button');
    s.className = 'diffBtn simple' + (locked ? ' locked' : '');
    s.innerHTML = '<span>' + t('simple') + '</span><small>×1.5</small>';
    s.onclick = () => {
      if (locked) { toast(t('locked')); Snd.sfx('nope'); return; }
      Snd.sfx('tap'); startStage(i, true);
    };
    row.appendChild(b); row.appendChild(s);
    el.appendChild(row);
  });
}
function buildSkillCards() {
  const lv = L.levelFor(S.save.exp), g = S.save.gender;
  sanitizeEquip();
  const max = L.slotCount(lv);
  $('skillCards').innerHTML = '';
  $('skillNote').textContent = tf('equipNote', { a: S.save.equipped.length, b: max });
  const listEl = $('skillList'); listEl.innerHTML = '';
  SKILL_ORDER.forEach(id => {
    const info = SKILL_INFO[id];
    const acquired = L.skillAcquired(id, lv, g);
    const equipped = S.save.equipped.includes(id);
    const req = (id === 'm' || id === 'f') ? (g === id ? 1 : 5)
      : (id === 'speed' && g === 'n') ? 1 : L.SKILLS.find(s => s.id === id).lv;
    const row = document.createElement('button');
    row.className = 'skillRow' + (equipped ? ' sel' : '') + (acquired ? '' : ' locked');
    row.innerHTML = '<span class="srIco">' + SKILL_ICONS[id] + '</span>'
      + '<span class="srBody"><b>' + info.name + (equipped ? '　✅' : '') + '</b><span>' + info.desc + '</span></span>'
      + '<span class="srVal">' + (acquired ? info.val(lv) : '🔒 LV' + req) + '</span>';
    row.onclick = () => {
      if (!acquired) { toast(tf('learnAt', { n: req })); Snd.sfx('nope'); return; }
      if (equipped) {
        S.save.equipped = S.save.equipped.filter(x => x !== id);
      } else {
        if (S.save.equipped.length >= max) { toast(t('slotsFull')); Snd.sfx('nope'); return; }
        S.save.equipped.push(id);
      }
      persist(); Snd.sfx('tap'); buildSkillCards();
    };
    listEl.appendChild(row);
  });
}

/* ---- UI ---- */
function attachUI() {
  $('btnStart').onclick = () => { Snd.sfx('tap'); showScreen('diff'); };
  $('btnBackTitle').onclick = () => { Snd.sfx('tap'); showScreen('title'); };
  $('btnBackTitle2').onclick = () => { Snd.sfx('tap'); showScreen('title'); };
  $('btnSkill').onclick = () => { Snd.sfx('tap'); showScreen('skill'); };
  $('btnLang').onclick = () => { Snd.sfx('tap'); showScreen('lang'); };
  $('btnSet').onclick = () => { Snd.sfx('tap'); showScreen('set'); };
  $('btnBackTitle4').onclick = () => { Snd.sfx('tap'); showScreen('title'); };
  $('congrats').onclick = hideCongrats;
  $('volBgmR').oninput = () => {
    S.save.volBgm = parseFloat($('volBgmR').value); persist();
    Snd.setVolumes(S.save.volBgm, S.save.volSfx);
    $('volBgmV').textContent = Math.round(S.save.volBgm * 100) + '%';
  };
  $('volSfxR').oninput = () => {
    S.save.volSfx = parseFloat($('volSfxR').value); persist();
    Snd.setVolumes(S.save.volBgm, S.save.volSfx);
    $('volSfxV').textContent = Math.round(S.save.volSfx * 100) + '%';
    Snd.sfx('coin'); // 試し聞き
  };
  $('pickBlue').onclick = () => { S.save.gender = 'm'; sanitizeEquip(); persist(); Snd.sfx('tap'); refreshTitle(); };
  $('pickNeutral').onclick = () => { S.save.gender = 'n'; sanitizeEquip(); persist(); Snd.sfx('tap'); refreshTitle(); };
  $('pickRed').onclick = () => { S.save.gender = 'f'; sanitizeEquip(); persist(); Snd.sfx('tap'); refreshTitle(); };
  $('btnZoomIn').onclick = () => { setZoom(S.zoom * 1.25); Snd.sfx('tap'); };
  $('btnZoomOut').onclick = () => { setZoom(S.zoom / 1.25); Snd.sfx('tap'); };
  $('btnReset').onclick = resetView;
  let quitArm = 0;
  $('btnQuit').onclick = () => {
    if (Date.now() - quitArm < 2000) { S.stage = null; quitArm = 0; showScreen('diff'); }
    else { quitArm = Date.now(); toast(t('quit')); }
  };
  $('btnRetry').onclick = () => { Snd.sfx('tap'); const p = S.pendingLevelUp; startStage(S.stage.diffIdx); S.pendingLevelUp = p; playPendingLevelUp(); };
  $('btnNext').onclick = () => { Snd.sfx('tap'); S.stage = null; showScreen('diff'); playPendingLevelUp(); };
  // アイテムスロット
  $('slotPick').onclick = () => {
    if (!playActive()) return;
    if (S.targetMode === 'pick') { setTarget(null); return; }
    desc(DESCS.pick);
    if (S.stage.counts.pick <= 0 && S.stage.pickCharges <= 0) { Snd.sfx('nope'); return; }
    Snd.sfx('tap'); setTarget('pick');
  };
  $('slotWarp').onclick = () => {
    if (!playActive()) return;
    desc(DESCS.warp);
    const st = S.stage;
    if (!st.warpOk) { toast(t('warpNo')); Snd.sfx('nope'); return; }
    const remain = st.warpReadyAt - st.gameTime;
    if (remain > 0) { toast(tf('ctWait', { n: Math.ceil(remain / 1000) })); Snd.sfx('nope'); return; }
    doWarp();
  };
  $('slotLadder').onclick = () => {
    if (!playActive()) return;
    if (S.targetMode === 'ladder') { setTarget(null); return; }
    desc(DESCS.ladder);
    if (S.stage.counts.ladder <= 0) { Snd.sfx('nope'); return; }
    Snd.sfx('tap'); setTarget('ladder');
  };
  $('slotFist').onclick = () => {
    if (!playActive()) return;
    if (S.targetMode === 'tackle') { setTarget(null); return; }
    desc(DESCS.tackle);
    const st = S.stage;
    const remain = st.tackleReadyAt - st.gameTime;
    if (remain > 0) { toast(tf('ctWait', { n: Math.ceil(remain / 1000) })); Snd.sfx('nope'); return; }
    Snd.sfx('tap'); setTarget('tackle');
  };
  $('slotCoin').onclick = () => { desc(DESCS.coin); Snd.sfx('tap'); };
  $('slotDia').onclick = () => { desc(DESCS.diamond); Snd.sfx('tap'); };
  window.addEventListener('resize', resize);
  // HUDの表示/非表示や横向き切替で迷路エリアの大きさが変わったら追従
  if (window.ResizeObserver) new ResizeObserver(resize).observe($('gameArea'));
  attachInput();
}

/* ---- メインループ ---- */
let lastTs = 0;
let roboBlinkState = -1;
function frame(ts) {
  const dt = Math.min(60, lastTs ? ts - lastTs : 16);
  lastTs = ts;
  tick(dt);
  render();
  // タイトルのロボ選択プレビューも目を点滅させる（状態が変わった時だけ再描画）
  if (S.screen === 'title') {
    const b = Math.floor(performance.now() / 1000) % 2;
    if (b !== roboBlinkState) { roboBlinkState = b; drawPreview($('cvNeutral'), charSet('n').down[0]); }
  }
  requestAnimationFrame(frame);
}

/* ---- 起動 ---- */
function drawPreview(cnv, img) {
  const c2 = cnv.getContext('2d');
  c2.imageSmoothingEnabled = false;
  c2.clearRect(0, 0, cnv.width, cnv.height);
  c2.drawImage(img, 0, 0, cnv.width, cnv.height);
}
function boot() {
  loadSave();
  buildSprites();
  drawPreview($('cvBlue'), SPR.m.down[0]);
  drawPreview($('cvNeutral'), SPR.n.down[0]);
  drawPreview($('cvRed'), SPR.f.down[0]);
  attachUI();
  applyLang();
  applyFont();
  Snd.setVolumes(S.save.volBgm, S.save.volSfx);
  resize();
  showScreen('title');
  requestAnimationFrame(frame);
}
boot();

/* ---- 機械検証用フック（本番動作には影響なし） ---- */
window.DM = {
  S, L, startStage, tick, render,
  trace: (rx, ry) => { const st = S.stage; if (st) st.plan.push({ rx, ry, t: st.gameTime - 2000 }); },
  auto: n => {
    const st = S.stage; if (!st) return 0;
    const from = committedPos();
    const p = L.shortestPath(st.m, from.rx, from.ry, st.goal.rx, st.goal.ry, st.ladders);
    if (!p) return 0;
    const seg = p.slice(1, n ? 1 + n : undefined);
    for (const q of seg) st.plan.push({ rx: q[0], ry: q[1], t: st.gameTime - 2000 });
    return seg.length;
  },
  skip: () => S.stage && S.stage.cuts.skip(),
  setTarget, tryTargetTap, candidates, bPos, bSize, THEMES, doWarp, distMap,
};
})();
