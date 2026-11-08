const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let lastState = null;

// ========================================================
// TIỆN ÍCH
// ========================================================
let toastTimer = null;
function toast(msg, isError = false) {
  const el = $('#panel-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

async function api(path, body, method = 'POST') {
  try {
    const res = await fetch(path, method === 'GET' ? {} : {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
    return data;
  } catch (e) {
    toast('⚠️ ' + e.message, true);
    throw e;
  }
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.filter(c => c !== null && c !== undefined));
  return node;
}

const fmt = n => (Number(n) || 0).toLocaleString('vi-VN');
const timeStr = ts => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const isEditing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

// ========================================================
// ĐỒNG HỒ, TAB, LINK
// ========================================================
function updateClock() {
  $('#live-clock').textContent = `🕒 ${new Date().toTimeString().split(' ')[0]}`;
}
setInterval(updateClock, 1000);
updateClock();

$$('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    $$('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#${btn.dataset.tab}`)?.classList.add('active');
    if (btn.dataset.tab === 'tab-bgm') loadMusic();
    if (btn.dataset.tab === 'tab-voice') loadVoices();
    if (btn.dataset.tab === 'tab-mclines' && !mcRendered) loadMcEditor();
    if (btn.dataset.tab === 'tab-album') loadAlbum();
  });
});

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`📋 Đã sao chép ${label}`);
  } catch {
    prompt(`Sao chép ${label}:`, text);
  }
}

$('#btn-copy-link')?.addEventListener('click', () => copyText(`${location.origin}/overlay.html`, 'link màn hình LIVE — dán vào OBS Browser Source (1080×1920)'));

let webhookPath = '';
api('/api/webhook-info', null, 'GET').then(d => {
  webhookPath = d.path;
  $('#webhook-path').textContent = d.path;
}).catch(() => {});
$('#btn-copy-webhook')?.addEventListener('click', () => copyText(webhookPath, 'đường dẫn webhook (ghép sau link tunnel)'));

$('#btn-refresh-preview')?.addEventListener('click', () => {
  $('#preview-iframe').src = `/overlay.html?preview=1&v=${Date.now()}`;
});

// ========================================================
// NÚT NGHI THỨC
// ========================================================
const ACTION_DONE = {
  ceremony: '💒 Bắt đầu lễ thành hôn!',
  reset_roles: '🔄 Đã mở lại vai cô dâu – chú rể',
  steal_groom: '🤵 Khách ảo đang lên cướp chú rể...',
  steal_bride: '👰 Khách ảo đang lên cướp cô dâu...',
  photo: '📸 Đang chụp ảnh cưới — ảnh sẽ lưu vào Album',
  quickwed: '⚡ Động phòng luôn!',
  cancel: '💔 Đã phá đám — cặp đôi xuống sân khấu',
  bouquet: '💐 Cô dâu tung hoa cưới!',
  fireworks: '🎆 Bắn pháo hoa!',
  music: '🎵 Đã chuyển bài nhạc'
};
$$('[data-action]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const action = btn.dataset.action;
    try {
      const r = await api('/api/action', { action });
      toast(action === 'music' && r.track ? `🎵 Đang phát: ${r.track}` : (ACTION_DONE[action] || '✨ Đã kích hoạt trên màn hình LIVE'));
      if (action === 'photo') setTimeout(loadAlbum, 4000);
    } catch {}
  });
});

// ========================================================
// MÔ PHỎNG
// ========================================================
const DEMO_NAMES = ['Ngọc Hân', 'Hoàng Long', 'Minh Thư', 'Tuệ An', 'Anh Dũng', 'Kim Ngân', 'Thanh Tùng', 'Phương Thảo', 'Văn Hùng', 'Thành Đạt', 'Mai Linh', 'Bảo Nam'];
const demoId = name => 'demo-' + name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, '-');

async function simComment(name, comment) {
  await api('/api/demo', { type: 'chat', id: demoId(name), name, comment });
}
async function simGift(name, gift, coinsEach, count = 1) {
  return api('/api/demo', { type: 'gift', id: demoId(name), name, gift, diamonds: coinsEach, count });
}

$('#btn-send-sim-comment')?.addEventListener('click', async () => {
  const comment = $('#sim-comment-input').value.trim() || 'Chúc mừng trăm năm hạnh phúc! 🎉';
  try { await simComment(pick(DEMO_NAMES), comment); toast('💬 Đã gửi bình luận thử'); } catch {}
});
$('#sim-comment-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-send-sim-comment').click(); });

$$('.tag-btn[data-cmt]').forEach(tag => {
  tag.addEventListener('click', () => {
    $('#sim-comment-input').value = tag.dataset.cmt;
    $('#btn-send-sim-comment').click();
  });
});

$$('.tag-btn[data-sim]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const type = btn.dataset.sim;
    const name = pick(DEMO_NAMES);
    try {
      await api('/api/demo', { type, id: demoId(name), name, count: Number(btn.dataset.count) || 1 });
      toast(type === 'like' ? `❤️ ${name} thả ${btn.dataset.count} tim` : type === 'share' ? `📤 ${name} chia sẻ rạp cưới` : `➕ ${name} theo dõi kênh`);
    } catch {}
  });
});

$('#btn-sim-gift')?.addEventListener('click', async () => {
  const gift = $('#sim-gift-name').value.trim() || 'Rose';
  const coins = Math.max(1, Number($('#sim-gift-coins').value) || 1);
  const count = Math.max(1, Number($('#sim-gift-count').value) || 1);
  const name = $('#sim-gift-sender').value.trim() || pick(DEMO_NAMES);
  try {
    const r = await simGift(name, gift, coins, count);
    toast(`🎁 ${name} tặng ${gift} ×${count} → ${ACTION_LABEL[r.offeringEvent?.action] || r.offeringEvent?.action}`);
  } catch {}
});

