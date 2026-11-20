# Bộ Prompt Biến Cố

Kịch bản, hình và video cho năm biến cố: có người xông vào đòi thay vai, bố vợ thách cưới, cô dâu hóa gián, cúp điện, cưới tập thể. Thêm tiệc mừng tự diễn sau lễ với năm sự cố (quên nhẫn, bố vợ chặn hôn, bánh đổ, ông chú giành mic, chặn cửa phòng) tuần trăng mật check-in sang chảnh, và màn đón em bé. Mỗi màn có cửa tặng quà nằm ngay trong câu chuyện. Trend TikTok Việt chỉ xuất hiện ở cảnh hợp với nó. Nhân vật cùng bộ Bán thực 3D đang dùng. Tên file, tỷ lệ và hướng nhìn đã khớp với màn hình LIVE.

> Bản Markdown xuất từ `bo-prompt-bien-co.html` bằng `tools/xuat-prompt-md.mjs`. Mở file HTML bằng trình duyệt để có nút sao chép và ô đánh dấu "đã tạo xong".

## Kịch bản từng biến cố

Mỗi biến cố là một màn kịch ngắn lúc đôi trẻ sắp làm lễ, đi đủ bốn nhịp: mở màn, cả rạp ra tay, vinh danh, hẹn lượt sau. Lúc ra tay, màn hình luôn đặt hai cửa cạnh nhau: cửa miễn phí để cả rạp cùng làm, và cửa tặng quà để một người thành người hùng của màn đó. Câu thoại và trend đi theo đúng việc đang diễn ra trên sân khấu.

- **Cửa miễn phí:** Thả tim hoặc gõ đúng từ khóa. Cả rạp đẩy chung một thanh, không chia phe.
- **Cửa tặng quà:** Quà nào cũng tính. Người tặng bước lên sân khấu, có tên trên bảng, MC cảm ơn theo đúng câu chuyện, thanh nhảy vọt.
- **Vinh danh:** Thắng thì người tặng nhiều xu nhất được gọi tên trên bảng tin, đứng cạnh đôi trẻ tới hết lượt cưới và có mặt trong ảnh cưới.
- **Hẹn lượt sau:** Người bị đẩy lui hẹn quay lại, người đứng đầu hàng chờ có tên riêng và được lên sóng: người xem có lý do ở lại xem tiếp.

| Biến cố | Mở màn | Cả rạp làm gì | Tặng quà thì | Kết | File hình |
|---|---|---|---|---|---|
| Có người xông vào đòi thay vai | "KHOAN ĐÃ!" Nếu có người đang xếp hàng chờ vai thì chính người đứng đầu hàng xông ra, màn hình gọi là "lốp trưởng". Không ai xếp hàng thì là vợ chồng cũ thật trong sổ cưới, hoặc một khách đóng người yêu cũ | Thả tim che chắn | Thành vệ sĩ. Chính người xông vào tặng quà thay vai thì cướp ngay | Thắng: người đó bị hất văng (lốp trưởng thì về lại hàng chờ). Thua: người đó lên thay vai | `bc_ex_m` `bc_ex_f` `bc_fx_shatter` `bc_fx_shield` `couple_shock` |
| Bố vợ thách cưới | Bố vợ hỏi lương, nhà, xe. Chú rể né: "dạ gỗ xà cừ ạ" | Gõ "dạ bố" xin cưới giùm | Món quà thành sính lễ. Quà nhỏ bố vợ chấm "sáu bảy, tạm được", quà lớn "con rể quý đây rồi" | Thắng: bố vợ cắn thử vàng, gửi thiệp hoa hồng lấp lánh. Thua: chú rể bị đuổi | `bc_bovo_angry` `bc_bovo_happy` `bc_fx_goldrain` |
| Cô dâu hóa gián | "Nếu em biến thành con gián, anh còn yêu em không?" | Mỗi người tự chọn. Gõ "yêu" thì góp sức. Gõ "không yêu" (hoặc "chạy") thì bị gián rượt cho vui, không góp mà cũng không trừ. Chính chú rể gõ "yêu" là qua ngay, gõ "không yêu" là thua ngay | Tiếp sức tình yêu, thành thần tình yêu | Thắng: gián biến lại thành cô dâu. Thua: chú rể bỏ chạy mất dép | `couple_roach` |
| Cúp điện | Sét đánh, hội trường tối om, chỉ còn những đôi mắt | Thả tim quay máy phát | Thắp nến, thành thợ điện của rạp | Thắng: điện về, một khách bị bắt quả tang. Thua: cưới ánh nến | `bc_dark` `bc_fx_lightning` |
| Cưới tập thể | "Chồng con gì chưa người đẹp?" | Gõ "cưới" để cưới ké | Suất hạng nhất: luôn có chỗ, đứng đầu | Các cặp cưới ké thành hôn cùng đôi chính | Không cần |

**Người dẫn thật nói gì.** MC ảo chỉ tường thuật và cảm ơn. Lời mời tặng quà để người dẫn nói, thưa và đúng lúc, như ba gợi ý dưới đây.

- **Lúc mở màn:** Gọi tên người trong cuộc: "Minh Anh ơi, có người tới đòi vợ kìa! Ai làm vệ sĩ cho đôi trẻ nào?"
- **Lúc thanh gần đầy:** Nói đúng phần còn thiếu: "Còn 8 tim nữa thôi", "thêm một lễ vật là bố vợ gật đầu".
- **Lúc có người tặng:** Cảm ơn bằng đúng vai của họ: "Cảm ơn vệ sĩ Lan", "nhà tài trợ sính lễ Thu Trang đây rồi".

**Sau lễ: tiệc mừng tự diễn và các sự cố.** Cưới xong, đôi trẻ tự hôn, cắt bánh, cụng ly rồi vào phòng tân hôn, không cần ai tặng quà, nên buổi LIVE lúc nào cũng có trò để xem. Thỉnh thoảng một sự cố chen vào chặn đúng bước sắp diễn ra. Người xem đã thấy bước đó diễn trọn vẹn ở lượt trước nên muốn cứu. Vẫn là hai cửa: cả rạp gỡ miễn phí, hoặc một món quà gỡ nhanh. Không gỡ kịp thì bước đó diễn bản chữa cháy cho vui, đôi trẻ không mất gì.

| Sự cố | Chặn bước nào | Cả rạp làm gì | Tặng quà thì | Không ai gỡ | File hình |
|---|---|---|---|---|---|
| Chú rể quên nhẫn | Trao nhẫn, ngay trước lễ. Chú rể móc túi ra chìa khóa xe | Thả tim đi tìm nhẫn | Thành người cho mượn nhẫn | Đeo tạm dây thun, lễ vẫn diễn ra | Không cần |
| Bố vợ chặn hôn | Hôn. Bố vợ chen vào đứng giữa: "Chưa cho hôn!" | Gõ "hôn đi" xin bố | Mời rượu bố vợ, thành cao thủ dụ bố vợ | Chỉ được hôn gió qua vai bố | Dùng lại `bc_bovo_angry` `bc_bovo_happy` |
| Bánh cưới đổ | Cắt bánh. Bé Tí quẹt mất tầng trên, bánh sập | Thả tim dựng lại bánh | Thành nhà tài trợ bánh cưới | Cắt tạm bánh mì | `bc_kid` |
| Ông chú giành mic | Cụng ly. Ông chú ôm mic hát tới bài thứ ba | Gõ "xuống đi chú" | Mời chú một ly, thành chủ xị | Cả rạp nghe hết liên khúc | `bc_uncle` |
| Chặn cửa phòng tân hôn | Vào phòng. Hội bạn thân đứng chắn cửa đòi lì xì | Gõ "mở cửa" | Lì xì mở cửa, thành ông mai hoặc bà mối | Đôi trẻ ngủ ngoài hành lang | `bc_friends` |
| Tung hoa cưới | Không chặn gì: sau khi cụng ly, cô dâu tung hoa, bó hoa lơ lửng trên đầu cả rạp 9 giây | Gõ "chụp" để giơ tay. Hết giờ một người đã giơ tay bắt được hoa và được xếp hàng lên làm cô dâu hoặc chú rể lượt sau | Tặng quà bất kỳ là chụp chắc: người tặng chắc chắn bắt được và đứng đầu hàng chờ | Hoa rơi xuống đất, MC nhặt về cắm bình | Không cần |
| Tuần trăng mật | Không chặn gì: cuối tiệc mừng, màn hình bày ra danh sách mười điểm đến (ảnh làm mờ), mỗi nơi một mức xu, đồng hồ 12 giây. Mặc định là một chỗ gần nhà (quán trà đá, sân thượng, hồ câu cá) | Thả tim, bình luận đủ thì được nơi rẻ nhất (Đà Lạt) | Tặng quà để chọn: tổng xu quà của cả rạp tới mức của nơi nào thì đi nơi đó (Đà Lạt 1, Phú Quốc 5, Hạ Long 10, Seoul 30, Tokyo 50, Paris 99, Maldives 199). Người tặng nhiều xu nhất là nhà tài trợ. Hết giờ hiện tấm check-in có đôi trẻ ở nơi được chọn, mặc đồ của nơi đó | Vẫn trăng mật ở chỗ gần nhà, rồi vào phòng như thường | `moon_*` `checkin_*` |
| Chín tháng mười ngày sau | Không chặn gì: cửa phòng vừa đóng, bảng hai ô "bé trai", "bé gái" hiện 15 giây |  | Người tặng đầu tiên của mỗi món làm bố mẹ đỡ đầu. Đủ hai món thì sinh đôi | Cửa mở, MC chúc sớm sinh quý tử | `bc_baby_boy` `bc_baby_girl` |

