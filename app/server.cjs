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
const CEREMONY_MS = 37500;       // lễ tự chạy đủ các bước (kiểu cũ): mở lễ, nhẫn, hôn, bánh, rượu, động phòng
const CEREMONY_WED_MS = 10000;   // chỉ làm lễ thành hôn: mở lễ, trao nhẫn, tuyên bố — các bước sau chờ khách tặng quà
const CEREMONY_QUICK_MS = 11500; // "động phòng luôn": bỏ qua các bước lễ
const FAREWELL_MS = 5000;        // hết tiệc mừng: đôi trẻ chào khách rồi mới mở vai cho lượt mới
const RECEPTION_GIFT_MS = 8000;  // mỗi món quà trong tiệc mừng giữ đôi trẻ trên sân khấu thêm chừng này
const RECEPTION_MAX_MS = 2 * 60 * 1000;
const ALBUM_DIR = path.join(PUBLIC_DIR, 'album');
const THEMES_DIR = path.join(PUBLIC_DIR, 'themes');
let themeCache = { at: 0, list: [] };
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

// Đếm sự kiện TikFinity gửi về từ lúc bật server (không lưu file): để biết Event nào trong TikFinity đã chạy
const WEBHOOK_SINCE = Date.now();
const webhookSeen = Object.fromEntries(['chat', 'gift', 'join', 'like', 'share', 'follow', 'other'].map(k => [k, { count: 0, at: 0, who: '', what: '' }]));

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
  // Hàng chờ (kiểu các rạp cưới phổ biến): mỗi vai một món quà cố định, vai có người thì xếp hàng;
  // quà "thay" để chen lên ngay. Thứ tự quan trọng: luật đầu tiên khớp được dùng (quà >= 99 xu để cuối).
  // Tên quà: chữ đầu tiên là tên hiện trên màn hình LIVE, các chữ sau để khớp tên TikTok gửi về (Việt / Anh).
  queue: [
    { gifts: 'chú heo may mắn, bé heo, heo, pig', minCoins: 0, action: 'groom' },
    { gifts: 'cỏ bốn lá, cỏ 4 lá, clover', minCoins: 0, action: 'bride' },
    { gifts: 'nước hoa, perfume', minCoins: 0, action: 'replaceGroom' },
    { gifts: 'rosa', minCoins: 0, action: 'replaceBride' },
    { gifts: 'hand hearts, tay tim', minCoins: 0, action: 'quickwed' },
    { gifts: 'kính râm, sunglasses', minCoins: 0, action: 'music' },
    { gifts: 'bánh vòng, doughnut', minCoins: 0, action: 'dance' },
    { gifts: 'hạc giấy, paper crane', minCoins: 0, action: 'cancel' },
    { gifts: 'bắn tim, finger heart', minCoins: 0, action: 'bouquet' },
    { gifts: 'pháo giấy, confetti', minCoins: 0, action: 'fireworks' },
    { gifts: 'chó corgi, corgi', minCoins: 0, action: 'mc' },
    { gifts: 'hoa hồng, rose', minCoins: 0, action: 'petal' },
    { gifts: 'heart me, thả tim', minCoins: 0, action: 'kiss' },
    { gifts: 'gg', minCoins: 0, action: 'champagne' },
    { gifts: 'lát bánh kem, cake slice', minCoins: 0, action: 'cake' },
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

// Từ đệm người xem hay gõ kèm khi xin vai: "em chú rể nè", "cho mình cô dâu với ạ", "chú rể +1"...
// Bỏ các từ này đi mà còn đúng "chu re" / "co dau" thì coi là xin vai. Không tính "ơi", "đâu", "đẹp"...
// để câu gọi hay khen ("chú rể ơi", "cô dâu xinh quá") không bị hiểu nhầm.
const ROLE_FILLERS = new Set(('cho xin dang ky dk em e minh m toi t tui tao anh a chi c ban b lam vai len nhan lay muon mun duoc dc di ik voi vs '
  + 'ne nha nhe nhaa nhaaa ah ak ha hen luon lun day nay nua ad mc 1 mot cai suat slot pls plz please ma thoi thui').split(' '));
function detectRoleIntent(comment) {
  const n = norm(comment).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Câu hỏi ("ai làm chú rể vậy", "chú rể đâu rồi", "sao chưa có cô dâu"), không phải xin vai. Xét trên chữ CÓ DẤU
  // vì bỏ dấu thì "đâu" trùng với "dâu" trong "cô dâu".
  const low = String(comment || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} ]+/gu, ' ');
  if (/(^| )(ai|đâu|sao)( |$)/u.test(low)) return null;
  if (n === 'co dau' || hasWord(n, 'lam co dau') || hasWord(n, 'vai co dau') || hasWord(n, 'lam vo')) return 'bride';
  if (n === 'chu re' || hasWord(n, 'lam chu re') || hasWord(n, 'vai chu re') || hasWord(n, 'lam chong')) return 'groom';
  const words = n.split(' ');
  if (words.length > 8) return null;
  const core = words.filter(w => !ROLE_FILLERS.has(w)).join(' ');
  if (core === 'co dau') return 'bride';
  if (core === 'chu re') return 'groom';
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
    autoPair: true,            // vai trống quá lâu không ai tặng quà -> MC ghép đôi ngẫu nhiên khách trong rạp
    autoPairSeconds: 8,        // giây chờ ghép đôi (cô dâu, chú rể đứng riêng chờ nửa kia)
    pairBoth: true,            // sân khấu trống: MC chọn luôn cả cô dâu lẫn chú rể (false = mời một người trước, người kia để khách giành)
    partyEvery: 5,             // cứ đủ chừng này cặp cưới thì cả rạp mở tiệc quẩy (0 = tắt)
    partnerWaitSeconds: 90,    // đã có người thật nhận một vai: chờ người thật khác nhận vai kia bấy nhiêu giây rồi MC mới chọn ngẫu nhiên
    hostName: '',              // tên chủ phòng: lên vai khi hết giờ ghép đôi mà rạp chưa có khách
    freeRoles: true,           // luật Hàng chờ: bình luận "chú rể" / "cô dâu" là nhận vai miễn phí
    ceremonyCountdown: 15,     // giây
    ceremonySteps: 'gift',     // gift = cưới xong chờ khách tặng quà mới hôn / cắt bánh / động phòng | auto = tự chạy đủ các bước
    treatQuietSeconds: 60,     // rạp không ai tặng quà chừng này giây thì MC đãi miễn phí một hiệu ứng, ghi rõ "MC đãi" (0 = tắt)
    demoEvery: 8,              // MC đãi miễn phí pháo hoa / động phòng để khoe tính năng: trung bình mấy lượt cưới một lần (0 = tắt)
    receptionSeconds: 25,      // tiệc mừng sau lễ: đôi trẻ ở lại sân khấu bao lâu để khách tặng quà
    commentRituals: true,      // bình luận "hôn", "dzô"... kích hoạt nghi thức
    commentCooldown: 8,        // giây giữa 2 lần cùng nghi thức do bình luận
    roleSystem: 'queue',       // auction = đấu giá | queue = quà vào vai
    roleQueue: true,           // luật quà vào vai: vai có người thì xếp hàng (true) hay tặng quà là giành ngay (false)
    maxGuests: 90,             // 24 = thoáng | 54 = đông khách | 90 = kín rạp
    guestsWander: true,        // khách đi lại trong rạp thay vì đứng yên một chỗ
    giftEffects: true,         // nhận quà: thẻ cảm ơn, mưa hình quà, quà lớn phóng to giữa màn hình
    botsEnabled: false,        // bot lấp rạp: khách ảo đi lại cho rạp đỡ trống, không tham gia tiệc cưới
    botsCount: 20,             // giữ rạp luôn có ít nhất chừng này người (khách thật vào thì bot rút bớt)
    likeGoal: 5000,            // đủ số tim này thì cả rạp đứng dậy quẩy
    photoAfterCeremony: true,  // chụp ảnh cưới sau mỗi lễ
    moneyUnit: 'xu',           // xu | chỉ vàng (cách hiển thị tiền mừng)
    titleDecaySeconds: 30,     // ngừng tương tác bao lâu thì mất danh hiệu
    showMC: true,              // nhân vật MC đứng trên sân khấu
    // Bộ hình (thư mục public/themes/<mã>/theme.json)
    theme: 'ban-thuc-3d',
    themeBackground: '',       // mã phông trong bộ hình; trống = phông đầu tiên
    themeVideo: true,          // nhân vật chuyển động bằng video (máy yếu thì tắt)
    themeScenes: true,         // phông tự đổi theo diễn biến lễ cưới (bộ hình có "scenes")
    sizeCouple: 100,           // % kích thước cặp đôi
    sizeMC: 100,               // % kích thước MC
    sizeGuest: 100,            // % kích thước khách và người đi lên
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
      playing: true,
      rotate: 'shuffle'        // hết bài thì: shuffle = sang bài ngẫu nhiên | order = bài kế tiếp | off = lặp lại bài đó
    },
    // Giọng MC
    voiceEngine: 'auto',       // auto | browser | google | vieneu (giọng nam chạy trên máy, tools/giong-nam)
    vieneuVoice: 'Minh Quân',  // giọng nam của VieNeu-TTS
    vieneuReverb: 'hoi-truong', // khong | phong | hoi-truong: độ vang như MC nói trong phòng thật
    vieneuStyle: 'lay',        // tu-nhien | lay | rat-lay (lên giọng, nói nhanh cho người xem trẻ) | mc (giọng MC đám cưới, trầm vừa)
    browserVoice: '',          // tên giọng của máy (nếu chọn)
    mcIdleEnabled: true,       // MC tự dẫn khi phòng vắng
    mcIdleSeconds: 45,
    mcWelcomeEnabled: true,    // MC chào khách mới vào
    mcWelcomeSeconds: 30,
    mcCaption: false,          // phụ đề lời MC trên màn hình LIVE (tắt: MC chỉ nói, màn hình đỡ rối chữ)
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
    { id: 'guest-1', name: 'Minh Thư', avatar: '', gender: 'female', sprite: 4, table: 0, seat: 0, statusTag: '💍 Xin vía' },
    { id: 'guest-2', name: 'Nhà Đẹp Huy', avatar: '', gender: 'male', sprite: 1, table: 12, seat: 0, statusTag: '🍗 Ăn cỗ' },
    { id: 'guest-3', name: 'Jamie', avatar: '', gender: 'male', sprite: 2, table: 1, seat: 0, statusTag: '🍻 Cạn ly' },
    { id: 'guest-4', name: 'Linh', avatar: '', gender: 'female', sprite: 5, table: 13, seat: 0, statusTag: '💃 Quẩy' },
    { id: 'guest-5', name: 'Em Bông', avatar: '', gender: 'female', sprite: 3, table: 2, seat: 0, statusTag: '👀 Hóng biến' },
    { id: 'guest-6', name: 'Quang Nhật', avatar: '', gender: 'male', sprite: 0, table: 14, seat: 0, statusTag: '🥂 Cụng ly' }
  ],
  scores: {},
  recentGivers: [],
  recentGifts: [],
  feats: {},
  wedLog: {},
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

