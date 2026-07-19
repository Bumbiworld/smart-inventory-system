'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  API_BASE_URL,
  getToken,
  readApiError,
} from '@/lib/inventory-api';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Hammer,
  Image as ImageIcon,
  Loader2,
  PackageOpen,
  RefreshCw,
  UploadCloud,
  UserPlus,
  Users,
} from 'lucide-react';

interface DashboardStats {
  total_employees: number;
  total_folders: number;
  total_images: number;
  in_stock_items: number;
  processing_items: number;
  completed_items: number;
  warning_items: number;
  completion_rate: number;
}

interface DailyFlowItem {
  date: string;
  label: string;
  uploaded: number;
  in_stock: number;
  in_progress: number;
  completed: number;
  defective: number;
}

interface ActivityItem {
  id: string;
  type: 'folder_created' | 'image_uploaded';
  title: string;
  description: string;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  daily_flow: DailyFlowItem[];
  activities: ActivityItem[];
  last_updated: string;
}

const EMPTY_DASHBOARD: DashboardData = {
  stats: {
    total_employees: 0,
    total_folders: 0,
    total_images: 0,
    in_stock_items: 0,
    processing_items: 0,
    completed_items: 0,
    warning_items: 0,
    completion_rate: 0,
  },
  daily_flow: [],
  activities: [],
  last_updated: '',
};

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return 'Không rõ thời gian';
  }

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (diffSeconds < 60) {
    return 'Vừa xong';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  }

  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 🛠 ĐÃ NÂNG CẤP: Thêm props onClick và hiệu ứng tương tác (hover, active)
