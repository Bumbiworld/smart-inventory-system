# 📦 Smart Inventory System (On-Premise Workspace)

Hệ thống quản lý kho và lưu trữ hình ảnh vật liệu chuyên dụng dành cho xưởng sản xuất. Dự án được thiết kế theo kiến trúc **On-Premise (Triển khai tại chỗ)**, tối ưu hóa cho mạng LAN nội bộ, giúp các thiết bị di động của nhân viên dễ dàng truy cập với tốc độ cao nhất mà không phụ thuộc vào Internet bên ngoài.

## ✨ Tính năng nổi bật

- **Tự động nhận diện mạng LAN (IP-Agnostic):** Frontend tự động nội suy IP của máy chủ thông qua Client-side routing, giúp hệ thống không bao giờ bị sập dù cục phát Wi-Fi đổi IP máy chủ.
- **Mobile-First Dashboard:** Giao diện quản trị Admin được thiết kế chuẩn App di động (Bottom Navigation, Responsive Grid), vuốt chạm mượt mà cho nhân viên quét/nhập kho bằng điện thoại.
- **Tối ưu hóa hình ảnh:** Ứng dụng cơ chế Lazy Loading và Async Decoding, xử lý mượt mà hàng trăm file ảnh dung lượng lớn (3MB-5MB) trên cùng một màn hình mà không gây giật lag.
- **Vận hành "Tàng hình" (Background Execution):** Backend Python được cấu hình chạy ngầm hoàn toàn trên Windows qua VBScript, tự động khởi chạy và tự động cài đặt môi trường ảo (Auto-venv) khi máy chủ có điện.

## 🛠️ Công nghệ sử dụng

- **Frontend:** Next.js, React, Tailwind CSS, Lucide Icons. (Triển khai qua Docker Compose).
- **Backend:** FastAPI, Python, Uvicorn, SQLite. (Chạy trực tiếp Local để tối đa hóa tốc độ ghi file lên ổ cứng).
- **Deployment:** Docker, VBScript, Batch Script.

## 📂 Cấu trúc dự án

\`\`\`text
quan_ly_kho/
├── backend/                  # Source code Python (FastAPI)
│   ├── app/                  # Logic xử lý API
│   ├── storage_data/         # Nơi lưu trữ file ảnh vật lý trên Windows
│   ├── run_backend.bat       # Script tự tạo venv & cài thư viện
│   └── start_hidden.vbs      # Script chạy ngầm Backend
├── frontend/                 # Source code Next.js
│   ├── src/                  # UI Components & API Clients
│   ├── Dockerfile            # Cấu hình build Docker cho Frontend
│   └── docker-compose.yml    # Orchestration mở port 8080
└── README.md
\`\`\`

## 🚀 Hướng dẫn Triển khai (Dành cho Server Xưởng)

Hệ thống được đóng gói để triển khai cực kỳ đơn giản chỉ với 2 bước:

### 1. Khởi động Backend (Chạy ngầm trên Windows)
Backend cần chạy trực tiếp trên Windows để có toàn quyền thao tác đọc/ghi file ảnh với tốc độ cao nhất.
- Truy cập vào thư mục `backend/`.
- Nhấp đúp chuột vào file `start_hidden.vbs`.
- *(Hệ thống sẽ tự động tạo Virtual Environment, cài đặt thư viện từ `requirements.txt` và chạy ngầm cổng 8000).*
- **Auto-start:** Copy file `start_hidden.vbs` vào thư mục `shell:startup` của Windows để Backend tự động chạy mỗi khi bật máy.

### 2. Khởi động Frontend (Qua Docker)
Frontend được cách ly sạch sẽ trong Docker, tự động kết nối ra máy Host.
- Đảm bảo máy chủ đã cài đặt [Docker Desktop](https://www.docker.com/products/docker-desktop).
- Mở Terminal tại thư mục `frontend/`.
- Chạy lệnh sau:
  \`\`\`bash
  docker-compose up -d --build
  \`\`\`
- Frontend sẽ được build và chạy ngầm ở cổng `8080`.

### 3. Truy cập sử dụng
- Từ bất kỳ thiết bị nào (Điện thoại, PC) trong cùng mạng Wi-Fi của xưởng, mở trình duyệt và truy cập:
  \`\`\`text
  http://[IP-MÁY-CHỦ-XƯỞNG]:8080
  \`\`\`
  *(Ví dụ: `http://192.168.1.100:8080`)*

## ⚠️ Lưu ý kỹ thuật
- Khi chạy Docker Frontend, biến môi trường được cấu hình trỏ về `http://host.docker.internal:8000` để giao tiếp với Backend ở Local.
- Để tắt Backend (đang chạy ngầm), mở `Task Manager` -> Tab `Details` -> Tìm và End Task tiến trình `python.exe`.
