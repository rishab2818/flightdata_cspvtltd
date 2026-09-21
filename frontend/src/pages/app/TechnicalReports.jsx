import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { recordsApi } from "../../api/recordsApi";
import { computeSha256 } from "../../lib/fileUtils";

import totalRecordsIcon from "../../assets/bule_message.svg";
import technicalIcon from "../../assets/setting_black.svg";
import designicon from "../../assets/design_black.svg";
import Report1 from "../../assets/Report1.svg";
import load from "../../assets/load.svg";

import FileUploadBox from "../../components/common/FileUploadBox";
import DocumentActions from "../../components/common/DocumentActions";
import EmptySection from "../../components/common/EmptyProject";
import CommonStatCard from "../../components/common/common_card/common_card";

import { FiSearch } from "react-icons/fi";

import ConfirmationModal from "../../components/common/ConfirmationModal";

import { useLazyCollection } from "../../hooks/useLazyCollection";
import { useInfiniteScrollTrigger } from "../../hooks/useInfiniteScrollTrigger";

import FilterField from "../../components/common/FilterField";

const BORDER = "#E2E8F0";
const PRIMARY = "#1976D2";

const getReportName = (row) =>
  row.report_name ?? row.name ?? "";

const getReportType = (row) =>
  row.type ?? row.report_type ?? "";

