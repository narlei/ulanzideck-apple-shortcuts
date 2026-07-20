// Generates the README/store art (cover + two banners) as self-contained SVGs
// in the shared dark-navy store style. The shortcut keys embed REAL shortcut
// icons (fetched from the Shortcuts app into tools/assets/) so mockups are
// authentic. Rasterize with Chrome headless. Run: node tools/gen-banners.mjs
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'resources');
const ICON_PATH = path.join(__dirname, '..', 'com.narlei.appleshortcuts.ulanziPlugin', 'resources', 'icon.png');

const dataUrl = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const asset = (n) => dataUrl(path.join(__dirname, 'assets', n));

const ICON_URL = dataUrl(ICON_PATH);
const SC = {
  pomodoro: asset('pomodoro.png'),
  volup: asset('volup.png'),
  voldown: asset('voldown.png'),
  play: asset('play.png'),
  alarm: asset('alarm.png'),
  meme: asset('meme.png'),
};

const ACCENT = '#8A5CFF';
const BG0 = '#0a0e1a';
const BG1 = '#0d1117';
const WHITE = '#ffffff';
const MUTED = '#8b93a7';
const CARD = '#15181f';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const KEY_BG = '#0e0e12';

let uid = 0;
const nextId = () => `id${uid++}`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function txt(s, x, y, size, { fill = WHITE, weight = 700, anchor = 'start', spacing = 0, family } = {}) {
  const ls = spacing ? ` letter-spacing="${spacing}"` : '';
  const ff = family || 'Helvetica Neue, Helvetica, Arial, sans-serif';
  return `<text x="${x}" y="${y}" font-family="${ff}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${esc(s)}</text>`;
}

function keyCell(x, y, size, imgUrl, radius = 22) {
  const clip = nextId();
  const frame = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${KEY_BG}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  if (!imgUrl) return frame;
  const pad = Math.round(size * 0.06);
  const inner = size - pad * 2;
  return (
    `<defs><clipPath id="${clip}"><rect x="${x + pad}" y="${y + pad}" width="${inner}" height="${inner}" rx="${radius - 6}"/></clipPath></defs>` +
    frame +
    `<image href="${imgUrl}" x="${x + pad}" y="${y + pad}" width="${inner}" height="${inner}" clip-path="url(#${clip})"/>`
  );
}

function appIcon(x, y, size) {
  const clip = nextId();
  const glow = nextId();
  return (
    `<defs>` +
    `<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.24}"/></clipPath>` +
    `<filter id="${glow}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="18"/></filter>` +
    `</defs>` +
    `<rect x="${x - 4}" y="${y - 4}" width="${size + 8}" height="${size + 8}" rx="${size * 0.28}" filter="url(#${glow})" fill="${ACCENT}" opacity="0.5"/>` +
    `<image href="${ICON_URL}" x="${x}" y="${y}" width="${size}" height="${size}" clip-path="url(#${clip})"/>`
  );
}

function pillRow(x, y, labels, size = 28, gap = 18) {
  let cx = x;
  let out = '';
  for (const l of labels) {
    const padX = Math.round(size * 0.9);
    const w = Math.round(l.length * size * 0.56 + padX * 2);
    const h = Math.round(size * 1.9);
    out +=
      `<rect x="${cx}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>` +
      txt(l, cx + w / 2, y + h / 2 + size * 0.34, size, { fill: '#d3d8e3', weight: 600, anchor: 'middle' });
    cx += w + gap;
  }
  return out;
}

function checkItem(x, y, label, size = 40, accent = ACCENT) {
  const box = size * 1.1;
  const by = y - box * 0.75;
  return (
    `<rect x="${x}" y="${by}" width="${box}" height="${box}" rx="${box * 0.28}" fill="rgba(138,92,255,0.14)" stroke="${accent}" stroke-width="2"/>` +
    `<path d="M ${x + box * 0.25} ${by + box * 0.52} L ${x + box * 0.44} ${by + box * 0.7} L ${x + box * 0.76} ${by + box * 0.3}" fill="none" stroke="${accent}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    txt(label, x + box + size * 0.5, y, size, { fill: '#e6e9f0', weight: 600 })
  );
}

function bgLayer(w, h) {
  const g = nextId();
  const glow = nextId();
  return (
    `<defs>` +
    `<linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BG0}"/><stop offset="1" stop-color="${BG1}"/></linearGradient>` +
    `<radialGradient id="${glow}" cx="0.14" cy="0.1" r="0.5"><stop offset="0" stop-color="rgba(46,86,170,0.38)"/><stop offset="1" stop-color="rgba(46,86,170,0)"/></radialGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="url(#${g})"/>` +
    `<rect width="${w}" height="${h}" fill="url(#${glow})"/>`
  );
}

