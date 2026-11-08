const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const EventEmitter = require('node:events');
const { MC_GROUPS, defaultMcLines, sanitizeMcLines } = require('./mc_lines.cjs');

const PORT = Number(process.env.PORT) || 3003;
const STATE_FILE = process.env.TIECCUOI_STATE || path.join(__dirname, 'wedding_state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MUSIC_DIR = path.join(PUBLIC_DIR, 'music');
const CEREMONY_MS = 37500;       // thời lượng chuỗi lễ thành hôn trên overlay
const CEREMONY_QUICK_MS = 14500; // "động phòng luôn": bỏ qua các bước lễ
const ALBUM_DIR = path.join(PUBLIC_DIR, 'album');
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MUSIC_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);
const MAX_MUSIC_BYTES = 60 * 1024 * 1024;

try { fs.mkdirSync(MUSIC_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(ALBUM_DIR, { recursive: true }); } catch {}

// Khóa bí mật cho webhook TikFinity Web (khi đi qua tunnel cloudflared/ngrok)
const WEBHOOK_KEY_FILE = path.join(__dirname, 'webhook_key.txt');
const WEBHOOK_KEY = (() => {
  if (process.env.TIKFINITY_KEY) return process.env.TIKFINITY_KEY;
  try { return fs.readFileSync(WEBHOOK_KEY_FILE, 'utf8').trim(); } catch {}
  const key = require('node:crypto').randomBytes(12).toString('hex');
  try { fs.writeFileSync(WEBHOOK_KEY_FILE, key); } catch {}
  return key;
})();

// Request đi qua tunnel (từ Internet) thay vì từ chính máy này
function isTunneled(req) {
  return Boolean(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['ngrok-trace-id']);
}

// ========================================================
// TIỆN ÍCH CHỮ
// ========================================================

// Bỏ dấu tiếng Việt, chữ thường, gọn khoảng trắng: "Hoa Hồng" -> "hoa hong"
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

// Điền biến {name} {gift}... (thay tất cả, không chỉ lần đầu)
function fill(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clampNum = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// ========================================================
// HÀNH ĐỘNG / NGHI THỨC
// ========================================================
const ACTIONS = ['role', 'groom', 'bride', 'replaceGroom', 'replaceBride', 'cancel', 'quickwed', 'dongphong', 'dance', 'kiss', 'cake',
  'champagne', 'cheers', 'petal', 'ring', 'bouquet', 'fireworks', 'music', 'mc', 'photo', 'thanks'];
const ROLE_ACTIONS = ['role', 'groom', 'bride', 'replaceGroom', 'replaceBride'];
const ROLE_LABEL = { groom: 'chú rể', bride: 'cô dâu' };

// Bộ luật quà mẫu. Tên quà là gợi ý — kiểm tra lại bằng bảng "Quà vừa nhận" khi LIVE thử.
const RULE_PRESETS = {
  // Đấu giá: tặng từ 10 xu để giành vai, ai tặng nhiều hơn thì cướp vai
  auction: [
    { gifts: 'rose, hoa hồng', minCoins: 0, action: 'petal' },
    { gifts: 'finger heart, bắn tim', minCoins: 0, action: 'kiss' },
    { gifts: 'doughnut, bánh vòng', minCoins: 0, action: 'dance' },
    { gifts: 'perfume, nước hoa', minCoins: 0, action: 'champagne' },
    { gifts: 'confetti, pháo giấy', minCoins: 0, action: 'fireworks' },
    { gifts: 'hạc giấy, paper crane', minCoins: 0, action: 'cancel' },
    { gifts: 'hand hearts', minCoins: 0, action: 'dongphong' },
    { gifts: '', minCoins: 10, action: 'role' }
  ],
  // Hàng chờ (kiểu các rạp cưới phổ biến): quà rẻ để vào vai, vai có người thì xếp hàng; quà "thay" để chen lên ngay
  queue: [
    { gifts: 'bé heo hồng, heo, pig', minCoins: 0, action: 'groom' },
    { gifts: 'cỏ bốn lá, cỏ 4 lá, clover', minCoins: 0, action: 'bride' },
    { gifts: 'perfume, nước hoa', minCoins: 0, action: 'replaceGroom' },
    { gifts: 'rosa', minCoins: 0, action: 'replaceBride' },
    { gifts: 'hand hearts', minCoins: 0, action: 'quickwed' },
    { gifts: 'doughnut, bánh vòng', minCoins: 0, action: 'dance' },
    { gifts: 'hạc giấy, paper crane', minCoins: 0, action: 'cancel' },
    { gifts: 'finger heart, bắn tim', minCoins: 0, action: 'bouquet' },
    { gifts: 'confetti, pháo giấy', minCoins: 0, action: 'fireworks' },
    { gifts: 'rose, hoa hồng', minCoins: 0, action: 'petal' },
    { gifts: '', minCoins: 99, action: 'photo' }
  ]
};
const DEFAULT_GIFT_RULES = RULE_PRESETS.auction;

// Từ khóa bình luận kích hoạt nghi thức.
// words: so khớp nguyên từ CÓ DẤU (tránh "hơn" bị hiểu thành "hôn"); phrases: so khớp cụm KHÔNG DẤU.
const COMMENT_RITUALS = [
  { action: 'kiss', words: ['hôn', 'hun', 'thơm', 'kiss'], phrases: ['hon di', 'hun di', 'hon nhau', 'hon co dau'] },
  { action: 'cheers', words: ['dzô', 'dzo', 'zô', 'dô'], phrases: ['cung ly', 'can ly', 'mot hai ba', '1 2 3 do'] },
  { action: 'dance', words: ['nhảy', 'quẩy', 'dance'], phrases: ['nhay di', 'nhay len', 'quay len', 'quay di'] },
  { action: 'cake', words: [], phrases: ['cat banh', 'banh cuoi'] },
  { action: 'champagne', words: ['rượu', 'champagne'], phrases: ['sam panh', 'ruou'] },
  { action: 'petal', words: [], phrases: ['hoa hong', 'mua hoa', 'tung hoa', 'rai hoa'] }
];

function hasWord(text, word) {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'u').test(text);
}

function detectRitual(comment) {
  const lower = String(comment).toLowerCase();
  const n = norm(comment);
  for (const r of COMMENT_RITUALS) {
    if (r.words.some(w => hasWord(lower, w)) || r.phrases.some(p => hasWord(n, p))) return r.action;
  }
  return null;
}

// Chỉ nhận khi khách nói rõ muốn làm ("làm cô dâu", "xin vai cô dâu") hoặc gõ đúng "cô dâu";
// tránh hiểu nhầm lời khen như "cô dâu xinh quá", "chúc cô dâu chú rể..."
// Comment chỉ gồm "nam"/"nữ" -> đổi nhân vật (gõ lại để đổi bộ đồ khác)
function detectGender(comment) {
  const n = norm(comment).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (['nam', 'trai', 'con trai', 'boy'].includes(n)) return 'male';
  if (['nu', 'gai', 'con gai', 'girl'].includes(n)) return 'female';
  return null;
}
const MALE_SPRITES = [0, 1, 2];
const FEMALE_SPRITES = [3, 4, 5];

function detectRoleIntent(comment) {
  const n = norm(comment).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (n === 'co dau' || hasWord(n, 'lam co dau') || hasWord(n, 'vai co dau') || hasWord(n, 'lam vo')) return 'bride';
  if (n === 'chu re' || hasWord(n, 'lam chu re') || hasWord(n, 'vai chu re') || hasWord(n, 'lam chong')) return 'groom';
  return null;
}

// ========================================================
// TRẠNG THÁI MẶC ĐỊNH
// ========================================================
const defaultState = {
  config: {
    groom: 'Tuấn Anh',
    bride: 'Mai Vy',
    title: 'TIỆC CƯỚI ONLINE',
    slogan: 'Trăm Năm Hạnh Phúc',
    date: '2026-11-03',
    showRosePetals: true,
    showHearts: true,
    showFireworks: true,
    showBubbles: true,
    speech: true,
    voice: 'vi-VN-HoaiMyNeural',
    speechMode: 'browser',
    volume: 0.9,
    voicePitch: 1.25,
    voiceRate: 1.08,
    soundEffects: true,
    enableMarryAuction: true,
    minCoinsToMarry: 10,
    roleMode: 'both',          // both | groom | bride : khách được giành vai nào
    autoCeremony: true,        // đủ đôi -> đếm ngược -> làm lễ thành hôn & động phòng
    ceremonyCountdown: 45,     // giây
    commentRituals: true,      // bình luận "hôn", "dzô"... kích hoạt nghi thức
    commentCooldown: 8,        // giây giữa 2 lần cùng nghi thức do bình luận
    roleSystem: 'auction',     // auction = đấu giá | queue = quà vào vai + hàng chờ
    maxGuests: 54,             // 24 = thoáng | 54 = đông khách
    likeGoal: 5000,            // đủ số tim này thì cả rạp đứng dậy quẩy
    photoAfterCeremony: true,  // chụp ảnh cưới sau mỗi lễ
    moneyUnit: 'xu',           // xu | chỉ vàng (cách hiển thị tiền mừng)
    titleDecaySeconds: 30,     // ngừng tương tác bao lâu thì mất danh hiệu
    showMC: true,              // nhân vật MC đứng trên sân khấu
    funnyVoiceEnabled: true,
    giftRules: DEFAULT_GIFT_RULES.map(r => ({ ...r })),
    bgm: {
      enabled: true,
      source: 'file',          // file | youtube | off
      file: '',
      youtubeUrl: '',
      youtubeId: '',
      title: '',
      volume: 50,
      playing: true
    },
    // Giọng MC
    voiceEngine: 'auto',       // auto | browser | google
    browserVoice: '',          // tên giọng của máy (nếu chọn)
    mcIdleEnabled: true,       // MC tự dẫn khi phòng vắng
    mcIdleSeconds: 45,
    mcWelcomeEnabled: true,    // MC chào khách mới vào
    mcWelcomeSeconds: 30,
    mcCaption: true,           // phụ đề lời MC trên màn hình LIVE
    mcLines: defaultMcLines()
  },
  stats: {
    guests: 119,
    outside: 21,
    envelopes: 588,
    wishes: 175,
    couples: 0,
    likes: 0,
    shares: 0,
    follows: 0
  },
  goals: {
    rose: { current: 0, target: 100, label: 'Mưa hoa hồng' },
    cake: { current: 0, target: 1000, label: 'Cắt bánh cưới' }
  },
  people: [
    { id: 'guest-1', name: 'Minh Thư', avatar: '', sprite: 4, table: 0, seat: 0, statusTag: '💍 Xin vía' },
    { id: 'guest-2', name: 'Nhà Đẹp Huy', avatar: '', sprite: 1, table: 12, seat: 0, statusTag: '🍗 Ăn cỗ' },
    { id: 'guest-3', name: 'Jamie', avatar: '', sprite: 2, table: 1, seat: 0, statusTag: '🍻 Cạn ly' },
    { id: 'guest-4', name: 'Linh', avatar: '', sprite: 5, table: 13, seat: 0, statusTag: '💃 Quẩy' },
    { id: 'guest-5', name: 'Em Bông', avatar: '', sprite: 3, table: 2, seat: 0, statusTag: '👀 Hóng biến' },
    { id: 'guest-6', name: 'Quang Nhật', avatar: '', sprite: 0, table: 14, seat: 0, statusTag: '🥂 Cụng ly' }
  ],
  scores: {},
  recentGivers: [],
  recentGifts: [],
  roles: { groom: null, bride: null },
  bids: { groom: {}, bride: {} },
  queue: { groom: [], bride: [] },
  likes: { total: 0, progress: 0 },
  intents: {},
  ceremony: { phase: 'idle', endsAt: 0 },
  marriages: [],
  status: {
    state: 'offline', // 'offline' | 'connecting' | 'waiting' | 'connected' | 'error'
    message: 'Chưa kết nối. Hãy mở TikFinity Desktop trên máy này.',
    username: '',
    roomId: '',
    mode: 'tikfinity'
  }
};

// ========================================================
// NẠP & DI TRÚ TRẠNG THÁI ĐÃ LƯU
// ========================================================
function sanitizeRules(rules) {
  if (!Array.isArray(rules)) return DEFAULT_GIFT_RULES.map(r => ({ ...r }));
  return rules.slice(0, 30).map(r => ({
    gifts: String(r?.gifts ?? '').slice(0, 200),
    minCoins: clampNum(r?.minCoins, 0, 1000000, 0),
    action: ACTIONS.includes(r?.action) ? r.action : 'thanks'
  }));
}

// Thứ tự xếp ghế: 24 ghế gốc (xen kẽ trái/phải), rồi 30 ghế thêm khi bật "đông khách"
const SEAT_ORDER = [
  ...Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? i / 2 : 12 + (i - 1) / 2)),
  ...Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 24 + i / 2 : 39 + (i - 1) / 2))
];
function maxSeats() {
  return Number(state?.config?.maxGuests) === 24 ? 24 : 54;
}

