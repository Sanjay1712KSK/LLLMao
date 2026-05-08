import logging
import os
from pathlib import Path
from typing import AsyncGenerator
import asyncio

from piper import PiperVoice

from app.config import get_settings

logger = logging.getLogger("lllmao.audio.tts")
settings = get_settings()

_tts_voice: PiperVoice | None = None
_current_model_path: str | None = None

def get_installed_voices() -> list[dict]:
    """Returns a list of installed piper voices from the models directory."""
    piper_dir = Path(settings.models_piper_path)
    if not piper_dir.exists():
        return []
    
    voices = []
    # We look for .onnx files
    for onnx_file in piper_dir.glob("*.onnx"):
        json_file = onnx_file.with_suffix(".onnx.json")
        if json_file.exists():
            voices.append({
                "model_id": onnx_file.stem,
                "onnx_path": str(onnx_file),
                "json_path": str(json_file),
                "size_bytes": onnx_file.stat().st_size
            })
    return voices

def load_voice(model_id: str) -> PiperVoice:
    global _tts_voice, _current_model_path
    
    piper_dir = Path(settings.models_piper_path)
    onnx_path = piper_dir / f"{model_id}.onnx"
    json_path = piper_dir / f"{model_id}.onnx.json"
    
    if not onnx_path.exists() or not json_path.exists():
        raise FileNotFoundError(f"Piper model {model_id} not found in {piper_dir}")
        
    if _current_model_path == str(onnx_path) and _tts_voice is not None:
        return _tts_voice
        
    logger.info(f"Loading Piper TTS voice: {model_id}")
    _tts_voice = PiperVoice.load(str(onnx_path), str(json_path))
    _current_model_path = str(onnx_path)
    return _tts_voice

async def synthesize_stream(text: str, model_id: str) -> AsyncGenerator[bytes, None]:
    """
    Asynchronously yields synthesized audio chunks as raw PCM bytes.
    This enables streaming playback to the frontend without blocking chat streams.
    """
    voice = load_voice(model_id)
    
    # We run the synthesis in a threadpool to prevent blocking the event loop
    loop = asyncio.get_running_loop()
    
    def _generate():
        return voice.synthesize_stream_raw(text)
        
    # This might block if synthesize_stream_raw is a generator that blocks on yield
    # piper's synthesize_stream_raw yields chunks of PCM audio.
    # We need to adapt it cleanly.
    audio_stream = await loop.run_in_executor(None, _generate)
    
    for chunk in audio_stream:
        # Yield execution so we don't hog the thread
        await asyncio.sleep(0)
        yield chunk

async def synthesize_to_file(text: str, model_id: str, output_path: str) -> None:
    """
    Synthesizes audio and saves it to a persistent file.
    """
    voice = load_voice(model_id)
    import wave
    
    loop = asyncio.get_running_loop()
    def _generate():
        with wave.open(output_path, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2) # 16-bit
            wav_file.setframerate(voice.config.sample_rate)
            
            for chunk in voice.synthesize_stream_raw(text):
                wav_file.writeframes(chunk)
                
    await loop.run_in_executor(None, _generate)