const getReportNote = (row) =>
  row.note ?? row.description ?? "";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-GB")
    : "—";

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function TechnicalReports() {
  const { projectId } = useParams();

  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    type: "all",
  });

  const [showModal, setShowModal] =
    useState(false);

  const [editingRecord, setEditingRecord] =
    useState(null);

  const [
    showDeleteModal,
    setShowDeleteModal,
  ] = useState(false);

  const [
    recordToDelete,
    setRecordToDelete,
  ] = useState(null);

  /* =========================================================
     FETCH RECORDS
  ========================================================= */

  const fetchRecordsPage =
    React.useCallback(
      async ({ page, limit }) => {
        const data =
          await recordsApi.listTechnical(
            projectId,
            {
              page,
              limit,
            }
          );

        return data || [];
      },
      [projectId]
    );

  const {
    items: records,

    setItems: setRecords,

    loading,

    loadingMore,

    error,

    hasMore,

    loadMore,
  } = useLazyCollection({
    fetchPage: fetchRecordsPage,

    deps: [projectId],

    errorMessage:
      "Failed to load technical reports.",
  });

  const loadMoreRef =
    useInfiniteScrollTrigger({
      hasMore,

      isLoading:
        loading || loadingMore,

      onLoadMore: loadMore,
    });

  /* =========================================================
     FILTER
  ========================================================= */

  const filtered = useMemo(() => {
    const searchText =
      search.toLowerCase();

    return records.filter(
      (row) => {
        const typeMatch =
          filters.type === "all" ||
          getReportType(row) ===
            filters.type;

        const searchMatch =
          getReportName(row)
            .toLowerCase()
            .includes(searchText);

        return (
          typeMatch &&
          searchMatch
        );
      }
    );
  }, [
    records,
    filters,
    search,
  ]);

  /* =========================================================
     VIEW
  ========================================================= */

  const handleView = async (row) => {
    try {
      const res =
        await recordsApi.downloadTechnical(
          row.record_id
        );

      window.open(
        res.download_url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      alert(
        "Unable to open this record."
      );
    }
  };

  /* =========================================================
     DOWNLOAD
  ========================================================= */

  const handleDownload =
    async (row) => {
      try {
        const res =
          await recordsApi.downloadTechnical(
            row.record_id
          );

        const link =
          document.createElement("a");

        link.href =
          res.download_url;

        link.download =
          row.original_name ||
          "technical-report";

        link.click();

        link.remove();
      } catch (err) {
        alert(
          "Download failed. Please try again."
        );
      }
    };

  /* =========================================================
     EDIT
  ========================================================= */

  const handleEdit = (row) => {
    setEditingRecord(row);

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);

    setEditingRecord(null);
  };

  const handleUpdate = (
    updatedRecord
  ) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.record_id ===
        updatedRecord.record_id
          ? updatedRecord
          : record
      )
    );
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const confirmDelete =
    async () => {
      if (!recordToDelete) {
        return;
      }

      try {
        await recordsApi.removeTechnical(
          recordToDelete.record_id
        );

        setRecords(
          (prev) =>
            prev.filter(
              (record) =>
                record.record_id !==
                recordToDelete.record_id
            )
        );
      } catch (err) {
        alert(
          "Unable to delete record."
        );
      }

      setShowDeleteModal(false);

      setRecordToDelete(null);
    };

  /* =========================================================
     CREATE
  ========================================================= */

  const handleCreated = (
    newRecord
  ) => {
    setRecords((prev) => [
      newRecord,
      ...prev,
    ]);
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      style={{
        width: "100%",

        maxWidth: 1640,

        margin: "0 auto",

        height: "100%",

        gap: "10px",

        borderRadius: "8px",
      }}
    >
      {/* =====================================================
          STAT CARDS
      ====================================================== */}

      <div
        style={{
          borderRadius:
            "8px",

          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(200px,1fr))",

          gap:
            "24px",
        }}
      >
        <CommonStatCard
          title="Total Records"

          value={
            records.length
          }

          icon={
            totalRecordsIcon
          }

          bg="#DBEAFE"
        />

        <CommonStatCard
          title="Technical"

          value={
            records.filter(
              (record) =>
                getReportType(
                  record
                ) ===
                "Technical"
            ).length
          }

          icon={
            technicalIcon
          }

          bg="#F3E8FF"
        />

        <CommonStatCard
          title="Design"

          value={
            records.filter(
              (record) =>
                getReportType(
                  record
                ) ===
                "Design"
            ).length
          }

          icon={
            designicon
          }

          bg="#DCFCE7"
        />
      </div>

      {/* =====================================================
          SEARCH / FILTER / UPLOAD TOOLBAR
      ====================================================== */}

      <div
        style={{
          marginTop:
            22,

          width:
            "100%",

          background:
            "#ffffff",

          border: `1px solid ${BORDER}`,

          borderRadius:
            "8px",

          padding:
            "24px",

          boxSizing:
            "border-box",

          display:
            "grid",

          /*
           * Search consumes remaining width.
           * Filter = 300px
           * Upload = 200px
           */

          gridTemplateColumns:
            "minmax(300px, 1fr) 300px 200px",

          alignItems:
            "end",

          /* REQUIRED GAP */

          columnGap:
            "16px",
        }}
      >
        {/* SEARCH */}

        <FilterField
          label="Search"

          style={{
            width:
              "100%",

            minWidth:
              0,
          }}
        >
          <div
            style={{
              width:
                "100%",

              height:
                "42px",

              display:
                "flex",

              alignItems:
                "center",

              gap:
                8,

              background:
                "#f8fafc",

              border:
                "1px solid #e2e8f0",

              borderRadius:
                "0px",

              padding:
                "0 24px",

              boxSizing:
                "border-box",
            }}
          >
            <FiSearch
              size={16}

              color="#64748b"
            />

            <input
              type="text"

              placeholder="Search reports, tags, projects..."

              value={
                search
              }

              onChange={(
                e
              ) =>
                setSearch(
                  e.target
                    .value
                )
              }

              style={{
                width:
                  "100%",

                minWidth:
                  0,

                border:
                  "none",

                outline:
                  "none",

                background:
                  "transparent",

                flex:
                  1,

                fontSize:
                  "14px",

                color:
                  "#0f172a",
              }}
            />
          </div>
        </FilterField>

        {/* FILTER TYPE */}

        <FilterField
          label="Filter by Type"

          style={{
            width:
              "100%",

            minWidth:
              0,
          }}
        >
          <select
            value={
              filters.type
            }

            onChange={(
              e
            ) =>
              setFilters({
                type:
                  e.target
                    .value,
              })
            }

            style={{
              width:
                "100%",

              height:
                "42px",

              background:
                "#F3F3F5",

              borderRadius:
                "8px",

              border:
                "none",

              padding:
                "0 32px 0 12px",

              color:
                "#374151",

              fontSize:
                14,

              lineHeight:
                "36px",

              boxSizing:
                "border-box",

              appearance:
                "none",

              WebkitAppearance:
                "none",

              MozAppearance:
                "none",

              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,

              backgroundRepeat:
                "no-repeat",

              backgroundPosition:
                "right 12px center",

              backgroundSize:
                "10px 6px",
            }}
          >
            <option value="all">
              All Types
            </option>

            <option value="Technical">
              Technical
            </option>

            <option value="Design">
              Design
            </option>

            <option value="Other">
              Other
            </option>
          </select>
        </FilterField>

        {/* UPLOAD BUTTON */}

        <button
          type="button"

          onClick={() => {
            setEditingRecord(
              null
            );

            setShowModal(
              true
            );
          }}

          style={{
            width:
              "100%",

            height:
              "42px",

            padding:
              "10px 16px",

            background:
              PRIMARY,

            color:
              "#ffffff",

            border:
              "none",

            borderRadius:
              "4px",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            gap:
              8,

            fontWeight:
              600,

            cursor:
              "pointer",

            boxSizing:
              "border-box",
          }}
        >
          <img
            src={
              Report1
            }

            alt="Document"
          />

          Upload Document
        </button>
      </div>

      {/* =====================================================
          TABLE
      ====================================================== */}

      <div
        style={{
          marginTop:
            23,

          background:
            "#ffffff",

          border: `1px solid ${BORDER}`,

          borderRadius:
            "8px",

          padding:
            "10px 24px 24px 24px",

          display:
            "flex",

          flexDirection:
            "column",

          height:
            "calc(68vh - 70px)",
        }}
      >
        <div
          style={{
            marginTop:
              10,

            flex:
              1,

            overflowX:
              "auto",

            overflowY:
              "auto",
          }}
        >
          <div
            style={{
              marginBottom:
                10,

              marginLeft:
                5,

              color:
                "#0A0A0A",

              fontSize:
                16,

              fontWeight:
                600,

              fontFamily:
                "Inter-semiBold, Helvetica",
            }}
          >
            Technical Reports
          </div>

          <table
            style={{
              width:
                "100%",

              borderCollapse:
                "separate",

              borderSpacing:
                0,

              border: `1px solid ${BORDER}`,

              borderRadius:
                "8px",

              overflow:
                "hidden",

              minWidth:
                900,

              marginTop:
                "20px",
            }}
          >
            <thead>
              <tr
                style={{
                  color:
                    "#000000",

                  borderBottom: `1px solid ${BORDER}`,

                  position:
                    "sticky",

                  top:
                    0,

                  zIndex:
                    10,

                  textAlign:
                    "left",

                  fontWeight:
                    400,

                  fontSize:
                    "14px",

                  background:
                    "#EFF7FF",
                }}
              >
                {[
                  "Report Name",
                  "Type",
                  "Created Date",
                  "Note",
                  "Action",
                ].map(
                  (
                    col
                  ) => (
                    <th
                      key={
                        col
                      }

                      style={{
                        padding:
                          "12px 16px",

                        fontSize:
                          "14px",

                        fontWeight:
                          500,

                        borderBottom: `1px solid ${BORDER}`,

                        fontFamily:
                          "Inter-Regular, Helvetica",
                      }}
                    >
                      {
                        col
                      }
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody
              style={{
                textAlign:
                  "left",

                fontSize:
                  "12px",

                fontWeight:
                  400,

                color:
                  "#717182",

                fontFamily:
                  "Inter-Regular, Helvetica",
              }}
            >
              {/* LOADING */}

              {loading && (
                <tr>
                  <td
                    colSpan={
                      5
                    }

                    style={{
                      padding:
                        16,

                      textAlign:
                        "center",
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              )}

              {/* ERROR */}

              {!loading &&
                error && (
                  <tr>
                    <td
                      colSpan={
                        5
                      }

                      style={{
                        padding:
                          16,

                        textAlign:
                          "center",

                        color:
                          "#b91c1c",
                      }}
                    >
                      {
                        error
                      }
                    </td>
                  </tr>
                )}

              {/* EMPTY */}

              {!loading &&
                !error &&
                filtered.length ===
                  0 && (
                  <tr
                    style={{
                      height:
                        "250px",
                    }}
                  >
                    <td
                      colSpan={
                        5
                      }

                      style={{
                        padding:
                          0,
                      }}
                    >
                      <div
                        style={{
                          width:
                            "100%",

                          height:
                            "60%",

                          display:
                            "flex",

                          alignItems:
                            "center",

                          justifyContent:
                            "center",

                          padding:
                            "40px 0",
                        }}
                      >
                        <EmptySection />
                      </div>
                    </td>
                  </tr>
                )}

              {/* RECORDS */}

              {!loading &&
                !error &&
                filtered.map(
                  (
                    row,
                    index
                  ) => {
                    const isLast =
                      index ===
                      filtered.length -
                        1;

                    return (
                      <tr
                        key={
                          row.record_id
                        }
                      >
                        {/* REPORT NAME */}

                        <td
                          style={{
                            padding:
                              "12px 16px",

                            fontWeight:
                              600,

                            borderBottom:
                              isLast
                                ? "none"
                                : `1px solid ${BORDER}`,
                          }}
                        >
                          {getReportName(
                            row
                          )}
                        </td>

                        {/* TYPE */}

                        <td
                          style={{
                            padding:
                              "12px 16px",

                            color:
                              "#475569",

                            borderBottom:
                              isLast
                                ? "none"
                                : `1px solid ${BORDER}`,

                            width:
                              "200px",
                          }}
                        >
                          {getReportType(
                            row
                          )}
                        </td>

                        {/* CREATED DATE */}

                        <td
                          style={{
                            padding:
                              "12px 16px",

                            borderBottom:
                              isLast
                                ? "none"
                                : `1px solid ${BORDER}`,
                          }}
                        >
                          {formatDate(
                            row.created_date
                          )}
                        </td>

                        {/* NOTE */}

                        <td
                          style={{
                            padding:
                              "12px 16px",

                            borderBottom:
                              isLast
                                ? "none"
                                : `1px solid ${BORDER}`,
                          }}
                        >
                          {getReportNote(
                            row
                          )}
                        </td>

                        {/* ACTION */}

                        <td
                          style={{
                            padding:
                              "12px 16px",

                            borderBottom:
                              isLast
                                ? "none"
                                : `1px solid ${BORDER}`,
                          }}
                        >
                          <DocumentActions
                            doc={{
                              id:
                                row.record_id,

                              fileName:
                                row.original_name,
                            }}

                            onEdit={() =>
                              handleEdit(
                                row
                              )
                            }

                            onView={() =>
                              handleView(
                                row
                              )
                            }

                            onDownload={() =>
                              handleDownload(
                                row
                              )
                            }

                            onDelete={() => {
                              setRecordToDelete(
                                row
                              );

                              setShowDeleteModal(
                                true
                              );
                            }}
                          />
                        </td>
                      </tr>
                    );
                  }
                )}
            </tbody>
          </table>

          {/* =================================================
              INFINITE SCROLL
          ================================================== */}

          {hasMore &&
            !error && (
              <div
                ref={
                  loadMoreRef
                }

                style={{
                  height:
                    1,
                }}
              />
            )}

          {loadingMore && (
            <div
              style={{
                paddingTop:
                  8,

                textAlign:
                  "center",

                color:
                  "#64748b",
              }}
            >
              Loading more...
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          REPORT MODAL
      ====================================================== */}

      {showModal && (
        <ReportModal
          onClose={
            closeModal
          }

          onCreated={
            handleCreated
          }

          editingRecord={
            editingRecord
          }

          onUpdated={
            handleUpdate
          }

          projectId={
            projectId
          }
        />
      )}

      {/* =====================================================
          DELETE CONFIRMATION
      ====================================================== */}

      {showDeleteModal && (
        <ConfirmationModal
          title="Delete this technical report?"

          onCancel={() => {
            setShowDeleteModal(
              false
            );

            setRecordToDelete(
              null
            );
          }}

          onConfirm={
            confirmDelete
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   INPUT COMPONENT
========================================================= */

function Input({
  label,
  style,
  ...rest
}) {
  return (
    <label
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        gap:
          6,
      }}
    >
      <span
        style={{
          color:
            "#475569",

          fontSize:
            14,

          fontWeight:
            400,
        }}
      >
        {label}
      </span>

      <input
        {...rest}

        style={{
          height:
            40,

          borderRadius:
            "8px",

          border: `1px solid ${BORDER}`,

          padding:
            "0 12px",

          background:
            "#F3F3F5",

          ...style,
        }}
      />
    </label>
  );
}

/* =========================================================
   REPORT MODAL
========================================================= */

function ReportModal({
  onClose,
  onCreated,
  onUpdated,
  editingRecord,
  projectId,
}) {
  const [
    form,
    setForm,
  ] = useState({
    name:
      "",

    report_type:
      "Technical",

    created_date:
      "",

    description:
      "",

    rating:
      "",
  });

  const [file, setFile] =
    useState(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =========================================================
     FORM CHANGE
  ========================================================= */

  const onChange = (
    key,
    value
  ) =>
    setForm(
      (prev) => ({
        ...prev,

        [key]:
          value,
      })
    );

  /* =========================================================
     LOAD EDIT RECORD
  ========================================================= */

  useEffect(() => {
    if (editingRecord) {
      setForm({
        name:
          editingRecord.name ||
          "",

        description:
          editingRecord.description ||
          "",

        report_type:
          editingRecord.report_type ||
          "Technical",

        created_date:
          editingRecord.created_date
            ? editingRecord.created_date.split(
                "T"
              )[0]
            : "",

        rating:
          editingRecord.rating ??
          "",
      });

      setFile(null);

      setError("");
    }
  }, [
    editingRecord,
  ]);

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      setError("");

      if (
        !editingRecord &&
        !file
      ) {
        setError(
          "Please select a file to upload."
        );

        return;
      }

      try {
        setSubmitting(
          true
        );

        const filePayload =
          {};

        /* ===============================================
           FILE UPLOAD
        =============================================== */

        if (file) {
          const content_hash =
            await computeSha256(
              file
            );

          const initRes =
            await recordsApi.initUpload(
              "technical-reports",
              {
                section:
                  "technical-reports",

                filename:
                  file.name,

                content_type:
                  file.type ||
                  "application/octet-stream",

                size_bytes:
                  file.size,

                content_hash,
              }
            );

          await fetch(
            initRes.upload_url,
            {
              method:
                "PUT",

              body:
                file,
            }
          );

          filePayload.storage_key =
            initRes.storage_key;

          filePayload.original_name =
            file.name;

          filePayload.content_type =
            file.type ||
            "application/octet-stream";

          filePayload.size_bytes =
            file.size;

          filePayload.content_hash =
            content_hash;
        }

        /* ===============================================
           PAYLOAD
        =============================================== */

        const payload = {
          ...form,

          project_id:
            projectId ||
            undefined,

          created_date:
            form.created_date ||
            undefined,

          ...filePayload,
        };

        let result;

        /* ===============================================
           UPDATE
        =============================================== */

        if (
          editingRecord
        ) {
          result =
            await recordsApi.updateTechnical(
              editingRecord.record_id,
              payload
            );

          onUpdated?.(
            result
          );
        }

        /* ===============================================
           CREATE
        =============================================== */

        else {
          result =
            await recordsApi.createTechnical(
              payload
            );

          onCreated?.(
            result
          );
        }

        onClose();
      } catch (err) {
        console.error(
          err
        );

        setError(
          "Failed to save report."
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  /* =========================================================
     MODAL UI
  ========================================================= */

  return (
    <div
      style={{
        position:
          "fixed",

        inset:
          0,

        background:
          "rgba(15,23,42,0.4)",

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          12,

        zIndex:
          100,
      }}
    >
      <div
        style={{
          width:
            "min(840px, 96vw)",

          background:
            "#ffffff",

          borderRadius:
            12,

          padding:
            "24px 28px",

          boxShadow:
            "0 30px 70px rgba(15,23,42,0.25)",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            height:
              50,

            alignItems:
              "center",

            flexShrink:
              0,

            marginTop:
              "-10px",
          }}
        >
          <div>
            <h3
              style={{
                margin:
                  0,
              }}
            >
              {editingRecord
                ? "Edit Report"
                : "Upload Report"}
            </h3>

            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#64748B",
              }}
            >
              Add report metadata and attach your document.
            </p>
          </div>

          <button
            type="button"

            onClick={
              onClose
            }

            style={{
              border: `1px solid ${BORDER}`,

              background:
                "#ffffff",

              borderRadius:
                "8px",

              cursor:
                "pointer",

              width:
                30,

              height:
                30,

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",
            }}
          >
            X
          </button>
        </div>

        {/* =================================================
            FORM
        ================================================== */}

        <form
          onSubmit={
            handleSubmit
          }

          style={{
            marginTop:
              16,

            display:
              "flex",

            flexDirection:
              "column",

            gap:
              14,

            overflowY:
              "auto",

            maxHeight:
              "70vh",
          }}
        >
          {/* FILE */}

          <FileUploadBox
            label="Upload Document"

            description="Attach report document here"

            supported="PDF/Word"

            file={
              file
            }

            onFileSelected={(
              selectedFile
            ) =>
              setFile(
                selectedFile
              )
            }

            currentFileName={
              editingRecord &&
              !file
                ? editingRecord.original_name
                : null
            }
          />

          {/* FORM GRID */}

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",

              gap:
                12,
            }}
          >
            {/* REPORT NAME */}

            <Input
              label="Report Name"

              value={
                form.name
              }

              onChange={(
                e
              ) =>
                onChange(
                  "name",
                  e.target
                    .value
                )
              }
            />

            {/* TYPE */}

            <label
              style={{
                display:
                  "flex",

                flexDirection:
                  "column",

                gap:
                  6,
              }}
            >
              <span
                style={{
                  color:
                    "#475569",

                  fontSize:
                    13,

                  fontWeight:
                    400,
                }}
              >
                Type
              </span>

              <select
                value={
                  form.report_type
                }

                onChange={(
                  e
                ) =>
                  onChange(
                    "report_type",
                    e.target
                      .value
                  )
                }

                style={{
                  height:
                    40,

                  borderRadius:
                    8,

                  border: `1px solid ${BORDER}`,

                  padding:
                    "0 32px 0 12px",

                  background:
                    "#F3F3F5",

                  color:
                    "#374151",

                  fontSize:
                    14,

                  lineHeight:
                    "36px",

                  appearance:
                    "none",

                  WebkitAppearance:
                    "none",

                  MozAppearance:
                    "none",

                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23777' stroke-width='2' fill='none' stroke-linecap='round'/></svg>")`,

                  backgroundRepeat:
                    "no-repeat",

                  backgroundPosition:
                    "right 12px center",

                  backgroundSize:
                    "10px 6px",
                }}
              >
                <option value="Technical">
                  Technical
                </option>

                <option value="Design">
                  Design
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </label>

            {/* CREATED DATE */}

            <Input
              label="Created Date"

              type="date"

              value={
                form.created_date
              }

              onChange={(
                e
              ) =>
                onChange(
                  "created_date",
                  e.target
                    .value
                )
              }

              style={{
                borderRadius:
                  "8px",

                background:
                  "#F3F3F5",

                color:
                  "#717182",
              }}
            />
          </div>

          {/* NOTE */}

          <label
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              gap:
                6,
            }}
          >
            <span
              style={{
                color:
                  "#475569",

                fontSize:
                  13,

                fontWeight:
                  400,
              }}
            >
              Note
            </span>

            <textarea
              value={
                form.description
              }

              onChange={(
                e
              ) =>
                onChange(
                  "description",
                  e.target
                    .value
                )
              }

              rows={
                3
              }

              maxLength={
                500
              }

              style={{
                borderRadius:
                  8,

                border: `1px solid ${BORDER}`,

                padding:
                  10,

                background:
                  "#F3F3F5",

                resize:
                  "none",
              }}
            />

            <div
              style={{
                fontSize:
                  12,

                textAlign:
                  "right",

                color:
                  (
                    form.description ||
                    ""
                  ).length >
                  180
                    ? "red"
                    : "#666",
              }}
            >
              {
                (
                  form.description ||
                  ""
                ).length
              }
              /500
            </div>
          </label>

          {/* ERROR */}

          {error && (
            <p
              style={{
                color:
                  "#d32f2f",

                fontSize:
                  "14px",

                fontFamily:
                  "Inter, sans-serif",

                margin:
                  0,
              }}
            >
              {
                error
              }
            </p>
          )}

          {/* BUTTONS */}

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "flex-end",

              gap:
                12,
            }}
          >
            <button
              type="button"

              onClick={
                onClose
              }

              style={{
                border:
                  "1px solid #1976D2",

                color:
                  "#1976d2",

                background:
                  "#ffffff",

                padding:
                  "10px 16px",

                borderRadius:
                  "4px",

                cursor:
                  "pointer",

                width:
                  "100px",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"

              disabled={
                submitting
              }

              style={{
                border:
                  "none",

                background:
                  PRIMARY,

                color:
                  "#ffffff",

                padding:
                  "10px 18px",

                borderRadius:
                  "4px",

                fontWeight:
                  600,

                cursor:
                  submitting
                    ? "not-allowed"
                    : "pointer",

                opacity:
                  submitting
                    ? 0.7
                    : 1,

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                gap:
                  "8px",
              }}
            >
              <img
                src={
                  load
                }

                alt="load"

                style={{
                  width:
                    "16px",

                  height:
                    "16px",
                }}
              />

              {submitting
                ? "Saving…"
                : editingRecord
                  ? "Update"
                  : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}