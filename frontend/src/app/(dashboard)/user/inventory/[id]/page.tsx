'use client';

import {
  ArrowLeft,
  Camera,
  CalendarDays,
  CheckCircle2,
  FileImage,
  Hammer,
  Images,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  API_BASE_URL,
  FolderRecord,
  ImageRecord,
  getLocalDateValue,
  getToken,
  readApiError,
  resolveFileUrl,
} from '@/lib/inventory-api';

type TabName = 'stock' | 'working' | 'completed';
type ActionName = 'pick' | 'cancel' | 'complete';

type PendingStatus =
  | 'ready'
  | 'uploading'
  | 'error';

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
  status: PendingStatus;
  error?: string;
}

const POLL_INTERVAL_MS = 1500;

type ImageWithCompletion = ImageRecord & {
  completed_time?: string;
};

const getCompletedTime = (image: ImageRecord) =>
  (image as ImageWithCompletion).completed_time;

const parseApiDate = (value?: string) => {
  if (!value) {
    return null;
  }

  // Backend hiện lưu timestamp không kèm múi giờ.
  // Thêm Z để hiển thị đúng theo giờ địa phương của trình duyệt.
  const normalizedValue =
    value.endsWith('Z') ||
      /[+-]\d{2}:?\d{2}$/.test(value)
      ? value
      : `${value}Z`;

  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

const formatCompletedTime = (value?: string) => {
  const date = parseApiDate(value);

  if (!date) {
    return 'Chưa ghi nhận thời gian';
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function UserInventoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const folderId = params.id;

  const cameraInputRef =
    useRef<HTMLInputElement>(null);

  const galleryInputRef =
    useRef<HTMLInputElement>(null);

  const pendingFilesRef =
    useRef<PendingFile[]>([]);

  const [folder, setFolder] =
    useState<FolderRecord | null>(null);

  const [images, setImages] =
    useState<ImageRecord[]>([]);

  const [pendingFiles, setPendingFiles] =
    useState<PendingFile[]>([]);

  const [activeTab, setActiveTab] =
    useState<TabName>('stock');

  const [selectedDate, setSelectedDate] =
    useState('all');

  const [uploadDate, setUploadDate] =
    useState(getLocalDateValue());

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUploading, setIsUploading] =
    useState(false);

  const [isDragging, setIsDragging] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState({
      current: 0,
      total: 0,
    });

  const [activeActionId, setActiveActionId] =
    useState<number | null>(null);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = getToken();

      const [folderResponse, imagesResponse] =
        await Promise.all([
          fetch(
            `${API_BASE_URL}/api/inventory/folders/${folderId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: 'no-store',
            },
          ),

          fetch(
            `${API_BASE_URL}/api/inventory/folders/${folderId}/images`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: 'no-store',
            },
          ),
        ]);

      if (
        folderResponse.status === 401 ||
        imagesResponse.status === 401
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        router.replace('/login');
        return;
      }

      if (!folderResponse.ok) {
        throw new Error(
          await readApiError(folderResponse),
        );
      }

      if (!imagesResponse.ok) {
        throw new Error(
          await readApiError(imagesResponse),
        );
      }

      const folderData: FolderRecord =
        await folderResponse.json();

      const imageData: ImageRecord[] =
        await imagesResponse.json();

      setFolder(folderData);
      setImages(
        Array.isArray(imageData) ? imageData : [],
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tải dữ liệu lô.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [folderId, router]);

  const refreshImages = useCallback(
    async (showErrors = false) => {
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
          throw new Error(
            await readApiError(response),
          );
        }

        const imageData: ImageRecord[] =
          await response.json();

        setImages(
          Array.isArray(imageData)
            ? imageData
            : [],
        );
      } catch (error) {
        console.error(
          'Lỗi khi đồng bộ danh sách ảnh:',
          error,
        );

        // Polling lỗi tạm thời không hiện thông báo liên tục.
        // Chỉ thao tác thủ công mới báo lỗi cho người dùng.
        if (showErrors) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Không thể đồng bộ danh sách ảnh.',
          );
        }
      }
    },
    [folderId, router],
  );

  useEffect(() => {
    if (!folderId) {
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextRefresh = () => {
      if (!stopped) {
        timer = setTimeout(
          refresh,
          POLL_INTERVAL_MS,
        );
      }
    };

    const refresh = async () => {
      if (!document.hidden) {
        await refreshImages(false);
      }

      scheduleNextRefresh();
    };

    const startPolling = async () => {
      await fetchData();
      scheduleNextRefresh();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refreshImages(false);
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
    fetchData,
    folderId,
    refreshImages,
  ]);

  const stockImages = useMemo(() => {
    return images
      .filter(
        (image) =>
          image.status === 'in_stock' ||
          !image.status,
      )
      .sort((a, b) => b.id - a.id);
  }, [images]);

  const workingImages = useMemo(() => {
    return images
      .filter(
        (image) =>
          image.status === 'in_progress',
      )
      .sort((a, b) => b.id - a.id);
  }, [images]);

  const completedImages = useMemo(() => {
    return images
      .filter(
        (image) =>
          image.status === 'completed',
      )
      .sort((a, b) => {
        const timeA = parseApiDate(
          getCompletedTime(a) ||
          a.original_time,
        )?.getTime() || 0;

        const timeB = parseApiDate(
          getCompletedTime(b) ||
          b.original_time,
        )?.getTime() || 0;

        return timeB - timeA || b.id - a.id;
      });
  }, [images]);

  const dateImageCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    stockImages.forEach((image) => {
      const date =
        image.original_time?.split('T')[0];

      if (date) {
        counts[date] = (counts[date] || 0) + 1;
      }
    });

    return counts;
  }, [stockImages]);

  const availableDates = useMemo(() => {
    return Object.keys(dateImageCounts)
      .sort()
      .reverse();
  }, [dateImageCounts]);

  useEffect(() => {
    if (
      selectedDate !== 'all' &&
      !availableDates.includes(selectedDate)
    ) {
      setSelectedDate('all');
    }
  }, [availableDates, selectedDate]);

  const stockImagesByDate = useMemo(() => {
    if (selectedDate === 'all') {
      return stockImages;
    }

    return stockImages.filter(
      (image) =>
        image.original_time?.split('T')[0] ===
        selectedDate,
    );
  }, [selectedDate, stockImages]);

  // Số thứ tự động của toàn bộ ảnh còn trong kho.
  // Không reset khi đổi ngày và tự nối lại sau khi lấy một tấm ra cắt.
  const stockImageNumbers = useMemo(() => {
    const result: Record<number, number> = {};

    stockImages.forEach((image, index) => {
      result[image.id] = stockImages.length - index;
    });

    return result;
  }, [stockImages]);

  // Số gốc dùng cho khu chờ cắt và lịch sử hoàn thành.
  // Số này nối tiếp xuyên suốt các ngày upload.
  const originalImageNumbers = useMemo(() => {
    const result: Record<number, number> = {};
    const orderedImages = [...images].sort(
      (a, b) => a.id - b.id,
    );

    orderedImages.forEach((image, index) => {
      result[image.id] = index + 1;
    });

    return result;
  }, [images]);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incomingFiles = Array.from(fileList)
        .filter((file) =>
          file.type.startsWith('image/'),
        )
        .sort(
          (a, b) =>
            a.lastModified - b.lastModified,
        );

      if (incomingFiles.length === 0) {
        setErrorMessage(
          'Không tìm thấy file ảnh hợp lệ.',
        );
        return;
      }

      setErrorMessage('');
      setSuccessMessage('');

      setPendingFiles((currentFiles) => {
        const existingKeys = new Set(
          currentFiles.map(
            (item) =>
              `${item.file.name}-${item.file.size}-${item.file.lastModified}`,
          ),
        );

        const newItems: PendingFile[] = [];

        incomingFiles.forEach((file, index) => {
          const fileKey =
            `${file.name}-${file.size}-${file.lastModified}`;

          if (existingKeys.has(fileKey)) {
            return;
          }

          existingKeys.add(fileKey);

          newItems.push({
            id: `${Date.now()}-${index}-${file.name}`,
            file,
            previewUrl:
              URL.createObjectURL(file),
            status: 'ready',
          });
        });

        return [...currentFiles, ...newItems].sort(
          (a, b) =>
            a.file.lastModified -
            b.file.lastModified,
        );
      });
    },
    [],
  );

  const removePendingFile = (
    pendingFile: PendingFile,
  ) => {
    if (isUploading) {
      return;
    }

    URL.revokeObjectURL(
      pendingFile.previewUrl,
    );

    setPendingFiles((currentFiles) =>
      currentFiles.filter(
        (item) =>
          item.id !== pendingFile.id,
      ),
    );
  };

  const clearPendingFiles = () => {
    if (isUploading) {
      return;
    }

    pendingFiles.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });

    setPendingFiles([]);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length) {
      addFiles(event.dataTransfer.files);
    }
  };

  const uploadPendingFiles = async () => {
    const queue = pendingFiles.filter(
      (item) =>
        item.status === 'ready' ||
        item.status === 'error',
    );

    if (queue.length === 0) {
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    setUploadProgress({
      current: 0,
      total: queue.length,
    });

    const successfulIds =
      new Set<string>();

    let successCount = 0;
    let failedCount = 0;

    for (
      let index = 0;
      index < queue.length;
      index += 1
    ) {
      const pendingFile = queue[index];

      setUploadProgress({
        current: index + 1,
        total: queue.length,
      });

      setPendingFiles((currentFiles) =>
        currentFiles.map((item) =>
          item.id === pendingFile.id
            ? {
              ...item,
              status: 'uploading',
              error: undefined,
            }
            : item,
        ),
      );

      try {
        const formData = new FormData();

        formData.append(
          'file',
          pendingFile.file,
        );

        formData.append(
          'upload_date',
          uploadDate,
        );

        const response = await fetch(
          `${API_BASE_URL}/api/inventory/folders/${folderId}/images`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(
            await readApiError(response),
          );
        }

        successfulIds.add(
          pendingFile.id,
        );

        successCount += 1;
      } catch (error) {
        failedCount += 1;

        const message =
          error instanceof Error
            ? error.message
            : 'Upload thất bại.';

        setPendingFiles((currentFiles) =>
          currentFiles.map((item) =>
            item.id === pendingFile.id
              ? {
                ...item,
                status: 'error',
                error: message,
              }
              : item,
          ),
        );
      }
    }

    setPendingFiles((currentFiles) => {
      currentFiles.forEach((item) => {
        if (successfulIds.has(item.id)) {
          URL.revokeObjectURL(
            item.previewUrl,
          );
        }
      });

      return currentFiles.filter(
        (item) =>
          !successfulIds.has(item.id),
      );
    });

    setIsUploading(false);

    setUploadProgress({
      current: 0,
      total: 0,
    });

    if (successCount > 0) {
      setSuccessMessage(
        `Đã tải lên thành công ${successCount} ảnh.`,
      );

      setActiveTab('stock');
      setSelectedDate(uploadDate);
      await refreshImages(true);
    }

    if (failedCount > 0) {
      setErrorMessage(
        `${failedCount} ảnh tải lên thất bại. Các ảnh lỗi được giữ lại để thử lại.`,
      );
    }

    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  const runImageAction = async (
    image: ImageRecord,
    action: ActionName,
  ) => {
    const confirmationMessages: Record<
      ActionName,
      string
    > = {
      pick: 'Đưa tấm này vào khu chờ cắt?',
      cancel: 'Trả tấm này về kho?',
      complete:
        'Xác nhận tấm này đã hoàn thành?',
    };

    const confirmed = window.confirm(
      confirmationMessages[action],
    );

    if (!confirmed) {
      return;
    }

    setActiveActionId(image.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/folders/${folderId}/images/${image.id}/${action}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          await readApiError(response),
        );
      }

      if (action === 'pick') {
        // Giữ nguyên tab Trong kho để người dùng thấy ngay
        // ảnh biến mất và số thứ tự còn lại tự nối lại.
        setActiveTab('stock');
        setSuccessMessage(
          'Đã đưa tấm vật liệu vào khu chờ cắt.',
        );
      }

      if (action === 'cancel') {
        setActiveTab('stock');
        setSuccessMessage(
          'Đã trả tấm vật liệu về kho.',
        );
      }

      if (action === 'complete') {
        setActiveTab('completed');
        setSuccessMessage(
          'Đã xác nhận tấm vật liệu hoàn thành.',
        );
      }

      await refreshImages(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật ảnh.',
      );
    } finally {
      setActiveActionId(null);
    }
  };

  const currentImages =
    activeTab === 'stock'
      ? stockImagesByDate
      : activeTab === 'working'
        ? workingImages
        : completedImages;

  // Khi xem tất cả ngày, đây là đỉnh/đáy của toàn bộ lô.
  // Khi chọn một ngày, đây là đỉnh/đáy trong riêng ngày đó.
  const visibleStockTopId =
    stockImagesByDate[0]?.id;

  const visibleStockBottomId =
    stockImagesByDate[
      stockImagesByDate.length - 1
    ]?.id;

  const topLabel =
    selectedDate === 'all'
      ? 'Đỉnh lô'
      : 'Đỉnh ngày';

  const bottomLabel =
    selectedDate === 'all'
      ? 'Đáy lô'
      : 'Đáy ngày';

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

        <p className="text-sm font-medium text-slate-500">
          Đang tải lô...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28 md:pb-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            router.push('/user/inventory')
          }
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-slate-900 md:text-2xl">
            {folder?.name ||
              `Lô #${folderId}`}
          </h1>

          <p className="text-sm text-slate-500">
            {images.length} ảnh trong lô
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshImages(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
          aria-label="Làm mới"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </header>

      {errorMessage && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <span>{errorMessage}</span>

          <button
            type="button"
            onClick={() =>
              setErrorMessage('')
            }
            aria-label="Đóng thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {successMessage}
        </div>
      )}

      <section className="grid grid-cols-3 rounded-2xl bg-slate-200 p-1">
        <button
          type="button"
          onClick={() =>
            setActiveTab('stock')
          }
          className={`min-h-14 rounded-xl px-2 text-xs font-bold sm:text-sm ${activeTab === 'stock'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500'
            }`}
        >
          Trong kho
          <span className="ml-1">
            ({stockImages.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab('working')
          }
          className={`min-h-14 rounded-xl px-2 text-xs font-bold sm:text-sm ${activeTab === 'working'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-slate-500'
            }`}
        >
          Chờ cắt
          <span className="ml-1">
            ({workingImages.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab('completed')
          }
          className={`min-h-14 rounded-xl px-2 text-xs font-bold sm:text-sm ${activeTab === 'completed'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500'
            }`}
        >
          Đã xong
          <span className="ml-1">
            ({completedImages.length})
          </span>
        </button>
      </section>

      {activeTab === 'stock' && (
        <>
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800">
                    Xem ảnh theo ngày
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    Số thứ tự vẫn nối tiếp giữa tất cả các ngày
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {stockImagesByDate.length}/{stockImages.length} tấm
              </span>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button
                type="button"
                onClick={() => setSelectedDate('all')}
                className={`min-h-16 min-w-[7.5rem] shrink-0 rounded-2xl border px-4 py-2 text-left transition ${selectedDate === 'all'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700'
                  }`}
              >
                <span className="block text-sm font-bold">
                  Tất cả ngày
                </span>
                <span
                  className={`mt-1 block text-xs ${selectedDate === 'all'
                      ? 'text-blue-100'
                      : 'text-slate-400'
                    }`}
                >
                  {stockImages.length} tấm trong kho
                </span>
              </button>

              {availableDates.map((date) => {
                const [year, month, day] =
                  date.split('-');
                const isSelected =
                  selectedDate === date;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() =>
                      setSelectedDate(date)
                    }
                    className={`min-h-16 min-w-[7.5rem] shrink-0 rounded-2xl border px-4 py-2 text-left transition ${isSelected
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-700'
                      }`}
                  >
                    <span className="block text-sm font-bold">
                      {day}/{month}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${isSelected
                          ? 'text-blue-100'
                          : 'text-slate-400'
                        }`}
                    >
                      {year} • {dateImageCounts[date] || 0} tấm
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-700">
                  Ngày lưu ảnh mới
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ảnh upload tiếp theo sẽ được xếp vào ngày này
                </p>
              </div>

              <input
                type="date"
                value={uploadDate}
                onChange={(event) =>
                  setUploadDate(
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 outline-none focus:border-blue-500 sm:w-auto"
              />
            </div>
          </section>

          <section
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() =>
              setIsDragging(false)
            }
            onDrop={handleDrop}
            className={`hidden min-h-44 items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition md:flex ${isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-white'
              }`}
          >
            <div>
              <UploadCloud className="mx-auto h-10 w-10 text-blue-600" />

              <h2 className="mt-3 text-lg font-bold text-slate-800">
                Kéo thả ảnh vào đây
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Hoặc chọn nhiều ảnh từ máy tính
              </p>

              <button
                type="button"
                onClick={() =>
                  galleryInputRef.current?.click()
                }
                className="mt-4 h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white"
              >
                Chọn ảnh
              </button>
            </div>
          </section>

          {pendingFiles.length > 0 && (
            <section className="rounded-3xl border border-blue-200 bg-blue-50/50 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Ảnh đang chờ upload
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Đã chọn{' '}
                    <strong>
                      {pendingFiles.length}
                    </strong>{' '}
                    ảnh. Kiểm tra trước khi tải lên.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearPendingFiles}
                  disabled={isUploading}
                  className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Bỏ tất cả
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {pendingFiles.map(
                  (pendingFile, index) => (
                    <article
                      key={pendingFile.id}
                      className={`relative overflow-hidden rounded-xl border bg-white ${pendingFile.status ===
                          'error'
                          ? 'border-rose-400'
                          : 'border-slate-200'
                        }`}
                    >
                      <div className="relative aspect-square bg-slate-100">
                        <img
                          src={
                            pendingFile.previewUrl
                          }
                          alt={
                            pendingFile.file.name
                          }
                          className="h-full w-full object-cover"
                        />

                        <span className="absolute bottom-1 left-1 rounded-md bg-slate-950/70 px-1.5 py-0.5 text-xs font-bold text-white">
                          #{index + 1}
                        </span>

                        {!isUploading && (
                          <button
                            type="button"
                            onClick={() =>
                              removePendingFile(
                                pendingFile,
                              )
                            }
                            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/70 text-white"
                            aria-label="Bỏ ảnh"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}

                        {pendingFile.status ===
                          'uploading' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                              <Loader2 className="h-7 w-7 animate-spin text-white" />
                            </div>
                          )}
                      </div>

                      <p className="truncate px-2 py-2 text-xs font-medium text-slate-600">
                        {pendingFile.file.name}
                      </p>

                      {pendingFile.status ===
                        'error' && (
                          <p className="px-2 pb-2 text-[11px] font-semibold text-rose-600">
                            Upload lỗi
                          </p>
                        )}
                    </article>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  void uploadPendingFiles()
                }
                disabled={isUploading}
                className="mt-5 hidden h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white disabled:opacity-60 md:flex"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang tải{' '}
                    {uploadProgress.current}/
                    {uploadProgress.total} ảnh
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-5 w-5" />
                    Tải lên{' '}
                    {pendingFiles.length} ảnh
                  </>
                )}
              </button>
            </section>
          )}
        </>
      )}

      {currentImages.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <FileImage className="mx-auto h-12 w-12 text-slate-300" />

          <p className="mt-4 font-bold text-slate-700">
            {activeTab === 'stock' &&
              'Không có ảnh trong kho'}

            {activeTab === 'working' &&
              'Không có ảnh chờ cắt'}

            {activeTab === 'completed' &&
              'Chưa có ảnh hoàn thành'}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {activeTab === 'stock'
              ? 'Chọn ảnh từ điện thoại hoặc kéo thả trên máy tính.'
              : 'Ảnh sẽ xuất hiện tại đây sau khi cập nhật trạng thái.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {currentImages.map(
            (image) => {
              const isBusy =
                activeActionId === image.id;

              const isVisibleTop =
                activeTab === 'stock' &&
                image.id === visibleStockTopId;

              const isVisibleBottom =
                activeTab === 'stock' &&
                image.id === visibleStockBottomId;

              const isOnlyVisibleStockImage =
                isVisibleTop && isVisibleBottom;

              const completedTime =
                getCompletedTime(image);

              const stackNumber =
                activeTab === 'stock'
                  ? stockImageNumbers[
                  image.id
                  ] || 0
                  : originalImageNumbers[
                  image.id
                  ] || 0;

              const imageUrl =
                resolveFileUrl(
                  image.file_path,
                );

              return (
                <article
                  key={image.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${isOnlyVisibleStockImage
                      ? 'border-violet-400 ring-2 ring-violet-100'
                      : isVisibleTop
                        ? 'border-blue-400 ring-2 ring-blue-100'
                        : isVisibleBottom
                          ? 'border-amber-400 ring-2 ring-amber-100'
                          : 'border-slate-200'
                    }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        imageUrl,
                        '_blank',
                      )
                    }
                    className="relative block aspect-square w-full overflow-hidden bg-slate-100"
                  >
                    <img
                      src={imageUrl}
                      alt={image.filename}
                      className="h-full w-full object-cover transition hover:scale-105"
                    />

                    <span className="absolute left-2 top-2 rounded-lg bg-slate-950/75 px-2 py-1 text-sm font-bold text-white">
                      #{stackNumber}
                    </span>

                    {isOnlyVisibleStockImage && (
                      <span className="absolute right-2 top-2 rounded-lg bg-violet-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                        {selectedDate === 'all'
                          ? 'Đỉnh & đáy lô'
                          : 'Đỉnh & đáy ngày'}
                      </span>
                    )}

                    {isVisibleTop &&
                      !isOnlyVisibleStockImage && (
                        <span className="absolute right-2 top-2 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                          {topLabel}
                        </span>
                      )}

                    {isVisibleBottom &&
                      !isOnlyVisibleStockImage && (
                        <span className="absolute right-2 top-2 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                          {bottomLabel}
                        </span>
                      )}
                  </button>

                  <div className="p-3">
                    <p className="truncate text-xs font-bold text-slate-700">
                      {image.filename}
                    </p>

                    {activeTab ===
                      'completed' && (
                        <div className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 px-2.5 py-2">
                          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Cắt xong lúc
                            </p>
                            <p className="mt-0.5 text-[11px] font-bold leading-4 text-slate-700">
                              {formatCompletedTime(
                                completedTime,
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                    {activeTab ===
                      'stock' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void runImageAction(
                              image,
                              'pick',
                            )
                          }
                          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-2 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Hammer className="h-4 w-4" />
                          )}

                          Chờ cắt
                        </button>
                      )}

                    {activeTab ===
                      'working' && (
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void runImageAction(
                                image,
                                'complete',
                              )
                            }
                            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 text-sm font-bold text-white disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}

                            Hoàn thành
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void runImageAction(
                                image,
                                'cancel',
                              )
                            }
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-2 text-sm font-bold text-slate-600 disabled:opacity-60"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Trả kho
                          </button>
                        </div>
                      )}

                    {activeTab ===
                      'completed' && (
                        <div className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Đã hoàn thành
                        </div>
                      )}
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            addFiles(event.target.files);
          }

          event.target.value = '';
        }}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) {
            addFiles(event.target.files);
          }

          event.target.value = '';
        }}
      />

      {activeTab === 'stock' && (
        <div className="fixed inset-x-4 bottom-20 z-30 md:hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            {isUploading ? (
              <div className="flex h-14 items-center justify-center gap-3 rounded-xl bg-blue-50 font-bold text-blue-700">
                <Loader2 className="h-5 w-5 animate-spin" />

                Đang tải{' '}
                {uploadProgress.current}/
                {uploadProgress.total}
              </div>
            ) : pendingFiles.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  void uploadPendingFiles()
                }
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white"
              >
                <UploadCloud className="h-5 w-5" />
                Tải lên{' '}
                {pendingFiles.length} ảnh
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    galleryInputRef.current?.click()
                  }
                  className="flex h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 text-sm font-bold text-white"
                >
                  <Images className="h-5 w-5" />
                  Chọn nhiều ảnh
                </button>

                <button
                  type="button"
                  onClick={() =>
                    cameraInputRef.current?.click()
                  }
                  className="flex h-14 items-center justify-center gap-2 rounded-xl bg-slate-100 px-2 text-sm font-bold text-slate-700"
                >
                  <Camera className="h-5 w-5" />
                  Chụp thêm
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}