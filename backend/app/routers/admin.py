from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..dependencies import require_admin

UPLOAD_DIR = Path(
    os.getenv(
        "UPLOAD_DIR",
        "/data/uploads",
    )
).resolve()

router = APIRouter(
    prefix="/api/admin",
    tags=["Admin Management"],
    # Chỉ admin được gọi mọi endpoint trong router này.
    dependencies=[Depends(require_admin)],
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


def _resolve_storage_path(relative_path: str) -> Path:
    if not relative_path:
        raise HTTPException(
            status_code=400,
            detail="Thiếu đường dẫn file hoặc thư mục.",
        )

    decoded_path = unquote(str(relative_path)).lstrip("/\\")
    candidate = (UPLOAD_DIR / decoded_path).resolve()

    try:
        candidate.relative_to(UPLOAD_DIR)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Đường dẫn nằm ngoài thư mục lưu trữ.",
        ) from exc

    return candidate


def _parse_size_mb(value: str | None) -> float:
    if not value:
        return 0.0

    try:
        return float(value.replace("MB", "").strip())
    except (TypeError, ValueError):
        return 0.0


def _open_local_path(path: Path) -> None:
    system_name = platform.system()

    if system_name == "Windows":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif system_name == "Darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        total_employees = (
            db.query(models.User)
            .filter(models.User.role == "user")
            .count()
        )
        total_folders = db.query(models.Folder).count()
        total_images = db.query(models.ImageRecord).count()

        in_stock_items = (
            db.query(models.ImageRecord)
            .filter(models.ImageRecord.status == "in_stock")
            .count()
        )
        processing_items = (
            db.query(models.ImageRecord)
            .filter(models.ImageRecord.status == "in_progress")
            .count()
        )
        completed_items = (
            db.query(models.ImageRecord)
            .filter(models.ImageRecord.status == "completed")
            .count()
        )
        warning_items = (
            db.query(models.ImageRecord)
            .filter(models.ImageRecord.status == "defective")
            .count()
        )

        finished_items = completed_items + warning_items
        completion_rate = (
            round((completed_items / finished_items) * 100, 1)
            if finished_items
            else 0
        )

        today = datetime.now().date()
        start_date = today - timedelta(days=6)
        start_datetime = datetime.combine(
            start_date,
            datetime.min.time(),
        )

        daily_flow = {}
        for offset in range(7):
            current_date = start_date + timedelta(days=offset)
            key = current_date.isoformat()
            daily_flow[key] = {
                "date": key,
                "label": current_date.strftime("%d/%m"),
                "uploaded": 0,
                "in_stock": 0,
                "in_progress": 0,
                "completed": 0,
                "defective": 0,
            }

        recent_images = (
            db.query(models.ImageRecord)
            .filter(models.ImageRecord.original_time >= start_datetime)
            .all()
        )

        for image in recent_images:
            if not image.original_time:
                continue

            key = image.original_time.date().isoformat()
            if key not in daily_flow:
                continue

            daily_flow[key]["uploaded"] += 1
            status = image.status or "in_stock"
            if status in {
                "in_stock",
                "in_progress",
                "completed",
                "defective",
            }:
                daily_flow[key][status] += 1

        activity_folders = (
            db.query(models.Folder)
            .order_by(models.Folder.created_at.desc())
            .limit(6)
            .all()
        )
        activity_images = (
            db.query(models.ImageRecord)
            .filter(models.ImageRecord.original_time.isnot(None))
            .order_by(models.ImageRecord.original_time.desc())
            .limit(8)
            .all()
        )

        folder_ids = {image.folder_id for image in activity_images}
        folder_map = {}
        if folder_ids:
            related_folders = (
                db.query(models.Folder)
                .filter(models.Folder.id.in_(folder_ids))
                .all()
            )
            folder_map = {
                folder.id: folder.name
                for folder in related_folders
            }

        activities = []

        for folder in activity_folders:
            created_at = folder.created_at or datetime.now()
            activities.append({
                "id": f"folder-{folder.id}",
                "type": "folder_created",
                "title": "Tạo lô vật liệu mới",
                "description": folder.name,
                "created_at": created_at.isoformat(),
                "_sort_time": created_at,
            })

        for image in activity_images:
            created_at = image.original_time or datetime.now()
            activities.append({
                "id": f"image-{image.id}",
                "type": "image_uploaded",
                "title": f"Nhập kho ảnh {image.filename}",
                "description": folder_map.get(
                    image.folder_id,
                    f"Lô #{image.folder_id}",
                ),
                "created_at": created_at.isoformat(),
                "_sort_time": created_at,
            })

        activities.sort(
            key=lambda item: item["_sort_time"],
            reverse=True,
        )

        for activity in activities:
            activity.pop("_sort_time", None)

        return {
            "stats": {
                "total_employees": total_employees,
                "total_folders": total_folders,
                "total_images": total_images,
                "in_stock_items": in_stock_items,
                "processing_items": processing_items,
                "completed_items": completed_items,
                "warning_items": warning_items,
                "completion_rate": completion_rate,
            },
            "daily_flow": list(daily_flow.values()),
            "activities": activities[:8],
            "last_updated": datetime.now().isoformat(),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi lấy thống kê dashboard: {str(exc)}",
        ) from exc


