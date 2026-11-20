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
// TIECCUOI_ALBUM: thư mục album riêng cho server chạy thử, để ảnh chụp lúc thử không lẫn vào album thật
const ALBUM_DIR = process.env.TIECCUOI_ALBUM || path.join(PUBLIC_DIR, 'album');
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
  'champagne', 'cheers', 'petal', 'ring', 'bouquet', 'fireworks', 'music', 'mc', 'photo', 'babyBoy', 'babyGirl', 'thanks'];
const ROLE_ACTIONS = ['role', 'groom', 'bride', 'replaceGroom', 'replaceBride'];
const ROLE_LABEL = { groom: 'chú rể', bride: 'cô dâu' };
// Các loại biến cố lúc sắp làm lễ (xem mục BIẾN CỐ bên dưới)
const TWIST_KINDS = ['ex', 'dowry', 'blackout', 'mass', 'roach', 'ring'];
// Sự cố trong tiệc mừng (sau lễ): một bước vốn miễn phí (hôn, cắt bánh, cụng ly, vào phòng tân hôn) bị chặn lại
const PARTY_KINDS = ['kiss', 'cake', 'cheers', 'room'];
const sanitizeTwists = t => Object.fromEntries([...TWIST_KINDS, ...PARTY_KINDS].map(k => [k, !(t && t[k] === false)]));

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
    autoPairSeconds: 60,       // giây chờ ghép đôi (cô dâu, chú rể đứng riêng chờ nửa kia)
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
    twistEvery: 3,             // biến cố lúc sắp làm lễ (người yêu cũ, bố vợ thách cưới, cúp điện, cưới tập thể): trung bình mấy lượt cưới một lần (0 = tắt)
    twists: { ex: true, dowry: true, blackout: true, mass: true, roach: true, ring: true, kiss: true, cake: true, cheers: true, room: true }, // bật / tắt từng loại biến cố, sự cố
    partyFree: true,           // tiệc mừng tự diễn: cưới xong đôi trẻ tự hôn, cắt bánh, cụng ly rồi vào phòng tân hôn (miễn phí); false = chờ quà như cũ
    tossSeconds: 9,            // tung hoa cưới (trong tiệc mừng): bao nhiêu giây để khán giả gõ "chụp" bắt hoa; người bắt được lên làm cô dâu / chú rể lượt sau (0 = tắt)
    moonSeconds: 12,           // tuần trăng mật (cuối tiệc mừng, trước khi vào phòng): bao nhiêu giây để cả rạp đổi vé cho đôi trẻ (0 = tắt)
    moonPrices: { dalat: 1, phuquoc: 5, halong: 10, seoul: 30, tokyo: 50, paris: 99, maldives: 199 }, // tuần trăng mật: tổng xu quà trong chuyến đạt mức nào thì đôi trẻ đi nơi đó
    hitchEvery: 2,             // sự cố trong tiệc mừng (bố vợ chặn hôn, bánh đổ, ông chú giành mic, chặn cửa phòng): trung bình mấy lượt cưới một lần (0 = tắt)
    babySeconds: 15,           // sinh con: sau khi đôi trẻ vào động phòng, cửa phòng đóng bao nhiêu giây để khách tặng quà "bé trai" / "bé gái" (0 = tắt)
    attendants: true,          // vai phụ: bình luận "phù dâu" / "phù rể" để lên sân khấu, lượt sau được MC ưu tiên chọn làm cô dâu, chú rể
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
  attendants: { maid: null, bestman: null },
  patron: null, // người tặng quà cứu đám cưới trong biến cố của lượt này: được ghi công cạnh đôi trẻ tới hết lượt
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
    s.config.twists = sanitizeTwists(s.config.twists);
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
        roleSystem: 'queue', roleQueue: true, freeRoles: true, autoPair: true, autoPairSeconds: 60, pairBoth: true,
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
    attendants: state.attendants,
    patron: state.patron || null,
    twist: twistPublic(),
    moon: moonPublic(),
    toss: tossPublic(),
    baby: babyPublic(),
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
      party: Boolean(c.party), // tiệc mừng tự diễn: các bước miễn phí, hết tiệc đôi trẻ tự vào phòng
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
  { key: 'fireworks', title: '🎆 Vua Pháo Hoa', min: 1 },    // tặng quà bắn pháo hoa
  // Người hùng của từng biến cố: ai tặng quà nhiều nhất trong màn đó, không ai tặng thì người góp tim, bình luận nhiều nhất
  { key: 'guard', title: '🛡️ Vệ Sĩ Tình Yêu', min: 1 },     // che chắn lúc lốp trưởng (người yêu cũ) đòi lên thay
  { key: 'flatter', title: '🧧 Nhà Tài Trợ Sính Lễ', min: 1 }, // góp sính lễ / xin cưới giùm lúc bố vợ thách cưới
  { key: 'power', title: '⚡ Thợ Điện Của Rạp', min: 1 },    // thắp nến / quay máy phát lúc cúp điện
  { key: 'cupid', title: '💘 Thần Tình Yêu', min: 1 },       // tiếp sức tình yêu lúc cô dâu hóa gián
  { key: 'godparent', title: '🍼 Bố Mẹ Đỡ Đầu', min: 1 },    // tặng quà đón em bé cho đôi trẻ
  // Người gỡ sự cố: chú rể quên nhẫn, bố vợ chặn hôn, bánh cưới đổ, ông chú giành mic, hội bạn thân chặn cửa phòng
  { key: 'ringer', title: '💍 Người Cho Mượn Nhẫn', min: 1 },
  { key: 'charmer', title: '🍶 Cao Thủ Dụ Bố Vợ', min: 1 },
  { key: 'baker', title: '🎂 Nhà Tài Trợ Bánh Cưới', min: 1 },
  { key: 'host', title: '🍻 Chủ Xị Của Rạp', min: 1 },
  { key: 'matchmaker', title: '🏮 Ông Mai Bà Mối', min: 1 },
  { key: 'traveler', title: '✈️ Nhà Tài Trợ Trăng Mật', min: 1 } // tặng quà đổi vé tuần trăng mật cho đôi trẻ
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
  // Đang là phù dâu / phù rể mà lên vai chính thì thôi vai phụ
  for (const slot of ['maid', 'bestman']) if (state.attendants[slot]?.id === String(user.id)) state.attendants[slot] = null;
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
  return clampNum(state.config.autoPairSeconds, 5, 600, 60) * 1000;
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
  if (kickBan && Date.now() < kickBan.until) taken.add('tik-' + kickBan.id);
  const takenNames = new Set(['groom', 'bride'].map(r => state.roles[r]?.name).filter(Boolean));
  const picks = [];
  const empty = openRoles().filter(r => !state.roles[r] && !(isQueue() && state.queue[r].length));
  // Chưa ai nhận vai nào: chỉ mời một người lên trước (khách nữ làm cô dâu, khách nam làm chú rể),
  // người còn lại để khách tặng quà giành, hết giờ lượt sau mới chọn tiếp
  const single = state.config.pairBoth === false && empty.length > 1 && openRoles().every(r => !state.roles[r]);
  const roles = single ? [empty[Math.floor(Math.random() * empty.length)]] : empty;
  for (let role of roles) {
    // Phù dâu, phù rể của lượt trước (còn ở trong rạp) được lên vai trước; không có thì chọn ngẫu nhiên như thường
    const up = takeNextUp(role, taken, takenNames);
    const p = up || randomGuest(role, taken, takenNames);
    if (p) {
      if (single && !up) role = p.gender === 'female' && empty.includes('bride') ? 'bride' : empty.includes('groom') ? 'groom' : role;
      taken.add(p.id);
      takenNames.add(p.name);
      picks.push({ role, id: p.id.replace(/^tik-/, ''), name: p.name, avatar: p.avatar || '', from: up ? (role === 'bride' ? 'maid' : 'bestman') : '' });
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
  const raised = picks.filter(p => p.from);
  const line = raised.length > 1
    ? pickLine('attendantsWed', v)
    : raised.length
    ? pickLine('attendantPromoted', { ...v, name: raised[0].name, role: ROLE_LABEL[raised[0].role], from: ATTEND[raised[0].from].label })
    : single && !hostPick
    ? pickLine('firstPick', { ...v, name: one.name, role: ROLE_LABEL[one.role], other: other(one.role) })
    : hostPick
    ? pickLine('hostPick', { ...v, name: hostPick.name, role: ROLE_LABEL[hostPick.role], partner: name(hostPick.role === 'groom' ? 'bride' : 'groom') })
    : picks.length > 1
      ? pickLine('randomPair', v)
      : pickLine('randomRole', { ...v, name: one.name, role: ROLE_LABEL[one.role], partner: name(one.role === 'groom' ? 'bride' : 'groom') });
  broadcast('action', { action: 'random_pair', picks: picks.map(({ role, name, avatar, from }) => ({ role, name, avatar, from })), line });
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
    ceremonyTimer = setTimeout(ceremonyDue, secs * 1000);
    setTimeout(autoAttendants, 4000);
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
    if (twist) return; // đang có biến cố: đồng hồ do biến cố giữ, diễn xong kết cục mới vào lễ
    // Cướp vai phút chót -> gia hạn thêm 10 giây cho kịch tính; có người vừa bị đá thì giữ đồng hồ tới hết giờ phục thù của họ
    const rv = activeRevenge();
    // Đôi mới ghép lại là hai người từng đá nhau giành vai: chờ bảng "thay vai" tắt rồi bóc phốt, giữ đồng hồ đủ lâu để kịp xem
    const tea = rivalsGossip(16);
    if (tea) gossipLater(tea);
    const minLeft = Math.max(10000, rv ? rv.until - Date.now() + 1500 : 0, tea ? 18000 : 0);
    if (c.endsAt - Date.now() < minLeft) {
      c.endsAt = Date.now() + minLeft;
      clearTimeout(ceremonyTimer);
      ceremonyTimer = setTimeout(ceremonyDue, minLeft);
      broadcastState();
    }
  }
}

// Ba kiểu lễ:
//   wed   — chỉ làm lễ thành hôn (mở lễ, trao nhẫn, tuyên bố). Sau đó là "tiệc mừng": đôi trẻ ở lại sân khấu,
//           hôn / cắt bánh / rót rượu / động phòng... chỉ diễn ra khi khách tặng quà (mặc định)
//   auto  — tự chạy đủ các bước rồi động phòng (kiểu cũ, chọn trong bảng điều khiển)
//   quick — quà "động phòng luôn": vào thẳng động phòng. finale = đôi này đã thành hôn rồi (quà tặng trong tiệc mừng)
function startCeremony({ quick = false, initiator = '', finale = false, demo = false, free = false } = {}) {
  if (state.ceremony.phase === 'running') return false;
  if (state.ceremony.phase === 'reception' && !(quick && finale)) return false; // đôi này vừa cưới xong, chỉ còn động phòng
  abortTwist(); // quà "động phòng luôn" giữa lúc có biến cố: bỏ biến cố, vào lễ
  party = null; // tiệc mừng tự diễn (nếu đang chạy) dừng ở đây: đôi trẻ vào phòng
  dropMoon();
  dropToss();
  clearTimeout(ceremonyTimer);
  const mode = quick ? 'quick' : state.config.ceremonySteps === 'auto' ? 'auto' : 'wed';
  // Động phòng xong thì cửa phòng đóng thêm một lúc cho khách tặng quà đón em bé (xem mục SINH CON)
  const babyMs = quick && babyOn() ? babySeconds() * 1000 : 0;
  const ms = { quick: CEREMONY_QUICK_MS, auto: CEREMONY_MS, wed: CEREMONY_WED_MS }[mode] + (babyMs ? babyMs + BABY_REVEAL_MS - 2500 : 0);
  state.ceremony = { phase: 'running', endsAt: Date.now() + ms, quick, mode, married: finale };
  const v = { ...baseVars(), name: initiator || 'MC' };
  // Người tặng quà động phòng là ông mai / bà mối của đôi này
  const maiP = quick && initiator && !demo ? state.people.find(p => p.name === initiator) : null;
  const matchmaker = quick && initiator && !demo ? { name: initiator, title: maiP?.gender === 'female' ? 'Bà mối' : 'Ông mai' } : null;
  if (maiP) maiP.baseTag = maiP.gender === 'female' ? '🏮 Bà mối' : '🏮 Ông mai';
  if (babyMs) startBaby(babyMs);
  const keys = {
    quick: ['quickwed', 'dongphong', 'dongphongEnd', 'ceremonyEnd'],
    auto: ['ceremonyStart', 'ring', 'kiss', 'cake', 'champagne', 'dongphong', 'dongphongEnd', 'ceremonyEnd'],
    wed: ['ceremonyStart', 'ring', 'wedDone']
  }[mode];
  const lines = {};
  for (const k of keys) lines[k] = pickLine(k, v);
  if (quick) lines.ceremonyStart = demo ? pickLine('demoDongphong', { ...v, gift: ruleGiftName(['dongphong', 'quickwed']) || 'quà động phòng' })
    : free && !initiator ? pickLine('partyRoom', v) : lines.quickwed; // free: tiệc tàn, đôi trẻ tự vào phòng (không ai tặng quà)
  if (babyMs) lines.babyStart = pickLine('babyStart', v);
  broadcast('action', { action: 'ceremony', quick, mode, finale, initiator, matchmaker, baby: babyMs ? { ms: babyMs, openMs: BABY_OPEN_MS } : null, ms, ...coupleInfo(), lines });
  markMc();
  broadcastState();
  ceremonyTimer = setTimeout(finishCeremony, ms);
  return true;
}