- **Đúng món thì gỡ ngay:** Món quà đã gán cho đúng bước đang bị chặn (quà "hôn" lúc bố vợ chặn hôn, quà "động phòng" lúc cửa bị chặn) gỡ sự cố tức thì. Tên món đó hiện ngay trên thẻ nhân vật. Quà khác thì góp điểm lớn.
- **Cửa miễn phí thắng được:** Mục tiêu tính theo nhịp tương tác của rạp. Rạp đông và chịu gõ thì thắng không cần quà, người góp nhiều nhất vẫn được gọi tên.
- **Mỗi lượt một sự cố:** Trung bình hai lượt cưới có một sự cố sau lễ, không lặp cùng loại hai lần liền. Chỉnh trong bảng điều khiển.
- **Động phòng luôn:** Quà "động phòng luôn" vẫn tiễn đôi trẻ vào phòng ngay lập tức, bỏ qua phần tiệc còn lại, người tặng làm ông mai hoặc bà mối.

**Bật, tắt:** bảng điều khiển, ô "Tiệc mừng tự diễn". Tắt thì về kiểu cũ: chờ khách tặng đúng món mới hôn, cắt bánh, và hết giờ phòng tân hôn khóa cửa. Ô "Sự cố trong tiệc mừng" chỉnh nhịp, đặt 0 là không có sự cố.

**Tung hoa cưới:** ô "Tung hoa cưới" chỉnh số giây chụp (0 là tắt). Đây là cửa miễn phí để khán giả lên sân khấu: người bắt được thật sự lên vai ở lượt cưới sau.

**Tuần trăng mật:** ô "Tuần trăng mật" chỉnh số giây chọn (0 là tắt) và mức xu của từng nơi. Cả rạp góp chung một chuyến nên không có phe nào thua. Ảnh `moon_` dùng cho các ô chọn và nền mờ, ảnh `checkin_` hiện lúc khoe.

**Bật màn em bé:** tab "Luật quà", gán một món quà cho "Sinh bé trai" và một món cho "Sinh bé gái". Chưa gán món nào thì màn này không chạy.

**Thử từng màn:** khung nút bấm nhanh có năm nút "Sự cố". Bấm rồi chờ lượt cưới kế tiếp, sự cố sẽ diễn đúng chỗ của nó.

**Câu thoại:** các màn này dùng chuyện quen ở đám cưới Việt (bố vợ canh con gái, ông chú giành mic, hội bạn thân đòi lì xì). Tôi không đưa trend nào vào vì chưa thấy trend nào hợp cảnh.

Chưa có file hình nào thì biến cố vẫn chạy: app mượn hình khách và tự vẽ hiệu ứng. Có file nào thì app dùng file đó, nên bạn làm dần từng file cũng được.

## Cách làm

Làm theo thứ tự này thì nhân vật mới cùng phong cách với cô dâu chú rể và khách đang có trên rạp.

**Tải kèm đúng ảnh ghi ở cuối mỗi thẻ.** Ảnh mẫu đã có sẵn trong `DamCuoiV1/bo-hinh-moi/`: `guest_m1.png` để lấy phong cách, `couple_idle.png` để giữ đúng cô dâu chú rể, `bg_pink_white.jpg` để giữ đúng hội trường.

**Làm ảnh nhân vật trước** (mục Nhân vật). Ảnh 9:16, nền xanh lá `#00FF00`, thấy đủ từ đầu tới chân, kể cả đạo cụ. Riêng người yêu cũ nam mặc đồ xanh lá nên làm trên nền xanh dương `#0000FF`. App tự nhận ra màu nền, bạn không phải chỉnh gì.

Nhân vật đứng bên phải sân khấu nên phải quay người và chỉ tay về bên TRÁI ảnh, tức là về phía cô dâu chú rể.

**Tạo vài bản rồi chọn bản buồn cười nhất.** Mỗi thẻ ghi rõ miếng hài cần thấy. Bản nào nhìn một giây chưa bật cười thì tạo lại, hoặc thêm câu ở mục Sửa lỗi nhanh.

**Làm video từ chính ảnh vừa chọn** (Image to Video). Đặt ảnh đó làm khung đầu và khung cuối, 5 giây, để video lặp lại không bị giật.

**Hiệu ứng tràn màn hình làm bằng Text to Video**, tỷ lệ 9:16. Ánh sáng như sét, tia lửa làm trên nền đen. Vật thể như dép, vàng, phong bì làm trên nền xanh lá. Mỗi thẻ ghi rõ nền nào.

**Đặt đúng tên file như trên thẻ**, bỏ vào `DamCuoiV1/bo-hinh-moi/`, rồi chạy lệnh ở mục cuối trang. Tick "Đã tạo xong" để theo dõi.

- **Phải gây cười ngay:** Mỗi nhân vật có một miếng hài nhìn là hiểu: đạo cụ vô lý, mặt diễn lố hết cỡ. Nhân vật chỉ cao khoảng một phần tư màn hình điện thoại nên miếng hài phải to và rõ.
- **Hài nhưng dễ thương:** Cười vì tình huống, không chê ngoại hình, không tục, không bạo lực. Trang phục kín đáo để không vi phạm quy định TikTok LIVE.
- **Không trùng màu nền:** Màu nào trùng nền thì bị xóa cùng nền. Ảnh nền xanh lá không được có màu xanh lá. Ảnh nền xanh dương không được có màu xanh dương, kể cả quần jean. Đồ trong suốt cũng lộ nền.
- **Không có chữ, không logo:** Công cụ AI viết chữ hay sai. Hóa đơn, sổ đỏ để trơn, app tự hiện chữ khi cần. Áo và nón tài xế cũng để trơn: màu xanh là đủ nhận ra, không cần logo hãng thật.
- **Gương mặt bình thường:** Không dùng mặt người nổi tiếng hay người thật.

## Trend dùng ở đâu

Một trend chỉ được dùng khi việc đang diễn ra trên sân khấu đúng là tình huống người ta nói câu đó ngoài đời. Không có cảnh hợp thì không dùng. Vì vậy nhân vật không phải đeo thêm đạo cụ hay làm thêm động tác nào chỉ để cho đủ trend.

| Trend | Cảnh dùng | Vì sao hợp |
|---|---|---|
| Lốp trưởng | Người đứng đầu hàng chờ vai: lúc họ xếp hàng, lúc họ xông ra đòi lên, lúc tới lượt họ | Lốp trưởng là người chờ được lên thay. Hàng chờ đúng là vậy |
| Nếu em biến thành con gián | Biến cố thử lòng: cô dâu hỏi, chú rể phải trả lời | Trend vốn là câu thử lòng người yêu, hợp ngay trước lễ cưới |
| Dạ gỗ xà cừ | Chú rể đáp khi bố vợ hỏi lương | Câu dùng để né một câu hỏi khó |
| 67 (sáu bảy) | Bố vợ nhận món quà nhỏ: "Sáu bảy! Tạm được." Đồng hồ đếm ngược chạm 7, 6 giây thì vài vị khách hô | Nghĩa là tạm tạm. Ngoài đời cứ thấy hai số này là hô |
| Thua Gia Cát Lượng đúng cây quạt | MC khen người chờ đúng lúc mới tặng quà chen ngang, cướp vai | Câu khen người tính nước khéo |
| Cơm nước gì chưa người đẹp | MC chào khách mới vào. "Chồng con gì chưa người đẹp?" lúc tuyển cô dâu, mời cưới ké. Người yêu cũ nữ tới tính sổ: "Nợ nần gì chưa người đẹp?" | Câu bắt chuyện, hỏi thăm |
| Bốc trúng sít rịt | MC bốc thăm ghép đôi ngẫu nhiên | Đúng là một lần bốc, không biết trúng ai |
| Hướng nội hết phần đời còn lại | Người vừa bị hất văng, bị bố vợ đuổi, bị bắt quả tang lúc điện về | Câu nói khi vừa bị bẽ mặt trước đám đông |
| Thực dân Zalo | Một chỗ duy nhất: tấm thiệp hoa hồng lấp lánh bố vợ gửi khi gật đầu | Đúng kiểu thiệp các bố hay gửi |

**Sửa câu MC:** bảng điều khiển, tab "Lời thoại MC", mục "Biến cố & vai phụ". Lưu là dùng ngay, không cần tắt bật.

**Có trend mới muốn đưa vào:** nói cho tôi trend đó. Tôi tìm cảnh hợp trong kịch bản trước rồi mới viết câu, không có cảnh hợp thì tôi sẽ nói rõ.

Chữ hiện trên màn hình LIVE (chữ mở màn, câu trong bong bóng, tên vai người hùng) nằm trong code. Cần đổi thì bảo tôi sửa.

## Sửa lỗi nhanh

Kết quả bị lỗi thì thêm câu tương ứng vào cuối prompt rồi tạo lại.

## Đặt tên và gắn vào app

Giữ đúng tên như trên thẻ. Ảnh nhân vật để PNG, hội trường tối để JPG, video để MP4.

