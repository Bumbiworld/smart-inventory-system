'use client';

import {
  ChevronRight,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  API_BASE_URL,
  FolderRecord,
  getToken,
  readApiError,
} from '@/lib/inventory-api';

export default function UserInventoryPage() {
  const router = useRouter();

  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] =
    useState(false);

  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

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

      const data: FolderRecord[] =
        await response.json();

      setFolders(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tải danh sách lô.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  const filteredFolders = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLocaleLowerCase('vi');

    return folders
      .filter((folder) => {
        if (!keyword) {
          return true;
        }

        return folder.name
          .toLocaleLowerCase('vi')
          .includes(keyword);
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      );
  }, [folders, searchText]);

  const handleCreateFolder = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const name = folderName.trim();

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
        throw new Error(
          await readApiError(response),
        );
      }

      const createdFolder: FolderRecord =
        await response.json();

      setFolderName('');
      setIsCreateOpen(false);

      router.push(
        `/user/inventory/${createdFolder.id}`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tạo lô mới.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            Chọn lô hàng
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Chọn lô cần upload hoặc xử lý ảnh.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage('');
            setIsCreateOpen(true);
          }}
          className="hidden h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 md:flex"
        >
          <Plus className="h-5 w-5" />
          Tạo lô mới
        </button>
      </header>

      <label className="relative block max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

        <input
          type="search"
          value={searchText}
          onChange={(event) =>
            setSearchText(event.target.value)
          }
          placeholder="Tìm tên lô..."
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
      </label>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

          <p className="text-sm font-medium text-slate-500">
            Đang tải danh sách lô...
          </p>
        </div>
      ) : filteredFolders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-slate-300" />

          <h2 className="mt-4 font-bold text-slate-700">
            Không tìm thấy lô hàng
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Tạo lô mới hoặc thử từ khóa khác.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFolders.map((folder) => {
            const createdAt = new Date(
              folder.created_at.endsWith('Z')
                ? folder.created_at
                : `${folder.created_at}Z`,
            );

            return (
              <button
                key={folder.id}
                type="button"
                onClick={() =>
                  router.push(
                    `/user/inventory/${folder.id}`,
                  )
                }
                className="group flex min-h-28 w-full items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <FolderOpen className="h-7 w-7" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold text-slate-900">
                    {folder.name}
                  </h2>

                  <p className="mt-1 text-sm font-semibold text-blue-600">
                    {folder.image_count ?? 0} ảnh
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Tạo ngày{' '}
                    {Number.isNaN(createdAt.getTime())
                      ? folder.created_at
                      : createdAt.toLocaleDateString(
                        'vi-VN',
                      )}
                  </p>
                </div>

                <ChevronRight className="h-6 w-6 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
              </button>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-4 bottom-20 z-30 md:hidden">
        <button
          type="button"
          onClick={() => {
            setErrorMessage('');
            setIsCreateOpen(true);
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white shadow-xl shadow-blue-200"
        >
          <Plus className="h-5 w-5" />
          Tạo lô mới
        </button>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4">
          <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Tạo lô mới
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Nhập tên ngắn và dễ nhận biết.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsCreateOpen(false);
                    setFolderName('');
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Tên lô
                </span>

                <input
                  autoFocus
                  required
                  value={folderName}
                  onChange={(event) =>
                    setFolderName(event.target.value)
                  }
                  placeholder="Ví dụ: Ván MDF đen"
                  className="h-14 w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  disabled={isSubmitting}
                />
              </label>

              <button
                type="submit"
                disabled={
                  isSubmitting || !folderName.trim()
                }
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Tạo và mở lô
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}