function fixSeats(people, max = maxSeats()) {
  const order = SEAT_ORDER.filter(n => n < max);
  const list = Array.isArray(people) ? people.slice(-max) : [];
  const used = new Set();
  for (const p of list) {
    if (!Number.isInteger(p.table) || p.table < 0 || p.table >= max || used.has(p.table)) p.table = -1;
    else used.add(p.table);
  }
  for (const p of list) {
    if (p.table === -1) {
      p.table = order.find(n => !used.has(n));
      used.add(p.table);
    }
  }
  return list;
}

function sanitizeQueue(list) {
  return Array.isArray(list)
    ? list.filter(x => x && x.id).slice(0, 20).map(x => ({ id: String(x.id), name: String(x.name || 'Khách'), avatar: String(x.avatar || ''), at: Number(x.at) || Date.now() }))
    : [];
}

function loadState() {
  const s = JSON.parse(JSON.stringify(defaultState));
  if (!fs.existsSync(STATE_FILE)) return s;
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const cfgIn = { ...(parsed.config || {}) };
    // Lỗi cũ: bảng điều khiển lưu lồng trong config.config
    if (cfgIn.config && typeof cfgIn.config === 'object') {
      Object.assign(cfgIn, cfgIn.config);
      delete cfgIn.config;
    }
    const goalsIn = cfgIn.goals;
    delete cfgIn.goals;
    for (const k of ['__proto__', 'constructor', 'prototype']) delete cfgIn[k];

    s.config = { ...s.config, ...cfgIn, bgm: { ...s.config.bgm, ...(cfgIn.bgm || {}) } };
    s.config.giftRules = sanitizeRules(cfgIn.giftRules || DEFAULT_GIFT_RULES);
    // Lời thoại MC: bản cũ lưu funnyJokes / thanksTemplate / wishes riêng lẻ
    const mcIn = { ...(cfgIn.mcLines || {}) };
    if (!cfgIn.mcLines) {
      if (Array.isArray(cfgIn.funnyJokes) && cfgIn.funnyJokes.length) mcIn.thanksFunny = cfgIn.funnyJokes;
      if (cfgIn.thanksTemplate) mcIn.thanksPlain = [cfgIn.thanksTemplate];
      if (Array.isArray(cfgIn.wishes) && cfgIn.wishes.length) mcIn.cardWishes = cfgIn.wishes;
    }
    s.config.mcLines = sanitizeMcLines(mcIn);
    for (const k of ['funnyJokes', 'marryJokes', 'brideJokes', 'thanksTemplate', 'wishes']) delete s.config[k];
    if (!cfgIn.voiceEngine) s.config.voiceEngine = cfgIn.speechMode === 'server' ? 'google' : 'auto';
    if (!cfgIn.voiceEngine && Number(cfgIn.voicePitch) === 1.25) s.config.voicePitch = 1; // cao độ cũ (giọng "cute") nghe méo với giọng tự nhiên
    if (!cfgIn.bgm || !cfgIn.bgm.source) {
      // Bản cũ phát nhạc YouTube -> chuyển sang nhạc file trên máy (tránh bản quyền), bỏ tên bài YouTube cũ
      Object.assign(s.config.bgm, { source: 'file', file: '', title: '', playing: true, enabled: true });
    }

    s.stats = { ...s.stats, ...(parsed.stats || {}) };
    s.goals = {
      rose: { ...s.goals.rose, ...(parsed.goals?.rose || {}), ...(goalsIn?.rose || {}) },
      cake: { ...s.goals.cake, ...(parsed.goals?.cake || {}), ...(goalsIn?.cake || {}) }
    };
    // Đơn vị cũ của "cắt bánh" là xu×100
    if (s.goals.cake.target > 20000) {
      s.goals.cake.target = Math.round(s.goals.cake.target / 100);
      s.goals.cake.current = Math.round(s.goals.cake.current / 100);
    }
    s.scores = parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : {};
    s.recentGivers = Array.isArray(parsed.recentGivers) ? parsed.recentGivers.slice(0, 8) : [];
    s.recentGifts = Array.isArray(parsed.recentGifts) ? parsed.recentGifts.slice(0, 30) : [];
    s.marriages = Array.isArray(parsed.marriages) ? parsed.marriages.slice(0, 10) : [];
    s.roles = { groom: parsed.roles?.groom || null, bride: parsed.roles?.bride || null };
    s.bids = { groom: { ...(parsed.bids?.groom || {}) }, bride: { ...(parsed.bids?.bride || {}) } };
    s.intents = parsed.intents && typeof parsed.intents === 'object' ? parsed.intents : {};
    if (Array.isArray(parsed.people)) s.people = parsed.people;
    s.people = fixSeats(s.people, Number(s.config.maxGuests) === 24 ? 24 : 54);
    for (const p of s.people) if (!p.baseTag) p.baseTag = p.statusTag || '✨ Khách quý';
    s.queue = { groom: sanitizeQueue(parsed.queue?.groom), bride: sanitizeQueue(parsed.queue?.bride) };
    s.likes = { total: Number(parsed.likes?.total) || 0, progress: Number(parsed.likes?.progress) || 0 };
    s.ceremony = { phase: 'idle', endsAt: 0 };
    s.status = { ...s.status, state: 'offline', message: 'Chưa kết nối. Hãy mở TikFinity Desktop trên máy này.' };
  } catch (e) {
    console.error('Error loading wedding state, using default:', e.message);
  }
  return s;
}

let state = loadState();

// Ghi file gộp (tránh ghi đĩa liên tục khi LIVE đông)
let persistTimer = null;
function persistState() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 400);
}
function persistNow() {
  clearTimeout(persistTimer);
  persistTimer = null;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist wedding state:', e.message);
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { persistNow(); process.exit(0); });
}

// ========================================================
// REALTIME (SSE)
// ========================================================
const clients = new Set();
const overlayClients = new Set(); // màn hình LIVE thật (OBS/trình duyệt), không tính khung xem trước
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (e) {
      clients.delete(client);
    }
  }
}

// Trạng thái gửi cho trình duyệt: bỏ dữ liệu nội bộ, cắt bớt danh sách dài
function publicState() {
  const topScores = Object.values(state.scores).sort((a, b) => b.total - a.total).slice(0, 50);
  const c = state.ceremony;
  return {
    config: state.config,
    stats: state.stats,
    goals: state.goals,
    people: state.people,
    scores: Object.fromEntries(topScores.map(s => [s.id, s])),
    recentGivers: state.recentGivers,
    recentGifts: state.recentGifts,
    roles: state.roles,
    queue: {
      groom: state.queue.groom.slice(0, 5).map(q => ({ name: q.name, avatar: q.avatar })),
      bride: state.queue.bride.slice(0, 5).map(q => ({ name: q.name, avatar: q.avatar })),
      groomCount: state.queue.groom.length,
      brideCount: state.queue.bride.length
    },
    likes: { total: state.likes.total, progress: state.likes.progress, goal: clampNum(state.config.likeGoal, 100, 10000000, 5000) },
    coupleNumber: (state.stats.couples || 0) + 1,
    marriages: state.marriages,
    ceremony: { phase: c.phase, remainingMs: c.phase === 'countdown' ? Math.max(0, c.endsAt - Date.now()) : 0 },
    status: state.status
  };
}

let stateTimer = null;
function broadcastState() {
  if (stateTimer) return;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    refreshTags();
    broadcast('state', publicState());
  }, 120);
}

// Giữ kết nối SSE sống
setInterval(() => {
  for (const client of clients) {
    try { client.write(': ping\n\n'); } catch { clients.delete(client); }
  }
}, 25000);

// ========================================================
// KHÁCH DỰ TIỆC (TỐI ĐA 24 GHẾ)
// ========================================================
function holderIds() {
  return new Set([state.roles.groom?.id, state.roles.bride?.id].filter(Boolean).map(id => 'tik-' + id));
}

// Người đã từng vào phòng trong phiên này (để bộ đếm "khách" không đếm trùng người quay lại sau khi nhường ghế)
const seenGuests = new Set(state.people.map(p => p.id));

function upsertPerson(user, baseTag) {
  const id = 'tik-' + user.id;
  let p = state.people.find(x => x.id === id);
  if (p) {
    if (user.name) p.name = user.name;
    if (user.avatar) p.avatar = user.avatar;
    if (baseTag) p.baseTag = baseTag;
    p.lastSeen = Date.now();
    return p;
  }
  const used = new Set(state.people.map(x => x.table));
  let seat = SEAT_ORDER.filter(n => n < maxSeats()).find(n => !used.has(n));
  if (seat === undefined) {
    // Hết ghế: mời khách lâu nhất không tương tác ra về (giữ lại cô dâu/chú rể)
    const keep = holderIds();
    const victim = state.people
      .filter(x => !keep.has(x.id))
      .sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0))[0] || state.people[0];
    seat = victim.table;
    state.people = state.people.filter(x => x !== victim);
  }
  const gender = user.gender === 'male' ? MALE_SPRITES : user.gender === 'female' ? FEMALE_SPRITES : null;
  p = {
    id,
    name: user.name || 'Khách Quý',
    avatar: user.avatar || '',
    sprite: gender ? pick(gender) : Math.floor(Math.random() * 6),
    table: seat,
    seat: 0,
    baseTag: baseTag || '✨ Khách quý',
    statusTag: baseTag || '✨ Khách quý',
    lastSeen: Date.now()
  };
  state.people.push(p);
  if (!seenGuests.has(id)) {
    seenGuests.add(id);
    if (seenGuests.size > 50000) seenGuests.delete(seenGuests.values().next().value);
    state.stats.guests++;
  }
  return p;
}

// Đổi nhân vật nam/nữ; gõ lại cùng giới tính -> bộ đồ khác
function switchGender(p, gender) {
  const list = gender === 'male' ? MALE_SPRITES : FEMALE_SPRITES;
  const idx = list.indexOf(p.sprite);
  p.sprite = idx >= 0 ? list[(idx + 1) % list.length] : pick(list);
  return p.sprite;
}

