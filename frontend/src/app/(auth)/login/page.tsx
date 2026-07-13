// 'use client';

// import { useState } from 'react';
// import { useRouter } from 'next/navigation';

// export default function LoginPage() {
//     const [email, setEmail] = useState('');
//     const [password, setPassword] = useState('');
//     const [isChangingPassword, setIsChangingPassword] = useState(false);
//     const [newPassword, setNewPassword] = useState('');
//     const [message, setMessage] = useState('');
//     const [isSuccess, setIsSuccess] = useState(false);

//     const router = useRouter();

//     const handleLogin = async(e: React.FormEvent) => {
//         e.preventDefault();
//         setMessage('');

//         try {
//             const res = await fetch('http://localhost:8000/api/login', {
//                 method: 'POST',
//                 headers: {'Content-Type': 'application/json'},
//                 body: JSON.stringify({ email, password })
//             });

//             const data = await res.json();
//             if (!res.ok) {
//                 setIsSuccess(false);
//                 setMessage(data.detail || 'Đăng nhập thất bại');
//                 return;
//             }

//             if (data.require_change_password) {
//                 setIsChangingPassword(true);
//                 setIsSuccess(false);
//                 setMessage('Đây là lần đăng nhập đầu tiên, vui lòng đổi mật khẩu.');
//             }
//             else {
//                 setIsSuccess(true);
//                 setMessage('Đăng nhập thành công!');
//                 localStorage.setItem('userRole', data.role);
//                 localStorage.setItem('token', data.token);

//                 if (data.role == 'admin') {
//                   router.push('/admin');
//                 } else {
//                   router.push('/user');
//                 }
//             }
//         } catch (error) {
//             setIsSuccess(false);
//             setMessage('Đã xảy ra lỗi khi đăng nhập');
//         }
//     };

//     const handleChangePassword = async(e: React.FormEvent) => {
//         e.preventDefault();
//         setMessage('');

//         try {
//             const res = await fetch('http://localhost:8000/api/change-password', {
//                 method: 'POST',
//                 headers : {'Content-Type': 'application/json'},
//                 body: JSON.stringify({ 
//                     email,
//                     old_password: password,
//                     new_password: newPassword
//                 }),
//             });

//             const data = await res.json();

//             if (!res.ok) {
//                 setIsSuccess(false);
//                 setMessage(data.detail || 'Đổi mật khẩu thất bại');
//                 return;
//             }

//             setIsSuccess(true);
//             setMessage('Đổi mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.');
//             setIsChangingPassword(false);
//             setPassword('');
//             setNewPassword('');
//         } catch (error) {
//             setIsSuccess(false);
//             setMessage('Đã xảy ra lỗi khi đổi mật khẩu');
//         }
//     };

//     return (
//     <div className="min-h-screen flex items-center justify-center bg-slate-50">
//       <div className="bg-white p-8 rounded-xl shadow-lg w-96 border border-slate-100">
//         <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">
//           {isChangingPassword ? 'Đặt Mật Khẩu' : 'Đăng Nhập'}
//         </h2>
        
//         {message && (
//           <div className={`p-3 mb-6 rounded-md text-sm font-medium ${isSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
//             {message}
//           </div>
//         )}

