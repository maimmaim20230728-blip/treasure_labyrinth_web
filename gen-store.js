/* 宝の迷宮 - Google Play ストア素材生成（透過なし）
   node gen-store.js →
     store/feature-graphic.png   1024x500（フィーチャーグラフィック）
     store/icon-512-store.png     512x512（ストア用ハイレゾアイコン・不透明）
   ※sharpは既存アプリのnode_modulesを流用 */
const fs = require('fs'), path = require('path');
let sharp;
for (const p of ['sharp', 'C:/Users/puipu/nou_soyogi/node_modules/sharp', 'C:/Users/puipu/wise_world/node_modules/sharp']) {
  try { sharp = require(p); break; } catch (e) {}
}
if (!sharp) { console.error('sharp が見つかりません'); process.exit(1); }

const outDir = path.join(__dirname, 'store');
fs.mkdirSync(outDir, { recursive: true });

const BG = '#141628', GOLD = '#f5c542', PANEL = '#1e2140', BORDER = '#3a3f6e';

/* 迷路パターン（背景装飾用の壁ブロック） */
function mazeWalls(w, h, cell, op) {
  let s = '';
  const rnd = (seed) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    if (rnd(x * 13.1 + y * 7.7) > 0.62) {
      const horiz = rnd(x + y) > 0.5;
      s += `<rect x="${x}" y="${y}" width="${horiz ? cell * 2 : cell * 0.5}" height="${horiz ? cell * 0.5 : cell * 2}" rx="2" fill="#2a2e56" opacity="${op}"/>`;
    }
  }
  return s;
}

/* ドット絵の勇者（青・正面） */
function hero(x, y, s, body, pants) {
  const p = (cx, cy, w2, h2, c) => `<rect x="${x + cx * s}" y="${y + cy * s}" width="${w2 * s}" height="${h2 * s}" fill="${c}"/>`;
  return `<g>
    ${p(2, 0, 6, 2, '#4a3020')}${p(1, 1, 8, 1, '#4a3020')}
    ${p(2, 2, 6, 3, '#f2c9a0')}${p(3, 3, 1, 1, '#20242c')}${p(6, 3, 1, 1, '#20242c')}
    ${p(2, 5, 6, 5, body)}${p(1, 6, 8, 3, body)}
    ${p(2, 10, 6, 2, pants)}${p(2, 12, 2, 2, pants)}${p(6, 12, 2, 2, pants)}
  </g>`;
}

/* ドット絵のロボ（金属グレー＋シアン発光アイ＋金アンテナ） */
function robo(x, y, s) {
  const p = (cx, cy, w2, h2, c) => `<rect x="${x + cx * s}" y="${y + cy * s}" width="${w2 * s}" height="${h2 * s}" fill="${c}"/>`;
  const H = '#9aa4b0', B = '#7c8794', L = '#5a6470', E = '#3fe0ff', A = '#f5c542', P = '#4a525e';
  return `<g>
    ${p(3, -2, 1, 2, L)}${p(3.2, -2.4, 0.6, 0.6, A)}
    ${p(2, 0, 6, 2, H)}${p(1, 1, 8, 1, H)}
    ${p(1.5, 1, 2, 1, E)}${p(5.5, 1, 2, 1, E)}
    ${p(2, 2, 6, 1, H)}
    ${p(2, 3, 6, 4, B)}${p(1, 4, 8, 2, B)}
    ${p(2.5, 4, 1, 1, P)}${p(5.5, 4, 1, 1, P)}
    ${p(2, 7, 6, 1, L)}${p(2, 8, 2, 2, L)}${p(6, 8, 2, 2, L)}
  </g>`;
}