// ========================================================
// DANH HIỆU KHÁCH (tương tác liên tục để lên hạng, ngừng lâu là mất)
// ========================================================
const engagement = new Map(); // userId -> { name, streak, lastAt, total, dance }
const TIER_TAGS = ['', '🔥 Khách nhiệt tình', '💖 Khách ruột'];
let specialHolders = { star: null, dance: null };

function decayMs() {
  return clampNum(state.config.titleDecaySeconds, 10, 600, 30) * 1000;
}
function tierOf(e, now = Date.now()) {
  if (!e || now - e.lastAt > decayMs()) return 0;
  return e.streak >= 12 ? 2 : e.streak >= 5 ? 1 : 0;
}

function bump(user, kind = 'chat', { dance = false } = {}) {
  if (!user || !user.id) return;
  const key = String(user.id);
  const now = Date.now();
  const e = engagement.get(key) || { name: user.name, streak: 0, lastAt: 0, total: 0, dance: 0 };
  const before = tierOf(e, now);
  if (now - e.lastAt > decayMs()) e.streak = 0;
  const weight = kind === 'gift' ? 3 : kind === 'share' ? 2 : 1;
  e.streak += weight;
  e.total += weight;
  if (dance) e.dance++;
  e.lastAt = now;
  e.name = user.name || e.name;
  engagement.delete(key);
  engagement.set(key, e);
  if (engagement.size > 1000) engagement.delete(engagement.keys().next().value);
  const after = tierOf(e, now);
  if (after > before && state.people.some(p => p.id === 'tik-' + key)) {
    broadcast('activity', { type: 'title', id: 'tik-' + key, name: e.name, title: TIER_TAGS[after] });
  }
}

// Tính lại nhãn dưới tên khách: vai > danh hiệu đặc biệt > hạng tương tác > nhãn sự kiện
function refreshTags() {
  const now = Date.now();
  let star = null;
  let dancer = null;
  for (const [k, e] of engagement) {
    if (e.total >= 10 && (!star || e.total > star.e.total)) star = { k, e };
    if (e.dance >= 3 && (!dancer || e.dance > dancer.e.dance)) dancer = { k, e };
  }
  for (const [slot, holder, title] of [['star', star, '🌟 Siêu sao rạp cưới'], ['dance', dancer, '💃 Trùm quẩy']]) {
    if (holder && specialHolders[slot] !== holder.k && state.people.some(p => p.id === 'tik-' + holder.k)) {
      broadcast('activity', { type: 'title', id: 'tik-' + holder.k, name: holder.e.name, title });
    }
    specialHolders[slot] = holder ? holder.k : null;
  }
  let changed = false;
  for (const p of state.people) {
    const k = p.id.replace(/^tik-/, '');
    let tag;
    if (state.roles.groom?.id === k) tag = '🤵 Chú rể';
    else if (state.roles.bride?.id === k) tag = '👰 Cô dâu';
    else if (star?.k === k) tag = '🌟 Siêu sao rạp cưới';
    else if (dancer?.k === k) tag = '💃 Trùm quẩy';
    else {
      const t = tierOf(engagement.get(k), now);
      tag = t ? TIER_TAGS[t] : (p.baseTag || '✨ Khách quý');
    }
    if (p.statusTag !== tag) {
      p.statusTag = tag;
      changed = true;
    }
  }
  return changed;
}
setInterval(() => { if (refreshTags()) broadcastState(); }, 3000);

// ========================================================
// VAI CÔ DÂU / CHÚ RỂ + ĐẤU GIÁ
// ========================================================
function openRoles() {
  const m = state.config.roleMode;
  return m === 'groom' ? ['groom'] : m === 'bride' ? ['bride'] : ['groom', 'bride'];
}
function minCoins() {
  return Math.max(1, Number(state.config.minCoinsToMarry) || 10);
}
function displayName(role) {
  return state.roles[role]?.name || state.config[role] || (role === 'groom' ? 'Chú rể' : 'Cô dâu');
}
function coupleInfo() {
  return {
    groom: displayName('groom'),
    bride: displayName('bride'),
    groomAvatar: state.roles.groom?.avatar || '',
    brideAvatar: state.roles.bride?.avatar || ''
  };
}

function applyRoleBid(user, role, coins) {
  const key = String(user.id);
  const other = role === 'groom' ? 'bride' : 'groom';
  // Đang giữ vai kia -> quà dùng để giữ ngôi hiện tại (không cho 1 người giữ 2 vai)
  if (state.roles[other]?.id === key) role = other;

  const bids = state.bids[role] || (state.bids[role] = {});
  bids[key] = (bids[key] || 0) + coins;
  const bid = bids[key];
  const holder = state.roles[role];

  if (holder && holder.id === key) {
    holder.bid = bid;
    holder.name = user.name || holder.name;
    if (user.avatar) holder.avatar = user.avatar;
    return { role, defended: true, became: false, bid };
  }
  const needed = holder ? Math.max(minCoins(), holder.bid + 1) : minCoins();
  if (bid >= needed) {
    const previous = holder ? holder.name : '';
    state.roles[role] = { id: key, name: user.name || 'Khách', avatar: user.avatar || '', bid, at: Date.now() };
    removeFromQueues(key);
    return { role, became: true, previous, bid };
  }
  return { role, became: false, bid, needed, missing: needed - bid, holder: holder?.name || '' };
}

const isQueue = () => state.config.roleSystem === 'queue';

function setRole(role, user, bid) {
  state.roles[role] = { id: String(user.id), name: user.name || 'Khách', avatar: user.avatar || '', bid: Number(bid) || 0, at: Date.now() };
  removeFromQueues(String(user.id));
}

function removeFromQueues(key) {
  for (const r of ['groom', 'bride']) state.queue[r] = state.queue[r].filter(q => q.id !== key);
}

function queueJoin(user, role) {
  const key = String(user.id);
  const q = state.queue[role];
  const holder = state.roles[role]?.name || '';
  const idx = q.findIndex(x => x.id === key);
  if (idx >= 0) return { role, queueAlready: true, position: idx + 1, holder };
  if (q.length >= 20) return { role, queueFull: true, holder };
  q.push({ id: key, name: user.name || 'Khách', avatar: user.avatar || '', at: Date.now() });
  return { role, queueJoined: true, position: q.length, holder };
}

// Chế độ hàng chờ: vai trống -> nhận ngay; vai có người -> xếp hàng
function applyRoleQueue(user, role, coins) {
  const key = String(user.id);
  const other = role === 'groom' ? 'bride' : 'groom';
  if (state.roles[role]?.id === key) return { role, holderSelf: true };
  if (state.roles[other]?.id === key) return { role: other, holderSelf: true };
  if (!state.roles[role] && !state.queue[role].length) {
    setRole(role, user, coins);
    return { role, became: true, previous: '', bid: coins };
  }
  if (!state.roles[role]) schedulePromotion(2500);
  return queueJoin(user, role);
}

// Đưa người đầu hàng chờ lên vai sau một lúc (để cảnh phá đám/mở vai diễn xong trước)
let promotionTimer = null;
function schedulePromotion(delayMs) {
  if (!isQueue()) return;
  clearTimeout(promotionTimer);
  promotionTimer = setTimeout(() => {
    if (state.ceremony.phase === 'running') return;
    const promoted = promoteQueue();
    if (promoted.length) {
      announcePromoted(promoted);
      persistState();
      broadcastState();
    }
  }, delayMs);
}

// Quà "thay chú rể / thay cô dâu": lên vai ngay, người cũ xuống
function replaceRole(user, role, coins) {
  const key = String(user.id);
  const other = role === 'groom' ? 'bride' : 'groom';
  const holder = state.roles[role];
  if (holder?.id === key) return { role, holderSelf: true };
  if (state.roles[other]?.id === key) return { role: other, holderSelf: true };
  let bid = coins;
  if (!isQueue()) {
    bid = Math.max((state.bids[role]?.[key] || 0) + coins, holder ? holder.bid + 1 : minCoins());
    state.bids[role][key] = bid;
  }
  setRole(role, user, bid);
  return { role, became: true, replaced: Boolean(holder), previous: holder?.name || '', bid };
}

// Sau lễ / sau khi bị phá đám: người đứng đầu hàng chờ lên vai
function promoteQueue() {
  const promoted = [];
  for (const role of openRoles()) {
    if (state.roles[role]) continue;
    const other = role === 'groom' ? 'bride' : 'groom';
    while (state.queue[role].length) {
      const next = state.queue[role].shift();
      if (state.roles[other]?.id === next.id) continue;
      setRole(role, next, 0);
      promoted.push({ role, ...next });
      break;
    }
  }
  return promoted;
}

function announcePromoted(list) {
  for (const p of list) {
    broadcast('action', {
      action: 'role_change', role: p.role, name: p.name, avatar: p.avatar || '', bid: 0, fromQueue: true,
      line: pickLine('queuePromoted', { ...baseVars(), name: p.name, role: ROLE_LABEL[p.role] })
    });
  }
  if (list.length) evaluateCeremony(true);
}

// ========================================================
// LỄ THÀNH HÔN TỰ ĐỘNG
// ========================================================
let ceremonyTimer = null;
const pendingRoleGifts = [];

function evaluateCeremony(roleChanged = false) {
  const c = state.ceremony;
  if (c.phase === 'running') return;
  const allHeld = openRoles().every(r => state.roles[r]);
  if (!state.config.autoCeremony || !allHeld) {
    if (c.phase === 'countdown') {
      clearTimeout(ceremonyTimer);
      state.ceremony = { phase: 'idle', endsAt: 0 };
      broadcastState();
    }
    return;
  }
  if (c.phase === 'idle') {
    const secs = clampNum(state.config.ceremonyCountdown, 5, 600, 45);
    state.ceremony = { phase: 'countdown', endsAt: Date.now() + secs * 1000 };
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(() => startCeremony(), secs * 1000);
    broadcastState();
    mcSay(pickLine('countdownStart', { ...baseVars(), seconds: secs }), 'event');
  } else if (roleChanged && c.endsAt - Date.now() < 10000) {
    // Cướp vai phút chót -> gia hạn thêm 10 giây cho kịch tính
    c.endsAt = Date.now() + 10000;
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(() => startCeremony(), 10000);
    broadcastState();
  }
}

function startCeremony({ quick = false, initiator = '' } = {}) {
  clearTimeout(ceremonyTimer);
  if (state.ceremony.phase === 'running') return false;
  const ms = quick ? CEREMONY_QUICK_MS : CEREMONY_MS;
  state.ceremony = { phase: 'running', endsAt: Date.now() + ms, quick };
  const v = { ...baseVars(), name: initiator || 'MC' };
  const keys = quick
    ? ['quickwed', 'dongphong', 'dongphongEnd', 'ceremonyEnd']
    : ['ceremonyStart', 'ring', 'kiss', 'cake', 'champagne', 'dongphong', 'dongphongEnd', 'ceremonyEnd'];
  const lines = {};
  for (const k of keys) lines[k] = pickLine(k, v);
  if (quick) lines.ceremonyStart = lines.quickwed;
  broadcast('action', { action: 'ceremony', quick, initiator, ...coupleInfo(), lines });
  markMc();
  broadcastState();
  ceremonyTimer = setTimeout(finishCeremony, ms);
  return true;
}

