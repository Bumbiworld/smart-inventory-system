from pydantic import BaseModel, EmailStr, Field 
from datetime import datetime 
from typing import Optional, List 

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

class TagBase(BaseModel):
    name: str
    color_code: Optional[str] = "#3B82F6"  # Màu hiển thị (mặc định là xanh dương)

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int

    class Config:
        from_attributes = True

class ImageTagsUpdate(BaseModel):
    tag_ids: List[int]


class ImageResponse(BaseModel):
    id: int
    folder_id: int 
    filename: str
    file_path: str 
    size_mb: str
    original_time: datetime
    status: str
    completed_time: Optional[datetime] = None
    tags: List[TagResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True