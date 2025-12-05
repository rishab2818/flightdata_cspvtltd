// src/api/documentsApi.js
import { axiosClient } from "../lib/axiosClient";

export const documentsApi = {
  // List only *my* Minutes of Meeting documents for a specific subsection
  listMinutes: async (subsection) => {
    const params = { section: "minutes_of_meeting" };
    if (subsection) {
      params.subsection = subsection; // "tcm" | "pmrc" | "ebm" | "gdm"
    }
    const { data } = await axiosClient.get("/api/documents", { params });
    return data;
  },

  // Generic list by section (no subsection)
  listBySection: async (section) => {
    const params = { section }; // e.g. "inventory_records"
    const { data } = await axiosClient.get("/api/documents", { params });
    return data; // array of UserDocumentOut
  },

  // Step 1: ask backend for presigned upload URL
  initUpload: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/documents/init-upload",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    return data; // { upload_url, storage_key, bucket, expires_in }
  },

  // Step 3: confirm upload & register metadata
  confirmUpload: async (payload) => {
    const { data } = await axiosClient.post(
      "/api/documents/confirm",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    return data; // one UserDocumentOut
  },

  // Get a presigned download URL
  getDownloadUrl: async (docId) => {
    const { data } = await axiosClient.get(
      `/api/documents/${docId}/download-url`
    );
    return data; // { download_url, original_name, content_type, expires_in }
  },

  searchAssignees: async (query) => {
    const params = { q: query };
    const { data } = await axiosClient.get("/api/documents/assignees", {
      params,
    });
    return data; // string[]
  },

  // Hard delete document
  remove: async (docId) => {
    const { data } = await axiosClient.delete(`/api/documents/${docId}`);
    return data; // { ok: true }
  },
};
