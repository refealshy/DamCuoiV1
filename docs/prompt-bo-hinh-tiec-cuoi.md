# Bộ Prompt Tiệc Cưới

Prompt để dán vào các công cụ AI: Dreamina, ChatGPT, Gemini, Midjourney cho ảnh; Dreamina, Kling, Hailuo, Runway, Veo cho video; Suno cho nhạc. Tên file, tỷ lệ và bố cục đã khớp với overlay hiện tại.

> Bản Markdown xuất từ `bo-prompt-tiec-cuoi.html` bằng `tools/xuat-prompt-md.mjs`. Mở file HTML bằng trình duyệt để có nút sao chép và ô đánh dấu "đã tạo xong".

## Cách làm

Làm đúng thứ tự này thì cả bộ sẽ cùng phong cách, cùng gương mặt và cùng tỷ lệ.

**Chọn phong cách ở góc trên.** "Bán thực 3D" giống các rạp cưới đang hot, "Ảnh thật" giống người thật hơn. Mọi prompt tự đổi theo. Dùng một phong cách cho cả bộ.

**Làm 2 ảnh mẫu trước:** `guest_m1.png` rồi `couple_ref.png`. Tạo vài lần, chọn bản đẹp nhất.

Mọi ảnh sau đều tải kèm một trong hai ảnh này, nhờ vậy các nhân vật không bị lệch phong cách.

**Tải kèm đúng ảnh ghi ở cuối mỗi thẻ.** Dreamina: bấm dấu + để thêm ảnh tham chiếu. ChatGPT và Gemini: tải ảnh lên cùng lúc với prompt. Midjourney: kéo ảnh vào ô tham chiếu.

**Chọn kiểu nền ở góc trên.** "Xanh lá" (`#00FF00`) dùng được cho mọi công cụ, kể cả Dreamina, và dùng thẳng làm khung đầu video. "Trong suốt" chỉ dành cho ChatGPT.

Công cụ không xuất được nền trong suốt mà prompt vẫn đòi thì hay vẽ ra ô caro xám trắng giả, ảnh đó không dùng được.

**Làm video từ ảnh** (Image to Video), khung đầu là bản nền xanh của ảnh. Lệnh tạo bản nền xanh nằm ở mục Video.

**Đặt đúng tên file như trên thẻ**, bỏ hết vào `DamCuoiV1/bo-hinh-moi/` và tick "Đã tạo xong" để theo dõi.

Xóa nền xanh, chuyển video sang dạng trong suốt cho OBS và gắn vào tool là bước làm sau, khi đã có file.

Làm cả hai ở một chỗ, dùng kiểu nền Xanh lá. Ảnh: model Seedream, tỷ lệ 9:16 cho một người và 1:1 cho cặp đôi, bấm dấu + thêm ảnh mẫu, chọn tham chiếu Character hoặc Human face khi cần giữ nguyên người. Video: model Seedance, chế độ khung hình đầu cuối, đặt cùng một ảnh cho cả hai. Gói miễn phí thường dính watermark và không cho dùng thương mại.

Xuất được nền trong suốt thật (kiểu nền Trong suốt). Tải ảnh mẫu lên rồi dán prompt. Có thể sửa tiếp bằng lời, ví dụ "giữ nguyên, chỉ đổi tư thế tay".

Giữ gương mặt nhân vật rất tốt khi đổi tư thế. Không xuất được nền trong suốt, dùng kiểu nền Xanh lá.

Bấm "Bản Midjourney" để chép prompt có sẵn tham số. Kéo ảnh mẫu vào ô tham chiếu nhân vật (Omni/Character Reference) để giữ người, hoặc Style Reference để chỉ lấy phong cách. Dùng kiểu nền Xanh lá.

Cũng có ô khung đầu và khung cuối như Dreamina: đặt cùng một ảnh vào cả hai để video lặp mượt. Chọn 5 giây, chế độ chất lượng cao.

Chỉ có khung đầu vẫn dùng được: lúc chuyển đổi có thể ghép chạy xuôi rồi chạy ngược cho liền mạch. Tắt âm thanh nếu công cụ tự thêm.

- **Không có màu xanh lá:** Màu xanh lá bị xóa cùng nền, kể cả lá trong bó hoa. Prompt đã dặn sẵn.
- **Gương mặt bình thường:** Không dùng mặt người nổi tiếng, người thật hay hình của rạp khác.
- **Lịch sự:** Hôn nhẹ nhàng, không gợi cảm, để không vi phạm quy định TikTok LIVE.
- **Thấy đủ từ đầu tới chân:** Ảnh mất chân thì nhân vật sẽ lơ lửng khi đặt vào hội trường.
- **Không watermark:** Bản miễn phí của nhiều công cụ video có watermark ở góc. Đọc thêm điều khoản dùng thương mại của từng công cụ.

## Sửa lỗi nhanh

Kết quả bị lỗi thì thêm câu tương ứng vào cuối prompt rồi tạo lại.

## Đặt tên và gửi file