function StatCard({
  title,
  value,
  description,
  icon,
  onClick,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex min-h-36 flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 ${onClick
          ? 'cursor-pointer hover:-translate-y-1 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-50 active:scale-[0.98]'
          : ''
        }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>
          <h3 className="mt-1 text-3xl font-bold text-slate-800">
            {value}
          </h3>
        </div>
        {icon}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">
          {description}
        </p>
        {onClick && (
          <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<DashboardData>(EMPTY_DASHBOARD);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(
    async (
      showMainLoader = false,
      signal?: AbortSignal,
    ) => {
      if (showMainLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/dashboard-stats`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
            },
            cache: 'no-store',
            signal,
          },
        );

        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');

          router.replace('/login');
          return;
        }

        if (response.status === 403) {
          throw new Error(
            'Tài khoản hiện tại không có quyền xem dashboard admin.',
          );
        }

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const data: DashboardData = await response.json();

        if (!signal?.aborted) {
          setDashboard(data);
        }
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === 'AbortError'
        ) {
          return;
        }

        if (!signal?.aborted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Đã xảy ra lỗi không xác định.',
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchDashboard(true, controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchDashboard]);

  const maxUploaded = useMemo(() => {
    return Math.max(
      ...dashboard.daily_flow.map((item) => item.uploaded),
      1,
    );
  }, [dashboard.daily_flow]);

  const statusTotal =
    dashboard.stats.in_stock_items +
    dashboard.stats.processing_items +
    dashboard.stats.completed_items +
    dashboard.stats.warning_items;

  const getStatusPercentage = (value: number) => {
    if (statusTotal === 0) {
      return 0;
    }

    return Math.round((value / statusTotal) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-slate-400">
        <Loader2 className="mb-4 h-9 w-9 animate-spin text-blue-500" />
        <p className="font-medium">
          Đang tổng hợp dữ liệu hệ thống...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl animate-in space-y-6 pb-10 fade-in duration-500 sm:space-y-8 sm:pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-1 text-sm font-bold text-blue-600">
            Trang chủ
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Tổng quan hệ thống
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi lô vật liệu, ảnh nhập kho và tiến độ xử lý.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          {dashboard.last_updated && (
            <span
              suppressHydrationWarning
              className="col-span-2 text-xs font-medium text-slate-400 sm:col-span-1"
            >
              Cập nhật lúc{' '}
              {new Date(
                dashboard.last_updated,
              ).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}

          <button
            type="button"
            onClick={() => void fetchDashboard(false)}
            disabled={isRefreshing}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/inventory')}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto sm:px-4"
          >
            Quản lý lô
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
            <div>
              <p className="font-bold text-rose-700">
                Không thể tải dashboard
              </p>
              <p className="mt-0.5 text-sm text-rose-600">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchDashboard(false)}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 🛠 ĐÃ NÂNG CẤP: Truyền onClick vào các StatCard để tạo tính tương tác */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Nhân viên"
          value={dashboard.stats.total_employees}
          description="Quản lý tài khoản nhân viên"
          onClick={() => router.push('/admin/users')} // Điều hướng đến trang Users
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
              <Users className="h-5 w-5" />
            </div>
          }
        />

        <StatCard
          title="Lô vật liệu"
          value={dashboard.stats.total_folders}
          description={`${dashboard.stats.total_images} ảnh trong hệ thống`}
          onClick={() => router.push('/admin/inventory')} // Điều hướng đến trang Inventory
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition-colors group-hover:bg-violet-100">
              <FolderOpen className="h-5 w-5" />
            </div>
          }
        />

        <StatCard
          title="Đang chờ cắt"
          value={dashboard.stats.processing_items}
          description="Ảnh đang nằm trong working_zone"
          onClick={() => router.push('/admin/inventory')}
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
              <Hammer className="h-5 w-5" />
            </div>
          }
        />

        <StatCard
          title="Đã hoàn thành"
          value={dashboard.stats.completed_items}
          description={`Tỷ lệ hoàn tất hiện tại: ${dashboard.stats.completion_rate}%`}
          onClick={() => router.push('/admin/inventory')}
          icon={
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Ảnh nhập kho 7 ngày gần nhất
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Mỗi cột thể hiện ảnh được upload trong ngày và trạng thái hiện tại của chúng.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Trong kho
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Chờ cắt
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Hoàn thành
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Lỗi
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl">
            <div className="flex h-72 min-w-[34rem] items-end justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 pb-4 pt-8 sm:min-w-0 sm:gap-5 sm:px-7">
              {dashboard.daily_flow.map((day) => {
                const total = day.uploaded;
                const chartHeight =
                  total === 0
                    ? 3
                    : Math.max(12, Math.round((total / maxUploaded) * 100));

                const segmentHeight = (value: number) => {
                  if (total === 0) return '0%';
                  return `${(value / total) * 100}%`;
                };

                return (
                  <div
                    key={day.date}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end group cursor-pointer"
                  >
                    <span className="mb-2 text-xs font-bold text-slate-600 transition-transform group-hover:-translate-y-1">
                      {total}
                    </span>

                    <div className="flex h-[210px] w-full max-w-12 items-end transition-transform group-hover:scale-105">
                      <div
                        className="flex w-full flex-col-reverse overflow-hidden rounded-t-xl bg-slate-200 shadow-sm transition-all"
                        style={{ height: `${chartHeight}%` }}
                        title={`${day.label}: ${total} ảnh`}
                      >
                        <div className="bg-blue-500 hover:brightness-110" style={{ height: segmentHeight(day.in_stock) }} />
                        <div className="bg-amber-500 hover:brightness-110" style={{ height: segmentHeight(day.in_progress) }} />
                        <div className="bg-emerald-500 hover:brightness-110" style={{ height: segmentHeight(day.completed) }} />
                        <div className="bg-rose-500 hover:brightness-110" style={{ height: segmentHeight(day.defective) }} />
                      </div>
                    </div>

                    <span className="mt-3 whitespace-nowrap text-xs font-semibold text-slate-500">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">
              Trạng thái toàn kho
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Phân bố của {statusTotal} ảnh đang được quản lý.
            </p>
          </div>

          {/* 🛠 ĐÃ NÂNG CẤP: Làm các thanh tiến trình có thể click được */}
          <div className="space-y-1 flex-1">
            {[
              {
                label: 'Trong kho',
                value: dashboard.stats.in_stock_items,
                percentage: getStatusPercentage(dashboard.stats.in_stock_items),
                barClass: 'bg-blue-500',
                icon: <PackageOpen className="h-4 w-4 text-blue-600" />,
              },
              {
                label: 'Đang chờ cắt',
                value: dashboard.stats.processing_items,
                percentage: getStatusPercentage(dashboard.stats.processing_items),
                barClass: 'bg-amber-500',
                icon: <Clock3 className="h-4 w-4 text-amber-600" />,
              },
              {
                label: 'Đã hoàn thành',
                value: dashboard.stats.completed_items,
                percentage: getStatusPercentage(dashboard.stats.completed_items),
                barClass: 'bg-emerald-500',
                icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
              },
              {
                label: 'Ảnh lỗi',
                value: dashboard.stats.warning_items,
                percentage: getStatusPercentage(dashboard.stats.warning_items),
                barClass: 'bg-rose-500',
                icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
              },
            ].map((item) => (
              <div
                key={item.label}
                onClick={() => router.push('/admin/inventory')}
                className="group cursor-pointer rounded-2xl p-3 transition-colors hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    {item.value}{' '}
                    <span className="font-medium text-slate-400">
                      ({item.percentage}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${item.barClass}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => router.push('/admin/inventory')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
          >
            Xem kho vật liệu
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Hoạt động gần đây
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Các lô và ảnh được tạo gần nhất trong hệ thống.
            </p>
          </div>
        </div>

        {dashboard.activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-12 text-slate-400">
            <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium">
              Chưa có hoạt động nào.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {dashboard.activities.map((activity) => {
              const isFolder = activity.type === 'folder_created';

              return (
                <div
                  key={activity.id}
                  onClick={() => router.push('/admin/inventory')}
                  className="group flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-100 p-4 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${isFolder
                        ? 'bg-violet-50 text-violet-600 group-hover:bg-violet-500 group-hover:text-white'
                        : 'bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white'
                      }`}
                  >
                    {isFolder ? (
                      <UserPlus className="h-5 w-5" />
                    ) : (
                      <UploadCloud className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-700 group-hover:text-blue-600">
                      {activity.title}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-400">
                      {activity.description}
                    </p>
                  </div>

                  <span
                    suppressHydrationWarning
                    className="whitespace-nowrap text-xs font-medium text-slate-400 group-hover:text-slate-600"
                  >
                    {formatRelativeTime(activity.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}