// 마이크 녹음 + 실시간 진폭 (오브 연동)

import { useCallback, useRef, useState } from 'react';

export interface RecordingResult {
  audioBase64: string;
  contentType: 'audio/webm;codecs=opus' | 'audio/mp4;codecs=mp4a.40.2';
  durationSec: number;
}

function pickMimeType(): { recorder: string; api: RecordingResult['contentType'] } | undefined {
  const candidates: { recorder: string; api: RecordingResult['contentType'] }[] = [
    { recorder: 'audio/webm;codecs=opus', api: 'audio/webm;codecs=opus' },
    { recorder: 'audio/mp4;codecs=mp4a.40.2', api: 'audio/mp4;codecs=mp4a.40.2' },
    { recorder: 'audio/mp4', api: 'audio/mp4;codecs=mp4a.40.2' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.recorder)) {
      return c;
    }
  }
  return undefined;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('blob read failed'));
    reader.readAsDataURL(blob);
  });
}

export interface UseVoiceRecorder {
  readonly isRecording: boolean;
  readonly amplitude: number;
  readonly permissionDenied: boolean;
  readonly supported: boolean;
  start(): Promise<boolean>;
  stop(): Promise<RecordingResult | undefined>;
  cancel(): void;
}

export function useVoiceRecorder(): UseVoiceRecorder {
  const [isRecording, setIsRecording] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const audioCtxRef = useRef<AudioContext | undefined>(undefined);
  const analyserRef = useRef<AnalyserNode | undefined>(undefined);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const mimeRef = useRef<ReturnType<typeof pickMimeType>>(undefined);

  const supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined' &&
    pickMimeType() !== undefined;

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = undefined;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
      audioCtxRef.current = undefined;
    }
    analyserRef.current = undefined;
    setAmplitude(0);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const mime = pickMimeType();
    if (mime === undefined) return false;
    mimeRef.current = mime;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      setPermissionDenied(false);

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new Ctx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setAmplitude(Math.min(1, rms * 3.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime.recorder });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      return true;
    } catch {
      setPermissionDenied(true);
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<RecordingResult | undefined> => {
    const recorder = recorderRef.current;
    const mime = mimeRef.current;
    if (recorder === undefined || mime === undefined) { cleanup(); setIsRecording(false); return undefined; }

    const durationSec = Math.max(0.1, (Date.now() - startTimeRef.current) / 1000);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: mime.recorder }));
      recorder.stop();
    });

    cleanup();
    setIsRecording(false);
    recorderRef.current = undefined;

    if (blob.size === 0) return undefined;
    const audioBase64 = await blobToBase64(blob);
    return { audioBase64, contentType: mime.api, durationSec: Math.min(120, durationSec) };
  }, [cleanup]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try { recorder.stop(); } catch {}
    }
    recorderRef.current = undefined;
    chunksRef.current = [];
    cleanup();
    setIsRecording(false);
  }, [cleanup]);

  return { isRecording, amplitude, permissionDenied, supported, start, stop, cancel };
}