Giữ đúng tên như trên thẻ. Ảnh để PNG (phông nền để JPG), video để MP4. Ảnh một người để 9:16 vì công cụ video nào cũng có tỷ lệ này, video ra sẽ không bị cắt mất đầu hay chân.

DamCuoiV1/ └── bo-hinh-moi/ ├── guest_m1.png, couple_ref.png ảnh mẫu ├── bg_red_gold.jpg … phông hội trường (9:16) ├── couple_idle.png … cô dâu chú rể (1:1) ├── mc_idle.png, mc_talk.png MC (9:16) ├── guest_m2.png … guest_f8.png khách mời (9:16) ├── walker_m.png, walker_f.png người đi lên thảm đỏ (9:16) ├── couple_idle.mp4 … video nền xanh lá └── nen-xanh/ bản nền xanh (lệnh ở mục Video) LoạiTỷ lệKích thướcNền Phông hội trường9:16 dọcLý tưởng 1080 × 1920Đầy đủ cảnh, không người Cô dâu chú rể1:1 vuôngTừ 1024 × 1024Trong suốt hoặc xanh lá `#00FF00` MC, khách mời, người đi lên9:16 dọcTừ 1080 × 1920Trong suốt hoặc xanh lá `#00FF00` VideoGiống ảnh khung đầu720p trở lên, 5 giâyXanh lá phẳng, máy quay đứng yên Có đủ các file "Ưu tiên 1" là đã thay được toàn bộ hình tĩnh trên rạp. Video có thể bổ sung dần.

# Prompt từng file

## Ảnh mẫu (làm đầu tiên)

Hai ảnh này quyết định phong cách cho cả bộ. Tạo vài lần, chọn bản đẹp nhất rồi mới làm tiếp.

### `guest_m1.png`

**Khách nam đầu tiên, cũng là khuôn phong cách**

9:16 · Ưu tiên 1

Ảnh này vừa là một khách mời, vừa là ảnh tham chiếu phong cách cho mọi nhân vật khác.

```text
A young Vietnamese man in a black slim-fit suit and white shirt without a tie, holding a glass of champagne, relaxed friendly smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `couple_ref.png`

**Ảnh mẫu cô dâu chú rể (ba góc nhìn)**

16:9 · Ưu tiên 1 · tải kèm: `guest_m1.png`

Chỉ dùng làm tham chiếu để giữ gương mặt và trang phục, không đưa lên LIVE nên không cần nền trong suốt.

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. Character reference sheet of one Vietnamese wedding couple in their mid-20s, the same couple shown three times side by side: front view, three-quarter view and back view, full body from head to toe. Groom: classic black tuxedo, white shirt, black bow tie, a red rose boutonniere, short neat black hair. Bride: white lace wedding gown with a long tulle veil, hair in a soft updo, holding a round bouquet of red and white roses wrapped in white ribbon with no green leaves. Ordinary non-famous faces that do not resemble any real person. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Plain light grey background. No text, no labels. Wide 16:9 image.
```

## Phông hội trường

Bố cục giống phông hiện tại để khớp vị trí cô dâu chú rể, MC và người đi lên: vòm hoa ở khoảng giữa ảnh, thảm đỏ chạy từ giữa mép dưới lên sân khấu, bàn tiệc hai bên. Không cần tải kèm ảnh mẫu.

### `bg_red_gold.jpg`

**Đỏ – vàng sang trọng (giống bản hiện tại)**

9:16 · Ưu tiên 1

```text
Vertical 9:16 interior of a luxurious red and gold Vietnamese wedding banquet hall, seen from the back of the hall at standing eye level, perfectly symmetrical. A long straight red carpet with a few scattered rose petals runs from the bottom center of the image up to the stage. The stage is in the middle of the image: a large heart-shaped arch of red and white roses framing a softly glowing gold backdrop rises from about 33% to 53% of the image height, and the stage floor with a few low steps sits at about 55% of the height, with a tall white wedding cake on each side of the stage. Round banquet tables with white tablecloths, gold chair covers and red rose centerpieces line both sides of the carpet in the lower half of the image, chairs empty. The top of the image shows draped ivory and gold fabric, large crystal chandeliers and curtains of tiny warm fairy lights. Completely empty hall: no people. No text, no letters, no signs, no screens with writing. Semi-realistic 3D render, cinematic warm lighting, rich detail, high-quality game environment art.
```

### `bg_pink_garden.jpg`

**Trắng – hồng kiểu vườn hoa**

9:16 · Làm sau

```text
Vertical 9:16 interior of a romantic white and pastel pink garden-style wedding hall, seen from the back of the hall at standing eye level, perfectly symmetrical. A long straight red carpet with a few scattered rose petals runs from the bottom center of the image up to the stage. The stage is in the middle of the image: a round arch of cherry blossoms, white roses and pink peonies framing a pale pink backdrop rises from about 33% to 53% of the image height, and the stage floor with a few low steps sits at about 55% of the height, with tall vases of white flowers on each side of the stage. Round banquet tables with white tablecloths, white chairs and pink flower centerpieces line both sides of the carpet in the lower half of the image, chairs empty. The top of the image shows a glass roof with soft daylight and hanging flower garlands. Completely empty hall: no people. No text, no letters, no signs, no screens with writing. Semi-realistic 3D render, cinematic warm lighting, rich detail, high-quality game environment art.
```

