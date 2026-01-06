// // src/utils/documentActions.js
// import { documentsApi } from "../api/documentsApi";

// export const viewDocument = async (docId) => {
//     try {
//         const res = await documentsApi.getDownloadUrl(docId);
//         const url = res?.download_url;
//         if (!url) throw new Error("No view URL");

//         window.open(url, "_blank", "noopener,noreferrer");
//     } catch (err) {
//         console.error("View failed:", err);
//         alert("Failed to preview file.");
//     }
// };

// export const downloadDocument = async (docId, fileName = "document") => {
//     try {
//         const res = await documentsApi.getDownloadUrl(docId);
//         const url = res?.download_url;
//         if (!url) throw new Error("No download URL");

//         const link = document.createElement("a");
//         link.href = url;
//         link.download = fileName;
//         link.click();
//         link.remove();
//     } catch (err) {
//         console.error("Download failed:", err);
//         alert("Failed to download.");
//     }
// };

// export const deleteDocument = async (docId, removeFromUI) => {
//     if (!window.confirm("Confirm delete?")) return;

//     try {
//         await documentsApi.remove(docId);
//         if (removeFromUI) removeFromUI(docId);
//     } catch (err) {
//         console.error("Delete failed:", err);
//         alert("Delete error");
//     }
// };
import { documentsApi } from "../api/documentsApi";
import { recordsApi } from "../api/recordsApi";

const getClient = (id) => {
    // Adjust based on your backend ID formats!
    if (String(id).startsWith("inv_")) return recordsApi;
    return documentsApi;
};

export const viewDocument = async (docId) => {
    try {
        const api = getClient(docId);
        const res = await api.getDownloadUrl(docId);
        const url = res?.download_url;
        if (!url) throw new Error("No view URL");

        window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
        alert("Failed to preview file.");
    }
};

export const downloadDocument = async (docId, fileName = "document") => {
    try {
        const api = getClient(docId);
        const res = await api.getDownloadUrl(docId);
        const link = document.createElement("a");
        link.href = res.download_url;
        link.download = fileName;
        link.click();
        link.remove();
    } catch (err) {
        alert("Failed to download.");
    }
};

export const deleteDocument = async (docId, removeFromUI) => {
    if (!window.confirm("Confirm delete?")) return;

    try {
        const api = getClient(docId);
        await api.remove(docId);
        removeFromUI?.(docId);
    } catch (err) {
        alert("Delete error");
    }
};
