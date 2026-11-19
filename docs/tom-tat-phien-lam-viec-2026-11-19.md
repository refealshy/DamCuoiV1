# Tóm tắt phiên làm việc 16–19/11/2026

Bản ghi gọn của một phiên làm việc dài với trợ lý AI trên nhánh `bo-hinh-ban-thuc-3d`. Mục đích: ai mở lại dự án (người hoặc AI) đọc một file là nắm được đã làm gì, vì sao, và còn thiếu gì.

## 1. Mục tiêu và ràng buộc

App là một "rạp cưới online" chạy trên TikTok LIVE: người xem tặng quà hoặc bình luận để lên vai cô dâu, chú rể, và xem đôi trẻ làm lễ.

Yêu cầu xuyên suốt của chủ dự án:

- **Kịch bản phải kéo được quà**, không chỉ cho vui. Tính năng nào cũng phải trả lời được: người xem tặng quà ở đâu, và được gì ngay trên màn hình (tên, vai, được MC gọi).
- **Trend là trend TikTok Việt** (câu nói, meme), không phải điệu nhảy quốc tế. Một trend chỉ dùng khi việc đang diễn ra trên sân khấu đúng là tình huống người ta nói câu đó ngoài đời. Không có cảnh hợp thì bỏ, không thêm đạo cụ hay động tác để minh họa trend.
- **Hình phải thật sự gây cười**, hài kiểu đời thường Việt Nam ai nhìn cũng nhận ra.
- **Bước vui thì cho miễn phí trước, rồi để một sự cố ngẫu nhiên chặn lại**: quà là cách gỡ nhanh nhất.

Ràng buộc chính sách TikTok LIVE được giữ trong mọi thiết kế:

- MC ảo chỉ tường thuật và cảm ơn, không xin quà máy móc. Lời mời tặng quà để người dẫn thật nói.
- Luôn có cửa miễn phí, quà không thành vé bắt buộc.
- Quà cho kết quả chắc chắn, không quay số may rủi.
- Không chia hai phe đấu nhau bằng quà, tim hay bình luận.

## 2. Đã làm gì, theo thứ tự

### 2.1 Biến cố trước lễ có cửa tặng quà (commit `9493197`)

Mỗi biến cố là một màn kịch ngắn lúc hết giờ đếm ngược, với hai cửa đặt cạnh nhau: cả rạp thả tim hoặc gõ từ khóa (miễn phí), hoặc tặng quà để thành người hùng của màn đó.

| Biến cố | Cửa miễn phí | Tặng quà thì thành |
|---|---|---|
| Có người xông vào đòi thay vai (người đứng đầu hàng chờ gọi là "lốp trưởng") | Thả tim che chắn | Vệ sĩ |
| Bố vợ thách cưới | Gõ "dạ bố" | Nhà tài trợ sính lễ |
| Cô dâu hóa gián | Gõ "yêu" | Thần tình yêu |
| Cúp điện | Thả tim quay máy phát | Người thắp nến |
| Cưới tập thể | Gõ "cưới" | Suất hạng nhất |

Người tặng nhiều xu nhất được ghi công cạnh đôi trẻ tới hết lượt cưới và có mặt trong ảnh cưới.

### 2.2 Phòng tân hôn và sinh con

- **Phòng sắp khóa cửa** (chỉ còn dùng khi tắt "Tiệc mừng tự diễn"): trong tiệc mừng, ai tặng quà động phòng trước thì làm ông mai hoặc bà mối; hết giờ không ai tặng thì đôi trẻ lỡ phòng.
- **Chín tháng mười ngày sau**: cửa phòng vừa đóng, bảng hai ô "bé trai" và "bé gái" hiện 15 giây. Mỗi ô một món quà riêng, người tặng đầu tiên làm bố mẹ đỡ đầu. Một món thì sinh một bé, đủ hai món thì sinh đôi, không ai tặng thì MC chúc sớm sinh quý tử. Hai món không đấu nhau nên không có phe thua.

### 2.3 Hình và video cho biến cố

Chủ dự án tự tạo hình bằng công cụ AI theo bộ prompt do trợ lý soạn (xem [kich-ban-va-prompt-bien-co.md](kich-ban-va-prompt-bien-co.md)), bỏ vào `bo-hinh-moi/` rồi chạy công cụ xử lý. Đã có: người yêu cũ nam (tài xế công nghệ giao trà sữa tới đúng đám cưới người yêu cũ) và nữ (cầm hóa đơn tới tính sổ), bố vợ áo ba lỗ quần đùi cầm chổi lông gà (bản khó chịu và bản cười), hội trường lúc cúp điện, bốn hiệu ứng tràn màn hình, cô dâu hóa gián, cặp đôi hết hồn, em bé trai và gái.