### `bg_blue_silver.jpg`

**Xanh dương – bạc**

9:16 · Làm sau

```text
Vertical 9:16 interior of an elegant royal blue and silver wedding banquet hall, seen from the back of the hall at standing eye level, perfectly symmetrical. A long straight red carpet with a few scattered rose petals runs from the bottom center of the image up to the stage. The stage is in the middle of the image: a tall arch of white flowers with silver accents framing a deep blue starry backdrop rises from about 33% to 53% of the image height, and the stage floor with a few low steps sits at about 55% of the height, with silver candelabras on each side of the stage. Round banquet tables with white tablecloths, silver chairs and white flower centerpieces line both sides of the carpet in the lower half of the image, chairs empty. The top of the image shows crystal chandeliers with cool white light and a sky of tiny star lights. Completely empty hall: no people. No text, no letters, no signs, no screens with writing. Semi-realistic 3D render, cinematic warm lighting, rich detail, high-quality game environment art.
```

### `dongphong_room.jpg`

**Phòng tân hôn cho cảnh động phòng (tùy chọn)**

9:16 · Làm sau

```text
Vertical 9:16 view of a traditional Vietnamese bridal chamber decorated for the wedding night: a bed with red silk bedding and red curtains, red and gold wedding ornaments, red paper lanterns, tall red candles, rose petals on the floor, warm romantic candlelight; elegant and tasteful. No people. No text, no letters, no symbols. Semi-realistic 3D render, cinematic warm lighting, rich detail, high-quality game environment art.
```

## Cô dâu chú rể

Mọi tư thế đều tải kèm couple_ref.png để giữ đúng gương mặt và trang phục. Tên và avatar của người xem giành vai được tool gắn lên cặp đôi này.

### `couple_idle.png`

**Đứng nắm tay (tư thế chính)**

1:1 · Ưu tiên 1 · tải kèm: `couple_ref.png`

```text
Use the attached image as the character reference and keep exactly the same groom and bride: same faces, hairstyles, outfits and colors. The groom and bride stand side by side holding hands and smiling at the camera; the bride holds her bouquet in her other hand. Both people fully visible from head to toe with the shoes visible, centered, standing on an invisible floor; together they fill about 85% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people besides the couple. No green color anywhere on the clothing, flowers or props. Square 1:1 image.
```

### `couple_kiss.png`

**Hôn nhau**

1:1 · Ưu tiên 1 · tải kèm: `couple_ref.png`

```text
Use the attached image as the character reference and keep exactly the same groom and bride: same faces, hairstyles, outfits and colors. The groom and bride face each other and share a gentle, tasteful wedding kiss; his hand rests lightly on her waist, her veil flows behind her. Both people fully visible from head to toe with the shoes visible, centered, standing on an invisible floor; together they fill about 85% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people besides the couple. No green color anywhere on the clothing, flowers or props. Square 1:1 image.
```

### `couple_carry.png`

**Chú rể bế cô dâu**

1:1 · Ưu tiên 2 · tải kèm: `couple_ref.png`

```text
Use the attached image as the character reference and keep exactly the same groom and bride: same faces, hairstyles, outfits and colors. The groom carries the bride in his arms in a classic bridal carry; both laugh and look at the camera; her dress and veil hang naturally. Both people fully visible from head to toe with the shoes visible, centered, standing on an invisible floor; together they fill about 85% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people besides the couple. No green color anywhere on the clothing, flowers or props. Square 1:1 image.
```

### `couple_dance.png`

**Khiêu vũ**

1:1 · Làm sau · tải kèm: `couple_ref.png`

```text
Use the attached image as the character reference and keep exactly the same groom and bride: same faces, hairstyles, outfits and colors. First-dance waltz pose: the groom leads with one hand on her back, her hand on his shoulder, their other hands joined, the dress swirling slightly. Both people fully visible from head to toe with the shoes visible, centered, standing on an invisible floor; together they fill about 85% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people besides the couple. No green color anywhere on the clothing, flowers or props. Square 1:1 image.
```

### `couple_cake.png`

**Cắt bánh cưới**

1:1 · Làm sau · tải kèm: `couple_ref.png`

```text
Use the attached image as the character reference and keep exactly the same groom and bride: same faces, hairstyles, outfits and colors. The groom and bride hold one cake knife together and cut a three-tier white wedding cake decorated with red roses, standing next to it on a small round white table. Both people fully visible from head to toe with the shoes visible, centered, standing on an invisible floor; together they fill about 85% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people besides the couple. No green color anywhere on the clothing, flowers or props. Square 1:1 image.
```

### `couple_cheers.png`

**Cụng ly sâm panh**

1:1 · Làm sau · tải kèm: `couple_ref.png`

