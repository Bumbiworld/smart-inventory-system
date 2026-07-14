'use client';

import {
  ArrowLeft,
  Camera,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  FileImage,
  Filter,
  Hammer,
  Images,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Tags,
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

interface TagRecord {
  id: number;
  name: string;
  color_code: string;
}

type UserImageRecord = ImageRecord & {
  completed_time?: string;
  tags?: TagRecord[];
};

type PendingStatus =
  | 'ready'
  | 'uploading'
  | 'error';

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string;
  status: PendingStatus;
  tagIds: number[];
  error?: string;
}

const POLL_INTERVAL_MS = 1500;

type ImageWithCompletion = UserImageRecord & {
  completed_time?: string;
};

const getCompletedTime = (image: UserImageRecord) =>
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
    useState<UserImageRecord[]>([]);

  const [pendingFiles, setPendingFiles] =
    useState<PendingFile[]>([]);

  const [allTags, setAllTags] =
    useState<TagRecord[]>([]);

  const [selectedTagIds, setSelectedTagIds] =
    useState<number[]>([]);

  const [showUntaggedOnly, setShowUntaggedOnly] =
    useState(false);

  const [isFilterOpen, setIsFilterOpen] =
    useState(false);

  const [filterSearch, setFilterSearch] =
    useState('');

  const [selectedPendingIds, setSelectedPendingIds] =
    useState<string[]>([]);

  const [isUploadModalOpen, setIsUploadModalOpen] =
    useState(false);

  const [uploadTagSearch, setUploadTagSearch] =
    useState('');

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

      const imageData: UserImageRecord[] =
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

        const imageData: UserImageRecord[] =
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

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/tags`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
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

      const data: TagRecord[] = await response.json();
      setAllTags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Không thể tải danh sách nhãn:', error);
    }
  }, [router]);

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
        await Promise.all([
          refreshImages(false),
          fetchTags(),
        ]);
      }

      scheduleNextRefresh();
    };

    const startPolling = async () => {
      await Promise.all([
        fetchData(),
        fetchTags(),
      ]);
      scheduleNextRefresh();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void Promise.all([
          refreshImages(false),
          fetchTags(),
        ]);
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
    fetchTags,
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

  const imageMatchesTagFilter = useCallback(
    (image: UserImageRecord) => {
      if (showUntaggedOnly) {
        return !image.tags?.length;
      }

      if (selectedTagIds.length === 0) {
        return true;
      }

      const imageTagIds = new Set(
        (image.tags || []).map((tag) => tag.id),
      );

      return selectedTagIds.every((tagId) =>
        imageTagIds.has(tagId),
      );
    },
    [selectedTagIds, showUntaggedOnly],
  );

  const filteredStockImages = useMemo(
    () => stockImages.filter(imageMatchesTagFilter),
    [imageMatchesTagFilter, stockImages],
  );

  const filteredWorkingImages = useMemo(
    () => workingImages.filter(imageMatchesTagFilter),
    [imageMatchesTagFilter, workingImages],
  );

  const filteredCompletedImages = useMemo(
    () => completedImages.filter(imageMatchesTagFilter),
    [completedImages, imageMatchesTagFilter],
  );

  const filteredTagOptions = useMemo(() => {
    const keyword = filterSearch.trim().toLowerCase();

    if (!keyword) {
      return allTags;
    }

    return allTags.filter((tag) =>
      tag.name.toLowerCase().includes(keyword),
    );
  }, [allTags, filterSearch]);

  const filteredUploadTagOptions = useMemo(() => {
    const keyword = uploadTagSearch.trim().toLowerCase();

    if (!keyword) {
      return allTags;
    }

    return allTags.filter((tag) =>
      tag.name.toLowerCase().includes(keyword),
    );
  }, [allTags, uploadTagSearch]);

  const selectedPendingFiles = useMemo(() => {
    const selectedIds = new Set(selectedPendingIds);
    return pendingFiles.filter((item) =>
      selectedIds.has(item.id),
    );
  }, [pendingFiles, selectedPendingIds]);

  const dateImageCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredStockImages.forEach((image) => {
      const date =
        image.original_time?.split('T')[0];

      if (date) {
        counts[date] = (counts[date] || 0) + 1;
      }
    });

    return counts;
  }, [filteredStockImages]);

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

  const actualStockImagesByDate = useMemo(() => {
    if (selectedDate === 'all') {
      return stockImages;
    }

    return stockImages.filter(
      (image) =>
        image.original_time?.split('T')[0] ===
        selectedDate,
    );
  }, [selectedDate, stockImages]);

  const stockImagesByDate = useMemo(() => {
    if (selectedDate === 'all') {
      return filteredStockImages;
    }

    return filteredStockImages.filter(
      (image) =>
        image.original_time?.split('T')[0] ===
        selectedDate,
    );
  }, [filteredStockImages, selectedDate]);

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

  const toggleFilterTag = (tagId: number) => {
    setShowUntaggedOnly(false);
    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  };

  const toggleUntaggedFilter = () => {
    setSelectedTagIds([]);
    setShowUntaggedOnly((current) => !current);
  };

  const clearTagFilters = () => {
    setSelectedTagIds([]);
    setShowUntaggedOnly(false);
  };

  const togglePendingSelection = (pendingId: string) => {
    setSelectedPendingIds((current) =>
      current.includes(pendingId)
        ? current.filter((id) => id !== pendingId)
        : [...current, pendingId],
    );
  };

  const toggleSelectAllPending = () => {
    const allIds = pendingFiles.map((item) => item.id);
    const allSelected =
      allIds.length > 0 &&
      allIds.every((id) => selectedPendingIds.includes(id));

    setSelectedPendingIds(
      allSelected ? [] : allIds,
    );
  };

  const toggleTagForSelectedPending = (tagId: number) => {
    if (selectedPendingIds.length === 0) {
      setErrorMessage('Hãy chọn ít nhất một ảnh để gắn nhãn.');
      return;
    }

    const selectedSet = new Set(selectedPendingIds);
    const allSelectedHaveTag =
      selectedPendingFiles.length > 0 &&
      selectedPendingFiles.every((item) =>
        item.tagIds.includes(tagId),
      );

    setPendingFiles((current) =>
      current.map((item) => {
        if (!selectedSet.has(item.id)) {
          return item;
        }

        return {
          ...item,
          tagIds: allSelectedHaveTag
            ? item.tagIds.filter((id) => id !== tagId)
            : Array.from(new Set([...item.tagIds, tagId])),
        };
      }),
    );
  };

  const getPendingTags = (item: PendingFile) =>
    item.tagIds
      .map((tagId) =>
        allTags.find((tag) => tag.id === tagId),
      )
      .filter((tag): tag is TagRecord => Boolean(tag));

  const renderImageTags = (image: UserImageRecord) => {
    if (!image.tags?.length) {
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400">
          Bình thường
        </span>
      );
    }

    const visibleTags = image.tags.slice(0, 2);
    const remainingCount =
      image.tags.length - visibleTags.length;

    return (
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {visibleTags.map((tag) => (
          <span
            key={tag.id}
            className="max-w-[5.5rem] truncate rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              borderColor: `${tag.color_code}66`,
              backgroundColor: `${tag.color_code}18`,
              color: tag.color_code,
            }}
            title={tag.name}
          >
            {tag.name}
          </span>
        ))}

        {remainingCount > 0 && (
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

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
            tagIds: [],
          });
        });

        return [...currentFiles, ...newItems].sort(
          (a, b) =>
            a.file.lastModified -
            b.file.lastModified,
        );
      });

      setIsUploadModalOpen(true);
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

    setSelectedPendingIds((current) =>
      current.filter((id) => id !== pendingFile.id),
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
    setSelectedPendingIds([]);
    setIsUploadModalOpen(false);
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

        // Nhãn là tùy chọn. Ảnh bình thường gửi chuỗi rỗng.
        formData.append(
          'tags',
          pendingFile.tagIds.join(','),
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
      setSelectedPendingIds([]);

      if (failedCount === 0) {
        setIsUploadModalOpen(false);
      }

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
        ? filteredWorkingImages
        : filteredCompletedImages;

  // Đỉnh/đáy luôn dựa trên chồng thật trước khi lọc nhãn.
  // Nếu ảnh đỉnh hoặc đáy không khớp bộ lọc thì không gắn nhãn sai
  // cho ảnh kế tiếp trong kết quả lọc.
  const visibleStockTopId =
    actualStockImagesByDate[0]?.id;

  const visibleStockBottomId =
    actualStockImagesByDate[
      actualStockImagesByDate.length - 1
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

      <section className="relative flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsFilterOpen((current) => !current)}
          className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm transition ${selectedTagIds.length > 0 || showUntaggedOnly
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-700'
            }`}
        >
          <Filter className="h-4 w-4" />
          Lọc nhãn
          {(selectedTagIds.length > 0 || showUntaggedOnly) && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
              {showUntaggedOnly ? 1 : selectedTagIds.length}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {(selectedTagIds.length > 0 || showUntaggedOnly) && (
          <>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {showUntaggedOnly && (
                <button
                  type="button"
                  onClick={toggleUntaggedFilter}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
                >
                  Bình thường
                  <X className="h-3 w-3" />
                </button>
              )}

              {selectedTagIds.map((tagId) => {
                const tag = allTags.find((item) => item.id === tagId);
                if (!tag) return null;

                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleFilterTag(tag.id)}
                    className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      borderColor: `${tag.color_code}66`,
                      backgroundColor: `${tag.color_code}16`,
                      color: tag.color_code,
                    }}
                  >
                    {tag.name}
                    <X className="h-3 w-3" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={clearTagFilters}
              className="h-9 shrink-0 rounded-lg px-2 text-xs font-bold text-slate-400"
            >
              Xóa lọc
            </button>
          </>
        )}

        {isFilterOpen && (
          <div className="absolute left-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                placeholder="Tìm nhãn..."
                className="h-11 w-full rounded-xl bg-slate-100 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <button
              type="button"
              onClick={toggleUntaggedFilter}
              className={`mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold ${showUntaggedOnly
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-700 hover:bg-slate-50'
                }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
                Bình thường (không nhãn)
              </span>
              {showUntaggedOnly && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </button>

            <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {filteredTagOptions.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);

                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleFilterTag(tag.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold ${selected
                      ? 'bg-blue-50'
                      : 'hover:bg-slate-50'
                      }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color_code }}
                      />
                      <span className="truncate text-slate-700">
                        {tag.name}
                      </span>
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                );
              })}

              {filteredTagOptions.length === 0 && (
                <p className="px-3 py-5 text-center text-xs text-slate-400">
                  Không tìm thấy nhãn.
                </p>
              )}
            </div>

            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              Nhãn do admin tạo. User chỉ chọn nhãn để upload và lọc ảnh.
            </p>
          </div>
        )}
      </section>

      {activeTab === 'stock' && (
        <>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[10.5rem_minmax(0,1fr)]">
              <label className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition hover:border-blue-300 hover:shadow">
                <CalendarDays className="h-5 w-5 shrink-0 text-slate-400" />

                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Ngày nhập kho:
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-blue-700">
                    {uploadDate.split('-').reverse().join('/')}
                  </p>
                </div>

                <input
                  type="date"
                  value={uploadDate}
                  onChange={(event) =>
                    setUploadDate(event.target.value)
                  }
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Chọn ngày nhập kho"
                />
              </label>

              <section
                onClick={() =>
                  galleryInputRef.current?.click()
                }
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
                className={`hidden min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed px-4 py-2 transition md:flex ${isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-blue-300 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <UploadCloud className={`h-5 w-5 shrink-0 text-blue-600 ${isDragging ? 'animate-bounce' : ''}`} />

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-700">
                      Chọn ảnh rồi phân loại
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Có thể chọn nhiều ảnh và gắn nhãn theo từng nhóm nếu cần.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Lịch sử:
              </span>

              {availableDates.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('all')}
                  className={`h-10 shrink-0 rounded-xl px-4 text-xs font-bold transition ${selectedDate === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-600'
                    }`}
                >
                  Tất cả ({stockImages.length})
                </button>
              )}

              {availableDates.map((date) => {
                const [year, month, day] = date.split('-');
                const isOnlyDate = availableDates.length === 1;
                const isSelected =
                  selectedDate === date ||
                  (isOnlyDate && selectedDate === 'all');

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`h-10 shrink-0 rounded-xl px-4 text-xs font-bold transition ${isSelected
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'border border-slate-200 bg-white text-slate-600'
                      }`}
                  >
                    {day}/{month}/{year} ({dateImageCounts[date] || 0})
                  </button>
                );
              })}
            </div>
          </div>

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

                      {pendingFile.status ===
                        'error' && (
                          <p className="px-2 py-2 text-[11px] font-semibold text-rose-600">
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
                  setIsUploadModalOpen(true)
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
                    Gắn nhãn & tải{' '}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
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

                  <div className="p-2">
                    <div className="min-h-5">
                      {renderImageTags(image)}
                    </div>

                    {activeTab ===
                      'completed' && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5">
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
                          className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2 text-xs font-bold text-white disabled:opacity-60 sm:min-h-11"
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
                        <div className="mt-2 grid gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void runImageAction(
                                image,
                                'complete',
                              )
                            }
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 text-xs font-bold text-white disabled:opacity-60 sm:min-h-11"
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
                            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-2 text-xs font-bold text-slate-600 disabled:opacity-60"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Trả kho
                          </button>
                        </div>
                      )}

                    {activeTab ===
                      'completed' && (
                        <div className="mt-2 flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-xs font-bold text-emerald-700">
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

      {isUploadModalOpen && pendingFiles.length > 0 && (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-w-5xl sm:rounded-3xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-bold text-slate-900 sm:text-lg">
                  <Tags className="h-5 w-5 text-blue-600" />
                  Gắn nhãn nếu cần
                </h2>
                <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                  Chỉ gắn nhãn cho ảnh quan trọng. Ảnh bình thường có thể để trống.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllPending}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm"
                >
                  {pendingFiles.length > 0 &&
                    pendingFiles.every((item) =>
                      selectedPendingIds.includes(item.id),
                    )
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả'}
                </button>

                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  Đã chọn {selectedPendingIds.length}/{pendingFiles.length}
                </span>

                {selectedPendingIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPendingIds([])}
                    className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400"
                  >
                    Bỏ chọn
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CalendarDays className="h-4 w-4" />
                  {uploadDate.split('-').reverse().join('/')}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={uploadTagSearch}
                      onChange={(event) =>
                        setUploadTagSearch(event.target.value)
                      }
                      placeholder="Tìm nhãn để gắn..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-400"
                    />
                  </div>

                  <p className="shrink-0 text-[11px] font-medium text-slate-400">
                    Chọn ảnh trước, sau đó bấm nhãn
                  </p>
                </div>

                <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                  {filteredUploadTagOptions.map((tag) => {
                    const allSelectedHaveTag =
                      selectedPendingFiles.length > 0 &&
                      selectedPendingFiles.every((item) =>
                        item.tagIds.includes(tag.id),
                      );

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          toggleTagForSelectedPending(tag.id)
                        }
                        disabled={selectedPendingIds.length === 0}
                        className={`flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${allSelectedHaveTag
                          ? 'ring-2 ring-blue-100'
                          : 'bg-white'
                          }`}
                        style={{
                          borderColor: `${tag.color_code}66`,
                          backgroundColor: allSelectedHaveTag
                            ? `${tag.color_code}18`
                            : undefined,
                          color: tag.color_code,
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: tag.color_code }}
                        />
                        {tag.name}
                        {allSelectedHaveTag && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    );
                  })}

                  {allTags.length === 0 && (
                    <p className="py-2 text-xs text-slate-400">
                      Admin chưa tạo nhãn. Bạn vẫn có thể upload ảnh bình thường.
                    </p>
                  )}

                  {allTags.length > 0 &&
                    filteredUploadTagOptions.length === 0 && (
                      <p className="py-2 text-xs text-slate-400">
                        Không tìm thấy nhãn phù hợp.
                      </p>
                    )}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                {pendingFiles.map((item) => {
                  const selected =
                    selectedPendingIds.includes(item.id);
                  const itemTags = getPendingTags(item);

                  return (
                    <article
                      key={item.id}
                      onClick={() =>
                        !isUploading &&
                        togglePendingSelection(item.id)
                      }
                      className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition ${selected
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : item.status === 'error'
                          ? 'border-rose-300'
                          : 'border-slate-200 shadow-sm'
                        }`}
                    >
                      <div className="relative aspect-square bg-slate-100">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />

                        <span
                          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-white ${selected
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-white/70 bg-slate-950/40'
                            }`}
                        >
                          {selected && (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removePendingFile(item);
                          }}
                          disabled={isUploading}
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/65 text-white disabled:opacity-50"
                          aria-label="Bỏ ảnh"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>

                        {item.status === 'uploading' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                            <Loader2 className="h-7 w-7 animate-spin text-white" />
                          </div>
                        )}
                      </div>

                      <div className="p-1.5">
                        {itemTags.length === 0 ? (
                          <p className="text-[10px] font-semibold text-slate-400">
                            Bình thường • không nhãn
                          </p>
                        ) : (
                          <div className="mt-1 flex items-center gap-1 overflow-hidden">
                            {itemTags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: tag.color_code,
                                }}
                                title={tag.name}
                              />
                            ))}
                            <span className="truncate text-[9px] font-semibold text-slate-400">
                              {itemTags.map((tag) => tag.name).join(', ')}
                            </span>
                          </div>
                        )}

                        {item.status === 'error' && (
                          <p className="mt-1 text-[10px] font-bold text-rose-600">
                            {item.error || 'Upload lỗi'}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {pendingFiles.length} ảnh đã chọn
                </p>
                <p className="text-xs text-slate-500">
                  Ảnh không có nhãn vẫn được upload như vật liệu bình thường.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearPendingFiles}
                  disabled={isUploading}
                  className="h-11 rounded-xl px-4 text-sm font-bold text-rose-600 disabled:opacity-50"
                >
                  Bỏ toàn bộ
                </button>

                <button
                  type="button"
                  onClick={() => void uploadPendingFiles()}
                  disabled={isUploading || pendingFiles.length === 0}
                  className="flex h-11 min-w-40 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:bg-slate-300"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadProgress.current}/{uploadProgress.total}
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Upload {pendingFiles.length} ảnh
                    </>
                  )}
                </button>
              </div>
            </footer>
          </div>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            {isUploading ? (
              <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                <Loader2 className="h-5 w-5 animate-spin" />

                Đang tải{' '}
                {uploadProgress.current}/
                {uploadProgress.total}
              </div>
            ) : pendingFiles.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setIsUploadModalOpen(true)
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white"
              >
                <UploadCloud className="h-5 w-5" />
                Gắn nhãn & tải{' '}
                {pendingFiles.length} ảnh
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    galleryInputRef.current?.click()
                  }
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 text-xs font-bold text-white sm:text-sm"
                >
                  <Images className="h-5 w-5" />
                  Chọn nhiều ảnh
                </button>

                <button
                  type="button"
                  onClick={() =>
                    cameraInputRef.current?.click()
                  }
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-2 text-xs font-bold text-slate-700 sm:text-sm"
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