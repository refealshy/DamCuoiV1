// ========================================================
// LỜI THOẠI MC MẶC ĐỊNH — giọng trẻ trung, lầy lội cho người xem trẻ trên TikTok
// Mỗi nhóm: nhiều câu, MC đọc luân phiên (không lặp lại câu vừa đọc).
// Biến trong {ngoặc nhọn} được tool tự điền khi có sự kiện.
// Sửa trong bảng điều khiển: tab "Lời thoại MC" (lưu vào wedding_state.json).
// Câu nên ngắn (dưới ~25 từ): các bước của lễ diễn nhanh, câu dài MC đọc không kịp.
// ========================================================

const MC_GROUPS = [
  // ---------------- DẪN CHƯƠNG TRÌNH ----------------
  {
    section: 'Dẫn chương trình',
    key: 'welcome',
    label: 'Chào khách mới vào phòng',
    vars: '{names}',
    lines: [
      'Ố là la, {names} tới rồi! Vô lẹ đi, cỗ sắp hết mà chuyện hay thì còn nguyên nha!',
      '{names} vừa đáp xuống rạp cưới! Ngồi xuống ăn miếng bánh, lát lên làm cô dâu chú rể luôn cũng được!',
      'Chào {names} nha! Tới trễ không sao, miễn có mang phong bì là được!',
      'Rạp vừa đón thêm {names}! Ai ế giơ tay, hôm nay MC bao thoát ế tại chỗ!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'intro',
    label: 'Giới thiệu cách chơi & quà (MC tự nói khi vắng)',
    vars: '{groom} {bride} {min} {gifts} {afterWed}',
    lines: [
      'Rạp cưới online xin chào cả nhà! Ở đây không cần người yêu vẫn cưới được, tặng từ {min} xu là lên xe hoa liền!',
      'Luật siêu gọn: tặng từ {min} xu là có vai, ai tặng nhiều hơn thì cướp vai. {afterWed}',
      'Mẹo nhỏ nè: gõ dzô để cụng ly, gõ nhảy để cả rạp quẩy, gõ hôn đi để cô dâu chú rể phát cơm chó!',
      'Muốn làm cô dâu thì gõ làm cô dâu rồi tặng quà, muốn làm chú rể thì tặng từ {min} xu. Đủ đôi là MC chốt đơn cưới ngay!',
      'Cảm ơn cả nhà đã ghé đám cưới của {groom} và {bride}! Thả tim đi, ngồi im là MC tưởng mọi người ế thật đó!',
      'Sân khấu đang trống, ai ế thì đây là cơ hội! Tặng quà giành vai, đủ đôi là cưới liền. {afterWed}'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'waitGroom',
    label: 'Chờ chú rể (vai chú rể đang trống)',
    vars: '{bride} {min}',
    lines: [
      'Ét ô ét, cô dâu {bride} đứng một mình nãy giờ! Anh nào tặng {min} xu là thoát ế ngay và luôn!',
      'Tuyển chú rể gấp! Không cần nhà, không cần xe, chỉ cần {min} xu là có vợ liền!',
      'Cô dâu {bride} xinh vậy mà chưa ai rước hả? Mấy anh ế lâu năm đâu rồi, {min} xu thôi nè!',
      'Hoa có rồi, nhẫn có rồi, thiếu đúng một ông chồng! Tặng {min} xu nhận vai chú rể nào!',
      'Anh nào bị mẹ giục cưới thì vô đây, {min} xu là có ảnh cưới gửi mẹ liền!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'waitBride',
    label: 'Chờ cô dâu (vai cô dâu đang trống)',
    vars: '{groom} {min}',
    lines: [
      'Chú rể {groom} ôm hoa đứng chờ muốn mốc luôn rồi! Chị em gõ làm cô dâu rồi tặng {min} xu cứu ảnh đi!',
      'Tuyển cô dâu gấp! Váy cưới miễn phí, chồng có sẵn, chỉ cần gõ làm cô dâu và {min} xu!',
      'Vai cô dâu còn trống nha mấy bà! Gõ làm cô dâu, tặng {min} xu, khỏi yêu đương mệt mỏi!',
      'Chú rể {groom} nhìn cũng được mà sao chưa ai hốt? Gõ làm cô dâu rồi tặng quà là có chồng liền!',
      'Chị em nào muốn có chồng trong ba mươi giây thì gõ làm cô dâu và tặng {min} xu nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'idleSocial',
    label: 'Rủ rê làm quen, kết bạn (MC nói xen lúc rạp vắng)',
    vars: '{groomHow} {brideHow}',
    lines: [
      'Ai đang ế thì vô đây! Lên làm cô dâu chú rể, biết đâu gặp được người trong mộng ngay tại rạp này!',
      'Cưới ảo mà quen thật là có thiệt nha bà con! Mạnh dạn nhận vai đi, người ấy đang ngồi xem cùng đó!',
      'Thấy ai dễ thương trong phần bình luận chưa? Lên giành vai cưới người ta liền, chậm là mất!',
      'Rạp này không chỉ cưới cho vui đâu, làm quen kết bạn thoải mái! Bình luận chào nhau một câu đi nào!',
      'Crush đang xem live chung hả? Rủ vô đây cưới thử một lần, tỏ tình kiểu này khỏi sợ quê!',
      'Một mình coi live buồn lắm! Lên xe hoa với một người lạ, cưới xong follow nhau là hết cô đơn!',
      'Ai cưới rồi thì chụp màn hình khoe bạn bè đi, rủ cả hội vô đây cưới chung cho vui!',
      'Cô dâu chú rể tương lai đang trốn ở đâu? Muốn có đôi thì {groomHow} hoặc {brideHow}, MC se duyên liền!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'challenge',
    label: 'Khích cướp vai (đã đủ đôi, chưa làm lễ)',
    vars: '{groom} {bride} {groomBid} {brideBid}',
    lines: [
      'Chú rể {groom} giữ ghế với {groomBid} xu, cô dâu {bride} với {brideBid} xu. Ai ghen ăn tức ở thì tặng nhiều hơn mà cướp!',
      '{groom} với {bride} đang hạnh phúc quá, có ai muốn phá không? Tặng nhiều hơn là soán ngôi liền!',
      'Ghế chú rể giá {groomBid} xu, ghế cô dâu {brideBid} xu. Rẻ hơn ly trà sữa mà được cưới, ai chốt nào?'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'countdownStart',
    label: 'Đủ đôi — bắt đầu đếm ngược làm lễ',
    vars: '{groom} {bride} {seconds} {crashHow}',
    lines: [
      'Chốt đơn! {groom} và {bride} thành một cặp, {seconds} giây nữa cưới. Ai thấy ngứa mắt thì {crashHow}!',
      'U là trời, đủ đôi rồi! {groom} với {bride}, còn {seconds} giây. Người yêu cũ đâu, vô {crashHow} lẹ lên!',
      'Cặp đôi lộ diện: {groom} và {bride}! {seconds} giây nữa làm lễ, muốn chen ngang thì {crashHow} nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'countdownRemind',
    label: 'Nhắc giờ làm lễ (khi vắng, đang đếm ngược)',
    vars: '{groom} {bride} {seconds}',
    lines: [
      'Còn {seconds} giây nữa {groom} và {bride} thành vợ chồng! Ai định cướp thì làm lẹ, chậm là ế tiếp đó!',
      'Đồng hồ đang chạy, còn {seconds} giây! Giờ không phá thì lát đừng có khóc nha!',
      '{seconds} giây nữa thôi! Hội ế chuẩn bị tinh thần ăn cơm chó của {groom} và {bride} nào!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'share',
    label: 'Cảm ơn chia sẻ rạp cưới',
    vars: '{names}',
    lines: [
      'Cảm ơn {names} đã chia sẻ rạp cưới! Rủ thêm hội ế vào đây, đông vui dễ thoát ế!',
      '{names} vừa đi phát thiệp cưới giùm MC! Chúc sớm có bồ, không có thì quay lại đây MC gả!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'follow',
    label: 'Cảm ơn theo dõi kênh',
    vars: '{names}',
    lines: [
      'Cảm ơn {names} đã theo dõi! Từ nay là người nhà rồi, ngày nào cũng có đám cưới để hóng nha!',
      '{names} vừa bấm theo dõi, MC ghi sổ ân nhân rồi đó! Mai nhớ ghé ăn cưới tiếp nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'likeGoal',
    label: 'Đủ tim — cả rạp đứng dậy quẩy',
    vars: '{likes}',
    lines: [
      'Đủ {likes} tim rồi cả nhà ơi! Đứng dậy quẩy thôi, ai ngồi im là người đó ế!',
      'Tim ngập rạp luôn rồi! Nhạc lên, bung lụa hết mình nào!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'partyCouples',
    label: 'Đủ số cặp cưới — cả rạp mở tiệc quẩy',
    vars: '{couples}',
    lines: [
      'Cặp thứ {couples} cưới xong rồi! Mở tiệc thôi, cả rạp đứng dậy quẩy nào!',
      'Chúc mừng cặp số {couples}! Nhạc lên, ai ngồi im là người đó ế nha!',
      'Đủ cặp rồi bà con ơi! Tiệc to tới rồi, quẩy banh nóc rạp luôn!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'poemIdle',
    label: 'Đọc thơ khi rạp vắng (MC rảnh)',
    vars: '',
    lines: [
      'MC đọc thơ nè: Ế lâu thì cũng chán rồi, vào đây tặng quà lên ngồi xe hoa. Không cần nhà lầu xe ga, một bông hồng nhỏ là ta có chồng!',
      'Thơ thả tim nè cả nhà: Thả tim đi cả nhà ơi, tim nhiều cả rạp đứng chơi quẩy liền. Ai mà cứ đứng ưu phiền, là người ế nhất cả miền đó nha!',
      'Thơ tặng hội ế: Trời xanh mây trắng lưng chừng, ế lâu cũng chớ có ngừng ước mơ. Gõ ngay chú rể, đừng chờ, MC gả vợ bất ngờ cho luôn!',
      'MC làm thơ nè: Hôm nay rạp cưới đông vui, người ta có cặp, còn tui một mình. Thôi thì tặng chút chân tình, biết đâu cô dâu xinh xinh nhìn mình!',
      'Nghe thơ nè cả nhà: Bánh cưới thì ngọt như đường, cô dâu thì đẹp như hường mới ra. Chú rể thì cứ ngó qua, ai chưa có cặp thì ra đây liền!',
      'Một bông hồng đỏ thắm tươi, tặng ngay một cái là người có đôi. Ế chi ế mãi vậy trời, vào đây MC gả rồi khỏi lo!',
      'Thơ rủ bạn nè: Thương nhau thì rủ nhau về, bấm chia sẻ để hội ế vào đây. Rạp đông thì cưới càng hay, biết đâu nhờ vậy mà nay có bồ!',
      'Thơ theo dõi nè: Bấm theo dõi chẳng tốn tiền, ngày nào cũng có cô tiên cưới chồng. Ai mà chưa có người trông, theo dõi MC là xong chuyện tình!',
      'Tim ơi tim hỡi bay cao, thả tim đủ số là vào tiệc to. Cả rạp đứng dậy hát hò, ai không quẩy được thì lo ế dài!',
      'MC ngẫu hứng một bài: Rạp cưới trên mạng vui ghê, cưới xong một cặp lại về cặp sau. Ai còn đứng đó ngó nhau, tặng quà lên vai, mau mau cưới liền!',
      'Thơ cưới thời nay: Người ta cưới vợ rình rang, ở đây một món quà sang là xong. Không cần cưới hỏi long đong, một giây có vợ, có chồng như ai!',
      'Đêm nay trăng sáng trên cao, ai chưa có cặp thì vào đây ngay. Bình luận hai chữ thật hay, cô dâu, chú rể, xếp ngay hàng chờ!',
      'Thơ gửi mẹ nè: Mẹ ơi con sắp cưới rồi, cưới trong rạp mạng có đôi hẳn hoi. Mẹ đừng giục nữa mẹ ơi, ảnh cưới con gửi mẹ coi liền liền!',
      'Thơ cảm ơn nè: Cảm ơn ai đã tặng quà, rạp này nhờ bạn mà ra tưng bừng. Chúc ai tặng mãi không ngừng, năm nay có Tết, có mừng, có yêu!',
      'MC đọc thơ tình nè: Yêu nhau chẳng cần lý do, cưới nhau chẳng cần hẹn hò bao lâu. Vào đây gặp gỡ nhau mau, ba mươi giây đã thành dâu thành chồng!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'poemWedding',
    label: 'Đọc thơ mừng cặp đôi vừa cưới (trong tiệc mừng)',
    vars: '{groom} {bride}',
    lines: [
      'Tặng {groom} và {bride} bài thơ nè: Trăm năm duyên nợ ba sinh, hôm nay hai bạn chung tình một đôi. Chúc cho mãi mãi rạng ngời, sớm sinh quý tử, cả đời bên nhau!',
      'Thơ mừng {groom} và {bride}: Cô dâu xinh tựa hoa hồng, chú rể thì đẹp trai không ai bằng. Chúc nhau như bóng với trăng, đêm nào cũng sáng, lăng nhăng thì đừng!',
      'Dặn {groom} và {bride} bằng thơ nè: Vợ chồng là nghĩa trăm năm, cưới online cũng phải chăm nhắn tin. Kết bạn đi nhé, đừng im, mai còn hẹn gặp để tìm nhau thêm!',
      'Lời khuyên cho {groom} nè: Chồng thì nhớ rửa chén đi, vợ thì nhớ chớ có chi cũng hờn. Lương về nộp đủ thì hơn, giấu quỹ đen nữa là đơn ly hôn!',
      'MC xin đọc thơ mừng {groom} và {bride}: Pháo hồng rộn rã ngoài sân, hai nhà kết nghĩa Châu Trần từ đây. Rượu mừng ly cạn ly đầy, chúc cho đôi trẻ mãi say tình nồng!',
      'Thơ tặng hội ế đang xem {groom} và {bride} cưới: Hôm qua còn ế một mình, hôm nay có vợ xinh xinh rồi nè. Hội ế ở lại lắng nghe, tặng quà để lượt sau xe đón mình!',
      '{groom} và {bride} trao nhẫn rồi nè: Nhẫn vàng trao tận tay nhau, thề rằng mãi mãi trước sau một lòng. Ai mà phá đám thì xong, cho ế dài tới mùa đông năm sau!',
      'Thơ chúc {groom} và {bride}: Ông Tơ bà Nguyệt se duyên, hôm nay rạp cưới có tiên lấy chồng. Chúc cho hai trái tim hồng, mỗi ngày một ngọt, thêm nồng thêm say!',
      'Dặn dò {groom} và {bride} nè: Cưới rồi thì nhớ nghe chưa, chồng đi làm, vợ đón đưa mỗi ngày. Cãi nhau thì cũng chớ gay, hôn một cái là hết ngay giận hờn!',
      'Thơ mừng đôi trẻ {groom} và {bride}: Rạp cưới hoa nở rộn ràng, cô dâu e thẹn, chú chàng ngẩn ngơ. Bao năm ế chỏng ế chơ, hôm nay cưới được như mơ thật rồi!',
      'Nâng ly mừng {groom} và {bride} nè: Một hai ba, nâng ly cao, mừng đôi trẻ cưới, ly nào cũng khô. Hét lên cho cả rạp hô, trăm năm hạnh phúc, ấm no mỗi ngày!',
      'Khen {groom} và {bride} một bài: Váy trắng tinh, áo vest sang, cô dâu đẹp tựa nữ hoàng hôm nay. Chú rể cười tít cả ngày, nhìn vợ không chớp, mê say quên đường!',
      'MC chúc {groom} và {bride} bằng thơ: Ghép đôi ngẫu nhiên mà hay, biết đâu là sợi chỉ tay ông trời. Thôi thì cưới đại đi thôi, kết bạn nhắn tin, trọn đời bên nhau!',
      'Thơ động phòng cho {groom} và {bride}: Động phòng hoa chúc đêm nay, ai muốn xem tiếp thì tay tặng quà. Cô dâu, chú rể đôi ta, đang chờ cả rạp mở ra cửa phòng!',
      'Chúc {groom} và {bride} bạc đầu nè: Từ nay chung lối đi về, cơm ngon vợ nấu, chồng mê tít mù. Chúc cho hạnh phúc ngàn thu, đầu bạc răng long vẫn như thuở nào!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'treatQuiet',
    label: 'Rạp vắng quà — MC đãi miễn phí một hiệu ứng',
    vars: '{effect} {gift}',
    lines: [
      'Rạp buồn quá, MC đãi {effect} miễn phí nè! Lần sau muốn xem nữa thì tặng {gift} nha!',
      'Im re vậy trời! Thôi MC bao {effect} một lần, ai muốn xem lại thì tặng {gift} nha!',
      'MC mở hàng {effect} cho rạp đỡ buồn! Muốn xem tiếp thì cả nhà tặng {gift} là có liền!',
      'Quà đâu hết rồi cả nhà? MC tự đãi {effect} luôn nè! Thích thì tặng {gift} để MC làm lại nha!'
    ]
  },
  // ---------------- VAI CÔ DÂU – CHÚ RỂ & ĐẤU GIÁ ----------------
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomTaken',
    label: 'Nhận vai chú rể (vai đang trống)',
    vars: '{name} {gift} {count} {bid} {bride}',
    lines: [
      'Chúc mừng {name} thoát ế với {bid} xu! Cô dâu {bride} ơi, chồng em tới rồi nè!',
      'Có chú rể rồi! {name} mừng {count} {gift} một phát là lên xe hoa, quá nhanh quá nguy hiểm!',
      'Đẹp trai chưa biết nhưng nhanh tay thì có, {name} chính thức làm chú rể!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideTaken',
    label: 'Nhận vai cô dâu (vai đang trống)',
    vars: '{name} {gift} {count} {bid} {groom}',
    lines: [
      'Cô dâu xuất hiện! {name} chốt vai với {bid} xu, xinh hết nước chấm luôn!',
      'Chú rể {groom} ơi hết ế rồi nha! {name} mừng {count} {gift} và thành cô dâu của anh!',
      'Váy cưới có chủ! {name} chính thức làm cô dâu, hội chị em vỗ tay nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomStolen',
    label: 'Cướp ngôi chú rể',
    vars: '{name} {previous} {bid} {bride}',
    lines: [
      'Tới công chuyện! {name} quăng {bid} xu, đá bay chú rể {previous} trong một nốt nhạc!',
      '{previous} ơi mất vợ rồi! Chú rể giờ là {name}, muốn đòi lại thì tặng hơn {bid} xu nha!',
      'Tin chấn động: {name} cướp chú rể với {bid} xu! {previous} ra chuồng gà ngồi tạm nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideStolen',
    label: 'Cướp ngôi cô dâu',
    vars: '{name} {previous} {bid} {groom}',
    lines: [
      'Biến căng! {name} chi {bid} xu giật luôn vai cô dâu của {previous}!',
      'Cô dâu mới là {name}! {previous} ơi, tặng hơn {bid} xu mà giành lại chồng đi!',
      'Chú rể {groom} ơi vợ anh vừa đổi người rồi! Chào cô dâu {name} với {bid} xu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'bidMissing',
    label: 'Đấu giá chưa đủ xu',
    vars: '{name} {role} {bid} {missing} {holder}',
    lines: [
      '{name} đang có {bid} xu, thiếu đúng {missing} xu nữa là đá được {holder} khỏi vai {role}! Cố lên!',
      'Suýt được rồi {name} ơi! Thêm {missing} xu nữa thôi là vai {role} về tay!',
      '{holder} đang toát mồ hôi hột! {name} chỉ còn thiếu {missing} xu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'bidDefended',
    label: 'Người đang giữ vai tặng thêm (giữ ngôi)',
    vars: '{name} {role} {bid}',
    lines: [
      '{name} quyết giữ vai {role}, nâng giá lên {bid} xu! Keo lỳ quá trời, ai dám cướp nữa không?',
      'Đừng hòng nha! {role} {name} vừa tăng giá lên {bid} xu để giữ ghế!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queued',
    label: 'Đặt cọc vai cho lượt sau (tặng trong lúc làm lễ)',
    vars: '{name} {role}',
    lines: [
      'Đang làm lễ nên {name} chờ xíu nha, vai {role} lượt sau MC để dành cho bạn rồi!',
      'Ghi nhận {name}! Lễ xong là vai {role} thuộc về bạn liền!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queuedApplied',
    label: 'Lượt mới: người đặt cọc nhận vai',
    vars: '{name} {role}',
    lines: [
      'Lượt mới! {name} đã đặt chỗ từ trước nên lên làm {role} luôn!',
      'Tới rồi tới rồi! {name} chính thức nhận vai {role}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queueJoined',
    label: 'Hàng chờ: xếp hàng thành công',
    vars: '{name} {role} {position} {holder}',
    lines: [
      '{name} đã xếp hàng làm {role}, số thứ tự {position}! Chờ {holder} cưới xong là tới bạn!',
      'Ghi tên {name} vào hàng chờ {role}, số {position}. Sốt ruột thì tặng quà mà chen lên nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queueAlready',
    label: 'Hàng chờ: nhắc lại chỗ đã giữ',
    vars: '{name} {role} {position}',
    lines: [
      '{name} ơi bình tĩnh, bạn có chỗ trong hàng chờ {role} rồi, đang số {position} đó!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queuePromoted',
    label: 'Hàng chờ: tới lượt lên sân khấu',
    vars: '{name} {role}',
    lines: [
      'Tới lượt rồi! {name} bước lên sân khấu làm {role} nào!',
      'Chờ mỏi cổ cuối cùng cũng tới! {name} chính thức làm {role}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'pairSoon',
    label: 'Ghép đôi ngẫu nhiên: nhắc trước khi chọn',
    vars: '{seconds}',
    lines: [
      'Còn {seconds} giây nữa MC bốc đại một người lên cưới đó! Ai muốn tự chọn thì nhanh tay lên!',
      'Chưa ai nhận vai hả? {seconds} giây nữa MC điểm danh ngẫu nhiên, trúng ai người đó cưới!'
    ]
  },
  {
    key: 'partnerSoon',
    label: 'Ghép đôi ngẫu nhiên: có người đang chờ nửa kia, nhắc trước khi MC chọn',
    vars: '{name} {role} {other} {seconds}',
    lines: [
      '{name} đứng chờ mỏi chân rồi nè! {seconds} giây nữa không ai tặng quà làm {other} là MC bốc đại một người lên cưới luôn!',
      'Còn {seconds} giây! Ai muốn làm {other} của {name} thì tặng quà lẹ, không là MC gả đại cho người lạ đó nha!',
      'Bà con ơi, {role} {name} ế tới nơi rồi! {seconds} giây nữa MC quay số trúng ai, người đó làm {other}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'firstPick',
    label: 'Ghép đôi ngẫu nhiên: chưa ai nhận vai, MC mời một khách lên trước',
    vars: '{name} {role} {other}',
    lines: [
      'Sân khấu vắng quá, MC bốc trúng {name} lên làm {role}! Còn thiếu {other}, ai hốt nào?',
      '{name} đang ngồi chơi cũng bị kéo lên làm {role}! Giờ cần một {other}, nhanh tay nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'randomPair',
    label: 'Ghép đôi ngẫu nhiên: MC chọn cả hai vai',
    vars: '{groom} {bride}',
    lines: [
      'Không ai chịu cưới thì MC gả đại: chú rể {groom}, cô dâu {bride}! Không ưng thì tặng quà mà cướp!',
      'Ông tơ bà nguyệt se duyên bừa rồi! {groom} và {bride}, lên sân khấu lẹ nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'randomRole',
    label: 'Ghép đôi ngẫu nhiên: MC chọn vai còn thiếu',
    vars: '{name} {role} {partner}',
    lines: [
      'Vai {role} trống, MC bốc trúng {name}! {partner} ơi, nửa kia từ trên trời rơi xuống nè!',
      '{name} bị MC gả đại làm {role}! Ai thấy không xứng thì tặng quà giành lại nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'hostPick',
    label: 'Ghép đôi ngẫu nhiên: rạp chưa có khách, mời chủ phòng lên vai',
    vars: '{name} {role} {partner}',
    lines: [
      'Không ai nhận vai {role} thì chủ phòng {name} xông pha luôn! {partner} ơi, nửa kia của bạn đây!',
      'Rạp vắng quá, chủ phòng {name} phải tự lên làm {role}! Ai thương thì tặng quà lên thay giùm!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'introQueue',
    label: 'Luật quà vào vai: giới thiệu cách chơi',
    vars: '{title} {gifts} {groomHow} {brideHow} {heldHow} {afterWed}',
    lines: [
      'Chào cả nhà đến với {title}! Muốn làm chú rể thì {groomHow}, muốn làm cô dâu thì {brideHow}, ế mấy cũng cưới được!',
      'Luật siêu dễ: {groomHow} là làm chú rể, {brideHow} là làm cô dâu, {heldHow}. {afterWed}',
      'Ai muốn thoát ế trong ba mươi giây? Cứ {groomHow} là có vợ, {brideHow} là có chồng. Đủ đôi là MC chốt đơn cưới liền!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'waitGroomQueue',
    label: 'Luật Hàng chờ: mời nhận vai chú rể',
    vars: '{groomHow}',
    lines: [
      'Ét ô ét, thiếu chú rể! Anh nào {groomHow} trước là có vợ liền, khỏi cần tán!',
      'Tuyển chú rể gấp! Không cần nhà xe, chỉ cần {groomHow} là lên xe hoa!',
      'Mấy anh bị mẹ giục cưới đâu rồi? Chỉ cần {groomHow} là có ảnh cưới gửi mẹ ngay!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'waitBrideQueue',
    label: 'Luật Hàng chờ: mời nhận vai cô dâu',
    vars: '{brideHow}',
    lines: [
      'Vai cô dâu đang trống nha mấy bà! Chỉ cần {brideHow} là có chồng liền, khỏi yêu đương mệt mỏi!',
      'Tuyển cô dâu gấp! Váy có sẵn, chồng có sẵn, chỉ cần {brideHow} thôi!',
      'Chị em nào muốn mặc váy cưới hôm nay? Cứ {brideHow} là lên sân khấu liền nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rolesOpenQueue',
    label: 'Luật Hàng chờ: vai mở lại sau lễ',
    vars: '{groomHow} {brideHow}',
    lines: [
      'Sân khấu trống rồi! Muốn làm chú rể thì {groomHow}, muốn làm cô dâu thì {brideHow}, nhanh tay kẻo ế!',
      'Vai mở lại rồi cả nhà ơi! Cứ {groomHow} là có vợ, {brideHow} là có chồng, ai lẹ người đó được!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomTakenQueue',
    label: 'Luật Hàng chờ: có người nhận vai chú rể',
    vars: '{name} {bride}',
    lines: [
      'Chúc mừng {name} thoát ế, chính thức làm chú rể! Giờ chờ một cô dâu tới hốt thôi!',
      'Chú rể {name} đã lên sân khấu, nhìn bảnh ghê! Chị em đâu, vô nhận chồng nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideTakenQueue',
    label: 'Luật Hàng chờ: có người nhận vai cô dâu',
    vars: '{name} {groom}',
    lines: [
      'Cô dâu {name} đã xuất hiện, xinh hết nước chấm! Mấy anh đâu, vô rước dâu lẹ!',
      'Chúc mừng {name} thành cô dâu! Váy cưới hôm nay đỉnh nóc kịch trần luôn!'
    ]
  },
  {
    key: 'revengeCall',
    label: 'Kèo đấu: khích người vừa bị đá đòi lại vai (đọc nối sau câu cướp vai)',
    vars: '{name} {previous} {role} {seconds}',
    lines: [
      '{previous} ơi, có {seconds} giây tặng quà đòi lại ghế {role} nè, nhịn là mất luôn đó!',
      '{previous} định nhịn thiệt hả? {seconds} giây phục thù bắt đầu, cả rạp đang hóng!',
      'Nóng nè! {previous} có {seconds} giây để đá lại {name}, chơi không?'
    ]
  },
  {
    key: 'revengeDone',
    label: 'Kèo đấu: phục thù thành công (người bị đá giành lại vai)',
    vars: '{name} {previous} {role} {round} {a} {b}',
    lines: [
      'Phục thù thành công! {name} quay lại đá {previous} bay màu, lấy lại ghế {role}! Tỉ số {a} – {b}!',
      'Ối dồi ôi, {name} không nhịn! {previous} vừa ngồi chưa ấm ghế {role} đã văng! Tỉ số {a} – {b}, {previous} gỡ không?',
      'Có thù phải trả! {name} đòi lại ghế {role} từ tay {previous}! Hiệp {round} rồi bà con ơi!'
    ]
  },
  {
    key: 'duelRound',
    label: 'Kèo đấu: hai người giành qua giành lại (từ hiệp 2)',
    vars: '{name} {previous} {role} {round} {a} {b}',
    lines: [
      'Hiệp {round}! {name} lại đá {previous} văng khỏi ghế {role}, tỉ số {a} – {b}! {previous} gỡ không?',
      'Căng như dây đàn! {name} với {previous} giành ghế {role} tới hiệp {round} rồi, tỉ số {a} – {b}!',
      'Kèo này cháy quá! {name} {a}, {previous} {b}! Ai tặng quà trước người đó ngồi ghế {role}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomReplaced',
    label: 'Quà thay chú rể',
    vars: '{name} {previous} {bride}',
    lines: [
      'Tới công chuyện! {name} xông lên đá bay chú rể {previous}, đứng cạnh cô dâu {bride} luôn!',
      'Chú rể {previous} bay màu rồi! Chồng mới của cô dâu {bride} là {name}!',
      '{previous} ơi ra chuồng gà ngồi nha! {name} mới là chú rể!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideReplaced',
    label: 'Quà thay cô dâu',
    vars: '{name} {previous} {groom}',
    lines: [
      'Biến căng! {name} lên thay cô dâu {previous}, chú rể {groom} ơi vợ anh đổi người rồi!',
      'Cô dâu {previous} bay màu! Chào cô dâu mới {name} của chú rể {groom}!',
      '{previous} ơi mất chồng rồi! {name} mới là cô dâu nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'cancel',
    label: 'Hủy hôn, phá đám',
    vars: '{name} {groom} {bride}',
    lines: [
      'Toang rồi! {name} phá đám, {groom} và {bride} bay màu khỏi sân khấu! Ai muốn cưới thì lên lẹ!',
      'Thuyền chìm! {name} tặng quà phá đám, đám cưới của {groom} và {bride} đi vào lòng đất!',
      'Cả rạp chấn động! {name} lật bàn, {groom} với {bride} chạy mất dép!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'cancelBlocked',
    label: 'Phá đám bị chặn (đang làm lễ)',
    vars: '{name}',
    lines: [
      '{name} định phá đám mà đang làm lễ rồi, bảo vệ khiêng ra ngoài nha!',
      'Trễ rồi {name} ơi, đang làm lễ không phá được! Lần sau phá sớm sớm xíu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rivalsWed',
    label: 'Chuyện cũ: hai người từng đá nhau giành vai, giờ lại cưới nhau',
    vars: '{groom} {bride} {role} {rounds} {seconds} {crashHow}',
    lines: [
      'Ủa gì vậy trời! {groom} với {bride} mới nãy còn đá nhau giành ghế {role}, giờ quay qua cưới nhau luôn! Ghét của nào trời trao của đó!',
      'Cú quay xe cháy máy! Đánh nhau {rounds} hiệp xong {groom} và {bride} dắt nhau lên xe hoa! Oan gia ngõ hẹp là đây chứ đâu!',
      'Hết giành nhau rồi hả? {groom} và {bride} từ kẻ thù thành vợ chồng luôn! Ai thấy vô lý thì {crashHow}!',
      'Thương nhau lắm cắn nhau đau! {groom} với {bride} giành ghế {role} chán chê, giờ về chung một nhà cho đỡ phải giành!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'coupleAgain',
    label: 'Chuyện cũ: cặp này đã cưới nhau rồi, giờ cưới lại',
    vars: '{groom} {bride} {before} {times} {seconds} {crashHow}',
    lines: [
      'Ủa lại là {groom} với {bride}? Cưới {before} lần rồi chưa chán hả! {seconds} giây nữa cưới lần thứ {times}!',
      'Người quen đây rồi! {groom} và {bride} lên xe hoa lần thứ {times}, yêu lại từ đầu hay gì? Ai ngứa mắt thì {crashHow}!',
      'Cưới hoài cưới mãi! {groom} với {bride} lần thứ {times} rồi đó, MC thuộc luôn tên hai bạn!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideSwitched',
    label: 'Chuyện cũ: cô dâu vừa cưới người khác, giờ cưới chú rể mới',
    vars: '{groom} {bride} {ex} {seconds} {crashHow}',
    lines: [
      'Rồi luôn! Cô dâu {bride} bỏ {ex} để cưới {groom}! {ex} ơi còn {seconds} giây, không giành lại là mất vợ đó!',
      'Quay xe gắt quá! {bride} mới cưới {ex} xong giờ lên xe hoa với {groom}! Ai muốn can thì {crashHow}!',
      'Chấn động! Hôm trước {bride} còn là vợ {ex}, hôm nay đã theo {groom}! Còn {seconds} giây nữa cưới!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomSwitched',
    label: 'Chuyện cũ: chú rể vừa cưới người khác, giờ cưới cô dâu mới',
    vars: '{groom} {bride} {ex} {seconds} {crashHow}',
    lines: [
      'Rồi luôn! Chú rể {groom} bỏ {ex} để cưới {bride}! {ex} ơi còn {seconds} giây, không giành lại là mất chồng đó!',
      'Bẻ lái khét lẹt! {groom} mới cưới {ex} xong giờ rước {bride} về dinh! Ai muốn can thì {crashHow}!',
      'Trời ơi tin được không! {groom} thay vợ như thay áo, bỏ {ex} cưới {bride}! Còn {seconds} giây nữa thôi!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'roleHeld',
    label: 'Bình luận xin vai nhưng vai đang có người (không hàng chờ)',
    vars: '{name} {role} {holder} {gift}',
    lines: [
      'Vai {role} có {holder} giữ rồi {name} ơi! Tặng {gift} là đá bay liền, khỏi chờ!',
      '{name} muốn làm {role} hả? Tặng {gift} đi, {holder} bay màu ngay!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'holderLeft',
    label: 'Người giữ vai đã rời phòng — mở lại vai',
    vars: '{name} {role}',
    lines: [
      '{name} trốn mất tiêu rồi! Vai {role} mở lại nè, ai nhanh tay thì lên!',
      'Chờ hoài không thấy {name} đâu, chắc sợ cưới! Vai {role} trống rồi, mời người khác!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rolesOpen',
    label: 'Mở lại vai (khi bấm nút trong bảng điều khiển)',
    vars: '{min}',
    lines: [
      'Vai cô dâu chú rể mở lại rồi! Tặng từ {min} xu là lên xe hoa, ế chi cho khổ!'
    ]
  },
  // ---------------- LỄ THÀNH HÔN & ĐỘNG PHÒNG ----------------
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ceremonyStart',
    label: 'Mở đầu lễ thành hôn',
    vars: '{groom} {bride}',
    lines: [
      'Giờ lành tới rồi! Mời chú rể {groom} và cô dâu {bride} lên lễ đường!',
      'Chốt đơn cưới! {groom} và {bride}, hai bạn hết đường lui rồi nha!',
      'Nghiêm túc nào cả nhà! Lễ cưới của {groom} và {bride} bắt đầu!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'wedDone',
    label: 'Thành hôn xong — mời tặng quà cho các bước tiếp theo',
    vars: '{groom} {bride}',
    lines: [
      'Xong! {groom} và {bride} thành vợ chồng rồi! Giờ cả nhà tặng quà đi, muốn xem hôn, cắt bánh hay động phòng là có liền!',
      'Hết ế chính thức! Tặng gì là {groom} và {bride} làm nấy, cơ hội hành cô dâu chú rể đây rồi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'coupleConnect',
    label: 'Sau khi thành hôn: rủ đôi trẻ kết bạn, nói chuyện với nhau',
    vars: '{groom} {bride}',
    lines: [
      'Cưới xong rồi thì {groom} với {bride} follow nhau, nhắn tin làm quen ở ngoài luôn nha! Biết đâu cưới ảo thành yêu thật!',
      '{groom} ơi, vợ mới cưới đó! Vô trang cá nhân {bride} bấm follow rồi nhắn tin hỏi thăm đi chứ!',
      'Hai bạn {groom} và {bride} kết bạn nói chuyện với nhau đi nha, cưới rồi mà không quen nhau thì kỳ lắm!',
      'Rạp này mai mối có tâm lắm! {groom} với {bride} cứ làm quen ngoài đời, thành đôi thật nhớ mời MC ăn cưới!',
      'Duyên số là đây chứ đâu! {bride} với {groom} thử nhắn cho nhau một câu xem, biết đâu hợp cạ!',
      '{bride} ơi, chồng {groom} đang chờ tin nhắn kìa! Cưới trên live rồi thì ra ngoài cà phê làm quen một bữa đi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'demoFireworks',
    label: 'MC đãi: thỉnh thoảng bắn pháo hoa miễn phí để khoe tính năng',
    vars: '{groom} {bride} {gift}',
    lines: [
      'MC khao một tràng pháo hoa mừng {groom} và {bride}! Lần sau ai muốn xem nữa thì tặng {gift} nha!',
      'Hôm nay MC vui, bắn pháo hoa tặng đôi trẻ luôn! Thích thì lần sau tặng {gift} là có liền!',
      'Pháo hoa cây nhà lá vườn đây bà con! Muốn bắn hoài thì tặng {gift} cho MC đỡ tốn nha!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'demoDongphong',
    label: 'MC đãi: thỉnh thoảng cho đôi trẻ động phòng miễn phí để khoe tính năng',
    vars: '{groom} {bride} {gift}',
    lines: [
      'Hôm nay MC chơi lớn, khao {groom} và {bride} một suất động phòng! Lần sau muốn xem thì tặng {gift} nha!',
      'Thấy đôi trẻ đứng chờ tội quá, MC cho vô động phòng luôn! Cặp sau muốn vậy thì tặng {gift} nhé bà con!',
      'Khuyến mãi động phòng miễn phí cho {groom} với {bride}! Chỉ lần này thôi, lần sau nhớ tặng {gift}!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'receptionRemind',
    label: 'Tiệc mừng: nhắc tặng quà trước khi đôi trẻ rời sân khấu',
    vars: '{groom} {bride} {seconds}',
    lines: [
      'Còn {seconds} giây nữa {groom} và {bride} về mất! Muốn xem hôn hay động phòng thì tặng quà lẹ!',
      'Chưa ai cho đôi trẻ động phòng hả? Còn {seconds} giây, tặng quà đi rồi cả nhà cùng hóng!',
      'Cô dâu chú rể đứng chờ quà mỏi chân rồi! Tặng một cái cho {groom} với {bride} hôn nhau coi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'quickwed',
    label: 'Quà "động phòng luôn" (bỏ qua các bước lễ)',
    vars: '{name} {groom} {bride}',
    lines: [
      'Chơi lớn! {name} tặng quà cho {groom} và {bride} vô động phòng luôn, khỏi vòng vo!',
      'Gấp lắm rồi! Nhờ {name}, {groom} với {bride} được đẩy thẳng vô động phòng!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ring',
    label: 'Trao nhẫn',
    vars: '{groom} {bride}',
    lines: [
      'Trao nhẫn nào! Đeo vô là hết đường chạy nha hai bạn!',
      'Nhẫn nhỏ mà trách nhiệm to! Mời {groom} và {bride} trao nhẫn!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'kiss',
    label: 'Hôn cô dâu',
    vars: '{groom} {bride}',
    lines: [
      'Hôn đi hôn đi! Cả rạp đếm: một, hai, ba!',
      'Chú rể hôn cô dâu nào! Hội ế quay mặt đi chỗ khác nha!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'cake',
    label: 'Cắt bánh cưới',
    vars: '{groom} {bride}',
    lines: [
      'Cắt bánh thôi! Cắt khéo vô, chia MC một miếng nha!',
      'Bánh cưới tới rồi! Mời {groom} và {bride} cùng cắt, ngọt như tình yêu của hai bạn!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'champagne',
    label: 'Rót rượu sâm panh',
    vars: '{groom} {bride}',
    lines: [
      'Khui rượu! Rót tràn ly, say thì về mà yêu thì ở lại!',
      'Sâm panh nổ rồi! Cả rạp nâng ly mừng cô dâu chú rể nào!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'dongphong',
    label: 'Mời vào động phòng',
    vars: '{groom} {bride}',
    lines: [
      'Tới giờ rồi! Mời {groom} và {bride} vô động phòng, cả nhà đứng ngoài hóng thôi nha!',
      'Tiệc tàn rồi, cô dâu chú rể vô động phòng! Ai nhìn trộm là bị đau mắt đỏ đó!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'dongphongEnd',
    label: 'Sau động phòng',
    vars: '{groom} {bride}',
    lines: [
      'Xong rồi! Chúc {groom} và {bride} trăm năm hạnh phúc, sang năm có em bé cho MC bế!',
      'Cửa mở rồi! {groom} với {bride} bước ra mặt tươi rói, chúc hai bạn ở với nhau tới già!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ceremonyEnd',
    label: 'Kết thúc lễ — mở vai cho lượt mới',
    vars: '{groom} {bride}',
    lines: [
      'Tiễn {groom} và {bride} về chung một nhà! Sân khấu trống rồi, cặp tiếp theo đâu?',
      'Xong một cặp! Hội ế còn lại đâu rồi, lên sân khấu nào!',
      '{groom} với {bride} cưới xong rồi, ai muốn thoát ế tiếp theo thì nhanh tay nha!'
    ]
  },
  // ---------------- CẢM ƠN QUÀ TẶNG ----------------
  {
    section: 'Cảm ơn quà tặng',
    key: 'thanksFunny',
    label: 'Cảm ơn quà — MC hài hước (quà không gán nghi thức)',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'U là trời! {name} mừng hẳn {count} {gift}! Đại gia tới rồi, cả rạp đứng dậy chào!',
      'Cảm ơn {name} đã mừng {count} {gift}! Hào phóng vậy chắc chắn không ế được lâu đâu!',
      '{name} chơi lớn quá, {count} {gift} luôn! Chúc bạn tiền vô như nước, bồ tới như mưa!',
      'Đỉnh nóc kịch trần! {name} mừng {count} {gift}, tối nay cô dâu chú rể đếm quà mỏi tay!',
      'Cảm ơn {name} nha! Mừng quà xịn vậy, năm sau MC làm đám cưới miễn phí cho bạn!',
      '{name} vừa mừng {count} {gift}! Người gì đâu vừa giàu vừa dễ thương, có bồ chưa vậy?'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'thanksPlain',
    label: 'Cảm ơn quà — lịch sự (khi tắt MC hài hước)',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Cảm ơn {name} đã mừng {count} {gift} cho {groom} và {bride}! Chúc bạn luôn vui và gặp nhiều may mắn!',
      'Rạp cưới cảm ơn {name} đã gửi {count} {gift}! Chúc bạn sức khỏe và thật nhiều niềm vui!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftPetal',
    label: 'Quà → Mưa hoa hồng',
    vars: '{name} {gift} {count}',
    lines: [
      'Cảm ơn {name} mừng {count} {gift}! Hoa rơi đầy rạp, lãng mạn muốn xỉu!',
      'Mưa hoa hồng tới! {name} làm cả rạp thơm phức luôn!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftKiss',
    label: 'Quà → Cô dâu chú rể hôn',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      '{name} hô hôn đi! {groom} và {bride} phát cơm chó cho cả rạp nè!',
      'Cảm ơn {name}! Hôn một cái cho hội ế ghen tị chơi!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftDance',
    label: 'Quà → Lên sàn nhảy',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} lên sàn quẩy cháy máy! Cả rạp bung lụa theo nào!',
      'Nhạc lên! {name} nhảy sung quá, ai ngồi im là già đó nha!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftCake',
    label: 'Quà → Cắt bánh cưới',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Cảm ơn {name}! Cô dâu chú rể cắt bánh nào, nhớ chừa MC một miếng!',
      '{name} đãi bánh cưới! {groom} và {bride} cắt lẹ cho cả rạp ăn với!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftChampagne',
    label: 'Quà → Rót rượu sâm panh',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} khui sâm panh! Rót tràn ly, hôm nay không say không về!',
      'Bốp! {name} mở rượu mừng, cả rạp nâng ly nào!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftCheers',
    label: 'Quà → Cụng ly',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} mời cả rạp! Một, hai, ba, dzô! Hai, ba, uống!',
      'Cụng ly nào! {name} bao, cả rạp cứ uống thoải mái!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftRing',
    label: 'Quà → Trao nhẫn',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      '{name} giục trao nhẫn! {groom} và {bride} đeo vô là hết đường chạy nha!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftDongphong',
    label: 'Quà → Động phòng',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Gấp lắm rồi! {name} mừng {gift}, đẩy {groom} và {bride} vô động phòng luôn!',
      'U là trời, {name} chơi lớn! Cô dâu {bride} và chú rể {groom} vô động phòng, cả nhà hóng nào!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'bouquet',
    label: 'Quà → Tung hoa cưới',
    vars: '{name} {catcher} {bride}',
    lines: [
      'Cô dâu tung hoa! Người bắt được là {catcher}! Sắp thoát ế rồi nha!',
      'Bó hoa bay vèo trúng ngay {catcher}! Chuẩn bị thiệp cưới đi là vừa!',
      'Cảm ơn {name}! Hoa cưới rơi vô tay {catcher}, năm nay không cưới là MC phạt!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'fireworks',
    label: 'Quà → Bắn pháo hoa',
    vars: '{name}',
    lines: [
      'Bùm chíu! {name} bắn pháo hoa, sáng rực cả rạp luôn!',
      'Pháo hoa tới! Cảm ơn {name}, đẹp muốn xỉu ngang!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'musicChange',
    label: 'Quà → Đổi nhạc',
    vars: '{name} {track}',
    lines: [
      '{name} đổi nhạc! Bài {track} lên rồi, quẩy tiếp nào cả nhà!',
      'Nhạc mới theo yêu cầu của {name}! Ai không nhún là hơi kỳ nha!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'marryMC',
    label: 'Quà → Cưới MC',
    vars: '{name}',
    lines: [
      'Ơ kìa, {name} tặng quà đòi cưới MC! Mẹ ơi con có người hốt rồi!',
      '{name} cầu hôn MC giữa rạp! MC ngại quá mà MC đồng ý nha!',
      'Cứu! {name} đòi cưới MC! Thôi được, MC ế lâu rồi nên chốt luôn!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'photo',
    label: 'Chụp ảnh cưới / ảnh chung (MC nói)',
    vars: '{name} {groom} {bride} {number}',
    lines: [
      'Cả nhà nhìn đây! Một, hai, ba, cười! Ai nhắm mắt MC không chịu trách nhiệm nha!',
      'Tách! Ảnh cưới của {groom} và {bride} lên sóng, chụp màn hình lưu lại lẹ!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'photoCaption',
    label: 'Chú thích ảnh cưới (chỉ hiển thị)',
    vars: '{number} {groom} {bride}',
    lines: [
      'Cặp đôi số {number} hôm nay, chính thức thoát ế 💍',
      '{groom} và {bride} về chung một nhà, cấm trả hàng nha 💕'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'photoGiftCaption',
    label: 'Chú thích ảnh chung do khách tặng quà (chỉ hiển thị)',
    vars: '{name} {groom} {bride}',
    lines: [
      '{name} chụp chung với cô dâu {bride} và chú rể {groom} 📸',
      'Kỷ niệm của {name} ở rạp cưới, lấy vía thoát ế 💕'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'goalRose',
    label: 'Đạt mục tiêu mưa hoa hồng',
    vars: '{groom} {bride}',
    lines: [
      'Đủ hoa hồng rồi cả nhà ơi! Mưa hoa đổ xuống, lãng mạn hết nấc!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'goalCake',
    label: 'Đạt mục tiêu cắt bánh',
    vars: '{groom} {bride}',
    lines: [
      'Đủ chỉ tiêu bánh rồi! Mời cô dâu chú rể cắt cái bánh to nhất rạp!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'cardWishes',
    label: 'Lời chúc trên thẻ chúc mừng (chỉ hiển thị, không đọc)',
    vars: '',
    lines: [
      'Chúc hai bạn bên nhau tới răng long đầu bạc!',
      'Chúc tiền vô như nước, tình thắm như keo!',
      'Chúc sớm có em bé cho cả rạp ăn đầy tháng!',
      'Chúc cãi nhau ít thôi, thương nhau nhiều vô!',
      'Chúc trăm năm hạnh phúc, cấm trả hàng!'
    ]
  }
];

const MC_KEYS = new Set(MC_GROUPS.map(g => g.key));

function defaultMcLines() {
  return Object.fromEntries(MC_GROUPS.map(g => [g.key, g.lines.slice()]));
}

// Mọi câu mặc định của các bản trước. Nhóm nào trong cài đặt đã lưu chỉ gồm toàn câu cũ này (tức người dùng
// chưa tự sửa nhóm đó) thì đổi sang bộ câu mới; nhóm có câu người dùng tự viết thì giữ nguyên.
const OLD_DEFAULT_LINES = new Set(require('./mc_lines_cu.json'));

// Giữ câu do người dùng sửa; nhóm thiếu -> lấy mặc định; mảng rỗng = MC im lặng ở sự kiện đó
function sanitizeMcLines(input) {
  const out = defaultMcLines();
  if (!input || typeof input !== 'object') return out;
  for (const key of MC_KEYS) {
    if (!Array.isArray(input[key])) continue;
    const lines = input[key]
      .map(l => String(l ?? '').replace(/\s+/g, ' ').trim().slice(0, 400))
      .filter(Boolean)
      .slice(0, 20);
    if (lines.length && lines.every(l => OLD_DEFAULT_LINES.has(l))) continue; // chưa sửa gì: dùng bộ câu mới
    out[key] = lines;
  }
  return out;
}

module.exports = { MC_GROUPS, defaultMcLines, sanitizeMcLines };
