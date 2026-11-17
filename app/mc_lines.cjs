// ========================================================
// LỜI THOẠI MC MẶC ĐỊNH — giọng trẻ trung, lầy lội cho người xem trẻ trên TikTok
// Mỗi nhóm: nhiều câu, MC đọc luân phiên (không lặp lại câu vừa đọc).
// Biến trong {ngoặc nhọn} được tool tự điền khi có sự kiện.
// Sửa trong bảng điều khiển: tab "Lời thoại MC" (lưu vào wedding_state.json).
// Câu phải ngắn (khoảng 12 từ trở xuống, một ý một câu): câu dài MC đọc không kịp, người xem nghe mệt. Riêng thơ thì để dài.
// ========================================================

const MC_GROUPS = [
  // ---------------- DẪN CHƯƠNG TRÌNH ----------------
  {
    section: 'Dẫn chương trình',
    key: 'welcome',
    label: 'Chào khách mới vào phòng',
    vars: '{names}',
    lines: [
      'Ố là la, {names} tới rồi! Vô ăn cưới lẹ nè!',
      '{names} đáp xuống rạp! Ăn cỗ trước, cưới tính sau nha!',
      'Chào {names}! Tới trễ không sao, có phong bì là được!',
      'Rạp đón {names}! Ai ế giơ tay, MC bao thoát ế!',
      'Cơm nước gì chưa {names}? Vô ăn cỗ cưới nè!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'intro',
    label: 'Giới thiệu cách chơi & quà (MC tự nói khi vắng)',
    vars: '{groom} {bride} {min} {gifts} {afterWed}',
    lines: [
      'Không cần người yêu, {min} xu là lên xe hoa liền!',
      'Tặng {min} xu là có vai, tặng nhiều hơn là cướp vai!',
      'Gõ dzô để cụng ly, gõ nhảy để cả rạp quẩy!',
      'Gõ hôn đi là cô dâu chú rể phát cơm chó liền!',
      'Gõ làm cô dâu rồi tặng quà là có chồng liền!',
      'Thả tim đi cả nhà, ngồi im là MC tưởng ế thật đó!',
      '{afterWed}'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'waitGroom',
    label: 'Chờ chú rể (vai chú rể đang trống)',
    vars: '{bride} {min}',
    lines: [
      'Ét ô ét, cô dâu {bride} đứng một mình kìa!',
      'Tuyển chú rể gấp! Không cần nhà xe, chỉ cần {min} xu!',
      'Cô dâu {bride} xinh vậy mà chưa ai rước hả?',
      'Thiếu đúng một ông chồng! Tặng {min} xu nhận vai nào!',
      'Anh nào bị mẹ giục cưới? {min} xu là có vợ liền!',
      'Vợ con gì chưa người đẹp trai? {min} xu là có vợ!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'waitBride',
    label: 'Chờ cô dâu (vai cô dâu đang trống)',
    vars: '{groom} {min}',
    lines: [
      'Chú rể {groom} chờ muốn mốc luôn rồi! Chị em cứu ảnh đi!',
      'Khỏi yêu đương mệt mỏi, gõ làm cô dâu rồi tặng {min} xu!',
      'Váy cưới miễn phí, chồng có sẵn, thiếu mỗi cô dâu!',
      'Chú rể {groom} cũng được mà chưa ai hốt hả?',
      'Muốn có chồng trong ba mươi giây? Gõ làm cô dâu nha!',
      'Chồng con gì chưa người đẹp? {min} xu là có chồng!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'idleSocial',
    label: 'Rủ rê làm quen, kết bạn (MC nói xen lúc rạp vắng)',
    vars: '{groomHow} {brideHow}',
    lines: [
      'Ai đang ế thì vô đây, biết đâu gặp người trong mộng!',
      'Cưới ảo mà quen thật là có thiệt nha bà con!',
      'Thấy ai dễ thương chưa? Lên giành vai cưới liền đi!',
      'Bình luận chào nhau đi, ngại gì, toàn hội ế cả mà!',
      'Crush đang xem chung hả? Rủ vô cưới thử một lần!',
      'Một mình coi live buồn lắm, lên xe hoa cho vui!',
      'Cưới rồi thì chụp màn hình khoe bạn bè đi!',
      'Muốn có đôi thì {groomHow} hoặc {brideHow} nha!',
      'Cơm nước gì chưa người đẹp? Chưa thì vô ăn cỗ cưới!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'idleFollow',
    label: 'Mời theo dõi, bấm chuông, chia sẻ (MC nói xen lúc đang tìm cô dâu chú rể)',
    vars: '',
    lines: [
      'Trong lúc chờ đủ đôi, bấm theo dõi cho MC vui nha!',
      'Bấm chuông đi cả nhà, rạp mở là có thông báo liền!',
      'Chia sẻ live rủ hội ế vô, đông mới dễ thoát ế!',
      'Theo dõi, bấm chuông, chia sẻ, ba nút cứu cả hội ế!',
      'Chưa theo dõi hả? Bấm đi, mai có đám cưới MC gọi!',
      'Bấm chuông kẻo lỡ đám cưới sau nha cả nhà!',
      'Rủ crush vô cưới thử đi, bấm chia sẻ liền nào!',
      'Chờ cô dâu chú rể thì bấm theo dõi trước nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'challenge',
    label: 'Khích cướp vai (đã đủ đôi, chưa làm lễ)',
    vars: '{groom} {bride} {groomBid} {brideBid}',
    lines: [
      'Ghế chú rể {groomBid} xu, ghế cô dâu {brideBid} xu. Ai cướp không?',
      '{groom} với {bride} hạnh phúc quá, ai muốn phá không?',
      'Rẻ hơn ly trà sữa mà được cưới, ai chốt nào?'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'countdownStart',
    label: 'Đủ đôi — bắt đầu đếm ngược làm lễ',
    vars: '{groom} {bride} {seconds} {crashHow}',
    lines: [
      'Chốt đơn! {groom} và {bride}, {seconds} giây nữa cưới!',
      'U là trời, đủ đôi! {groom} với {bride}, còn {seconds} giây!',
      '{groom} và {bride} sắp cưới! Ai ngứa mắt thì {crashHow}!',
      'Người yêu cũ đâu rồi? {groom} và {bride} sắp cưới kìa!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'countdownRemind',
    label: 'Nhắc giờ làm lễ (khi vắng, đang đếm ngược)',
    vars: '{groom} {bride} {seconds}',
    lines: [
      'Còn {seconds} giây nữa {groom} và {bride} thành vợ chồng!',
      'Còn {seconds} giây! Giờ không phá thì lát đừng khóc nha!',
      '{seconds} giây nữa thôi! Hội ế chuẩn bị ăn cơm chó nào!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'share',
    label: 'Cảm ơn chia sẻ rạp cưới',
    vars: '{names}',
    lines: [
      'Cảm ơn {names} đã chia sẻ! Rủ thêm hội ế vô nha!',
      '{names} vừa đi phát thiệp cưới giùm MC! Chúc sớm có bồ!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'follow',
    label: 'Cảm ơn theo dõi kênh',
    vars: '{names}',
    lines: [
      'Cảm ơn {names} đã theo dõi! Từ nay là người nhà rồi!',
      '{names} vừa bấm theo dõi, MC ghi sổ ân nhân nha!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'likeGoal',
    label: 'Đủ tim — cả rạp đứng dậy quẩy',
    vars: '{likes}',
    lines: [
      'Đủ {likes} tim rồi! Quẩy đi, ai ngồi im là ế!',
      'Tim ngập rạp luôn rồi! Nhạc lên, bung lụa nào!'
    ]
  },
  {
    section: 'Dẫn chương trình',
    key: 'partyCouples',
    label: 'Đủ số cặp cưới — cả rạp mở tiệc quẩy',
    vars: '{couples}',
    lines: [
      'Cặp thứ {couples} cưới xong rồi! Mở tiệc quẩy thôi!',
      'Chúc mừng cặp số {couples}! Ai ngồi im là ế nha!',
      'Đủ cặp rồi bà con ơi! Quẩy banh nóc rạp luôn!'
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
      'Rạp buồn quá, MC đãi {effect} nè! Thích thì tặng {gift} nha!',
      'Im re vậy trời! MC bao {effect} một lần nè!',
      'MC mở hàng {effect}! Muốn xem nữa thì tặng {gift}!',
      'Quà đâu hết rồi? MC đãi {effect} luôn, thích thì tặng {gift}!'
    ]
  },
  // ---------------- VAI CÔ DÂU – CHÚ RỂ & ĐẤU GIÁ ----------------
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomTaken',
    label: 'Nhận vai chú rể (vai đang trống)',
    vars: '{name} {gift} {count} {bid} {bride}',
    lines: [
      'Chúc mừng {name} thoát ế với {bid} xu!',
      'Có chú rể rồi! {name} quá nhanh quá nguy hiểm!',
      'Đẹp trai chưa biết, nhanh tay thì có! {name} làm chú rể!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideTaken',
    label: 'Nhận vai cô dâu (vai đang trống)',
    vars: '{name} {gift} {count} {bid} {groom}',
    lines: [
      'Cô dâu xuất hiện! {name} xinh hết nước chấm!',
      'Chú rể {groom} hết ế rồi nha! Cô dâu là {name}!',
      'Váy cưới có chủ! {name} chính thức làm cô dâu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomStolen',
    label: 'Cướp ngôi chú rể',
    vars: '{name} {previous} {bid} {bride}',
    lines: [
      'Tới công chuyện! {name} đá bay chú rể {previous}!',
      '{previous} ơi mất vợ rồi! Chú rể giờ là {name}!',
      '{name} cướp chú rể với {bid} xu! {previous} ra chuồng gà nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideStolen',
    label: 'Cướp ngôi cô dâu',
    vars: '{name} {previous} {bid} {groom}',
    lines: [
      'Biến căng! {name} giật vai cô dâu của {previous}!',
      'Cô dâu mới là {name}! {previous} ơi giành lại chồng đi!',
      'Chú rể {groom} ơi, vợ anh đổi thành {name} rồi!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'bidMissing',
    label: 'Đấu giá chưa đủ xu',
    vars: '{name} {role} {bid} {missing} {holder}',
    lines: [
      '{name} thiếu {missing} xu nữa là đá được {holder}!',
      'Suýt được rồi {name} ơi! Thêm {missing} xu nữa thôi!',
      '{holder} toát mồ hôi! {name} chỉ còn thiếu {missing} xu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'bidDefended',
    label: 'Người đang giữ vai tặng thêm (giữ ngôi)',
    vars: '{name} {role} {bid}',
    lines: [
      '{name} nâng giá lên {bid} xu giữ vai {role}! Lỳ ghê!',
      'Đừng hòng nha! {name} tăng lên {bid} xu để giữ ghế!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queued',
    label: 'Đặt cọc vai cho lượt sau (tặng trong lúc làm lễ)',
    vars: '{name} {role}',
    lines: [
      'Đang làm lễ, {name} chờ xíu, lượt sau làm {role} nha!',
      'Ghi nhận {name}! Lễ xong là lên làm {role} liền!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queuedApplied',
    label: 'Lượt mới: người đặt cọc nhận vai',
    vars: '{name} {role}',
    lines: [
      'Lượt mới! {name} đặt chỗ trước nên làm {role} luôn!',
      'Hàng đặt trước tới rồi! {name} lên làm {role} nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queueJoined',
    label: 'Hàng chờ: xếp hàng thành công',
    vars: '{name} {role} {position} {holder}',
    lines: [
      '{name} bốc số {position} làm {role}, chờ xíu là có đôi!',
      'Ghi tên {name} số {position}! Sốt ruột thì tặng quà chen lên!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queueAlready',
    label: 'Hàng chờ: nhắc lại chỗ đã giữ',
    vars: '{name} {role} {position}',
    lines: [
      '{name} ơi bình tĩnh, bạn đang số {position} rồi đó!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queueHead',
    label: 'Hàng chờ: xếp hàng đứng đầu, lên chức "lốp trưởng"',
    vars: '{name} {role} {position} {holder}',
    lines: [
      '{name} lên chức lốp trưởng, chờ lên lốp chính nha!',
      'Lốp trưởng mới: {name}! Sốt ruột thì tặng quà chen lên!',
      '{name} đứng đầu hàng chờ làm {role}, lốp trưởng đây rồi!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'queuePromoted',
    label: 'Hàng chờ: tới lượt lên sân khấu',
    vars: '{name} {role}',
    lines: [
      'Tới lượt rồi! {name} lên sân khấu làm {role} nào!',
      'Chờ mỏi cổ cũng tới! {name} chính thức làm {role}!',
      'Lốp trưởng {name} lên lốp chính rồi! Làm {role} nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'pairSoon',
    label: 'Ghép đôi ngẫu nhiên: nhắc trước khi chọn',
    vars: '{seconds}',
    lines: [
      'Còn {seconds} giây nữa MC bốc đại một người lên cưới!',
      'Chưa ai nhận vai? {seconds} giây nữa MC bốc thăm nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'partnerSoon',
    label: 'Ghép đôi ngẫu nhiên: có người đang chờ nửa kia, nhắc trước khi MC chọn',
    vars: '{name} {role} {other} {seconds}',
    lines: [
      '{name} chờ mỏi chân rồi! {seconds} giây nữa MC bốc đại {other}!',
      'Còn {seconds} giây! Ai muốn làm {other} của {name} nào?',
      '{role} {name} ế tới nơi rồi! {seconds} giây nữa MC quay số!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'firstPick',
    label: 'Ghép đôi ngẫu nhiên: chưa ai nhận vai, MC mời một khách lên trước',
    vars: '{name} {role} {other}',
    lines: [
      'MC bốc trúng {name} làm {role}! Còn thiếu {other}, ai hốt?',
      '{name} bị kéo lên làm {role}! Giờ cần một {other} nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'randomPair',
    label: 'Ghép đôi ngẫu nhiên: MC chọn cả hai vai',
    vars: '{groom} {bride}',
    lines: [
      'MC gả đại: {groom} cưới {bride}! Không ưng thì cướp!',
      'Ông tơ bà nguyệt se bừa: {groom} và {bride} lên sân khấu!',
      'MC bốc túi mù: {groom} bốc trúng sít rịt {bride}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'randomRole',
    label: 'Ghép đôi ngẫu nhiên: MC chọn vai còn thiếu',
    vars: '{name} {role} {partner}',
    lines: [
      'MC bốc trúng {name} làm {role}! {partner} ơi, nửa kia nè!',
      '{name} bị MC gả đại làm {role}! Không ưng thì giành lại!',
      '{partner} bốc trúng sít rịt rồi: {name} làm {role} nè!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'hostPick',
    label: 'Ghép đôi ngẫu nhiên: rạp chưa có khách, mời chủ phòng lên vai',
    vars: '{name} {role} {partner}',
    lines: [
      'Không ai nhận thì chủ phòng {name} lên làm {role} luôn!',
      'Ế tới mức chủ phòng {name} phải tự lên làm {role}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'introQueue',
    label: 'Luật quà vào vai: giới thiệu cách chơi',
    vars: '{title} {gifts} {groomHow} {brideHow} {heldHow} {afterWed}',
    lines: [
      'Chào cả nhà đến với {title}! Ế mấy cũng cưới được!',
      'Cứ {groomHow} là có vợ, {brideHow} là có chồng!',
      'Muốn thoát ế trong ba mươi giây? Lên sân khấu cưới liền!',
      'Nhớ nha: {heldHow}!',
      '{afterWed}'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'waitGroomQueue',
    label: 'Luật Hàng chờ: mời nhận vai chú rể',
    vars: '{groomHow}',
    lines: [
      'Ét ô ét, thiếu chú rể! Cứ {groomHow} là có vợ!',
      'Tuyển chú rể gấp! Chỉ cần {groomHow} là lên xe hoa!',
      'Bị mẹ giục cưới hả? Cứ {groomHow} là xong!',
      'Vợ con gì chưa người đẹp trai? Chưa thì {groomHow}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'waitBrideQueue',
    label: 'Luật Hàng chờ: mời nhận vai cô dâu',
    vars: '{brideHow}',
    lines: [
      'Khỏi yêu đương mệt mỏi, cứ {brideHow} là có chồng!',
      'Váy có sẵn, chồng có sẵn, chỉ cần {brideHow}!',
      'Chị em muốn mặc váy cưới? Cứ {brideHow} nha!',
      'Chồng con gì chưa người đẹp? Chưa thì {brideHow} nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rolesOpenQueue',
    label: 'Luật Hàng chờ: vai mở lại sau lễ',
    vars: '{groomHow} {brideHow}',
    lines: [
      'Sân khấu trống rồi! Nhanh tay kẻo ế nha cả nhà!',
      'Vai mở lại rồi! Làm chú rể thì {groomHow} nha!',
      'Vai mở lại rồi! Làm cô dâu thì {brideHow} nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomTakenQueue',
    label: 'Luật Hàng chờ: có người nhận vai chú rể',
    vars: '{name} {bride}',
    lines: [
      'Chúc mừng {name} thoát ế, chính thức làm chú rể!',
      'Chú rể {name} bảnh ghê! Chị em vô nhận chồng nào!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideTakenQueue',
    label: 'Luật Hàng chờ: có người nhận vai cô dâu',
    vars: '{name} {groom}',
    lines: [
      'Cô dâu {name} xuất hiện, xinh hết nước chấm!',
      'Chúc mừng {name} thành cô dâu! Mấy anh vô rước dâu lẹ!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'revengeCall',
    label: 'Kèo đấu: khích người vừa bị đá đòi lại vai (đọc nối sau câu cướp vai)',
    vars: '{name} {previous} {role} {seconds}',
    lines: [
      '{previous} ơi, {seconds} giây đòi lại ghế nè!',
      '{previous} nhịn thiệt hả? Có {seconds} giây phục thù đó!',
      '{previous} có {seconds} giây đá lại {name}, chơi không?'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'revengeDone',
    label: 'Kèo đấu: phục thù thành công (người bị đá giành lại vai)',
    vars: '{name} {previous} {role} {round} {a} {b}',
    lines: [
      'Phục thù! {name} lấy lại ghế {role}, tỉ số {a} – {b}!',
      'Ối dồi ôi, {previous} chưa ấm ghế đã văng! Tỉ số {a} – {b}!',
      'Có thù phải trả! {name} đòi lại ghế {role} rồi!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'duelRound',
    label: 'Kèo đấu: hai người giành qua giành lại (từ hiệp 2)',
    vars: '{name} {previous} {role} {round} {a} {b}',
    lines: [
      'Hiệp {round}! {name} lại đá văng {previous}, tỉ số {a} – {b}!',
      'Căng như dây đàn! Hiệp {round} rồi, tỉ số {a} – {b}!',
      'Kèo cháy quá! {name} {a}, {previous} {b}! Ai gỡ nào?'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomReplaced',
    label: 'Quà thay chú rể',
    vars: '{name} {previous} {bride}',
    lines: [
      'Tới công chuyện! {name} đá bay chú rể {previous}!',
      'Chú rể {previous} bay màu! Chồng mới của {bride} là {name}!',
      '{previous} ra chuồng gà nha! {name} mới là chú rể!',
      '{name} chen ngang quá gắt! Thua Gia Cát Lượng đúng cây quạt!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideReplaced',
    label: 'Quà thay cô dâu',
    vars: '{name} {previous} {groom}',
    lines: [
      'Biến căng! {name} lên thay cô dâu {previous}!',
      'Cô dâu {previous} bay màu! Vợ mới của {groom} là {name}!',
      '{previous} ơi mất chồng rồi! {name} mới là cô dâu!',
      '{name} chen ngang quá gắt! Thua Gia Cát Lượng đúng cây quạt!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'cancel',
    label: 'Hủy hôn, phá đám',
    vars: '{name} {groom} {bride}',
    lines: [
      'Toang rồi! {name} phá đám, {groom} và {bride} bay màu!',
      'Thuyền chìm! {name} phá đám cưới của {groom} và {bride}!',
      '{name} lật bàn, {groom} với {bride} chạy mất dép!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'cancelBlocked',
    label: 'Phá đám bị chặn (đang làm lễ)',
    vars: '{name}',
    lines: [
      '{name} phá đám trễ rồi, bảo vệ khiêng ra ngoài nha!',
      'Trễ rồi {name} ơi! Lần sau phá sớm xíu nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rivalsWed',
    label: 'Chuyện cũ: hai người từng đá nhau giành vai, giờ lại cưới nhau',
    vars: '{groom} {bride} {role} {rounds} {seconds} {crashHow}',
    lines: [
      'Ủa! {groom} với {bride} mới đá nhau, giờ cưới nhau luôn!',
      'Đấu {rounds} hiệp xong {groom} và {bride} dắt nhau lên xe hoa!',
      '{groom} và {bride} từ kẻ thù thành vợ chồng luôn!',
      'Ghét của nào trời trao của đó! {groom} cưới {bride}!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'coupleAgain',
    label: 'Chuyện cũ: cặp này đã cưới nhau rồi, giờ cưới lại',
    vars: '{groom} {bride} {before} {times} {seconds} {crashHow}',
    lines: [
      'Lại là {groom} với {bride}? Cưới {before} lần chưa chán hả!',
      'Người quen đây rồi! {groom} và {bride} cưới lần thứ {times}!',
      '{groom} với {bride} cưới hoài, MC thuộc tên luôn rồi!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'brideSwitched',
    label: 'Chuyện cũ: cô dâu vừa cưới người khác, giờ cưới chú rể mới',
    vars: '{groom} {bride} {ex} {seconds} {crashHow}',
    lines: [
      'Rồi luôn! Cô dâu {bride} bỏ {ex} để cưới {groom}!',
      'Quay xe gắt! {bride} mới cưới {ex}, giờ theo {groom}!',
      '{bride} bỏ {ex} theo {groom}! {ex} ơi còn {seconds} giây đó!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'groomSwitched',
    label: 'Chuyện cũ: chú rể vừa cưới người khác, giờ cưới cô dâu mới',
    vars: '{groom} {bride} {ex} {seconds} {crashHow}',
    lines: [
      'Rồi luôn! Chú rể {groom} bỏ {ex} để cưới {bride}!',
      'Bẻ lái khét lẹt! {groom} mới cưới {ex}, giờ rước {bride}!',
      '{groom} bỏ {ex} cưới {bride}! {ex} ơi còn {seconds} giây đó!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'roleHeld',
    label: 'Bình luận xin vai nhưng vai đang có người (không hàng chờ)',
    vars: '{name} {role} {holder} {gift}',
    lines: [
      'Vai {role} có {holder} rồi, {name} tặng {gift} mà giành!',
      '{name} muốn làm {role}? Tặng {gift} là {holder} bay màu!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'holderLeft',
    label: 'Người giữ vai đã rời phòng — mở lại vai',
    vars: '{name} {role}',
    lines: [
      '{name} trốn mất tiêu rồi! Vai {role} mở lại nè!',
      '{name} chắc sợ cưới nên chuồn rồi! Vai {role} trống nha!'
    ]
  },
  {
    section: 'Vai cô dâu – chú rể & đấu giá',
    key: 'rolesOpen',
    label: 'Mở lại vai (khi bấm nút trong bảng điều khiển)',
    vars: '{min}',
    lines: [
      'Vai mở lại! {min} xu là lên xe hoa, ế chi cho khổ!'
    ]
  },
  // ---------------- BIẾN CỐ & VAI PHỤ ----------------
  // Trend TikTok chỉ dùng ở chỗ tình huống trên màn hình đúng là tình huống người ta dùng câu đó ngoài đời:
  // "lốp trưởng" cho người đứng đầu hàng chờ, "dạ gỗ xà cừ" lúc chú rể né câu hỏi của bố vợ, "hướng nội hết phần đời
  // còn lại" cho người vừa bị bẽ mặt, "thua Gia Cát Lượng đúng cây quạt" cho người tính nước khéo, "bốc trúng sít rịt" lúc
  // bốc thăm ghép đôi. Không hợp cảnh thì không dùng. Trend cũ đi thì sửa ở tab "Lời thoại MC" của bảng điều khiển.
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExStart',
    label: 'Người yêu cũ xông vào phản đối (một khách bất kỳ được MC chọn)',
    vars: '{name} {target} {groom} {bride}',
    lines: [
      'Khoan đã! {name} xông vào đòi lại {target} kìa!',
      'Biến căng! Người yêu cũ {name} tới phản đối đám cưới!',
      'Tình cũ không rủ cũng tới! {name} đòi lại {target}!',
      'Toang! {name} tới đòi lại tiền trà sữa của {target}!',
      'Người yêu cũ {name} tới rồi! Ai làm vệ sĩ cho đôi trẻ nào?'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExQueue',
    label: 'Lốp trưởng đòi lên: người đứng đầu hàng chờ xông ra đòi thay vai',
    vars: '{name} {target} {role} {holder}',
    lines: [
      'Khoan đã! Lốp trưởng {name} chờ hết nổi, đòi lên làm {role}!',
      'Xếp hàng mỏi cổ rồi! Lốp trưởng {name} đòi thay {holder} luôn!',
      'Lốp trưởng {name} tuyên bố: lốp dự phòng cũng chạy tốt nha!',
      'Lốp trưởng {name} đòi lên lốp chính! Ai che chắn cho {holder} nào?'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExReal',
    label: 'Người xông vào là vợ / chồng cũ thật trong sổ cưới',
    vars: '{name} {target} {times}',
    lines: [
      'Check VAR: {name} từng cưới {target} rồi, giờ quay lại đòi người!',
      'Vợ chồng cũ thật luôn! {name} tới giành lại {target}!',
      'Sổ cưới còn ghi rõ: {name} cưới {target} {times} lần rồi!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExWin',
    label: 'Cả rạp che chắn thành công, người xông vào ra về',
    vars: '{name} {hero}',
    lines: [
      'Che chắn thành công! {name} ôm hận ra về!',
      '{name} bị đẩy ra giữa rạp, xin hướng nội hết phần đời còn lại!',
      '{hero} che chắn nhiệt nhất, phong làm vệ sĩ tình yêu!',
      'Tình yêu đấm bay {name} rồi, khỏi đòi tiền trà sữa!',
      'Tạm biệt {name}! Hẹn lượt sau quay lại nha!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExSteal',
    label: 'Che chắn không kịp: người xông vào cướp vai (vai do MC chọn ngẫu nhiên)',
    vars: '{name} {previous} {role} {partner}',
    lines: [
      'Cướp trắng trợn! {name} đá bay {previous}, lên làm {role} luôn!',
      'Rạp che chắn chậm quá! {previous} mất {partner} về tay {name}!',
      'Quay xe khét lẹt! {name} cưới {partner}, {previous} ra chuồng gà!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExStay',
    label: 'Che chắn không kịp nhưng vai đã có người tự nhận: người xông vào ở lại dự cưới',
    vars: '{name}',
    lines: [
      '{name} không chịu về! Thôi ở lại làm khách bất đắc dĩ!',
      'Vai có chủ rồi! {name} ngồi mâm trên dự cưới cho cay!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistExBought',
    label: 'Người xông vào tự tặng quà thay vai giữa biến cố: cướp thành công',
    vars: '{name} {previous} {role} {partner}',
    lines: [
      '{name} chơi lớn, tặng quà cướp {partner} luôn!',
      'Khỏi cần giành giật! {name} tặng quà lên làm {role}, {previous} bay màu!',
      '{name} tính nước này, thua Gia Cát Lượng đúng cây quạt!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistCut',
    label: 'Người khác tặng quà thay vai giữa biến cố: chen ngang, biến cố giải tán',
    vars: '{name} {previous} {role} {partner}',
    lines: [
      '{name} chen ngang lên làm {role}! Biến cố giải tán!',
      'Trai cò đánh nhau, {name} làm ngư ông đắc lợi!',
      '{name} chờ đúng lúc mới ra tay, thua Gia Cát Lượng đúng cây quạt!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistGiftEx',
    label: 'Có người tặng quà lúc đang che chắn: người tặng làm vệ sĩ',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} tung {gift} làm vệ sĩ, kẻ phá đám lùi ba bước!',
      'Vệ sĩ {name} ra tay! {gift} đỡ đạn cho đôi trẻ!',
      '{name} bảo kê đám cưới bằng {gift}, uy tín luôn!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistDowryStart',
    label: 'Bố vợ thách cưới',
    vars: '{dad} {groom} {bride} {need}',
    lines: [
      'Bố vợ {dad} thách cưới! Bình luận dạ bố lẹ lên!',
      'Bố vợ hỏi lương, chú rể {groom} đáp: dạ gỗ xà cừ ạ!',
      'Bố vợ hỏi {groom}: nhà đâu, xe đâu, sổ đỏ đâu?',
      '{groom} đang trong quá trình tích lũy tài sản, cả rạp cứu với!',
      'Bố vợ {dad} đòi sính lễ! Ai góp một lễ vật giùm {groom} nào?'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistDowryWin',
    label: 'Bố vợ gật đầu',
    vars: '{dad} {groom} {hero}',
    lines: [
      'Bố vợ gật đầu! Gửi luôn thiệp hoa hồng lấp lánh chúc mừng!',
      'Bố vợ cắn thử vàng rồi, vàng thật! Cho cưới!',
      '{hero} góp sính lễ nhiệt nhất, bố vợ nhận làm con nuôi!',
      'Bố vợ gật đầu rồi! {groom} được tặng luôn sổ đỏ!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistDowryKick',
    label: 'Bố vợ lắc đầu: chú rể do MC chọn bị đuổi',
    vars: '{groom} {bride}',
    lines: [
      'Bố vợ lắc đầu! {groom} bị đuổi, tuyển rể mới gấp!',
      'Bố vợ rút chổi lông gà! {groom} chạy mất dép!',
      '{groom} bị đuổi giữa rạp, xin hướng nội hết phần đời còn lại!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistDowrySoft',
    label: 'Bố vợ lắc đầu nhưng chú rể đã tự nhận vai: chỉ bị phạt vui',
    vars: '{groom}',
    lines: [
      'Bố vợ chưa ưng! Phạt {groom} ở rể ba năm rửa chén!',
      'Thiếu sính lễ! {groom} cưới được nhưng phải ở rể nha!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistGiftDowry',
    label: 'Có người tặng quà lúc bố vợ thách cưới: món quà thành sính lễ',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} góp {gift} làm sính lễ, bố vợ gật gù!',
      'Mâm sính lễ có thêm {gift} của {name}! Bố vợ cười rồi!',
      '{name} mừng {gift}, bố vợ đòi nhận làm con nuôi luôn!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistBlackoutStart',
    label: 'Cúp điện',
    vars: '',
    lines: [
      'Ối, cúp điện rồi! Ai quên đóng tiền điện vậy?',
      'Mất điện toàn rạp! Thả tim quay máy phát điện lẹ!',
      'Cúp điện! Ai đang nắm tay ai thì buông ra nha!',
      'Cúp điện rồi! Ai thắp giùm rạp một ngọn nến nào?'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistBlackoutWin',
    label: 'Điện về: một khách bị bắt quả tang',
    vars: '{name} {gag} {hero}',
    lines: [
      'Điện về rồi! Bắt quả tang {name} đang {gag}!',
      'Sáng đèn là lộ hết! {name} tranh thủ {gag} kìa!',
      '{name} đang {gag} hả? Xin hướng nội hết phần đời còn lại!',
      'Cảm ơn thợ điện {hero}! Mà {name} đang {gag} kìa!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistBlackoutLose',
    label: 'Không kịp có điện: cưới bằng ánh nến',
    vars: '',
    lines: [
      'Hết giờ! Thôi cưới bằng ánh nến cho lãng mạn!',
      'Máy phát không nổ! Đám cưới ánh nến, tình hơn hẳn!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistGiftBlackout',
    label: 'Có người tặng quà lúc cúp điện: món quà thành ngọn nến',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} thắp {gift} lên, rạp sáng hẳn một góc!',
      'Thợ điện {name} tới rồi! {gift} thay luôn máy phát!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistMassStart',
    label: 'Cưới tập thể: mời bình luận "cưới" để cưới ké',
    vars: '{slots}',
    lines: [
      'Hôm nay ngày đẹp, cưới tập thể! Còn {slots} suất cưới ké!',
      'Chồng con gì chưa người đẹp? Chưa thì gõ cưới lẹ!',
      'Ai ế giơ tay! Gõ cưới là được cưới ké liền!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistMassDone',
    label: 'Cưới tập thể: chốt các cặp cưới ké',
    vars: '{pairs}',
    lines: [
      'Chốt cưới ké: {pairs}! Lên xe hoa cả đám!',
      'Cưới tập thể có thêm {pairs}! Vỗ tay nào!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistMassNone',
    label: 'Cưới tập thể: không có ai cưới ké',
    vars: '',
    lines: [
      'Không ai cưới ké hả? Thôi đôi chính cưới một mình!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistGiftMass',
    label: 'Có người tặng quà lúc cưới tập thể: nhận suất cưới ké hạng nhất',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} tặng {gift}, nhận suất cưới ké hạng thương gia!',
      'Suất hạng nhất về tay {name}! Cưới ké mà sang như chính chủ!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistRoachStart',
    label: 'Nếu em biến thành con gián: cô dâu hóa gián thử lòng chú rể',
    vars: '{groom} {bride}',
    lines: [
      '{bride} hỏi: nếu em biến thành con gián, anh còn yêu không?',
      'Thử lòng chú rể! {bride} biến thành con gián rồi kìa!',
      'Úm ba la! {bride} hóa gián! {groom} còn yêu không?',
      '{bride} hóa gián rồi! Ai tiếp sức tình yêu cho đôi trẻ nào?'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistRoachWin',
    label: 'Con gián: cả rạp nói yêu đủ, cô dâu trở lại',
    vars: '{groom} {bride} {hero}',
    lines: [
      'Tình yêu thắng! {bride} hết làm gián, xinh lại rồi!',
      'Cả rạp làm chứng: gián cũng yêu! Cưới tiếp nào!',
      '{hero} tin vào tình yêu nhất rạp, phong làm thần tình yêu!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistRoachProved',
    label: 'Con gián: chính chú rể nói yêu (hoặc tặng quà), qua bài thử lòng ngay',
    vars: '{groom} {bride}',
    lines: [
      '{groom} hôn luôn con gián! Chồng quốc dân là đây!',
      '{groom} nói yêu không cần nghĩ! Qua bài thử lòng!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistRoachFlee',
    label: 'Con gián: không đủ lời yêu, chú rể do MC chọn bỏ chạy',
    vars: '{groom} {bride}',
    lines: [
      '{groom} bỏ chạy mất dép! Không yêu đương gì tầm này!',
      '{groom} thấy gián là chuồn! {bride} chờ rể khác nha!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistRoachSoft',
    label: 'Con gián: không đủ lời yêu nhưng chú rể đã tự nhận vai, chỉ bị phạt vui',
    vars: '{groom} {bride}',
    lines: [
      '{groom} đứng hình không nói gì! Phạt ngủ sô pha một tháng!',
      'Cưới thì vẫn cưới, nhưng {groom} nợ {bride} một lời yêu!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistGiftRoach',
    label: 'Có người tặng quà lúc cô dâu hóa gián: tiếp sức tình yêu',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} tặng {gift} tiếp sức tình yêu! Gián cũng cảm động!',
      '{name} tin vào tình yêu, {gift} bay tới tấp!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'twistHero',
    label: 'Vinh danh người tặng quà cứu đám cưới (đọc nối sau câu kết của biến cố)',
    vars: '{hero} {gift}',
    lines: [
      'Vinh danh {hero}, người hùng của đám cưới này!',
      'Không có {gift} của {hero} là toang rồi, vỗ tay nào!',
      '{hero} được ghi công cạnh đôi trẻ tới hết đám cưới!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'attendantTaken',
    label: 'Có người bình luận nhận vai phù dâu / phù rể',
    vars: '{name} {role}',
    lines: [
      '{name} nhanh tay làm {role}! Lượt sau tới bạn lên xe hoa!',
      'Có {role} rồi nha: {name}! Đứng gần lấy vía cưới!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'attendantPromoted',
    label: 'Phù dâu / phù rể lượt trước được MC chọn lên vai chính',
    vars: '{name} {role} {from}',
    lines: [
      'Lấy vía thành công! {name} từ {from} lên thẳng {role}!',
      '{name} làm {from} lượt trước, giờ lên làm {role} luôn!'
    ]
  },
  {
    section: 'Biến cố & vai phụ',
    key: 'attendantsWed',
    label: 'Cả phù dâu lẫn phù rể lượt trước lên làm cô dâu, chú rể',
    vars: '{groom} {bride}',
    lines: [
      'Phù dâu phù rể lượt trước lên xe hoa: {groom} và {bride}!',
      'Lấy vía quá đỉnh! {groom} với {bride} từ vai phụ lên vai chính!'
    ]
  },
  // ---------------- LỄ THÀNH HÔN & ĐỘNG PHÒNG ----------------
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ceremonyStart',
    label: 'Mở đầu lễ thành hôn',
    vars: '{groom} {bride}',
    lines: [
      'Giờ lành tới! Mời {groom} và {bride} lên lễ đường!',
      'Chốt đơn cưới! {groom} và {bride} hết đường lui nha!',
      'Nghiêm túc nào! Lễ cưới của {groom} và {bride} bắt đầu!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'wedDone',
    label: 'Thành hôn xong — mời tặng quà cho các bước tiếp theo',
    vars: '{groom} {bride}',
    lines: [
      '{groom} và {bride} thành vợ chồng rồi! Tặng quà xem hôn nào!',
      'Hết ế chính thức! Tặng gì là {groom} và {bride} làm nấy!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'coupleConnect',
    label: 'Sau khi thành hôn: rủ đôi trẻ kết bạn, nói chuyện với nhau',
    vars: '{groom} {bride}',
    lines: [
      '{groom} với {bride} cưới xong nhớ follow nhau nha!',
      '{groom} ơi, vô trang {bride} bấm follow đi chứ!',
      '{groom} và {bride} kết bạn đi, cưới rồi mà lạ nhau kỳ lắm!',
      'Thành đôi thật thì {groom} với {bride} nhớ mời MC nha!',
      '{bride} với {groom} nhắn nhau một câu xem, biết đâu hợp!',
      '{bride} ơi, chồng {groom} đang chờ tin nhắn kìa!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'demoFireworks',
    label: 'MC đãi: thỉnh thoảng bắn pháo hoa miễn phí để khoe tính năng',
    vars: '{groom} {bride} {gift}',
    lines: [
      'MC khao pháo hoa mừng {groom} và {bride}! Thích thì tặng {gift}!',
      'MC vui nên bắn pháo hoa! Lần sau tặng {gift} nha!',
      'Pháo hoa cây nhà lá vườn! Muốn nữa thì tặng {gift}!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'demoDongphong',
    label: 'MC đãi: thỉnh thoảng cho đôi trẻ động phòng miễn phí để khoe tính năng',
    vars: '{groom} {bride} {gift}',
    lines: [
      'MC chơi lớn, khao {groom} và {bride} một suất động phòng!',
      'MC cho đôi trẻ động phòng luôn! Cặp sau nhớ tặng {gift}!',
      'Khuyến mãi động phòng miễn phí! Lần sau tặng {gift} nha!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'receptionRemind',
    label: 'Tiệc mừng: nhắc tặng quà trước khi đôi trẻ rời sân khấu',
    vars: '{groom} {bride} {seconds}',
    lines: [
      'Còn {seconds} giây nữa đôi trẻ về mất, tặng quà lẹ!',
      'Chưa ai cho đôi trẻ động phòng hả? Còn {seconds} giây!',
      'Tặng một cái cho {groom} với {bride} hôn nhau coi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'quickwed',
    label: 'Quà "động phòng luôn" (bỏ qua các bước lễ)',
    vars: '{name} {groom} {bride}',
    lines: [
      'Chơi lớn! {name} cho {groom} và {bride} động phòng luôn!',
      'Gấp lắm rồi! Nhờ {name}, đôi trẻ vô thẳng động phòng!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ring',
    label: 'Trao nhẫn',
    vars: '{groom} {bride}',
    lines: [
      'Trao nhẫn nào! Đeo vô là hết đường chạy nha!',
      'Nhẫn nhỏ mà trách nhiệm to nha {groom} và {bride}!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'kiss',
    label: 'Hôn cô dâu',
    vars: '{groom} {bride}',
    lines: [
      'Hôn đi hôn đi! Cả rạp đếm nào: một, hai, ba!',
      'Chú rể hôn cô dâu nào! Hội ế quay mặt đi!',
      'Hôn đi! Tuyệt đối điện ảnh luôn cả nhà ơi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'cake',
    label: 'Cắt bánh cưới',
    vars: '{groom} {bride}',
    lines: [
      'Cắt bánh thôi! Nhớ chia MC một miếng nha!',
      'Bánh cưới tới! {groom} và {bride} cắt lẹ, MC đói rồi!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'champagne',
    label: 'Rót rượu sâm panh',
    vars: '{groom} {bride}',
    lines: [
      'Khui rượu! Say thì về mà yêu thì ở lại!',
      'Sâm panh nổ rồi! Cả rạp nâng ly nào!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'dongphong',
    label: 'Mời vào động phòng',
    vars: '{groom} {bride}',
    lines: [
      'Tới giờ rồi! {groom} và {bride} vô động phòng, cấm hóng!',
      'Đôi trẻ vô động phòng! Ai nhìn trộm là đau mắt đỏ!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'dongphongEnd',
    label: 'Sau động phòng',
    vars: '{groom} {bride}',
    lines: [
      'Xong rồi! Chúc {groom} và {bride} sang năm có em bé!',
      'Cửa mở rồi! {groom} với {bride} bước ra mặt tươi rói!'
    ]
  },
  {
    section: 'Lễ thành hôn & động phòng',
    key: 'ceremonyEnd',
    label: 'Kết thúc lễ — mở vai cho lượt mới',
    vars: '{groom} {bride}',
    lines: [
      'Tiễn {groom} và {bride} về dinh! Cặp tiếp theo đâu?',
      'Xong một cặp! Hội ế còn lại lên sân khấu nào!',
      '{groom} với {bride} cưới xong rồi, ai thoát ế tiếp nào?'
    ]
  },
  // ---------------- CẢM ƠN QUÀ TẶNG ----------------
  {
    section: 'Cảm ơn quà tặng',
    key: 'thanksFunny',
    label: 'Cảm ơn quà — MC hài hước (quà không gán nghi thức)',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'U là trời! {name} mừng {count} {gift}! Đại gia tới rồi!',
      'Cảm ơn {name} mừng {count} {gift}! Hào phóng vậy sao mà ế!',
      '{name} chơi lớn, {count} {gift} luôn! Chúc bồ tới như mưa!',
      'Đỉnh nóc kịch trần! {name} mừng {count} {gift}!',
      'Cảm ơn {name}! Năm sau MC làm đám cưới miễn phí cho!',
      '{name} mừng {count} {gift}! Giàu vậy có bồ chưa?'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'thanksPlain',
    label: 'Cảm ơn quà — lịch sự (khi tắt MC hài hước)',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Cảm ơn {name} đã mừng {count} {gift}! Chúc bạn may mắn!',
      'Rạp cưới cảm ơn {name} đã gửi {count} {gift}!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftPetal',
    label: 'Quà → Mưa hoa hồng',
    vars: '{name} {gift} {count}',
    lines: [
      'Cảm ơn {name} mừng {count} {gift}! Lãng mạn muốn xỉu!',
      'Mưa hoa hồng tới! {name} làm cả rạp thơm phức!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftKiss',
    label: 'Quà → Cô dâu chú rể hôn',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      '{name} hô hôn đi! {groom} và {bride} phát cơm chó nè!',
      'Cảm ơn {name}! Hôn một cái cho hội ế ghen chơi!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftDance',
    label: 'Quà → Lên sàn nhảy',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} lên sàn quẩy cháy máy! Cả rạp bung lụa nào!',
      'Nhạc lên! {name} quẩy sung, ai ngồi im là già!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftCake',
    label: 'Quà → Cắt bánh cưới',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Cảm ơn {name}! Cắt bánh nào, chừa MC một miếng nha!',
      '{name} đãi bánh cưới! Cắt lẹ cho cả rạp ăn với!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftChampagne',
    label: 'Quà → Rót rượu sâm panh',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} khui sâm panh! Hôm nay không say không về!',
      'Bốp! {name} mở rượu mừng, nâng ly nào cả rạp!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftCheers',
    label: 'Quà → Cụng ly',
    vars: '{name} {gift} {count}',
    lines: [
      '{name} mời cả rạp! Một, hai, ba, dzô!',
      'Cụng ly nào! {name} bao, cả rạp uống thoải mái!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftRing',
    label: 'Quà → Trao nhẫn',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      '{name} giục trao nhẫn! Đeo vô là hết đường chạy nha!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'giftDongphong',
    label: 'Quà → Động phòng',
    vars: '{name} {gift} {count} {groom} {bride}',
    lines: [
      'Gấp lắm rồi! {name} đẩy {groom} và {bride} vô động phòng!',
      '{name} chơi lớn! Đôi trẻ vô động phòng, cả nhà hóng nào!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'bouquet',
    label: 'Quà → Tung hoa cưới',
    vars: '{name} {catcher} {bride}',
    lines: [
      'Cô dâu tung hoa! {catcher} bắt được, sắp thoát ế rồi!',
      'Hoa bay trúng ngay {catcher}! Chuẩn bị thiệp cưới đi!',
      'Cảm ơn {name}! Hoa cưới rơi vô tay {catcher} rồi!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'fireworks',
    label: 'Quà → Bắn pháo hoa',
    vars: '{name}',
    lines: [
      'Bùm chíu! {name} bắn pháo hoa sáng rực cả rạp!',
      'Pháo hoa tới! Cảm ơn {name}, đẹp muốn xỉu!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'musicChange',
    label: 'Quà → Đổi nhạc',
    vars: '{name} {track}',
    lines: [
      '{name} đổi nhạc! Bài {track} lên rồi, quẩy tiếp nào!',
      'Nhạc mới của {name}! Ai không nhún là hơi kỳ nha!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'marryMC',
    label: 'Quà → Cưới MC',
    vars: '{name}',
    lines: [
      '{name} tặng quà đòi cưới MC! Mẹ ơi con có người hốt!',
      '{name} cầu hôn MC giữa rạp! MC ngại mà MC đồng ý!',
      'Cứu! {name} đòi cưới MC! Thôi được, MC chốt luôn!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'photo',
    label: 'Chụp ảnh cưới / ảnh chung (MC nói)',
    vars: '{name} {groom} {bride} {number}',
    lines: [
      'Một, hai, ba, cười! Ai nhắm mắt MC không chịu trách nhiệm!',
      'Tách! Ảnh cưới của {groom} và {bride} lên sóng!',
      'Tách! Tấm này tuyệt đối điện ảnh luôn!'
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
      'Đủ hoa hồng rồi! Mưa hoa đổ xuống, lãng mạn hết nấc!'
    ]
  },
  {
    section: 'Cảm ơn quà tặng',
    key: 'goalCake',
    label: 'Đạt mục tiêu cắt bánh',
    vars: '{groom} {bride}',
    lines: [
      'Đủ chỉ tiêu bánh rồi! Cắt cái bánh to nhất rạp nào!'
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
