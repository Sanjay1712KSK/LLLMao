import logging
import time
from typing import Any

from faster_whisper import WhisperModel
import librosa

from app.orchestration.scheduler import scheduler

logger = logging.getLogger("lllmao.audio.stt")

# Lazy loading of model
_stt_model: WhisperModel | None = None
_model_size = "base"
MAX_AUDIO_DURATION_SECONDS = 300  # 5 minutes limit to protect VRAM

async def _get_model() -> WhisperModel:
    global _stt_model
    if _stt_model is None:
        # Check orchestration to see if we should fallback to CPU
        admitted = await scheduler.admit_task(domain="GPU_COMPUTE", priority="realtime")
        device = "cuda" if admitted else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        
        logger.info(f"Loading faster-whisper model '{_model_size}' on {device} ({compute_type})")
        _stt_model = WhisperModel(_model_size, device=device, compute_type=compute_type)
    return _stt_model

async def transcribe_audio(file_path: str) -> dict[str, Any]:
    """
    Transcribes audio file using faster-whisper, returning segments and text.
    """
    # Duration limit check
    duration = librosa.get_duration(path=file_path)
    if duration > MAX_AUDIO_DURATION_SECONDS:
        raise ValueError(f"Audio duration {duration:.1f}s exceeds maximum allowed ({MAX_AUDIO_DURATION_SECONDS}s).")

    model = await _get_model()
    
    start_time = time.time()
    logger.info(f"Starting STT for {file_path}")
    
    # Run transcription
    # vad_filter=True acts as a chunking mechanism to prevent OOM
    segments_gen, info = model.transcribe(file_path, beam_size=5, vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500))
    
    segments = []
    full_text = []
    
    for segment in segments_gen:
        segments.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip()
        })
        full_text.append(segment.text.strip())
        
    latency = time.time() - start_time
    logger.info(f"STT completed in {latency:.2f}s for {file_path}")
    
    return {
        "text": " ".join(full_text),
        "segments": segments,
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": duration,
        "latency_ms": int(latency * 1000)
    }
