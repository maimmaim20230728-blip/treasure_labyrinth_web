/* 宝の迷宮 (Treasure Labyrinth) - ゲーム本体
   レトロ2Dドット絵 × 2.5D風俯瞰 × なぞり移動の迷路ゲーム */
(function () {
'use strict';

const L = window.Logic;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ---- 定数 ---- */
const T = 32;   // 1ブロックのワールドpx
const WH = 14;  // 壁の見た目の高さ（2.5D風に側面が見える）

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
  default: 'ゆびで なぞると 1びょうおくれて キャラが はしるよ',
  pick:    '⛏️つるはし：かべを 1まい こわせる（つかいきり・さいだい2こ）',
  ladder:  '🪜ハシゴ：かべに かける。かけた ほうこうにだけ とおれる（さいだい3こ）',
  coin:    '🪙コイン：さいごの タイムを 10%カット（ふくり・さいだい5まい）',
  diamond: '💎ダイヤ：さいごの タイムを 15%カット（ふくり・さいだい5こ）',
  fist:    '👊かべパンチ：つるはしなしで かべを こわせる（クールタイムあり）',
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
const roomX = rx => (2 * rx + 1.5) * T;
const roomY = ry => (2 * ry + 1.5) * T;
function viewScale() {
  const base = clamp(Math.min(cv.clientWidth, cv.clientHeight) / (T * 11), 0.9, 2.4);
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
  const ww = st.m.bw * T, wh2 = st.m.bh * T;
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
  const path = L.shortestPath(m, 0, 0, diff.w - 1, diff.h - 1, null);
  const st = {
    diffIdx: di, diff, m,
    ladders: new Uint8Array(m.bw * m.bh),
    chests: new Map(),
    timer: new L.StageTimer(),
    plan: [], gameTime: 0,
    targetMs: L.targetSeconds(diff, path.length - 1) * 1000,
    counts: { pick: 0, ladder: 0, coin: 0, diamond: 0 },
    char: { rx: 0, ry: 0, x: roomX(0), y: roomY(0), dir: 2, frame: 0, animT: 0, moving: null },
    cam: { x: roomX(0), y: roomY(0) },
    theme: THEMES[(Math.random() * THEMES.length) | 0],
    particles: [], shake: 0, cleared: false, fistReadyAt: 0,
  };
  st.cuts = new L.CutsceneCtrl(st.timer);
  // 宝箱配置（スタート・ゴール以外からランダム）
  const n = L.chestCount(diff);
  const cand = [];
  for (let i = 1; i < diff.w * diff.h - 1; i++) cand.push(i);
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
  const rx = clamp(Math.round((w.x / T - 1.5) / 2), 0, st.m.w - 1);
  const ry = clamp(Math.round((w.y / T - 1.5) / 2), 0, st.m.h - 1);
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
  let budget = dt / 1000 * L.CHAR_SPEED * 2 * T; // 一定速度（キビキビ）
  while (budget > 0) {
    if (!c.moving) {
      const nxt = st.plan[0];
      if (!nxt) { c.animT = 0; c.frame = 0; break; }
      if (st.gameTime < nxt.t + 1000) break; // 約1秒遅れて追いかける
      const d = dirBetween(c.rx, c.ry, nxt.rx, nxt.ry);
      if (d < 0 || !L.canPass(st.m, c.rx, c.ry, d, st.ladders)) { st.plan.shift(); continue; }
      st.plan.shift();
      c.moving = { fx: c.x, fy: c.y, tx: nxt.rx, ty: nxt.ry, prog: 0, dist: 2 * T };
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
    st.cuts.start('chest', 3000, { ri, revealAt: 900, res: chest.result }, () => applyChest(chest.result));
    return;
  }
  if (c.rx === st.m.w - 1 && c.ry === st.m.h - 1) doClear();
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
  if (mode === 'pick' || mode === 'fist') desc(DESCS.pickTarget);
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
    const x = cand.bx * T, y = cand.by * T - WH;
    if (wx >= x && wx <= x + T && wy >= y && wy <= y + T + WH) {
      const mode = S.targetMode; setTarget(null);
      if (mode === 'ladder') {
        st.counts.ladder--; // 置いたら再配置不可・通行は何度でも（再利用可）
        st.ladders[cand.wi] = cand.d + 1;
        Snd.sfx('ladder');
        st.cuts.start('ladder', 900, { wi: cand.wi }, () => {});
      } else {
        if (mode === 'pick') st.counts.pick--; // 1回使い捨て
        else st.fistReadyAt = st.gameTime + L.PASSIVE.m.ct[L.passiveRank(L.levelFor(S.save.exp))] * 1000;
        st.plan.length = 0;
        st.cuts.start('break', 2000, { wi: cand.wi, hitsDone: 0 }, () => {
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
  const fin = L.finalTimeMs(raw, st.counts.coin, st.counts.diamond); // 複利計算
  const ok = fin <= st.targetMs;
  const prevLv = L.levelFor(S.save.exp);
  let e = st.diff.exp * (ok ? 1.5 : 1);
  if (effPassive() === 'f') e *= L.PASSIVE.f.mult[L.passiveRank(prevLv)];
  e = Math.round(e);
  S.save.exp += e; S.save.badges[st.diffIdx]++; persist();
  const newLv = L.levelFor(S.save.exp);
  setTimeout(() => {
    if (ok) { Snd.sfx('fanfare'); Snd.bgm('clearBig'); spawnConfetti(150); } // 盛大に祝う
    else    { Snd.sfx('clearSoft'); Snd.bgm('clearSoft'); spawnConfetti(25); } // ひかえめ
    buildClearOverlay(raw, fin, ok, e, newLv);
    showScreen('clear');
    if (newLv > prevLv) {
      showLvup(newLv); Snd.sfx('levelup');
      if (newLv >= 5 && prevLv < 5) setTimeout(() => toast('⚙スキルせんたくが かいほうされた！'), 1900);
    }
  }, 650);
}
function buildClearOverlay(raw, fin, ok, e, lv) {
  const st = S.stage, c = st.counts;
  $('clearTitle').textContent = ok ? '🎉 おたから ゲット！ 🎉' : '✨ ゴール！';
  let html = '<div class="crow">めいろの タイム <b>' + fmt(raw) + '</b></div>';
  if (c.coin) html += '<div class="crow">🪙×' + c.coin + '　タイム ×' + Math.pow(0.9, c.coin).toFixed(3) + '（ふくり）</div>';
  if (c.diamond) html += '<div class="crow">💎×' + c.diamond + '　タイム ×' + Math.pow(0.85, c.diamond).toFixed(3) + '（ふくり）</div>';
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
      x: bx * T + T / 2, y: by * T + T / 2 - WH / 2,
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
      if (cutA.kind === 'break') { // 3回叩くアニメ＋打撃音
        const hits = Math.min(3, 1 + ((cutA.t / 650) | 0));
        if (hits > cutA.data.hitsDone) { cutA.data.hitsDone = hits; Snd.sfx('pickHit'); st.shake = 5; }
      }
    } else {
      st.timer.update(dt); // 演出中はタイマーが止まっている
      st.gameTime += dt;
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
    const remain = Math.max(0, st.fistReadyAt - st.gameTime);
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
    const x0 = Math.max(0, ((st.cam.x - cw / 2 / sc) / T | 0) - 1), x1 = Math.min(m.bw - 1, ((st.cam.x + cw / 2 / sc) / T | 0) + 1);
    const y0 = Math.max(0, ((st.cam.y - ch / 2 / sc) / T | 0) - 2), y1 = Math.min(m.bh - 1, ((st.cam.y + ch / 2 / sc) / T | 0) + 2);
    // 床
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      if (m.g[by * m.bw + bx] !== 0) continue;
      ctx.fillStyle = ((bx + by) & 1) ? th.floor : th.floor2;
      ctx.fillRect(bx * T, by * T, T, T);
    }
    drawPlan(st);
    // 行ごとに 壁→エンティティ（2.5D風の前後関係）
    const charRow = clamp((st.char.y / T) | 0, 0, m.bh - 1);
    const goalRow = 2 * (m.h - 1) + 1;
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
      if (by === charRow) drawChar(st);
    }
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
  const m = st.m, th = st.theme, x = bx * T, y = by * T;
  const below = (by + 1 < m.bh) ? m.g[(by + 1) * m.bw + bx] : 0;
  if (below === 0) { // 壁の側面（前面）が見える
    ctx.fillStyle = (v === 2) ? th.front2 : th.front;
    ctx.fillRect(x, y + T - WH, T, WH);
    ctx.fillStyle = th.line;
    ctx.fillRect(x, y + T - WH + ((WH / 2) | 0), T, 1);
    ctx.fillRect(x + ((bx & 1) ? (T >> 2) : (3 * T >> 2)), y + T - WH, 1, (WH / 2) | 0);
  }
  ctx.fillStyle = (v === 2) ? th.top2 : th.top;
  ctx.fillRect(x, y - WH, T, T);
  ctx.strokeStyle = th.line; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y - WH + 0.5, T - 1, T - 1);
  const cutA = st.cuts.active;
  if (cutA && cutA.kind === 'break' && cutA.data.wi === by * m.bw + bx) {
    drawCracks(x, y - WH, Math.min(3, 1 + ((cutA.t / 650) | 0)));
  }
  const lv = st.ladders[by * m.bw + bx];
  if (lv) drawLadder(x, y - WH, lv - 1);
}
function drawCracks(x, y, lvl) {
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + T * 0.5, y + T * 0.15); ctx.lineTo(x + T * 0.35, y + T * 0.45); ctx.lineTo(x + T * 0.55, y + T * 0.6);
  if (lvl >= 2) {
    ctx.moveTo(x + T * 0.35, y + T * 0.45); ctx.lineTo(x + T * 0.15, y + T * 0.7);
    ctx.moveTo(x + T * 0.55, y + T * 0.6); ctx.lineTo(x + T * 0.75, y + T * 0.85);
  }
  if (lvl >= 3) {
    ctx.moveTo(x + T * 0.5, y + T * 0.15); ctx.lineTo(x + T * 0.72, y + T * 0.35);
    ctx.moveTo(x + T * 0.15, y + T * 0.7); ctx.lineTo(x + T * 0.3, y + T * 0.9);
  }
  ctx.stroke();
}
function drawLadder(x, y, d) {
  ctx.fillStyle = '#a9743f';
  const horiz = (d === 1 || d === 3);
  if (horiz) {
    ctx.fillRect(x + 3, y + T * 0.3, T - 6, 3); ctx.fillRect(x + 3, y + T * 0.62, T - 6, 3);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 6 + i * ((T - 12) / 2), y + T * 0.3, 3, T * 0.32 + 3);
  } else {
    ctx.fillRect(x + T * 0.3, y + 3, 3, T - 6); ctx.fillRect(x + T * 0.62, y + 3, 3, T - 6);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + T * 0.3, y + 6 + i * ((T - 12) / 2), T * 0.32 + 3, 3);
  }
  // 通れる方向の矢印
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  const cx = x + T / 2, cy = y + T / 2, a = 6;
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
  const m = st.m, gx = roomX(m.w - 1), gy = roomY(m.h - 1);
  const t = performance.now() / 1000;
  const w = T * 0.8, h = T * 0.62, x = gx - w / 2, y = gy + T * 0.38 - h;
  ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
  ctx.fillStyle = '#f5c542';
  if (st.cleared) ctx.fillRect(x - 1, y - h * 0.25, w + 2, h * 0.3);
  else ctx.fillRect(x, y, w, h * 0.4);
  ctx.fillStyle = '#7a4a20'; ctx.fillRect(x + w * 0.44, y + h * 0.3, w * 0.12, h * 0.4);
  ctx.fillStyle = 'rgba(255,236,150,' + (0.5 + 0.5 * Math.sin(t * 3)).toFixed(3) + ')';
  ctx.fillRect(gx - 1.5, gy - T * 0.7 - ((t * 10) % 8), 3, 3);
  ctx.fillRect(gx + 8, gy - T * 0.5 - ((t * 13) % 10), 2.5, 2.5);
  ctx.fillRect(gx - 9, gy - T * 0.55 - ((t * 8) % 7), 2.5, 2.5);
}
function drawChest(st, ri, chd) {
  const m = st.m, rx = ri % m.w, ry = (ri / m.w) | 0;
  const cx = roomX(rx), cyB = roomY(ry) + T * 0.36;
  const w = T * 0.62, h = T * 0.5, x = cx - w / 2, y = cyB - h;
  const cutA = st.cuts.active;
  let lid = chd.opened ? 1 : 0;
  if (cutA && cutA.kind === 'chest' && cutA.data.ri === ri) lid = Math.min(1, cutA.t / 800);
  ctx.fillStyle = '#7a4a20'; ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
  if (lid > 0) { ctx.fillStyle = '#241608'; ctx.fillRect(x + 2, y + h * 0.35, w - 4, h * 0.25); }
  ctx.fillStyle = '#9a6a34'; ctx.fillRect(x - 1, y - lid * h * 0.5, w + 2, h * 0.42);
  ctx.fillStyle = '#f5c542'; ctx.fillRect(x + w * 0.44, y + h * 0.3, w * 0.12, h * 0.45);
}
function drawChar(st) {
  const c = st.char;
  const set = SPR[S.save.gender];
  const key = c.dir === 0 ? 'up' : c.dir === 1 ? 'right' : c.dir === 3 ? 'left' : 'down';
  const img = set[key][c.moving ? c.frame : 0];
  ctx.drawImage(img, Math.round(c.x - 10), Math.round(c.y + T * 0.4 - 28), 20, 28);
}
function drawTargets(st) {
  if (!S.targetMode) return;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
  for (const c of candidates()) {
    ctx.strokeStyle = 'rgba(255,220,80,' + (0.45 + 0.5 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(c.bx * T + 1.5, c.by * T - WH + 1.5, T - 3, T + WH - 3);
    ctx.fillStyle = 'rgba(255,220,80,' + (0.12 + 0.15 * pulse).toFixed(3) + ')';
    ctx.fillRect(c.bx * T + 1.5, c.by * T - WH + 1.5, T - 3, T + WH - 3);
  }
}
function drawCutFx(st) {
  const c = st.cuts.active; if (!c) return;
  const m = st.m;
  if (c.kind === 'break') {
    const bx = c.data.wi % m.bw, by = (c.data.wi / m.bw) | 0;
    const swing = Math.sin(c.t / 650 * Math.PI * 2) * 0.9;
    ctx.save();
    ctx.translate(bx * T + T * 0.85, by * T - WH - 4);
    ctx.rotate(-0.6 + swing);
    ctx.font = ((T * 0.9) | 0) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛏️', 0, 0);
    ctx.restore();
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
    ctx.strokeRect(bx * T - 2, by * T - WH - 2, T + 4, T + 4);
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
  $('slotFist').classList.toggle('sel', S.targetMode === 'fist');
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
  const curBase = L.LV_EXP[lv - 1];
  const next = (lv < L.LV_EXP.length) ? L.LV_EXP[lv] : null;
  $('expFill').style.width = next ? Math.min(100, 100 * (S.save.exp - curBase) / (next - curBase)) + '%' : '100%';
  $('expTxt').textContent = next ? ('EXP ' + S.save.exp + ' / ' + next) : ('EXP ' + S.save.exp + '（LV10たいは こうかいよてい）');
  const pk = effPassive(), P = L.PASSIVE[pk], r = L.passiveRank(lv);
  $('passiveNow').textContent = 'パッシブ: ' + P.icon + P.name + (pk === 'm' ? '（CT ' + P.ct[r] + 'びょう）' : '（EXP ×' + P.mult[r] + '）');
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
  const lv = L.levelFor(S.save.exp), r = L.passiveRank(lv);
  const el = $('skillCards'); el.innerHTML = '';
  ['m', 'f'].forEach(k => {
    const P = L.PASSIVE[k];
    const unlocked = (k === S.save.gender) || lv >= 5; // LV5で異性のパッシブも習得（平等化）
    const seld = effPassive() === k;
    const card = document.createElement('button');
    card.className = 'skillCard' + (seld ? ' sel' : '') + (unlocked ? '' : ' locked');
    const val = k === 'm' ? ('クールタイム ' + P.ct[r] + 'びょう') : ('EXP ×' + P.mult[r]);
    card.innerHTML = '<b>' + P.icon + ' ' + P.name + '</b><span>' + P.desc + '</span><span class="val">' + val + '</span>'
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
    if (S.targetMode === 'fist') { setTarget(null); return; }
    desc(DESCS.fist);
    const st = S.stage;
    const remain = st.fistReadyAt - st.gameTime;
    if (remain > 0) { toast('クールタイム あと' + Math.ceil(remain / 1000) + 'びょう'); Snd.sfx('nope'); return; }
    Snd.sfx('tap'); setTarget('fist');
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
    const p = L.shortestPath(st.m, from.rx, from.ry, st.m.w - 1, st.m.h - 1, st.ladders);
    if (!p) return 0;
    const seg = p.slice(1, n ? 1 + n : undefined);
    for (const q of seg) st.plan.push({ rx: q[0], ry: q[1], t: st.gameTime - 2000 });
    return seg.length;
  },
  skip: () => S.stage && S.stage.cuts.skip(),
};
})();
