#!/usr/bin/env bash
# Bật mọi thứ cần cho một buổi LIVE trên Linux: server Tiệc Cưới (cổng 3003) + tunnel cloudflared cho TikFinity Web.
#
#   ./BAT_DAU.sh          bật (cái nào đang chạy rồi thì giữ nguyên) và in link webhook
#   ./BAT_DAU.sh tat      tắt server + tunnel
#   ./BAT_DAU.sh xem      xem đang chạy hay chưa, link tunnel hiện tại
#
# Link tunnel miễn phí (trycloudflare.com) ĐỔI mỗi lần bật lại tunnel, nên sau khi bật phải dán link mới vào
# các Action webhook trong TikFinity. Tắt server (để nạp code mới) thì không cần tắt tunnel: ./BAT_DAU.sh tat server

ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3003}"
LOG_DIR="$ROOT/.tmp_kiemtra"
SERVER_LOG="$LOG_DIR/server.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
LINK_FILE="$LOG_DIR/link_tunnel.txt"
mkdir -p "$LOG_DIR"

NODE="$(command -v node || ls -1 "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1)"

server_chay() { curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/api/license/status"; }
tunnel_pid() { pgrep -f "cloudflared tunnel .*--url http://localhost:$PORT" | head -1; }
link_trong_log() { grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1; }

tat() {
  if [ "$1" != server ]; then
    local pid; pid="$(tunnel_pid)"
    if [ -n "$pid" ]; then kill "$pid" && echo "Đã tắt tunnel."; else echo "Tunnel không chạy."; fi
    rm -f "$LINK_FILE"
  fi
  if server_chay; then fuser -k "$PORT/tcp" >/dev/null 2>&1; echo "Đã tắt server."; else echo "Server không chạy."; fi
  # "tat server": giữ lại server giọng MC nam (cổng 3010) để lần bật sau dùng lại ngay, khỏi nạp lại nửa phút
  if [ "$1" != server ]; then fuser -k "${GIONG_PORT:-3010}/tcp" >/dev/null 2>&1 && echo "Đã tắt giọng MC nam."; fi
}

in_link() {
  local link key; link="$(cat "$LINK_FILE" 2>/dev/null)"; key="$(cat "$ROOT/app/webhook_key.txt" 2>/dev/null)"
  echo
  echo "Bảng điều khiển : http://localhost:$PORT"
  echo "Nguồn OBS       : http://localhost:$PORT/overlay.html  (1080 x 1920)"
  if [ -z "$link" ]; then echo "Tunnel          : chưa có link"; return; fi
  local wh="$link/api/tikfinity?key=$key"
  echo
  echo "Dán vào TikFinity (Actions & Events → sửa URL của từng Action webhook):"
  echo "  Quà + Bình luận : $wh"
  echo "  Join            : $wh&event=join"
  echo "  Likes           : $wh&event=like"
  echo "  Share           : $wh&event=share"
  echo "  Follow          : $wh&event=follow"
  if printf '%s' "$wh" | { wl-copy 2>/dev/null || xclip -selection clipboard 2>/dev/null; }; then
    echo
    echo "(Đã chép link Quà + Bình luận vào bộ nhớ tạm; các link kia chỉ thêm đuôi &event=...)"
  fi
}

case "$1" in
  tat|stop) tat "$2"; exit 0 ;;
  xem|status)
    server_chay && echo "Server: đang chạy (cổng $PORT)" || echo "Server: CHƯA chạy"
    [ -n "$(tunnel_pid)" ] && echo "Tunnel: đang chạy" || echo "Tunnel: CHƯA chạy"
    in_link; exit 0 ;;
esac

# 1) Server
if server_chay; then
  echo "Server đang chạy sẵn (cổng $PORT)."
else
  [ -x "$NODE" ] || { echo "Không tìm thấy node. Cài Node.js trước."; exit 1; }
  echo "Đang bật server..."
  (cd "$ROOT/app" && PORT="$PORT" setsid nohup "$NODE" server.cjs >"$SERVER_LOG" 2>&1 </dev/null &)
  for _ in $(seq 40); do server_chay && break; sleep 0.5; done
  server_chay || { echo "Server không lên. Xem lỗi: $SERVER_LOG"; tail -5 "$SERVER_LOG"; exit 1; }
  echo "Server đã chạy. (Giọng MC nam bật mới thì cần khoảng nửa phút để nạp; trong lúc đó MC tạm dùng giọng dự phòng.)"
fi

# 2) Tunnel
if [ -n "$(tunnel_pid)" ] && [ -s "$LINK_FILE" ]; then
  echo "Tunnel đang chạy sẵn — link cũ vẫn dùng được, KHÔNG cần sửa TikFinity."
else
  command -v cloudflared >/dev/null || { echo "Chưa cài cloudflared nên không mở được tunnel."; in_link; exit 1; }
  pid="$(tunnel_pid)"; [ -n "$pid" ] && kill "$pid"
  echo "Đang mở tunnel..."
  : >"$TUNNEL_LOG"
  setsid nohup cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$TUNNEL_LOG" 2>&1 </dev/null &
  for _ in $(seq 60); do [ -n "$(link_trong_log)" ] && break; sleep 0.5; done
  link="$(link_trong_log)"
  [ -n "$link" ] || { echo "Tunnel không lấy được link (mạng?). Xem: $TUNNEL_LOG"; tail -5 "$TUNNEL_LOG"; exit 1; }
  echo "$link" >"$LINK_FILE"
  echo "Tunnel MỚI — link đã đổi, phải dán lại vào TikFinity."
fi

in_link
