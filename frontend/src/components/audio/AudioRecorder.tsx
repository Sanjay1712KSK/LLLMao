import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Square, Loader2 } from 'lucide-react';
import { useAudioStore } from '../../store/audioStore';
import { useChatStore } from '../../store/chatStore';
import { API_BASE_URL } from '../../services/api';

export const AudioRecorder: React.FC = () => {
  const { state, setState, silenceDetectionEnabled, silenceSensitivity, silenceTimeoutMs } = useAudioStore();
  const { sendMessage } = useChatStore();
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [volume, setVolume] = useState(0);

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      
      const mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        cleanup();
      };
      
      // Silence Detection
      if (silenceDetectionEnabled) {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(mediaStream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        monitorSilence();
      }
      
      mediaRecorder.start(100); // 100ms chunks
      setState('RECORDING');
    } catch (error) {
      console.error("Failed to start recording:", error);
      setState('FAILED');
      setTimeout(() => setState('IDLE'), 2000);
    }
  };

  const monitorSilence = () => {
    if (!analyserRef.current || state !== 'RECORDING') return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / bufferLength;
    setVolume(average);
    
    // threshold based on sensitivity (0-100) -> mapping to 0-255 volume average
    const threshold = (silenceSensitivity / 100) * 50; 
    
    if (average < threshold) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = window.setTimeout(() => {
          stopRecording();
        }, silenceTimeoutMs);
      }
    } else {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(monitorSilence);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  };

  const processAudio = async (blob: Blob) => {
    setState('PROCESSING_STT');
    
    try {
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      
      // We pass the active chat_id if available (not strictly required here if we use message_id linking later)
      const { currentChatId } = useChatStore.getState();
      if (currentChatId) {
        formData.append('chat_id', currentChatId.toString());
      }

      const response = await fetch(`${API_BASE_URL}/audio/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const attachment = await response.json();
      
      // If there's a transcript, send it as a message
      if (attachment.transcript) {
        setState('WAITING_FOR_LLM');
        // Currently, sendMessage might need modification to accept attachments. 
        // For now we send the transcript text.
        await sendMessage(attachment.transcript); 
      }
      
      setState('IDLE');
    } catch (error) {
      console.error("Audio processing failed", error);
      setState('FAILED');
      setTimeout(() => setState('IDLE'), 2000);
    }
  };

  useEffect(() => {
    return cleanup;
  }, []);

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
        state === 'RECORDING' 
          ? 'border-red-500 bg-red-500/20 text-red-400'
          : state === 'PROCESSING_STT'
          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
          : 'border-line text-muted hover:bg-white/5 hover:text-ink'
      }`}
      type="button"
      onClick={state === 'RECORDING' ? stopRecording : startRecording}
      disabled={state !== 'IDLE' && state !== 'RECORDING'}
      title={state === 'RECORDING' ? 'Stop Recording' : 'Start Voice Input'}
    >
      {state === 'IDLE' && (
        <>
          <Mic size={14} className="mr-2" />
          Voice
        </>
      )}
      {state === 'RECORDING' && (
        <>
          <Square size={14} className="mr-2 fill-current" />
          Recording...
          {silenceDetectionEnabled && (
            <div className="ml-2 flex items-center gap-0.5">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className="w-1 bg-red-400 rounded-full transition-all duration-75"
                  style={{ height: Math.max(4, (volume / 255) * 16 * (Math.random() * 0.5 + 0.5)) + 'px' }}
                />
              ))}
            </div>
          )}
        </>
      )}
      {state === 'PROCESSING_STT' && (
        <>
          <Loader2 size={14} className="mr-2 animate-spin" />
          Transcribing...
        </>
      )}
      {state === 'WAITING_FOR_LLM' && (
        <>
          <Loader2 size={14} className="mr-2 animate-spin" />
          Thinking...
        </>
      )}
      {state === 'FAILED' && (
        <>
          <MicOff size={14} className="mr-2 text-red-500" />
          Failed
        </>
      )}
    </button>
  );
};
