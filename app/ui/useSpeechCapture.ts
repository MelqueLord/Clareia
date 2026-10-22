'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechResult = { transcript?: string };
type SpeechLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results?: ArrayLike<ArrayLike<SpeechResult>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechConstructor = new () => SpeechLike;

const MAX_LISTEN_MS = 30_000;
const STOP_GRACE_MS = 2_500;

function errorMessage(error: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'O microfone não foi liberado. Confira a permissão do navegador ou digite sua frase.';
  }
  if (error === 'audio-capture') {
    return 'Não consegui acessar o microfone. Confira se ele está conectado e tente novamente.';
  }
  if (error === 'no-speech') return 'Não ouvi uma frase. Tente novamente ou digite.';
  if (error === 'network') return 'A transcrição perdeu a conexão. Tente novamente ou digite.';
  if (error === 'aborted') return '';
  return 'Não foi possível transcrever. Tente novamente ou digite sua frase.';
}

export default function useSpeechCapture(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognition = useRef<SpeechLike | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef(0);
  const transcriptCallback = useRef(onTranscript);

  useEffect(() => {
    transcriptCallback.current = onTranscript;
  }, [onTranscript]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const release = useCallback((instance: SpeechLike, token: number, abort: boolean) => {
    if (session.current !== token) return;
    clearTimer();
    if (recognition.current === instance) recognition.current = null;
    session.current += 1;
    setListening(false);
    if (abort) {
      try {
        instance.abort();
      } catch {
        try { instance.stop(); } catch { /* The browser may already have closed it. */ }
      }
    }
  }, [clearTimer]);

  const stop = useCallback(() => {
    const instance = recognition.current;
    if (!instance) {
      setListening(false);
      return;
    }

    const token = session.current;
    clearTimer();
    timer.current = setTimeout(() => {
      if (recognition.current !== instance || session.current !== token) return;
      setMessage('O microfone demorou para encerrar e foi liberado. A transcrição recebida foi mantida.');
      release(instance, token, true);
    }, STOP_GRACE_MS);

    try {
      instance.stop();
    } catch {
      setMessage('O microfone foi encerrado. Você pode tentar novamente ou digitar.');
      release(instance, token, true);
    }
  }, [clearTimer, release]);

  const abortForBackground = useCallback(() => {
    const instance = recognition.current;
    if (!instance) return;
    const token = session.current;
    setMessage('A gravação foi encerrada ao sair do app. A transcrição recebida foi mantida.');
    release(instance, token, true);
  }, [release]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) abortForBackground();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', abortForBackground);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', abortForBackground);
      clearTimer();
      const instance = recognition.current;
      recognition.current = null;
      session.current += 1;
      if (instance) {
        try { instance.abort(); } catch {
          try { instance.stop(); } catch { /* The browser may already have closed it. */ }
        }
      }
    };
  }, [abortForBackground, clearTimer]);

  const record = useCallback(() => {
    if (recognition.current) {
      stop();
      return;
    }

    const browser = window as Window & {
      SpeechRecognition?: SpeechConstructor;
      webkitSpeechRecognition?: SpeechConstructor;
    };
    const Speech = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Speech) {
      setMessage('Este navegador não oferece transcrição por voz. Use o ditado do teclado ou digite sua frase.');
      return;
    }

    let instance: SpeechLike;
    try {
      instance = new Speech();
    } catch {
      setMessage('Não foi possível iniciar o microfone. Você pode digitar sua frase.');
      return;
    }

    const token = ++session.current;
    recognition.current = instance;
    instance.lang = 'pt-BR';
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = event => {
      if (session.current !== token) return;
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) transcriptCallback.current(transcript);
    };
    instance.onerror = event => {
      if (session.current !== token) return;
      const text = errorMessage(event.error);
      if (text) setMessage(text);
      release(instance, token, true);
    };
    instance.onend = () => release(instance, token, false);

    setMessage('');
    setListening(true);
    timer.current = setTimeout(() => {
      if (recognition.current !== instance || session.current !== token) return;
      setMessage('A gravação atingiu o limite de 30 segundos e foi encerrada. A transcrição recebida foi mantida.');
      release(instance, token, true);
    }, MAX_LISTEN_MS);
    try {
      instance.start();
    } catch {
      setMessage('O navegador não conseguiu iniciar o microfone. Tente novamente ou digite sua frase.');
      release(instance, token, true);
    }
  }, [release, stop]);

  return { listening, message, setMessage, record };
}
