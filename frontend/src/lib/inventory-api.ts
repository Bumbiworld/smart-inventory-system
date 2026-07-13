// Hàm tự động nội suy IP của Backend
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Nếu code đang chạy trên trình duyệt (Điện thoại, PC của khách)
    // Nó sẽ tự lấy IP trên thanh địa chỉ và ghép với cổng 8000
    return `http://${window.location.hostname}:8000`;
  }
  // Nếu code chạy ngầm trên Server Next.js (SSR) thì tự gọi local
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiUrl();

export interface FolderRecord {
  id: number;
  name: string;
  uploader_email?: string;
  created_at: string;
  image_count: number;
  size_mb?: number;
  status?: string;
}

export interface ImageRecord {
  id: number;
  folder_id: number;
  filename: string;
  file_path: string;
  size_mb?: number | string;
  original_time: string;
  status: string;
}

export function getToken(): string {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Phiên đăng nhập không tồn tại.');
  }

  return token;
}

export async function readApiError(
  response: Response,
): Promise<string> {
  const payload = await response.json().catch(() => null);

  return (
    payload?.detail ||
    payload?.message ||
    `Yêu cầu thất bại với mã ${response.status}.`
  );
}

export function getLocalDateValue(): string {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .split('T')[0];
}

export function resolveFileUrl(filePath: string): string {
  if (!filePath) {
    return '';
  }

  try {
    const apiUrl = new URL(API_BASE_URL);
    const fileUrl = new URL(filePath, `${API_BASE_URL}/`);

    if (
      fileUrl.hostname === 'localhost' ||
      fileUrl.hostname === '127.0.0.1'
    ) {
      fileUrl.protocol = apiUrl.protocol;
      fileUrl.hostname = apiUrl.hostname;
      fileUrl.port = apiUrl.port;
    }

    return fileUrl.toString();
  } catch {
    return `${API_BASE_URL}/${filePath.replace(/^\/+/, '')}`;
  }
}

export function resolveImageUrl(filePath: string): string {
  const baseUrl = API_BASE_URL.replace(/\/+$/, '');

  if (!filePath) {
    return '';
  }

  // Xử lý các URL cũ đã lưu dạng tuyệt đối:
  // http://localhost:8000/uploads/...
  try {
    const parsedUrl = new URL(filePath);
    const uploadIndex = parsedUrl.pathname.indexOf('/uploads/');

    if (uploadIndex !== -1) {
      const uploadPath = parsedUrl.pathname.slice(uploadIndex);

      return `${baseUrl}${uploadPath}${parsedUrl.search}`;
    }
  } catch {
    // filePath không phải URL tuyệt đối, tiếp tục xử lý bên dưới.
  }

  // Dữ liệu mới được lưu dạng /uploads/...
  if (filePath.startsWith('/')) {
    return `${baseUrl}${filePath}`;
  }

  return `${baseUrl}/${filePath}`;
}