import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


load_dotenv()

# Thư mục gốc backend, nằm bên ngoài folder app.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Database hiện tại của bạn:
# backend/app/app.db
DEFAULT_DATABASE_PATH = (
    Path(__file__).resolve().parent / "app.db"
)


def build_database_url() -> str:
    database_url = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DEFAULT_DATABASE_PATH.as_posix()}",
    ).strip()

    # Không xử lý đường dẫn nếu sau này chuyển sang MySQL/PostgreSQL.
    if not database_url.startswith("sqlite:///"):
        return database_url

    raw_database_path = database_url.removeprefix(
        "sqlite:///"
    )

    database_path = Path(raw_database_path)

    if not database_path.is_absolute():
        database_path = (
            PROJECT_ROOT / database_path
        ).resolve()

    # Tự tạo thư mục chứa database nếu chưa tồn tại.
    database_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    return f"sqlite:///{database_path.as_posix()}"


SQLALCHEMY_DATABASE_URL = build_database_url()

connect_args = {}

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False,
    }

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()