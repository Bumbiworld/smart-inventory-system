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
  Scissors
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
  in_progress_count?: number;
  cover_image?: string;
}

interface FolderView {
  id: number;
  name: string;
  uploader: string;
  time: string;
  imageCount: number;
  size: string;
  inProgressCount: number;
  coverImage?: string;
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

  // States lưu trữ ảnh bìa
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{
    id: number;
    name: string;
    coverImage?: string;
  } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState('');

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, id: number | null, name: string }>({ isOpen: false, id: null, name: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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
          inProgressCount: folder.in_progress_count || 0,
          coverImage: folder.cover_image,
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

  const handleCloseCreateModal = () => {
    setIsModalOpen(false);
    setNewFolderName('');
    setCoverFile(null);
    setCoverPreview('');
    setErrorMessage('');
  };

  const handleCloseEditModal = () => {
    if (editCoverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(editCoverPreview);
    }

    setIsEditModalOpen(false);
    setEditingFolder(null);
    setEditFolderName('');
    setEditCoverFile(null);
    setEditCoverPreview('');
    setErrorMessage('');
  };

  const handleCreateFolder = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const name = newFolderName.trim();

    if (!name) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Tạo thư mục mới
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

      if (!response.ok) throw new Error(await readApiError(response));

      const newFolder = await response.json();

      // 2. GỌI API UPLOAD KÈM THÔNG BÁO LỖI
      if (coverFile) {
        if (!newFolder.id && !newFolder.data?.id) {
          alert("Lỗi: Backend không trả về ID của thư mục! Data nhận được: " + JSON.stringify(newFolder));
        } else {
          const folderId = newFolder.id || newFolder.data?.id;

          const formData = new FormData();
          formData.append("file", coverFile);

          const uploadResponse = await fetch(
            `${API_BASE_URL}/api/admin/folders/${folderId}/cover`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${getToken()}`,
              },
              body: formData,
            }
          );

          if (!uploadResponse.ok) {
            const errDetails = await uploadResponse.text();
            alert(`Lỗi upload ảnh (Mã lỗi: ${uploadResponse.status}): ${errDetails}`);
          }
        }
      }

      handleCloseCreateModal();
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

    if (!editingFolder || !name) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Cập nhật tên lô.
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

      // 2. Nếu admin chọn ảnh mới thì thêm/thay ảnh bìa.
      // Folder cũ chưa có cover_image vẫn dùng được endpoint này.
      if (editCoverFile) {
        const formData = new FormData();
        formData.append('file', editCoverFile);

        const coverResponse = await fetch(
          `${API_BASE_URL}/api/admin/folders/${editingFolder.id}/cover`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
            body: formData,
          },
        );

        if (!coverResponse.ok) {
          throw new Error(await readApiError(coverResponse));
        }
      }

      handleCloseEditModal();
      await fetchFolders();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật lô hàng.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (
    event: React.MouseEvent<HTMLButtonElement>,
    folder: FolderView,
  ) => {
    event.stopPropagation();

    if (editCoverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(editCoverPreview);
    }

    const currentCoverUrl = folder.coverImage
      ? (
        folder.coverImage.startsWith('http')
          ? folder.coverImage
          : `${API_BASE_URL}${folder.coverImage}`
      )
      : '';

    setEditingFolder({
      id: folder.id,
      name: folder.name,
      coverImage: folder.coverImage,
    });
    setEditFolderName(folder.name);
    setEditCoverFile(null);
    setEditCoverPreview(currentCoverUrl);
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deletePassword !== '123456') {
      setDeleteError('Mã xác minh không chính xác!');
      return;
    }

    if (!deleteModal.id) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/folders/${deleteModal.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        },
      );

      if (!response.ok) throw new Error(await readApiError(response));

      setDeleteModal({ isOpen: false, id: null, name: '' });
      setDeletePassword('');
      await fetchFolders();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Không thể xóa lô hàng.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-7xl animate-in space-y-6 pb-10 fade-in slide-in-from-bottom-4 duration-500 sm:space-y-8">
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

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 sm:ml-4 sm:border-l-2 sm:border-dashed sm:border-slate-200 sm:pl-6">
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
                    className="group flex flex-col justify-between relative cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <div className="flex items-start gap-4 mb-4">

                      {/* KHU VỰC ẢNH BÌA */}
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 shadow-inner overflow-hidden transition group-hover:bg-blue-600 group-hover:text-white">
                        {folder.coverImage ? (
                          <img
                            src={folder.coverImage.startsWith('http') ? folder.coverImage : `${API_BASE_URL}${folder.coverImage}`}
                            alt={folder.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FolderOpen className="h-7 w-7" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="truncate text-base font-bold text-slate-800 sm:text-lg" title={folder.name}>
                            {folder.name}
                          </h2>
                          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500" />
                        </div>

                        <div className="mt-2 flex flex-col gap-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5 truncate" title={folder.uploader}>
                            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{folder.uploader}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {folder.time}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto border-t border-slate-100 pt-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                            {folder.imageCount} ảnh
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                            Dung lượng: {folder.size}
                          </p>
                        </div>

                        {folder.inProgressCount > 0 && (
                          <div
                            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 shadow-sm"
                            title={`${folder.inProgressCount} tấm vật liệu đang chờ được cắt`}
                          >
                            <Scissors className="h-4 w-4" />
                            <span className="text-xs font-bold">{folder.inProgressCount}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <button
                          type="button"
                          onClick={(event) => openEditModal(event, folder)}
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Edit className="h-4 w-4" /> Chỉnh sửa
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteModal({ isOpen: true, id: folder.id, name: folder.name });
                            setDeletePassword('');
                            setDeleteError('');
                          }}
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" /> Xóa
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* MODAL TẠO MỚI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:max-w-md sm:rounded-3xl sm:p-8 sm:zoom-in-95">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-800">Tạo thư mục lô hàng mới</h2>
              <button onClick={handleCloseCreateModal} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Tên lô hàng / Thư mục <span className="text-rose-500">*</span></span>
                <input type="text" required autoFocus placeholder="VD: Nhập tên vật liệu..." className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} disabled={isSubmitting} />
              </label>

              {/* UPLOAD ẢNH BÌA */}
              <div className="mt-4">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Ảnh bìa thư mục (Tùy chọn)</span>
                <div className="flex items-center gap-4">
                  {coverPreview ? (
                    <div className="relative h-16 w-16 shrink-0 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 border border-slate-200 border-dashed">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCoverFile(file);
                        setCoverPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:py-2.5 file:px-4 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" onClick={handleCloseCreateModal} disabled={isSubmitting} className="min-h-12 rounded-2xl font-semibold text-slate-600 transition hover:bg-slate-100">Hủy bỏ</button>
                <button type="submit" disabled={isSubmitting || !newFolderName.trim()} className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Xác nhận tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA TÊN VÀ ẢNH BÌA */}
      {isEditModalOpen && editingFolder && (
        <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:max-w-md sm:rounded-3xl sm:p-8 sm:zoom-in-95">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Chỉnh sửa lô hàng
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Có thể đổi tên hoặc thêm/thay ảnh bìa.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSubmitting}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 disabled:opacity-50"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateFolder}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Tên lô hàng
                </span>

                <input
                  type="text"
                  required
                  autoFocus
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  value={editFolderName}
                  onChange={(event) => setEditFolderName(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>

              <div className="mt-5">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Ảnh bìa
                </span>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                      {editCoverPreview ? (
                        <img
                          src={editCoverPreview}
                          alt={`Ảnh bìa ${editingFolder.name}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-7 w-7" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
                        {editCoverPreview ? 'Chọn ảnh bìa khác' : 'Thêm ảnh bìa'}

                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isSubmitting}
                          onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (!file) {
                              return;
                            }

                            if (editCoverPreview.startsWith('blob:')) {
                              URL.revokeObjectURL(editCoverPreview);
                            }

                            setEditCoverFile(file);
                            setEditCoverPreview(URL.createObjectURL(file));
                            event.target.value = '';
                          }}
                        />
                      </label>

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Folder cũ chưa có ảnh bìa vẫn có thể thêm tại đây.
                      </p>

                      {editCoverFile && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            if (editCoverPreview.startsWith('blob:')) {
                              URL.revokeObjectURL(editCoverPreview);
                            }

                            const originalCover = editingFolder.coverImage
                              ? (
                                editingFolder.coverImage.startsWith('http')
                                  ? editingFolder.coverImage
                                  : `${API_BASE_URL}${editingFolder.coverImage}`
                              )
                              : '';

                            setEditCoverFile(null);
                            setEditCoverPreview(originalCover);
                          }}
                          className="mt-1 text-xs font-bold text-rose-600 hover:underline disabled:opacity-50"
                        >
                          Bỏ ảnh vừa chọn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={isSubmitting}
                  className="min-h-12 rounded-2xl font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !editFolderName.trim()}
                  className="flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
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

      {/* MODAL XÓA BẰNG MẬT KHẨU */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Cảnh báo xóa dữ liệu!</h3>
            <p className="text-center text-slate-500 text-sm mb-6">
              Xóa lô hàng <span className="font-bold text-rose-600">"{deleteModal.name}"</span> sẽ xóa toàn bộ ảnh bên trong và <strong>không thể hoàn tác</strong>.
            </p>
            <div className="space-y-3 mb-6">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center">Nhập mã xác minh (123456):</label>
              <input type="password" value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleConfirmDelete()} className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-all font-mono text-center tracking-widest text-lg ${deleteError ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-500' : 'border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white'}`} placeholder="••••••" autoFocus disabled={isDeleting} />
              {deleteError && <p className="text-sm font-bold text-rose-500 text-center">{deleteError}</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setDeleteModal({ isOpen: false, id: null, name: '' }); setDeletePassword(''); setDeleteError(''); }} disabled={isDeleting} className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50">Hủy bỏ</button>
              <button type="button" onClick={handleConfirmDelete} disabled={isDeleting || !deletePassword} className="flex flex-1 items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all disabled:opacity-70">
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xác nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}