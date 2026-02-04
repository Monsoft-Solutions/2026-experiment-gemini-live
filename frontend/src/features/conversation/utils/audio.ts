export function downsample(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const len = Math.round(buffer.length / ratio);
  const result = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const start = Math.round(i * ratio);
    const end = Math.round((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < buffer.length; j++) {
      sum += buffer[j];
      count++;
    }
    result[i] = sum / count;
  }
  return result;
}

export function float32ToInt16(buffer: Float32Array): ArrayBuffer {
  const buf = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    buf[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7fff;
  }
  return buf.buffer;
}
