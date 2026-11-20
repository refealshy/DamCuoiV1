# Tài liệu

| File | Nội dung |
|---|---|
| [kich-ban-va-prompt-bien-co.md](kich-ban-va-prompt-bien-co.md) | Kịch bản từng biến cố và sự cố (ai làm gì, tặng quà thì được gì), bảng trend dùng ở đâu, và 44 prompt hình, video cho các màn đó (gồm điểm đến tuần trăng mật) |
| [prompt-bo-hinh-tiec-cuoi.md](prompt-bo-hinh-tiec-cuoi.md) | 59 prompt của bộ hình gốc: cô dâu chú rể, MC, khách, phông, nhạc |
| [tom-tat-phien-lam-viec-2026-11-19.md](tom-tat-phien-lam-viec-2026-11-19.md) | Tóm tắt phiên làm việc 16–19/11/2026: đã làm gì, vì sao, còn thiếu gì |
| `bo-prompt-bien-co.html`, `bo-prompt-tiec-cuoi.html` | Bản gốc của hai bộ prompt. Tải về, mở bằng trình duyệt để có nút sao chép, bộ lọc và ô đánh dấu "đã tạo xong" |

Hai file Markdown về prompt được xuất từ file HTML, đừng sửa tay. Sửa file HTML rồi chạy lại:

```bash
node tools/xuat-prompt-md.mjs docs/bo-prompt-bien-co.html > docs/kich-ban-va-prompt-bien-co.md
node tools/xuat-prompt-md.mjs docs/bo-prompt-tiec-cuoi.html > docs/prompt-bo-hinh-tiec-cuoi.md
```

Prompt của bộ hình gốc được xuất theo phong cách đang dùng (Bán thực 3D, nền xanh lá); file HTML còn có phong cách "Ảnh thật".
