'use client';

import {
  CheckCircle2,
  Clipboard,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface UserRecord {
  id: number;
  email: string;
  role: 'admin' | 'user' | string;
  is_first_login: boolean;
}

interface CreateUserResponse {
  message: string;
  email: string;
  default_password: string;
}

interface ApiError {
  detail?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState<number | null>(
    null,
  );

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createdAccount, setCreatedAccount] =
    useState<CreateUserResponse | null>(null);

  const getToken = () => {
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('Phiên đăng nhập không tồn tại.');
    }

    return token;
  };

  const readApiError = async (response: Response) => {
    const data: ApiError = await response.json().catch(() => ({}));
    return data.detail || `Yêu cầu thất bại (${response.status}).`;
  };

  const fetchUsers = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users`,
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

      const data: UserRecord[] = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tải danh sách nhân viên.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const employeeUsers = useMemo(
    () => users.filter((user) => user.role !== 'admin'),
    [users],
  );

  const activatedCount = useMemo(
    () =>
      employeeUsers.filter((user) => !user.is_first_login).length,
    [employeeUsers],
  );

  const pendingCount = employeeUsers.length - activatedCount;

  const handleCreateUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const email = newEmail.trim().toLowerCase();

    if (!email) {
      return;
    }

    setIsCreating(true);
    setErrorMessage('');
    setSuccessMessage('');
    setCreatedAccount(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ email }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data: CreateUserResponse = await response.json();

      setCreatedAccount(data);
      setSuccessMessage('Đã tạo tài khoản nhân viên thành công.');
      setNewEmail('');
      await fetchUsers(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tạo tài khoản nhân viên.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (user: UserRecord) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa tài khoản "${user.email}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/users/${user.id}`,
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

      setSuccessMessage(`Đã xóa tài khoản ${user.email}.`);
      await fetchUsers(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Không thể xóa tài khoản.',
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  const copyDefaultPassword = async () => {
    if (!createdAccount) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        createdAccount.default_password,
      );
      setSuccessMessage('Đã sao chép mật khẩu mặc định.');
    } catch {
      setErrorMessage('Không thể sao chép tự động.');
    }
  };

  const closeCreateModal = () => {
    if (isCreating) {
      return;
    }

    setIsCreateOpen(false);
    setNewEmail('');
    setCreatedAccount(null);
    setErrorMessage('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Quản lý nhân sự
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo tài khoản và theo dõi trạng thái kích hoạt của nhân viên.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => void fetchUsers(true)}
            disabled={isRefreshing}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 sm:px-4"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''
                }`}
            />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCreateOpen(true);
              setSuccessMessage('');
              setErrorMessage('');
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:px-4"
          >
            <UserPlus className="h-5 w-5" />
            Thêm nhân viên
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Tổng nhân viên
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {employeeUsers.length}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Đã kích hoạt
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">
                {activatedCount}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Chưa kích hoạt
              </p>
              <p className="mt-1 text-3xl font-bold text-amber-600">
                {pendingCount}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      {errorMessage && !isCreateOpen && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {errorMessage}
        </div>
      )}

      {successMessage && !isCreateOpen && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">
              Đang tải danh sách nhân viên...
            </p>
          </div>
        ) : employeeUsers.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <Users className="h-12 w-12 text-slate-300" />
            <h2 className="mt-4 font-bold text-slate-700">
              Chưa có nhân viên
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Bấm “Thêm nhân viên” để tạo tài khoản đầu tiên.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[1fr_180px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-400 md:grid">
              <span>Tài khoản</span>
              <span>Trạng thái</span>
              <span className="text-right">Thao tác</span>
            </div>

            <div className="divide-y divide-slate-100">
              {employeeUsers.map((user) => {
                const isActivated = !user.is_first_login;
                const isDeleting = deletingUserId === user.id;

                return (
                  <article
                    key={user.id}
                    className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_180px_130px] md:items-center md:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Mail className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">
                          {user.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Nhân viên · ID #{user.id}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${isActivated
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                          }`}
                      >
                        {isActivated ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {isActivated
                          ? 'Đã kích hoạt'
                          : 'Chưa kích hoạt'}
                      </span>

                      <p className="mt-1.5 text-xs text-slate-400">
                        {isActivated
                          ? 'Đã đổi mật khẩu lần đầu'
                          : 'Chưa đổi mật khẩu mặc định'}
                      </p>
                    </div>

                    <div className="flex justify-start md:justify-end">
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(user)}
                        disabled={isDeleting}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-100 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 md:w-auto md:border-transparent"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4">
          <div className="w-full rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Thêm nhân viên
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tài khoản mới sẽ nhận mật khẩu mặc định.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                {errorMessage}
              </div>
            )}

            {createdAccount ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-emerald-700">
                    <ShieldCheck className="h-5 w-5" />
                    Tạo tài khoản thành công
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Email
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {createdAccount.email}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Mật khẩu mặc định
                      </p>

                      <div className="mt-1 flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-3 py-2">
                        <code className="font-bold text-slate-800">
                          {createdAccount.default_password}
                        </code>

                        <button
                          type="button"
                          onClick={() => void copyDefaultPassword()}
                          className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-blue-600 hover:bg-blue-50"
                        >
                          <Clipboard className="h-4 w-4" />
                          Sao chép
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm leading-6 text-slate-500">
                  Tài khoản sẽ hiển thị “Chưa kích hoạt” cho đến khi
                  nhân viên đăng nhập và đổi mật khẩu lần đầu.
                </p>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="h-12 w-full rounded-2xl bg-blue-600 font-bold text-white"
                >
                  Hoàn tất
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Email nhân viên
                  </span>

                  <input
                    type="email"
                    required
                    autoFocus
                    value={newEmail}
                    onChange={(event) =>
                      setNewEmail(event.target.value)
                    }
                    placeholder="nhanvien@example.com"
                    className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                    disabled={isCreating}
                  />
                </label>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Mật khẩu mặc định hiện tại là{' '}
                  <strong className="text-slate-700">123456</strong>.
                  Nhân viên sẽ phải đổi mật khẩu trong lần đăng nhập đầu tiên.
                </div>

                <button
                  type="submit"
                  disabled={isCreating || !newEmail.trim()}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Tạo tài khoản
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}