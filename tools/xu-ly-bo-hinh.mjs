#!/usr/bin/env node
// Xử lý bộ hình AI nền xanh thành bộ hình cho overlay.
//
// Cách dùng (từ thư mục DamCuoiV1):
//   node tools/xu-ly-bo-hinh.mjs                       # đọc bo-hinh-moi/, ghi app/public/themes/ban-thuc-3d/
//   node tools/xu-ly-bo-hinh.mjs <thư_mục_nguồn> <mã_bộ_hình> "<Tên hiển thị>"
//
// Tên file nguồn (ảnh .png/.jpg/.webp, video .mp4/.mov/.webm):
//   bg_<mã>.jpg              phông 9:16 (vd bg_red_gold.jpg)
//   bg_<tên>.mp4             phông động (vd bg_party.mp4: chế độ tiệc khi cả rạp quẩy, pháo hoa).
//                            Tự gắn vào phông giống khung đầu nhất; đặt bg_<mã phông>_party.mp4 để chỉ định rõ.
//   dongphong_room.jpg       phông phòng tân hôn (tùy chọn)
//   couple_<động tác>        cặp đôi: idle (bắt buộc), kiss, heart, wave, bow, và tùy chọn:
//                            ring (trao nhẫn), cake (cắt bánh), cheers (cụng ly), dance (khiêu vũ),
//                            carry (bế vào động phòng), bouquet (tung hoa), shock hoặc cancel (bị phá đám),
//                            thanks (cảm ơn quà), petal (mưa hoa), fireworks (pháo hoa). couple_ref bị bỏ qua.
//   mc_<động tác>            MC: idle, talk
//   walker_m, walker_f       người đi lên thảm đỏ (mặc định nhân vật hướng mặt sang phải)
//   guest_m<số>, guest_f<số> khách nam, khách nữ
//   guest_m<số>_dance        (video) khách đó nhảy trên sàn nhảy (tùy chọn)
//   guest_m<số>_idle         (video) khách đó đứng cử động nhẹ, lặp lại; thành ảnh động WebP (tùy chọn)
//
// Mỗi nhóm (cặp đôi, MC, từng người đi lên, khách) dùng chung một khung cắt để
// chuyển giữa ảnh và video không bị nhảy vị trí. Chạy lại bất cứ lúc nào khi thêm file.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'bo-hinh-moi'));
const THEME_ID = (process.argv[3] || 'ban-thuc-3d').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'ban-thuc-3d';
const THEME_NAME = process.argv[4] || 'Bán thực 3D';
const OUT = path.join(ROOT, 'app', 'public', 'themes', THEME_ID);

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const VID_EXT = ['.mp4', '.mov', '.webm', '.mkv'];

// Chiều cao xuất ra (px). Ảnh xuất gấp đôi cỡ hiển thị cho nét; video nhỏ hơn cho nhẹ máy.
const GROUPS = {
  couple: { test: n => /^couple_[a-z0-9]+$/.test(n) && n !== 'couple_ref', imgH: 900, vidH: 600 },
  mc: { test: n => /^mc_[a-z0-9]+$/.test(n), imgH: 560, vidH: 400 },
  walker_m: { test: n => n === 'walker_m', imgH: 640, vidH: 440 },
  walker_f: { test: n => n === 'walker_f', imgH: 640, vidH: 440 },
  guest: { test: n => /^guest_[mf]\d+(_(dance|idle))?$/.test(n), imgH: 440, vidH: 440 }
};

// Cỡ hiển thị mặc định trên khung 1080x1920 (chiều cao, px) ở mức 100%.
const DISPLAY = { couple: 430, mc: 270, guest: 360, walker: 380 };

const BG_NAMES = {
  red_gold: 'Đỏ vàng', pink_white: 'Hồng trắng', pink_garden: 'Hồng vườn hoa',
  champagne: 'Champagne', blue_silver: 'Xanh bạc', gold: 'Vàng kim', white: 'Trắng tinh khôi'
};

// Nhãn "AI" của Dreamina nằm ở góc trên trái (tỷ lệ theo khung hình).
const LABEL = { w: 0.085, h: 0.045 };

// Khóa nền theo độ "trội xanh" d = G - max(R, B): d <= t1 giữ nguyên, d >= t2 trong suốt.
// Không phụ thuộc sắc xanh cụ thể nên chịu được nền loang. Ngưỡng tự hạ xuống với file nền xanh
// tối/xỉn (đo riêng từng file ở các mép ảnh), tối đa 16/66 với nền xanh tươi.
const T1_MAX = 16;
const T2_MAX = 66;
const FEATHER = 0.035; // làm mờ dần phần bị cắt sát mép trái/phải (tỷ lệ chiều rộng khung cắt)

