import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Loader2, VolumeX, Volume2 } from 'lucide-react';
import { useAudioStore } from '../../store/audioStore';

interface AudioPlayerProps {
  src: string;
  durationMs?: number;
  transcript?: string;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, durationMs, transcript, autoPlay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Audio arbitration via store
  const { state, setState } = useAudioStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#3b82f6', // blue-500
      progressColor: '#60a5fa', // blue-400
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 36,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
      if (autoPlay) {
        ws.play();
      }
    });

    ws.on('play', () => {
      setIsPlaying(true);
      setState('PLAYING_AUDIO');
    });

    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      setState('IDLE');
    });

    ws.load(src);

    return () => {
      ws.destroy();
      // If we unmount while playing, free up the state
      const currentState = useAudioStore.getState().state;
      if (currentState === 'PLAYING_AUDIO') {
        useAudioStore.getState().setState('IDLE');
      }
    };
  }, [src, autoPlay, setState]);

  // Handle global interruptions (e.g. user starts recording or stops generation)
  useEffect(() => {
    if (state === 'INTERRUPTED' || state === 'RECORDING') {
      if (wavesurferRef.current && isPlaying) {
        wavesurferRef.current.pause();
      }
    }
  }, [state, isPlaying]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    
    // Pause any other active player by emitting state change
    if (!isPlaying) {
       setState('PLAYING_AUDIO');
    }
    
    wavesurferRef.current.playPause();
  };
  
  const toggleMute = () => {
    if (!wavesurferRef.current) return;
    const newMute = !isMuted;
    wavesurferRef.current.setMuted(newMute);
    setIsMuted(newMute);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 max-w-sm w-full">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            !isReady ? 'bg-gray-800 text-gray-500' : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          title={isPlaying ? "Pause" : "Play"}
        >
          {!isReady ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-1" />
          )}
        </button>
        
        <div className="flex-1 overflow-hidden" ref={containerRef} />
        
        <button onClick={toggleMute} className="text-muted hover:text-ink transition-colors p-1" title="Toggle Mute">
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
      
      {(durationMs || transcript) && (
        <div className="flex items-center justify-between px-1">
          {durationMs && (
            <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
              {formatTime(durationMs)}
            </span>
          )}
          {transcript && (
            <p className="text-xs text-muted truncate max-w-[200px]" title={transcript}>
              "{transcript}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};
