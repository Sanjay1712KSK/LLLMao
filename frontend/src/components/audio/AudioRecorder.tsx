import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, RotateCcw, Square } from 'lucide-react';

import { API_BASE_URL } from '../../services/api';
import { useAudioStore } from '../../store/audioStore';
import { useChatStore } from '../../store/chatStore';
import { useNotificationStore } from '../../store/notificationStore';

type AudioRecorderProps = {
  onTranscript: (transcript: string) => Promise<void> | void;
};

const preferredMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscript }) => {
  const { state, setState, silenceDetectionEnabled, silenceSensitivity, silenceTimeoutMs, setLatencies } = useAudioStore();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [volume, setVolume] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef(false);

  const fail = (message: string) => {
    setErrorMessage(message);
    setState('FAILED');
    useNotificationStore.getState().notify({ kind: 'error', title: 'Voice input failed', message });
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    recordingRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    animationFrameRef.current = null;
    silenceTimerRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setState('PROCESSING_STT');
      mediaRecorderRef.current.stop();
    }
  };

  const monitorSilence = () => {
    if (!analyserRef.current || !recordingRef.current) return;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((sum, item) => sum + item, 0) / bufferLength;
    setVolume(average);

    const threshold = (silenceSensitivity / 100) * 50;
    if (average < threshold) {
      silenceTimerRef.current ??= window.setTimeout(stopRecording, silenceTimeoutMs);
    } else if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    animationFrameRef.current = window.requestAnimationFrame(monitorSilence);
  };

  const processAudio = async (blob: Blob) => {
    setState('PROCESSING_STT');
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120000);
      const formData = new FormData();
      const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
      formData.append('file', blob, `recording.${extension}`);
      const { currentChatId } = useChatStore.getState();
      if (currentChatId) formData.append('chat_id', currentChatId.toString());

      const response = await fetch(`${API_BASE_URL}/audio/upload`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const detail = typeof payload?.detail === 'object' ? payload.detail : null;
        throw new Error(detail?.message || payload?.detail || 'Voice upload failed.');
      }

      const attachment = await response.json();
      const transcript = String(attachment.transcript || '').trim();
      if (!transcript) throw new Error('No speech was detected in the recording.');
      const sttLatency = Number(attachment.extra_metadata?.stt_latency_ms);
      if (Number.isFinite(sttLatency)) setLatencies({ stt: sttLatency });
      setState('WAITING_FOR_LLM');
      await onTranscript(transcript);
      setState('IDLE');
    } catch (error) {
      fail(error instanceof Error && error.name === 'AbortError' ? 'Voice transcription timed out.' : error instanceof Error ? error.message : 'Voice transcription failed.');
    }
  };

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice recording is not supported by this browser runtime.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      streamRef.current = mediaStream;

      const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onerror = () => fail('The recording device stopped unexpectedly.');
      mediaRecorder.onstop = () => {
        recordingRef.current = false;
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (!audioBlob.size) {
          fail('No audio was captured. Check microphone permissions and try again.');
          cleanup();
          return;
        }
        setLastBlob(audioBlob);
        void processAudio(audioBlob).finally(cleanup);
      };

      if (silenceDetectionEnabled) {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(mediaStream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }

      recordingRef.current = true;
      mediaRecorder.start(100);
      setState('RECORDING');
      if (silenceDetectionEnabled) monitorSilence();
    } catch (error) {
      cleanup();
      fail(error instanceof Error ? error.message : 'Microphone permission was denied or unavailable.');
    }
  };

  const retry = async () => {
    setErrorMessage(null);
    if (lastBlob) await processAudio(lastBlob);
    else await startRecording();
  };

  useEffect(() => cleanup, []);

  const isBusy = state === 'PROCESSING_STT' || state === 'WAITING_FOR_LLM';
  const level = Math.max(4, Math.round((volume / 255) * 18));

  return (
    <button
      className={`inline-flex min-h-8 items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
        state === 'RECORDING'
          ? 'border-red-500/50 bg-red-500/15 text-red-300'
          : isBusy
          ? 'border-accent/50 bg-accent/10 text-accent'
          : state === 'FAILED'
          ? 'border-red-500/50 bg-red-500/10 text-red-300'
          : 'border-line text-muted hover:bg-hover hover:text-ink'
      }`}
      type="button"
      onClick={state === 'RECORDING' ? stopRecording : state === 'FAILED' ? retry : startRecording}
      disabled={isBusy}
      title={errorMessage || (state === 'RECORDING' ? 'Stop recording' : 'Start voice input')}
    >
      {state === 'IDLE' && <><Mic size={14} className="mr-2" /> Voice</>}
      {state === 'RECORDING' && (
        <>
          <Square size={14} className="mr-2 fill-current" /> Recording
          {silenceDetectionEnabled && (
            <span className="ml-2 flex h-4 items-end gap-0.5">
              {[0.7, 1, 0.8].map((scale, index) => (
                <span key={index} className="w-1 rounded-full bg-red-300 transition-all" style={{ height: `${Math.max(4, level * scale)}px` }} />
              ))}
            </span>
          )}
        </>
      )}
      {state === 'PROCESSING_STT' && <><Loader2 size={14} className="mr-2 animate-spin" /> Transcribing</>}
      {state === 'WAITING_FOR_LLM' && <><Loader2 size={14} className="mr-2 animate-spin" /> Sending</>}
      {state === 'FAILED' && <>{lastBlob ? <RotateCcw size={14} className="mr-2" /> : <MicOff size={14} className="mr-2" />} Retry</>}
    </button>
  );
};