const headlineGradientDef = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3ecf6b"/><stop offset="0.55" stop-color="#22d3ee"/><stop offset="1" stop-color="#4772fa"/></linearGradient>`;

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

// ================================ COVER (1600x800) ============================
function buildCover() {
  const W = 1600, H = 800;
  const gid = nextId();
  let s = bgLayer(W, H);
  s += `<defs>${headlineGradientDef(gid)}</defs>`;

  s += appIcon(90, 150, 120);
  s += txt('Apple Shortcuts', 240, 210, 60, { weight: 800 });
  s += txt('UlanziDeck · macOS', 242, 250, 26, { fill: MUTED, weight: 600 });

  s += txt('Your Shortcuts.', 90, 400, 88, { weight: 800 });
  s += txt('One tap away.', 90, 500, 88, { weight: 800, fill: `url(#${gid})` });

  s += txt('Every shortcut on your Mac, on a physical key.', 92, 560, 32, { fill: '#aeb6c6', weight: 500 });

  s += pillRow(90, 610, ['Real shortcut icons', 'A–Z list', 'Zero setup'], 28, 18);

  const px = 900, py = 190, pw = 610, ph = 430;
  s += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="34" fill="#141414" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
  s += txt('U · STUDIO', px + pw / 2, py + 60, 26, { fill: '#6b7180', weight: 700, anchor: 'middle', spacing: 8 });

  const keySize = 118, gap = 24;
  const gx = px + 40, gy = py + 90;
  const row0 = [SC.pomodoro, SC.volup, SC.play, SC.alarm];
  for (let i = 0; i < 4; i++) s += keyCell(gx + i * (keySize + gap), gy, keySize, row0[i]);
  const row1 = [SC.meme, null, null, null];
  for (let i = 0; i < 4; i++) s += keyCell(gx + i * (keySize + gap), gy + keySize + gap, keySize, row1[i]);

  return svg(W, H, s);
}

