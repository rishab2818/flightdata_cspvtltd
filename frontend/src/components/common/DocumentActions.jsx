
// // src/components/common/DocumentActions.jsx
// import React, {useState} from "react";
// import { FiEye, FiDownload, FiTrash2, FiEdit2 } from "react-icons/fi";
// import { viewDocument, downloadDocument, deleteDocument } from "../../utils/documentActions";
// import ConfirmationModal from "../../components/common/ConfirmationModal";

// export default function DocumentActions({ doc, onEdit, onView, onDownload, onDelete }) {
//    const [showDeleteModal, setShowDeleteModal] = useState(false);

//   const handleDelete = () => {
//     setShowDeleteModal(true);
//   };
  
//   const handleView = () => {
//     if (onView) return onView(doc);
//     return viewDocument(doc.id);
//   };

//   const handleDownload = () => {
//     if (onDownload) return onDownload(doc);
//     return downloadDocument(doc.id, doc.fileName);
//   };

// const confirmDelete = async () => {
//     try {
//       await onDelete?.(doc);
//     } finally {
//       setShowDeleteModal(false);
//     }
//   };

//   return (
//     <div className="doc-actions">
//       {onEdit && (
//         <button type="button" className="icon-btn" onClick={onEdit} aria-label="Edit">
//           <FiEdit2 size={16} />
//         </button>
//       )}
//       <button type="button" className="icon-btn" onClick={handleView} aria-label="View">
//         <FiEye size={16} />
//       </button>

//       <button
//         type="button"
//         className="icon-btn"
//         onClick={handleDownload}
//         aria-label="Download"
//       >
//         <FiDownload size={16} />
//       </button>

//        <button className="icon-btn" onClick={handleDelete}>
//         <FiTrash2 size={16} />
//       </button>

  

//       {showDeleteModal && (
//         <ConfirmationModal
//           title=""
//           onCancel={() => setShowDeleteModal(false)}
//           onConfirm={confirmDelete}
//         />
//          )}

//       {/* <button
//         type="button"
//         className="icon-btn"
//         onClick={handleDelete}
//         aria-label="Delete"
//       >
//         <FiTrash2 size={16} />
//       </button>

//        {showDeleteModal && (
//         <ConfirmationModal
//           title="Delete Procurement Records"
//           onCancel={() => {
//             setShowDeleteModal(false);
//             setRecordToDelete(null);
//           }}
//           onConfirm={confirmDelete}
//         /> */}
     
//     </div>
//   );
// }

import React from "react";
import { FiEye, FiDownload, FiTrash2, FiEdit2 } from "react-icons/fi";
import Delete from '../../assets/Delete.svg'
import PencilSimple from '../../assets/PencilSimple.svg'
import ViewIcon from '../../assets/ViewIcon.svg'
import DownloadSimple from '../../assets/DownloadSimple.svg'

export default function DocumentActions({
  doc,
  onEdit,
  onView,
  onDownload,
  onDelete
}) {
  return (
    <div className="doc-actions">

      
      <button type="button" onClick={() => onView?.(doc)} style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}>
         <img style={{ width: '20px', height: '20px' }} src={ViewIcon} alt="view" />
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit}  style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}>
          <img style={{ width: '20px', height: '20px' }} src={PencilSimple} alt="edit" />
        </button>
      )}

      <button type="button"  onClick={() => onDownload?.(doc)}  style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}>
        <img style={{ width: '20px', height: '20px' }} src={DownloadSimple} alt="download" />
      </button>

      <button
        type="button"
         style={{ background: '#ffffff', border: '0.67px solid #0000001A', width: '40px', height: '35px', borderRadius: '8px', alignItems: 'center' }}
        onClick={() => onDelete?.(doc.id)}
      >
         <img style={{ width: '20px', height: '20px' }} src={Delete} alt="delete" />
      </button>
    </div>
  );
}