const ACTION_LABEL = {
  role: '👑 Làm chú rể / cô dâu (đấu giá)',
  groom: '🤵 Làm chú rể',
  bride: '👰 Làm cô dâu',
  dongphong: '🏮 Động phòng',
  dance: '💃 Lên sàn nhảy',
  kiss: '💋 Cô dâu chú rể hôn',
  cake: '🎂 Cắt bánh cưới',
  champagne: '🍾 Rót rượu sâm panh',
  cheers: '🍻 Cụng ly 1 2 3 dzô',
  petal: '🌹 Mưa hoa hồng',
  ring: '💍 Trao nhẫn',
  replaceGroom: '🔁 Thay chú rể (lên ngay)',
  replaceBride: '🔁 Thay cô dâu (lên ngay)',
  quickwed: '⚡ Động phòng luôn (thành hôn ngay)',
  cancel: '💔 Hủy hôn, phá đám',
  bouquet: '💐 Tung hoa cưới',
  fireworks: '🎆 Bắn pháo hoa',
  music: '🎵 Đổi nhạc (bài kế tiếp)',
  mc: '🎤 Cưới MC',
  photo: '📸 Chụp ảnh chung',
  thanks: '💌 Mừng phong bì (cảm ơn)'
};

function renderRuleGiftButtons(rules) {
  const box = $('#sim-rule-gifts');
  if (!box) return;
  box.replaceChildren();
  rules.forEach(r => {
    const first = String(r.gifts || '').split(',').map(s => s.trim()).find(s => s && !s.startsWith('#'));
    const gift = first || 'Quà bất kỳ';
    const coins = Math.max(1, Number(r.minCoins) || 1);
    box.append(el('button', {
      class: 'tag-btn',
      text: `${gift}${r.minCoins ? ` (${coins} xu)` : ''} → ${ACTION_LABEL[r.action] || r.action}`,
      onclick: async () => {
        const name = pick(DEMO_NAMES);
        try { await simGift(name, gift, coins, 1); toast(`🎁 ${name} tặng ${gift}`); } catch {}
      }
    }));
  });
  if (lastState?.config?.roleSystem !== 'queue') box.append(el('button', {
    class: 'tag-btn',
    text: '👰 Thử làm cô dâu (cmt + 10 xu)',
    onclick: async () => {
      const name = pick(['Ngọc Lan', 'Thu Trang', 'Kim Chi', 'Bảo Ngọc']);
      try {
        await simComment(name, 'Cho em làm cô dâu nha 👰');
        await sleep(400);
        await simGift(name, 'GG', Math.max(10, Number(lastState?.config?.minCoinsToMarry) || 10), 1);
        toast(`👰 ${name} xin làm cô dâu`);
      } catch {}
    }
  }));
}

// Kịch bản mô phỏng nguyên buổi tiệc (~1 phút)
let simRunning = false;
$('#btn-sim-full')?.addEventListener('click', async () => {
  if (simRunning) return toast('Đang mô phỏng, chờ chút nhé...');
  simRunning = true;
  const btn = $('#btn-sim-full');
  btn.disabled = true;
  const rules = lastState?.config?.giftRules || [];
  const giftFor = action => {
    const r = rules.find(x => x.action === action && String(x.gifts || '').trim());
    return r ? String(r.gifts).split(',')[0].trim() : null;
  };
  const min = Math.max(1, Number(lastState?.config?.minCoinsToMarry) || 10);
  const queue = lastState?.config?.roleSystem === 'queue';
  const groomGift = giftFor('groom') || 'GG';
  const brideGift = giftFor('bride') || 'GG';
  const steps = [
    () => simComment('Lan Nguyễn', 'Chúc mừng hạnh phúc hai bạn! 🎉'),
    () => simComment('Hùng', '1 2 3 dzô!! 🍻'),
    () => api('/api/demo', { type: 'like', id: demoId('Lan Nguyễn'), name: 'Lan Nguyễn', count: 300 }),
    () => giftFor('petal') && simGift('Lan Nguyễn', giftFor('petal'), 1, 5),
    ...(queue
      ? [
        () => simGift('Minh Đẹp Zai', groomGift, 1, 1),
        () => simGift('Thu Trang', brideGift, 1, 1),
        () => simGift('Văn Hùng', groomGift, 1, 1),
        () => giftFor('bouquet') && simGift('Bé Na', giftFor('bouquet'), 5, 1)
      ]
      : [
        () => simGift('Minh Đẹp Zai', 'GG', min, 1),
        () => simComment('Thu Trang', 'Cho em làm cô dâu với 👰'),
        () => simGift('Thu Trang', 'GG', min + 2, 1),
        () => simGift('Văn Hùng', 'GG', min, 1),
        () => simGift('Văn Hùng', 'GG', min, 1)
      ]),
    () => simComment('Hùng', 'nữ'),
    () => api('/api/demo', { type: 'share', id: demoId('Kim Chi'), name: 'Kim Chi' }),
    () => giftFor('dance') && simGift('Bé Na', giftFor('dance'), 30, 1),
    () => simComment('Quang', 'hôn đi hôn đi 💋')
  ];
  toast('🎬 Bắt đầu mô phỏng — xem bên khung xem trước / OBS');
  try {
    for (const step of steps) {
      await step();
      await sleep(5500);
    }
    toast('🎬 Xong! Nếu đủ đôi, lễ thành hôn sẽ tự diễn ra sau đếm ngược.');
  } catch {}
  simRunning = false;
  btn.disabled = false;
});

