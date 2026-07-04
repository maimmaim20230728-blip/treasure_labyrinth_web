/* 宝の迷宮 (Treasure Labyrinth) - ゲーム本体
   レトロ2Dドット絵 × 2.5D風俯瞰 × なぞり移動の迷路ゲーム */
(function () {
'use strict';

const L = window.Logic;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

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
];
const CONF_COLS = ['#f5c542', '#ff6b6b', '#4ecdc4', '#7bd44a', '#6f9dff', '#e08bff'];

const DESCS = {
  default: 'ゆびで なぞると 0.5びょうおくれて キャラが はしるよ',
  pick:    '⛏️つるはし：かべを 1まい こわせる（つかいきり・さいだい2こ）',
  ladder:  '🪜ハシゴ：かべに 立てかける。かけた ほうこうにだけ とおれる（のぼるのに 2びょう）',
  coin:    '🪙コイン：さいごの タイムを カット（ふくり・さいだい5まい）',
  diamond: '💎ダイヤ：さいごの タイムを おおきくカット（ふくり・さいだい5こ）',
  tackle:  '💥たいあたり：つるはしなしで かべを こわせる（クールタイムあり）',
  pickTarget:   'こわしたい かべを タップ！（ほかを タップで キャンセル）',
  ladderTarget: 'ハシゴを かけたい かべを タップ！',
};

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
  const set = pal => ({
    down:  PIX.down.map(f => pixCanvas(f, pal)),
    up:    PIX.up.map(f => pixCanvas(f, pal)),
    right: PIX.side.map(f => pixCanvas(f, pal)),
    left:  PIX.side.map(f => pixCanvas(mirror(f), pal)),
  });
  SPR.m = set(PAL_M); SPR.f = set(PAL_F);
}

