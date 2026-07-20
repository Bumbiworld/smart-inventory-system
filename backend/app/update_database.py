import sqlite3

DB_FILE = 'app.db' 

def update_database():
    try:

        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()

        cursor.execute("ALTER TABLE folders ADD COLUMN cover_image VARCHAR(255);")
        
        conn.commit()
        print("✅ Thành công! Đã thêm cột 'cover_image' vào bảng 'folders'. Dữ liệu cũ vẫn an toàn!")
        
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("⚠️ Cột 'cover_image' đã tồn tại trong database rồi, không cần chạy lại đâu!")
        else:
            print(f"❌ Có lỗi xảy ra: {e}")
            
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    update_database()