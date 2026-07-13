'use client';

import {
  ChevronRight,
  Clock,
  Edit,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  API_BASE_URL,
  getToken,
  readApiError,
} from '@/lib/inventory-api';

interface Folder {
  id: number;
  name: string;
  uploader_email: string;
  created_at: string;
  image_count: number;
  size_mb: number;
  status: string;
}

interface FolderView {
  id: number;
  name: string;
  uploader: string;
  time: string;
  imageCount: number;
  size: string;
}

interface FolderGroup {
  date: string;
  isToday: boolean;
  folders: FolderView[];
}

export default function ImageFoldersPage() {
  const router = useRouter();
  const [groupedFolders, setGroupedFolders] = useState<FolderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const fetchFolders = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/folders`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const rawData: Folder[] = await response.json();
      const groups = new Map<string, FolderGroup>();
      const todayStr = new Date().toLocaleDateString('vi-VN');

      rawData.forEach((folder) => {
        const rawCreatedAt = folder.created_at || '';
        const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(rawCreatedAt);
        const dateObj = new Date(
          hasTimezone ? rawCreatedAt : `${rawCreatedAt}Z`,
        );
        const validDate = Number.isNaN(dateObj.getTime())
          ? new Date()
          : dateObj;
        const dateStr = validDate.toLocaleDateString('vi-VN');
        const timeStr = validDate.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const isToday = dateStr === todayStr;
        const label = isToday ? `Hôm nay (${dateStr})` : dateStr;

        if (!groups.has(label)) {
          groups.set(label, {
            date: label,
            isToday,
            folders: [],
          });
        }

        groups.get(label)?.folders.push({
          id: folder.id,
          name: folder.name,
          uploader: folder.uploader_email,
          time: timeStr,
          imageCount: folder.image_count,
          size: `${folder.size_mb} MB`,
        });
      });

      setGroupedFolders(Array.from(groups.values()));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tải danh sách lô hàng.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  const handleCreateFolder = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const name = newFolderName.trim();

    if (!name) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/inventory/folders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setNewFolderName('');
      setIsModalOpen(false);
      await fetchFolders();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tạo lô hàng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateFolder = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const name = editFolderName.trim();

    if (!editingFolder || !name) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/folders/${editingFolder.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ name }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setIsEditModalOpen(false);
      setEditingFolder(null);
      setEditFolderName('');
      await fetchFolders();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể đổi tên lô hàng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFolder = async (
    event: React.MouseEvent<HTMLButtonElement>,
    folderId: number,
    folderName: string,
  ) => {
    event.stopPropagation();

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa thư mục "${folderName}"? Toàn bộ ảnh bên trong sẽ bị mất.`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/folders/${folderId}`,
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

      await fetchFolders();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể xóa lô hàng.',
      );
    }
  };

  const openEditModal = (
    event: React.MouseEvent<HTMLButtonElement>,
    folder: FolderView,
  ) => {
    event.stopPropagation();
    setEditingFolder({ id: folder.id, name: folder.name });
    setEditFolderName(folder.name);
    setIsEditModalOpen(true);
  };

  return (
    <div className="relative mx-auto max-w-5xl animate-in space-y-6 pb-10 fade-in slide-in-from-bottom-4 duration-500 sm:space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-bold text-blue-600">Kho hàng</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Thư viện ảnh lô hàng
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Quản lý các thư mục hình ảnh do nhân viên tải lên.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage('');
            setIsModalOpen(true);
          }}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto sm:rounded-xl"
        >
          <UploadCloud className="mr-2 h-5 w-5" />
          Tạo thư mục mới
        </button>
      </section>

      {errorMessage && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => void fetchFolders()}
            className="min-h-11 rounded-xl bg-rose-600 px-4 font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
          <p>Đang tải dữ liệu thư viện...</p>
        </div>
      ) : groupedFolders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center">
          <FolderOpen className="mx-auto mb-4 h-14 w-14 text-slate-300" />
          <h2 className="text-lg font-bold text-slate-700">
            Kho lưu trữ trống
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
            Chưa có lô hàng nào được tạo. Hãy bấm “Tạo thư mục mới”.
          </p>
        </div>
      ) : (
        <div className="space-y-9 sm:space-y-12">
          {groupedFolders.map((group) => (
            <section key={group.date}>
              <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:gap-4">
                <div
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold sm:px-4 sm:text-sm ${group.isToday
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600'
                    }`}
                >
                  {group.date}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-3 sm:ml-4 sm:border-l-2 sm:border-dashed sm:border-slate-200 sm:pl-6">
                {group.folders.map((folder) => (
                  <article
                    key={folder.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/admin/inventory/${folder.id}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/admin/inventory/${folder.id}`);
                      }
                    }}
                    className="group relative cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 sm:p-5"
                  >
                    <div className="flex items-start gap-3 sm:gap-5">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 shadow-inner transition group-hover:bg-blue-500 group-hover:text-white sm:h-16 sm:w-16">
                        <FolderOpen className="h-7 w-7 sm:h-8 sm:w-8" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-bold text-slate-800 sm:text-lg">
                              {folder.name}
                            </h2>
                            <div className="mt-2 flex flex-col gap-1.5 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:text-sm">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <User className="h-4 w-4 shrink-0 text-slate-400" />
                                <span className="truncate">{folder.uploader}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-slate-400" />
                                {folder.time}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-bold text-slate-700 sm:text-base">
                              <ImageIcon className="h-4 w-4 text-blue-500 sm:h-5 sm:w-5" />
                              {folder.imageCount} ảnh
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-slate-400">
                              Tổng dung lượng: {folder.size}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:flex">
                            <button
                              type="button"
                              onClick={(event) => openEditModal(event, folder)}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              aria-label={`Đổi tên ${folder.name}`}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sm:hidden">Đổi tên</span>
                            </button>

                            <button
                              type="button"
                              onClick={(event) =>
                                void handleDeleteFolder(
                                  event,
                                  folder.id,
                                  folder.name,
                                )
                              }
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                              aria-label={`Xóa ${folder.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sm:hidden">Xóa</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:max-w-md sm:rounded-3xl sm:p-8 sm:zoom-in-95">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-800">
                Tạo thư mục lô hàng mới
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Tên lô hàng / Thư mục{' '}
                  <span className="text-rose-500">*</span>
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="VD: Nhập tên vật liệu..."
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="min-h-12 rounded-2xl font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newFolderName.trim()}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Xác nhận tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingFolder && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:max-w-md sm:rounded-3xl sm:p-8 sm:zoom-in-95">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-800">
                Đổi tên thư mục
              </h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateFolder}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Tên mới
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  value={editFolderName}
                  onChange={(event) => setEditFolderName(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                  className="min-h-12 rounded-2xl font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editFolderName.trim()}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
