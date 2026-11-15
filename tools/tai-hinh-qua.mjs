#!/usr/bin/env node
// Tải hình các quà TikTok về app/public/gifts/ để bảng quà trên overlay hiện đúng hình quà
// (hình quà → hành động), và người tặng đi lên cầm đúng hình quà vừa tặng.
//
// Cách dùng (từ thư mục DamCuoiV1):
//   node tools/tai-hinh-qua.mjs                         # quà khu vực VN + quà đang có trong bảng luật
//   node tools/tai-hinh-qua.mjs --khu-vuc=US            # đổi khu vực
//   node tools/tai-hinh-qua.mjs --them="Hand Heart, Cake Slice"   # thêm quà nằm ngoài danh sách khu vực
//   node tools/tai-hinh-qua.mjs --lai                   # tải lại cả những hình đã có
//
// Kết quả: app/public/gifts/<tên-quà>.webp (96x96) và app/public/gifts/gifts.json (tên, giá xu, tên tiếng Việt).
// Overlay tìm hình theo tên quà ghi trong luật (tên tiếng Anh của TikTok hoặc tên tiếng Việt ở VI_NAMES bên dưới).
// Quà mới ra chưa có hình: chạy lại lệnh này.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'app', 'public', 'gifts');
const STATE = path.join(ROOT, 'app', 'wedding_state.json');
const SOURCE = 'https://streamtoearn.io/gifts';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SIZE = 96;

// Tên tiếng Việt hay dùng trong bảng luật → tên quà của TikTok
const VI_NAMES = {
  'Rose': ['hoa hồng'],
  'Finger Heart': ['bắn tim'],
  'Heart Me': ['thả tim'],
  'Perfume': ['nước hoa'],
  'Doughnut': ['bánh vòng', 'bánh donut'],
  'Paper Crane': ['hạc giấy'],
  'Confetti': ['pháo giấy'],
  'Corgi': ['chó corgi'],
  'Sunglasses': ['kính râm'],
  'Hand Heart': ['tay tim', 'hand hearts'],
  'Cake Slice': ['lát bánh kem'],
  'Lucky Pig': ['chú heo may mắn', 'bé heo', 'heo'],
  'Treasure Clover': ['cỏ bốn lá', 'cỏ 4 lá'],
  'Ice Cream Cone': ['kem ốc quế'],
  'Hat and Mustache': ['mũ và ria mép']
};
// Luôn tải thêm (không có trong danh sách khu vực VN nhưng hay được gán nghi thức)
const ALWAYS = ['Hand Heart', 'Cake Slice'];

const args = process.argv.slice(2);
const opt = name => (args.find(a => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=');
const region = (opt('khu-vuc') || 'VN').toUpperCase();
const redo = args.includes('--lai');

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const unescapeHtml = s => s.replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");

async function fetchList(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const html = await r.text();
  const re = /<div class="gift"[^>]*>\s*<img\s+src="([^"]+)"[\s\S]*?<p class="gift-name">([^<]*)<\/p>\s*<p class="gift-price">\s*([\d.,]+)/g;
  const list = [];
  const seen = new Set();
  for (const m of html.matchAll(re)) {
    const name = unescapeHtml(m[2]).replace(/\s+/g, ' ').trim();
    const key = norm(name);
    if (!name || !key || seen.has(key) || !/^https:\/\/[a-z0-9.-]*tiktokcdn[a-z0-9.-]*\//.test(m[1])) continue;
    seen.add(key);
    list.push({ name, key, url: m[1], coins: Number(m[3].replace(/[.,]/g, '')) || 0 });
  }
  return list;
}

// Cùng cách so tên với overlay: trùng hẳn, khác số ít/số nhiều, hoặc là một cụm từ trọn vẹn trong tên quà
function findGift(list, token) {
  const t = norm(token);
  if (!t) return null;
  const single = s => s.replace(/s$/, '');
  return list.find(g => g.key === t)
    || list.find(g => single(g.key) === single(t))
    || (t.length >= 3 ? list.find(g => ` ${g.key} `.includes(` ${t} `)) : null)
    || null;
}

function ruleTokens() {
  try {
    const rules = JSON.parse(fs.readFileSync(STATE, 'utf8')).config?.giftRules || [];
    return rules.flatMap(r => String(r.gifts || '').split(',').map(t => t.trim()).filter(t => t && !t.startsWith('#')));
  } catch {
    return [];
  }
}

async function download(g, file) {
  const base = g.url.replace(/~tplv-[^/]*$/, '');
  for (const url of [`${base}~tplv-resize:${SIZE}:${SIZE}.webp`, g.url]) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!r.ok || !String(r.headers.get('content-type') || '').startsWith('image/')) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 200) continue;
      fs.writeFileSync(file, buf);
      return true;
    } catch {}
  }
  return false;
}

console.log(`Lấy danh sách quà khu vực ${region}...`);
const regional = await fetchList(`${SOURCE}?region=${region}`);
if (!regional.length) throw new Error('Không đọc được danh sách quà (trang nguồn có thể đã đổi cấu trúc).');
const gifts = [...regional];

// Quà có trong bảng luật / danh sách thêm mà khu vực này không có: tìm trong danh sách chung
const wanted = [...ALWAYS, ...ruleTokens(), ...opt('them').split(',').map(s => s.trim()).filter(Boolean)];
const viOf = Object.fromEntries(Object.entries(VI_NAMES).map(([en, vi]) => [norm(en), vi]));
const viToEn = new Map(Object.entries(VI_NAMES).flatMap(([en, vi]) => vi.map(v => [norm(v), en])));
const missing = wanted.map(t => viToEn.get(norm(t)) || t).filter(t => !findGift(gifts, t));
if (missing.length) {
  const all = await fetchList(SOURCE);
  for (const t of missing) {
    const g = findGift(all, t);
    if (g && !gifts.some(x => x.key === g.key)) gifts.push(g);
  }
}

fs.mkdirSync(OUT, { recursive: true });
const used = new Set();
for (const g of gifts) {
  let slug = norm(g.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) slug = 'qua-' + createHash('sha1').update(g.url).digest('hex').slice(0, 10);
  let file = slug;
  for (let i = 2; used.has(file); i++) file = `${slug}-${i}`;
  used.add(file);
  g.file = `${file}.webp`;
}

let ok = 0;
let failed = 0;
let next = 0;
async function worker() {
  while (next < gifts.length) {
    const g = gifts[next++];
    const file = path.join(OUT, g.file);
    if (!redo && fs.existsSync(file) && fs.statSync(file).size > 200) { ok++; continue; }
    if (await download(g, file)) ok++;
    else { failed++; g.failed = true; }
    if ((ok + failed) % 100 === 0) console.log(`  ${ok + failed}/${gifts.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const catalog = gifts.filter(g => !g.failed).sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name))
  .map(g => ({ name: g.name, file: g.file, coins: g.coins, ...(viOf[g.key] ? { vi: viOf[g.key] } : {}) }));
fs.writeFileSync(path.join(OUT, 'gifts.json'), JSON.stringify({ version: Date.now(), region, source: SOURCE, size: SIZE, gifts: catalog }, null, 1));

console.log(`Xong: ${ok} hình quà trong app/public/gifts/${failed ? `, ${failed} hình tải lỗi (chạy lại để thử tiếp)` : ''}.`);
const noIcon = [...new Set(ruleTokens().filter(t => !findGift(gifts, viToEn.get(norm(t)) || t)).map(t => t.toLowerCase()))];
if (noIcon.length) console.log(`Tên trong bảng luật chưa khớp hình nào (không sao nếu luật còn tên khác khớp): ${noIcon.join(', ')}`);