```text
Use the attached image as the character reference and keep exactly the same groom and bride: same faces, hairstyles, outfits and colors. The groom and bride raise glasses of golden champagne toward each other in a toast, smiling. Both people fully visible from head to toe with the shoes visible, centered, standing on an invisible floor; together they fill about 85% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people besides the couple. No green color anywhere on the clothing, flowers or props. Square 1:1 image.
```

## MC

MC đứng bên trái sân khấu và nhìn về phía cô dâu chú rể, nên quay người hơi sang bên phải ảnh.

### `mc_idle.png`

**MC cầm micro (tư thế chính)**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A Vietnamese male wedding MC (master of ceremonies) in his early 30s, ivory white dinner jacket with black satin lapels, black bow tie, white shirt, black trousers, neat short black hair, black handheld microphone, holding the microphone at chest height, confident warm smile, body and face turned slightly toward the right side of the image. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `mc_talk.png`

**MC đang nói**

9:16 · Ưu tiên 2 · tải kèm: `mc_idle.png`

```text
Use the attached image as the character reference and keep exactly the same person: same face, hairstyle, outfit and colors. A Vietnamese male wedding MC (master of ceremonies) in his early 30s, ivory white dinner jacket with black satin lapels, black bow tie, white shirt, black trousers, neat short black hair, black handheld microphone, speaking into the microphone held near his mouth, free hand raised in an open welcoming gesture toward the right side of the image, lively expression. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

## Khách mời nam

Người xem comment "nam" sẽ ngồi bàn với một trong các hình này. Tất cả tải kèm guest_m1.png để cùng phong cách.

### `guest_m2.png`

**Vest xám, vỗ tay**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese man in a light grey suit with a light pink tie, clapping his hands, cheerful. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_m3.png`

**Sơ mi trắng xắn tay, vẫy tay**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese man in a white shirt with rolled-up sleeves, beige chinos and brown shoes, waving one hand, friendly smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_m4.png`

**Áo dài nam đỏ, khăn đóng**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A Vietnamese man in a traditional men's ao dai (long tunic) in deep red with a subtle gold pattern, white trousers and a red round traditional headwrap (khan dong), hands clasped politely in front, gentle smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_m5.png`

**Blazer xanh navy**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese man in a navy blazer, light blue shirt and dark grey trousers, one hand in his pocket, relaxed smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_m6.png`

**Vest đỏ đô, cầm phong bì**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese man in a burgundy suit and black shirt, holding a red wedding envelope with both hands. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_m7.png`

**Sơ mi xanh nhạt, giơ ngón cái**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese man in a light blue short-sleeve shirt and beige trousers, giving a thumbs up, big grin. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_m8.png`

**Chú trung niên, gi-lê nâu**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A Vietnamese uncle around 50 years old in a brown vest over a white shirt and dark trousers, hands behind his back, warm laughing face. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

## Khách mời nữ

Dùng khi người xem comment "nữ". Áo dài là điểm nhấn của đám cưới Việt, chỉ cần tránh màu xanh lá.

### `guest_f1.png`

**Áo dài đỏ thêu vàng, cầm hoa**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a red ao dai with gold floral embroidery and white silk trousers, holding a small bouquet of pink roses with no green leaves, sweet smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f2.png`

**Áo dài hồng phấn, vỗ tay**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a pastel pink ao dai, hair in a low bun, clapping happily. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f3.png`

**Áo dài trắng hoa xanh dương**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a white ao dai with a light blue flower print and long straight black hair, hands together near her chest, gentle smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f4.png`

**Đầm hồng dự tiệc, vẫy tay**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a blush pink knee-length party dress with a small handbag, waving one hand. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f5.png`

**Đầm satin vàng champagne**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a champagne gold satin evening dress, holding a glass of champagne, elegant smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f6.png`

**Đầm voan tím, reo hò**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a lavender chiffon midi dress, cheering with both arms raised. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f7.png`

**Áo dài xanh navy hoa bạc**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A young Vietnamese woman in a navy blue ao dai with a silver pattern and pearl earrings, hands lightly folded, gentle smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `guest_f8.png`

**Cô trung niên, áo dài nhung tím**

9:16 · Ưu tiên 2 · tải kèm: `guest_m1.png`

```text
Use the attached image only as a reference for art style, lighting and proportions; the people in this image are different. A Vietnamese auntie around 50 years old in a purple velvet ao dai with a pearl necklace and short permed hair, holding a red wedding envelope, warm smile. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, slight three-quarter turn toward the camera; the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

## Người đi lên thảm đỏ

Người tặng quà đi từ mép dưới màn hình lên sân khấu, tức là quay lưng về phía người xem. Hai ảnh nhìn từ phía sau này dùng cho đoạn đi bộ và làm khung đầu cho video đi bộ.

### `walker_m.png`

**Khách nam nhìn từ phía sau**

9:16 · Ưu tiên 2 · tải kèm: `guest_m6.png`