const LOOP_FADE = 8; // số khung hình trộn đuôi vào đầu để vòng lặp liền mạch
const FPS = 24;

function sh(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; if (err.length > 400000) err = err.slice(-200000); });
    p.on('close', code => code === 0 ? resolve(err) : reject(new Error(`${cmd} lỗi (${code}): ${err.slice(-1500)}`)));
  });
}

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Không đọc được ${file}: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  return { w: j.streams[0].width, h: j.streams[0].height, dur: Number(j.format?.duration) || 0 };
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const even = n => Math.max(2, Math.round(n / 2) * 2);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const labelMask = 'drawbox=x=0:y=0:w=iw*' + LABEL.w + ':h=ih*' + LABEL.h + ':color=0x00FF00@1:t=fill';
const alphaExpr = k => `clip(255-(g(X,Y)-max(r(X,Y),b(X,Y))-${k.t1})*255/${k.t2 - k.t1},0,255)`;

// Đo độ trội xanh của nền ở mép trên và hai mép bên (phần trên), nơi chỉ có nền.
function estimateKey(file, isVideo) {
  const SW = 90;
  const SH = 160;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `${isVideo ? 'fps=2,' : ''}scale=${SW}:${SH},format=rgb24`,
    '-frames:v', isVideo ? '12' : '1', '-f', 'rawvideo', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  const buf = r.stdout || Buffer.alloc(0);
  const frameBytes = SW * SH * 3;
  const ds = [];
  const at = (f, x, y) => {
    const i = f * frameBytes + (y * SW + x) * 3;
    return buf[i + 1] - Math.max(buf[i], buf[i + 2]);
  };
  for (let f = 0; f < Math.floor(buf.length / frameBytes); f++) {
    for (let x = Math.round(SW * 0.12); x < SW * 0.88; x += 2) {
      for (const y of [3, 5, 7]) ds.push(at(f, x, y));
    }
    for (let y = Math.round(SH * 0.06); y < SH * 0.4; y += 2) {
      for (const x of [1, 3, SW - 4, SW - 2]) ds.push(at(f, x, y));
    }
  }
  const bg = ds.filter(d => d >= 20).sort((a, b) => a - b);
  if (bg.length < 20) return { t1: T1_MAX, t2: T2_MAX, d: null };
  const dLow = bg[Math.floor(bg.length * 0.08)];
  const t2 = clamp(Math.round(dLow * 0.82), 26, T2_MAX);
  const t1 = clamp(Math.round(t2 * 0.3), 6, T1_MAX);
  return { t1, t2, d: dLow };
}

function keyFilter(k, { featherL = false, featherR = false } = {}) {
  let a = alphaExpr(k);
  if (featherL) a = `${a}*min(1,X/(W*${FEATHER}))`;
  if (featherR) a = `${a}*min(1,(W-1-X)/(W*${FEATHER}))`;
  return `format=gbrap,geq=r='r(X,Y)':g='min(g(X,Y),max(r(X,Y),b(X,Y)))':b='b(X,Y)':a='${a}'`;
}

// Khung chứa nhân vật (tỷ lệ 0..1 theo khung gốc), gộp qua mọi khung hình nếu là video.
async function detectBox(file, isVideo, k) {
  const { w, h } = probe(file);
  const W = 360;
  const H = even((W * h) / w);
  const vf = [isVideo ? 'fps=8' : null, `scale=${W}:${H}`, labelMask,
    `format=gbrap,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alphaExpr(k)}'`,
    'alphaextract', 'cropdetect=limit=2:round=2:reset=0:skip=0'].filter(Boolean).join(',');
  const err = await sh('ffmpeg', ['-hide_banner', '-i', file, '-vf', vf, '-f', 'null', '-']);
  const m = [...err.matchAll(/x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+)/g)].pop();
  if (!m) throw new Error(`Không tìm thấy nhân vật trong ${path.basename(file)}`);
  const [x1, x2, y1, y2] = m.slice(1).map(Number);
  return { x1: x1 / W, x2: (x2 + 1) / W, y1: y1 / H, y2: (y2 + 1) / H };
}

