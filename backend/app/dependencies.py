import os
import jwt 
from datetime import datetime, timedelta 
from fastapi import Depends, HTTPException, Security 
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials 
from sqlalchemy.orm import Session
from .database import get_db 
from . import crud, models

# ================= ĐẺ KEY TRỰC TIẾP TRONG RAM =================
# Ưu tiên lấy từ biến môi trường của OS (nếu có cài). 
# Nếu không có, gọi OS sinh ngẫu nhiên 32 bytes trực tiếp vào RAM.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("" \
    "SECRET_KEY chưa được cấu hình"
    )
# ==============================================================

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120
security = HTTPBearer() 

def create_access_token(data: dict):
    to_encode = data.copy() 
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt 

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token không hợp lệ")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập hết hạn, vui lòng đăng nhập lại")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    
    user = crud.get_user_by_email(db, email)
    if user is None:
        raise HTTPException(status_code=401, detail="Không tìm thấy người dùng")
    return user 

def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Không có quyền truy cập! Chỉ dành cho Admin.")
    return current_user