// ========================================================
// CÔ DÂU, CHÚ RỂ & ĐẤU GIÁ
// ========================================================
$('#btn-save-couple')?.addEventListener('click', async () => {
  const config = {
    groom: $('#cfg-groom').value.trim() || 'Tuấn Anh',
    bride: $('#cfg-bride').value.trim() || 'Mai Vy',
    title: $('#cfg-title').value.trim() || 'TIỆC CƯỚI ONLINE',
    slogan: $('#cfg-slogan').value.trim(),
    date: $('#cfg-date').value,
    enableMarryAuction: $('#cfg-marry-auction').value === 'true',
    roleMode: $('#cfg-role-mode').value,
    minCoinsToMarry: Math.max(1, Number($('#cfg-min-marry').value) || 10),
    autoCeremony: $('#cfg-auto-ceremony').value === 'true',
    ceremonyCountdown: Math.max(5, Number($('#cfg-ceremony-countdown').value) || 45),
    roleSystem: $('#cfg-role-system').value,
    photoAfterCeremony: $('#cfg-photo-after').value === 'true',
    maxGuests: Number($('#cfg-max-guests').value) || 54,
    likeGoal: Math.max(100, Number($('#cfg-like-goal').value) || 5000),
    moneyUnit: $('#cfg-money-unit').value,
    titleDecaySeconds: Math.max(10, Number($('#cfg-title-decay').value) || 30),
    showMC: $('#cfg-show-mc').value === 'true'
  };
  const switched = lastState?.config?.roleSystem && lastState.config.roleSystem !== config.roleSystem;
  try {
    await api('/api/config', { config });
    toast(switched
      ? `✅ Đã lưu. Đổi sang ${config.roleSystem === 'queue' ? 'Hàng chờ' : 'Đấu giá'} — vào tab Luật Quà bấm "${config.roleSystem === 'queue' ? 'Bộ quà Hàng chờ' : 'Bộ quà Đấu giá'}" để có bộ quà phù hợp`
      : '✅ Đã lưu cô dâu, chú rể & cách chơi');
  } catch {}
});

// ========================================================
// LUẬT QUÀ
// ========================================================
let rulesDirty = false;

function ruleRow(rule) {
  const select = el('select', { class: 'rule-action' });
  for (const [k, label] of Object.entries(ACTION_LABEL)) {
    const opt = el('option', { value: k, text: label });
    if (k === rule.action) opt.selected = true;
    select.append(opt);
  }
  const tr = el('tr', {},
    el('td', {}, el('input', { class: 'rule-gifts', type: 'text', value: rule.gifts || '', placeholder: 'để trống = mọi quà' })),
    el('td', { class: 'col-min' }, el('input', { class: 'rule-min', type: 'number', min: '0', value: String(Number(rule.minCoins) || 0) })),
    el('td', { class: 'col-act' }, select),
    el('td', { class: 'col-move' },
      el('button', { class: 'icon-btn', title: 'Lên', text: '▲', onclick: () => { tr.previousElementSibling?.before(tr); rulesDirty = true; } }),
      el('button', { class: 'icon-btn', title: 'Xuống', text: '▼', onclick: () => { tr.nextElementSibling?.after(tr); rulesDirty = true; } })
    ),
    el('td', { class: 'col-del' }, el('button', { class: 'icon-btn danger', title: 'Xóa', text: '✕', onclick: () => { tr.remove(); rulesDirty = true; } }))
  );
  tr.addEventListener('input', () => { rulesDirty = true; });
  tr.addEventListener('change', () => { rulesDirty = true; });
  return tr;
}

function renderRules(rules) {
  const tbody = $('#rules-table tbody');
  if (!tbody) return;
  tbody.replaceChildren(...rules.map(ruleRow));
  rulesDirty = false;
}

function readRules() {
  return Array.from($$('#rules-table tbody tr')).map(tr => ({
    gifts: tr.querySelector('.rule-gifts').value.trim(),
    minCoins: Math.max(0, Number(tr.querySelector('.rule-min').value) || 0),
    action: tr.querySelector('.rule-action').value
  }));
}

$('#btn-add-rule')?.addEventListener('click', () => {
  $('#rules-table tbody').append(ruleRow({ gifts: '', minCoins: 0, action: 'thanks' }));
  rulesDirty = true;
});
async function applyPreset(kind) {
  try {
    const { presets } = await api('/api/rule-presets', null, 'GET');
    renderRules(presets[kind] || []);
    rulesDirty = true;
    toast(`${kind === 'queue' ? '⏳ Bộ quà Hàng chờ' : '⚔️ Bộ quà Đấu giá'} đã điền — kiểm tra tên quà rồi bấm Lưu Luật Quà`);
  } catch {}
}
$('#btn-preset-auction')?.addEventListener('click', () => applyPreset('auction'));
$('#btn-preset-queue')?.addEventListener('click', () => applyPreset('queue'));
$('#btn-save-rules')?.addEventListener('click', async () => {
  try {
    await api('/api/config', { config: { giftRules: readRules() } });
    rulesDirty = false;
    toast('✅ Đã lưu luật quà — menu quà trên màn hình LIVE đã cập nhật');
  } catch {}
});

function renderRecentGifts(list = []) {
  const tbody = $('#table-recent-gifts tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '6', class: 'muted', text: 'Chưa có quà nào — LIVE thử hoặc dùng mô phỏng để xem tên quà TikTok gửi về.' })));
    return;
  }
  tbody.replaceChildren(...list.map(g => el('tr', {},
    el('td', { text: timeStr(g.at) }),
    el('td', { text: g.name }),
    el('td', {}, el('b', { text: g.gift }), g.giftId ? el('small', { class: 'muted', text: ` #${g.giftId}` }) : null),
    el('td', { text: `${fmt(g.coins)} (${g.count}×)` }),
    el('td', { text: ACTION_LABEL[g.action] || g.action }),
    el('td', {}, el('button', {
      class: 'icon-btn', title: 'Tạo luật cho quà này', text: '➕',
      onclick: () => {
        $('#rules-table tbody').prepend(ruleRow({ gifts: g.gift, minCoins: 0, action: 'thanks' }));
        rulesDirty = true;
        toast(`➕ Đã thêm luật cho "${g.gift}" lên đầu bảng — chọn nghi thức rồi bấm Lưu`);
      }
    }))
  )));
}