```text
Use the attached image as the character reference and keep exactly the same person: same face, hairstyle, outfit and colors. The same young Vietnamese man in a burgundy suit and black shirt, walking away from the camera toward a wedding stage, mid-stride, holding a red wedding envelope in his right hand slightly out to the side so it stays visible. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, seen from directly behind (back view, face not visible); the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

### `walker_f.png`

**Khách nữ nhìn từ phía sau**

9:16 · Ưu tiên 2 · tải kèm: `guest_f1.png`

```text
Use the attached image as the character reference and keep exactly the same person: same face, hairstyle, outfit and colors. The same young Vietnamese woman in a red ao dai with gold floral embroidery and white silk trousers, walking away from the camera toward a wedding stage, mid-stride, holding a small bouquet of pink roses slightly out to the side so it stays visible. Full body from head to toe with the shoes visible and a little empty space above the head and below the feet, centered, seen from directly behind (back view, face not visible); the person fills about 88% of the image height. Semi-realistic 3D render of Vietnamese people, natural human proportions, warm friendly expressions, soft cinematic studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. No text, no logo, no watermark, no other people. No green color anywhere on the clothing, flowers or props. Vertical 9:16 image.
```

## Video chuyển động

Phần này làm nhân vật cử động mượt. Dùng Image to Video, khung đầu là bản nền xanh của ảnh ghi trên thẻ. Thẻ ghi "lặp" thì đặt cùng ảnh đó làm khung cuối.

### `couple_idle.mp4`

**Cô dâu chú rể đứng**

5 giây · Ưu tiên 2 · khung đầu: `couple_idle.png` · lặp lại

```text
The groom and bride sway gently, glance at each other and smile, the bride lifts her bouquet slightly, natural breathing and blinking. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_kiss.mp4`

**Hôn nhau rồi quay lại nhìn khán giả**

5 giây · Ưu tiên 2 · khung đầu: `couple_idle.png` · lặp lại

```text
The groom and bride turn toward each other and share a gentle, tasteful kiss, then turn back and smile at the camera, ending in the starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `mc_talk.mp4`

**MC đang nói**

5 giây · Ưu tiên 2 · khung đầu: `mc_idle.png` · lặp lại

```text
The MC talks enthusiastically into the microphone, mouth moving as if speaking, nodding, his free hand gesturing toward the right side of the frame, friendly expression. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `mc_idle.mp4`

**MC đứng chờ**

5 giây · Ưu tiên 2 · khung đầu: `mc_idle.png` · lặp lại

```text
The MC stands holding the microphone, breathing calmly with a slight sway, smiles and blinks naturally, glances toward the right side of the frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `walk_m.mp4`

**Khách nam đi lên (nhìn từ phía sau)**

5 giây · Ưu tiên 2 · khung đầu: `walker_m.png` · lặp lại

```text
Seen from behind, the man walks away from the camera in place, as if on a treadmill: natural stride and arm swing, the red envelope in his hand. He stays exactly the same size and in the same spot, the camera does not follow. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `walk_f.mp4`

**Khách nữ đi lên (nhìn từ phía sau)**

5 giây · Ưu tiên 2 · khung đầu: `walker_f.png` · lặp lại

```text
Seen from behind, the woman walks away from the camera in place, as if on a treadmill: graceful natural steps, the bouquet in her hand, the ao dai panels swaying softly. She stays exactly the same size and in the same spot, the camera does not follow. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `bg_red_gold_party.mp4`

**Phông chế độ tiệc (làm cho từng phông)**

5 giây · Ưu tiên 2 · khung đầu: `bg_red_gold.jpg` · lặp lại

Khung đầu và khung cuối là ảnh phông đó. Đặt tên bg_<mã phông>_party.mp4 (vd bg_champagne_party.mp4); bg_party.mp4 thì tool tự gắn vào phông giống nhất. Phát khi cả rạp quẩy, bắn pháo hoa, có người lên sàn nhảy, kết thúc lễ.

```text
The empty wedding hall switches into party mode: colorful stage lights and moving spotlights sweep across the room, cold sparkler fountains shoot up along both sides of the red carpet, rose petals rain down and a disco ball sparkles under the chandeliers, then everything calms down and the hall returns to its exact starting look. Static locked-off camera: no zoom, no pan. No people appear. No text.
```

## Video động tác trendy

Động tác trend TikTok cho cô dâu chú rể và khách: tinh nghịch, táo bạo vừa đủ để giữ chân người xem trẻ, nhưng vẫn trong luật TikTok LIVE (hôn nhanh, không hôn sâu, không sờ soạng, không hở hang; quá đà là LIVE bị tắt, Dreamina cũng chặn prompt). Trong Dreamina chọn AI Video → Seedance → First and last frames, đặt cùng một ảnh cho cả hai ô, tỷ lệ Auto, 720P, 5 giây (nhảy có thể chọn 10 giây). Video cặp đôi dùng couple_idle.png cho cả hai ô để chuyển động tác liền mạch; riêng cắt bánh và cụng ly cần ảnh có bánh, có ly. Muốn nhiều kiểu cho cùng một lúc thì đánh số: couple_kiss2, couple_kiss3, couple_dance2… tool chọn ngẫu nhiên mỗi lần. Bỏ file vào bo-hinh-moi, chạy node tools/xu-ly-bo-hinh.mjs rồi làm mới OBS.

