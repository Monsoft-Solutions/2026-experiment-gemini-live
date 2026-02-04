"""Audio format conversion for Twilio Media Streams.

Twilio sends/receives mulaw 8kHz mono audio.
Our voice providers use PCM 16-bit mono at 16kHz or 24kHz.

This module handles:
  - mulaw ↔ PCM 16-bit conversion (G.711 µ-law codec)
  - Sample rate conversion (8kHz ↔ 16kHz ↔ 24kHz)

Note: audioop was removed in Python 3.13, so we implement
the codec manually per ITU-T G.711.
"""

from __future__ import annotations

import struct

# ---------------------------------------------------------------------------
# µ-law codec (ITU-T G.711)
# ---------------------------------------------------------------------------

_MULAW_BIAS = 0x84  # 132
_MULAW_CLIP = 32635

# Precomputed lookup tables for speed
_mulaw_decode_table: list[int] = []
_mulaw_encode_table: list[int] = []


def _init_tables():
    """Build decode/encode lookup tables on import."""
    global _mulaw_decode_table, _mulaw_encode_table

    # Decode table: 256 mulaw bytes → 16-bit linear PCM
    for i in range(256):
        b = ~i & 0xFF
        sign = b & 0x80
        exponent = (b >> 4) & 0x07
        mantissa = b & 0x0F
        sample = ((mantissa << 3) + _MULAW_BIAS) << exponent
        sample -= _MULAW_BIAS
        if sign:
            sample = -sample
        _mulaw_decode_table.append(sample)

    # Encode table: 65536 uint16 values → mulaw byte
    # Index by (sample + 32768) for signed 16-bit range
    _mulaw_encode_table = [0] * 65536
    for i in range(65536):
        sample = i - 32768  # Convert to signed

        sign = 0
        if sample < 0:
            sign = 0x80
            sample = -sample
        if sample > _MULAW_CLIP:
            sample = _MULAW_CLIP
        sample += _MULAW_BIAS

        # Find segment by locating highest set bit
        # Check bits 14 down to 7 (mask starts at 0x4000)
        exponent = 7
        mask = 0x4000
        for _ in range(8):
            if sample & mask:
                break
            exponent -= 1
            mask >>= 1

        if exponent < 0:
            exponent = 0

        mantissa = (sample >> (exponent + 3)) & 0x0F
        mulaw_byte = ~(sign | (exponent << 4) | mantissa) & 0xFF
        _mulaw_encode_table[i] = mulaw_byte


_init_tables()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def mulaw_to_pcm16(mulaw_data: bytes) -> bytes:
    """Convert mulaw bytes to PCM 16-bit signed little-endian."""
    n = len(mulaw_data)
    out = bytearray(n * 2)
    for i in range(n):
        sample = _mulaw_decode_table[mulaw_data[i]]
        struct.pack_into("<h", out, i * 2, sample)
    return bytes(out)


def pcm16_to_mulaw(pcm_data: bytes) -> bytes:
    """Convert PCM 16-bit signed little-endian to mulaw bytes."""
    n = len(pcm_data) // 2
    out = bytearray(n)
    for i in range(n):
        sample = struct.unpack_from("<h", pcm_data, i * 2)[0]
        out[i] = _mulaw_encode_table[sample + 32768]
    return bytes(out)


def resample_pcm16(data: bytes, from_rate: int, to_rate: int) -> bytes:
    """Resample PCM 16-bit mono via linear interpolation."""
    if from_rate == to_rate:
        return data

    n_samples = len(data) // 2
    if n_samples == 0:
        return data

    samples = struct.unpack(f"<{n_samples}h", data)
    ratio = from_rate / to_rate
    out_len = int(n_samples / ratio)
    out = []

    for i in range(out_len):
        src_idx = i * ratio
        idx = int(src_idx)
        frac = src_idx - idx
        if idx + 1 < n_samples:
            val = samples[idx] * (1 - frac) + samples[idx + 1] * frac
        else:
            val = samples[idx] if idx < n_samples else 0
        out.append(int(max(-32768, min(32767, val))))

    return struct.pack(f"<{len(out)}h", *out)


def twilio_to_provider_audio(mulaw_data: bytes, target_rate: int = 16000) -> bytes:
    """Convert Twilio mulaw 8kHz → PCM 16-bit at target_rate.

    Pipeline: mulaw 8kHz → PCM 8kHz → resample to target_rate
    """
    pcm_8k = mulaw_to_pcm16(mulaw_data)
    return resample_pcm16(pcm_8k, 8000, target_rate)


def provider_to_twilio_audio(pcm_data: bytes, source_rate: int = 24000) -> bytes:
    """Convert provider PCM 16-bit at source_rate → Twilio mulaw 8kHz.

    Pipeline: resample to 8kHz → PCM to mulaw
    """
    pcm_8k = resample_pcm16(pcm_data, source_rate, 8000)
    return pcm16_to_mulaw(pcm_8k)
