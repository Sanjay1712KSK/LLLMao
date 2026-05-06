from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Chat, Message


def list_chats(db: Session) -> list[Chat]:
    return list(db.scalars(select(Chat).order_by(Chat.pinned.desc(), Chat.updated_at.desc(), Chat.created_at.desc())))


def create_chat(db: Session, title: str = "New chat") -> Chat:
    chat = Chat(title=title.strip() or "New chat")
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


def get_chat(db: Session, chat_id: int) -> Chat | None:
    return db.get(Chat, chat_id)


def update_chat(db: Session, chat_id: int, title: str | None = None, pinned: bool | None = None) -> Chat | None:
    chat = get_chat(db, chat_id)
    if chat is None:
        return None
    if title is not None:
        chat.title = title.strip()[:160] or "New chat"
    if pinned is not None:
        chat.pinned = pinned
    db.commit()
    db.refresh(chat)
    return chat


def rename_chat(db: Session, chat_id: int, title: str) -> Chat | None:
    return update_chat(db, chat_id, title=title)


def delete_chat(db: Session, chat_id: int) -> bool:
    chat = get_chat(db, chat_id)
    if chat is None:
        return False
    db.delete(chat)
    db.commit()
    return True


def list_messages(db: Session, chat_id: int) -> list[Message]:
    return list(db.scalars(select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at.asc(), Message.id.asc())))


def add_message(db: Session, chat_id: int, role: str, content: str) -> Message:
    message = Message(chat_id=chat_id, role=role, content=content)
    db.add(message)
    chat = get_chat(db, chat_id)
    if chat is not None:
        chat.updated_at = func.now()
    db.commit()
    db.refresh(message)
    return message


def title_from_message(content: str) -> str:
    normalized = " ".join(content.strip().split())
    if not normalized:
        return "New chat"
    return normalized[:64]