### `couple_kiss2.mp4`

**Hôn ngả người kiểu phim (dip kiss)**

5 giây · Ưu tiên 1 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: quà hôn, lúc hôn trong lễ. Tool chọn ngẫu nhiên giữa bản này và bản hôn đang có.

```text
Movie-style dip kiss: the groom pulls the bride close by the waist and dips her backward dramatically, they share a quick romantic kiss, he swings her back up, she laughs and playfully taps his chest, then they return to the exact starting pose smiling at the camera. Tasteful and romantic. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_kiss3.mp4`

**Cô dâu thơm má, chú rể đỏ mặt**

5 giây · Ưu tiên 2 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: quà hôn, lúc hôn trong lễ (thêm một kiểu cho đỡ nhàm).

```text
The bride stands on her tiptoes and gives the groom a quick peck on the cheek; he freezes, blushes and covers his face with one hand, shy and thrilled, she laughs and winks at the camera, then they return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_ring.mp4`

**Quỳ gối trao nhẫn**

5 giây · Ưu tiên 1 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: trao nhẫn trong lễ thành hôn, quà Trao nhẫn.

```text
The groom drops to one knee in front of the bride and slides a sparkling ring onto her finger, she gasps with joy and covers her mouth, then pulls him up by his bow tie into a tight happy hug, and they return to the exact starting pose holding hands. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_thanks.mp4`

**Cúi chào kiểu idol, thả tim, hôn gió**

5 giây · Ưu tiên 1 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: khách tặng quà thường (cách nhau ít nhất 10 giây).

```text
Idol-style thank you: the couple bows quickly to the camera, then both blow flying kisses and make finger hearts at the audience, the bride winks and the groom gives a charming smile, then they return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_shock.mp4`

**Ngất kiểu phim Hàn khi bị phá đám**

5 giây · Ưu tiên 1 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: có quà phá đám (hủy hôn), có người cưới luôn MC. Đặt tên couple_cancel.mp4 cũng được (vd cảnh giận dỗi bỏ đi).

```text
K-drama reaction: the bride gasps and dramatically fake-faints backward, the groom catches her in his arms just in time, both snap their heads toward the camera with exaggerated shocked faces, then burst out laughing, she stands back up and they return to the exact starting pose. Comedic, over-the-top acting. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_dance.mp4`

**Nhảy trend TikTok đôi**

5 giây · Ưu tiên 2 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: cả rạp quẩy, đổi nhạc. Có thể chọn 10 giây cho đủ điệu.

```text
The couple does a short viral TikTok couple dance in place: synchronized shoulder shimmies, a playful hip bump, the groom spins the bride once under his arm, both strike a cool pose toward the camera, then they return to the exact starting pose. Energetic, fun, perfectly in sync. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_heart2.mp4`

**Tim to bằng tay + tim ngón tay**

5 giây · Ưu tiên 2 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: vừa đủ đôi, đủ mục tiêu tim, mưa hoa. Chọn ngẫu nhiên với bản bắn tim đang có.

```text
Both raise their arms together to form one big heart shape above their heads, then switch to cute finger hearts pointed at the camera, the bride winks and the groom gives a confident smirk, then they return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_wave2.mp4`

**Chào kiểu idol**

5 giây · Làm sau · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: có người mới nhận vai cô dâu, chú rể; cụng ly, pháo hoa khi chưa có video riêng.

```text
The bride does a cute idol-style wave with a V sign next to her eye, the groom does a cool two-finger salute and a wink at the camera, they bump shoulders playfully and laugh, then return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_carry.mp4`

**Bế công chúa xoay vòng**

5 giây · Ưu tiên 2 · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: vào động phòng.

```text
The groom sweeps the bride into a princess carry and spins once in place, she kicks her feet happily and wraps her arms around his neck, he winks at the camera, then gently sets her down and they return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_bouquet.mp4`

**Tung hoa giả, lừa khán giả**

5 giây · Làm sau · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: tung hoa cưới.

```text
The bride winks at the camera and winds up as if to throw her bouquet to the guests, then fakes it out and pulls it back, laughing; the groom points at the audience playfully as if asking who wants it next. She keeps the bouquet the whole time and they return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_petal.mp4`

**Thả hôn gió, chú rể bắt lấy**

5 giây · Làm sau · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: mưa hoa hồng.

```text
The bride blows a flying kiss to the groom, he pretends to catch it in the air and presses it to his heart, then both look up with delight as if rose petals are falling and the bride twirls once in place, then they return to the exact starting pose. No petals or other objects appear in the frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_fireworks.mp4`

**Nhảy cẫng ăn mừng**

5 giây · Làm sau · khung đầu: `couple_idle.png` · lặp lại

Dùng khi: bắn pháo hoa.

```text
Both look up and cheer as if watching fireworks, the groom lifts the bride slightly off the ground in excitement and they high-five, then return to the exact starting pose. Nothing new appears in the frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_cake.mp4`

**Đút bánh, giả quẹt kem**