$('#btn-save-goals')?.addEventListener('click', async () => {
  try {
    await api('/api/config', {
      config: {
        commentRituals: $('#cfg-comment-rituals').value === 'true',
        commentCooldown: Math.max(0, Number($('#cfg-comment-cooldown').value) || 0)
      },
      goals: {
        rose: { target: Math.max(1, Number($('#cfg-goal-rose').value) || 100) },
        cake: { target: Math.max(1, Number($('#cfg-goal-cake').value) || 1000) }
      }
    });
    toast('✅ Đã lưu bình luận & mục tiêu');
  } catch {}
});

// ========================================================
// GIỌNG MC
// ========================================================
function updateRangeLabels() {
  $('#lbl-rate').textContent = Number($('#cfg-voice-rate').value).toFixed(2);
  $('#lbl-pitch').textContent = Number($('#cfg-voice-pitch').value).toFixed(2);
  $('#lbl-volume').textContent = Math.round(Number($('#cfg-volume').value) * 100) + '%';
}
['#cfg-voice-rate', '#cfg-voice-pitch', '#cfg-volume'].forEach(id => $(id)?.addEventListener('input', updateRangeLabels));

let wantedBrowserVoice = '';
async function loadVoices() {
  try {
    const d = await api('/api/voices', null, 'GET');
    const sel = $('#cfg-browser-voice');
    const list = d.list || [];
    sel.replaceChildren(el('option', { value: '', text: '(Tự chọn giọng tự nhiên nhất)' }));
    for (const v of list) sel.append(el('option', { value: v.name, text: v.name }));
    if (wantedBrowserVoice && !list.some(v => v.name === wantedBrowserVoice)) {
      sel.append(el('option', { value: wantedBrowserVoice, text: `${wantedBrowserVoice} (không thấy trên máy LIVE hiện tại)` }));
    }
    sel.value = wantedBrowserVoice;
    const info = $('#voice-detect-info');
    if (!d.overlays) info.textContent = '⚠️ Chưa có màn hình LIVE nào đang mở (OBS / trình duyệt) — mở lên rồi bấm "Dò lại giọng".';
    else if (!list.length) info.textContent = 'Máy chạy màn hình LIVE không có giọng tiếng Việt → MC sẽ dùng giọng Google.';
    else info.textContent = `✅ Có ${list.length} giọng tiếng Việt trên máy chạy màn hình LIVE.`;
  } catch {}
}
$('#btn-refresh-voices')?.addEventListener('click', () => { loadVoices(); toast('🔄 Đang dò giọng của màn hình LIVE...'); });

function voiceConfigFromForm() {
  return {
    speech: $('#cfg-speech-enabled').value === 'true',
    voiceEngine: $('#cfg-voice-engine').value,
    browserVoice: $('#cfg-browser-voice').value,
    voiceRate: Number($('#cfg-voice-rate').value) || 1.08,
    voicePitch: Number($('#cfg-voice-pitch').value) || 1,
    volume: Number($('#cfg-volume').value),
    soundEffects: $('#cfg-sound-effects').value === 'true',
    funnyVoiceEnabled: $('#cfg-funny-voice').value === 'true',
    mcCaption: $('#cfg-mc-caption').value === 'true',
    mcIdleEnabled: $('#cfg-mc-idle').value === 'true',
    mcIdleSeconds: Math.max(15, Number($('#cfg-mc-idle-seconds').value) || 45),
    mcWelcomeEnabled: $('#cfg-mc-welcome').value === 'true',
    mcWelcomeSeconds: Math.max(5, Number($('#cfg-mc-welcome-seconds').value) || 30)
  };
}

$('#btn-save-voice')?.addEventListener('click', async () => {
  const config = voiceConfigFromForm();
  wantedBrowserVoice = config.browserVoice;
  try { await api('/api/config', { config }); toast('✅ Đã lưu Giọng MC'); } catch {}
});

function splitForTts(text) {
  const out = [];
  for (const sentence of String(text).match(/[^.!?]+[.!?]*/g) || [String(text)]) {
    let t = sentence.trim();
    while (t.length > 180) {
      const cut = Math.max(t.lastIndexOf(', ', 180), t.lastIndexOf(' ', 180));
      out.push(t.slice(0, cut > 40 ? cut : 180).trim());
      t = t.slice(cut > 40 ? cut + 1 : 180).trim();
    }
    if (t) out.push(t);
  }
  return out;
}