/* ---- 状態 ---- */
const S = {
  screen: 'title', save: null, stage: null,
  zoom: 1, tracing: false, pointers: new Map(), pinchD: 0,
  targetMode: null, confetti: [],
};
const SAVE_KEY = 'tlab.v1';
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  S.save = Object.assign({ gender: 'm', exp: 0, badges: [0, 0, 0, 0, 0, 0, 0], passive: null, sound: true }, s || {});
  if (!Array.isArray(S.save.badges) || S.save.badges.length !== 7) S.save.badges = [0, 0, 0, 0, 0, 0, 0];
  Snd.setEnabled(S.save.sound);
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.save)); } catch (e) {} }
function effPassive() {
  const s = S.save, lv = L.levelFor(s.exp);
  if (lv >= 5 && s.passive) return s.passive;
  return s.gender;
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
function startStage(di) {
  const diff = L.DIFFS[di];
  const m = L.generate(diff.w, diff.h);
  // スタート＝四隅のどこかランダム／ゴール＝残り三隅 or 真ん中付近からランダム
  const corners = [[0, 0], [diff.w - 1, 0], [0, diff.h - 1], [diff.w - 1, diff.h - 1]];
  const si = (Math.random() * 4) | 0;
  const start = { rx: corners[si][0], ry: corners[si][1] };
  const gOpts = corners.filter((c, i) => i !== si).map(c => ({ rx: c[0], ry: c[1] }));
  gOpts.push({
    rx: clamp(((diff.w / 2) | 0) + ((Math.random() * 3) | 0) - 1, 1, diff.w - 2),
    ry: clamp(((diff.h / 2) | 0) + ((Math.random() * 3) | 0) - 1, 1, diff.h - 2),
  });
  const goal = gOpts[(Math.random() * gOpts.length) | 0];
  const path = L.shortestPath(m, start.rx, start.ry, goal.rx, goal.ry, null);
  const st = {
    diffIdx: di, diff, m, start, goal,
    ladders: new Uint8Array(m.bw * m.bh),
    chests: new Map(),
    timer: new L.StageTimer(),
    plan: [], gameTime: 0,
    targetMs: L.targetSeconds(diff, path.length - 1) * 1000,
    counts: { pick: 0, ladder: 0, coin: 0, diamond: 0 },
    char: { rx: start.rx, ry: start.ry, x: roomX(start.rx), y: roomY(start.ry), dir: 2, frame: 0, animT: 0, moving: null },
    cam: { x: roomX(start.rx), y: roomY(start.ry) },
    theme: THEMES[(Math.random() * THEMES.length) | 0],
    particles: [], shake: 0, cleared: false, tackleReadyAt: 0,
  };
  st.cuts = new L.CutsceneCtrl(st.timer);
  // 宝箱配置（スタート・ゴール以外からランダム）
  const n = L.chestCount(diff);
  const cand = [];
  const sIdx = start.ry * diff.w + start.rx, gIdx = goal.ry * diff.w + goal.rx;
  for (let i = 0; i < diff.w * diff.h; i++) if (i !== sIdx && i !== gIdx) cand.push(i);
  for (let i = cand.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
  for (let i = 0; i < n; i++) st.chests.set(cand[i], { opened: false, result: null });
  S.stage = st; S.zoom = 1; S.targetMode = null; S.tracing = false;
  showScreen('play');
  updateSlots(); descDefault();
  $('diffName').textContent = diff.name;
  $('timeTarget').textContent = ' / もくひょう ' + fmt(st.targetMs);
  toast('～ ' + st.theme.name + ' ～');
  Snd.bgm('maze' + (1 + ((Math.random() * 3) | 0)));
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
  const seg = L.bfsLimited(st.m, last.rx, last.ry, rx, ry, 4, st.ladders);
  if (seg && seg.length) for (const p of seg) st.plan.push({ rx: p[0], ry: p[1], t: st.gameTime });
}
function moveChar(dt) {
  const st = S.stage, c = st.char;
  let budget = dt / 1000 * L.CHAR_SPEED * P; // 一定速度（4マス/秒）
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
        st.cuts.start('climb', 2000, { d, fx: c.x, fy: c.y, tx: nxt.rx, ty: nxt.ry, steps: 0 }, cut => {
          c.rx = cut.data.tx; c.ry = cut.data.ty;
          c.x = roomX(c.rx); c.y = roomY(c.ry);
          c.moving = null;
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
  const chest = st.chests.get(ri);
  if (chest && !chest.opened) {
    chest.opened = true;
    chest.result = L.rollChest(); // 5種 均等20%
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
function applyChest(res) {
  const st = S.stage;
  if (res === 'empty') { toast('からっぽ だった…💨'); Snd.sfx('empty'); return; }
  const cap = L.ITEM_CAPS[res];
  const names = { pick: '⛏️つるはし', ladder: '🪜ハシゴ', coin: '🪙コイン', diamond: '💎ダイヤ' };
  if (st.counts[res] >= cap) {
    toast(names[res] + 'は もう もてない…おいていった');
    Snd.sfx('empty');
  } else {
    st.counts[res]++;
    toast(names[res] + 'を てにいれた！');
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
        if (via === 'pick') st.counts.pick--; // 1回使い捨て
        else st.tackleReadyAt = st.gameTime + L.tackleCT(L.levelFor(S.save.exp)) * 1000;
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
}

/* ---- クリア ---- */
function doClear() {
  const st = S.stage;
  st.cleared = true; st.timer.pause();
  Snd.sfx('goal');
  const raw = st.timer.ms;
  const prevLv = L.levelFor(S.save.exp);
  // 複利計算（✨おたからマスターなら係数がレベルぶん強化）
  const isF = effPassive() === 'f';
  const coinF = L.coinFactor(prevLv, isF), diaF = L.diaFactor(prevLv, isF);
  const fin = L.finalTimeMs(raw, st.counts.coin, st.counts.diamond, coinF, diaF);
  const ok = fin <= st.targetMs;
  const e = Math.round(st.diff.exp * (ok ? 1.5 : 1));
  S.save.exp += e; S.save.badges[st.diffIdx]++; persist();
  const newLv = L.levelFor(S.save.exp);
  setTimeout(() => {
    if (ok) { Snd.sfx('fanfare'); Snd.bgm('clearBig'); spawnConfetti(150); } // 盛大に祝う
    else    { Snd.sfx('clearSoft'); Snd.bgm('clearSoft'); spawnConfetti(25); } // ひかえめ
    buildClearOverlay(raw, fin, ok, e, newLv, coinF, diaF);
    showScreen('clear');
    if (newLv > prevLv) {
      showLvup(newLv); Snd.sfx('levelup');
      if (newLv >= 5 && prevLv < 5) setTimeout(() => toast('⚙スキルせんたくが かいほうされた！'), 1900);
    }
  }, 650);
}
function buildClearOverlay(raw, fin, ok, e, lv, coinF, diaF) {
  const st = S.stage, c = st.counts;
  $('clearTitle').textContent = ok ? '🎉 おたから ゲット！ 🎉' : '✨ ゴール！';
  let html = '<div class="crow">めいろの タイム <b>' + fmt(raw) + '</b></div>';
  if (c.coin) html += '<div class="crow">🪙×' + c.coin + '　タイム ×' + Math.pow(coinF, c.coin).toFixed(3) + '（ふくり）</div>';
  if (c.diamond) html += '<div class="crow">💎×' + c.diamond + '　タイム ×' + Math.pow(diaF, c.diamond).toFixed(3) + '（ふくり）</div>';
  html += '<div class="crow cbig">さいしゅうタイム <b>' + fmt(fin) + '</b></div>';
  html += '<div class="crow">もくひょう ' + fmt(st.targetMs) + (ok ? '　🏆 たっせい！' : '　つぎは もくひょうに チャレンジ！') + '</div>';
  html += '<div class="crow">EXP <b>+' + e + '</b>　（LV ' + lv + '）</div>';
  $('clearBody').innerHTML = html;
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
    }
  }
  if (st) {
    updateCam(dt);
    updateParticles(st, dt);
    if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 0.02);
  }
  updateConfetti(dt);
  updateHud();
}
function updateHud() {
  const st = S.stage;
  if (!st || (S.screen !== 'play' && S.screen !== 'clear')) return;
  $('timeNow').textContent = fmt(st.timer.ms);
  if (effPassive() === 'm') {
    const remain = Math.max(0, st.tackleReadyAt - st.gameTime);
    $('cntFist').textContent = remain > 0 ? Math.ceil(remain / 1000) + 's' : 'OK';
    $('slotFist').classList.toggle('dim', remain > 0);
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
      ctx.fillStyle = ((bx + by) & 1) ? th.floor : th.floor2;
      ctx.fillRect(bPos(bx), bPos(by), bSize(bx), bSize(by));
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
  }
  // 紙吹雪（スクリーン座標）
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const p of S.confetti) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
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
  const t = performance.now() / 1000;
  // 大きな金の宝箱（部屋幅を少しはみ出すくらい堂々と）
  const w = T * 1.15, h = T * 0.9, x = gx - w / 2, y = gy + T * 0.42 - h;
  const lidH = h * 0.4;
  // 後光（明滅する金色のオーラ）
  const glow = 0.22 + 0.13 * Math.sin(t * 2.4);
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
  const tw1 = Math.max(0, Math.sin(t * 3.1));
  const tw2 = Math.max(0, Math.sin(t * 3.1 + 2.2));
  ctx.fillStyle = 'rgba(255,255,230,' + (0.4 + 0.6 * tw1).toFixed(3) + ')';
  drawTwinkle(x + w * 0.16, y + 3, 4 + 3 * tw1);
  ctx.fillStyle = 'rgba(255,255,230,' + (0.4 + 0.6 * tw2).toFixed(3) + ')';
  drawTwinkle(x + w * 0.88, y + h * 0.5, 3.5 + 3 * tw2);
  // 立ちのぼるきらめき
  ctx.fillStyle = 'rgba(255,236,150,' + (0.5 + 0.5 * Math.sin(t * 3)).toFixed(3) + ')';
  ctx.fillRect(gx - 2, gy - T * 0.95 - ((t * 12) % 12), 3.5, 3.5);
  ctx.fillRect(gx + 11, gy - T * 0.7 - ((t * 15) % 13), 3, 3);
  ctx.fillRect(gx - 13, gy - T * 0.75 - ((t * 9) % 10), 3, 3);
  // 「ゴール」ラベル（ふわふわ上下）
  const ly = y - 22 + Math.sin(t * 2) * 2;
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lw = ctx.measureText('ゴール').width + 14;
  ctx.fillStyle = 'rgba(20,16,40,0.75)';
  ctx.fillRect(gx - lw / 2, ly - 9, lw, 18);
  ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 1;
  ctx.strokeRect(gx - lw / 2 + 0.5, ly - 8.5, lw - 1, 17);
  ctx.fillStyle = '#f5c542';
  ctx.fillText('ゴール', gx, ly + 0.5);
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
  const set = SPR[S.save.gender];
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
  ctx.drawImage(set[key][frame], Math.round(c.x - 10 + ox), Math.round(c.y + T * 0.4 - 28 + oy), 20, 28);
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
    const NM = { pick: 'つるはし！', ladder: 'ハシゴ！', coin: 'コイン！', diamond: 'ダイヤ！', empty: 'からっぽ…' };
    ctx.font = ((T * 0.8) | 0) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(EM[c.data.res], x, y);
    const label = NM[c.data.res];
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
function updateSlots() {
  const st = S.stage; if (!st) return;
  $('cntPick').textContent = '×' + st.counts.pick;
  $('cntLadder').textContent = '×' + st.counts.ladder;
  $('cntCoin').textContent = '×' + st.counts.coin;
  $('cntDia').textContent = '×' + st.counts.diamond;
  $('slotPick').classList.toggle('dim', st.counts.pick <= 0);
  $('slotLadder').classList.toggle('dim', st.counts.ladder <= 0);
  $('slotCoin').classList.toggle('dim', st.counts.coin <= 0);
  $('slotDia').classList.toggle('dim', st.counts.diamond <= 0);
  $('slotPick').classList.toggle('sel', S.targetMode === 'pick');
  $('slotLadder').classList.toggle('sel', S.targetMode === 'ladder');
  $('slotFist').classList.toggle('sel', S.targetMode === 'tackle');
  $('slotFist').classList.toggle('hidden', effPassive() !== 'm');
}
function showScreen(name) {
  S.screen = name;
  ['title', 'diffSel', 'skillSel', 'clearOv'].forEach(id => $(id).classList.add('hidden'));
  ['hudTop', 'hudBottom'].forEach(id => $(id).classList.add('hidden'));
  if (name === 'title') { $('title').classList.remove('hidden'); refreshTitle(); Snd.bgm('title'); }
  else if (name === 'diff') { $('diffSel').classList.remove('hidden'); buildDiffList(); Snd.bgm('title'); }
  else if (name === 'skill') { $('skillSel').classList.remove('hidden'); buildSkillCards(); Snd.bgm('skill'); } // 専用BGM
  else if (name === 'play') { $('hudTop').classList.remove('hidden'); $('hudBottom').classList.remove('hidden'); }
  else if (name === 'clear') { $('clearOv').classList.remove('hidden'); }
}
function refreshTitle() {
  const lv = L.levelFor(S.save.exp);
  $('lvNum').textContent = lv;
  const curBase = L.lvCum(lv);
  const next = (lv < L.MAX_LV) ? L.lvCum(lv + 1) : null;
  $('expFill').style.width = next ? Math.min(100, 100 * (S.save.exp - curBase) / (next - curBase)) + '%' : '100%';
  $('expTxt').textContent = next ? ('EXP ' + S.save.exp + ' / ' + next) : ('EXP ' + S.save.exp + '（LV99 カンスト！）');
  const pk = effPassive(), PS = L.PASSIVE[pk];
  $('passiveNow').textContent = 'パッシブ: ' + PS.icon + PS.name + (pk === 'm'
    ? '（CT ' + L.tackleCT(lv) + 'びょう）'
    : '（🪙×' + L.coinFactor(lv, true).toFixed(3) + '・💎×' + L.diaFactor(lv, true).toFixed(3) + '）');
  $('pickBlue').classList.toggle('sel', S.save.gender === 'm');
  $('pickRed').classList.toggle('sel', S.save.gender === 'f');
  $('btnSkill').textContent = lv >= 5 ? '⚙ スキル' : '⚙ スキル（LV5でせんたく）';
  $('btnSound').textContent = S.save.sound ? '🔊 おと ON' : '🔇 おと OFF';
}
function buildDiffList() {
  const el = $('diffList'); el.innerHTML = '';
  L.DIFFS.forEach((d, i) => {
    const locked = i > 0 && S.save.badges[i - 1] <= 0;
    const b = document.createElement('button');
    b.className = 'diffBtn' + (locked ? ' locked' : '');
    const badge = S.save.badges[i] > 0 ? '<span class="badge">🏅×' + S.save.badges[i] + '</span>' : '<span class="badge"></span>';
    b.innerHTML = '<span>' + (locked ? '🔒 ' : '') + d.name + '</span><small>' + d.w + '×' + d.h + '</small>' + badge;
    b.onclick = () => {
      if (locked) { toast('まえの めいろを クリアすると あそべるよ'); Snd.sfx('nope'); return; }
      Snd.sfx('tap'); startStage(i);
    };
    el.appendChild(b);
  });
}
function buildSkillCards() {
  const lv = L.levelFor(S.save.exp);
  const el = $('skillCards'); el.innerHTML = '';
  ['m', 'f'].forEach(k => {
    const PS = L.PASSIVE[k];
    const unlocked = (k === S.save.gender) || lv >= 5; // LV5で異性のパッシブも習得（平等化）
    const seld = effPassive() === k;
    const card = document.createElement('button');
    card.className = 'skillCard' + (seld ? ' sel' : '') + (unlocked ? '' : ' locked');
    const val = k === 'm'
      ? ('クールタイム ' + L.tackleCT(lv) + 'びょう（LV99で11びょう）')
      : ('🪙×' + L.coinFactor(lv, true).toFixed(3) + '・💎×' + L.diaFactor(lv, true).toFixed(3) + '（LVで強化）');
    card.innerHTML = '<b>' + PS.icon + ' ' + PS.name + '</b><span>' + PS.desc + '</span><span class="val">' + val + '</span>'
      + (unlocked ? (seld ? '<span class="tag">✅ セットちゅう</span>' : '<span class="tag"> </span>') : '<span class="tag">🔒 LV5で かいほう</span>');
    card.onclick = () => {
      if (!unlocked) { toast('LV5に なると えらべるよ'); Snd.sfx('nope'); return; }
      if (lv >= 5) { S.save.passive = k; persist(); Snd.sfx('tap'); buildSkillCards(); }
    };
    el.appendChild(card);
  });
  $('skillNote').textContent = lv >= 5 ? 'すきな ほうを セットできるよ' : 'いまは じぶんの キャラの スキルだけ。LV5で りょうほうから えらべるよ';
}

/* ---- UI ---- */
function attachUI() {
  $('btnStart').onclick = () => { Snd.sfx('tap'); showScreen('diff'); };
  $('btnBackTitle').onclick = () => { Snd.sfx('tap'); showScreen('title'); };
  $('btnBackTitle2').onclick = () => { Snd.sfx('tap'); showScreen('title'); };
  $('btnSkill').onclick = () => { Snd.sfx('tap'); showScreen('skill'); };
  $('btnSound').onclick = () => {
    S.save.sound = !S.save.sound; persist();
    Snd.setEnabled(S.save.sound);
    refreshTitle();
  };
  $('pickBlue').onclick = () => { S.save.gender = 'm'; persist(); Snd.sfx('tap'); refreshTitle(); };
  $('pickRed').onclick = () => { S.save.gender = 'f'; persist(); Snd.sfx('tap'); refreshTitle(); };
  $('btnZoomIn').onclick = () => { setZoom(S.zoom * 1.25); Snd.sfx('tap'); };
  $('btnZoomOut').onclick = () => { setZoom(S.zoom / 1.25); Snd.sfx('tap'); };
  $('btnReset').onclick = resetView;
  let quitArm = 0;
  $('btnQuit').onclick = () => {
    if (Date.now() - quitArm < 2000) { S.stage = null; quitArm = 0; showScreen('diff'); }
    else { quitArm = Date.now(); toast('もういちど ✕ で めいろを やめる'); }
  };
  $('btnRetry').onclick = () => { Snd.sfx('tap'); startStage(S.stage.diffIdx); };
  $('btnNext').onclick = () => { Snd.sfx('tap'); S.stage = null; showScreen('diff'); };
  // アイテムスロット
  $('slotPick').onclick = () => {
    if (!playActive()) return;
    if (S.targetMode === 'pick') { setTarget(null); return; }
    desc(DESCS.pick);
    if (S.stage.counts.pick <= 0) { Snd.sfx('nope'); return; }
    Snd.sfx('tap'); setTarget('pick');
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
    if (remain > 0) { toast('クールタイム あと' + Math.ceil(remain / 1000) + 'びょう'); Snd.sfx('nope'); return; }
    Snd.sfx('tap'); setTarget('tackle');
  };
  $('slotCoin').onclick = () => { desc(DESCS.coin); Snd.sfx('tap'); };
  $('slotDia').onclick = () => { desc(DESCS.diamond); Snd.sfx('tap'); };
  window.addEventListener('resize', resize);
  attachInput();
}

/* ---- メインループ ---- */
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(60, lastTs ? ts - lastTs : 16);
  lastTs = ts;
  tick(dt);
  render();
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
  drawPreview($('cvRed'), SPR.f.down[0]);
  attachUI();
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
  setTarget, tryTargetTap, candidates, bPos, bSize,
};
})();
