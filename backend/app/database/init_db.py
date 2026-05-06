from app.database.session import Base, engine
from app.models import chat, rag
from sqlalchemy import inspect, text


def init_db() -> None:
    _ = chat
    _ = rag
    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema()


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
