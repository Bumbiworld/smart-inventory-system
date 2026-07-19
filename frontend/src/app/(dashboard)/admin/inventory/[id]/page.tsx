'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { API_BASE_URL, getToken, readApiError } from '@/lib/inventory-api';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Image as ImageIcon, Trash2, Eye, LayoutGrid,
  Layers, Loader2, Scissors, X, CalendarDays, Undo2, Calendar, CheckCircle2,
  FileImage, Tags, Plus, Filter, Search, Check, SlidersHorizontal,
  Settings2, ImagePlus, ChevronDown
} from 'lucide-react';

interface TagRecord {
  id: number;
  name: string;
  color_code: string;
}

interface ImageRecord {
  id: number;
  folder_id: number;
  filename: string;
  file_path: string;
  size_mb: string;
  original_time: string;
  status: string;
  completed_time?: string;
  tags: TagRecord[];
}

interface PendingUploadFile {
  id: string;
  file: File;
  previewUrl: string;
  tagIds: number[];
}

type PendingView = 'all' | 'untagged';

const POLL_INTERVAL_MS = 1500;

export default function FolderDetailPage() {
  const params = useParams();
  const router = useRouter();

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

  const [allTags, setAllTags] = useState<TagRecord[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [isTagCreatorOpen, setIsTagCreatorOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<number | null>(null);

  const [pendingFiles, setPendingFiles] = useState<PendingUploadFile[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingView, setPendingView] = useState<PendingView>('all');
  const [uploadTagSearch, setUploadTagSearch] = useState('');
  const [isUploadTagPickerOpen, setIsUploadTagPickerOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; img: ImageRecord | null }>({
    isOpen: false,
    img: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<PendingUploadFile[]>([]);

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

  // ĐOẠN MÃ MỚI: Lắng nghe phím ESC để đóng Modal xem ảnh
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewModal({ isOpen: false, img: null });
      }
    };

    if (previewModal.isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewModal.isOpen]);

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
      const response = await fetch(`${API_BASE_URL}/api/inventory/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 401) {
        localStorage.removeItem('token'); localStorage.removeItem('userRole'); router.replace('/login'); return;
      }
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setFolderName(data.name);
    } catch (error) { console.error('Lỗi khi tải thông tin thư mục:', error); }
  }, [folderId, router]);

  const fetchImages = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/inventory/folders/${folderId}/images`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (response.status === 401) {
        localStorage.removeItem('token'); localStorage.removeItem('userRole'); router.replace('/login'); return;
      }
      if (!response.ok) throw new Error(await readApiError(response));
      const data = await response.json();
      setImages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách hình ảnh:', error);
      if (showLoading) setImages([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [folderId, router]);

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

      const data = await response.json();
      setAllTags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách tag:', error);
    }
  }, [router]);

  useEffect(() => {
    if (isInvalidFolder) { setIsLoading(false); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleNextRefresh = () => { if (!stopped) timer = setTimeout(refreshImages, POLL_INTERVAL_MS); };
    const refreshImages = async () => { if (!document.hidden) await fetchImages(false); scheduleNextRefresh(); };
    const startPolling = async () => {
      await Promise.all([
        fetchImages(true),
        fetchFolderDetails(),
        fetchTags(),
      ]);
      scheduleNextRefresh();
    };
    const handleVisibilityChange = () => { if (!document.hidden) void fetchImages(false); };

    void startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchFolderDetails, fetchImages, fetchTags, isInvalidFolder]);

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

  const imageMatchesTagFilter = useCallback(
    (image: ImageRecord) => {
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

  const visiblePendingFiles = useMemo(() => {
    if (pendingView === 'untagged') {
      return pendingFiles.filter((item) => item.tagIds.length === 0);
    }

    return pendingFiles;
  }, [pendingFiles, pendingView]);

  const untaggedPendingCount = useMemo(
    () => pendingFiles.filter((item) => item.tagIds.length === 0).length,
    [pendingFiles],
  );

  const selectedPendingFiles = useMemo(() => {
    const selectedIds = new Set(selectedPendingIds);
    return pendingFiles.filter((item) => selectedIds.has(item.id));
  }, [pendingFiles, selectedPendingIds]);

  const originalTags = useMemo(() => {
    const tags: Record<number, number> = {};
    [...images].sort((a, b) => new Date(a.original_time).getTime() - new Date(b.original_time).getTime() || a.id - b.id)
      .forEach((img, index) => { tags[img.id] = index + 1; });
    return tags;
  }, [images]);

  const { sortedAvailableStack, availableStackNumbers } = useMemo(() => {
    const ascending = [...availableImages].sort((a, b) => new Date(a.original_time).getTime() - new Date(b.original_time).getTime() || a.id - b.id);
    const numbers: Record<number, number> = {};
    ascending.forEach((img, index) => { numbers[img.id] = index + 1; });
    return { sortedAvailableStack: [...ascending].reverse(), availableStackNumbers: numbers };
  }, [availableImages]);

  const { imagesByDate, dates } = useMemo(() => {
    const availableGrouped = sortedAvailableStack.reduce((acc, img) => {
      const date = img.original_time.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(img);
      return acc;
    }, {} as Record<string, ImageRecord[]>);
    return { imagesByDate: availableGrouped, dates: Object.keys(availableGrouped).sort().reverse() };
  }, [sortedAvailableStack]);

  const filteredAvailableStack = useMemo(
    () => sortedAvailableStack.filter(imageMatchesTagFilter),
    [imageMatchesTagFilter, sortedAvailableStack],
  );

  const filteredImagesByDate = useMemo(() => {
    return filteredAvailableStack.reduce(
      (acc, image) => {
        const date = image.original_time.split('T')[0];
        acc[date] ??= [];
        acc[date].push(image);
        return acc;
      },
      {} as Record<string, ImageRecord[]>,
    );
  }, [filteredAvailableStack]);

  useEffect(() => {
    if (dates.length > 0 && (!selectedDate || !dates.includes(selectedDate))) setSelectedDate(dates[0]);
    else if (dates.length === 0) setSelectedDate('');
  }, [dates]);

  const { completedByDate, completedDates } = useMemo(() => {
    const allGrouped: Record<string, boolean> = {};
    completedImages.forEach(img => {
      const timeStr = img.completed_time || img.original_time;
      const date = timeStr.split('T')[0];
      allGrouped[date] = true;
    });
    const sortedCompleted = [...completedImages].sort((a, b) => new Date(b.completed_time || b.original_time).getTime() - new Date(a.completed_time || a.original_time).getTime());
    const grouped = sortedCompleted.reduce((acc, img) => {
      const timeStr = img.completed_time || img.original_time;
      const date = timeStr.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(img);
      return acc;
    }, {} as Record<string, ImageRecord[]>);
    return { completedByDate: grouped, completedDates: Object.keys(allGrouped).sort().reverse() };
  }, [completedImages]);

  useEffect(() => {
    if (completedDates.length > 0 && (!selectedCompletedDate || !completedDates.includes(selectedCompletedDate))) setSelectedCompletedDate(completedDates[0]);
    else if (completedDates.length === 0) setSelectedCompletedDate('');
  }, [completedDates]);

  const filteredCompletedByDate = useMemo(() => {
    return filteredCompletedImages.reduce(
      (acc, image) => {
        const timeValue =
          image.completed_time || image.original_time;
        const date = timeValue.split('T')[0];
        acc[date] ??= [];
        acc[date].push(image);
        return acc;
      },
      {} as Record<string, ImageRecord[]>,
    );
  }, [filteredCompletedImages]);

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

  const addPendingFiles = (rawFiles: FileList | File[]) => {
    const incomingFiles = Array.from(rawFiles)
      .filter((file) =>
        file.type.startsWith('image/') ||
        /\.(dng|heic)$/i.test(file.name),
      )
      .sort((a, b) => a.lastModified - b.lastModified);

    if (incomingFiles.length === 0) {
      alert('Không tìm thấy file ảnh hợp lệ.');
      return;
    }

    setPendingFiles((current) => {
      const existingKeys = new Set(
        current.map(
          (item) =>
            `${item.file.name}-${item.file.size}-${item.file.lastModified}`,
        ),
      );

      const additions: PendingUploadFile[] = [];

      incomingFiles.forEach((file, index) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;

        if (existingKeys.has(key)) {
          return;
        }

        existingKeys.add(key);
        additions.push({
          id: `${Date.now()}-${index}-${file.name}`,
          file,
          previewUrl: URL.createObjectURL(file),
          tagIds: [],
        });
      });

      return [...current, ...additions];
    });

    setIsUploadModalOpen(true);
    setPendingView('all');
  };

  const removePendingFile = (pendingId: string) => {
    setPendingFiles((current) => {
      const target = current.find((item) => item.id === pendingId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== pendingId);
    });

    setSelectedPendingIds((current) =>
      current.filter((id) => id !== pendingId),
    );
  };

  const clearPendingFiles = () => {
    pendingFiles.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    setPendingFiles([]);
    setSelectedPendingIds([]);
    setIsUploadModalOpen(false);
  };

  const togglePendingSelection = (pendingId: string) => {
    setSelectedPendingIds((current) =>
      current.includes(pendingId)
        ? current.filter((id) => id !== pendingId)
        : [...current, pendingId],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = visiblePendingFiles.map((item) => item.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedPendingIds.includes(id));

    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedPendingIds((current) =>
        current.filter((id) => !visibleSet.has(id)),
      );
      return;
    }

    setSelectedPendingIds((current) =>
      Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const toggleTagForSelectedPending = (tagId: number) => {
    if (selectedPendingIds.length === 0) {
      alert('Hãy chọn ít nhất một ảnh trước.');
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

  const getPendingTags = (item: PendingUploadFile) =>
    item.tagIds
      .map((tagId) => allTags.find((tag) => tag.id === tagId))
      .filter((tag): tag is TagRecord => Boolean(tag));

  const handleCreateTag = async () => {
    const name = newTagName.trim();

    if (!name) {
      alert('Vui lòng nhập tên nhãn.');
      return;
    }

    setIsCreatingTag(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/tags`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            color_code: newTagColor,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const createdTag: TagRecord =
        await response.json();

      setAllTags((current) => {
        const withoutDuplicate = current.filter(
          (tag) => tag.id !== createdTag.id,
        );

        return [...withoutDuplicate, createdTag].sort(
          (a, b) => a.name.localeCompare(b.name, 'vi'),
        );
      });

      if (selectedPendingIds.length > 0) {
        const selectedSet = new Set(selectedPendingIds);
        setPendingFiles((current) =>
          current.map((item) =>
            selectedSet.has(item.id)
              ? {
                ...item,
                tagIds: Array.from(
                  new Set([...item.tagIds, createdTag.id]),
                ),
              }
              : item,
          ),
        );
      }

      setNewTagName('');
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Không thể tạo nhãn.',
      );
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tag: TagRecord) => {
    const confirmed = window.confirm(
      `Xóa nhãn "${tag.name}"? Nhãn này sẽ được gỡ khỏi tất cả ảnh đang sử dụng.`,
    );

    if (!confirmed) return;

    setDeletingTagId(tag.id);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/tags/${tag.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setAllTags((current) =>
        current.filter((item) => item.id !== tag.id),
      );

      setSelectedTagIds((current) =>
        current.filter((id) => id !== tag.id),
      );

      setPendingFiles((current) =>
        current.map((item) => ({
          ...item,
          tagIds: item.tagIds.filter((id) => id !== tag.id),
        })),
      );

      setImages((current) =>
        current.map((image) => ({
          ...image,
          tags: (image.tags || []).filter(
            (item) => item.id !== tag.id,
          ),
        })),
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Không thể xóa nhãn.',
      );
    } finally {
      setDeletingTagId(null);
    }
  };

  const renderImageTags = (image: ImageRecord) => {
    if (!image.tags?.length) {
      return (
        <span className="text-[10px] font-semibold text-slate-400">
          Bình thường
        </span>
      );
    }

    const visibleTags = image.tags.slice(0, 2);
    const remainingCount = image.tags.length - visibleTags.length;

    return (
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {visibleTags.map((tag) => (
          <span
            key={tag.id}
            className="max-w-[7rem] truncate rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
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

  const uploadPendingFilesToServer = async () => {
    if (pendingFiles.length === 0 || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadProgress({
      current: 0,
      total: pendingFiles.length,
    });

    const token = localStorage.getItem('token');

    try {
      for (let index = 0; index < pendingFiles.length; index += 1) {
        const pending = pendingFiles[index];

        setUploadProgress({
          current: index + 1,
          total: pendingFiles.length,
        });

        const formData = new FormData();
        formData.append('file', pending.file);
        formData.append('upload_date', uploadDate);
        formData.append('tags', pending.tagIds.join(','));

        const response = await fetch(
          `${API_BASE_URL}/api/inventory/folders/${folderId}/images`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(
            `${pending.file.name}: ${await readApiError(response)}`,
          );
        }
      }

      pendingFiles.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });

      setPendingFiles([]);
      setSelectedPendingIds([]);
      setIsUploadModalOpen(false);
      await fetchImages(false);
    } catch (error) {
      console.error('Lỗi upload:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Tải ảnh lên thất bại.',
      );
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      addPendingFiles(e.dataTransfer.files);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addPendingFiles(e.target.files);
    }

    e.target.value = '';
  };
  const handleBoxClick = () => {
    if (dateInputRef.current) {
      try { dateInputRef.current.showPicker(); } catch (error) { dateInputRef.current.click(); }
    }
  };

  return (
    <div className="relative mx-auto max-w-7xl animate-in space-y-4 pb-10 fade-in slide-in-from-bottom-4 duration-500">

      {/* HEADER TỐI GIẢN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mt-2">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={() => router.push('/admin/inventory')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="hidden h-6 w-px bg-slate-300 sm:block"></div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <LayoutGrid className="h-5 w-5 text-blue-500 hidden sm:block" />
              {folderName ? `Lô hàng: ${folderName}` : `Lô hàng #${folderId}`}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 font-medium sm:text-sm">
              Sơ đồ không gian thực tế • <span className="font-bold text-blue-600">{images.length} tấm ảnh</span>
            </p>
          </div>
        </div>

        {/* TABS NẰM NGANG */}
        <div className="flex rounded-xl bg-slate-100 p-1 shadow-inner">
          <button onClick={() => setActiveTab('inventory')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${activeTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Calendar className="h-4 w-4" /> <span className="hidden sm:inline">Theo ngày</span>
          </button>
          <button onClick={() => setActiveTab('stack')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${activeTab === 'stack' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Layers className="h-4 w-4" /> <span className="hidden sm:inline">Toàn bộ</span>
          </button>
          <button onClick={() => setActiveTab('completed')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all sm:text-sm ${activeTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">Hoàn thành</span>
          </button>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsFilterOpen((value) => !value)}
          className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${selectedTagIds.length > 0 || showUntaggedOnly
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Bộ lọc
          {(selectedTagIds.length > 0 || showUntaggedOnly) && (
            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
              {showUntaggedOnly ? 1 : selectedTagIds.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsTagCreatorOpen(true)}
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          <Settings2 className="h-4 w-4" />
          Quản lý nhãn
        </button>

        {(selectedTagIds.length > 0 || showUntaggedOnly) && (
          <>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {showUntaggedOnly && (
                <button
                  type="button"
                  onClick={toggleUntaggedFilter}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
                  title="Bỏ bộ lọc không gắn nhãn"
                >
                  Không gắn nhãn
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
                    title="Bỏ nhãn khỏi bộ lọc"
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
              className="h-9 shrink-0 rounded-lg px-2 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              Xóa lọc
            </button>
          </>
        )}

        {isFilterOpen && (
          <div className="absolute left-0 top-12 z-40 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                placeholder="Tìm nhãn..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium outline-none focus:border-blue-400 focus:bg-white"
              />
            </label>

            <p className="mt-2 text-[11px] font-medium text-slate-400">
              Chọn nhãn cần tìm, hoặc xem riêng vật liệu bình thường không gắn nhãn.
            </p>

            <button
              type="button"
              onClick={toggleUntaggedFilter}
              className={`mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold transition ${showUntaggedOnly
                ? 'bg-slate-100 text-slate-800'
                : 'text-slate-700 hover:bg-slate-50'
                }`}
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
                Không gắn nhãn (bình thường)
              </span>
              {showUntaggedOnly && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </button>

            <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {filteredTagOptions.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-400">
                  Không tìm thấy nhãn.
                </p>
              ) : (
                filteredTagOptions.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleFilterTag(tag.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold transition ${selected
                        ? 'bg-slate-100'
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
                })
              )}
            </div>
          </div>
        )}
      </div>

      <input type="file" multiple accept="image/*, .dng, .heic" className="hidden" ref={fileInputRef} onChange={handleFileSelect} disabled={isUploading} />

      {isInvalidFolder ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed shadow-sm mt-8">
          <X className="w-12 h-12 mx-auto text-rose-400 mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2">Lô hàng không tồn tại</h3>
          <button onClick={() => router.push('/admin/inventory')} className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors">Về trang Quản lý</button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in">

          {/* TAB 1: THEO NGÀY */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">

              {/* KHU VỰC CHỜ CẮT */}
              {filteredWorkingImages.length > 0 && (
                <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-4 sm:p-5">
                  <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2 text-sm">
                    <Scissors className="w-4 h-4" /> Đang chờ cắt (Đã đưa vào máy)
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {filteredWorkingImages.map((img) => {
                      const tagNum = originalTags[img.id] || 0;
                      return (
                        <div key={img.id} className="bg-white p-2 rounded-xl shadow-sm border border-amber-200 flex items-center gap-3 relative group">
                          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => setPreviewModal({ isOpen: true, img: img })}>
                            {img.file_path.toLowerCase().endsWith('.dng') ? (
                              <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400"><FileImage className="w-5 h-5" /></div>
                            ) : (
                              <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="h-12 w-12 rounded-lg border border-slate-100 object-cover" />
                            )}
                            <div className="absolute -top-2 -left-2 z-10 bg-black/80 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-white/20">#{tagNum}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{img.filename}</p>
                            <div className="mt-1">{renderImageTags(img)}</div>
                            <button onClick={() => handleCancelWork(img.id)} className="text-[10px] text-rose-500 font-bold hover:underline flex items-center gap-1 mt-1"><Undo2 className="w-3 h-3" /> Hủy & Trả kho</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* KHU VỰC CHỌN ẢNH — TAG ĐƯỢC GÁN THEO TỪNG NHÓM ẢNH TRONG CỬA SỔ PHÂN LOẠI */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div onClick={handleBoxClick} className="group flex h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition-all hover:border-blue-300 hover:shadow sm:w-auto">
                  <CalendarDays className="h-5 w-5 text-slate-400 transition-colors group-hover:text-blue-500" />
                  <div className="flex flex-col pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày nhập kho:</span>
                    <span className="text-sm font-bold text-blue-700">{uploadDate.split('-').reverse().join('/')}</span>
                  </div>
                  <input type="date" ref={dateInputRef} value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} onClick={(e) => e.stopPropagation()} className="pointer-events-none absolute h-0 w-0 opacity-0" />
                </div>

                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 text-center transition-all duration-300 ${isUploading
                    ? 'cursor-not-allowed border-slate-200 bg-slate-50'
                    : 'cursor-pointer border-blue-300 bg-blue-50/50 hover:bg-blue-100/50'
                    }`}
                >
                  <ImagePlus className={`h-5 w-5 ${isDragging ? 'animate-bounce text-blue-700' : 'text-blue-500'}`} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-blue-700">
                      Chọn ảnh rồi phân loại
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Có thể chọn 50 ảnh và gán nhãn theo từng nhóm màu.
                    </p>
                  </div>
                </div>

                {pendingFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white"
                  >
                    <Tags className="h-4 w-4" />
                    Phân loại ({pendingFiles.length})
                  </button>
                )}
              </div>

              {/* LƯỚI ẢNH THEO NGÀY CÓ HIỆN ĐỈNH/ĐÁY */}
              {filteredAvailableStack.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed"><ImageIcon className="w-12 h-12 mx-auto text-slate-300 mb-4" /><p className="text-slate-500 font-medium">
                  {selectedTagIds.length > 0
                    ? 'Không có ảnh nào phù hợp với bộ lọc.'
                    : 'Kho trống hoặc ván đã đưa vào máy cắt hết.'}
                </p></div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 whitespace-nowrap">Lịch sử:</span>
                    {dates.map(date => {
                      const total = (filteredImagesByDate[date] || []).length;
                      return (
                        <button key={date} onClick={() => setSelectedDate(date)} className={`flex-shrink-0 px-4 py-2 rounded-xl border text-sm font-bold transition-all whitespace-nowrap ${selectedDate === date ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                          {date.split('-').reverse().join('/')} <span className="opacity-70 text-xs ml-1">({total})</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDate && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:gap-4">
                      {((filteredImagesByDate?.[selectedDate]) || []).map((img) => {
                        const dynamicIndex = availableStackNumbers[img.id] || 0;
                        const fullDateStack = imagesByDate[selectedDate] || [];
                        const isOnly = fullDateStack.length === 1;
                        const isTop = img.id === fullDateStack[0]?.id;
                        const isBottom =
                          img.id ===
                          fullDateStack[fullDateStack.length - 1]?.id;

                        return (
                          <div key={img.id} className={`group bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative ${isOnly ? 'border-violet-400 ring-4 ring-violet-50' : isTop ? 'border-blue-400 ring-4 ring-blue-50' : isBottom ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-200/60'}`}>
                            <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md text-white font-mono font-bold text-sm px-2 py-0.5 rounded-lg border border-white/10">#{dynamicIndex}</div>

                            {!isOnly && isTop && (
                              <div className="absolute top-2 right-2 z-20 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">ĐỈNH NGÀY</div>
                            )}
                            {!isOnly && isBottom && (
                              <div className="absolute top-2 right-2 z-20 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">ĐÁY NGÀY</div>
                            )}
                            {isOnly && (
                              <div className="absolute top-2 right-2 z-20 bg-violet-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">DUY NHẤT</div>
                            )}

                            <div className="relative aspect-square bg-slate-100 overflow-hidden cursor-pointer" onClick={() => setPreviewModal({ isOpen: true, img: img })}>
                              {img.file_path.toLowerCase().endsWith('.dng') ? (
                                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-colors">
                                  <FileImage className="w-10 h-10 mb-2" />
                                  <span className="text-xs font-bold tracking-wider">FILE .DNG</span>
                                </div>
                              ) : (
                                <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                              )}

                              <div className="absolute inset-0 hidden items-center justify-center gap-1.5 bg-slate-950/40 px-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:flex">
                                <button onClick={(e) => { e.stopPropagation(); handlePickForWork(img.id); }} className="p-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0" title="Đưa vào chờ cắt"><Scissors className="w-4 h-4" /></button>

                                <button onClick={(e) => { e.stopPropagation(); setPreviewModal({ isOpen: true, img: img }); }} className="p-2 bg-white text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0" title="Xem ảnh lớn"><Eye className="w-4 h-4" /></button>

                                <button onClick={(e) => { e.stopPropagation(); handleDeleteSingleImage(img.id); }} className="p-2 bg-white text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>

                            <div className="border-t border-slate-100 p-2">
                              {renderImageTags(img)}
                            </div>

                            <div className="grid grid-cols-3 gap-1 border-t border-slate-100 p-1.5 lg:hidden">
                              <button type="button" onClick={(e) => { e.stopPropagation(); handlePickForWork(img.id); }} className="flex min-h-9 items-center justify-center rounded-lg text-emerald-600 active:bg-emerald-50"><Scissors className="h-4 w-4" /></button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewModal({ isOpen: true, img }); }} className="flex min-h-9 items-center justify-center rounded-lg text-amber-600 active:bg-amber-50"><Eye className="h-4 w-4" /></button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteSingleImage(img.id); }} className="flex min-h-9 items-center justify-center rounded-lg text-rose-600 active:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TOÀN BỘ CHỒNG (GIAO DIỆN SẠCH SẼ + CÓ NHÃN ĐỈNH/ĐÁY) */}
          {activeTab === 'stack' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:gap-4 mt-4">
              {filteredAvailableStack.map((img) => {
                const dynamicIndex = availableStackNumbers[img.id] || 0;
                const isTopStack =
                  img.id === sortedAvailableStack[0]?.id;
                const isBottomStack =
                  img.id ===
                  sortedAvailableStack[
                    sortedAvailableStack.length - 1
                  ]?.id;
                const isOnlyStack =
                  sortedAvailableStack.length === 1;

                return (
                  <div key={img.id} className="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 border-slate-200/60 hover:shadow-md">

                    <div className="absolute left-2 top-2 z-20 rounded-lg border border-white/10 bg-black/65 px-2 py-0.5 font-mono text-sm font-bold text-white shadow-sm backdrop-blur-md">#{dynamicIndex}</div>

                    {/* KHÔI PHỤC LẠI NHÃN ĐỈNH / ĐÁY TẠI ĐÂY */}
                    {!isOnlyStack && isTopStack && (
                      <div className="absolute top-2 right-2 z-20 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">ĐỈNH CHỒNG</div>
                    )}
                    {!isOnlyStack && isBottomStack && (
                      <div className="absolute top-2 right-2 z-20 bg-amber-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">ĐÁY CHỒNG</div>
                    )}
                    {isOnlyStack && (
                      <div className="absolute top-2 right-2 z-20 bg-violet-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">DUY NHẤT</div>
                    )}

                    <div className="relative aspect-square overflow-hidden bg-slate-100 cursor-pointer" onClick={() => setPreviewModal({ isOpen: true, img: img })}>
                      {img.file_path.toLowerCase().endsWith('.dng') ? (
                        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-colors">
                          <FileImage className="w-10 h-10 mb-2" />
                          <span className="text-xs font-bold tracking-wider">FILE .DNG</span>
                        </div>
                      ) : (
                        <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      )}

                      {/* CHỈ HIỆN 1 ICON MẮT KHI HOVER */}
                      <div className="absolute inset-0 hidden items-center justify-center bg-slate-950/40 px-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:flex">
                        <button onClick={(e) => { e.stopPropagation(); setPreviewModal({ isOpen: true, img }); }} className="p-3 bg-white text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0" title="Xem ảnh lớn"><Eye className="h-6 w-6" /></button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 p-2">
                      {renderImageTags(img)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: ĐÃ HOÀN THÀNH */}
          {activeTab === 'completed' && (
            <div className="space-y-4">
              {filteredCompletedImages.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 whitespace-nowrap">Đã hoàn thành:</span>
                  {completedDates.map(date => {
                    const total = (filteredCompletedByDate[date] || []).length;
                    return (
                      <button key={date} onClick={() => setSelectedCompletedDate(date)} className={`flex-shrink-0 px-4 py-2 rounded-xl border text-sm font-bold transition-all whitespace-nowrap ${selectedCompletedDate === date ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        {date.split('-').reverse().join('/')} <span className="opacity-70 text-xs ml-1">({total})</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedCompletedDate && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:gap-4">
                  {((filteredCompletedByDate?.[selectedCompletedDate]) || []).map((img) => (
                    <div key={img.id} className="group bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm flex flex-col relative">
                      <div className="absolute top-2 left-2 z-20 bg-emerald-600/95 backdrop-blur-md text-white font-mono font-bold text-sm px-2 py-0.5 rounded-lg border border-emerald-500/30">#{originalTags[img.id] || 0}</div>
                      <div className="relative aspect-square bg-slate-100 overflow-hidden cursor-pointer" onClick={() => setPreviewModal({ isOpen: true, img: img })}>
                        {img.file_path.toLowerCase().endsWith('.dng') ? (
                          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-colors">
                            <FileImage className="w-10 h-10 mb-2" />
                            <span className="text-xs font-bold tracking-wider">FILE .DNG</span>
                          </div>
                        ) : (
                          <img src={getValidImageUrl(img.file_path)} alt={img.filename} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90" />
                        )}
                        <div className="absolute inset-0 hidden items-center justify-center bg-slate-950/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 lg:flex">
                          <button onClick={(e) => { e.stopPropagation(); setPreviewModal({ isOpen: true, img: img }); }} className="p-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0" title="Xem ảnh lớn"><Eye className="w-4 h-4" /></button>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 p-2">
                        {renderImageTags(img)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isTagCreatorOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setIsTagCreatorOpen(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Quản lý nhãn</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tạo mới hoặc xóa các nhãn phân loại vật liệu.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsTagCreatorOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                aria-label="Đóng quản lý nhãn"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Tên nhãn mới
                    </span>
                    <input
                      value={newTagName}
                      onChange={(event) => setNewTagName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleCreateTag();
                        }
                      }}
                      placeholder="Ví dụ: Inox, Đỏ, Vàng, 1.2mm..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Màu
                    </span>
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(event) => setNewTagColor(event.target.value)}
                      className="h-11 w-full min-w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 sm:w-16"
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span
                    className="max-w-[60%] truncate rounded-full border px-3 py-1 text-xs font-bold"
                    style={{
                      borderColor: `${newTagColor}66`,
                      backgroundColor: `${newTagColor}18`,
                      color: newTagColor,
                    }}
                  >
                    {newTagName.trim() || 'Xem trước'}
                  </span>

                  <button
                    type="button"
                    onClick={() => void handleCreateTag()}
                    disabled={isCreatingTag || !newTagName.trim()}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {isCreatingTag ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Thêm nhãn
                  </button>
                </div>
              </section>

              <section className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">
                    Nhãn hiện có
                  </h3>
                  <span className="text-xs font-semibold text-slate-400">
                    {allTags.length} nhãn
                  </span>
                </div>

                {allTags.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có nhãn phân loại.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color_code }}
                          />
                          <span className="truncate text-sm font-semibold text-slate-700">
                            {tag.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDeleteTag(tag)}
                          disabled={deletingTagId === tag.id}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          aria-label={`Xóa nhãn ${tag.name}`}
                          title="Xóa nhãn"
                        >
                          {deletingTagId === tag.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs leading-5 text-amber-700">
                  Khi xóa một nhãn, nhãn đó cũng sẽ được gỡ khỏi mọi ảnh đang sử dụng. Ảnh và file gốc không bị xóa.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[105] flex bg-slate-950/50 backdrop-blur-sm">
          <div className="ml-auto flex h-full w-full max-w-6xl flex-col bg-slate-50 shadow-2xl">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  Gắn nhãn nếu cần cho {pendingFiles.length} ảnh
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chỉ gắn nhãn cho ảnh quan trọng. Ảnh bình thường có thể để trống.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  {visiblePendingFiles.length > 0 &&
                    visiblePendingFiles.every((item) =>
                      selectedPendingIds.includes(item.id),
                    )
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả'}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingView('all')}
                  className={`h-10 rounded-xl px-3 text-sm font-bold ${pendingView === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  Tất cả ({pendingFiles.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPendingView('untagged')}
                  className={`h-10 rounded-xl px-3 text-sm font-bold ${pendingView === 'untagged'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-600'
                    }`}
                >
                  Không gắn nhãn ({untaggedPendingCount})
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setIsUploadTagPickerOpen((value) => !value)
                    }
                    className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold ${selectedPendingIds.length > 0
                      ? 'bg-blue-600 text-white'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                      }`}
                    disabled={selectedPendingIds.length === 0}
                  >
                    <Tags className="h-4 w-4" />
                    Gán nhãn ({selectedPendingIds.length})
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>

                  {isUploadTagPickerOpen && selectedPendingIds.length > 0 && (
                    <div className="absolute left-0 top-12 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      <label className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={uploadTagSearch}
                          onChange={(event) =>
                            setUploadTagSearch(event.target.value)
                          }
                          placeholder="Tìm nhãn..."
                          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                        />
                      </label>

                      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                        {filteredUploadTagOptions.map((tag) => {
                          const allHaveTag =
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
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-50"
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

                              {allHaveTag && (
                                <Check className="h-4 w-4 text-blue-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUploadTagPickerOpen(false);
                          setIsTagCreatorOpen(true);
                        }}
                        className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 text-xs font-bold text-violet-600 hover:bg-violet-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tạo nhãn mới
                      </button>
                    </div>
                  )}
                </div>

                {selectedPendingIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPendingIds([])}
                    className="h-10 rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-slate-100"
                  >
                    Bỏ chọn
                  </button>
                )}

                <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <CalendarDays className="h-4 w-4" />
                  {uploadDate.split('-').reverse().join('/')}
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                Nhãn là tùy chọn: chỉ chọn nhóm ảnh cần nhận diện đặc biệt rồi gắn màu, độ dày hoặc thuộc tính.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              {visiblePendingFiles.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="mt-3 font-bold text-slate-700">
                    Không có ảnh nào đang để trống nhãn
                  </p>
                  <button
                    type="button"
                    onClick={() => setPendingView('all')}
                    className="mt-3 text-sm font-bold text-blue-600"
                  >
                    Xem lại toàn bộ ảnh
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                  {visiblePendingFiles.map((item) => {
                    const selected = selectedPendingIds.includes(item.id);
                    const itemTags = getPendingTags(item);

                    return (
                      <article
                        key={item.id}
                        onClick={() => togglePendingSelection(item.id)}
                        className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition ${selected
                          ? 'border-blue-500 ring-2 ring-blue-100'
                          : item.tagIds.length === 0
                            ? 'border-slate-200 shadow-sm'
                            : 'border-transparent shadow-sm hover:border-slate-300'
                          }`}
                      >
                        <div className="relative aspect-square bg-slate-100">
                          {item.file.name.toLowerCase().endsWith('.dng') ? (
                            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                              <FileImage className="h-8 w-8" />
                              <span className="mt-1 text-[10px] font-bold">DNG</span>
                            </div>
                          ) : (
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="h-full w-full object-cover"
                            />
                          )}

                          <span
                            className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border text-white ${selected
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-white/70 bg-slate-950/40'
                              }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removePendingFile(item.id);
                            }}
                            disabled={isUploading}
                            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="p-2">
                          <p className="truncate text-[10px] font-bold text-slate-600">
                            {item.file.name}
                          </p>

                          {itemTags.length === 0 ? (
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              Bình thường • không nhãn
                            </p>
                          ) : (
                            <div className="mt-1 flex items-center gap-1 overflow-hidden">
                              {itemTags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: tag.color_code }}
                                  title={tag.name}
                                />
                              ))}
                              <span className="truncate text-[9px] font-semibold text-slate-400">
                                {itemTags.map((tag) => tag.name).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {pendingFiles.length} ảnh • {untaggedPendingCount} ảnh không gắn nhãn
                </p>
                <p className="text-xs text-slate-500">
                  Ảnh không chọn nhãn vẫn được upload như vật liệu bình thường.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearPendingFiles}
                  disabled={isUploading}
                  className="h-11 rounded-xl px-4 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  Bỏ toàn bộ
                </button>

                <button
                  type="button"
                  onClick={() => void uploadPendingFilesToServer()}
                  disabled={
                    isUploading ||
                    pendingFiles.length === 0
                  }
                  className="flex h-11 min-w-44 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadProgress.current}/{uploadProgress.total}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload {pendingFiles.length} ảnh
                    </>
                  )}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* --- CỬA SỔ LIGHTBOX XEM ẢNH FULL SIZE --- */}
      {previewModal.isOpen && previewModal.img && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewModal({ isOpen: false, img: null })}
        >
          <button
            onClick={() => setPreviewModal({ isOpen: false, img: null })}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 rounded-full transition-all z-50"
            title="Đóng (Esc)"
          >
            <X className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>

          <div className="w-full h-full flex items-center justify-center p-2 sm:p-4" onClick={(e) => e.stopPropagation()}>
            {previewModal.img.file_path.toLowerCase().endsWith('.dng') ? (
              <div className="flex flex-col items-center justify-center text-slate-300 bg-slate-900 w-full max-w-lg aspect-square rounded-3xl border border-slate-700 shadow-2xl">
                <FileImage className="w-20 h-20 mb-4 text-slate-500" />
                <p className="text-2xl font-bold text-white mb-2">FILE RAW (.DNG)</p>
                <p className="text-sm text-slate-400 mb-8 text-center px-4">Trình duyệt web không hỗ trợ xem trước định dạng này trực tiếp.</p>
                <a
                  href={getValidImageUrl(previewModal.img!.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                  Tải file gốc về máy
                </a>
              </div>
            ) : (
              <img
                src={getValidImageUrl(previewModal.img.file_path)}
                alt={previewModal.img.filename}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}