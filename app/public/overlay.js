const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Khung xem trước trong bảng điều khiển (?preview=1): tắt toàn bộ âm thanh để không bị đọc 2 lần
const IS_PREVIEW = new URLSearchParams(location.search).has('preview');

// ========================================================
// REALTIME (SSE) - tự kết nối lại, không nhân đôi sự kiện
// ========================================================
class WeddingRealtime {
  constructor() {
    this.listeners = [];
    this.retryTimer = null;
    this.connect();
  }
  connect() {
    if (this.es) this.es.close();
    this.es = new EventSource(`/api/events?client=${IS_PREVIEW ? 'preview' : 'overlay'}`);
    for (const [ev, fn] of this.listeners) this.es.addEventListener(ev, fn);
    this.es.onerror = () => {
      // Trình duyệt tự thử lại khi CONNECTING; chỉ tự tạo lại khi đã CLOSED
      if (this.es.readyState === EventSource.CLOSED) {
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.connect(), 3000);
      }
    };
  }
  addEventListener(ev, fn) {
    this.listeners.push([ev, fn]);
    this.es.addEventListener(ev, fn);
  }
}

// ========================================================
// CO GIÃN KHUNG 1080x1920
// ========================================================
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  const frame = $('#frame');
  if (frame) {
    frame.style.transform = `scale(${s})`;
    frame.style.left = `${(innerWidth - 1080 * s) / 2}px`;
    frame.style.top = `${(innerHeight - 1920 * s) / 2}px`;
  }
}
window.addEventListener('resize', fit);
window.addEventListener('load', fit);
try { new ResizeObserver(fit).observe(document.documentElement); } catch (e) {}
fit();

// ========================================================
// TIỆN ÍCH
// ========================================================
let currentState = null;
const cfg = () => currentState?.config || {};
const soundOn = () => !IS_PREVIEW && cfg().soundEffects !== false;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 10000) return Math.round(n / 1000) + 'K';
  return n.toLocaleString('vi-VN');
}

function money(n) {
  return cfg().moneyUnit === 'chỉ vàng' ? `${fmt(n)} chỉ` : `${fmt(n)} xu`;
}

function hashHue(str) {
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function initial(name) {
  const ch = [...String(name || '').trim()].find(c => /[\p{L}\p{N}]/u.test(c));
  return (ch || '?').toUpperCase();
}

// Avatar TikTok tròn; không có ảnh (hoặc ảnh lỗi) thì hiện chữ cái đầu
function makeAvatar(url, name) {
  const el = document.createElement('span');
  el.className = 'av';
  el.style.setProperty('--hue', hashHue(name));
  const b = document.createElement('b');
  b.textContent = initial(name);
  el.append(b);
  if (url && /^(https?:|data:image\/)/.test(url)) {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.decoding = 'async';
    img.onload = () => el.classList.add('has-img');
    img.onerror = () => img.remove();
    img.src = url;
    el.append(img);
  }
  return el;
}

function updateAvatar(holder, url, name) {
  if (!holder) return;
  const key = `${url || ''}|${name || ''}`;
  if (holder.dataset.avKey === key) return;
  holder.dataset.avKey = key;
  holder.replaceChildren(makeAvatar(url, name));
}

// Vai đang mở cho khách giành mà chưa có ai nhận
function roleSearching(role, s = currentState) {
  const c = s?.config || {};
  return c.enableMarryAuction !== false && openRolesOf(c).includes(role) && !s?.roles?.[role];
}
const SEEK_TEXT = { groom: 'Đang tìm chú rể…', bride: 'Đang tìm cô dâu…' };

// Khung tên dưới sân khấu: chưa ai nhận vai thì ẩn; thiếu một vai thì ghi "Đang tìm…";
// vừa thành hôn (tiệc mừng) thì vẫn ghi tên cặp vừa cưới
// Khung tên nằm trong sân khấu thì bị khách hàng ghế đầu đè lên -> đưa ra lớp riêng của khung cảnh
// (trên hàng ghế đầu) và đặt ngay dưới chân cặp đôi
function placeCoupleLabel() {
  const label = $('#couple-label');
  const spr = $('#couple-sprite');
  const sceneEl = $('#scene');
  if (!label || !spr || !sceneEl) return;
  if (label.parentElement !== sceneEl) {
    sceneEl.append(label);
    placeCouple(); // sân khấu bớt chiều cao: đặt lại để chân cặp đôi vẫn đúng chỗ
  }
  const sc = sceneEl.getBoundingClientRect();
  const k = sc.width / 1080 || 1;
  const r = spr.getBoundingClientRect();
  if (!r.width) return;
  label.style.left = `${Math.round((r.left + r.width / 2 - sc.left) / k)}px`;
  label.style.top = `${Math.round((r.bottom - sc.top) / k - 10)}px`;
}
// Bảng tên sau lưng sân khấu: tên đôi đang cưới (hoặc vừa cưới) + ngày hôm nay; sân khấu trống thì ẩn
function renderNamePlaque(s) {
  const plaque = $('#name-plaque');
  if (!plaque) return;
  const wed = marriageStage(s) === 'married' ? s.marriages?.[0] : null;
  const g = wed ? wed.groom : s.roles?.groom?.name || '';
  const b = wed ? wed.bride : s.roles?.bride?.name || '';
  plaque.classList.toggle('empty', !g && !b);
  $('#np-groom').textContent = g || '…';
  $('#np-bride').textContent = b || '…';
  const len = Math.max(g.length, b.length);
  plaque.dataset.size = len > 15 ? 'xs' : len > 11 ? 's' : len > 7 ? 'm' : '';
  const d = new Date();
  $('#np-date').textContent = `${d.getDate()} · ${d.getMonth() + 1} · ${d.getFullYear()}`;
}
function renderCoupleLabel(s) {
  renderNamePlaque(s);
  const label = $('#couple-label');
  if (!label) return;
  requestAnimationFrame(placeCoupleLabel);
  const wed = marriageStage(s) === 'married' ? s.marriages?.[0] : null;
  const seek = { groom: !wed && roleSearching('groom', s), bride: !wed && roleSearching('bride', s) };
  label.classList.toggle('empty', seek.groom && seek.bride);
  for (const r of ['groom', 'bride']) {
    const name = wed ? wed[r] : seek[r] ? SEEK_TEXT[r] : roleName(r);
    $(`#${r}-name`).textContent = name;
    $(`#${r}-name`).classList.toggle('seeking', seek[r]);
    $(`#${r}-av`).hidden = seek[r];
    if (!seek[r]) updateAvatar($(`#${r}-av`), wed ? '' : s.roles?.[r]?.avatar || '', name);
  }
}

function openRolesOf(c) {
  return c.roleMode === 'groom' ? ['groom'] : c.roleMode === 'bride' ? ['bride'] : ['groom', 'bride'];
}
function roleName(role) {
  return currentState?.roles?.[role]?.name || cfg()[role] || (role === 'groom' ? 'Chú rể' : 'Cô dâu');
}

// ========================================================
// HIỆU ỨNG ÂM THANH (tự tổng hợp, không bản quyền)
// ========================================================
let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) audioCtx = new Context();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
window.addEventListener('pointerdown', getAudio, { passive: true });
window.addEventListener('keydown', getAudio);

function tone(ctx, { freq, type = 'sine', at = 0, dur = 0.6, gain = 0.15, to }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBurst(ctx, { at = 0, dur = 0.08, gain = 0.3, hp = 2000 }) {
  const t = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

function playClink() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  [2100, 3200, 4400].forEach((freq, i) => tone(ctx, { freq, dur: 0.8 + i * 0.2, gain: 0.18 / (i + 1) }));
}

function playWeddingBell() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, { freq, type: 'triangle', at: i * 0.08, dur: 2.5, gain: 0.13 }));
}

function playFanfare() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  [440, 554, 659, 880, 1108].forEach((freq, i) => tone(ctx, { freq, type: 'square', at: i * 0.1, dur: 0.7, gain: 0.09 }));
}

function playPop() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  noiseBurst(ctx, { dur: 0.12, gain: 0.45, hp: 900 });
  tone(ctx, { freq: 900, to: 300, dur: 0.15, gain: 0.12 });
}

function playDoor() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  tone(ctx, { freq: 110, to: 55, dur: 0.35, gain: 0.35 });
  noiseBurst(ctx, { dur: 0.06, gain: 0.25, hp: 400 });
}

function playChime() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  [1318.5, 1568, 2093, 2637].forEach((freq, i) => tone(ctx, { freq, type: 'sine', at: i * 0.07, dur: 1.2, gain: 0.08 }));
}

// Nhạc beat sàn nhảy tự tạo (124 BPM) - không dính bản quyền
function playDanceBeat(seconds = 8) {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  const eighth = 60 / 124 / 2;
  const t0 = ctx.currentTime + 0.05;
  const steps = Math.floor(seconds / eighth);
  const bass = [55, 55, 65.41, 73.42];
  const arp = [440, 523.25, 659.25, 783.99, 659.25, 523.25];
  const hatBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const hd = hatBuf.getChannelData(0);
  for (let i = 0; i < hd.length; i++) hd[i] = Math.random() * 2 - 1;

  for (let i = 0; i < steps; i++) {
    const t = t0 + i * eighth;
    if (i % 2 === 0) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.22);
    } else {
      const s = ctx.createBufferSource(); s.buffer = hatBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      s.connect(hp).connect(g).connect(master); s.start(t);

      const bo = ctx.createOscillator(); bo.type = 'sawtooth';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      const bg = ctx.createGain();
      bo.frequency.value = bass[Math.floor(i / 8) % 4] * 2;
      bg.gain.setValueAtTime(0.22, t); bg.gain.exponentialRampToValueAtTime(0.001, t + eighth * 0.9);
      bo.connect(lp).connect(bg).connect(master); bo.start(t); bo.stop(t + eighth);
    }
    if (i % 4 === 2 || i % 8 === 7) {
      const ao = ctx.createOscillator(); ao.type = 'triangle';
      const ag = ctx.createGain();
      ao.frequency.value = arp[(i >> 1) % arp.length];
      ag.gain.setValueAtTime(0.09, t); ag.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      ao.connect(ag).connect(master); ao.start(t); ao.stop(t + 0.27);
    }
  }
}

// ========================================================
// NHẠC NỀN: FILE TRÊN MÁY (mặc định) hoặc YOUTUBE
// ========================================================
const bgmAudio = new Audio();
bgmAudio.loop = false;   // hết bài thì hỏi server bài kế tiếp (xem bgmTrackEnded); chỉ lặp tại chỗ khi cài "lặp một bài"
bgmAudio.preload = 'auto';
const duckReasons = new Map();
let ytPlayer = null;
let ytReady = false;
let ytLoading = false;

function duckFactor() {
  let f = 1;
  for (const v of duckReasons.values()) f = Math.min(f, v);
  return f;
}
function setDuck(reason, factor) {
  if (factor == null) duckReasons.delete(reason); else duckReasons.set(reason, factor);
  applyBgmVolume();
}
function bgmBaseVolume() {
  const v = Number(cfg().bgm?.volume);
  return Math.max(0, Math.min(1, (Number.isFinite(v) ? v : 50) / 100));
}
function applyBgmVolume() {
  const v = bgmBaseVolume() * duckFactor();
  bgmAudio.volume = v;
  if (ytReady) { try { ytPlayer.setVolume(Math.round(v * 100)); } catch (e) {} }
}

function prettyFile(f) {
  return String(f || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ');
}

function ensureYouTube(videoId) {
  if (ytPlayer || ytLoading) return;
  ytLoading = true;
  window.onYouTubeIframeAPIReady = () => {
    const slot = $('#yt-player-slot');
    const holder = document.createElement('div');
    holder.id = 'yt-bgm-iframe';
    slot.append(holder);
    ytPlayer = new YT.Player('yt-bgm-iframe', {
      height: '100', width: '100', videoId,
      playerVars: { autoplay: 1, loop: 1, playlist: videoId, controls: 0, disablekb: 1, modestbranding: 1 },
      events: {
        onReady: () => { ytReady = true; applyBgm(); },
        onError: err => console.warn('YouTube BGM error', err?.data)
      }
    });
  };
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.append(s);
}

function applyBgm() {
  const b = cfg().bgm || {};
  const wantPlay = !IS_PREVIEW && b.enabled !== false && b.playing !== false;
  const hasFile = b.source === 'file' && b.file;
  const hasYt = b.source === 'youtube' && b.youtubeId;

  const badge = $('#bgm-badge');
  if (badge) {
    // Khung "Nhạc nền cưới" mặc định ẩn (đỡ rối góc trên); muốn hiện lại thì đặt bgm.showBadge = true trong cấu hình
    badge.hidden = b.showBadge !== true || !(hasFile || hasYt) || b.playing === false || b.enabled === false;
    $('#frame')?.classList.toggle('no-bgm-badge', badge.hidden); // không có khung nhạc: bảng bên trái dời lên lấp chỗ trống
    $('#bgm-title-text').textContent = b.title || (hasFile ? prettyFile(b.file) : 'Nhạc YouTube');
  }

  if (hasFile && wantPlay) {
    const src = '/music/' + encodeURIComponent(b.file);
    if (!bgmAudio.src || !bgmAudio.src.endsWith(src)) bgmAudio.src = src;
    bgmAudio.loop = b.rotate === 'off';
    applyBgmVolume();
    if (bgmAudio.paused) bgmAudio.play().catch(() => {});
  } else if (!bgmAudio.paused) {
    bgmAudio.pause();
  }

  if (hasYt && wantPlay) {
    ensureYouTube(b.youtubeId);
    if (ytReady) {
      try {
        if (!(ytPlayer.getVideoUrl?.() || '').includes(b.youtubeId)) ytPlayer.loadVideoById({ videoId: b.youtubeId });
        applyBgmVolume();
        ytPlayer.playVideo();
      } catch (e) {}
    }
  } else if (ytReady) {
    try { ytPlayer.pauseVideo(); } catch (e) {}
  }
}

// Hết bài (hoặc file hỏng/không còn): báo server để đổi sang bài khác. Server phát lại sự kiện 'bgm' cho mọi overlay;
// nếu không đổi (chỉ có một bài, mất kết nối...) thì phát lại chính bài đó để rạp không bị im.
let bgmEndedAt = 0;
async function bgmTrackEnded(broken) {
  const b = cfg().bgm || {};
  if (IS_PREVIEW || b.source !== 'file' || !b.file) return;
  if (Date.now() - bgmEndedAt < 4000) return;   // file hỏng liên tiếp thì không gọi dồn dập
  bgmEndedAt = Date.now();
  let changed = false;
  try {
    const r = await fetch('/api/bgm/ended', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: b.file }) });
    const d = await r.json();
    changed = Boolean(d.changed);
    if (d.bgm && currentState) currentState.config.bgm = d.bgm;
  } catch (e) {}
  if (changed) {
    const disc = $('.music-disc');
    disc?.classList.add('fast');
    setTimeout(() => disc?.classList.remove('fast'), 3000);
  } else if (!broken) {
    bgmAudio.currentTime = 0;
  }
  if (changed || !broken) applyBgm();
}
bgmAudio.addEventListener('ended', () => bgmTrackEnded(false));
bgmAudio.addEventListener('error', () => { if (bgmAudio.src) bgmTrackEnded(true); });

// Trình duyệt thường chặn tự phát nhạc tới khi có thao tác; OBS thì không chặn
window.addEventListener('pointerdown', () => applyBgm(), { once: true, passive: true });

// ========================================================
// GIỌNG MC: giọng tiếng Việt của máy, nếu không có thì giọng Google qua server
// ========================================================
// ----- TÊN QUÀ TIẾNG ANH -> TIẾNG VIỆT KHI MC ĐỌC -----
// TikTok / TikFinity hay gửi tên quà tiếng Anh ("Rose", "Finger Heart"...): MC đọc bằng tên tiếng Việt cho tự nhiên.
// Ưu tiên tên trong bảng luật quà (vd luật "bắn tim, finger heart" -> đọc "Finger Heart" là "Bắn Tim"), rồi tới từ điển dưới.
const GIFT_VI = {
  // Chỉ những tên quà TikTok đặc trưng; bỏ các từ ngắn dễ trùng tên người xem (Sun, Star, Cherry, Diamond...)
  'rose': 'Hoa Hồng', 'gg': 'Gờ Gờ', 'heart me': 'Thả Tim', 'hand hearts': 'Tay Tim', 'hand heart': 'Tay Tim',
  'finger heart': 'Bắn Tim', 'love you': 'Yêu Bạn', 'i love you': 'Yêu Bạn', 'perfume': 'Nước Hoa', 'doughnut': 'Bánh Vòng',
  'donut': 'Bánh Vòng', 'sunglasses': 'Kính Râm', 'paper crane': 'Hạc Giấy', 'confetti': 'Pháo Giấy', 'corgi': 'Chó Cọc Gi',
  'cake slice': 'Lát Bánh Kem', 'ice cream cone': 'Kem Ốc Quế', 'lucky pig': 'Chú Heo May Mắn', 'four leaf clover': 'Cỏ Bốn Lá',
  'clover': 'Cỏ Bốn Lá', 'thumbs up': 'Ngón Cái Like', 'hat and mustache': 'Mũ Và Ria', 'sports car': 'Xe Thể Thao',
  'private jet': 'Máy Bay Riêng', 'yacht': 'Du Thuyền', 'diamond ring': 'Nhẫn Kim Cương', 'blow a kiss': 'Gửi Nụ Hôn',
  'teddy bear': 'Gấu Bông', 'gift box': 'Hộp Quà', 'money gun': 'Súng Bắn Tiền', 'fireworks': 'Pháo Hoa',
  'champagne': 'Sâm Panh', 'glow stick': 'Que Phát Sáng', 'love letter': 'Thư Tình', 'wishing bottle': 'Chai Ước Nguyện',
  'gold mine': 'Mỏ Vàng', 'golden gamepad': 'Tay Cầm Vàng', 'birthday cake': 'Bánh Sinh Nhật', 'ice cream': 'Kem',
  'microphone': 'Micro', 'team bracelet': 'Vòng Tay Đồng Đội', 'tiktok universe': 'Vũ Trụ Tóp Tóp', 'interstellar': 'Liên Hành Tinh',
  'love bang': 'Bùm Tình Yêu', 'heart puppy': 'Cún Trái Tim', 'cupid': 'Thần Tình Yêu', 'swan': 'Thiên Nga', 'lion': 'Sư Tử'
};
let giftViCache = { key: '', list: [] };
function giftViList() {
  const rules = cfg().giftRules || [];
  const key = JSON.stringify(rules.map(r => r.gifts));
  if (key === giftViCache.key) return giftViCache.list;
  const map = new Map(Object.entries(GIFT_VI));
  for (const r of rules) {
    const names = String(r.gifts || '').split(',').map(t => t.trim()).filter(t => t && !t.startsWith('#'));
    const vi = names.find(t => /[^\x00-\x7f]/.test(t)); // tên có dấu tiếng Việt
    if (!vi) continue;
    const pretty = vi.replace(/(^|\s)(\p{L})/gu, (m, a, ch) => a + ch.toUpperCase());
    for (const t of names) if (!/[^\x00-\x7f]/.test(t)) map.set(t.toLowerCase(), pretty);
  }
  // Tên dài trước ("diamond ring" trước "ring"), khớp nguyên cụm, không khớp giữa một từ khác
  const list = [...map].sort((x, y) => y[0].length - x[0].length)
    .map(([en, vi]) => [new RegExp(`(?<![\\p{L}\\d])${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![\\p{L}\\d])`, 'giu'), vi]);
  giftViCache = { key, list };
  return list;
}
function giftNamesToVi(text) {
  let out = String(text || '');
  if (!/[a-z]/i.test(out)) return out;
  for (const [re, vi] of giftViList()) out = out.replace(re, vi);
  return out;
}

function cleanForSpeech(text) {
  return giftNamesToVi(String(text || ''))
    .replace(/\p{Extended_Pictographic}|‍|️/gu, '')
    .replace(/[★☆♥♡❤✿❀•●◆◇■□▪▫※]+/g, ' ')
    .replace(/(\d)\s*–\s*(?=\d)/g, '$1 ')   // tỉ số "2 – 1" đọc là "hai một"
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSpeech(text, max = 180) {
  const parts = [];
  let rest = String(text || '').replace(/\s+/g, ' ').trim();
  while (rest.length > max) {
    let cut = Math.max(...['. ', '! ', '? ', ', '].map(p => rest.lastIndexOf(p, max)));
    if (cut < 40) cut = rest.lastIndexOf(' ', max);
    if (cut < 1) cut = max;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

const ttsQueue = [];
let ttsPlaying = false;
// Chrome không cho trang tự phát tiếng khi chưa được bấm vào (OBS thì cho): hiện nút để bấm một lần
function showSoundUnlock() {
  if (IS_PREVIEW || $('#sound-unlock')) return;
  const btn = document.createElement('button');
  btn.id = 'sound-unlock';
  btn.type = 'button';
  btn.textContent = '🔊 Bấm vào đây để bật giọng MC và âm thanh';
  btn.addEventListener('click', () => {
    btn.remove();
    getAudio();
    playTtsQueue();
  });
  document.body.append(btn);
}

// Lấy tiếng của một câu từ server (giọng Google hoặc giọng nam trên máy). Gọi ngay lúc xếp hàng để câu sau
// được tạo sẵn trong lúc câu trước đang phát, MC không bị ngắt quãng giữa các câu.
function fetchSpeech(text) {
  return fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    .then(async res => (res.ok ? { url: URL.createObjectURL(await res.blob()), voice: res.headers.get('X-Voice') || '' } : null))
    .catch(() => null);
}
function dropSpeech(items) {
  for (const it of items) it.audio?.then(got => got && URL.revokeObjectURL(got.url));
}

async function playTtsQueue() {
  if (ttsPlaying) return;
  ttsPlaying = true;
  setDuck('voice', 0.35);
  while (ttsQueue.length) {
    const item = ttsQueue.shift();
    const { rate, volume } = item;
    try {
      const got = await item.audio;
      if (!got) continue;
      const { url } = got;
      const audio = new Audio(url);
      // Giọng nam trên máy đọc tốc độ tự nhiên: không tua nhanh như giọng Google
      audio.playbackRate = got.voice === 'vieneu' ? Math.min(rate, 1.25) : rate;
      audio.volume = volume;
      const blocked = await new Promise(resolve => {
        const done = (b = false) => { clearTimeout(guard); resolve(b); };
        const guard = setTimeout(done, 20000);
        audio.onended = audio.onerror = () => done();
        audio.play().catch(e => done(e?.name === 'NotAllowedError'));
      });
      if (blocked) {
        // Trình duyệt chặn tự phát tiếng (chưa bấm vào trang lần nào): giữ câu lại, hiện nút bật tiếng
        ttsQueue.unshift(item);
        showSoundUnlock();
        break;
      }
      URL.revokeObjectURL(url);
    } catch (e) {}
  }
  ttsPlaying = false;
  setDuck('voice', null);
}

// Giọng tiếng Việt có trên máy đang chạy màn hình LIVE (vd: Edge trên Windows có HoaiMy/NamMinh tự nhiên)
function viVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
}

// Giọng có sẵn của Linux (espeak qua speech-dispatcher, tên kiểu "Vietnamese+David") đọc như robot:
// bỏ qua, dùng giọng Google qua server. Chọn đích danh trong bảng điều khiển thì vẫn dùng.
const ROBOT_VOICE = /espeak|mbrola|festival|pico|flite|\+/i;
const LINUX_DESKTOP = /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
function chosenBrowserVoice() {
  const list = viVoices();
  if (!list.length) return null;
  const want = cfg().browserVoice;
  return (want && list.find(v => v.name === want))
    || list.find(v => /natural|online/i.test(v.name) && /hoaimy/i.test(v.name))
    || list.find(v => /natural|online/i.test(v.name))
    || list.find(v => !ROBOT_VOICE.test(v.name) && !(LINUX_DESKTOP && v.localService))
    || null;
}

// Báo danh sách giọng về server để bảng điều khiển cho chọn
function reportVoices() {
  if (IS_PREVIEW) return;
  const voices = viVoices().map(v => ({ name: v.name, lang: v.lang, local: v.localService }));
  fetch('/api/voices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voices, agent: navigator.userAgent })
  }).catch(() => {});
}
if ('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged', reportVoices);
setTimeout(reportVoices, 1500);

// Phụ đề lời MC
let captionTimer = null;
let mcTalkTimer = null;
function mcTalk(ms) {
  const host = $('#mc-host');
  if (!host) return;
  host.classList.add('talking');
  mcActor.play('talk', ms);
  clearTimeout(mcTalkTimer);
  mcTalkTimer = setTimeout(() => host.classList.remove('talking'), ms);
}

function showCaption(text) {
  mcTalk(Math.min(14000, Math.max(3000, String(text).length * 70)));
  if (cfg().mcCaption === false) return;
  const box = $('#mc-caption');
  if (!box) return;
  $('#mc-caption-text').textContent = text;
  box.dataset.size = text.length > 150 ? 'l' : text.length > 80 ? 'm' : 's'; // câu ngắn chữ to nhất
  box.hidden = false;
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => box.classList.remove('show'), Math.min(14000, Math.max(4000, text.length * 75)));
}

function speak(text, { priority = false, caption = true } = {}) {
  const c = cfg();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  if (caption) showCaption(String(text).trim());
  if (IS_PREVIEW || c.speech === false) return;
  const engine = c.voiceEngine || (c.speechMode === 'server' ? 'google' : 'auto');
  const bv = engine === 'google' || engine === 'vieneu' ? null : chosenBrowserVoice(); // hai nguồn này lấy tiếng qua server
  if (!bv) {
    // Giọng Google qua server (máy không có giọng tiếng Việt, hoặc chọn Google)
    if (priority) dropSpeech(ttsQueue.splice(0));
    if (ttsQueue.length > 6) dropSpeech(ttsQueue.splice(0, ttsQueue.length - 6));
    const rate = Math.min(2, Math.max(0.5, Number(c.voiceRate) || 1.08));
    const volume = Math.min(1, Math.max(0, Number(c.volume ?? 0.95)));
    splitSpeech(clean).forEach(t => ttsQueue.push({ text: t, rate, volume, audio: fetchSpeech(t) }));
    playTtsQueue();
    return;
  }
  try {
    if (priority) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = bv;
    u.lang = bv.lang;
    u.rate = Number(c.voiceRate) || 1.08;
    u.pitch = Number(c.voicePitch) || 1;
    u.volume = Math.min(1, Math.max(0, Number(c.volume ?? 0.95)));
    u.onstart = () => setDuck('voice', 0.35);
    u.onend = u.onerror = () => { if (!speechSynthesis.speaking) setDuck('voice', null); };
    speechSynthesis.speak(u);
  } catch (e) {}
}

// ========================================================
// BỘ HÌNH: phông, cặp đôi, MC, khách, người đi lên (ảnh + video nền trong suốt)
// Mỗi bộ ở /themes/<mã>/theme.json (tạo bằng tools/xu-ly-bo-hinh.mjs)
// ========================================================
const LEGACY_THEME = {
  id: 'co-dien',
  legacy: true,
  version: 1,
  display: { couple: 280, mc: 155, guest: 175, walker: 185 },
  backgrounds: [{ id: 'hoi-truong', src: '/assets/wedding_stage_bg.jpg' }],
  couple: { aspect: 0.9492, states: { idle: { img: '/assets/couple_standing.png' }, kiss: { img: '/assets/couple_kissing.png' } } },
  mc: { aspect: 0.8929, states: { idle: { img: '/assets/guest_1.png' } } },
  guests: {
    aspect: 0.8929,
    male: ['/assets/guest_1.png', '/assets/guest_2.png', '/assets/guest_3.png'],
    female: ['/assets/guest_4.png', '/assets/guest_5.png', '/assets/guest_6.png']
  },
  walker: null
};
const theme = { id: 'co-dien', data: LEGACY_THEME, key: '', bgSrc: '/assets/wedding_stage_bg.jpg' };

function themeAsset(f) {
  if (!f) return '';
  return f.startsWith('/') ? f : `/themes/${theme.id}/${f}?v=${theme.data.version || 1}`;
}
const sizePct = v => Math.min(160, Math.max(50, Number(v) || 100)) / 100;

// Một nhân vật trên sân khấu gồm nhiều lớp (mỗi động tác một ảnh hoặc video), chuyển bằng mờ dần
class StageActor {
  constructor(host) {
    this.host = host;
    this.layers = {};
    this.state = '';
    this.timer = null;
    this.sig = '';
    this.hasVideo = false;
  }
  configure(def, { video }) {
    const states = def?.states || {};
    const sig = JSON.stringify([theme.id, theme.data.version, states, video]);
    if (!this.host || sig === this.sig) return;
    this.sig = sig;
    clearTimeout(this.timer);
    this.host.replaceChildren();
    this.layers = {};
    this.hasVideo = false;
    for (const [name, s] of Object.entries(states)) {
      let el;
      if (video && s?.video) {
        el = document.createElement('video');
        el.muted = true;
        el.defaultMuted = true;
        el.playsInline = true;
        el.loop = true;
        el.preload = 'auto';
        el.setAttribute('muted', '');
        el.setAttribute('playsinline', '');
        if (s.img) el.poster = themeAsset(s.img);
        el.src = themeAsset(s.video);
        this.hasVideo = true;
      } else if (s?.img) {
        el = new Image();
        el.decoding = 'async';
        el.alt = '';
        el.src = themeAsset(s.img);
      } else continue;
      el.className = 'actor-layer';
      el.dataset.state = name;
      this.host.append(el);
      this.layers[name] = el;
    }
    this.state = '';
    this.show('idle');
  }
  // Nhiều phiên bản cùng động tác: kiss, kiss2, kiss3... -> mỗi lần chọn ngẫu nhiên một bản
  variants(name) {
    return Object.keys(this.layers).filter(k => k === name || (k.startsWith(name) && /^\d+$/.test(k.slice(name.length))));
  }
  has(name) { return this.variants(name).length > 0; }
  show(name) {
    if (!this.layers[name]) name = 'idle';
    const next = this.layers[name];
    if (!next) return;
    const changed = name !== this.state;
    for (const el of Object.values(this.layers)) {
      const on = el === next;
      el.classList.toggle('on', on);
      if (el.tagName !== 'VIDEO') continue;
      if (on) {
        if (changed) { try { el.currentTime = 0; } catch (e) {} }
        el.play().catch(() => {});
      } else {
        setTimeout(() => { if (!el.classList.contains('on')) el.pause(); }, 400);
      }
    }
    this.state = name;
  }
  // Diễn một động tác trong ms rồi về đứng yên. Bộ hình không có động tác đó -> trả false.
  play(name, ms, back = 'idle') {
    const list = this.variants(name);
    if (!list.length) return false;
    const chosen = list[Math.floor(Math.random() * list.length)];
    const el = this.layers[chosen];
    // Video dài hơn thời gian định sẵn thì cho chạy hết một lượt (về đúng tư thế đứng rồi mới chuyển)
    const clip = el.tagName === 'VIDEO' && Number.isFinite(el.duration) ? el.duration * 1000 - 120 : 0;
    clearTimeout(this.timer);
    this.show(chosen);
    this.timer = setTimeout(() => this.show(back), Math.max(ms, Math.min(clip, 12000)));
    return true;
  }
}
const coupleActor = new StageActor($('#couple-sprite'));
// Diễn động tác đầu tiên mà bộ hình có (vd ['ring', 'heart']: có video trao nhẫn thì dùng, không thì bắn tim)
function coupleDo(names, ms) {
  for (const n of [].concat(names)) if (coupleActor.play(n, ms)) return n;
  return '';
}
// Cảm ơn quà thường: cúi chào, không quá dày
let lastCoupleThanks = 0;
function coupleThanks() {
  if (Date.now() - lastCoupleThanks < 10000 || coupleActor.state !== 'idle') return;
  if (coupleDo(['thanks', 'bow'], 3200)) lastCoupleThanks = Date.now();
}
const mcActor = new StageActor($('.mc-sprite'));

// Phông động: phát một lượt đè lên phông thường rồi mờ dần về.
// 'party' (quẩy, pháo hoa) dùng video party nếu phông có; còn lại dùng hiệu ứng riêng của phông
// (vd Hồng trắng: love, Champagne: toast). Quà thường ('gift') không phát dày hơn mỗi 12 giây.
let bgFxBusy = false;
let bgFxToken = 0;
let bgFxGiftAt = 0;
function bgFxName(name) {
  const fx = theme.fx || {};
  if (fx[name]) return name;
  return Object.keys(fx).find(k => k !== 'party' && !k.startsWith('to_')) || '';
}
function playBgFx(name = 'party') {
  const el = $('.stage-bg-fx');
  const f = theme.fx?.[bgFxName(name)];
  if (!el || !f || bgFxBusy || scene.busy || cfg().themeVideo === false) return false;
  if (name === 'gift' && Date.now() - bgFxGiftAt < 12000) return false;
  bgFxGiftAt = Date.now();
  const src = themeAsset(f);
  if (el.dataset.src !== src) {
    el.dataset.src = src;
    el.src = src;
  }
  bgFxBusy = true;
  try { el.currentTime = 0; } catch (e) {}
  el.play().catch(() => {});
  el.classList.add('on');
  const len = Number.isFinite(el.duration) && el.duration > 1 ? el.duration * 1000 : 5000;
  const tok = ++bgFxToken;
  setTimeout(() => { if (tok === bgFxToken) el.classList.remove('on'); }, Math.max(1500, len - 500));
  setTimeout(() => { if (tok === bgFxToken) { el.pause(); bgFxBusy = false; } }, Math.max(2000, len + 200));
  return true;
}
function stopBgFx() {
  const el = $('.stage-bg-fx');
  const tok = ++bgFxToken;
  bgFxBusy = false;
  if (!el) return;
  el.classList.remove('on');
  setTimeout(() => { if (tok === bgFxToken) el.pause(); }, 600);
}

// ========================================================
// PHÔNG THEO DIỄN BIẾN HÔN LỄ
// Chờ đôi → đủ đôi (đếm ngược tới lễ) → đang làm lễ → vừa thành hôn: mỗi giai đoạn một phông
// (theme.json "scenes"). Đổi phông bằng video chuyển cảnh bg_<phông>_to_<phông>, không có thì đi vòng
// qua phông chờ, vẫn không có (hoặc tắt video) thì phông mới mờ dần lên.
// ========================================================
// Tiệc mừng tính từ lúc phông tiệc mừng hiện ra (sau ảnh cưới và chuyển cảnh)
const MARRIED_MIN_MS = 25000; // ít nhất chừng này kể cả khi đã có đôi mới
const MARRIED_MAX_MS = 60000; // chưa có đôi mới thì chừng này rồi về phông chờ
const TX_RATE = 1.5;          // tua nhanh video chuyển cảnh: 5 giây còn khoảng 3,3 giây
const scene = { bg: '', themeId: '', busy: false, marriedAt: 0, afterCeremony: false, override: null, leavingOverride: false };

function themeBgs() {
  const t = theme.data;
  return t.backgrounds?.length ? t.backgrounds : LEGACY_THEME.backgrounds;
}
function bgById(id) {
  const bgs = themeBgs();
  return bgs.find(b => b.id === id) || bgs[0];
}
function scenesOn() {
  return cfg().themeScenes !== false && Boolean(theme.data.scenes);
}
function marriageStage(s = currentState) {
  if (ceremonyRunning) return 'ceremony';
  // Tiệc mừng (đôi vừa cưới còn trên sân khấu chờ quà) và lúc chào khách: giữ phông tiệc mừng
  if (s?.ceremony?.phase === 'reception' || s?.ceremony?.mode === 'farewell') return 'married';
  const couple = Boolean(s) && openRolesOf(s.config || {}).every(r => s.roles?.[r]);
  const at = Math.max(ceremonyEndedAt, Number(s?.marriages?.[0]?.at) || 0);
  const since = Date.now() - (scene.marriedAt > at ? scene.marriedAt : at);
  // Đôi đó đã rời sân khấu (hết tiệc mừng / động phòng xong) thì về cảnh chờ luôn, không giữ cảnh tiệc mừng nữa
  if (at && at > turnEndedAt && since >= 0 && (since < MARRIED_MIN_MS || (since < MARRIED_MAX_MS && !couple))) return 'married';
  if (s?.ceremony?.phase === 'running') return 'ceremony';
  return couple ? 'engaged' : 'waiting';
}
function sceneBgId() {
  const fixed = bgById(cfg().themeBackground).id;
  if (!scenesOn()) return fixed;
  // Đang mượn tạm nền khác để diễn cảnh tiệc tùng (nhảy, pháo hoa): giữ nền đó tới khi hết cảnh
  if (scene.override) {
    if (Date.now() < scene.override.until && !ceremonyRunning && !dpActive && themeBgs().some(b => b.id === scene.override.id)) return scene.override.id;
    scene.override = null;
    scene.leavingOverride = true;
  }
  const sc = theme.data.scenes;
  const id = sc[marriageStage()] || sc.waiting;
  return themeBgs().some(b => b.id === id) ? id : fixed;
}

// Đặt phông tĩnh ngay và nạp sẵn hiệu ứng riêng của phông
function setStageBg(id) {
  const bg = bgById(id);
  scene.bg = bg.id;
  theme.bgSrc = themeAsset(bg.src);
  const el = $('.stage-bg');
  if (el && el.getAttribute('src') !== theme.bgSrc) el.src = theme.bgSrc;
  theme.fx = { ...(theme.data.effects || {}), ...(bg.fx || {}) };
  const fxEl = $('.stage-bg-fx');
  const own = bgFxName('party');
  if (fxEl && own && !bgFxBusy && cfg().themeVideo !== false) {
    const src = themeAsset(theme.fx[own]);
    if (fxEl.dataset.src !== src) {
      fxEl.dataset.src = src;
      fxEl.src = src;
    }
  }
}
function preloadSceneBgs() {
  for (const b of themeBgs()) new Image().src = themeAsset(b.src);
}

function waitMedia(el, ev, ms) {
  return new Promise(res => {
    const done = () => { clearTimeout(t); el.removeEventListener(ev, done); res(); };
    const t = setTimeout(done, ms);
    el.addEventListener(ev, done);
  });
}
// Các chặng video chuyển cảnh từ phông a sang phông b
function txRoute(a, b) {
  const clip = (x, y) => bgById(x).fx?.[`to_${y}`];
  if (clip(a, b)) return [[a, b]];
  const home = theme.data.scenes?.waiting;
  if (home && home !== a && home !== b && clip(a, home) && clip(home, b)) return [[a, home], [home, b]];
  return null;
}
async function playTxClip(el, a, b) {
  const src = themeAsset(bgById(a).fx[`to_${b}`]);
  if (el.dataset.src !== src) {
    el.dataset.src = src;
    el.src = src;
  }
  try { el.currentTime = 0; } catch (e) {}
  if (el.readyState < 3) await waitMedia(el, 'canplay', 2500);
  el.defaultPlaybackRate = TX_RATE;
  el.playbackRate = TX_RATE;
  el.play().catch(() => {});
  el.classList.add('on');
  await sleep(350); // khung đầu trùng phông đang hiện; video đã che kín thì đổi phông tĩnh bên dưới
  setStageBg(b);
  const len = Number.isFinite(el.duration) && el.duration > 1 ? el.duration : 5;
  await waitMedia(el, 'ended', (len / TX_RATE) * 1000 + 1500);
}
async function crossfadeTo(id) {
  const img = new Image();
  img.className = 'stage-bg-next';
  img.alt = '';
  img.src = themeAsset(bgById(id).src);
  try { await img.decode(); } catch (e) {}
  $('.stage-bg')?.after(img);
  if (id === theme.data.scenes?.engaged) spawnPetalsBurst(40);
  if (id === theme.data.scenes?.married) for (let i = 0; i < 14; i++) setTimeout(() => spawnBubbles(true), i * 90);
  await sleep(40);
  img.classList.add('on');
  await sleep(1300);
  setStageBg(id);
  img.remove();
}
// Ảnh cưới tới khoảng 1,5 giây sau lễ (server chốt lễ), hiện chừng 10 giây
async function waitWeddingPhoto() {
  if (cfg().photoAfterCeremony === false) return;
  for (let i = 0; i < 20 && !photoBusy && !photoQueue.length; i++) await sleep(200);
  for (let i = 0; i < 100 && (photoBusy || photoQueue.length); i++) await sleep(200);
}
async function transitionTo(id) {
  stopBgFx();
  const el = $('.stage-bg-tx');
  const route = el && cfg().themeVideo !== false ? txRoute(scene.bg, id) : null;
  if (!route) return crossfadeTo(id);
  for (const [a, b] of route) await playTxClip(el, a, b);
  el.classList.remove('on');
  await sleep(650);
  el.pause();
}

let lastSceneStage = '';
async function updateScene() {
  if (scene.afterCeremony && !scene.busy && marriageStage() !== 'married') scene.afterCeremony = false;
  const want = sceneBgId();
  // Vừa đủ đôi mà nền không đổi (chờ và đủ đôi dùng chung một nền): phát hiệu ứng riêng của nền đó cho có không khí
  const stage = marriageStage();
  if (stage !== lastSceneStage) {
    if (stage === 'engaged' && lastSceneStage === 'waiting' && want === scene.bg && !scene.busy) setTimeout(() => playBgFx('scene'), 600);
    lastSceneStage = stage;
  }
  if (!scene.bg || scene.themeId !== theme.id) {
    scene.themeId = theme.id;
    if (!scene.busy) setStageBg(want);
    return;
  }
  if (scene.busy || want === scene.bg) return;
  scene.busy = true;
  let quick = false;
  try {
    for (let i = 0; i < 4; i++) {
      let target = sceneBgId();
      if (target === scene.bg) break;
      if (scene.afterCeremony && marriageStage() === 'married') {
        // Vừa thành hôn: ảnh cưới bật lên (che kín sân khấu) -> đợi ảnh đóng rồi mới chuyển cảnh cho mọi người xem
        scene.afterCeremony = false;
        await waitWeddingPhoto();
        target = sceneBgId();
        if (target === scene.bg) break;
      }
      // Mượn nền cho cảnh tiệc tùng rồi trả lại: mờ chuyển nhanh, không phát clip chuyển cảnh dài
      quick = Boolean(scene.override) || scene.leavingOverride;
      if (quick) { stopBgFx(); await crossfadeTo(target); } else await transitionTo(target);
      if (scenesOn() && target === theme.data.scenes.married && marriageStage() === 'married') scene.marriedAt = Date.now();
    }
  } finally {
    scene.busy = false;
    if (!scene.override) scene.leavingOverride = false;
  }
  if (quick) return; // cảnh tiệc tùng tự phát hiệu ứng của nó; lúc trả nền thì không phát lại hiệu ứng của nền
  // Vào phông mới: phát hiệu ứng riêng của phông (Hồng trắng: love, Champagne: toast; Đỏ vàng không có)
  await sleep(300);
  if (!scene.busy) playBgFx('scene');
}

// Cảnh tiệc tùng (đèn disco, pháo hoa lạnh, mưa cánh hoa) chỉ có ở một nền (Đỏ vàng). Khi cả rạp nhảy hoặc bắn pháo
// mà đang ở nền khác: chuyển nhanh sang nền đó, phát cảnh, xong tự trả về nền của giai đoạn hiện tại.
function partyBgId() {
  const b = themeBgs().find(x => x.fx?.party);
  return b ? b.id : '';
}
async function playPartyScene(ms = 5600) {
  const id = partyBgId();
  if (!id || !scenesOn() || cfg().themeVideo === false || scene.bg === id || ceremonyRunning || dpActive) return playBgFx('party');
  scene.override = { id, until: Date.now() + 1500 + ms };
  updateScene();
  for (let i = 0; i < 20 && scene.override && (scene.bg !== id || scene.busy); i++) await sleep(150);
  if (scene.bg === id && scene.override) playBgFx('party');
}
setInterval(() => { if (currentState) { updateScene(); updateSolo(); renderCoupleLabel(currentState); renderAttendants(currentState); } }, 1000);

// ========================================================
// CÔ DÂU, CHÚ RỂ ĐỨNG RIÊNG CHỜ GHÉP ĐÔI
// Ảnh bride_wait / groom_wait cùng khung với ảnh cặp đôi (mỗi người đứng đúng chỗ của mình), lúc chờ
// tách ra hai bên; vai còn trống thì mờ đi. Đủ đôi: hai người lại gần nhau rồi hiện ảnh cặp đôi.
// ========================================================
const soloActors = { bride: new StageActor($('#solo-bride')), groom: new StageActor($('#solo-groom')) };
function hasSolo() {
  const s = theme.data.solo;
  return Boolean(s?.bride?.states && s?.groom?.states);
}
function setupSolo(video) {
  for (const r of ['bride', 'groom']) {
    soloActors[r].configure(theme.data.solo?.[r], { video });
    // Ảnh nằm trong khung đang ẩn: giải mã ngay, nếu không Chrome có lúc không vẽ khi khung hiện ra
    for (const el of Object.values(soloActors[r].layers)) if (el.tagName === 'IMG') el.decoding = 'sync';
    soloActors[r].show('wait');
  }
  requestAnimationFrame(placeSolo);
}
// Phủ đúng khung ảnh cặp đôi
function placeSolo() {
  const spr = $('#couple-sprite');
  const pair = $('#solo-pair');
  if (!spr || !pair) return;
  pair.style.left = `${spr.offsetLeft}px`;
  pair.style.top = `${spr.offsetTop}px`;
  pair.style.width = `${spr.offsetWidth}px`;
  pair.style.height = `${spr.offsetHeight}px`;
}
function updateSolo(s = currentState) {
  const wrap = $('#couple-wrapper');
  if (!wrap || !s) return;
  const c = s.config || {};
  const on = hasSolo() && c.enableMarryAuction !== false && marriageStage(s) === 'waiting';
  if (!on && wrap.classList.contains('solo-mode')) {
    // Đủ đôi: cả hai sáng lên, bước lại gần nhau rồi mới đổi sang ảnh cặp đôi
    for (const r of ['bride', 'groom']) $(`#solo-${r}`)?.classList.remove('vacant');
    wrap.classList.add('solo-leave');
    clearTimeout(updateSolo.leaveTimer);
    updateSolo.leaveTimer = setTimeout(() => wrap.classList.remove('solo-leave'), 1500);
  }
  wrap.classList.toggle('solo-mode', on);
  if (!on) {
    // Hết chế độ đứng riêng: tắt ô hướng dẫn nhận vai (không để sót lại khi hai người hiện lên lần sau)
    for (const r of ['bride', 'groom']) $(`#tip-${r}`)?.classList.remove('on');
    return;
  }
  placeSolo();
  const open = openRolesOf(c);
  for (const r of ['bride', 'groom']) {
    const vacant = open.includes(r) && !s.roles?.[r];
    $(`#solo-${r}`)?.classList.toggle('vacant', vacant);
    const tip = $(`#tip-${r}`);
    if (!tip) continue;
    tip.classList.toggle('on', vacant);
    if (vacant) tip.textContent = takeRoleText(r, c);
  }
}
// Cách nhận vai còn trống theo luật quà đang dùng
function takeRoleText(role, c) {
  const label = role === 'groom' ? 'chú rể' : 'cô dâu';
  if (c.roleSystem === 'queue' && c.freeRoles) return `Cmt "${label}" để làm ${label} (miễn phí)`;
  if (c.roleSystem === 'queue') {
    const gift = firstGiftFor(c, role === 'groom' ? ['groom', 'role'] : ['bride']);
    return gift ? `Tặng ${gift} để làm ${label}` : `Tặng quà để làm ${label}`;
  }
  const min = fmt(Number(c.minCoinsToMarry) || 10);
  const gift = firstGiftFor(c, ['role']);
  const what = gift ? `${gift} (${min} xu)` : `${min} xu`;
  if (role === 'bride' && openRolesOf(c).length > 1) return `Cmt "cô dâu" rồi tặng ${what}`;
  return `Tặng ${what} để làm ${label}`;
}

function coupleStill(...names) {
  const st = theme.data.couple?.states || {};
  const n = names.find(k => st[k]?.img) || 'idle';
  return themeAsset(st[n]?.img || LEGACY_THEME.couple.states.idle.img);
}

function guestGender(p) {
  if (p?.gender === 'male' || p?.gender === 'female') return p.gender;
  const sp = Number(p?.sprite);
  return sp >= 3 && sp <= 5 ? 'female' : 'male'; // dữ liệu cũ: 0-2 nam, 3-5 nữ
}

function guestFile(p) {
  const g = theme.data.guests || LEGACY_THEME.guests;
  const own = g[guestGender(p)] || [];
  const pool = own.length ? own : [...(g.male || []), ...(g.female || [])];
  return pool[(Number(p?.sprite) || 0) % pool.length];
}
function guestSprite(p) {
  return themeAsset(guestFile(p));
}

function guestBox() {
  const h = Math.round((theme.data.display?.guest || 175) * sizePct(cfg().sizeGuest));
  return { w: Math.max(135, Math.round(h * (theme.data.guests?.aspect || 0.9))), h };
}

// Bộ hình người thật: hàng sau không nhỏ quá so với hàng trước (theme.guestScale = [hàng sau, hàng trước])
function seatScale(seat) {
  const gs = theme.data.guestScale;
  if (!Array.isArray(gs) || gs.length !== 2) return seat.scale;
  return Number((gs[0] + ((seat.scale - 0.58) * (gs[1] - gs[0])) / (0.97 - 0.58)).toFixed(3));
}

function actorBox() {
  const t = theme.data;
  const h = Math.round((t.display?.walker || 185) * sizePct(cfg().sizeGuest));
  const aspects = [t.guests?.aspect || 0.9, ...Object.values(t.walker || {}).map(w => w?.aspect || 0)];
  return { w: Math.max(145, Math.round(h * Math.max(...aspects))), h };
}

// Đặt chân cặp đôi đúng mặt sân khấu của phông (giữ cách căn giữa cũ để hiệu ứng rung không lệch)
function placeCouple() {
  const stage = $('#wedding-stage');
  const wrap = $('#couple-wrapper');
  const spr = $('#couple-sprite');
  const bottom = theme.data.layout?.coupleBottom;
  if (!stage || !wrap || !spr) return;
  if (!bottom) { stage.style.top = ''; return; }
  const h = wrap.offsetHeight;
  const sprBottom = spr.offsetTop + spr.offsetHeight;
  if (h > 0) stage.style.top = `${Math.round(bottom + h / 2 - sprBottom)}px`;
}

let themeLoadSeq = 0;
async function applyTheme(c) {
  const id = /^[a-z0-9-]{1,40}$/.test(c.theme || '') ? c.theme : 'co-dien';
  const key = JSON.stringify([id, c.themeBackground || '', c.themeVideo !== false, c.sizeCouple, c.sizeMC, c.sizeGuest]);
  if (key === theme.key) return;
  theme.key = key;
  const seq = ++themeLoadSeq;
  if (id !== theme.id || theme.data === LEGACY_THEME) {
    let data = null;
    try {
      const r = await fetch(`/themes/${id}/theme.json`, { cache: 'no-store' });
      if (r.ok) data = await r.json();
    } catch (e) {}
    if (seq !== themeLoadSeq) return;
    if (data?.couple?.states?.idle) {
      theme.id = id;
      theme.data = data;
    } else {
      theme.id = 'co-dien';
      theme.data = LEGACY_THEME;
    }
  }
  renderTheme(c);
}

function renderTheme(c) {
  const t = theme.data;
  const video = c.themeVideo !== false;
  document.body.dataset.theme = theme.id;

  // Phông: đổi bộ hình thì đặt ngay, còn lại chuyển cảnh sang phông đã chọn / phông của giai đoạn hiện tại
  if (scene.themeId !== theme.id) preloadSceneBgs();
  updateScene();

  // Cặp đôi
  const spr = $('#couple-sprite');
  const ch = Math.round((t.display?.couple || 280) * sizePct(c.sizeCouple));
  if (spr) {
    spr.style.height = `${ch}px`;
    spr.style.width = `${Math.round(ch * (t.couple?.aspect || 0.95))}px`;
  }
  coupleActor.configure(t.couple, { video });
  spr?.classList.toggle('has-video', coupleActor.hasVideo);
  setupSolo(video);
  requestAnimationFrame(placeCouple);

  // MC
  const host = $('#mc-host');
  mcActor.configure(t.mc, { video });
  if (host) {
    host.classList.toggle('has-video', mcActor.hasVideo);
    const L = t.layout;
    if (L?.mcX && L?.mcBottom) {
      const mh = Math.round((t.display?.mc || 155) * sizePct(c.sizeMC));
      const mw = Math.round(mh * (t.mc?.aspect || 0.9));
      Object.assign(host.style, { width: `${mw}px`, height: `${mh}px`, left: `${L.mcX - mw / 2}px`, top: `${L.mcBottom - mh}px` });
    } else {
      Object.assign(host.style, { width: '', height: '', left: '', top: '' });
    }
  }

  // Người đi lên + khách ngồi bàn
  setupActorMedia();
  setupDongPhong(video);
  if (currentState) renderGuests(currentState.people || []);
}

// Động phòng: bộ hình có ảnh phòng tân hôn -> phòng tràn màn hình, cặp đôi bế nhau cỡ lớn (video nếu có).
// Bộ hình không có ảnh phòng -> giữ kiểu cũ (khung cửa nhỏ, ảnh tĩnh).
function setupDongPhong(video) {
  const t = theme.data;
  const root = $('#dong-phong');
  const box = $('.dp-couple');
  const room = $('.dp-inside');
  if (!root || !box || !room) return;
  const photo = Boolean(t.dongphong);
  root.dataset.room = photo ? 'photo' : '';
  room.style.background = photo ? `url('${themeAsset(t.dongphong)}') center / cover no-repeat` : '';
  if (!photo) {
    box.dataset.sig = '';
    box.replaceChildren();
    box.style.removeProperty('--dp-aspect');
    box.style.backgroundImage = `url('${coupleStill('carry', 'heart', 'kiss', 'idle')}')`;
    return;
  }
  const st = t.couple?.states || {};
  const s = st[['carry', 'heart', 'kiss', 'idle'].find(k => st[k]?.img || st[k]?.video)] || {};
  const src = video ? s.videoHD || s.video : '';
  const sig = JSON.stringify([theme.id, t.version, src, s.img]);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.style.backgroundImage = 'none';
  box.style.setProperty('--dp-aspect', t.couple?.aspect || 0.5625);
  let el;
  if (src) {
    el = document.createElement('video');
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    if (s.img) el.poster = themeAsset(s.img);
    el.src = themeAsset(src);
  } else {
    el = new Image();
    el.decoding = 'async';
    el.alt = '';
    el.src = s.img ? themeAsset(s.img) : coupleStill('carry', 'heart', 'kiss', 'idle');
  }
  el.className = 'dp-media';
  box.replaceChildren(el);
}

// ========================================================
// KHÁCH DỰ TIỆC
// ========================================================
const guestNodes = new Map();
const SPECIAL_TAG = /Chú rể|Cô dâu|Đại gia|Đại Gia|Siêu sao|Trùm|Thần|Nghiện|Vua|Khách ruột|Khách nhiệt tình|Bắt được hoa|Vệ Sĩ|Thánh Nịnh|Thợ Điện|Phù dâu|Phù rể|Lấy vía cưới/;

const banquetTables = [
  { x: 100, y: 1200, scale: 0.58 }, { x: 210, y: 1200, scale: 0.58 }, { x: 320, y: 1210, scale: 0.58 },
  { x: 95, y: 1330, scale: 0.68 }, { x: 205, y: 1330, scale: 0.68 }, { x: 315, y: 1340, scale: 0.68 },
  { x: 90, y: 1470, scale: 0.78 }, { x: 200, y: 1470, scale: 0.78 }, { x: 310, y: 1480, scale: 0.78 },
  { x: 85, y: 1620, scale: 0.88 }, { x: 195, y: 1620, scale: 0.88 }, { x: 305, y: 1630, scale: 0.88 },
  { x: 760, y: 1210, scale: 0.58 }, { x: 870, y: 1200, scale: 0.58 }, { x: 980, y: 1200, scale: 0.58 },
  { x: 765, y: 1340, scale: 0.68 }, { x: 875, y: 1330, scale: 0.68 }, { x: 985, y: 1330, scale: 0.68 },
  { x: 770, y: 1480, scale: 0.78 }, { x: 880, y: 1470, scale: 0.78 }, { x: 990, y: 1470, scale: 0.78 },
  { x: 775, y: 1630, scale: 0.88 }, { x: 885, y: 1620, scale: 0.88 }, { x: 995, y: 1620, scale: 0.88 },
  // Ghế thêm khi bật "đông khách" (24-38 bên trái, 39-53 bên phải)
  ...[
    [45, 1265, 0.62], [155, 1265, 0.62], [265, 1265, 0.62], [370, 1265, 0.62],
    [40, 1400, 0.72], [150, 1400, 0.72], [255, 1400, 0.72],
    [40, 1545, 0.82], [145, 1545, 0.82], [250, 1545, 0.82],
    [40, 1700, 0.92], [140, 1700, 0.92], [235, 1700, 0.92],
    [95, 1790, 0.97], [190, 1790, 0.97]
  ].map(([x, y, scale]) => ({ x, y, scale })),
  ...[
    [1035, 1265, 0.62], [925, 1265, 0.62], [815, 1265, 0.62], [710, 1265, 0.62],
    [1040, 1400, 0.72], [930, 1400, 0.72], [825, 1400, 0.72],
    [1040, 1545, 0.82], [935, 1545, 0.82], [830, 1545, 0.82],
    [1040, 1700, 0.92], [940, 1700, 0.92], [845, 1700, 0.92],
    [985, 1790, 0.97], [890, 1790, 0.97]
  ].map(([x, y, scale]) => ({ x, y, scale })),
  // Ghế thêm khi "kín rạp" (54-71 bên trái, 72-89 bên phải): 6 hàng x 3 chỗ mỗi bên, so le
  ...['L', 'R'].flatMap(side => [1300, 1385, 1470, 1555, 1640, 1725].flatMap((y, r) => [0, 1, 2].map(i => {
    const x = 70 + i * 115 + (r % 2) * 45;
    return { x: side === 'L' ? x : 1080 - x, y, scale: 0.6 + ((y - 1240) / 590) * 0.37 };
  })))
];

function renderGuests(people = []) {
  const container = $('#guests-container');
  if (!container) return;
  const currentIds = new Set(people.map(p => p.id));
  for (const [id, node] of guestNodes) {
    if (!currentIds.has(id)) {
      node.remove();
      guestNodes.delete(id);
      wanderers.delete(id);
    }
  }

  const box = guestBox();
  people.forEach((p, index) => {
    let node = guestNodes.get(p.id);
    const idle = cfg().themeVideo !== false ? theme.data.guests?.idle?.[guestFile(p)] : null;
    const src = idle ? themeAsset(idle) : guestSprite(p);
    if (!node) {
      node = document.createElement('div');
      node.className = 'wedding-guest';
      node.dataset.id = p.id;
      node.style.setProperty('--delay', `${-(Math.random() * 4).toFixed(2)}s`);
      node.style.setProperty('--dur', `${(2.8 + Math.random() * 1.8).toFixed(2)}s`);
      node.style.setProperty('--sway', `${(0.9 + Math.random() * 1.1).toFixed(2)}deg`);
      node.style.setProperty('--bdur', `${(2.6 + Math.random() * 1.4).toFixed(2)}s`);

      const sprite = document.createElement('div');
      sprite.className = 'guest-sprite';

      const badge = document.createElement('div');
      badge.className = 'guest-name-badge';
      const av = document.createElement('span');
      av.className = 'badge-av';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'badge-name';
      const statusTag = document.createElement('span');
      statusTag.className = 'guest-status-tag';
      badge.append(av, nameSpan, statusTag);
      node.append(sprite, badge);
      container.append(node);
      guestNodes.set(p.id, node);
    }
    const spr = node.querySelector('.guest-sprite');
    if (spr.dataset.src !== src) {
      // Chỉ "thay đồ" khi khách đổi nhân vật, không phải khi đổi cả bộ hình
      const changed = spr.dataset.src !== undefined && spr.dataset.theme === theme.id;
      spr.dataset.src = src;
      spr.dataset.theme = theme.id;
      spr.style.backgroundImage = `url('${src}')`;
      if (changed) {
        node.classList.remove('outfit-change');
        void node.offsetWidth;
        node.classList.add('outfit-change');
      }
    }
    updateAvatar(node.querySelector('.badge-av'), p.avatar, p.name);
    node.querySelector('.badge-name').textContent = p.name;
    node.querySelector('.guest-status-tag').textContent = p.statusTag || '💍 Xin vía';
    // Người giữ danh hiệu (Đại Gia Đám Cưới, Thần Động Phòng, Trùm Phá Đám...): thẻ tên vàng, đứng hàng đầu
    // Thẻ vàng chỉ dành cho người đặc biệt (cô dâu, chú rể, người có danh hiệu, đại gia...); khách thường thẻ tối chỉ ghi tên
    node.classList.toggle('special', SPECIAL_TAG.test(p.statusTag || ''));
    const vip = Number.isInteger(p.vip) && VIP_SPOTS[p.vip] ? String(p.vip) : '';
    node.classList.toggle('vip', vip !== '');
    node.dataset.vip = vip;

    const seat = banquetTables[(Number.isInteger(p.table) ? p.table : index) % banquetTables.length];
    node.style.width = `${box.w}px`;
    node.style.height = `${box.h}px`;
    placeGuest(p.id, node, seat, box);
  });
  guestsShown = true;
}

// ----- KHÁCH ĐI LẠI TRONG RẠP -----
// Khách không đứng yên một chỗ: mỗi người tự chọn một điểm ở khu bàn tiệc bên mình (trái / phải thảm đỏ),
// đi tới đó, đứng chơi một lát rồi đi tiếp. Thảm đỏ ở giữa luôn để trống làm lối đi và sàn nhảy.
// Vị trí tính theo điểm đặt chân (x, y) trong khung 1080x1920; càng gần ống kính (y lớn) người càng to.
const wanderers = new Map(); // id -> { node, side, box, x, y, fx, fy, tx, ty, t0, t1, moving, nextAt, holdUntil }
let guestsShown = false;     // đã vẽ lượt khách đầu tiên (khách tới sau đó sẽ đi bộ từ cửa vào)
const WALK_TOP = 1232;
const WALK_BOTTOM = 1822;
const wanderOn = () => cfg().guestsWander !== false;
// Chỗ đứng hàng đầu sát sân khấu cho người giữ danh hiệu, theo thứ tự danh hiệu (đủ xa nhau để thẻ vàng không đè lên nhau).
// Danh hiệu xếp sau không có chỗ riêng: người giữ vẫn đi lại như khách thường, danh hiệu ghi ở nhãn nhỏ cạnh tên.
const VIP_SPOTS = [{ x: 775, y: 1198 }, { x: 150, y: 1203 }, { x: 968, y: 1210 }, { x: 872, y: 1272 }];
const vipSpotOf = w => (w.node.dataset.vip ? VIP_SPOTS[Number(w.node.dataset.vip)] || null : null);
// Khoảng x được đứng ở độ sâu y: mép trong bám theo mép thảm đỏ (thảm rộng dần về phía ống kính)
function walkBounds(side, y) {
  // Lối đi giữa hẹp lại để khách đứng kín rạp (vẫn đủ rộng cho người đi lên sân khấu)
  const inner = 455 - ((y - 1240) / 580) * 120;
  return side === 'L' ? [44, inner] : [1080 - inner, 1036];
}
function depthScale(y) {
  const k = Math.min(1, Math.max(0, (y - 30 - 1200) / 590));
  return seatScale({ scale: 0.58 + k * 0.39 });
}
function wanderPos(w, now = performance.now()) {
  if (!w.moving) return { x: w.x, y: w.y };
  const k = Math.min(1, Math.max(0, (now - w.t0) / (w.t1 - w.t0)));
  return { x: w.fx + (w.tx - w.fx) * k, y: w.fy + (w.ty - w.fy) * k };
}
function wanderApply(w, x, y, ms = 0) {
  const st = w.node.style;
  st.transition = ms ? `translate ${ms}ms linear, scale ${ms}ms linear, opacity 0.4s ease` : 'opacity 0.4s ease';
  st.translate = `${(x - w.box.w / 2).toFixed(1)}px ${(y - w.box.h).toFixed(1)}px`;
  st.scale = String(depthScale(y));
  st.setProperty('--inv', (1 / depthScale(y)).toFixed(3)); // thẻ tên danh hiệu giữ cỡ chữ dễ đọc dù người đứng xa
}
function wanderStop(w, now = performance.now()) {
  if (!w.moving) return;
  const p = wanderPos(w, now);
  w.moving = false;
  w.x = p.x;
  w.y = p.y;
  w.node.classList.remove('walking');
  wanderApply(w, p.x, p.y);
  w.node.style.zIndex = String(Math.round((p.y - 30) / 10));
}
function wanderGo(w, tx, ty, now = performance.now(), speed = 85 + Math.random() * 55) {
  const p = wanderPos(w, now);
  const dist = Math.hypot(tx - p.x, ty - p.y);
  if (dist < 12) { w.nextAt = now + 400; return; }
  const ms = Math.max(500, (dist / (speed * depthScale((p.y + ty) / 2))) * 1000);
  Object.assign(w, { moving: true, x: p.x, y: p.y, fx: p.x, fy: p.y, tx, ty, t0: now, t1: now + ms });
  w.node.style.setProperty('--lean', `${tx > p.x ? 2.4 : -2.4}deg`);
  w.node.classList.add('walking');
  // Chốt vị trí hiện tại trước rồi mới đặt đích, để trình duyệt chạy đúng một đoạn đi thẳng
  wanderApply(w, p.x, p.y);
  void w.node.offsetWidth;
  wanderApply(w, tx, ty, ms);
}
// Chọn điểm đến: vài điểm ngẫu nhiên quanh chỗ đang đứng, lấy điểm thoáng nhất (xa những người khác nhất)
function wanderTarget(w, now) {
  const p = wanderPos(w, now);
  const others = [];
  const vips = [];
  for (const o of wanderers.values()) {
    if (o === w) continue;
    const spot = vipSpotOf(o);
    if (spot) vips.push(spot);
    else if (o.side === w.side) others.push(o.moving ? { x: o.tx, y: o.ty } : { x: o.x, y: o.y });
  }
  let best = null;
  for (let i = 0; i < 7; i++) {
    const far = i >= 5; // 2 điểm cuối: bất kỳ đâu trong khu, để thỉnh thoảng đi một quãng dài
    const y = far ? WALK_TOP + Math.random() * (WALK_BOTTOM - WALK_TOP)
      : Math.min(WALK_BOTTOM, Math.max(WALK_TOP, p.y + (Math.random() - 0.5) * 420));
    const [x0, x1] = walkBounds(w.side, y);
    const x = far ? x0 + Math.random() * (x1 - x0) : Math.min(x1, Math.max(x0, p.x + (Math.random() - 0.5) * 460));
    if (Math.hypot(x - p.x, y - p.y) < 70) continue;
    if (vips.some(v => Math.abs(x - v.x) < 105 && y - v.y < 130)) continue; // không đứng che người giữ danh hiệu
    let near = Infinity;
    for (const o of others) near = Math.min(near, Math.hypot(x - o.x, (y - o.y) * 1.5));
    if (!best || near > best.near) best = { x, y, near };
  }
  return best;
}
// Chỗ của một khách theo ghế server xếp (vẫn dùng để chia bên trái / phải và làm chỗ đứng ban đầu)
function placeGuest(id, node, seat, box) {
  const now = performance.now();
  const side = seat.x < 540 ? 'L' : 'R';
  const home = { x: seat.x, y: seat.y + 30 };
  let w = wanderers.get(id);
  if (!w) {
    w = { node, side, box, home, x: home.x, y: home.y, moving: false, nextAt: now + 300 + Math.random() * 2600, holdUntil: 0 };
    wanderers.set(id, w);
    node.style.left = '0px';
    node.style.top = '0px';
    if (guestsShown && wanderOn()) {
      // Khách mới tới: đi bộ từ mép màn hình vào chỗ
      w.x = side === 'L' ? -90 : 1170;
      w.y = Math.min(WALK_BOTTOM, home.y + 120 + Math.random() * 160);
      wanderApply(w, w.x, w.y);
      node.style.zIndex = String(Math.round((w.y - 30) / 10));
      void node.offsetWidth;
      wanderGo(w, home.x, home.y, now, 150);
      return;
    }
    wanderApply(w, w.x, w.y);
    node.style.zIndex = String(Math.round((w.y - 30) / 10));
    return;
  }
  const moved = w.home.x !== home.x || w.home.y !== home.y;
  const resized = w.box.w !== box.w || w.box.h !== box.h;
  w.home = home;
  w.side = side;
  if (resized) {
    wanderStop(w, now);
    w.box = box;
    wanderApply(w, w.x, w.y);
  }
  if (!wanderOn()) {
    // Tắt đi lại: ai về ghế nấy
    if (w.moving || w.x !== home.x || w.y !== home.y) {
      wanderStop(w, now);
      Object.assign(w, { x: home.x, y: home.y });
      wanderApply(w, home.x, home.y);
      node.style.zIndex = String(Math.round((home.y - 30) / 10));
    }
  } else if (moved && !w.moving) {
    w.nextAt = now; // bị đổi ghế (đổi bên): đi sang khu mới ngay
  }
}
// Đứng lại một lát (đang nói, đang được gọi tên...)
function wanderHold(id, ms) {
  const w = wanderers.get(id);
  if (!w) return;
  const now = performance.now();
  wanderStop(w, now);
  w.holdUntil = Math.max(w.holdUntil, now + ms);
}
function wanderTick() {
  if (!wanderers.size || document.hidden) return;
  const now = performance.now();
  const on = wanderOn() && !dpActive;
  for (const w of wanderers.values()) {
    const busy = w.node.classList.contains('dancing') || w.node.classList.contains('cheering');
    if (busy || !on) {
      // Đang nhảy / cụng ly thì đứng tại chỗ; xong thì lát nữa đi tiếp
      if (w.moving) wanderStop(w, now);
      if (busy) w.nextAt = now + 300 + Math.random() * 1500;
      continue;
    }
    // Người giữ danh hiệu: đi tới chỗ hàng đầu của mình rồi đứng đó
    const spot = vipSpotOf(w);
    if (spot) {
      if (w.moving && now >= w.t1) wanderStop(w, w.t1);
      const p = wanderPos(w, now);
      const heading = w.moving && w.tx === spot.x && w.ty === spot.y;
      if (!heading && now >= w.holdUntil && Math.hypot(p.x - spot.x, p.y - spot.y) > 14) wanderGo(w, spot.x, spot.y, now, 150);
      else if (w.moving) w.node.style.zIndex = String(Math.round((p.y - 30) / 10));
      continue;
    }
    if (w.moving) {
      if (now >= w.t1) {
        wanderStop(w, w.t1);
        // Lúc làm lễ khách đứng xem lâu hơn, bình thường chỉ nghỉ chân một chút rồi đi tiếp
        w.nextAt = now + (ceremonyRunning ? 2500 + Math.random() * 6000 : 500 + Math.random() * 2600);
      } else {
        w.node.style.zIndex = String(Math.round((wanderPos(w, now).y - 30) / 10));
      }
      continue;
    }
    if (now < w.nextAt || now < w.holdUntil) continue;
    const out = w.x < 30 || w.x > 1050; // còn ở ngoài rìa (vừa đổi bên / vừa vào): về khu của mình trước
    const [x0, x1] = walkBounds(w.side, w.y);
    const t = out || w.x < x0 - 40 || w.x > x1 + 40 ? { x: w.home.x, y: w.home.y } : wanderTarget(w, now);
    if (t) wanderGo(w, t.x, t.y, now);
    else w.nextAt = now + 800;
  }
}
setInterval(wanderTick, 250);

// Khách "sống": mỗi người một nhịp đung đưa, thỉnh thoảng vỗ tay, nhảy cẫng, vẫy, ngó lên sân khấu
const GUEST_REACTS = { clap: 1300, hop: 1100, wave: 1500, look: 1900 };
function guestReact(node, kind, ms) {
  if (!node || node.classList.contains('dancing') || node.classList.contains('cheering')) return;
  if ([...node.classList].some(c => c.startsWith('react-'))) return;
  node.classList.add('react-' + kind);
  setTimeout(() => node.classList.remove('react-' + kind), ms || GUEST_REACTS[kind] || 1200);
}
function guestsReact(count, kinds = ['clap']) {
  const nodes = Array.from(guestNodes.values()).sort(() => Math.random() - 0.5).slice(0, count);
  nodes.forEach((n, i) => setTimeout(() => guestReact(n, pick(kinds)), i * 90 + Math.random() * 250));
}
setInterval(() => {
  if (!guestNodes.size || dpActive) return;
  const n = Math.min(2, Math.ceil(guestNodes.size / 12));
  guestsReact(n, ['clap', 'hop', 'wave', 'look', 'look']);
}, 1700);

// ========================================================
// SỔ MỪNG CƯỚI, MENU QUÀ, CÁCH CHƠI
// ========================================================
function renderRegistry(scores = {}) {
  const list = $('#registry-list');
  if (!list) return;
  list.replaceChildren();
  const sorted = Object.values(scores).sort((a, b) => b.total - a.total).slice(0, 5);
  const ranks = ['👑', '🥈', '🥉', '🌸', '💐'];
  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'registry-empty';
    empty.textContent = 'Chờ phong bì đầu tiên...';
    list.append(empty);
    return;
  }
  sorted.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'registry-item';
    const rank = document.createElement('span');
    rank.className = 'reg-rank';
    rank.textContent = ranks[idx] || String(idx + 1);
    const av = document.createElement('span');
    av.className = 'reg-av';
    av.append(makeAvatar(item.avatar, item.name));
    const nameSpan = document.createElement('span');
    nameSpan.className = 'reg-name';
    nameSpan.textContent = item.name;
    const score = document.createElement('span');
    score.className = 'reg-score';
    score.textContent = money(item.total);
    row.append(rank, av, nameSpan, score);
    list.append(row);
  });
}

const ACTION_INFO = {
  role: { icon: '👑', label: 'LÀM CHÚ RỂ / CÔ DÂU', cls: 'highlight-marry' },
  groom: { icon: '🤵', label: 'LÀM CHÚ RỂ', cls: 'highlight-marry' },
  bride: { icon: '👰', label: 'LÀM CÔ DÂU', cls: 'highlight-marry' },
  dongphong: { icon: '🏮', label: 'ĐỘNG PHÒNG', cls: 'highlight-dp' },
  dance: { icon: '💃', label: 'LÊN SÀN NHẢY', cls: '' },
  kiss: { icon: '💋', label: 'CÔ DÂU CHÚ RỂ HÔN', cls: '' },
  cake: { icon: '🎂', label: 'CẮT BÁNH CƯỚI', cls: '' },
  champagne: { icon: '🍾', label: 'RÓT RƯỢU SÂM PANH', cls: '' },
  cheers: { icon: '🍻', label: 'CỤNG LY 1 2 3 DZÔ', cls: '' },
  petal: { icon: '🌹', label: 'MƯA HOA HỒNG', cls: '' },
  ring: { icon: '💍', label: 'TRAO NHẪN CƯỚI', cls: '' },
  replaceGroom: { icon: '🔁', label: 'THAY CHÚ RỂ', cls: 'highlight-marry' },
  replaceBride: { icon: '🔁', label: 'THAY CÔ DÂU', cls: 'highlight-marry' },
  quickwed: { icon: '⚡', label: 'ĐỘNG PHÒNG LUÔN', cls: 'highlight-dp' },
  cancel: { icon: '💔', label: 'HỦY HÔN, PHÁ ĐÁM', cls: '' },
  bouquet: { icon: '💐', label: 'TUNG HOA CƯỚI', cls: '' },
  fireworks: { icon: '🎆', label: 'BẮN PHÁO HOA', cls: '' },
  music: { icon: '🎵', label: 'ĐỔI NHẠC', cls: '' },
  mc: { icon: '🎤', label: 'CƯỚI MC', cls: '' },
  photo: { icon: '📸', label: 'CHỤP ẢNH CHUNG', cls: '' },
  babyBoy: { icon: '👶', label: 'SINH BÉ TRAI', cls: 'highlight-dp' },
  babyGirl: { icon: '🎀', label: 'SINH BÉ GÁI', cls: 'highlight-dp' },
  thanks: { icon: '💌', label: 'MỪNG PHONG BÌ', cls: '' }
};
const ROLE_RULE_ROLE = { groom: 'groom', bride: 'bride', replaceGroom: 'groom', replaceBride: 'bride' };

// Tên quà đầu tiên của luật có hành động này (để ghi "Tặng Bé Heo Hồng để làm chú rể")
function firstGiftFor(c, actions) {
  const r = (c.giftRules || []).find(x => actions.includes(x.action) && String(x.gifts || '').trim());
  const name = r && String(r.gifts).split(',').map(t => t.trim()).find(t => t && !t.startsWith('#'));
  return name ? titleCase(name) : '';
}

function roleRuleLabel(c) {
  return c.roleMode === 'groom' ? 'LÀM CHÚ RỂ' : c.roleMode === 'bride' ? 'LÀM CÔ DÂU' : 'LÀM CHÚ RỂ / CÔ DÂU';
}

function titleCase(s) {
  return String(s).trim().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

function ruleSubtitle(rule) {
  const names = String(rule.gifts || '').split(',').map(s => s.trim()).filter(Boolean).filter(s => !s.startsWith('#'));
  const min = Number(rule.minCoins) || 0;
  if (!names.length) return min ? `Mọi quà ≥ ${fmt(min)} xu` : 'Mọi quà';
  return names.slice(0, 2).map(titleCase).join(' · ') + (min ? ` · ≥${fmt(min)} xu` : '');
}

// ----- HÌNH QUÀ TIKTOK: /gifts/gifts.json + hình 96x96 (tải bằng tools/tai-hinh-qua.mjs) -----
// Chưa tải hình, hoặc tên quà không khớp hình nào: vẫn hiện biểu tượng của nghi thức như trước.
const giftCatalog = { version: '', list: [], cache: new Map() };
const normGift = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
fetch('/gifts/gifts.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(d => {
  if (!Array.isArray(d?.gifts)) return;
  giftCatalog.version = String(d.version || '');
  giftCatalog.list = d.gifts.filter(g => g?.file && g.name).map(g => ({ file: String(g.file), keys: [g.name, ...(g.vi || [])].map(normGift).filter(Boolean) }));
  giftCatalog.cache.clear();
  if (currentState) renderGiftMenu(currentState.config || {});
}).catch(() => {});

// Đường dẫn hình của một quà theo tên (tên TikTok hoặc tên tiếng Việt); '' nếu không có.
// So tên như công cụ tải hình: trùng hẳn → khác số ít/số nhiều → là một cụm từ trọn vẹn trong tên quà.
function giftImage(name) {
  const t = normGift(name);
  if (!t || !giftCatalog.list.length) return '';
  if (giftCatalog.cache.has(t)) return giftCatalog.cache.get(t);
  const single = s => s.replace(/s$/, '');
  const { list } = giftCatalog;
  const hit = list.find(g => g.keys.includes(t))
    || list.find(g => g.keys.some(k => single(k) === single(t)))
    || (t.length >= 3 ? list.find(g => g.keys.some(k => ` ${k} `.includes(` ${t} `))) : null);
  const url = hit ? `/gifts/${encodeURIComponent(hit.file)}?v=${giftCatalog.version}` : '';
  giftCatalog.cache.set(t, url);
  return url;
}
// Hình của quà đầu tiên (có hình) trong một luật
function ruleGiftImage(rule) {
  for (const t of String(rule.gifts || '').split(',')) {
    const url = t.trim().startsWith('#') ? '' : giftImage(t);
    if (url) return url;
  }
  return '';
}
// Đặt hình quà vào ô biểu tượng; không có hình (hoặc hình lỗi) thì hiện emoji
function setGiftIcon(el, url, emoji) {
  if (!el) return;
  el.classList.toggle('has-gift-img', Boolean(url));
  if (!url) { el.textContent = emoji; return; }
  const img = new Image();
  img.alt = '';
  img.decoding = 'async';
  img.onerror = () => {
    if (!img.isConnected) return;
    el.classList.remove('has-gift-img');
    el.textContent = emoji;
  };
  img.src = url;
  el.replaceChildren(img);
}

// Tên ngắn, viết thường của từng việc để ghi sau mũi tên trong bảng quà ("→ làm chú rể")
const GIFT_ROW_LABEL = {
  role: 'làm chú rể / cô dâu', groom: 'làm chú rể', bride: 'làm cô dâu', replaceGroom: 'thay chú rể', replaceBride: 'thay cô dâu',
  quickwed: 'động phòng luôn', dongphong: 'động phòng', kiss: 'cô dâu chú rể hôn', cake: 'cắt bánh cưới', champagne: 'rót rượu',
  cheers: 'cụng ly', petal: 'mưa hoa hồng', ring: 'trao nhẫn', dance: 'lên sàn nhảy', cancel: 'hủy hôn, phá đám',
  bouquet: 'tung hoa', fireworks: 'bắn pháo hoa', music: 'đổi nhạc', mc: 'cưới MC', photo: 'chụp ảnh chung', thanks: 'mừng phong bì'
};

// Bảng quà bên phải: mỗi dòng "hình quà → việc sẽ xảy ra", chữ to để người xem trên điện thoại đọc được.
// Quà chưa có hình thì hiện biểu tượng kèm tên quà nhỏ bên dưới.
let lastMenuKey = '';
function renderGiftMenu(c) {
  const list = $('#gift-guide-list');
  if (!list) return;
  const rules = (c.giftRules || []).filter(r => r.action !== 'thanks' && (!ROLE_RULE_ROLE[r.action] || openRolesOf(c).includes(ROLE_RULE_ROLE[r.action])));
  const key = JSON.stringify([rules, c.roleMode, c.enableMarryAuction, giftCatalog.version]);
  if (key === lastMenuKey) return;
  lastMenuKey = key;
  const shown = rules.filter(r => c.enableMarryAuction !== false || !(r.action === 'role' || ROLE_RULE_ROLE[r.action])).slice(0, 16);
  list.classList.toggle('dense', shown.length > 11); // nhiều dòng: thu nhỏ một nấc cho vừa khung
  list.classList.remove('compact');
  list.replaceChildren(...shown.map(r => {
    const info = ACTION_INFO[r.action] || ACTION_INFO.thanks;
    const img = ruleGiftImage(r);
    const item = document.createElement('div');
    item.className = 'gift-guide-item ' + (info.cls || '');
    const ic = document.createElement('div');
    ic.className = 'guide-icon';
    setGiftIcon(ic, img, info.icon);
    const text = document.createElement('div');
    text.className = 'guide-info';
    const b = document.createElement('b');
    b.textContent = `→ ${r.action === 'role' ? roleRuleLabel(c).toLowerCase() : GIFT_ROW_LABEL[r.action] || info.label.toLowerCase()}`;
    text.append(b);
    if (!img) {
      const sub = document.createElement('span');
      sub.textContent = ruleSubtitle(r);
      text.append(sub);
    }
    item.append(ic, text);
    return item;
  }));
}

let lastHowKey = '';
function renderHowTo(c) {
  const ul = $('#howto-list');
  if (!ul) return;
  const min = fmt(Number(c.minCoinsToMarry) || 10);
  const roles = openRolesOf(c);
  const key = JSON.stringify([min, roles, c.enableMarryAuction, c.autoCeremony, c.roleSystem, c.giftRules, c.freeRoles, c.ceremonySteps, c.roleQueue, c.commentRituals, c.attendants]);
  if (key === lastHowKey) return;
  lastHowKey = key;
  // Luật "quà vào vai": bảng này chỉ ghi các bình luận dùng được (quà đã có bảng quà bên phải), mỗi dòng ngắn, chữ to
  const rit = c.commentRituals !== false;
  const lines = [];
  let title = 'BÌNH LUẬN';
  let icon = '💬';
  if (c.roleSystem === 'queue') {
    if (c.enableMarryAuction !== false && c.freeRoles) {
      if (roles.includes('groom')) lines.push(['chú rể', 'làm chú rể', true]);
      if (roles.includes('bride')) lines.push(['cô dâu', 'làm cô dâu', true]);
    } else {
      lines.push(['chúc …', 'vào dự tiệc']);
    }
  } else {
    title = 'CÁCH CHƠI';
    icon = '🎎';
    lines.push(['chúc …', 'vào dự tiệc']);
    if (c.enableMarryAuction !== false) {
      if (roles.includes('groom')) lines.push([`tặng ≥${min} xu`, 'làm chú rể', true]);
      if (roles.includes('bride')) lines.push([roles.length > 1 ? `"làm cô dâu" + ${min} xu` : `tặng ≥${min} xu`, 'làm cô dâu', true]);
      lines.push(['tặng nhiều hơn', 'cướp vai']);
    }
  }
  if (c.attendants !== false && c.enableMarryAuction !== false) lines.push(['phù dâu, phù rể', 'vai phụ', true]);
  if (rit) lines.push(['dzô', 'cụng ly'], ['nhảy', 'cả rạp quẩy'], ['hôn đi', 'cô dâu chú rể hôn']);
  lines.push(['nam / nữ', 'đổi nhân vật']);
  if ($('#howto-title')) $('#howto-title').textContent = title;
  if ($('#howto-icon')) $('#howto-icon').textContent = icon;
  ul.replaceChildren(...lines.map(([b, rest, gold]) => {
    const li = document.createElement('li');
    const bold = document.createElement('b');
    bold.textContent = b;
    const tail = document.createElement('span');
    if (gold) tail.className = 'gold-text';
    tail.textContent = rest;
    li.append(bold, ' → ', tail);
    return li;
  }));
}

// ========================================================
// THẺ VAI & ĐẾM NGƯỢC LỄ THÀNH HÔN
// ========================================================
function renderRoleCard(role, s) {
  const el = $('#medal-' + role);
  if (!el) return;
  const c = s.config || {};
  const holder = s.roles?.[role];
  const open = openRolesOf(c).includes(role) && c.enableMarryAuction !== false;
  // Vai mở mà chưa ai nhận: không hiện tên mặc định, ghi "Đang tìm…"
  const name = holder?.name || (open ? SEEK_TEXT[role] : c[role] || (role === 'groom' ? 'Chú rể' : 'Cô dâu'));
  const min = Number(c.minCoinsToMarry) || 10;
  if (!el.classList.contains('rolling')) { // đang quay tên ghép đôi ngẫu nhiên: chưa lộ người được chọn
    updateAvatar(el.querySelector('.rc-avatar'), holder?.avatar || '', holder || !open ? name : '?');
    el.querySelector('.rc-name').textContent = name;
  }
  el.classList.toggle('held', Boolean(holder));
  el.classList.toggle('closed', !open);
  const queueMode = c.roleSystem === 'queue';
  const waiting = Number(s.queue?.[role + 'Count']) || 0;
  el.querySelector('.rc-bid').textContent = holder
    ? (queueMode ? (c.roleQueue ? `⏳ Hàng chờ: ${waiting} người` : holder.random && !holder.bid ? '🎲 MC chọn ngẫu nhiên' : '💍 Đang giữ vai') : holder.host && !holder.bid ? '👑 Chủ phòng lên vai' : holder.random && !holder.bid ? '🎲 MC chọn ngẫu nhiên' : `💰 ${fmt(holder.bid)} xu`)
    : (open ? '🔎 CHƯA CÓ AI NHẬN VAI' : (role === 'groom' ? 'CHÚ RỂ CHÍNH' : 'CÔ DÂU CHÍNH'));
  let hint = '';
  if (open && queueMode) {
    const take = firstGiftFor(c, role === 'groom' ? ['groom', 'role'] : ['bride']);
    const swap = firstGiftFor(c, [role === 'groom' ? 'replaceGroom' : 'replaceBride']);
    const busy = ['running', 'reception'].includes(s.ceremony?.phase); // đôi này đang làm lễ / vừa cưới: không thay được nữa
    if (holder && !c.roleQueue) {
      // Không hàng chờ: tặng quà nhận vai là lên ngay (đang làm lễ thì tính cho lượt kế)
      hint = s.ceremony?.phase === 'running' ? `Tặng ${take || swap || 'quà'} để giành lượt sau` : `Tặng ${take || swap || 'quà'} để giành ngay!`;
    } else if (holder && busy) hint = take || swap ? `Tặng ${take || swap} để xếp hàng lượt sau` : 'Tặng quà để xếp hàng lượt sau';
    else if (holder) hint = swap ? `Tặng ${swap} để thay ngay!` : (take ? `Tặng ${take} để xếp hàng` : 'Tặng quà để xếp hàng');
    else if (c.freeRoles) hint = `Cmt "${role === 'groom' ? 'chú rể' : 'cô dâu'}" để nhận vai`;
    else hint = take ? `Tặng ${take} để nhận vai` : `Tặng quà để làm ${role === 'groom' ? 'chú rể' : 'cô dâu'}`;
  } else if (open) {
    if (holder) hint = holder.bid + 1 < min ? `Tặng ${fmt(min)} xu để cướp!` : `Tặng > ${fmt(holder.bid)} xu để cướp!`;
    else if (role === 'bride' && openRolesOf(c).length > 1) hint = `Cmt "làm cô dâu" + ${fmt(min)} xu`;
    else hint = `Tặng ${fmt(min)} xu để làm ${role === 'groom' ? 'chú rể' : 'cô dâu'}`;
  }
  el.querySelector('.rc-hint').textContent = hint;
}

function renderStageInfo(s) {
  const c = s.config || {};
  $('#couple-no').textContent = `💒 Cặp đôi số ${fmt(s.coupleNumber || 1)}`;
  const q = s.queue || {};
  const names = (list, count) => {
    const shown = (list || []).slice(0, 2).map(x => x.name);
    return shown.join(', ') + (count > shown.length ? ` +${count - shown.length}` : '');
  };
  const parts = [];
  if (c.roleSystem === 'queue') {
    if (q.groomCount) parts.push(`🤵 ${names(q.groom, q.groomCount)}`);
    if (q.brideCount) parts.push(`👰 ${names(q.bride, q.brideCount)}`);
  }
  $('#queue-text').textContent = parts.length ? `Chờ lên: ${parts.join(' · ')}` : '';
}

let tagPhase = 'idle';
let tagMode = '';
let ceremonyDeadline = 0;
// Tiệc mừng: thẻ trên sân khấu lần lượt nhắc "tặng quà gì → đôi trẻ làm gì" theo bảng luật
const RECEPTION_STEPS = {
  kiss: 'HÔN', cake: 'CẮT BÁNH', champagne: 'RÓT RƯỢU', cheers: 'CỤNG LY', bouquet: 'TUNG HOA',
  fireworks: 'PHÁO HOA', dance: 'QUẨY', petal: 'MƯA HOA', quickwed: 'ĐỘNG PHÒNG', dongphong: 'ĐỘNG PHÒNG'
};
function receptionHint() {
  const hints = [];
  for (const r of cfg().giftRules || []) {
    const gift = RECEPTION_STEPS[r.action] && String(r.gifts || '').split(',').map(t => t.trim()).find(t => t && !t.startsWith('#'));
    if (gift) hints.push(`${titleCase(gift)} → ${RECEPTION_STEPS[r.action]}`);
  }
  return hints.length ? hints[Math.floor(Date.now() / 3500) % hints.length] : 'TẶNG QUÀ CHO ĐÔI TRẺ';
}
// Vừa đủ đôi -> cặp đôi bắn tim. Nếu người nhận vai còn đang đi lên thì chờ họ vẫy tay chào xong.
let pairHeartTimer = null;
let pairHeartPending = false;
function playPairHeart() {
  pairHeartPending = false;
  clearTimeout(pairHeartTimer);
  coupleActor.play('heart', 5200);
}
function renderCeremonyTag(s) {
  const prevPhase = tagPhase;
  tagPhase = s.ceremony?.phase || 'idle';
  if (prevPhase === 'idle' && tagPhase === 'countdown') {
    if (offeringBusy || offeringQueue.length) {
      pairHeartPending = true;
      clearTimeout(pairHeartTimer);
      pairHeartTimer = setTimeout(playPairHeart, 12000);
    } else {
      playPairHeart();
    }
  }
  tagMode = s.ceremony?.mode || '';
  ceremonyDeadline = tagPhase === 'countdown' || tagPhase === 'reception' ? performance.now() + (Number(s.ceremony.remainingMs) || 0) : 0;
  pairDeadline = tagPhase === 'idle' && s.pairing?.remainingMs > 0 ? performance.now() + Number(s.pairing.remainingMs) : 0;
  revengeInfo = s.revenge && s.revenge.remainingMs > 0 ? { ...s.revenge, deadline: performance.now() + Number(s.revenge.remainingMs) } : null;
  updateTag();
}
// ----- CỬA PHỤC THÙ & TỈ SỐ KÈO ĐẤU -----
// A vừa bị B cướp vai: gọi thẳng tên A, đếm giờ đòi lại, chỉ rõ tặng quà gì. Hai người giành qua lại thì hiện tỉ số từng hiệp.
let revengeInfo = null; // { role, loser, loserAvatar, winner, round, loserWins, winnerWins, deadline }
let duelKey = '';
function roleGiftHint(role, s, c) {
  if (c.roleSystem !== 'queue') {
    const h = s.roles?.[role];
    if (h) return { text: `Tặng hơn ${fmt(h.bid)} xu`, img: '' };
  }
  const want = role === 'groom' ? ['replaceGroom', 'groom', 'role'] : ['replaceBride', 'bride', 'role'];
  for (const action of want) {
    const rule = (c.giftRules || []).find(r => r.action === action && (String(r.gifts || '').trim() || action === 'role'));
    if (!rule) continue;
    const gift = String(rule.gifts || '').split(',').map(t => t.trim()).find(t => t && !t.startsWith('#'));
    if (gift) return { text: `Tặng ${titleCase(gift)}`, img: ruleGiftImage(rule) };
    return { text: `Tặng quà từ ${fmt(Number(rule.minCoins) || 1)} xu`, img: '' };
  }
  return { text: 'Tặng quà nhận vai', img: '' };
}
function duelBar() {
  let el = $('#duel-bar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'duel-bar';
    el.innerHTML = '<div class="duel-head"><span class="duel-call"></span><b id="duel-timer"></b></div>'
      + '<div class="duel-body"><span class="duel-av"></span><div class="duel-text"><b></b><span></span></div><div class="duel-gift"></div></div>'
      + '<div class="duel-score"></div>';
    $('#frame').append(el);
  }
  return el;
}
function updateDuelBar() {
  const r = revengeInfo;
  const left = r ? r.deadline - performance.now() : 0;
  const bannerOn = $('#ceremony-alert-banner')?.hidden === false;
  const on = Boolean(r) && left > 0 && !ceremonyRunning && !dpActive && !kickHold && !bannerOn && ['idle', 'countdown'].includes(tagPhase);
  const el = duelBar();
  el.classList.toggle('on', on);
  $('#frame').classList.toggle('duel-on', on);
  if (!on) return;
  const sec = Math.ceil(left / 1000);
  $('#duel-timer').textContent = mmss(sec);
  el.classList.toggle('urgent', sec <= 7);
  const key = JSON.stringify([r.role, r.loser, r.winner, r.round, giftCatalog.version]);
  if (key === duelKey) return;
  duelKey = key;
  const label = r.role === 'groom' ? 'CHÚ RỂ' : 'CÔ DÂU';
  const hint = roleGiftHint(r.role, currentState, cfg());
  el.querySelector('.duel-call').textContent = `🔥 ${String(r.loser).toUpperCase()} ƠI, ĐÒI LẠI ĐI!`;
  updateAvatar(el.querySelector('.duel-av'), r.loserAvatar, r.loser);
  el.querySelector('.duel-text b').textContent = `${r.winner} vừa đá bạn khỏi ghế ${label}`;
  el.querySelector('.duel-text span').textContent = `${hint.text} để phục thù!`;
  setGiftIcon(el.querySelector('.duel-gift'), hint.img, '🥊');
  const score = el.querySelector('.duel-score');
  score.hidden = r.round < 2;
  score.textContent = `⚔️ HIỆP ${r.round} · ${r.winner} ${r.winnerWins} – ${r.loserWins} ${r.loser}`;
}

// ----- BẢNG "AI DÁM PHÁ ĐÁM?" -----
// Vừa đủ đôi, đang đếm ngược tới lễ: hiện thật rõ tặng quà nào để thay chú rể / thay cô dâu / phá đám,
// kèm đồng hồ đếm ngược, cho người xem tranh nhau trước khi lễ bắt đầu.
const CRASH_ACTIONS = [
  { action: 'replaceGroom', role: 'groom', label: 'THAY CHÚ RỂ', emoji: '🥊' },
  { action: 'replaceBride', role: 'bride', label: 'THAY CÔ DÂU', emoji: '🥊' },
  { action: 'cancel', label: 'PHÁ ĐÁM', emoji: '💔' }
];
let crashKey = '';
function crashPanel() {
  let el = $('#crash-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'crash-panel';
    const title = document.createElement('div');
    title.className = 'crash-title';
    const q = document.createElement('span');
    q.textContent = '⚔️ AI DÁM PHÁ ĐÁM CƯỚI NÀY?';
    const timer = document.createElement('b');
    timer.id = 'crash-timer';
    title.append(q, timer);
    const list = document.createElement('div');
    list.className = 'crash-list';
    el.append(title, list);
    $('#frame').append(el);
  }
  return el;
}
function crashItems(s, c) {
  const items = [];
  const open = openRolesOf(c);
  if (c.roleSystem !== 'queue') {
    // Luật đấu giá: tặng nhiều xu hơn người đang giữ vai là cướp được
    for (const role of open) {
      const h = s.roles?.[role];
      if (h) items.push({ label: role === 'groom' ? 'CƯỚP CHÚ RỂ' : 'CƯỚP CÔ DÂU', sub: `đá ${h.name}`, gift: `Tặng hơn ${fmt(h.bid)} xu`, img: '', emoji: '💰' });
    }
  }
  for (const a of CRASH_ACTIONS) {
    const rule = (c.giftRules || []).find(r => r.action === a.action && String(r.gifts || '').trim());
    if (!rule || (a.role && !open.includes(a.role))) continue;
    const gift = String(rule.gifts).split(',').map(t => t.trim()).find(t => t && !t.startsWith('#'));
    items.push({ label: a.label, sub: a.role ? `đá ${roleName(a.role)}` : 'hủy luôn đám cưới', gift: gift ? `Tặng ${titleCase(gift)}` : '', img: ruleGiftImage(rule), emoji: a.emoji });
  }
  if (items.length > 3) items.splice(2, items.length - 3); // nhiều hơn 3 ô: giữ 2 ô đầu và ô cuối (PHÁ ĐÁM)
  return items;
}
// Các ô của bảng "phòng tân hôn sắp khóa cửa": quà động phòng, và (nếu có gán) hai món quà đón em bé
function roomItems(c) {
  const rule = actions => (c.giftRules || []).find(r => actions.includes(r.action) && String(r.gifts || '').trim());
  const giftOf = r => {
    const g = String(r.gifts).split(',').map(t => t.trim()).find(t => t && !t.startsWith('#'));
    return g ? `Tặng ${titleCase(g)}` : '';
  };
  const dp = rule(['quickwed', 'dongphong']);
  if (!dp) return [];
  const items = [{ label: currentState?.ceremony?.party ? 'VÀO PHÒNG NGAY' : 'ĐỘNG PHÒNG', sub: 'làm ông mai, bà mối', gift: giftOf(dp), img: ruleGiftImage(dp), emoji: '🏮' }];
  if (Number(c.babySeconds ?? 15) > 0) {
    for (const [action, label, emoji] of [['babyBoy', 'BÉ TRAI', '👶'], ['babyGirl', 'BÉ GÁI', '🎀']]) {
      const r = rule([action]);
      if (r) items.push({ label, sub: 'lúc cửa phòng đóng', gift: giftOf(r), img: ruleGiftImage(r), emoji });
    }
  }
  return items;
}
function updateCrashPanel() {
  const s = currentState;
  const c = cfg();
  // Đang có bảng thông báo lớn thì nhường chỗ (hai bảng nằm cùng vùng giữa màn hình)
  const bannerOn = $('#ceremony-alert-banner')?.hidden === false;
  const free = Boolean(s) && !ceremonyRunning && !dpActive && !kickHold && !bannerOn && !tw && !ts && c.enableMarryAuction !== false;
  const show = free && tagPhase === 'countdown';
  // Tiệc mừng: phòng tân hôn chỉ mở tới hết giờ. Ai tặng quà động phòng trước là ông mai / bà mối tiễn đôi trẻ vào phòng;
  // không ai tặng thì phòng khóa cửa, đôi trẻ lỡ phòng.
  const room = free && tagPhase === 'reception';
  const items = show ? crashItems(s, c) : room ? roomItems(c) : [];
  const el = crashPanel();
  const on = items.length > 0;
  el.classList.toggle('on', on);
  if (!on) return;
  const sec = Math.max(0, Math.ceil((ceremonyDeadline - performance.now()) / 1000));
  $('#crash-timer').textContent = mmss(sec);
  el.classList.toggle('urgent', sec <= 10);
  el.dataset.mode = room ? 'room' : 'crash';
  // Tiệc mừng tự diễn: hết giờ đôi trẻ tự vào phòng; quà động phòng là tiễn vào ngay (làm ông mai, bà mối)
  const partyOn = Boolean(s.ceremony?.party);
  el.querySelector('.crash-title span').textContent = !room ? '⚔️ AI DÁM PHÁ ĐÁM CƯỚI NÀY?' : partyOn ? '🏮 SẮP VÀO PHÒNG TÂN HÔN!' : '🏮 PHÒNG TÂN HÔN SẮP KHÓA CỬA!';
  const key = JSON.stringify([items, giftCatalog.version]);
  if (key === crashKey) return;
  crashKey = key;
  el.querySelector('.crash-list').replaceChildren(...items.map(it => {
    const item = document.createElement('div');
    item.className = 'crash-item';
    const icon = document.createElement('div');
    icon.className = 'crash-icon';
    setGiftIcon(icon, it.img, it.emoji);
    const label = document.createElement('b');
    label.textContent = it.label;
    const sub = document.createElement('span');
    sub.textContent = it.sub;
    const gift = document.createElement('i');
    gift.textContent = it.gift;
    item.append(icon, label, sub, gift);
    return item;
  }));
}

let pairDeadline = 0; // còn bao lâu nữa MC ghép đôi ngẫu nhiên
// Vài vị khách hô "sáu bảy" kèm động tác hai tay nâng lên hạ xuống
let sixSevenAt = 0;
function sixSevenShout() {
  sixSevenAt = performance.now();
  const ids = Array.from(guestNodes.keys()).sort(() => Math.random() - 0.5).slice(0, 3);
  ids.forEach((id, i) => setTimeout(() => {
    showChatBubble(id, ['Sáu bảy! 🤲', 'SÁU BẢYYY 🤲', 'Six seven! 🤲', 'Sáu... bảy! 😂'][i % 4]);
    guestReact(guestNodes.get(id), 'hop');
  }, i * 260));
  sfx(ctx => { tone(ctx, { freq: 520, type: 'square', dur: 0.12, gain: 0.05 }); tone(ctx, { freq: 660, type: 'square', at: 0.16, dur: 0.16, gain: 0.05 }); });
}
const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
function updateTag() {
  updateCrashPanel();
  updateDuelBar();
  const tag = $('#groom-status-tag');
  if (!tag) return;
  const span = tag.querySelector('span');
  const pairSec = tagPhase === 'idle' && pairDeadline ? Math.ceil((pairDeadline - performance.now()) / 1000) : 0;
  tag.classList.toggle('countdown', tagPhase === 'countdown' || tagPhase === 'reception' || pairSec > 0);
  tag.classList.toggle('running', tagPhase === 'running');
  // Trend "sáu bảy": đồng hồ chạm 7 rồi 6 giây thì vài vị khách buột miệng hô, đúng kiểu ngoài đời cứ thấy hai số này là hô
  // (mỗi lần đếm ngược một lượt; đang có biến cố thì thôi). Đồng hồ vẫn giữ nguyên chữ.
  const six7 = tagPhase === 'countdown' && !tw && [7, 6].includes(Math.ceil((ceremonyDeadline - performance.now()) / 1000));
  if (tagPhase === 'countdown') {
    const sec = Math.max(0, Math.ceil((ceremonyDeadline - performance.now()) / 1000));
    span.textContent = `💒 LỄ THÀNH HÔN SAU ${mmss(sec)}`;
    if (six7 && performance.now() - sixSevenAt > 12000) sixSevenShout();
  } else if (tagPhase === 'reception') {
    const sec = Math.max(0, Math.ceil((ceremonyDeadline - performance.now()) / 1000));
    span.textContent = `🎁 ${receptionHint()} · ${mmss(sec)}`;
  } else if (tagPhase === 'running') {
    span.textContent = tagMode === 'farewell' ? '🎉 TIỄN ĐÔI TRẺ VỀ CHUNG MỘT NHÀ' : tagMode === 'quick' ? '🏮 ĐỘNG PHÒNG HOA CHÚC' : '💒 ĐANG LÀM LỄ THÀNH HÔN';
  } else {
    const c = cfg();
    const seekG = roleSearching('groom');
    const seekB = roleSearching('bride');
    const married = marriageStage() === 'married';
    if (pairSec > 0) span.textContent = seekG && seekB ? `🎲 MC MỜI KHÁCH LÊN SÂN KHẤU SAU ${mmss(pairSec)}` : `🎲 ${seekB ? 'TÌM CÔ DÂU' : 'TÌM CHÚ RỂ'} · MC CHỌN NGẪU NHIÊN SAU ${mmss(pairSec)}`;
    else if (married) span.textContent = '🥂 TIỆC MỪNG TÂN HÔN';
    else if (seekG && seekB) span.textContent = '💍 ĐANG TÌM CÔ DÂU & CHÚ RỂ';
    else if (seekG || seekB) span.textContent = seekG ? '🤵 ĐANG TÌM CHÚ RỂ' : '👰 ĐANG TÌM CÔ DÂU';
    else span.textContent = c.autoCeremony !== false && c.enableMarryAuction !== false ? '💍 CHỜ ĐỦ ĐÔI ĐỂ LÀM LỄ' : '👑 TIỆC CƯỚI HỶ SỰ';
  }
}
setInterval(updateTag, 250);

// ========================================================
// VẼ TOÀN BỘ TRẠNG THÁI
// ========================================================
let firstBuild = '';
function renderState(s) {
  // App vừa khởi động lại (có thể đã cập nhật giao diện): tải lại trang, trừ lúc đang làm lễ / động phòng
  if (s.build) {
    if (!firstBuild) firstBuild = s.build;
    else if (s.build !== firstBuild && !ceremonyRunning && !dpActive) { location.reload(); return; }
  }
  // Nhớ người vừa mất vai (bị cướp/thay) để hiệu ứng văng khỏi sân khấu gắn đúng tên, avatar
  for (const r of ['groom', 'bride']) {
    const old = currentState?.roles?.[r];
    if (old && old.id !== s.roles?.[r]?.id) ousted[r] = old;
  }
  if (kickHold) {
    if (Date.now() > kickHold.until) kickHold = null;
    else {
      s.rawRoles = s.roles;
      s.roles = { groom: s.roles?.groom || kickHold.roles.groom, bride: s.roles?.bride || kickHold.roles.bride };
    }
  }
  currentState = s;
  const c = s.config || {};
  const stats = s.stats || {};
  const goals = s.goals || {};

  $('#wedding-title').textContent = c.title || 'TIỆC CƯỚI ONLINE';
  renderCoupleLabel(s);

  $('#stat-guests').textContent = `${fmt(stats.guests || 0)} khách`;
  $('#stat-envelopes').textContent = `${fmt(stats.envelopes || 0)} phong bì`;
  $('#stat-wishes').textContent = `${fmt(stats.wishes || 0)} lời chúc`;
  $('#stat-couples').textContent = `${fmt(stats.couples || 0)} cặp cưới`;
  const party = s.party || {};
  $('#metric-party').hidden = !party.every;
  if (party.every) $('#stat-party').textContent = `còn ${fmt(party.left || party.every)} cặp tới tiệc`;

  for (const k of ['rose', 'cake']) {
    const g = goals[k];
    if (!g) continue;
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    $(`#goal-${k}-fill`).style.width = `${pct}%`;
    $(`#goal-${k}-num`).textContent = `${fmt(g.current)}/${fmt(g.target)}${k === 'cake' ? ' xu' : ''}`;
    if (g.label) $(`#goal-${k}-label`).textContent = g.label;
    // Mục tiêu chưa ai góp thì ẩn: thanh tim chiếm cả hàng, to rõ
    document.querySelector(`.goal-${k}`)?.classList.toggle('idle', !(g.current > 0));
  }

  const lk = s.likes || {};
  const lpct = lk.goal ? Math.min(100, Math.round(((lk.progress || 0) / lk.goal) * 100)) : 0;
  $('#goal-like-fill').style.width = `${lpct}%`;
  $('#goal-like-num').textContent = `${fmt(lk.progress || 0)}/${fmt(lk.goal || 5000)}`;
  renderStageInfo(s);
  const host = $('#mc-host');
  if (host) host.hidden = c.showMC === false;
  $('#registry-unit').textContent = c.moneyUnit === 'chỉ vàng' ? '1 xu = 1 chỉ' : '';

  renderRoleCard('groom', s);
  renderRoleCard('bride', s);
  renderCeremonyTag(s);
  applyTheme(c);
  updateScene();
  updateSolo(s);
  renderGuests(s.people || []);
  renderRegistry(s.scores || {});
  renderGiftMenu(c);
  renderHowTo(c);
  applyBgm();
  twistSync(s.twist);
  moonSync(s.moon);
  tossSync(s.toss);
  renderAttendants(s);
  const onStage = s.rawRoles || s.roles || {};
  if (!tw && (s.ceremony?.phase || 'idle') === 'idle' && !onStage.groom && !onStage.bride) twistTurnOver();
}

// ========================================================
// BANNER, THÔNG BÁO, BONG BÓNG CHAT
// ========================================================
let ceremonyTimer = null;
// Bảng thông báo lớn giữa màn hình. kicker = dòng nhãn nhỏ phía trên (vd "🔁 THAY CHÚ RỂ!") khi tiêu đề là một cái tên.
let bannerHoldScale = 1; // > 1 khi đang diễn hành động của một món quà lớn: bảng thông báo đứng lâu hơn một chút
function showCeremonyBanner(title, subtitle, type = 'gold', durationMs = 5500, kicker = '') {
  const banner = $('#ceremony-alert-banner');
  if (!banner) return;
  // Biến cố đang diễn: bảng thử thách đang nằm đúng chỗ này. Bảng tin của các món quà tặng lúc đó (mưa hoa, hôn, pháo hoa...)
  // nhường chỗ, hiệu ứng của quà vẫn chạy. Bảng tin kết cục của chính biến cố thì hiện sau khi biến cố đã khép (tw.ended).
  if (tw && !tw.ended) return;
  if (ts?.open) return; // đang tung hoa: bảng "gõ chụp" nằm đúng chỗ này
  durationMs = Math.round(durationMs * bannerHoldScale);
  // Đưa bảng ra lớp ngoài cùng của khung hình (không nằm trong sân khấu) để to được và không bị các bảng khác che
  if (banner.parentElement !== $('#frame')) $('#frame').append(banner);
  $('#ceremony-title').textContent = title;
  $('#ceremony-subtitle').textContent = subtitle || '';
  const spark = banner.querySelector('.ceremony-sparkles');
  if (spark) spark.textContent = kicker || '✨ 💍 ✨';
  banner.classList.toggle('has-kicker', Boolean(kicker));
  const len = [...String(title)].length;
  banner.dataset.size = len <= 12 ? 'xl' : len <= 22 ? 'l' : len <= 34 ? 'm' : 's';
  banner.className = `ceremony-alert type-${type}${kicker ? ' has-kicker' : ''}`;
  banner.hidden = false;
  banner.style.animation = 'none';
  void banner.offsetWidth;
  banner.style.animation = '';
  clearTimeout(ceremonyTimer);
  ceremonyTimer = setTimeout(() => { banner.hidden = true; }, durationMs);
}

function showToast(text, avatarUrl, name) {
  const toast = $('#footer-toast');
  const txt = $('#toast-text');
  const av = $('#toast-avatar');
  if (!toast || !txt) return;
  txt.textContent = text;
  if (av) {
    if (name) updateAvatar(av, avatarUrl, name);
    else { av.dataset.avKey = ''; av.textContent = '👰'; }
  }
  toast.style.animation = 'none';
  void toast.offsetWidth;
  toast.style.animation = 'toast-glow 3s infinite alternate';
}

// Bình luận THẬT của người xem: ô trắng chữ to, nằm ở lớp trên cùng ngay phía trên đầu nhân vật của họ
// (không bị khách đứng trước che, không nhỏ đi theo hàng xa gần). Lời bâng quơ của rạp vẫn dùng ô nhỏ gắn trên nhân vật.
// Người bình luận đang là cô dâu / chú rể: trả về vai của họ
function roleOfPerson(personId) {
  return ['groom', 'bride'].find(r => 'tik-' + currentState?.roles?.[r]?.id === personId) || '';
}
// Chỗ đầu của cô dâu / chú rể trên sân khấu (tọa độ khung 1080x1920); null nếu lúc này họ không đứng trên sân khấu
const STAGE_HEAD = { groom: { x: 0.66, y: 0.03 }, bride: { x: 0.36, y: 0.1 } }; // vị trí đầu trong khung hình cặp đôi
function stageHead(role) {
  if (dpActive) return null;
  const frame = $('#frame');
  const solo = hasSolo() && $('#couple-wrapper')?.classList.contains('solo-mode');
  const el = solo ? $(`#solo-${role}`) : $('#couple-sprite');
  if (!frame || !el) return null;
  const fr = frame.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = fr.width / 1080;
  if (!k || r.width < 5 || r.height < 5) return null;
  const at = STAGE_HEAD[role];
  return { x: (r.left - fr.left + r.width * at.x) / k, y: (r.top - fr.top + r.height * at.y) / k };
}
function chatLayer() {
  let layer = $('#chat-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'chat-layer';
    $('#frame').append(layer);
  }
  return layer;
}
// Cô dâu / chú rể bình luận: ô trắng hiện ngay trên đầu họ ở sân khấu (kèm tên), không phải ở nhân vật khách dưới rạp
function showRoleComment(personId, role, text) {
  const head = stageHead(role);
  if (!head) return false;
  const layer = chatLayer();
  layer.querySelector(`[data-id="${CSS.escape(personId)}"]`)?.remove();
  while (layer.childElementCount >= 4) layer.firstElementChild.remove();
  wanderers.get(personId)?.node.querySelector('.wedding-chat-bubble')?.remove();
  const bubble = document.createElement('div');
  bubble.className = `live-comment from-role role-${role}`;
  bubble.dataset.id = personId;
  const who = document.createElement('small');
  who.textContent = `${role === 'groom' ? '🤵 Chú rể' : '👰 Cô dâu'} ${currentState?.roles?.[role]?.name || ''}`;
  const say = document.createElement('span');
  say.textContent = text;
  bubble.append(who, say);
  // Cô dâu đứng bên trái nên ô ngả sang trái, chú rể ngả sang phải; đuôi ô vẫn chỉ vào đầu người nói
  const cx = Math.min(790, Math.max(290, head.x + (role === 'groom' ? 110 : -110)));
  bubble.style.left = `${cx}px`;
  let top = head.y - 14;
  layer.append(bubble);
  // Người kia cũng vừa nói: xếp ô mới lên trên ô của họ, không đè lên nhau
  const other = layer.querySelector(`.live-comment.from-role:not([data-id="${CSS.escape(personId)}"]):not(.out)`);
  if (other) top = Math.min(top, parseFloat(other.style.top) - other.offsetHeight - 16);
  bubble.style.top = `${top}px`;
  const maxTail = Math.max(0, bubble.offsetWidth / 2 - 36);
  bubble.style.setProperty('--tail', `${Math.round(Math.max(-maxTail, Math.min(maxTail, head.x - cx)))}px`);
  setTimeout(() => bubble.classList.add('out'), 4800);
  setTimeout(() => bubble.remove(), 5200);
  return true;
}
function showComment(personId, comment, retried = false) {
  const text = String(comment || '').trim().slice(0, 90);
  if (!text) return;
  const role = roleOfPerson(personId);
  if (role && showRoleComment(personId, role, text)) return;
  const w = wanderers.get(personId);
  if (!w) {
    // Người này vừa bình luận lần đầu: nhân vật của họ chưa kịp hiện trong rạp, chờ một nhịp rồi hiện ô bình luận
    if (!retried) setTimeout(() => showComment(personId, comment, true), 700);
    return;
  }
  const layer = chatLayer();
  layer.querySelector(`[data-id="${CSS.escape(personId)}"]`)?.remove();
  while (layer.childElementCount >= 4) layer.firstElementChild.remove();
  w.node.querySelector('.wedding-chat-bubble')?.remove();
  wanderHold(personId, 3800);
  const p = wanderPos(w);
  const bubble = document.createElement('div');
  bubble.className = 'live-comment';
  bubble.dataset.id = personId;
  bubble.textContent = text;
  // Mép ô không tràn khỏi màn hình: tâm ô nằm trong khoảng 290..790
  bubble.style.left = `${Math.min(790, Math.max(290, p.x))}px`;
  bubble.style.top = `${p.y - w.box.h * depthScale(p.y) - 34}px`;
  bubble.style.setProperty('--tail', `${Math.round(p.x - Math.min(790, Math.max(290, p.x)))}px`);
  layer.append(bubble);
  setTimeout(() => bubble.classList.add('out'), 4300);
  setTimeout(() => bubble.remove(), 4700);
}

function showChatBubble(personId, comment, { hold = true } = {}) {
  const node = guestNodes.get(personId);
  if (!node) return;
  node.querySelector('.wedding-chat-bubble')?.remove();
  const bubble = document.createElement('div');
  bubble.className = 'wedding-chat-bubble';
  bubble.textContent = String(comment).slice(0, 60);
  node.append(bubble);
  if (hold) wanderHold(personId, 2600); // đứng lại nói cho người xem kịp đọc
  setTimeout(() => bubble.remove(), 4200);
}

// ========================================================
// HẠT HIỆU ỨNG
// ========================================================
function spawnPetals() {
  if (cfg().showRosePetals === false) return;
  const layer = $('#petals');
  if (!layer || layer.childElementCount > 30) return;
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'falling-rose-petal';
    p.style.left = `${30 + Math.random() * 1020}px`;
    const dur = 7 + Math.random() * 5;
    p.style.animationDuration = `${dur}s`;
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 240}px`);
    p.style.setProperty('--turn', `${(Math.random() - 0.5) * 600}deg`);
    layer.append(p);
    setTimeout(() => p.remove(), dur * 1000);
  }
}
setInterval(spawnPetals, 1800);

function spawnPetalsBurst(count = 40) {
  const layer = $('#petals');
  if (!layer) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'falling-rose-petal';
    p.style.left = `${20 + Math.random() * 1040}px`;
    const dur = 4 + Math.random() * 4;
    p.style.animationDuration = `${dur}s`;
    p.style.animationDelay = `${i * 0.04}s`;
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 300}px`);
    p.style.setProperty('--turn', `${(Math.random() - 0.5) * 720}deg`);
    layer.append(p);
    setTimeout(() => p.remove(), (dur + 1 + i * 0.04) * 1000);
  }
}

function spawnHearts(count = 8, { x = 540, y = 820, spread = 360, emojis } = {}) {
  if (cfg().showHearts === false) return;
  const layer = $('#hearts-layer');
  if (!layer) return;
  const hearts = emojis || ['💕', '💖', '💗', '💓', '💘', '💍'];
  for (let i = 0; i < count; i++) {
    const h = document.createElement('div');
    h.className = 'flying-heart';
    h.textContent = pick(hearts);
    h.style.left = `${x - spread / 2 + Math.random() * spread}px`;
    h.style.top = `${y + (Math.random() - 0.5) * 80}px`;
    h.style.animationDelay = `${i * 0.08}s`;
    layer.append(h);
    setTimeout(() => h.remove(), 2600 + i * 80);
  }
}

function spawnBubbles(gold = false) {
  if (!gold && cfg().showBubbles === false) return;
  const layer = $('#bubbles-layer');
  if (!layer || (!gold && layer.childElementCount > 12)) return;
  const b = document.createElement('div');
  b.className = 'floating-bubble' + (gold ? ' gold' : '');
  const size = 22 + Math.floor(Math.random() * 32);
  b.style.width = `${size}px`;
  b.style.height = `${size}px`;
  b.style.left = `${gold ? 380 + Math.random() * 320 : 60 + Math.random() * 960}px`;
  const dur = gold ? 3 + Math.random() * 2 : 6 + Math.random() * 4;
  b.style.animationDuration = `${dur}s`;
  b.style.setProperty('--drift', `${(Math.random() - 0.5) * 150}px`);
  layer.append(b);
  setTimeout(() => b.remove(), dur * 1000);
}
setInterval(() => spawnBubbles(false), 950);

// ========================================================
// BIẾN TẤU HIỆU ỨNG: các cảnh lặp lại mỗi lượt cưới (mở lễ, trao nhẫn, tuyên bố thành hôn, tiễn đôi trẻ)
// mỗi lần bốc một kiểu khác, không dùng lại kiểu vừa diễn. Chỉ dùng hiệu ứng "miễn phí": không hôn, cắt bánh,
// pháo hoa lớn, sàn nhảy... (mấy cảnh đó để dành cho quà).
// ========================================================
const lastVariants = {};
function pickFresh(key, list) {
  const recent = lastVariants[key] || [];
  const pool = list.map((_, i) => i).filter(i => !recent.includes(i));
  const idx = pick(pool.length ? pool : list.map((_, i) => i));
  lastVariants[key] = [idx, ...recent].slice(0, list.length >= 4 ? 2 : 1);
  return list[idx];
}
// Mưa biểu tượng rơi từ trên xuống khắp khung hình
function emojiRain(emojis, count = 36, ms = 4200) {
  if (cfg().showHearts === false) return;
  const layer = $('#hearts-layer');
  if (!layer) return;
  for (let i = 0; i < count; i++) {
    const e = document.createElement('div');
    e.className = 'fx-rain';
    e.textContent = pick(emojis);
    e.style.left = `${20 + Math.random() * 1040}px`;
    e.style.fontSize = `${30 + Math.random() * 30}px`;
    layer.append(e);
    const drift = (Math.random() - 0.5) * 260;
    const turn = (Math.random() - 0.5) * 540;
    const dur = ms * (0.75 + Math.random() * 0.5);
    const a = e.animate([
      { transform: 'translate(0, -80px) rotate(0deg)', opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.8 },
      { transform: `translate(${drift}px, ${1250 + Math.random() * 600}px) rotate(${turn}deg)`, opacity: 0 }
    ], { duration: dur, delay: Math.random() * ms * 0.45, easing: 'cubic-bezier(0.3, 0.1, 0.7, 1)', fill: 'both' });
    a.onfinish = () => e.remove();
    setTimeout(() => e.remove(), ms * 2 + 500);
  }
}
// Vòng biểu tượng bung ra từ chỗ cặp đôi
function heartRing(emojis = ['💖', '💗', '💕'], n = 14, x = 540, y = 860) {
  if (cfg().showHearts === false) return;
  const layer = $('#hearts-layer');
  if (!layer) return;
  for (let i = 0; i < n; i++) {
    const e = document.createElement('div');
    e.className = 'fx-rain';
    e.textContent = pick(emojis);
    e.style.left = `${x - 20}px`;
    e.style.top = `${y - 20}px`;
    e.style.fontSize = '38px';
    layer.append(e);
    const ang = (i / n) * Math.PI * 2;
    const dist = 250 + Math.random() * 90;
    const a = e.animate([
      { transform: 'translate(0, 0) scale(0.3)', opacity: 0 },
      { transform: `translate(${Math.cos(ang) * dist * 0.55}px, ${Math.sin(ang) * dist * 0.55}px) scale(1.25)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(0.8)`, opacity: 0 }
    ], { duration: 1700, easing: 'ease-out', fill: 'both' });
    a.onfinish = () => e.remove();
    setTimeout(() => e.remove(), 2500);
  }
}
// Chớp sáng cả khung hình
function screenFlash(color = '#ffffff') {
  const f = document.createElement('div');
  f.className = 'fx-flash';
  f.style.background = color;
  $('#fireworks-layer')?.append(f);
  const a = f.animate([{ opacity: 0 }, { opacity: 0.6, offset: 0.2 }, { opacity: 0 }], { duration: 750, easing: 'ease-out', fill: 'both' });
  a.onfinish = () => f.remove();
  setTimeout(() => f.remove(), 1200);
}
// Hai luồng đèn sân khấu quét qua cặp đôi
function spotlights(ms = 3400) {
  const layer = $('#fireworks-layer');
  if (!layer) return;
  [[250, -26, 20], [830, 26, -20]].forEach(([x, from, to]) => {
    const b = document.createElement('div');
    b.className = 'fx-beam';
    b.style.left = `${x - 160}px`;
    layer.append(b);
    const a = b.animate([
      { transform: `rotate(${from}deg)`, opacity: 0 },
      { transform: `rotate(${(from + to) / 2}deg)`, opacity: 1, offset: 0.25 },
      { transform: `rotate(${to}deg)`, opacity: 1, offset: 0.6 },
      { transform: `rotate(${from / 2}deg)`, opacity: 0 }
    ], { duration: ms, easing: 'ease-in-out', fill: 'both' });
    a.onfinish = () => b.remove();
    setTimeout(() => b.remove(), ms + 500);
  });
}
// Vài chùm tia sáng nhỏ (nhẹ hơn hẳn quà pháo hoa: ít chùm, không đổi phông, tiếng lấp lánh thay tiếng nổ)
function sparkBursts(n = 3) {
  const layer = $('#fireworks-layer');
  if (!layer) return;
  const colors = ['#ffd700', '#ff8fab', '#ffffff', '#ffc2d1'];
  for (let k = 0; k < n; k++) {
    setTimeout(() => {
      const color = pick(colors);
      const burst = document.createElement('div');
      burst.className = 'fw-burst';
      burst.style.left = `${220 + Math.random() * 640}px`;
      burst.style.top = `${330 + Math.random() * 330}px`;
      for (let i = 0; i < 26; i++) {
        const sp = document.createElement('i');
        const ang = (i / 26) * Math.PI * 2;
        const dist = 90 + Math.random() * 70;
        sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
        sp.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
        sp.style.background = color;
        sp.style.boxShadow = `0 0 8px ${color}`;
        burst.append(sp);
      }
      layer.append(burst);
      playTwinkle();
      setTimeout(() => burst.remove(), 1900);
    }, k * 480);
  }
}

// Mở lễ
const OPENINGS = [
  { title: '💒 LỄ THÀNH HÔN BẮT ĐẦU', type: 'marry', run() { playWeddingBell(); spawnHearts(16); spawnPetalsBurst(25); } },
  { title: '🔔 GIỜ LÀNH ĐÃ ĐIỂM!', type: 'gold', run() { playWeddingBell(); screenFlash('#fff6d8'); spotlights(3400); emojiRain(['✨', '🌟', '💫'], 26, 3600); guestsReact(14, ['look', 'clap']); } },
  { title: '🎊 CÔ DÂU CHÚ RỂ RA MẮT!', type: 'marry', run() { playFanfare(); emojiRain(['🎊', '🎉', '🎀', '✨'], 40); coupleDo(['wave'], 3000); guestsReact(18, ['hop', 'clap', 'wave']); } },
  { title: '💘 ĐÁM CƯỚI BẮT ĐẦU RỒI!', type: 'bride', run() { playChime(); playWeddingBell(); heartRing(); emojiRain(['💖', '💗', '💕', '💘'], 30); spawnPetalsBurst(18); } },
  { title: '🌟 KHAI MÀN LỄ CƯỚI!', type: 'gold', run() { playFanfare(); sparkBursts(3); spawnHearts(14, { emojis: ['🌟', '💖', '✨'] }); guestsReact(16, ['hop', 'look']); } }
];
// Sau khi hai chiếc nhẫn bay tới cặp đôi
const RING_FINISHES = [
  () => spawnHearts(18, { x: 540, y: 860, spread: 240, emojis: ['✨', '💍', '💖', '🌟'] }),
  () => { heartRing(['💍', '✨', '💖'], 12); screenFlash('#fff6d8'); },
  () => { emojiRain(['💍', '✨', '💎'], 22, 3000); spawnHearts(10, { x: 540, y: 860, spread: 200 }); },
  () => { sparkBursts(2); spawnHearts(12, { x: 540, y: 860, spread: 240, emojis: ['💍', '💖'] }); }
];
// Tuyên bố thành hôn
const WED_DONES = [
  { title: (g, b) => `💍 ${g} & ${b} NÊN VỢ NÊN CHỒNG!`, type: 'marry', acts: ['wave'], run() { playFanfare(); spawnPetalsBurst(40); spawnHearts(18, { emojis: ['💍', '💖', '🎉', '✨'] }); guestsReact(24, ['clap', 'hop', 'clap']); } },
  { title: (g, b) => `🎉 ${g} & ${b} CHÍNH THỨC VỀ MỘT NHÀ!`, type: 'gold', acts: ['heart', 'wave'], run() { playFanfare(); screenFlash('#ffe3ee'); emojiRain(['🎊', '🎉', '💖', '✨'], 44); guestsReact(24, ['hop', 'wave', 'clap']); } },
  { title: (g, b) => `💞 ${g} & ${b} ĐÃ LÀ CỦA NHAU!`, type: 'bride', acts: ['heart', 'wave'], run() { playWeddingBell(); playChime(); heartRing(['💞', '💗', '💓'], 16); emojiRain(['💞', '💗', '💓'], 28); spawnPetalsBurst(24); guestsReact(20, ['clap', 'look', 'hop']); } },
  { title: (g, b) => `👰🤵 TÂN LANG TÂN NƯƠNG: ${g} & ${b}!`, type: 'marry', acts: ['wave'], run() { playFanfare(); spotlights(3600); sparkBursts(4); spawnHearts(16, { emojis: ['🌟', '💍', '✨'] }); guestsReact(24, ['hop', 'clap']); } },
  { title: (g, b) => `🥳 ${g} & ${b} HẾT Ế RỒI BÀ CON ƠI!`, type: 'gold', acts: ['bow', 'wave'], run() { playPop(); playFanfare(); emojiRain(['🥳', '🎈', '🎊', '💍'], 40); guestsReact(26, ['hop', 'hop', 'clap']); } }
];
// Tiễn đôi trẻ
const FAREWELLS = [
  { title: (g, b) => `🎉 ${g} & ${b} VỀ CHUNG MỘT NHÀ!`, acts: ['bow', 'wave'], run() { playFanfare(); spawnPetalsBurst(40); guestsReact(20, ['clap', 'wave', 'hop']); } },
  { title: (g, b) => `👋 TẠM BIỆT ${g} & ${b}!`, acts: ['wave', 'bow'], run() { playChime(); playFanfare(); emojiRain(['👋', '💐', '💖', '✨'], 30); guestsReact(22, ['wave', 'wave', 'clap']); } },
  { title: (g, b) => `🚗 ${g} & ${b} LÊN XE HOA!`, acts: ['wave', 'bow'], run() { playPop(); playFanfare(); emojiRain(['🚗', '🎀', '🎉', '💨'], 28); guestsReact(20, ['hop', 'wave']); } },
  { title: (g, b) => `💐 TIỄN ĐÔI TRẺ ${g} & ${b}!`, acts: ['bow', 'wave'], run() { playWeddingBell(); heartRing(['💐', '💖', '🌸'], 14); spawnPetalsBurst(30); guestsReact(20, ['clap', 'look', 'wave']); } }
];

// ========================================================
// NGHI THỨC
// ========================================================
let kissTimeout = null;
function triggerKiss(silent = false) {
  const sprite = $('#couple-sprite');
  if (sprite) {
    sprite.classList.remove('couple-idle');
    sprite.classList.add('couple-kissing');
    clearTimeout(kissTimeout);
    kissTimeout = setTimeout(() => {
      sprite.classList.remove('couple-kissing');
      sprite.classList.add('couple-idle');
    }, 4500);
  }
  coupleActor.play('kiss', 4500);
  if (!silent) {
    showCeremonyBanner('💋 CÔ DÂU CHÚ RỂ TRAO NỤ HÔN!', 'Tình nồng ý thắm gắn kết trọn đời!', 'kiss');
    guestsReact(12, ['clap', 'hop', 'look']);
    playBgFx('gift');
  }
  spawnHearts(20);
  playWeddingBell();
}

function triggerCheers(initiator = '') {
  coupleDo(['cheers', 'wave'], 4500);
  playClink();
  $$('.wedding-guest').forEach(g => {
    g.classList.add('cheering');
    setTimeout(() => g.classList.remove('cheering'), 2500);
  });
  showCeremonyBanner('🍻 1 2 3 DZÔ! CẠN LY CHÚC MỪNG!', `${initiator ? initiator + ' mời: ' : ''}Cạn ly 100% chúc tân lang tân nương!`, 'cheers');
  showToast(`🥂 ${initiator ? initiator + ' mời: ' : ''}1 2 3 DZÔ! Cạn ly chúc mừng! 🍻`);
}

let discoTimer = null;
function startDisco(ms) {
  const layer = $('#disco-layer');
  if (!layer) return;
  layer.classList.add('on');
  clearTimeout(discoTimer);
  discoTimer = setTimeout(() => layer.classList.remove('on'), ms);
}

function guestsDance(ms) {
  $$('.wedding-guest').forEach(g => {
    g.classList.add('dancing');
    setTimeout(() => g.classList.remove('dancing'), ms);
  });
  wanderTick(); // đang đi thì dừng lại nhảy tại chỗ
}

function triggerDance(initiator = '', { big = false, goal = 0, couples = 0 } = {}) {
  const ms = big ? 8000 : 5000;
  if (!big) coupleDo(['dance', 'wave'], ms);
  playPartyScene(ms);
  guestsDance(ms);
  startDisco(ms + 200);
  playDanceBeat(ms / 1000);
  setDuck('dance', 0.2);
  setTimeout(() => setDuck('dance', null), ms + 200);
  if (big) {
    coupleActor.play('heart', 5200);
    showCeremonyBanner('💃 CẢ RẠP ĐỨNG DẬY QUẨY!', couples ? `Mừng cặp cưới thứ ${fmt(couples)}! 🎉` : goal ? `Đủ ${fmt(goal)} tim rồi bà con ơi! 🎉` : 'Quẩy hết mình nào!', 'dance', ms - 300);
    spawnHearts(20, { x: 540, y: 1200, spread: 700, emojis: ['❤️', '💃', '🕺', '🎶', '✨'] });
    showToast(couples ? `🎉 Cặp thứ ${fmt(couples)} cưới xong! Cả rạp mở tiệc quẩy!` : '💃 Đủ tim rồi! Cả rạp đứng dậy quẩy! ❤️');
    return;
  }
  showCeremonyBanner('💃 CẢ HỘI TRƯỜNG QUẨY TƯNG BỪNG! 🎉', `${initiator ? initiator + ' khuấy động: ' : ''}Hòa nhịp đón mừng ngày vui!`, 'dance');
  showToast('💃 Cả hội trường cùng quẩy tưng bừng! 🎉');
}

function triggerCake() {
  playFanfare();
  spawnHearts(16, { emojis: ['🎂', '🍰', '💕', '✨'] });
  if (!coupleActor.play('cake', 4800)) triggerKiss(true);
  playBgFx('gift');
  showCeremonyBanner('🎂 NGHI THỨC CẮT BÁNH CƯỚI!', 'Tân lang & tân nương cùng cắt bánh ngọt ngào!', 'cake');
  showToast('🎂 Nghi thức cắt bánh cưới hạnh phúc viên mãn! 💕');
}

function triggerChampagne() {
  coupleDo(['cheers', 'wave'], 4500);
  playPop();
  setTimeout(playClink, 350);
  for (let i = 0; i < 18; i++) setTimeout(() => spawnBubbles(true), i * 90);
  spawnHearts(10, { emojis: ['🥂', '🍾', '✨', '💛'] });
  playBgFx('gift');
  showCeremonyBanner('🍾 RÓT THÁP RƯỢU SÂM PANH!', 'Rót tràn tình nồng, trăm năm hạnh phúc!', 'champagne');
  showToast('🍾 Rót tháp rượu sâm panh tình nồng ý thắm! 🥂');
}

function triggerPetal(big = false) {
  coupleDo(['petal', 'heart'], 4500);
  playWeddingBell();
  spawnPetalsBurst(big ? 70 : 45);
  playBgFx('gift');
  showCeremonyBanner('🌹 MƯA HOA HỒNG RỰC RỠ! 🌸', 'Trăm hoa trải thảm chúc phúc đôi uyên ương!', 'petal');
  showToast('🌹 Mưa hoa hồng rực rỡ khắp hôn trường! 💕');
}

function cardCenter(role) {
  const el = $('#medal-' + role);
  if (!el) return { x: role === 'groom' ? 140 : 940, y: 800 };
  return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + 90 };
}

function triggerRing(couple = {}) {
  const g = couple.groom || roleName('groom');
  const b = couple.bride || roleName('bride');
  showCeremonyBanner('💍 TRAO NHẪN CƯỚI', `${g} 💕 ${b}`, 'marry', 4800);
  coupleDo(['ring', 'heart'], 4800);
  playChime();
  const layer = $('#hearts-layer');
  const target = { x: 540, y: 880 };
  for (const role of ['groom', 'bride']) {
    const from = cardCenter(role);
    const ring = document.createElement('div');
    ring.className = 'flying-ring';
    ring.textContent = '💍';
    layer.append(ring);
    ring.animate([
      { transform: `translate(${from.x - 30}px, ${from.y - 30}px) scale(0.6) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${(from.x + target.x) / 2 - 30}px, ${Math.min(from.y, target.y) - 160}px) scale(1.3) rotate(${role === 'groom' ? 200 : -200}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${target.x - 30}px, ${target.y - 30}px) scale(1.6) rotate(${role === 'groom' ? 360 : -360}deg)`, opacity: 1 }
    ], { duration: 1600, easing: 'ease-in-out', fill: 'forwards' });
    setTimeout(() => ring.remove(), 3400);
  }
  setTimeout(() => {
    playWeddingBell();
    pickFresh('ring', RING_FINISHES)();
  }, 1550);
}

function flashCard(role) {
  const el = $('#medal-' + role);
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 4000);
}

function triggerRoleChange({ role, name, avatar, previous, bid, replaced = false, fromQueue = false, duel = null }) {
  const isGroom = role === 'groom';
  const label = isGroom ? 'chú rể' : 'cô dâu';
  const queueMode = cfg().roleSystem === 'queue';
  let sub;
  if (fromQueue) sub = `tới lượt từ hàng chờ, mời lên sân khấu!`;
  else if (replaced || previous) sub = `xông lên đá ${label} ${previous} văng khỏi sân khấu!`;
  else if (queueMode) sub = `chính thức nhận vai ${label}!`;
  else sub = `giành vai ${label} với ${fmt(bid)} xu!`;
  // Kèo đấu: phục thù thành công hoặc giành qua giành lại từ hiệp 2 thì báo tỉ số ngay trên bảng lớn
  let kicker = replaced || previous ? `🔁 THAY ${label.toUpperCase()}!` : isGroom ? '🤵 CHÚ RỂ MỚI!' : '👰 CÔ DÂU MỚI!';
  if (duel && previous && !fromQueue) {
    if (duel.revenge) { kicker = duel.round >= 3 ? `🔥 HIỆP ${duel.round} · PHỤC THÙ!` : '🔥 PHỤC THÙ THÀNH CÔNG!'; sub = `đòi lại ghế ${label} từ tay ${previous}! Tỉ số ${duel.winnerWins} – ${duel.loserWins}`; }
    else if (duel.round >= 2) { kicker = `⚔️ HIỆP ${duel.round} · THAY ${label.toUpperCase()}!`; sub = `lại đá ${previous} văng khỏi sân khấu! Tỉ số ${duel.winnerWins} – ${duel.loserWins}`; }
  }
  // Nhãn nhỏ ở trên, tên người thật to ở giữa, việc vừa xảy ra ở dưới
  showCeremonyBanner(String(name), sub, isGroom ? 'marry' : 'bride', 6500, kicker);
  const celebrate = () => {
    flashCard(role);
    const crown = $('#groom-status-tag');
    crown?.classList.add('crown-flash');
    setTimeout(() => crown?.classList.remove('crown-flash'), 5000);
    playFanfare();
    playWeddingBell();
    if (!coupleActor.play('wave', 4800)) triggerKiss(true);
    guestsReact(10, ['clap', 'hop']);
    if (pairHeartPending) {
      clearTimeout(pairHeartTimer);
      pairHeartTimer = setTimeout(playPairHeart, 4800);
    }
    const c = cardCenter(role);
    spawnHearts(16, { x: c.x, y: c.y + 40, spread: 160, emojis: isGroom ? ['👑', '💖', '✨'] : ['👰', '💐', '💖', '✨'] });
  };
  showToast(`🎉 ${name} chính thức làm ${isGroom ? 'CHÚ RỂ' : 'CÔ DÂU'}! Chúc mừng! 💕`, avatar, name);
  // Có người bị cướp/thay vai: người cũ văng khỏi sân khấu trước, người mới đáp xuống rồi mới chúc mừng
  if (previous && !fromQueue) stealFling({ role, previous }).then(celebrate, celebrate);
  else celebrate();
}

// ----- CƯỚP VAI: người cũ bị đánh bật, quay mòng mòng rồi văng khỏi màn hình; người mới rơi xuống thế chỗ -----
const ousted = {}; // vai -> người vừa mất vai (để gắn đúng avatar lên người đang bay)
const STEAL_POWS = ['BỐP!', 'BAY MÀU!', 'HẾT VAI!', 'TẠM BIỆT!'];
const STEAL_GASPS = ['Ối dồi ôi! 😱', 'Bay màu luôn! 🤣', 'Căng thật sự! 🍿', 'Tội ghê á 😂', 'Cướp trắng trợn! 😳', 'Drama quá bà con ơi! 🔥'];
const STEAL_FLY_MS = 2300;  // từ lúc bị đánh bật tới lúc bay khỏi màn hình
const STEAL_DROP_AT = 1650; // người mới bắt đầu rơi xuống (người cũ đã bay gần khuất)
const STEAL_DROP_MS = 700;
const stealRuns = { groom: null, bride: null }; // vai -> hàm dọn cảnh đang diễn (cô dâu và chú rể có thể bay cùng lúc)
let stealModeCount = 0;

function stealLayer() {
  let layer = $('#steal-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'steal-layer';
    $('#frame').append(layer);
  }
  return layer;
}
// Vị trí một phần tử theo toạ độ khung 1080x1920 (đã tính các phép dịch chuyển đang áp dụng)
function frameRect(el) {
  const f = $('#frame').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = f.width / 1080 || 1;
  return { x: (r.left - f.left) / k, y: (r.top - f.top) / k, w: r.width / k, h: r.height / k };
}
// Chụp hình đang hiện của một lớp nhân vật ra canvas, kèm vùng có hình (0..1 so với khung ảnh):
// ảnh cô dâu/chú rể đứng lệch một bên khung, phải quay quanh thân người chứ không quanh tâm khung
const figureBoxCache = new Map();
function figureOf(el) {
  const iw = el?.naturalWidth || el?.videoWidth || 0;
  const ih = el?.naturalHeight || el?.videoHeight || 0;
  if (!iw || !ih) return null;
  const cv = document.createElement('canvas');
  cv.width = iw;
  cv.height = ih;
  try { cv.getContext('2d').drawImage(el, 0, 0, iw, ih); } catch (e) { return null; }
  const key = el.currentSrc || el.src || '';
  let box = figureBoxCache.get(key);
  if (box === undefined) {
    box = null;
    try {
      const w = 64;
      const h = Math.max(8, Math.round((64 * ih) / iw));
      const small = document.createElement('canvas');
      small.width = w;
      small.height = h;
      const cx = small.getContext('2d');
      cx.drawImage(cv, 0, 0, w, h);
      const d = cx.getImageData(0, 0, w, h).data;
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] < 48) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 >= x0) box = { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
    } catch (e) {}
    figureBoxCache.set(key, box);
  }
  return { cv, iw, ih, box: box || { x0: 0, x1: 1, y0: 0, y1: 1 } };
}
// Tâm thân người và đỉnh đầu bên trong khung rộng w cao h (ảnh canh đáy, giữa như .actor-layer)
function figureAnchor(fig, w, h) {
  if (!fig) return { cx: w / 2, cy: h / 2, head: 0 };
  const k = Math.min(w / fig.iw, h / fig.ih);
  const dw = fig.iw * k;
  const dh = fig.ih * k;
  const ox = (w - dw) / 2;
  const oy = h - dh;
  return { cx: ox + ((fig.box.x0 + fig.box.x1) / 2) * dw, cy: oy + ((fig.box.y0 + fig.box.y1) / 2) * dh, head: oy + fig.box.y0 * dh };
}

// Trả về Promise xong lúc người mới đáp xuống sân khấu (để bắt đầu chúc mừng)
// drop = false: không có người thế chỗ (phá đám) — bay khuất là xong, chỗ đứng trống lại
function stealFling({ role, previous, drop = true, sound = true }) {
  stealRuns[role]?.();
  let alive = true;
  const own = [];
  const layer = stealLayer();
  const wrap = $('#couple-wrapper');
  const other = role === 'groom' ? 'bride' : 'groom';
  const solo = hasSolo() && Boolean(wrap);
  const host = solo ? $(`#solo-${role}`) : null;
  const prev = ousted[role]?.name === previous ? ousted[role] : { name: previous, avatar: '' };
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
  // Hạt hiệu ứng tự xoá sau ms
  const put = (cls, x, y, text, ms, vars = {}) => {
    const el = document.createElement('div');
    el.className = cls;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    if (text) el.textContent = text;
    layer.append(el);
    own.push(el);
    setTimeout(() => el.remove(), ms);
    return el;
  };

  // 1. Tách người bị cướp ra khỏi sân khấu thành một hình bay riêng
  let rect;
  let fig = null;
  if (solo) {
    placeSolo();
    stealModeCount++;
    wrap.classList.add('steal-mode'); // đang hiện ảnh cặp đôi thì đổi sang hai người đứng riêng
    const actor = soloActors[role];
    fig = figureOf(actor.layers[actor.state] || Object.values(actor.layers)[0]);
    rect = frameRect(host);
  } else {
    const r = frameRect($('#couple-sprite'));
    rect = { x: role === 'groom' ? r.x + r.w / 2 : r.x, y: r.y, w: r.w / 2, h: r.h };
  }
  const a = figureAnchor(fig, rect.w, rect.h);
  const lean = a.cx - rect.w / 2;
  const dir = Math.abs(lean) > rect.w * 0.05 ? Math.sign(lean) : role === 'groom' ? 1 : -1; // văng về phía mình đang đứng
  const sx = rect.x + a.cx;
  const sy = rect.y + a.cy;
  const ey = Math.max(240, sy - 640);
  const dx = (dir > 0 ? 1210 : -130) - sx;
  const dy = ey - sy;

  const flyer = document.createElement('div');
  flyer.className = 'steal-flyer';
  Object.assign(flyer.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
  const lift = document.createElement('div');
  lift.className = 'sf-lift';
  const spin = document.createElement('div');
  spin.className = 'sf-spin';
  spin.style.transformOrigin = `${a.cx}px ${a.cy}px`;
  if (fig) {
    spin.append(fig.cv);
  } else {
    const emoji = document.createElement('div');
    emoji.className = 'sf-emoji';
    emoji.textContent = role === 'groom' ? '🤵' : '👰';
    spin.append(emoji);
  }
  const tag = document.createElement('div');
  tag.className = 'sf-tag';
  tag.style.left = `${a.cx}px`;
  tag.style.top = `${a.head - 8}px`;
  const av = document.createElement('span');
  av.className = 'sf-av';
  updateAvatar(av, prev.avatar, prev.name);
  const nm = document.createElement('b');
  nm.textContent = prev.name;
  tag.append('😵', av, nm);
  lift.append(spin, tag);
  flyer.append(lift);
  put('steal-pow', sx - dir * 70, rect.y + a.head + 10, pick(STEAL_POWS), 700); // nằm sau lưng người bay
  layer.append(flyer);
  own.push(flyer);
  host?.classList.add('stolen');

  // 2. Bị đánh bật → quay mòng mòng tại chỗ → văng theo đường vòng cung ra khỏi màn hình
  const opt = { duration: STEAL_FLY_MS, fill: 'forwards' };
  flyer.animate([
    { transform: 'translateX(0px)' },
    { transform: `translateX(${dir * 16}px)`, offset: 0.06 },
    { transform: `translateX(${-dir * 8}px)`, offset: 0.2 },
    { transform: 'translateX(0px)', offset: 0.42, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
    { transform: `translateX(${dx}px)` }
  ], opt);
  lift.animate([
    { transform: 'translateY(0px)' },
    { transform: 'translateY(-28px)', offset: 0.07 },
    { transform: 'translateY(-70px)', offset: 0.42, easing: 'cubic-bezier(0.15, 0.7, 0.4, 1)' },
    { transform: `translateY(${dy}px)` }
  ], opt);
  spin.animate([
    { transform: 'rotate(0deg) scale(1, 1)' },
    { transform: `rotate(${-dir * 16}deg) scale(1.14, 0.86)`, offset: 0.05 },
    { transform: `rotate(${dir * 10}deg) scale(0.94, 1.06)`, offset: 0.1, easing: 'cubic-bezier(0.5, 0, 1, 0.7)' },
    { transform: `rotate(${dir * 900}deg) scale(1, 1)`, offset: 0.42 },
    { transform: `rotate(${dir * 2520}deg) scale(0.42, 0.42)` }
  ], opt);
  // Thẻ tên không quay theo; lúc người thu nhỏ dần thì thẻ hạ xuống cho khỏi rời nhau
  tag.animate([
    { transform: 'translate(-50%, -100%)' },
    { transform: 'translate(-50%, -100%)', offset: 0.42 },
    { transform: `translate(-50%, calc(-100% + ${Math.round((a.cy - a.head) * 0.55)}px))` }
  ], opt);
  setTimeout(() => flyer.remove(), STEAL_FLY_MS + 150);

  if (sound) {
    playBonk();
    later(230, () => playDizzy(0.72));
    later(STEAL_FLY_MS * 0.42, () => playFlingWhistle(1.2));
    later(STEAL_FLY_MS * 0.42 + 900, playTrollLaugh);
  }
  const stage = $('#wedding-stage');
  stage?.classList.remove('jolt');
  void stage?.offsetWidth;
  stage?.classList.add('jolt');
  const card = $('#medal-' + role);
  card?.classList.add('robbed');
  setTimeout(() => { stage?.classList.remove('jolt'); card?.classList.remove('robbed'); }, 1000);

  // Sao chóng mặt quanh đầu lúc quay, rồi vệt sao kéo theo lúc bay
  let tick = 0;
  const trail = setInterval(() => {
    const t = ++tick * 70;
    if (!alive || t > STEAL_FLY_MS) return clearInterval(trail);
    const r = frameRect(spin);
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    if (x < -30 || x > 1110) return;
    if (t < STEAL_FLY_MS * 0.42) {
      if (tick % 2) put('steal-star', x + (Math.random() - 0.5) * 150, rect.y + a.head - 70 + Math.random() * 60, pick(['💫', '⭐', '💫']), 800, { '--dx': `${(Math.random() - 0.5) * 80}px`, '--dy': '-40px' });
    } else {
      put('steal-star', x, y, pick(['💫', '⭐', '✨', '💨', '🌟']), 800, { '--dx': `${-dir * (30 + Math.random() * 50)}px`, '--dy': `${30 + Math.random() * 50}px` });
    }
  }, 70);
  // Bay khuất: một ngôi sao loé lên ở mép màn hình
  later(STEAL_FLY_MS - 140, () => {
    put('steal-twinkle', dir > 0 ? 1010 : 70, ey + 60, '✨', 750);
    if (sound) playTwinkle();
  });

  // 3. Mọi người sửng sốt: người còn lại giật mình, khách ngó lên bàn tán
  if (drop && solo && !roleSearching(other)) {
    later(160, () => {
      const pHost = $(`#solo-${other}`);
      const pActor = soloActors[other];
      const pLayer = pActor.layers[pActor.state] || Object.values(pActor.layers)[0];
      if (!pHost || !pLayer) return;
      const pr = frameRect(pHost);
      const pa = figureAnchor(figureOf(pLayer), pr.w, pr.h);
      put('steal-react', pr.x + pa.cx, pr.y + pa.head - 14, '😱', 1300);
      pLayer.animate([
        { transform: 'translateY(0px)' }, { transform: 'translateY(-24px)' }, { transform: 'translateY(0px)' },
        { transform: 'translateY(-12px)' }, { transform: 'translateY(0px)' }
      ], { duration: 520, easing: 'ease-out' });
    });
  }
  if (sound) guestsReact(14, ['look', 'hop', 'look']);
  for (const ms of sound ? [450, 1000, 1600] : []) {
    later(ms, () => {
      const ids = Array.from(guestNodes.keys());
      if (ids.length) showChatBubble(pick(ids), pick(STEAL_GASPS));
    });
  }

  // 4. Người mới rơi từ trên xuống, nhún một cái rồi đứng vào chỗ
  const dropped = solo ? Array.from(host.querySelectorAll('.actor-layer')) : [];
  let done = () => {};
  let restored = false;
  const restoreStage = () => {
    if (restored) return;
    restored = true;
    if (solo && --stealModeCount <= 0) {
      stealModeCount = 0;
      wrap.classList.remove('steal-mode');
    }
    host?.classList.remove('stolen', 'dropping');
    for (const el of dropped) {
      el.getAnimations().forEach(x => x.cancel());
      el.style.transformOrigin = '';
    }
  };
  const cleanup = () => {
    if (!alive) return;
    alive = false;
    if (stealRuns[role] === cleanup) stealRuns[role] = null;
    timers.forEach(clearTimeout);
    clearInterval(trail);
    restoreStage();
    own.forEach(el => el.remove());
    done();
  };
  stealRuns[role] = cleanup;
  return new Promise(resolve => {
    done = resolve;
    later(STEAL_FLY_MS + 900, () => { if (stealRuns[role] === cleanup) stealRuns[role] = null; });
    if (!drop) {
      later(STEAL_FLY_MS, () => { restoreStage(); resolve(); });
      return;
    }
    const landAt = STEAL_DROP_AT + STEAL_DROP_MS * 0.5;
    if (solo) {
      later(STEAL_DROP_AT, () => {
        host.classList.replace('stolen', 'dropping');
        for (const el of dropped) {
          el.style.transformOrigin = `${a.cx}px 100%`;
          el.animate([
            { transform: 'translateY(-820px) scale(1, 1)', easing: 'cubic-bezier(0.55, 0, 1, 0.75)' },
            { transform: 'translateY(0px) scale(1.14, 0.84)', offset: 0.5 },
            { transform: 'translateY(-36px) scale(0.96, 1.05)', offset: 0.68 },
            { transform: 'translateY(0px) scale(1.05, 0.96)', offset: 0.86 },
            { transform: 'translateY(0px) scale(1, 1)' }
          ], { duration: STEAL_DROP_MS });
        }
      });
    }
    later(landAt, () => {
      if (solo) {
        playThud();
        const fx = rect.x + a.cx;
        const fy = rect.y + rect.h - 26;
        put('steal-dust', fx - 30, fy, '💨', 700, { '--dx': '-90px', '--flip': '-1' });
        put('steal-dust', fx + 30, fy, '💨', 700, { '--dx': '90px', '--flip': '1' });
        spawnHearts(8, { x: fx, y: rect.y + rect.h * 0.45, spread: 170, emojis: ['✨', '🌟', '💖'] });
      }
      resolve();
    });
    later(STEAL_DROP_AT + STEAL_DROP_MS + 120, restoreStage);
  });
}

// ----- MC GHÉP ĐÔI NGẪU NHIÊN: thẻ vai quay tên khách trong rạp rồi dừng ở người được chọn -----
function playTick(i) {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  tone(ctx, { freq: 1500 + (i % 2) * 300, type: 'triangle', dur: 0.05, gain: 0.07 });
}
async function spinRoleCard(role, finalName, names) {
  const el = $('#medal-' + role);
  const nameEl = el?.querySelector('.rc-name');
  if (!nameEl) return;
  el.classList.add('rolling');
  const pool = names.filter(n => n !== finalName);
  for (let i = 0; i < 22 && pool.length; i++) {
    nameEl.textContent = pool[Math.floor(Math.random() * pool.length)];
    playTick(i);
    await sleep(60 + i * i * 0.6); // chậm dần như vòng quay
  }
  el.classList.remove('rolling');
  if (currentState) renderRoleCard(role, currentState);
  nameEl.textContent = finalName;
  flashCard(role);
}
async function triggerRandomPair(d) {
  const picks = (Array.isArray(d.picks) ? d.picks : []).filter(p => p && (p.role === 'groom' || p.role === 'bride'));
  if (!picks.length) return;
  const label = r => (r === 'groom' ? 'chú rể' : 'cô dâu');
  const names = [...new Set((currentState?.people || []).filter(p => !p.bot).map(p => p.name).filter(Boolean))];
  showCeremonyBanner('🎲 MC GHÉP ĐÔI NGẪU NHIÊN!', picks.length > 1 ? 'Chưa ai nhận vai, ông tơ bà nguyệt đang chọn...' : `Vai ${label(picks[0].role)} còn trống, MC đang chọn...`, 'gold', 3600);
  await Promise.all(picks.map(p => spinRoleCard(p.role, p.name, names)));
  const g = picks.find(p => p.role === 'groom');
  const b = picks.find(p => p.role === 'bride');
  const one = picks[0];
  showCeremonyBanner(
    g && b ? `💞 ${String(g.name).toUpperCase()} & ${String(b.name).toUpperCase()}` : `${one.role === 'groom' ? '👑 CHÚ RỂ' : '👰 CÔ DÂU'}: ${String(one.name).toUpperCase()}`,
    picks.some(p => p.from) ? '🍀 Phù dâu, phù rể lượt trước được lên xe hoa!' : 'MC ghép đôi ngẫu nhiên · tặng quà để giành lại vai!', one.role === 'bride' && !g ? 'bride' : 'marry', 6000
  );
  playFanfare();
  playWeddingBell();
  guestsReact(12, ['clap', 'hop', 'look']);
  for (const p of picks) {
    const c = cardCenter(p.role);
    spawnHearts(14, { x: c.x, y: c.y + 40, spread: 160, emojis: p.role === 'groom' ? ['👑', '💖', '🎲'] : ['👰', '💐', '💖', '🎲'] });
  }
  showToast(`🎲 MC ghép đôi: ${picks.map(p => `${p.name} làm ${label(p.role).toUpperCase()}`).join(', ')}!`, one.avatar, one.name);
  if (d.line) speak(d.line);
}

function showAuction(item) {
  const r = item.roleResult || {};
  const roleLabel = r.role === 'bride' ? 'CÔ DÂU' : 'CHÚ RỂ';
  if (r.queued) {
    showToast(`⏳ ${item.name} đã đặt cọc vai ${roleLabel.toLowerCase()} cho lượt sau!`, item.avatar, item.name);
    return;
  }
  if (r.queueJoined || r.queueAlready) {
    showCeremonyBanner(`⏳ ${String(item.name).toUpperCase()} XẾP HÀNG LÀM ${roleLabel}`, `Số thứ tự ${r.position}${r.holder ? ` · chờ lễ của ${r.holder}` : ''}`, 'auction', 4200);
    playClink();
    return;
  }
  if (r.queueFull || r.holderSelf) {
    playWeddingBell();
    spawnHearts(10);
    return;
  }
  if (r.defended) {
    showCeremonyBanner(`🛡️ ${String(item.name).toUpperCase()} GIỮ VỮNG NGÔI ${roleLabel}!`, `Nâng giá lên ${fmt(r.bid)} xu — ai dám cướp?`, r.role === 'bride' ? 'bride' : 'marry', 4500);
    flashCard(r.role);
    playFanfare();
    return;
  }
  showCeremonyBanner(`⚔️ ${String(item.name).toUpperCase()} ĐẤU GIÁ ${roleLabel}`, `Đã có ${fmt(r.bid)} xu · thiếu ${fmt(r.missing)} xu để cướp ngôi!`, 'auction', 4500);
  playClink();
}

// ----- ÂM THANH PHỤ -----
// Tiếng cười troll (file audio/cuoi_troll.mp3): lúc có người bị phá đám / bị cướp vai. Cách nhau ít nhất 4 giây cho đỡ lặp.
let lastTrollLaugh = 0;
function playTrollLaugh() {
  if (!soundOn() || Date.now() - lastTrollLaugh < 4000) return;
  lastTrollLaugh = Date.now();
  const a = new Audio('/audio/cuoi_troll.mp3');
  a.volume = 0.75 * Math.min(1, Math.max(0, Number(cfg().volume ?? 0.95)));
  a.play().catch(() => {});
}
function playSadTrombone() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  [392, 370, 349, 311].forEach((freq, i) => tone(ctx, { freq, to: freq * 0.97, type: 'sawtooth', at: i * 0.32, dur: i === 3 ? 0.9 : 0.3, gain: 0.07 }));
}
// Pháo hoa nhẹ nhàng: "vút" bay lên, "bụp" nhỏ rồi lách tách — không còn tiếng bùm trầm ồn ào
function playBoom() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  glide(ctx, { pts: [[0, 700], [0.32, 1700]], gain: 0.018, attack: 0.05, release: 0.06 });
  tone(ctx, { freq: 210, to: 120, at: 0.34, dur: 0.14, gain: 0.07 });
  noiseBurst(ctx, { at: 0.34, dur: 0.07, gain: 0.05, hp: 1500 });
  for (let i = 0; i < 7; i++) noiseBurst(ctx, { at: 0.42 + i * 0.055 + Math.random() * 0.04, dur: 0.018, gain: 0.03, hp: 4500 });
}
// Tiếng chụp ảnh nhẹ: hai tiếng "tách" nhỏ rồi một nốt chuông trong, không dùng tiếng ồn trắng cho đỡ chói.
function playShutter() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  tone(ctx, { freq: 1600, to: 700, dur: 0.035, gain: 0.05, type: 'triangle' });
  tone(ctx, { freq: 1300, to: 600, at: 0.08, dur: 0.04, gain: 0.04, type: 'triangle' });
  tone(ctx, { freq: 1318.5, at: 0.2, dur: 0.9, gain: 0.035 });
  tone(ctx, { freq: 1975.5, at: 0.3, dur: 1.1, gain: 0.025 });
}

// Nốt trượt cao độ có láy (còi trượt, lò xo, tiếng quay mòng mòng). pts = [[giây, Hz], ...]
function glide(ctx, { pts, type = 'sine', at = 0, gain = 0.1, attack = 0.02, release = 0.08, vib }) {
  const t0 = ctx.currentTime + at;
  const dur = pts[pts.length - 1][0];
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(pts[0][1], t0);
  for (const [t, f] of pts.slice(1)) osc.frequency.exponentialRampToValueAtTime(f, t0 + t);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  if (vib) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.setValueAtTime(vib.rate, t0);
    if (vib.rateTo) lfo.frequency.linearRampToValueAtTime(vib.rateTo, t0 + dur);
    depth.gain.value = vib.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}
function sfx(fn) {
  if (!soundOn()) return;
  const ctx = getAudio();
  if (ctx) fn(ctx);
}

// ----- TIẾNG CƯỚP VAI: bốp → quay mòng mòng → còi trượt bay đi → "ting" → người mới đáp xuống -----
const playBonk = () => sfx(ctx => {
  tone(ctx, { freq: 240, to: 70, type: 'triangle', dur: 0.18, gain: 0.32 });
  noiseBurst(ctx, { dur: 0.08, gain: 0.35, hp: 600 });
  glide(ctx, { pts: [[0, 170], [0.09, 480], [0.42, 210]], type: 'triangle', at: 0.06, gain: 0.1, vib: { rate: 24, depth: 40 } });
});
const playDizzy = sec => sfx(ctx => glide(ctx, { pts: [[0, 380], [sec, 820]], gain: 0.06, release: 0.05, vib: { rate: 6, rateTo: 18, depth: 110 } }));
const playFlingWhistle = sec => sfx(ctx => {
  glide(ctx, { pts: [[0, 820], [sec, 2900]], gain: 0.075, release: 0.3, vib: { rate: 7, depth: 16 } });
  noiseBurst(ctx, { dur: 0.45, gain: 0.1, hp: 1500 });
});
const playTwinkle = () => sfx(ctx => [3136, 4186].forEach((freq, i) => tone(ctx, { freq, at: i * 0.07, dur: 0.9, gain: 0.06 })));
const playThud = () => sfx(ctx => {
  tone(ctx, { freq: 150, to: 45, dur: 0.24, gain: 0.32 });
  noiseBurst(ctx, { dur: 0.09, gain: 0.2, hp: 250 });
});

// ----- HIỆU ỨNG NHẬN QUÀ: hiện ngay lúc quà tới, không chờ tới lượt người tặng đi lên thảm đỏ -----
// 1. Thẻ cảm ơn giữa màn hình: avatar + tên người tặng, hình quà, số lượng (tặng dồn thì cộng dồn ×N)
// 2. Mưa hình quà rơi khắp màn hình, quà càng nhiều xu càng dày
// 3. Quà từ 100 xu: hình quà phóng to giữa màn hình + chớp vàng; từ 1.000 xu: thêm mưa xu
const giftThanks = new Map(); // "người|quà" -> { el, count, timer }
function giftFxLayer() {
  let layer = $('#gift-fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'gift-fx';
    const tray = document.createElement('div');
    tray.id = 'gift-thanks';
    layer.append(tray);
    $('#frame').append(layer);
  }
  return layer;
}
function giftThanksCard(ev, url, emoji) {
  const tray = $('#gift-thanks');
  const key = `${ev.id}|${normGift(ev.gift)}`;
  const add = Math.max(1, Number(ev.count) || 1);
  let t = giftThanks.get(key);
  if (!t) {
    const el = document.createElement('div');
    el.className = 'gift-thanks-card';
    const av = document.createElement('span');
    av.className = 'gt-av';
    updateAvatar(av, ev.avatar, ev.name);
    const text = document.createElement('div');
    text.className = 'gt-text';
    const name = document.createElement('b');
    name.textContent = ev.name;
    const sub = document.createElement('span');
    sub.textContent = `tặng ${titleCase(ev.gift)} · cảm ơn nha! 💖`;
    text.append(name, sub);
    const icon = document.createElement('div');
    icon.className = 'gt-gift';
    setGiftIcon(icon, url, emoji);
    const count = document.createElement('strong');
    count.className = 'gt-count';
    el.append(av, text, icon, count);
    tray.prepend(el);
    while (tray.childElementCount > 3) {
      const old = tray.lastElementChild;
      for (const [k, v] of giftThanks) if (v.el === old) { clearTimeout(v.timer); giftThanks.delete(k); }
      old.remove();
    }
    t = { el, count: 0, timer: null };
    giftThanks.set(key, t);
  }
  t.count += add;
  const countEl = t.el.querySelector('.gt-count');
  countEl.textContent = `×${fmt(t.count)}`;
  countEl.classList.remove('bump');
  void countEl.offsetWidth;
  countEl.classList.add('bump');
  t.el.classList.toggle('big', (Number(ev.total) || 0) >= 100);
  t.scale = Math.max(t.scale || 1, giftShowScale(ev.total)); // tặng dồn nhiều lần: giữ theo món lớn nhất
  clearTimeout(t.timer);
  t.timer = setTimeout(() => {
    giftThanks.delete(key);
    t.el.classList.add('out');
    setTimeout(() => t.el.remove(), 450);
  }, 4200 * t.scale);
}
// Quà lớn thì các bảng khoe quà (thẻ cảm ơn, hình quà phóng to, thẻ chúc mừng) đứng lâu hơn một chút cho cả rạp kịp thấy.
// Tính theo tổng xu của món quà: dưới 20 xu giữ nguyên, từ 20 xu +20%, từ 100 xu +40%, từ 500 xu +60%.
function giftShowScale(coins) {
  const n = Number(coins) || 0;
  return n >= 500 ? 1.6 : n >= 100 ? 1.4 : n >= 20 ? 1.2 : 1;
}
function giftShower(layer, url, emoji, n) {
  if (layer.querySelectorAll('.gift-drop').length > 110) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'gift-drop';
    setGiftIcon(d, url, emoji);
    const size = 54 + Math.random() * 58;
    const x = 30 + Math.random() * 1020;
    d.style.width = d.style.height = `${size}px`;
    d.style.fontSize = `${size * 0.8}px`;
    d.style.left = `${x - size / 2}px`;
    layer.append(d);
    const sway = (Math.random() - 0.5) * 260;
    const spin = (Math.random() - 0.5) * 720;
    d.animate([
      { transform: 'translate(0px, -140px) rotate(0deg) scale(0.6)', opacity: 0 },
      { transform: `translate(${sway * 0.3}px, 240px) rotate(${spin * 0.25}deg) scale(1.1)`, opacity: 1, offset: 0.14 },
      { transform: `translate(${sway}px, 1500px) rotate(${spin}deg) scale(1)`, opacity: 1, offset: 0.8 },
      { transform: `translate(${sway * 1.1}px, 2080px) rotate(${spin * 1.2}deg) scale(0.9)`, opacity: 0 }
    ], { duration: 2400 + Math.random() * 1600, delay: Math.random() * 700, easing: 'cubic-bezier(0.3, 0.1, 0.7, 1)', fill: 'both' })
      .finished.then(() => d.remove(), () => d.remove());
  }
}
function giftSplash(ev) {
  if (!ev || cfg().giftEffects === false) return;
  const coins = Math.max(1, Number(ev.total) || 1);
  const url = giftImage(ev.gift);
  const emoji = '🎁'; // quà chưa có hình trong app/public/gifts
  const layer = giftFxLayer();
  giftThanksCard(ev, url, emoji);
  if (dpActive) return; // đang động phòng: chỉ hiện thẻ cảm ơn, không che cảnh
  giftShower(layer, url, emoji, coins < 5 ? 7 : coins < 20 ? 11 : coins < 100 ? 16 : coins < 1000 ? 26 : 40);
  if (coins < 100) return;
  // Quà lớn: hình quà phóng to giữa màn hình, chớp vàng
  const pop = document.createElement('div');
  pop.className = 'gift-pop';
  const icon = document.createElement('div');
  icon.className = 'gift-pop-icon';
  setGiftIcon(icon, url, emoji);
  const cap = document.createElement('b');
  cap.textContent = `${ev.name} · ${fmt(coins)} xu`;
  pop.append(icon, cap);
  const flash = document.createElement('div');
  flash.className = 'gift-flash';
  const popMs = Math.round(2300 * giftShowScale(coins));
  pop.style.animationDuration = `${popMs - 100}ms`;
  layer.append(flash, pop);
  setTimeout(() => { pop.remove(); flash.remove(); }, popMs);
  if (coins >= 1000) setTimeout(() => giftShower(layer, '', pick(['🪙', '💰', '💎']), 34), 500);
}

// ----- TIẾNG NHẬN QUÀ: kêu ngay lúc quà tới (trước cả khi khách đi lên), quà càng lớn càng rộn -----
// < 10 xu: tiếng xu · 10-99: xu + "ka-ching" · 100-999: chuỗi nốt lấp lánh + ka-ching · từ 1.000: thêm kèn mừng, mưa xu
let lastGiftSfx = 0;
function playGiftSound(coins = 1) {
  const now = performance.now();
  if (now - lastGiftSfx < 160) return; // quà tới dồn dập: không chồng tiếng lên nhau
  sfx(ctx => {
    lastGiftSfx = now;
    const n = Number(coins) || 1;
    const coin = (at, base = 987.77, gain = 0.05) => {
      tone(ctx, { freq: base, type: 'square', at, dur: 0.09, gain });
      tone(ctx, { freq: base * 4 / 3, type: 'square', at: at + 0.075, dur: 0.42, gain });
    };
    const kaching = at => {
      noiseBurst(ctx, { at, dur: 0.05, gain: 0.22, hp: 3500 });
      [2093, 2637, 3136].forEach((freq, i) => tone(ctx, { freq, type: 'triangle', at: at + 0.04 + i * 0.012, dur: 0.9, gain: 0.07 / (i + 1) }));
    };
    if (n < 10) return coin(0, pick([987.77, 1046.5, 1174.66]));
    if (n < 100) { coin(0); kaching(0.16); return; }
    [1046.5, 1318.5, 1568, 2093, 2637].forEach((freq, i) => tone(ctx, { freq, type: 'triangle', at: i * 0.07, dur: 0.5, gain: 0.08 }));
    kaching(0.38);
    if (n < 1000) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(ctx, { freq, type: 'square', at: 0.5 + i * 0.11, dur: i === 3 ? 0.9 : 0.22, gain: 0.06 }));
    for (let i = 0; i < 7; i++) coin(0.95 + i * 0.09, 987.77 * (1 + (i % 3) * 0.12), 0.035);
  });
}

// ----- PHÁ ĐÁM -----
// Server bỏ vai của đôi bị phá ngay lúc nhận quà, nhưng trên màn hình người phá đám còn đang đi lên thảm đỏ.
// Giữ đôi cũ trên sân khấu cho tới lúc cảnh phá đám diễn ra (tối đa 25 giây) rồi mới cho họ "bay màu".
let kickHold = null; // { until, roles: { groom, bride } }
function holdKickedCouple() {
  const r = currentState?.rawRoles || currentState?.roles || {};
  if (!r.groom && !r.bride) return;
  kickHold = { until: Date.now() + 25000, roles: { groom: r.groom || null, bride: r.bride || null } };
}
function releaseKickHold() {
  kickHold = null;
  if (!currentState?.rawRoles) return;
  currentState.roles = currentState.rawRoles;
  delete currentState.rawRoles;
  renderState(currentState);
}
setInterval(() => { if (kickHold && Date.now() > kickHold.until) releaseKickHold(); }, 1000);

function triggerCancel(name, couple) {
  const g = couple?.groom || roleName('groom');
  const b = couple?.bride || roleName('bride');
  showCeremonyBanner(`💔 ${String(name || 'Ai đó').toUpperCase()} PHÁ ĐÁM!`, `Đám cưới của ${g} & ${b} đã bị hủy!`, 'cancel', 5000);
  const stage = $('#wedding-stage');
  stage?.classList.remove('shake');
  void stage?.offsetWidth;
  stage?.classList.add('shake');
  if (hasSolo() && $('#couple-wrapper')) {
    // Cả cô dâu lẫn chú rể bị đá: quay mòng mòng rồi văng ra hai phía
    ['groom', 'bride'].forEach((r, i) => stealFling({ role: r, previous: r === 'groom' ? g : b, drop: false, sound: i === 0 }));
    releaseKickHold();
  } else {
    releaseKickHold();
    const acted = coupleDo(['cancel', 'shock'], 4600);
    const sprite = $('#couple-sprite');
    if (!acted) {
      sprite?.classList.add('fled');
      setTimeout(() => sprite?.classList.remove('fled'), 4200);
    }
  }
  playSadTrombone();
  setTimeout(playTrollLaugh, 1500);
  const big = document.createElement('div');
  big.className = 'broken-heart';
  big.textContent = '💔';
  $('#hearts-layer').append(big);
  setTimeout(() => big.remove(), 2600);
  spawnHearts(12, { x: 540, y: 900, spread: 320, emojis: ['💔', '😱', '🏃', '💨'] });
  showToast(`💔 ${name || 'Ai đó'} phá đám! Sân khấu mở cho cặp đôi mới!`);
}

// ----- TUNG HOA CƯỚI -----
function seatPoint(personId) {
  const w = wanderers.get(personId);
  if (!w) return { x: 200 + Math.random() * 680, y: 1400 };
  const p = wanderPos(w);
  return { x: p.x, y: p.y - w.box.h * 0.8 * depthScale(p.y) };
}

async function triggerBouquet(catcher) {
  coupleDo(['bouquet', 'wave'], 3600);
  showCeremonyBanner('💐 CÔ DÂU TUNG HOA CƯỚI!', 'Ai sẽ bắt được hoa đây?', 'bride', 3200);
  playChime();
  const from = { x: 560, y: 860 };
  const to = catcher ? seatPoint(catcher.id) : { x: 200 + Math.random() * 680, y: 1400 };
  const el = document.createElement('div');
  el.className = 'flying-bouquet';
  el.textContent = '💐';
  $('#hearts-layer').append(el);
  const peak = Math.min(from.y, to.y) - 380;
  await el.animate([
    { transform: `translate(${from.x - 36}px, ${from.y - 36}px) rotate(0deg) scale(0.8)` },
    { transform: `translate(${(from.x + to.x) / 2 - 36}px, ${peak}px) rotate(360deg) scale(1.4)`, offset: 0.5 },
    { transform: `translate(${to.x - 36}px, ${to.y - 36}px) rotate(720deg) scale(1)` }
  ], { duration: 2000, easing: 'ease-in-out', fill: 'forwards' }).finished;
  el.remove();
  spawnHearts(14, { x: to.x, y: to.y, spread: 120, emojis: ['💐', '🌸', '💖', '✨'] });
  playWeddingBell();
  if (catcher) {
    showChatBubble(catcher.id, '💐 Bắt được rồi!');
    showCeremonyBanner(`💐 ${String(catcher.name).toUpperCase()} BẮT ĐƯỢC HOA!`, 'Sắp tới lượt lên xe hoa rồi nha!', 'bride', 4500);
    showToast(`💐 ${catcher.name} bắt được hoa cưới! Sắp có đám cưới tiếp theo!`, catcher.avatar, catcher.name);
  }
}

// ----- PHÁO HOA -----
function triggerFireworks(name, { quiet = false } = {}) {
  if (name) {
    showCeremonyBanner('🎆 PHÁO HOA RỰC RỠ!', `${name} thắp sáng cả hôn trường!`, 'gold', 4500);
    coupleDo(['fireworks', 'wave'], 4500);
    guestsReact(10, ['hop', 'clap', 'look']);
    playPartyScene(5200);
  }
  const layer = $('#fireworks-layer');
  if (!layer) return;
  const colors = ['#ffd700', '#ff4d6d', '#4cc9f0', '#b5ff6b', '#ff9e00', '#f72585', '#ffffff'];
  for (let k = 0; k < 9; k++) {
    setTimeout(() => {
      const color = pick(colors);
      const burst = document.createElement('div');
      burst.className = 'fw-burst';
      burst.style.left = `${140 + Math.random() * 800}px`;
      burst.style.top = `${240 + Math.random() * 520}px`;
      const n = 40;
      for (let i = 0; i < n; i++) {
        const sp = document.createElement('i');
        const ang = (i / n) * Math.PI * 2;
        const dist = 150 + Math.random() * 110;
        sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
        sp.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
        sp.style.background = Math.random() < 0.3 ? '#ffffff' : color;
        sp.style.boxShadow = `0 0 10px ${color}`;
        burst.append(sp);
      }
      layer.append(burst);
      if (!quiet) playBoom();
      setTimeout(() => burst.remove(), 1900);
    }, k * 520);
  }
}

// ----- ĐỔI NHẠC -----
// Tiếng DJ chà đĩa (kéo lui, kéo tới, kéo lui) rồi một nốt "ting" báo bài mới
const playScratch = () => sfx(ctx => {
  glide(ctx, { pts: [[0, 900], [0.11, 240]], type: 'sawtooth', gain: 0.09, release: 0.03 });
  glide(ctx, { pts: [[0, 260], [0.1, 1100]], type: 'sawtooth', at: 0.13, gain: 0.09, release: 0.03 });
  glide(ctx, { pts: [[0, 1000], [0.16, 180]], type: 'sawtooth', at: 0.26, gain: 0.09, release: 0.04 });
  [0, 0.13, 0.26].forEach(at => noiseBurst(ctx, { at, dur: 0.09, gain: 0.12, hp: 1500 }));
  [1318.5, 1975.5].forEach((freq, i) => tone(ctx, { freq, type: 'triangle', at: 0.5 + i * 0.09, dur: 0.7, gain: 0.08 }));
});
function triggerMusic(name, track) {
  playScratch();
  coupleDo(['dance', 'wave'], 4500);
  guestsReact(8, ['clap', 'hop']);
  showCeremonyBanner(`🎵 ĐỔI NHẠC: ${String(track || 'bài mới').toUpperCase()}`, name ? `Theo yêu cầu của ${name}` : 'Nhạc mới đã lên!', 'dance', 4500);
  const disc = $('.music-disc');
  disc?.classList.add('fast');
  setTimeout(() => disc?.classList.remove('fast'), 5000);
  spawnHearts(10, { x: 540, y: 860, spread: 320, emojis: ['🎵', '🎶', '🎧', '✨'] });
}

// ----- CƯỚI MC -----
function triggerMarryMC(name, avatar) {
  coupleDo(['shock'], 4000);
  guestsReact(8, ['hop', 'look']);
  showCeremonyBanner(`🎤 ${String(name || 'Ai đó').toUpperCase()} CƯỚI LUÔN MC!`, 'MC đỏ mặt nhận lời rồi bà con ơi! 😳', 'bride', 5000);
  const host = $('#mc-host');
  host?.classList.add('blush');
  setTimeout(() => host?.classList.remove('blush'), 5200);
  spawnHearts(18, { x: 345, y: 960, spread: 160, emojis: ['💖', '💘', '😳', '💍'] });
  playWeddingBell();
  if (name) showToast(`🎤 ${name} vừa cầu hôn MC! 😳💍`, avatar, name);
}

// ========================================================
// ẢNH CƯỚI "HAPPY WEDDING" (vẽ canvas -> hiện lên LIVE + lưu PNG vào album)
// ========================================================
const imgCache = new Map();
function loadImg(src) {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    }));
  }
  return imgCache.get(src);
}

// Avatar TikTok đi qua server (cùng nguồn) để canvas còn xuất được ảnh
function avatarSrc(url) {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  return /^https:\/\//.test(url) ? '/api/avatar?u=' + encodeURIComponent(url) : '';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawAvatar(ctx, img, name, cx, cy, r, ring = '#ffffff') {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const k = Math.max((2 * r) / img.width, (2 * r) / img.height);
    ctx.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
  } else {
    ctx.fillStyle = `hsl(${hashHue(name)} 58% 42%)`;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(r)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial(name), cx, cy + 2);
  }
  ctx.restore();
}

function wrapText(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitFont(ctx, text, weight, size, family, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 18 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
}

async function renderPhotoCanvas(d) {
  const W = 900;
  const H = 1100;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const font = '"Segoe UI", "Noto Sans", Roboto, Arial, sans-serif';
  const guests = (d.guests || []).slice(0, 8);
  const [bg, couple, gAv, bAv, giverAv, ...guestAvs] = await Promise.all([
    loadImg(theme.bgSrc),
    loadImg(d.kind === 'wedding' ? coupleStill('kiss', 'idle') : coupleStill('heart', 'wave', 'idle')),
    loadImg(avatarSrc(d.groomAvatar)),
    loadImg(avatarSrc(d.brideAvatar)),
    loadImg(avatarSrc(d.giver?.avatar)),
    ...guests.map(gu => loadImg(avatarSrc(gu.avatar)))
  ]);

  ctx.fillStyle = '#fffaf2';
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fill();

  ctx.fillStyle = '#c08a2a';
  ctx.font = 'italic 700 54px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Happy Wedding', W / 2, 68);

  drawAvatar(ctx, gAv, d.groom, 64, 128, 34, '#ffd36b');
  drawAvatar(ctx, bAv, d.bride, 116, 128, 34, '#ffb3d1');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2a1a12';
  fitFont(ctx, `${d.groom} ♥ ${d.bride}`, 800, 34, font, W - 200);
  ctx.fillText(`${d.groom} ♥ ${d.bride}`, 170, 124);
  ctx.fillStyle = '#8a7768';
  ctx.font = `500 22px ${font}`;
  ctx.fillText(`💍 Lễ thành hôn · ${d.date}`, 170, 158);

  const px = 30, py = 182, pw = 840, ph = 660;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.clip();
  if (bg) {
    // Cắt vùng cổng hoa + sân khấu ở giữa ảnh nền (tỷ lệ theo khung 9:16)
    const sw = bg.width * 0.686;
    const sh = (sw * ph) / pw;
    ctx.drawImage(bg, (bg.width - sw) / 2, bg.height * 0.449 - sh / 2, sw, sh, px, py, pw, ph);
  } else {
    ctx.fillStyle = '#7a1a2a';
    ctx.fillRect(px, py, pw, ph);
  }
  const grad = ctx.createLinearGradient(0, py, 0, py + ph);
  grad.addColorStop(0, 'rgba(255,230,190,0.06)');
  grad.addColorStop(1, 'rgba(60,10,20,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, pw, ph);
  if (couple) {
    const tall = couple.width / couple.height < 0.75;
    const ch = tall ? 540 : 470;
    const cw = (couple.width * ch) / couple.height;
    const cx = d.giver ? px + pw / 2 - cw / 2 - 70 : px + (pw - cw) / 2;
    ctx.drawImage(couple, cx, py + ph - ch - (tall ? 64 : 78), cw, ch);
  }
  if (d.giver) {
    const gx = px + pw - 170;
    const gy = py + ph - 250;
    drawAvatar(ctx, giverAv, d.giver.name, gx, gy, 62, '#ffd36b');
    ctx.fillStyle = 'rgba(20,8,12,0.82)';
    ctx.font = `800 24px ${font}`;
    // Người tặng quà chụp ảnh chung, hoặc người hùng của biến cố (vệ sĩ, nhà tài trợ sính lễ...) trong ảnh cưới
    const label = `${TWIST_UI[d.giver.hero]?.heroIcon || '📸'} ${d.giver.name}`;
    const lw = Math.min(260, ctx.measureText(label).width + 30);
    roundRect(ctx, gx - lw / 2, gy + 74, lw, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.textAlign = 'center';
    fitFont(ctx, label, 800, 24, font, lw - 20);
    ctx.fillText(label, gx, gy + 102);
  }
  guests.forEach((gu, i) => {
    const gap = 60;
    const x0 = px + pw / 2 - ((guests.length - 1) * gap) / 2;
    drawAvatar(ctx, guestAvs[i], gu.name, x0 + i * gap, py + ph - 40, 24, '#ffffff');
  });
  ctx.fillStyle = 'rgba(160,15,40,0.9)';
  roundRect(ctx, px + 20, py + 18, 260, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.textAlign = 'left';
  ctx.font = `800 24px ${font}`;
  ctx.fillText(`💒 Cặp đôi số ${fmt(d.number)}`, px + 38, py + 51);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.font = `34px ${font}`;
  ctx.fillText('❤️  💬  📤', 34, py + ph + 52);
  ctx.textAlign = 'right';
  ctx.fillText('🔖', W - 34, py + ph + 52);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2a1a12';
  ctx.font = `800 28px ${font}`;
  ctx.fillText(`${fmt(Math.max(1, d.likes || 0))} lượt thích`, 34, py + ph + 96);
  ctx.fillStyle = '#3a2a20';
  ctx.font = `500 25px ${font}`;
  const lines = wrapText(ctx, d.caption, W - 68).slice(0, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, 34, py + ph + 136 + i * 34));
  ctx.fillStyle = '#2563eb';
  ctx.font = `700 24px ${font}`;
  ctx.fillText((d.hashtags || []).join(' '), 34, py + ph + 136 + lines.length * 34 + 6);
  return cv;
}

const photoQueue = [];
let photoBusy = false;
async function runPhotoQueue() {
  if (photoBusy) return;
  photoBusy = true;
  while (photoQueue.length) {
    for (let i = 0; i < 150 && (ceremonyRunning || dpActive); i++) await sleep(200);
    await runPhoto(photoQueue.shift());
  }
  photoBusy = false;
}

async function runPhoto(d, { fromOffering = false } = {}) {
  if (!d) return;
  if (!fromOffering) for (let i = 0; i < 30 && offeringBusy; i++) await sleep(200);
  sceneLock++;
  try {
    const cv = await renderPhotoCanvas(d);
    $('#pb-img').src = cv.toDataURL('image/png');
    const root = $('#photo-booth');
    root.className = '';
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('pb-show');
    playShutter();
    setTimeout(() => triggerFireworks(null, { quiet: true }), 600);
    spawnPetalsBurst(30);
    if (d.line) speak(d.line);
    if (!IS_PREVIEW) {
      cv.toBlob(blob => {
        if (!blob) return;
        const label = `cap-doi-${d.number}-${d.groom}-${d.bride}${d.giver ? '-cung-' + d.giver.name : ''}`;
        fetch(`/api/photos?id=${encodeURIComponent(d.id)}&name=${encodeURIComponent(label)}`, { method: 'POST', body: blob }).catch(() => {});
      }, 'image/png');
    }
    await sleep(9500);
    root.classList.add('pb-hide');
    await sleep(600);
    root.hidden = true;
    root.className = '';
  } catch (e) {
    console.warn('photo error', e);
  }
  sceneLock--;
  processOfferingQueue();
}

// ----- SÀN NHẢY: người tặng nhảy giữa thảm đỏ 8 giây -----
async function runDanceFloor(item, actor, token) {
  showCeremonyBanner(`💃 ${String(item.name).toUpperCase()} LÊN SÀN NHẢY!`, 'Cả hôn trường quẩy cùng nào! 🎶', 'dance', 7600);
  startDisco(8000);
  guestsDance(8000);
  playPartyScene(8000);
  actor.classList.add('dancer');
  playDanceBeat(8);
  setDuck('dance', 0.15);
  spawnHearts(10, { x: 540, y: 1380, spread: 200, emojis: ['🎶', '🎵', '✨', '💃', '🕺'] });
  await hold(8000, token);
  actor.classList.remove('dancer');
  setDuck('dance', null);
}

// ----- ĐỘNG PHÒNG HOA CHÚC -----
let dpActive = false;
let sceneLock = 0; // > 0: đang có cảnh lớn (lễ cưới / động phòng) -> tạm dừng hàng người tặng quà

async function runDongPhong({ groom, bride, intro = true, lines = {}, baby = null } = {}) {
  if (dpActive) return;
  dpActive = true;
  sceneLock++;
  coupleDo(['carry', 'kiss'], 3200);
  const g = groom || roleName('groom');
  const b = bride || roleName('bride');
  const root = $('#dong-phong');
  // Phòng tràn màn hình: để người xem nhìn rõ cặp đôi bế nhau lâu hơn rồi mới đóng cửa (tổng thời lượng như cũ)
  const photo = root.dataset.room === 'photo';
  const T = photo ? { enter: 1700, close: 1100, closed: 2800 } : { enter: 900, close: 1500, closed: 3400 };
  const media = photo ? root.querySelector('video.dp-media') : null;
  $('#dp-groom').textContent = g;
  $('#dp-bride').textContent = b;
  root.className = '';
  root.hidden = false;
  if (media) {
    try { media.currentTime = 0; } catch (e) {}
    media.play().catch(() => {});
  }
  void root.offsetWidth;
  root.classList.add('dp-show');
  if (intro && lines.dongphong) speak(lines.dongphong, { priority: true });
  playWeddingBell();

  await sleep(T.enter);
  root.classList.add('dp-enter');
  await sleep(T.close);
  root.classList.add('dp-closed');
  playDoor();
  await sleep(500);
  root.classList.add('dp-signon');

  const heartsBox = root.querySelector('.dp-hearts');
  const heartTimer = setInterval(() => {
    const h = document.createElement('div');
    h.className = 'dp-heart';
    h.textContent = pick(['💕', '💖', '💗', '💞', '✨']);
    h.style.left = `${520 + (Math.random() - 0.5) * 120}px`;
    h.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    heartsBox.append(h);
    setTimeout(() => h.remove(), 2600);
  }, 220);
  const chants = ['Ố ồ ồ 🙈', 'Hóng quá 👀', 'Chúc ngủ ngon 😴', 'Sớm có tin vui nha 👶', 'Trăm năm hạnh phúc 💕', 'Đóng cửa rồi kìa 🤭'];
  const ids = Array.from(guestNodes.keys()).sort(() => Math.random() - 0.5).slice(0, 4);
  // Phòng tràn màn hình che mất khách -> lời trêu hiện thành bong bóng trên cánh cửa
  const spots = [[250, 1190], [830, 1290], [270, 1410], [810, 1520]];
  ids.forEach((id, i) => setTimeout(() => {
    if (!photo) return showChatBubble(id, pick(chants));
    const name = (currentState?.people || []).find(p => p.id === id)?.name || '';
    const c = document.createElement('div');
    c.className = 'dp-chant';
    if (name) {
      const n = document.createElement('b');
      n.textContent = String(name).slice(0, 18);
      c.append(n);
    }
    c.append(pick(chants));
    c.style.left = `${spots[i][0] + (Math.random() - 0.5) * 60}px`;
    c.style.top = `${spots[i][1] + (Math.random() - 0.5) * 40}px`;
    heartsBox.append(c);
    setTimeout(() => c.remove(), 3200);
  }, 400 + i * 900));

  // Sinh con: cửa phòng đóng thêm một lúc cho khách tặng quà đón em bé; không bật thì đóng cửa chừng vài giây như cũ
  const born = baby ? await babyWindow(root, baby, lines) : null;
  if (!baby) await sleep(T.closed);
  clearInterval(heartTimer);
  root.classList.remove('dp-closed', 'dp-signon');
  const kid = born && born.result !== 'none';
  if (kid) babyReveal(root, born, g, b);
  root.classList.add('dp-open', 'dp-baby-on');
  playFanfare();
  spawnHearts(24, { x: 540, y: 900, spread: 420, emojis: kid ? ['👶', '🍼', '💖', '✨'] : undefined });
  spawnPetalsBurst(30);
  if (born?.line) speak(born.line, { priority: true });
  else if (lines.dongphongEnd) speak(lines.dongphongEnd);
  await sleep(kid ? 5000 : 2000);
  root.classList.add('dp-hide');
  await sleep(600);
  root.hidden = true;
  root.className = '';
  const wish = root.querySelector('.dp-baby');
  wish.classList.remove('reveal');
  wish.textContent = '👶 Chúc sớm sinh quý tử!';
  media?.pause();
  heartsBox.replaceChildren();
  dpActive = false;
  sceneLock--;
  processOfferingQueue();
}

// ----- SINH CON: cửa phòng tân hôn đang đóng, khách tặng quà "bé trai" / "bé gái" để đón em bé -----
// Mỗi món quà người tặng đầu tiên làm bố / mẹ đỡ đầu; có cả hai món thì sinh đôi. Server tính giờ và báo kết quả.
let babyWait = null; // cửa sổ đang mở trên màn hình: { resolve, mark }
async function babyWindow(root, info, lines) {
  const c = cfg();
  const ruleOf = a => (c.giftRules || []).find(r => r.action === a && String(r.gifts || '').trim());
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const box = mk('div', 'dp-babywin');
  const head = mk('div', 'dpb-head');
  const timer = mk('b', 'dpb-timer');
  head.append(mk('span', '', '👶 CHÍN THÁNG MƯỜI NGÀY SAU...'), timer);
  const cards = mk('div', 'dpb-cards');
  const cardEls = {};
  for (const [sex, action, label, emoji] of [['boy', 'babyBoy', 'BÉ TRAI', '👶'], ['girl', 'babyGirl', 'BÉ GÁI', '🎀']]) {
    const r = ruleOf(action);
    if (!r) continue;
    const gift = String(r.gifts).split(',').map(t => t.trim()).find(t => t && !t.startsWith('#')) || '';
    const card = mk('div', `dpb-card ${sex}`);
    const icon = mk('div', 'dpb-icon');
    setGiftIcon(icon, ruleGiftImage(r), emoji);
    const who = mk('div', 'dpb-who', gift ? `Tặng ${titleCase(gift)}` : 'Tặng quà');
    card.append(icon, mk('b', '', label), who);
    cards.append(card);
    cardEls[sex] = { card, who };
  }
  box.append(head, cards, mk('div', 'dpb-foot', 'Người tặng đầu tiên làm bố mẹ đỡ đầu · đủ hai món thì sinh đôi'));
  root.append(box);
  void box.offsetWidth;
  box.classList.add('on');
  if (lines.babyStart) speak(lines.babyStart, { priority: true });
  // Đã có người nhận đỡ đầu: ô đó sáng lên, ghi tên và hình đại diện
  const mark = (sex, p) => {
    const e = cardEls[sex];
    if (!e || !p || e.card.classList.contains('taken')) return;
    e.card.classList.add('taken');
    const av = mk('span', 'dpb-av');
    updateAvatar(av, p.avatar || '', p.name);
    e.who.replaceChildren(av, mk('span', '', `Đỡ đầu: ${p.name}`));
    playChime();
    spawnHearts(10, { x: sex === 'boy' ? 380 : 700, y: 1000, spread: 200, emojis: sex === 'boy' ? ['👶', '💙', '✨'] : ['🎀', '💗', '✨'] });
  };
  const early = currentState?.baby; // quà tới trước khi cửa đóng hẳn
  if (early?.boy) mark('boy', early.boy);
  if (early?.girl) mark('girl', early.girl);
  const deadline = Number(info.deadline) || performance.now() + (Number(info.ms) || 15000);
  const tick = () => { timer.textContent = mmss(Math.max(0, Math.ceil((deadline - performance.now()) / 1000))); };
  tick();
  const iv = setInterval(tick, 250);
  const res = await new Promise(resolve => {
    babyWait = { resolve, mark };
    // Lỡ mất tin báo kết quả của server (rớt mạng): tự mở cửa sau hạn vài giây
    setTimeout(() => resolve({ result: 'none' }), Math.max(1500, deadline - performance.now() + 5000));
  });
  babyWait = null;
  clearInterval(iv);
  box.classList.remove('on');
  setTimeout(() => box.remove(), 450);
  return res;
}
// Mở cửa khoe em bé: hình em bé (bộ hình có thì dùng, không thì biểu tượng), tên bố mẹ, tên bố mẹ đỡ đầu
function babyReveal(root, born, g, b) {
  const wish = root.querySelector('.dp-baby');
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const art = theme.data.events?.baby?.states || {};
  const kids = mk('div', 'dpb-kids');
  for (const sex of born.result === 'twins' ? ['boy', 'girl'] : [born.result]) {
    const kidEl = mk('div', `dpb-kid ${sex}`);
    if (art[sex]?.img) {
      const img = new Image();
      img.alt = '';
      img.src = themeAsset(art[sex].img);
      kidEl.append(img);
    } else {
      kidEl.append(mk('span', '', '👶'), mk('i', '', sex === 'boy' ? '💙' : '🎀'));
    }
    kids.append(kidEl);
  }
  const title = { boy: 'BÉ TRAI KHÁU KHỈNH!', girl: 'BÉ GÁI XINH XẮN!', twins: 'SINH ĐÔI LONG PHỤNG!' }[born.result];
  const givers = [born.boy, born.girl].filter(Boolean).map(x => x.name).filter((n, i, a) => a.indexOf(n) === i);
  wish.replaceChildren(mk('b', '', title), mk('small', '', `🍼 Đỡ đầu: ${givers.join(' và ')}`), kids);
  wish.classList.add('reveal');
}

// ----- LỄ THÀNH HÔN: trao nhẫn -> hôn -> cắt bánh -> rót rượu -> động phòng -----
let ceremonyRunning = false;
let ceremonyEndedAt = 0;
let turnEndedAt = 0; // lúc đôi vừa cưới rời sân khấu sau tiệc mừng

async function runCeremony(d) {
  if (ceremonyRunning) return;
  ceremonyRunning = true;
  const t0 = performance.now();
  updateScene(); // vào lễ: về phông làm lễ
  sceneLock++;
  abortCurrentOffering();
  // Thông báo đấu giá của lượt này đã cũ (cặp đôi sắp thành hôn) -> bỏ; giữ quà thường và quà đặt cọc lượt sau
  for (let i = offeringQueue.length - 1; i >= 0; i--) {
    const q = offeringQueue[i];
    if (q.action === 'role' && !q.roleResult?.queued) offeringQueue.splice(i, 1);
  }
  // Đợi cảnh động phòng do quà (nếu đang chạy) kết thúc
  for (let i = 0; i < 60 && (offeringBusy || dpActive); i++) await sleep(200);
  const g = d.groom || roleName('groom');
  const b = d.bride || roleName('bride');
  // Cửa sổ sinh con do server tính giờ từ lúc bắt đầu động phòng: ghi lại mốc hết giờ theo đồng hồ của màn hình
  if (d.baby) d.baby = { ...d.baby, deadline: t0 + (Number(d.baby.openMs) || 0) + (Number(d.baby.ms) || 0) };

  const L = d.lines || {};
  if (d.quick) {
    const mai = d.matchmaker ? `${d.matchmaker.title} ${d.matchmaker.name} tiễn vào phòng · ` : d.initiator ? `${d.initiator} tặng quà · ` : '';
    showCeremonyBanner('⚡ ĐỘNG PHÒNG LUÔN!', `${mai}${g} 💕 ${b}`, 'marry', 3200);
    playFanfare();
    spawnHearts(16);
    if (L.ceremonyStart) speak(L.ceremonyStart, { priority: true });
    await sleep(2200);
  } else {
    const opening = pickFresh('opening', OPENINGS);
    showCeremonyBanner(opening.title, `${g} 💕 ${b}`, opening.type, 5200);
    opening.run();
    const wed = d.mode === 'wed'; // lễ kiểu mới (cưới xong chờ quà) diễn gọn; server báo tổng thời lượng (d.ms), bản cũ là 7 giây
    const wedStep = Math.max(2500, ((Number(d.ms) || 7000) - 1200) / 2);
    if (L.ceremonyStart) speak(L.ceremonyStart, { priority: true });
    await sleep(wed ? wedStep : 5200);

    triggerRing({ groom: g, bride: b });
    if (L.ring) speak(L.ring);
    await sleep(wed ? wedStep : 5000);

    if (d.mode === 'wed') {
      // Chỉ làm lễ thành hôn. Hôn, cắt bánh, rót rượu, động phòng... là của tiệc mừng: khách tặng quà thì mới diễn ra
      const done = pickFresh('wedDone', WED_DONES);
      showCeremonyBanner(done.title(g, b), '🎁 Tặng quà để đôi trẻ hôn, cắt bánh, động phòng!', done.type, 6500);
      coupleDo(done.acts, 5200);
      done.run();
      showToast(`💒 ${g} & ${b} đã thành hôn! Tặng quà để xem hôn, cắt bánh, động phòng! 🎁`);
      if (L.wedDone) speak(L.wedDone);
      await sleep(1000);
      ceremonyRunning = false;
      ceremonyEndedAt = Date.now();
      scene.afterCeremony = true;
      updateScene(); // sang phông tiệc mừng (sau khi ảnh cưới đóng)
      sceneLock--;
      processOfferingQueue();
      return;
    }

    triggerKiss();
    if (L.kiss) speak(L.kiss);
    await sleep(5000);

    triggerCake();
    if (L.cake) speak(L.cake);
    await sleep(5000);

    triggerChampagne();
    if (L.champagne) speak(L.champagne);
    await sleep(4500);
  }

  sceneLock--;
  await runDongPhong({ groom: g, bride: b, intro: true, baby: d.baby, lines: { dongphong: L.dongphong, dongphongEnd: L.dongphongEnd, babyStart: L.babyStart } });
  sceneLock++;

  showCeremonyBanner(`🎉 ${g} & ${b} VỀ CHUNG MỘT NHÀ!`, 'Vai cô dâu – chú rể mở lại cho lượt mới!', 'marry', 6000);
  coupleActor.play('bow', 5500);
  if (!scenesOn()) setTimeout(() => playBgFx('party'), 1200);
  playFanfare();
  spawnPetalsBurst(40);
  showToast(`💒 ${g} & ${b} đã thành hôn! Tặng quà để giành vai lượt mới! 💕`);
  if (L.ceremonyEnd) speak(L.ceremonyEnd);
  ceremonyRunning = false;
  ceremonyEndedAt = Date.now();
  if (d.finale) turnEndedAt = ceremonyEndedAt; // động phòng sau tiệc mừng: đôi này xong lượt, về cảnh chờ
  scene.afterCeremony = !d.finale;
  updateScene(); // vừa thành hôn: sang phông tiệc mừng (sau khi ảnh cưới đóng)
  sceneLock--;
  processOfferingQueue();
}

// "Bóc phốt" lúc vừa đủ đôi: cặp này cưới nhau lần thứ n, hoặc cô dâu / chú rể vừa bỏ người cũ để cưới người mới
const GOSSIP_GASPS = {
  again: ['Lại nữa hả 😂', 'Cưới hoài vậy trời 🤣', 'Cặp này ghiền cưới ghê 💍', 'Quen quá rồi nha 😆', 'Lần thứ mấy rồi đó 🙈'],
  switch: ['Rồi luôn! 😱', 'Drama quá bà con ơi 🍿', 'Tội người cũ ghê 😢', 'Thay nhanh dữ vậy 🤭', 'Hóng tiếp nè 👀', 'Người cũ đâu rồi 😂'],
  rivals: ['Ủa alo?? 😳', 'Ghét của nào trời trao của đó 🤣', 'Đánh nhau xong yêu luôn hả 😂', 'Quay xe gắt quá 🍿', 'Oan gia ngõ hẹp 💘', 'Tui đã bảo mà 👀']
};
function triggerGossip(d) {
  showCeremonyBanner(d.title || '😱 CÓ BIẾN!', d.subtitle || '', d.kind === 'switch' ? 'cancel' : 'marry', 6500, d.kicker || '');
  playChime();
  guestsReact(18, ['look', 'hop', 'look']);
  spawnHearts(14, { emojis: d.kind === 'again' ? ['💍', '😂', '🔁', '💖'] : d.kind === 'rivals' ? ['🥊', '💘', '😂', '🍿'] : ['💔', '😱', '🍿', '👀'] });
  const lines = GOSSIP_GASPS[d.kind] || GOSSIP_GASPS.switch;
  [400, 1100, 1900, 2800].forEach(ms => setTimeout(() => {
    const ids = Array.from(guestNodes.keys());
    if (ids.length) showChatBubble(pick(ids), pick(lines));
  }, ms));
  showToast(`${d.kicker ? d.kicker + ' ' : ''}${d.title || ''}`);
}
// Người giữ vai đã rời phòng nên bị mời xuống: quay mòng mòng rồi văng khỏi sân khấu (không có ai thế chỗ)
function triggerRoleKick(d) {
  const label = d.role === 'bride' ? 'CÔ DÂU' : 'CHÚ RỂ';
  showCeremonyBanner(`💨 ${String(d.name || '').toUpperCase()} BIẾN MẤT RỒI!`, `Vai ${label.toLowerCase()} mở lại cho bà con!`, 'auction', 5000);
  if (hasSolo() && $('#couple-wrapper')) stealFling({ role: d.role, previous: d.name, drop: false });
  showToast(`💨 ${d.name} rời sân khấu · vai ${label.toLowerCase()} đang trống!`, d.avatar, d.name);
}

// Hết tiệc mừng mà chưa ai tặng quà động phòng: đôi trẻ cúi chào, vài giây sau vai mở cho lượt mới
function triggerFarewell(d) {
  const g = d.groom || roleName('groom');
  const b = d.bride || roleName('bride');
  const bye = pickFresh('farewell', FAREWELLS);
  // Hết tiệc mừng mà không ai tặng quà động phòng: phòng tân hôn khóa cửa
  if (d.hallway) showCeremonyBanner(`TIỄN ${g.toUpperCase()} & ${b.toUpperCase()}!`, 'Đêm nay ngủ hành lang · lượt sau nhớ lì xì mở cửa nha', 'marry', 5500);
  else if (d.missed) showCeremonyBanner('PHÒNG TÂN HÔN KHÓA CỬA!', `Không ai tiễn vào phòng · ${g} và ${b} lỡ động phòng`, 'cancel', 5500, '🔒 HẾT GIỜ RỒI');
  else showCeremonyBanner(bye.title(g, b), 'Vai cô dâu – chú rể sắp mở cho lượt mới!', 'marry', 5500);
  coupleDo(bye.acts, 4800);
  bye.run();
  showToast(`💒 Tiễn ${g} & ${b}! Tặng quà để giành vai lượt mới! 💕`);
  turnEndedAt = Date.now() + 5000; // vài giây nữa server mở vai: về cảnh chờ, không hiện thêm thông báo "vai đã mở"
}

// ========================================================
// NGƯỜI TẶNG QUÀ ĐI LÊN THẢM ĐỎ
// ========================================================
const offeringQueue = [];
let offeringBusy = false;
const START = { x: 540, y: 1995, scale: 0.95 };
const ALTAR = { x: 540, y: 1335, scale: 0.64 };
const FLOOR = { x: 540, y: 1560, scale: 0.85 };

function placeFrame(p) {
  const box = actorBox();
  return { left: `${p.x - box.w / 2}px`, top: `${p.y - box.h}px`, transform: `scale(${p.scale})` };
}

// Người đi lên: video đi bộ (nếu bộ hình có), ảnh đứng, hoặc ảnh khách chính diện khi nhảy
function setupActorMedia() {
  const actor = $('#procession-actor');
  const holder = actor?.querySelector('.actor-sprite');
  if (!holder) return;
  if (!holder.querySelector('.actor-layer')) {
    const img = new Image();
    img.alt = '';
    img.className = 'actor-layer actor-img';
    const vid = document.createElement('video');
    vid.className = 'actor-layer actor-vid';
    vid.muted = true;
    vid.defaultMuted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    holder.style.backgroundImage = 'none';
    holder.append(img, vid);
  }
  const box = actorBox();
  actor.style.width = `${box.w}px`;
  actor.style.height = `${box.h}px`;
  // Nạp sẵn video đi bộ để lúc có quà là chạy ngay
  if (cfg().themeVideo !== false) {
    for (const w of Object.values(theme.data.walker || {})) {
      if (w?.video && !theme.preloaded?.has(w.video)) {
        theme.preloaded = theme.preloaded || new Set();
        theme.preloaded.add(w.video);
        fetch(themeAsset(w.video)).catch(() => {});
      }
    }
  }
}

function setActorLook(actor, item, mode, flip = false) {
  setupActorMedia();
  const holder = actor.querySelector('.actor-sprite');
  const img = holder.querySelector('.actor-img');
  const vid = holder.querySelector('.actor-vid');
  const person = { gender: item.gender, sprite: item.sprite };
  const w = theme.data.walker?.[guestGender(person)];
  const useWalker = w && mode !== 'dance';
  const danceVid = mode === 'dance' ? theme.data.guests?.dance?.[guestFile(person)] : null;
  const useVid = cfg().themeVideo !== false && ((useWalker && w.video) || danceVid);
  actor.classList.toggle('has-video', Boolean(useVid));
  actor.classList.toggle('dance-video', Boolean(useVid && danceVid));
  if (useVid) {
    const src = themeAsset(danceVid || w.video);
    if (vid.dataset.src !== src) { vid.dataset.src = src; vid.src = src; }
    if (mode === 'walk' || mode === 'dance') vid.play().catch(() => {});
    else vid.pause();
  } else {
    vid.pause();
    const src = useWalker ? themeAsset(w.img) : guestSprite(person);
    if (img.getAttribute('src') !== src) img.src = src;
  }
  vid.classList.toggle('on', Boolean(useVid));
  img.classList.toggle('on', !useVid);
  for (const el of [img, vid]) el.classList.toggle('flip', Boolean(useWalker && flip));
}

function stopActorMedia(actor) {
  actor?.querySelector('.actor-vid')?.pause();
}

// Đường đi: bộ hình có người đi lên nhìn nghiêng thì đi chéo từ góc dưới vào, xen kẽ trái/phải
let walkSide = 0;
function walkPath(item) {
  const dance = item.action === 'dance';
  if (!theme.data.walker) return { start: START, target: dance ? FLOOR : ALTAR };
  const fromRight = walkSide++ % 2 === 1;
  const start = fromRight ? { x: 770, y: 1995, scale: 0.95 } : { x: 310, y: 1995, scale: 0.95 };
  const target = dance ? FLOOR : fromRight ? { x: 612, y: 1335, scale: 0.64 } : { x: 468, y: 1335, scale: 0.64 };
  return { start, target };
}

// Lật hình khi hướng đi ngược với hướng mặt của nhân vật
function flipFor(item, from, to) {
  const w = theme.data.walker?.[guestGender({ gender: item.gender, sprite: item.sprite })];
  const facesRight = (w?.facing || 'right') !== 'left';
  return (to.x >= from.x) !== facesRight;
}

async function walkTo(actor, from, to, ms) {
  const a = actor.animate([placeFrame(from), placeFrame(to)], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
  await a.finished;
}

// Cướp vai, thay vai, phá đám: cho lên trước các quà thường đang chờ để người xem thấy kết quả ngay lúc đang tranh nhau
const urgentOffering = ev => ev.action === 'cancel'
  || (ev.action === 'role' && Boolean(ev.roleResult?.became && (ev.roleResult.replaced || ev.roleResult.previous)));
function queueOffering(ev) {
  if (urgentOffering(ev)) {
    let i = 0;
    while (i < offeringQueue.length && urgentOffering(offeringQueue[i])) i++;
    offeringQueue.splice(i, 0, ev);
  } else {
    offeringQueue.push(ev);
  }
  if (offeringQueue.length > 25) {
    const idx = offeringQueue.findIndex(x => ['thanks', 'petal', 'kiss', 'cheers'].includes(x.action));
    offeringQueue.splice(idx >= 0 ? idx : 0, 1);
  }
  processOfferingQueue();
}

async function processOfferingQueue() {
  if (offeringBusy || sceneLock > 0 || !offeringQueue.length) return;
  offeringBusy = true;
  const item = offeringQueue.shift();
  try {
    // Hàng chờ dài, hoặc phía sau còn cảnh cướp vai / phá đám đang chờ: diễn nhanh
    await presentOffering(item, offeringQueue.length >= 3 || urgentOffering(item) || offeringQueue.some(urgentOffering));
  } catch (e) {
    console.warn('offering error', e);
  }
  offeringBusy = false;
  if (offeringQueue.length) setTimeout(processOfferingQueue, 250);
}

function giftLine(item) {
  const r = item.roleResult;
  const hero = item.twist && item.action !== 'role' && TWIST_UI[item.twist.kind];
  if (hero) return `${hero.heroIcon} ${hero.heroRole} · ${item.gift} ×${item.count}`;
  if (item.action === 'role' && r) {
    const label = r.role === 'bride' ? 'cô dâu' : 'chú rể';
    if (r.queued) return `⏳ Đặt cọc vai ${label} lượt sau`;
    if (r.queueJoined || r.queueAlready) return `⏳ Xếp hàng làm ${label} · số ${r.position}`;
    if (r.queueFull || r.holderSelf) return `Mừng ${item.gift} ×${item.count}`;
    if (r.became && r.replaced) return `🔁 Thay ${label}: ${r.previous}`;
    if (r.became) return `${r.role === 'bride' ? '👰' : '👑'} Trở thành ${label}!`;
    if (r.defended) return `🛡️ Giữ ngôi ${label}: ${fmt(r.bid)} xu`;
    return `⚔️ Đấu giá ${label}: ${fmt(r.bid)} xu (thiếu ${fmt(r.missing)})`;
  }
  if (item.action === 'bouquet' && item.catcher) return `💐 Tung hoa → ${item.catcher.name} bắt được!`;
  if (item.action === 'music' && item.track) return `🎵 Đổi nhạc: ${item.track}`;
  if (item.action === 'cancel') return '💔 Phá đám! Đám cưới bị hủy';
  const info = ACTION_INFO[item.action];
  return `Mừng ${item.gift} ×${item.count}${info && item.action !== 'thanks' ? ` → ${info.icon} ${info.label.toLowerCase()}` : ''}`;
}

// Cắt ngang người tặng đang đi (khi tới giờ làm lễ) — quà không phải giành vai được xếp lại sau lễ
let offeringToken = 0;
let currentOffering = null;

async function hold(ms, token) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (token !== offeringToken) return false;
    await sleep(100);
  }
  return token === offeringToken;
}

function abortCurrentOffering() {
  if (!offeringBusy) return;
  offeringToken++;
  const actor = $('#procession-actor');
  actor?.getAnimations().forEach(a => a.finish());
  actor?.classList.remove('dancer', 'walking');
  stopActorMedia(actor);
  $('#celebration-card')?.classList.remove('show');
  $('#disco-layer')?.classList.remove('on');
  setDuck('dance', null);
  const item = currentOffering;
  if (item && item.action !== 'role' && item.action !== 'dongphong') offeringQueue.unshift(item);
}

async function presentOffering(item, fast) {
  const actor = $('#procession-actor');
  if (!actor) return;
  const token = offeringToken;
  currentOffering = item;
  try {
    await presentOfferingInner(item, fast, actor, token);
  } finally {
    currentOffering = null;
    actor.getAnimations().forEach(a => a.cancel());
    actor.classList.remove('dancer', 'walking');
    stopActorMedia(actor);
    actor.hidden = true;
  }
}

async function presentOfferingInner(item, fast, actor, token) {
  const info = ACTION_INFO[item.action] || ACTION_INFO.thanks;
  const path = walkPath(item);
  setActorLook(actor, item, 'walk', flipFor(item, path.start, path.target));
  setGiftIcon(actor.querySelector('.actor-gift-icon'), giftImage(item.gift), info.icon); // cầm đúng hình quà vừa tặng
  actor.querySelector('.actor-gift-name').textContent = `${item.gift} ×${item.count}`;
  actor.querySelector('.actor-name').textContent = item.name;
  updateAvatar(actor.querySelector('.actor-av'), item.avatar, item.name);

  const target = path.target;
  Object.assign(actor.style, placeFrame(path.start));
  actor.hidden = false;
  actor.classList.add('walking');
  await walkTo(actor, path.start, target, fast ? 1200 : 2400);
  actor.classList.remove('walking');
  if (token !== offeringToken) return;
  setActorLook(actor, item, item.action === 'dance' ? 'dance' : 'stand', flipFor(item, path.start, target));

  speak(item.funnyMessage);
  showToast(`💌 ${item.name}: ${giftLine(item)}`, item.avatar, item.name);
  // Món quà góp vào biến cố đang diễn: người tặng vừa bước tới nơi là ra tay
  if (item.twist && tw && !tw.ended && tw.kind === item.twist.kind) twistHeroArrive(item);

  let showCard = true;
  bannerHoldScale = giftShowScale(item.total);
  try {
  switch (item.action) {
    case 'role': {
      const r = item.roleResult || {};
      if (r.became) triggerRoleChange({ role: r.role, name: item.name, avatar: item.avatar, previous: r.previous, bid: r.bid, replaced: r.replaced, duel: r.duel });
      else if (!tw || tw.ended) showAuction(item); // đang có biến cố: không phủ bảng "xếp hàng" lên bảng thử thách (thẻ chúc mừng bên dưới vẫn hiện)
      break;
    }
    case 'cancel': triggerCancel(item.name, item.cancel); break;
    case 'bouquet': await triggerBouquet(item.catcher); break;
    case 'fireworks': triggerFireworks(item.name); break;
    case 'music': triggerMusic(item.name, item.track); break;
    case 'mc': triggerMarryMC(item.name, item.avatar); break;
    case 'photo':
      showCard = false;
      actor.hidden = true;
      await runPhoto(item.photo, { fromOffering: true });
      break;
    case 'dongphong':
      showCard = false;
      actor.hidden = true;
      await runDongPhong({ ...(item.couple || {}), intro: false, lines: item.lines || {} });
      break;
    case 'dance':
      showCard = false;
      await runDanceFloor(item, actor, token);
      break;
    case 'kiss': triggerKiss(); break;
    case 'cake': triggerCake(); break;
    case 'champagne': triggerChampagne(); break;
    case 'cheers': triggerCheers(item.name); break;
    case 'petal': triggerPetal(item.count >= 10); break;
    case 'ring': triggerRing(item.couple); break;
    default:
      playWeddingBell();
      spawnHearts(10);
      coupleThanks();
  }
  } finally {
    bannerHoldScale = 1;
  }
  guestsReact(item.action === 'thanks' ? 4 : 7, ['clap', 'clap', 'hop']);

  const card = $('#celebration-card');
  if (showCard && card) {
    updateAvatar($('#celeb-av'), item.avatar, item.name);
    $('#celeb-donor').textContent = item.name;
    $('#celeb-gift').textContent = giftLine(item);
    const wishes = cfg().mcLines?.cardWishes?.length ? cfg().mcLines.cardWishes : ['Chúc trăm năm hạnh phúc!'];
    $('#celeb-wish').textContent = `"${pick(wishes)}"`;
    card.classList.add('show');
    // Quà lớn: thẻ đứng lâu hơn; kể cả lúc hàng quà đang dồn (fast) cũng không cắt ngắn dưới mức thường của quà nhỏ
    const scale = giftShowScale(item.total);
    const ok = await hold(Math.round((fast && scale === 1 ? 1500 : fast ? 2200 : 3000) * scale), token);
    card.classList.remove('show');
    if (!ok) return;
  }
  if (token !== offeringToken) return;

  if (!actor.hidden) {
    if (fast) {
      await actor.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }).finished;
    } else {
      setActorLook(actor, item, 'walk', flipFor(item, target, path.start));
      actor.classList.add('walking');
      await walkTo(actor, target, path.start, 1600);
      actor.classList.remove('walking');
    }
  }
}

// ========================================================
// TRÒ CHUYỆN NGẪU NHIÊN CỦA KHÁCH
// ========================================================
const ambientLines = [
  'Chúc trăm năm hạnh phúc! 💕', '1 2 3 DZÔ! 🍻', 'Hôn điii hôn điii! 💋', 'Cô dâu xinh quá nè! ✨',
  'Chú rể phong độ đỉnh cao! 🤵', 'Ăn cỗ no nê nha mọi người! 🍗', 'Xin vía sớm có bồ! 💍',
  'Cạn ly chúc phúc đôi bạn trẻ! 🥂', 'Đẹp đôi nhất quả đất! 💖', 'Ai cướp cô dâu đi cho vui! 😆',
  'Lên nhạc quẩy đi MC ơi! 🎶', 'Bao giờ tới lượt mình ta 🥹', 'Cỗ ngon quá trời luôn! 😋',
  'Tung hoa đi cô dâu ơi! 💐', 'Rạp hôm nay đông vui ghê! 🎉', 'Chụp chung tấm hình nào! 📸',
  'Phong bì chuẩn bị sẵn rồi nha 💌', 'Hóng động phòng quá nè 🏮'
];
// Rạp càng đông càng rôm rả: dưới 12 khách khoảng 6,6 giây một câu, dưới 30 khách 4,4 giây, đông hơn 2,2 giây
let chatterTick = 0;
setInterval(() => {
  const n = guestNodes.size;
  if (!n || dpActive || ceremonyRunning) return;
  if (++chatterTick % (n < 12 ? 3 : n < 30 ? 2 : 1)) return;
  const ids = Array.from(guestNodes.keys());
  showChatBubble(pick(ids), pick(ambientLines));
}, 2200);

// ========================================================
// BIẾN CỐ LÚC SẮP LÀM LỄ: người yêu cũ phản đối, bố vợ thách cưới, cúp điện, cưới tập thể
// Server gửi sự kiện 'twist' (phase: start / end) và kèm tiến độ trong state.twist, nên màn hình mở giữa chừng vẫn theo kịp.
// Bộ hình có mục "events" (người yêu cũ, bố vợ, hội trường tối, hiệu ứng tràn màn hình — tạo bằng
// tools/xu-ly-bo-hinh.mjs --chi=bc) thì dùng hình đó; chưa có thì lấy hình khách sẵn có và hiệu ứng vẽ bằng CSS, vẫn diễn đủ.
// ========================================================
// Chữ của từng biến cố. Mỗi màn có HAI CỬA cho người xem: cửa miễn phí (free: việc cả rạp làm, freeSub: để làm gì)
// và cửa quà (gift: tặng quà thì thành ai). Câu chữ dùng trend TikTok Việt: lốp trưởng, thực dân Zalo, dạ gỗ xà cừ,
// cơm nước gì chưa người đẹp, sáu bảy, nếu em biến thành con gián... Trend cũ đi thì sửa ngay ở đây.
// Câu quát (shouts) hiện trong bong bóng rộng 222px: giữ mỗi câu tối đa 2 dòng (khoảng 27 ký tự), dài hơn sẽ che nhân vật.
const TWIST_UI = {
  ex: {
    slam: 'KHOAN ĐÃ!!!', slamSub: 'TÔI PHẢN ĐỐI!', tape: '🚨 BIẾN CĂNG', unit: '❤',
    free: 'THẢ TIM ❤', freeSub: 'che chắn đôi trẻ', gift: 'làm vệ sĩ', heroIcon: '🛡️', heroRole: 'Vệ sĩ',
    // Người yêu cũ (khách bất kỳ, vợ chồng cũ thật): câu chung, thêm câu theo hình nhân vật nam (tài xế) / nữ (cầm hóa đơn tới tính sổ)
    shouts: ['Tôi phản đối!', 'Trả người yêu cho tôi!', 'Trả tiền trà sữa đây!', 'Cưới mà không mời tôi hả?'],
    shoutsMale: ['Chở bao năm, giờ lên xe hoa?', 'Năm sao rồi mà vẫn bỏ tôi?'],
    shoutsFemale: ['Nợ nần gì chưa người đẹp?', 'Tính sổ xong rồi hẵng cưới!'],
    // Lốp trưởng (người đứng đầu hàng chờ): họ đang chờ lên thay thật nên nói chuyện chờ đợi
    queueSub: 'LỐP TRƯỞNG TỚI!',
    shoutsQueue: ['Tôi chờ đủ lâu rồi!', 'Tới lượt tôi rồi chứ!', 'Lốp dự phòng cũng chạy tốt!']
  },
  dowry: {
    slam: 'THÁCH CƯỚI!', slamSub: 'SÍNH LỄ ĐÂU?', tape: '🧧 BỐ VỢ CHẶN CỬA', unit: 'lời xin',
    free: 'GÕ: DẠ BỐ', freeSub: 'xin cưới giùm', gift: 'góp sính lễ', heroIcon: '🧧', heroRole: 'Nhà tài trợ sính lễ', heroChip: 'Nhà tài trợ',
    shouts: ['Sính lễ đâu?!', 'Lương tháng bao nhiêu?', 'Nhà, xe, sổ đỏ đâu hết?', 'Muốn cưới con gái tôi hả?', 'Vàng đâu, đưa đây cắn thử!'],
    // Bố vợ hỏi dồn, chú rể né bằng "dạ gỗ xà cừ"; bố vợ phản ứng theo cỡ món quà (quà nhỏ: "sáu bảy", tức tạm tạm)
    reply: 'Dạ... gỗ xà cừ ạ!',
    react: { small: 'Sáu bảy! Tạm được.', mid: 'Được đấy con!', big: 'Con rể quý đây rồi!' }
  },
  blackout: {
    slam: 'CÚP ĐIỆN!', slamSub: 'AI TẮT CẦU DAO?', tape: '⚡ MẤT ĐIỆN TOÀN RẠP', unit: '⚡',
    free: 'THẢ TIM ❤', freeSub: 'quay máy phát', gift: 'thắp nến', heroIcon: '🕯️', heroRole: 'Người thắp nến'
  },
  mass: {
    slam: 'CƯỚI TẬP THỂ!', slamSub: 'CHỒNG CON GÌ CHƯA NGƯỜI ĐẸP?', tape: '💒 CƯỚI TẬP THỂ · NGÀY ĐẸP', unit: 'suất',
    free: 'GÕ: CƯỚI', freeSub: 'để cưới ké', gift: 'suất hạng nhất', heroIcon: '👑', heroRole: 'Cưới ké hạng nhất'
  },
  roach: {
    slam: 'HÓA GIÁN!', slamSub: 'NẾU EM BIẾN THÀNH CON GIÁN?', tape: '🪳 THỬ LÒNG CHÚ RỂ', unit: '❤',
    free: 'YÊU hay KHÔNG?', freeSub: 'gõ: yêu · hoặc: không yêu', gift: 'tiếp sức tình yêu', heroIcon: '💘', heroRole: 'Thần tình yêu'
  },
  // ----- SỰ CỐ: một bước vốn miễn phí bị chặn lại. title / stake: chữ trên bảng; actor: nhân vật bước ra (art = tên nhóm
  // hình trong bộ hình, chưa có thì mượn hình khách và che mặt bằng badge); end: bảng tin kết cục thắng / thua -----
  ring: {
    slam: 'ỦA, NHẪN ĐÂU?!', slamSub: 'CHÚ RỂ QUÊN NHẪN Ở NHÀ', tape: '💍 SỰ CỐ TRAO NHẪN', unit: '❤',
    free: 'THẢ TIM ❤', freeSub: 'đi tìm nhẫn', gift: 'cho mượn nhẫn', heroIcon: '💍', heroRole: 'Người cho mượn nhẫn', heroChip: 'Cho mượn nhẫn',
    title: ({ groom, up }) => `${up(groom)} QUÊN NHẪN CƯỚI!`, stake: () => 'Không kịp: đeo tạm dây thun!',
    reply: 'Ủa... nhẫn đâu rồi?!', rain: ['💍', '✨'],
    end: {
      winTitle: 'TÌM THẤY NHẪN RỒI!', winSub: 'Làm lễ thôi', winTag: '💍 CÓ NHẪN CƯỚI', winRain: ['💍', '✨', '💖', '🎉'],
      loseTitle: 'ĐEO TẠM DÂY THUN!', loseSub: (g, b) => `${g} hứa bù nhẫn cho ${b} sau`, loseTag: '🥲 KHÔNG TÌM KỊP NHẪN', loseRain: ['🪢', '😅']
    }
  },
  kiss: {
    slam: 'KHOAN, CHƯA CHO HÔN!', slamSub: 'BỐ VỢ CHEN VÀO GIỮA', tape: '🧧 BỐ VỢ CHẶN HÔN', unit: '❤',
    free: 'GÕ: HÔN ĐI', freeSub: 'xin bố cho hôn', gift: 'mời rượu bố vợ', heroIcon: '🍶', heroRole: 'Cao thủ dụ bố vợ', heroChip: 'Dụ bố vợ',
    title: ({ cast, up }) => (cast.name ? `BỐ VỢ ${up(cast.name)} CHƯA CHO HÔN!` : 'BỐ VỢ CHƯA CHO HÔN!'), stake: () => 'Không đủ: chỉ được hôn gió!',
    actor: { art: 'bovo', role: '🧧 BỐ VỢ', name: 'Ông Khó Tính', badge: '😠' },
    shouts: ['Chưa cho hôn!', 'Hôn hít gì tầm này!', 'Đứng xa con gái tôi ra!', 'Có tôi ở đây nhé!'],
    reply: 'Dạ... con xin phép bố!', react: 'Ờ... rượu này được đấy!', rain: ['🍶', '💋'],
    end: {
      winTitle: 'BỐ VỢ QUAY MẶT ĐI!', winSub: 'Hôn lẹ đi chú rể', winTag: '💋 BỐ VỢ CHO HÔN', winRain: ['💋', '💖', '🍶', '✨'],
      loseTitle: 'CHỈ ĐƯỢC HÔN GIÓ!', loseSub: g => `Bố vợ không nhúc nhích · ${g} hôn gió qua vai bố`, loseTag: '😘 BỐ VỢ CHƯA ƯNG', loseRain: ['😘', '💨']
    }
  },
  cake: {
    slam: 'BÁNH CƯỚI ĐỔ RỒI!', slamSub: 'AI QUẸT MẤT TẦNG TRÊN?', tape: '🎂 SỰ CỐ BÁNH CƯỚI', unit: '❤',
    free: 'THẢ TIM ❤', freeSub: 'dựng lại bánh', gift: 'tài trợ bánh mới', heroIcon: '🎂', heroRole: 'Nhà tài trợ bánh cưới', heroChip: 'Tài trợ bánh',
    title: () => 'BÉ TÍ QUẸT SẬP BÁNH CƯỚI!', stake: () => 'Không kịp: cắt tạm bánh mì!',
    actor: { art: 'kid', role: '🍰 THỦ PHẠM', name: 'Bé Tí', badge: '😋' },
    shouts: ['Bánh ngon quá à!', 'Con quẹt có miếng à!', 'Hông phải con đâu!'],
    react: 'Cho con miếng nữa!', rain: ['🎂', '🍰'],
    end: {
      winTitle: 'BÁNH MỚI TỚI RỒI!', winSub: 'Mời đôi trẻ cắt bánh', winTag: '🎂 CÓ BÁNH CƯỚI MỚI', winRain: ['🎂', '🍰', '✨', '🎉'],
      loseTitle: 'CẮT TẠM BÁNH MÌ!', loseSub: () => 'Bánh cưới không dựng kịp · bánh mì cũng ngọt', loseTag: '🥖 HẾT GIỜ RỒI', loseRain: ['🥖', '😅']
    }
  },
  cheers: {
    slam: 'ÔNG CHÚ GIÀNH MIC!', slamSub: 'HÁT TỚI BÀI THỨ BA RỒI', tape: '🎤 ÔNG CHÚ KHÔNG CHỊU XUỐNG', unit: '❤',
    free: 'GÕ: XUỐNG ĐI', freeSub: 'mời chú trả mic', gift: 'mời chú một ly', heroIcon: '🍻', heroRole: 'Chủ xị', heroChip: 'Chủ xị',
    title: () => 'ÔNG CHÚ GIÀNH MIC HÁT HOÀI!', stake: () => 'Không đủ: cả rạp nghe hết liên khúc!',
    actor: { art: 'uncle', role: '🎤 ÔNG CHÚ', name: 'Chú Ba', badge: '🎤' },
    shouts: ['Bài nữa nha bà con!', 'Chưa say! Chú hát tiếp!', 'Một hai ba, dô!', 'Nhạc lên cho chú!'],
    react: 'Ừa, mời thì chú uống!', rain: ['🍻', '🎶'],
    end: {
      winTitle: 'ÔNG CHÚ TRẢ MIC RỒI!', winSub: 'Cả rạp nâng ly', winTag: '🍻 MỜI CHÚ XUỐNG THÀNH CÔNG', winRain: ['🍻', '🥂', '🎉', '✨'],
      loseTitle: 'NGHE HẾT LIÊN KHÚC!', loseSub: () => 'Ông chú hát tới cùng · cụng ly để lượt sau', loseTag: '🎤 KHÔNG AI CẢN NỔI', loseRain: ['🎶', '🎤', '😵']
    }
  },
  room: {
    slam: 'CHẶN CỬA PHÒNG!', slamSub: 'LÌ XÌ MỚI CHO VÀO', tape: '🚪 HỘI BẠN THÂN CHẶN CỬA', unit: '❤',
    free: 'GÕ: MỞ CỬA', freeSub: 'xin cho đôi trẻ vào phòng', gift: 'lì xì mở cửa', heroIcon: '🏮', heroRole: 'Ông mai, bà mối', heroChip: 'Ông mai bà mối',
    title: () => 'HỘI BẠN THÂN CHẶN CỬA PHÒNG!', stake: () => 'Không đủ: đôi trẻ ngủ hành lang!',
    actor: { art: 'friends', role: '🚪 HỘI BẠN THÂN', name: 'Hội Bạn Thân', badge: '🧧' },
    shouts: ['Lì xì đâu?', 'Chưa lì xì chưa cho vào!', 'Trả lời ba câu đã!', 'Muốn vào thì mở hầu bao!'],
    reply: 'Cho tụi em vào đi mà!', react: 'Lì xì đẹp đó nha!', rain: ['🧧', '🚪'],
    end: {
      winTitle: 'MỞ CỬA RỒI!', winSub: 'Tiễn đôi trẻ vào phòng tân hôn', winTag: '🏮 CỬA PHÒNG ĐÃ MỞ', winRain: ['🧧', '🏮', '💖', '🎉'],
      loseTitle: 'NGỦ NGOÀI HÀNH LANG!', loseSub: (g, b) => `Không ai lì xì mở cửa · ${g} và ${b} trải chiếu ngoài hành lang`, loseTag: '🚪 CỬA KHÔNG MỞ', loseRain: ['🛏️', '🥲']
    }
  }
};
const TWIST_GASPS = {
  ex: ['Ối dồi ôi! 😱', 'Biến căng rồi! 🍿', 'Hóng hóng hóng 🍿', 'Về kể lại không ai tin 😱', 'Tới công chuyện! 🔥', 'Cứu đám cưới! 😭'],
  dowry: ['Dạ bố! 🙇', 'Bố vợ khó quá 😰', 'Xin bố cho cưới 🙏', 'Căng nha chú rể 😂', 'Sổ đỏ đâu rồi 📕'],
  blackout: ['Ai tắt đèn vậy?! 😱', 'Á! Ai đụng tui? 😳', 'Tối thui luôn 🙈', 'Cúp điện thiệt hả 😭', 'Bật đèn pin lên 🔦'],
  mass: ['Cưới cưới cưới! 💍', 'Cho em cưới ké 🙋', 'Ế lâu rồi cho cưới với 😭', 'Ngày đẹp quá nè 💒'],
  roach: ['Gián đáng yêu hông? 🪳', 'Yêu yêu yêu! ❤', 'Hôn đi chú rể 😂', 'Gián mà vẫn xinh 🥹', 'Chạy lẹ chú rể ơi 🏃'],
  ring: ['Quên nhẫn thiệt hả 😭', 'Chú rể hậu đậu quá 😂', 'Ai có nhẫn cho mượn đi 💍', 'Cô dâu dỗi rồi kìa 😤'],
  kiss: ['Hôn đi hôn đi! 💋', 'Bố ơi cho hôn đi 🙏', 'Bố vợ canh kỹ quá 😂', 'Căng nha chú rể 😰'],
  cake: ['Trời ơi cái bánh 😭', 'Bé Tí ơi là Bé Tí 😂', 'Dựng bánh lẹ lên 🎂', 'Thương cái bánh ghê 🥲'],
  cheers: ['Xuống đi chú ơi 😂', 'Chú hát hay mà dài quá 🎤', 'Đám nào cũng có ông chú này 🤣', 'Cho tụi con cụng ly với 🍻'],
  room: ['Mở cửa đi mà 🚪', 'Lì xì đâu chú rể 🧧', 'Hội bạn thân lầy quá 😂', 'Cho đôi trẻ vào đi 🙏']
};
const TWIST_ACTOR = { x: 786, bottom: 1152, h: 448 }; // nhân vật của biến cố đứng bên phải sân khấu, quay về phía cặp đôi

// ----- ÂM THANH BIẾN CỐ (tự tổng hợp) -----
// "Tèn tén tèn" kịch tính: ba nốt đồng trầm, nốt cuối kéo dài kèm trống
const playSting = () => sfx(ctx => {
  [[0, 196], [0.3, 185], [0.6, 146.83]].forEach(([at, f], i) => {
    const dur = i === 2 ? 1.7 : 0.26;
    tone(ctx, { freq: f, type: 'sawtooth', at, dur, gain: 0.15 });
    tone(ctx, { freq: f / 2, type: 'square', at, dur, gain: 0.09 });
    noiseBurst(ctx, { at, dur: 0.12, gain: 0.26, hp: 150 });
  });
  tone(ctx, { freq: 110, to: 38, at: 0.6, dur: 1.3, gain: 0.3 });
});
const playThunder = () => sfx(ctx => {
  noiseBurst(ctx, { dur: 0.06, gain: 0.5, hp: 2800 });
  noiseBurst(ctx, { at: 0.05, dur: 1.1, gain: 0.42, hp: 70 });
  tone(ctx, { freq: 72, to: 28, at: 0.05, dur: 1.5, gain: 0.34 });
});
const playPowerDown = () => sfx(ctx => {
  glide(ctx, { pts: [[0, 560], [0.95, 42]], type: 'sawtooth', gain: 0.11, release: 0.25 });
  noiseBurst(ctx, { dur: 0.05, gain: 0.4, hp: 2500 });
});
const playPowerUp = () => sfx(ctx => {
  glide(ctx, { pts: [[0, 70], [0.65, 900]], type: 'sawtooth', gain: 0.09, release: 0.1 });
  [1046.5, 1318.5, 1568, 2093].forEach((freq, i) => tone(ctx, { freq, type: 'triangle', at: 0.62 + i * 0.07, dur: 0.9, gain: 0.1 }));
});
const playHeartbeat = () => sfx(ctx => {
  tone(ctx, { freq: 64, to: 40, dur: 0.14, gain: 0.4 });
  tone(ctx, { freq: 58, to: 38, at: 0.19, dur: 0.16, gain: 0.32 });
});
const playCoins = () => sfx(ctx => {
  for (let i = 0; i < 9; i++) tone(ctx, { freq: 1568 + (i % 3) * 262, type: 'square', at: i * 0.11, dur: 0.16, gain: 0.04 });
});

let twistUi = null;
let tw = null; // biến cố đang hiện: { id, kind, d, deadline, lastN, lastSec, timers, later, ended }

function twistEls() {
  if (twistUi) return twistUi;
  const frame = $('#frame');
  const scene = $('#scene');
  const mk = (tag, cls, parent) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    parent.append(el);
    return el;
  };
  const ui = {};
  // Trong khung cảnh (nằm sau các bảng): hội trường tối và nhân vật của biến cố
  ui.darkBg = document.createElement('img');
  ui.darkBg.className = 'tw-bg-dark';
  ui.darkBg.alt = '';
  $('.stage-bg')?.after(ui.darkBg);
  ui.actor = mk('div', 'tw-actor', scene);
  ui.sprite = mk('div', 'tw-actor-sprite', ui.actor);
  ui.badge = mk('div', 'tw-actor-emoji', ui.actor);
  ui.tag = mk('div', 'tw-actor-tag', ui.actor);
  ui.tagRole = mk('i', '', ui.tag);
  const tagRow = mk('div', 'tw-tag-row', ui.tag);
  ui.tagAv = mk('span', 'tw-av', tagRow);
  ui.tagName = mk('b', '', tagRow);
  ui.tagHint = mk('small', 'tw-tag-hint', ui.tag); // lốp trưởng: món quà thay vai để cướp ngay
  ui.shout = mk('div', 'tw-shout', ui.actor);
  ui.reply = mk('div', 'tw-reply', scene);         // chú rể đáp lời bố vợ
  ui.roach = mk('div', 'tw-gian', scene);         // cô dâu hóa gián, dùng khi bộ hình chưa có hình couple_roach
  ui.roach.textContent = '🪳';
  // Ngoài khung cảnh (nổi trên các bảng): viền tối, bóng đêm, hiệu ứng, bảng thử thách, chữ mở màn
  ui.vignette = mk('div', 'tw-vignette', frame);
  ui.dark = mk('div', 'tw-dark', frame);
  ui.eyes = mk('div', 'tw-eyes', frame);
  ui.spot = mk('div', 'tw-spot', frame);
  ui.fx = mk('video', 'tw-fx', frame);
  ui.fx.muted = true;
  ui.fx.playsInline = true;
  ui.fx.setAttribute('muted', '');
  ui.fx.setAttribute('playsinline', '');
  ui.panel = mk('div', 'tw-panel', frame);
  const head = mk('div', 'tw-head', ui.panel);
  ui.tape = mk('span', 'tw-tape', head);
  ui.timer = mk('b', 'tw-timer', head);
  ui.title = mk('div', 'tw-title', ui.panel);
  // Hai cửa đặt cạnh nhau: miễn phí (việc cả rạp cùng làm) và tặng quà (làm người hùng của màn này)
  const doors = mk('div', 'tw-doors', ui.panel);
  const free = mk('div', 'tw-door free', doors);
  ui.verb = mk('b', '', free);
  ui.how = mk('span', '', free);
  const gift = mk('div', 'tw-door gift', doors);
  mk('b', '', gift).textContent = 'TẶNG QUÀ 🎁';
  ui.giftSub = mk('span', '', gift);
  ui.bar = mk('div', 'tw-bar', ui.panel);
  ui.fill = mk('i', '', ui.bar);
  ui.num = mk('b', '', ui.bar);
  ui.tally = mk('div', 'tw-tally', ui.panel); // con gián: bao nhiêu người chọn yêu, bao nhiêu người bỏ chạy
  ui.slots = mk('div', 'tw-slots', ui.panel);
  const foot = mk('div', 'tw-foot', ui.panel);
  ui.stake = mk('span', 'tw-stake', foot);
  ui.top = mk('span', 'tw-top', foot);
  ui.stamp = mk('div', 'tw-stamp', ui.panel);
  ui.pops = mk('div', 'tw-pops', frame);
  ui.slam = mk('div', 'tw-slam', frame);
  ui.slamMain = mk('b', '', ui.slam);
  ui.slamSub = mk('i', '', ui.slam);
  ui.count = mk('div', 'tw-count', frame);
  ui.pairs = mk('div', 'tw-pairs', frame);
  // Thiệp mừng lấp lánh kiểu "thực dân Zalo" bố vợ gửi khi gật đầu
  ui.zalo = mk('div', 'tw-zalo', frame);
  mk('span', '', ui.zalo).textContent = '🌹✨🌹✨🌹';
  mk('b', '', ui.zalo).textContent = 'CHÚC HAI CON TRĂM NĂM HẠNH PHÚC';
  ui.zaloFrom = mk('small', '', ui.zalo);
  twistUi = ui;
  return ui;
}

// Hiệu ứng tràn màn hình của bộ hình (kính vỡ, sét, mưa vàng...): có thì phát một lượt, không có thì thôi
function twistFx(name) {
  const f = theme.data.events?.fx?.[name];
  const src = typeof f === 'string' ? f : f?.src;
  if (!src || cfg().themeVideo === false) return false;
  const el = twistEls().fx;
  el.style.mixBlendMode = f?.blend || ''; // video nền đen: hòa sáng vào khung hình, phần đen tự biến mất
  el.src = themeAsset(src);
  try { el.currentTime = 0; } catch (e) {}
  el.classList.add('on');
  el.play().catch(() => {});
  el.onended = () => el.classList.remove('on');
  setTimeout(() => el.classList.remove('on'), 6000);
  return true;
}

function twistActorMedia(s) {
  let el = null;
  if (s?.video && cfg().themeVideo !== false) {
    el = document.createElement('video');
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.loop = true;
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    if (s.img) el.poster = themeAsset(s.img);
    el.src = themeAsset(s.video);
    el.play().catch(() => {});
  } else if (s?.img) {
    el = new Image();
    el.alt = '';
    el.src = themeAsset(s.img);
  }
  if (el) twistEls().sprite.replaceChildren(el);
  return Boolean(el);
}
// Bố vợ đổi nét mặt: đang khó chịu -> cười khi cả rạp xin đủ
function twistActorMood(mood) {
  const ui = twistEls();
  const def = theme.data.events?.bovo;
  if (def?.states?.[mood]) twistActorMedia(def.states[mood]);
  else if (ui.actor.classList.contains('fallback')) ui.badge.textContent = mood === 'happy' ? '😄' : '😠';
}
function twistActorShow(d) {
  const ui = twistEls();
  const ev = theme.data.events || {};
  const cast = d.cast || {};
  const isEx = d.kind === 'ex';
  const A = TWIST_UI[d.kind].actor; // nhân vật của một sự cố (bố vợ chặn hôn, ông chú, Bé Tí, hội bạn thân)
  const def = isEx ? (ev.ex?.[cast.gender === 'female' ? 'female' : 'male'] || ev.ex?.male || ev.ex?.female) : A ? ev[A.art] : ev.bovo;
  const first = isEx || (A && !def?.states) ? def : def?.states?.angry || Object.values(def?.states || {})[0];
  let aspect = def?.aspect;
  const own = twistActorMedia(first);
  if (!own) {
    // Chưa có hình riêng: lấy hình khách của chính người đó (không có thì một khách nam của bộ hình)
    const p = (currentState?.people || []).find(x => x.id === 'tik-' + cast.id);
    const img = new Image();
    img.alt = '';
    img.src = p ? guestSprite(p) : guestSprite({ gender: isEx && cast.gender === 'female' ? 'female' : 'male', sprite: 6 });
    ui.sprite.replaceChildren(img);
    aspect = theme.data.guests?.aspect || 0.9;
  }
  // Bảng thử thách cao thấp tùy độ dài tên: nhân vật thấp bớt lại nếu cần, để đầu và thẻ tên không chui dưới bảng
  const panelBottom = ui.panel.offsetTop + ui.panel.offsetHeight;
  // Nhóm nhiều người (hội bạn thân, ảnh rộng): thấp bớt lại, thẻ tên và bong bóng đưa lên phía trên đầu để không che mặt ai
  const wide = (aspect || 0.5) >= 0.9;
  const h = wide ? Math.max(300, Math.min(340, TWIST_ACTOR.bottom - panelBottom - 130))
    : Math.max(340, Math.min(TWIST_ACTOR.h, TWIST_ACTOR.bottom - panelBottom - 20));
  ui.actor.classList.toggle('wide', wide);
  const w = Math.round(h * (aspect || 0.5));
  Object.assign(ui.actor.style, { width: `${w}px`, height: `${h}px`, left: `${TWIST_ACTOR.x - w / 2}px`, top: `${TWIST_ACTOR.bottom - h}px` });
  ui.actor.dataset.kind = d.kind;
  ui.actor.classList.toggle('fallback', !own);
  // Hình mượn của khách: che mặt bằng một biểu cảm lớn để người xem thấy ngay đây là nhân vật của biến cố
  ui.badge.textContent = own ? '' : isEx ? '😭' : A ? A.badge : '😠';
  ui.tagRole.textContent = isEx ? (cast.real ? '📼 VỢ CHỒNG CŨ THẬT' : cast.queued ? '🛞 LỐP TRƯỞNG' : '💔 NGƯỜI YÊU CŨ') : A ? A.role : '🧧 BỐ VỢ';
  // Lốp trưởng muốn lên thật thì có sẵn cửa: món quà thay vai là cướp ngay (hiện cho cả rạp thấy).
  // Sự cố: món quà của đúng bước đang bị chặn thì gỡ ngay
  const hint = isEx && d.role && currentState ? roleGiftHint(d.role, currentState, cfg()) : null;
  ui.tagHint.textContent = hint ? `🎁 ${hint.text.replace(/^Tặng /, '')} = cướp ngay` : A && d.fix ? `🎁 ${d.fix} = gỡ ngay` : '';
  ui.actor.classList.toggle('has-hint', Boolean(hint || (A && d.fix)));
  ui.tagName.textContent = cast.name || (isEx ? 'Tình Cũ' : A ? A.name : 'Ông Khó Tính');
  ui.tagAv.hidden = !cast.name;
  if (cast.name) updateAvatar(ui.tagAv, cast.avatar || '', cast.name);
  // Câu quát chỉ hiện lúc mới bước ra, rồi nhường chỗ cho các thẻ góp sức
  const lines = TWIST_UI[d.kind];
  const pool = !isEx ? lines.shouts : cast.queued ? lines.shoutsQueue : [...lines.shouts, ...(cast.gender === 'female' ? lines.shoutsFemale : lines.shoutsMale)];
  twistShout(pick(pool), 3800);
  ui.actor.classList.remove('on', 'out', 'fling', 'jump');
  void ui.actor.offsetWidth;
  ui.actor.classList.add('on');
  playThud();
}
let twistShoutTimer = null;
// Bong bóng lời nói của nhân vật biến cố (lúc mới bước ra, và lúc phản ứng với một món quà)
function twistShout(text, ms = 2600) {
  const ui = twistEls();
  if (!text) return;
  ui.shout.textContent = text;
  ui.shout.classList.add('on');
  clearTimeout(twistShoutTimer);
  twistShoutTimer = setTimeout(() => ui.shout.classList.remove('on'), ms);
}
// Người tặng quà bước tới sân khấu giữa biến cố: vệ sĩ đẩy lùi lốp trưởng, nến bừng sáng, tim hôn bay lên
function twistHeroArrive(item) {
  const ui = twistEls();
  const kind = item.twist.kind;
  if (kind === 'ex') {
    ui.sprite.classList.remove('pushed');
    void ui.sprite.offsetWidth;
    ui.sprite.classList.add('pushed');
    setTimeout(() => ui.sprite.classList.remove('pushed'), 750); // trả lại nhịp cử động thường của nhân vật
    playBonk();
    heartRing(['🛡️', '💖', '🛡️'], 14);
  } else if (kind === 'blackout') {
    screenFlash('#fff3b0');
  } else if (kind === 'roach') {
    spawnHearts(12, { x: 520, y: 820, spread: 260, emojis: ['💋', '💘', '❤'] });
  } else if (kind === 'dowry') {
    playCoins();
  }
}
// Chú rể đáp lời (bong bóng nhỏ bên trái cặp đôi)
let twistReplyTimer = null;
function twistReply(text, ms = 2800) {
  const ui = twistEls();
  ui.reply.textContent = text;
  // Nằm ngay dưới bảng thử thách (bảng cao thấp tùy độ dài tên), để mép bảng không che mất dòng đầu
  ui.reply.style.top = `${Math.max(664, ui.panel.offsetTop + ui.panel.offsetHeight + 18)}px`;
  ui.reply.classList.add('on');
  clearTimeout(twistReplyTimer);
  twistReplyTimer = setTimeout(() => ui.reply.classList.remove('on'), ms);
}
// Cô dâu hóa gián: bộ hình có động tác couple_roach thì dùng; chưa có thì phủ một con gián lên nửa cô dâu của ảnh cặp đôi
function twistRoachOn() {
  const ui = twistEls();
  playBonk();
  spawnHearts(10, { x: 500, y: 800, spread: 220, emojis: ['💨', '✨', '🪳'] });
  if (coupleActor.play('roach', 120000)) return;
  const s = coupleSpot('bride');
  if (!s) return;
  // Phủ lên đầu và nửa thân trên của cô dâu (mặt cô dâu hơi lệch về phía chú rể so với tâm váy)
  Object.assign(ui.roach.style, { left: `${Math.round(s.x + s.w * 0.07)}px`, top: `${Math.round(s.top + s.h * 0.2)}px`, fontSize: `${Math.round(s.w * 0.72)}px` });
  ui.roach.classList.add('on');
}
// Chỗ đứng của cô dâu / chú rể trong ảnh cặp đôi đang hiện (toạ độ khung): cô dâu bên trái, chú rể bên phải
function coupleSpot(role) {
  const host = $('#couple-sprite');
  if (!host) return null;
  const r = frameRect(host);
  if (r.w < 20 || r.h < 20) return null;
  const fig = figureOf(coupleActor.layers[coupleActor.state] || coupleActor.layers.idle);
  const k = fig ? Math.min(r.w / fig.iw, r.h / fig.ih) : 1;
  const dw = fig ? fig.iw * k : r.w;
  const dh = fig ? fig.ih * k : r.h;
  const b = fig?.box || { x0: 0, x1: 1, y0: 0, y1: 1 };
  const fx = b.x0 + (b.x1 - b.x0) * (role === 'bride' ? 0.3 : 0.72);
  return { x: r.x + (r.w - dw) / 2 + fx * dw, top: r.y + (r.h - dh) + b.y0 * dh, w: (b.x1 - b.x0) * dw, h: (b.y1 - b.y0) * dh };
}
function twistRoachOff(sparkle = false) {
  const ui = twistEls();
  const was = ui.roach.classList.contains('on') || coupleActor.state.startsWith('roach');
  ui.roach.classList.remove('on');
  if (coupleActor.state.startsWith('roach')) coupleActor.show('idle');
  if (was && sparkle) spawnHearts(14, { x: 500, y: 800, spread: 260, emojis: ['✨', '💖', '👰'] });
}
// mode: walk = lủi thủi đi ra · fling = bị hất văng · jump = nhảy lên sân khấu (cướp vai)
function twistActorOut(mode = 'walk') {
  const el = twistEls().actor;
  if (!el.classList.contains('on')) return;
  el.classList.add(mode === 'fling' ? 'fling' : mode === 'jump' ? 'jump' : 'out');
  setTimeout(() => el.classList.remove('on', 'out', 'fling', 'jump'), 1250);
}

function twistRender(d) {
  const ui = twistEls();
  const k = TWIST_UI[d.kind];
  const cast = d.cast || {};
  const up = s => String(s || '').toUpperCase();
  // Tên cô dâu, chú rể lấy từ chính sự kiện mở màn (state mới có thể tới sau sự kiện vài phần mười giây)
  const groom = d.couple?.groom || roleName('groom');
  const bride = d.couple?.bride || roleName('bride');
  ui.tape.textContent = k.tape;
  const title = d.kind === 'ex' ? (cast.queued ? `${up(cast.name)} ĐÒI LÊN LỐP CHÍNH!` : `${up(cast.name)} ĐÒI LẠI ${up(cast.of)}!`)
    : d.kind === 'dowry' ? (cast.name ? `BỐ VỢ ${up(cast.name)} THÁCH CƯỚI!` : 'BỐ VỢ THÁCH CƯỚI!')
    : d.kind === 'blackout' ? 'RẠP MẤT ĐIỆN RỒI!'
    : d.kind === 'roach' ? `${up(bride)} HÓA GIÁN RỒI!`
    : k.title ? k.title({ cast, groom, bride, up }) : 'CƯỚI TẬP THỂ!';
  ui.title.textContent = title;
  ui.title.hidden = d.kind === 'mass'; // cưới tập thể có thêm hàng ô suất cưới ké: bỏ dòng tiêu đề (đã có trên băng chữ) cho bảng khỏi che mặt cặp đôi
  const len = [...title].length;
  ui.title.dataset.size = len > 34 ? 'xs' : len > 25 ? 's' : len > 19 ? 'm' : 'l';
  ui.verb.textContent = k.free;
  ui.how.textContent = k.freeSub;
  ui.giftSub.textContent = k.gift;
  const role = d.role === 'groom' ? 'chú rể' : 'cô dâu';
  ui.stake.textContent = d.kind === 'ex'
    ? (d.canSteal ? `Không đủ: ${cast.name} lên thay ${role}!` : `Không đủ: ${cast.name} ngồi lì dự cưới!`)
    : d.kind === 'dowry' ? (d.canSteal ? `Không đủ: ${groom} bị đuổi!` : `Không đủ: ${groom} phải ở rể!`)
    : d.kind === 'blackout' ? 'Không kịp: cưới bằng ánh nến!'
    : d.kind === 'roach' ? (d.canSteal ? `Không đủ: ${groom} bỏ chạy mất dép!` : `Không đủ: ${groom} ngủ sô pha!`)
    : k.stake ? k.stake({ cast, groom, bride })
    : 'Ai gõ trước được trước!';
  ui.panel.dataset.kind = d.kind;
  ui.bar.hidden = d.kind === 'mass';
  ui.tally.hidden = d.kind !== 'roach';
  ui.slots.hidden = d.kind !== 'mass';
  ui.top.dataset.key = '';
  ui.top.replaceChildren();
  twistProgress(d);
}
const twistDarkMax = () => (theme.data.events?.dark ? 0.6 : 0.9);
// Góc phải chân bảng: những người đã tặng quà trong màn này (người hùng). Chưa ai tặng thì hiện người góp tim, bình luận nhiều nhất.
function twistHeroes(d) {
  const ui = twistEls();
  const heroes = d.heroes || [];
  const top = d.top?.[0];
  const key = JSON.stringify([d.kind, heroes.map(h => [h.name, h.avatar]), heroes.length ? 0 : top ? [top.name, top.pts] : 0]);
  if (key === ui.top.dataset.key) return;
  ui.top.dataset.key = key;
  ui.top.classList.toggle('heroes', heroes.length > 0);
  if (!heroes.length) {
    ui.top.textContent = top ? `🔥 ${top.name} +${fmt(top.pts)}` : '';
    return;
  }
  const icon = document.createElement('i');
  icon.textContent = TWIST_UI[d.kind].heroIcon;
  const avs = heroes.slice(0, 3).map(h => {
    const av = document.createElement('span');
    av.className = 'tw-av';
    updateAvatar(av, h.avatar || '', h.name);
    return av;
  });
  const name = document.createElement('b');
  name.textContent = heroes.length > 1 ? `${heroes[0].name} +${heroes.length - 1}` : heroes[0].name;
  ui.top.replaceChildren(icon, ...avs, name);
}
function twistProgress(d) {
  const ui = twistEls();
  twistHeroes(d);
  if (d.kind === 'mass') {
    const claims = d.claims || [];
    const key = JSON.stringify([claims, d.slots]);
    if (key === ui.slots.dataset.key) return;
    ui.slots.dataset.key = key;
    ui.slots.dataset.n = String(d.slots || 0); // mở thêm suất hạng nhất: ô nhỏ lại cho vừa một hàng
    ui.slots.replaceChildren(...Array.from({ length: d.slots || 0 }, (_, i) => {
      const who = claims[i];
      const cell = document.createElement('div');
      cell.className = 'tw-slot' + (who ? ' taken' : '') + (who?.vip ? ' vip' : '');
      const av = document.createElement('span');
      av.className = 'tw-slot-av';
      if (who) updateAvatar(av, who.avatar || '', who.name);
      else av.textContent = '?';
      const nm = document.createElement('b');
      nm.textContent = who ? `${who.vip ? '👑 ' : ''}${who.name}` : 'còn trống';
      cell.append(av, nm);
      return cell;
    }));
    const left = Math.max(0, (d.slots || 0) - claims.length);
    ui.stake.textContent = left ? `Còn ${left} suất · ai gõ trước được trước!` : 'Đủ suất rồi, chốt đơn!';
    return;
  }
  if (d.kind === 'roach') ui.tally.textContent = `💘 ${fmt(d.yes || 0)} người nói yêu · 🏃 ${fmt(d.no || 0)} người bỏ chạy`;
  const ratio = d.target > 0 ? Math.min(1, d.progress / d.target) : 0;
  ui.fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  ui.num.textContent = d.kind === 'blackout' ? `⚡ ${Math.round(ratio * 100)}%` : `${fmt(d.progress)} / ${fmt(d.target)} ${TWIST_UI[d.kind].unit}`;
  // Cúp điện: thanh càng đầy rạp càng sáng dần
  if (d.kind === 'blackout') ui.dark.style.setProperty('--tw-dark', (twistDarkMax() - ratio * 0.45).toFixed(2));
  if (d.kind === 'dowry' && ui.actor.classList.contains('fallback')) ui.badge.textContent = ratio >= 0.75 ? '🙂' : ratio >= 0.4 ? '🤨' : '😠';
}
// Mỗi lượt góp sức: một thẻ nhỏ "+12 ❤ Tên" bay lên phía dưới bảng thử thách.
// Món quà thì thẻ to, màu vàng, ghi rõ người tặng thành ai trong màn này, và có hiệu ứng riêng của màn đó.
let twistPopAt = 0;
function twistPop(last, kind) {
  const now = performance.now();
  const isGift = last.kind === 'coin' || last.kind === 'vip';
  const big = isGift || last.kind === 'proof' || last.kind === 'refuse';
  if (!big && now - twistPopAt < 110) return; // tim đổ dồn dập: không vẽ quá dày
  twistPopAt = now;
  const ui = twistEls();
  const k = TWIST_UI[kind] || {};
  const el = document.createElement('div');
  el.className = 'tw-pop' + (big ? ' gift' : '');
  const icon = { like: '❤', chat: '💬', share: '📤' }[last.kind] || '✨';
  el.textContent = last.kind === 'claim' ? `💍 ${last.name} cưới ké!`
    : last.kind === 'vip' ? `👑 ${last.name}: suất hạng nhất!`
    : last.kind === 'proof' ? `💋 ${last.name} nói yêu rồi!`
    : last.kind === 'refuse' ? `💔 ${last.name} nói KHÔNG YÊU!`
    : last.kind === 'no' ? `🏃 ${last.name}: không yêu!`
    : last.love ? `💘 ${last.name}: yêu!`
    : isGift ? `${k.heroIcon || '🎁'} ${last.name} ${k.gift || 'tặng quà'}!`
    : `+${fmt(last.pts)} ${icon} ${last.name}`;
  // Bay lên ở hai bên phía dưới bảng thử thách, chừa khoảng giữa cho cặp đôi
  el.style.left = `${Math.random() < 0.5 ? 150 + Math.random() * 230 : 690 + Math.random() * 230}px`;
  if (big) {
    el.style.left = '300px';
    ui.reply.classList.remove('on'); // thẻ quà hiện đúng chỗ bong bóng của chú rể
  }
  ui.pops.append(el);
  while (ui.pops.childElementCount > 10) ui.pops.firstElementChild.remove();
  setTimeout(() => el.remove(), big ? 2300 : 1250);
  // Con gián: ai chọn "không yêu" thì bị gián rượt cho vui (kết cục không đổi vì lựa chọn này)
  if (last.kind === 'no') {
    const p = last.id ? seatPoint(last.id) : null;
    if (last.id) {
      showChatBubble(last.id, 'Á! Gián rượt! 🏃', { hold: false });
      guestReact(guestNodes.get(last.id), 'hop');
    }
    if (p) spawnHearts(5, { x: p.x, y: p.y, spread: 70, emojis: ['🪳', '💨'] });
    twistReply(`Nhớ mặt ${last.name} nha! 😤`, 2000);
    return sfx(ctx => tone(ctx, { freq: 300, to: 160, type: 'sawtooth', dur: 0.18, gain: 0.05 }));
  }
  if (last.kind === 'refuse') return playSadTrombone();
  if (!isGift) return sfx(ctx => tone(ctx, { freq: 880 + Math.random() * 520, type: 'triangle', dur: 0.07, gain: 0.05 }));
  // Hiệu ứng riêng khi có quà: vệ sĩ dựng khiên, bố vợ phản ứng theo cỡ quà, nến sáng lên, tim hôn bay
  playCoins();
  if (kind === 'ex') heartRing(['🛡️', '💖', '🛡️'], 12);
  else if (kind === 'dowry') {
    const r = k.react;
    twistShout(last.coins >= 99 ? r.big : last.coins >= 10 ? r.mid : r.small, 2400);
    spawnHearts(8, { x: 540, y: 900, spread: 300, emojis: last.coins >= 99 ? ['📕', '🥇', '💰'] : last.coins >= 10 ? ['🥇', '🧧'] : ['🧧'] });
  } else if (kind === 'blackout') {
    spawnHearts(8, { x: 540, y: 900, spread: 420, emojis: ['🕯️', '✨'] });
  } else if (kind === 'roach') {
    spawnHearts(10, { x: 520, y: 820, spread: 240, emojis: ['💋', '💘', '❤'] });
  } else if (k.rain) {
    if (k.react) twistShout(k.react, 2400);
    spawnHearts(8, { x: 540, y: 900, spread: 300, emojis: k.rain });
  }
}

// Cúp điện: đèn chập chờn rồi tắt, trong bóng tối chỉ còn những đôi mắt
function twistEyes() {
  const ui = twistEls();
  ui.eyes.replaceChildren();
  for (const w of Array.from(wanderers.values()).sort(() => Math.random() - 0.5).slice(0, 16)) {
    const p = wanderPos(w);
    const e = document.createElement('i');
    e.textContent = '👀';
    e.style.left = `${p.x}px`;
    e.style.top = `${p.y - w.box.h * depthScale(p.y) * 0.84}px`;
    e.style.animationDelay = `${-(Math.random() * 3).toFixed(2)}s`;
    ui.eyes.append(e);
  }
}
function twistDarkOn(intro) {
  const ui = twistEls();
  const frame = $('#frame');
  const dark = theme.data.events?.dark;
  if (dark) ui.darkBg.src = themeAsset(dark);
  const go = () => {
    frame.classList.remove('tw-flicker');
    frame.classList.add('tw-dark-on');
    ui.darkBg.classList.toggle('on', Boolean(dark));
    ui.dark.style.setProperty('--tw-dark', String(twistDarkMax()));
    twistEyes();
  };
  if (!intro) return go();
  frame.classList.add('tw-flicker');
  tw.later(950, go);
}
function twistDarkOff() {
  const ui = twistEls();
  $('#frame').classList.remove('tw-dark-on', 'tw-flicker');
  ui.darkBg.classList.remove('on');
  ui.eyes.replaceChildren();
}
// Điện về: đèn rọi thẳng vào vị khách bị bắt quả tang
function twistSpot(c) {
  const ui = twistEls();
  const w = wanderers.get(c.id);
  if (!w) return;
  wanderHold(c.id, 5200);
  const p = wanderPos(w);
  Object.assign(ui.spot.style, { left: `${p.x}px`, top: `${p.y - w.box.h * depthScale(p.y) * 0.55}px` });
  ui.spot.classList.add('on');
  showChatBubble(c.id, '😳 Ơ kìa...');
  guestReact(guestNodes.get(c.id), 'hop');
  setTimeout(() => ui.spot.classList.remove('on'), 4600);
}
// Các cặp cưới ké đứng thành thẻ bên phải sân khấu tới hết lượt cưới này
function twistPairs(pairs) {
  const ui = twistEls();
  ui.pairs.replaceChildren(...pairs.map(p => {
    const chip = document.createElement('div');
    chip.className = 'tw-pair';
    const tag = document.createElement('small');
    tag.textContent = '💍 CƯỚI KÉ';
    const row = document.createElement('div');
    for (const [i, u] of [p.a, p.b].entries()) {
      if (i) { const h = document.createElement('i'); h.textContent = '♥'; row.append(h); }
      const av = document.createElement('span');
      av.className = 'tw-pair-av';
      updateAvatar(av, u.avatar || '', u.name);
      const nm = document.createElement('b');
      nm.textContent = u.name;
      row.append(av, nm);
    }
    chip.append(tag, row);
    return chip;
  }));
}

function twistOpen(d) {
  const id = d.id;
  tw = { id, kind: d.kind, d: { ...d }, deadline: performance.now() + (Number(d.remainingMs) || 0), lastN: d.last?.n || 0, lastSec: 0, timers: [], ended: false };
  tw.later = (ms, fn) => tw && tw.timers.push(setTimeout(() => { if (tw && tw.id === id) fn(); }, ms));
  $('#frame').classList.add('tw-on', `tw-${d.kind}`);
}
function twistStart(d, intro = true) {
  twistCleanup();
  const ui = twistEls();
  const old = $('#ceremony-alert-banner');
  if (old) old.hidden = true; // bảng tin đang hiện (vd vừa ghép đôi) nhường chỗ cho biến cố
  twistOpen(d);
  const later = tw.later;
  ui.panel.classList.remove('on', 'won', 'lost', 'urgent');
  ui.slots.dataset.key = '';
  twistRender(d);
  if (d.kind === 'blackout') twistDarkOn(intro);
  const hasActor = d.kind === 'ex' || d.kind === 'dowry' || Boolean(TWIST_UI[d.kind].actor);
  if (!intro) {
    // Màn hình mở giữa lúc đang có biến cố: vào thẳng bảng thử thách
    if (hasActor) twistActorShow(d);
    if (d.kind === 'roach') twistRoachOn();
    ui.panel.classList.add('on');
    return;
  }
  // 1. Mở màn: khựng lại, chữ đập vào màn hình, cả rạp ngó lên
  const k = TWIST_UI[d.kind];
  ui.slamMain.textContent = k.slam;
  ui.slamSub.textContent = d.kind === 'ex' && d.cast?.queued ? k.queueSub : k.slamSub;
  ui.slam.dataset.kind = d.kind;
  ui.slam.classList.remove('on');
  void ui.slam.offsetWidth;
  ui.slam.classList.add('on');
  const frame = $('#frame');
  frame.classList.add('tw-shake');
  later(700, () => frame.classList.remove('tw-shake'));
  if (d.kind === 'blackout') {
    playPowerDown();
    later(260, playThunder);
    twistFx('lightning');
  } else if (d.kind === 'mass') {
    playFanfare();
    playWeddingBell();
    emojiRain(['💒', '💍', '💖', '🎊'], 40, 3600);
  } else {
    playSting();
    screenFlash(d.kind === 'ex' ? '#ff2d55' : d.kind === 'roach' ? '#c8ff7a' : '#ffd24a');
    if (d.kind === 'ex') twistFx('shatter');
  }
  // Con gián: cô dâu "úm ba la" hóa gián ngay giữa sân khấu; các màn khác thì cặp đôi hết hồn
  if (d.kind === 'roach') later(1250, twistRoachOn);
  else coupleDo(['shock'], 2800);
  guestsReact(24, ['look', 'hop', 'look']);
  [350, 950, 1600, 2300, 3200].forEach(ms => later(ms, () => {
    const ids = Array.from(guestNodes.keys());
    if (ids.length) showChatBubble(pick(ids), pick(TWIST_GASPS[d.kind]));
  }));
  if (d.line) later(650, () => speak(d.line, { priority: true }));
  // 2. Nhân vật của biến cố bước ra. Bố vợ hỏi dồn, chú rể né: "Dạ... gỗ xà cừ ạ!"
  if (hasActor) later(1250, () => twistActorShow(d));
  if (k.reply) later(hasActor ? 3400 : 1500, () => twistReply(k.reply)); // chú rể đáp lại ("dạ gỗ xà cừ", "ủa nhẫn đâu"...)
  // 3. Chữ mở màn thu lại, bảng thử thách bật lên
  later(2500, () => {
    ui.slam.classList.remove('on');
    ui.panel.classList.add('on');
    playPop();
  });
}

// Tiến độ đi kèm mỗi lần server gửi state
function twistSync(t) {
  if (!t) {
    // Server hết biến cố mà màn hình lỡ mất sự kiện kết thúc (rớt mạng): tự dọn
    if (tw && !tw.ended && performance.now() > tw.deadline + 4000) twistCleanup();
    return;
  }
  if (tw && tw.id === t.id) {
    if (tw.ended) return;
    tw.d = { ...tw.d, ...t };
    tw.deadline = performance.now() + (Number(t.remainingMs) || 0);
    twistProgress(tw.d);
    if (t.last && t.last.n !== tw.lastN) {
      tw.lastN = t.last.n;
      twistPop(t.last, tw.kind);
    }
    return;
  }
  if (!tw || tw.ended) twistStart(t, false);
}
// Đồng hồ thử thách; 5 giây cuối hiện số thật to kèm nhịp tim
setInterval(() => {
  if (!tw || tw.ended) return;
  const ui = twistEls();
  const sec = Math.ceil(Math.max(0, tw.deadline - performance.now()) / 1000);
  ui.timer.textContent = mmss(sec);
  const urgent = sec <= 5 && ui.panel.classList.contains('on');
  ui.panel.classList.toggle('urgent', urgent);
  if (urgent && sec >= 1 && sec !== tw.lastSec) {
    tw.lastSec = sec;
    ui.count.textContent = String(sec);
    ui.count.classList.remove('on');
    void ui.count.offsetWidth;
    ui.count.classList.add('on');
    playTick(sec);
    if (tw.kind !== 'mass') playHeartbeat();
  }
}, 200);

function twistEnd(d) {
  const ui = twistEls();
  if (!tw || tw.id !== d.id) {
    if (d.aborted || d.cut || d.bought) return;
    twistCleanup();
    twistOpen(d); // màn hình không thấy lúc bắt đầu: vẫn diễn kết cục
  }
  tw.ended = true;
  ui.count.classList.remove('on');
  if (d.aborted) return twistCleanup();
  const later = tw.later;
  const cast = d.cast || tw.d.cast || {};
  const k = TWIST_UI[d.kind];
  const up = s => String(s || '').toUpperCase();
  ui.panel.classList.remove('urgent');
  ui.reply.classList.remove('on');
  // Có người lên thay vai giữa chừng: đóng dấu rồi nhường sân khấu cho cảnh thay vai (do món quà đó tự diễn)
  if (d.cut || d.bought) {
    ui.stamp.textContent = d.bought ? '💥 CƯỚP THÀNH CÔNG!' : '⚡ CÓ NGƯỜI CHEN NGANG!';
    ui.panel.classList.add('lost');
    later(1300, () => ui.panel.classList.remove('on'));
    twistRoachOff(false);
    if (d.kind === 'blackout') later(300, () => { playPowerUp(); twistDarkOff(); });
    later(d.bought ? 600 : 1500, () => twistActorOut(d.bought ? 'jump' : 'walk'));
    later(2600, twistCleanup);
    return;
  }
  // Con dấu kết quả đóng lên bảng thử thách, rồi bảng thu lại nhường chỗ cho bảng tin lớn
  ui.stamp.textContent = d.kind === 'mass' ? '💍 CHỐT ĐƠN!' : d.win ? '✔ THÀNH CÔNG!' : '✘ KHÔNG KỊP!';
  ui.panel.classList.add(d.win ? 'won' : 'lost');
  later(850, () => ui.panel.classList.remove('on'));
  if (d.line) later(500, () => speak(d.line, { priority: true }));
  const banner = (...a) => later(900, () => showCeremonyBanner(...a));
  // Vinh danh: người tặng quà được gọi đúng vai người hùng của màn; không ai tặng thì người góp tim, bình luận nhiều nhất
  const hero = !d.hero?.name ? '' : d.hero.byGift ? ` · ${k.heroIcon} ${k.heroRole}: ${d.hero.name}` : ` · 🔥 ${d.hero.name} góp nhiều nhất`;

  if (d.kind === 'ex') {
    if (d.win) {
      if (cast.queued) banner('LỐP TRƯỞNG VỀ LẠI HÀNG CHỜ!', `${cast.name} chờ thêm một lượt nữa nha${hero}`, 'gold', 5000, '🛡️ CHE CHẮN THÀNH CÔNG');
      else banner('CHE CHẮN THÀNH CÔNG!', `${cast.name} ôm hận ra về${hero}`, 'gold', 5000, '🛡️ ĐÁM CƯỚI AN TOÀN');
      later(900, () => {
        playFanfare();
        twistFx('shield');
        heartRing(['🛡️', '💖', '💗'], 16);
        emojiRain(['🛡️', '💖', '✨', '🎉'], 36, 3600);
        guestsReact(24, ['clap', 'hop', 'clap']);
        coupleDo(['heart', 'wave'], 4200);
      });
      later(1300, () => { playBonk(); twistActorOut('fling'); });
      later(1500, () => playFlingWhistle(0.9));
    } else if (d.steal) {
      // Người cũ văng khỏi sân khấu ngay, lốp trưởng nhảy lên thế chỗ
      ousted[d.role] = { name: d.previous, avatar: d.previousAvatar || '' };
      stealFling({ role: d.role, previous: d.previous });
      later(1200, () => twistActorOut('jump'));
      guestsReact(24, ['look', 'hop', 'look']);
      if (cast.queued) banner(up(cast.name), `hết phải chờ, lên làm ${d.role === 'groom' ? 'chú rể' : 'cô dâu'} luôn · ${d.previous} văng khỏi sân khấu!`, 'cancel', 5400, '💥 LỐP TRƯỞNG LÊN LỐP CHÍNH!');
      else banner(up(cast.name), `cướp ${d.role === 'groom' ? 'cô dâu' : 'chú rể'} ngay giữa lễ đường, ${d.previous} văng khỏi sân khấu!`, 'cancel', 5400, d.role === 'groom' ? '💥 CƯỚP DÂU THÀNH CÔNG!' : '💥 CƯỚP RỂ THÀNH CÔNG!');
    } else {
      if (cast.queued) banner(`${up(cast.name)} VẪN LÀ LỐP TRƯỞNG!`, 'Đôi trẻ vẫn cưới · lượt sau tới lốp trưởng', 'auction', 5000, '🥲 CHE CHẮN KHÔNG KỊP');
      else banner(`${up(cast.name)} NGỒI LÌ DỰ CƯỚI!`, 'Đôi trẻ vẫn cưới · người yêu cũ ngồi mâm trên cho cay', 'auction', 5000, '🥲 CHE CHẮN KHÔNG KỊP');
      later(900, () => { playSadTrombone(); guestsReact(16, ['look', 'look', 'hop']); });
      later(3800, () => twistActorOut('walk'));
    }
  } else if (d.kind === 'dowry') {
    if (d.win) {
      twistActorMood('happy');
      banner('BỐ VỢ GẬT ĐẦU!', `Cho cưới, tặng luôn sổ đỏ làm của hồi môn${hero}`, 'gold', 5000, '🧧 XIN CƯỚI THÀNH CÔNG');
      later(900, () => {
        playFanfare();
        playCoins();
        twistFx('goldrain');
        emojiRain(['🪙', '🧧', '📕', '💰', '🥇'], 48, 3800);
        guestsReact(24, ['clap', 'hop']);
        coupleDo(['bow', 'thanks'], 4200);
      });
      // Bố vợ gửi thiệp hoa hồng lấp lánh đúng kiểu "thực dân Zalo"
      later(1700, () => twistZalo(cast.name));
      later(4300, () => twistActorOut('walk'));
    } else if (d.kick) {
      twistActorMood('angry');
      twistKickFx(d);
      banner(`${up(d.previous)} BỊ ĐUỔI!`, 'Sính lễ chưa tới · cô dâu ở lại chờ rể mới', 'cancel', 5400, '🧹 BỐ VỢ LẮC ĐẦU!');
      later(3600, () => twistActorOut('walk'));
    } else {
      twistActorMood('angry');
      banner('BỐ VỢ CHƯA ƯNG!', `Phạt chú rể ${roleName('groom')} ở rể 3 năm rửa chén`, 'auction', 5000, '🏠 CƯỚI ĐƯỢC NHƯNG PHẢI Ở RỂ');
      later(900, () => { playSadTrombone(); guestsReact(16, ['look', 'hop']); });
      later(3800, () => twistActorOut('walk'));
    }
  } else if (d.kind === 'blackout') {
    if (d.win) {
      const c = d.caught;
      later(250, () => { playPowerUp(); screenFlash('#ffffff'); twistDarkOff(); });
      banner(c ? `BẮT QUẢ TANG ${up(c.name)}!` : 'CẢ RẠP QUAY MÁY PHÁT QUÁ ĐỈNH!', c ? `đang ${d.gag} lúc cúp điện${hero}` : hero.replace(' · ', ''), 'gold', 5200, '💡 ĐIỆN VỀ RỒI!');
      later(900, () => {
        playFanfare();
        emojiRain(['💡', '⚡', '✨', '🎉'], 36, 3600);
        guestsReact(24, ['hop', 'clap', 'look']);
        if (c) twistSpot(c);
      });
    } else {
      later(300, () => { twistDarkOff(); $('#frame').classList.add('tw-candle'); playChime(); });
      banner('ĐÁM CƯỚI ÁNH NẾN', 'Máy phát không nổ · cưới trong ánh nến cho lãng mạn', 'bride', 5000, '🕯️ HẾT GIỜ RỒI');
      later(900, () => { emojiRain(['🕯️', '✨', '💛'], 26, 3800); coupleDo(['heart'], 4000); });
    }
  } else if (d.kind === 'roach') {
    const groom = roleName('groom');
    if (d.win) {
      // Tình yêu thắng: gián biến lại thành cô dâu
      later(700, () => { twistRoachOff(true); playChime(); });
      if (d.proved) banner(`${up(groom)} HÔN LUÔN CON GIÁN!`, 'Chồng quốc dân là đây · cô dâu xinh trở lại rồi', 'gold', 5000, '💋 QUA BÀI THỬ LÒNG');
      else banner('TÌNH YÊU THẮNG!', `Gián cũng yêu · cô dâu xinh trở lại rồi${hero}${d.no ? ` · 🏃 ${fmt(d.no)} người bị gián rượt` : ''}`, 'gold', 5000, '💘 CẢ RẠP LÀM CHỨNG');
      later(900, () => {
        playFanfare();
        emojiRain(['💘', '💋', '✨', '🪳'], 40, 3600);
        guestsReact(24, ['clap', 'hop', 'clap']);
      });
      later(1300, () => coupleDo(['kiss', 'heart'], 4000));
    } else if (d.kick) {
      later(500, () => twistRoachOff(false));
      later(650, () => twistKickFx(d));
      if (d.refused) banner(`${up(d.previous)} NÓI KHÔNG YÊU!`, 'Phũ thật sự · cô dâu chờ rể mới', 'cancel', 5400, '💔 CHÊ GIÁN RA MẶT');
      else banner(`${up(d.previous)} BỎ CHẠY MẤT DÉP!`, 'Không yêu đương gì tầm này · cô dâu chờ rể mới', 'cancel', 5400, '🏃 THẤY GIÁN LÀ CHUỒN');
    } else {
      later(1800, () => twistRoachOff(true));
      banner(d.refused ? 'CHÚ RỂ CHÊ GIÁN!' : 'CHÚ RỂ ĐỨNG HÌNH!', `Cưới thì vẫn cưới · phạt ${groom} ngủ sô pha một tháng`, 'auction', 5000, d.refused ? '💔 DÁM NÓI KHÔNG YÊU' : '🛋️ CHƯA NÓI ĐƯỢC LỜI YÊU');
      later(900, () => { playSadTrombone(); guestsReact(16, ['look', 'hop']); });
    }
  } else if (k.end) {
    // Sự cố: thắng thì bảng tin vinh danh hiện nhanh rồi nhường chỗ cho chính bước vừa được gỡ (server diễn ngay sau đó);
    // thua thì diễn bản chữa cháy
    const e = k.end;
    const g = d.couple?.groom || roleName('groom');
    const b = d.couple?.bride || roleName('bride');
    if (d.win) {
      if (d.kind === 'kiss') twistActorMood('happy');
      banner(e.winTitle, `${e.winSub}${hero}`, 'gold', d.kind === 'ring' ? 4600 : 2700, e.winTag);
      later(900, () => {
        playFanfare();
        emojiRain(e.winRain, 30, 3000);
        guestsReact(22, ['clap', 'hop', 'clap']);
      });
      later(2300, () => twistActorOut('walk'));
    } else {
      banner(e.loseTitle, e.loseSub(g, b), 'auction', 4400, e.loseTag);
      later(900, () => {
        playSadTrombone();
        emojiRain(e.loseRain, 18, 3000);
        guestsReact(16, ['look', 'hop']);
        if (d.kind === 'kiss') spawnHearts(8, { x: 540, y: 820, spread: 200, emojis: ['😘', '💨'] });
      });
      later(3800, () => twistActorOut('walk'));
    }
  } else {
    const pairs = d.pairs || [];
    if (pairs.length) {
      banner('CƯỚI TẬP THỂ!', `${pairs.map(p => `${p.a.name} ♥ ${p.b.name}`).join(' · ')} cưới ké cùng đôi chính`, 'marry', 5400, `💒 THÊM ${pairs.length} CẶP CƯỚI KÉ`);
      later(900, () => {
        playFanfare();
        playWeddingBell();
        emojiRain(['💍', '💒', '💖', '🎊'], 44, 3800);
        guestsReact(26, ['hop', 'clap', 'wave']);
        twistPairs(pairs);
      });
    } else {
      banner('KHÔNG AI CƯỚI KÉ!', 'Đôi chính cưới một mình vậy', 'auction', 4200, '💒 CƯỚI TẬP THỂ');
    }
  }
  later(6200, twistCleanup);
}
// Chú rể rời sân khấu (bị bố vợ đuổi, thấy gián bỏ chạy): bộ hình có ảnh đứng riêng thì bay hẳn ra ngoài
function twistKickFx(d) {
  if (hasSolo() && $('#couple-wrapper')) {
    ousted.groom = { name: d.previous, avatar: d.previousAvatar || '' };
    stealFling({ role: 'groom', previous: d.previous, drop: false });
  } else playSadTrombone();
  guestsReact(20, ['look', 'hop']);
}
// Thiệp mừng của bố vợ: chữ vàng viền hồng, hoa hồng lấp lánh, bật lên giữa lối đi rồi tự thu lại
function twistZalo(name) {
  const ui = twistEls();
  ui.zaloFrom.textContent = `${name ? `Bố vợ ${name}` : 'Bố vợ'} gửi · đúng chất thực dân Zalo`;
  ui.zalo.classList.remove('on');
  void ui.zalo.offsetWidth;
  ui.zalo.classList.add('on');
  playPop();
}

function twistCleanup() {
  if (!tw) return;
  tw.timers.forEach(clearTimeout);
  tw = null;
  const ui = twistEls();
  $('#frame').classList.remove('tw-on', 'tw-shake', 'tw-flicker', 'tw-dark-on', ...Object.keys(TWIST_UI).map(k => `tw-${k}`));
  for (const el of [ui.panel, ui.slam, ui.count, ui.actor, ui.spot, ui.darkBg, ui.fx, ui.reply, ui.zalo]) el.classList.remove('on', 'out', 'fling', 'jump', 'won', 'lost', 'urgent');
  twistRoachOff(false);
  ui.eyes.replaceChildren();
  ui.pops.replaceChildren();
}
// Lượt cưới này khép lại (sân khấu trống): bỏ ánh nến và các cặp cưới ké của lượt đó
function twistTurnOver() {
  $('#frame').classList.remove('tw-candle');
  if (twistUi) twistUi.pairs.replaceChildren();
}

// ----- VAI PHỤ: phù dâu, phù rể — một dòng ngay dưới khung tên cặp đôi -----
let attendKey = '';
function renderAttendants(s) {
  const scene = $('#scene');
  if (!s || !scene) return;
  let line = $('#attend-line');
  if (!line) {
    line = document.createElement('div');
    line.id = 'attend-line';
    scene.append(line);
  }
  const c = s.config || {};
  const a = s.attendants || {};
  const roles = s.rawRoles || s.roles || {};
  const on = c.attendants !== false && c.enableMarryAuction !== false && Boolean(roles.groom || roles.bride) && !dpActive;
  const canClaim = ['idle', 'countdown'].includes(s.ceremony?.phase || 'idle');
  const slots = [['maid', '💐', 'Phù dâu', 'phù dâu'], ['bestman', '🎩', 'Phù rể', 'phù rể']];
  const taken = on ? slots.filter(([slot]) => a[slot]) : [];
  const empty = on && canClaim ? slots.filter(([slot]) => !a[slot]) : [];
  // Người hùng của biến cố lượt này (người tặng quà cứu đám cưới): được ghi công cạnh đôi trẻ tới hết lượt cưới
  const hero = s.patron && TWIST_UI[s.patron.kind] && Boolean(roles.groom || roles.bride) && !dpActive ? s.patron : null;
  line.classList.toggle('on', taken.length + empty.length > 0 || Boolean(hero));
  const lab = $('#couple-label');
  if (lab && line.classList.contains('on')) {
    const r = frameRect(lab);
    if (r.h > 4) line.style.top = `${Math.round(r.y + r.h + 8)}px`;
  }
  const key = JSON.stringify([taken.map(([slot]) => [slot, a[slot].name, a[slot].avatar]), empty.map(([slot]) => slot), hero && [hero.kind, hero.name, hero.avatar]]);
  if (key === attendKey) return;
  attendKey = key;
  const chips = [];
  if (hero) {
    const k = TWIST_UI[hero.kind];
    const chip = document.createElement('span');
    chip.className = 'attend-chip taken hero';
    const av = document.createElement('i');
    av.className = 'attend-av';
    updateAvatar(av, hero.avatar || '', hero.name);
    const text = document.createElement('b');
    text.textContent = `${k.heroIcon} ${k.heroChip || k.heroRole}: ${hero.name}`; // thẻ hẹp: dùng tên vai ngắn nếu có
    chip.append(av, text);
    chips.push(chip);
  }
  chips.push(...taken.map(([slot, icon, label]) => {
    const chip = document.createElement('span');
    chip.className = 'attend-chip taken';
    const av = document.createElement('i');
    av.className = 'attend-av';
    updateAvatar(av, a[slot].avatar || '', a[slot].name);
    const text = document.createElement('b');
    text.textContent = `${icon} ${label}: ${a[slot].name}`;
    chip.append(av, text);
    return chip;
  }));
  if (empty.length) {
    const hint = document.createElement('span');
    hint.className = 'attend-chip hint';
    hint.textContent = `💬 Gõ ${empty.map(([, , , word]) => `"${word}"`).join(' / ')} để lên sân khấu`;
    chips.push(hint);
  }
  line.replaceChildren(...chips);
}
function triggerAttendant(d) {
  const list = Array.isArray(d.list) ? d.list : [];
  if (!list.length) return;
  const label = slot => (slot === 'maid' ? 'phù dâu' : 'phù rể');
  const one = list[0];
  showToast(`${one.slot === 'maid' ? '💐' : '🎩'} ${list.map(x => `${x.name} làm ${label(x.slot)}`).join(', ')} · lượt sau được ưu tiên lên xe hoa!`, one.avatar, one.name);
  playChime();
  const line = $('#attend-line');
  if (line) {
    line.classList.remove('flash');
    void line.offsetWidth;
    line.classList.add('flash');
  }
}

// ========================================================
// SỰ KIỆN TỪ SERVER
// ========================================================
const realtime = new WeddingRealtime();

realtime.addEventListener('state', e => {
  try { renderState(JSON.parse(e.data)); } catch (err) { console.warn('render error', err); }
});

realtime.addEventListener('bgm', e => {
  try {
    if (currentState) currentState.config.bgm = JSON.parse(e.data);
    applyBgm();
  } catch (err) {}
});

realtime.addEventListener('activity', e => {
  try {
    const d = JSON.parse(e.data);
    if (d.type === 'chat') {
      showComment(d.id, d.comment);
      guestReact(guestNodes.get(d.id), 'hop');
    } else if (d.type === 'join') {
      // Khách mới đang đi bộ từ cửa vào: vừa đi vừa chào (chờ một nhịp cho hình khách hiện lên)
      setTimeout(() => showChatBubble(d.id, '👋 Tới rồi nè!', { hold: false }), 1300);
      setTimeout(() => guestReact(guestNodes.get(d.id), 'wave'), 4200);
    }
    else if (d.type === 'share') {
      showToast(`⭐ ${d.name} đã chia sẻ rạp cưới · cảm ơn nha!`, d.avatar, d.name);
      showChatBubble(d.id, '📤 Đã chia sẻ!');
    } else if (d.type === 'follow') {
      showToast(`➕ ${d.name} đã theo dõi kênh · cảm ơn nha!`, d.avatar, d.name);
      showChatBubble(d.id, '➕ Đã theo dõi!');
    } else if (d.type === 'title') {
      showToast(`🎉 ${d.name} lên ${d.title}!`);
      showChatBubble(d.id, `${d.title}!`);
    }
  } catch (err) {}
});

realtime.addEventListener('action', e => {
  try {
    const d = JSON.parse(e.data);
    if (ceremonyRunning) {
      // Không chen ngang lễ cưới; người giành vai lượt mới được chúc mừng sau khi lễ xong
      if (d.action === 'role_change') setTimeout(() => { triggerRoleChange({ role: d.role, name: d.name, avatar: d.avatar, bid: d.bid, fromQueue: d.fromQueue }); if (d.line) speak(d.line); }, 7000);
      if (!['ceremony', 'roles_open'].includes(d.action)) return;
    }
    switch (d.action) {
      case 'kiss': triggerKiss(); break;
      case 'cheers': triggerCheers(d.initiator); break;
      case 'dance': triggerDance(d.initiator, { big: Boolean(d.big), goal: d.likeGoal, couples: d.partyCouples }); break;
      case 'cancel': triggerCancel(d.name, d.couple); break;
      case 'bouquet': triggerBouquet(d.catcher); break;
      case 'fireworks': triggerFireworks(d.name); break;
      case 'music': triggerMusic(d.name, d.track); break;
      case 'mc': triggerMarryMC(d.name); break;
      case 'cake': triggerCake(); break;
      case 'champagne': triggerChampagne(); break;
      case 'petal': triggerPetal(Boolean(d.goal)); break;
      case 'ring': triggerRing(d); break;
      case 'dongphong': runDongPhong({ groom: d.groom, bride: d.bride, intro: true, lines: d.lines || {} }); break;
      case 'ceremony': runCeremony(d); break;
      case 'reception_end': triggerFarewell(d); break;
      case 'gossip': triggerGossip(d); break;
      case 'role_kick': triggerRoleKick(d); break;
      case 'role_change': triggerRoleChange({ role: d.role, name: d.name, avatar: d.avatar, bid: d.bid, fromQueue: d.fromQueue }); break;
      case 'random_pair': triggerRandomPair(d); break;
      case 'attendant': triggerAttendant(d); break;
      case 'marry': triggerRoleChange({ role: 'groom', name: d.initiator || d.newGroom || '', bid: d.bid || 0 }); break;
      case 'roles_open':
        // Lượt của đôi vừa cưới bị cắt ngang (có người tặng quà giành vai giữa tiệc mừng): về cảnh chờ luôn
        if (d.silent) turnEndedAt = Math.max(turnEndedAt, Date.now());
        if (d.silent || ceremonyRunning || Date.now() - ceremonyEndedAt < 4000 || Date.now() - turnEndedAt < 4000) break;
        showCeremonyBanner('🔔 VAI CÔ DÂU – CHÚ RỂ ĐÃ MỞ!', 'Tặng quà để giành vai ngay!', 'gold', 4500);
        if (d.line) speak(d.line);
        break;
    }
    // MC đãi khi rạp vắng: ghi rõ là MC đãi (không phải khách tặng), nhắc quà để xem lại
    if (d.treat) {
      setTimeout(() => {
        showCeremonyBanner(`🎁 MC ĐÃI ${d.treat.label}!`, `Muốn xem nữa thì tặng ${d.treat.gift} nha!`, 'gold', 5000);
        showToast(`🎁 MC đãi ${d.treat.label.toLowerCase()} miễn phí · tặng ${d.treat.gift} để xem lại`);
      }, 80);
    }
    // Lời MC đi kèm nút bấm / mục tiêu / người nhận vai lượt mới (ghép đôi ngẫu nhiên: đọc sau khi quay xong)
    if (d.line && !['roles_open', 'random_pair'].includes(d.action)) speak(d.line);
  } catch (err) { console.warn('action error', err); }
});

// ========================================================
// TUẦN TRĂNG MẬT: cảnh tràn màn hình ở cuối tiệc mừng. Bày ra danh sách điểm đến, mỗi nơi một ô có ảnh nền làm mờ và mức xu;
// cả rạp tặng quà để chọn (tổng xu tới mức nào thì đi nơi đó, đủ tim thì được nơi rẻ nhất). Hết giờ: hiện tấm ảnh check-in
// có đôi trẻ ở nơi được chọn. Ảnh lấy từ bộ hình: events.moon.<mã> (cảnh không người, dùng cho ô chọn và nền mờ),
// events.checkin.<mã> (đôi trẻ đã nằm trong cảnh, dùng lúc khoe). Chưa có ảnh thì vẽ tạm bằng màu nền và biểu tượng.
// ========================================================
const MOON_UI = {
  stamps: ['TRĂNG MẬT TẠI GIA', 'CHECK-IN SANG CHẢNH', 'CHECK-IN HẠNG THƯƠNG GIA'],
  places: {
    trada: { emoji: '🍵', bg: 'linear-gradient(180deg, #6b7f55, #3a4630 55%, #2a2118)', cap: 'Hai ly trà đá, một gói hướng dương' },
    santhuong: { emoji: '🏠', bg: 'linear-gradient(180deg, #7fb0d8, #c9d6dd 50%, #8a8f95)', cap: 'View triệu đô: dây phơi đồ và bồn nước inox' },
    hocau: { emoji: '🎣', bg: 'linear-gradient(180deg, #86b8a0, #3f7f6b 55%, #24443c)', cap: 'Lãng mạn bên hồ, muỗi đốt là chính' },
    dalat: { emoji: '🌲', bg: 'linear-gradient(180deg, #ffd9b8, #9fc2a8 48%, #2f5a45)', cap: 'Săn mây đồi thông, sáng lạnh ôm nhau' },
    phuquoc: { emoji: '🏝️', bg: 'linear-gradient(180deg, #ff9a5c, #ffcf8a 38%, #2aa7c4 62%, #f2dfb8)', cap: 'Hoàng hôn trên biển, nước trong thấy đáy' },
    halong: { emoji: '⛵', bg: 'linear-gradient(180deg, #9fd4e8, #5fa7b8 50%, #1f5f72)', cap: 'Du thuyền ngủ đêm giữa vịnh' },
    maldives: { emoji: '🌊', bg: 'linear-gradient(180deg, #5fd0ff, #b8f0ff 40%, #19c4c9 62%, #f7efd8)', cap: 'Biệt thự trên mặt nước, bước ra là biển' },
    paris: { emoji: '🗼', bg: 'linear-gradient(180deg, #2a2f5a, #b86a8f 50%, #ffc98a)', cap: 'Cà phê dưới chân tháp Eiffel' },
    tokyo: { emoji: '🌸', bg: 'linear-gradient(180deg, #3a2a6a, #ff8fb8 46%, #ffd9e6 62%, #5a3a7a)', cap: 'Hoa anh đào nở, tháp Tokyo lên đèn' },
    seoul: { emoji: '🔐', bg: 'linear-gradient(180deg, #1f2f6a, #6a7fd0 44%, #ffb38a 62%, #2a2a4a)', cap: 'Lên tháp Namsan móc khóa tình yêu' }
  }
};
// Trang phục rời của đôi trẻ theo điểm đến (hình trip_<mã>), chỉ dùng cho nơi chưa có tấm check-in trọn cảnh
const MOON_OUTFIT = { trada: 'home', santhuong: 'home', hocau: 'home', dalat: 'dalat', phuquoc: 'beach', halong: 'beach', maldives: 'beach', paris: 'paris', tokyo: 'tokyo', seoul: 'seoul' };
function moonCoupleImg(key) {
  const st = theme.data.events?.trip?.states || {};
  const f = st[key]?.img || st[MOON_OUTFIT[key]]?.img;
  return `url('${f ? themeAsset(f) : coupleStill('trip', 'wave', 'heart', 'idle')}')`;
}
const moonName = n => { const t = String(n || ''); return t.charAt(0).toUpperCase() + t.slice(1); };
// Ảnh cảnh không người của một nơi (ô chọn, nền mờ); tấm check-in có đôi trẻ (lúc khoe)
const moonScene = key => {
  const f = theme.data.events?.moon?.[key] || theme.data.events?.checkin?.[key];
  return f ? `url('${themeAsset(f)}') center / cover no-repeat` : (MOON_UI.places[key] || MOON_UI.places.trada).bg;
};
const moonBaked = key => Boolean(theme.data.events?.checkin?.[key]);
const moonFull = key => {
  const f = theme.data.events?.checkin?.[key] || theme.data.events?.moon?.[key];
  return f ? `url('${themeAsset(f)}') center / cover no-repeat` : (MOON_UI.places[key] || MOON_UI.places.trada).bg;
};
let moonUi = null;
let mn = null; // chuyến đang hiện: { deadline, key, groom, bride, timers, d }
function moonEls() {
  if (moonUi) return moonUi;
  const mk = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; parent.append(e); return e; };
  const root = mk('div', '', $('#frame'));
  root.id = 'moon';
  const ui = { root, opts: new Map() };
  ui.bg = mk('div', 'mn-bg', root);           // nền mờ: cảnh của nơi đang được chọn
  ui.full = mk('div', 'mn-full', root);       // lúc khoe: tấm ảnh check-in, rõ nét
  ui.emoji = mk('div', 'mn-emoji', root);
  ui.couple = mk('div', 'mn-couple', root);   // chỉ dùng khi nơi đó chưa có tấm check-in trọn cảnh
  ui.shade = mk('div', 'mn-shade', root);
  const head = mk('div', 'mn-head', root);
  mk('b', '', head, '✈️ TUẦN TRĂNG MẬT');
  ui.timer = mk('i', 'mn-timer', head);
  ui.sub = mk('div', 'mn-sub', root, '🎁 Tặng quà để chọn nơi trăng mật · tổng quà tới mức nào, đi nơi đó');
  ui.grid = mk('div', 'mn-grid', root);
  const meters = mk('div', 'mn-meters', root);
  ui.hearts = mk('span', 'mn-meter', meters);
  ui.coins = mk('span', 'mn-meter gift', meters);
  ui.card = mk('div', 'mn-card', root);
  ui.stamp = mk('i', 'mn-stamp', ui.card);
  ui.who = mk('span', 'mn-who', ui.card);
  ui.place = mk('b', 'mn-place', ui.card);
  ui.cap = mk('span', 'mn-cap', ui.card);
  ui.by = mk('span', 'mn-by', ui.card);
  return (moonUi = ui);
}
// Dựng các ô chọn: nơi đắt nhất nằm trên cùng, ba chỗ miễn phí nằm dưới cùng
function moonGrid(d) {
  const ui = moonEls();
  const list = (d.options || []).slice().sort((a, b) => b.price - a.price);
  const cheapest = Math.min(...list.filter(o => o.price > 0).map(o => o.price));
  ui.opts.clear();
  ui.grid.replaceChildren(...list.map(o => {
    const el = document.createElement('div');
    el.className = [...o.name].length > 16 ? 'mn-opt long' : 'mn-opt';
    const pic = document.createElement('div');
    pic.className = 'mn-opt-pic';
    pic.style.background = moonScene(o.key);
    const name = document.createElement('b');
    name.textContent = moonName(o.name);
    const price = document.createElement('i');
    price.textContent = !o.price ? 'MIỄN PHÍ' : o.price === cheapest ? `${fmt(o.price)} xu · hoặc đủ tim ❤` : `${fmt(o.price)} xu`;
    el.append(pic, name, price);
    ui.opts.set(o.key, { el, o });
    return el;
  }));
}
// Ô đang được chọn sáng lên, các ô đã vượt qua thì đánh dấu; hai thanh tim và xu
function moonRender(d) {
  const ui = moonEls();
  const cur = d.place?.key;
  for (const [key, { el, o }] of ui.opts) {
    el.classList.toggle('on', key === cur);
    el.classList.toggle('passed', key !== cur && o.price < (d.place?.price || 0)); // các nơi rẻ hơn nơi đang chọn (kể cả chỗ miễn phí) mờ đi
  }
  ui.bg.style.background = moonScene(cur);
  const paid = (d.options || []).filter(o => o.price > 0).sort((a, b) => a.price - b.price);
  const next = paid.find(o => o.price > (d.coins || 0));
  ui.hearts.textContent = d.heartsDone || (d.coins || 0) > 0 ? `❤ đã có vé đi ${moonName(paid[0]?.name)}` : `❤ ${fmt(d.progress || 0)} / ${fmt(d.target || 0)} tim là đi ${moonName(paid[0]?.name)}`;
  ui.coins.textContent = next ? `🎁 Tổng quà ${fmt(d.coins || 0)} xu · mốc kế: ${moonName(next.name)} ${fmt(next.price)} xu` : `🎁 Tổng quà ${fmt(d.coins || 0)} xu · đã tới nơi sang nhất`;
}
function moonStart(d) {
  moonClose(true);
  const ui = moonEls();
  const g = d.groom || roleName('groom');
  const b = d.bride || roleName('bride');
  mn = { deadline: performance.now() + (Number(d.remainingMs) || 0), key: d.place?.key, groom: g, bride: b, timers: [], d: { ...d } };
  dpActive = true; // cảnh tràn màn hình: các bảng mời quà, hàng người tặng quà tạm nhường chỗ như lúc động phòng
  sceneLock++;
  moonGrid(d);
  moonRender(d);
  ui.root.className = 'on';
  playFanfare();
  emojiRain(['✈️', '🧳', '💕', '🌴'], 26, 3200);
  if (d.line) speak(d.line, { priority: true });
  updateTag();
}
// Server gửi state: cập nhật thanh tim, số xu, đồng hồ
function moonSync(m) {
  if (!mn || !m) return;
  mn.deadline = performance.now() + (Number(m.remainingMs) || 0);
  mn.d = { ...mn.d, ...m };
  if (!moonEls().root.classList.contains('reveal')) moonRender(mn.d);
}
// Có người đổi vé (hoặc cả rạp đủ tim): ô của nơi mới sáng lên, nền mờ đổi theo
function moonUp(d) {
  if (!mn) return;
  const ui = moonEls();
  mn.key = d.place?.key;
  mn.d = { ...mn.d, ...d };
  moonRender(mn.d);
  const hit = ui.opts.get(mn.key)?.el;
  if (hit) {
    hit.classList.remove('hit');
    void hit.offsetWidth;
    hit.classList.add('hit');
  }
  playFanfare();
  screenFlash('#fff3c4');
  emojiRain(d.tier === 2 ? ['✈️', '💎', '🥂', '✨'] : ['🧳', '🏖️', '💕', '✨'], 26, 2600);
  if (d.by?.name) showToast(`✈️ ${d.by.name} chọn ${moonName(d.place?.name)} cho đôi trẻ!`, d.by.avatar, d.by.name);
  if (d.line) speak(d.line, { priority: true });
}
// Hết giờ: "tách!", danh sách thu lại, tấm ảnh check-in có đôi trẻ hiện rõ nét kèm thẻ ghi nơi đến và nhà tài trợ
function moonEnd(d) {
  if (!mn) return;
  if (d.aborted) return moonClose();
  const ui = moonEls();
  const key = d.place?.key;
  const p = MOON_UI.places[key] || MOON_UI.places.trada;
  mn.deadline = 0;
  ui.full.style.background = moonFull(key);
  const baked = moonBaked(key);
  ui.couple.style.backgroundImage = baked ? 'none' : moonCoupleImg(key);
  ui.emoji.textContent = baked || theme.data.events?.moon?.[key] ? '' : p.emoji;
  ui.stamp.textContent = MOON_UI.stamps[d.tier] || MOON_UI.stamps[0];
  ui.who.textContent = `${mn.groom} 💕 ${mn.bride} đang ở`;
  ui.place.textContent = `📍 ${moonName(d.place?.name)}`;
  ui.cap.textContent = p.cap;
  ui.by.textContent = d.sponsor ? `✈️ Vé do ${d.sponsor.name} tài trợ` : d.tier ? '❤ Vé do cả rạp góp' : '';
  ui.root.classList.toggle('baked', baked);
  ui.root.classList.add('reveal');
  playShutter();
  screenFlash('#ffffff');
  mn.timers.push(setTimeout(playPop, 280));
  if (d.tier) mn.timers.push(setTimeout(() => emojiRain(['📸', '💖', '✨', '🎉'], 30, 3000), 500));
  if (d.line) mn.timers.push(setTimeout(() => speak(d.line, { priority: true }), 450));
  mn.timers.push(setTimeout(() => moonClose(), 5400));
}
function moonClose(silent = false) {
  if (!mn) return;
  mn.timers.forEach(clearTimeout);
  mn = null;
  dpActive = false;
  sceneLock = Math.max(0, sceneLock - 1);
  moonEls().root.className = '';
  if (!silent) updateTag();
}
setInterval(() => {
  if (!mn) return;
  const ui = moonEls();
  const sec = Math.ceil(Math.max(0, mn.deadline - performance.now()) / 1000);
  ui.timer.textContent = mn.deadline ? mmss(sec) : '';
  ui.timer.classList.toggle('urgent', mn.deadline > 0 && sec <= 5);
  // Server hết chuyến mà màn hình lỡ mất sự kiện kết thúc (rớt mạng): tự dọn
  if (mn.deadline && performance.now() > mn.deadline + 6000) moonClose();
}, 250);

// ========================================================
// TUNG HOA CƯỚI: cô dâu tung hoa, bó hoa lơ lửng trên đầu cả rạp; khán giả gõ "chụp" để giơ tay, tặng quà là chụp chắc.
// Hết giờ hoa bay tới tay người bắt được: người đó lên làm cô dâu / chú rể lượt sau.
// ========================================================
let tossUi = null;
let ts = null; // lượt tung hoa đang hiện: { deadline, timers, open }
function tossEls() {
  if (tossUi) return tossUi;
  const mk = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; parent.append(e); return e; };
  const frame = $('#frame');
  const ui = {};
  ui.panel = mk('div', '', frame);
  ui.panel.id = 'toss-panel';
  const head = mk('div', 'ts-head', ui.panel);
  mk('span', 'ts-tape', head, '💐 CÔ DÂU TUNG HOA!');
  ui.timer = mk('b', 'ts-timer', head);
  const doors = mk('div', 'ts-doors', ui.panel);
  const free = mk('div', 'ts-door free', doors);
  mk('b', '', free, 'GÕ: CHỤP 🙌');
  mk('span', '', free, 'để bắt hoa');
  const gift = mk('div', 'ts-door gift', doors);
  mk('b', '', gift, 'TẶNG QUÀ 🎁');
  mk('span', '', gift, 'chụp chắc bó hoa');
  ui.prize = mk('div', 'ts-prize', ui.panel, 'Bắt được hoa: lượt sau lên làm cô dâu, chú rể');
  ui.count = mk('div', 'ts-count', ui.panel);
  ui.bouquet = mk('div', 'ts-bouquet', frame, '💐');
  return (tossUi = ui);
}
function tossCount(d) {
  const ui = tossEls();
  const n = Number(d.count) || 0;
  ui.count.textContent = d.top?.name ? `🎁 ${d.top.name} đang chụp chắc · 🙌 ${fmt(n)} người giơ tay` : n ? `🙌 ${fmt(n)} người đang giơ tay` : '🙌 Chưa ai giơ tay, gõ CHỤP đi nào!';
}
function tossStart(d) {
  tossClose();
  const ui = tossEls();
  ts = { deadline: performance.now() + (Number(d.remainingMs) || 0), timers: [], open: true };
  const old = $('#ceremony-alert-banner');
  if (old) old.hidden = true;
  tossCount(d);
  ui.panel.classList.add('on');
  ui.bouquet.classList.remove('on');
  void ui.bouquet.offsetWidth;
  ui.bouquet.classList.add('on');
  coupleDo(['bouquet', 'wave'], 3600);
  playChime();
  guestsReact(26, ['hop', 'look', 'hop']);
  if (d.line) speak(d.line, { priority: true });
  updateTag();
}
// Có người giơ tay (bình luận "chụp") hoặc tặng quà chụp chắc
function tossGrabFx(d) {
  if (!ts) return;
  tossCount(d);
  showChatBubble(d.id, d.sure ? '🎁 Chụp chắc!' : '🙌 Chụp!', { hold: false });
  guestReact(guestNodes.get(d.id), 'hop');
  if (d.sure) { playCoins(); showToast(`🎁 ${d.name} tặng quà: chụp chắc bó hoa!`); }
  else sfx(ctx => tone(ctx, { freq: 880 + Math.random() * 400, type: 'triangle', dur: 0.08, gain: 0.05 }));
}
async function tossEnd(d) {
  if (!ts) return;
  const ui = tossEls();
  ts.open = false;
  ts.deadline = 0;
  ui.panel.classList.remove('on');
  ui.bouquet.classList.remove('on');
  if (d.aborted) return tossClose();
  const w = d.winner;
  if (d.line) ts.timers.push(setTimeout(() => speak(d.line, { priority: true }), 500));
  // Bó hoa rời chỗ lơ lửng, bay tới tay người bắt được (không ai chụp thì rơi xuống thảm)
  const from = { x: 540, y: 980 };
  const to = w ? seatPoint(w.id) : { x: 540, y: 1560 };
  const el = document.createElement('div');
  el.className = 'flying-bouquet';
  el.textContent = '💐';
  $('#hearts-layer').append(el);
  const peak = Math.min(from.y, to.y) - (w ? 260 : 60);
  await el.animate([
    { transform: `translate(${from.x - 36}px, ${from.y - 36}px) rotate(0deg) scale(1.5)` },
    { transform: `translate(${(from.x + to.x) / 2 - 36}px, ${peak}px) rotate(360deg) scale(1.5)`, offset: 0.45 },
    { transform: `translate(${to.x - 36}px, ${to.y - 36}px) rotate(720deg) scale(1)` }
  ], { duration: w ? 1300 : 900, easing: w ? 'ease-in-out' : 'ease-in', fill: 'forwards' }).finished;
  el.remove();
  if (!ts) return;
  if (w) {
    const role = w.role === 'bride' ? 'cô dâu' : 'chú rể';
    spawnHearts(16, { x: to.x, y: to.y, spread: 130, emojis: ['💐', '🌸', '💖', '✨'] });
    playWeddingBell();
    playFanfare();
    showChatBubble(w.id, '💐 Bắt được rồi!');
    guestReact(guestNodes.get(w.id), 'hop');
    guestsReact(20, ['clap', 'look', 'clap']);
    const sub = w.position > 1 ? `Xếp hàng chờ số ${w.position} để làm ${role}` : `Lượt sau lên làm ${role}!`;
    showCeremonyBanner(`${String(w.name).toUpperCase()} BẮT ĐƯỢC HOA!`, sub, 'bride', 4400, w.byGift ? '🎁 CHỤP CHẮC BẰNG QUÀ' : '💐 CHỤP ĐƯỢC HOA CƯỚI');
    showToast(`💐 ${w.name} bắt được hoa cưới · ${sub}`, w.avatar, w.name);
  } else {
    playSadTrombone();
    showCeremonyBanner('HOA RƠI XUỐNG ĐẤT!', 'Không ai chụp · MC nhặt về cắm bình', 'auction', 3800, '💐 TUNG HOA CƯỚI');
  }
  ts.timers.push(setTimeout(tossClose, 4600));
}
function tossClose() {
  if (!ts) return;
  ts.timers.forEach(clearTimeout);
  ts = null;
  const ui = tossEls();
  ui.panel.classList.remove('on', 'urgent');
  ui.bouquet.classList.remove('on');
  updateTag();
}
// Server gửi state: số người giơ tay, đồng hồ
function tossSync(t) {
  if (!ts || !t || !ts.open) return;
  ts.deadline = performance.now() + (Number(t.remainingMs) || 0);
  tossCount(t);
}
setInterval(() => {
  if (!ts) return;
  const ui = tossEls();
  const sec = Math.ceil(Math.max(0, ts.deadline - performance.now()) / 1000);
  ui.timer.textContent = ts.open ? mmss(sec) : '';
  ui.panel.classList.toggle('urgent', ts.open && sec <= 3);
  // Server hết lượt mà màn hình lỡ mất sự kiện kết thúc (rớt mạng): tự dọn
  if (ts.open && performance.now() > ts.deadline + 6000) tossClose();
}, 250);

realtime.addEventListener('toss', e => {
  try {
    const d = JSON.parse(e.data);
    if (d.phase === 'start') tossStart(d);
    else if (d.phase === 'grab') tossGrabFx(d);
    else if (d.phase === 'end') tossEnd(d);
  } catch (err) { console.warn('toss error', err); }
});

realtime.addEventListener('moon', e => {
  try {
    const d = JSON.parse(e.data);
    if (d.phase === 'start') moonStart(d);
    else if (d.phase === 'up') moonUp(d);
    else if (d.phase === 'end') moonEnd(d);
  } catch (err) { console.warn('moon error', err); }
});

// Sinh con: có người vừa nhận đỡ đầu (ô sáng lên), hoặc hết giờ (mở cửa khoe em bé)
realtime.addEventListener('baby', e => {
  try {
    const d = JSON.parse(e.data);
    if (d.phase === 'gift') {
      babyWait?.mark(d.sex, d[d.sex]);
      if (d.line) speak(d.line);
      showToast(`🍼 ${d[d.sex]?.name || ''} đỡ đầu ${d.sex === 'boy' ? 'bé trai' : 'bé gái'}!`, d[d.sex]?.avatar, d[d.sex]?.name);
    } else if (d.phase === 'end') {
      babyWait?.resolve(d);
    }
  } catch (err) { console.warn('baby error', err); }
});

realtime.addEventListener('twist', e => {
  try {
    const d = JSON.parse(e.data);
    if (d.phase === 'start') twistStart(d, true);
    else if (d.phase === 'end') twistEnd(d);
  } catch (err) { console.warn('twist error', err); }
});

realtime.addEventListener('mc', e => {
  try {
    const d = JSON.parse(e.data);
    if (ceremonyRunning && d.kind !== 'test') return;
    speak(d.text, { priority: d.kind === 'test' });
  } catch (err) {}
});

realtime.addEventListener('photo', e => {
  try {
    photoQueue.push(JSON.parse(e.data));
    runPhotoQueue();
  } catch (err) {}
});

realtime.addEventListener('focus', e => {
  try {
    const ev = JSON.parse(e.data);
    playGiftSound(ev.total);
    giftSplash(ev);
    if (ev.action === 'cancel' && ev.cancel) holdKickedCouple();
    queueOffering(ev);
  } catch (err) {}
});

// Chỉ để kiểm thử: mở overlay.html?debug rồi gọi window.__fx.<nhóm>[i].run()
if (new URLSearchParams(location.search).has('debug')) window.__fx = { OPENINGS, RING_FINISHES, WED_DONES, FAREWELLS, showCeremonyBanner, lastVariants, pickFresh, twistStart, twistEnd, twistSync,
  theme, TWIST_UI, twistEls, twistActorShow, twistCleanup, twistRoachOn, twistRoachOff, twistZalo, twistReply, twistShout, twistPop, coupleSpot, renderPhotoCanvas, runDongPhong };
