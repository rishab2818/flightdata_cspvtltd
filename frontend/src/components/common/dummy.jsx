// import React, { useState } from "react";
// import Info from '../../assets/info.svg'

// const InfoButton = ({ message }) => {
//   const [show, setShow] = useState(false);

//   return (
//     <span
//       style={{ position: "relative", marginLeft: "6px", cursor: "pointer" }}
//       onMouseEnter={() => setShow(true)}
//       onMouseLeave={() => setShow(false)}
//     >
//     <img style={{width:"18px", height:"18px", fontWeight:"bold"}} src={Info} alt="info" />

//       {show && (
//         <div
//           style={{
//             position: "absolute",
//             top: "22px",
//             left: "0",
//             background: "#f3f3f5",
//             color: "#000000",
//             padding: "6px 10px",
//             borderRadius: "4px",
//             fontSize: "12px",
//             whiteSpace: "nowrap",
//             zIndex: 999,
//           }}
//         >
//           {message}
//         </div>
//       )}
//     </span>
//   );
// };

// export default InfoButton;