#!/usr/bin/env python3
"""Thử giọng MC nam của VieNeu-TTS: đọc một câu MC bằng vài giọng, đo thời gian, lưu file nghe thử.

Chạy:  ./venv/bin/python thu_giong.py [tên giọng ...]     (lần đầu sẽ tải mô hình)
Kết quả: mau/<tên giọng>.wav
"""
import sys
import time
from pathlib import Path

import giong_nam

CAU = ("Đủ đôi rồi bà con ơi! Chú rể Minh và cô dâu Thu Trang, lễ thành hôn sẽ bắt đầu sau bốn mươi giây. "
       "Ai không chịu thì tặng Nước Hoa để thay chú rể, nhanh tay lên nào!")
GIONG = sys.argv[1:] or ["Hải Đăng", "Adam bựa", "Quốc Tuấn", "Adam", "Thái Sơn"]

out = Path(__file__).parent / "mau"
out.mkdir(exist_ok=True)

t0 = time.time()
giong_nam.load()
print(f"nạp mô hình: {time.time() - t0:.1f}s")

for name in GIONG:
    t = time.time()
    data, dur = giong_nam.synth(CAU, name)
    dt = time.time() - t
    path = out / f"{name.replace(' ', '_')}.wav"
    path.write_bytes(data)
    print(f"{name:12s} đọc {dur:5.1f}s tiếng trong {dt:5.1f}s  (nhanh gấp {dur / dt:.2f} lần thời gian thực)  -> {path.name}")
