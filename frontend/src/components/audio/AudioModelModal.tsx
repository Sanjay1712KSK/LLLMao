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
      <div className="fixed bottom-4 right-4 bg-gray-900 border border-red-900/50 rounded-xl p-4 shadow-2xl z-50 flex items-center gap-4">
        <Volume2 className="w-5 h-5 text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">No TTS Voice Installed</p>
          <p className="text-xs text-gray-400">Audio playback requires a voice model.</p>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-blue-400" />
            Voice Model Setup
          </h2>
          <p className="text-sm text-gray-400 mt-2">
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
                  isActive ? 'border-blue-500/50 bg-blue-500/5' : 'border-gray-800 bg-gray-800/50 hover:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-white">{voice.name || voice.model_id}</h3>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <HardDrive className="w-3 h-3" />
                      {(voice.size_bytes / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  
                  {voice.is_installed ? (
                    <button
                      onClick={() => setActiveModel(voice.model_id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-white'
                      }`}
                    >
                      {isActive ? 'Active' : 'Select'}
                    </button>
                  ) : (
                    <button
                      onClick={() => downloadVoice(voice.model_id, voice.onnx_url!, voice.json_url!)}
                      disabled={isDownloading}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
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
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {voices.some(v => v.is_installed) ? 'Done' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  );
};
