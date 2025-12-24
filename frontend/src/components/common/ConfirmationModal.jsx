import React from "react";
import DeleteImg from "../../assets/DeleteImg.png";
import styles from "./ConfirmationModal.module.css";

// export default function ConfirmationModal({ title, onCancel, onConfirm }) {
//   const handleConfirm = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     onConfirm();
//   };

//   const handleCancel = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     onCancel();
//   };

//   return (
//     <div className={styles.confirmationOverlay} onClick={handleCancel}>
//       <div
//         className={styles.confirmationBox}
//         onClick={(e) => e.stopPropagation()}   // ✅ FIX
//       >
//         <img src={DeleteImg} alt="delete" width={200} />

//         <h2 className={styles.title}>{title}</h2>

//         <p className={styles.text}>
//           Are you sure you want to delete this record?
//         </p>

//         <div className={styles.modalActions}>
//           <button type="button" onClick={handleCancel}>
//             Cancel
//           </button>

//           <button type="button" onClick={handleConfirm}>
//             YES, DELETE
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

export default function ConfirmationModal({ title, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="modal">
      <h3>{title}</h3> {/* ✅ DO NOT change this */}

      <div className="actions">
        <button onClick={onCancel} disabled={loading}>
          Cancel
        </button>

        <button onClick={handleConfirm} disabled={loading}>
          {loading ? "Deleting…" : "Yes, Delete"}
        </button>
      </div>
    </div>
  );
}