function resetRoles(tag = '💍 Đã thành đôi') {
  for (const r of ['groom', 'bride']) {
    const h = state.roles[r];
    const p = h && state.people.find(x => x.id === 'tik-' + h.id);
    if (p) p.baseTag = tag;
  }
  state.roles = { groom: null, bride: null };
  state.bids = { groom: {}, bride: {} };
}

// Hủy hôn / phá đám: cặp đôi hiện tại xuống sân khấu (không tính là thành hôn)
function cancelWedding() {
  if (state.ceremony.phase === 'running') return { blocked: true };
  const couple = coupleInfo();
  const had = ['groom', 'bride'].some(r => state.roles[r]);
  clearTimeout(ceremonyTimer);
  resetRoles('💔 Bị phá đám');
  state.ceremony = { phase: 'idle', endsAt: 0 };
  return { blocked: false, had, couple };
}

function finishCeremony() {
  clearTimeout(ceremonyTimer);
  const couple = coupleInfo();
  state.stats.couples = (state.stats.couples || 0) + 1;
  state.marriages = [{ groom: couple.groom, bride: couple.bride, at: Date.now() }, ...state.marriages].slice(0, 10);
  const photo = state.config.photoAfterCeremony !== false ? makePhoto('wedding') : null;
  resetRoles();
  state.ceremony = { phase: 'idle', endsAt: 0 };
  broadcast('action', { action: 'roles_open' });
  if (photo) broadcast('photo', photo);
  if (isQueue()) announcePromoted(promoteQueue());

  // Quà giành vai gửi trong lúc làm lễ (chế độ đấu giá) -> áp dụng cho lượt mới
  for (const g of pendingRoleGifts.splice(0)) {
    const r = applyRoleBid(g.user, g.role, g.coins);
    if (r.became) {
      broadcast('action', {
        action: 'role_change', role: r.role, name: g.user.name, avatar: g.user.avatar || '', bid: r.bid,
        line: pickLine('queuedApplied', { ...baseVars(), name: g.user.name, role: ROLE_LABEL[r.role] })
      });
    }
  }
  persistState();
  broadcastState();
  evaluateCeremony();
}

// ========================================================
// LUẬT QUÀ -> NGHI THỨC
// ========================================================
function matchRule(giftName, giftId, coins) {
  const gn = norm(giftName);
  for (const rule of state.config.giftRules || []) {
    if (coins < (Number(rule.minCoins) || 0)) continue;
    const tokens = String(rule.gifts || '').split(',').map(t => norm(t)).filter(Boolean);
    const ruleRole = { groom: 'groom', bride: 'bride', replaceGroom: 'groom', replaceBride: 'bride' }[rule.action];
    if (ruleRole && !openRoles().includes(ruleRole)) continue;
    if (!tokens.length) return rule;
    const hit = tokens.some(t => {
      if (t.startsWith('#')) return String(giftId) === t.slice(1);
      return gn === t || (t.length >= 3 && gn.includes(t));
    });
    if (hit) return rule;
  }
  return null;
}

function goalAdd(kind, amount) {
  const g = state.goals[kind];
  if (!g || !(g.target > 0) || !(amount > 0)) return;
  g.current += amount;
  if (g.current >= g.target) {
    g.current = g.current % g.target;
    broadcast('action', { action: kind === 'rose' ? 'petal' : 'cake', initiator: 'Cả hôn trường', goal: true, line: pickLine(kind === 'rose' ? 'goalRose' : 'goalCake', baseVars()) });
  }
}

// ========================================================
// MC: CHỌN CÂU LUÂN PHIÊN + TỰ DẪN CHƯƠNG TRÌNH
// ========================================================
const mcRotation = {};

// Lấy 1 câu trong nhóm, luân phiên ngẫu nhiên, không lặp câu vừa đọc. Nhóm rỗng -> '' (MC im lặng)
function pickLine(key, vars = {}) {
  const lines = (state.config.mcLines?.[key] || []).filter(Boolean);
  if (!lines.length) return '';
  let r = mcRotation[key];
  if (!r || r.size !== lines.length || r.pos >= r.order.length) {
    const order = lines.map((_, i) => i).sort(() => Math.random() - 0.5);
    if (r && order.length > 1 && order[0] === r.last) order.push(order.shift());
    r = mcRotation[key] = { order, pos: 0, size: lines.length, last: r?.last };
  }
  const idx = r.order[r.pos++];
  r.last = idx;
  return fill(lines[idx], vars).replace(/\{\w+\}/g, '').replace(/\s+/g, ' ').trim();
}

const ACTION_VERB = {
  petal: 'mưa hoa hồng', kiss: 'cô dâu chú rể hôn nhau', dance: 'lên sàn nhảy', cake: 'cắt bánh cưới',
  champagne: 'rót rượu sâm panh', cheers: 'cụng ly cả hôn trường', ring: 'trao nhẫn cưới',
  dongphong: 'tiễn cô dâu chú rể vào động phòng', groom: 'làm chú rể', bride: 'làm cô dâu'
};

// "Rose để mưa hoa hồng, Finger Heart để cô dâu chú rể hôn nhau, ..."
function giftsSummary() {
  const parts = (state.config.giftRules || [])
    .filter(r => ACTION_VERB[r.action] && String(r.gifts || '').trim())
    .slice(0, 3)
    .map(r => {
      const first = String(r.gifts).split(',').map(x => x.trim()).find(x => x && !x.startsWith('#')) || 'quà';
      return `${first.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())} để ${ACTION_VERB[r.action]}`;
    });
  return parts.length ? parts.join(', ') : 'quà bất kỳ để chung vui cùng cô dâu chú rể';
}

function baseVars() {
  return {
    groom: displayName('groom'),
    bride: displayName('bride'),
    groomBid: state.roles.groom?.bid || 0,
    brideBid: state.roles.bride?.bid || 0,
    min: minCoins(),
    title: state.config.title || 'tiệc cưới',
    gifts: giftsSummary()
  };
}

let lastMcAt = Date.now();
function markMc() { lastMcAt = Date.now(); }

// Gửi 1 câu MC tới màn hình LIVE (đọc + phụ đề)
function mcSay(text, kind = 'event') {
  if (!text) return;
  broadcast('mc', { text, kind });
  markMc();
}

const GIFT_LINE_KEY = {
  petal: 'giftPetal', kiss: 'giftKiss', dance: 'giftDance', cake: 'giftCake',
  champagne: 'giftChampagne', cheers: 'giftCheers', ring: 'giftRing', dongphong: 'giftDongphong',
  bouquet: 'bouquet', fireworks: 'fireworks', music: 'musicChange', mc: 'marryMC', photo: 'photo', cancel: 'cancel'
};

function buildMessage(action, g, roleResult, extra = {}) {
  const vars = { ...baseVars(), name: g.name, gift: g.gift, count: g.count, coins: g.coins, ...extra };
  if (action === 'role' && roleResult) {
    const role = roleResult.role;
    const roleLabel = ROLE_LABEL[role];
    if (roleResult.queued) return pickLine('queued', { ...vars, role: roleLabel });
    if (roleResult.queueJoined) return pickLine('queueJoined', { ...vars, role: roleLabel, position: roleResult.position, holder: roleResult.holder || 'cặp đôi hiện tại' });
    if (roleResult.queueAlready) return pickLine('queueAlready', { ...vars, role: roleLabel, position: roleResult.position });
    if (roleResult.queueFull || roleResult.holderSelf) return pickLine(state.config.funnyVoiceEnabled !== false ? 'thanksFunny' : 'thanksPlain', vars);
    if (roleResult.became) {
      const key = roleResult.replaced ? (role === 'groom' ? 'groomReplaced' : 'brideReplaced')
        : roleResult.previous ? (role === 'groom' ? 'groomStolen' : 'brideStolen') : (role === 'groom' ? 'groomTaken' : 'brideTaken');
      return pickLine(key, { ...vars, previous: roleResult.previous, bid: roleResult.bid });
    }
    if (roleResult.defended) return pickLine('bidDefended', { ...vars, role: roleLabel, bid: roleResult.bid });
    return pickLine('bidMissing', { ...vars, role: roleLabel, bid: roleResult.bid, missing: roleResult.missing, holder: roleResult.holder || 'người giữ ngôi' });
  }
  if (GIFT_LINE_KEY[action]) return pickLine(GIFT_LINE_KEY[action], vars);
  return pickLine(state.config.funnyVoiceEnabled !== false ? 'thanksFunny' : 'thanksPlain', vars);
}

// MC tự nói khi phòng vắng: mời giành vai trống, nhắc giờ làm lễ, giới thiệu cách chơi
let idleCount = 0;
function idleLine() {
  const v = baseVars();
  idleCount++;
  if (state.config.enableMarryAuction === false || idleCount % 3 === 0) return pickLine('intro', v);
  const open = openRoles();
  const empty = open.filter(r => !state.roles[r]);
  if (empty.length) {
    const role = empty.length > 1 ? empty[idleCount % 2] : empty[0];
    return pickLine(role === 'groom' ? 'waitGroom' : 'waitBride', v);
  }
  if (state.ceremony.phase === 'countdown') {
    const secs = Math.ceil((state.ceremony.endsAt - Date.now()) / 1000);
    return secs >= 10 ? pickLine('countdownRemind', { ...v, seconds: secs }) : '';
  }
  return isQueue() ? pickLine('intro', v) : pickLine('challenge', v);
}

const pendingJoins = [];
let lastWelcomeAt = 0;
function noteJoin(name) {
  if (state.config.mcWelcomeEnabled === false || !name) return;
  if (!pendingJoins.includes(name)) pendingJoins.push(name);
  if (pendingJoins.length > 10) pendingJoins.shift();
}

const pendingSocial = { share: [], follow: [] };
let lastSocialAt = 0;
function noteSocial(kind, name) {
  const list = pendingSocial[kind];
  if (!list || !name) return;
  if (!list.includes(name)) list.push(name);
  if (list.length > 10) list.shift();
}

function joinNames(list) {
  const names = list.slice(-3);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} và ${names.at(-1)}` : names[0];
}

setInterval(() => {
  const c = state.config;
  if (c.speech === false || !overlayClients.size || state.ceremony.phase === 'running') return;
  const now = Date.now();
  // Chào khách mới (gộp tên, không chen ngang câu MC vừa đọc)
  if (c.mcWelcomeEnabled !== false && pendingJoins.length && now - lastWelcomeAt >= clampNum(c.mcWelcomeSeconds, 5, 600, 30) * 1000 && now - lastMcAt > 7000) {
    const text = pickLine('welcome', { ...baseVars(), names: joinNames(pendingJoins) });
    pendingJoins.length = 0;
    lastWelcomeAt = now;
    if (text) return mcSay(text, 'welcome');
  }
  // Cảm ơn chia sẻ / theo dõi
  for (const kind of ['share', 'follow']) {
    if (pendingSocial[kind].length && now - lastSocialAt >= 8000 && now - lastMcAt > 5000) {
      const text = pickLine(kind, { ...baseVars(), names: joinNames(pendingSocial[kind]) });
      pendingSocial[kind].length = 0;
      lastSocialAt = now;
      if (text) return mcSay(text, 'social');
    }
  }
  // Tự dẫn khi vắng
  if (c.mcIdleEnabled !== false && now - lastMcAt >= clampNum(c.mcIdleSeconds, 15, 600, 45) * 1000) {
    const text = idleLine();
    if (text) mcSay(text, 'idle');
    else markMc();
  }
}, 4000);

// ========================================================
// ẢNH CƯỚI, TUNG HOA, ĐỔI NHẠC
// ========================================================
let photoSeq = 0;
const pad2 = n => String(n).padStart(2, '0');

// kind: wedding (sau lễ) | couple (bấm nút) | group (khách tặng quà chụp ảnh chung)
function makePhoto(kind = 'couple', giver = null) {
  const number = kind === 'wedding' ? (state.stats.couples || 0) : (state.stats.couples || 0) + 1;
  const v = { ...baseVars(), number, name: giver?.name || '' };
  const exclude = new Set([...holderIds(), giver ? 'tik-' + giver.id : '']);
  const guests = state.people
    .filter(p => !exclude.has(p.id))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    .slice(0, 8)
    .map(p => ({ name: p.name, avatar: p.avatar || '' }));
  const d = new Date();
  return {
    id: `${Date.now().toString(36)}-${++photoSeq}`,
    kind,
    number,
    ...coupleInfo(),
    giver: giver ? { name: giver.name, avatar: giver.avatar || '' } : null,
    date: `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`,
    likes: state.likes.total || 0,
    caption: pickLine(giver ? 'photoGiftCaption' : 'photoCaption', v),
    hashtags: ['#HappyWedding', `#CapDoiSo${number}`, '#TramNamHanhPhuc'],
    line: pickLine('photo', v),
    guests,
    title: state.config.title || 'TIỆC CƯỚI ONLINE'
  };
}

