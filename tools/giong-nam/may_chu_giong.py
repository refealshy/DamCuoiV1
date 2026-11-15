#!/usr/bin/env python3
"""Server giọng MC nam (VieNeu-TTS) cho app Tiệc Cưới Online.

App (app/server.cjs) tự bật file này khi chọn "Giọng nam trên máy" trong tab Giọng MC; cũng có thể chạy tay:
    ./venv/bin/python may_chu_giong.py

Chỉ nghe trên 127.0.0.1 (cổng GIONG_PORT, mặc định 3010):
    GET  /health            -> {"ok": true, "mode": "...", "voices": [{"name", "description", "gender"}]}
    POST /speak             -> thân JSON {"text": "...", "voice": "Minh Quân", "style": "tu-nhien|lay|rat-lay|mc", "vang": "khong|phong|hoi-truong"}; trả về audio/wav

Mặc định dùng bản nhẹ v3nano (24 kHz): trên CPU đọc nhanh gấp 3-4 lần thời gian thực. Bản v3turbo (48 kHz) hay hơn
nhưng trên CPU chậm hơn thời gian thực nên MC nói trễ; muốn thử thì đặt GIONG_CHE_DO=v3turbo.
"""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault("GIONG_CHE_DO", "v3nano")

import giong_nam  # noqa: E402

PORT = int(os.environ.get("GIONG_PORT", "3010"))
lock = threading.Lock()


def log(msg):
    # App chính bị tắt đột ngột thì ống stdout có thể đã đóng: ghi log hỏng cũng không được làm hỏng việc đọc
    try:
        print(msg, flush=True)
    except Exception:  # noqa: BLE001
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # không in log từng yêu cầu
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] != "/health":
            return self._send(404, b"{}")
        voices = [{"name": n, "description": d, "gender": g} for n, d, g in giong_nam.voices()]
        self._send(200, json.dumps({"ok": True, "mode": os.environ["GIONG_CHE_DO"], "voices": voices}, ensure_ascii=False).encode())

    def do_POST(self):
        if self.path.split("?")[0] != "/speak":
            return self._send(404, b"{}")
        try:
            n = min(int(self.headers.get("Content-Length") or 0), 20000)
            data = json.loads(self.rfile.read(n) or b"{}")
            text = str(data.get("text") or "").strip()[:600]
            voice = str(data.get("voice") or "").strip()
            style = str(data.get("style") or "tu-nhien").strip()
            vang = str(data.get("vang") or "khong").strip()
            if not text:
                return self._send(400, b'{"error":"thieu text"}')
            names = [v[0] for v in giong_nam.voices()]
            if voice not in names:
                voice = next((v[0] for v in giong_nam.voices() if v[2] == "male"), names[0])
            with lock:  # mô hình đọc từng câu một
                t = time.time()
                wav, dur = giong_nam.synth(text, voice, style, vang)
            log(f"{voice} ({style}): {dur:.1f}s tiếng trong {time.time() - t:.1f}s")
            self._send(200, wav, "audio/wav")
        except Exception as e:  # noqa: BLE001
            self._send(500, json.dumps({"error": str(e)[:300]}, ensure_ascii=False).encode())


def main():
    t = time.time()
    giong_nam.load()
    giong_nam.synth("Xin chào quý vị.", next((v[0] for v in giong_nam.voices() if v[2] == "male"), None) or giong_nam.voices()[0][0])  # làm nóng
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    log(f"READY cổng {PORT}, chế độ {os.environ['GIONG_CHE_DO']}, nạp {time.time() - t:.1f}s")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
