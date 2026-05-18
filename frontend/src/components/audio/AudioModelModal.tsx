import React, { useEffect } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { Download, Check, Volume2, HardDrive } from 'lucide-react';

export const AudioModelModal: React.FC = () => {
  const { voices, fetchVoices, downloadVoice, downloadProgress, activeModelId, setActiveModel } = useAudioStore();
  const [isOpen, setIsOpen] = React.useState(false);

  useEffect(() => {
    fetchVoices().then(() => {
      const state = useAudioStore.getState();
      const hasInstalled = state.voices.some(v => v.is_installed);
      if (!hasInstalled && state.voices.length > 0) {
        setIsOpen(true);
      }
    });
  }, [fetchVoices]);

  if (!isOpen && !voices.some(v => v.is_installed)) {
    return (
      <div className="fixed bottom-4 right-4 bg-elevated border border-red-500/30 rounded-xl p-4 shadow-float z-50 flex items-center gap-4">
        <Volume2 className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">No TTS Voice Installed</p>
          <p className="text-xs text-muted">Audio playback requires a voice model.</p>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
        >
          Setup
        </button>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-panel-soft border border-line rounded-2xl w-full max-w-xl overflow-hidden shadow-float flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-line">
          <h2 className="text-xl font-semibold text-ink flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-accent" />
            Voice Model Setup
          </h2>
          <p className="text-sm text-muted mt-2">
            To enable local Text-to-Speech (TTS), you need to download a voice model. These run entirely on your hardware and never connect to the cloud.
          </p>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {voices.map((voice) => {
            const isDownloading = downloadProgress[voice.model_id] !== undefined;
            const progress = downloadProgress[voice.model_id] || 0;
            const isActive = activeModelId === voice.model_id;
            
            return (
              <div 
                key={voice.model_id}
                className={`p-4 rounded-xl border transition-colors ${
                  isActive ? 'border-accent/50 bg-accent/10' : 'border-line bg-elevated hover:border-accent/40'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-ink">{voice.name || voice.model_id}</h3>
                    <p className="text-xs text-muted flex items-center gap-1 mt-1">
                      <HardDrive className="w-3 h-3" />
                      {(voice.size_bytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  
                  {voice.is_installed ? (
                    <button
                      onClick={() => setActiveModel(voice.model_id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-accent text-accent-ink' 
                          : 'bg-subtle hover:bg-hover text-ink'
                      }`}
                    >
                      {isActive ? 'Active' : 'Select'}
                    </button>
                  ) : (
                    <button
                      onClick={() => downloadVoice(voice.model_id, voice.onnx_url!, voice.json_url!)}
                      disabled={isDownloading}
                      className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {isDownloading ? (
                        `${progress}%`
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {isDownloading && (
                  <div className="w-full h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-line flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-elevated hover:bg-hover text-ink rounded-xl text-sm font-medium transition-colors"
          >
            {voices.some(v => v.is_installed) ? 'Done' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  );
};
