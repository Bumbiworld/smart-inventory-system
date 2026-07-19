from __future__ import annotations

import os
import re
import shutil
from datetime import datetime, timedelta, timezone
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
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user, require_admin

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

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".dng"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/dng",           
    "image/x-adobe-dng",   
    "application/x-adobe-dng", 
    "application/octet-stream",
}

router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
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


# ==========================================
# CÁC API QUẢN LÝ TAG (NHÃN DÁN)
# ==========================================

@router.get("/tags", response_model=list[schemas.TagResponse])
def get_all_tags(db: Session = Depends(get_db)):
    return db.query(models.Tag).order_by(models.Tag.name).all()

@router.post(
    "/tags",
    response_model=schemas.TagResponse,
    dependencies=[Depends(require_admin)],
)
def create_new_tag(
    tag_data: schemas.TagCreate,
    db: Session = Depends(get_db),
):
    tag_name = tag_data.name.strip()

    if not tag_name:
        raise HTTPException(
            status_code=400,
            detail="Tên tag không được để trống.",
        )

    existing = (
        db.query(models.Tag)
        .filter(func.lower(models.Tag.name) == tag_name.lower())
        .first()
    )

    if existing:
        return existing

    new_tag = models.Tag(
        name=tag_name,
        color_code=tag_data.color_code or "#3B82F6",
    )

    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag


@router.delete(
    "/tags/{tag_id}",
    dependencies=[Depends(require_admin)],
)
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
):
    tag = (
        db.query(models.Tag)
        .options(joinedload(models.Tag.images))
        .filter(models.Tag.id == tag_id)
        .first()
    )

    if not tag:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhãn.",
        )

    affected_images = len(tag.images)
    tag_name = tag.name

    try:
        # Gỡ nhãn khỏi toàn bộ ảnh trước khi xóa bản ghi nhãn.
        # Cách này không phụ thuộc vào thiết lập ON DELETE CASCADE của SQLite.
        tag.images.clear()
        db.flush()
        db.delete(tag)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Không thể xóa nhãn: {str(exc)}",
        ) from exc

    return {
        "message": f"Đã xóa nhãn {tag_name}.",
        "tag_id": tag_id,
        "affected_images": affected_images,
    }

# ==========================================


@router.get("/folders") 
def get_folders(db: Session = Depends(get_db)):
    folders = (
        db.query(models.Folder)
        .order_by(models.Folder.created_at.desc())
        .all()
    )
    
    result = []
    for folder in folders:
       
        in_progress_count = (
            db.query(models.ImageRecord)
            .filter(
                models.ImageRecord.folder_id == folder.id,
                models.ImageRecord.status == "in_progress"
            )
            .count()
        )
        
        
        result.append({
            "id": folder.id,
            "name": folder.name,
            "uploader_email": folder.uploader_email,
            "created_at": folder.created_at,
            "image_count": folder.image_count,
            "size_mb": folder.size_mb,
            "status": getattr(folder, "status", None),
            "in_progress_count": in_progress_count 
        })
        
    return result


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
        .options(joinedload(models.ImageRecord.tags))  # <-- TỰ ĐỘNG NẠP CÁC TAG ĐI KÈM ẢNH
        .filter(models.ImageRecord.folder_id == folder_id)
        .order_by(
            models.ImageRecord.original_time.desc(),
            models.ImageRecord.id.desc(),
        )
        .all()
    )


@router.put(
    "/folders/{folder_id}/images/{image_id}/tags",
    response_model=schemas.ImageResponse,
    dependencies=[Depends(require_admin)],
)
def update_image_tags(
    folder_id: int,
    image_id: int,
    payload: schemas.ImageTagsUpdate,
    db: Session = Depends(get_db),
):
    _get_folder_or_404(db, folder_id)
    image = _get_image_or_404(db, folder_id, image_id)

    tag_ids = sorted(set(payload.tag_ids))

    # Danh sách rỗng có nghĩa là gỡ toàn bộ nhãn,
    # ảnh trở về trạng thái bình thường/không gắn nhãn.
    if not tag_ids:
        image.tags = []
    else:
        db_tags = (
            db.query(models.Tag)
            .filter(models.Tag.id.in_(tag_ids))
            .all()
        )

        if len(db_tags) != len(tag_ids):
            raise HTTPException(
                status_code=400,
                detail="Có tag không tồn tại hoặc đã bị xóa.",
            )

        image.tags = db_tags
    db.commit()

    return (
        db.query(models.ImageRecord)
        .options(joinedload(models.ImageRecord.tags))
        .filter(models.ImageRecord.id == image.id)
        .one()
    )


@router.post(
    "/folders/{folder_id}/images",
    response_model=schemas.ImageResponse,
)
async def upload_image(
    folder_id: int,
    file: UploadFile = File(...),
    upload_date: str = Form(...),
    tags: str = Form(default=""), # <-- NHẬN CHUỖI TAG ID TỪ FRONTEND GỬI LÊN (VD: "1,4,5")
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
        db.add(image)
        db.flush() # flush để lấy ID trước

        # Tag là tùy chọn. Ảnh không có tag được xem là
        # vật liệu bình thường và vẫn được phép upload.
        tag_id_list = sorted(
            {
                int(value.strip())
                for value in tags.split(",")
                if value.strip().isdigit()
            }
        )

        if tag_id_list:
            db_tags = (
                db.query(models.Tag)
                .filter(models.Tag.id.in_(tag_id_list))
                .all()
            )

            if len(db_tags) != len(tag_id_list):
                raise HTTPException(
                    status_code=400,
                    detail="Có tag không tồn tại hoặc đã bị xóa.",
                )

            image.tags = db_tags
        else:
            image.tags = []

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
        folder.size_mb = int(round((folder.size_mb or 0) + size_value))

        db.commit()

        return (
            db.query(models.ImageRecord)
            .options(joinedload(models.ImageRecord.tags))
            .filter(models.ImageRecord.id == image.id)
            .one()
        )
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
    image.completed_time = datetime.now(timezone.utc)

    db.commit()
    db.refresh(image)
    return image