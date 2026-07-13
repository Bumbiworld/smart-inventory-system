// 'use client'; 

// import { useState, useEffect } from 'react';
// import { Plus, Trash2, UserPlus, X} from 'lucide-react';

// export default function UsersPage() {
//     const [users, setUsers] = useState([]);
//     const [isModalOpen, setIsModalOpen] = useState(false);
//     const [newEmail, setNewEmail] = useState('');

//     const fetchUsers = async () => {
//       try {
//         const token = localStorage.getItem('token');

//         if (!token) {
//           console.error("Không tìm thấy token. Vui lòng đăng nhập lại!");
//           return;
//         }

//         const res = await fetch('http://localhost:8000/api/admin/users', {
//           headers: {
//             'Authorization': `Bearer ${token}`
//           }
//         });

//         if (res.ok) {
//           const data = await res.json();

//           const userOnly = data.filter((user: any) => user.role !== 'admin');
//           setUsers(userOnly);
//         }
//       } catch (error) {
//         console.error("Lỗi khi tải danh sách: ",error);
//       }
//     }

//     useEffect(() => {
//       fetchUsers();
//     }, []);

//     const handleAddUser = async () => {
//       if (!newEmail) {
//         alert('Vui lòng nhập email!')
//         return;
//       }

//       try {
//         const token = localStorage.getItem('token');
//         const res = await fetch('http://localhost:8000/api/admin/create-user', {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             'Authorization': `Bearer ${token}`
//           },
//           body: JSON.stringify({ email: newEmail }),
//         });

//         const data = await res.json();
//         if (res.ok) {
//           alert("Thêm thành viên thành công! Mật khẩu mặc định là 123456");
//           setIsModalOpen(false);
//           setNewEmail('');
//           fetchUsers();
//         } else {
//           alert("Lỗi: " + (data.detail || "Không thể tạo tài khoản"));
//         }
//       } catch(error) {
//         console.error("Lỗi kết nối:", error);
//         alert("Không thể kết nối đến máy chủ Backend!");
//       }
//     };

//     const handleDeleteUser = async (userId: number, email: string) => {
//       if (!window.confirm(`Có chắc chắn muốn xóa tài khoản ${email} không? Hành động này không thể hoàn tác!`)) {
//         return; 
//       }

//       try {
//         const token = localStorage.getItem('token');
//         const res = await fetch(`http://localhost:8000/api/admin/users/${userId}`,{
//           method: 'DELETE',
//           headers: {'Authorization': `Bearer ${token}`}
//         });

//         if (res.ok) {
//           alert("Đã xóa nhân viên thành công!");
//           fetchUsers();
//         } else {
//           const data = await res.json();
//           alert("Lỗi: " + (data.detail || "Không thể xóa tài khoản"));
//         }
//       } catch(error) {
//         console.error("Lỗi khi xóa: ", error);
//         alert("Không thể kết nối đến máy chủ Backend!");
//       }
//     }

//     return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <h3 className="text-xl font-bold text-slate-800">Danh sách nhân viên</h3>
//         <button 
//           onClick={() => setIsModalOpen(true)}
//           className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
//         >
//           <UserPlus className="w-4 h-4 mr-2" />
//           Thêm nhân viên mới
//         </button>
//       </div>

//       {isModalOpen && (
//         <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
//           <div className="bg-white p-6 rounded-xl w-96 shadow-xl border border-slate-200">
//             <div className="flex justify-between items-center mb-4">
//               <h4 className="font-bold text-lg text-slate-800">Thêm nhân viên</h4>
//               <button 
//                 onClick={() => setIsModalOpen(false)}
//                 className="text-slate-400 hover:text-slate-700 transition-colors"
//               >
//                 <X className="w-5 h-5" />
//               </button>
//             </div>
//             <div className="mb-4">
//               <label className="block text-slate-700 text-sm font-semibold mb-2">Email nhân viên</label>
//               <input 
//                 type="email" 
//                 placeholder="nhanvien@example.com"
//                 className="w-full p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
//                 value={newEmail}
//                 onChange={(e) => setNewEmail(e.target.value)}
//               />
//             </div>
//             <button 
//               onClick={handleAddUser}
//               className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
//             >
//               Xác nhận thêm
//             </button>
//           </div>
//         </div>
//       )}

//       <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
//         <table className="w-full text-left">
//           <thead className="bg-slate-50 border-b border-slate-200">
//             <tr>
//               <th className="px-6 py-4 font-semibold text-slate-700">Email</th>
//               <th className="px-6 py-4 font-semibold text-slate-700">Vai trò</th>
//               <th className="px-6 py-4 font-semibold text-slate-700">Trạng thái</th>
//               <th className="px-6 py-4 font-semibold text-slate-700 text-right">Thao tác</th>
//             </tr>
//           </thead>
//           <tbody className="divide-y divide-slate-100">
//             {/* DUYỆT DANH SÁCH THẬT TỪ STATE */}
//             {users.map((user: any) => (
//               <tr key={user.id} className="hover:bg-slate-50 transition-colors">
//                 <td className="px-6 py-4 text-slate-600 font-medium">{user.email}</td>
//                 <td className="px-6 py-4 text-slate-600">
//                   <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold">
//                     {user.role}
//                   </span>
//                 </td>
//                 <td className="px-6 py-4 text-slate-600">
//                   {user.is_first_login ? (
//                     <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-sm font-semibold">
//                       Chưa đổi mật khẩu
//                     </span>
//                   ) : (
//                     <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-sm font-semibold">
//                       Đã kích hoạt
//                     </span>
//                   )}
//                 </td>
//                 <td className="px-6 py-4 text-right">
//                   <button
//                     onClick={() => handleDeleteUser(user.id, user.email)} 
//                     className="text-slate-400 hover:text-red-500 transition-colors"
//                     title="Xóa nhân viên">
//                     <Trash2 className="w-5 h-5" />
//                   </button>
//                 </td>
//               </tr>
//             ))}
//             {/* Hiển thị nếu chưa có nhân viên nào */}
//             {users.length === 0 && (
//               <tr>
//                 <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
//                   Chưa có nhân viên nào trong hệ thống.
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }

import { redirect } from 'next/navigation';

export default function UserHomePage() {
  redirect('/user/inventory');
}