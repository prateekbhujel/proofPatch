import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

export type VoiceDictationState = 'idle' | 'listening' | 'unsupported' | 'error';

interface VoiceDictationButtonProps {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  label?: string;
}

export function VoiceDictationButton({
  onTranscript,
  disabled = false,
  label = 'Voice',
}: VoiceDictationButtonProps) {
  const [state, setState] = useState<VoiceDictationState>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  function handleToggle() {
    if (disabled) return;

    if (state === 'listening' && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setState('idle');
      setStatusMessage(null);
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionCtor) {
      setState('unsupported');
      setStatusMessage('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setState('listening');
        setStatusMessage('Listening… speak now (click Mic to stop).');
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results || [])
          .map((res: any) => res[0]?.transcript ?? '')
          .join(' ')
          .trim();
        if (transcript) {
          onTranscript(transcript);
          setStatusMessage(`Added: "${transcript.slice(0, 48)}${transcript.length > 48 ? '…' : ''}"`);
        }
      };

      recognition.onerror = (event: any) => {
        const code = event?.error || 'unknown';
        setState('error');
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setStatusMessage('Microphone permission was denied. Allow mic access in browser settings.');
        } else if (code === 'no-speech') {
          setStatusMessage('No speech detected. Click Voice to try again.');
        } else if (code === 'network') {
          setStatusMessage('Speech recognition service is currently unavailable. Click Voice to retry or type directly.');
        } else {
          setStatusMessage(`Speech recognition error (${code}).`);
        }
      };

      recognition.onend = () => {
        setState((prev) => (prev === 'listening' ? 'idle' : prev));
      };

      recognitionRef.current = recognition;
      setState('listening');
      setStatusMessage('Requesting microphone access…');
      recognition.start();
    } catch {
      setState('error');
      setStatusMessage('Could not start browser speech recognition.');
    }
  }

  const isListening = state === 'listening';

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-40 ${
          isListening
            ? 'bg-rose-50 text-rose-800 border-rose-300'
            : state === 'unsupported' || state === 'error'
            ? 'bg-amber-50 text-amber-900 border-amber-300'
            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
        }`}
      >
        {isListening ? (
          <MicOff className="w-3.5 h-3.5 text-rose-600" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-slate-600" />
        )}
        <span>{isListening ? 'Listening…' : label}</span>
      </button>

      {statusMessage && (
        <span
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-1 text-[11px] ${
            state === 'error' || state === 'unsupported'
              ? 'text-amber-800 font-medium'
              : isListening
              ? 'text-rose-700 font-medium'
              : 'text-slate-600'
          }`}
        >
          {(state === 'error' || state === 'unsupported') && (
            <AlertCircle className="w-3 h-3 shrink-0" />
          )}
          <span>{statusMessage}</span>
        </span>
      )}
    </div>
  );
}
