import logging
import os
from pathlib import Path
from typing import Any
import httpx
import aiofiles

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.config import get_settings
from app.audio.tts import get_installed_voices

logger = logging.getLogger("lllmao.routers.audio")
settings = get_settings()

router = APIRouter(tags=["audio"])

class PiperModelDownload(BaseModel):
    model_id: str
    onnx_url: str
    json_url: str

AVAILABLE_VOICES = [
    {
        "model_id": "en_US-lessac-medium",
        "name": "Lessac (English US, Medium)",
        "onnx_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true",
        "json_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true"
    },
    {
        "model_id": "en_US-amy-medium",
        "name": "Amy (English US, Medium)",
        "onnx_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx?download=true",
        "json_url": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json?download=true"
    }
]

@router.get("/audio/models/piper/available")
async def list_available_piper_voices():
    installed = get_installed_voices()
    installed_ids = {v["model_id"] for v in installed}
    
    return {
        "installed": installed,
        "available": [
            {**v, "is_installed": v["model_id"] in installed_ids} 
            for v in AVAILABLE_VOICES
        ]
    }

async def download_file(url: str, dest_path: Path):
    async with httpx.AsyncClient(follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            async with aiofiles.open(dest_path, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    await f.write(chunk)

@router.post("/audio/models/piper/download")
async def download_piper_voice(payload: PiperModelDownload, background_tasks: BackgroundTasks):
    piper_dir = Path(settings.models_piper_path)
    piper_dir.mkdir(parents=True, exist_ok=True)
    
    onnx_path = piper_dir / f"{payload.model_id}.onnx"
    json_path = piper_dir / f"{payload.model_id}.onnx.json"
    
    if onnx_path.exists() and json_path.exists():
        return {"status": "already_installed"}
        
    async def _do_download():
        try:
            logger.info(f"Downloading piper model {payload.model_id}")
            await download_file(payload.json_url, json_path)
            await download_file(payload.onnx_url, onnx_path)
            logger.info(f"Successfully downloaded {payload.model_id}")
        except Exception as e:
            logger.error(f"Failed to download {payload.model_id}: {e}")
            if onnx_path.exists(): onnx_path.unlink()
            if json_path.exists(): json_path.unlink()
            
    background_tasks.add_task(_do_download)
    return {"status": "downloading", "model_id": payload.model_id}

import json
from fastapi import File, Form, UploadFile, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.chat import ChatAttachment, AttachmentType, AttachmentSource
from app.schemas.chat import ChatAttachmentRead
from app.audio.utils import save_upload
from app.audio.stt import transcribe_audio

@router.post("/audio/upload", response_model=ChatAttachmentRead)
async def upload_audio(chat_id: int | None = Form(default=None), file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type and not file.content_type.startswith("audio/") and file.content_type != "application/octet-stream":
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload must be an audio recording.")

    # save file
    attachment_id, storage_path = await save_upload(file, chat_id)
    
    # run STT
    try:
        stt_result = await transcribe_audio(storage_path)
    except Exception as e:
        logger.exception("stt_failed", extra={"storage_path": storage_path})
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Voice transcription failed.",
                "details": str(e),
                "recovery": "Check microphone input, ffmpeg availability, and the faster-whisper model cache.",
            },
        ) from e
    
    # create attachment record
    attachment = ChatAttachment(
        id=attachment_id,
        message_id=None,
        type=AttachmentType.AUDIO,
        source_type=AttachmentSource.USER,
        mime_type=file.content_type or "audio/webm",
        filename=file.filename or "audio.webm",
        storage_path=storage_path,
        duration_ms=int(stt_result["duration"] * 1000) if stt_result["duration"] else None,
        transcript=stt_result["text"] if stt_result["text"] else None,
        timestamps_json=json.dumps(stt_result["segments"]),
        extra_metadata=json.dumps({
            "stt_latency_ms": stt_result["latency_ms"],
            "language": stt_result["language"],
            "language_prob": stt_result["language_probability"]
        })
    )
    
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return ChatAttachmentRead.model_validate(attachment)

from fastapi.responses import FileResponse

@router.get("/media/{chat_id}/{attachment_id}")
def get_media(chat_id: int, attachment_id: str, db: Session = Depends(get_db)):
    attachment = db.get(ChatAttachment, attachment_id)
    if not attachment or attachment.message_id is not None and attachment.message.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Media not found")
    if not Path(attachment.storage_path).exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(attachment.storage_path, media_type=attachment.mime_type, filename=attachment.filename)

import base64
from fastapi.responses import StreamingResponse
from app.audio.tts import synthesize_stream

class SynthesizeRequest(BaseModel):
    text: str
    model_id: str
    session_id: str | None = None

@router.post("/audio/synthesize_stream")
async def synthesize_audio_stream(payload: SynthesizeRequest):
    async def event_stream():
        try:
            async for chunk in synthesize_stream(payload.text, payload.model_id):
                b64_chunk = base64.b64encode(chunk).decode('utf-8')
                event = {
                    "type": "tts_chunk",
                    "session_id": payload.session_id,
                    "payload": {"audio_base64": b64_chunk}
                }
                yield f"data: {json.dumps(event)}\n\n"
            yield f"data: {json.dumps({'type': 'tts_done', 'session_id': payload.session_id, 'payload': {}})}\n\n"
        except Exception as e:
            logger.error(f"TTS streaming failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'payload': {'message': str(e)}})}\n\n"
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")

class GenerateRequest(BaseModel):
    text: str
    model_id: str
    chat_id: int
    message_id: int | None = None

@router.post("/audio/generate", response_model=ChatAttachmentRead)
async def generate_audio(payload: GenerateRequest, db: Session = Depends(get_db)):
    from app.audio.tts import synthesize_to_file
    from app.audio.utils import get_generated_dir
    import uuid
    import time
    
    attachment_id = str(uuid.uuid4())
    dest_dir = get_generated_dir(payload.chat_id)
    storage_path = dest_dir / f"{attachment_id}.wav"
    
    start = time.time()
    await synthesize_to_file(payload.text, payload.model_id, str(storage_path))
    latency = time.time() - start
    
    import wave
    with wave.open(str(storage_path), "rb") as w:
        frames = w.getnframes()
        rate = w.getframerate()
        duration = frames / float(rate)
    
    attachment = ChatAttachment(
        id=attachment_id,
        message_id=payload.message_id,
        type=AttachmentType.AUDIO,
        source_type=AttachmentSource.ASSISTANT,
        mime_type="audio/wav",
        filename=f"tts_{attachment_id[:8]}.wav",
        storage_path=str(storage_path),
        duration_ms=int(duration * 1000),
        transcript=payload.text,
        extra_metadata=json.dumps({"tts_latency_ms": int(latency * 1000)})
    )
    
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return ChatAttachmentRead.model_validate(attachment)
