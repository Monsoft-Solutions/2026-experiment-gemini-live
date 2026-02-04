import { useCallback, useRef } from "react";

export function useAudioPlayback() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const setAudioContext = useCallback((ctx: AudioContext) => {
    audioCtxRef.current = ctx;
    nextStartTimeRef.current = ctx.currentTime;
  }, []);

  const play = useCallback((arrayBuffer: ArrayBuffer, sampleRate: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const pcm = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    nextStartTimeRef.current = Math.max(now, nextStartTimeRef.current);
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;

    scheduledSourcesRef.current.push(source);
    source.onended = () => {
      const idx = scheduledSourcesRef.current.indexOf(source);
      if (idx > -1) scheduledSourcesRef.current.splice(idx, 1);
    };
  }, []);

  const stopAll = useCallback(() => {
    scheduledSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        // ignore
      }
    });
    scheduledSourcesRef.current = [];
    if (audioCtxRef.current) {
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
    }
  }, []);

  return { setAudioContext, play, stopAll };
}
