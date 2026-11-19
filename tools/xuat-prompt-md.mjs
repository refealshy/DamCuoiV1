#!/usr/bin/env node
// Xuất trang prompt (file HTML có nút sao chép) thành Markdown để đọc thẳng trên GitHub:
// phần kịch bản (các bảng, ghi chú) rồi tới từng thẻ prompt hình / video đã ghép đủ chữ.
// Cách dùng:  node tools/xuat-prompt-md.mjs docs/bo-prompt-bien-co.html > docs/kich-ban-va-prompt-bien-co.md
import fs from 'node:fs';
import vm from 'node:vm';

const file = process.argv[2];
if (!file) { console.error('Thiếu đường dẫn file HTML'); process.exit(1); }
const html = fs.readFileSync(file, 'utf8');
const text = s => s.replace(/<code>(.*?)<\/code>/g, '`$1`').replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const out = [];
out.push(`# ${text(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] || 'Bộ prompt')}`, '');
const lede = html.match(/<p class="lede">([\s\S]*?)<\/p>/)?.[1];
if (lede) out.push(text(lede), '');
out.push(`> Bản Markdown xuất từ \`${file.split('/').pop()}\` bằng \`tools/xuat-prompt-md.mjs\`. Mở file HTML bằng trình duyệt để có nút sao chép và ô đánh dấu "đã tạo xong".`, '');

// Phần chữ viết sẵn trong trang: mỗi <section> một mục, giữ bảng, danh sách, ghi chú
for (const m of html.matchAll(/<section id="([\w-]+)">([\s\S]*?)<\/section>/g)) {
  const body = m[2];
  const h2 = body.match(/<h2>([\s\S]*?)<\/h2>/)?.[1];
  if (!h2) continue;
  out.push(`## ${text(h2)}`, '');
  for (const b of body.matchAll(/<table>([\s\S]*?)<\/table>|<p[^>]*>([\s\S]*?)<\/p>|<div class="rule">([\s\S]*?)<\/div>|<pre[^>]*>([\s\S]*?)<\/pre>/g)) {
    if (b[1]) {
      const rows = [...b[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<t[hd]>([\s\S]*?)<\/t[hd]>/g)].map(c => text(c[1]).replace(/\|/g, '/')));
      if (!rows.length) continue;
      out.push('', `| ${rows[0].join(' | ')} |`, `|${rows[0].map(() => '---').join('|')}|`, ...rows.slice(1).map(r => `| ${r.join(' | ')} |`), '');
    } else if (b[2]) {
      const t = text(b[2]);
      if (t) out.push('', t, '');
    } else if (b[3]) {
      out.push(`- ${text(b[3].replace(/<\/b>\s*<span>/, ':</b> <span>'))}`);
    } else if (b[4]) {
      out.push('```', b[4].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'), '```', '');
    }
  }
  out.push('');
}

// Phần dữ liệu trong <script>: các thẻ prompt, câu sửa lỗi, lệnh
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('const SECTIONS'));
if (src) {
  const a = src.indexOf('const PEOPLE') >= 0 ? src.indexOf('const PEOPLE') : src.indexOf('const ');
  const b = src.indexOf('const PRI =');
  // Trang bộ hình gốc có hai lựa chọn trên trang (phong cách, màu nền): lấy mặc định đang dùng là Bán thực 3D, nền xanh lá
  const d = vm.runInNewContext(`(() => { var style = 'semi', bgMode = 'green'; ${src.slice(a, b)}; return { SECTIONS, FIXES: typeof FIXES === 'undefined' ? [] : FIXES, COMMANDS: typeof COMMANDS === 'undefined' ? [] : COMMANDS, REF_TEXT: typeof REF_TEXT === 'undefined' ? {} : REF_TEXT, PRI: {1: 'Ưu tiên 1', 2: 'Ưu tiên 2', 3: 'Làm sau'} }; })()`);
  out.push('# Prompt từng file', '');
  for (const sec of d.SECTIONS) {
    out.push(`## ${sec.title}`, '', sec.intro || '', '');
    for (const it of sec.items) {
      out.push(`### \`${it.file}\``, '', `**${it.title}**`, '');
      const meta = [it.ratio, d.PRI[it.pri], it.from ? `${/\.(mp4|mov|webm)$/.test(it.file) ? 'khung đầu' : 'tải kèm'}: \`${it.from}\`` : '', it.loop === true ? 'lặp lại' : it.loop === false ? 'phát một lượt' : ''].filter(Boolean);
      if (meta.length) out.push(meta.join(' · '), '');
      if (it.note) out.push(it.note, '');
      // Trang bộ hình gốc: prompt đổi theo phong cách (lấy "Bán thực 3D" đang dùng); thẻ nhạc thì gồm nhiều ô (Title, Styles, Lyrics)
      const prompt = typeof it.prompt === 'function' ? it.prompt('semi') : it.prompt;
      if (prompt) out.push('```text', (it.ref ? d.REF_TEXT[it.ref] || '' : '') + prompt, '```', '');
      for (const b of it.blocks || []) out.push(`${b.label}:`, '', '```text', b.text, '```', '');
    }
  }
  if (d.FIXES.length) {
    out.push('## Sửa lỗi nhanh: thêm câu này vào cuối prompt', '', '| Hình bị gì | Thêm vào prompt |', '|---|---|', ...d.FIXES.map(f => `| ${f[0]} | ${String(f[1]).replace(/\|/g, '/')} |`), '');
  }
  if (d.COMMANDS.length) {
    out.push('## Lệnh xử lý hình', '');
    for (const c of d.COMMANDS) out.push(`${c[0]}:`, '', '```bash', c[1], '```', '');
  }
}
process.stdout.write(out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
