"""Nạp VieNeu-TTS (v3 Turbo, chạy CPU bằng ONNX) và đọc câu thành file WAV.

Dùng chung cho thu_giong.py (nghe thử) và may_chu_giong.py (server app gọi sang).
"""
import io
import os
import shutil
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
MODEL_ROOT = HERE / "model"

# ONNX Runtime bản mới không chịu đọc file trọng số nằm ngoài thư mục chứa mô hình, mà cache của Hugging Face
# lại là các liên kết trỏ sang thư mục blobs. Chép các file đã tải thành file thật trong model/ rồi nạp từ đó.
from vieneu._v3_turbo_engine import onnx_runtime_lite as _orl  # noqa: E402

_fetch_cache = _orl.OnnxV3LiteEngine._fetch


def _fetch_real(repo, files, subfolder):
    src = Path(_fetch_cache(repo, files, subfolder))
    dst = MODEL_ROOT / repo.replace("/", "--") / (subfolder or "")
    dst.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        target = dst / f.name
        if f.is_file() and (not target.exists() or target.stat().st_size != f.stat().st_size):
            shutil.copyfile(f, target)  # copyfile đọc xuyên qua liên kết
    return dst


_orl.OnnxV3LiteEngine._fetch = staticmethod(_fetch_real)

from vieneu import Vieneu  # noqa: E402

_tts = None


def load():
    """Biến môi trường: GIONG_CHE_DO = v3turbo (mặc định, 48 kHz) | v3nano (nhẹ hơn, 24 kHz);
    GIONG_DO_CHINH_XAC = fp32 (mặc định) | int8 (nhanh hơn, cần CPU có VNNI); GIONG_SO_LUONG = số luồng CPU (0 = tự chọn)."""
    global _tts
    if _tts is None:
        mode = os.environ.get("GIONG_CHE_DO", "v3turbo")
        kw = {}
        if mode == "v3turbo":
            kw["precision"] = os.environ.get("GIONG_DO_CHINH_XAC", "fp32")
        threads = int(os.environ.get("GIONG_SO_LUONG", "0") or 0)
        if threads:
            kw["threads"] = threads
        _tts = Vieneu(mode=mode, **kw)
    return _tts


# Giọng tự thêm (giong_rieng/<tên>.npz, lấy mẫu từ một đoạn ghi âm bằng tts.encode_reference): chỉ dùng cho bản v3nano
GIONG_RIENG_DIR = HERE / "giong_rieng"
_rieng = None


def _giong_rieng():
    global _rieng
    if _rieng is None:
        _rieng = {}
        if os.environ.get("GIONG_CHE_DO", "v3turbo") == "v3nano" and GIONG_RIENG_DIR.is_dir():
            for f in sorted(GIONG_RIENG_DIR.glob("*.npz")):
                d = np.load(f)
                _rieng[f.stem] = {"speaker_emb": d["speaker_emb"], "style": d["style"],
                                  "toc_do": float(d["toc_do"]) if "toc_do" in d else 1.0}
    return _rieng


# Phong cách đọc: (lên cao mấy nửa cung, tốc độ đọc, cfg). Lên giọng bằng cách co ngắn sóng âm nên câu cũng nhanh lên
# (bù lại bằng tốc độ đọc chậm hơn) — nghe tưng tửng, lầy lội hợp người xem trẻ. cfg cao hơn thì nhấn nhá rõ hơn.
PHONG_CACH = {
    "tu-nhien": (0.0, 1.0, None),
    "lay": (4.0, 0.9, 3.5),
    "rat-lay": (6.0, 0.85, 3.5),
    "mc": (None, 1.0, 3.5),  # MC đám cưới: đưa mọi giọng về cùng cao độ MC_F0, nhịp hơi chậm (xem _mc_semis)
}

# Kiểu "MC đám cưới": cao độ đích (Hz) và nhịp so với giọng gốc. Cao độ gốc mỗi giọng đo một lần rồi nhớ lại.
MC_F0 = 174.0  # đo từ bài dẫn khai mạc mẫu: giọng MC "hô" đám cưới, cao và nhấn nhá nhiều
MC_TEMPO = 0.93
_f0_goc = {"Adam bựa": 172.0, "Adam": 115.9, "Anh Khôi": 104.6, "Đức Trí": 94.1, "Hữu Quân": 155.3,
           "Mạnh Dũng": 166.7, "Minh Quân": 166.7}


def _f0_trung_vi(wav, sr):
    """Cao độ trung vị (Hz) của đoạn giọng nói, đo bằng tự tương quan trên các khung có tiếng."""
    n, h = int(sr * 0.04), int(sr * 0.01)
    lo, hi = int(sr / 300), int(sr / 70)
    out = []
    for i in range(0, len(wav) - n, h):
        f = wav[i:i + n] - wav[i:i + n].mean()
        if np.sqrt((f ** 2).mean()) < 0.02:
            continue
        ac = np.correlate(f, f, "full")[n - 1:]
        ac /= ac[0] + 1e-9
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.45:
            out.append(sr / k)
    return float(np.median(out)) if out else 0.0


