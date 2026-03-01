import React, { useEffect, useRef } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'

export default function ProjectSearchPanel({
  open,
  query,
  onQueryChange,
  onClose,
  onSelectResult,
  results = [],
  loading = false,
  error = '',
  isRemoteEnabled = false,
}) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="project-search__overlay" onClick={() => onClose?.()}>
      <div className="project-search__panel" onClick={(event) => event.stopPropagation()}>
        <div className="project-search__header">
          <FiSearch size={18} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            placeholder="Search sections, tags, files, visualizations..."
          />
          <button type="button" onClick={() => onClose?.()} aria-label="Close search">
            <FiX size={16} />
          </button>
        </div>

        <div className="project-search__results">
          {!query.trim() && (
            <div className="project-search__hint">Type to search this project.</div>
          )}
          {query.trim() && !isRemoteEnabled && (
            <div className="project-search__hint">Type at least 2 characters for deep search.</div>
          )}
          {loading && <div className="project-search__hint">Searching...</div>}
          {!loading && !!error && <div className="project-shell__error">{error}</div>}
          {!loading && !error && query.trim() && !results.length && (
            <div className="project-search__hint">No results found.</div>
          )}

          {results.map((item) => (
            <button
              key={`${item?.kind || 'item'}:${item?.id || item?.route || item?.title}`}
              type="button"
              className="project-search__result"
              onClick={() => onSelectResult?.(item)}
            >
              <div className="project-search__result-main">
                <div className="project-search__result-title">{item?.title || 'Untitled'}</div>
                <div className="project-search__result-subtitle">{item?.subtitle || ''}</div>
              </div>
              <span className="project-search__result-kind">{item?.kind || 'item'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