5 giây · Làm sau · khung đầu: `couple_cake.png` · lặp lại

Cần ảnh couple_cake.png (mục Cô dâu chú rể) làm cả khung đầu và khung cuối. Dùng khi: cắt bánh.

```text
After cutting the cake together, the groom playfully reaches toward the bride's nose with a fingertip as if to dab cream, she dodges and laughs, then feeds him a tiny bite of cake and he pretends it is the best thing ever, then they return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_cheers.mp4`

**Uống rượu giao bôi**

5 giây · Ưu tiên 2 · khung đầu: `couple_cheers.png` · lặp lại

Cần ảnh couple_cheers.png (mục Cô dâu chú rể). Dùng khi: cụng ly 1 2 3 dzô, rót rượu sâm panh.

```text
Love-shot toast: the groom and bride link arms and drink from their champagne glasses with arms intertwined, eyes locked and smiling, then unlink, clink glasses and cheer toward the camera, then return to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `guest_m1_idle.mp4`

**Khách đứng nhún theo nhạc (làm cho từng khách)**

5 giây · Ưu tiên 2 · khung đầu: `guest_m1.png` · lặp lại

Làm cho từng khách: đổi cả hai ô thành ảnh của khách đó, đặt tên guest_m2_idle.mp4, guest_f3_idle.mp4… Khách có video này cử động liên tục khi ngồi bàn.

```text
The person stands vibing to the music in place: a subtle head nod and shoulder groove on the beat, natural breathing, a playful smile and a quick wink at the camera, then returns to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `guest_m1_dance.mp4`

**Khách nhảy trend (làm cho từng khách)**

5 giây · Làm sau · khung đầu: `guest_m1.png` · lặp lại

Đặt tên guest_<mã>_dance.mp4. Khi khách mặc bộ đồ đó tặng quà lên sàn nhảy, tool phát video này.

```text
The person dances in place to a viral TikTok trend: hip sways, shoulder shimmies, a quick spin and a cool finishing pose with a finger heart at the camera, big smile, staying on the same spot, then returns to the exact starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Smooth natural motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

## Nhạc cưới tự tạo (Suno)

Bài gốc do AI làm theo prompt, không chép giai điệu hay lời của bài có sẵn. Tạo bằng gói trả phí thì mới có quyền dùng thương mại. Trong Suno chọn Custom, dán từng ô bên dưới vào ô cùng tên; bài không lời thì bật Instrumental và bỏ trống Lyrics. Mỗi lần Suno ra 2 bản, nghe rồi giữ bản hay nhất, tải MP3 và đưa vào tool ở tab Nhạc Nền.

### `tu-nay-minh-la-cua-nhau.mp3`

**Bài hát cưới song ca nam nữ**

có lời · Ưu tiên 1

Ballad V-pop ngọt ngào giống không khí các bài hay mở trong đám cưới, nhưng giai điệu và lời đều mới. Không ghi tên bài hay tên ca sĩ có sẵn vào ô Styles.

Title:

```text
Từ Nay Mình Là Của Nhau
```

Styles:

```text
Vietnamese V-pop wedding ballad, male and female duet sung in Vietnamese, warm piano, acoustic guitar, soft strings, gentle drums, heartfelt and romantic, builds to a big final chorus with a key change, 76 BPM
```

Lyrics:

```text
[Intro]

[Verse 1 - Male vocal]
Ngày anh gặp em giữa phố đông người
Chỉ một nụ cười mà lòng anh chơi vơi
Bao nhiêu mùa mưa nắng qua rồi
Hôm nay anh đến rước em về thôi

[Verse 1 - Female vocal]
Ngày em gặp anh, em nào có hay
Người con trai ấy sẽ cùng em đến hôm nay
Áo cưới trắng tinh, hoa cầm trên tay
Em nghe tim mình khẽ nói: chính là đây

[Pre-Chorus - Duet]
Pháo hồng rộn ràng ngoài ngõ
Mẹ cười rưng rưng trong gió
Họ hàng hai bên đứng đó
Chờ đôi ta trao lời thề

[Chorus - Duet]
Từ nay mình là của nhau
Dù mai sau nắng mưa dãi dầu
Anh là mái nhà, em là ngọn đèn
Thắp sáng những tháng năm dài phía sau
Từ nay mình là của nhau
Cùng nắm tay đi tới bạc đầu
Trăm năm vẫn một lời hẹn ước
Mình mãi mãi bên nhau

[Verse 2 - Male vocal]
Cảm ơn ba mẹ đã sinh ra em
Cho anh được thương một người con gái hiền
Anh hứa sẽ luôn che chở em
Những lúc em buồn có anh kề bên

[Verse 2 - Female vocal]
Cảm ơn cuộc đời cho em gặp anh
Chẳng mong cao sang, chỉ cần chân thành
Sớm mai thức dậy có anh bên cạnh
Vậy là đủ cho em trọn kiếp an lành

[Pre-Chorus - Duet]
Pháo hồng rộn ràng ngoài ngõ
Mẹ cười rưng rưng trong gió
Họ hàng hai bên đứng đó
Chờ đôi ta trao lời thề