// Thứ tự xếp ghế: 24 ghế gốc (xen kẽ trái/phải), rồi 30 ghế thêm khi bật "đông khách", rồi 36 ghế "kín rạp"
const SEAT_ORDER = [
  ...Array.from({ length: 24 }, (_, i) => (i % 2 === 0 ? i / 2 : 12 + (i - 1) / 2)),
  ...Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 24 + i / 2 : 39 + (i - 1) / 2)),
  ...Array.from({ length: 36 }, (_, i) => (i % 2 === 0 ? 54 + i / 2 : 72 + (i - 1) / 2))
];
const GUEST_LIMITS = [24, 54, 90];
const guestLimit = v => (GUEST_LIMITS.includes(Number(v)) ? Number(v) : 54);
function maxSeats() {
  return guestLimit(state?.config?.maxGuests);
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
    // Nhịp "rạp viral" (một lần): sân khấu luôn có cặp đôi, bình luận để xếp hàng lên vai, quà để chen lên ngay,
    // rạp kín khách, bỏ phụ đề MC cho đỡ rối chữ
    if (!cfgIn.viralFlow) {
      Object.assign(s.config, {
        roleSystem: 'queue', roleQueue: true, freeRoles: true, autoPair: true, autoPairSeconds: 8, pairBoth: true,
        ceremonyCountdown: Math.min(15, Number(cfgIn.ceremonyCountdown) || 15), partyEvery: 5, maxGuests: 90, mcCaption: false
      });
      if (cfgIn.botsEnabled) s.config.botsCount = Math.max(Number(cfgIn.botsCount) || 0, 40);
    }
    s.config.viralFlow = 1;
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
    s.feats = parsed.feats && typeof parsed.feats === 'object' ? parsed.feats : {};
    s.wedLog = parsed.wedLog && typeof parsed.wedLog === 'object' ? parsed.wedLog : {};
    if (Array.isArray(parsed.people)) s.people = parsed.people;
    s.people = fixSeats(s.people, guestLimit(s.config.maxGuests));
    for (const p of s.people) {
      if (!p.baseTag) p.baseTag = p.statusTag || '✨ Khách quý';
      // Bản cũ chỉ lưu số hình 0-5 (0-2 nam, 3-5 nữ); giờ lưu giới tính + số bộ đồ
      if (p.gender !== 'male' && p.gender !== 'female') p.gender = FEMALE_SPRITES.includes(Number(p.sprite)) ? 'female' : 'male';
      if (!Number.isInteger(p.sprite) || p.sprite < 0) p.sprite = 0;
    }
    s.queue = { groom: sanitizeQueue(parsed.queue?.groom), bride: sanitizeQueue(parsed.queue?.bride) };
    if (!(s.config.roleSystem === 'queue' && s.config.roleQueue === true)) s.queue = { groom: [], bride: [] }; // không dùng hàng chờ
    s.likes = { total: Number(parsed.likes?.total) || 0, progress: Number(parsed.likes?.progress) || 0 };
    // App tắt lúc đôi vừa cưới còn trên sân khấu (tiệc mừng / đang tiễn / đang động phòng sau lễ): lượt đó coi như xong,
    // không để họ đứng kẹt trên sân khấu rồi cưới lại lần nữa
    const savedCer = parsed.ceremony || {};
    if (savedCer.phase === 'reception' || (savedCer.phase === 'running' && savedCer.married)) {
      s.roles = { groom: null, bride: null };
      s.bids = { groom: {}, bride: {} };
    }
    s.ceremony = { phase: 'idle', endsAt: 0 };
    s.status = { ...s.status, state: 'offline', message: 'Chưa kết nối. Hãy mở TikFinity Desktop trên máy này.' };
  } catch (e) {
    console.error('Error loading wedding state, using default:', e.message);
  }
  sanitizeThemeConfig(s.config);
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
    party: { every: partyEvery(), left: couplesToParty() },
    // Đôi vừa cưới còn trên sân khấu (tiệc mừng / đang tiễn): vẫn là số của họ, chưa sang cặp kế
    coupleNumber: (state.stats.couples || 0) + (c.phase === 'reception' || (c.phase === 'running' && c.married) ? 0 : 1),
    marriages: state.marriages,
    ceremony: {
      phase: c.phase,
      mode: c.mode || '',
      remainingMs: c.phase === 'countdown' || c.phase === 'reception' ? Math.max(0, c.endsAt - Date.now()) : 0
    },
    pairing: { remainingMs: pairingRemainingMs() },
    revenge: (r => r && {
      role: r.role, loser: r.loser.name, loserAvatar: r.loser.avatar, winner: r.winner.name,
      remainingMs: r.until - Date.now(), round: r.round, loserWins: r.loserWins, winnerWins: r.winnerWins
    })(activeRevenge()),
    build: SERVER_BUILD,
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
    const pool = state.people.filter(x => !keep.has(x.id));
    // Bot lấp rạp nhường ghế trước, rồi mới tới khách lâu nhất không tương tác
    const victim = pool.find(x => x.bot) || pool.sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0))[0] || state.people[0];
    seat = victim.table;
    state.people = state.people.filter(x => x !== victim);
  }
  p = {
    id,
    name: user.name || 'Khách Quý',
    avatar: user.avatar || '',
    // Chưa biết giới tính thì chọn ngẫu nhiên; bộ đồ cụ thể do bộ hình đang dùng quyết định
    gender: user.gender === 'male' || user.gender === 'female' ? user.gender : (Math.random() < 0.5 ? 'male' : 'female'),
    sprite: Math.floor(Math.random() * 1000),
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

// Nhận vai chú rể thì nhân vật là nam, cô dâu là nữ (giới tính lúc đầu chỉ là chọn ngẫu nhiên): người đi lên thảm đỏ
// và nhân vật khách của họ khớp với vai, không còn cảnh "chú rể" mà hình nữ đi lên.
function alignGender(id, role) {
  const want = role === 'groom' ? 'male' : role === 'bride' ? 'female' : '';
  const p = want && state.people.find(x => x.id === 'tik-' + String(id).replace(/^tik-/, ''));
  if (p && p.gender !== want) switchGender(p, want);
}

// Đổi nhân vật nam/nữ; gõ lại cùng giới tính -> bộ đồ khác
function switchGender(p, gender) {
  if (p.gender === gender) p.sprite = (Number(p.sprite) || 0) + 1;
  else {
    p.gender = gender;
    p.sprite = Math.floor(Math.random() * 1000);
  }
  return p.sprite;
}

// ========================================================
// BỘ HÌNH: mỗi thư mục public/themes/<mã>/ có theme.json (tạo bằng tools/xu-ly-bo-hinh.mjs)
// ========================================================
function listThemes() {
  if (Date.now() - themeCache.at < 3000) return themeCache.list;
  const list = [];
  let dirs = [];
  try { dirs = fs.readdirSync(THEMES_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch {}
  for (const id of dirs) {
    if (!/^[a-z0-9-]{1,40}$/.test(id)) continue;
    try {
      const t = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, id, 'theme.json'), 'utf8'));
      const url = f => (!f ? '' : String(f).startsWith('/') ? String(f) : `/themes/${id}/${f}`);
      const states = [t.couple?.states, t.mc?.states].filter(Boolean).flatMap(o => Object.values(o));
      list.push({
        id,
        name: String(t.name || id).slice(0, 60),
        legacy: Boolean(t.legacy),
        hasVideo: states.some(x => x && x.video) || Boolean(t.walker && Object.values(t.walker).some(w => w && w.video)),
        guests: (t.guests?.male?.length || 0) + (t.guests?.female?.length || 0),
        backgrounds: (Array.isArray(t.backgrounds) ? t.backgrounds : []).slice(0, 30).map(b => ({
          id: String(b.id).slice(0, 40),
          name: String(b.name || b.id).slice(0, 40),
          src: url(b.src),
          thumb: url(b.thumb || b.src)
        }))
      });
    } catch {}
  }
  list.sort((a, b) => (a.legacy - b.legacy) || a.name.localeCompare(b.name, 'vi'));
  themeCache = { at: Date.now(), list };
  return list;
}