function resetRoles(tag = '💍 Đã thành đôi') {
  // Đôi trẻ rời sân khấu giữa chừng (bấm "mở lại vai" lúc cửa phòng tân hôn đang đóng): bỏ luôn cửa sổ sinh con của họ
  if (baby) { clearTimeout(baby.timer); baby = null; }
  party = null;
  dropMoon();
  dropToss();
  for (const r of ['groom', 'bride']) {
    const h = state.roles[r];
    const p = h && state.people.find(x => x.id === 'tik-' + h.id);
    if (p) p.baseTag = tag;
  }
  state.roles = { groom: null, bride: null };
  state.bids = { groom: {}, bride: {} };
  // Lượt này khép lại: vai phụ, người hùng, các cặp cưới ké và biến cố đều thuộc về lượt đó
  clearAttendants();
  state.patron = null;
  massPairs = [];
  twistPlan.used = false;
}

// Hủy hôn / phá đám: cặp đôi hiện tại xuống sân khấu (không tính là thành hôn)
function cancelWedding() {
  if (state.ceremony.phase === 'running') return { blocked: true };
  abortTwist();
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
    const before = state.stats.couples || 0;
    state.stats.couples = before + 1 + massPairs.length;
    state.marriages = [{ groom: couple.groom, bride: couple.bride, at: Date.now() }, ...state.marriages].slice(0, 10);
    for (const r of ['groom', 'bride']) if (state.roles[r]) feat(state.roles[r].id, state.roles[r].name, 'wed');
    logWedding(state.roles.groom, state.roles.bride);
    // Cưới tập thể: các cặp cưới ké thành hôn cùng lúc, cũng được ghi vào sổ cưới
    for (const { a, b } of massPairs) {
      feat(a.id, a.name, 'wed');
      feat(b.id, b.name, 'wed');
      logWedding(a, b);
    }
    schedulePartyForCouples(before, state.stats.couples);
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

// ========================================================
// BIẾN CỐ: hết giờ đếm ngược, sắp làm lễ thì thỉnh thoảng có chuyện bất ngờ, để lượt cưới nào cũng khác nhau.
// Mỗi biến cố là một màn kịch bốn nhịp: MỞ MÀN (chữ đập vào màn hình, nhân vật bước ra) -> CẢ RẠP RA TAY
// -> KẾT (vinh danh người góp sức) -> MÓC CÂU (hẹn lượt sau). Trong nhịp "ra tay" luôn có HAI CỬA:
//   cửa miễn phí  cả rạp thả tim / bình luận từ khóa, cùng đẩy một thanh chung (không chia hai phe)
//   cửa quà       ai tặng quà là bước lên sân khấu làm NGƯỜI HÙNG của màn đó (vệ sĩ, góp sính lễ, thắp nến...):
//                 thanh nhảy vọt, tên hiện trên bảng, MC cảm ơn; thắng thì được ghi công cạnh đôi trẻ tới hết lượt cưới
//   ex        có người xông vào đòi thay vai: cả rạp che chắn; không đủ thì người đó cướp vai.
//             Chọn người: vợ / chồng cũ thật trong sổ cưới, rồi người đứng đầu hàng chờ (gọi là "lốp trưởng", vì họ
//             đang chờ lên thay thật), rồi một khách bất kỳ (gọi là "người yêu cũ").
//             Chính người đó tặng quà thay vai thì cướp được ngay tại chỗ.
//   dowry     bố vợ thách cưới: cả rạp "dạ bố" xin giùm, quà là sính lễ; không đủ thì chú rể bị đuổi (hoặc phải ở rể)
//   blackout  cúp điện: tim và bình luận quay máy phát, quà là nến; không kịp thì cưới bằng ánh nến
//   mass      cưới tập thể: bình luận "cưới" để cưới ké, quà là suất hạng nhất (luôn có chỗ, đứng đầu)
//   roach     "nếu em biến thành con gián": cô dâu hóa gián thử lòng; cả rạp gõ "yêu", quà tiếp sức; chính chú rể
//             gõ "yêu" hoặc tặng quà là qua ngay; không đủ thì chú rể bỏ chạy (hoặc bị phạt vui)
// Kết quả luôn tất định (không quay số, không may rủi). Người đã tự nhận vai (bình luận / tặng quà) không bao giờ
// mất vai vì biến cố: chỉ người do MC chọn ngẫu nhiên mới bị cướp / bị đuổi.
// Biến cố diễn ra ngay trong lúc đếm ngược (phase vẫn là 'countdown') nên quà thay vai, phá đám vẫn dùng được;
// có người lên thay vai giữa chừng thì biến cố giải tán ("chen ngang").
// ========================================================
const TWIST_INTRO_MS = 4200; // màn mở đầu ("KHOAN ĐÃ!", nhân vật xuất hiện) trước khi tính giờ thử thách
const TWIST_WINDOW_MS = { ex: 16000, dowry: 16000, blackout: 15000, mass: 12000, roach: 16000, ring: 14000, kiss: 15000, cake: 14000, cheers: 15000, room: 16000 };
const TWIST_TAIL_MS = 6500;  // diễn xong kết cục rồi mới vào lễ
const TWIST_GIFT_FINISH_MS = 2600; // món quà làm đầy thanh: chờ người tặng kịp bước lên sân khấu rồi mới chốt
// Mỗi lượt tương tác được bao nhiêu điểm: tim, bình luận, xu quà, chia sẻ
const TWIST_POINTS = {
  ex: { like: 1, chat: 5, coin: 5, share: 20 },
  blackout: { like: 1, chat: 5, coin: 5, share: 20 },
  roach: { like: 1, chat: 5, coin: 5, share: 20 },
  dowry: { like: 0.2, chat: 1, coin: 1, share: 3 },
  ring: { like: 1, chat: 5, coin: 5, share: 20 },
  kiss: { like: 1, chat: 5, coin: 5, share: 20 },
  cake: { like: 1, chat: 5, coin: 5, share: 20 },
  cheers: { like: 1, chat: 5, coin: 5, share: 20 },
  room: { like: 1, chat: 5, coin: 5, share: 20 },
  moon: { like: 1, chat: 5, coin: 0, share: 20 } // tuần trăng mật: tim, bình luận đổi vé đi trong nước; quà tính riêng theo xu
};
const TWIST_FLOOR = { ex: 40, blackout: 40, roach: 40, dowry: 5, ring: 40, kiss: 40, cake: 40, cheers: 40, room: 40, moon: 30 }; // mục tiêu thấp nhất: rạp vắng, một hai người cũng làm được
// Danh hiệu cho người hùng của từng màn, và nhóm câu MC cảm ơn món quà tặng giữa biến cố
const TWIST_FEAT = { ex: 'guard', dowry: 'flatter', blackout: 'power', roach: 'cupid', ring: 'ringer', kiss: 'charmer', cake: 'baker', cheers: 'host', room: 'matchmaker' };
const TWIST_GIFT_LINE = {
  ex: 'twistGiftEx', dowry: 'twistGiftDowry', blackout: 'twistGiftBlackout', mass: 'twistGiftMass', roach: 'twistGiftRoach',
  ring: 'twistGiftRing', kiss: 'twistGiftKiss', cake: 'twistGiftCake', cheers: 'twistGiftCheers', room: 'twistGiftRoom'
};
// SỰ CỐ: một bước vui vốn miễn phí bị một thứ chặn lại (chú rể quên nhẫn, bố vợ chen vào lúc hôn, bánh cưới đổ, ông chú
// giành mic lúc cụng ly, hội bạn thân chặn cửa phòng tân hôn). Cả rạp gỡ bằng tim, bình luận (đúng từ khóa tính gấp đôi);
// quà nào cũng góp sức, riêng món quà của đúng bước đó (match) thì gỡ ngay. Thua thì bước đó diễn bản chữa cháy cho vui,
// đôi trẻ không mất gì. Mỗi sự cố có ba nhóm câu MC: twist<Tên>Start, twist<Tên>Win, twist<Tên>Lose.
const HITCH = {
  ring: { name: 'Ring', match: ['ring'], words: ['nhẫn', 'nhan'] },
  kiss: { name: 'Kiss', match: ['kiss'], words: ['hôn', 'hon', 'hun'] },
  cake: { name: 'Cake', match: ['cake'], words: ['bánh', 'banh'] },
  cheers: { name: 'Cheers', match: ['champagne', 'cheers'], words: ['xuống', 'xuong'] },
  room: { name: 'Room', match: ['quickwed', 'dongphong'], words: ['mở', 'mo'] }
};
const HITCH_TAIL_MS = 5600;    // diễn xong kết cục của sự cố rồi mới đi tiếp
const HITCH_STEP_AT_MS = 3600; // thắng: bảng tin vinh danh hiện xong thì bước bị chặn mới diễn ra
const MASS_MAX_SLOTS = 6;
// Chữ nói yêu trong biến cố con gián (so khớp nguyên từ có dấu; "yeu", "iu" không dấu cũng tính)
const LOVE_WORDS = ['yêu', 'iu', 'yeu', 'hôn', 'hun', 'thương', 'love'];
const LOVE_ANSWERS = ['có', 'còn', 'co', 'con']; // chú rể trả lời "còn yêu không?"
const LOVE_DENIALS = ['không', 'ko', 'hông', 'hong', 'hok', 'khum', 'chẳng', 'chả'];
const ROACH_FLEE = ['chạy', 'chay', 'sợ', 'ghê', 'eo', 'ewww', 'kinh']; // cũng tính là chọn "không yêu"
// Điện về là lộ: một khách bị "bắt quả tang" (chuyện vui vô hại, không chê bai ai)
const BLACKOUT_GAGS = [
  { text: 'ăn vụng cỗ', tag: '🍗 Ăn vụng cỗ' },
  { text: 'gói phần mang về', tag: '🥡 Gói phần mang về' },
  { text: 'ngủ gật', tag: '😴 Ngủ gật' },
  { text: 'nắm tay crush', tag: '🤝 Nắm tay crush' },
  { text: 'nhảy một mình', tag: '🕺 Nhảy một mình' },
  { text: 'hôn gió MC', tag: '😘 Hôn gió MC' }
];
const DEMO_EX = ['Tình Cũ', 'Người Yêu Cũ', 'Crush Cũ'];

let twist = null;   // biến cố đang diễn (chỉ nhớ trong phiên, không lưu file)
let twistTimer = null;
let twistSeq = 0;
let massPairs = []; // các cặp cưới ké của lượt này: thành hôn cùng lúc với đôi chính
let kickBan = null; // chú rể vừa bị bố vợ đuổi / vừa bỏ chạy: MC không chọn lại ngay người đó làm rể mới
const twistPlan = { since: 0, next: 0, last: '', forced: '', used: false };

// Nhịp tương tác 60 giây gần nhất, để đặt mục tiêu vừa sức: rạp vắng không thua hoài, rạp đông không thắng quá dễ
const pulse = []; // [lúc, loại, số lượng]
function notePulse(kind, n = 1) {
  const now = Date.now();
  pulse.push([now, kind, n]);
  while (pulse.length && (now - pulse[0][0] > 60000 || pulse.length > 4000)) pulse.shift();
}
function pulseSum(kind) {
  const from = Date.now() - 60000;
  return pulse.reduce((a, [t, k, n]) => (k === kind && t >= from ? a + n : a), 0);
}
// Muốn đầy thanh thì cả rạp phải tương tác gấp rưỡi nhịp thường ngày
function twistTarget(kind, ms) {
  const w = TWIST_POINTS[kind];
  const perMinute = pulseSum('like') * w.like + pulseSum('chat') * w.chat;
  return Math.min(1000000, Math.max(TWIST_FLOOR[kind], Math.ceil(perMinute * (ms / 60000) * 1.5)));
}

// Khách thật đang có mặt, không giữ vai cô dâu / chú rể, cũng không phải phù dâu / phù rể của lượt này
function twistGuests() {
  const keep = new Set([...holderIds(), ...[...attendantIds()].map(id => 'tik-' + id)]);
  return state.people.filter(p => !p.bot && !keep.has(p.id) && isPresent(p));
}
const userOf = p => ({ id: p.id.replace(/^tik-/, ''), name: p.name, avatar: p.avatar || '', gender: p.gender });
const personOf = id => state.people.find(p => p.id === 'tik-' + id);

// Tới lượt có biến cố chưa: cứ twistEvery lượt cưới một lần. Từ 3 lượt trở lên thì xê dịch một lượt cho khó đoán;
// đặt 1 hoặc 2 thì giữ đúng nhịp (1 = lượt nào cũng có).
function twistDue() {
  if (twistPlan.forced) return true;
  const every = clampNum(state.config.twistEvery, 0, 50, 3);
  if (!every) return false;
  const jitter = () => (every < 3 ? every : every + Math.floor(Math.random() * 3) - 1);
  if (!twistPlan.next) twistPlan.next = jitter();
  if (++twistPlan.since < twistPlan.next) return false;
  twistPlan.since = 0;
  twistPlan.next = jitter();
  return true;
}
// Chọn loại biến cố: đang bật, đủ người để diễn, và khác loại vừa diễn lần trước
function pickTwistKind() {
  const forced = twistPlan.forced;
  twistPlan.forced = '';
  if (forced) return forced; // bấm thử từ bảng điều khiển: rạp chưa có khách vẫn diễn (dùng tên mẫu)
  const guests = twistGuests().length;
  const can = { ex: guests >= 1 || state.queue.groom.length + state.queue.bride.length > 0, dowry: true, blackout: true, mass: guests >= 2, roach: true, ring: true };
  const pool = TWIST_KINDS.filter(k => state.config.twists?.[k] !== false && can[k]);
  const fresh = pool.filter(k => k !== twistPlan.last);
  return (fresh.length ? pick(fresh) : pool[0]) || '';
}

// Lốp trưởng / người yêu cũ, theo thứ tự ưu tiên:
//   1. vợ / chồng cũ thật trong sổ cưới (đang có mặt)
//   2. người đứng đầu hàng chờ của một vai: họ đang chờ lên thay thật, đúng nghĩa "lốp trưởng"
//   3. một khách bất kỳ vừa có mặt
function castEx(allowDemo) {
  const guests = twistGuests();
  for (const [me, rival] of [[state.roles.bride, 'groom'], [state.roles.groom, 'bride']].sort(() => Math.random() - 0.5)) {
    const past = state.wedLog[me.id]?.with || {};
    const p = guests.find(x => past[x.id.replace(/^tik-/, '')]);
    if (p) return { user: userOf(p), of: me.name, role: rival, real: true, times: past[p.id.replace(/^tik-/, '')] };
  }
  const busy = new Set([...holderIds()].map(id => id.replace(/^tik-/, '')));
  for (const role of ['groom', 'bride'].sort(() => Math.random() - 0.5)) {
    const q = state.queue[role][0];
    if (!q || busy.has(String(q.id)) || attendantIds().has(String(q.id))) continue;
    const gender = personOf(q.id)?.gender || (role === 'bride' ? 'female' : 'male');
    return { user: { id: String(q.id), name: q.name, avatar: q.avatar || '', gender }, of: state.roles[role === 'groom' ? 'bride' : 'groom'].name, role, real: false, queued: true, times: 0 };
  }
  const p = guests.length ? pick(guests.slice().sort((x, y) => (y.lastSeen || 0) - (x.lastSeen || 0)).slice(0, 12)) : null;
  if (!p && !allowDemo) return null;
  const user = p ? userOf(p) : { id: 'demo-tinh-cu', name: pick(DEMO_EX), avatar: '', gender: Math.random() < 0.5 ? 'male' : 'female' };
  // Nhắm vào vai do MC chọn ngẫu nhiên (vai đó mới cướp được); hai vai như nhau thì theo giới tính nhân vật
  const loose = ['groom', 'bride'].filter(r => !realHolder(r));
  const role = loose.length === 1 ? loose[0] : user.gender === 'female' ? 'bride' : 'groom';
  return { user, of: state.roles[role === 'groom' ? 'bride' : 'groom'].name, role, real: false, times: 0 };
}

// Hết giờ đếm ngược: vào lễ, trừ khi tới lượt có biến cố
function ceremonyDue() {
  if (startTwist()) return;
  startCeremony();
}

function startTwist() {
  const c = state.config;
  if (twist || twistPlan.used || c.enableMarryAuction === false || !overlayClients.size) return false;
  if (state.ceremony.phase !== 'countdown' || openRoles().length < 2 || !state.roles.groom || !state.roles.bride) return false;
  const forced = Boolean(twistPlan.forced);
  if (!twistDue()) return false;
  const kind = pickTwistKind();
  if (!kind) return false;
  const now = Date.now();
  const ms = TWIST_WINDOW_MS[kind];
  const t = {
    id: ++twistSeq, kind, ms, opensAt: now + TWIST_INTRO_MS, endsAt: now + TWIST_INTRO_MS + ms,
    progress: 0, target: 0, contrib: new Map(), gifts: new Map(), last: null, n: 0
  };
  const v = baseVars();
  let line = '';
  if (kind === 'ex') {
    const x = castEx(forced);
    if (!x) return false;
    t.cast = { ...x.user, of: x.of, real: x.real, times: x.times, queued: Boolean(x.queued) };
    t.role = x.role;
    t.canSteal = !realHolder(x.role);
    t.target = twistTarget('ex', ms);
    // Người đứng đầu hàng chờ mới là "lốp trưởng"; khách bất kỳ thì là người yêu cũ
    line = pickLine(x.real ? 'twistExReal' : x.queued ? 'twistExQueue' : 'twistExStart',
      { ...v, name: x.user.name, target: x.of, times: x.times, role: ROLE_LABEL[x.role], holder: state.roles[x.role].name });
  } else if (kind === 'dowry') {
    // Một khách (ưu tiên nhân vật nam) được mời làm bố vợ cho có tên có mặt
    const guests = twistGuests();
    const men = guests.filter(p => p.gender === 'male');
    const dad = guests.length ? userOf(pick(men.length ? men : guests)) : null;
    t.cast = dad || { id: '', name: '', avatar: '', gender: 'male' };
    t.role = 'groom';
    t.canSteal = !realHolder('groom'); // chú rể do MC chọn: xin không đủ thì bị đuổi; chú rể tự nhận vai thì chỉ bị phạt vui
    t.target = twistTarget('dowry', ms);
    line = pickLine('twistDowryStart', { ...v, dad: dad?.name || '', need: t.target });
  } else if (kind === 'blackout') {
    t.target = twistTarget('blackout', ms);
    line = pickLine('twistBlackoutStart', v);
  } else if (kind === 'roach') {
    // Cô dâu hóa gián, chú rể là người bị thử lòng
    t.role = 'bride';
    t.tested = String(state.roles.groom.id);
    t.yes = new Set();   // những người đã chọn "yêu"
    t.noes = new Map();  // những người đã chọn "không yêu" (bị gián rượt cho vui)
    t.canSteal = !realHolder('groom');
    t.target = twistTarget('roach', ms);
    line = pickLine('twistRoachStart', v);
  } else if (kind === 'ring') {
    // Chú rể quên nhẫn: không ai mất vai, không tìm kịp thì đeo tạm dây thun
    t.target = twistTarget('ring', ms);
    line = pickLine('twistRingStart', v);
  } else {
    t.slots = twistGuests().length >= 4 ? 4 : 2;
    t.claims = [];
    t.target = t.slots;
    line = pickLine('twistMassStart', { ...v, slots: t.slots });
  }
  twist = t;
  twistPlan.used = true;
  twistPlan.last = kind;
  state.ceremony.endsAt = t.endsAt + TWIST_TAIL_MS; // đồng hồ "lễ thành hôn sau..." chạy tới lúc thật sự vào lễ
  clearTimeout(ceremonyTimer);
  clearTimeout(twistTimer);
  twistTimer = setTimeout(resolveTwist, t.endsAt - now);
  broadcast('twist', { phase: 'start', ...twistPublic(), couple: coupleInfo(), line });
  markMc();
  broadcastState();
  return true;
}

// Phần của biến cố gửi cho màn hình LIVE (kèm trong 'state' để màn hình mở giữa chừng vẫn theo kịp)
function twistPublic() {
  const t = twist;
  if (!t) return null;
  const now = Date.now();
  return {
    id: t.id, kind: t.kind, ms: t.ms, stage: t.stage || 'pre',
    fix: HITCH[t.kind] ? ruleGiftName(HITCH[t.kind].match) : '', // món quà gỡ ngay sự cố này (nếu luật quà có gán)
    introMs: Math.max(0, t.opensAt - now), remainingMs: Math.max(0, t.endsAt - now),
    progress: Math.min(t.target, Math.floor(t.progress)), target: t.target,
    cast: t.cast || null, role: t.role || '', canSteal: Boolean(t.canSteal),
    yes: t.yes ? t.yes.size : 0, no: t.noes ? t.noes.size : 0, // con gián: số người chọn yêu / không yêu
    slots: t.slots || 0, claims: (t.claims || []).map(u => ({ name: u.name, avatar: u.avatar, vip: Boolean(u.vip) })),
    top: [...t.contrib.values()].sort((a, b) => b.pts - a.pts).slice(0, 3).map(x => ({ name: x.name, avatar: x.avatar, pts: Math.round(x.pts) })),
    // Người hùng: những người đã tặng quà trong màn này, nhiều xu đứng trước
    heroes: [...t.gifts.values()].sort((a, b) => b.coins - a.coins).slice(0, 4).map(x => ({ name: x.name, avatar: x.avatar, coins: x.coins, gift: x.gift })),
    last: t.last
  };
}

// Đầy thanh / đủ suất: chốt sớm, nhưng vẫn để người xem kịp thấy màn mở đầu (và người tặng quà kịp bước lên)
function twistFinishSoon(waitMs = 0) {
  clearTimeout(twistTimer);
  twistTimer = setTimeout(resolveTwist, Math.max(900, waitMs, twist.opensAt + 1500 - Date.now()));
}

function twistNoteGift(t, user, coins, gift) {
  const key = String(user.id);
  const g = t.gifts.get(key) || { id: key, name: user.name || 'Khách', avatar: user.avatar || '', coins: 0, gift: '' };
  g.coins += coins;
  g.gift = gift || g.gift;
  g.name = user.name || g.name;
  if (user.avatar) g.avatar = user.avatar;
  t.gifts.set(key, g);
}

// Một lượt tim / bình luận / quà / chia sẻ góp sức vào thử thách đang diễn. Trả về true nếu lượt đó được tính.
// meta: { gift: tên món quà, love: bình luận có chữ yêu, answer: bình luận trả lời "có / còn" }
function twistAdd(user, kind, amount = 1, meta = {}) {
  const t = twist;
  if (!t || !user?.id) return false;
  const key = String(user.id);
  if (t.cast?.id && t.cast.id === key) return false; // lốp trưởng, bố vợ không tự cứu hay tự phá
  if (t.kind === 'mass') return kind === 'coin' ? twistClaimVip(user, meta.gift) : false;
  const w = TWIST_POINTS[t.kind];
  if (!w) return false;
  const pts = amount * (w[kind] || 0);
  if (!(pts > 0)) return false;
  const full = t.progress >= t.target;
  t.progress += pts;
  if (meta.match) t.progress = Math.max(t.progress, t.target); // món quà của đúng bước đang bị chặn: gỡ ngay
  // Con gián: chính chú rể nói yêu (hoặc tặng quà) là qua bài thử lòng ngay
  const proved = t.kind === 'roach' && key === t.tested && !t.proved && !t.refused && (kind === 'coin' || (kind === 'chat' && (meta.love || meta.answer)));
  if (proved) {
    t.proved = true;
    t.progress = Math.max(t.progress, t.target);
  }
  if (t.kind === 'roach' && key !== 'anon' && (meta.love || meta.answer)) {
    t.yes.add(key);
    // Trước đó chê gián mà giờ đổi ý nói yêu: gỡ tên khỏi danh sách bỏ chạy, đổi luôn thẻ tên
    if (t.noes.delete(key)) { const me = personOf(key); if (me && key !== t.tested) me.baseTag = '💘 Yêu cả gián'; }
  }
  if (key !== 'anon') {
    const x = t.contrib.get(key) || { id: key, name: user.name || 'Khách', avatar: user.avatar || '', pts: 0 };
    x.pts += pts;
    x.name = user.name || x.name;
    if (user.avatar) x.avatar = user.avatar;
    t.contrib.set(key, x);
    if (kind === 'coin') twistNoteGift(t, user, amount, meta.gift);
  }
  t.last = {
    name: user.name || 'Khách', avatar: user.avatar || '', pts: Math.max(1, Math.round(pts)), kind: proved ? 'proof' : kind, n: ++t.n, love: Boolean(meta.love || meta.answer),
    gift: kind === 'coin' ? String(meta.gift || '') : '', coins: kind === 'coin' ? amount : 0
  };
  if (!full && t.progress >= t.target) twistFinishSoon(kind === 'coin' ? TWIST_GIFT_FINISH_MS : 0);
  broadcastState();
  return true;
}

// Con gián: một người chọn "không yêu". Khán giả: ghi vào danh sách "bỏ chạy" (đổi ý nói yêu sau đó thì được gỡ tên).
// Chính chú rể nói không yêu thì khỏi chờ nữa: chốt luôn là không qua bài thử lòng.
function twistRoachNo(user) {
  const t = twist;
  if (!t || t.kind !== 'roach' || !user?.id) return false;
  const key = String(user.id);
  if (holderIds().has('tik-' + key) && key !== t.tested) return false; // cô dâu (đang là gián) không tự chê mình
  t.yes.delete(key);
  const isNew = !t.noes.has(key);
  t.noes.set(key, { id: key, name: user.name || 'Khách', avatar: user.avatar || '' });
  const me = personOf(key);
  if (me && key !== t.tested) me.baseTag = '🪳 Sợ gián';
  const groomSaidNo = key === t.tested && !t.proved && !t.refused;
  if (groomSaidNo) t.refused = true;
  if (isNew || groomSaidNo) t.last = { name: user.name || 'Khách', avatar: user.avatar || '', pts: 0, kind: groomSaidNo ? 'refuse' : 'no', n: ++t.n, gift: '', coins: 0, id: 'tik-' + key };
  if (groomSaidNo) twistFinishSoon(1200);
  broadcastState();
  return true;
}

// Cưới tập thể: bình luận "cưới" để nhận một suất cưới ké ("cười" có dấu không tính)
function twistClaim(user, comment) {
  const t = twist;
  if (!t || t.kind !== 'mass' || t.claims.length >= t.slots || !user?.id) return false;
  const low = String(comment).toLowerCase().normalize('NFC');
  if (!hasWord(low, 'cưới') && !hasWord(low, 'cuoi')) return false;
  const key = String(user.id);
  if (holderIds().has('tik-' + key) || attendantIds().has(key) || t.claims.some(u => u.id === key)) return false;
  t.claims.push({ id: key, name: user.name || 'Khách', avatar: user.avatar || '' });
  t.progress = t.claims.length;
  t.last = { name: user.name || 'Khách', avatar: user.avatar || '', pts: 1, kind: 'claim', n: ++t.n, gift: '', coins: 0 };
  if (t.claims.length >= t.slots) twistFinishSoon();
  broadcastState();
  return true;
}
// Cưới tập thể: tặng quà là có suất hạng nhất: luôn có chỗ (hết suất thì mở thêm một cặp), đứng đầu danh sách
function twistClaimVip(user, gift) {
  const t = twist;
  const key = String(user.id);
  if (holderIds().has('tik-' + key) || attendantIds().has(key)) return false;
  const mine = t.claims.find(u => u.id === key);
  if (mine?.vip) return true;
  if (mine) {
    t.claims.splice(t.claims.indexOf(mine), 1);
  } else if (t.claims.length >= t.slots) {
    if (t.slots >= MASS_MAX_SLOTS) return false;
    t.slots += 2;
    t.target = t.slots;
  }
  t.claims.unshift({ id: key, name: user.name || 'Khách', avatar: user.avatar || '', vip: true });
  twistNoteGift(t, user, 0, gift);
  t.progress = t.claims.length;
  t.last = { name: user.name || 'Khách', avatar: user.avatar || '', pts: 1, kind: 'vip', n: ++t.n, gift: String(gift || ''), coins: 0 };
  if (t.claims.length >= t.slots) twistFinishSoon(TWIST_GIFT_FINISH_MS);
  broadcastState();
  return true;
}

// Chú rể bị loại khỏi sân khấu vì biến cố (bố vợ đuổi, thấy gián bỏ chạy): về bước tìm rể mới
function twistKickGroom(out, tag) {
  const groom = state.roles.groom;
  const me = personOf(groom.id);
  if (me) me.baseTag = tag;
  state.roles.groom = null;
  state.bids.groom = {};
  kickBan = { id: groom.id, until: Date.now() + 90000 };
  Object.assign(out, { kick: true, role: 'groom', previous: groom.name, previousAvatar: groom.avatar || '' });
}

function resolveTwist() {
  const t = twist;
  if (!t) return;
  clearTimeout(twistTimer);
  if (!twistStageOk(t)) return abortTwist();
  twist = null;
  const win = t.kind === 'mass' || (t.progress >= t.target && !t.refused); // chú rể tự nói không yêu thì cả rạp nói yêu mấy cũng không qua
  // Người hùng của màn: ai tặng quà nhiều xu nhất; không ai tặng quà thì người góp tim, bình luận nhiều nhất
  const patron = [...t.gifts.values()].sort((a, b) => b.coins - a.coins)[0] || null;
  const top = [...t.contrib.values()].sort((a, b) => b.pts - a.pts)[0] || null;
  const hero = patron || top;
  const out = {
    phase: 'end', id: t.id, kind: t.kind, win, cast: t.cast || null,
    hero: hero && { name: hero.name, avatar: hero.avatar, pts: Math.round(top && top.id === hero.id ? top.pts : 0), byGift: Boolean(patron), gift: patron?.gift || '' }
  };
  const v = { ...baseVars(), hero: hero?.name || 'cả rạp' };
  let line = '';
  if (t.kind === 'ex') {
    const role = t.role;
    const partner = state.roles[role === 'groom' ? 'bride' : 'groom'];
    const me = personOf(t.cast.id);
    if (win) {
      if (me) me.baseTag = t.cast.queued ? '🛞 Lốp trưởng' : '💔 Người yêu cũ';
      line = pickLine('twistExWin', { ...v, name: t.cast.name });
    } else if (!realHolder(role)) {
      // Vai do MC chọn ngẫu nhiên: lốp trưởng cướp luôn, người cũ văng khỏi sân khấu
      const prev = state.roles[role];
      setRole(role, t.cast, 0);
      // Người đứng đầu hàng chờ lên vai thì là người thật nhận vai (không bị biến cố khác cướp lại); khách bất kỳ thì vẫn là vai MC chọn
      if (!t.cast.queued) state.roles[role].random = true;
      const loser = personOf(prev.id);
      if (loser) loser.baseTag = role === 'groom' ? '💔 Bị cướp vợ' : '💔 Bị cướp chồng';
      feat(t.cast.id, t.cast.name, 'steal');
      Object.assign(out, { steal: true, role, previous: prev.name, previousAvatar: prev.avatar || '' });
      line = pickLine('twistExSteal', { ...v, name: t.cast.name, previous: prev.name, role: ROLE_LABEL[role], partner: partner.name });
    } else {
      // Người giữ vai đã tự nhận vai: không mất vai vì biến cố, lốp trưởng ở lại dự cưới
      if (me) me.baseTag = t.cast.queued ? '🥲 Lốp trưởng dự cưới' : '🥲 Người yêu cũ dự cưới';
      out.stay = true;
      line = pickLine('twistExStay', { ...v, name: t.cast.name });
    }
  } else if (t.kind === 'dowry') {
    const groom = state.roles.groom;
    if (win) {
      line = pickLine('twistDowryWin', { ...v, dad: t.cast?.name || '' });
    } else if (!realHolder('groom')) {
      twistKickGroom(out, '🧹 Bị bố vợ đuổi');
      line = pickLine('twistDowryKick', { ...v, groom: groom.name });
    } else {
      out.soft = true;
      line = pickLine('twistDowrySoft', v);
    }
  } else if (t.kind === 'blackout') {
    if (win) {
      const guests = twistGuests();
      const caught = guests.length ? pick(guests) : null;
      const gag = pick(BLACKOUT_GAGS);
      if (caught) caught.baseTag = gag.tag;
      Object.assign(out, { caught: caught && { id: caught.id, name: caught.name, avatar: caught.avatar || '' }, gag: gag.text });
      line = pickLine('twistBlackoutWin', { ...v, name: caught?.name || 'MC', gag: gag.text });
    } else {
      line = pickLine('twistBlackoutLose', v);
    }
  } else if (t.kind === 'roach') {
    const groom = state.roles.groom;
    if (win) {
      out.proved = Boolean(t.proved);
      line = pickLine(t.proved ? 'twistRoachProved' : 'twistRoachWin', v);
    } else if (!realHolder('groom')) {
      twistKickGroom(out, '🏃 Thấy gián là chạy');
      line = pickLine(t.refused ? 'twistRoachRefuse' : 'twistRoachFlee', { ...v, groom: groom.name });
    } else {
      out.soft = true;
      line = pickLine('twistRoachSoft', v);
    }
    out.refused = Boolean(t.refused);
    Object.assign(out, { yes: t.yes.size, no: t.noes.size, noNames: [...t.noes.values()].filter(u => u.id !== t.tested).slice(0, 3).map(u => u.name) });
  } else if (HITCH[t.kind]) {
    line = pickLine(`twist${HITCH[t.kind].name}${win ? 'Win' : 'Lose'}`, { ...v, dad: t.cast?.name || '' });
  } else {
    // Cưới tập thể: chưa đủ người bình luận thì MC bốc thêm khách trong rạp cho đủ cặp
    const list = t.claims.slice();
    const taken = new Set([...holderIds(), ...list.map(u => 'tik-' + u.id)]);
    const pool = twistGuests().filter(p => !taken.has(p.id)).sort(() => Math.random() - 0.5);
    while (list.length < t.slots && pool.length) list.push(userOf(pool.pop()));
    massPairs = [];
    for (let i = 0; i + 1 < list.length; i += 2) massPairs.push({ a: list[i], b: list[i + 1] });
    for (const { a, b } of massPairs) for (const u of [a, b]) { const me = personOf(u.id); if (me) me.baseTag = u.vip ? '👑 Cưới ké hạng nhất' : '💍 Cưới ké'; }
    out.pairs = massPairs.map(({ a, b }) => ({ a: { name: a.name, avatar: a.avatar || '', vip: Boolean(a.vip) }, b: { name: b.name, avatar: b.avatar || '', vip: Boolean(b.vip) } }));
    line = massPairs.length
      ? pickLine('twistMassDone', { ...v, pairs: massPairs.map(({ a, b }) => `${a.name} với ${b.name}`).join(', ') })
      : pickLine('twistMassNone', v);
  }
  // Thắng: người hùng nhận danh hiệu. Người hùng là người tặng quà (không phải cô dâu, chú rể) thì được ghi công
  // cạnh đôi trẻ tới hết lượt cưới, và MC đọc thêm một câu vinh danh.
  if (win && hero && TWIST_FEAT[t.kind]) {
    feat(hero.id, hero.name, TWIST_FEAT[t.kind]);
    if (patron && !holderIds().has('tik-' + patron.id)) {
      state.patron = { id: patron.id, name: patron.name, avatar: patron.avatar || '', kind: t.kind, gift: patron.gift || '' };
      line = `${line} ${pickLine('twistHero', { ...v, hero: patron.name, gift: patron.gift || 'quà' })}`.trim();
    }
  }
  broadcast('twist', { ...out, line });
  markMc();
  if (t.stage === 'party') {
    partyAfterHitch(t, win, hero);
  } else if (state.roles.groom && state.roles.bride) {
    // Còn đủ đôi: diễn xong kết cục rồi vào lễ
    state.ceremony.endsAt = Date.now() + TWIST_TAIL_MS;
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(ceremonyDue, TWIST_TAIL_MS);
  } else {
    // Chú rể bị đuổi / bỏ chạy: về bước tìm người (hàng chờ lên trước, không có thì MC ghép đôi ngẫu nhiên)
    evaluateCeremony();
    schedulePromotion(5000);
  }
  persistState();
  broadcastState();
}

// Có người vừa lên thay vai (tặng quà thay chú rể / cô dâu) giữa lúc biến cố đang diễn: biến cố khép lại ngay.
// Chính lốp trưởng tự tặng quà thì là "cướp thành công"; người khác thì là "chen ngang".
// Trả về câu MC để đọc lúc người tặng bước lên sân khấu (thay cho câu thay vai thường lệ).
function twistRoleChanged(user, r) {
  const t = twist;
  if (!t || !r?.became) return '';
  twist = null;
  clearTimeout(twistTimer);
  // Đồng hồ vào lễ đang do biến cố giữ: trả lại để evaluateCeremony(true) (gọi ngay sau khi đổi vai) đặt lại giờ làm lễ
  if (t.stage !== 'party') state.ceremony.endsAt = Date.now();
  const partner = state.roles[r.role === 'groom' ? 'bride' : 'groom'];
  const v = { ...baseVars(), name: user.name || 'Khách', previous: r.previous || 'người cũ', role: ROLE_LABEL[r.role], partner: partner?.name || 'nửa kia' };
  const bought = t.kind === 'ex' && t.cast?.id === String(user.id);
  broadcast('twist', { phase: 'end', id: t.id, kind: t.kind, cast: t.cast || null, role: r.role, previous: r.previous || '', by: user.name || 'Khách', ...(bought ? { bought: true } : { cut: true }) });
  return pickLine(bought ? 'twistExBought' : 'twistCut', v);
}

// Đôi này không còn (bị phá đám, có người thay vai làm thiếu người) hoặc vào lễ sớm: bỏ biến cố đang diễn
function abortTwist() {
  const t = twist;
  if (!t) return;
  twist = null;
  clearTimeout(twistTimer);
  broadcast('twist', { phase: 'end', id: t.id, kind: t.kind, aborted: true });
}
// Biến cố trước lễ diễn trong lúc đếm ngược; sự cố của tiệc mừng diễn trong tiệc mừng. Đôi trẻ không còn đủ thì thôi.
function twistStageOk(t) {
  return Boolean(state.roles.groom && state.roles.bride) && state.ceremony.phase === (t.stage === 'party' ? 'reception' : 'countdown');
}
setInterval(() => {
  if (twist && !twistStageOk(twist)) {
    abortTwist();
    broadcastState();
  }
}, 500);

// ========================================================
// VAI PHỤ: PHÙ DÂU, PHÙ RỂ
// Bình luận "phù dâu" / "phù rể" lúc sân khấu đã có người chờ cưới là nhận vai (miễn phí, mỗi vai một người).
// Không ai nhận thì lúc đủ đôi MC mời hai khách đang tương tác nhiều nhất.
// Phù dâu, phù rể của lượt này được MC ưu tiên chọn làm cô dâu, chú rể khi ghép đôi ngẫu nhiên lượt sau:
// ở lại thêm một lượt là tới mình lên xe hoa.
// ========================================================
const ATTEND = {
  maid: { label: 'phù dâu', tag: '💐 Phù dâu', next: 'bride' },
  bestman: { label: 'phù rể', tag: '🎩 Phù rể', next: 'groom' }
};
const NEXT_UP_MS = 4 * 60 * 1000; // sau chừng này mà chưa tới lượt (rạp toàn người tặng quà nhận vai) thì thôi ưu tiên
let nextUp = { groom: null, bride: null };
const attendantsOn = () => state.config.attendants !== false && state.config.enableMarryAuction !== false;
const attendantIds = () => new Set(Object.values(state.attendants).filter(Boolean).map(a => a.id));

function detectAttendant(comment) {
  const n = norm(comment).replace(/[^a-z0-9 ]+/g, ' ');
  if (hasWord(n, 'phu dau')) return 'maid';
  if (hasWord(n, 'phu re')) return 'bestman';
  return null;
}
function setAttendant(slot, user, auto = false) {
  state.attendants[slot] = { id: String(user.id), name: user.name || 'Khách', avatar: user.avatar || '', auto };
  const p = personOf(user.id);
  if (p) p.baseTag = ATTEND[slot].tag;
}
function clearAttendants() {
  for (const a of Object.values(state.attendants || {})) {
    const p = a && personOf(a.id);
    if (p && Object.values(ATTEND).some(x => x.tag === p.baseTag)) p.baseTag = '✨ Khách quý';
  }
  state.attendants = { maid: null, bestman: null };
}
// Người đang có vai trong biến cố (người yêu cũ, bố vợ, người đã nhận suất cưới ké) thì không kiêm phù dâu, phù rể
const twistBusy = id => Boolean(twist && (twist.cast?.id === String(id) || (twist.claims || []).some(u => u.id === String(id))));
function claimAttendant(user, slot) {
  if (!attendantsOn() || !['idle', 'countdown'].includes(state.ceremony.phase)) return false;
  if (!state.roles.groom && !state.roles.bride) return false; // chưa có ai chờ cưới thì chưa cần phù dâu, phù rể
  const key = String(user.id);
  if (state.attendants[slot] || holderIds().has('tik-' + key) || attendantIds().has(key) || twistBusy(key)) return false;
  setAttendant(slot, user);
  // MC chỉ nhắc khi đang rảnh lời, không chen vào câu đang đọc
  const quiet = Date.now() - lastMcAt > 3500 && !twist;
  broadcast('action', {
    action: 'attendant', list: [{ slot, name: user.name, avatar: user.avatar || '' }],
    line: quiet ? pickLine('attendantTaken', { ...baseVars(), name: user.name, role: ATTEND[slot].label }) : ''
  });
  if (quiet) markMc();
  return true;
}
// Vừa đủ đôi mà còn thiếu phù dâu / phù rể: MC mời khách đang tương tác nhiều nhất (ưu tiên đúng giới tính nhân vật)
function autoAttendants() {
  if (!attendantsOn() || state.ceremony.phase !== 'countdown') return;
  const busy = new Set([...holderIds(), ...[...attendantIds()].map(id => 'tik-' + id)]);
  const pool = state.people
    .filter(p => !p.bot && !busy.has(p.id) && isPresent(p) && !twistBusy(p.id.replace(/^tik-/, '')))
    .map(p => ({ p, e: engagement.get(p.id.replace(/^tik-/, '')) }))
    .filter(x => x.e && x.e.total > 0)
    .sort((a, b) => (b.e.streak - a.e.streak) || (b.e.total - a.e.total));
  const list = [];
  for (const slot of ['maid', 'bestman']) {
    if (state.attendants[slot] || !pool.length) continue;
    const want = slot === 'maid' ? 'female' : 'male';
    const i = Math.max(0, pool.findIndex(x => x.p.gender === want));
    const u = userOf(pool.splice(i, 1)[0].p);
    setAttendant(slot, u, true);
    list.push({ slot, name: u.name, avatar: u.avatar });
  }
  if (!list.length) return;
  broadcast('action', { action: 'attendant', list, auto: true });
  persistState();
  broadcastState();
}
// Đôi vừa cưới rời sân khấu: phù dâu, phù rể của họ được ưu tiên lên vai lượt sau
function queueNextUp() {
  const now = Date.now();
  for (const [slot, a] of Object.entries(state.attendants)) {
    if (!a) continue;
    if (nextUp[ATTEND[slot].next]?.from === 'bouquet') continue; // người bắt được hoa đã giữ chỗ này
    nextUp[ATTEND[slot].next] = { ...a, at: now };
    const p = personOf(a.id);
    if (p) p.baseTag = '🍀 Lấy vía cưới';
  }
}
function takeNextUp(role, taken, takenNames) {
  const up = nextUp[role];
  if (!up) return null;
  nextUp[role] = null;
  const p = personOf(up.id);
  return p && !p.bot && Date.now() - up.at < NEXT_UP_MS && isPresent(p) && !taken.has(p.id) && !takenNames.has(p.name) ? p : null;
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
  if (!quietMs || !overlayClients.size || pairing.applying || twist) return;
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
// before -> n: số cặp trước và sau lễ này (cưới tập thể tăng mấy cặp một lúc, vượt qua mốc là mở tiệc)
function schedulePartyForCouples(before, n) {
  const every = partyEvery();
  if (!every || Math.floor(n / every) === Math.floor(before / every)) return;
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

// ========================================================
// TIỆC MỪNG TỰ DIỄN (partyFree): cưới xong đôi trẻ tự hôn, cắt bánh, cụng ly rồi vào phòng tân hôn, không cần ai tặng quà:
// buổi LIVE lúc nào cũng có trò để xem. Cứ hitchEvery lượt thì một SỰ CỐ chen vào chặn đúng một bước (xem HITCH):
// người xem đã thấy bước đó diễn trọn vẹn ở lượt trước nên muốn cứu. Gỡ được thì bước đó diễn ra, người gỡ được ghi công;
// không gỡ được thì diễn bản chữa cháy. Quà "động phòng luôn" vẫn tiễn đôi trẻ vào phòng ngay (người tặng là ông mai, bà mối).
// ========================================================
const PARTY_STEPS = ['kiss', 'cake', 'cheers'];
const PARTY_ACTION = { kiss: 'kiss', cake: 'cake', cheers: 'champagne' };
const PARTY_FIRST_MS = 6500; // chờ bảng tin "tân lang tân nương" và ảnh cưới hiện xong rồi mới vào bước đầu
let party = null;            // tiệc mừng đang tự diễn: { queue: các bước còn lại, hitch: bước sẽ gặp sự cố, gap }
const hitchPlan = { since: 0, next: 0, last: '', forced: '' };
const partyOn = () => state.config.partyFree !== false && state.config.ceremonySteps !== 'auto';

// Lượt này có sự cố không, và là sự cố nào (khác loại vừa diễn lần trước)
function pickHitch() {
  const forced = hitchPlan.forced;
  hitchPlan.forced = '';
  if (forced) return forced;
  const every = clampNum(state.config.hitchEvery, 0, 50, 2);
  if (!every || !overlayClients.size) return '';
  const jitter = () => (every < 3 ? every : every + Math.floor(Math.random() * 3) - 1);
  if (!hitchPlan.next) hitchPlan.next = jitter();
  if (++hitchPlan.since < hitchPlan.next) return '';
  hitchPlan.since = 0;
  hitchPlan.next = jitter();
  const pool = PARTY_KINDS.filter(k => state.config.twists?.[k] !== false);
  const fresh = pool.filter(k => k !== hitchPlan.last);
  const kind = (fresh.length ? pick(fresh) : pool[0]) || '';
  if (kind) hitchPlan.last = kind;
  return kind;
}
// Đồng hồ tiệc mừng trên màn hình: còn bao lâu nữa thì đôi trẻ vào phòng tân hôn
function partyEta(firstMs) {
  const rest = party ? party.queue.filter(k => k !== 'room').length : 0;
  state.ceremony.endsAt = Date.now() + firstMs + rest * (party?.gap || 0);
}
function startParty() {
  const now = Date.now();
  const total = clampNum(state.config.receptionSeconds, 8, 600, 25) * 1000;
  party = {
    queue: [...PARTY_STEPS, 'toss', 'moon', 'room'], hitch: pickHitch(),
    gap: Math.round(Math.min(15000, Math.max(6000, (total - PARTY_FIRST_MS) / PARTY_STEPS.length)))
  };
  state.ceremony = { phase: 'reception', endsAt: now, startedAt: now, party: true };
  partyEta(PARTY_FIRST_MS);
  clearTimeout(ceremonyTimer);
  ceremonyTimer = setTimeout(partyNext, PARTY_FIRST_MS);
  persistState();
  broadcastState();
}
// Một bước của tiệc mừng diễn ra (miễn phí). line = câu MC; sau sự cố thì MC đã nói rồi, không đọc thêm
function partyStep(step, withLine = true) {
  const action = PARTY_ACTION[step];
  broadcast('action', { action, name: 'MC', initiator: '', free: true, line: withLine ? pickLine(action, baseVars()) : '' });
  if (withLine) markMc();
}
function partyNext() {
  if (!party || state.ceremony.phase !== 'reception') return;
  clearTimeout(ceremonyTimer);
  const step = party.queue.shift();
  if (!step) return;
  if (step === party.hitch && startHitch(step)) return; // gỡ xong (hoặc hết giờ) thì resolveTwist gọi partyAfterHitch đi tiếp
  if (step === 'room') return partyRoom('');
  if (step === 'toss') {
    // Tung hoa cưới: có cửa sổ riêng, hết giờ thì resolveToss gọi đi tiếp. Đang tắt thì bỏ qua bước này
    if (startToss()) return;
    return partyNext();
  }
  if (step === 'moon') {
    // Tuần trăng mật: có cửa sổ riêng, hết giờ thì resolveMoon gọi đi tiếp. Đang tắt (hoặc chưa mở màn hình) thì bỏ qua bước này
    if (startMoon()) return;
    return partyNext();
  }
  partyStep(step);
  partyEta(party.gap);
  ceremonyTimer = setTimeout(partyNext, party.gap);
  broadcastState();
}
// Sự cố chen vào ngay trước một bước của tiệc mừng: dùng chung bộ máy "hai cửa" của biến cố
function startHitch(kind) {
  if (twist || !HITCH[kind] || !overlayClients.size || state.ceremony.phase !== 'reception' || !state.roles.groom || !state.roles.bride) return false;
  const now = Date.now();
  const ms = TWIST_WINDOW_MS[kind];
  const t = {
    id: ++twistSeq, kind, stage: 'party', ms, opensAt: now + TWIST_INTRO_MS, endsAt: now + TWIST_INTRO_MS + ms,
    progress: 0, target: twistTarget(kind, ms), contrib: new Map(), gifts: new Map(), last: null, n: 0
  };
  const guests = twistGuests();
  if (kind === 'kiss') {
    // Một khách (ưu tiên nhân vật nam) được mời làm bố vợ cho có tên có mặt
    const men = guests.filter(p => p.gender === 'male');
    t.cast = guests.length ? userOf(pick(men.length ? men : guests)) : { id: '', name: '', avatar: '', gender: 'male' };
  } else if (kind === 'cheers') {
    t.cast = { id: '', name: 'Chú Ba', avatar: '', gender: 'male' }; // nhân vật của rạp, không gán cho khách nào
  } else if (kind === 'room') {
    t.cast = guests.length ? userOf(pick(guests)) : { id: '', name: '', avatar: '', gender: 'male' }; // trưởng hội bạn thân
  }
  twist = t;
  partyEta(TWIST_INTRO_MS + ms + HITCH_TAIL_MS);
  clearTimeout(ceremonyTimer);
  clearTimeout(twistTimer);
  twistTimer = setTimeout(resolveTwist, t.endsAt - now);
  broadcast('twist', { phase: 'start', ...twistPublic(), couple: coupleInfo(), line: pickLine(`twist${HITCH[kind].name}Start`, { ...baseVars(), dad: t.cast?.name || '' }) });
  markMc();
  broadcastState();
  return true;
}
// Sự cố của tiệc mừng vừa có kết cục: thắng thì bước bị chặn diễn ra (đã có người hùng), thua thì bỏ qua bước đó
function partyAfterHitch(t, win, hero) {
  clearTimeout(ceremonyTimer);
  if (!party) return;
  if (t.kind === 'room') {
    // Mở được cửa: người gỡ là ông mai, bà mối tiễn đôi trẻ vào phòng. Không mở được: đôi trẻ ngủ ngoài hành lang
    const by = win ? hero?.name || '' : '';
    partyEta(HITCH_TAIL_MS);
    ceremonyTimer = setTimeout(() => (win ? partyRoom(by) : partyEnd()), HITCH_TAIL_MS);
    return;
  }
  if (!win) {
    partyEta(HITCH_TAIL_MS);
    ceremonyTimer = setTimeout(partyNext, HITCH_TAIL_MS);
    return;
  }
  partyEta(HITCH_STEP_AT_MS + party.gap);
  ceremonyTimer = setTimeout(() => {
    if (!party || state.ceremony.phase !== 'reception') return;
    partyStep(t.kind, false);
    ceremonyTimer = setTimeout(partyNext, party.gap);
  }, HITCH_STEP_AT_MS);
}
// Hết tiệc: đôi trẻ vào phòng tân hôn. by = người gỡ sự cố chặn cửa (làm ông mai, bà mối); không có thì là tiệc tàn tự vào
function partyRoom(by = '') {
  party = null;
  if (startCeremony({ quick: true, finale: true, initiator: by, free: true })) return;
  partyEnd();
}
// Không vào được phòng (hội bạn thân không mở cửa): đôi trẻ chào rồi rời sân khấu
function partyEnd() {
  party = null;
  clearTimeout(ceremonyTimer);
  state.ceremony = { phase: 'running', endsAt: Date.now() + FAREWELL_MS, mode: 'farewell', married: true };
  broadcast('action', { action: 'reception_end', hallway: true, ...coupleInfo(), line: '' });
  broadcastState();
  ceremonyTimer = setTimeout(endTurn, FAREWELL_MS);
}

// ========================================================
// TUNG HOA CƯỚI: cô dâu tung hoa, khán giả tranh nhau bắt. Ai bắt được thì THẬT SỰ được xếp lên làm cô dâu / chú rể lượt sau
// (khách nữ làm cô dâu, khách nam làm chú rể), nên ai xem cũng có cửa lên sân khấu mà không cần quà:
//   cửa miễn phí  bình luận "chụp" (hoặc "bắt") trong lúc hoa đang bay; hết giờ bốc một người trong số đã giơ tay
//   cửa quà       tặng một món quà bất kỳ là "chụp chắc": người tặng (nhiều xu nhất, ai trước thì hơn) chắc chắn bắt được,
//                 và được đứng ĐẦU hàng chờ. Người bắt bằng bình luận thì xếp cuối hàng chờ (sau những người đã tặng quà xếp hàng).
// Bốc ngẫu nhiên chỉ dùng cho cửa miễn phí; đã tặng quà thì kết quả chắc chắn. Không ai chụp thì hoa rơi, không ai mất gì.
// Chạy như một bước của tiệc mừng tự diễn; món quà "tung hoa cưới" cũng mở màn này (lúc không làm lễ).
// ========================================================
const TOSS_INTRO_MS = 1400; // cô dâu lấy đà, bảng hiện lên rồi mới tính giờ
const TOSS_TAIL_MS = 5200;  // hoa bay tới tay người bắt được, vinh danh xong rồi mới đi tiếp
const TOSS_WORDS = ['chụp', 'chup', 'bắt', 'bat'];
let toss = null;            // lượt tung hoa đang mở: { endsAt, grabs: Map, gifts: Map, timer, step }
const tossSeconds = () => clampNum(state.config.tossSeconds, 0, 30, 9);
function tossPublic() {
  const t = toss;
  if (!t) return null;
  const top = [...t.gifts.values()].sort((a, b) => b.coins - a.coins || a.at - b.at)[0] || null;
  return { remainingMs: Math.max(0, t.endsAt - Date.now()), count: t.grabs.size, top: top && { name: top.name, avatar: top.avatar } };
}
// step = true: đang là một bước của tiệc mừng tự diễn (xong thì tiệc đi tiếp)
function startToss({ step = true } = {}) {
  const sec = tossSeconds();
  if (toss || twist || moon || !sec || !overlayClients.size || !state.roles.groom || !state.roles.bride) return false;
  if (state.ceremony.phase === 'running') return false;
  // Mở bằng món quà "tung hoa cưới": chỉ trong tiệc mừng kiểu cũ (tiệc tự diễn thì lượt nào cũng đã có bước tung hoa)
  if (!step && (party || state.ceremony.phase !== 'reception')) return false;
  const now = Date.now();
  const ms = sec * 1000;
  toss = { endsAt: now + TOSS_INTRO_MS + ms, grabs: new Map(), gifts: new Map(), step };
  toss.timer = setTimeout(resolveToss, TOSS_INTRO_MS + ms);
  if (step && party) partyEta(TOSS_INTRO_MS + ms + TOSS_TAIL_MS);
  broadcast('toss', { phase: 'start', ms, introMs: TOSS_INTRO_MS, ...tossPublic(), ...coupleInfo(), line: pickLine('tossStart', baseVars()) });
  markMc();
  broadcastState();
  return true;
}
// Ai đang giữ vai thì không chụp hoa của chính đám cưới mình
const tossCan = user => Boolean(user?.id) && !holderIds().has('tik-' + String(user.id));
// Bình luận "chụp" / "bắt": giơ tay bắt hoa
function tossGrab(user, comment) {
  const t = toss;
  if (!t || !tossCan(user)) return false;
  const low = String(comment).toLowerCase().normalize('NFC');
  if (!TOSS_WORDS.some(w => hasWord(low, w))) return false;
  const key = String(user.id);
  if (t.grabs.has(key)) return true;
  t.grabs.set(key, { id: key, name: user.name || 'Khách', avatar: user.avatar || '' });
  broadcast('toss', { phase: 'grab', id: 'tik-' + key, name: user.name || 'Khách', ...tossPublic() });
  return true;
}
// Quà tặng lúc hoa đang bay: "chụp chắc". Trả về câu MC cho món quà đó (rỗng nếu không tính).
function tossGift(user, coins, gift) {
  const t = toss;
  if (!t || !(coins > 0) || !tossCan(user)) return '';
  const key = String(user.id);
  const g = t.gifts.get(key) || { id: key, name: user.name || 'Khách', avatar: user.avatar || '', coins: 0, at: Date.now() };
  g.coins += coins;
  g.name = user.name || g.name;
  if (user.avatar) g.avatar = user.avatar;
  t.gifts.set(key, g);
  broadcast('toss', { phase: 'grab', id: 'tik-' + key, name: g.name, sure: true, ...tossPublic() });
  return pickLine('tossGift', { ...baseVars(), name: g.name, gift: gift || 'quà' });
}
function resolveToss() {
  const t = toss;
  if (!t) return;
  clearTimeout(t.timer);
  toss = null;
  const paid = [...t.gifts.values()].sort((a, b) => b.coins - a.coins || a.at - b.at)[0] || null;
  const pool = [...t.grabs.values()].filter(u => tossCan(u));
  const w = paid && tossCan(paid) ? paid : pool.length ? pick(pool) : null;
  const out = { phase: 'end', count: t.grabs.size + [...t.gifts.keys()].filter(k => !t.grabs.has(k)).length, winner: null, ...coupleInfo() };
  let line = '';
  if (w) {
    const me = personOf(w.id);
    const role = me?.gender === 'female' ? 'bride' : 'groom';
    if (me) me.baseTag = '💐 Bắt được hoa';
    let position = 0;
    if (queueOn()) {
      // Có hàng chờ: chụp bằng quà thì đứng đầu hàng; chụp bằng bình luận thì xếp cuối hàng (sau những người đã tặng quà xếp hàng)
      const q = state.queue[role];
      const at = q.findIndex(x => x.id === w.id);
      if (paid) {
        if (at >= 0) q.splice(at, 1);
        q.unshift({ id: w.id, name: w.name, avatar: w.avatar || '', at: Date.now() });
        position = 1;
      } else if (at >= 0) {
        position = at + 1;
      } else if (q.length < 20) {
        q.push({ id: w.id, name: w.name, avatar: w.avatar || '', at: Date.now() });
        position = q.length;
      }
    }
    // Không có hàng chờ (hoặc hàng đã đầy): giữ chỗ để lượt sau MC mời người này lên trước
    if (!position) nextUp[role] = { id: w.id, name: w.name, avatar: w.avatar || '', at: Date.now(), from: 'bouquet' };
    out.winner = { id: 'tik-' + w.id, name: w.name, avatar: w.avatar || '', byGift: Boolean(paid), role, position };
    line = pickLine(paid ? 'tossWinGift' : 'tossWin', { ...baseVars(), name: w.name, role: ROLE_LABEL[role] });
  } else {
    line = pickLine('tossNone', baseVars());
  }
  broadcast('toss', { ...out, line });
  markMc();
  if (t.step && party && state.ceremony.phase === 'reception') {
    partyEta(TOSS_TAIL_MS);
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(partyNext, TOSS_TAIL_MS);
  }
  persistState();
  broadcastState();
}
// Đôi trẻ rời sân khấu hoặc được tiễn thẳng vào phòng giữa lúc tung hoa: bỏ lượt tung hoa đó
function dropToss() {
  if (!toss) return;
  clearTimeout(toss.timer);
  toss = null;
  broadcast('toss', { phase: 'end', aborted: true });
}

// ========================================================
// TUẦN TRĂNG MẬT: bước cuối của tiệc mừng tự diễn, trước khi vào phòng tân hôn. Màn hình bày ra danh sách điểm đến (ảnh nền
// làm mờ), mỗi nơi một mức xu; cả rạp tặng quà để chọn:
//   gần nhà (miễn phí)   quán trà đá, sân thượng, hồ câu cá: mặc định, bốc một trong ba
//   có giá               tổng xu quà của cả rạp trong chuyến đạt mức của nơi nào thì đôi trẻ đi nơi đó (lấy nơi đắt nhất đã đạt).
//                        Cửa miễn phí: cả rạp thả tim, bình luận đủ mục tiêu thì được nơi rẻ nhất trong các nơi có giá.
// Ai cũng góp chung một chuyến (không chia phe, không may rủi); người tặng nhiều xu nhất là nhà tài trợ. Hết giờ thì hiện tấm
// ảnh check-in có đôi trẻ ở nơi được chọn. Không ai làm gì thì đôi trẻ trăng mật ở chỗ gần nhà: không mất gì, chỉ kém sang.
// ========================================================
const MOON_FREE = [
  { key: 'trada', name: 'quán trà đá đầu ngõ' }, { key: 'santhuong', name: 'sân thượng nhà chú rể' }, { key: 'hocau', name: 'hồ câu cá cuối xóm' }
];
// tier: 1 = trong nước, 2 = nước ngoài (để chọn câu MC)
const MOON_PAID = [
  { key: 'dalat', name: 'Đà Lạt', tier: 1 }, { key: 'phuquoc', name: 'Phú Quốc', tier: 1 }, { key: 'halong', name: 'vịnh Hạ Long', tier: 1 },
  { key: 'seoul', name: 'Seoul', tier: 2 }, { key: 'tokyo', name: 'Tokyo', tier: 2 }, { key: 'paris', name: 'Paris', tier: 2 }, { key: 'maldives', name: 'Maldives', tier: 2 }
];
const MOON_PRICE_DEFAULT = { dalat: 1, phuquoc: 5, halong: 10, seoul: 30, tokyo: 50, paris: 99, maldives: 199 };
const MOON_INTRO_MS = 2600; // chữ "tuần trăng mật" và danh sách điểm đến hiện xong rồi mới tính giờ
const MOON_TAIL_MS = 6000;  // hiện tấm ảnh check-in có đôi trẻ, khoe xong rồi mới đi tiếp
let moon = null;            // chuyến trăng mật đang mở: { endsAt, options, place, points, target, heartsDone, coins, gifts, timer }
let moonLastFree = '';      // chỗ gần nhà vừa dùng, để hai chuyến liền nhau không trùng
const moonSeconds = () => clampNum(state.config.moonSeconds, 0, 60, 12);
function moonPrices() {
  const c = state.config.moonPrices || {};
  return Object.fromEntries(MOON_PAID.map(p => [p.key, Math.round(clampNum(c[p.key], 1, 1000000, MOON_PRICE_DEFAULT[p.key]))]));
}
// Danh sách điểm đến của một chuyến: ba chỗ miễn phí, rồi các nơi có giá xếp từ rẻ tới đắt
function moonOptions() {
  const pr = moonPrices();
  return [...MOON_FREE.map(p => ({ ...p, tier: 0, price: 0 })), ...MOON_PAID.map(p => ({ ...p, price: pr[p.key] })).sort((a, b) => a.price - b.price)];
}
const moonSponsor = m => [...m.gifts.values()].sort((a, b) => b.coins - a.coins)[0] || null;
function moonPublic() {
  const m = moon;
  if (!m) return null;
  const sp = moonSponsor(m);
  return {
    tier: m.place.tier, place: { key: m.place.key, name: m.place.name, price: m.place.price },
    options: m.options.map(o => ({ key: o.key, name: o.name, price: o.price, tier: o.tier })),
    remainingMs: Math.max(0, m.endsAt - Date.now()),
    progress: Math.min(m.target, Math.floor(m.points)), target: m.target, heartsDone: m.heartsDone, coins: m.coins,
    sponsor: sp && { name: sp.name, avatar: sp.avatar, coins: sp.coins, gift: sp.gift }
  };
}
function startMoon() {
  const sec = moonSeconds();
  if (moon || !sec || !overlayClients.size || state.ceremony.phase !== 'reception' || !state.roles.groom || !state.roles.bride) return false;
  const now = Date.now();
  const ms = sec * 1000;
  const options = moonOptions();
  const free = options.filter(o => !o.price);
  const fresh = free.filter(o => o.key !== moonLastFree);
  const place = pick(fresh.length ? fresh : free);
  moonLastFree = place.key;
  moon = { endsAt: now + MOON_INTRO_MS + ms, options, place, points: 0, target: twistTarget('moon', ms), heartsDone: false, coins: 0, gifts: new Map() };
  moon.timer = setTimeout(resolveMoon, MOON_INTRO_MS + ms);
  partyEta(MOON_INTRO_MS + ms + MOON_TAIL_MS);
  broadcast('moon', { phase: 'start', ms, introMs: MOON_INTRO_MS, ...moonPublic(), ...coupleInfo(), line: pickLine('moonStart', { ...baseVars(), place: place.name }) });
  markMc();
  broadcastState();
  return true;
}
// Một lượt tim / bình luận / quà góp vào chuyến trăng mật. Trả về câu MC cho món quà (rỗng nếu không phải quà hoặc không tính).
function moonAdd(user, kind, amount = 1, gift = '') {
  const m = moon;
  if (!m || !user?.id || !(amount > 0)) return '';
  const name = user.name || 'Khách';
  const at = o => m.options.indexOf(o);
  let best = null;
  if (kind === 'coin') {
    const key = String(user.id);
    const g = m.gifts.get(key) || { id: key, name, avatar: user.avatar || '', coins: 0, gift: '' };
    g.coins += amount;
    g.gift = gift || g.gift;
    g.name = name;
    if (user.avatar) g.avatar = user.avatar;
    m.gifts.set(key, g);
    m.coins += amount;
    best = m.options.filter(o => o.price > 0 && o.price <= m.coins).pop() || null; // nơi đắt nhất mà tổng quà đã đạt
  } else {
    m.points += amount * (TWIST_POINTS.moon[kind] || 0);
    if (!m.heartsDone && m.points >= m.target) {
      m.heartsDone = true;
      best = m.options.find(o => o.price > 0) || null; // đủ tim: được nơi rẻ nhất trong các nơi có giá
    }
  }
  let line = '';
  if (best && at(best) > at(m.place)) {
    m.place = best;
    const v = { ...baseVars(), name, gift: gift || 'quà', place: best.name };
    line = pickLine(kind !== 'coin' ? 'moonUpFree' : best.tier === 2 ? 'moonUpAbroad' : 'moonUpGift', v);
    // Quà: câu MC đi kèm thẻ quà của người tặng (không đọc hai lần). Tim, bình luận: màn hình đọc câu này
    broadcast('moon', { phase: 'up', ...moonPublic(), by: kind === 'coin' ? { name, avatar: user.avatar || '' } : null, line: kind === 'coin' ? '' : line });
    if (kind !== 'coin') markMc();
  } else if (kind === 'coin') {
    line = pickLine('moonGift', { ...baseVars(), name, gift: gift || 'quà', place: m.place.name });
  }
  broadcastState();
  return kind === 'coin' ? line : '';
}
function resolveMoon() {
  const m = moon;
  if (!m) return;
  clearTimeout(m.timer);
  moon = null;
  const sp = moonSponsor(m);
  if (sp) {
    feat(sp.id, sp.name, 'traveler');
    const me = personOf(sp.id);
    if (me) me.baseTag = '✈️ Tài trợ trăng mật';
  }
  broadcast('moon', {
    phase: 'end', tier: m.place.tier, place: { key: m.place.key, name: m.place.name, price: m.place.price }, sponsor: sp && { name: sp.name, avatar: sp.avatar, coins: sp.coins, gift: sp.gift }, ...coupleInfo(),
    line: pickLine(['moonEndHome', 'moonEndDomestic', 'moonEndAbroad'][m.place.tier], { ...baseVars(), place: m.place.name, hero: sp?.name || 'cả rạp' })
  });
  markMc();
  if (party && state.ceremony.phase === 'reception') {
    partyEta(MOON_TAIL_MS);
    clearTimeout(ceremonyTimer);
    ceremonyTimer = setTimeout(partyNext, MOON_TAIL_MS);
  }
  persistState();
  broadcastState();
}
// Đôi trẻ rời sân khấu hoặc được tiễn thẳng vào phòng giữa chuyến trăng mật: bỏ chuyến đó
function dropMoon() {
  if (!moon) return;
  clearTimeout(moon.timer);
  moon = null;
  broadcast('moon', { phase: 'end', aborted: true });
}

// Tiệc mừng: đôi vừa cưới ở lại sân khấu chờ khách tặng quà. Hết giờ mà không ai cho động phòng thì đôi trẻ chào rồi rời sân khấu.
function startReception() {
  if (partyOn()) return startParty();
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
  if (c.phase !== 'reception' || party) return; // tiệc mừng tự diễn có lịch riêng, không kéo dài theo quà
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
  // Có quà động phòng trong luật mà hết giờ không ai tặng: phòng tân hôn khóa cửa, đôi trẻ lỡ phòng
  const missed = Boolean(ruleGiftName(['dongphong', 'quickwed']));
  broadcast('action', { action: 'reception_end', missed, ...coupleInfo(), line: pickLine(missed ? 'roomMissed' : 'ceremonyEnd', baseVars()) });
  markMc();
  broadcastState();
  ceremonyTimer = setTimeout(endTurn, FAREWELL_MS);
}

// Đôi trẻ rời sân khấu: mở vai cho lượt mới
function endTurn({ quiet = false } = {}) {
  clearTimeout(ceremonyTimer);
  lastTurnEndAt = Date.now();
  queueNextUp();
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
// SINH CON: đôi trẻ vào động phòng xong, cửa phòng đóng thêm một lúc ("chín tháng mười ngày sau...").
// Trong lúc đó ai tặng món quà gán cho "Sinh bé trai" hoặc "Sinh bé gái" thì đôi trẻ sinh bé đó, người tặng ĐẦU TIÊN
// của mỗi món làm bố / mẹ đỡ đầu. Có cả hai món thì sinh đôi một trai một gái: không bên nào thua, nên không thành
// hai phe đua quà (TikTok không cho chia phe bằng quà). Không ai tặng thì cửa mở như thường, MC chúc sớm sinh quý tử.
// Chỉ chạy khi luật quà có gán quà cho ít nhất một trong hai hành động đó; babySeconds = 0 là tắt.
// ========================================================
const BABY_OPEN_MS = 6000;   // từ lúc bắt đầu động phòng tới lúc cửa phòng đóng hẳn (khớp cảnh trên màn hình)
const BABY_REVEAL_MS = 6000; // mở cửa khoe em bé rồi mới hết lượt
let baby = null;             // cửa sổ sinh con đang mở: { endsAt, boy, girl, timer } (chỉ nhớ trong phiên)
const babySeconds = () => clampNum(state.config.babySeconds, 0, 60, 15);
const babyOn = () => babySeconds() > 0 && (state.config.giftRules || []).some(r => r.action === 'babyBoy' || r.action === 'babyGirl');
const babyPublic = () => baby && { remainingMs: Math.max(0, baby.endsAt - Date.now()), boy: baby.boy, girl: baby.girl };

function startBaby(ms) {
  clearTimeout(baby?.timer);
  baby = { endsAt: Date.now() + BABY_OPEN_MS + ms, boy: null, girl: null, timer: setTimeout(resolveBaby, BABY_OPEN_MS + ms) };
}
// Một món quà "bé trai" / "bé gái". Trả về true nếu người tặng thành bố / mẹ đỡ đầu (người đầu tiên của món đó).
function babyGift(user, sex, gift) {
  const b = baby;
  if (!b || Date.now() > b.endsAt || b[sex]) return false;
  b[sex] = { id: String(user.id), name: user.name || 'Khách', avatar: user.avatar || '', gift: String(gift || '') };
  broadcast('baby', { phase: 'gift', sex, ...babyPublic(), line: pickLine(sex === 'boy' ? 'babyGiftBoy' : 'babyGiftGirl', { ...baseVars(), name: b[sex].name, gift }) });
  markMc();
  broadcastState();
  return true;
}
function resolveBaby() {
  const b = baby;
  if (!b) return;
  clearTimeout(b.timer);
  baby = null;
  const result = b.boy && b.girl ? 'twins' : b.boy ? 'boy' : b.girl ? 'girl' : 'none';
  const givers = [b.boy, b.girl].filter(Boolean).filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
  if (result !== 'none') {
    state.stats.babies = (state.stats.babies || 0) + (result === 'twins' ? 2 : 1);
    for (const g of givers) {
      feat(g.id, g.name, 'godparent');
      const me = personOf(g.id);
      if (me) me.baseTag = result === 'twins' && givers.length === 1 ? '🍼 Đỡ đầu hai bé' : b.boy?.id === g.id ? '🍼 Đỡ đầu bé trai' : '🍼 Đỡ đầu bé gái';
    }
  }
  const key = { twins: 'babyTwins', boy: 'babyBoy', girl: 'babyGirl', none: 'babyNone' }[result];
  broadcast('baby', { phase: 'end', result, boy: b.boy, girl: b.girl, ...coupleInfo(), line: pickLine(key, { ...baseVars(), givers: givers.map(g => g.name).join(' và ') }) });
  markMc();
  persistState();
  broadcastState();
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
  petal: 'mưa hoa hồng', kiss: 'đôi trẻ hôn nhau', dance: 'lên sàn nhảy', cake: 'cắt bánh',
  champagne: 'khui sâm panh', cheers: 'cụng ly', ring: 'trao nhẫn',
  dongphong: 'động phòng', quickwed: 'động phòng',
  bouquet: 'tung hoa cưới', fireworks: 'bắn pháo hoa', groom: 'làm chú rể', bride: 'làm cô dâu'
};
// Thứ tự MC kể "quà gì → làm gì": các bước sau lễ thành hôn trước (hôn, cắt bánh, động phòng). Quà nhận vai có câu riêng.
const SUMMARY_ORDER = ['kiss', 'cake', 'quickwed', 'dongphong', 'champagne', 'bouquet', 'fireworks', 'dance', 'petal', 'cheers', 'ring'];

// "Thả Tim để đôi trẻ hôn nhau, Lát Bánh Kem để cắt bánh" — mỗi lần MC chỉ kể hai món cho câu ngắn
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
  if (parts.length > 2) parts.splice(Math.floor(Math.random() * parts.length), 1); // đủ ba món thì bỏ bớt một, lần sau kể món khác
  return parts.length ? parts.join(', ') : 'quà bất kỳ để chung vui cùng cô dâu chú rể';
}

// Tên quà đầu tiên của luật cho các hành động này (vd "Chú Heo May Mắn")
function ruleGiftName(actions) {
  const r = (state.config.giftRules || []).find(x => actions.includes(x.action) && String(x.gifts || '').trim());
  const first = r && String(r.gifts).split(',').map(x => x.trim()).find(x => x && !x.startsWith('#'));
  return first ? first.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : '';
}

// "tặng Hạc Giấy để phá đám" — theo luật đang dùng; có nhiều cách thì mỗi lần MC nhắc một cách cho câu ngắn
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
    if (g) parts.push(`tặng ${g} để ${verb}`);
  }
  return parts.length ? pick(parts) : 'tặng quà để giành vai';
}

function baseVars() {
  return {
    crashHow: crashSummary(),
    heldHow: queueOn() ? 'vai có người thì xếp hàng chờ tới lượt' : 'vai có người thì tặng quà là giành ngay',
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
    // Đứng đầu hàng chờ: lên chức "lốp trưởng"
    if (roleResult.queueJoined) return pickLine(roleResult.position === 1 ? 'queueHead' : 'queueJoined', { ...vars, role: roleLabel, position: roleResult.position, holder: roleResult.holder || 'cặp đôi hiện tại' });
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
let seekCount = 0;
function idleLine() {
  const v = baseVars();
  if (state.ceremony.phase === 'reception') {
    return pickLine(state.ceremony.party ? 'partyRemind' : 'receptionRemind', { ...v, seconds: Math.max(1, Math.ceil((state.ceremony.endsAt - Date.now()) / 1000)) });
  }
  const empty = openRoles().filter(r => !state.roles[r]);
  // Đang tìm cô dâu chú rể (còn vai trống): cứ ba câu thì chen một câu mời theo dõi, bấm chuông, chia sẻ.
  // Chen thêm chứ không chiếm lượt của các câu bên dưới; nhóm này bị xóa hết câu thì bỏ qua
  if (state.config.enableMarryAuction !== false && empty.length && seekCount++ % 3 === 0) {
    const line = pickLine('idleFollow', v);
    if (line) return line;
  }
  idleCount++;
  if (idleCount % 3 === 1) return pickLine('poemIdle', v); // đọc thơ cho rạp đỡ trống
  if (state.config.enableMarryAuction !== false && idleCount % 4 === 2) return pickLine('idleSocial', v); // rủ làm quen, kết bạn
  if (state.config.enableMarryAuction === false || idleCount % 3 === 0) return pickLine('intro', v);
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
  if (c.speech === false || !overlayClients.size || state.ceremony.phase === 'running' || twist) return;
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
  // Ảnh cưới: người hùng của biến cố lượt này (người tặng quà cứu đám cưới) được đứng cạnh đôi trẻ trong ảnh
  const hero = kind === 'wedding' && state.patron ? state.patron : null;
  const exclude = new Set([...holderIds(), giver ? 'tik-' + giver.id : '', hero ? 'tik-' + hero.id : '']);
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
    giver: giver ? { name: giver.name, avatar: giver.avatar || '' } : hero ? { name: hero.name, avatar: hero.avatar || '', hero: hero.kind } : null,
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
  notePulse('like', count);
  const liker = ev?.id && ev.id !== 'unknown' ? { id: ev.id, name: ev.name || 'Khách', avatar: ev.avatar } : { id: 'anon', name: 'Cả rạp' };
  twistAdd(liker, 'like', count);
  moonAdd(liker, 'like', count);
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
  twistAdd(user, 'share', 1);
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
  notePulse('chat');
  // Đang có biến cố: bình luận là góp sức, đúng từ khóa của màn đó thì tính gấp đôi (bố vợ thách cưới: "bố", "cưới";
  // con gián: chữ nói yêu, và chính chú rể nói yêu là qua luôn); cưới tập thể: gõ "cưới" để cưới ké
  if (twist) {
    const low = comment.toLowerCase().normalize('NFC');
    // "không yêu", "hong có" là lời chối: không tính là nói yêu
    const roach = twist.kind === 'roach';
    const loveWord = roach && LOVE_WORDS.some(w => hasWord(low, w));
    const no = roach && LOVE_DENIALS.some(w => hasWord(low, w));
    const love = loveWord && !no;
    const answer = twist.kind === 'roach' && !no && LOVE_ANSWERS.some(w => hasWord(low, w));
    const dad = twist.kind === 'dowry' && /(^| )(bo|ba|cuoi)( |$)/.test(norm(comment).replace(/[^a-z0-9 ]+/g, ' '));
    const word = Boolean(HITCH[twist.kind]?.words.some(w => hasWord(low, w))); // từ khóa của sự cố ("hôn", "xuống", "mở"...)
    // Con gián: mỗi người tự chọn. "Yêu" thì góp sức như cũ; "không yêu" (hoặc "chạy", "sợ") thì không góp, người đó bị
    // gián rượt cho vui. Hai lựa chọn không đấu nhau: kết cục vẫn chỉ tùy cả rạp nói yêu đủ hay chưa.
    // Lời chối chỉ tính khi đi kèm chữ yêu ("không yêu") hoặc là một câu thật ngắn ("không", "hong nha"), để bình luận
    // chuyện khác có chữ "không" không bị hiểu nhầm
    const short = low.trim().split(/\s+/).length <= 3;
    const flee = roach && !love && ((no && (loveWord || short)) || (!loveWord && ROACH_FLEE.some(w => hasWord(low, w))));
    if (flee) twistRoachNo(user);
    else twistAdd(user, 'chat', love || dad || word ? 2 : 1, { love, answer });
    twistClaim(user, comment);
  }
  moonAdd(user, 'chat', 1);
  tossGrab(user, comment);
  const attend = detectAttendant(comment);
  if (attend) claimAttendant(user, attend);

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
    // Bước đang bị sự cố chặn (vd bố vợ chặn hôn) thì bình luận không tự diễn bước đó được: phải gỡ sự cố trước
    const blocked = Boolean(twist && HITCH[twist.kind]?.match.includes(a));
    if (a && !blocked && now - (lastCommentRitual[a] || 0) >= cd && now - lastAnyCommentRitual >= 2500) {
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
    mcSay(pickLine(r.position === 1 ? 'queueHead' : 'queueJoined', { ...vars, position: r.position, holder: r.holder || 'cặp đôi hiện tại' }), 'event');
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
  // Quà lớn không gán nghi thức thường là "chụp ảnh chung"; giữa lúc có biến cố thì không dừng màn kịch để chụp:
  // người tặng làm người hùng của màn đó, thắng thì có tên trong ảnh cưới ngay sau lễ
  if ((twist || moon || toss) && action === 'photo') action = 'thanks'; // giữa chuyến trăng mật cũng vậy: quà lớn là đổi vé, không dừng lại chụp ảnh
  // Sự cố đang chặn một bước: món quà của đúng bước đó không tự diễn nữa mà gỡ luôn sự cố, người tặng là người hùng
  let hitchFix = false;
  let tossOpener = false; // món quà này vừa mời cô dâu tung hoa: người tặng là người mời, không tính là lượt chụp
  if (twist && HITCH[twist.kind]?.match.includes(action)) {
    hitchFix = true;
    action = 'thanks';
  }

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
    if (startToss({ step: false })) {
      // Mở màn chụp hoa cho cả rạp tranh nhau (người tặng món quà này là người mời tung hoa)
      action = 'thanks';
      tossOpener = true;
      blockedLine = pickLine('tossByGift', { ...baseVars(), name, gift });
    } else {
      const c = pickBouquetCatcher(key);
      special = { catcher: c };
      extra.catcher = c ? c.name : 'một vị khách may mắn';
    }
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
  } else if (action === 'babyBoy' || action === 'babyGirl') {
    // Quà đón em bé: chỉ có tác dụng lúc cửa phòng tân hôn đang đóng. Người đầu tiên của mỗi món làm bố / mẹ đỡ đầu,
    // màn hình báo ngay trên cánh cửa (không chờ tới lượt đi lên thảm đỏ). Lúc khác thì là quà mừng thường.
    if (babyGift(user, action === 'babyBoy' ? 'boy' : 'girl', gift)) skipFocus = true;
    else action = 'thanks';
  }

  // Quà tặng giữa lúc đang có biến cố (quà phá đám, động phòng luôn đã tự khép biến cố ở trên):
  //   quà làm đổi vai (thay chú rể / cô dâu): biến cố khép lại, MC đọc câu "cướp thành công" hoặc "chen ngang"
  //   quà khác: người tặng thành người hùng của màn đó (vệ sĩ, góp sính lễ, thắp nến...), MC cảm ơn theo đúng câu chuyện
  let twistLine = '';
  let twistHero = null;
  if (twist) {
    const kind = twist.kind;
    if (roleResult?.became) {
      twistLine = twistRoleChanged(user, roleResult);
    } else if (twistAdd(user, 'coin', coins, { gift, match: hitchFix })) {
      twistHero = { kind, coins };
      if (action !== 'role') twistLine = pickLine(TWIST_GIFT_LINE[kind], { ...baseVars(), name, gift, count, coins });
    }
  }

  // Quà tặng giữa tuần trăng mật: góp vào chuyến đi (đổi vé lên nấc sang hơn), người tặng nhiều xu nhất là nhà tài trợ
  const moonLine = moon && !twist && action !== 'role' ? moonAdd(user, 'coin', coins, gift) : '';
  // Quà tặng lúc hoa cưới đang bay: "chụp chắc" bó hoa
  const tossLine = toss && !twist && !tossOpener && action !== 'role' ? tossGift(user, coins, gift) : '';

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
    twist: twistHero || undefined, // quà này góp vào biến cố đang diễn: màn hình cho người tặng làm người hùng
    funnyMessage: action === 'photo' ? '' : (blockedLine || twistLine || moonLine || tossLine || buildMessage(action, { name, gift, count, coins }, roleResult, extra)),
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
    state.config.twistEvery = clampNum(state.config.twistEvery, 0, 50, 3);
    state.config.babySeconds = clampNum(state.config.babySeconds, 0, 60, 15);
    twistPlan.next = 0; // nhịp biến cố tính lại theo số vừa lưu, không chờ hết nhịp cũ
    state.config.hitchEvery = clampNum(state.config.hitchEvery, 0, 50, 2);
    state.config.moonSeconds = clampNum(state.config.moonSeconds, 0, 60, 12);
    state.config.tossSeconds = clampNum(state.config.tossSeconds, 0, 30, 9);
    state.config.moonPrices = moonPrices();
    delete state.config.moonAbroadCoins;
    state.config.partyFree = state.config.partyFree !== false;
    hitchPlan.next = 0;
    state.config.twists = sanitizeTwists(state.config.twists);
    state.config.attendants = state.config.attendants !== false;
    if (!state.config.attendants) clearAttendants();
    state.config.autoPair = state.config.autoPair !== false;
    state.config.freeRoles = state.config.freeRoles === true;
    state.config.autoPairSeconds = clampNum(state.config.autoPairSeconds, 5, 600, 60);
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

  // Thử một biến cố: đang đếm ngược thì diễn luôn, chưa đủ đôi thì diễn ngay lúc đôi kế tiếp sắp làm lễ
  if (pathname === '/api/twist' && req.method === 'POST') {
    const data = await readJson();
    const kind = TWIST_KINDS.includes(data.kind) || PARTY_KINDS.includes(data.kind) ? data.kind : '';
    if (!kind) return sendJson(res, 400, { ok: false, error: 'Không có biến cố này' });
    if (twist) return sendJson(res, 409, { ok: false, error: 'Đang có một biến cố diễn ra' });
    if (!overlayClients.size) return sendJson(res, 409, { ok: false, error: 'Chưa mở màn hình LIVE (overlay) nên không diễn được' });
    if (PARTY_KINDS.includes(kind)) {
      // Sự cố của tiệc mừng: đang tiệc mừng mà bước đó chưa tới thì diễn ngay trong lượt này, không thì để lượt cưới kế tiếp
      if (!partyOn()) return sendJson(res, 409, { ok: false, error: 'Cần bật "Tiệc mừng tự diễn" thì mới có sự cố này' });
      const now = Boolean(party && party.queue.includes(kind));
      if (now) party.hitch = kind;
      else hitchPlan.forced = kind;
      return sendJson(res, 200, { ok: true, now });
    }
    twistPlan.forced = kind;
    twistPlan.used = false;
    const now = state.ceremony.phase === 'countdown' && startTwist();
    return sendJson(res, 200, { ok: true, now: Boolean(now) });
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
    abortTwist();
    clearTimeout(baby?.timer);
    baby = null;
    clearAttendants();
    nextUp = { groom: null, bride: null };
    massPairs = [];
    Object.assign(twistPlan, { since: 0, next: 0, last: '', forced: '', used: false });
    Object.assign(hitchPlan, { since: 0, next: 0, last: '', forced: '' });
    party = null;
    dropMoon();
    dropToss();
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
