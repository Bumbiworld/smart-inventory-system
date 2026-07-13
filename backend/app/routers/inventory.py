from __future__ import annotations

import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

UPLOAD_DIR = Path(
    os.getenv(
        "UPLOAD_DIR",
        "./storage_data",
    )
).resolve()

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

def _public_file_url(*parts: str) -> str:
    encoded_path = quote(
        "/".join(parts),
        safe="/",
    )
    return f"/uploads/{encoded_path}"

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/octet-stream",
}

router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
    # Mọi endpoint trong router này yêu cầu đăng nhập.
    # Cả admin và user đều có thể sử dụng.
    dependencies=[Depends(get_current_user)],
)


def _safe_folder_name(name: str) -> str:
    safe_name = re.sub(r'[\\/*?:"<>|]', "", name).strip()
    return safe_name or "unnamed"


def _folder_dir_name(folder: models.Folder) -> str:
    return f"{folder.id}_{_safe_folder_name(folder.name)}"


def _get_folder_or_404(db: Session, folder_id: int) -> models.Folder:
    folder = (
        db.query(models.Folder)
        .filter(models.Folder.id == folder_id)
        .first()
    )
    if not folder:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy lô vật liệu.",
        )
    return folder


def _get_image_or_404(
    db: Session,
    folder_id: int,
    image_id: int,
) -> models.ImageRecord:
    image = (
        db.query(models.ImageRecord)
        .filter(
            models.ImageRecord.id == image_id,
            models.ImageRecord.folder_id == folder_id,
        )
        .first()
    )
    if not image:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy ảnh trong lô vật liệu này.",
        )
    return image


def _physical_path_from_file_url(file_url: str) -> Path:
    parsed = urlparse(file_url)
    decoded_path = unquote(parsed.path)
    marker = "/uploads/"

    if marker not in decoded_path:
        raise HTTPException(
            status_code=500,
            detail="Đường dẫn ảnh trong database không hợp lệ.",
        )

    relative_path = decoded_path.split(marker, 1)[1]
    candidate = (UPLOAD_DIR / relative_path).resolve()

    try:
        candidate.relative_to(UPLOAD_DIR)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Đường dẫn file nằm ngoài thư mục lưu trữ.",
        ) from exc

    return candidate


@router.get("/folders", response_model=list[schemas.FolderResponse])
def get_folders(db: Session = Depends(get_db)):
    return (
        db.query(models.Folder)
        .order_by(models.Folder.created_at.desc())
        .all()
    )


@router.post("/folders", response_model=schemas.FolderResponse)
def create_folder(
    folder: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder_name = folder.name.strip()
    if not folder_name:
        raise HTTPException(
            status_code=400,
            detail="Tên lô vật liệu không được để trống.",
        )

    db_folder = models.Folder(
        name=folder_name,
        uploader_email=current_user.email,
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder


@router.get(
    "/folders/{folder_id}",
    response_model=schemas.FolderResponse,
)
def get_single_folder(
    folder_id: int,
    db: Session = Depends(get_db),
):
    return _get_folder_or_404(db, folder_id)


@router.get(
    "/folders/{folder_id}/images",
    response_model=list[schemas.ImageResponse],
)
def get_folder_images(
    folder_id: int,
    db: Session = Depends(get_db),
):
    _get_folder_or_404(db, folder_id)

    return (
        db.query(models.ImageRecord)
        .filter(models.ImageRecord.folder_id == folder_id)
        .order_by(
            models.ImageRecord.original_time.desc(),
            models.ImageRecord.id.desc(),
        )
        .all()
    )


@router.post(
    "/folders/{folder_id}/images",
    response_model=schemas.ImageResponse,
)
async def upload_image(
    folder_id: int,
    file: UploadFile = File(...),
    upload_date: str = Form(...),
    db: Session = Depends(get_db),
):
    folder = _get_folder_or_404(db, folder_id)

    try:
        selected_date = datetime.strptime(
            upload_date,
            "%Y-%m-%d",
        ).date()
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Ngày nhập kho phải có định dạng YYYY-MM-DD.",
        ) from exc

    original_filename = file.filename or ""
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Chỉ hỗ trợ JPG, JPEG, PNG, WEBP và HEIC.",
        )

    if (
        file.content_type
        and file.content_type not in ALLOWED_CONTENT_TYPES
        and not file.content_type.startswith("image/")
    ):
        raise HTTPException(
            status_code=400,
            detail="File tải lên không phải định dạng ảnh hợp lệ.",
        )

    folder_dir_name = _folder_dir_name(folder)
    folder_date = selected_date.isoformat()
    target_directory = (
        UPLOAD_DIR / folder_dir_name / folder_date
    ).resolve()
    target_directory.mkdir(parents=True, exist_ok=True)

    now = datetime.now()
    original_time = datetime.combine(
        selected_date,
        now.time().replace(microsecond=0),
    )

    image = models.ImageRecord(
        folder_id=folder_id,
        filename="",
        file_path="",
        size_mb="0.00 MB",
        original_time=original_time,
        status="in_stock",
    )

    file_location: Path | None = None

    try:
        # flush để lấy ID trước khi đặt tên file.
        db.add(image)
        db.flush()

        new_filename = f"{image.id:06d}{extension}"
        file_location = target_directory / new_filename

        with file_location.open("wb") as output_file:
            shutil.copyfileobj(file.file, output_file)

        size_value = file_location.stat().st_size / (1024 * 1024)
        size_text = f"{size_value:.2f} MB"

        image.filename = new_filename
        image.file_path = _public_file_url(
            folder_dir_name,
            folder_date,
            new_filename,
        )
        image.size_mb = size_text

        folder.image_count = (folder.image_count or 0) + 1
        # Model hiện tại lưu Integer nên dashboard chỉ hiển thị gần đúng.
        folder.size_mb = int(round((folder.size_mb or 0) + size_value))

        db.commit()
        db.refresh(image)
        return image
    except HTTPException:
        db.rollback()
        if file_location and file_location.exists():
            file_location.unlink(missing_ok=True)
        raise
    except Exception as exc:
        db.rollback()
        if file_location and file_location.exists():
            file_location.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Không thể lưu ảnh: {str(exc)}",
        ) from exc
    finally:
        await file.close()