//         {!isChangingPassword ? (
//           <form onSubmit={handleLogin}>
//             <div className="mb-4">
//               <label className="block text-slate-700 text-sm font-semibold mb-2">Email</label>
//               <input 
//                 type="email" 
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
//                 placeholder="admin@example.com"
//                 required
//               />
//             </div>
//             <div className="mb-6">
//               <label className="block text-slate-700 text-sm font-semibold mb-2">Mật khẩu</label>
//               <input 
//                 type="password" 
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
//                 placeholder="••••••••"
//                 required
//               />
//             </div>
//             <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
//               Đăng Nhập
//             </button>
//           </form>
//         ) : (
//           <form onSubmit={handleChangePassword}>
//             <div className="mb-4">
//               <label className="block text-slate-700 text-sm font-semibold mb-2">Tài khoản</label>
//               <input 
//                 type="email" 
//                 value={email} 
//                 disabled 
//                 className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed" 
//               />
//             </div>
//             <div className="mb-6">
//               <label className="block text-slate-700 text-sm font-semibold mb-2">Mật khẩu mới</label>
//               <input 
//                 type="password" 
//                 value={newPassword}
//                 onChange={(e) => setNewPassword(e.target.value)}
//                 className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-slate-900"
//                 placeholder="Nhập mật khẩu mới..."
//                 required
//               />
//             </div>
//             <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
//               Xác Nhận Đổi Mật Khẩu
//             </button>
//           </form>
//         )}
//       </div>
//     </div>
//   );
// }

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface LoginResponse {
  message?: string;
  require_change_password?: boolean;
  email?: string;
  role?: 'admin' | 'user';
  token?: string;
  detail?: string;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isChangingPassword, setIsChangingPassword] =
    useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearStoredSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
  };

  const handleLogin = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setMessage('');
    setIsSuccess(false);
    setIsSubmitting(true);
    clearStoredSession();

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data: LoginResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setMessage(data.detail || 'Đăng nhập thất bại.');
        return;
      }

      if (data.require_change_password) {
        setIsChangingPassword(true);
        setMessage(
          'Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu mới.',
        );
        return;
      }

      if (!data.token || !data.role) {
        setMessage('Phản hồi đăng nhập không đầy đủ.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.role);

      setIsSuccess(true);
      setMessage('Đăng nhập thành công.');

      if (data.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/user/inventory');
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setMessage('');
    setIsSuccess(false);

    if (newPassword.length < 6) {
      setMessage('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            old_password: password,
            new_password: newPassword,
          }),
        },
      );

      const data: LoginResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setMessage(data.detail || 'Đổi mật khẩu thất bại.');
        return;
      }

      clearStoredSession();

      setIsSuccess(true);
      setMessage(
        'Đổi mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      );

      setIsChangingPassword(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Change password error:', error);
      setMessage(
        'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setMessage('');
    setIsSuccess(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            {isChangingPassword ? (
              <ShieldCheck className="h-7 w-7" />
            ) : (
              <LockKeyhole className="h-7 w-7" />
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {isChangingPassword
              ? 'Đặt mật khẩu mới'
              : 'Đăng nhập hệ thống'}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {isChangingPassword
              ? 'Tài khoản đăng nhập lần đầu cần đổi mật khẩu.'
              : 'Đăng nhập để truy cập hệ thống quản lý kho.'}
          </p>
        </div>

        {message && (
          <div
            className={`mb-5 rounded-2xl border p-3 text-sm font-medium ${
              isSuccess
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {message}
          </div>
        )}

        {!isChangingPassword ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Email
              </span>

              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="h-12 w-full rounded-2xl border border-slate-300 pl-12 pr-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  placeholder="nhanvien@example.com"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Mật khẩu
              </span>

              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  className="h-12 w-full rounded-2xl border border-slate-300 pl-12 pr-12 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  placeholder="Nhập mật khẩu"
                  required
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={
                    showPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 px-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleChangePassword}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Tài khoản
              </span>

              <input
                type="email"
                value={email}
                disabled
                className="h-12 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 text-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Mật khẩu mới
              </span>

              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) =>
                    setNewPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 pr-12 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  placeholder="Ít nhất 6 ký tự"
                  minLength={6}
                  required
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowNewPassword((value) => !value)
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={
                    showNewPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Xác nhận mật khẩu mới
              </span>

              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                placeholder="Nhập lại mật khẩu mới"
                minLength={6}
                required
                disabled={isSubmitting}
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Xác nhận đổi mật khẩu'
              )}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              disabled={isSubmitting}
              className="h-11 w-full rounded-2xl font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Quay lại đăng nhập
            </button>
          </form>
        )}
      </section>
    </main>
  );
}