/* 金の宝箱（ゴール・後光つき） */
function chest(cx, cy, s) {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${s * 5.5}" fill="${GOLD}" opacity="0.22"/>
    <circle cx="${cx}" cy="${cy}" r="${s * 3.6}" fill="${GOLD}" opacity="0.3"/>
    <rect x="${cx - s * 4}" y="${cy - s * 1}" width="${s * 8}" height="${s * 4.2}" rx="3" fill="#e8b93a" stroke="#8a5a1c" stroke-width="3"/>
    <rect x="${cx - s * 4}" y="${cy - s * 2.6}" width="${s * 8}" height="${s * 2}" rx="3" fill="#f7d35e" stroke="#8a5a1c" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy - s * 0.4}" r="${s * 0.9}" fill="#c0392b"/>
    <path d="M${cx - s * 5.6} ${cy - s * 4} l${s * 0.5} ${s * 1.3} l${s * 1.3} ${s * 0.5} l${-s * 1.3} ${s * 0.5} l${-s * 0.5} ${s * 1.3} l${-s * 0.5} ${-s * 1.3} l${-s * 1.3} ${-s * 0.5} l${s * 1.3} ${-s * 0.5} Z" fill="#fff8dc" opacity="0.9"/>
    <path d="M${cx + s * 5} ${cy - s * 1} l${s * 0.4} ${s} l${s} ${s * 0.4} l${-s} ${s * 0.4} l${-s * 0.4} ${s} l${-s * 0.4} ${-s} l${-s} ${-s * 0.4} l${s} ${-s * 0.4} Z" fill="#fff8dc" opacity="0.85"/>
  </g>`;
}

/* ---- フィーチャーグラフィック 1024x500 ---- */
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${BG}"/>
  ${mazeWalls(1024, 500, 40, 0.5)}
  <rect width="1024" height="500" fill="url(#vig)"/>
  <defs>
    <radialGradient id="vig" cx="0.32" cy="0.5" r="0.75">
      <stop offset="0.45" stop-color="#141628" stop-opacity="0"/>
      <stop offset="1" stop-color="#0a0c1c" stop-opacity="0.85"/>
    </radialGradient>
  </defs>
  <!-- 右：ゴールの宝箱と勇者たち -->
  ${chest(812, 210, 15)}
  ${hero(690, 300, 7, '#3b6fd6', '#27407e')}
  ${hero(792, 320, 7, '#e0526b', '#93304a')}
  ${robo(894, 300, 7)}
  <!-- 左：タイトル -->
  <text x="60" y="150" font-family="Yu Gothic, Meiryo, sans-serif" font-size="24" fill="#cfd6ff">むりょう・広告なし・オフライン</text>
  <text x="56" y="252" font-family="'Yu Gothic UI', Yu Gothic, Meiryo, sans-serif" font-size="94" font-weight="bold" fill="${GOLD}" style="paint-order:stroke" stroke="#7a5a10" stroke-width="6">宝の迷宮</text>
  <text x="60" y="300" font-family="Yu Gothic, Meiryo, sans-serif" font-size="26" letter-spacing="5" fill="#9aa0d0">TREASURE LABYRINTH</text>
  <text x="60" y="352" font-family="Yu Gothic, Meiryo, sans-serif" font-size="30" fill="#f2ecd9">なぞって すすむ ドットめいろ</text>
  <text x="62" y="452" font-family="Yu Gothic, Meiryo, sans-serif" font-size="21" fill="#8a90c0">アプリ開発・介護と支援の相談どころ　そよぎ</text>
</svg>`;

/* ---- ストア用ハイレゾアイコン 512x512（不透明・迷路＋宝箱） ---- */
const u = 512 / 16;
function wallRect(bx, by, bw, bh) { return `<rect x="${bx * u}" y="${by * u}" width="${bw * u}" height="${bh * u}" fill="#3a3f6e"/>`; }
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  ${wallRect(1, 1, 14, 1)}${wallRect(1, 14, 14, 1)}${wallRect(1, 1, 1, 14)}${wallRect(14, 1, 1, 14)}
  ${wallRect(3, 3, 7, 1)}${wallRect(12, 3, 1, 6)}${wallRect(3, 6, 1, 7)}${wallRect(6, 12, 7, 1)}
  ${chest(256, 250, 21)}
  <rect x="${3.5 * u}" y="${10.4 * u}" width="${1.6 * u}" height="${1.6 * u}" fill="#3b6fd6"/>
  <rect x="${11 * u}" y="${10.4 * u}" width="${1.6 * u}" height="${1.6 * u}" fill="#e0526b"/>