Sửa công cụ `tools/xu-ly-bo-hinh.mjs`:

- Nhân vật mặc đồ xanh lá thì làm trên nền xanh dương; công cụ tự nhận nền xanh lá hay xanh dương.
- Hiệu ứng nền đen có tia sáng xanh (tia sét) từng bị nhận nhầm thành nền xanh dương và bị xóa mất một phần. Giờ chỉ coi là nền màu khi phần lớn điểm đo ở mép mang màu đó.
- Thêm nhóm hình `bc_baby_*`, `bc_uncle`, `bc_kid`, `bc_friends`.

### 2.4 Tiệc mừng tự diễn và năm sự cố

Cưới xong, đôi trẻ tự hôn, cắt bánh, cụng ly rồi vào phòng tân hôn, không cần ai tặng quà, nên buổi LIVE lúc nào cũng có trò để xem. Trung bình hai lượt cưới một lần, một sự cố chen vào chặn đúng bước sắp diễn ra.

| Sự cố | Chặn bước | Cửa miễn phí | Tặng quà thì thành | Không ai gỡ |
|---|---|---|---|---|
| Chú rể quên nhẫn | Trao nhẫn (trước lễ) | Thả tim tìm nhẫn | Người cho mượn nhẫn | Đeo tạm dây thun |
| Bố vợ chặn hôn | Hôn | Gõ "hôn đi" | Cao thủ dụ bố vợ | Hôn gió |
| Bánh cưới đổ | Cắt bánh | Thả tim dựng bánh | Nhà tài trợ bánh cưới | Cắt bánh mì |
| Ông chú giành mic | Cụng ly | Gõ "xuống đi" | Chủ xị | Nghe hết liên khúc |
| Hội bạn thân chặn cửa | Vào phòng tân hôn | Gõ "mở cửa" | Ông mai, bà mối | Ngủ ngoài hành lang |

Luật chung của sự cố:

- Món quà đã gán cho đúng bước đang bị chặn (quà "hôn" lúc bố vợ chặn hôn, quà "động phòng" lúc cửa bị chặn) gỡ ngay. Tên món đó hiện trên thẻ nhân vật. Quà khác góp điểm lớn.
- Mục tiêu tính theo nhịp tương tác của rạp, nên rạp đông và chịu gõ thì thắng không cần quà.
- Thua thì bước đó diễn bản chữa cháy cho vui, đôi trẻ không mất gì đã trả tiền.
- Quà "động phòng luôn" vẫn tiễn đôi trẻ vào phòng ngay, kể cả giữa tiệc hay giữa một sự cố khác.
- Bình luận không tự diễn được bước đang bị chặn (gõ "hôn đi" lúc bố vợ chặn hôn chỉ tính điểm).

Các màn này dùng chuyện quen ở đám cưới Việt, không đưa trend nào vào vì chưa thấy trend nào hợp cảnh.

### 2.5 Việc nhỏ khác

- Thời gian chờ khi sân khấu trống trước khi MC ghép đôi ngẫu nhiên: 8 giây lên 60 giây.
- Câu MC giữ trong khoảng 14 từ trở xuống (trừ các bài thơ).

## 3. Một lượt cưới bây giờ diễn ra thế nào

1. Sân khấu trống: khách tặng quà hoặc bình luận nhận vai; sau 60 giây không ai nhận thì MC ghép đôi ngẫu nhiên.
2. Đủ đôi: đếm ngược tới lễ. Bảng "ai dám phá đám" mời quà thay vai, hủy hôn.
3. Hết đếm ngược: thỉnh thoảng có biến cố trước lễ (mục 2.1, và "quên nhẫn").
4. Lễ thành hôn, chụp ảnh cưới.
5. Tiệc mừng tự diễn: hôn, cắt bánh, cụng ly; thỉnh thoảng một sự cố chặn một bước.
6. Vào phòng tân hôn (hoặc bị chặn cửa). Cửa đóng: cửa sổ sinh con nếu đã gán quà em bé.
7. Đôi trẻ rời sân khấu, mở vai cho lượt mới.

## 4. Cấu hình mới (bảng điều khiển)

| Ô | Khóa | Mặc định | Ý nghĩa |
|---|---|---|---|
| Tiệc mừng tự diễn | `partyFree` | bật | Tắt thì về kiểu cũ: chờ quà mới hôn, cắt bánh; hết giờ phòng khóa cửa |
| Sự cố trong tiệc mừng | `hitchEvery` | 2 | Trung bình mấy lượt cưới một sự cố; 0 là tắt |
| Loại sự cố | `twists.ring/kiss/cake/cheers/room` | bật | Bật tắt từng loại |
| Sinh con | `babySeconds` | 15 | Cửa phòng đóng bao nhiêu giây; 0 là tắt |
| Chờ khi sân khấu trống | `autoPairSeconds` | 60 | Giây chờ trước khi MC ghép đôi ngẫu nhiên |