function unionBox(boxes) {
  const b = boxes.reduce((u, v) => ({
    x1: Math.min(u.x1, v.x1), x2: Math.max(u.x2, v.x2), y1: Math.min(u.y1, v.y1), y2: Math.max(u.y2, v.y2)
  }));
  const touchL = b.x1 <= 0.004;
  const touchR = b.x2 >= 0.996;
  const x1 = Math.max(0, b.x1 - 0.025);
  const x2 = Math.min(1, b.x2 + 0.025);
  const y1 = Math.max(0, b.y1 - 0.015);
  const y2 = Math.min(1, b.y2 + 0.006);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1, touchL, touchR };
}

const cropExpr = c => `crop=w=iw*${c.w.toFixed(5)}:h=ih*${c.h.toFixed(5)}:x=iw*${c.x.toFixed(5)}:y=ih*${c.y.toFixed(5)}`;

async function makeStill(file, crop, outH, outFile, k) {
  const vf = [labelMask, cropExpr(crop), `scale=-2:${outH}:flags=lanczos`,
    keyFilter(k, { featherL: crop.touchL, featherR: crop.touchR }), 'format=yuva420p'].join(',');
  await sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-vf', vf,
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', outFile]);
}

async function makeVideo(file, crop, outH, outFile, key) {
  const { dur } = probe(file);
  const n = Math.floor(dur * FPS);
  const k = LOOP_FADE;
  const filters = [];
  if (n > 3 * k) {
    // Trộn k khung cuối vào k khung đầu: chỗ nối vòng lặp không còn giật
    filters.push(`[0:v]fps=${FPS},split[a][b]`,
      `[a]trim=start_frame=${k},setpts=PTS-STARTPTS[s1]`,
      `[b]trim=end_frame=${k},setpts=PTS-STARTPTS[s2]`,
      `[s1][s2]xfade=transition=fade:duration=${(k / FPS).toFixed(4)}:offset=${((n - 2 * k) / FPS).toFixed(4)}[lp]`);
  } else {
    filters.push(`[0:v]fps=${FPS}[lp]`);
  }
  filters.push(`[lp]${labelMask},${cropExpr(crop)},scale=-2:${even(outH)}:flags=lanczos,` +
    `${keyFilter(key, { featherL: crop.touchL, featherR: crop.touchR })},format=yuva420p[out]`);
  await sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-filter_complex', filters.join(';'),
    '-map', '[out]', '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32',
    '-deadline', 'good', '-cpu-used', '3', '-row-mt', '1', '-auto-alt-ref', '0', outFile]);
}

// Video khách đứng chờ -> ảnh động WebP trong suốt (nhiều khách dùng chung nhẹ hơn nhiều video cùng lúc)
async function makeAnimWebp(file, crop, outH, outFile, key) {
  const { dur } = probe(file);
  const fps = 12;
  const n = Math.floor(dur * fps);
  const k = 4;
  const filters = [];
  if (n > 3 * k) {
    filters.push(`[0:v]fps=${fps},split[a][b]`,
      `[a]trim=start_frame=${k},setpts=PTS-STARTPTS[s1]`,
      `[b]trim=end_frame=${k},setpts=PTS-STARTPTS[s2]`,
      `[s1][s2]xfade=transition=fade:duration=${(k / fps).toFixed(4)}:offset=${((n - 2 * k) / fps).toFixed(4)}[lp]`);
  } else {
    filters.push(`[0:v]fps=${fps}[lp]`);
  }
  filters.push(`[lp]${labelMask},${cropExpr(crop)},scale=-2:${even(outH)}:flags=lanczos,` +
    `${keyFilter(key, { featherL: crop.touchL, featherR: crop.touchR })},format=yuva420p[out]`);
  await sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-filter_complex', filters.join(';'),
    '-map', '[out]', '-an', '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '62', '-compression_level', '4', '-loop', '0', outFile]);
}

// Độ giống (SSIM) giữa khung đầu của video và một ảnh
function similarity(video, image) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', video, '-i', image, '-lavfi',
    "[0:v]select='eq(n\\,0)',scale=180:320,format=yuv420p[a];[1:v]scale=180:320,format=yuv420p[b];[a][b]ssim",
    '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8' });
  return Number((r.stderr || '').match(/All:([0-9.]+)/)?.[1]) || 0;
}

// Phông động (không xóa nền): che nhãn AI, bỏ tiếng, giữ 720x1280 cho nhẹ (CSS phóng lên 1080x1920)
async function makeBackgroundVideo(file, outFile) {
  const { w, h } = probe(file);
  const lx = Math.max(1, Math.round(w * 0.01));
  const ly = Math.max(1, Math.round(h * 0.006));
  const lw = Math.round(w * 0.075);
  const lh = Math.round(h * 0.035);
  const vf = `fps=${FPS},delogo=x=${lx}:y=${ly}:w=${lw}:h=${lh},scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280,format=yuv420p`;
  await sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-vf', vf, '-an',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-deadline', 'good', '-cpu-used', '3', '-row-mt', '1', outFile]);
}