// ============================== BANNER 1 (2400x1600) =========================
// "Real icons. Real shortcuts." — grid of shortcut keys.
function buildBanner1() {
  const W = 2400, H = 1600;
  const gid = nextId();
  let s = bgLayer(W, H);
  s += `<defs>${headlineGradientDef(gid)}</defs>`;

  const lx = 130;
  s += `<circle cx="${lx + 8}" cy="335" r="9" fill="${ACCENT}"/>`;
  s += txt('STRAIGHT FROM SHORTCUTS', lx + 34, 345, 32, { fill: '#9aa2b4', weight: 700, spacing: 6 });
  s += txt('Real icons.', lx, 500, 118, { weight: 800 });
  s += txt('Real shortcuts.', lx, 630, 118, { weight: 800, fill: `url(#${gid})` });
  s += txt('The key wears the shortcut’s own icon, fetched', lx, 770, 42, { fill: '#aeb6c6', weight: 500 });
  s += txt('live from the Shortcuts app — recolor it there,', lx, 828, 42, { fill: '#aeb6c6', weight: 500 });
  s += txt('hit Refresh here.', lx, 886, 42, { fill: '#aeb6c6', weight: 500 });

  s += checkItem(lx, 1130, 'Icons synced from macOS', 40);
  s += checkItem(lx, 1230, 'Toast confirms every run', 40);
  s += checkItem(lx, 1330, 'Runs via Apple’s own CLI', 40);

  const cards = [
    { img: SC.pomodoro, title: 'Start Pomodoro', sub: 'focus timer' },
    { img: SC.volup, title: 'Volume Up', sub: 'system control' },
    { img: SC.play, title: 'Play', sub: 'media' },
    { img: SC.alarm, title: 'Start alarm', sub: 'clock' },
    { img: SC.meme, title: 'Meme Maker', sub: 'fun' },
    { img: SC.voldown, title: 'Volume Down', sub: 'system control' },
  ];
  const cols = 3, cw = 360, ch = 500, gapx = 44, gapy = 60;
  const x0 = 1120, y0 = 300;
  for (let i = 0; i < cards.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x0 + col * (cw + gapx);
    const cy = y0 + row * (ch + gapy);
    const c = cards[i];
    s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="30" fill="${CARD}" stroke="${CARD_BORDER}" stroke-width="1"/>`;
    s += `<rect x="${cx + 24}" y="${cy}" width="${cw - 48}" height="6" rx="3" fill="${ACCENT}"/>`;
    const bsize = 236;
    s += keyCell(cx + (cw - bsize) / 2, cy + 46, bsize, c.img, 26);
    s += txt(c.title, cx + cw / 2, cy + 380, 40, { weight: 800, anchor: 'middle' });
    s += txt(c.sub, cx + cw / 2, cy + 428, 30, { fill: MUTED, weight: 600, anchor: 'middle' });
  }
  return svg(W, H, s);
}

// ============================== BANNER 2 (2400x1600) =========================
// "Nothing pre-set. You choose." — the Property Inspector picker.
function buildBanner2() {
  const W = 2400, H = 1600;
  const gid = nextId();
  let s = bgLayer(W, H);
  s += `<defs>${headlineGradientDef(gid)}</defs>`;

  const lx = 130;
  s += `<circle cx="${lx + 8}" cy="335" r="9" fill="#22d3ee"/>`;
  s += txt('PICK FROM THE LIST', lx + 34, 345, 32, { fill: '#9aa2b4', weight: 700, spacing: 6 });
  s += txt('Nothing pre-set.', lx, 500, 118, { weight: 800 });
  s += txt('You choose.', lx, 630, 118, { weight: 800, fill: `url(#${gid})` });
  s += txt('A fresh button does nothing until you pick.', lx, 770, 42, { fill: '#aeb6c6', weight: 500 });
  s += txt('The dropdown reads every shortcut on your', lx, 828, 42, { fill: '#aeb6c6', weight: 500 });
  s += txt('Mac, alphabetically, always current.', lx, 886, 42, { fill: '#aeb6c6', weight: 500 });

  s += checkItem(lx, 1130, 'No accidental runs by default', 40, '#22d3ee');
  s += checkItem(lx, 1230, 'A–Z, straight from macOS', 40, '#22d3ee');
  s += checkItem(lx, 1330, 'Refresh re-reads list + icons', 40, '#22d3ee');

  const px = 1150, py = 360, pw = 1120, ph = 880;
  s += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="26" fill="#1e1f22" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  s += `<rect x="${px}" y="${py}" width="${pw}" height="70" rx="26" fill="#26272b"/>`;
  s += `<rect x="${px}" y="${py + 40}" width="${pw}" height="30" fill="#26272b"/>`;
  s += `<circle cx="${px + 34}" cy="${py + 35}" r="9" fill="#ff5f57"/><circle cx="${px + 64}" cy="${py + 35}" r="9" fill="#febc2e"/><circle cx="${px + 94}" cy="${py + 35}" r="9" fill="#28c840"/>`;
  s += txt('Apple Shortcuts', px + pw / 2, py + 44, 28, { fill: '#c9cdd6', weight: 600, anchor: 'middle' });

  let fy = py + 140;
  s += txt('Shortcut', px + 60, fy + 6, 30, { fill: '#c9cdd6', weight: 600 });
  const selX = px + 300, selW = pw - 360, selH = 64;
  s += `<rect x="${selX}" y="${fy - 40}" width="${selW}" height="${selH}" rx="10" fill="#18191b" stroke="${ACCENT}" stroke-width="2"/>`;
  s += txt('Start Pomodoro', selX + 24, fy + 3, 28, { fill: '#ffffff', weight: 600 });
  s += `<path d="M ${selX + selW - 44} ${fy - 16} l 14 16 l 14 -16" fill="none" stroke="#8b93a7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

  const dy = fy + 44;
  const rows = [
    { t: '— Select a Shortcut —', sel: false, muted: true },
    { t: 'Meme Maker', sel: false },
    { t: 'Play', sel: false },
    { t: 'Start Pomodoro', sel: true },
    { t: 'Start alarm', sel: false },
    { t: 'Volume Down', sel: false },
  ];
  const rowH = 74;
  s += `<rect x="${selX}" y="${dy}" width="${selW}" height="${rows.length * rowH + 20}" rx="12" fill="#0f1012" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  rows.forEach((r, i) => {
    const ry = dy + 10 + i * rowH;
    if (r.sel) s += `<rect x="${selX + 8}" y="${ry}" width="${selW - 16}" height="${rowH - 8}" rx="8" fill="rgba(138,92,255,0.20)"/>`;
    s += txt(r.t, selX + 28, ry + rowH / 2 + 6, 27, {
      fill: r.sel ? '#f0e9ff' : r.muted ? '#8b93a7' : '#cfd4e0',
      weight: r.sel ? 700 : 500,
    });
    if (r.sel) s += `<path d="M ${selX + selW - 60} ${ry + rowH / 2 - 2} l 12 12 l 22 -24" fill="none" stroke="${ACCENT}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  const by = dy + rows.length * rowH + 50;
  const bw = 260, bh = 62;
  const bx = selX + selW - bw;
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10" fill="none" stroke="#00ffe6" stroke-width="1.5"/>`;
  s += txt('Refresh list', bx + bw / 2, by + bh / 2 + 10, 28, { fill: '#00ffe6', weight: 600, anchor: 'middle' });

  return svg(W, H, s);
}

writeFileSync(path.join(OUT, 'cover.svg'), buildCover());
writeFileSync(path.join(OUT, 'banner1.svg'), buildBanner1());
writeFileSync(path.join(OUT, 'banner2.svg'), buildBanner2());
console.log('wrote cover.svg, banner1.svg, banner2.svg to', OUT);