// Nghe thử ngay trên máy đang mở bảng điều khiển (giọng Google)
let localAudio = null;
async function playGoogle(text) {
  const clean = String(text || '').replace(/\p{Extended_Pictographic}|‍|️/gu, '').trim();
  if (!clean) return toast('Chưa có câu để đọc', true);
  if (localAudio) { localAudio.pause(); localAudio = null; }
  const rate = Number($('#cfg-voice-rate').value) || 1.08;
  const volume = Number($('#cfg-volume').value);
  for (const part of splitForTts(clean)) {
    try {
      const res = await fetch('/api/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: part }) });
      if (!res.ok) { toast('⚠️ Không lấy được giọng Google (kiểm tra Internet)', true); return; }
      const audio = localAudio = new Audio(URL.createObjectURL(await res.blob()));
      audio.playbackRate = rate;
      audio.volume = Number.isFinite(volume) ? volume : 0.95;
      await new Promise(r => { audio.onended = audio.onerror = audio.onpause = r; audio.play().catch(r); });
      if (localAudio !== audio) return;
    } catch {}
  }
}

$('#btn-test-voice')?.addEventListener('click', () => playGoogle($('#voice-test-text').value));

$('#btn-test-overlay')?.addEventListener('click', async () => {
  try {
    await api('/api/config', { config: voiceConfigFromForm() });
    const d = await api('/api/mc/test', { text: $('#voice-test-text').value });
    toast(d.overlays ? `📺 Đã gửi tới ${d.overlays} màn hình LIVE — nghe ở OBS/trình duyệt đang mở` : '⚠️ Chưa có màn hình LIVE nào đang mở', !d.overlays);
  } catch {}
});

// ========================================================
// LỜI THOẠI MC
// ========================================================
let mcGroups = [];
let mcDirty = false;
let mcRendered = false;
const normTxt = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

async function loadMcEditor(force = false) {
  if (mcDirty && !force) return;
  try {
    if (!mcGroups.length) mcGroups = (await api('/api/mc/groups', null, 'GET')).groups || [];
    const s = await api('/api/state', null, 'GET');
    renderMcEditor(s.config?.mcLines || {});
  } catch {}
}

function sampleVars() {
  const c = lastState?.config || {};
  return {
    name: 'Hoàng Long', names: 'Lan, Hùng và Bảo', gift: 'Hoa hồng', count: 5, coins: 50,
    groom: lastState?.roles?.groom?.name || c.groom || 'Tuấn Anh',
    bride: lastState?.roles?.bride?.name || c.bride || 'Mai Vy',
    role: 'chú rể', bid: 30, missing: 11, holder: 'Minh Khang', previous: 'Minh Khang',
    min: c.minCoinsToMarry || 10, seconds: 45, groomBid: 30, brideBid: 20, title: c.title || 'tiệc cưới',
    gifts: 'Rose để mưa hoa hồng, Finger Heart để cô dâu chú rể hôn nhau'
  };
}
const fillVars = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? ''));

function updateGroupCount(groupEl) {
  const n = groupEl.querySelectorAll('.mc-line').length;
  groupEl.querySelector('.mc-g-count').textContent = `· ${n} câu`;
  groupEl.querySelector('.mc-g-empty').textContent = n ? '' : '(MC im lặng)';
}

function markGroupDirty(groupEl) {
  mcDirty = true;
  groupEl.querySelector('.mc-g-dirty').textContent = '● chưa lưu';
  updateGroupCount(groupEl);
}

function lineRow(text, groupEl) {
  const ta = el('textarea', { rows: '2' });
  ta.value = text;
  ta.addEventListener('input', () => markGroupDirty(groupEl));
  const row = el('div', { class: 'mc-line' },
    ta,
    el('button', { class: 'icon-btn', title: 'Nghe thử câu này (dữ liệu mẫu)', text: '▶', onclick: () => playGoogle(fillVars(ta.value, sampleVars())) }),
    el('button', { class: 'icon-btn danger', title: 'Xóa câu', text: '✕', onclick: () => { row.remove(); markGroupDirty(groupEl); } })
  );
  return row;
}

function renderMcEditor(lines) {
  const box = $('#mc-groups');
  if (!box) return;
  box.replaceChildren();
  let section = '';
  for (const g of mcGroups) {
    if (g.section !== section) {
      section = g.section;
      box.append(el('h4', { class: 'mc-section', text: section }));
    }
    const list = Array.isArray(lines[g.key]) ? lines[g.key] : g.lines;
    const body = el('div', { class: 'mc-g-body' });
    const details = el('details', { class: 'mc-group', 'data-key': g.key },
      el('summary', {}, el('span', { text: g.label }), el('span', { class: 'mc-g-count' }), el('span', { class: 'mc-g-empty' }), el('span', { class: 'mc-g-dirty' })),
      body
    );
    body.append(el('div', { class: 'mc-g-vars' },
      g.vars ? 'Biến dùng được: ' : 'Không dùng biến',
      g.vars ? el('code', { text: g.vars }) : null,
      g.display ? ' · chỉ hiển thị trên thẻ chúc mừng, MC không đọc' : null
    ));
    const linesBox = el('div', { class: 'mc-g-lines' }, ...list.map(t => lineRow(t, details)));
    body.append(linesBox, el('div', { class: 'mc-g-actions' },
      el('button', {
        class: 'btn btn-secondary btn-sm', text: '➕ Thêm câu',
        onclick: () => { const r = lineRow('', details); linesBox.append(r); r.querySelector('textarea').focus(); markGroupDirty(details); }
      }),
      el('button', {
        class: 'btn btn-secondary btn-sm', text: '↺ Mặc định nhóm này',
        onclick: () => { linesBox.replaceChildren(...g.lines.map(t => lineRow(t, details))); markGroupDirty(details); }
      })
    ));
    box.append(details);
    updateGroupCount(details);
  }
  mcDirty = false;
  mcRendered = true;
  applyMcSearch();
}

function collectMcLines() {
  const out = {};
  $$('#mc-groups .mc-group').forEach(d => {
    out[d.dataset.key] = Array.from(d.querySelectorAll('.mc-line textarea')).map(t => t.value.trim()).filter(Boolean);
  });
  return out;
}

