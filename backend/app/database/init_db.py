import logging

from app.database.session import Base, engine
from app.models import chat, developer_tools, memory, multimodal, rag, workspace
from sqlalchemy import inspect, text

logger = logging.getLogger("lllmao.database")


def init_db() -> None:
    _ = chat
    _ = developer_tools
    _ = memory
    _ = multimodal
    _ = rag
    _ = workspace
    try:
        Base.metadata.create_all(bind=engine)
        migrate_sqlite_schema()
        sqlite_integrity_check()
    except Exception:
        logger.exception("database_initialization_failed")
        raise


def migrate_sqlite_schema() -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "chats" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("chats")}
    with engine.begin() as connection:
        if "pinned" not in columns:
            connection.execute(text("ALTER TABLE chats ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT 0"))
        if "updated_at" not in columns:
            connection.execute(text("ALTER TABLE chats ADD COLUMN updated_at DATETIME"))
        connection.execute(text("UPDATE chats SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL"))
        
        # Migrate messages table
        if "messages" in inspector.get_table_names():
            msg_columns = {column["name"] for column in inspector.get_columns("messages")}
            if "model_name" not in msg_columns:
                connection.execute(text("ALTER TABLE messages ADD COLUMN model_name VARCHAR(120)"))


def sqlite_integrity_check() -> None:
    if engine.dialect.name != "sqlite":
        return
    try:
        with engine.connect() as connection:
            result = connection.execute(text("PRAGMA quick_check")).scalar()
        if result != "ok":
            logger.warning("sqlite_quick_check_failed", extra={"result": result})
    except Exception:
        logger.exception("sqlite_quick_check_error")
        raise
