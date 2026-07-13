'use client';

import {
  Boxes,
  Loader2,
  LogOut,
  Package,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage
      .getItem('userRole')
      ?.toLowerCase();

    if (!token || !role) {
      router.replace('/login');
      return;
    }

    if (role === 'admin') {
      router.replace('/admin');
      return;
    }

    if (role !== 'user') {
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      router.replace('/login');
      return;
    }

    setIsAuthorized(true);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    router.replace('/login');
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

          <p className="text-sm font-medium text-slate-500">
            Đang kiểm tra tài khoản...
          </p>
        </div>
      </div>
    );
  }

  const inventoryActive =
    pathname.startsWith('/user/inventory');

  const accountActive =
    pathname.startsWith('/user/account');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link
            href="/user/inventory"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Boxes className="h-5 w-5" />
            </div>

            <div>
              <p className="font-bold leading-tight text-slate-800">
                Kho vật liệu
              </p>

              <p className="text-xs text-slate-400">
                Khu vực nhân viên
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-2 md:flex">
              <Link
                href="/user/inventory"
                className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                  inventoryActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Package className="h-4 w-4" />
                Kho hàng
              </Link>

              <Link
                href="/user/account"
                className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                  accountActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <UserRound className="h-4 w-4" />
                Tài khoản
              </Link>
            </nav>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Đăng xuất"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 pb-24 md:px-6 md:py-8 md:pb-10">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
        <div className="grid h-16 grid-cols-2">
          <Link
            href="/user/inventory"
            className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
              inventoryActive
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          >
            <Package className="h-5 w-5" />
            Kho hàng
          </Link>

          <Link
            href="/user/account"
            className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${
              accountActive
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          >
            <UserRound className="h-5 w-5" />
            Tài khoản
          </Link>
        </div>
      </nav>
    </div>
  );
}