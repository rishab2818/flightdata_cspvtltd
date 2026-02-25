// import React, { useEffect, useState } from "react";
// import { useParams } from "react-router-dom";
// import { projectApi } from "../../../api/projectapi";

// export default function ProjectMembersPage() {
//   const { projectId } = useParams();
//   const [members, setMembers] = useState([]);

//   useEffect(() => {
//     loadMembers();
//   }, [projectId]);

//   const loadMembers = async () => {
//     try {
//       const data = await projectApi.getMembers(projectId);
//       setMembers(data || []);
//     } catch (err) {
//       console.error("Failed to load members");
//     }
//   };

//   return (
//     <div>
//       <h2>Project Members</h2>

//       <table style={{ width: "100%" }}>
//         <thead>
//           <tr>
//             <th>Name</th>
//             <th>Email</th>
//             <th>Role</th>
//           </tr>
//         </thead>

//         <tbody>
//           {members.map((m) => (
//             <tr key={m.email}>
//               <td>{m.first_name} {m.last_name}</td>
//               <td>{m.email}</td>
//               <td>{m.role}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }