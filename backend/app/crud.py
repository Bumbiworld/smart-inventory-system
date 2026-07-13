from sqlalchemy.orm import Session 
from . import models, schemas
from passlib.context import CryptContext
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def update_user_password(db: Session, user: models.User, new_password: str):
    hashed_password = pwd_context.hash(new_password)
    user.password = hashed_password 

    user.is_first_login = False 
    db.commit()
    db.refresh(user)
    return user 

def create_user(db: Session, email: str):
    hashed_password = pwd_context.hash('123456')
    db_user = models.User(
        email=email,
        password=hashed_password,
        role='user',
        is_first_login=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_all_users(db: Session):
    return db.query(models.User).all()

def delete_user(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
        return True 
    return False 

def create_folder(db: Session, folder: schemas.FolderCreate, uploader_email: str):
    db_folder = models.Folder(
        name=folder.name, 
        uploader_email=uploader_email
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

def get_all_folders(db: Session):
    return db.query(models.Folder).order_by(models.Folder.created_at.desc()).all()

def get_folder_by_id(db: Session, folder_id: int):
    return db.query(models.Folder).filter(models.Folder.id == folder_id).first() 

def update_folder(db: Session, folder_id: int, folder: schemas.FolderUpdate):
    db_folder = get_folder_by_id(db, folder_id)
    if db_folder:
        db_folder.name = folder.name
        db.commit()
        db.refresh(db_folder)
    return db_folder 

def delete_folder(db: Session, folder_id: int):
    db_folder =get_folder_by_id(db, folder_id)
    if db_folder:
        db.query(models.ImageRecord).filter(models.ImageRecord.folder_id == folder_id).delete()
        db.delete(db_folder)
        db.commit()
    return db_folder 

def create_image_record(db: Session, folder_id: int, filename: str, file_path: str, size_mb: str, original_time: datetime):
    db_image = models.ImageRecord(
        folder_id=folder_id,
        filename=filename,
        file_path=file_path,
        size_mb=size_mb,
        original_time=original_time
    )
    db.add(db_image)

    db_folder = get_folder_by_id(db, folder_id)
    if db_folder:
        db_folder.image_count += 1
    
    db.commit()
    db.refresh(db_image)
    return db_image

def get_images_by_folder(db: Session, folder_id: int):
    return db.query(models.ImageRecord).filter(models.ImageRecord.folder_id == folder_id).all()