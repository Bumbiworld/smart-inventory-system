from pydantic import BaseModel, EmailStr 
from datetime import datetime 
from typing import Optional 

class LoginRequest(BaseModel):
    email: str
    password: str 

class ChangePasswordRequest(BaseModel):
    email: str
    old_password: str 
    new_password: str 

class UserCreate(BaseModel):
    email: EmailStr 

class FolderCreate(BaseModel):
    name: str 

class FolderResponse(BaseModel):
    id: int 
    name: str 
    uploader_email: str 
    created_at: datetime
    image_count: int 
    size_mb: int 
    status: str 

    class Config:
        from_attributes = True 

class FolderUpdate(BaseModel):
    name: str 

class ImageResponse(BaseModel):
    id: int
    folder_id: int 
    filename: str
    file_path: str 
    size_mb: str
    original_time: datetime
    status: str
    completed_time: Optional[datetime] = None

    class Config:
        from_attributes = True 
        