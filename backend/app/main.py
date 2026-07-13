import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .routers import auth, admin, inventory


models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Hệ thống Quản lý Kho",
    version="1.0.0",
)

UPLOAD_DIR = os.getenv(
    "UPLOAD_DIR",
    "./storage_data",
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)

# --- ĐÃ SỬA CHỖ NÀY ---
# Mở khóa CORS cho phép mọi thiết bị trong mạng LAN (xưởng) truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Dùng "*" cho mạng LAN nội bộ, hoặc bạn có thể điền IP cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(inventory.router)
app.include_router(admin.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )