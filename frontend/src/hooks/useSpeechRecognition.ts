// 브라우저 내장 음성인식 (Web Speech API, ko-KR 실시간)

import { useCallback, useRef, useState } from 'react';

interface SpeechRecognitionResultLike { 0: { transcript: string }; isFinal: boolean; length: number }
interface SpeechRecognitionEventLike { resultIndex: number; results: { length: number; [i: number]: SpeechRecognitionResultLike } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface UseSpeechRecognition {
  readonly supported: boolean;
  readonly listening: boolean;
  readonly interim: string;
  readonly permissionDenied: boolean;
  start(): boolean;
  stop(): Promise<string>;
}

export function useSpeechRecognition(): UseSpeechRecognition {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | undefined>(undefined);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const resolveRef = useRef<((t: string) => void) | undefined>(undefined);

  const supported = getCtor() !== undefined;

  const start = useCallback((): boolean => {
    const Ctor = getCtor();
    if (Ctor === undefined) return false;

    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = '';
    interimRef.current = '';
    setInterim('');

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i]!;
        const text = r[0].transcript;
        if (r.isFinal) finalRef.current += text;
        else interimText += text;
      }
      interimRef.current = interimText;
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setPermissionDenied(true);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
      const result = (finalRef.current + interimRef.current).trim();
      resolveRef.current?.(result);
      resolveRef.current = undefined;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      setPermissionDenied(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback((): Promise<string> => {
    const rec = recRef.current;
    if (rec === undefined) return Promise.resolve('');
    return new Promise<string>((resolve) => {
      resolveRef.current = resolve;
      try { rec.stop(); } catch { resolve((finalRef.current + interimRef.current).trim()); }
    });
  }, []);

  return { supported, listening, interim, permissionDenied, start, stop };
}
