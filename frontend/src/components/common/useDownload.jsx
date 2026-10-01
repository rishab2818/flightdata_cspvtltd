import { useState, useCallback } from "react";
import { openFilePreview } from "../../utils/filePreview";

/**
 * Generic per-file download hook
 * @param apiFn - function(recordId) => { download_url, original_name }
 */
export const useDownload = (apiFn) => {
  const [loadingFiles, setLoadingFiles] = useState({}); // { [recordId]: true/false }
  const [errorFiles, setErrorFiles] = useState({});     // { [recordId]: "Error message" }

  const setLoading = (recordId, value) =>
    setLoadingFiles((prev) => ({ ...prev, [recordId]: value }));

  const setError = (recordId, msg) =>
    setErrorFiles((prev) => ({ ...prev, [recordId]: msg }));

  // ------------------ Download ------------------
  const download = useCallback(
    async (recordId, filename) => {
      if (!recordId) return;
      setLoading(recordId, true);
      setError(recordId, "");
      try {
        const res = await apiFn(recordId);

        if (!res?.download_url) throw new Error("No download URL");

        // Fetch file as blob to force download
        const response = await fetch(res.download_url);
        if (!response.ok) throw new Error("Failed to fetch file");

        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename || res.original_name || "file";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);

      } catch (err) {
        console.error("Download error:", err);
        setError(recordId, "Download failed");
      } finally {
        setLoading(recordId, false);
      }
    },
    [apiFn]
  );

  // ------------------ View ------------------
  const view = useCallback(
    async (recordId) => {
      if (!recordId) return;
      setLoading(recordId, true);
      setError(recordId, "");
      try {
        const res = await apiFn(recordId);

        if (!res?.download_url) throw new Error("No download URL");

        await openFilePreview(res.download_url);

      } catch (err) {
        console.error("View error:", err);
        setError(recordId, "Unable to view file");
      } finally {
        setLoading(recordId, false);
      }
    },
    [apiFn]
  );

 



  return { download, view, loadingFiles, errorFiles };
};