Luật quà có thêm hai hành động "Sinh bé trai" và "Sinh bé gái". Chưa gán quà cho hành động nào thì màn sinh con không chạy. Khung nút bấm nhanh có nút thử cho từng biến cố và sự cố.

## 5. Code nằm ở đâu

| File | Phần liên quan |
|---|---|
| `app/server.cjs` | Mục "BIẾN CỐ" (bảng `HITCH`, `startTwist`, `twistAdd`, `resolveTwist`), mục "TIỆC MỪNG TỰ DIỄN" (`startParty`, `partyNext`, `startHitch`, `partyAfterHitch`, `partyRoom`), mục "SINH CON" (`startBaby`, `babyGift`, `resolveBaby`) |
| `app/mc_lines.cjs` | 150 nhóm câu MC; mỗi sự cố có `twist<Tên>Start`, `Win`, `Lose` và `twistGift<Tên>` |
| `app/public/overlay.js` | Bảng `TWIST_UI` (mọi chữ trên màn hình của biến cố và sự cố), `twistActorShow`, `twistEnd`, `babyWindow`, `babyReveal`, bảng mời quà lúc tiệc mừng |
| `app/public/overlay.css` | Kiểu của bảng hai cửa, bảng sinh con, màn khoe em bé |
| `app/public/panel.js`, `index.html` | Ô cài đặt và nút thử |
| `tools/xu-ly-bo-hinh.mjs` | Tách nền và đưa hình vào `app/public/themes/ban-thuc-3d/` |

Sự cố dùng chung bộ máy "hai cửa" của biến cố: một đối tượng `twist` có thêm `stage` (`pre` là trước lễ, `party` là trong tiệc mừng). Thêm sự cố mới gồm: một dòng trong `HITCH` và các bảng số ở server, một mục trong `TWIST_UI` ở màn hình, và bốn nhóm câu MC.

## 6. Thử thế nào

Bài thử tự động nằm ngoài repo (thư mục `.tmp_kiemtra/`, không đưa lên git): một server thử ở cổng riêng cùng Chrome không giao diện, gửi sự kiện giả qua webhook rồi đọc sự kiện và màn hình.

Kết quả lần chạy cuối (19/11/2026):

- Sự cố và tiệc mừng tự diễn, 10 màn: đạt hết, không lỗi JavaScript.
- Các bài thử cũ (biến cố, phòng khóa cửa và sinh con, ảnh cưới, câu thoại, bảng điều khiển) chạy với "Tiệc mừng tự diễn" tắt: đạt hết.

Chưa thử trên một buổi LIVE thật với các tính năng này.

Lưu ý khi phát triển: server thật phục vụ thẳng thư mục `app/` và tự ghi `wedding_state.json`. Khi nó đang chạy, đổi cấu hình qua bảng điều khiển chứ đừng sửa file, và làm tính năng mới trên một bản sao rồi mới chép về.

## 7. Còn lại

- **Hình còn thiếu:** `bc_uncle` (ông chú giành mic), `bc_kid` (Bé Tí quẹt bánh), `bc_friends` (hội bạn thân chặn cửa), mỗi cái một ảnh và một video. Prompt nằm ở mục "Nhân vật sự cố" của [kich-ban-va-prompt-bien-co.md](kich-ban-va-prompt-bien-co.md). Chưa có thì app mượn hình một vị khách và che mặt bằng biểu tượng. Có rồi thì chạy `node tools/xu-ly-bo-hinh.mjs --chi=bc`.
- **Gán quà em bé** trong tab "Luật quà" để bật màn sinh con.
- **Ảnh nguồn hơi nhỏ** (rộng 498 px, đề nghị từ 1080 px); hội trường lúc cúp điện sẽ hơi mờ. Tải lại bản gốc rồi xử lý lại nếu có.
- **Theo dõi trên LIVE thật:** khi các bước tự diễn miễn phí, quà hôn, cắt bánh, rót rượu mất vai trò "tặng mới được xem" và chỉ còn tác dụng gỡ sự cố. Giả định là tiền chủ yếu đến từ quà nhận vai và thay vai (suy từ một mẫu nhỏ). Nếu thu giảm, tắt "Tiệc mừng tự diễn" để so sánh.
- **Lượt cưới dài hơn:** phần sau lễ khoảng 25 giây tiệc cộng 12 giây vào phòng; lượt có sự cố thêm khoảng 25 giây, có cửa sổ sinh con thêm khoảng 21 giây.