@router.put(
    "/folders/{folder_id}/images/{image_id}/pick",
    response_model=schemas.ImageResponse,
)
def pick_image_for_work(
    folder_id: int,
    image_id: int,
    db: Session = Depends(get_db),
):
    folder = _get_folder_or_404(db, folder_id)
    image = _get_image_or_404(db, folder_id, image_id)

    if image.status != "in_stock":
        raise HTTPException(
            status_code=409,
            detail="Chỉ ảnh đang ở trong kho mới có thể đưa vào chờ cắt.",
        )

    current_path = _physical_path_from_file_url(image.file_path)
    if not current_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy file ảnh trên ổ cứng.",
        )

    folder_dir_name = _folder_dir_name(folder)
    working_directory = (
        UPLOAD_DIR / folder_dir_name / "working_zone"
    ).resolve()
    working_directory.mkdir(parents=True, exist_ok=True)

    target_path = working_directory / image.filename
    if target_path.exists():
        raise HTTPException(
            status_code=409,
            detail="Ảnh đã tồn tại trong khu vực chờ cắt.",
        )

    try:
        shutil.move(str(current_path), str(target_path))
        image.status = "in_progress"
        image.file_path = _public_file_url(
            folder_dir_name,
            "working_zone",
            image.filename,
        )
        db.commit()
        db.refresh(image)
        return image
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Không thể đưa ảnh vào khu vực chờ cắt: {str(exc)}",
        ) from exc


@router.put(
    "/folders/{folder_id}/images/{image_id}/cancel",
    response_model=schemas.ImageResponse,
)
def cancel_image_work(
    folder_id: int,
    image_id: int,
    db: Session = Depends(get_db),
):
    folder = _get_folder_or_404(db, folder_id)
    image = _get_image_or_404(db, folder_id, image_id)

    if image.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail="Ảnh này không nằm trong khu vực chờ cắt.",
        )

    if not image.original_time:
        raise HTTPException(
            status_code=500,
            detail="Ảnh không có ngày nhập kho gốc.",
        )

    current_path = _physical_path_from_file_url(image.file_path)
    if not current_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy file ảnh trong khu vực chờ cắt.",
        )

    folder_dir_name = _folder_dir_name(folder)
    folder_date = image.original_time.strftime("%Y-%m-%d")
    target_directory = (
        UPLOAD_DIR / folder_dir_name / folder_date
    ).resolve()
    target_directory.mkdir(parents=True, exist_ok=True)

    target_path = target_directory / image.filename
    if target_path.exists():
        raise HTTPException(
            status_code=409,
            detail="File ảnh đã tồn tại tại vị trí nhập kho ban đầu.",
        )

    try:
        shutil.move(str(current_path), str(target_path))
        image.status = "in_stock"
        image.file_path = _public_file_url(
            folder_dir_name,
            folder_date,
            image.filename,
        )
        db.commit()
        db.refresh(image)
        return image
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Không thể trả ảnh về kho: {str(exc)}",
        ) from exc


@router.put(
    "/folders/{folder_id}/images/{image_id}/complete",
    response_model=schemas.ImageResponse,
)
def complete_image_work(
    folder_id: int,
    image_id: int,
    db: Session = Depends(get_db),
):
    _get_folder_or_404(db, folder_id)
    image = _get_image_or_404(db, folder_id, image_id)

    if image.status == "completed":
        return image

    if image.status != "in_progress":
        raise HTTPException(
            status_code=409,
            detail="Chỉ ảnh đang chờ cắt mới có thể đánh dấu hoàn thành.",
        )

    image.status = "completed"
    image.completed_time = datetime.now()

    db.commit()
    db.refresh(image)
    return image