function pickBouquetCatcher(excludeKey) {
  const keep = holderIds();
  const pool = state.people.filter(p => !keep.has(p.id) && p.id !== 'tik-' + excludeKey);
  const c = pool.length ? pick(pool) : null;
  if (!c) return null;
  c.baseTag = '💐 Bắt được hoa';
  return { id: c.id, name: c.name, avatar: c.avatar || '' };
}

// Chuyển sang bài kế tiếp trong thư mục nhạc
function nextTrack() {
  const b = state.config.bgm;
  if (!b || b.source === 'youtube') return null;
  const files = listMusic();
  if (!files.length) return null;
  const idx = files.findIndex(f => f.name === b.file);
  const next = files[(idx + 1) % files.length];
  Object.assign(b, { source: 'file', file: next.name, playing: true, enabled: true, title: '' });
  broadcast('bgm', b);
  persistState();
  return next.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ');
}

// ========================================================
// XỬ LÝ SỰ KIỆN (TikFinity Desktop, Webhook, Demo)
// ========================================================
function processJoinEvent(user) {
  if (!user || !user.id || user.id === 'unknown') return;
  const p = upsertPerson(user, null);
  noteJoin(p.name);
  broadcast('activity', { type: 'join', id: p.id, name: p.name, avatar: p.avatar });
  persistState();
  broadcastState();
}

function processLikeEvent(ev) {
  const count = Math.max(1, Math.min(100000, Number(ev?.count) || 1));
  state.likes.total = Math.max(state.likes.total + count, Number(ev?.total) || 0);
  state.likes.progress += count;
  state.stats.likes = state.likes.total;
  if (ev?.id && ev.id !== 'unknown') {
    upsertPerson({ id: ev.id, name: ev.name || 'Khách', avatar: ev.avatar }, null);
    bump({ id: ev.id, name: ev.name }, 'like');
  }
  const goal = clampNum(state.config.likeGoal, 100, 10000000, 5000);
  if (state.likes.progress >= goal) {
    state.likes.progress %= goal;
    broadcast('action', { action: 'dance', initiator: 'Cả rạp', big: true, likeGoal: goal, line: pickLine('likeGoal', { ...baseVars(), likes: goal }) });
    markMc();
  }
  persistState();
  broadcastState();
}

function processSocialEvent(kind, user) {
  if (!['share', 'follow'].includes(kind) || !user?.id || user.id === 'unknown') return;
  const p = upsertPerson(user, null);
  bump(user, 'share');
  const statKey = kind === 'share' ? 'shares' : 'follows';
  state.stats[statKey] = (state.stats[statKey] || 0) + 1;
  broadcast('activity', { type: kind, id: p.id, name: p.name, avatar: p.avatar });
  noteSocial(kind, p.name);
  persistState();
  broadcastState();
}

const lastCommentRitual = {};
let lastAnyCommentRitual = 0;

function processChatEvent(chat) {
  if (!chat || !chat.id || chat.id === 'unknown') return;
  const comment = String(chat.comment || '').trim().slice(0, 300);
  if (!comment) return;
  const gender = detectGender(comment);
  const user = { id: chat.id, name: chat.name || 'Khách Mời', avatar: chat.avatar, gender };
  const existed = state.people.some(x => x.id === 'tik-' + chat.id);
  const p = upsertPerson(user, null);
  if (gender && existed) switchGender(p, gender);
  state.stats.wishes++;
  const ritual = detectRitual(comment);
  bump(user, 'chat', { dance: ritual === 'dance' });

  const intent = detectRoleIntent(comment);
  if (intent) {
    state.intents[String(chat.id)] = intent;
    const keys = Object.keys(state.intents);
    if (keys.length > 1000) delete state.intents[keys[0]];
  }

  let triggeredAction = null;
  if (state.config.commentRituals !== false && state.ceremony.phase !== 'running') {
    const a = ritual;
    const now = Date.now();
    const cd = clampNum(state.config.commentCooldown, 0, 300, 8) * 1000;
    if (a && now - (lastCommentRitual[a] || 0) >= cd && now - lastAnyCommentRitual >= 2500) {
      triggeredAction = a;
      lastCommentRitual[a] = now;
      lastAnyCommentRitual = now;
    }
  }

  broadcast('activity', { type: 'chat', id: p.id, name: p.name, comment, avatar: p.avatar, triggeredAction, intent, gender });
  if (triggeredAction) broadcast('action', { action: triggeredAction, initiator: p.name });
  persistState();
  broadcastState();
}

function processGiftEvent(g) {
  if (!g || !g.id || g.id === 'unknown') return null;
  const key = String(g.id);
  const name = String(g.name || 'Người Tặng').slice(0, 60);
  const gift = String(g.gift || 'Mừng Cưới').slice(0, 60);
  const count = Math.max(1, Number(g.count) || 1);
  const diamonds = Math.max(1, Number(g.diamonds) || 1);
  const coins = count * diamonds;
  const avatar = String(g.avatar || '');
  const user = { id: key, name, avatar };

  const p = upsertPerson(user, '👑 Đại gia');
  state.stats.envelopes += count;

  const sid = 'tik-' + key;
  if (!state.scores[sid]) state.scores[sid] = { id: sid, name, total: 0, avatar };
  state.scores[sid].total += coins;
  state.scores[sid].name = name;
  if (avatar) state.scores[sid].avatar = avatar;

  state.recentGivers = [{ id: sid, name, gift, count, diamonds, total: coins }, ...state.recentGivers.filter(x => x.id !== sid)].slice(0, 8);

  const rule = matchRule(gift, g.giftId, coins);
  let action = rule ? rule.action : 'thanks';
  let roleResult = null;
  const extra = {};
  let special = {};
  let skipFocus = false;
  let promotedAfter = false;
  let blockedLine = '';

  bump(user, 'gift', { dance: action === 'dance' });

  // Đấu giá: người đang đấu giá/giữ vai tặng quà lẻ (không gán nghi thức) cũng được cộng dồn vào giá
  let topUpRole = null;
  if (action === 'thanks' && !isQueue() && state.config.enableMarryAuction !== false) {
    topUpRole = openRoles().find(r => state.roles[r]?.id === key) || openRoles().find(r => (state.bids[r]?.[key] || 0) > 0) || null;
    if (topUpRole) action = 'role';
  }

  if (ROLE_ACTIONS.includes(action)) {
    if (state.config.enableMarryAuction === false) {
      action = 'thanks';
    } else {
      const replace = action === 'replaceGroom' || action === 'replaceBride';
      let role = topUpRole || (action === 'role'
        ? (state.intents[key] || openRoles()[0])
        : { groom: 'groom', bride: 'bride', replaceGroom: 'groom', replaceBride: 'bride' }[action]);
      if (!openRoles().includes(role)) role = openRoles()[0];
      if (state.ceremony.phase === 'running') {
        if (isQueue()) {
          roleResult = queueJoin(user, role);
        } else {
          pendingRoleGifts.push({ user, role, coins });
          roleResult = { role, queued: true };
        }
      } else if (replace) {
        roleResult = replaceRole(user, role, coins);
      } else {
        roleResult = isQueue() ? applyRoleQueue(user, role, coins) : applyRoleBid(user, role, coins);
      }
      action = 'role';
    }
  } else if (action === 'cancel') {
    const r = cancelWedding();
    if (r.blocked || !r.had) {
      blockedLine = r.blocked ? pickLine('cancelBlocked', { ...baseVars(), name }) : '';
      action = 'thanks';
    } else {
      special = { cancel: r.couple };
      extra.groom = r.couple.groom;
      extra.bride = r.couple.bride;
      promotedAfter = true;
    }
  } else if (action === 'bouquet') {
    const c = pickBouquetCatcher(key);
    special = { catcher: c };
    extra.catcher = c ? c.name : 'một vị khách may mắn';
  } else if (action === 'music') {
    const track = nextTrack();
    if (track) {
      special = { track };
      extra.track = track;
    } else {
      action = 'thanks';
    }
  } else if (action === 'quickwed') {
    if (state.ceremony.phase === 'running') action = 'thanks';
    else skipFocus = startCeremony({ quick: true, initiator: name });
  } else if (action === 'photo') {
    special = { photo: makePhoto('group', user) };
  }

  state.recentGifts = [{ name, gift, giftId: String(g.giftId || ''), count, coins, action, at: Date.now() }, ...state.recentGifts].slice(0, 30);

  if (action === 'petal' || /\b(rose|hoa hong)\b/.test(norm(gift))) goalAdd('rose', count);
  goalAdd('cake', coins);

  const offeringEvent = {
    id: sid,
    name,
    avatar,
    sprite: p.sprite,
    gift,
    count,
    diamonds,
    total: coins,
    action,
    roleResult,
    couple: coupleInfo(),
    ...special,
    funnyMessage: action === 'photo' ? '' : (blockedLine || buildMessage(action, { name, gift, count, coins }, roleResult, extra)),
    lines: action === 'dongphong' ? { dongphongEnd: pickLine('dongphongEnd', baseVars()) } : undefined
  };

  persistState();
  markMc();
  if (!skipFocus) broadcast('focus', offeringEvent);
  if (roleResult?.became) evaluateCeremony(true);
  if (promotedAfter) schedulePromotion(9000);
  broadcastState();
  return offeringEvent;
}

// ========================================================
// TIKFINITY DESKTOP WEBSOCKET CLIENT
// ========================================================
class TikFinityClient extends EventEmitter {
  constructor({ endpoint = 'ws://127.0.0.1:21213/' } = {}) {
    super();
    this.endpoint = endpoint;
    this.closed = false;
    this.socket = null;
    this.seen = new Set();
    this.roomId = '';
    this.hostId = '';
  }

  status(stateName, message) {
    if (stateName === 'connected') {
      message = this.hostId
        ? `Đã kết nối thành công @${this.hostId}${this.roomId ? ` · ID phòng: ${this.roomId}` : ''}`
        : (this.roomId ? `Đã kết nối thành công · ID phòng: ${this.roomId}` : 'Đã kết nối thành công TikFinity · Đang nhận dữ liệu LIVE');
    }
    this.emit('status', { state: stateName, message, username: this.hostId, roomId: this.roomId, mode: 'tikfinity' });
  }

