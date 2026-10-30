'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechResult = { transcript?: string };
type SpeechResultGroup = ArrayLike<SpeechResult> & { isFinal?: boolean };
type SpeechLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results?: ArrayLike<SpeechResultGroup> }) => void) | null;
  onstart: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechConstructor = new () => SpeechLike;

const MAX_LISTEN_MS = 30_000;
const START_GRACE_MS = 8_000;
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
  const startupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef(0);
  const transcriptCallback = useRef(onTranscript);
  const transcriptSegments = useRef<string[]>([]);

  useEffect(() => {
    transcriptCallback.current = onTranscript;
  }, [onTranscript]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clearStartupTimer = useCallback(() => {
    if (startupTimer.current !== null) clearTimeout(startupTimer.current);
    startupTimer.current = null;
  }, []);

  const release = useCallback((instance: SpeechLike, token: number, abort: boolean) => {
    if (session.current !== token) return;
    clearTimer();
    clearStartupTimer();
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
  }, [clearStartupTimer, clearTimer]);

  const stop = useCallback(() => {
    const instance = recognition.current;
    if (!instance) {
      setListening(false);
      return;
    }

    const token = session.current;
    clearTimer();
    clearStartupTimer();
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
  }, [clearStartupTimer, clearTimer, release]);

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
      clearStartupTimer();
      const instance = recognition.current;
      recognition.current = null;
      session.current += 1;
      if (instance) {
        try { instance.abort(); } catch {
          try { instance.stop(); } catch { /* The browser may already have closed it. */ }
        }
      }
    };
  }, [abortForBackground, clearStartupTimer, clearTimer]);

  const record = useCallback(() => {
    if (recognition.current) {
      stop();
      return;
    }

    const browser = window as Window & {
      SpeechRecognition?: SpeechConstructor;
      webkitSpeechRecognition?: SpeechConstructor;
    };
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSWebView = isIOS && !(/Version\/[\d.]+.*Safari\//.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)/i.test(userAgent));
    const isAndroidWebView = /Android/i.test(userAgent) && /;\s*wv\)|\bwv\b/i.test(userAgent);
    if (isIOSWebView || isAndroidWebView) {
      setMessage('Este navegador não consegue iniciar a transcrição com segurança. Abra o Clareia no Safari (iPhone) ou Chrome (Android), ou toque no campo de texto e use o microfone do teclado.');
      return;
    }
    if (!window.isSecureContext) {
      setMessage('A gravação por voz exige uma conexão segura. Abra o Clareia pelo endereço https ou digite sua frase.');
      return;
    }
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
    instance.interimResults = true;
    transcriptSegments.current = [];
    instance.onstart = () => {
      if (session.current === token) clearStartupTimer();
    };
    instance.onresult = event => {
      if (session.current !== token) return;
      try {
        const groups = event.results;
        if (!groups?.length) return;
        for (let index = 0; index < groups.length; index++) {
          const group = groups[index];
          const transcript = group?.[0]?.transcript?.trim();
          transcriptSegments.current[index] = transcript || '';
        }
        const transcript = transcriptSegments.current.filter(Boolean).join(' ').trim();
        if (transcript) transcriptCallback.current(transcript);
      } catch {
        setMessage('A transcrição falhou. Você pode continuar digitando sua frase.');
        release(instance, token, true);
      }
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
    startupTimer.current = setTimeout(() => {
      if (recognition.current !== instance || session.current !== token) return;
      setMessage('O navegador não respondeu ao pedido de voz. Tente novamente ou use o microfone do teclado para ditar no campo de texto.');
      release(instance, token, true);
    }, START_GRACE_MS);
    try {
      instance.start();
    } catch {
      setMessage('O navegador não conseguiu iniciar o microfone. Tente novamente ou digite sua frase.');
      release(instance, token, true);
    }
  }, [clearStartupTimer, release, stop]);

  return { listening, message, setMessage, record };
}
