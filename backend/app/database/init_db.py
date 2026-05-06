from app.database.session import Base, engine
from app.models import chat


def init_db() -> None:
    _ = chat
    Base.metadata.create_all(bind=engine)