</svg>`;

/* ---- Farcaster ミニアプリ カード（3:2・1200x800・埋め込み用） ---- */
const fcard = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="${BG}"/>
  ${mazeWalls(1200, 800, 48, 0.5)}
  <rect width="1200" height="800" fill="url(#vig2)"/>
  <defs>
    <radialGradient id="vig2" cx="0.32" cy="0.52" r="0.8">
      <stop offset="0.4" stop-color="#141628" stop-opacity="0"/>
      <stop offset="1" stop-color="#0a0c1c" stop-opacity="0.88"/>
    </radialGradient>
  </defs>
  ${chest(910, 300, 22)}
  ${hero(770, 430, 10, '#3b6fd6', '#27407e')}
  ${hero(910, 470, 10, '#e0526b', '#93304a')}
  ${robo(1050, 430, 10)}
  <text x="80" y="230" font-family="Yu Gothic, Meiryo, sans-serif" font-size="30" fill="#cfd6ff">むりょう・広告なし・オフライン</text>
  <text x="74" y="380" font-family="'Yu Gothic UI', Yu Gothic, Meiryo, sans-serif" font-size="128" font-weight="bold" fill="${GOLD}" style="paint-order:stroke" stroke="#7a5a10" stroke-width="8">宝の迷宮</text>
  <text x="80" y="440" font-family="Yu Gothic, Meiryo, sans-serif" font-size="32" letter-spacing="6" fill="#9aa0d0">TREASURE LABYRINTH</text>
  <text x="80" y="520" font-family="Yu Gothic, Meiryo, sans-serif" font-size="40" fill="#f2ecd9">なぞって すすむ ドットめいろ</text>
  <text x="82" y="720" font-family="Yu Gothic, Meiryo, sans-serif" font-size="26" fill="#8a90c0">アプリ開発・介護と支援の相談どころ　そよぎ</text>
</svg>`;

/* ---- スクリーンショット（1080x1920・縦） ---- */
const SW = 1080, SH = 1920;

/* 2.5D風の壁ブロック（前面＋上面） */
function wall25(x, y, w, h, top, front, line) {
  const wh = 22;
  return `<rect x="${x}" y="${y + h - wh}" width="${w}" height="${wh}" fill="${front}"/>`
    + `<rect x="${x}" y="${y - wh}" width="${w}" height="${h}" fill="${top}" stroke="${line}" stroke-width="1.5"/>`;
}
function ssBadge(x, y, ic, txt) {
  return `<g>
    <rect x="${x}" y="${y}" width="150" height="150" rx="22" fill="${PANEL}" stroke="${BORDER}" stroke-width="3"/>
    <text x="${x + 75}" y="${y + 82}" font-family="sans-serif" font-size="58" text-anchor="middle">${ic}</text>
    <text x="${x + 75}" y="${y + 128}" font-family="Yu Gothic, Meiryo, sans-serif" font-size="24" fill="#f2ecd9" text-anchor="middle">${txt}</text>
  </g>`;
}

/* SS1 タイトル */
const shot1 = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${BG}"/>
  ${mazeWalls(SW, SH, 64, 0.4)}
  <text x="${SW / 2}" y="360" font-family="'Yu Gothic UI', Yu Gothic, Meiryo, sans-serif" font-size="150" font-weight="bold" fill="${GOLD}" text-anchor="middle" style="paint-order:stroke" stroke="#7a5a10" stroke-width="9">宝の迷宮</text>
  <text x="${SW / 2}" y="430" font-family="Yu Gothic, Meiryo, sans-serif" font-size="38" letter-spacing="8" fill="#9aa0d0" text-anchor="middle">TREASURE LABYRINTH</text>
  <text x="${SW / 2}" y="520" font-family="Yu Gothic, Meiryo, sans-serif" font-size="46" fill="#f2ecd9" text-anchor="middle">なぞって すすむ ドットめいろ</text>
  <!-- キャラ3枚 -->
  <g>
    <rect x="150" y="620" width="230" height="290" rx="20" fill="${PANEL}" stroke="${GOLD}" stroke-width="4"/>
    ${hero(198, 690, 14, '#3b6fd6', '#27407e')}
    <text x="265" y="875" font-family="Yu Gothic, Meiryo, sans-serif" font-size="34" fill="#f2ecd9" text-anchor="middle">あお</text>
    <rect x="425" y="620" width="230" height="290" rx="20" fill="${PANEL}" stroke="${BORDER}" stroke-width="3"/>
    ${robo(478, 690, 14)}
    <text x="540" y="875" font-family="Yu Gothic, Meiryo, sans-serif" font-size="34" fill="#f2ecd9" text-anchor="middle">ロボ</text>
    <rect x="700" y="620" width="230" height="290" rx="20" fill="${PANEL}" stroke="${BORDER}" stroke-width="3"/>
    ${hero(748, 690, 14, '#e0526b', '#93304a')}
    <text x="815" y="875" font-family="Yu Gothic, Meiryo, sans-serif" font-size="34" fill="#f2ecd9" text-anchor="middle">あか</text>
  </g>
  <rect x="290" y="1000" width="500" height="130" rx="24" fill="${GOLD}"/>
  <text x="${SW / 2}" y="1085" font-family="Yu Gothic, Meiryo, sans-serif" font-size="52" font-weight="bold" fill="#3a2a05" text-anchor="middle">▶ はじめる</text>
  <text x="${SW / 2}" y="1300" font-family="Yu Gothic, Meiryo, sans-serif" font-size="44" fill="#cfd6ff" text-anchor="middle">むりょう・広告なし・オフライン</text>
  <text x="${SW / 2}" y="1380" font-family="Yu Gothic, Meiryo, sans-serif" font-size="36" fill="#8a90c0" text-anchor="middle">息ぬきにも 脳トレにも</text>
