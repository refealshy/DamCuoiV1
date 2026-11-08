#!/usr/bin/env bash
# Giả lập một buổi LIVE: khách vào, bình luận, tặng quà, giành cô dâu/chú rể, cướp vai, sàn nhảy, thả tim, chia sẻ, đổi nhân vật.
# Dữ liệu gửi đúng định dạng webhook của TikFinity Web.
#
# Cách dùng:
#   ./test_thu.sh                                   # test trên máy (localhost)
#   ./test_thu.sh https://xxxx.trycloudflare.com    # test xuyên qua tunnel
#   DELAY=6 ./test_thu.sh                           # chậm hơn (mặc định 4 giây/sự kiện)
#
# Xem kết quả trên overlay: http://localhost:3003/overlay.html (hoặc preview OBS)

BASE="${1:-http://localhost:3003}"
BASE="${BASE%/}"
KEY="$(cat "$(dirname "$0")/app/webhook_key.txt" 2>/dev/null)"
URL="$BASE/api/tikfinity?key=$KEY"
DELAY="${DELAY:-4}"

send() {
  local label="$1" json="$2" code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H 'Content-Type: application/json' -d "$json")
  if [ "$code" = 200 ]; then echo "✅ $label"; else echo "❌ $label (HTTP $code)"; [ "$code" = 403 ] && echo "   -> Sai khóa hoặc sai link tunnel"; [ "$code" = 000 ] && echo "   -> Không kết nối được tới $BASE"; exit 1; fi
  sleep "$DELAY"
}

chat() { send "$2 bình luận: $3" "{\"username\":\"$1\",\"nickname\":\"$2\",\"commandParams\":\"$3\",\"triggerTypeId\":\"2\"}"; }
gift() { send "$2 tặng $3 ×$4 ($5 xu) → $6" "{\"username\":\"$1\",\"nickname\":\"$2\",\"giftId\":\"1\",\"giftName\":\"$3\",\"repeatCount\":\"$4\",\"coins\":\"$5\",\"triggerTypeId\":\"3\"}"; }

echo "Gửi tới: $BASE  (mỗi sự kiện cách nhau ${DELAY}s)"
echo

send "Lan vào phòng" '{"event":"join","username":"lan_nguyen","nickname":"Lan Nguyễn"}'
chat lan_nguyen "Lan Nguyễn" "Chúc mừng hạnh phúc hai bạn!"
chat hung99 "Hùng" "1 2 3 dzô!"
gift lan_nguyen "Lan Nguyễn" "Rose" 5 5 "mưa hoa hồng"
gift minh_dz "Minh Đẹp Zai" "GG" 3 30 "làm CHÚ RỂ (30 xu)"
chat thu_trang "Thu Trang" "cho em làm cô dâu nha"
gift thu_trang "Thu Trang" "GG" 1 12 "làm CÔ DÂU (12 xu) → đủ đôi, bắt đầu đếm ngược"
gift hung99 "Hùng" "GG" 2 20 "đấu giá chú rể (20 < 30, thiếu 11)"
gift hung99 "Hùng" "GG" 1 15 "cộng dồn 35 > 30 → CƯỚP CHÚ RỂ"
gift be_na "Bé Na" "Doughnut" 1 30 "lên sàn nhảy"
send "Bé Na thả 300 tim" '{"event":"like","username":"be_na","nickname":"Bé Na","likeCount":"300"}'
send "Kim Chi chia sẻ rạp cưới" '{"event":"share","username":"kim_chi","nickname":"Kim Chi"}'
chat hung99 "Hùng" "nữ"

echo
echo "Xong. Trên overlay: chú rể = 'Hùng', cô dâu = 'Thu Trang'; hết đếm ngược sẽ tự làm lễ thành hôn + động phòng."
echo "Trước khi LIVE thật: bảng điều khiển → Sổ Mừng Cưới → 'Xóa Dữ Liệu Bắt Đầu Phiên Mới'."
