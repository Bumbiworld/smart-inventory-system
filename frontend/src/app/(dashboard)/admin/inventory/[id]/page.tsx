'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import {
  API_BASE_URL,
  getToken,
  readApiError,
} from '@/lib/inventory-api';

import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Image as ImageIcon, Trash2, Eye, LayoutGrid,
  Layers, Loader2, Hammer, Clock, X, FolderOpen, Maximize, CalendarDays, Undo2, Calendar, CheckCircle2
} from 'lucide-react';

interface ImageRecord {
  id: number;
  folder_id: number;
  filename: string;
  file_path: string;
  size_mb: string;
  original_time: string;
  status: string;
  completed_time?: string;
}

const POLL_INTERVAL_MS = 1500;

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();

  // Trích xuất an toàn folderId từ URL
  const rawId = params?.id;
  const folderId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const isInvalidFolder = !folderId || folderId === 'undefined';

  const [images, setImages] = useState<ImageRecord[]>([]);
  const [folderName, setFolderName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'inventory' | 'stack' | 'completed'>('inventory');
  const [selectedCompletedDate, setSelectedCompletedDate] = useState<string>('');

  const [locationModal, setLocationModal] = useState<{ isOpen: boolean; img: ImageRecord | null }>({
    isOpen: false,
    img: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const getValidImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const backendUrl = API_BASE_URL || 'http://localhost:8000';
    const cleanBaseUrl = backendUrl.replace(/\/$/, '');
    const marker = '/uploads/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex !== -1) {
      return `${cleanBaseUrl}${url.slice(markerIndex)}`;
    }
    return `${cleanBaseUrl}${url}`;
  };

  const fetchFolderDetails = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/folders/${folderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        },
      );

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = await response.json();
      setFolderName(data.name);
    } catch (error) {
      console.error(
        'Lỗi khi tải thông tin thư mục:',
        error,
      );
    }
  }, [folderId, router]);

  const fetchImages = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const token = getToken();
        const response = await fetch(
          `${API_BASE_URL}/api/inventory/folders/${folderId}/images`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
          },
        );

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const data = await response.json();
        setImages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(
          'Lỗi khi lấy danh sách hình ảnh:',
          error,
        );

        // Chỉ xóa danh sách khi lần tải đầu thất bại.
        // Polling lỗi tạm thời không được làm giao diện nhấp nháy.
        if (showLoading) {
          setImages([]);
        }
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [folderId, router],
  );

  // Tải lần đầu, sau đó tự đồng bộ trạng thái ảnh giữa admin và user.
  useEffect(() => {
    if (isInvalidFolder) {
      setIsLoading(false);
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextRefresh = () => {
      if (!stopped) {
        timer = setTimeout(
          refreshImages,
          POLL_INTERVAL_MS,
        );
      }
    };

    const refreshImages = async () => {
      if (!document.hidden) {
        await fetchImages(false);
      }

      scheduleNextRefresh();
    };

    const startPolling = async () => {
      await Promise.all([
        fetchImages(true),
        fetchFolderDetails(),
      ]);

      scheduleNextRefresh();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchImages(false);
      }
    };

    void startPolling();

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
      }

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [
    fetchFolderDetails,
    fetchImages,
    isInvalidFolder,
  ]);

  const availableImages = useMemo(
    () => images.filter((img) => img.status === "in_stock" || !img.status),
    [images],
  );

  const workingImages = useMemo(
    () => images.filter((img) => img.status === "in_progress"),
    [images],
  );

  const completedImages = useMemo(
    () => images.filter((img) => img.status === "completed"),
    [images],
  );

  // Số gốc của từng tấm trên TOÀN BỘ lô, nối tiếp qua tất cả ngày nhập.
  // Dùng cho khu vực chờ cắt và lịch sử hoàn thành để nhận diện tấm đã lấy ra.
  const originalTags = useMemo(() => {
    const tags: Record<number, number> = {};

    [...images]
      .sort((a, b) => {
        return (
          new Date(a.original_time).getTime() -
          new Date(b.original_time).getTime() ||
          a.id - b.id
        );
      })
      .forEach((img, index) => {
        tags[img.id] = index + 1;
      });

    return tags;
  }, [images]);

  // Chồng vật liệu hiện còn trong kho:
  // - Mảng hiển thị từ ĐỈNH xuống ĐÁY.
  // - Số thứ tự luôn liên tục trên toàn bộ chồng và tự đánh lại sau khi lấy tấm ra.
  const {
    sortedAvailableStack,
    availableStackNumbers,
  } = useMemo(() => {
    const ascending = [...availableImages].sort((a, b) => {
      return (
        new Date(a.original_time).getTime() -
        new Date(b.original_time).getTime() ||
        a.id - b.id
      );
    });

    const numbers: Record<number, number> = {};

    ascending.forEach((img, index) => {
      numbers[img.id] = index + 1;
    });

    return {
      sortedAvailableStack: [...ascending].reverse(),
      availableStackNumbers: numbers,
    };
  }, [availableImages]);

  const { imagesByDate, dates } = useMemo(() => {
    const availableGrouped = sortedAvailableStack.reduce((acc, img) => {
      const date = img.original_time.split('T')[0];

      if (!acc[date]) {
        acc[date] = [];
      }

      acc[date].push(img);
      return acc;
    }, {} as Record<string, ImageRecord[]>);

    return {
      imagesByDate: availableGrouped,
      dates: Object.keys(availableGrouped).sort().reverse(),
    };
  }, [sortedAvailableStack]);

  useEffect(() => {
    if (dates.length > 0 && (!selectedDate || !dates.includes(selectedDate))) {
      setSelectedDate(dates[0]);
    } else if (dates.length === 0) { setSelectedDate(''); }
  }, [dates]);

  const { completedByDate, completedDates } = useMemo(() => {
    const allGrouped: Record<string, boolean> = {};
    completedImages.forEach(img => {
      const timeStr = img.completed_time || img.original_time;
      const date = timeStr.split('T')[0];
      allGrouped[date] = true;
    });

    const sortedCompleted = [...completedImages].sort((a, b) => {
      const timeA = new Date(a.completed_time || a.original_time).getTime();
      const timeB = new Date(b.completed_time || b.original_time).getTime();
      return timeB - timeA;
    });

    const grouped = sortedCompleted.reduce((acc, img) => {
      const timeStr = img.completed_time || img.original_time;
      const date = timeStr.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(img);
      return acc;
    }, {} as Record<string, ImageRecord[]>);

    return {
      completedByDate: grouped,
      completedDates: Object.keys(allGrouped).sort().reverse()
    };
  }, [completedImages]);

  useEffect(() => {
    if (completedDates.length > 0 && (!selectedCompletedDate || !completedDates.includes(selectedCompletedDate))) {
      setSelectedCompletedDate(completedDates[0]);
    } else if (completedDates.length === 0) { setSelectedCompletedDate(''); }
  }, [completedDates]);

  const uploadFilesToServer = async (rawFiles: FileList) => {
    if (rawFiles.length === 0) return;
    const filesToUpload = Array.from(rawFiles).sort((a, b) => a.lastModified - b.lastModified);
    setIsUploading(true);
    const token = localStorage.getItem('token');

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_date', uploadDate);

        const response = await fetch(`${API_BASE_URL}/api/inventory/folders/${folderId}/images`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
      }
      await fetchImages(false);
    } catch (error) {
      console.error("Lỗi upload:", error); alert("Tải ảnh lên thất bại!");
    } finally {
      setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePickForWork = async (imageId: number) => {
    if (!confirm("Xác nhận: Đưa tấm vật liệu này vào khu vực chờ cắt?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/folders/${folderId}/images/${imageId}/pick`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) await fetchImages(false);
    } catch (error) { console.error(error); }
  };

  const handleCancelWork = async (imageId: number) => {
    if (!confirm("Xác nhận: Trả tấm vật liệu này về lại kho ván gốc?")) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventory/folders/${folderId}/images/${imageId}/cancel`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) await fetchImages(false);
    } catch (error) { console.error(error); }
  };

  const handleDeleteSingleImage = async (imageId: number) => {
    if (!confirm("Xác nhận: Xóa vĩnh viễn tấm ảnh lỗi này khỏi hệ thống?")) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/folders/${folderId}/images/${imageId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) await fetchImages(false);
    } catch (error) { console.error(error); }
  };

  const getRelativeUploadPath = (url: string) => {
    const marker = '/uploads/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) throw new Error('URL ảnh không chứa đường dẫn /uploads/.');
    const encodedPath = url.slice(markerIndex + marker.length);
    try { return decodeURIComponent(encodedPath); } catch { return encodedPath; }
  };

  const getLocalFolderPath = (url: string) => {
    try {
      const relativePath = getRelativeUploadPath(url);
      const parts = relativePath.split('/');
      parts.pop();
      return `storage_data/${parts.join('/')}`;
    } catch { return url; }
  };

  const handleOpenFolderDirectly = async (url: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Phiên đăng nhập không tồn tại.');
      const relativePath = getRelativeUploadPath(url);
      const parts = relativePath.split('/');
      parts.pop();
      const response = await fetch(`${API_BASE_URL}/api/admin/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ folder_path: parts.join('/') }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mở thư mục tự động.';
      alert(message);
    }
  };

  const handleOpenFileDirectly = async (url: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Phiên đăng nhập không tồn tại.');
      const relativePath = getRelativeUploadPath(url);
      const response = await fetch(`${API_BASE_URL}/api/admin/open-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ file_path: relativePath }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mở file tự động.';
      alert(message);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) uploadFilesToServer(e.dataTransfer.files);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFilesToServer(e.target.files);
  };
  const handleBoxClick = () => {
    if (dateInputRef.current) {
      try { dateInputRef.current.showPicker(); } catch (error) { dateInputRef.current.click(); }
    }
  };

  return (
    <div className="relative mx-auto max-w-6xl animate-in space-y-5 pb-10 fade-in slide-in-from-bottom-4 duration-500 sm:space-y-6 sm:pb-12">
      <button onClick={() => router.push('/admin/inventory')} className="group flex min-h-11 items-center rounded-xl pr-3 font-medium text-slate-500 transition-colors hover:bg-white hover:text-blue-600">
        <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        Quay lại Thư viện
      </button>

      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-6 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 sm:h-12 sm:w-12">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-800 sm:text-xl">{folderName ? `Lô hàng: ${folderName}` : `Chi tiết Lô hàng #${folderId}`}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Sơ đồ quản lý vị trí không gian thực tế</p>
          </div>
        </div>
        <div className="flex border-t border-slate-100 pt-3 text-sm font-medium md:border-t-0 md:pt-0">
          <div className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-blue-700 md:w-auto">
            <Layers className="w-4 h-4" />
            <span>Tổng số ảnh: {images.length} tấm</span>
          </div>
        </div>
      </div>

      <div className="mb-5 mt-1 flex justify-center sm:mb-6 sm:mt-2">
        <div className="grid w-full grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1.5 shadow-inner sm:w-fit sm:gap-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all duration-300 sm:gap-2 sm:px-5 sm:text-sm ${activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Theo ngày</span>
          </button>

          <button
            onClick={() => setActiveTab('stack')}
            className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all duration-300 sm:gap-2 sm:px-5 sm:text-sm ${activeTab === 'stack' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span>Toàn bộ chồng</span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all duration-300 sm:gap-2 sm:px-5 sm:text-sm ${activeTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'}`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Đã hoàn thành</span>
          </button>
        </div>
      </div>

      <input type="file" multiple accept="image/png, image/jpeg, image/jpg, image/webp" className="hidden" ref={fileInputRef} onChange={handleFileSelect} disabled={isUploading} />

      {/* ================= XỬ LÝ LỖI TRƯỚC KHI HIỂN THỊ ================= */}
      {isInvalidFolder ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
          <X className="w-12 h-12 mx-auto text-rose-400 mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Lô hàng không tồn tại</h3>
          <p className="text-slate-500 font-medium max-w-md mx-auto mb-6">
            Lô vật liệu này đã bị xóa hoặc không còn tồn tại trong cơ sở dữ liệu mới.
          </p>
          <button onClick={() => router.push('/admin/inventory')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">
            Về trang Quản lý Kho
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
          <p>Đang đồng bộ dữ liệu hệ thống...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in">
          {/* TAB 1: KHO VÁN */}
          {activeTab === 'inventory' && (
            <div className="space-y-8 animate-in fade-in">
              {workingImages.length > 0 && (
                <div className="animate-in rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50 p-4 fade-in sm:p-6">
                  <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2">
                    <Hammer className="w-5 h-5" /> Đang chờ cắt (Sẵn sàng đưa vào máy)
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
                    {workingImages.map((img) => {
                      const tagNum = originalTags[img.id] || 0;
                      return (
                        <div key={img.id} className="bg-white p-2.5 rounded-xl shadow-sm border border-amber-300 flex items-center gap-3 relative group transition-all hover:shadow-md">
                          <div className="relative flex-shrink-0">
                            <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="h-14 w-14 rounded-lg border border-slate-100 object-cover" />
                            <div className="absolute -top-2 -left-2 z-10 bg-black/80 backdrop-blur-sm text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-white/20 shadow-sm">
                              #{tagNum}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{img.filename}</p>
                            <button onClick={() => handleCancelWork(img.id)} className="text-[10px] text-rose-500 font-bold hover:text-rose-700 hover:underline mt-0.5 flex items-center gap-1">
                              <Undo2 className="w-3 h-3" /> Hủy rút về kho
                            </button>
                          </div>
                          <button onClick={() => handleOpenFileDirectly(img.file_path)} className="absolute -right-2 -top-2 rounded-full bg-emerald-500 p-2 text-white opacity-100 shadow-md transition-opacity hover:bg-emerald-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Mở file gốc"><Maximize className="h-3.5 w-3.5" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-stretch sm:justify-end">
                  <div onClick={handleBoxClick} className="group flex min-h-12 w-full cursor-pointer select-none items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all hover:border-blue-300 hover:shadow sm:w-auto sm:rounded-xl">
                    <CalendarDays className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <div className="flex flex-col items-start text-left pr-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lưu file vào ngày:</span>
                      <span className="text-sm font-bold text-blue-700">{uploadDate.split('-').reverse().join('/')}</span>
                    </div>
                    <input type="date" ref={dateInputRef} value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-0 h-0 absolute opacity-0 pointer-events-none" />
                  </div>
                </div>

                <div onClick={() => !isUploading && fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`rounded-3xl border-2 border-dashed bg-white p-5 text-center shadow-sm transition-all duration-300 sm:p-8 ${isUploading ? 'cursor-not-allowed border-slate-100 bg-slate-50' : 'cursor-pointer border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'}`}>
                  <div className="max-w-md mx-auto flex flex-col items-center gap-3">
                    {isUploading ? (
                      <><div className="p-4 rounded-full bg-blue-50 text-blue-600 animate-spin"><Loader2 className="w-7 h-7" /></div><p className="font-bold text-slate-700">Đang tự động tải ảnh vào lô hàng...</p></>
                    ) : (
                      <><div className={`p-4 rounded-full transition-transform ${isDragging ? 'bg-blue-500 text-white scale-110 animate-bounce' : 'bg-blue-50 text-blue-500'}`}><Upload className="w-7 h-7" /></div><p className="font-bold text-slate-700">Kéo thả hoặc nhấp vào đây để tải ảnh nhập kho</p><p className="text-xs text-slate-400">Hình ảnh sẽ được tự động lưu vào ngày đã chọn ở phía trên</p></>
                    )}
                  </div>
                </div>
              </div>

              {availableImages.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
                  <ImageIcon className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">Kho vật liệu trống. Hoặc toàn bộ ván đã được đưa vào máy cắt.</p>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-5 lg:flex-row lg:gap-8">

                  <div className="w-full flex-shrink-0 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6 lg:w-72">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Lịch sử nhập kho</h3>
                    <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1 lg:max-h-[60vh] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pr-2">
                      {dates.map(date => {
                        const totalInDate = availableImages.filter(img => img.original_time.split('T')[0] === date).length;
                        return (
                          <button key={date} onClick={() => setSelectedDate(date)} className={`min-w-[9.5rem] rounded-2xl border p-3 text-left transition-all sm:p-4 lg:min-w-0 lg:w-full ${selectedDate === date ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                            <p className={`font-bold text-[15px] ${selectedDate === date ? 'text-blue-700' : 'text-slate-700'}`}>{date.split('-').reverse().join('/')}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Tổng cộng: {totalInDate} tấm ván</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    {selectedDate && (
                      <>
                        <div className="flex items-center gap-4 mb-6">
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">Lô hàng ngày {selectedDate.split('-').reverse().join('/')}</h3>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>

                        {((imagesByDate?.[selectedDate]) || []).length === 0 ? (
                          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                            Tất cả tấm vật liệu của ngày này hiện đang nằm ở khu vực "Chờ cắt".
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:gap-5">
                            {((imagesByDate?.[selectedDate]) || []).map((img, index) => {
                              const currentStack = imagesByDate[selectedDate];

                              // Đánh lại số liên tục theo số tấm hiện còn trong kho.
                              // Danh sách đang hiển thị từ đỉnh lô xuống đáy lô.
                              const dynamicIndex = availableStackNumbers[img.id] || 0;

                              const isOnlyInDate = currentStack.length === 1;
                              const isTop = index === 0;
                              const isBottom = index === currentStack.length - 1;
                              const imgDate = new Date(img.original_time + 'Z');

                              return (
                                <div key={img.id} className={`group bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative ${isOnlyInDate ? 'border-violet-400 ring-4 ring-violet-50' : isTop ? 'border-blue-400 ring-4 ring-blue-50' : isBottom ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-200/60'}`}>

                                  <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md text-white font-mono font-bold text-sm px-2.5 py-1 rounded-lg border border-white/10 shadow-sm">#{dynamicIndex}</div>

                                  {isOnlyInDate ? (
                                    <div className="absolute top-2 right-2 z-20 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                      Đỉnh & đáy ngày
                                    </div>
                                  ) : (
                                    <>
                                      {isTop && (
                                        <div className="absolute top-2 right-2 z-20 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                          Đỉnh ngày
                                        </div>
                                      )}
                                      {isBottom && (
                                        <div className="absolute top-2 right-2 z-20 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                          Đáy ngày
                                        </div>
                                      )}
                                    </>
                                  )}

                                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                                    <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-slate-950/40 px-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
                                      <button onClick={(e) => { e.stopPropagation(); handlePickForWork(img.id); }} className="p-2.5 bg-white text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0"><Hammer className="w-5 h-5" /></button>
                                      <button onClick={(e) => { e.stopPropagation(); setLocationModal({ isOpen: true, img: img }); }} className="p-2.5 bg-white text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0"><FolderOpen className="w-5 h-5" /></button>
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteSingleImage(img.id); }} className="p-2.5 bg-white text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                  </div>

                                  <div className="p-3 bg-white border-t border-slate-50">
                                    <p className="font-bold text-slate-700 text-xs truncate" title={img.filename}>{img.filename}</p>
                                    <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium mt-1.5">
                                      <span>{imgDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                      <span>{img.size_mb}</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-1 border-t border-slate-100 p-2 sm:hidden">
                                    <button
                                      type="button"
                                      onClick={() => handlePickForWork(img.id)}
                                      className="flex min-h-11 items-center justify-center rounded-xl text-emerald-600 active:bg-emerald-50"
                                      aria-label="Đưa vào khu vực chờ cắt"
                                    >
                                      <Hammer className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setLocationModal({ isOpen: true, img })}
                                      className="flex min-h-11 items-center justify-center rounded-xl text-amber-600 active:bg-amber-50"
                                      aria-label="Mở công cụ file"
                                    >
                                      <FolderOpen className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSingleImage(img.id)}
                                      className="flex min-h-11 items-center justify-center rounded-xl text-rose-600 active:bg-rose-50"
                                      aria-label="Xóa ảnh"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TOÀN BỘ CHỒNG VẬT LIỆU */}
          {activeTab === 'stack' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                      <Layers className="h-5 w-5 text-violet-600" />
                      Toàn bộ chồng hiện tại
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Hiển thị liên tục qua tất cả ngày nhập, từ đỉnh chồng xuống đáy chồng.
                      Số thứ tự sẽ tự cập nhật khi một tấm được đưa sang khu vực chờ cắt.
                    </p>
                  </div>

                  <div className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-bold text-violet-700">
                    {sortedAvailableStack.length} tấm trong kho
                  </div>
                </div>

                {sortedAvailableStack.length > 0 && (
                  <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
                      Đỉnh lô: #{availableStackNumbers[sortedAvailableStack[0].id]}
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                      Đáy lô: #{availableStackNumbers[sortedAvailableStack[sortedAvailableStack.length - 1].id]}
                    </div>
                  </div>
                )}
              </div>

              {sortedAvailableStack.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center">
                  <ImageIcon className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <p className="font-medium text-slate-500">
                    Không còn tấm vật liệu nào trong kho.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:gap-5">
                  {sortedAvailableStack.map((img, index) => {
                    const dynamicIndex = availableStackNumbers[img.id] || 0;
                    const isOnly = sortedAvailableStack.length === 1;
                    const isTop = index === 0;
                    const isBottom = index === sortedAvailableStack.length - 1;
                    const imgDate = new Date(img.original_time + 'Z');
                    const importedDate = img.original_time.split('T')[0];

                    return (
                      <div
                        key={img.id}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:shadow-md ${isOnly
                          ? 'border-violet-400 ring-4 ring-violet-50'
                          : isTop
                            ? 'border-blue-400 ring-4 ring-blue-50'
                            : isBottom
                              ? 'border-amber-400 ring-4 ring-amber-50'
                              : 'border-slate-200/60'
                          }`}
                      >
                        <div className="absolute left-2 top-2 z-20 rounded-lg border border-white/10 bg-black/65 px-2.5 py-1 font-mono text-sm font-bold text-white shadow-sm backdrop-blur-md">
                          #{dynamicIndex}
                        </div>

                        {isOnly ? (
                          <div className="absolute right-2 top-2 z-20 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                            Đỉnh & đáy lô
                          </div>
                        ) : (
                          <>
                            {isTop && (
                              <div className="absolute right-2 top-2 z-20 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                Đỉnh lô
                              </div>
                            )}
                            {isBottom && (
                              <div className="absolute right-2 top-2 z-20 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                Đáy lô
                              </div>
                            )}
                          </>
                        )}

                        <div className="relative aspect-square overflow-hidden bg-slate-100">
                          <img
                            src={getValidImageUrl(img.file_path)}
                            alt={img.filename}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />

                          <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-slate-950/40 px-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handlePickForWork(img.id);
                              }}
                              className="translate-y-2 rounded-lg bg-white p-2.5 text-emerald-600 transition-all group-hover:translate-y-0 hover:bg-emerald-500 hover:text-white"
                              aria-label="Đưa vào khu vực chờ cắt"
                            >
                              <Hammer className="h-5 w-5" />
                            </button>

                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setLocationModal({ isOpen: true, img });
                              }}
                              className="translate-y-2 rounded-lg bg-white p-2.5 text-amber-600 transition-all group-hover:translate-y-0 hover:bg-amber-500 hover:text-white"
                              aria-label="Mở công cụ file"
                            >
                              <FolderOpen className="h-5 w-5" />
                            </button>

                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteSingleImage(img.id);
                              }}
                              className="translate-y-2 rounded-lg bg-white p-2.5 text-rose-600 transition-all group-hover:translate-y-0 hover:bg-rose-600 hover:text-white"
                              aria-label="Xóa ảnh"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-slate-50 bg-white p-3">
                          <p
                            className="truncate text-xs font-bold text-slate-700"
                            title={img.filename}
                          >
                            {img.filename}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
                            <span>
                              {importedDate.split('-').reverse().join('/')}
                            </span>
                            <span>
                              {imgDate.toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1 border-t border-slate-100 p-2 sm:hidden">
                          <button
                            type="button"
                            onClick={() => handlePickForWork(img.id)}
                            className="flex min-h-11 items-center justify-center rounded-xl text-emerald-600 active:bg-emerald-50"
                            aria-label="Đưa vào khu vực chờ cắt"
                          >
                            <Hammer className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setLocationModal({ isOpen: true, img })}
                            className="flex min-h-11 items-center justify-center rounded-xl text-amber-600 active:bg-amber-50"
                            aria-label="Mở công cụ file"
                          >
                            <FolderOpen className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSingleImage(img.id)}
                            className="flex min-h-11 items-center justify-center rounded-xl text-rose-600 active:bg-rose-50"
                            aria-label="Xóa ảnh"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ĐÃ XỬ LÝ XONG */}
          {activeTab === 'completed' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              {completedImages.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-4" />
                  <h3 className="font-bold text-slate-700 text-lg mb-1">Chưa có dữ liệu hoàn thành</h3>
                  <p className="text-slate-500 font-medium">Chưa có tấm vật liệu nào được cắt xong trong lô hàng này.</p>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-5 lg:flex-row lg:gap-8">

                  <div className="w-full flex-shrink-0 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6 lg:w-72">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Ngày hoàn thành</h3>
                    <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1 lg:max-h-[60vh] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pr-2">
                      {completedDates.map(date => {
                        const totalInDate = completedImages.filter(img => {
                          const tStr = img.completed_time || img.original_time;
                          return tStr.split('T')[0] === date;
                        }).length;
                        return (
                          <button key={date} onClick={() => setSelectedCompletedDate(date)} className={`min-w-[9.5rem] rounded-2xl border p-3 text-left transition-all sm:p-4 lg:min-w-0 lg:w-full ${selectedCompletedDate === date ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
                            <p className={`font-bold text-[15px] ${selectedCompletedDate === date ? 'text-emerald-700' : 'text-slate-700'}`}>{date.split('-').reverse().join('/')}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Đã xử lý xong: <span className="text-emerald-600 font-bold">{totalInDate} tấm</span></p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    {selectedCompletedDate && (
                      <>
                        <div className="flex items-center gap-4 mb-6">
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">Vật liệu cắt xong ngày {selectedCompletedDate.split('-').reverse().join('/')}</h3>
                          <div className="flex-1 h-px bg-slate-200"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:gap-5">
                          {((completedByDate?.[selectedCompletedDate]) || []).map((img) => {
                            const dynamicIndex = originalTags[img.id] || 0;
                            const timeStr = img.completed_time || img.original_time;
                            const imgDate = new Date(timeStr + 'Z');

                            return (
                              <div key={img.id} className="group bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative">

                                <div className="absolute top-2 left-2 z-20 bg-emerald-600/95 backdrop-blur-md text-white font-mono font-bold text-sm px-2.5 py-1 rounded-lg border border-emerald-500/30 shadow-sm">#{dynamicIndex}</div>

                                <div className="relative aspect-square bg-slate-100 overflow-hidden">
                                  <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90" />
                                  <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-slate-950/40 px-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
                                    <button onClick={(e) => { e.stopPropagation(); setLocationModal({ isOpen: true, img: img }); }} className="p-2.5 bg-white text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0 shadow-md">
                                      <FolderOpen className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="p-3 bg-white border-t border-slate-50">
                                  <p className="font-bold text-slate-700 text-xs truncate" title={img.filename}>{img.filename}</p>
                                  <div className="flex justify-between items-center text-[11px] mt-1.5">
                                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-600">
                                      {imgDate.toLocaleString('vi-VN', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                    <span className="text-slate-400 font-medium">{img.size_mb}</span>
                                  </div>
                                </div>

                                <div className="border-t border-slate-100 p-2 sm:hidden">
                                  <button
                                    type="button"
                                    onClick={() => setLocationModal({ isOpen: true, img })}
                                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl font-bold text-emerald-700 active:bg-emerald-50"
                                  >
                                    <FolderOpen className="h-4 w-4" />
                                    Công cụ file
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {locationModal.isOpen && locationModal.img && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:justify-center sm:p-4">
          <div className="relative max-h-[92dvh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-3xl border border-slate-100 bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:mx-4 sm:rounded-3xl sm:p-6 sm:zoom-in-95">
            <button onClick={() => setLocationModal({ isOpen: false, img: null })} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            <div className="flex items-center gap-3 border-b pb-3 border-slate-100">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0"><LayoutGrid className="w-5 h-5" /></div>
              <div><h3 className="font-bold text-slate-800 text-base">Công cụ tương tác file</h3><p className="text-xs text-slate-400">Hệ thống cục bộ đã tự động tạo cấu trúc dữ liệu</p></div>
            </div>
            <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="w-16 h-16 rounded-xl overflow-hidden border bg-white flex-shrink-0">
                <img src={getValidImageUrl(locationModal.img.file_path)} alt="Vật liệu" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0"><p className="font-bold text-slate-700 text-sm truncate">{locationModal.img.filename}</p><p className="text-xs text-slate-400 font-medium mt-0.5">Dung lượng: {locationModal.img.size_mb}</p><p className="text-xs text-slate-400 font-medium truncate">Đường dẫn: {getLocalFolderPath(locationModal.img.file_path)}</p></div>
            </div>
            <p className="rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-700 sm:hidden">
              “Mở thư mục” và “Mở file gốc” sẽ thao tác trên máy Windows đang chạy backend, không mở bộ nhớ của điện thoại.
            </p>
            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
              <button onClick={() => window.open(getValidImageUrl(locationModal.img!.file_path), '_blank')} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 border-slate-100 bg-white hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-all group"><Eye className="w-7 h-7 text-slate-400 group-hover:text-blue-500 transition-colors" /><p className="font-bold text-[13px]">Xem Ảnh</p></button>
              <button onClick={() => handleOpenFolderDirectly(locationModal.img!.file_path)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 border-slate-100 bg-white hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-all group"><FolderOpen className="w-7 h-7 text-slate-400 group-hover:text-emerald-500 transition-colors" /><p className="font-bold text-[13px]">Mở Thư Mục</p></button>
              <button onClick={() => handleOpenFileDirectly(locationModal.img!.file_path)} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 border-slate-100 bg-white hover:border-amber-400 hover:bg-amber-50 text-slate-700 hover:text-amber-700 transition-all group"><Maximize className="w-7 h-7 text-slate-400 group-hover:text-amber-500 transition-colors" /><p className="font-bold text-[13px]">Mở File Gốc</p></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}