</svg>`;

/* SS2 プレイ画面（HUD＋迷路＋アイテム欄） */
const th = THEMES => 0;
const T0 = { top: '#9aa0aa', top2: '#8a8f98', front: '#666c78', line: '#474b55', floor: '#d9d0aa', floor2: '#cfc59c' };
function mazeScene(ox, oy) {
  let s = `<rect x="${ox}" y="${oy}" width="1080" height="1180" fill="#101223"/>`;
  // 床
  for (let y = 0; y < 1180; y += 96) for (let x = 0; x < 1080; x += 96) {
    s += `<rect x="${ox + x}" y="${oy + y}" width="96" height="96" fill="${((x / 96 + y / 96) & 1) ? T0.floor : T0.floor2}"/>`;
  }
  // 壁（迷路っぽく）
  const W = [[0, 0, 1080, 48], [0, 1132, 1080, 48], [0, 0, 48, 1180], [1032, 0, 48, 1180],
    [200, 200, 400, 48], [600, 200, 48, 300], [200, 400, 48, 400], [400, 600, 300, 48], [700, 700, 48, 300], [300, 900, 400, 48]];
  for (const w of W) s += wall25(ox + w[0], oy + w[1], w[2], w[3], T0.top, T0.front, T0.line);
  // ゴールの宝箱
  s += chest(ox + 850, oy + 320, 20);
  // 勇者
  s += hero(ox + 380, oy + 640, 11, '#3b6fd6', '#27407e');
  // なぞりの点線
  for (let i = 0; i < 5; i++) s += `<circle cx="${ox + 430 + i * 60}" cy="${oy + 700 - i * 20}" r="6" fill="rgba(255,255,255,0.5)"/>`;
  return s;
}
function slot(x, ic, cnt, lbl, sel) {
  return `<g>
    <rect x="${x}" y="1640" width="150" height="150" rx="20" fill="${PANEL}" stroke="${sel ? GOLD : BORDER}" stroke-width="${sel ? 4 : 3}"/>
    <text x="${x + 62}" y="1710" font-family="sans-serif" font-size="52" text-anchor="middle">${ic}</text>
    <text x="${x + 115}" y="1700" font-family="sans-serif" font-size="26" fill="#f2ecd9" text-anchor="middle">${cnt}</text>
    <text x="${x + 75}" y="1770" font-family="Yu Gothic, Meiryo, sans-serif" font-size="24" fill="#f2ecd9" text-anchor="middle">${lbl}</text>
  </g>`;
}
const shot2 = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${BG}"/>
  <!-- 上部HUD -->
  <rect x="0" y="0" width="${SW}" height="150" fill="#10122a"/>
  <text x="40" y="88" font-family="sans-serif" font-size="62" font-weight="bold" fill="#f2ecd9">⏱ 0:14.2</text>
  <text x="40" y="128" font-family="Yu Gothic, Meiryo, sans-serif" font-size="30" fill="#9aa0d0">もくひょう 0:40.0</text>
  <text x="${SW - 260}" y="95" font-family="Yu Gothic, Meiryo, sans-serif" font-size="32" fill="#f2ecd9">ふつう</text>
  <!-- 迷路 -->
  <svg x="0" y="150" width="1080" height="1180">${mazeScene(0, 0)}</svg>
  <!-- 下部アイテム欄 -->
  <rect x="0" y="1600" width="${SW}" height="320" fill="#10122a"/>
  ${slot(60, '⛏️', '×2', 'つるはし', true)}
  ${slot(232, '🪜', '×3', 'ハシゴ', false)}
  ${slot(404, '🪙', '×1', 'コイン', false)}
  ${slot(576, '💎', '×0', 'ダイヤ', false)}
  ${slot(748, '💥', 'OK', 'たいあたり', false)}
  ${slot(920, '🌀', 'OK', 'ワープ', false)}
  <text x="${SW / 2}" y="1880" font-family="Yu Gothic, Meiryo, sans-serif" font-size="30" fill="#f2ecd9" text-anchor="middle">ゆびで みちを なぞろう。キャラが おくれて ついてくるよ</text>
</svg>`;