def _mc_semis(tts, voice, v):
    if voice not in _f0_goc:
        mau = np.asarray(tts.infer("Xin chào toàn thể quý vị quan khách, mời cả nhà cùng nâng ly chúc mừng hai bạn nào!",
                                   voice=v, seed=1), dtype=np.float32)
        _f0_goc[voice] = _f0_trung_vi(mau, tts.sample_rate) or MC_F0
    return 12 * np.log2(MC_F0 / _f0_goc[voice])


def voices():
    """[(tên giọng, mô tả, giới tính)]"""
    tts = load()
    out = [(name, "Nam · Lầy lội, tưng tửng" if name == "Adam bựa" else "Giọng riêng (tự thêm)", "male") for name in _giong_rieng()]
    for name, v in tts._preset_voices.items():
        out.append((name, v.get("description", ""), v.get("gender", "")))
    return out


def _len_giong(wav, semis):
    if not semis:
        return wav
    from fractions import Fraction
    from scipy.signal import resample_poly
    f = Fraction(2 ** (semis / 12)).limit_denominator(100)
    return resample_poly(wav, f.denominator, f.numerator).astype(np.float32)


def _rut_khoang_lang(wav, sr, max_s=0.3, nguong=0.015):
    """Rút các quãng lặng dài trong câu xuống còn max_s giây (giọng học từ người nói ngập ngừng hay chêm quãng lặng dài)."""
    fr = int(sr * 0.02)
    n = len(wav) // fr
    if n < 3:
        return wav
    lang = np.abs(wav[:n * fr]).reshape(n, fr).max(1) < nguong
    giu = int(max_s / 0.02)
    keep = np.ones(n, dtype=bool)
    i = 0
    while i < n:
        if lang[i]:
            j = i
            while j < n and lang[j]:
                j += 1
            if j - i > giu:
                keep[i + giu // 2:j - (giu - giu // 2)] = False
            i = j
        else:
            i += 1
    return np.concatenate([wav[:n * fr].reshape(n, fr)[keep].ravel(), wav[n * fr:]])


# Độ vang như nói trong phòng thật: (thời gian vang tắt RT60 giây, tỉ lệ tiếng vang, độ trễ trước tiếng vang đầu)
VANG = {
    "khong": None,
    "phong": (0.45, 0.20, 0.010),       # phòng khách / sảnh nhỏ
    "hoi-truong": (1.15, 0.30, 0.022),  # hội trường tiệc cưới, có loa
}


def _them_vang(wav, sr, kieu):
    cfg = VANG.get(kieu)
    if not cfg or not len(wav):
        return wav
    from scipy.signal import butter, fftconvolve, lfilter
    rt60, wet, pre = cfg
    n = int(sr * rt60 * 1.2)
    t = np.arange(n) / sr
    ir = np.random.default_rng(7).standard_normal(n) * np.exp(-6.91 * t / rt60)  # tắt 60 dB sau rt60 giây
    b, a = butter(2, 4200 / (sr / 2))
    ir = lfilter(b, a, ir)  # tường, rèm hút bớt âm cao: tiếng vang ấm hơn tiếng gốc
    ir[:int(pre * sr)] = 0
    for d, g in ((0.011, 0.55), (0.017, 0.4), (0.026, 0.32), (0.039, 0.24), (0.053, 0.18)):  # dội sớm từ tường gần
        ir[int((pre + d) * sr)] += g
    ir /= np.sqrt((ir ** 2).sum()) + 1e-9
    duoi = int(sr * rt60 * 0.7)  # giữ lại đuôi vang sau chữ cuối
    vang = fftconvolve(wav, ir)[:len(wav) + duoi]
    kho = np.concatenate([wav, np.zeros(len(vang) - len(wav), dtype=np.float32)])
    out = kho * (1 - wet * 0.35) + vang * wet
    peak = float(np.abs(out).max())
    if peak > 0.97:
        out *= 0.97 / peak
    return out.astype(np.float32)


def synth(text, voice="Hải Đăng", style="tu-nhien", vang="khong"):
    """Đọc `text` bằng giọng `voice` theo phong cách `style`, thêm độ vang `vang`; trả về (bytes WAV 16 bit mono, số giây)."""
    tts = load()
    semis, speed, cfg = PHONG_CACH.get(style, PHONG_CACH["tu-nhien"])
    kw = {}
    v = _giong_rieng().get(voice, voice)
    if isinstance(v, dict):  # giọng riêng: có thể kèm tốc độ đọc riêng (giọng mẫu nói chậm thì đọc nhanh lên)
        speed *= v["toc_do"]
        v = {"speaker_emb": v["speaker_emb"], "style": v["style"]}
    if semis is None:  # kiểu MC: lên/xuống giọng cho đúng cao độ đích, bù tốc độ để nhịp cuối = MC_TEMPO
        semis = _mc_semis(tts, voice, v)
        speed *= MC_TEMPO / (2 ** (semis / 12))
    if speed != 1.0:
        kw["speed"] = speed
    if cfg is not None:
        kw["cfg"] = cfg
    wav = np.asarray(tts.infer(text, voice=v, **kw), dtype=np.float32)
    wav = _rut_khoang_lang(wav, tts.sample_rate)
    wav = _len_giong(wav, semis)
    wav = _them_vang(wav, tts.sample_rate, vang)
    pcm = (np.clip(wav, -1, 1) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(tts.sample_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue(), len(pcm) / tts.sample_rate
