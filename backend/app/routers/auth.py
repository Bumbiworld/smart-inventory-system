from fastapi import APIRouter, Depends, HTTPException 
from sqlalchemy.orm import Session 
from ..database import get_db 
from .. import crud, schemas 
from ..dependencies import create_access_token 

router = APIRouter(prefix="/api", tags=["Authentication"])

@router.post("/login")
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, request.email)

    if not user or not crud.pwd_context.verify(request.password, user.password):
        raise HTTPException(status_code=400, detail="Sai email hoặc mật khẩu")
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})

    if user.is_first_login:
        return {
            "message": "Yêu cầu đổi mật khẩu",
            "require_change_password": True,
            "email": user.email,
            "token": access_token 
        }
    return {
        "message": "Đăng nhập thành công",
        "require_change_password": False,
        "role": user.role,
        "token": access_token 
    }

@router.post("/change-password")
def change_password(request: schemas.ChangePasswordRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, request.email)

    if not user or not crud.pwd_context.verify(request.old_password, user.password):
        raise HTTPException(status_code=400, detail="Thông tin không hợp lệ")
    
    crud.update_user_password(db, user, request.new_password)
    return {
        "message": "Đổi mật khẩu thành công! Vui lòng đăng nhập lại."
    }