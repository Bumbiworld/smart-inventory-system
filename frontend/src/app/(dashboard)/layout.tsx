// 'use client';

// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';
// import { LayoutDashboard, Users, Package, LogOut, Hexagon } from 'lucide-react';
// import { useEffect, useState } from 'react';

// export default function DashboardLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const pathname = usePathname();
//   const router = useRouter();

//   const [isAuthorized, setIsAuthorized] = useState(false);

//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     const role = localStorage.getItem('userRole');

//     if (!token || !role || role.toLowerCase() !== 'admin') {
//       router.push('/login');
//     } else {
//       setIsAuthorized(true);
//     }
//   }, [router]);

//   const handleLogout = () => {
//     localStorage.removeItem('userRole');
//     localStorage.removeItem('token');
//     router.push('/login');
//   };

//   if (!isAuthorized) {
//     return (
//       <div className="flex h-screen w-full items-center justify-center bg-slate-50">
//         <div className="flex flex-col items-center gap-4">
//           <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
//           <p className="text-slate-500 font-medium animate-pulse">Đang kiểm tra quyền truy cập...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">

//       {/* SIDEBAR NÂNG CẤP */}
//       <aside className="w-64 bg-[#0B1120] flex flex-col transition-all duration-300 border-r border-slate-800/50">

//         {/* Logo Area */}
//         <div className="h-20 flex items-center px-6 mt-2">
//           <div className="flex items-center gap-3">
//             <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
//               <Hexagon className="w-6 h-6 text-white fill-white/20" />
//             </div>
//             <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
//               KHO HÀNG
//             </h1>
//           </div>
//         </div>

//         {/* Navigation */}
//         <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
//           <Link 
//             href="/admin" 
//             className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group ${
//               pathname === '/admin' 
//                 ? 'bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)]' 
//                 : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
//             }`}
//           >
//             <LayoutDashboard className={`w-5 h-5 mr-3 transition-transform duration-200 ${pathname === '/admin' ? 'scale-110' : 'group-hover:scale-110'}`} />
//             <span className="font-medium">Bảng điều khiển</span>
//           </Link>

//           <Link 
//             href="/admin/users" 
//             className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group ${
//               pathname.includes('/users') 
//                 ? 'bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)]' 
//                 : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
//             }`}
//           >
//             <Users className={`w-5 h-5 mr-3 transition-transform duration-200 ${pathname.includes('/users') ? 'scale-110' : 'group-hover:scale-110'}`} />
//             <span className="font-medium">Quản lý Nhân sự</span>
//           </Link>

//           <Link 
//             href="/admin/inventory" 
//             className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group ${
//               pathname.includes('/inventory') 
//                 ? 'bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)]' 
//                 : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
//             }`}
//           >
//             <Package className={`w-5 h-5 mr-3 transition-transform duration-200 ${pathname.includes('/inventory') ? 'scale-110' : 'group-hover:scale-110'}`} />
//             <span className="font-medium">Quản lý Lô hàng</span>
//           </Link>
//         </nav>

//         {/* Logout Area */}
//         <div className="p-4 mb-4">
//           <button 
//             onClick={handleLogout} 
//             className="flex items-center w-full px-4 py-3.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl transition-all duration-200 group"
//           >
//             <LogOut className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
//             <span className="font-medium">Đăng xuất</span>
//           </button>
//         </div>
//       </aside>

//       {/* MAIN CONTENT AREA */}
//       <div className="flex-1 flex flex-col min-w-0">
//         <header className="h-20 bg-slate-50 flex items-center justify-between px-8 z-10">
//           <h2 className="text-lg font-bold text-slate-800">
//             {pathname === '/admin' && 'Trang chủ'}
//             {pathname.includes('/users') && 'Nhân sự'}
//             {pathname.includes('/inventory') && 'Kho hàng'}
//           </h2>
//           <div className="flex items-center gap-4">
//             <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-blue-600 font-bold border border-slate-200 ring-4 ring-slate-100">
//               A
//             </div>
//           </div>
//         </header>

//         <main className="flex-1 overflow-auto px-8 pb-8">
//           {children}
//         </main>
//       </div>
//     </div>
//   );
// }

export default function DashboardGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}

