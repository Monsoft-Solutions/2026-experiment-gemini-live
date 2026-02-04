import { useCallback, useRef } from "react";
import { downsample, float32ToInt16 } from "../utils/audio";

interface UseAudioCaptureOptions {
  onAudioData: (pcm16: ArrayBuffer) => void;
}

export function useAudioCapture({ onAudioData }: UseAudioCaptureOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const start = useCallback(async () => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    await audioCtx.audioWorklet.addModule("/pcm-processor.js");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    const source = audioCtx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
    workletNodeRef.current = worklet;

    worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const downsampled = downsample(e.data, audioCtx.sampleRate, 16000);
      const pcm16 = float32ToInt16(downsampled);
      onAudioData(pcm16);
    };

    source.connect(worklet);
    const mute = audioCtx.createGain();
    mute.gain.value = 0;
    worklet.connect(mute);
    mute.connect(audioCtx.destination);

    return audioCtx;
  }, [onAudioData]);

  const stop = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
  }, []);

  const getAudioContext = useCallback(() => audioCtxRef.current, []);

  return { start, stop, getAudioContext };
}