DamCuoiV1/ └── bo-hinh-moi/ ├── bc_ex_m.png, bc_ex_m.mp4 người yêu cũ nam, tài xế công nghệ (nền xanh dương) ├── bc_ex_f.png, bc_ex_f.mp4 người yêu cũ nữ ├── bc_bovo_angry.png, .mp4 bố vợ áo ba lỗ quần đùi, đang khó chịu ├── bc_bovo_happy.png, .mp4 bố vợ gật đầu, cắn thử vàng ├── bc_dark.jpg hội trường lúc cúp điện ├── bc_fx_shatter.mp4, bc_fx_goldrain.mp4 hiệu ứng nền xanh lá ├── bc_fx_lightning.mp4, bc_fx_shield.mp4 hiệu ứng nền đen ├── bc_baby_boy.png, bc_baby_girl.png em bé trai, em bé gái lúc cửa phòng tân hôn mở lại ├── bc_uncle.png, bc_uncle.mp4 ông chú giành mic lúc cụng ly ├── bc_kid.png, bc_kid.mp4 Bé Tí quẹt sập bánh cưới ├── bc_friends.png, bc_friends.mp4 hội bạn thân chặn cửa phòng tân hôn ├── moon_trada.jpg, moon_santhuong.jpg, moon_hocau.jpg trăng mật gần nhà ├── moon_dalat.jpg, moon_phuquoc.jpg, moon_halong.jpg trăng mật trong nước ├── moon_maldives.jpg, moon_paris.jpg, moon_tokyo.jpg, moon_seoul.jpg trăng mật nước ngoài ├── checkin_.jpg (10 ảnh, cùng mã với moon_) tấm check-in: đôi trẻ nằm sẵn trong cảnh ├── couple_roach.png, couple_roach.mp4 cô dâu hóa gián └── couple_shock.mp4 cô dâu chú rể hết hồn LoạiTỷ lệKích thướcNền Nhân vật biến cố9:16 dọcTừ 1080 × 1920Xanh lá `#00FF00`. Riêng `bc_ex_m`: xanh dương `#0000FF` Video nhân vậtGiống ảnh khung đầu720p trở lên, 5 giây, lặpPhẳng, cùng màu nền với ảnh khung đầu, máy quay đứng yên Hội trường tối9:16 dọcLý tưởng 1080 × 1920Đủ cảnh, không người Hiệu ứng tràn màn hình9:16 dọc720p trở lên, 3 đến 5 giây, chạy 1 lầnĐen hoặc xanh lá, ghi trên từng thẻ Tấm check-in trăng mật9:16 dọcTừ 1080 × 1920Chính là ảnh điểm đến, có thêm đôi trẻ ở nửa dưới Điểm đến trăng mật9:16 dọcTừ 1080 × 1920Đủ cảnh, không người, không chữ Hội bạn thân (ba người)1:1 vuôngTừ 1024 × 1024Xanh lá phẳng, cả ba quay về bên trái Em bé1:1 vuôngTừ 1024 × 1024Xanh lá phẳng, em bé nhìn thẳng Cô dâu hóa gián, cô dâu chú rể hết hồn1:1 vuôngGiống `couple_idle`Xanh lá phẳng Sau khi chạy lệnh, tắt và bật lại server để màn hình LIVE nạp hình mới. Muốn xem ngay thì vào bảng điều khiển, bấm một trong năm nút "Biến cố" ở khung nút bấm nhanh.

# Prompt từng file

## Nhân vật (làm đầu tiên)

Bốn ảnh này thay cho hình khách đang được mượn tạm. Người yêu cũ có hai bản nam và nữ vì app chọn theo nhân vật của người xem được gán vai (người đứng đầu hàng chờ xông ra thì cũng dùng hình này, chỉ khác tên gọi "lốp trưởng"). Bản nam mặc đồ xanh lá nên làm trên nền xanh dương, ba ảnh còn lại vẫn nền xanh lá.

### `bc_ex_m.png`

**Người yêu cũ nam: tài xế công nghệ áo xanh nón xanh, nhận đơn trà sữa giao tới đúng đám cưới người yêu cũ, vừa giao vừa khóc**

9:16 · nền xanh dương · Ưu tiên 1 · tải kèm: `guest_m1.png`

Chuyện của nhân vật: nhận đơn trà sữa, tới nơi mới biết là đám cưới người yêu cũ, khóc như mưa mà vẫn phải giao. Cần thấy rõ áo khoác và nón bảo hiểm xanh lá, thùng giao hàng sau lưng, ly trà sữa khổng lồ, một chân mất dép (chiếc dép bay vào màn hình lúc mở màn là của anh này). Áo, nón, thùng để trơn, không logo. Ảnh này làm trên nền XANH DƯƠNG, vì đồ xanh lá đặt trên nền xanh lá sẽ bị xóa mất. Hiện lúc "KHOAN ĐÃ!!!", thua thì bị hất văng khỏi màn hình.

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A scrawny Vietnamese man in his late 20s, the heartbroken ex-boyfriend, a ride-hailing motorbike delivery driver who just found out his order is for his ex's wedding: a bright emerald-green long-sleeved driver windbreaker with white reflective stripes, a matching emerald-green open-face motorbike helmet with no visor and the chin strap dangling, black trousers, one foot in a yellow plastic honeycomb sandal and the other foot bare, and a big square emerald-green insulated delivery box on his back like a backpack; the jacket, helmet and box are completely plain with no logo and no writing, ugly-crying with huge watery puppy eyes, thick streams of glossy white cartoon tears, a runny nose and a huge wobbly wailing mouth, one arm stretched toward the left side of the image offering a comically oversized cup of bubble tea filled to the brim with opaque beige milk tea and black tapioca pearls, sealed flat with a white film lid and a fat pink straw, the other hand clutching his jacket over his heart. Full body from head to toe with the feet visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, every prop fully inside the image. The body is turned three-quarters toward the LEFT side of the image and the eyes look to the left; the person fills about 85% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure blue background (#0000FF) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No blue color anywhere on the clothing or props, and nothing transparent. Vertical 9:16 image.
```

### `bc_ex_f.png`

**Người yêu cũ nữ: váy đỏ lộng lẫy nhưng còn nguyên lô cuốn tóc, dép bông thỏ, cầm máy tính và hóa đơn dài chấm đất tới tính sổ**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

Chuyện của nhân vật: tới không phải để khóc mà để tính sổ, vội tới mức sang chảnh nửa trên, ở nhà nửa dưới. Cần thấy rõ lô cuốn tóc hồng, dép bông thỏ, máy tính to, cuộn hóa đơn dài chồng dưới sàn. Trên màn hình cô sẽ nói "Nợ nần gì chưa người đẹp?".

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A glamorous Vietnamese woman in her mid 20s, the ex-girlfriend who storms into the wedding to collect everything she is owed: an elegant long-sleeved floor-length red satin gown, but her hair is still rolled up in big pink plastic curlers and she wears fluffy white bunny house slippers, as if she ran out of the house halfway through getting ready, glaring with one eyebrow raised sky-high and lips pursed in a smug pay-up-now pout, one hand holding up an oversized pink calculator, the other arm thrust toward the left side of the image gripping the end of a ridiculously long white paper receipt that unrolls all the way down and piles up on the floor; the receipt shows only plain grey lines with no readable writing. Full body from head to toe with the feet visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, every prop fully inside the image. The body is turned three-quarters toward the LEFT side of the image and the eyes look to the left; the person fills about 85% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Vertical 9:16 image.
```

### `bc_bovo_angry.png`

**Bố vợ khó tính: áo ba lỗ trắng, quần đùi kẻ sọc, dép tổ ong, khăn vắt vai, ngậm tăm, chĩa chổi lông gà dọa rể**

9:16 · Ưu tiên 1 · tải kèm: `guest_m1.png`