  roomInfo(e) {
    const n = e.data || {};
    const r = n.roomInfo || n.room || e.roomInfo || {};
    const s = r.owner || n.host || {};
    const i = s.uniqueId || s.unique_id;
    const o = n.common?.roomId || n.common?.room_id || n.roomId || n.room_id || r.id || r.roomId;
    if (typeof i === 'string' && /^[\w.]{2,64}$/.test(i.replace(/^@/, ''))) {
      this.hostId = i.replace(/^@/, '');
    }
    if ((typeof o === 'string' || typeof o === 'number') && /^\d{5,30}$/.test(String(o))) {
      this.roomId = String(o);
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      let isConnected = false;
      let isSettled = false;
      let ws;

      const fail = (err) => {
        clearTimeout(timer);
        if (!isSettled) {
          isSettled = true;
          reject(err || new Error('Chưa kết nối được TikFinity Desktop. Hãy mở ứng dụng TikFinity Desktop và bấm Connect phòng LIVE trước.'));
        }
      };

      try {
        ws = new WebSocket(this.endpoint);
      } catch (err) {
        return fail(err);
      }
      this.socket = ws;

      const timer = setTimeout(() => {
        fail();
        try { ws.close(); } catch {}
      }, 7000);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        if (this.closed) {
          try { ws.close(); } catch {}
          fail();
          return;
        }
        isConnected = true;
        isSettled = true;
        this.status('waiting', 'Đã kết nối TikFinity! Đang chờ bình luận/quà từ phòng LIVE bạn chọn trong TikFinity.');
        resolve();
      });

      ws.addEventListener('message', async ({ data }) => {
        if (!this.closed) {
          try {
            const text = typeof data === 'string' ? data : (data.text ? await data.text() : data.toString());
            this.handleMessage(JSON.parse(text));
          } catch {}
        }
      });

      ws.addEventListener('error', () => {
        if (!isConnected) fail();
      });

      ws.addEventListener('close', () => {
        clearTimeout(timer);
        if (!this.closed) {
          if (isConnected) {
            this.emit('disconnected');
          } else {
            fail();
          }
        }
      });
    });
  }

  handleMessage(msg) {
    if (this.closed || !msg || typeof msg !== 'object') return;
    const n = msg.event;
    const r = msg.data;
    if (r) this.roomInfo(msg);
    if (!r || !['chat', 'gift', 'member', 'join', 'leave', 'memberLeave', 'userLeave', 'like', 'follow', 'share', 'social'].includes(n)) return;

    const s = String(r.msgId || r.common?.msgId || '');
    const i = n + '|' + s;
    if (s && s !== '0') {
      if (this.seen.has(i)) return;
      this.seen.add(i);
      if (this.seen.size > 5000) {
        this.seen.delete(this.seen.values().next().value);
      }
    }

    if (['leave', 'memberLeave', 'userLeave'].includes(n)) {
      const u = this.parseUser(r);
      if (u.id !== 'unknown') this.emit('leave', u);
      return;
    }
    if (n === 'like') {
      const u = this.parseUser(r);
      this.emit('like', { ...u, count: Number(r.likeCount) || 1, total: Number(r.totalLikeCount) || 0 });
      return;
    }
    if (n === 'follow' || n === 'share' || n === 'social') {
      const u = this.parseUser(r);
      let kind = n;
      if (n === 'social') {
        const t = String(r.displayType || r.label || r.common?.displayText?.key || '');
        kind = /share/i.test(t) ? 'share' : /follow/i.test(t) ? 'follow' : '';
      }
      if (kind && u.id !== 'unknown') this.emit('social', { kind, user: u });
      return;
    }
    if (n === 'member' || n === 'join') {
      const u = this.parseUser(r);
      if (u.id === 'unknown') return;
      this.status('connected', `TikFinity đang gửi sự kiện: ${u.name} vào phòng`);
      this.emit('join', u);
      return;
    }
    if (n === 'chat') {
      const u = this.parseUser(r);
      const comment = String(r.comment || r.content || '').slice(0, 500);
      if (u.id === 'unknown' || !comment) return;
      this.status('connected', `TikFinity đang nhận bình luận LIVE`);
      this.emit('chat', { ...u, comment });
      return;
    }
    if (n === 'gift') {
      const g = this.parseGift(r);
      if (!g || g.id === 'unknown') return;
      this.status('connected', `TikFinity đang nhận quà LIVE: ${g.name} mừng ${g.gift}`);
      this.emit('gift', g);
    }
  }

  parseUser(t) {
    const e = t.user || t;
    const urls = e.profilePicture?.urls || e.profilePicture?.urlList || e.avatarThumb?.urlList || e.avatarLarge?.urlList || [];
    return {
      id: String(e.userId || e.idStr || e.id || e.uniqueId || e.displayId || 'unknown'),
      name: String(e.nickname || e.uniqueId || e.displayId || 'Khách Mời').slice(0, 60),
      avatar: String(urls[0] || e.profilePictureUrl || '')
    };
  }

  parseGift(t) {
    const e = t.giftDetails || t.gift || {};
    const n = t.extendedGiftInfo || {};
    if (Number(e.giftType ?? e.type ?? t.giftType) === 1 && !t.repeatEnd) {
      return null;
    }
    return {
      ...this.parseUser(t),
      gift: String(e.giftName || e.name || n.name || t.giftName || `Quà ${t.giftId || ''}`),
      giftId: String(t.giftId || e.id || ''),
      count: Math.max(1, Number(t.repeatCount || t.count) || 1),
      diamonds: Math.max(1, Number(e.diamondCount ?? n.diamond_count ?? t.diamondCount ?? t.diamonds) || 1)
    };
  }

  async disconnect() {
    this.closed = true;
    const ws = this.socket;
    this.socket = null;
    if (ws && ws.readyState < 2) {
      try { ws.close(); } catch {}
    }
  }
}

let activeTikFinityClient = null;
let tikfinityReconnectTimer = null;
let userDisconnected = false;

function setStatus(s) {
  state.status = s;
  broadcast('status', s);
}

async function disconnectTikFinity() {
  userDisconnected = true;
  clearTimeout(tikfinityReconnectTimer);
  tikfinityReconnectTimer = null;
  if (activeTikFinityClient) {
    const c = activeTikFinityClient;
    activeTikFinityClient = null;
    c.removeAllListeners();
    try { await c.disconnect(); } catch {}
  }
  setStatus({ state: 'offline', message: 'Chưa kết nối. Hãy mở TikFinity Desktop trên máy này.', mode: 'tikfinity' });
}

async function connectTikFinity() {
  userDisconnected = false;
  clearTimeout(tikfinityReconnectTimer);
  tikfinityReconnectTimer = null;
  if (activeTikFinityClient) {
    const c = activeTikFinityClient;
    activeTikFinityClient = null;
    c.removeAllListeners();
    try { await c.disconnect(); } catch {}
  }

  setStatus({ state: 'connecting', message: 'Đang kết nối TikFinity Desktop (cổng 21213)...', mode: 'tikfinity' });

  const client = new TikFinityClient({ endpoint: 'ws://127.0.0.1:21213/' });
  activeTikFinityClient = client;

  client.on('status', s => setStatus(s));
  client.on('chat', chat => processChatEvent(chat));
  client.on('gift', gift => processGiftEvent(gift));
  client.on('join', user => processJoinEvent(user));
  client.on('like', ev => processLikeEvent(ev));
  client.on('social', ({ kind, user }) => processSocialEvent(kind, user));
  client.on('disconnected', () => {
    if (activeTikFinityClient === client) activeTikFinityClient = null;
    setStatus({ state: 'offline', message: 'Mất kết nối TikFinity Desktop. Kiểm tra ứng dụng TikFinity Desktop trên máy.', mode: 'tikfinity' });
    if (!userDisconnected) {
      tikfinityReconnectTimer = setTimeout(() => {
        if (!userDisconnected && !activeTikFinityClient) {
          connectTikFinity().catch(() => {});
        }
      }, 6000);
    }
  });

  try {
    await client.connect();
  } catch (err) {
    if (activeTikFinityClient === client) activeTikFinityClient = null;
    throw err;
  }
}