[Chorus - Duet]
Từ nay mình là của nhau
Dù mai sau nắng mưa dãi dầu
Anh là mái nhà, em là ngọn đèn
Thắp sáng những tháng năm dài phía sau
Từ nay mình là của nhau
Cùng nắm tay đi tới bạc đầu
Trăm năm vẫn một lời hẹn ước
Mình mãi mãi bên nhau

[Bridge]
[Male vocal] Mai sau dù ra sao
[Female vocal] Em vẫn tin vào nhau
[Male vocal] Bao gian nan phía trước
[Duet] Có anh có em, chẳng sợ chi đâu

[Final Chorus - Duet, key change]
Từ nay mình là của nhau
Dù mai sau nắng mưa dãi dầu
Anh là mái nhà, em là ngọn đèn
Thắp sáng những tháng năm dài phía sau
Từ nay mình là của nhau
Cùng nắm tay đi tới bạc đầu
Trăm năm vẫn một lời hẹn ước
Mình mãi mãi bên nhau

[Outro - Duet]
Từ nay... mình là của nhau

[End]
```

### `don-khach.mp3`

**Nhạc nền đón khách**

không lời · Ưu tiên 1

Title:

```text
Đón Khách Vào Rạp
```

Styles:

```text
Instrumental, elegant wedding reception background music, warm romantic piano, soft strings, light acoustic guitar, bright and gentle, steady calm mood that loops well, 80 BPM, no vocals
```

### `le-thanh-hon.mp3`

**Nhạc làm lễ thành hôn**

không lời · Ưu tiên 2

Title:

```text
Lễ Thành Hôn
```

Styles:

```text
Instrumental, grand wedding ceremony processional, majestic orchestral strings, warm pipe organ, harp glissandos, soft timpani, slow and uplifting, 64 BPM, no vocals
```

### `quay-len-rap-cuoi.mp3`

**Nhạc quẩy cho sàn nhảy**

có lời · Ưu tiên 2

Title:

```text
Quẩy Lên Rạp Cưới
```

Styles:

```text
Vietnamese wedding party remix, vinahouse EDM, punchy four-on-the-floor kick, bouncy bass, bright synth lead, festive brass stabs, crowd chants in Vietnamese, 132 BPM, high energy
```

Lyrics:

```text
[Intro]
Rạp cưới lên đèn rồi, cả nhà ơi!

[Build]
Một, hai, ba, dô!

[Drop]

[Verse]
Cô dâu thì xinh, chú rể thì bảnh
Họ hàng hai bên đứng vây quanh
Ai ở phương xa thả tim thật nhanh
Chúc đôi uyên ương mãi an lành

[Chorus - Crowd chant]
Quẩy lên! Quẩy lên! Rạp cưới hôm nay!
Nâng ly chúc mừng, vỗ tay, vỗ tay!
Quẩy lên! Quẩy lên! Vui hết đêm nay!
Một, hai, ba, dô!

[Drop]

[Chorus - Crowd chant]
Quẩy lên! Quẩy lên! Rạp cưới hôm nay!
Nâng ly chúc mừng, vỗ tay, vỗ tay!
Quẩy lên! Quẩy lên! Vui hết đêm nay!
Một, hai, ba, dô!

[Outro]
Một, hai, ba, dô!

[End]
```

### `dem-tan-hon.mp3`

**Nhạc động phòng**

không lời · Làm sau

Title:

```text
Đêm Tân Hôn
```

Styles:

```text
Instrumental, romantic slow R&B lofi, soft electric piano, warm bass, gentle brushed drums, candlelight mood, 70 BPM, no vocals
```

## Sửa lỗi nhanh: thêm câu này vào cuối prompt

| Hình bị gì | Thêm vào prompt |
|---|---|
| Bị cắt mất chân hoặc đỉnh đầu | Zoom out so the whole body fits inside the image, with empty space above the head and below the shoes. |
| Nhân vật không giống ảnh mẫu | Keep the face, hairstyle, outfit and colors exactly identical to the attached reference image; only change the pose. |
| Nền ra ô caro xám trắng (trong suốt giả) | Do not draw a checkerboard pattern. Use a flat solid pure green background (#00FF00) instead. |
| Nền có sàn, bóng hoặc chuyển màu | The background must be one flat solid pure green color (#00FF00) everywhere, with no floor, no shadow, no gradient and no vignette. |
| Quần áo, hoa hoặc đạo cụ có màu xanh lá | Recolor every green part of the outfit, flowers and props to white, gold or pink. |
| Bàn tay, ngón tay bị lỗi | Anatomically correct hands with five fingers each, natural relaxed hand pose. |
| Video: máy quay tự di chuyển | Locked-off tripod shot. The camera never moves; the framing stays identical from the first frame to the last. |
| Video: nhân vật trôi, to ra hoặc nhỏ lại | The character stays centered at exactly the same size and position for the whole clip; only the body moves. |
| Video: tự thêm người, chữ hoặc nhạc | Only the people from the first frame appear. No new people, no text, no subtitles, no music. |

