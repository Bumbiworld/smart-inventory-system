from xmlrpc.client import Boolean

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String) 
    is_first_login = Column(Boolean, default=True)

class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String) 

class Plank(Base):
    __tablename__ = "planks"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    image_url = Column(String)
    sequence = Column(Integer)

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    uploader_email = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    image_count = Column(Integer, default=0)
    size_mb = Column(Integer, default=0)
    status = Column(String, default='pending')

class ImageRecord(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"))
    filename = Column(String, index=True)
    file_path = Column(String)
    size_mb = Column(String)
    original_time = Column(DateTime)
    status = Column(String, default="in_stock") 
    completed_time = Column(DateTime, nullable=True)