function applyMcSearch() {
  const q = normTxt($('#mc-search')?.value || '').trim();
  $$('#mc-groups .mc-group').forEach(d => {
    const hay = normTxt(d.querySelector('summary').textContent + ' ' + Array.from(d.querySelectorAll('textarea')).map(t => t.value).join(' '));
    const hit = !q || hay.includes(q);
    d.hidden = !hit;
    if (q && hit) d.open = true;
  });
  $$('#mc-groups .mc-section').forEach(h => {
    let n = h.nextElementSibling;
    let any = false;
    while (n && !n.classList.contains('mc-section')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
    h.hidden = !any;
  });
}
$('#mc-search')?.addEventListener('input', applyMcSearch);
$('#btn-mc-expand')?.addEventListener('click', () => $$('#mc-groups .mc-group').forEach(d => { if (!d.hidden) d.open = true; }));
$('#btn-mc-collapse')?.addEventListener('click', () => $$('#mc-groups .mc-group').forEach(d => { d.open = false; }));
$('#btn-mc-reset-all')?.addEventListener('click', () => {
  if (!confirm('Thay toàn bộ lời thoại bằng câu mặc định? (chưa lưu cho tới khi bấm Lưu lời thoại)')) return;
  renderMcEditor({});
  $$('#mc-groups .mc-group').forEach(markGroupDirty);
  toast('↺ Đã điền lời thoại mặc định — bấm "Lưu lời thoại" để áp dụng');
});
$('#btn-mc-save')?.addEventListener('click', async () => {
  try {
    await api('/api/config', { config: { mcLines: collectMcLines() } });
    mcDirty = false;
    $$('#mc-groups .mc-g-dirty').forEach(x => { x.textContent = ''; });
    toast('✅ Đã lưu lời thoại MC — áp dụng ngay cho buổi LIVE');
  } catch {}
});
window.addEventListener('beforeunload', e => {
  if (mcDirty || rulesDirty) { e.preventDefault(); e.returnValue = ''; }
});

// ========================================================
// SỔ MỪNG CƯỚI
// ========================================================
$('#btn-reset-session')?.addEventListener('click', async () => {
  if (!confirm('Xóa khách mời, sổ mừng cưới, vai cô dâu – chú rể để bắt đầu phiên LIVE mới?')) return;
  try { await api('/api/reset'); toast('✅ Đã bắt đầu phiên LIVE mới'); } catch {}
});

function renderRegistry(scores = {}) {
  const tbody = $('#table-registry tbody');
  if (!tbody) return;
  const list = Object.values(scores).sort((a, b) => b.total - a.total);
  if (!list.length) {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '3', class: 'muted', text: 'Chưa có người mừng cưới' })));
    return;
  }
  tbody.replaceChildren(...list.map((d, i) => el('tr', {},
    el('td', {}, el('b', { text: i === 0 ? '👑 TOP 1' : i === 1 ? '🥈 TOP 2' : i === 2 ? '🥉 TOP 3' : `#${i + 1}` })),
    el('td', {}, el('b', { text: d.name })),
    el('td', { class: 'gold', text: `💌 ${fmt(d.total)} xu` })
  )));
}

// ========================================================
// NHẠC NỀN
// ========================================================
let musicFiles = [];
let selectedMusic = '';

async function loadMusic() {
  try {
    const d = await api('/api/music', null, 'GET');
    musicFiles = d.files || [];
    if (!selectedMusic) selectedMusic = d.current || '';
    renderMusic();
  } catch {}
}

function renderMusic() {
  const box = $('#music-list');
  if (!box) return;
  if (!musicFiles.length) {
    box.replaceChildren(el('div', { class: 'muted', text: 'Chưa có file nhạc. Bấm "Chọn tệp" rồi "Tải lên", hoặc chép file vào thư mục app/public/music.' }));
    return;
  }
  box.replaceChildren(...musicFiles.map(f => el('div', { class: 'music-item' + (f.name === selectedMusic ? ' active' : '') },
    el('input', { type: 'radio', name: 'bgm-file', ...(f.name === selectedMusic ? { checked: '' } : {}), onchange: () => { selectedMusic = f.name; $('#cfg-bgm-title').value = ''; renderMusic(); } }),
    el('span', { class: 'name', text: f.name }),
    el('span', { class: 'size', text: `${(f.size / 1048576).toFixed(1)} MB` }),
    el('button', {
      class: 'icon-btn danger', title: 'Xóa file', text: '🗑',
      onclick: async () => {
        if (!confirm(`Xóa file "${f.name}"?`)) return;
        try {
          const d = await api('/api/music/delete', { name: f.name });
          musicFiles = d.files;
          if (selectedMusic === f.name) selectedMusic = '';
          renderMusic();
        } catch {}
      }
    })
  )));
}

