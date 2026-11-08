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
bgmAudio.loop = true;
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
    badge.hidden = !(hasFile || hasYt) || b.playing === false || b.enabled === false;
    $('#bgm-title-text').textContent = b.title || (hasFile ? prettyFile(b.file) : 'Nhạc YouTube');
  }

  if (hasFile && wantPlay) {
    const src = '/music/' + encodeURIComponent(b.file);
    if (!bgmAudio.src || !bgmAudio.src.endsWith(src)) bgmAudio.src = src;
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

// Trình duyệt thường chặn tự phát nhạc tới khi có thao tác; OBS thì không chặn
window.addEventListener('pointerdown', () => applyBgm(), { once: true, passive: true });

// ========================================================
// GIỌNG MC: giọng tiếng Việt của máy, nếu không có thì giọng Google qua server
// ========================================================
function cleanForSpeech(text) {
  return String(text || '')
    .replace(/\p{Extended_Pictographic}|‍|️/gu, '')
    .replace(/[★☆♥♡❤✿❀•●◆◇■□▪▫※]+/g, ' ')
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
async function playTtsQueue() {
  if (ttsPlaying) return;
  ttsPlaying = true;
  setDuck('voice', 0.35);
  while (ttsQueue.length) {
    const { text, rate, volume } = ttsQueue.shift();
    try {
      const res = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) continue;
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.playbackRate = rate;
      audio.volume = volume;
      await new Promise(resolve => {
        const done = () => { clearTimeout(guard); resolve(); };
        const guard = setTimeout(done, 20000);
        audio.onended = audio.onerror = done;
        audio.play().catch(done);
      });
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

function chosenBrowserVoice() {
  const list = viVoices();
  if (!list.length) return null;
  const want = cfg().browserVoice;
  return (want && list.find(v => v.name === want))
    || list.find(v => /natural|online/i.test(v.name) && /hoaimy/i.test(v.name))
    || list.find(v => /natural|online/i.test(v.name))
    || list[0];
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
  const bv = engine === 'google' ? null : chosenBrowserVoice();
  if (!bv) {
    // Giọng Google qua server (máy không có giọng tiếng Việt, hoặc chọn Google)
    if (priority) ttsQueue.length = 0;
    if (ttsQueue.length > 6) ttsQueue.splice(0, ttsQueue.length - 6);
    const rate = Math.min(2, Math.max(0.5, Number(c.voiceRate) || 1.08));
    const volume = Math.min(1, Math.max(0, Number(c.volume ?? 0.95)));
    splitSpeech(clean).forEach(t => ttsQueue.push({ text: t, rate, volume }));
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
  has(name) { return Boolean(this.layers[name]); }
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
    if (!this.layers[name]) return false;
    clearTimeout(this.timer);
    this.show(name);
    this.timer = setTimeout(() => this.show(back), ms);
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

  const bgs = t.backgrounds?.length ? t.backgrounds : LEGACY_THEME.backgrounds;
  const bg = bgs.find(b => b.id === c.themeBackground) || bgs[0];
  theme.bgSrc = themeAsset(bg.src);
  const bgEl = $('.stage-bg');
  if (bgEl && bgEl.getAttribute('src') !== theme.bgSrc) bgEl.src = theme.bgSrc;

  // Cặp đôi
  const spr = $('#couple-sprite');
  const ch = Math.round((t.display?.couple || 280) * sizePct(c.sizeCouple));
  if (spr) {
    spr.style.height = `${ch}px`;
    spr.style.width = `${Math.round(ch * (t.couple?.aspect || 0.95))}px`;
  }
  coupleActor.configure(t.couple, { video });
  spr?.classList.toggle('has-video', coupleActor.hasVideo);
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
  const dp = $('.dp-couple');
  if (dp) dp.style.backgroundImage = `url('${coupleStill('carry', 'heart', 'kiss', 'idle')}')`;
  const room = $('.dp-inside');
  if (room) room.style.background = t.dongphong ? `url('${themeAsset(t.dongphong)}') center / cover no-repeat` : '';
  if (currentState) renderGuests(currentState.people || []);
}

// ========================================================
// KHÁCH DỰ TIỆC
// ========================================================
const guestNodes = new Map();

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
  ].map(([x, y, scale]) => ({ x, y, scale }))
];

function renderGuests(people = []) {
  const container = $('#guests-container');
  if (!container) return;
  const currentIds = new Set(people.map(p => p.id));
  for (const [id, node] of guestNodes) {
    if (!currentIds.has(id)) {
      node.remove();
      guestNodes.delete(id);
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

    const seat = banquetTables[(Number.isInteger(p.table) ? p.table : index) % banquetTables.length];
    const sc = seatScale(seat);
    node.style.width = `${box.w}px`;
    node.style.height = `${box.h}px`;
    node.style.left = `${seat.x - box.w / 2}px`;
    node.style.top = `${seat.y + 30 - box.h}px`;
    node.style.setProperty('--scale', sc);
    node.style.transform = `scale(${sc})`;
    node.style.zIndex = String(Math.round(seat.y / 10));
  });
}

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

let lastMenuKey = '';
function renderGiftMenu(c) {
  const list = $('#gift-guide-list');
  if (!list) return;
  const rules = (c.giftRules || []).filter(r => r.action !== 'thanks' && (!ROLE_RULE_ROLE[r.action] || openRolesOf(c).includes(ROLE_RULE_ROLE[r.action])));
  const key = JSON.stringify([rules, c.roleMode, c.enableMarryAuction]);
  if (key === lastMenuKey) return;
  lastMenuKey = key;
  list.replaceChildren();

  const add = (icon, title, sub, cls) => {
    const item = document.createElement('div');
    item.className = 'gift-guide-item ' + (cls || '');
    const ic = document.createElement('div');
    ic.className = 'guide-icon';
    ic.textContent = icon;
    const info = document.createElement('div');
    info.className = 'guide-info';
    const b = document.createElement('b');
    b.textContent = title;
    const s = document.createElement('span');
    s.textContent = sub;
    info.append(b, s);
    item.append(ic, info);
    list.append(item);
  };

  const shownAll = rules.filter(r => c.enableMarryAuction !== false || !(r.action === 'role' || ROLE_RULE_ROLE[r.action]));
  const compact = shownAll.length > 7;
  list.classList.toggle('compact', compact);
  if (!compact) add('💬', 'BÌNH LUẬN', 'Vào dự tiệc · gõ "dzô"', 'highlight-cmt');
  const shown = shownAll.slice(0, compact ? 11 : 7);
  for (const r of shown) {
    const info = ACTION_INFO[r.action] || ACTION_INFO.thanks;
    add(info.icon, r.action === 'role' ? roleRuleLabel(c) : info.label, ruleSubtitle(r), info.cls);
  }
}

let lastHowKey = '';
function renderHowTo(c) {
  const ul = $('#howto-list');
  if (!ul) return;
  const min = fmt(Number(c.minCoinsToMarry) || 10);
  const roles = openRolesOf(c);
  const key = JSON.stringify([min, roles, c.enableMarryAuction, c.autoCeremony, c.roleSystem, c.giftRules]);
  if (key === lastHowKey) return;
  lastHowKey = key;
  const lines = [
    ['💬', 'Cmt', 'vào dự tiệc'],
    ['🍻', 'dzô · nhảy · hôn đi', 'nghi thức']
  ];
  if (c.enableMarryAuction !== false) {
    if (c.roleSystem === 'queue') {
      const gGift = firstGiftFor(c, ['groom', 'role']);
      const bGift = firstGiftFor(c, ['bride']);
      if (roles.includes('groom')) lines.push(['🤵', gGift ? `Tặng ${gGift}` : 'Tặng quà', 'CHÚ RỂ!', true]);
      if (roles.includes('bride')) lines.push(['👰', bGift ? `Tặng ${bGift}` : '"làm cô dâu" + quà', 'CÔ DÂU!', true]);
      lines.push(['⏳', 'Vai có người', 'xếp hàng chờ']);
    } else {
      if (roles.includes('groom')) lines.push(['🤵', `Tặng ≥${min} xu`, 'LÀM CHÚ RỂ!', true]);
      if (roles.includes('bride')) lines.push(['👰', roles.length > 1 ? `"làm cô dâu" + ${min} xu` : `Tặng ≥${min} xu`, 'CÔ DÂU!', true]);
      lines.push(['⚔️', 'Tặng nhiều hơn', 'CƯỚP VAI!']);
    }
    if (c.autoCeremony !== false) lines.push(['💒', 'Đủ đôi', 'làm lễ & động phòng']);
  }
  lines.push(['👗', 'nam / nữ', 'đổi nhân vật']);
  ul.replaceChildren(...lines.map(([icon, b, rest, gold]) => {
    const li = document.createElement('li');
    const i = document.createElement('i');
    i.textContent = icon;
    const span = document.createElement('span');
    const bold = document.createElement('b');
    bold.textContent = b;
    const tail = document.createElement(gold ? 'b' : 'span');
    if (gold) tail.className = 'gold-text';
    tail.textContent = rest;
    span.append(bold, ' → ', tail);
    li.append(i, span);
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
  const name = holder?.name || c[role] || (role === 'groom' ? 'Chú rể' : 'Cô dâu');
  const min = Number(c.minCoinsToMarry) || 10;
  updateAvatar(el.querySelector('.rc-avatar'), holder?.avatar || '', name);
  el.querySelector('.rc-name').textContent = name;
  el.classList.toggle('held', Boolean(holder));
  el.classList.toggle('closed', !open);
  const queueMode = c.roleSystem === 'queue';
  const waiting = Number(s.queue?.[role + 'Count']) || 0;
  el.querySelector('.rc-bid').textContent = holder
    ? (queueMode ? `⏳ Hàng chờ: ${waiting} người` : `💰 ${fmt(holder.bid)} xu`)
    : (open ? (queueMode ? 'VAI ĐANG TRỐNG' : 'CHỜ NGƯỜI CƯỚP') : (role === 'groom' ? 'CHÚ RỂ CHÍNH' : 'CÔ DÂU CHÍNH'));
  let hint = '';
  if (open && queueMode) {
    const take = firstGiftFor(c, role === 'groom' ? ['groom', 'role'] : ['bride']);
    const swap = firstGiftFor(c, [role === 'groom' ? 'replaceGroom' : 'replaceBride']);
    if (holder) hint = swap ? `Tặng ${swap} để thay ngay!` : (take ? `Tặng ${take} để xếp hàng` : 'Tặng quà để xếp hàng');
    else hint = take ? `Tặng ${take} để nhận vai` : `Tặng quà để làm ${role === 'groom' ? 'chú rể' : 'cô dâu'}`;
  } else if (open) {
    if (holder) hint = `Tặng > ${fmt(holder.bid)} xu để cướp!`;
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
let ceremonyDeadline = 0;
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
  ceremonyDeadline = tagPhase === 'countdown' ? performance.now() + (Number(s.ceremony.remainingMs) || 0) : 0;
  updateTag();
}
function updateTag() {
  const tag = $('#groom-status-tag');
  if (!tag) return;
  const span = tag.querySelector('span');
  tag.classList.toggle('countdown', tagPhase === 'countdown');
  tag.classList.toggle('running', tagPhase === 'running');
  if (tagPhase === 'countdown') {
    const sec = Math.max(0, Math.ceil((ceremonyDeadline - performance.now()) / 1000));
    span.textContent = `💒 LỄ THÀNH HÔN SAU ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  } else if (tagPhase === 'running') {
    span.textContent = '💒 ĐANG LÀM LỄ THÀNH HÔN';
  } else {
    const c = cfg();
    span.textContent = c.autoCeremony !== false && c.enableMarryAuction !== false ? '💍 CHỜ ĐỦ ĐÔI ĐỂ LÀM LỄ' : '👑 TIỆC CƯỚI HỶ SỰ';
  }
}
setInterval(updateTag, 250);

// ========================================================
// VẼ TOÀN BỘ TRẠNG THÁI
// ========================================================
function renderState(s) {
  currentState = s;
  const c = s.config || {};
  const stats = s.stats || {};
  const goals = s.goals || {};

  $('#wedding-title').textContent = c.title || 'TIỆC CƯỚI ONLINE';
  $('#groom-name').textContent = roleName('groom');
  $('#bride-name').textContent = roleName('bride');
  updateAvatar($('#groom-av'), s.roles?.groom?.avatar || '', roleName('groom'));
  updateAvatar($('#bride-av'), s.roles?.bride?.avatar || '', roleName('bride'));

  $('#stat-guests').textContent = `${fmt(stats.guests || 0)} khách`;
  $('#stat-envelopes').textContent = `${fmt(stats.envelopes || 0)} phong bì`;
  $('#stat-wishes').textContent = `${fmt(stats.wishes || 0)} lời chúc`;
  $('#stat-couples').textContent = `${fmt(stats.couples || 0)} cặp`;

  for (const k of ['rose', 'cake']) {
    const g = goals[k];
    if (!g) continue;
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    $(`#goal-${k}-fill`).style.width = `${pct}%`;
    $(`#goal-${k}-num`).textContent = `${fmt(g.current)}/${fmt(g.target)}${k === 'cake' ? ' xu' : ''}`;
    if (g.label) $(`#goal-${k}-label`).textContent = g.label;
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
  renderGuests(s.people || []);
  renderRegistry(s.scores || {});
  renderGiftMenu(c);
  renderHowTo(c);
  applyBgm();
}

// ========================================================
// BANNER, THÔNG BÁO, BONG BÓNG CHAT
// ========================================================
let ceremonyTimer = null;
function showCeremonyBanner(title, subtitle, type = 'gold', durationMs = 5500) {
  const banner = $('#ceremony-alert-banner');
  if (!banner) return;
  $('#ceremony-title').textContent = title;
  $('#ceremony-subtitle').textContent = subtitle || '';
  banner.className = `ceremony-alert type-${type}`;
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

function showChatBubble(personId, comment) {
  const node = guestNodes.get(personId);
  if (!node) return;
  node.querySelector('.wedding-chat-bubble')?.remove();
  const bubble = document.createElement('div');
  bubble.className = 'wedding-chat-bubble';
  bubble.textContent = String(comment).slice(0, 60);
  node.append(bubble);
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
}

function triggerDance(initiator = '', { big = false, goal = 0 } = {}) {
  const ms = big ? 8000 : 5000;
  if (!big) coupleDo(['dance', 'wave'], ms);
  guestsDance(ms);
  startDisco(ms + 200);
  playDanceBeat(ms / 1000);
  setDuck('dance', 0.2);
  setTimeout(() => setDuck('dance', null), ms + 200);
  if (big) {
    coupleActor.play('heart', 5200);
    showCeremonyBanner('💃 CẢ RẠP ĐỨNG DẬY QUẨY!', goal ? `Đủ ${fmt(goal)} tim rồi bà con ơi! 🎉` : 'Quẩy hết mình nào!', 'dance', ms - 300);
    spawnHearts(20, { x: 540, y: 1200, spread: 700, emojis: ['❤️', '💃', '🕺', '🎶', '✨'] });
    showToast('💃 Đủ tim rồi! Cả rạp đứng dậy quẩy! ❤️');
    return;
  }
  showCeremonyBanner('💃 CẢ HỘI TRƯỜNG QUẨY TƯNG BỪNG! 🎉', `${initiator ? initiator + ' khuấy động: ' : ''}Hòa nhịp đón mừng ngày vui!`, 'dance');
  showToast('💃 Cả hội trường cùng quẩy tưng bừng! 🎉');
}

function triggerCake() {
  playFanfare();
  spawnHearts(16, { emojis: ['🎂', '🍰', '💕', '✨'] });
  if (!coupleActor.play('cake', 4800)) triggerKiss(true);
  showCeremonyBanner('🎂 NGHI THỨC CẮT BÁNH CƯỚI!', 'Tân lang & tân nương cùng cắt bánh ngọt ngào!', 'cake');
  showToast('🎂 Nghi thức cắt bánh cưới hạnh phúc viên mãn! 💕');
}

function triggerChampagne() {
  coupleDo(['cheers', 'wave'], 4500);
  playPop();
  setTimeout(playClink, 350);
  for (let i = 0; i < 18; i++) setTimeout(() => spawnBubbles(true), i * 90);
  spawnHearts(10, { emojis: ['🥂', '🍾', '✨', '💛'] });
  showCeremonyBanner('🍾 RÓT THÁP RƯỢU SÂM PANH!', 'Rót tràn tình nồng, trăm năm hạnh phúc!', 'champagne');
  showToast('🍾 Rót tháp rượu sâm panh tình nồng ý thắm! 🥂');
}

function triggerPetal(big = false) {
  coupleDo(['petal', 'heart'], 4500);
  playWeddingBell();
  spawnPetalsBurst(big ? 70 : 45);
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
    spawnHearts(18, { x: 540, y: 860, spread: 240, emojis: ['✨', '💍', '💖', '🌟'] });
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

function triggerRoleChange({ role, name, avatar, previous, bid, replaced = false, fromQueue = false }) {
  const isGroom = role === 'groom';
  const label = isGroom ? 'chú rể' : 'cô dâu';
  const queueMode = cfg().roleSystem === 'queue';
  let sub;
  if (fromQueue) sub = `Tới lượt từ hàng chờ, mời lên sân khấu!`;
  else if (replaced) sub = `Lên thay ${previous}!`;
  else if (queueMode) sub = `Chính thức nhận vai ${label}!`;
  else sub = previous ? `Soán ngôi ${previous} với ${fmt(bid)} xu!` : `Giành vai ${label} với ${fmt(bid)} xu!`;
  showCeremonyBanner(
    replaced ? `🔁 THAY ${label.toUpperCase()}: ${String(name).toUpperCase()}`
      : isGroom ? `👑 TÂN LANG MỚI: ${String(name).toUpperCase()}` : `👰 TÂN NƯƠNG MỚI: ${String(name).toUpperCase()}`,
    sub, isGroom ? 'marry' : 'bride', 6500
  );
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
  showToast(`🎉 ${name} chính thức làm ${isGroom ? 'CHÚ RỂ' : 'CÔ DÂU'}! Chúc mừng! 💕`, avatar, name);
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
function playSadTrombone() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  [392, 370, 349, 311].forEach((freq, i) => tone(ctx, { freq, to: freq * 0.97, type: 'sawtooth', at: i * 0.32, dur: i === 3 ? 0.9 : 0.3, gain: 0.07 }));
}
function playBoom() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  noiseBurst(ctx, { dur: 0.45, gain: 0.3, hp: 140 });
  tone(ctx, { freq: 95, to: 38, dur: 0.5, gain: 0.22 });
}
function playShutter() {
  if (!soundOn()) return;
  const ctx = getAudio(); if (!ctx) return;
  noiseBurst(ctx, { dur: 0.05, gain: 0.5, hp: 2500 });
  noiseBurst(ctx, { at: 0.09, dur: 0.06, gain: 0.35, hp: 1800 });
}

// ----- PHÁ ĐÁM -----
function triggerCancel(name, couple) {
  const g = couple?.groom || roleName('groom');
  const b = couple?.bride || roleName('bride');
  showCeremonyBanner(`💔 ${String(name || 'Ai đó').toUpperCase()} PHÁ ĐÁM!`, `Đám cưới của ${g} & ${b} đã bị hủy!`, 'cancel', 5000);
  const stage = $('#wedding-stage');
  stage?.classList.remove('shake');
  void stage?.offsetWidth;
  stage?.classList.add('shake');
  coupleDo(['shock'], 4200);
  const sprite = $('#couple-sprite');
  sprite?.classList.add('fled');
  setTimeout(() => sprite?.classList.remove('fled'), 4200);
  playSadTrombone();
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
  const p = currentState?.people?.find(x => x.id === personId);
  const seat = p ? banquetTables[p.table % banquetTables.length] : null;
  return seat ? { x: seat.x, y: seat.y + 30 - guestBox().h * 0.8 * seatScale(seat) } : { x: 200 + Math.random() * 680, y: 1400 };
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
function triggerFireworks(name) {
  if (name) {
    showCeremonyBanner('🎆 PHÁO HOA RỰC RỠ!', `${name} thắp sáng cả hôn trường!`, 'gold', 4500);
    coupleDo(['fireworks', 'wave'], 4500);
    guestsReact(10, ['hop', 'clap', 'look']);
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
      playBoom();
      setTimeout(() => burst.remove(), 1900);
    }, k * 520);
  }
}

// ----- ĐỔI NHẠC -----
function triggerMusic(name, track) {
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
    const label = `📸 ${d.giver.name}`;
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
    setTimeout(() => triggerFireworks(), 600);
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

async function runDongPhong({ groom, bride, intro = true, lines = {} } = {}) {
  if (dpActive) return;
  dpActive = true;
  sceneLock++;
  coupleDo(['carry', 'kiss'], 3200);
  const g = groom || roleName('groom');
  const b = bride || roleName('bride');
  const root = $('#dong-phong');
  $('#dp-groom').textContent = g;
  $('#dp-bride').textContent = b;
  root.className = '';
  root.hidden = false;
  void root.offsetWidth;
  root.classList.add('dp-show');
  if (intro && lines.dongphong) speak(lines.dongphong, { priority: true });
  playWeddingBell();

  await sleep(900);
  root.classList.add('dp-enter');
  await sleep(1700);
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
  ids.forEach((id, i) => setTimeout(() => showChatBubble(id, pick(chants)), 400 + i * 900));

  await sleep(5000);
  clearInterval(heartTimer);
  root.classList.remove('dp-closed', 'dp-signon');
  root.classList.add('dp-open', 'dp-baby-on');
  playFanfare();
  spawnHearts(24, { x: 540, y: 900, spread: 420 });
  spawnPetalsBurst(30);
  if (lines.dongphongEnd) speak(lines.dongphongEnd);
  await sleep(2600);
  root.classList.add('dp-hide');
  await sleep(600);
  root.hidden = true;
  root.className = '';
  heartsBox.replaceChildren();
  dpActive = false;
  sceneLock--;
  processOfferingQueue();
}

// ----- LỄ THÀNH HÔN: trao nhẫn -> hôn -> cắt bánh -> rót rượu -> động phòng -----
let ceremonyRunning = false;
let ceremonyEndedAt = 0;

async function runCeremony(d) {
  if (ceremonyRunning) return;
  ceremonyRunning = true;
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

  const L = d.lines || {};
  if (d.quick) {
    showCeremonyBanner('⚡ ĐỘNG PHÒNG LUÔN!', `${d.initiator ? d.initiator + ' tặng quà · ' : ''}${g} 💕 ${b}`, 'marry', 3200);
    playFanfare();
    spawnHearts(16);
    if (L.ceremonyStart) speak(L.ceremonyStart, { priority: true });
    await sleep(3000);
  } else {
    showCeremonyBanner('💒 LỄ THÀNH HÔN BẮT ĐẦU', `${g} 💕 ${b}`, 'marry', 5200);
    playWeddingBell();
    spawnHearts(16);
    spawnPetalsBurst(25);
    if (L.ceremonyStart) speak(L.ceremonyStart, { priority: true });
    await sleep(5200);

    triggerRing({ groom: g, bride: b });
    if (L.ring) speak(L.ring);
    await sleep(5000);

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
  await runDongPhong({ groom: g, bride: b, intro: true, lines: { dongphong: L.dongphong, dongphongEnd: L.dongphongEnd } });
  sceneLock++;

  showCeremonyBanner(`🎉 ${g} & ${b} VỀ CHUNG MỘT NHÀ!`, 'Vai cô dâu – chú rể mở lại cho lượt mới!', 'marry', 6000);
  coupleActor.play('bow', 5500);
  playFanfare();
  spawnPetalsBurst(40);
  showToast(`💒 ${g} & ${b} đã thành hôn! Tặng quà để giành vai lượt mới! 💕`);
  if (L.ceremonyEnd) speak(L.ceremonyEnd);
  ceremonyRunning = false;
  ceremonyEndedAt = Date.now();
  sceneLock--;
  processOfferingQueue();
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

function queueOffering(ev) {
  offeringQueue.push(ev);
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
    await presentOffering(item, offeringQueue.length >= 3);
  } catch (e) {
    console.warn('offering error', e);
  }
  offeringBusy = false;
  if (offeringQueue.length) setTimeout(processOfferingQueue, 250);
}

function giftLine(item) {
  const r = item.roleResult;
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
  actor.querySelector('.actor-gift-icon').textContent = info.icon;
  actor.querySelector('.actor-gift-name').textContent = `${item.gift} ×${item.count}`;
  actor.querySelector('.actor-name').textContent = item.name;
  updateAvatar(actor.querySelector('.actor-av'), item.avatar, item.name);

  const target = path.target;
  Object.assign(actor.style, placeFrame(path.start));
  actor.hidden = false;
  actor.classList.add('walking');
  await walkTo(actor, path.start, target, fast ? 1300 : 3400);
  actor.classList.remove('walking');
  if (token !== offeringToken) return;
  setActorLook(actor, item, item.action === 'dance' ? 'dance' : 'stand', flipFor(item, path.start, target));

  speak(item.funnyMessage);
  showToast(`💌 ${item.name}: ${giftLine(item)}`, item.avatar, item.name);

  let showCard = true;
  switch (item.action) {
    case 'role': {
      const r = item.roleResult || {};
      if (r.became) triggerRoleChange({ role: r.role, name: item.name, avatar: item.avatar, previous: r.previous, bid: r.bid, replaced: r.replaced });
      else showAuction(item);
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
  guestsReact(item.action === 'thanks' ? 4 : 7, ['clap', 'clap', 'hop']);

  const card = $('#celebration-card');
  if (showCard && card) {
    updateAvatar($('#celeb-av'), item.avatar, item.name);
    $('#celeb-donor').textContent = item.name;
    $('#celeb-gift').textContent = giftLine(item);
    const wishes = cfg().mcLines?.cardWishes?.length ? cfg().mcLines.cardWishes : ['Chúc trăm năm hạnh phúc!'];
    $('#celeb-wish').textContent = `"${pick(wishes)}"`;
    card.classList.add('show');
    const ok = await hold(fast ? 1700 : 4300, token);
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
      await walkTo(actor, target, path.start, 2400);
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
  'Cạn ly chúc phúc đôi bạn trẻ! 🥂', 'Đẹp đôi nhất quả đất! 💖'
];
setInterval(() => {
  if (!guestNodes.size || dpActive) return;
  const ids = Array.from(guestNodes.keys());
  showChatBubble(pick(ids), pick(ambientLines));
}, 5800);

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
      showChatBubble(d.id, d.comment);
      guestReact(guestNodes.get(d.id), 'hop');
    } else if (d.type === 'join') {
      showChatBubble(d.id, '👋 Tới rồi nè!');
      setTimeout(() => guestReact(guestNodes.get(d.id), 'wave'), 300);
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
      case 'dance': triggerDance(d.initiator, { big: Boolean(d.big), goal: d.likeGoal }); break;
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
      case 'role_change': triggerRoleChange({ role: d.role, name: d.name, avatar: d.avatar, bid: d.bid, fromQueue: d.fromQueue }); break;
      case 'marry': triggerRoleChange({ role: 'groom', name: d.initiator || d.newGroom || '', bid: d.bid || 0 }); break;
      case 'roles_open':
        if (d.silent || ceremonyRunning || Date.now() - ceremonyEndedAt < 4000) break;
        showCeremonyBanner('🔔 VAI CÔ DÂU – CHÚ RỂ ĐÃ MỞ!', 'Tặng quà để giành vai ngay!', 'gold', 4500);
        if (d.line) speak(d.line);
        break;
    }
    // Lời MC đi kèm nút bấm / mục tiêu / người nhận vai lượt mới
    if (d.line && !['roles_open'].includes(d.action)) speak(d.line);
  } catch (err) { console.warn('action error', err); }
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
  try { queueOffering(JSON.parse(e.data)); } catch (err) {}
});