Chuyện của nhân vật: ông bố quốc dân đang ngủ trưa thì nghe có đứa tới hỏi cưới con gái, để nguyên bộ đồ ở nhà ra chặn cửa. Cần thấy rõ áo ba lỗ trắng căng bụng, quần đùi kẻ sọc kéo cao, dép tổ ong vàng, khăn mặt vắt vai, tăm xỉa răng, chổi lông gà, mặt cau có hết cỡ. Hiện lúc "THÁCH CƯỚI!".

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A grumpy Vietnamese father in his late 50s with a round pot belly, the bride's impossible-to-please dad who walked straight out of his afternoon nap in the everyday at-home clothes of a typical Vietnamese dad: a slightly stretched plain white sleeveless tank-top undershirt pulled tight over his belly, baggy blue-and-white striped knee-length shorts hitched up high, yellow plastic honeycomb sandals on bare feet, a small faded red-and-white checkered hand towel draped over one shoulder, thick caterpillar eyebrows, short messy salt-and-pepper hair, tiny reading glasses on the tip of his nose and a toothpick in the corner of his mouth, standing with his feet planted wide, one hand on his hip and the other hand thrusting a brown rooster-feather duster toward the left side of the image like a sword, squinting with one eye almost closed, nostrils flared and a comically huge frown. Full body from head to toe with the feet visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, every prop fully inside the image. The body is turned three-quarters toward the LEFT side of the image and the eyes look to the left; the person fills about 85% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Vertical 9:16 image.
```

### `bc_bovo_happy.png`

**Bố vợ gật đầu: vẫn áo ba lỗ quần đùi, nhảy lò cò, cắn thử thỏi vàng, ôm sổ đỏ vào lòng**

9:16 · Ưu tiên 1 · tải kèm: `bc_bovo_angry.png`

Chuyện của nhân vật: vừa nãy còn làm khó, thấy sính lễ đủ là đổi mặt ngay, phải cắn thử xem vàng thật không. Thay cho bản khó chịu lúc sính lễ đã đủ. Sổ đỏ để trơn, không có chữ.

```text
Use the attached image as the character reference and keep exactly the same person: same face, hairstyle, outfit and colors. The same grumpy father from the reference image in the same white tank top, striped shorts, shoulder towel and honeycomb sandals, now overjoyed, hopping on one leg in pure joy, biting a shiny gold bar with his teeth to test whether it is real, his eyes wide and sparkling with greed, hugging a plain red booklet tightly against his chest with the other arm, the feather duster stuck in the waistband of his shorts. Full body from head to toe with the feet visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, every prop fully inside the image. The body is turned three-quarters toward the LEFT side of the image and the eyes look to the left; the person fills about 85% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Vertical 9:16 image.
```

## Hội trường lúc cúp điện

Một ảnh thay cho lớp bóng tối app đang tự phủ. Dùng chế độ sửa ảnh (Image to Image) từ phông Hồng trắng để bố cục khớp tuyệt đối, vì phông này đang hiện lúc đủ đôi. Phần gây cười ở cảnh này do app lo: những đôi mắt chớp chớp trong bóng tối và một vị khách bị bắt quả tang lúc điện về.

### `bc_dark.jpg`

**Hội trường Hồng trắng mất điện: tối om, chỉ còn nến và dây đèn**

9:16 · Ưu tiên 1 · tải kèm: `bg_pink_white.jpg`

Sân khấu, vòm hoa, thảm đỏ phải nằm đúng chỗ cũ. Lệch chỗ thì cô dâu chú rể sẽ đứng sai vị trí khi đèn tắt.

```text
Use the attached image as the base and keep exactly the same hall, camera angle, composition, stage, flower arch, red carpet and tables; only change the lighting. The same wedding hall during a sudden power outage at night: every chandelier and ceiling light is off, the hall sits in deep blue-black darkness with cold moonlight falling from above, only a few candles on the stage and some tiny warm fairy lights still glow, long soft shadows, a spooky but playful mood. Completely empty hall: no people. No text, no letters, no signs. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. Vertical 9:16 image.
```

## Video nhân vật

Image to Video từ đúng ảnh nhân vật ở trên, đặt ảnh đó làm cả khung đầu lẫn khung cuối. Có video thì nhân vật diễn trò suốt lúc thử thách, không có thì app dùng ảnh tĩnh. Nền video giữ đúng màu nền của ảnh: người yêu cũ nam nền xanh dương, còn lại nền xanh lá. Động tác trong video là việc nhân vật đó đang làm trong câu chuyện, không chèn điệu nhảy hay cử chỉ ngoài lề.

### `bc_ex_m.mp4`

**Người yêu cũ nam khóc nấc, chìa ly trà sữa ra, tiếc quá hút luôn một ngụm rồi khóc to hơn**

5 giây · nền xanh dương · Ưu tiên 2 · khung đầu: `bc_ex_m.png` · lặp lại

Diễn đúng lúc cả rạp đang che chắn: anh vẫn cố giao cho xong đơn, buồn tới mức uống luôn ly trà sữa của khách. Nền phải giữ xanh dương suốt video.

```text
The driver sobs with his whole body shaking so the helmet wobbles and the delivery box bounces on his back, thrusts the giant bubble tea toward the left, then pulls it back and takes a long comforting slurp through the straw himself, throws his head back and wails even louder, then returns to the starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid blue (#0000FF) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `bc_ex_f.mp4`

**Người yêu cũ nữ bấm máy tính như điên, giũ cuộn hóa đơn, dậm dép sốt ruột, lô tóc nảy tưng tưng**

5 giây · Ưu tiên 2 · khung đầu: `bc_ex_f.png` · lặp lại

Diễn đúng lúc cả rạp đang che chắn: cô vẫn đứng đó cộng sổ, đòi cho bằng được.

```text
The woman punches the calculator buttons at lightning speed with her thumb, shakes the long receipt toward the left so it ripples all the way down to the floor, taps one bunny slipper impatiently and flicks her head so the hair curlers bounce, then returns to the starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `bc_bovo_angry.mp4`

**Bố vợ chọc chổi lông gà dọa rể, xốc quần, bụng nảy, dậm dép**

5 giây · Ưu tiên 2 · khung đầu: `bc_bovo_angry.png` · lặp lại

Diễn đúng lúc cả rạp đang "dạ bố" xin cưới: ông vẫn chưa nguôi, cứ lăm lăm cây chổi.

```text
The father jabs the feather duster toward the left twice like a fencing sword, huffs so his belly bounces under the tank top, hitches up his shorts with his free hand, rolls the toothpick from one corner of his mouth to the other and stamps one sandal, then returns to the starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `bc_bovo_happy.mp4`

**Bố vợ cắn vàng, cười tít mắt, nhảy lò cò ăn mừng, hôn sổ đỏ**

5 giây · Ưu tiên 2 · khung đầu: `bc_bovo_happy.png` · lặp lại

Diễn lúc sính lễ đã đủ. Ngay sau đó app bật tấm thiệp hoa hồng lấp lánh "bố vợ gửi".

```text
The father bites the gold bar, pulls it away and grins at it with sparkling eyes, does a happy little hop-dance from one foot to the other, kisses the red booklet, then returns to the starting pose. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

## Hiệu ứng tràn màn hình

Text to Video, 9:16, phát một lượt đè lên cả màn hình. Nền xanh lá dành cho vật thể đặc: app xóa nền như với nhân vật. Nền đen dành cho ánh sáng: app hòa sáng vào khung hình nên phần đen tự biến mất.

### `bc_fx_shatter.mp4`

**Chiếc dép tổ ong bay thẳng vào màn hình, dính bẹp làm nứt kính: lúc "KHOAN ĐÃ!!!"**

nền xanh lá · Ưu tiên 2 · phát một lượt

Miếng hài: dép bay huyền thoại. Mở màn lúc có người xông vào phản đối, cú đập nên rơi vào giây đầu tiên.

```text
A yellow plastic honeycomb sandal spins in from far away straight toward the camera, smacks flat against the lens within the first second and sticks there for a beat while bright white glass cracks spread out from the impact across the whole frame, then the sandal slowly slides down out of the bottom of the frame and the cracks fade away. Vertical 9:16 visual effects clip, 4 to 5 seconds, on a flat solid pure green background (#00FF00) with no gradient and no shadow. Static locked-off camera. The last frame is empty green. No text, no people. Nothing in the clip is green or transparent.
```

### `bc_fx_goldrain.mp4`

**Mưa sính lễ: vàng thỏi, đồng vàng, phong bì đỏ, sổ đỏ, và một con heo quay thắt nơ rơi ngang: lúc bố vợ gật đầu**

nền xanh lá · Ưu tiên 2 · phát một lượt

Miếng hài: giữa cơn mưa vàng có nguyên con heo quay lễ vật rơi xuống. Phong bì và sổ đỏ để trơn, không có chữ. Mọi thứ rơi hết khỏi khung trước khi video kết thúc.

```text
A heavy shower of shiny gold bars, gold coins, red lucky-money envelopes with gold trim and plain red booklets falls from the top of the frame to the bottom, spinning and sparkling; in the middle of the clip a whole glazed golden-brown roast piglet with a big red ribbon bow tumbles down through the shower and bounces out of the bottom of the frame; then the shower thins out until nothing is left. Vertical 9:16 visual effects clip, 4 to 5 seconds, on a flat solid pure green background (#00FF00) with no gradient and no shadow. Static locked-off camera. The last frame is empty green. No text, no people. Nothing in the clip is green or transparent.
```

### `bc_fx_lightning.mp4`

**Hai tia sét dữ dội rồi một tia lửa bé tí xịt khói: lúc cúp điện**

nền đen · Làm sau · phát một lượt

Miếng hài: hai cú sét hoành tráng, cú thứ ba xịt.

```text
Two violent forked lightning bolts in white and electric blue strike from the top edge down to the bottom edge one after the other, each with a blinding full-frame flash and crackling sparks; then a third tiny pathetic spark sputters in the middle of the frame and fizzles out with a small puff, followed by darkness. Vertical 9:16 visual effects clip, 3 to 4 seconds, on a pure black background (#000000) with no smoke haze, no floor and nothing other than the effect. Static locked-off camera. The first frame and the last frame are completely black. No text, no people.
```

### `bc_fx_shield.mp4`

**Găng đấm bốc trái tim gắn lò xo bật ra, rồi nổ thành mưa tim: lúc che chắn thành công**

nền đen · Làm sau · phát một lượt

Miếng hài: cả rạp che chắn đủ thì tình yêu đấm bay kẻ phá đám.

```text
A giant glowing pink heart-shaped boxing glove on a coiled spring shoots out from the center toward the camera with a bright impact flash, wobbles back and forth on its spring, then bursts into a ring of light and hundreds of small sparkling hearts that fly past the camera and fade. Vertical 9:16 visual effects clip, 3 to 4 seconds, on a pure black background (#000000) with no smoke haze, no floor and nothing other than the effect. Static locked-off camera. The first frame and the last frame are completely black. No text, no people.
```

## Nhân vật sự cố (tiệc mừng)

Ba nhân vật cho các sự cố trong tiệc mừng. Bố vợ chặn hôn dùng lại hình bố vợ đã có, chú rể quên nhẫn không cần hình. Cả ba đứng bên phải sân khấu nên quay về bên TRÁI ảnh, nền xanh lá. Chưa có hình thì app mượn hình một vị khách và che mặt bằng một biểu tượng.

### `bc_uncle.png`

**Ông chú giành mic: sơ mi bung cúc lòi áo ba lỗ, cà vạt buộc ngang trán, ôm micro có dây hát nhắm tịt mắt**

9:16 · Ưu tiên 1 · tải kèm: `bc_bovo_angry.png`

Đám cưới nào cũng có ông chú này: lên hát một bài rồi không chịu xuống. Cần thấy rõ: cà vạt đỏ buộc ngang trán như băng đô, sơ mi trắng bung cúc lòi áo ba lỗ, micro có dây quấn mấy vòng quanh tay, má đỏ hây hây, miệng há to ngân nốt cao, một tay giơ lên trời. Không cầm ly rượu, bia. Hiện lúc sắp cụng ly.

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A stocky Vietnamese uncle in his 50s who has taken over the wedding karaoke and refuses to stop singing: thinning hair, a round face with rosy cheeks, a white dress shirt half unbuttoned over a white tank top with the sleeves rolled up, a red necktie tied around his forehead like a headband, grey trousers with the belt too high, and brown plastic sandals, singing his heart out with his eyes squeezed shut and his mouth wide open on a high note, clutching an old wired karaoke microphone in one hand with its cable wrapped several times around his forearm, the other arm thrown up toward the sky with the fingers spread, leaning back dramatically. Full body from head to toe with the feet visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, every prop fully inside the image. The body is turned three-quarters toward the LEFT side of the image and the eyes look to the left; the person fills about 85% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Vertical 9:16 image.
```

### `bc_kid.png`

**Bé Tí: nhóc năm tuổi mặt dính đầy kem, giấu nguyên tầng bánh cưới bị khoét sau lưng, liếc ngang giả vờ ngây thơ**

9:16 · Ưu tiên 1 · tải kèm: `bc_bovo_angry.png`

Thủ phạm làm sập bánh cưới. Cần thấy rõ: kem trắng dính quanh miệng, trên má và mười đầu ngón tay; má phồng vì đang nhai; một tay giấu sau lưng tầng bánh nhỏ bị khoét một lỗ to (vẫn lòi ra hai bên); mắt liếc ngang, huýt sáo giả vờ. Hiện lúc sắp cắt bánh.

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A chubby five-year-old Vietnamese boy, a little wedding guest caught red-handed: a bowl haircut, big round cheeks puffed out because his mouth is full, thick white whipped cream smeared around his mouth, on his nose, on both cheeks and all over his fingers, wearing a white short-sleeved shirt with red suspenders, navy shorts and one white sock half pulled down, pretending to be innocent, eyes glancing sideways and lips pursed as if whistling, one creamy hand raised in a tiny wave while the other hand hides a small round tier of white wedding cake behind his back; the cake is too big to hide, sticks out on both sides and has a huge finger-scooped hole in it. Full body from head to toe with the feet visible and a little empty space above the head and below the feet, centered, standing on an invisible floor, every prop fully inside the image. The body is turned three-quarters toward the LEFT side of the image and the eyes look to the left; the person fills about 85% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Vertical 9:16 image.
```

### `bc_friends.png`

**Hội bạn thân chặn cửa: ba người đứng dàn hàng, một anh chìa tay đòi lì xì, một chị cầm loa tay, một anh đeo kính râm khoanh tay làm bảo vệ**

1:1 · Ưu tiên 1 · tải kèm: `guest_m1.png`

Tục vui ở đám cưới: bạn thân chặn cửa phòng tân hôn đòi lì xì mới cho vào. Ba người phải đứng sát nhau thành một khối, cùng quay về bên TRÁI. Cần thấy rõ: bàn tay chìa ra ngửa lên đòi lì xì, chiếc loa tay màu đỏ, kính râm và tư thế khoanh tay của "bảo vệ". Ảnh vuông 1:1. Hiện cuối tiệc mừng, lúc đôi trẻ sắp vào phòng.

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. Three cheeky Vietnamese friends in their 20s standing shoulder to shoulder in a tight row like nightclub bouncers, blocking the way: on the left a grinning young man in a white shirt and a maroon vest stretching one hand forward with the palm up, rubbing his fingers together to ask for lucky money; in the middle a laughing young woman in a pink ao dai shouting into a small red handheld megaphone; on the right a big guy in a black suit and dark sunglasses with his arms crossed and a stone-serious face. All three bodies are turned three-quarters toward the LEFT side of the image and they look to the left. Full bodies from head to toe with the feet visible, standing on an invisible floor, the group centered and filling about 85% of the image height, with a little empty space on all sides. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous faces that do not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, nobody else in the image. No green color anywhere on the clothing or props, and nothing transparent. Square 1:1 image.
```

### `bc_uncle.mp4`

**Ông chú hát say sưa: lắc lư, ngân nốt cao, vuốt nước mắt vì bài hát buồn quá, rồi hát tiếp**

5 giây · Ưu tiên 2 · khung đầu: `bc_uncle.png` · lặp lại

Chạy suốt lúc cả rạp gõ "xuống đi chú". Chú không được bước ra khỏi chỗ đứng.

```text
The uncle sways from side to side while singing passionately into the wired microphone, throws his free arm up and holds a long high note with his eyes shut, wipes a tear from his cheek with the back of his hand because the song is so sad, then takes a deep breath and returns to the starting pose to keep singing. Keep exactly the same man as the first frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `bc_kid.mp4`

**Bé Tí lén liếm kem trên ngón tay, giật mình vì bị nhìn, giấu vội ra sau lưng rồi huýt sáo**

5 giây · Ưu tiên 2 · khung đầu: `bc_kid.png` · lặp lại

Chạy suốt lúc cả rạp dựng lại bánh. Miếng hài: càng giấu càng lộ.

```text
The little boy sneaks a lick of cream off one finger, freezes with wide eyes as if someone caught him, quickly hides the hand and the cake behind his back again, puffs his cheeks, looks up at the sky and whistles innocently while rocking on his heels, then returns to the starting pose. Keep exactly the same boy as the first frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `bc_friends.mp4`

**Hội bạn thân: anh áo ghi lê ngoắc tay đòi lì xì, chị cầm loa lắc đầu, anh kính râm khoanh tay gật gù**

5 giây · Ưu tiên 2 · khung đầu: `bc_friends.png` · lặp lại

Chạy suốt lúc cả rạp gõ "mở cửa". Cả ba đứng nguyên chỗ, không ai bước ra khỏi hàng.

```text
The man in the vest beckons with his open palm and rubs his fingers together asking for lucky money; the woman shakes her head with a teasing laugh and shouts into the megaphone; the big guy in sunglasses keeps his arms crossed, slowly shakes his head and then nods; all three return to the starting pose. Nobody leaves the row. Keep exactly the same three people as the first frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

## Tuần trăng mật (điểm đến)

Mười ảnh nền cho ba nấc vé (gần nhà và trong nước mỗi nấc ba điểm, nước ngoài bốn điểm) để các lượt không trùng nhau. App ghép đôi trẻ lên phía trước và đặt bảng vé ở nửa trên, nên ảnh nền không cần người. Mười tấm check-in ở nửa sau của mục là bước hai: đưa cho công cụ hai ảnh tham chiếu (ảnh điểm đến vừa tạo và ảnh couple_idle) để đôi trẻ ngồi, đứng ngay trong cảnh, mặc đồ của nơi đó. Có tấm check-in thì app dùng nó thay cho ảnh nền ghép đôi trẻ đứng phía trước. Ba chỗ "gần nhà" là miếng hài: trăng mật mà chỉ tới được đầu ngõ. Chưa có ảnh nào thì app vẽ tạm bằng màu nền và một biểu tượng. Làm tới đâu dùng tới đó.

### `moon_trada.jpg`

**Gần nhà: quán trà đá vỉa hè, ghế nhựa thấp, ấm trà, đĩa hướng dương, xe máy dựng bên cạnh**

9:16 · Ưu tiên 1

Miếng hài: tuần trăng mật ở quán trà đá đầu ngõ. Cần nhận ra ngay vỉa hè Việt Nam: ghế nhựa đỏ thấp, bàn nhựa, cốc trà đá, bức tường vàng cũ, dây điện chằng chịt. Không có chữ trên biển hiệu.

```text
A humble Vietnamese sidewalk iced-tea stall in a narrow city alley in late afternoon: low red and blue plastic stools around a tiny plastic table with glasses of iced tea, an aluminium teapot, a plate of sunflower seeds, an old motorbike parked against a faded yellow wall, tangled power cables overhead, a string of small light bulbs, potted plants on the pavement, warm nostalgic golden light. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_santhuong.jpg`

**Gần nhà: sân thượng nhà ống, dây phơi đồ, bồn nước inox, hai ly nước mía trên bàn nhựa, hoàng hôn trên mái nhà**

9:16 · Ưu tiên 1

Miếng hài: "view triệu đô" là dây phơi quần áo và bồn nước inox. Cố tình bày một góc lãng mạn vụng về: bàn nhựa, hai cái ghế, dây đèn nháy.

```text
The rooftop terrace of a narrow Vietnamese townhouse at sunset: a clothesline with colorful laundry flapping in the wind, a big shiny stainless-steel water tank on a stand, potted plants in old paint buckets, a clumsy romantic corner with a small plastic table, two plastic chairs, two tall glasses of sugarcane juice and a string of fairy lights, and a sea of tightly packed city rooftops and antennas under an orange sky. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_hocau.jpg`

**Gần nhà: hồ câu cá cuối xóm, chòi lá, ghế nhựa, cần câu cắm sẵn, bèo trôi**

9:16 · Ưu tiên 2

Miếng hài: lãng mạn bên hồ, muỗi đốt là chính. Hồ câu dịch vụ kiểu Việt: chòi lá, ghế nhựa, xô nhựa, cần câu.

```text
A small village fishing pond in Vietnam on a quiet afternoon: a thatched bamboo hut on stilts at the water edge, plastic chairs, fishing rods propped on forked sticks, a red plastic bucket, floating water hyacinth, banana trees and coconut palms around the muddy bank, a wooden plank walkway, soft hazy sunlight. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_dalat.jpg`

**Trong nước: Đà Lạt, đồi thông săn mây lúc bình minh, hoa cẩm tú cầu**

9:16 · Ưu tiên 1

Nấc giữa: cả rạp thả tim đủ, hoặc có một món quà. Cần ra chất Đà Lạt: rừng thông, biển mây, hoa.

```text
A cloud-hunting viewpoint in the pine hills of Da Lat, Vietnam at sunrise: a wooden viewing deck on a hillside, tall pine trees on both sides, a sea of soft white clouds filling the valley below, blue and pink hydrangea bushes in bloom, distant layered mountains, cool golden morning light and a little mist. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_phuquoc.jpg`

**Trong nước: Phú Quốc, bãi biển hoàng hôn, hàng dừa, xích đu, nước xanh ngọc**

9:16 · Ưu tiên 1

Bãi biển nhiệt đới lúc hoàng hôn, phần cát ở giữa để trống cho đôi trẻ đứng.

```text
A tropical beach on Phu Quoc island, Vietnam at sunset: fine pale sand, clear turquoise water with gentle waves, leaning coconut palms on both sides, a wooden swing hanging from a palm, a wooden fishing boat anchored offshore, a huge orange sun low over the sea and pink clouds. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_halong.jpg`

**Trong nước: vịnh Hạ Long, boong du thuyền gỗ giữa các đảo đá vôi**

9:16 · Ưu tiên 2

Nhìn từ boong du thuyền: sàn gỗ ở phần dưới để đôi trẻ đứng, đảo đá vôi hai bên.

```text
The open wooden sundeck of a luxury cruise junk in Ha Long Bay, Vietnam: polished teak floor in the foreground, rattan sun loungers and lanterns along the railing, tall limestone karst islands covered in dark vegetation rising from calm emerald water on both sides, a traditional junk boat with orange sails in the distance, soft late-afternoon light. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_maldives.jpg`

**Nước ngoài: Maldives, cầu gỗ dẫn ra dãy biệt thự mái lá trên mặt nước xanh ngọc**

9:16 · Ưu tiên 1

Nấc cao nhất: quà từ 30 xu. Phải nhìn là thấy sang: nước trong vắt, biệt thự trên mặt nước.

```text
A luxury resort in the Maldives at midday: a long wooden jetty in the foreground leading to a row of overwater villas with thatched roofs on both sides, crystal-clear turquoise lagoon so transparent the white sand shows through, a hammock net over the water, a few fluffy clouds in a deep blue sky, bright dazzling sunlight. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_paris.jpg`

**Nước ngoài: Paris, sân ngắm tháp Eiffel lúc hoàng hôn, đèn vàng**

9:16 · Ưu tiên 1

Tháp Eiffel đứng lệch một bên ở dải giữa ảnh để không bị bảng vé che hết.

```text
A romantic stone terrace in Paris at dusk with a view of the Eiffel Tower: the tower stands slightly off to the right in the middle distance, glowing with warm golden lights, classic Parisian buildings and trees along the left, old iron street lamps, a small round cafe table with two glasses and a rose, wet cobblestones reflecting the lights, a pink and violet sky. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_tokyo.jpg`

**Nước ngoài: Tokyo, con đường hoa anh đào lúc chạng vạng, tháp Tokyo lên đèn đỏ cam**

9:16 · Ưu tiên 1

Hoa anh đào hồng hai bên và tháp Tokyo đỏ cam là hai thứ ai nhìn cũng nhận ra. Tháp đứng lệch một bên ở dải giữa ảnh. Biển hiệu để trống, không chữ.

```text
A quiet paved street in Tokyo, Japan at dusk in cherry blossom season: rows of sakura trees in full pink bloom on both sides with petals drifting in the air, round paper lanterns glowing warm along the street, Tokyo Tower standing slightly off to the right in the middle distance and lit in bright orange-red, low traditional shopfronts with blank signboards, a deep blue and pink evening sky. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `moon_seoul.jpg`

**Nước ngoài: Seoul, sân ngắm cảnh núi Namsan, hàng rào đầy ổ khóa tình yêu, tháp Namsan và thành phố lên đèn**

9:16 · Ưu tiên 1

Điểm hẹn hò quen thuộc trong phim Hàn: móc khóa tình yêu trên núi Namsan. Cần thấy rõ hàng rào phủ kín ổ khóa nhiều màu hai bên, tháp Namsan lệch một bên, lá phong đỏ vàng.

```text
The hilltop viewing terrace on Namsan mountain in Seoul, South Korea at blue hour in autumn: railings and fences on both sides completely covered with thousands of small colorful love padlocks, N Seoul Tower standing slightly off to the left in the middle distance and glowing softly, red and golden maple trees, a wooden deck floor in the foreground, and the endless twinkling lights of the city skyline spreading out below. Vertical 9:16 wide establishing shot at eye level. The recognizable features of the place sit in the middle band of the image and on both sides; the lower middle is an open empty patch of ground or floor where two people could stand; the top third is mostly sky or plain background. Semi-realistic 3D render, cinematic lighting, rich detail, high-quality game environment art. No people, no animals, no text, no letters, no signs with writing, no logo, no watermark.
```

### `checkin_trada.jpg`

**Check-in quán trà đá: hai người ngồi ghế nhựa thấp, cụng ly trà đá, cắn hướng dương, mặc đồ ở nhà**

9:16 · Ưu tiên 1 · tải kèm: `moon_trada.jpg + couple_idle.png`

Miếng hài: trăng mật đầu ngõ mà mặt rạng rỡ như ở resort. Hai người phải ngồi hẳn lên hai chiếc ghế nhựa thấp có sẵn trong ảnh nền, đầu gối cao gần ngực. Cô dâu vẫn đội khăn voan.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple sits on the two low plastic stools at the tiny plastic table, knees up high, clinking tall glasses of iced tea with a pile of sunflower seed shells on the table. The groom wears a white tank top with his red rose boutonniere still pinned to it, striped boxer shorts and yellow plastic honeycomb sandals. The bride wears a matching two-piece floral pajama set in pink and white with plastic slippers and still has her white wedding veil on her head. Both grin proudly as if this were a five-star resort. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_santhuong.jpg`

**Check-in sân thượng: hai người ngồi ghế nhựa bên bàn nước mía, chụm đầu hút chung một ly, mặc đồ ở nhà**

9:16 · Ưu tiên 1 · tải kèm: `moon_santhuong.jpg + couple_idle.png`

Hai người ngồi vào đúng hai chiếc ghế nhựa ở góc "lãng mạn" trong ảnh nền. Dây phơi đồ và bồn nước inox vẫn phải thấy rõ phía sau.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple sits on the two plastic chairs at the small plastic table, leaning their heads together and sipping sugarcane juice through two straws from the same tall glass, the groom waving a woven bamboo hand fan. The groom wears a white tank top with his red rose boutonniere still pinned to it, striped boxer shorts and yellow plastic honeycomb sandals. The bride wears a matching two-piece floral pajama set in pink and white with plastic slippers and still has her white wedding veil on her head. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_hocau.jpg`

**Check-in hồ câu: hai người ngồi ghế nhựa bên mép hồ cầm cần câu, cô dâu câu được con cá bé tí, chú rể rối dây**

9:16 · Ưu tiên 2 · tải kèm: `moon_hocau.jpg + couple_idle.png`

Miếng hài: cô dâu khoe con cá bằng ngón tay, chú rể quấn dây câu đầy người. Hai người ngồi trên ghế nhựa có sẵn ở mép hồ.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple sits side by side on the plastic chairs at the edge of the pond, each holding a bamboo fishing rod. The bride proudly holds up a tiny fish no bigger than her finger; the groom is hopelessly tangled in his own fishing line. The groom wears a white tank top with his red rose boutonniere still pinned to it, striped boxer shorts and yellow plastic honeycomb sandals. The bride wears a matching two-piece floral pajama set in pink and white with plastic slippers and still has her white wedding veil on her head. The groom also wears a conical leaf hat. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_dalat.jpg`

**Check-in Đà Lạt: hai người đứng trên sàn gỗ săn mây, ôm nhau cho ấm, áo len, khăn choàng, mũ len quả bông**

9:16 · Ưu tiên 1 · tải kèm: `moon_dalat.jpg + couple_idle.png`

Hai người đứng trên sàn gỗ có sẵn, biển mây và đồi thông phía sau. Má và mũi đỏ vì lạnh, tay ôm ly sữa nóng bốc khói.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple stands on the wooden viewing deck, huddled together for warmth and each hugging a steaming paper cup with both hands. Both wear thick chunky knitted sweaters, oversized scarves wrapped several times around their necks and woolly beanies with big pompoms, with rosy cheeks and red noses from the cold. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_phuquoc.jpg`

**Check-in Phú Quốc: hai người ngồi chung chiếc xích đu gỗ dưới gốc dừa, chú rể đeo phao vịt vàng, cô dâu cầm trái dừa**

9:16 · Ưu tiên 1 · tải kèm: `moon_phuquoc.jpg + couple_idle.png`

Hai người ngồi lên đúng chiếc xích đu có sẵn trong ảnh nền, chân đung đưa trên cát.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple sits together on the wooden swing hanging from the palm tree, feet swinging above the sand; the bride sips from a brown coconut with a red paper straw and the groom makes a cool peace sign. The groom wears an open short-sleeved shirt with a loud red and yellow hibiscus print, navy swim shorts, big dark sunglasses and a bright yellow inflatable duck swim ring around his waist. The bride wears a flowing white maxi beach dress, a wide-brimmed straw sun hat and sunglasses. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_halong.jpg`

**Check-in Hạ Long: hai người nằm ghế tắm nắng trên boong du thuyền, kính râm, tay gối đầu**

9:16 · Ưu tiên 2 · tải kèm: `moon_halong.jpg + couple_idle.png`

Hai người nằm trên hai chiếc ghế tắm nắng bằng mây có sẵn trên boong, đảo đá vôi phía sau.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple lies back on the two rattan sun loungers on the deck with their hands behind their heads, looking completely relaxed and smug, each with a glass of orange juice with a paper umbrella on a small side table. The groom wears an open short-sleeved shirt with a loud red and yellow hibiscus print, navy swim shorts, big dark sunglasses and a bright yellow inflatable duck swim ring around his waist. The bride wears a flowing white maxi beach dress, a wide-brimmed straw sun hat and sunglasses. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_maldives.jpg`

**Check-in Maldives: hai người ngồi mép cầu gỗ thả chân xuống nước, cô dâu tựa vai chú rể, chú rể giơ gậy chụp ảnh**

9:16 · Ưu tiên 1 · tải kèm: `moon_maldives.jpg + couple_idle.png`

Hai người ngồi ở mép cầu gỗ có sẵn, bàn chân lơ lửng trên mặt nước xanh ngọc. Biệt thự trên mặt nước vẫn thấy rõ hai bên.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple sits on the edge of the wooden jetty with their bare feet dangling just above the turquoise water; the bride leans her head on the groom's shoulder and he holds a selfie stick with a phone up high. The groom wears an open short-sleeved shirt with a loud red and yellow hibiscus print, navy swim shorts, big dark sunglasses and a bright yellow inflatable duck swim ring around his waist. The bride wears a flowing white maxi beach dress, a wide-brimmed straw sun hat and sunglasses. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_paris.jpg`

**Check-in Paris: hai người ngồi bàn cà phê tròn trước tháp Eiffel, mũ nồi, áo sọc ngang, ổ bánh mì dài trên bàn**

9:16 · Ưu tiên 1 · tải kèm: `moon_paris.jpg + couple_idle.png`

Hai người ngồi vào chiếc bàn tròn có sẵn trong ảnh nền, tháp Eiffel lên đèn phía sau.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple sits at the small round cafe table, clinking two coffee cups, with a very long baguette lying across the table and a single red rose in a vase. The groom wears a black beret, a black and white horizontally striped long-sleeved shirt and a small red neck scarf, and twirls an imaginary moustache. The bride wears a red beret, a beige trench coat over a black dress and red lipstick, posing like a fashion model. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_tokyo.jpg`

**Check-in Tokyo: hai người đi dạo dưới chung một chiếc ô giấy đỏ giữa hoa anh đào, kimono, guốc gỗ**

9:16 · Ưu tiên 1 · tải kèm: `moon_tokyo.jpg + couple_idle.png`

Hai người đi giữa con đường hoa anh đào trong ảnh nền, tháp Tokyo phía sau. Chú rể cầm xiên bánh tròn ba màu.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple strolls down the middle of the street side by side under one red paper parasol held by the bride, cherry blossom petals falling around them. Both wear traditional Japanese kimono: the groom a navy blue men's kimono with a grey haori jacket, white tabi socks and wooden geta sandals, holding a skewer of three round rice dumplings in pink, white and brown and making a peace sign; the bride a soft pink kimono with a white cherry blossom pattern and a red obi sash, with flowers pinned in her hair. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

### `checkin_seoul.jpg`

**Check-in Seoul: hai người cùng móc ổ khóa hình trái tim lên hàng rào, hanbok, làm tim ngón tay**

9:16 · Ưu tiên 1 · tải kèm: `moon_seoul.jpg + couple_idle.png`

Hai người đứng sát hàng rào ổ khóa có sẵn trong ảnh nền, tháp Namsan phía sau. Cần thấy rõ ổ khóa trái tim đỏ và động tác tim ngón tay.

```text
Two images are attached: the first is the location, the second is the wedding couple. Put this couple into this location. The couple stands at the railing covered in love padlocks, together hanging a big red heart-shaped padlock on it with one hand each while making finger hearts with their other hands. Both wear traditional Korean hanbok: the groom a navy blue hanbok robe with a wide-brimmed black gat hat and a very serious face; the bride a white jeogori jacket, a long pink chima skirt and a red ribbon, smiling brightly. Keep exactly the same two people as in the couple reference image: the same faces, hairstyles and body proportions; only their clothes and poses change. Keep the location exactly as in the location reference image: the same place, objects, camera angle and lighting, with nothing moved or removed. The couple must look naturally part of the scene: correct scale and perspective, real contact with the seats and the ground, matching light and soft contact shadows. Composition: vertical 9:16; the couple is in the lower middle of the image, fully visible from head to toe, about 40% of the image height tall, with their heads below the vertical center of the image; the top 40% of the image shows only the scenery. Both look at the camera like a funny, charming honeymoon check-in photo. Same semi-realistic 3D art style as the reference images. No other people, no text, no letters, no logo, no watermark.
```

## Em bé (sau động phòng)

Hai ảnh cho màn "chín tháng mười ngày sau". Cửa phòng tân hôn mở lại, em bé hiện to phía trước đôi trẻ; sinh đôi thì hiện cả hai. Miếng hài chung: em bé là bản thu nhỏ của bố mẹ, mới đẻ mà đã ra dáng. Chưa có ảnh thì app tạm dùng biểu tượng em bé.

### `bc_baby_boy.png`

**Bé trai: bản sao tí hon của bố, đóng bỉm thắt nơ, xỏ đôi giày tây quá khổ, khoanh tay mặt nghiêm như tổng tài mà miệng ngậm ti giả**

1:1 · Ưu tiên 1 · tải kèm: `couple_idle.png`

Hiện khi có người tặng món quà "bé trai", MC đọc "bé trai giống bố như đúc". Cần thấy rõ: bỉm trắng, nơ đen trên cổ trần, đôi giày tây đen to gấp mấy lần bàn chân, tóc rẽ ngôi như người lớn, mặt nghiêm, ti giả đỏ. Ảnh hiện khá nhỏ trên màn hình nên em bé phải mập, hình khối to, rõ.

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A very chubby Vietnamese baby boy about eight months old, a tiny copy of his groom father: neat side-parted dark hair combed like a grown-up businessman, big round cheeks, wearing only a puffy white diaper and a black bow tie around his bare neck, with his tiny feet stuck inside a pair of shiny black men's dress shoes that are far too big for him, arms crossed over his round belly with a dead-serious bossy frown and one raised eyebrow like a little company chairman, while sucking on a bright red pacifier. Full body, sitting upright on an invisible floor and facing the viewer straight on, centered, with the whole baby and every prop inside the image and a little empty space on all sides; the baby fills about 80% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Square 1:1 image.
```

### `bc_baby_girl.png`

**Bé gái: bản sao tí hon của mẹ, đóng bỉm đội khăn voan, đeo chuỗi ngọc trai dài tới bụng, ôm bình sữa như ôm hoa cưới, nháy mắt hôn gió**

1:1 · Ưu tiên 1 · tải kèm: `couple_idle.png`

Hiện khi có người tặng món quà "bé gái", MC đọc "bé gái xinh như mẹ". Cần thấy rõ: bỉm trắng, khăn voan ngắn màu trắng đục (không trong suốt), kẹp hoa trắng, chuỗi ngọc trai quá khổ, bình sữa đầy sữa trắng, một mắt nháy, miệng cười chưa có răng.

```text
Use the attached image only as a reference for art style, lighting and proportions; the person in this image is different. A very chubby Vietnamese baby girl about eight months old, a tiny copy of her bride mother: a little tuft of dark hair tied up with a big white flower hair clip and a short opaque white bridal veil, big round rosy cheeks, wearing a puffy white diaper and a white pearl necklace that is far too big and hangs down to her belly, hugging a baby bottle completely filled with opaque white milk in both hands like a wedding bouquet, winking one eye and puckering her lips to blow a kiss, posing like a tiny beauty queen. Full body, sitting upright on an invisible floor and facing the viewer straight on, centered, with the whole baby and every prop inside the image and a little empty space on all sides; the baby fills about 80% of the image height. Semi-realistic 3D render of a Vietnamese person in the same art style as the rest of the set, natural human proportions, with hilariously exaggerated comedic acting like a frame from a viral comedy sketch: a rubbery over-the-top facial expression, a big readable silhouette and oversized props, bright even studio lighting, detailed fabrics, crisp clean edges, high-quality game character art. The image must make people laugh at first glance. Isolated on a flat solid pure green background (#00FF00) that fills the whole image evenly, with no gradient, no floor, no shadow and no checkerboard pattern. Ordinary non-famous face that does not resemble any real person. Anatomically correct hands. Family-friendly and tasteful. No text, no letters, no logo, no watermark, no other people. No green color anywhere on the clothing or props, and nothing transparent. Square 1:1 image.
```

## Cô dâu chú rể

Ba file cho cặp đôi, đều làm từ ảnh cặp đôi đứng nắm tay đang dùng để lúc chuyển qua lại không bị nhảy hình. Xong file nào thì chạy lệnh xử lý nhóm cô dâu chú rể ở cuối trang.

### `couple_roach.png`

**Cô dâu hóa gián: "nếu em biến thành con gián, anh còn yêu em không?"**

1:1 · Ưu tiên 1 · tải kèm: `couple_idle.png`

Trend: "nếu em biến thành con gián". Sửa ảnh (Image to Image) từ couple_idle: chú rể giữ nguyên, cô dâu thành một bạn gián mascot vẫn đội khăn voan, ôm hoa cưới. Gián phải tròn trịa, mắt to long lanh, đáng yêu chứ không ghê. Chưa có ảnh này thì app tạm phủ một con gián lên chỗ cô dâu đứng.

```text
Edit the attached image of the wedding couple. Replace only the bride with a human-sized cute cartoon cockroach mascot standing in exactly the same spot and at the same height: a round glossy caramel-brown body, big sparkling puppy eyes with long eyelashes, rosy cheeks, two long curly antennae and tiny arms, wearing the bride's white veil and holding the same wedding bouquet, looking up at the groom with a hopeful pleading smile. The groom stays exactly the same person in the same suit and position, but leans slightly away and stares at her with wide startled eyes and an awkward frozen smile. Adorable, friendly and funny, not realistic and not scary. Keep the same square framing, the same full-body size and position of the two figures, the same art style and the same flat solid pure green background (#00FF00) with no floor and no shadow. No text, no watermark, no other people. Nothing on the mascot is green or transparent.
```

### `couple_roach.mp4`

**Bạn gián chớp mắt xin yêu, chú rể giật mình rồi rụt rè vỗ đầu gián**

5 giây · Ưu tiên 2 · khung đầu: `couple_roach.png` · lặp lại

Chạy suốt lúc cả rạp gõ "yêu". Kết cục (gián biến lại thành cô dâu, hoặc chú rể bỏ chạy) do app diễn.

```text
The cute cockroach mascot blinks her big sparkling eyes, wiggles her antennae and clasps her tiny hands together pleadingly toward the groom; the groom flinches and leans back, glances left and right for help, then gingerly pats her on the head with one finger and forces a nervous smile; they return to the starting pose. Keep exactly the same groom and the same cockroach mascot as the first frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

### `couple_shock.mp4`

**Chú rể hét lên, nhảy phắt vào tay cô dâu, cô dâu bế chú rể tỉnh bơ**

5 giây · Làm sau · khung đầu: `couple_idle.png` · lặp lại

Miếng hài: đảo vai, cô dâu bế chú rể kiểu công chúa. Nhân vật của biến cố đứng bên phải sân khấu nên cả hai trợn mắt nhìn về bên PHẢI ảnh.

```text
The groom yelps in fright and leaps up into the bride's arms; she catches him and holds him bridal-style without any effort while both of them stare toward the RIGHT side of the frame with bulging eyes and wide open mouths; after a beat she sets him back down and they return to the starting pose. Keep exactly the same groom and bride as the first frame. Static locked-off camera: no zoom, no pan, no camera shake. The background stays one perfectly flat solid green (#00FF00) for the whole clip. The character stays centered at the same size and position, full body always in frame. Comedic timing with snappy exaggerated motion. No text, no subtitles, no new people. Seamless loop: the final frame returns exactly to the starting pose of the first frame.
```

## Sửa lỗi nhanh: thêm câu này vào cuối prompt

| Hình bị gì | Thêm vào prompt |
|---|---|
| Chưa buồn cười, mặt còn nghiêm | Make it much funnier: push the facial expression into full caricature with bulging eyes, a huge open mouth and exaggerated eyebrows, and make the silly props bigger and impossible to miss. |
| Thiếu đạo cụ của miếng hài | The image must clearly show every prop and clothing detail listed in the description; none of them may be missing or hidden. |
| Nhân vật quay sang phải | Mirror the pose: the body, the face and the pointing arm must all be directed toward the LEFT side of the image. |
| Bị cắt mất chân, đỉnh đầu hoặc đạo cụ | Zoom out so the whole body and every prop fit inside the image, with empty space above the head and below the feet. |
| Áo, nón, thùng hàng của tài xế có logo hoặc chữ | The jacket, the helmet and the delivery box are completely plain solid green: remove every logo, letter, number and symbol. |
| Người yêu cũ nam: ly trà sữa trong suốt, lộ nền | The cup is completely filled with opaque beige milk tea and sealed with a flat white lid, so nothing shows through it. |
| Người yêu cũ nam: nền chưa phải xanh dương phẳng | The background must be one flat solid pure blue color (#0000FF) everywhere, with no floor, no shadow, no gradient and no vignette. |
| Người yêu cũ nam: có màu xanh dương trên người (quần jean, nước mắt xanh) | Nothing on the character or the props is blue: the trousers are black and the tears are glossy white. |
| Bố vợ xuề xòa quá, muốn kín đáo hơn | He also wears a faded short-sleeved checkered shirt, unbuttoned and hanging open, over the white tank top. |
| Con gián trông ghê, giống gián thật | The cockroach is a cute, round, friendly cartoon mascot with big sparkling eyes and rosy cheeks. It is not realistic, not hairy and not scary. |
| Cô dâu hóa gián: chú rể bị đổi thành người khác | Keep the groom exactly identical to the attached image: same face, hair, suit, size and position. |
| Tấm check-in: cô dâu chú rể ra người khác | Keep both faces, hairstyles and body proportions exactly identical to the couple reference image. Only the clothes and poses change. |
| Tấm check-in: cảnh bị đổi so với ảnh nền | Do not change the location: keep every object, the camera angle and the lighting exactly as in the location reference image. |
| Tấm check-in: hai người trông như dán lên, lơ lửng | Make the couple truly part of the scene: they sit firmly on the seats and touch the ground, at the correct scale and perspective, with matching light and soft contact shadows. |
| Tấm check-in: hai người đứng cao quá, đầu chạm nửa trên ảnh | Move the couple lower and make them smaller: they stay in the lower middle of the image, about 40% of the image height tall, and the top 40% of the image shows only the scenery. |
| Điểm đến trăng mật: có người, có chữ trên biển hiệu | Remove every person and every piece of writing: the scene is empty of people, and all signs and boards are blank. |
| Điểm đến trăng mật: phần giữa phía dưới bị đồ vật chiếm chỗ | Clear the lower middle of the image: it must be an open empty patch of ground or floor, with the furniture and objects pushed to the left and right sides. |
| Ông chú cầm ly bia, ly rượu | He holds nothing except the microphone: remove any glass, bottle or drink. |
| Hội bạn thân: ba người đứng rời nhau hoặc quay ba hướng | The three friends stand tightly shoulder to shoulder as one compact group, and all three are turned toward the LEFT side of the image. |
| Em bé trông già, giống người lớn thu nhỏ | Baby proportions: a big round head, chubby cheeks, short chubby arms and legs and a round belly, clearly an eight-month-old baby. |
| Em bé: khăn voan hoặc bình sữa trong suốt, lộ nền | The veil is thick opaque white fabric and the bottle is completely filled with opaque white milk, so the background never shows through. |
| Không cùng phong cách với bộ hình | Match the attached reference exactly in rendering style, level of detail, lighting and body proportions. |
| Bố vợ bản cười ra người khác | Keep the face, glasses, hair, belly and outfit exactly identical to the attached reference image; only change the expression and the pose. |
| Ảnh nền xanh lá: nền có sàn, bóng hoặc chuyển màu | The background must be one flat solid pure green color (#00FF00) everywhere, with no floor, no shadow, no gradient and no vignette. |
| Ảnh nền xanh lá: quần áo hoặc đạo cụ có màu xanh lá | Recolor every green part of the outfit and props to red, yellow, navy or brown. |
| Có chữ trên hóa đơn, sổ đỏ, phong bì | Remove all writing: the receipt, the booklet and the envelopes are plain with no text, no letters and no symbols. |
| Hội trường tối bị đổi bố cục | Do not move, add or remove anything: same camera, same stage, same arch, same carpet and tables as the attached image. Only the lighting changes. |
| Hiệu ứng nền đen bị xám, có khói | The background is pure black (#000000) in every frame, with no fog, no smoke, no glow haze and no gradient. |
| Hiệu ứng còn sót lại ở cuối video | The effect is completely gone before the clip ends: the last frame shows only the empty background. |
| Video: máy quay tự di chuyển | Locked-off tripod shot. The camera never moves; the framing stays identical from the first frame to the last. |

## Lệnh xử lý hình

Xử lý mọi file biến cố (tên bắt đầu bằng bc_):

```bash
cd ~/Code/tiktok/DamCuoiV1 && node tools/xu-ly-bo-hinh.mjs --chi=bc
```

Khi có file couple_roach hoặc couple_shock: xử lý lại nhóm cô dâu chú rể:

```bash
cd ~/Code/tiktok/DamCuoiV1 && node tools/xu-ly-bo-hinh.mjs --chi=couple
```

Bật lại server để màn hình LIVE nạp hình mới (link tunnel giữ nguyên):

```bash
~/Code/tiktok/DamCuoiV1/BAT_DAU.sh tat server && ~/Code/tiktok/DamCuoiV1/BAT_DAU.sh
```