async function makeBackground(file, outFile, thumbFile) {
  const { w, h } = probe(file);
  // Che nhãn AI ở góc trên trái bằng cách nội suy từ vùng xung quanh.
  const lx = Math.max(1, Math.round(w * 0.01));
  const ly = Math.max(1, Math.round(h * 0.006));
  const lw = Math.round(w * 0.06);
  const lh = Math.round(h * 0.03);
  const base = `delogo=x=${lx}:y=${ly}:w=${lw}:h=${lh},scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920`;
  await sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-vf', base, '-frames:v', '1', '-q:v', '3', outFile]);
  if (thumbFile) {
    await sh('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', outFile, '-vf', 'scale=180:320', '-q:v', '4', thumbFile]);
  }
}

function listSources() {
  if (!fs.existsSync(SRC)) throw new Error(`Không thấy thư mục nguồn ${SRC}`);
  const items = [];
  for (const f of fs.readdirSync(SRC)) {
    const ext = path.extname(f).toLowerCase();
    const name = path.basename(f, path.extname(f)).toLowerCase();
    const kind = IMG_EXT.includes(ext) ? 'img' : VID_EXT.includes(ext) ? 'vid' : null;
    if (!kind) continue;
    items.push({ file: path.join(SRC, f), name, kind });
  }
  return items;
}