@router.post("/users")
@router.post("/create-user", include_in_schema=False)
def create_user(
    request: schemas.UserCreate,
    db: Session = Depends(get_db),
):
    existing_user = crud.get_user_by_email(db, request.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email này đã tồn tại.",
        )

    new_user = crud.create_user(db, request.email)
    return {
        "message": "Tạo tài khoản thành công.",
        "email": new_user.email,
        "default_password": "123456",
    }


@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = crud.get_all_users(db)
    return [
        {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_first_login": user.is_first_login,
        }
        for user in users
    ]


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    target_user = crud.get_user_by_id(db, user_id)

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhân viên.",
        )

    if target_user.role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Không thể xóa tài khoản admin.",
        )

    crud.delete_user(db, user_id)
    return {"message": "Đã xóa nhân viên thành công."}


@router.put(
    "/folders/{folder_id}",
    response_model=schemas.FolderResponse,
)
def update_folder(
    folder_id: int,
    folder_data: schemas.FolderUpdate,
    db: Session = Depends(get_db),
):
    folder = _get_folder_or_404(db, folder_id)
    new_name = folder_data.name.strip()

    if not new_name:
        raise HTTPException(
            status_code=400,
            detail="Tên lô vật liệu không được để trống.",
        )

    old_directory = UPLOAD_DIR / _folder_dir_name(folder)
    old_name = folder.name

    folder.name = new_name
    new_directory = UPLOAD_DIR / _folder_dir_name(folder)

    if (
        old_directory != new_directory
        and old_directory.exists()
        and new_directory.exists()
    ):
        folder.name = old_name
        raise HTTPException(
            status_code=409,
            detail="Thư mục vật lý với tên mới đã tồn tại.",
        )

    renamed = False

    try:
        if old_directory != new_directory and old_directory.exists():
            old_directory.rename(new_directory)
            renamed = True

            old_prefix = old_directory.name
            new_prefix = new_directory.name

            # BẢN VÁ: Mã hóa URL trước khi thay thế để tránh lỗi gãy đường dẫn ảnh
            encoded_old_prefix = quote(old_prefix, safe="")
            encoded_new_prefix = quote(new_prefix, safe="")

            images = (
                db.query(models.ImageRecord)
                .filter(models.ImageRecord.folder_id == folder_id)
                .all()
            )
            for image in images:
                image.file_path = image.file_path.replace(
                    f"/uploads/{encoded_old_prefix}/",
                    f"/uploads/{encoded_new_prefix}/",
                    1,
                )

        db.commit()
        db.refresh(folder)
        return folder
    except PermissionError as exc:
        # Bắt riêng lỗi WinError 5 trên Windows
        db.rollback()
        folder.name = old_name
        raise HTTPException(
            status_code=403,
            detail="Thư mục đang bị mở trên máy tính (File Explorer, Xem ảnh...). Hãy đóng cửa sổ thư mục và thử lại.",
        ) from exc
    except Exception as exc:
        db.rollback()
        folder.name = old_name

        if renamed and new_directory.exists():
            new_directory.rename(old_directory)

        raise HTTPException(
            status_code=500,
            detail=f"Không thể đổi tên lô vật liệu: {str(exc)}",
        ) from exc


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
):
    folder = _get_folder_or_404(db, folder_id)
    folder_directory = UPLOAD_DIR / _folder_dir_name(folder)

    crud.delete_folder(db, folder_id)

    filesystem_warning = None
    if folder_directory.exists():
        try:
            shutil.rmtree(folder_directory)
        except Exception as exc:
            filesystem_warning = str(exc)

    response = {
        "message": "Đã xóa lô vật liệu thành công.",
    }

    if filesystem_warning:
        response["warning"] = (
            "Database đã xóa nhưng không thể xóa hoàn toàn "
            f"thư mục vật lý: {filesystem_warning}"
        )

    return response


@router.delete(
    "/folders/{folder_id}/images/{image_id}",
)
def delete_single_image(
    folder_id: int,
    image_id: int,
    db: Session = Depends(get_db),
):
    folder = _get_folder_or_404(db, folder_id)
    image = _get_image_or_404(db, folder_id, image_id)
    file_path = _physical_path_from_file_url(image.file_path)
    image_size = _parse_size_mb(image.size_mb)

    try:
        if file_path.exists():
            file_path.unlink()

        db.delete(image)
        folder.image_count = max(
            0,
            (folder.image_count or 0) - 1,
        )
        folder.size_mb = max(
            0,
            int(round((folder.size_mb or 0) - image_size)),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Không thể xóa ảnh: {str(exc)}",
        ) from exc

    return {"message": "Đã xóa ảnh vĩnh viễn."}


@router.post("/open-folder")
def open_local_folder(request: dict):
    folder_path = request.get("folder_path")
    full_path = _resolve_storage_path(folder_path)

    if not full_path.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Thư mục không tồn tại trên máy chủ.",
        )

    try:
        _open_local_path(full_path)
        return {"message": "Đã mở thư mục thành công."}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Không thể mở thư mục: {str(exc)}",
        ) from exc


@router.post("/open-file")
def open_local_file(request: dict):
    file_path = request.get("file_path")
    full_path = _resolve_storage_path(file_path)

    if not full_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="File không tồn tại trên máy chủ.",
        )

    try:
        _open_local_path(full_path)
        return {"message": "Đã mở file thành công."}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Không thể mở file: {str(exc)}",
        ) from exc