/* SS3 特徴まとめ */
const shot3 = `<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">
  <rect width="${SW}" height="${SH}" fill="${BG}"/>
  ${mazeWalls(SW, SH, 64, 0.35)}
  <text x="${SW / 2}" y="230" font-family="Yu Gothic, Meiryo, sans-serif" font-size="64" font-weight="bold" fill="${GOLD}" text-anchor="middle">たっぷり あそべる</text>
  ${[['🏰', '9つの', 'めいろテーマ'], ['🌸', '8段階の', 'なんいど'], ['⚙️', '10種の', 'スキル'], ['🌐', '19言語', 'たいおう'], ['🔊', 'BGM＆音量', 'せってい'], ['🔡', 'もじサイズ', 'かえられる']]
    .map((f, i) => {
      const col = i % 2, row = (i / 2) | 0;
      const x = 120 + col * 470, y = 360 + row * 400;
      return `<g>
        <rect x="${x}" y="${y}" width="410" height="330" rx="28" fill="${PANEL}" stroke="${BORDER}" stroke-width="3"/>
        <text x="${x + 205}" y="${y + 150}" font-family="sans-serif" font-size="120" text-anchor="middle">${f[0]}</text>
        <text x="${x + 205}" y="${y + 230}" font-family="Yu Gothic, Meiryo, sans-serif" font-size="46" font-weight="bold" fill="${GOLD}" text-anchor="middle">${f[1]}</text>
        <text x="${x + 205}" y="${y + 285}" font-family="Yu Gothic, Meiryo, sans-serif" font-size="38" fill="#f2ecd9" text-anchor="middle">${f[2]}</text>
      </g>`;
    }).join('')}
  <text x="${SW / 2}" y="1800" font-family="Yu Gothic, Meiryo, sans-serif" font-size="34" fill="#8a90c0" text-anchor="middle">アプリ開発・介護と支援の相談どころ　そよぎ</text>
</svg>`;

async function main() {
  await sharp(Buffer.from(feature)).resize(1024, 500).flatten({ background: BG }).png()
    .toFile(path.join(outDir, 'feature-graphic.png'));
  console.log('wrote store/feature-graphic.png (1024x500)');
  await sharp(Buffer.from(icon)).resize(512, 512).flatten({ background: BG }).png()
    .toFile(path.join(outDir, 'icon-512-store.png'));
  console.log('wrote store/icon-512-store.png (512x512)');
  await sharp(Buffer.from(fcard)).resize(1200, 800).flatten({ background: BG }).png()
    .toFile(path.join(outDir, 'farcaster-card.png'));
  console.log('wrote store/farcaster-card.png (1200x800, 3:2)');
  const shots = { 'screenshot-1-title': shot1, 'screenshot-2-play': shot2, 'screenshot-3-features': shot3 };
  for (const [name, svg] of Object.entries(shots)) {
    await sharp(Buffer.from(svg)).resize(SW, SH).flatten({ background: BG }).png()
      .toFile(path.join(outDir, name + '.png'));
    console.log('wrote store/' + name + '.png (' + SW + 'x' + SH + ')');
  }
}
main().catch(e => { console.error(e); process.exit(1); });
