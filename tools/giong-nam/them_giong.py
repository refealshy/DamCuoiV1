#!/usr/bin/env python3
"""Thêm một giọng MC mới từ đoạn ghi âm mẫu (bắt chước chất giọng, ngữ điệu, kiểu nói của người trong đoạn đó).

Chạy:  ./venv/bin/python them_giong.py <file ghi âm> "<Tên giọng>" [--nghe] [--toc-do=1.3]
  - File ghi âm: wav/mp3/m4a/mp4..., tốt nhất 8-12 giây, MỘT người nói TIẾNG VIỆT, không nhạc nền.
  - Kết quả: giong_rieng/<Tên giọng>.npz — khởi động lại app là giọng hiện trong danh sách giọng nam.
  - --nghe: đọc thử một câu MC, lưu ra mau/<Tên giọng>_<kiểu đọc>_thu.wav
  - --toc-do: người trong đoạn mẫu nói chậm thì giọng học được cũng chậm; 1.3 = đọc nhanh hơn 30%

Chỉ dùng giọng của chính bạn hoặc của người đã đồng ý cho dùng.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

os.environ["GIONG_CHE_DO"] = "v3nano"  # app dùng bản nhẹ; giọng riêng chỉ chạy được với bản này

import numpy as np  # noqa: E402

import giong_nam  # noqa: E402

CAU_THU = "Ét ô ét! Cô dâu đứng một mình nãy giờ rồi nè! Anh nào tặng một bông hồng là thoát ế ngay và luôn!"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    toc_do = next((float(a.split("=", 1)[1]) for a in sys.argv[1:] if a.startswith("--toc-do=")), 1.0)
    if len(args) != 2:
        print(__doc__)
        return 1
    src, name = Path(args[0]), args[1].strip()
    if not src.is_file():
        print(f"Không thấy file {src}")
        return 1
    if not name or any(c in name for c in '/\\:*?"<>|'):
        print("Tên giọng không hợp lệ")
        return 1

    tts = giong_nam.load()
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "mau.wav"
        # Đổi mọi định dạng sang wav mono 24 kHz, bỏ khoảng lặng ở đầu, lấy tối đa 10 giây (mô hình học từ đoạn ngắn)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src),
                        "-af", "silenceremove=start_periods=1:start_threshold=-40dB",
                        "-t", "10", "-ac", "1", "-ar", "24000", str(wav)],
                       check=True)
        spk, style = tts.encode_reference(str(wav))

    # Đoạn mẫu không có lời nói (chỉ tiếng cười, nhạc...) thì giọng học được đọc ra im lặng: không lưu
    voice = {"speaker_emb": np.asarray(spk, dtype=np.float32), "style": np.asarray(style, dtype=np.float32)}
    # Câu thử ~60 ký tự, giọng bình thường đọc mất 3-4 giây; dưới 2 giây là giọng hỏng (nuốt chữ / im lặng)
    test = np.asarray(tts.infer(CAU_THU, voice=voice, seed=1, speed=toc_do), dtype=np.float32)
    if len(test) < tts.sample_rate * len(CAU_THU) / 50 or float(np.abs(test).max(initial=0)) < 0.02:
        print("❌ Giọng học từ đoạn này đọc hỏng (im lặng / nuốt chữ) — đoạn mẫu cần có người NÓI tiếng Việt rõ ràng (không chỉ cười/hát/nhạc).")
        return 1

    giong_nam.GIONG_RIENG_DIR.mkdir(exist_ok=True)
    out = giong_nam.GIONG_RIENG_DIR / f"{name}.npz"
    np.savez_compressed(out, **voice, toc_do=np.float32(toc_do))
    print(f"Đã thêm giọng \"{name}\" -> {out}")

    if "--nghe" in sys.argv:
        giong_nam._rieng = None  # nạp lại danh sách để có giọng vừa thêm
        mau = Path(__file__).parent / "mau"
        mau.mkdir(exist_ok=True)
        for style_name in ("tu-nhien", "lay"):
            data, dur = giong_nam.synth(CAU_THU, name, style_name)
            p = mau / f"{name.replace(' ', '_')}_{style_name}_thu.wav"
            p.write_bytes(data)
            print(f"Nghe thử ({style_name}, {dur:.1f}s): {p}")
    print("Khởi động lại app để dùng giọng mới.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