$('#btn-upload-music')?.addEventListener('click', async () => {
  const files = Array.from($('#bgm-upload').files || []);
  if (!files.length) return toast('Chọn file nhạc trước đã', true);
  for (const f of files) {
    toast(`⬆️ Đang tải ${f.name}...`);
    try {
      const res = await fetch(`/api/music/upload?name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || 'Tải lên lỗi');
      musicFiles = d.files;
      if (!selectedMusic) selectedMusic = d.name;
      renderMusic();
      toast(`✅ Đã tải ${d.name}`);
    } catch (e) {
      toast(`⚠️ ${f.name}: ${e.message}`, true);
    }
  }
  $('#bgm-upload').value = '';
});

function toggleBgmGroups() {
  const src = $('#cfg-bgm-source').value;
  $('#bgm-file-group').hidden = src !== 'file';
  $('#bgm-youtube-group').hidden = src !== 'youtube';
}
$('#cfg-bgm-source')?.addEventListener('change', toggleBgmGroups);

$('#btn-save-bgm')?.addEventListener('click', async () => {
  const source = $('#cfg-bgm-source').value;
  if (source === 'file' && !selectedMusic) return toast('Chọn một file nhạc trong danh sách trước', true);
  try {
    await api('/api/bgm', {
      source,
      file: selectedMusic,
      youtubeUrl: $('#cfg-bgm-url').value.trim(),
      title: $('#cfg-bgm-title').value.trim(),
      volume: Number($('#cfg-bgm-volume').value),
      playing: $('#cfg-bgm-playing').value === 'true',
      enabled: source !== 'off'
    });
    toast(source === 'off' ? '🔇 Đã tắt nhạc nền' : '🎵 Đã áp dụng nhạc nền (màn hình LIVE/OBS sẽ phát)');
  } catch {}
});

// ========================================================
// HIỂN THỊ TRẠNG THÁI
// ========================================================
function setVal(id, v) {
  const node = $(id);
  if (node && v !== undefined && v !== null) node.value = String(v);
}

let formsFilled = false;
function fillForms(cfg, goals) {
  setVal('#cfg-groom', cfg.groom);
  setVal('#cfg-bride', cfg.bride);
  setVal('#cfg-title', cfg.title);
  setVal('#cfg-slogan', cfg.slogan);
  setVal('#cfg-date', cfg.date);
  setVal('#cfg-marry-auction', cfg.enableMarryAuction !== false);
  setVal('#cfg-role-mode', cfg.roleMode || 'both');
  setVal('#cfg-min-marry', cfg.minCoinsToMarry || 10);
  setVal('#cfg-auto-ceremony', cfg.autoCeremony !== false);
  setVal('#cfg-ceremony-countdown', cfg.ceremonyCountdown || 45);
  setVal('#cfg-role-system', cfg.roleSystem || 'auction');
  setVal('#cfg-photo-after', cfg.photoAfterCeremony !== false);
  setVal('#cfg-max-guests', Number(cfg.maxGuests) === 24 ? 24 : 54);
  setVal('#cfg-like-goal', cfg.likeGoal || 5000);
  setVal('#cfg-money-unit', cfg.moneyUnit || 'xu');
  setVal('#cfg-title-decay', cfg.titleDecaySeconds || 30);
  setVal('#cfg-show-mc', cfg.showMC !== false);
  setVal('#cfg-comment-rituals', cfg.commentRituals !== false);
  setVal('#cfg-comment-cooldown', cfg.commentCooldown ?? 8);
  setVal('#cfg-speech-enabled', cfg.speech !== false);
  setVal('#cfg-funny-voice', cfg.funnyVoiceEnabled !== false);
  setVal('#cfg-sound-effects', cfg.soundEffects !== false);
  setVal('#cfg-voice-engine', cfg.voiceEngine || 'auto');
  wantedBrowserVoice = cfg.browserVoice || '';
  setVal('#cfg-browser-voice', wantedBrowserVoice);
  setVal('#cfg-voice-pitch', cfg.voicePitch || 1);
  setVal('#cfg-voice-rate', cfg.voiceRate || 1.08);
  setVal('#cfg-volume', cfg.volume ?? 0.95);
  setVal('#cfg-mc-caption', cfg.mcCaption !== false);
  setVal('#cfg-mc-idle', cfg.mcIdleEnabled !== false);
  setVal('#cfg-mc-idle-seconds', cfg.mcIdleSeconds || 45);
  setVal('#cfg-mc-welcome', cfg.mcWelcomeEnabled !== false);
  setVal('#cfg-mc-welcome-seconds', cfg.mcWelcomeSeconds || 30);
  updateRangeLabels();
  if (goals?.rose) setVal('#cfg-goal-rose', goals.rose.target);
  if (goals?.cake) setVal('#cfg-goal-cake', goals.cake.target);
  const b = cfg.bgm || {};
  setVal('#cfg-bgm-source', b.enabled === false ? 'off' : (b.source || 'file'));
  setVal('#cfg-bgm-playing', b.playing !== false);
  setVal('#cfg-bgm-volume', b.volume ?? 50);
  setVal('#cfg-bgm-title', b.title || '');
  setVal('#cfg-bgm-url', b.youtubeUrl || '');
  if (b.file) selectedMusic = b.file;
  toggleBgmGroups();
}

function roleMeta(holder, role, cfg) {
  if (!holder) {
    const open = cfg.enableMarryAuction !== false && (cfg.roleMode === 'both' || cfg.roleMode === role || !cfg.roleMode);
    return open ? `Vai trống — đang dùng tên gốc. Cần ≥ ${fmt(cfg.minCoinsToMarry || 10)} xu để giành.` : 'Vai cố định (không cho khách giành).';
  }
  return `💰 Giá ${fmt(holder.bid)} xu · giữ vai từ ${timeStr(holder.at)} · cần > ${fmt(holder.bid)} xu để cướp`;
}

let ceremonyTick = null;
function renderStage(s) {
  const cfg = s.config || {};
  for (const role of ['groom', 'bride']) {
    const holder = s.roles?.[role];
    $(`#rs-${role}`).textContent = holder?.name || cfg[role] || '—';
    $(`#rs-${role}-meta`).textContent = roleMeta(holder, role, cfg);
  }
  const phase = s.ceremony?.phase;
  clearInterval(ceremonyTick);
  const text = $('#ceremony-status-text');
  if (phase === 'countdown') {
    const end = performance.now() + (Number(s.ceremony.remainingMs) || 0);
    const tick = () => { text.textContent = `💒 Lễ thành hôn sau ${Math.max(0, Math.ceil((end - performance.now()) / 1000))} giây`; };
    tick();
    ceremonyTick = setInterval(tick, 500);
  } else if (phase === 'running') {
    text.textContent = '💒 Đang làm lễ thành hôn...';
  } else {
    text.textContent = cfg.autoCeremony !== false ? 'Chờ đủ đôi để làm lễ' : 'Tự động làm lễ đang tắt';
  }
}

function renderMarriages(list = []) {
  const tbody = $('#table-marriages tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '3', class: 'muted', text: 'Chưa có cặp nào thành hôn trong phiên này' })));
    return;
  }
  tbody.replaceChildren(...list.map(m => el('tr', {}, el('td', { text: timeStr(m.at) }), el('td', { text: m.groom }), el('td', { text: m.bride }))));
}

let lastRulesKey = '';
function renderAdminState(s) {
  lastState = s;
  const cfg = s.config || {};
  const stats = s.stats || {};
  $('#card-guests').textContent = fmt(stats.guests);
  $('#card-envelopes').textContent = fmt(stats.envelopes);
  $('#card-couples').textContent = fmt(stats.couples);
  $('#card-likes').textContent = fmt(s.likes?.total || stats.likes || 0);
  $('#card-social').textContent = `Tim · ${fmt(stats.shares || 0)} chia sẻ · ${fmt(stats.follows || 0)} theo dõi`;
  const q = s.queue || {};
  const qNames = (list, n) => (list || []).map(x => x.name).join(', ') + (n > (list || []).length ? ` +${n - list.length}` : '');
  $('#rs-queue').textContent = cfg.roleSystem === 'queue'
    ? `⏳ Hàng chờ — chú rể: ${q.groomCount ? qNames(q.groom, q.groomCount) : 'trống'} · cô dâu: ${q.brideCount ? qNames(q.bride, q.brideCount) : 'trống'}`
    : '';
  const top = Object.values(s.scores || {}).sort((a, b) => b.total - a.total)[0];
  $('#card-top-giver').textContent = top?.name || 'Chưa có';

  renderStage(s);
  renderRegistry(s.scores);
  renderRecentGifts(s.recentGifts);
  renderMarriages(s.marriages);

  const rulesKey = JSON.stringify(cfg.giftRules || []);
  if (rulesKey !== lastRulesKey) {
    lastRulesKey = rulesKey;
    renderRuleGiftButtons(cfg.giftRules || []);
    if (!rulesDirty) renderRules(cfg.giftRules || []);
  }

  if (!formsFilled && !isEditing()) {
    fillForms(cfg, s.goals);
    formsFilled = true;
  }
}

// Nạp form một lần khi mở trang; sau đó chỉ cập nhật phần hiển thị (không ghi đè lúc bạn đang sửa)
async function refreshForms() {
  try {
    const s = await api('/api/state', null, 'GET');
    fillForms(s.config || {}, s.goals);
    renderRegistry(s.scores);
  } catch {}
}

// ========================================================
// REALTIME
// ========================================================
const es = new EventSource('/api/events');
es.addEventListener('state', e => {
  try {
    const data = JSON.parse(e.data);
    renderAdminState(data);
    if (data.status) updateConnectionStatus(data.status);
  } catch (err) { console.warn(err); }
});
es.addEventListener('status', e => {
  try { updateConnectionStatus(JSON.parse(e.data)); } catch {}
});
refreshForms();
setTimeout(loadVoices, 2500);

function updateConnectionStatus(s) {
  if (!s) return;
  const labels = {
    offline: 'Chưa kết nối TikFinity Desktop',
    connecting: 'Đang kết nối…',
    waiting: 'Chờ dữ liệu LIVE…',
    connected: 'Đã kết nối TikFinity',
    retry: 'Đang kết nối lại…',
    error: 'Lỗi kết nối TikFinity'
  };
  const label = s.username ? `Đã kết nối @${s.username}` : (labels[s.state] || s.state);
  for (const node of [$('#status'), $('#global-status')]) {
    if (!node) continue;
    node.className = 'status-pill ' + (s.state || 'offline');
    node.textContent = label;
  }
  const msg = s.message || '';
  $('#connection-message').textContent = msg;
  $('#tab-status-desc').textContent = `${label}${msg ? ' · ' + msg : ''}`;
  const dot = $('#notice-dot');
  dot.style.background = s.state === 'connected' ? '#34c759' : ['connecting', 'waiting', 'retry'].includes(s.state) ? '#ffd60a' : s.state === 'error' ? '#ff453a' : '#888';
  $('#connect').disabled = ['connecting', 'connected', 'waiting'].includes(s.state);
  $('#disconnect').disabled = s.state === 'offline';
}

$('#connect')?.addEventListener('click', async () => {
  $('#connect').disabled = true;
  updateConnectionStatus({ state: 'connecting', message: 'Đang kết nối tới TikFinity Desktop...' });
  try {
    const res = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json();
    if (!data.ok) {
      toast('⚠️ Không kết nối được TikFinity Desktop — mở app, Connect phòng LIVE rồi thử lại', true);
      updateConnectionStatus({ state: 'error', message: data.error });
    }
  } catch (err) {
    updateConnectionStatus({ state: 'error', message: err.message });
  }
});

$('#disconnect')?.addEventListener('click', async () => {
  try {
    await api('/api/disconnect');
  } catch {}
});

// ========================================================
// ALBUM ẢNH CƯỚI
// ========================================================
async function loadAlbum() {
  const grid = $('#album-grid');
  if (!grid) return;
  try {
    const { photos } = await api('/api/photos', null, 'GET');
    if (!photos.length) {
      grid.replaceChildren(el('p', { class: 'muted', text: 'Chưa có ảnh nào. Ảnh tự lưu sau mỗi lễ thành hôn, hoặc bấm "Chụp ảnh ngay".' }));
      return;
    }
    grid.replaceChildren(...photos.map(ph => el('figure', { class: 'album-item' },
      el('a', { href: ph.url, target: '_blank', rel: 'noopener' }, el('img', { src: ph.url, alt: ph.name, loading: 'lazy' })),
      el('figcaption', {},
        el('span', { class: 'muted', text: new Date(ph.at).toLocaleString('vi-VN') }),
        el('span', { class: 'album-actions' },
          el('a', { class: 'icon-btn', href: ph.url, download: ph.name, title: 'Tải ảnh về', text: '⬇️' }),
          el('button', {
            class: 'icon-btn danger', title: 'Xóa ảnh', text: '🗑',
            onclick: async () => {
              if (!confirm('Xóa ảnh này?')) return;
              try { await api('/api/photos/delete', { name: ph.name }); loadAlbum(); } catch {}
            }
          })
        )
      )
    )));
  } catch {}
}
$('#btn-album-refresh')?.addEventListener('click', loadAlbum);
