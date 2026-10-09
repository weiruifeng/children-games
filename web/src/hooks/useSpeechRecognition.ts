import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { 0?: RecognitionAlternative; isFinal: boolean };
type RecognitionEvent = Event & { results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = Event & { error: string };

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserRecognitionConstructor = new () => BrowserRecognition;

function recognitionConstructor(): BrowserRecognitionConstructor | undefined {
  const browserWindow = window as Window & {
    SpeechRecognition?: BrowserRecognitionConstructor;
    webkitSpeechRecognition?: BrowserRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

function errorMessage(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') return '没有获得麦克风权限，可以直接打字告诉我。';
  if (error === 'no-speech') return '没有听到声音，请再试一次。';
  if (error === 'network') return '语音识别需要网络，请检查网络后再试。';
  return '语音识别暂时不可用，可以直接打字告诉我。';
}

export function useSpeechRecognition(onFinalResult: (text: string) => void) {
  const recognitionRef = useRef<BrowserRecognition | null>(null);
  const onFinalResultRef = useRef(onFinalResult);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState('');
  const isSupported = typeof window !== 'undefined' && Boolean(recognitionConstructor());

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback(() => {
    const Recognition = recognitionConstructor();
    if (!Recognition) {
      setError('当前浏览器不支持语音识别，可以直接打字告诉我。');
      return;
    }

    setError('');
    setInterimText('');
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const results = Array.from({ length: event.results.length }, (_, index) => event.results[index]);
      const transcript = results.map((result) => result[0]?.transcript ?? '').join('');
      setInterimText(transcript);
      if (results.some((result) => result.isFinal) && transcript.trim()) {
        onFinalResultRef.current(transcript.trim());
        setInterimText('');
      }
    };
    recognition.onerror = (event) => setError(errorMessage(event.error));
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setError('语音识别没有启动，请再试一次。');
    }
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { isSupported, isListening, interimText, error, start, stop };
}