function sanitizeThemeConfig(c) {
  const themes = listThemes();
  const t = themes.find(x => x.id === c.theme) || themes.find(x => !x.legacy) || themes[0];
  c.theme = t ? t.id : 'co-dien';
  const bgIds = t ? t.backgrounds.map(b => b.id) : [];
  if (!bgIds.includes(c.themeBackground)) c.themeBackground = bgIds[0] || '';
  c.themeVideo = c.themeVideo !== false;
  c.themeScenes = c.themeScenes !== false;
  c.sizeCouple = clampNum(c.sizeCouple, 50, 160, 100);
  c.sizeMC = clampNum(c.sizeMC, 50, 160, 100);
  c.sizeGuest = clampNum(c.sizeGuest, 50, 160, 100);
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

// ----- BOT LẤP RẠP -----
// Khách ảo đi lại, nói vài câu cho rạp đỡ trống lúc vắng. Bot KHÔNG tham gia tiệc cưới: không được chọn làm cô dâu /
// chú rể, không bắt hoa, không lên ảnh, không tính vào số khách, không được MC chào. Khách thật vào thì bot rút bớt;
// hết ghế thì bot nhường ghế trước.
const BOT_NAMES = {
  male: ['Gia Huy', 'Đức Minh', 'Quang Vinh', 'Tuấn Kiệt', 'Minh Khôi', 'Hữu Phước', 'Trung Kiên', 'Quốc Bảo', 'Nhật Minh', 'Đình Phong',
    'Hoàng Nam', 'Tiến Đạt', 'Công Thành', 'Xuân Trường', 'Việt Hoàng', 'Mạnh Cường', 'Đăng Khoa', 'Thế Anh', 'Duy Khánh', 'Sơn Tùng',
    'Phúc Lâm', 'Anh Tú', 'Hải Đăng', 'Chí Thanh', 'Bá Lộc', 'Thành Long', 'Minh Quân', 'Khải Nguyên', 'Trọng Nghĩa', 'Văn Toàn'],
  female: ['Bảo Anh', 'Khánh Linh', 'Thùy Dương', 'Hà My', 'Ngọc Ánh', 'Thanh Hằng', 'Diệu Linh', 'Yến Nhi', 'Mỹ Duyên', 'Phương Anh',
    'Cẩm Tú', 'Thu Hà', 'Bích Ngọc', 'Kiều Trang', 'Hồng Nhung', 'Tường Vy', 'Lan Hương', 'Quỳnh Như', 'Ngân Hà', 'Trà My',
    'Thảo Nguyên', 'Kim Oanh', 'Như Ý', 'Vân Anh', 'Mai Chi', 'Gia Hân', 'Minh Thư', 'Bảo Trâm', 'Thanh Trúc', 'Ánh Dương']
};
const BOT_TAGS = ['✨ Khách quý', '✨ Khách quý', '🍗 Ăn cỗ', '🥂 Cụng ly', '👀 Hóng biến', '💍 Xin vía'];
let lastBotSwap = Date.now();

function botTarget() {
  if (state.config.botsEnabled !== true) return 0;
  const real = state.people.filter(p => !p.bot).length;
  return Math.max(0, Math.min(clampNum(state.config.botsCount, 1, 80, 20), maxSeats()) - real);
}
function addBot() {
  const used = new Set(state.people.map(x => x.table));
  const seat = SEAT_ORDER.filter(n => n < maxSeats()).find(n => !used.has(n));
  if (seat === undefined) return false;
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const taken = new Set(state.people.map(p => p.name));
  const names = BOT_NAMES[gender].filter(n => !taken.has(n));
  if (!names.length) return false;
  const tag = pick(BOT_TAGS);
  state.people.push({
    id: `tik-bot-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: pick(names), avatar: '', gender, sprite: Math.floor(Math.random() * 1000),
    table: seat, seat: 0, baseTag: tag, statusTag: tag, lastSeen: 0, bot: true
  });
  return true;
}
function removeBot() {
  const bots = state.people.filter(p => p.bot);
  if (!bots.length) return false;
  const out = pick(bots);
  state.people = state.people.filter(p => p !== out);
  return true;
}
// Thêm / bớt từ từ (mỗi nhịp tối đa 2 người) cho giống khách ra vào; tắt bot thì cho ra hết ngay
setInterval(() => {
  const have = state.people.filter(p => p.bot).length;
  const want = botTarget();
  let changed = false;
  if (state.config.botsEnabled !== true && have) {
    state.people = state.people.filter(p => !p.bot);
    changed = true;
  } else if (have > want) {
    for (let i = 0; i < Math.min(2, have - want); i++) changed = removeBot() || changed;
  } else if (have < want) {
    for (let i = 0; i < Math.min(2, want - have); i++) changed = addBot() || changed;
  } else if (want > 0 && Date.now() - lastBotSwap > 30000) {
    // Thỉnh thoảng một bot ra về, một bot khác bước vào
    lastBotSwap = Date.now() + Math.random() * 20000;
    changed = removeBot() && addBot();
  }
  if (changed) {
    persistState();
    broadcastState();
  }
}, 1500);

// ----- DANH HIỆU THEO VIỆC KHÁCH LÀM -----
// Mỗi danh hiệu một người giữ: người làm việc đó nhiều nhất (bằng nhau thì người làm gần đây hơn).
// Người giữ danh hiệu được đứng hàng đầu sát sân khấu với thẻ tên vàng (overlay: p.vip = thứ tự danh hiệu).
const RICH_MIN_COINS = 20;
const FEAT_TITLES = [
  { key: 'rich', title: '💰 Đại Gia Đám Cưới' },            // tổng xu mừng cao nhất
  { key: 'dongphong', title: '🏮 Thần Động Phòng', min: 1 }, // tặng quà cho đôi trẻ động phòng
  { key: 'cancel', title: '💔 Trùm Phá Đám', min: 1 },       // tặng quà hủy hôn, phá đám
  { key: 'steal', title: '⚔️ Trùm Cướp Vai', min: 1 },       // cướp / thay cô dâu, chú rể
  { key: 'wed', title: '💍 Nghiện Cưới', min: 2 },           // lên xe hoa nhiều lần
  { key: 'fireworks', title: '🎆 Vua Pháo Hoa', min: 1 }     // tặng quà bắn pháo hoa
];
let featOwners = null; // danh hiệu -> người đang giữ (để báo khi đổi chủ)

function feat(id, name, kind) {
  const key = String(id || '');
  if (!key || key === 'unknown') return;
  const f = state.feats[key] || (state.feats[key] = { name: name || 'Khách' });
  f[kind] = (f[kind] || 0) + 1;
  f.name = name || f.name;
  f.at = Date.now();
  const keys = Object.keys(state.feats);
  if (keys.length > 600) delete state.feats[keys[0]];
}
function featHolders() {
  const out = [];
  FEAT_TITLES.forEach((t, slot) => {
    let best = null;
    if (t.key === 'rich') {
      for (const s of Object.values(state.scores)) {
        if (s.total >= RICH_MIN_COINS && (!best || s.total > best.n)) best = { k: String(s.id).replace(/^tik-/, ''), n: s.total, name: s.name };
      }
    } else {
      for (const [k, f] of Object.entries(state.feats)) {
        const n = Number(f[t.key]) || 0;
        if (n >= t.min && (!best || n > best.n || (n === best.n && f.at > best.at))) best = { k, n, at: f.at, name: f.name };
      }
    }
    if (best) out.push({ key: t.key, title: t.title, slot, k: best.k, name: best.name });
  });
  return out;
}

// Tính lại nhãn dưới tên khách: vai > danh hiệu theo việc đã làm > danh hiệu đặc biệt > hạng tương tác > nhãn sự kiện
function refreshTags() {
  const now = Date.now();
  const feats = featHolders();
  const owners = Object.fromEntries(feats.map(h => [h.key, h.k]));
  if (featOwners) {
    for (const h of feats) {
      if (featOwners[h.key] !== h.k && state.people.some(p => p.id === 'tik-' + h.k)) {
        broadcast('activity', { type: 'title', id: 'tik-' + h.k, name: h.name, title: h.title, vip: true });
      }
    }
  }
  featOwners = owners;
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
    let vip = null;
    const mine = feats.find(h => h.k === k); // danh hiệu xếp trên cùng mà người này đang giữ
    if (state.roles.groom?.id === k) tag = '🤵 Chú rể';
    else if (state.roles.bride?.id === k) tag = '👰 Cô dâu';
    else if (mine) { tag = mine.title; vip = mine.slot; }
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
    if ((p.vip ?? null) !== vip) {
      if (vip === null) delete p.vip;
      else p.vip = vip;
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

// ========================================================
// KÈO ĐẤU & CỬA PHỤC THÙ: A bị B cướp vai thì A có REVENGE_MS để tặng quà đòi lại (màn hình LIVE gọi tên A, đếm giờ).
// Hai người giành qua giành lại thì đếm tỉ số "hiệp mấy, ai dẫn" cho cả rạp hóng. Chỉ nhớ trong phiên, không lưu file.
// ========================================================
const REVENGE_MS = 25000;
const DUEL_TTL_MS = 10 * 60 * 1000;
const duels = new Map(); // "idA|idB" -> { wins: { id: số lần thắng }, at }
let revenge = null;      // { role, loser, winner, until, round, loserWins, winnerWins }

function recordSteal(role, winner, loser) {
  const w = String(winner?.id || '');
  const l = String(loser?.id || '');
  if (!w || !l || w === l || loser.host) return null;
  const now = Date.now();
  const key = [w, l].sort().join('|');
  let d = duels.get(key);
  if (!d || now - d.at > DUEL_TTL_MS) d = { wins: {}, at: now };
  d.wins[w] = (d.wins[w] || 0) + 1;
  d.at = now;
  d.role = role;
  duels.set(key, d);
  if (duels.size > 200) duels.delete(duels.keys().next().value);
  // Người vừa bị đá quay lại đá đúng người đã đá mình, còn trong giờ phục thù
  const wasRevenge = Boolean(revenge && revenge.until > now && revenge.loser.id === w && revenge.winner.id === l);
  const winnerWins = d.wins[w];
  const loserWins = d.wins[l] || 0;
  revenge = {
    role,
    loser: { id: l, name: loser.name || 'Khách', avatar: loser.avatar || '' },
    winner: { id: w, name: winner.name || 'Khách', avatar: winner.avatar || '' },
    until: now + REVENGE_MS, round: winnerWins + loserWins, winnerWins, loserWins
  };
  return { revenge: wasRevenge, round: revenge.round, winnerWins, loserWins, seconds: Math.round(REVENGE_MS / 1000) };
}
// Cửa phục thù còn mở: người thắng vẫn giữ đúng vai đó, người thua chưa lên vai nào, chưa vào lễ
function activeRevenge() {
  const r = revenge;
  if (!r || r.until <= Date.now()) return null;
  if (!['idle', 'countdown'].includes(state.ceremony.phase)) return null;
  if (state.roles[r.role]?.id !== r.winner.id) return null;
  if (['groom', 'bride'].some(x => state.roles[x]?.id === r.loser.id)) return null;
  return r;
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
    return { role, became: true, previous, bid, duel: holder ? recordSteal(role, { ...user, id: key }, holder) : null };
  }
  return { role, became: false, bid, needed, missing: needed - bid, holder: holder?.name || '' };
}

const isQueue = () => state.config.roleSystem === 'queue';
// Luật "quà vào vai" có hai kiểu khi vai đang có người: xếp hàng chờ tới lượt (roleQueue = true, kiểu cũ),
// hoặc KHÔNG hàng chờ (mặc định): tặng quà nhận vai là lên vai ngay, đá người đang giữ; bình luận chỉ nhận được vai còn trống
const queueOn = () => isQueue() && state.config.roleQueue === true;

function setRole(role, user, bid) {
  state.roles[role] = { id: String(user.id), name: user.name || 'Khách', avatar: user.avatar || '', bid: Number(bid) || 0, at: Date.now() };
  alignGender(user.id, role);
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
  return { role, became: true, replaced: Boolean(holder), previous: holder?.name || '', bid, duel: holder ? recordSteal(role, { ...user, id: key }, holder) : null };
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
// GHÉP ĐÔI NGẪU NHIÊN: vai trống quá autoPairSeconds mà không ai tặng quà nhận
// -> MC chọn ngẫu nhiên khách trong rạp lên vai còn thiếu
// ========================================================
// Mỗi lần app khởi động lại có mã mới: màn hình LIVE thấy mã đổi thì tự tải lại để dùng giao diện mới
const SERVER_BUILD = String(Date.now());
const PAIR_AFTER_WEDDING_MS = 10000; // vừa cưới xong: để ảnh cưới hiện xong rồi mới đếm giờ ghép đôi lượt mới
const PAIR_AFTER_TURN_MS = 3000;     // đôi trước vừa rời sân khấu: chờ cảnh chuyển xong rồi mới đếm giờ ghép đôi
let lastTurnEndAt = 0;
const PAIR_REVEAL_MS = 3600;         // khớp overlay: thẻ vai quay tên xong mới lên vai (không lộ tên trước)
const pairing = { startedAt: 0, warned: false, retryAt: 0, applying: false, anchor: 0 };

// Người thật (tặng quà / bình luận nhận vai) đang đứng một mình chờ nửa kia
function loneRealHolder() {
  const held = ['groom', 'bride'].filter(r => state.roles[r]);
  return held.length === 1 && realHolder(held[0]) ? { role: held[0], ...state.roles[held[0]] } : null;
}
// Sân khấu trống / người MC chọn đang chờ: autoPairSeconds. Người thật đang chờ nửa kia: partnerWaitSeconds
// (đủ lâu để khách khác kịp tặng quà giành vai, nhưng không bắt người đã tặng quà đứng chờ mãi).
function pairWaitMs() {
  if (loneRealHolder()) return clampNum(state.config.partnerWaitSeconds, 10, 600, 90) * 1000;
  return clampNum(state.config.autoPairSeconds, 5, 600, 8) * 1000;
}
// Mốc bắt đầu đếm: lúc vai trống, hoặc lúc người thật vừa nhận vai (đếm lại từ đầu cho người đó)
function pairAnchor() {
  return Math.max(pairing.startedAt, Number(loneRealHolder()?.at) || 0);
}
// Người thật tự nhận vai (bình luận / tặng quà), không phải do MC chọn ngẫu nhiên.
// Người được MC chọn mà sau đó tặng quà giữ ngôi thì cũng tính là người thật.
function realHolder(role) {
  const h = state.roles[role];
  return Boolean(h && (!h.random || h.bid > 0));
}
function pairingOpen() {
  const c = state.config;
  if (c.autoPair === false || c.enableMarryAuction === false || state.ceremony.phase !== 'idle' || !overlayClients.size || pairing.applying) return false;
  if (Date.now() - (Number(state.marriages[0]?.at) || 0) < PAIR_AFTER_WEDDING_MS) return false;
  if (Date.now() - lastTurnEndAt < PAIR_AFTER_TURN_MS) return false;
  // Đã có cô dâu / chú rể thật mà vai kia trống: vẫn đếm giờ (partnerWaitSeconds) rồi MC chọn ngẫu nhiên nửa kia
  // Còn vai trống (không có ai xếp hàng chờ vai đó) thì đếm giờ. Chưa ai nhận vai nào: hết giờ MC mời một khách
  // lên trước; người đó do MC chọn: hết giờ MC chọn nốt người còn lại
  return openRoles().some(r => !state.roles[r] && !(isQueue() && state.queue[r].length));
}
function pairingRemainingMs() {
  return pairing.startedAt ? Math.max(0, pairAnchor() + pairWaitMs() - Date.now()) : 0;
}

// Ưu tiên khách còn đang tương tác, đúng giới tính nhân vật, chưa thành đôi ở lượt trước
// TikTok không báo khi người xem rời phòng, nên "còn ở trong phòng" = vừa có mặt (vào phòng, bình luận, thả tim,
// tặng quà...) trong vòng PRESENT_MS. Ai im lặng lâu hơn thì coi như đã rời đi: không được MC chọn lên vai.
const PRESENT_MS = 3 * 60 * 1000;
const isPresent = p => Date.now() - (Number(p?.lastSeen) || 0) <= PRESENT_MS;

function randomGuest(role, taken, takenNames) {
  const recent = Date.now() - PRESENT_MS;
  const want = role === 'groom' ? 'male' : 'female';
  // Không ghép 2 người trùng tên hiển thị (khán giả sẽ thấy "A & A")
  const pool = state.people.filter(p => !p.bot && !taken.has(p.id) && !takenNames.has(p.name));
  const active = p => (Number(p.lastSeen) || 0) >= recent;
  const fresh = p => !/thành đôi/i.test(p.baseTag || '');
  const tiers = [
    pool.filter(p => p.gender === want && active(p) && fresh(p)),
    pool.filter(p => active(p) && fresh(p)),
    pool.filter(p => p.gender === want && active(p)),
    pool.filter(active)
  ];
  const list = tiers.find(t => t.length) || [];
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

// Tên chủ phòng: nhập trong bảng điều khiển, không có thì lấy @id TikTok khi đã kết nối TikFinity Desktop
function hostName() {
  return String(state.config.hostName || '').trim().slice(0, 40) || (state.status?.username ? '@' + state.status.username : '');
}

function runAutoPair() {
  const taken = holderIds();
  const takenNames = new Set(['groom', 'bride'].map(r => state.roles[r]?.name).filter(Boolean));
  const picks = [];
  const empty = openRoles().filter(r => !state.roles[r] && !(isQueue() && state.queue[r].length));
  // Chưa ai nhận vai nào: chỉ mời một người lên trước (khách nữ làm cô dâu, khách nam làm chú rể),
  // người còn lại để khách tặng quà giành, hết giờ lượt sau mới chọn tiếp
  const single = state.config.pairBoth === false && empty.length > 1 && openRoles().every(r => !state.roles[r]);
  const roles = single ? [empty[Math.floor(Math.random() * empty.length)]] : empty;
  for (let role of roles) {
    const p = randomGuest(role, taken, takenNames);
    if (p) {
      if (single) role = p.gender === 'female' && empty.includes('bride') ? 'bride' : empty.includes('groom') ? 'groom' : role;
      taken.add(p.id);
      takenNames.add(p.name);
      picks.push({ role, id: p.id.replace(/^tik-/, ''), name: p.name, avatar: p.avatar || '' });
      continue;
    }
    // Rạp chưa có khách nào để chọn: mời chủ phòng lên vai
    const host = hostName();
    if (host && !takenNames.has(host) && !taken.has('tik-host')) {
      taken.add('tik-host');
      takenNames.add(host);
      picks.push({ role, id: 'host', name: host, avatar: '', host: true });
    }
  }
  if (!picks.length) return false;
  const name = r => picks.find(p => p.role === r)?.name || displayName(r);
  const v = { ...baseVars(), groom: name('groom'), bride: name('bride') };
  const one = picks[0];
  const hostPick = picks.find(p => p.host);
  const other = r => ROLE_LABEL[r === 'groom' ? 'bride' : 'groom'];
  const line = single && !hostPick
    ? pickLine('firstPick', { ...v, name: one.name, role: ROLE_LABEL[one.role], other: other(one.role) })
    : hostPick
    ? pickLine('hostPick', { ...v, name: hostPick.name, role: ROLE_LABEL[hostPick.role], partner: name(hostPick.role === 'groom' ? 'bride' : 'groom') })
    : picks.length > 1
      ? pickLine('randomPair', v)
      : pickLine('randomRole', { ...v, name: one.name, role: ROLE_LABEL[one.role], partner: name(one.role === 'groom' ? 'bride' : 'groom') });
  broadcast('action', { action: 'random_pair', picks: picks.map(({ role, name, avatar }) => ({ role, name, avatar })), line });
  markMc();
  const realAtStart = realHolder('groom') || realHolder('bride');
  // Màn hình LIVE quay tên trên thẻ vai trước, quay xong mới lên vai (ai tặng quà nhận vai trong lúc quay thì giữ người đó)
  pairing.applying = true;
  setTimeout(() => {
    pairing.applying = false;
    let changed = false;
    // Trong lúc thẻ vai đang quay mới có người thật nhận vai: bỏ lượt ghép ngẫu nhiên này (người đó được đếm giờ chờ riêng)
    const realNow = !realAtStart && (realHolder('groom') || realHolder('bride'));
    for (const p of picks) {
      if (realNow || state.roles[p.role] || state.ceremony.phase !== 'idle' || holderIds().has('tik-' + p.id)) continue;
      setRole(p.role, p, 0);
      state.roles[p.role].random = true;
      if (p.host) state.roles[p.role].host = true;
      changed = true;
    }
    if (!changed) return broadcastState(); // vẽ lại thẻ vai (đang hiện tên vừa quay ra)
    evaluateCeremony(true);
    persistState();
    broadcastState();
  }, PAIR_REVEAL_MS);
  return true;
}

// Một người giữ vai (tự nhận hoặc được MC chọn) mà đã rời phòng, nửa kia mãi chưa có: mở lại vai đó,
// không để sân khấu đứng chờ một người không còn xem.
const LONE_HOLDER_MS = 40000;
function releaseAbsentHolder() {
  if (state.ceremony.phase !== 'idle' || state.config.enableMarryAuction === false || pairing.applying) return false;
  const held = openRoles().filter(r => state.roles[r]);
  if (held.length !== 1 || openRoles().length < 2) return false;
  const role = held[0];
  const h = state.roles[role];
  if (h.host || Date.now() - (Number(h.at) || 0) < LONE_HOLDER_MS) return false;
  const person = state.people.find(p => p.id === 'tik-' + h.id);
  if (person && isPresent(person)) return false;
  state.roles[role] = null;
  state.bids[role] = {};
  if (person) person.baseTag = '✨ Khách quý';
  // Màn hình LIVE: người này quay mòng mòng rồi văng khỏi sân khấu
  broadcast('action', { action: 'role_kick', role, name: h.name, avatar: h.avatar || '', line: pickLine('holderLeft', { ...baseVars(), name: h.name, role: ROLE_LABEL[role] }) });
  markMc();
  if (isQueue()) announcePromoted(promoteQueue());
  persistState();
  broadcastState();
  return true;
}

setInterval(() => {
  releaseAbsentHolder();
  if (!pairingOpen()) {
    if (pairing.startedAt) {
      pairing.startedAt = 0;
      broadcastState();
    }
    return;
  }
  if (!pairing.startedAt) {
    Object.assign(pairing, { startedAt: Date.now(), warned: false, retryAt: 0 });
    broadcastState();
    return;
  }
  const anchor = pairAnchor();
  if (anchor !== pairing.anchor) {   // mốc đếm đổi (vừa có người thật nhận vai): đếm lại, nhắc lại
    Object.assign(pairing, { anchor, warned: false, retryAt: 0 });
    broadcastState();
  }
  const left = pairingRemainingMs();
  if (!pairing.warned && left <= 15000 && pairWaitMs() >= 30000) {
    pairing.warned = true;
    const lone = loneRealHolder();
    const seconds = Math.ceil(left / 1000);
    mcSay(lone
      ? pickLine('partnerSoon', { ...baseVars(), seconds, name: lone.name, role: ROLE_LABEL[lone.role], other: ROLE_LABEL[lone.role === 'groom' ? 'bride' : 'groom'] })
      : pickLine('pairSoon', { ...baseVars(), seconds }), 'event');
  }
  if (left > 0 || Date.now() < pairing.retryAt) return;
  if (runAutoPair()) pairing.startedAt = 0;
  else pairing.retryAt = Date.now() + 10000; // chưa có khách nào trong rạp: 10 giây sau thử lại
}, 1000);

// ========================================================
// LỄ THÀNH HÔN TỰ ĐỘNG
// ========================================================
let ceremonyTimer = null;
const pendingRoleGifts = [];

// ----- SỔ CƯỚI: ai đã cưới ai, mấy lần — để MC "bóc phốt" khi họ lên xe hoa lần nữa -----
// state.wedLog[id] = { name, n: tổng số lần cưới, last: { id, name } người cưới gần nhất, with: { idNgườiKia: số lần } }
function logWedding(g, b) {
  if (!g || !b) return;
  for (const [me, other] of [[g, b], [b, g]]) {
    const e = state.wedLog[me.id] || (state.wedLog[me.id] = { name: me.name, n: 0, with: {} });
    e.name = me.name;
    e.n++;
    e.last = { id: other.id, name: other.name };
    e.with[other.id] = (e.with[other.id] || 0) + 1;
  }
  const keys = Object.keys(state.wedLog);
  if (keys.length > 500) delete state.wedLog[keys[0]];
}
// Hai người từng đá nhau giành vai, giờ lại thành một đôi: "từ kẻ thù thành vợ chồng". Mỗi cặp chỉ bóc một lần.
function rivalsGossip(seconds) {
  const g = state.roles.groom;
  const b = state.roles.bride;
  if (!g || !b) return null;
  const d = duels.get([String(g.id), String(b.id)].sort().join('|'));
  if (!d || d.told) return null;
  d.told = true;
  const role = ROLE_LABEL[d.role] || 'chú rể';
  const rounds = Object.values(d.wins).reduce((a, n) => a + n, 0);
  return {
    kind: 'rivals', pair: `${g.id}|${b.id}`,
    kicker: '🥊 TỪ KẺ THÙ THÀNH VỢ CHỒNG!', title: `${g.name} 💘 ${b.name}`,
    subtitle: `Mới nãy còn đá nhau giành ghế ${role}, giờ quay qua cưới nhau luôn!`,
    line: pickLine('rivalsWed', { ...baseVars(), seconds, role, rounds })
  };
}
// Bóc phốt sau khi bảng "thay vai / vai mới" đã tắt, nếu vẫn đúng đôi đó và chưa vào lễ
function gossipLater(tea, delayMs = 7500) {
  setTimeout(() => {
    if (state.ceremony.phase !== 'countdown' || `${state.roles.groom?.id}|${state.roles.bride?.id}` !== tea.pair) return;
    broadcast('action', { action: 'gossip', ...tea });
    markMc();
  }, delayMs);
}
function gossipLine(seconds) {
  const g = state.roles.groom;
  const b = state.roles.bride;
  if (!g || !b) return null;
  const rivals = rivalsGossip(seconds);
  if (rivals) return rivals;
  const v = { ...baseVars(), seconds };
  const before = Number(state.wedLog[g.id]?.with?.[b.id]) || 0;
  if (before > 0) {
    const times = before + 1;
    return {
      kind: 'again', title: `😱 ${g.name} & ${b.name}: CƯỚI LẦN THỨ ${times}!`, subtitle: `Cặp này đã cưới nhau ${before} lần rồi đó bà con!`,
      line: pickLine('coupleAgain', { ...v, before, times })
    };
  }
  const exOf = (me, now) => { const last = state.wedLog[me.id]?.last; return last && last.id !== now.id ? last.name : ''; };
  const brideEx = exOf(b, g);
  const groomEx = exOf(g, b);
  const brideFirst = brideEx && (!groomEx || Math.random() < 0.5);
  if (brideFirst) {
    return {
      kind: 'switch', title: `💔 ${b.name} BỎ ${brideEx} ĐỂ CƯỚI ${g.name}!`, subtitle: `Rồi luôn! Cô dâu vừa cưới ${brideEx} xong đó nha!`,
      line: pickLine('brideSwitched', { ...v, ex: brideEx })
    };
  }
  if (groomEx) {
    return {
      kind: 'switch', title: `💔 ${g.name} BỎ ${groomEx} ĐỂ CƯỚI ${b.name}!`, subtitle: `Rồi luôn! Chú rể vừa cưới ${groomEx} xong đó nha!`,
      line: pickLine('groomSwitched', { ...v, ex: groomEx })
    };
  }
  return null;
}

const stageBusy = () => state.ceremony.phase === 'running' || state.ceremony.phase === 'reception';

function evaluateCeremony(roleChanged = false) {
  const c = state.ceremony;
  if (stageBusy()) return;
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
    let secs = clampNum(state.config.ceremonyCountdown, 5, 600, 20);
    const tea = gossipLine(secs);
    const later = tea?.kind === 'rivals' && roleChanged; // vừa có người lên vai: bảng "cô dâu / chú rể mới" hiện trước, bóc phốt sau
    if (later) secs = Math.max(secs, 18);
    state.ceremony = { phase: 'countdown', endsAt: Date.now() + secs * 1000 };
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(() => startCeremony(), secs * 1000);
    broadcastState();
    if (later) {
      gossipLater(tea);
    } else if (tea) {
      // Cặp này có "chuyện cũ": bảng tin giật gân + lời MC riêng thay cho câu đủ đôi thường lệ
      broadcast('action', { action: 'gossip', ...tea });
      markMc();
    } else {
      mcSay(pickLine('countdownStart', { ...baseVars(), seconds: secs }), 'event');
    }
  } else if (roleChanged) {
    // Cướp vai phút chót -> gia hạn thêm 10 giây cho kịch tính; có người vừa bị đá thì giữ đồng hồ tới hết giờ phục thù của họ
    const rv = activeRevenge();
    // Đôi mới ghép lại là hai người từng đá nhau giành vai: chờ bảng "thay vai" tắt rồi bóc phốt, giữ đồng hồ đủ lâu để kịp xem
    const tea = rivalsGossip(16);
    if (tea) gossipLater(tea);
    const minLeft = Math.max(10000, rv ? rv.until - Date.now() + 1500 : 0, tea ? 18000 : 0);
    if (c.endsAt - Date.now() < minLeft) {
      c.endsAt = Date.now() + minLeft;
      clearTimeout(ceremonyTimer);
      ceremonyTimer = setTimeout(() => startCeremony(), minLeft);
      broadcastState();
    }
  }
}

// Ba kiểu lễ:
//   wed   — chỉ làm lễ thành hôn (mở lễ, trao nhẫn, tuyên bố). Sau đó là "tiệc mừng": đôi trẻ ở lại sân khấu,
//           hôn / cắt bánh / rót rượu / động phòng... chỉ diễn ra khi khách tặng quà (mặc định)
//   auto  — tự chạy đủ các bước rồi động phòng (kiểu cũ, chọn trong bảng điều khiển)
//   quick — quà "động phòng luôn": vào thẳng động phòng. finale = đôi này đã thành hôn rồi (quà tặng trong tiệc mừng)
function startCeremony({ quick = false, initiator = '', finale = false, demo = false } = {}) {
  if (state.ceremony.phase === 'running') return false;
  if (state.ceremony.phase === 'reception' && !(quick && finale)) return false; // đôi này vừa cưới xong, chỉ còn động phòng
  clearTimeout(ceremonyTimer);
  const mode = quick ? 'quick' : state.config.ceremonySteps === 'auto' ? 'auto' : 'wed';
  const ms = { quick: CEREMONY_QUICK_MS, auto: CEREMONY_MS, wed: CEREMONY_WED_MS }[mode];
  state.ceremony = { phase: 'running', endsAt: Date.now() + ms, quick, mode, married: finale };
  const v = { ...baseVars(), name: initiator || 'MC' };
  const keys = {
    quick: ['quickwed', 'dongphong', 'dongphongEnd', 'ceremonyEnd'],
    auto: ['ceremonyStart', 'ring', 'kiss', 'cake', 'champagne', 'dongphong', 'dongphongEnd', 'ceremonyEnd'],
    wed: ['ceremonyStart', 'ring', 'wedDone']
  }[mode];
  const lines = {};
  for (const k of keys) lines[k] = pickLine(k, v);
  if (quick) lines.ceremonyStart = demo ? pickLine('demoDongphong', { ...v, gift: ruleGiftName(['dongphong', 'quickwed']) || 'quà động phòng' }) : lines.quickwed;
  broadcast('action', { action: 'ceremony', quick, mode, finale, initiator, ms, ...coupleInfo(), lines });
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
  const cer = state.ceremony;
  // Thành hôn: tính cặp đôi, chụp ảnh cưới (đôi đã cưới từ trước — quà động phòng trong tiệc mừng — thì không tính lại)
  if (!cer.married) {
    const couple = coupleInfo();
    state.stats.couples = (state.stats.couples || 0) + 1;
    state.marriages = [{ groom: couple.groom, bride: couple.bride, at: Date.now() }, ...state.marriages].slice(0, 10);
    for (const r of ['groom', 'bride']) if (state.roles[r]) feat(state.roles[r].id, state.roles[r].name, 'wed');
    logWedding(state.roles.groom, state.roles.bride);
    schedulePartyForCouples(state.stats.couples);
    const photo = state.config.photoAfterCeremony !== false ? makePhoto('wedding') : null;
    if (photo) broadcast('photo', photo);
  }
  if (cer.mode === 'wed') {
    // Không hàng chờ: đã có người tặng quà giành vai ngay trong lúc làm lễ thì bỏ tiệc mừng, cho họ lên vai luôn
    if (pendingRoleGifts.some(g => g.direct)) return endTurn({ quiet: true });
    return startReception();
  }
  endTurn();
}

// ----- MC ĐÃI KHI RẠP VẮNG: lâu không ai tặng quà thì MC tự chạy một hiệu ứng miễn phí cho rạp đỡ buồn.
// Màn hình ghi rõ "MC đãi" (không giả làm khách tặng quà) và MC nói lần sau muốn xem thì tặng quà nào.
let lastGiftAt = Date.now();
let lastTreatAt = Date.now();
const TREATS = [
  { action: 'fireworks', effect: 'pháo hoa', label: 'PHÁO HOA', actions: ['fireworks'] },
  { action: 'petal', effect: 'mưa hoa hồng', label: 'MƯA HOA HỒNG', actions: ['petal'] },
  { action: 'dance', effect: 'cả rạp quẩy', label: 'CẢ RẠP QUẨY', actions: ['dance'] },
  { action: 'cheers', effect: 'cụng ly', label: 'CỤNG LY', actions: ['cheers', 'champagne'] }
];
let treatIdx = Math.floor(Math.random() * TREATS.length);
setInterval(() => {
  const quietMs = clampNum(state.config.treatQuietSeconds, 0, 3600, 60) * 1000;
  if (!quietMs || !overlayClients.size || pairing.applying) return;
  if (['running'].includes(state.ceremony.phase)) return;
  const now = Date.now();
  if (now - lastGiftAt < quietMs || now - lastTreatAt < quietMs || now - lastMcAt < 5000) return;
  lastTreatAt = now;
  const t = TREATS[treatIdx++ % TREATS.length];
  const gift = ruleGiftName(t.actions) || 'quà';
  broadcast('action', {
    action: t.action, name: 'MC', initiator: 'MC', treat: { label: t.label, gift },
    line: pickLine('treatQuiet', { ...baseVars(), effect: t.effect, gift })
  });
  markMc();
}, 2000);

// ----- TIỆC QUẨY: cứ đủ partyEvery cặp cưới thì cả rạp đứng dậy quẩy (đợi ảnh cưới đóng rồi mới mở tiệc)
const PARTY_AFTER_WEDDING_MS = 9000;
function partyEvery() { return clampNum(state.config.partyEvery, 0, 100, 5); }
function couplesToParty() {
  const every = partyEvery();
  return every ? every - ((Number(state.stats.couples) || 0) % every) : 0;
}
function schedulePartyForCouples(n) {
  const every = partyEvery();
  if (!every || n % every) return;
  setTimeout(() => {
    broadcast('action', { action: 'dance', initiator: 'Cả rạp', big: true, partyCouples: n, line: pickLine('partyCouples', { ...baseVars(), couples: n }) });
    markMc();
  }, PARTY_AFTER_WEDDING_MS);
}

// ----- MC ĐÃI: thỉnh thoảng (trung bình demoEvery lượt cưới một lần) cho xem miễn phí pháo hoa hoặc động phòng
// để người mới vào biết rạp có gì; MC nói luôn lần sau muốn xem thì tặng quà nào. Hai món luân phiên nhau.
const DEMO_FIREWORKS_AT = 6000; // sau khi vào tiệc mừng chừng này thì bắn (ảnh cưới đã đóng)
const demo = { since: 0, next: 0, last: '' };
function demoDue() {
  const every = clampNum(state.config.demoEvery, 0, 100, 8);
  if (!every) return '';
  const jitter = () => Math.max(2, every + Math.floor(Math.random() * 4) - 1); // every-1 .. every+2
  if (!demo.next) demo.next = jitter();
  if (++demo.since < demo.next) return '';
  demo.since = 0;
  demo.next = jitter();
  demo.last = demo.last === 'fireworks' ? 'dongphong' : 'fireworks';
  return demo.last;
}

// Tiệc mừng: đôi vừa cưới ở lại sân khấu chờ khách tặng quà. Hết giờ mà không ai cho động phòng thì đôi trẻ chào rồi rời sân khấu.
function startReception() {
  const ms = clampNum(state.config.receptionSeconds, 8, 600, 25) * 1000;
  const now = Date.now();
  state.ceremony = { phase: 'reception', endsAt: now + ms, startedAt: now, demo: demoDue() };
  if (state.ceremony.demo === 'fireworks') {
    setTimeout(() => {
      if (state.ceremony.phase !== 'reception' || state.ceremony.startedAt !== now) return;
      broadcast('action', {
        action: 'fireworks', name: 'MC',
        line: pickLine('demoFireworks', { ...baseVars(), gift: ruleGiftName(['fireworks']) || 'quà pháo hoa' })
      });
      markMc();
    }, Math.min(DEMO_FIREWORKS_AT, ms - 4000));
  } else if (Math.random() < 0.85) {
    // Thường thì MC rủ đôi vừa cưới kết bạn, nhắn tin cho nhau (bỏ qua nếu MC đang bận cảm ơn quà)
    const sayConnect = retry => {
      if (state.ceremony.phase !== 'reception' || state.ceremony.startedAt !== now) return;
      if (Date.now() - lastMcAt < 4500) {
        // MC vừa nói câu khác (cảm ơn quà, nhắc giờ): chờ thêm một nhịp, còn kịp thì nói
        if (retry && state.ceremony.endsAt - Date.now() > 9000) setTimeout(() => sayConnect(false), 5000);
        return;
      }
      // Một nửa số lần MC đọc thơ mừng đôi trẻ, còn lại rủ hai bạn kết bạn với nhau
      mcSay(pickLine(Math.random() < 0.5 ? 'poemWedding' : 'coupleConnect', baseVars()), 'event');
    };
    setTimeout(() => sayConnect(true), Math.min(8000, ms - 4000));
  }
  ceremonyTimer = setTimeout(endReception, ms);
  persistState();
  broadcastState();
}
// Có quà trong tiệc mừng: giữ đôi trẻ lại thêm để nghi thức kịp diễn ra (tối đa RECEPTION_MAX_MS)
function extendReception() {
  const c = state.ceremony;
  if (c.phase !== 'reception') return;
  const now = Date.now();
  const want = Math.min(c.startedAt + RECEPTION_MAX_MS, Math.max(c.endsAt + RECEPTION_GIFT_MS, now + 10000));
  if (want <= c.endsAt) return;
  c.endsAt = want;
  clearTimeout(ceremonyTimer);
  ceremonyTimer = setTimeout(endReception, want - now);
}
function endReception() {
  if (state.ceremony.phase !== 'reception') return;
  clearTimeout(ceremonyTimer);
  // Lượt được MC đãi động phòng: hết tiệc mừng mà chưa ai tặng quà động phòng thì MC cho đôi trẻ vào luôn
  if (state.ceremony.demo === 'dongphong' && startCeremony({ quick: true, initiator: 'MC', finale: true, demo: true })) return;
  state.ceremony = { phase: 'running', endsAt: Date.now() + FAREWELL_MS, mode: 'farewell', married: true };
  broadcast('action', { action: 'reception_end', ...coupleInfo(), line: pickLine('ceremonyEnd', baseVars()) });
  markMc();
  broadcastState();
  ceremonyTimer = setTimeout(endTurn, FAREWELL_MS);
}

// Đôi trẻ rời sân khấu: mở vai cho lượt mới
function endTurn({ quiet = false } = {}) {
  clearTimeout(ceremonyTimer);
  lastTurnEndAt = Date.now();
  resetRoles();
  state.ceremony = { phase: 'idle', endsAt: 0 };
  broadcast('action', { action: 'roles_open', silent: quiet });
  if (isQueue()) announcePromoted(promoteQueue());

  // Quà giành vai gửi trong lúc làm lễ (chế độ đấu giá) -> áp dụng cho lượt mới
  for (const g of pendingRoleGifts.splice(0)) {
    const r = g.direct ? replaceRole(g.user, g.role, g.coins) : applyRoleBid(g.user, g.role, g.coins);
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
  // Luật Hàng chờ: câu có bản riêng (vd introQueue) thì dùng bản đó, không nói "tặng từ 10 xu" của luật Đấu giá
  if (isQueue() && Array.isArray(state.config.mcLines?.[key + 'Queue'])) key += 'Queue';
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
  dongphong: 'tiễn cô dâu chú rể vào động phòng', quickwed: 'tiễn cô dâu chú rể vào động phòng',
  bouquet: 'cô dâu tung hoa cưới', fireworks: 'bắn pháo hoa', groom: 'làm chú rể', bride: 'làm cô dâu'
};
// Thứ tự MC kể "quà gì → làm gì": các bước sau lễ thành hôn trước (hôn, cắt bánh, động phòng). Quà nhận vai có câu riêng.
const SUMMARY_ORDER = ['kiss', 'cake', 'quickwed', 'dongphong', 'champagne', 'bouquet', 'fireworks', 'dance', 'petal', 'cheers', 'ring'];

// "Rose để mưa hoa hồng, Finger Heart để cô dâu chú rể hôn nhau, ..."
function giftsSummary() {
  const verbs = new Set();
  const parts = (state.config.giftRules || [])
    .filter(r => SUMMARY_ORDER.includes(r.action) && String(r.gifts || '').trim())
    .sort((a, b) => SUMMARY_ORDER.indexOf(a.action) - SUMMARY_ORDER.indexOf(b.action))
    .filter(r => !verbs.has(ACTION_VERB[r.action]) && verbs.add(ACTION_VERB[r.action]))
    .slice(0, 3)
    .map(r => {
      // MC đọc tiếng Việt: luật ghi cả tên Anh lẫn tên Việt ("heart me, thả tim") thì đọc tên Việt
      const names = String(r.gifts).split(',').map(x => x.trim()).filter(x => x && !x.startsWith('#'));
      const first = names.find(x => /[^\x00-\x7f]/.test(x)) || names[0] || 'quà';
      return `${first.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())} để ${ACTION_VERB[r.action]}`;
    });
  return parts.length ? parts.join(', ') : 'quà bất kỳ để chung vui cùng cô dâu chú rể';
}

// Tên quà đầu tiên của luật cho các hành động này (vd "Chú Heo May Mắn")
function ruleGiftName(actions) {
  const r = (state.config.giftRules || []).find(x => actions.includes(x.action) && String(x.gifts || '').trim());
  const first = r && String(r.gifts).split(',').map(x => x.trim()).find(x => x && !x.startsWith('#'));
  return first ? first.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : '';
}

// "tặng Nước Hoa để thay chú rể, Rosa để thay cô dâu, Hạc Giấy để phá đám" — theo luật đang dùng
function crashSummary() {
  const rules = state.config.giftRules || [];
  const giftOf = action => {
    const r = rules.find(x => x.action === action && String(x.gifts || '').trim());
    const names = r ? String(r.gifts).split(',').map(x => x.trim()).filter(x => x && !x.startsWith('#')) : [];
    const first = names.find(x => /[^\x00-\x7f]/.test(x)) || names[0];
    return first ? first.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : '';
  };
  const parts = [];
  if (!isQueue()) parts.push('tặng nhiều xu hơn để cướp vai');
  for (const [action, verb] of [['replaceGroom', 'thay chú rể'], ['replaceBride', 'thay cô dâu'], ['cancel', 'phá đám']]) {
    const g = giftOf(action);
    if (g) parts.push(`${parts.length ? '' : 'tặng '}${g} để ${verb}`);
  }
  return parts.length ? parts.join(', ') : 'tặng quà để giành vai';
}

function baseVars() {
  return {
    crashHow: crashSummary(),
    heldHow: queueOn() ? 'vai có người rồi thì xếp hàng chờ tới lượt' : 'vai có người rồi thì tặng quà là giành ngay, khỏi chờ',
    groom: displayName('groom'),
    bride: displayName('bride'),
    groomBid: state.roles.groom?.bid || 0,
    brideBid: state.roles.bride?.bid || 0,
    min: minCoins(),
    title: state.config.title || 'tiệc cưới',
    gifts: giftsSummary(),
    // Sau lễ thành hôn: chờ khách tặng quà (mặc định) hay tự chạy đủ các bước (kiểu cũ)
    afterWed: state.config.ceremonySteps === 'auto'
      ? 'Đủ đôi là có trao nhẫn, cắt bánh và động phòng hoa chúc luôn!'
      : `Cưới xong thì tặng ${giftsSummary()} nha!`,
    groomGift: ruleGiftName(['groom', 'role']) || 'quà',
    brideGift: ruleGiftName(['bride']) || 'quà',
    // Cách nhận vai: miễn phí thì bình luận, không thì tặng quà nhận vai
    groomHow: state.config.freeRoles && isQueue() ? 'bình luận chú rể' : `tặng ${ruleGiftName(['groom', 'role']) || 'quà'}`,
    brideHow: state.config.freeRoles && isQueue() ? 'bình luận cô dâu' : `tặng ${ruleGiftName(['bride']) || 'quà'}`
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
      const d = roleResult.duel;
      const dv = d && { ...vars, previous: roleResult.previous, role: roleLabel, round: d.round, a: d.winnerWins, b: d.loserWins, seconds: d.seconds };
      // Kèo đấu: phục thù thành công / giành qua giành lại từ hiệp 2 thì MC bình luận tỉ số; lần đầu thì khích người vừa bị đá
      if (d?.revenge) return pickLine(d.round >= 3 && Math.random() < 0.5 ? 'duelRound' : 'revengeDone', dv);
      if (d && d.round >= 2) return pickLine('duelRound', dv);
      const line = pickLine(key, { ...vars, previous: roleResult.previous, bid: roleResult.bid });
      return d ? `${line} ${pickLine('revengeCall', dv)}`.trim() : line;
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
  if (state.ceremony.phase === 'reception') {
    return pickLine('receptionRemind', { ...v, seconds: Math.max(1, Math.ceil((state.ceremony.endsAt - Date.now()) / 1000)) });
  }
  if (idleCount % 3 === 1) return pickLine('poemIdle', v); // đọc thơ cho rạp đỡ trống
  if (state.config.enableMarryAuction !== false && idleCount % 4 === 2) return pickLine('idleSocial', v); // rủ làm quen, kết bạn
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
    .filter(p => !p.bot && !exclude.has(p.id))
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
  const pool = state.people.filter(p => !p.bot && !keep.has(p.id) && p.id !== 'tik-' + excludeKey);
  const c = pool.length ? pick(pool) : null;
  if (!c) return null;
  c.baseTag = '💐 Bắt được hoa';
  return { id: c.id, name: c.name, avatar: c.avatar || '' };
}

// Kiểu tự đổi bài khi hết bài: shuffle (ngẫu nhiên, mặc định) | order (lần lượt) | off (lặp một bài)
function bgmRotate() {
  const r = state.config.bgm?.rotate;
  return ['order', 'shuffle', 'off'].includes(r) ? r : 'shuffle';
}

// Chuyển sang bài khác trong thư mục nhạc (quà "đổi nhạc", nút trên bảng điều khiển, hoặc tự đổi khi hết bài)
const recentTracks = [];
function nextTrack() {
  const b = state.config.bgm;
  if (!b || b.source === 'youtube') return null;
  const files = listMusic();
  if (!files.length) return null;
  let next;
  if (bgmRotate() === 'shuffle' && files.length > 1) {
    // Ngẫu nhiên nhưng tránh bài đang phát và các bài vừa phát (nhớ gần nửa danh sách) để không lặp lại sát nhau
    const keep = Math.min(recentTracks.length, Math.max(files.length >= 3 ? 1 : 0, Math.floor((files.length - 2) / 2)));
    const avoid = new Set([b.file, ...(keep > 0 ? recentTracks.slice(-keep) : [])]);
    const pool = files.filter(f => !avoid.has(f.name));
    next = pick(pool.length ? pool : files.filter(f => f.name !== b.file));
  } else {
    const idx = files.findIndex(f => f.name === b.file);
    next = files[(idx + 1) % files.length];
  }
  if (b.file) recentTracks.push(b.file);
  if (recentTracks.length > 30) recentTracks.shift();
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
  if (intent) freeRoleByComment(user, intent);
  persistState();
  broadcastState();
}

// Luật Hàng chờ + "nhận vai miễn phí": bình luận "chú rể" / "cô dâu" là nhận vai (vai có người thì xếp hàng).
// Quà "thay" vẫn để chen lên ngay.
let lastHeldHintAt = 0;
function freeRoleByComment(user, role) {
  const c = state.config;
  if (!c.freeRoles || !isQueue() || c.enableMarryAuction === false) return;
  if (!openRoles().includes(role)) return;
  if (state.ceremony.phase === 'running') {
    // Đang làm lễ: không ngắt lời MC. Có hàng chờ thì ghi tên để hết lượt này được gọi lên; không hàng chờ thì bỏ qua
    if (!queueOn() || holderIds().has('tik-' + user.id)) return;
    const q = queueJoin(user, role);
    if (q.queueJoined) { persistState(); broadcastState(); }
    return;
  }
  if (!queueOn() && state.roles[role]) {
    // Không hàng chờ: vai đang có người thì bình luận không nhận được, phải tặng quà mới giành ngay
    if (state.roles[role].id !== String(user.id) && Date.now() - lastHeldHintAt > 15000 && Date.now() - lastMcAt > 4000) {
      lastHeldHintAt = Date.now();
      const gift = ruleGiftName([role === 'groom' ? 'groom' : 'bride', 'role']) || ruleGiftName([role === 'groom' ? 'replaceGroom' : 'replaceBride']) || 'quà nhận vai';
      mcSay(pickLine('roleHeld', { ...baseVars(), name: user.name, role: ROLE_LABEL[role], holder: state.roles[role].name, gift }), 'event');
    }
    return;
  }
  const r = applyRoleQueue(user, role, 0);
  const vars = { ...baseVars(), name: user.name, role: ROLE_LABEL[r.role] };
  if (r.became) {
    broadcast('action', {
      action: 'role_change', role: r.role, name: user.name, avatar: user.avatar || '', bid: 0,
      line: pickLine(r.role === 'groom' ? 'groomTaken' : 'brideTaken', vars)
    });
    markMc();
    evaluateCeremony(true);
  } else if (r.queueJoined) {
    mcSay(pickLine('queueJoined', { ...vars, position: r.position, holder: r.holder || 'cặp đôi hiện tại' }), 'event');
  }
}

function processGiftEvent(g) {
  if (!g || !g.id || g.id === 'unknown') return null;
  lastGiftAt = Date.now();
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
      const direct = isQueue() && !queueOn(); // không hàng chờ: quà nhận vai = lên vai ngay
      if (direct && state.ceremony.phase === 'reception') {
        // Đôi vừa cưới còn đứng chờ quà: có người tặng quà giành vai thì lượt của họ kết thúc luôn, người tặng lên vai ngay
        const old = state.roles[role];
        endTurn({ quiet: true });
        roleResult = replaceRole(user, role, coins);
        if (old && roleResult.became) { roleResult.replaced = true; roleResult.previous = old.name; }
      } else if (stageBusy()) {
        // Đang làm lễ (hoặc luật có hàng chờ / đấu giá trong tiệc mừng): không cướp ngay được, tính cho lượt sau
        if (queueOn()) {
          roleResult = queueJoin(user, role);
        } else {
          pendingRoleGifts.push({ user, role, coins, direct });
          roleResult = { role, queued: true };
        }
      } else if (replace || direct) {
        roleResult = replaceRole(user, role, coins);
      } else {
        roleResult = isQueue() ? applyRoleQueue(user, role, coins) : applyRoleBid(user, role, coins);
      }
      alignGender(key, roleResult?.role || role); // quà nhận vai (kể cả đang xếp lượt sau): nhân vật đi lên khớp với vai
      action = 'role';
    }
  } else if (action === 'cancel') {
    const r = cancelWedding();
    if (r.blocked || !r.had) {
      blockedLine = r.blocked ? pickLine('cancelBlocked', { ...baseVars(), name }) : '';
      action = 'thanks';
    } else {
      feat(key, name, 'cancel');
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
    else skipFocus = startCeremony({ quick: true, initiator: name, finale: state.ceremony.phase === 'reception' });
  } else if (action === 'dongphong' && state.ceremony.phase === 'reception') {
    // Quà động phòng trong tiệc mừng: tiễn đôi vừa cưới vào động phòng, xong là hết lượt của họ
    action = 'quickwed';
    skipFocus = startCeremony({ quick: true, initiator: name, finale: true });
  } else if (action === 'photo') {
    special = { photo: makePhoto('group', user) };
  }

  if (action === 'dongphong' || action === 'quickwed') feat(key, name, 'dongphong');
  if (action === 'fireworks') feat(key, name, 'fireworks');
  if (roleResult?.became && (roleResult.replaced || roleResult.previous)) feat(key, name, 'steal');

  state.recentGifts = [{ name, gift, giftId: String(g.giftId || ''), count, coins, action, at: Date.now() }, ...state.recentGifts].slice(0, 30);

  if (action === 'petal' || /\b(rose|hoa hong)\b/.test(norm(gift))) goalAdd('rose', count);
  goalAdd('cake', coins);

  const offeringEvent = {
    id: sid,
    name,
    avatar,
    sprite: p.sprite,
    gender: p.gender,
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

  if (action !== 'role') extendReception(); // quà xếp hàng cho lượt sau không kéo dài lượt của đôi đang đứng
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
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
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

// ----- GIỌNG MC NAM CHẠY TRÊN MÁY (VieNeu-TTS, tools/giong-nam) -----
// App tự bật một server Python nhỏ (may_chu_giong.py, chỉ nghe trên 127.0.0.1) khi chọn nguồn giọng này.
// Chưa cài, đang nạp, hoặc lỗi: /api/speech tự quay về giọng Google để MC không bị câm.
const VIENEU_DIR = path.join(__dirname, '..', 'tools', 'giong-nam');
const VIENEU_PORT = Number(process.env.GIONG_PORT) || 3010;
const vieneu = { proc: null, ready: false, error: '', voices: [] };
const VIENEU_STYLES = ['tu-nhien', 'lay', 'rat-lay', 'mc'];
const VIENEU_REVERBS = ['khong', 'phong', 'hoi-truong'];
function vieneuPython() {
  return [path.join(VIENEU_DIR, 'venv', 'bin', 'python'), path.join(VIENEU_DIR, 'venv', 'Scripts', 'python.exe')].find(p => fs.existsSync(p)) || '';
}
function vieneuInstalled() {
  return Boolean(vieneuPython()) && fs.existsSync(path.join(VIENEU_DIR, 'may_chu_giong.py'));
}
function vieneuGet(pathname, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: VIENEU_PORT, path: pathname, timeout: timeoutMs }, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
// App bị tắt đột ngột (kill) thì server giọng nam cũ vẫn còn chạy và giữ cổng: lần bật sau dùng lại luôn server đó
// (khỏi nạp lại mô hình), không bật thêm cái mới — bật thêm sẽ lỗi "Address already in use" và MC rơi về giọng dự phòng.
function startVieneu() {
  if (vieneu.proc || vieneu.ready || vieneu.starting) return;
  if (!vieneuInstalled()) { vieneu.error = 'Chưa cài giọng nam (thư mục tools/giong-nam)'; return; }
  vieneu.starting = true;
  vieneu.error = '';
  vieneuGet('/health', 1500).then(h => {
    if (!h || !h.ok) throw new Error('không phải server giọng nam');
    vieneu.ready = true;
    vieneu.voices = h.voices || [];
    console.log('Giọng MC nam (VieNeu): dùng lại server đang chạy sẵn');
  }).catch(() => spawnVieneu()).finally(() => { vieneu.starting = false; });
}
function spawnVieneu() {
  if (vieneu.proc) return;
  vieneu.ready = false;
  vieneu.error = '';
  // Ghi log ra file (không nối ống với app): app bị tắt đột ngột thì server giọng nam vẫn chạy bình thường để lần sau dùng lại
  const logFile = path.join(VIENEU_DIR, 'may_chu.log');
  let fd;
  try { fd = fs.openSync(logFile, 'w'); } catch { fd = 'ignore'; }
  const p = require('node:child_process').spawn(vieneuPython(), ['may_chu_giong.py'], {
    cwd: VIENEU_DIR, env: { ...process.env, GIONG_PORT: String(VIENEU_PORT) }, stdio: ['ignore', fd, fd]
  });
  if (typeof fd === 'number') { try { fs.closeSync(fd); } catch {} }
  vieneu.proc = p;
  // Sẵn sàng khi /health trả lời (nạp mô hình mất khoảng nửa phút)
  const poll = setInterval(() => {
    if (vieneu.proc !== p) return clearInterval(poll);
    vieneuGet('/health', 900).then(h => {
      if (vieneu.proc !== p || !h?.ok) return;
      clearInterval(poll);
      vieneu.ready = true;
      vieneu.voices = h.voices || [];
      console.log('Giọng MC nam (VieNeu) đã sẵn sàng');
    }).catch(() => {});
  }, 1000);
  p.on('error', e => { vieneu.error = `Không bật được giọng nam: ${e.message}`; });
  p.on('exit', code => {
    clearInterval(poll);
    if (vieneu.proc === p) { vieneu.proc = null; vieneu.ready = false; }
    if (code) {
      let tail = '';
      try { tail = fs.readFileSync(logFile, 'utf8').trim().split('\n').pop() || ''; } catch {}
      vieneu.error = `Server giọng nam dừng (mã ${code}): ${tail}`.slice(0, 200);
    }
  });
}
function stopVieneu() {
  const p = vieneu.proc;
  vieneu.proc = null;
  vieneu.ready = false;
  if (p) { try { p.kill(); } catch {} }
}
// Server giọng nam chết giữa chừng (kể cả cái dùng lại): đánh dấu chưa sẵn sàng để lần đọc sau bật lại
function vieneuLost(err) {
  if (['ECONNREFUSED', 'ECONNRESET'].includes(err?.code) && !vieneu.proc) vieneu.ready = false;
}
function vieneuSpeak(text, voice, style, vang) {
  return new Promise((resolve, reject) => {
    if (!vieneu.ready) { startVieneu(); return reject(new Error(vieneu.error || 'Giọng nam đang nạp')); }
    const body = Buffer.from(JSON.stringify({ text, voice, style, vang }));
    const req = http.request({
      host: '127.0.0.1', port: VIENEU_PORT, path: '/speak', method: 'POST', timeout: 25000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
    }, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (r.statusCode === 200 && buf.length > 1000) resolve(buf);
        else reject(new Error(`Giọng nam lỗi (HTTP ${r.statusCode})`));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Giọng nam đọc quá lâu')));
    req.on('error', e => { vieneuLost(e); reject(e); });
    req.end(body);
  });
}
process.on('exit', stopVieneu);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopVieneu(); process.exit(0); });
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
    if (!['auto', 'browser', 'google', 'vieneu'].includes(state.config.voiceEngine)) state.config.voiceEngine = 'auto';
    state.config.vieneuVoice = String(state.config.vieneuVoice || 'Minh Quân').slice(0, 40);
    if (!VIENEU_STYLES.includes(state.config.vieneuStyle)) state.config.vieneuStyle = 'lay';
    if (!VIENEU_REVERBS.includes(state.config.vieneuReverb)) state.config.vieneuReverb = 'hoi-truong';
    if (state.config.voiceEngine === 'vieneu') startVieneu();
    else stopVieneu();
    state.config.minCoinsToMarry = clampNum(state.config.minCoinsToMarry, 1, 1000000, 10);
    state.config.ceremonyCountdown = clampNum(state.config.ceremonyCountdown, 5, 600, 20);
    state.config.botsEnabled = state.config.botsEnabled === true;
    state.config.botsCount = clampNum(state.config.botsCount, 1, 80, 20);
    state.config.ceremonySteps = state.config.ceremonySteps === 'auto' ? 'auto' : 'gift';
    state.config.receptionSeconds = clampNum(state.config.receptionSeconds, 8, 600, 25);
    state.config.demoEvery = clampNum(state.config.demoEvery, 0, 100, 8);
    state.config.autoPair = state.config.autoPair !== false;
    state.config.freeRoles = state.config.freeRoles === true;
    state.config.autoPairSeconds = clampNum(state.config.autoPairSeconds, 5, 600, 8);
    state.config.pairBoth = state.config.pairBoth !== false;
    state.config.partyEvery = clampNum(state.config.partyEvery, 0, 100, 5);
    state.config.treatQuietSeconds = clampNum(state.config.treatQuietSeconds, 0, 3600, 60);
    if (state.config.treatQuietSeconds && state.config.treatQuietSeconds < 20) state.config.treatQuietSeconds = 20;
    state.config.partnerWaitSeconds = clampNum(state.config.partnerWaitSeconds, 10, 600, 90);
    state.config.hostName = String(state.config.hostName || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    state.config.commentCooldown = clampNum(state.config.commentCooldown, 0, 300, 8);
    if (!['both', 'groom', 'bride'].includes(state.config.roleMode)) state.config.roleMode = 'both';
    if (!['auction', 'queue'].includes(state.config.roleSystem)) state.config.roleSystem = 'auction';
    state.config.roleQueue = state.config.roleQueue === true;
    if (!queueOn()) state.queue = { groom: [], bride: [] };
    state.config.maxGuests = guestLimit(state.config.maxGuests);
    state.people = fixSeats(state.people);
    state.config.likeGoal = clampNum(state.config.likeGoal, 100, 10000000, 5000);
    state.config.titleDecaySeconds = clampNum(state.config.titleDecaySeconds, 10, 600, 30);
    if (!['xu', 'chỉ vàng'].includes(state.config.moneyUnit)) state.config.moneyUnit = 'xu';
    themeCache.at = 0;
    sanitizeThemeConfig(state.config);

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
      return sendJson(res, ok ? 200 : 409, { ok, error: ok ? undefined : state.ceremony.phase === 'reception' ? 'Đôi này vừa cưới xong, đang tiệc mừng' : 'Lễ đang diễn ra' });
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
      // Luật hàng chờ: không cướp bằng xu được, dùng quà "thay chú rể / thay cô dâu" của bảng luật
      const swapGift = isQueue() ? ruleGiftName([role === 'groom' ? 'replaceGroom' : 'replaceBride']) : '';
      const ev = processGiftEvent({ id, name, gift: swapGift || 'Nhẫn cưới', count: 1, diamonds: coins, avatar: '' });
      return sendJson(res, 200, { ok: true, offeringEvent: ev });
    }
    // Đang tiệc mừng: nút "động phòng" / "động phòng luôn" tiễn đôi vừa cưới vào động phòng (hết lượt của họ)
    if (action === 'quickwed' || (action === 'dongphong' && state.ceremony.phase === 'reception')) {
      const ok = startCeremony({ quick: true, initiator: 'MC', finale: state.ceremony.phase === 'reception' });
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
    if (['order', 'shuffle', 'off'].includes(data.rotate)) bgm.rotate = data.rotate;
    persistState();
    broadcastState();
    broadcast('bgm', bgm);
    return sendJson(res, 200, { ok: true, bgm });
  }

  // Overlay báo một bài vừa phát hết -> tự đổi bài. Nhiều overlay cùng báo thì chỉ lần đầu (đúng bài đang phát) có tác dụng.
  if (pathname === '/api/bgm/ended' && req.method === 'POST') {
    const data = await readJson();
    const bgm = state.config.bgm || {};
    let changed = false;
    if (bgm.source === 'file' && bgm.file && String(data.file || '') === bgm.file && bgmRotate() !== 'off' && listMusic().length > 1) {
      changed = Boolean(nextTrack());
      if (changed) broadcastState();
    }
    return sendJson(res, 200, { ok: true, changed, bgm });
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

  if (pathname === '/api/webhook-stats' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, startedAt: WEBHOOK_SINCE, now: Date.now(), seen: webhookSeen });
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJson(res, 200, state.status);
  }

  if (pathname === '/api/rule-presets' && req.method === 'GET') {
    return sendJson(res, 200, { presets: RULE_PRESETS });
  }

  if (pathname === '/api/themes' && req.method === 'GET') {
    themeCache.at = 0;
    return sendJson(res, 200, { themes: listThemes(), current: state.config.theme, background: state.config.themeBackground });
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
    // Sổ theo dõi webhook (bảng điều khiển → Kết nối): loại nào đã về, lần cuối lúc nào, của ai
    {
      const kind = isGift ? 'gift'
        : data.event === 'like' || data.likeCount !== undefined ? 'like'
        : data.event === 'share' || data.event === 'follow' ? data.event
        : data.event === 'chat' || chatText ? 'chat'
        : data.event === 'member' || data.event === 'join' ? 'join' : 'other';
      const w = webhookSeen[kind];
      w.count++;
      w.at = Date.now();
      w.who = String(nickname || userId || '').slice(0, 40);
      w.what = kind === 'chat' ? String(chatText || '').slice(0, 80)
        : kind === 'gift' ? String(data.giftName || data.gift || '').slice(0, 40)
        : kind === 'other' ? Object.keys(data).slice(0, 12).join(', ') : '';
    }
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
    state.feats = {};
    state.wedLog = {};
    featOwners = null;
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
  if (pathname === '/api/vieneu' && req.method === 'GET') {
    return sendJson(res, 200, {
      installed: vieneuInstalled(), running: Boolean(vieneu.proc) || vieneu.ready, ready: vieneu.ready, error: vieneu.error,
      voices: vieneu.voices.filter(v => v.gender === 'male').map(v => ({ name: v.name, description: v.description }))
    });
  }

  if (pathname === '/api/speech' && req.method === 'POST') {
    const data = await readJson();
    const text = String(data.text || '').trim();
    if (!text || text.length > 300) return sendJson(res, 400, { error: 'Text length must be 1-300 chars' });
    // Giọng nam trên máy (bảng điều khiển nghe thử có thể gửi kèm engine/voice đang chọn trên form)
    const engine = ['vieneu', 'google'].includes(data.engine) ? data.engine : state.config.voiceEngine;
    if (engine === 'vieneu') {
      const voice = String(data.voice || state.config.vieneuVoice || 'Minh Quân').slice(0, 40);
      const style = VIENEU_STYLES.includes(data.style) ? data.style : (state.config.vieneuStyle || 'lay');
      const vang = VIENEU_REVERBS.includes(data.vang) ? data.vang : (state.config.vieneuReverb || 'hoi-truong');
      const key = `vieneu|${voice}|${style}|${vang}|${text}`;
      try {
        const buf = ttsCache.get(key) || await vieneuSpeak(text, voice, style, vang);
        ttsCache.set(key, buf);
        if (ttsCache.size > 150) ttsCache.delete(ttsCache.keys().next().value);
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-Voice': 'vieneu' });
        return res.end(buf);
      } catch (e) {
        // rơi xuống giọng Google bên dưới
      }
    }
    if (ttsCache.has(text)) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400', 'X-Voice': 'google' });
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
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400', 'X-Voice': 'google' });
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
      'Cache-Control': /\.(png|jpg|jpeg|webp|webm|woff2?|ttf)$/.test(ext) && !rel.endsWith('theme.json') ? 'public, max-age=3600' : 'no-cache',
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
  if (state.config.voiceEngine === 'vieneu') startVieneu();
  // Vừa khởi động lại: tiếp tục từ trạng thái đã lưu (vai trống mà có người chờ thì gọi lên; đủ đôi thì đếm ngược làm lễ)
  setTimeout(() => {
    if (isQueue()) {
      const promoted = promoteQueue();
      if (promoted.length) announcePromoted(promoted);
    }
    evaluateCeremony();
    persistState();
    broadcastState();
  }, 4000);
});
