import os

from dotenv import load_dotenv
from passlib.context import CryptContext

from app.database import Base, SessionLocal, engine
from app.models import User


load_dotenv()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def create_tables() -> None:
    print("Đang khởi tạo database...")
    Base.metadata.create_all(bind=engine)
    print("Các bảng đã sẵn sàng.")


def seed_admin() -> None:
    admin_email = os.getenv(
        "ADMIN_EMAIL",
        "admin@example.com",
    ).strip()

    admin_password = os.getenv(
        "ADMIN_PASSWORD",
        "Password@123",
    )

    db = SessionLocal()

    try:
        existing_admin = (
            db.query(User)
            .filter(User.email == admin_email)
            .first()
        )

        if existing_admin:
            print(
                f"Admin {admin_email} đã tồn tại."
            )
            return

        admin = User(
            email=admin_email,
            password=pwd_context.hash(admin_password),
            role="admin",
            is_first_login=True,
        )

        db.add(admin)
        db.commit()

        print(
            f"Đã tạo tài khoản admin: {admin_email}"
        )
        print(
            "Admin phải đổi mật khẩu sau lần đăng nhập đầu."
        )

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_tables()
    seed_admin()