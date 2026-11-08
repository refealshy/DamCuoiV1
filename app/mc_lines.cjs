// ========================================================
// LỜI THOẠI MC MẶC ĐỊNH
// Mỗi nhóm: nhiều câu, MC đọc luân phiên (không lặp lại câu vừa đọc).
// Biến trong {ngoặc nhọn} được tool tự điền khi có sự kiện.
// Sửa trong bảng điều khiển: tab "Lời thoại MC" (lưu vào wedding_state.json).
// ========================================================

const MC_GROUPS = [
  // ---------------- DẪN CHƯƠNG TRÌNH ----------------
  {
    section: 'Dẫn chương trình',
    key: 'welcome',
    label: 'Chào khách mới vào phòng',
    vars: '{names}',
    lines: [
      'Xin chào {names}! Mời vào hôn trường, kiếm chỗ ngồi đẹp rồi cùng chung vui với cô dâu chú rể nhé!',
      'Hôn trường vừa đón thêm {names}. Chào mừng các bạn, cứ tự nhiên ăn cỗ, thả tim và chúc phúc nha!',
      'Chào {names}! Đến đúng lúc lắm, tiệc đang vui, gõ dzô một cái để cả hôn trường cùng cụng ly nào!',
      'Ơ kìa, {names} đã tới! Mời vào bàn, hôm nay ai muốn lên sân khấu làm cô dâu chú rể thì giơ tay nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'intro',
    label: 'Giới thiệu cách chơi & quà (MC tự nói khi vắng)',
    vars: '{groom} {bride} {min} {gifts}',
    lines: [
      'Kính thưa quý vị quan khách, chào mừng đến với tiệc cưới online! Bình luận để vào dự tiệc, tặng quà từ {min} xu để lên sân khấu làm cô dâu hoặc chú rể nhé!',
      'Luật chơi rất đơn giản: tặng {gifts}. Còn muốn lên sân khấu thì tặng từ {min} xu, ai tặng nhiều hơn sẽ cướp được vai!',
      'Bà con nhớ nha: gõ dzô để cụng ly, gõ nhảy để cả hôn trường quẩy, gõ hôn đi để cô dâu chú rể trao nụ hôn ngọt ngào!',
      'Muốn làm cô dâu thì bình luận làm cô dâu rồi tặng quà, muốn làm chú rể thì cứ tặng từ {min} xu. Đủ đôi là MC tổ chức lễ thành hôn ngay!',
      'Cảm ơn cả nhà đã ghé tiệc cưới của {groom} và {bride}! Thả tim, bình luận và tặng quà để hôn trường thêm rộn ràng nhé!',
      'Sân khấu đang chờ những cặp đôi mới! Tặng quà để giành vai, đủ đôi là có trao nhẫn, cắt bánh và động phòng hoa chúc luôn!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'waitGroom',
    label: 'Chờ chú rể (vai chú rể đang trống)',
    vars: '{bride} {min}',
    lines: [
      'Ghế chú rể vẫn đang trống bà con ơi! Ai tặng từ {min} xu sẽ được đứng cạnh cô dâu {bride} ngay và luôn!',
      'Cô dâu {bride} chờ nãy giờ rồi đó nha. Các anh mạnh dạn lên, tặng {min} xu là có vé lên xe hoa!',
      'MC đang tuyển chú rể gấp! Điều kiện duy nhất: tặng từ {min} xu. Ai nhanh tay người đó được rước dâu!',
      'Hoa cưới đã cắm, nhẫn cưới đã có, chỉ thiếu mỗi chú rể thôi. Tặng {min} xu để nhận vai nào!',
      'Anh nào đang độc thân thì đây là cơ hội vàng: tặng {min} xu là thành chú rể của cô dâu {bride}!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'waitBride',
    label: 'Chờ cô dâu (vai cô dâu đang trống)',
    vars: '{groom} {min}',
    lines: [
      'Chú rể {groom} đứng một mình trông tội quá! Bạn nào bình luận làm cô dâu rồi tặng {min} xu là được lên sân khấu nha!',
      'Vai cô dâu đang trống đó cả nhà ơi! Gõ làm cô dâu, tặng {min} xu, váy cưới đã chuẩn bị sẵn rồi!',
      'Chú rể {groom} đã sẵn sàng, chỉ chờ một nàng dâu xinh đẹp. Ai muốn nhận vai thì bình luận làm cô dâu và tặng quà nhé!',
      'Tuyển cô dâu gấp! Bình luận làm cô dâu và tặng từ {min} xu, MC hứa tổ chức đám cưới linh đình!',
      'Chú rể {groom} cầm hoa đứng chờ nãy giờ rồi, cô dâu ơi em ở đâu? Gõ làm cô dâu rồi tặng quà để lên xe hoa nào!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'challenge',
    label: 'Khích cướp vai (đã đủ đôi, chưa làm lễ)',
    vars: '{groom} {bride} {groomBid} {brideBid}',
    lines: [
      'Chú rể {groom} đang giữ ngôi với {groomBid} xu, cô dâu {bride} với {brideBid} xu. Ai muốn cướp vai thì tặng nhiều hơn nhé!',
      'Cặp đôi {groom} và {bride} đẹp đôi quá! Nhưng chưa làm lễ thì vẫn còn cơ hội, ai tặng nhiều hơn là soán ngôi liền!',
      'Ghế chú rể đang có giá {groomBid} xu, ghế cô dâu {brideBid} xu. Có ai dám ra giá cao hơn không nào?'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'countdownStart',
    label: 'Đủ đôi — bắt đầu đếm ngược làm lễ',
    vars: '{groom} {bride} {seconds}',
    lines: [
      'Đủ đôi rồi bà con ơi! Chú rể {groom} và cô dâu {bride}, lễ thành hôn sẽ bắt đầu sau {seconds} giây. Ai muốn cướp vai thì nhanh tay lên!',
      'Tuyệt vời! {groom} và {bride} đã thành một cặp. Còn {seconds} giây nữa là làm lễ, tặng nhiều hơn để soán ngôi phút chót nhé!',
      'Cặp đôi đã lộ diện: {groom} và {bride}! Đồng hồ đếm ngược {seconds} giây bắt đầu, phút chót vẫn có thể đổi vai đó nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'countdownRemind',
    label: 'Nhắc giờ làm lễ (khi vắng, đang đếm ngược)',
    vars: '{groom} {bride} {seconds}',
    lines: [
      'Còn {seconds} giây nữa là {groom} và {bride} chính thức làm lễ. Ai muốn cướp vai thì đây là lúc!',
      'Đồng hồ đang chạy, còn {seconds} giây! Muốn thay chú rể hay cô dâu thì tặng nhiều hơn ngay nào!',
      '{seconds} giây nữa thôi! Bà con chuẩn bị chúc phúc cho {groom} và {bride} nhé!'
    ]
  },

  { section: 'Dẫn chương trình', key: 'share', label: 'Cảm ơn chia sẻ rạp cưới', vars: '{names}', lines: [
    'Cảm ơn {names} đã chia sẻ rạp cưới! Càng đông càng vui, mời thêm bạn bè vào chung vui nha!',
    '{names} vừa chia sẻ buổi tiệc, MC xin cảm ơn! Chúc các bạn sớm tìm được một nửa của mình!'
  ] },
  { section: 'Dẫn chương trình', key: 'follow', label: 'Cảm ơn theo dõi kênh', vars: '{names}', lines: [
    'Cảm ơn {names} đã theo dõi kênh! Chào mừng thành viên mới của đại gia đình!',
    '{names} vừa nhấn theo dõi, MC thương lắm! Nhớ ghé rạp cưới mỗi ngày nha!'
  ] },
  { section: 'Dẫn chương trình', key: 'likeGoal', label: 'Đủ tim — cả rạp đứng dậy quẩy', vars: '{likes}', lines: [
    'Cả rạp đã thả đủ {likes} tim! Cả rạp đứng dậy quẩy nào!',
    'Tim đã đầy rạp rồi bà con ơi! Nhạc lên, cả hôn trường cùng nhảy!'
  ] },

  // ---------------- VAI & ĐẤU GIÁ ----------------
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomTaken',
    label: 'Nhận vai chú rể (vai đang trống)',
    vars: '{name} {gift} {count} {bid} {bride}',
    lines: [
      'Chúc mừng {name} đã trở thành chú rể với {bid} xu! Cô dâu {bride} ơi, chú rể của em đây rồi!',
      'Hôn trường có chú rể rồi! Cảm ơn {name} đã mừng {count} {gift}, mời chú rể lên sân khấu!',
      'Đẹp trai, hào phóng, lại nhanh tay, {name} chính thức nhận vai chú rể! Xin một tràng pháo tay!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideTaken',
    label: 'Nhận vai cô dâu (vai đang trống)',
    vars: '{name} {gift} {count} {bid} {groom}',
    lines: [
      'Cô dâu xinh đẹp đã xuất hiện! Chúc mừng {name} nhận vai cô dâu với {bid} xu!',
      'Chú rể {groom} ơi, cô dâu {name} đã lên sân khấu rồi kìa! Cảm ơn {name} đã mừng {count} {gift}!',
      'Váy cưới đã có chủ! {name} chính thức trở thành cô dâu, cả hôn trường chúc mừng nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomStolen',
    label: 'Cướp ngôi chú rể',
    vars: '{name} {previous} {bid} {bride}',
    lines: [
      'Biến căng rồi bà con ơi! {name} vừa cướp ngôi chú rể từ tay {previous} với {bid} xu!',
      'Soán ngôi thành công! {previous} ơi, chú rể giờ là {name} rồi nha. Muốn lấy lại thì tặng nhiều hơn {bid} xu!',
      'Tin nóng hôn trường: {name} ra tay {bid} xu, chú rể {previous} mất vai trong một nốt nhạc!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideStolen',
    label: 'Cướp ngôi cô dâu',
    vars: '{name} {previous} {bid} {groom}',
    lines: [
      'Drama rồi bà con ơi! {name} vừa cướp vai cô dâu từ {previous} với {bid} xu!',
      'Cô dâu mới đã lên ngôi: {name}! {previous} ơi, tặng hơn {bid} xu để giành lại nhé!',
      'Chú rể {groom} ơi, cô dâu vừa đổi người rồi! Chúc mừng {name} với {bid} xu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'bidMissing',
    label: 'Đấu giá chưa đủ xu',
    vars: '{name} {role} {bid} {missing} {holder}',
    lines: [
      'Bạn {name} đang đấu giá {role} với {bid} xu, còn thiếu {missing} xu nữa để cướp ngôi từ {holder}! Tặng thêm đi nào!',
      'Suýt nữa rồi {name} ơi! Chỉ cần thêm {missing} xu là vai {role} thuộc về bạn!',
      '{holder} đang run rồi đó! {name} chỉ còn thiếu {missing} xu thôi!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'bidDefended',
    label: 'Người đang giữ vai tặng thêm (giữ ngôi)',
    vars: '{name} {role} {bid}',
    lines: [
      'Bạn {name} quyết giữ ngôi {role}, nâng giá lên {bid} xu! Ai dám cướp không nào?',
      'Không dễ đâu nha! {role} {name} vừa tăng giá lên {bid} xu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queued',
    label: 'Đặt cọc vai cho lượt sau (tặng trong lúc làm lễ)',
    vars: '{name} {role}',
    lines: [
      'Lễ đang diễn ra nên bạn {name} đã đặt cọc vai {role} cho lượt sau! Chờ chút nhé!',
      'Cảm ơn {name}! Vai {role} lượt sau MC ghi tên bạn rồi đó!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queuedApplied',
    label: 'Lượt mới: người đặt cọc nhận vai',
    vars: '{name} {role}',
    lines: [
      'Lượt mới bắt đầu! Bạn {name} đã đặt cọc nên chính thức nhận vai {role}!'
    ]
  },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'queueJoined', label: 'Hàng chờ: xếp hàng thành công', vars: '{name} {role} {position} {holder}', lines: [
    'Bạn {name} đã xếp hàng chờ làm {role}, đang ở vị trí số {position}! Lễ của {holder} xong là tới lượt bạn!',
    'Đã ghi tên {name} vào hàng chờ {role}, số thứ tự {position}. Muốn lên ngay thì tặng quà thay {role} nhé!'
  ] },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'queueAlready', label: 'Hàng chờ: nhắc lại chỗ đã giữ', vars: '{name} {role} {position}', lines: [
    '{name} ơi, bạn đã có chỗ trong hàng chờ {role} rồi, đang ở vị trí số {position} nha!'
  ] },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'queuePromoted', label: 'Hàng chờ: tới lượt lên sân khấu', vars: '{name} {role}', lines: [
    'Tới lượt rồi! Bạn {name} chính thức lên sân khấu làm {role}!',
    'Mời {name} bước lên sân khấu, vai {role} lượt này là của bạn!'
  ] },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'groomReplaced', label: 'Quà thay chú rể', vars: '{name} {previous} {bride}', lines: [
    'Thay chú rể! {name} vừa lên thay {previous}, đứng cạnh cô dâu {bride} ngay và luôn!',
    'Chú rể {previous} xin phép xuống sân khấu, chú rể mới là {name}!'
  ] },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'brideReplaced', label: 'Quà thay cô dâu', vars: '{name} {previous} {groom}', lines: [
    'Thay cô dâu! {name} vừa lên thay {previous}, chú rể {groom} ơi cô dâu mới tới rồi!',
    'Cô dâu {previous} nhường sân khấu, chào mừng cô dâu mới {name}!'
  ] },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'cancel', label: 'Hủy hôn, phá đám', vars: '{name} {groom} {bride}', lines: [
    'Ối dồi ôi! {name} vừa phá đám, đám cưới của {groom} và {bride} bị hủy rồi! Sân khấu mở cho cặp đôi mới!',
    'Biến lớn bà con ơi! {name} tặng quà phá đám, cô dâu chú rể bỏ chạy mất rồi!'
  ] },
  { section: 'Vai cô dâu – chú rể & đấu giá', key: 'cancelBlocked', label: 'Phá đám bị chặn (đang làm lễ)', vars: '{name}', lines: [
    '{name} định phá đám nhưng lễ đang diễn ra, bảo vệ đã chặn lại rồi nha!'
  ] },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rolesOpen',
    label: 'Mở lại vai (khi bấm nút trong bảng điều khiển)',
    vars: '{min}',
    lines: [
      'Vai cô dâu và chú rể đã mở lại! Ai muốn lên xe hoa thì tặng từ {min} xu ngay nào!'
    ]
  },

  // ---------------- LỄ THÀNH HÔN ----------------
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ceremonyStart',
    label: 'Mở đầu lễ thành hôn',
    vars: '{groom} {bride}',
    lines: [
      'Kính thưa quý vị quan khách! Lễ thành hôn của chú rể {groom} và cô dâu {bride} xin phép được bắt đầu!',
      'Giây phút thiêng liêng đã đến! Xin mời chú rể {groom} và cô dâu {bride} tiến vào lễ đường!'
    ]
  },
  { section: 'Lễ thành hôn & động phòng', key: 'quickwed', label: 'Quà "động phòng luôn" (bỏ qua các bước lễ)', vars: '{name} {groom} {bride}', lines: [
    'Chơi lớn! {name} tặng quà cho {groom} và {bride} vào động phòng luôn, khỏi chờ nữa!',
    'Không chờ được nữa rồi! Nhờ {name}, cô dâu {bride} và chú rể {groom} được đưa thẳng vào động phòng!'
  ] },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ring',
    label: 'Trao nhẫn',
    vars: '{groom} {bride}',
    lines: [
      'Mời cô dâu chú rể trao cho nhau nhẫn cưới, minh chứng cho tình yêu trăm năm!',
      'Chiếc nhẫn nhỏ, lời hứa lớn. Xin mời hai bạn trao nhẫn cưới!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'kiss',
    label: 'Hôn cô dâu',
    vars: '{groom} {bride}',
    lines: [
      'Và bây giờ, chú rể hãy hôn cô dâu đi nào!',
      'Cả hôn trường đếm nào: một, hai, ba, hôn đi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'cake',
    label: 'Cắt bánh cưới',
    vars: '{groom} {bride}',
    lines: [
      'Mời cô dâu chú rể cùng cắt bánh cưới, chúc cuộc sống luôn ngọt ngào!',
      'Bánh cưới thật xinh, xin mời đôi uyên ương cùng cắt bánh!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'champagne',
    label: 'Rót rượu sâm panh',
    vars: '{groom} {bride}',
    lines: [
      'Rót tràn tháp rượu, chúc mừng hạnh phúc!',
      'Sâm panh đã khui! Cả hôn trường nâng ly chúc mừng cô dâu chú rể nào!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'dongphong',
    label: 'Mời vào động phòng',
    vars: '{groom} {bride}',
    lines: [
      'Giờ lành đã điểm! Xin mời cô dâu {bride} và chú rể {groom} vào động phòng hoa chúc!',
      'Tiệc vui đến đây thôi, giờ là lúc cô dâu chú rể vào động phòng! Bà con giữ trật tự nha!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'dongphongEnd',
    label: 'Sau động phòng',
    vars: '{groom} {bride}',
    lines: [
      'Chúc mừng đôi uyên ương! Chúc hai bạn trăm năm hạnh phúc, sớm sinh quý tử!',
      'Cửa phòng hoa chúc đã mở, chúc {groom} và {bride} hạnh phúc trọn đời!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ceremonyEnd',
    label: 'Kết thúc lễ — mở vai cho lượt mới',
    vars: '{groom} {bride}',
    lines: [
      'Chúc mừng {groom} và {bride} đã về chung một nhà! Vai cô dâu chú rể mở lại rồi, ai muốn làm cặp đôi tiếp theo nào?',
      'Lễ thành hôn đã viên mãn! Sân khấu đang chờ cặp đôi mới, tặng quà để giành vai ngay nhé!'
    ]
  },

  // ---------------- QUÀ TẶNG ----------------
  {
    section: 'Cảm ơn quà tặng',
    key: 'thanksFunny',
    label: 'Cảm ơn quà — MC hài hước (quà không gán nghi thức)',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Úi giời ơi tin được không! Đại gia {name} vừa mừng hẳn {count} {gift}! Hào phóng thế này bảo sao cô dâu chú rể cười tít mắt!',
      'U là trời! Cảm ơn bạn {name} nha! Mừng cưới xịn xò thế này thì tối nay cô dâu chú rể đếm quà mỏi tay luôn rồi!',
      'Bạn {name} chơi lớn quá! Mừng {count} {gift} chất lừ! Chúc bạn ăn cỗ no say, sớm tìm được người yêu để năm sau tới lượt mình nha!',
      'Đẳng cấp thực sự bà con ơi! Bạn {name} vừa mừng {count} {gift}! Xứng đáng có mười người yêu xếp hàng tỏ tình!',
      'Cảm ơn bạn {name} nhiều nha! Say rượu thì về chứ say tình là ở lại chung vui tới bến luôn nhé!',
      'Quá đã luôn bà con ơi! Bạn {name} vừa mừng quà cực đỉnh! Cạn ly một trăm phần trăm vì bạn {name} nào!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'thanksPlain',
    label: 'Cảm ơn quà — lịch sự (khi tắt MC hài hước)',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Cảm ơn bạn {name} đã mừng {count} {gift} cho cô dâu {bride} và chú rể {groom}! Chúc bạn và gia đình dồi dào sức khỏe, vạn sự như ý!',
      'Xin cảm ơn {name} đã gửi {count} {gift} chúc mừng đôi uyên ương! Chúc bạn luôn vui vẻ và hạnh phúc!'
    ]
  },
  { section: 'Cảm ơn quà tặng', key: 'giftPetal', label: 'Quà → Mưa hoa hồng', vars: '{name} {gift} {count}', lines: [
    'Cảm ơn bạn {name} đã mừng {count} {gift}! Mưa hoa hồng chúc phúc đôi uyên ương!',
    'Hoa hồng bay khắp hôn trường, cảm ơn {name} nhiều nha!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftKiss', label: 'Quà → Cô dâu chú rể hôn', vars: '{name} {gift} {count} {groom} {bride}', lines: [
    'Bạn {name} hô hôn đi! Cô dâu chú rể trao nhau nụ hôn ngọt ngào!',
    'Cảm ơn {name}! Một nụ hôn cho cả hôn trường cùng ghen tị nào!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftDance', label: 'Quà → Lên sàn nhảy', vars: '{name} {gift} {count}', lines: [
    'Bạn {name} lên sàn nhảy quẩy cực sung! Cả hôn trường cùng nhảy nào!',
    'Nhạc lên! {name} đang làm chủ sàn nhảy, bà con vỗ tay theo nhịp nhé!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftCake', label: 'Quà → Cắt bánh cưới', vars: '{name} {gift} {count} {groom} {bride}', lines: [
    'Cảm ơn bạn {name}! Mời cô dâu chú rể cùng cắt bánh cưới ngọt ngào!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftChampagne', label: 'Quà → Rót rượu sâm panh', vars: '{name} {gift} {count}', lines: [
    'Bạn {name} khui sâm panh! Rót tràn tháp rượu chúc mừng hạnh phúc!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftCheers', label: 'Quà → Cụng ly', vars: '{name} {gift} {count}', lines: [
    'Bạn {name} mời cả hôn trường! Một, hai, ba, dzô!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftRing', label: 'Quà → Trao nhẫn', vars: '{name} {gift} {count} {groom} {bride}', lines: [
    'Bạn {name} mời cô dâu chú rể trao nhẫn cưới!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'giftDongphong', label: 'Quà → Động phòng', vars: '{name} {gift} {count} {groom} {bride}', lines: [
    'Giờ lành đã điểm! Bạn {name} vừa mừng {gift}, mời cô dâu {bride} và chú rể {groom} vào động phòng hoa chúc!',
    'Ối dồi ôi, {name} chơi lớn quá! Cô dâu {bride} và chú rể {groom} được tiễn vào động phòng luôn!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'bouquet', label: 'Quà → Tung hoa cưới', vars: '{name} {catcher} {bride}', lines: [
    'Cô dâu tung hoa cưới! Và người bắt được hoa là... {catcher}! Sắp có đám cưới tiếp theo rồi!',
    'Cảm ơn {name}! Bó hoa cưới bay vèo vèo và rơi đúng tay {catcher}! Chúc mừng nha!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'fireworks', label: 'Quà → Bắn pháo hoa', vars: '{name}', lines: [
    'Pháo hoa rực rỡ! Cảm ơn {name} đã thắp sáng cả hôn trường!',
    'Bùm bùm! {name} bắn pháo hoa mừng đôi uyên ương, đẹp quá bà con ơi!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'musicChange', label: 'Quà → Đổi nhạc', vars: '{name} {track}', lines: [
    '{name} đổi nhạc rồi! Mời cả nhà thưởng thức bài {track}!',
    'Nhạc mới đã lên theo yêu cầu của {name}! Quẩy tiếp nào!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'marryMC', label: 'Quà → Cưới MC', vars: '{name}', lines: [
    'Ơ kìa, {name} tặng quà đòi cưới luôn MC! Thôi được rồi, MC xin nhận lời!',
    'Trời ơi, {name} cầu hôn MC giữa hôn trường! MC đỏ mặt quá bà con ơi!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'photo', label: 'Chụp ảnh cưới / ảnh chung (MC nói)', vars: '{name} {groom} {bride} {number}', lines: [
    'Cả nhà nhìn vào đây nào! Một, hai, ba, cười! Ảnh cưới đã lên sóng, chụp màn hình lưu làm kỷ niệm nha!',
    'Tách! Khoảnh khắc đẹp nhất của {groom} và {bride} đã được lưu lại!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'photoCaption', label: 'Chú thích ảnh cưới (chỉ hiển thị)', vars: '{number} {groom} {bride}', display: true, lines: [
    'Cặp đôi số {number} của rạp cưới hôm nay, chúc hai bạn trăm năm hạnh phúc 💍',
    '{groom} và {bride} đã về chung một nhà, hạnh phúc trọn đời nhé 💕'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'photoGiftCaption', label: 'Chú thích ảnh chung do khách tặng quà (chỉ hiển thị)', vars: '{name} {groom} {bride}', display: true, lines: [
    '{name} chụp ảnh chung cùng cô dâu {bride} và chú rể {groom} 📸',
    'Kỷ niệm đáng nhớ của {name} tại rạp cưới hôm nay 💕'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'goalRose', label: 'Đạt mục tiêu mưa hoa hồng', vars: '{groom} {bride}', lines: [
    'Cả hôn trường đã đạt mục tiêu hoa hồng! Mưa hoa hồng rực rỡ chúc phúc cô dâu chú rể!'
  ] },
  { section: 'Cảm ơn quà tặng', key: 'goalCake', label: 'Đạt mục tiêu cắt bánh', vars: '{groom} {bride}', lines: [
    'Mục tiêu cắt bánh đã hoàn thành! Mời cô dâu chú rể cắt bánh cưới thật to!'
  ] },
  {
    section: 'Cảm ơn quà tặng',
    key: 'cardWishes',
    label: 'Lời chúc trên thẻ chúc mừng (chỉ hiển thị, không đọc)',
    vars: '',
    display: true,
    lines: [
      'Chúc hai bạn trăm năm hạnh phúc, đầu bạc răng long!',
      'Chúc tân lang tân nương tình nồng ý thắm, sớm sinh quý tử!',
      'Chúc đôi uyên ương hòa thuận gắn bó, gia đình hưng thịnh!',
      'Chúc mừng ngày vui đại hỷ, vạn sự cát tường, phúc lộc viên mãn!'
    ]
  }
];

const MC_KEYS = new Set(MC_GROUPS.map(g => g.key));

function defaultMcLines() {
  return Object.fromEntries(MC_GROUPS.map(g => [g.key, g.lines.slice()]));
}

// Giữ câu do người dùng sửa; nhóm thiếu -> lấy mặc định; mảng rỗng = MC im lặng ở sự kiện đó
function sanitizeMcLines(input) {
  const out = defaultMcLines();
  if (!input || typeof input !== 'object') return out;
  for (const key of MC_KEYS) {
    if (!Array.isArray(input[key])) continue;
    out[key] = input[key]
      .map(l => String(l ?? '').replace(/\s+/g, ' ').trim().slice(0, 400))
      .filter(Boolean)
      .slice(0, 20);
  }
  return out;
}

module.exports = { MC_GROUPS, defaultMcLines, sanitizeMcLines };
