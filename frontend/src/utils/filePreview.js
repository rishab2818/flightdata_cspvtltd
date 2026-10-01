/**
 * Opens a file for viewing without inheriting the storage server's
 * Content-Disposition: attachment header. Download flows must use their own
 * anchor/download logic instead.
 */
export async function openFilePreview(url) {
  if (!url) throw new Error("No file URL");

  // Reserve the tab synchronously so popup blockers do not reject an async open.
  // `noopener` makes some browsers return a null window reference. We need the
  // reference to replace the reserved tab after the asynchronous fetch.
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) throw new Error("Popup blocked");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Unable to fetch file");

    const blobUrl = URL.createObjectURL(await response.blob());
    previewWindow.location.replace(blobUrl);
    previewWindow.opener = null;
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}
