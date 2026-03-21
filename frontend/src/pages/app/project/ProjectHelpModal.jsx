import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiBookOpen, FiFileText, FiX } from "react-icons/fi";
import "../../../styles/help.css";

export default function ProjectHelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const manualUrl = "/manuals/user-manual.pdf";
  const tutorialUrl = "/manuals/tutorial.pdf";

  const handleViewManual = () => {
    window.open(manualUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadManual = () => {
    const link = document.createElement("a");
    link.href = manualUrl;
    link.download = "user-manual.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewTutorial = () => {
    window.open(tutorialUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadTutorial = () => {
    const link = document.createElement("a");
    link.href = tutorialUrl;
    link.download = "tutorial.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return createPortal(
    <div
      className="help-modal__overlay"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="help-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Project help"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="help-header">
          <div className="help-header__content">
            <h1 className="help-title">Help</h1>
            {/* <p className="help-subtitle">
              User manual and tutorial PDFs in one place.
            </p> */}
          </div>

          <button
            type="button"
            className="help-close-btn"
            onClick={onClose}
            aria-label="Close help"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="help-simple-grid">
          <div className="help-simple-card">
            <div className="help-simple-icon">
              <FiBookOpen />
            </div>
            <h3>User Manual</h3>
            <p>Open or download the system user manual.</p>
            <div className="help-simple-actions">
              <button type="button" onClick={handleViewManual}>
                View
              </button>
              <button type="button" onClick={handleDownloadManual}>
                Download
              </button>
            </div>
          </div>

          <div className="help-simple-card">
            <div className="help-simple-icon">
              <FiFileText />
            </div>
            <h3>Tutorial PDF</h3>
            <p>Open or download the tutorial guide in PDF format.</p>
            <div className="help-simple-actions">
              <button type="button" onClick={handleViewTutorial}>
                View
              </button>
              <button type="button" onClick={handleDownloadTutorial}>
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
