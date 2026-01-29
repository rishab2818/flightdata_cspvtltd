// // src/components/Management/Management.jsx
// import React, { useEffect, useState } from "react";
// import { Box, Typography, Button } from "@mui/material";

// import AddUserModal from "./Adduser";
// import PlusIcon from "../../assets/Plus.svg";
// import { usersApi } from "../../api/usersApi";
// import { storage } from "../../lib/storage";

// const Management = () => {
//   const [openModal, setOpenModal] = useState(false);
//   const [users, setUsers] = useState([]);
//   const [loading, setLoading] = useState(true);

//   // ================= FETCH USERS =================
//   const fetchUsers = async () => {
//     setLoading(true);
//     try {
//       const token = storage.getToken();
//       if (!token) {
//         console.error("No JWT token found. Please login first.");
//         setUsers([]);
//         setLoading(false);
//         return;
//       }

//       const data = await usersApi.list();
//       console.log("Fetched users:", data);
//       setUsers(data || []);
//     } catch (err) {
//       console.error("Failed to fetch users:", err.response?.data || err);
//       setUsers([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchUsers();
//   }, []);

//   // ================= CREATE USER =================
//   const handleCreateUser = async (newUser) => {
//     try {
//       await usersApi.create({
//         name: newUser.name,
//         loginId: newUser.loginId,
//         role: newUser.role,
//         password: newUser.password,
//       });
//       await fetchUsers();
//       setOpenModal(false);
//     } catch (err) {
//       console.error("Failed to create user:", err.response?.data || err);
//       alert(err.response?.data?.detail || "Failed to create user");
//     }
//   };

//   return (
//     <Box sx={{ background: "#fff", p: 3, borderRadius: 2 }}>
//       {/* HEADER */}
//       <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
//         <Typography fontWeight={600}>Users Created</Typography>
//         <Button
//           onClick={() => setOpenModal(true)}
//           sx={{
//             background: "#B43D01",
//             color: "#fff",
//             textTransform: "none",
//             "&:hover": { background: "#B43D01" },
//           }}
//         >
//           <img
//             src={PlusIcon}
//             alt="plus"
//             width={14}
//             style={{ marginRight: 6 }}
//           />
//           Add User
//         </Button>
//       </Box>

//       {/* TABLE */}
//       <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
//         <thead>
//           <tr>
//             {["Name", "Role", "Password", "Created"].map((h) => (
//               <th
//                 key={h}
//                 style={{ textAlign: "left", padding: "8px", fontSize: 13 }}
//               >
//                 {h}
//               </th>
//             ))}
//           </tr>
//         </thead>

//         <tbody>
//           {loading ? (
//             <tr>
//               <td colSpan={4} style={{ padding: "12px" }}>
//                 Loading users...
//               </td>
//             </tr>
//           ) : users.length === 0 ? (
//             <tr>
//               <td colSpan={4} style={{ padding: "12px" }}>
//                 No users found
//               </td>
//             </tr>
//           ) : (
//             users.map((u, index) => (
//               <tr key={u.loginId || index}>
//                 <td style={{ padding: "8px" }}>{u.name}</td>
//                 <td style={{ padding: "8px" }}>{u.role}</td>
//                 <td style={{ padding: "8px" }}>******</td>
//                 <td style={{ padding: "8px" }}>
//                   {u.created_at
//                     ? new Date(u.created_at).toLocaleDateString()
//                     : "-"}
//                 </td>
//               </tr>
//             ))
//           )}
//         </tbody>
//       </Box>

//       {/* ADD USER MODAL */}
//       <AddUserModal
//         open={openModal}
//         handleClose={() => setOpenModal(false)}
//         onSubmit={handleCreateUser}
//       />
//     </Box>
//   );
// };

// export default Management;