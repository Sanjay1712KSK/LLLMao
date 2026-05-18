from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChatCreate, ChatRead, ChatRequest, ChatUpdate, MessageRead
from app.services import chat_service
from app.services.ollama_service import OllamaService, OllamaUnavailableError

router = APIRouter(tags=["chat"])


@router.get("/chats", response_model=list[ChatRead])
def get_chats(db: Session = Depends(get_db)) -> list[ChatRead]:
    return [ChatRead.model_validate(chat) for chat in chat_service.list_chats(db)]


@router.post("/chats", response_model=ChatRead, status_code=status.HTTP_201_CREATED)
def post_chat(payload: ChatCreate, db: Session = Depends(get_db)) -> ChatRead:
    return ChatRead.model_validate(chat_service.create_chat(db, payload.title))


@router.patch("/chats/{chat_id}", response_model=ChatRead)
def patch_chat(chat_id: int, payload: ChatUpdate, db: Session = Depends(get_db)) -> ChatRead:
    chat = chat_service.update_chat(db, chat_id, title=payload.title, pinned=payload.pinned)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return ChatRead.model_validate(chat)


@router.delete("/chats/{chat_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_chat(chat_id: int, db: Session = Depends(get_db)) -> Response:
    if not chat_service.delete_chat(db, chat_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/chats", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_all_chats(db: Session = Depends(get_db)) -> Response:
    chat_service.delete_all_chats(db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/messages/{chat_id}", response_model=list[MessageRead])
def get_messages(chat_id: int, db: Session = Depends(get_db)) -> list[MessageRead]:
    if chat_service.get_chat(db, chat_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return [MessageRead.model_validate(message) for message in chat_service.list_messages(db, chat_id)]


@router.post("/chat")
async def stream_chat(payload: ChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    chat = chat_service.get_chat(db, payload.chat_id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    if chat.title == "New chat":
        chat_service.rename_chat(db, chat.id, chat_service.title_from_message(payload.message))

    chat_service.add_message(db, payload.chat_id, "user", payload.message)
    history = chat_service.list_messages(db, payload.chat_id)
    ollama_messages = [{"role": message.role, "content": message.content} for message in history]

    async def event_stream():
        assistant_content: list[str] = []
        try:
            async for chunk in OllamaService().stream_chat(payload.model, ollama_messages):
                assistant_content.append(chunk)
                yield chunk
        except OllamaUnavailableError as exc:
            yield f"\n\n[Error: {exc}]"
            return
        finally:
            content = "".join(assistant_content).strip()
            if content:
                chat_service.add_message(db, payload.chat_id, "assistant", content)

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