async function main() {
  const t0 = Date.now();
  const items = listSources();
  fs.mkdirSync(OUT, { recursive: true });
  const cpu = Math.max(2, Math.min(6, os.cpus().length - 1));
  console.log(`Nguồn: ${SRC}\nĐích:  ${OUT}\n`);

  const manifest = {
    id: THEME_ID,
    name: THEME_NAME,
    version: Date.now(),
    display: DISPLAY,
    // Vị trí trên khung 1080x1920: chân cặp đôi, tâm và chân MC (chỉnh nếu phông có sân khấu cao/thấp hơn)
    layout: { coupleBottom: 1108, mcX: 292, mcBottom: 1102 },
    // Co dãn khách theo hàng ghế: [hàng sau cùng, hàng trước nhất]
    guestScale: [0.66, 0.97],
    backgrounds: [],
    dongphong: null,
    couple: null,
    mc: null,
    walker: null,
    guests: null
  };

  // Phông
  const bgs = items.filter(i => i.kind === 'img' && /^bg_[a-z0-9_]+$/.test(i.name));
  await pool(bgs, cpu, async bg => {
    const id = bg.name.slice(3);
    await makeBackground(bg.file, path.join(OUT, `bg_${id}.jpg`), path.join(OUT, `bg_${id}_thumb.jpg`));
    console.log(`✓ phông ${id}`);
  });
  manifest.backgrounds = bgs.map(bg => bg.name.slice(3)).sort((a, b) => (a === 'red_gold' ? -1 : b === 'red_gold' ? 1 : a.localeCompare(b)))
    .map(id => ({ id, name: BG_NAMES[id] || id.replace(/_/g, ' '), src: `bg_${id}.jpg`, thumb: `bg_${id}_thumb.jpg` }));
  // Phông động: bg_<mã phông>_<hiệu ứng> gắn thẳng; bg_<hiệu ứng> gắn vào phông giống khung đầu nhất
  manifest.effects = {};
  for (const v of items.filter(i => i.kind === 'vid' && /^bg_[a-z0-9_]+$/.test(i.name))) {
    const out = `${v.name}.webm`;
    await makeBackgroundVideo(v.file, path.join(OUT, out));
    let target = manifest.backgrounds.find(b => v.name.startsWith(`bg_${b.id}_`));
    let fx = target ? v.name.slice(`bg_${target.id}_`.length) : v.name.slice(3);
    if (!target) {
      const scores = bgs.map(b => ({ id: b.name.slice(3), s: similarity(v.file, b.file) })).sort((a, b) => b.s - a.s);
      if (scores[0] && scores[0].s > 0.62 && scores[0].s - (scores[1]?.s || 0) > 0.05) target = manifest.backgrounds.find(b => b.id === scores[0].id);
      console.log(`  ${v.name}: giống nhất ${scores.map(x => `${x.id} ${x.s.toFixed(2)}`).join(', ')}`);
    }
    if (target) {
      target.fx = { ...(target.fx || {}), [fx]: out };
      console.log(`✓ phông động ${fx} cho phông ${target.id}`);
    } else {
      manifest.effects[fx] = out;
      console.log(`✓ phông động ${fx} (dùng cho mọi phông)`);
    }
  }

  const dp = items.find(i => i.kind === 'img' && i.name === 'dongphong_room');
  if (dp) {
    await makeBackground(dp.file, path.join(OUT, 'dongphong.jpg'));
    manifest.dongphong = 'dongphong.jpg';
    console.log('✓ phòng tân hôn');
  }

  // Nhân vật theo nhóm
  const groupOut = {};
  for (const [gid, g] of Object.entries(GROUPS)) {
    const members = items.filter(i => g.test(i.name));
    if (!members.length) continue;
    for (const m of members) m.key = estimateKey(m.file, m.kind === 'vid');
    const boxes = await pool(members, cpu, m => detectBox(m.file, m.kind === 'vid', m.key));
    const crop = unionBox(boxes);
    const ref = probe(members.find(m => m.kind === 'img')?.file || members[0].file);
    const aspect = (crop.w * ref.w) / (crop.h * ref.h);
    const assets = {};
    await pool(members, cpu, async m => {
      const entry = assets[m.name] || (assets[m.name] = {});
      if (m.kind === 'img') {
        const out = `${m.name}.webp`;
        await makeStill(m.file, crop, g.imgH, path.join(OUT, out), m.key);
        entry.img = out;
      } else if (gid === 'guest' && m.name.endsWith('_idle')) {
        const out = `${m.name}.webp`;
        await makeAnimWebp(m.file, crop, 400, path.join(OUT, out), m.key);
        entry.anim = out;
      } else if (g.vidH) {
        const out = `${m.name}.webm`;
        await makeVideo(m.file, crop, g.vidH, path.join(OUT, out), m.key);
        entry.video = out;
      }
      const t = m.key.d === null ? 'ngưỡng mặc định' : `nền ${m.key.d}, ngưỡng ${m.key.t1}/${m.key.t2}`;
      console.log(`✓ ${gid}: ${m.name}${m.kind === 'vid' ? ' (video)' : ''} · ${t}`);
    });
    const pct = v => `${Math.round(v * 100)}%`;
    console.log(`  khung cắt ${gid}: x ${pct(crop.x)}–${pct(crop.x + crop.w)}, y ${pct(crop.y)}–${pct(crop.y + crop.h)}`);
    groupOut[gid] = { aspect: Number(aspect.toFixed(4)), assets, crop };
  }

  const pickStates = (gid, prefix) => {
    const g = groupOut[gid];
    if (!g) return null;
    const states = {};
    for (const [name, a] of Object.entries(g.assets)) states[name.slice(prefix.length)] = a;
    return { aspect: g.aspect, states };
  };
  manifest.couple = pickStates('couple', 'couple_');
  manifest.mc = pickStates('mc', 'mc_');
  const walker = {};
  for (const [gid, key] of [['walker_m', 'male'], ['walker_f', 'female']]) {
    const g = groupOut[gid];
    if (g) walker[key] = { aspect: g.aspect, facing: 'right', ...g.assets[gid] };
  }
  manifest.walker = Object.keys(walker).length ? walker : null;
  if (groupOut.guest) {
    const assets = groupOut.guest.assets;
    const names = Object.keys(assets).filter(n => !/_(dance|idle)$/.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const dance = {};
    const idle = {};
    for (const n of names) {
      const v = assets[`${n}_dance`]?.video || assets[n].video;
      if (v && assets[n].img) dance[assets[n].img] = v;
      const a = assets[`${n}_idle`]?.anim;
      if (a && assets[n].img) idle[assets[n].img] = a;
    }
    manifest.guests = {
      aspect: groupOut.guest.aspect,
      male: names.filter(n => n.startsWith('guest_m')).map(n => assets[n].img).filter(Boolean),
      female: names.filter(n => n.startsWith('guest_f')).map(n => assets[n].img).filter(Boolean),
      dance,
      idle
    };
  }

  if (!manifest.couple?.states?.idle) console.warn('⚠ Thiếu couple_idle: overlay sẽ dùng cặp đôi của bộ Cổ điển.');
  fs.writeFileSync(path.join(OUT, 'theme.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nXong sau ${Math.round((Date.now() - t0) / 1000)} giây. Ghi ${path.relative(ROOT, path.join(OUT, 'theme.json'))}`);
}

main().catch(e => {
  console.error('\n✗ ' + e.message);
  process.exit(1);
});
