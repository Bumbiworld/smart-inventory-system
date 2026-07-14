'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Hexagon,
  LayoutDashboard,
  LogOut,
  Package,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const SIDEBAR_STORAGE_KEY = 'adminSidebarCollapsed';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole')?.toLowerCase();

    if (!token || !role) {
      router.replace('/login');
      return;
    }

    if (role !== 'admin') {
      router.replace('/user/inventory');
      return;
    }

    setIsSidebarCollapsed(
      localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
    );
    setIsAuthorized(true);
  }, [router]);



  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('token');
    router.replace('/login');
  };

  const toggleDesktopSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="animate-pulse font-medium text-slate-500">
            Đang kiểm tra quyền truy cập...
          </p>
        </div>
      </div>
    );
  }

  const isUsersPage = pathname.startsWith('/admin/users');
  const isInventoryPage = pathname.startsWith('/admin/inventory');

  const pageTitle =
    pathname === '/admin'
      ? 'Bảng điều khiển'
      : isInventoryPage
        ? 'Kho hàng'
        : isUsersPage
          ? 'Nhân sự'
          : 'Quản trị';

  const navItems = [
    {
      href: '/admin',
      label: 'Bảng điều khiển',
      mobileLabel: 'Tổng quan',
      icon: LayoutDashboard,
      active: pathname === '/admin',
    },
    {
      href: '/admin/inventory',
      label: 'Quản lý Lô hàng',
      mobileLabel: 'Kho hàng',
      icon: Package,
      active: isInventoryPage,
    },
    {
      href: '/admin/users',
      label: 'Quản lý Nhân sự',
      mobileLabel: 'Nhân sự',
      icon: Users,
      active: isUsersPage,
    },
  ];

  const renderSidebarContent = (
    collapsed: boolean,
  ) => (
    <>
      <div
        className={`flex h-20 shrink-0 items-center border-b border-slate-800/70 ${collapsed ? 'justify-center px-3' : 'justify-between px-5'
          }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 shadow-lg shadow-blue-500/20">
            <Hexagon className="h-6 w-6 fill-white/20 text-white" />
          </div>

          {!collapsed && (
            <h1 className="truncate bg-gradient-to-r from-white to-slate-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
              KHO HÀNG
            </h1>
          )}
        </div>

      </div>

      <nav
        className={`flex-1 space-y-2 overflow-y-auto py-5 ${collapsed ? 'px-2' : 'px-4'
          }`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group flex min-h-12 items-center rounded-xl py-3 transition ${collapsed ? 'justify-center px-2' : 'px-4'
                } ${item.active
                  ? 'bg-blue-600/15 text-blue-300 ring-1 ring-blue-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
            >
              <Icon
                className={`h-5 w-5 shrink-0 ${collapsed ? '' : 'mr-3'}`}
              />
              {!collapsed && (
                <span className="truncate font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div
        className={`border-t border-slate-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3 ${collapsed ? 'px-2' : 'px-4'
          }`}
      >
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={`flex min-h-12 w-full items-center rounded-xl py-3 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400 ${collapsed ? 'justify-center px-2' : 'px-4'
            }`}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && <span className="font-medium">Đăng xuất</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-slate-50 font-sans text-slate-900 lg:flex lg:h-screen lg:overflow-hidden">
      <aside
        className={`relative hidden shrink-0 flex-col border-r border-slate-800/50 bg-[#0B1120] transition-[width] duration-300 lg:flex ${isSidebarCollapsed ? 'w-[76px]' : 'w-64'
          }`}
      >
        {renderSidebarContent(isSidebarCollapsed)}

        <button
          type="button"
          onClick={toggleDesktopSidebar}
          className="absolute -right-3 top-24 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:text-blue-600"
          aria-label={
            isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'
          }
          title={
            isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'
          }
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0">

        <header className="hidden h-20 shrink-0 items-center justify-between bg-slate-50 px-8 lg:flex">
          <h2 className="text-lg font-bold text-slate-800">{pageTitle}</h2>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-blue-600 shadow-sm ring-4 ring-slate-100">
            A
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 pb-28 pt-3 sm:px-5 sm:pt-5 lg:overflow-y-auto lg:px-8 lg:pb-8 lg:pt-0">
          {children}
        </main>
      </div>


      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-slate-200 bg-white/95 px-2 pt-1 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden pb-[calc(0.35rem+env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold transition ${item.active
                ? 'text-blue-600'
                : 'text-slate-500 active:bg-slate-100'
                }`}
            >
              <Icon
                className={`h-5 w-5 ${item.active ? 'stroke-[2.5]' : ''}`}
              />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}