// ========================================================
// NHẠC NỀN (FILE TRÊN MÁY)
// ========================================================
function listMusic() {
  try {
    return fs.readdirSync(MUSIC_DIR)
      .filter(f => MUSIC_EXT.has(path.extname(f).toLowerCase()))
      .map(f => ({ name: f, size: fs.statSync(path.join(MUSIC_DIR, f)).size }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  } catch {
    return [];
  }
}

function safeMusicName(raw) {
  const base = path.basename(String(raw || '')).normalize('NFC');
  const ext = path.extname(base).toLowerCase();
  if (!MUSIC_EXT.has(ext)) return null;
  const stem = base.slice(0, -ext.length).replace(/[^\p{L}\p{N} ._()-]/gu, '_').replace(/^\.+/, '').trim().slice(0, 80);
  return stem ? stem + ext : null;
}

// ========================================================
// HTTP SERVER
// ========================================================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
};

const ttsCache = new Map(); // câu đọc lặp lại -> khỏi gọi Google lần nữa
let reportedVoices = { at: 0, list: [], agent: '' };
const AVATAR_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibyteimg.com', 'byteimg.com', 'muscdn.com', 'tiktokv.com'];
const avatarCache = new Map();
const uploadedPhotoIds = new Set();

function listPhotos() {
  try {
    return fs.readdirSync(ALBUM_DIR)
      .filter(f => f.toLowerCase().endsWith('.png'))
      .map(f => {
        const st = fs.statSync(path.join(ALBUM_DIR, f));
        return { name: f, url: '/album/' + encodeURIComponent(f), size: st.size, at: st.mtimeMs };
      })
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Từ Internet (qua tunnel) chỉ cho phép gọi webhook TikFinity với đúng khóa
  if (isTunneled(req) && (pathname !== '/api/tikfinity' || url.searchParams.get('key') !== WEBHOOK_KEY)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // Đọc body JSON (chấp nhận cả form-urlencoded), giới hạn 1MB
  const readJson = () => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) {
        try { resolve(Object.fromEntries(new URLSearchParams(body))); }
        catch { resolve({}); }
      }
    });
    req.on('error', () => resolve({}));
  });

  // 1. SSE
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
    res.write(`event: status\ndata: ${JSON.stringify(state.status)}\n\n`);
    clients.add(res);
    if (url.searchParams.get('client') === 'overlay') overlayClients.add(res);
    req.on('close', () => { clients.delete(res); overlayClients.delete(res); });
    return;
  }

  // 2. License (launcher kiểm tra product)
  if (pathname === '/api/license/status') {
    return sendJson(res, 200, {
      product: 'TiecCuoiLive',
      valid: true,
      plan: 'pro',
      status: 'active',
      expiresAt: '2099-12-31'
    });
  }

  // 3. State
  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, { ...publicState(), scores: state.scores });
  }

  // 4. Cấu hình (chấp nhận {config:{...}, goals:{...}} hoặc phẳng)
  if (pathname === '/api/config' && req.method === 'POST') {
    const data = await readJson();
    const cfgIn = data.config && typeof data.config === 'object' ? data.config : data;
    for (const [k, v] of Object.entries(cfgIn)) {
      if (['config', 'goals', 'bgm', 'giftRules', 'mcLines', '__proto__', 'constructor', 'prototype'].includes(k)) continue;
      state.config[k] = v;
    }
    if (cfgIn.bgm && typeof cfgIn.bgm === 'object') state.config.bgm = { ...state.config.bgm, ...cfgIn.bgm };
    if (cfgIn.giftRules) state.config.giftRules = sanitizeRules(cfgIn.giftRules);
    if (cfgIn.mcLines) { state.config.mcLines = sanitizeMcLines(cfgIn.mcLines); for (const k in mcRotation) delete mcRotation[k]; }
    state.config.mcIdleSeconds = clampNum(state.config.mcIdleSeconds, 15, 600, 45);
    state.config.mcWelcomeSeconds = clampNum(state.config.mcWelcomeSeconds, 5, 600, 30);
    if (!['auto', 'browser', 'google'].includes(state.config.voiceEngine)) state.config.voiceEngine = 'auto';
    state.config.minCoinsToMarry = clampNum(state.config.minCoinsToMarry, 1, 1000000, 10);
    state.config.ceremonyCountdown = clampNum(state.config.ceremonyCountdown, 5, 600, 45);
    state.config.commentCooldown = clampNum(state.config.commentCooldown, 0, 300, 8);
    if (!['both', 'groom', 'bride'].includes(state.config.roleMode)) state.config.roleMode = 'both';
    if (!['auction', 'queue'].includes(state.config.roleSystem)) state.config.roleSystem = 'auction';
    if (!isQueue()) state.queue = { groom: [], bride: [] };
    state.config.maxGuests = Number(state.config.maxGuests) === 24 ? 24 : 54;
    state.people = fixSeats(state.people);
    state.config.likeGoal = clampNum(state.config.likeGoal, 100, 10000000, 5000);
    state.config.titleDecaySeconds = clampNum(state.config.titleDecaySeconds, 10, 600, 30);
    if (!['xu', 'chỉ vàng'].includes(state.config.moneyUnit)) state.config.moneyUnit = 'xu';

    const goalsIn = data.goals || cfgIn.goals;
    if (goalsIn && typeof goalsIn === 'object') {
      for (const k of ['rose', 'cake']) {
        if (!goalsIn[k]) continue;
        if (goalsIn[k].target !== undefined) state.goals[k].target = clampNum(goalsIn[k].target, 1, 100000000, state.goals[k].target);
        if (goalsIn[k].label) state.goals[k].label = String(goalsIn[k].label).slice(0, 40);
      }
    }
    // Vai bị đóng (đổi chế độ) -> trả lại tên gốc
    for (const r of ['groom', 'bride']) {
      if (!openRoles().includes(r)) { state.roles[r] = null; state.bids[r] = {}; }
    }
    evaluateCeremony();
    persistState();
    broadcastState();
    return sendJson(res, 200, { ok: true, config: state.config, goals: state.goals });
  }

  // 5. Kích hoạt nghi thức từ bảng điều khiển
  if (pathname === '/api/action' && req.method === 'POST') {
    const data = await readJson();
    const action = String(data.action || '');
    if (action === 'ceremony') {
      const ok = startCeremony();
      return sendJson(res, ok ? 200 : 409, { ok, error: ok ? undefined : 'Lễ đang diễn ra' });
    }
    if (action === 'reset_roles') {
      clearTimeout(ceremonyTimer);
      resetRoles();
      state.ceremony = { phase: 'idle', endsAt: 0 };
      broadcast('action', { action: 'roles_open', line: pickLine('rolesOpen', baseVars()) });
      markMc();
      schedulePromotion(5000);
      persistState();
      broadcastState();
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'steal_groom' || action === 'steal_bride') {
      // Mô phỏng: một khách ảo tặng vừa đủ xu để cướp vai
      const role = action === 'steal_bride' ? 'bride' : 'groom';
      const holder = state.roles[role];
      const coins = holder ? holder.bid + 1 : minCoins();
      const names = role === 'groom' ? ['Hoàng Long', 'Văn Hùng', 'Thành Đạt', 'Minh Khang'] : ['Ngọc Hân', 'Kim Ngân', 'Mai Linh', 'Thu Trang'];
      const name = pick(names.filter(n => n !== holder?.name));
      const id = 'demo-' + norm(name).replace(/ /g, '-');
      state.intents[id] = role;
      const ev = processGiftEvent({ id, name, gift: 'Nhẫn cưới', count: 1, diamonds: coins, avatar: '' });
      return sendJson(res, 200, { ok: true, offeringEvent: ev });
    }
    if (action === 'quickwed') {
      const ok = startCeremony({ quick: true, initiator: 'MC' });
      return sendJson(res, ok ? 200 : 409, { ok, error: ok ? undefined : 'Lễ đang diễn ra' });
    }
    if (action === 'cancel') {
      const r = cancelWedding();
      if (r.blocked) return sendJson(res, 409, { ok: false, error: 'Lễ đang diễn ra, không phá đám được' });
      broadcast('action', { action: 'cancel', name: 'MC', couple: r.couple, line: pickLine('cancel', { ...baseVars(), name: 'MC', groom: r.couple.groom, bride: r.couple.bride }) });
      markMc();
      persistState();
      broadcastState();
      schedulePromotion(6000);
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'photo') {
      broadcast('photo', makePhoto('couple'));
      markMc();
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'bouquet') {
      const c = pickBouquetCatcher('');
      broadcast('action', { action: 'bouquet', name: 'Cô dâu', catcher: c, line: pickLine('bouquet', { ...baseVars(), name: 'cô dâu', catcher: c ? c.name : 'một vị khách may mắn' }) });
      markMc();
      persistState();
      broadcastState();
      return sendJson(res, 200, { ok: true, catcher: c });
    }
    if (action === 'fireworks' || action === 'mc') {
      const key2 = action === 'mc' ? 'marryMC' : 'fireworks';
      broadcast('action', { action, name: 'MC', line: pickLine(key2, { ...baseVars(), name: action === 'mc' ? 'một vị khách' : 'MC' }) });
      markMc();
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'music') {
      const track = nextTrack();
      if (!track) return sendJson(res, 409, { ok: false, error: 'Chưa có file nhạc trong tab Nhạc Nền' });
      broadcast('action', { action: 'music', name: 'MC', track });
      broadcastState();
      return sendJson(res, 200, { ok: true, track });
    }
    const allowed = ['kiss', 'cake', 'champagne', 'cheers', 'dance', 'petal', 'ring', 'dongphong'];
    if (!allowed.includes(action)) return sendJson(res, 400, { ok: false, error: 'Unknown action' });
    const v = baseVars();
    const extra = {};
    if (['ring', 'kiss', 'cake', 'champagne'].includes(action)) extra.line = pickLine(action, v);
    if (action === 'dongphong') extra.lines = { dongphong: pickLine('dongphong', v), dongphongEnd: pickLine('dongphongEnd', v) };
    broadcast('action', { action, initiator: String(data.initiator || '').slice(0, 60), ...coupleInfo(), ...extra });
    markMc();
    return sendJson(res, 200, { ok: true, action });
  }

  // 6. Nhạc nền
  if (pathname === '/api/bgm' && req.method === 'POST') {
    const data = await readJson();
    const bgm = state.config.bgm || (state.config.bgm = { ...defaultState.config.bgm });
    if (data.source !== undefined && ['file', 'youtube', 'off'].includes(data.source)) bgm.source = data.source;
    if (data.file !== undefined) {
      const f = String(data.file);
      bgm.file = f && listMusic().some(m => m.name === f) ? f : '';
    }
    if (data.youtubeUrl !== undefined) {
      bgm.youtubeUrl = String(data.youtubeUrl).slice(0, 300);
      const m = bgm.youtubeUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      bgm.youtubeId = m && m[2].length === 11 ? m[2] : (/^[\w-]{11}$/.test(bgm.youtubeUrl) ? bgm.youtubeUrl : '');
    }
    if (data.title !== undefined) bgm.title = String(data.title).slice(0, 80);
    if (data.volume !== undefined) bgm.volume = clampNum(data.volume, 0, 100, 50);
    if (data.playing !== undefined) bgm.playing = Boolean(data.playing);
    if (data.enabled !== undefined) bgm.enabled = Boolean(data.enabled);
    persistState();
    broadcastState();
    broadcast('bgm', bgm);
    return sendJson(res, 200, { ok: true, bgm });
  }

  if (pathname === '/api/music' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, files: listMusic(), current: state.config.bgm?.file || '' });
  }

  if (pathname === '/api/music/upload' && req.method === 'POST') {
    let raw = url.searchParams.get('name') || req.headers['x-filename'] || '';
    try { raw = decodeURIComponent(raw); } catch {}
    const name = safeMusicName(raw);
    if (!name) {
      req.resume();
      return sendJson(res, 400, { ok: false, error: 'Chỉ nhận file .mp3, .wav, .ogg, .m4a' });
    }
    const dest = path.join(MUSIC_DIR, name);
    const tmp = dest + '.uploading';
    const out = fs.createWriteStream(tmp);
    let size = 0;
    let aborted = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_MUSIC_BYTES && !aborted) {
        aborted = true;
        out.destroy();
        fs.rm(tmp, { force: true }, () => {});
        sendJson(res, 413, { ok: false, error: 'File quá lớn (tối đa 60MB)' });
        req.destroy();
      }
    });
    req.pipe(out);
    out.on('finish', () => {
      if (aborted) return;
      fs.rename(tmp, dest, err => {
        if (err) return sendJson(res, 500, { ok: false, error: err.message });
        sendJson(res, 200, { ok: true, name, files: listMusic() });
      });
    });
    out.on('error', err => {
      if (!aborted) sendJson(res, 500, { ok: false, error: err.message });
    });
    return;
  }

  if (pathname === '/api/music/delete' && req.method === 'POST') {
    const data = await readJson();
    const name = listMusic().find(m => m.name === String(data.name || ''))?.name;
    if (!name) return sendJson(res, 404, { ok: false, error: 'Không tìm thấy file' });
    fs.rmSync(path.join(MUSIC_DIR, name), { force: true });
    if (state.config.bgm?.file === name) {
      state.config.bgm.file = '';
      persistState();
      broadcastState();
      broadcast('bgm', state.config.bgm);
    }
    return sendJson(res, 200, { ok: true, files: listMusic() });
  }

  // 7. Mô phỏng
  if (pathname === '/api/demo' && req.method === 'POST') {
    const data = await readJson();
    if (data.type === 'chat' || data.type === 'comment') {
      const chatEvent = {
        id: data.id || ('demo-' + norm(data.name || 'khach').replace(/ /g, '-')),
        name: data.name || 'Khách Mời',
        comment: data.comment || 'Chúc mừng hai bạn trăm năm hạnh phúc!',
        avatar: data.avatar || ''
      };
      processChatEvent(chatEvent);
      return sendJson(res, 200, { ok: true, chat: chatEvent });
    }
    if (data.type === 'gift') {
      const offeringEvent = processGiftEvent({
        id: data.id || ('demo-' + norm(data.name || 'dai gia').replace(/ /g, '-')),
        name: data.name || 'Đại Gia Giấu Tên',
        gift: data.gift || 'Mừng Phong Bì',
        giftId: data.giftId || '',
        count: Math.max(1, Number(data.count) || 1),
        diamonds: Math.max(1, Number(data.diamonds) || 1),
        avatar: data.avatar || ''
      });
      return sendJson(res, 200, { ok: true, offeringEvent });
    }
    if (data.type === 'join') {
      processJoinEvent({ id: data.id || ('demo-' + Date.now()), name: data.name || 'Khách Quý', avatar: data.avatar || '' });
      return sendJson(res, 200, { ok: true });
    }
    if (data.type === 'like') {
      processLikeEvent({ id: data.id || ('demo-' + norm(data.name || 'khach').replace(/ /g, '-')), name: data.name || 'Khách', avatar: data.avatar || '', count: Number(data.count) || 1 });
      return sendJson(res, 200, { ok: true, likes: state.likes });
    }
    if (data.type === 'share' || data.type === 'follow') {
      processSocialEvent(data.type, { id: data.id || ('demo-' + norm(data.name || 'khach').replace(/ /g, '-')), name: data.name || 'Khách', avatar: data.avatar || '' });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: 'Unknown demo type' });
  }

  // 8-10. TikFinity Desktop
  if (pathname === '/api/connect' && req.method === 'POST') {
    try {
      await connectTikFinity();
      return sendJson(res, 200, { ok: true, status: state.status });
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Lỗi kết nối TikFinity Desktop', mode: 'tikfinity' });
      return sendJson(res, 400, { ok: false, error: err.message, status: state.status });
    }
  }

  if (pathname === '/api/disconnect' && req.method === 'POST') {
    await disconnectTikFinity();
    return sendJson(res, 200, { ok: true, status: state.status });
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJson(res, 200, state.status);
  }

  if (pathname === '/api/rule-presets' && req.method === 'GET') {
    return sendJson(res, 200, { presets: RULE_PRESETS });
  }

  // Lấy avatar TikTok qua server (cùng nguồn) để vẽ được vào ảnh cưới
  if (pathname === '/api/avatar' && req.method === 'GET') {
    let target;
    try { target = new URL(url.searchParams.get('u') || ''); } catch { return sendJson(res, 400, { error: 'URL không hợp lệ' }); }
    if (target.protocol !== 'https:' || !AVATAR_HOSTS.some(h => target.hostname === h || target.hostname.endsWith('.' + h))) {
      return sendJson(res, 400, { error: 'Chỉ nhận ảnh từ máy chủ TikTok' });
    }
    const hit = avatarCache.get(target.href);
    if (hit) {
      res.writeHead(200, { 'Content-Type': hit.type, 'Cache-Control': 'public, max-age=3600' });
      return res.end(hit.buf);
    }
    const fail = code => { if (!res.headersSent) sendJson(res, code, { error: 'Không tải được avatar' }); };
    const upReq = https.get(target, { timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0 (TiecCuoiLive)' } }, up => {
      const type = String(up.headers['content-type'] || '');
      if (up.statusCode !== 200 || !type.startsWith('image/')) { up.resume(); return fail(502); }
      const chunks = [];
      let size = 0;
      up.on('data', c => { size += c.length; if (size > 3 * 1024 * 1024) up.destroy(); else chunks.push(c); });
      up.on('end', () => {
        const buf = Buffer.concat(chunks);
        avatarCache.set(target.href, { buf, type });
        if (avatarCache.size > 300) avatarCache.delete(avatarCache.keys().next().value);
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' });
        res.end(buf);
      });
      up.on('error', () => fail(502));
    });
    upReq.on('timeout', () => upReq.destroy(new Error('timeout')));
    upReq.on('error', () => fail(502));
    return;
  }

  // Album ảnh cưới (màn hình LIVE gửi ảnh PNG về để lưu)
  if (pathname === '/api/photos' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, photos: listPhotos() });
  }
  if (pathname === '/api/photos' && req.method === 'POST') {
    const id = String(url.searchParams.get('id') || '').slice(0, 60);
    if (!id || uploadedPhotoIds.has(id)) {
      req.resume();
      return sendJson(res, 200, { ok: true, duplicate: true });
    }
    uploadedPhotoIds.add(id);
    if (uploadedPhotoIds.size > 500) uploadedPhotoIds.delete(uploadedPhotoIds.values().next().value);
    const chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size <= MAX_PHOTO_BYTES) chunks.push(c); });
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      if (size > MAX_PHOTO_BYTES || buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
        uploadedPhotoIds.delete(id);
        return sendJson(res, 400, { ok: false, error: 'Ảnh không hợp lệ' });
      }
      const label = norm(url.searchParams.get('name') || 'anh-cuoi').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'anh-cuoi';
      const d = new Date();
      const file = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}_${label}.png`;
      fs.writeFile(path.join(ALBUM_DIR, file), buf, err => (err ? sendJson(res, 500, { ok: false, error: err.message }) : sendJson(res, 200, { ok: true, file })));
    });
    return;
  }
  if (pathname === '/api/photos/delete' && req.method === 'POST') {
    const data = await readJson();
    const name = listPhotos().find(ph => ph.name === String(data.name || ''))?.name;
    if (!name) return sendJson(res, 404, { ok: false, error: 'Không tìm thấy ảnh' });
    fs.rmSync(path.join(ALBUM_DIR, name), { force: true });
    return sendJson(res, 200, { ok: true, photos: listPhotos() });
  }

  if (pathname === '/api/mc/groups' && req.method === 'GET') {
    return sendJson(res, 200, { groups: MC_GROUPS });
  }

  // Đọc thử 1 câu trên màn hình LIVE (đúng giọng & đường âm thanh của OBS)
  if (pathname === '/api/mc/test' && req.method === 'POST') {
    const data = await readJson();
    const text = String(data.text || '').trim().slice(0, 400);
    if (!text) return sendJson(res, 400, { ok: false, error: 'Chưa có câu để đọc' });
    broadcast('mc', { text, kind: 'test' });
    return sendJson(res, 200, { ok: true, overlays: overlayClients.size });
  }

  // Màn hình LIVE báo danh sách giọng tiếng Việt có trên máy nó
  if (pathname === '/api/voices') {
    if (req.method === 'POST') {
      const data = await readJson();
      const list = Array.isArray(data.voices) ? data.voices.slice(0, 50).map(v => ({ name: String(v.name || '').slice(0, 120), lang: String(v.lang || '').slice(0, 20), local: Boolean(v.local) })) : [];
      reportedVoices = { at: Date.now(), list, agent: String(data.agent || '').slice(0, 160) };
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 200, { ...reportedVoices, overlays: overlayClients.size });
  }

  if (pathname === '/api/webhook-info' && req.method === 'GET') {
    return sendJson(res, 200, { path: `/api/tikfinity?key=${WEBHOOK_KEY}` });
  }

  // 11. Webhook TikFinity Web
  if (pathname === '/api/tikfinity' && req.method === 'POST') {
    const data = { ...Object.fromEntries(url.searchParams), ...(await readJson()) };
    delete data.key;
    // Định dạng TikFinity Web: username, nickname, avatar_url, commandParams/value2 (bình luận),
    // giftId, giftName, repeatCount, coins (tổng xu), triggerTypeId
    const userId = data.uniqueId || data.username || data.userId || data.name;
    const nickname = data.nickname || data.uniqueId || data.username || data.name;
    const avatar = data.profilePictureUrl || data.avatar_url || data.avatarUrl || data.avatar || '';
    const isGift = data.event === 'gift' || data.giftId || data.giftName;
    const chatText = data.comment || data.text || data.commandParams || data.value2;
    if (isGift) {
      const count = Math.max(1, Number(data.repeatCount || data.count) || 1);
      let diamonds = Number(data.diamondCount || data.diamonds) || 0;
      if (!diamonds && Number(data.coins)) diamonds = Math.max(1, Math.round(Number(data.coins) / count));
      processGiftEvent({
        id: userId || 'donor',
        name: nickname || 'Người Tặng',
        gift: data.giftName || data.gift || 'Mừng Cưới',
        giftId: data.giftId || '',
        count,
        diamonds: diamonds || 1,
        avatar
      });
    } else if (data.event === 'like' || data.likeCount !== undefined) {
      processLikeEvent({ id: userId, name: nickname, avatar, count: Number(data.likeCount || data.likes || data.count) || 1, total: Number(data.totalLikeCount) || 0 });
    } else if (data.event === 'share' || data.event === 'follow') {
      processSocialEvent(data.event, { id: userId || 'guest', name: nickname || 'Khách', avatar });
    } else if (data.event === 'chat' || chatText) {
      processChatEvent({
        id: userId || 'guest',
        name: nickname || 'Khách Mời',
        comment: String(chatText || ''),
        avatar
      });
    } else if (data.event === 'member' || data.event === 'join') {
      processJoinEvent({ id: userId || 'guest', name: nickname || 'Khách Quý', avatar });
    }
    return sendJson(res, 200, { ok: true });
  }

  // 12. Phiên LIVE mới
  if (pathname === '/api/reset' && req.method === 'POST') {
    clearTimeout(ceremonyTimer);
    pendingRoleGifts.length = 0;
    state.people = [];
    state.scores = {};
    state.recentGivers = [];
    state.stats.guests = 0;
    state.stats.envelopes = 0;
    state.stats.wishes = 0;
    state.stats.couples = 0;
    state.goals.rose.current = 0;
    state.goals.cake.current = 0;
    state.marriages = [];
    state.intents = {};
    state.queue = { groom: [], bride: [] };
    state.likes = { total: 0, progress: 0 };
    state.stats.likes = 0;
    state.stats.shares = 0;
    state.stats.follows = 0;
    engagement.clear();
    seenGuests.clear();
    specialHolders = { star: null, dance: null };
    resetRoles();
    state.ceremony = { phase: 'idle', endsAt: 0 };
    persistState();
    broadcast('action', { action: 'roles_open', silent: true });
    broadcastState();
    return sendJson(res, 200, { ok: true });
  }

  // 13. Giọng đọc Google (proxy) + bộ nhớ đệm
  if (pathname === '/api/speech' && req.method === 'POST') {
    const data = await readJson();
    const text = String(data.text || '').trim();
    if (!text || text.length > 300) return sendJson(res, 400, { error: 'Text length must be 1-300 chars' });
    if (ttsCache.has(text)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
      return res.end(ttsCache.get(text));
    }
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
    https.get(ttsUrl, (ttsRes) => {
      if (ttsRes.statusCode !== 200) {
        ttsRes.resume();
        return sendJson(res, 500, { error: 'Google TTS failed' });
      }
      const chunks = [];
      ttsRes.on('data', c => chunks.push(c));
      ttsRes.on('end', () => {
        const buf = Buffer.concat(chunks);
        ttsCache.set(text, buf);
        if (ttsCache.size > 150) ttsCache.delete(ttsCache.keys().next().value);
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
        res.end(buf);
      });
    }).on('error', (err) => sendJson(res, 500, { error: err.message }));
    return;
  }

  // 14. File tĩnh trong public/ (hỗ trợ tên có dấu/khoảng trắng và Range cho nhạc)
  let rel = pathname === '/' ? '/index.html' : pathname;
  try { rel = decodeURIComponent(rel); } catch {
    res.writeHead(400);
    return res.end('Bad Request');
  }
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': /\.(png|jpg|jpeg|webp|woff2?|ttf)$/.test(ext) ? 'public, max-age=3600' : 'no-cache',
      'Accept-Ranges': 'bytes'
    };
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) {
      let start = range[1] === '' ? stats.size - Number(range[2]) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : stats.size - 1;
      start = Math.max(0, start);
      end = Math.min(stats.size - 1, end);
      if (start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stats.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': stats.size });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tiệc Cưới Online Server running on http://localhost:${PORT}`);
  console.log(`Webhook TikFinity Web: <link-tunnel>/api/tikfinity?key=${WEBHOOK_KEY}`);
});
